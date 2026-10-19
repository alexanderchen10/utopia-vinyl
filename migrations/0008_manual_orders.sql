CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('awaiting_payment','paid','preparing_shipment','shipped','cancelled','expired')),
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  customer_note TEXT NOT NULL DEFAULT '',
  transfer_reference TEXT NOT NULL DEFAULT '',
  admin_notes TEXT NOT NULL DEFAULT '',
  tracking_number TEXT NOT NULL DEFAULT '',
  subtotal_twd INTEGER NOT NULL,
  payment_deadline TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT,
  shipped_at TEXT,
  cancelled_at TEXT,
  expired_at TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  title_snapshot TEXT NOT NULL,
  catalog_number_snapshot TEXT NOT NULL DEFAULT '',
  unit_price_twd INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity = 1),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  record_id TEXT NOT NULL,
  reserved_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  released_at TEXT,
  release_reason TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (record_id) REFERENCES records(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS one_active_reservation_per_record
  ON inventory_reservations(record_id) WHERE released_at IS NULL;

CREATE TABLE IF NOT EXISTS order_status_history (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  actor TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_email_queue (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  template TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'test_pending' CHECK (status IN ('test_pending','pending','sending','sent','failed')),
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkout_idempotency (
  idempotency_key TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checkout_rate_limits (
  client_key TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_started_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_status_created_at ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS reservations_expiry ON inventory_reservations(expires_at, released_at);
CREATE INDEX IF NOT EXISTS order_items_order_id ON order_items(order_id);

CREATE TRIGGER IF NOT EXISTS reserve_available_record
BEFORE INSERT ON inventory_reservations
WHEN NEW.released_at IS NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM records
    WHERE id = NEW.record_id AND status = 'published' AND available = 1 AND sold_at IS NULL
  ) THEN RAISE(ABORT, 'RECORD_UNAVAILABLE') END;
END;
CREATE TRIGGER IF NOT EXISTS hide_reserved_record
AFTER INSERT ON inventory_reservations
WHEN NEW.released_at IS NULL
BEGIN
  UPDATE records SET available = 0, updated_at = NEW.reserved_at WHERE id = NEW.record_id;
END;
