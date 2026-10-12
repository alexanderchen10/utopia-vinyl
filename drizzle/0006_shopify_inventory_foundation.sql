ALTER TABLE records ADD COLUMN available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1));
ALTER TABLE records ADD COLUMN shopify_product_id TEXT;
ALTER TABLE records ADD COLUMN shopify_variant_id TEXT;
ALTER TABLE records ADD COLUMN shopify_inventory_item_id TEXT;
ALTER TABLE records ADD COLUMN shopify_sync_status TEXT NOT NULL DEFAULT 'not_configured'
  CHECK (shopify_sync_status IN ('not_configured', 'pending', 'syncing', 'synced', 'failed'));
ALTER TABLE records ADD COLUMN shopify_sync_error TEXT;
ALTER TABLE records ADD COLUMN shopify_sync_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE records ADD COLUMN shopify_next_sync_at TEXT;
ALTER TABLE records ADD COLUMN shopify_synced_at TEXT;
ALTER TABLE records ADD COLUMN sold_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS records_shopify_product_id
  ON records (shopify_product_id) WHERE shopify_product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS records_shopify_variant_id
  ON records (shopify_variant_id) WHERE shopify_variant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS records_shopify_sync_queue
  ON records (shopify_sync_status, shopify_next_sync_at);

CREATE TABLE IF NOT EXISTS shopify_webhook_receipts (
  webhook_id TEXT PRIMARY KEY,
  event_id TEXT,
  topic TEXT NOT NULL,
  shop_domain TEXT NOT NULL,
  received_at TEXT NOT NULL,
  processed_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'ignored', 'failed')),
  error TEXT
);

CREATE INDEX IF NOT EXISTS shopify_webhook_receipts_status
  ON shopify_webhook_receipts (status, received_at);
