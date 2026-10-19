import { env } from 'cloudflare:workers';
import { authorizeAdmin, isSameOriginRequest } from '@/lib/server/admin-auth';
import { listOrders, type OrderStatus } from '@/lib/server/orders';

export const dynamic = 'force-dynamic';
const statuses = new Set<OrderStatus>(['awaiting_payment','paid','preparing_shipment','shipped','cancelled','expired']);

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });
  const status = new URL(request.url).searchParams.get('status') || '';
  return Response.json({ orders: await listOrders(env.DB, statuses.has(status as OrderStatus) ? status : undefined) });
}

export async function PATCH(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ message: '要求無效。' }, { status: 403 });
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });
  const body = await request.json() as { orderId?:string; action?:string; transferReference?:string; adminNotes?:string; trackingNumber?:string };
  const order = body.orderId ? await env.DB.prepare(`SELECT * FROM orders WHERE id = ?`).bind(body.orderId).first<Record<string,string>>() : null;
  if (!order) return Response.json({ message: '找不到訂單。' }, { status: 404 });
  const now = new Date().toISOString();
  const actionMap: Record<string, OrderStatus> = { mark_paid:'paid', prepare:'preparing_shipment', ship:'shipped', cancel:'cancelled' };
  if (body.action === 'resend') {
    await env.DB.prepare(`INSERT INTO order_email_queue (id, order_id, template, recipient, status, created_at) VALUES (?, ?, 'payment_instructions', ?, 'test_pending', ?)`).bind(crypto.randomUUID(), body.orderId, order.customer_email, now).run();
    return Response.json({ message: '測試郵件已加入佇列；尚未對外寄送。' });
  }
  const next = actionMap[body.action || ''];
  if (!next) return Response.json({ message: '操作不正確。' }, { status: 400 });
  if (next === 'cancelled' && ['shipped','cancelled','expired'].includes(order.status)) return Response.json({ message: '此訂單不能取消。' }, { status: 409 });
  const reservations = await env.DB.prepare(`SELECT record_id FROM inventory_reservations WHERE order_id = ? AND released_at IS NULL`).bind(body.orderId).all<{record_id:string}>();
  const statements = [];
  if (next === 'cancelled') {
    statements.push(...reservations.results.map((item) => env.DB.prepare(`UPDATE records SET available = 1, updated_at = ? WHERE id = ? AND status = 'published' AND sold_at IS NULL`).bind(now, item.record_id)));
    statements.push(env.DB.prepare(`UPDATE inventory_reservations SET released_at = ?, release_reason = 'cancelled' WHERE order_id = ? AND released_at IS NULL`).bind(now, body.orderId));
  }
  if (next === 'shipped') {
    statements.push(...reservations.results.map((item) => env.DB.prepare(`UPDATE records SET available = 0, sold_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, item.record_id)));
    statements.push(env.DB.prepare(`UPDATE inventory_reservations SET released_at = ?, release_reason = 'sold' WHERE order_id = ? AND released_at IS NULL`).bind(now, body.orderId));
  }
  statements.push(env.DB.prepare(`UPDATE orders SET status = ?, transfer_reference = ?, admin_notes = ?, tracking_number = ?, updated_at = ?, paid_at = CASE WHEN ? = 'paid' THEN ? ELSE paid_at END, shipped_at = CASE WHEN ? = 'shipped' THEN ? ELSE shipped_at END, cancelled_at = CASE WHEN ? = 'cancelled' THEN ? ELSE cancelled_at END WHERE id = ?`).bind(next, String(body.transferReference || order.transfer_reference).slice(0,80), String(body.adminNotes || order.admin_notes).slice(0,1000), String(body.trackingNumber || order.tracking_number).slice(0,120), now, next, now, next, now, next, now, body.orderId));
  statements.push(env.DB.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, created_at, actor) VALUES (?, ?, ?, ?, '', ?, ?)`).bind(crypto.randomUUID(), body.orderId, order.status, next, now, auth.email));
  if (next === 'paid' || next === 'shipped' || next === 'cancelled') statements.push(env.DB.prepare(`INSERT INTO order_email_queue (id, order_id, template, recipient, status, created_at) VALUES (?, ?, ?, ?, 'test_pending', ?)`).bind(crypto.randomUUID(), body.orderId, next, order.customer_email, now));
  await env.DB.batch(statements);
  return Response.json({ message: '訂單已更新。' });
}
