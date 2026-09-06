export const recordsSchema = `
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    composers TEXT NOT NULL DEFAULT '',
    performers TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category IN ('classical', 'jazz', 'pop', 'taiwan')),
    index_letters TEXT NOT NULL DEFAULT '[]',
    label TEXT NOT NULL DEFAULT '',
    catalog_number TEXT NOT NULL DEFAULT '',
    price TEXT NOT NULL DEFAULT '價格待定',
    condition TEXT NOT NULL DEFAULT '品相待確認',
    image_url TEXT NOT NULL,
    image_key TEXT,
    image_content_type TEXT,
    is_new_arrival INTEGER NOT NULL DEFAULT 1 CHECK (is_new_arrival IN (0, 1)),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS records_status_created_at
    ON records (status, created_at DESC);

  CREATE INDEX IF NOT EXISTS records_category_status
    ON records (category, status);

  CREATE TABLE IF NOT EXISTS record_images (
    record_id TEXT PRIMARY KEY,
    image_blob BLOB NOT NULL,
    content_type TEXT NOT NULL DEFAULT 'image/jpeg',
    created_at TEXT NOT NULL,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS admin_login_attempts (
    attempt_key TEXT PRIMARY KEY,
    failed_attempts INTEGER NOT NULL DEFAULT 0,
    window_started_at INTEGER NOT NULL,
    blocked_until INTEGER NOT NULL DEFAULT 0
  );
`;
