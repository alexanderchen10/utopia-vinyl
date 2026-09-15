CREATE TABLE IF NOT EXISTS admin_ai_usage (
  usage_day TEXT PRIMARY KEY,
  request_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
