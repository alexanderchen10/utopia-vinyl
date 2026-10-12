import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

type ShopifyOrder = {
  line_items?: Array<{ variant_id?: number | string | null }>;
};

function base64(bytes: ArrayBuffer) {
  let binary = '';
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

async function validHmac(body: ArrayBuffer, supplied: string) {
  const secret = env.SHOPIFY_API_SECRET?.trim();
  if (!secret || !supplied) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = base64(await crypto.subtle.sign('HMAC', key, body));
  return constantTimeEqual(expected, supplied);
}

function header(request: Request, name: string) {
  return request.headers.get(name)?.trim() ?? '';
}

export async function POST(request: Request) {
  const rawBody = await request.arrayBuffer();
  if (!(await validHmac(rawBody, header(request, 'x-shopify-hmac-sha256')))) {
    return new Response('Invalid webhook signature', { status: 401 });
  }

  const webhookId = header(request, 'x-shopify-webhook-id');
  const eventId = header(request, 'x-shopify-event-id');
  const topic = header(request, 'x-shopify-topic').toLowerCase();
  const shopDomain = header(request, 'x-shopify-shop-domain').toLowerCase();
  const configuredDomain = env.SHOPIFY_SHOP_DOMAIN?.trim().toLowerCase();
  if (!webhookId || !topic || !shopDomain) {
    return new Response('Missing webhook metadata', { status: 400 });
  }
  if (configuredDomain && shopDomain !== configuredDomain) {
    return new Response('Unexpected shop', { status: 403 });
  }

  const now = new Date().toISOString();
  const inserted = await env.DB.prepare(
    `INSERT OR IGNORE INTO shopify_webhook_receipts
      (webhook_id, event_id, topic, shop_domain, received_at, status)
      VALUES (?, ?, ?, ?, ?, 'processing')`,
  )
    .bind(webhookId, eventId || null, topic, shopDomain, now)
    .run();
  if ((inserted.meta.changes ?? 0) === 0) return new Response('Duplicate', { status: 200 });

  try {
    if (topic !== 'orders/paid') {
      await env.DB.prepare(
        `UPDATE shopify_webhook_receipts
          SET status = 'ignored', processed_at = ? WHERE webhook_id = ?`,
      )
        .bind(now, webhookId)
        .run();
      return new Response('Ignored', { status: 200 });
    }

    const order = JSON.parse(new TextDecoder().decode(rawBody)) as ShopifyOrder;
    const variantIds = Array.from(
      new Set(
        (order.line_items ?? [])
          .map((item) => String(item.variant_id ?? '').trim())
          .filter(Boolean),
      ),
    );
    const statements = variantIds.flatMap((variantId) => [
      env.DB.prepare(
        `UPDATE records SET available = 0, sold_at = ?, updated_at = ?
          WHERE available = 1 AND
            (shopify_variant_id = ? OR shopify_variant_id = ?)`,
      ).bind(now, now, variantId, `gid://shopify/ProductVariant/${variantId}`),
    ]);
    statements.push(
      env.DB.prepare(
        `UPDATE shopify_webhook_receipts
          SET status = 'processed', processed_at = ? WHERE webhook_id = ?`,
      ).bind(now, webhookId),
    );
    await env.DB.batch(statements);
    return new Response('Processed', { status: 200 });
  } catch (error) {
    await env.DB.prepare(
      `UPDATE shopify_webhook_receipts
        SET status = 'failed', error = ? WHERE webhook_id = ?`,
    )
      .bind(String(error).slice(0, 1000), webhookId)
      .run();
    console.error(
      JSON.stringify({ event: 'shopify_webhook_failed', webhookId, topic, error: String(error) }),
    );
    return new Response('Processing failed', { status: 500 });
  }
}
