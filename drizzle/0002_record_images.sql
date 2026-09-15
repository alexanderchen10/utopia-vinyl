CREATE TABLE IF NOT EXISTS record_images (
  record_id TEXT PRIMARY KEY,
  image_blob BLOB NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'image/jpeg',
  created_at TEXT NOT NULL,
  FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
);
