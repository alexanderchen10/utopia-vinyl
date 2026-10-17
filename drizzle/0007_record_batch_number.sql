ALTER TABLE records ADD COLUMN batch_number TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS records_batch_number ON records (batch_number);
CREATE INDEX IF NOT EXISTS records_created_at ON records (created_at DESC);
