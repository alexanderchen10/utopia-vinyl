import { env } from 'cloudflare:workers';

import { paymentInstructions, parseTwdPrice, expireOverdueOrders } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';

type CheckoutBody = {
  recordIds?: unknown;
  idempotencyKey?: unknown;
  customer?: { name?: unknown; email?: unknown; phone?: unknown; address?: unknown; note?: unknown; privacyConsent?: unknown };
};

function clean(value: unknown, limit: number) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

async function clientKey(request: Request) {
  const address = request.headers.get('cf-connecting-ip') || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`checkout:${address}`));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    return Response.json({ message: '結帳要求無效，請重新整理頁面。' }, { status: 403 });
  }
  let body: CheckoutBody;
  try { body = await request.json() as CheckoutBody; }
  catch { return Response.json({ message: '無法讀取訂單資料。' }, { status: 400 }); }

  const recordIds = Array.isArray(body.recordIds)
    ? Array.from(new Set(body.recordIds.filter((id): id is string => typeof id === 'string'))).slice(0, 20)
    : [];
  const idempotencyKey = clean(body.idempotencyKey, 80);
  const name = clean(body.customer?.name, 100);
  const email = clean(body.customer?.email, 160).toLowerCase();
  const phone = clean(body.customer?.phone, 40);
  const address = clean(body.customer?.address, 500);
  const note = clean(body.customer?.note, 500);

  if (!recordIds.length || !idempotencyKey || !name || !phone || !address || !/^\S+@\S+\.\S+$/.test(email) || body.customer?.privacyConsent !== true) {
    return Response.json({ message: '請完整填寫聯絡、寄送資料並同意隱私聲明。' }, { status: 400 });
  }

  await expireOverdueOrders(env.DB);
  const prior = await env.DB.prepare(`SELECT o.* FROM checkout_idempotency ci JOIN orders o ON o.id = ci.order_id WHERE ci.idempotency_key = ?`).bind(idempotencyKey).first();
  if (prior) return Response.json({ order: prior, paymentInstructions });

  const key = await clientKey(request);
  const nowMs = Date.now();
  const rate = await env.DB.prepare(`SELECT request_count, window_started_at FROM checkout_rate_limits WHERE client_key = ?`).bind(key).first<{request_count:number;window_started_at:number}>();
  if (rate && nowMs - rate.window_started_at < 600_000 && rate.request_count >= 8) {
    return Response.json({ message: '結帳嘗試過於頻繁，請稍後再試。' }, { status: 429 });
  }
  await env.DB.prepare(`INSERT INTO checkout_rate_limits (client_key, request_count, window_started_at) VALUES (?, 1, ?) ON CONFLICT(client_key) DO UPDATE SET request_count = CASE WHEN ? - window_started_at >= 600000 THEN 1 ELSE request_count + 1 END, window_started_at = CASE WHEN ? - window_started_at >= 600000 THEN ? ELSE window_started_at END`).bind(key, nowMs, nowMs, nowMs, nowMs).run();

  const placeholders = recordIds.map(() => '?').join(',');
  const records = await env.DB.prepare(`SELECT id, title, catalog_number, price FROM records WHERE id IN (${placeholders}) AND status = 'published' AND available = 1 AND sold_at IS NULL`).bind(...recordIds).all<{id:string;title:string;catalog_number:string;price:string}>();
  if (records.results.length !== recordIds.length) {
    return Response.json({ message: '其中一張唱片剛剛已被保留或售出，請重新整理購物車。' }, { status: 409 });
  }
  const priced = records.results.map((record) => ({ ...record, priceTwd: parseTwdPrice(record.price) }));
  if (priced.some((record) => record.priceTwd === null)) {
    return Response.json({ message: '購物車內有尚未定價的唱片，暫時無法結帳。' }, { status: 400 });
  }

  const orderId = crypto.randomUUID();
  const now = new Date();
  const createdAt = now.toISOString();
  const deadline = new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString();
  const dateCode = createdAt.slice(0, 10).replaceAll('-', '');
  const suffix = String(crypto.getRandomValues(new Uint32Array(1))[0] % 10_000).padStart(4, '0');
  const orderNumber = `UV-${dateCode}-${suffix}`;
  const subtotal = priced.reduce((sum, record) => sum + (record.priceTwd ?? 0), 0);
  try {
    await env.DB.batch([
      env.DB.prepare(`INSERT INTO orders (id, order_number, status, customer_name, customer_email, customer_phone, shipping_address, customer_note, subtotal_twd, payment_deadline, created_at, updated_at) VALUES (?, ?, 'awaiting_payment', ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(orderId, orderNumber, name, email, phone, address, note, subtotal, deadline, createdAt, createdAt),
      ...priced.flatMap((record) => [
        env.DB.prepare(`INSERT INTO order_items (id, order_id, record_id, title_snapshot, catalog_number_snapshot, unit_price_twd, quantity) VALUES (?, ?, ?, ?, ?, ?, 1)`).bind(crypto.randomUUID(), orderId, record.id, record.title, record.catalog_number, record.priceTwd),
        env.DB.prepare(`INSERT INTO inventory_reservations (id, order_id, record_id, reserved_at, expires_at) VALUES (?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), orderId, record.id, createdAt, deadline),
      ]),
      env.DB.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, created_at, actor) VALUES (?, ?, NULL, 'awaiting_payment', '訂單成立並保留全部唱片。', ?, 'customer')`).bind(crypto.randomUUID(), orderId, createdAt),
      env.DB.prepare(`INSERT INTO order_email_queue (id, order_id, template, recipient, status, created_at) VALUES (?, ?, 'payment_instructions', ?, 'test_pending', ?)`).bind(crypto.randomUUID(), orderId, email, createdAt),
      env.DB.prepare(`INSERT INTO checkout_idempotency (idempotency_key, order_id, created_at) VALUES (?, ?, ?)`).bind(idempotencyKey, orderId, createdAt),
    ]);
  } catch (error) {
    const unavailable = String(error).includes('RECORD_UNAVAILABLE') || String(error).includes('UNIQUE');
    console.error(JSON.stringify({ event: 'order_create_failed', orderId, error: String(error) }));
    return Response.json({ message: unavailable ? '其中一張唱片剛剛已被其他客人保留，訂單沒有建立。' : '暫時無法建立訂單，請稍後再試。' }, { status: unavailable ? 409 : 500 });
  }

  return Response.json({ order: { id: orderId, order_number: orderNumber, status: 'awaiting_payment', subtotal_twd: subtotal, payment_deadline: deadline }, paymentInstructions }, { status: 201 });
}
