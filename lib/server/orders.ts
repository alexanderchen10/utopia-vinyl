type Database = D1Database;

export type OrderStatus = 'awaiting_payment' | 'paid' | 'preparing_shipment' | 'shipped' | 'cancelled' | 'expired';

export const paymentInstructions = {
  testMode: true,
  bank: '測試銀行（請勿匯款）',
  account: '000-000000000000',
  note: '目前為測試模式。正式銀行資料會在完整測試及核准後才加入。',
};

export function parseTwdPrice(value: string) {
  const matches = String(value).replace(/,/g, '').match(/\d+(?:\.\d+)?/g);
  if (!matches?.length) return null;
  const amount = Math.round(Number(matches[matches.length - 1]));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export async function expireOverdueOrders(db: Database) {
  const now = new Date().toISOString();
  const due = await db.prepare(`SELECT id FROM orders WHERE status = 'awaiting_payment' AND payment_deadline <= ?`).bind(now).all<{id:string}>();
  for (const row of due.results) {
    const reservations = await db.prepare(`SELECT record_id FROM inventory_reservations WHERE order_id = ? AND released_at IS NULL`).bind(row.id).all<{record_id:string}>();
    await db.batch([
      ...reservations.results.map((item) => db.prepare(`UPDATE records SET available = 1, updated_at = ? WHERE id = ? AND status = 'published' AND sold_at IS NULL`).bind(now, item.record_id)),
      db.prepare(`UPDATE inventory_reservations SET released_at = ?, release_reason = 'expired' WHERE order_id = ? AND released_at IS NULL`).bind(now, row.id),
      db.prepare(`UPDATE orders SET status = 'expired', expired_at = ?, updated_at = ? WHERE id = ? AND status = 'awaiting_payment'`).bind(now, now, row.id),
      db.prepare(`INSERT INTO order_status_history (id, order_id, from_status, to_status, note, created_at, actor) VALUES (?, ?, 'awaiting_payment', 'expired', '48 小時付款期限已到，庫存已自動釋放。', ?, 'system')`).bind(crypto.randomUUID(), row.id, now),
      db.prepare(`INSERT INTO order_email_queue (id, order_id, template, recipient, status, created_at) SELECT ?, id, 'order_expired', customer_email, 'test_pending', ? FROM orders WHERE id = ?`).bind(crypto.randomUUID(), now, row.id),
    ]);
  }
  return due.results.length;
}

export async function listOrders(db: Database, status?: string) {
  await expireOverdueOrders(db);
  const where = status ? 'WHERE o.status = ?' : '';
  const query = db.prepare(`SELECT o.*, GROUP_CONCAT(oi.title_snapshot, '｜') AS item_titles, COUNT(oi.id) AS item_count FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id ${where} GROUP BY o.id ORDER BY o.created_at DESC LIMIT 300`);
  const rows = status ? await query.bind(status).all() : await query.all();
  return rows.results;
}
