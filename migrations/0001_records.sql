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

INSERT OR IGNORE INTO records (
  id, title, composers, performers, category, index_letters, label,
  catalog_number, price, condition, image_url, is_new_arrival, status,
  created_at, updated_at
) VALUES
  (
    'janos-starker-most-beautiful-melodies',
    'The Most Beautiful Melodies',
    '巴赫・海頓・舒伯特・聖桑・馬替奴・舒曼・布洛赫・韋伯',
    'János Starker 大提琴・Shuku Iwasaki 鋼琴',
    'classical',
    '["B","H","M","S","W"]',
    'DENON PCM Recording',
    'GK-7041-HQ',
    '價格待定',
    '品相待確認',
    '/records/janos-starker-most-beautiful-melodies.jpeg',
    1,
    'published',
    '2026-09-02T00:00:00.000Z',
    '2026-09-02T00:00:00.000Z'
  ),
  (
    'chopin-liszt-piano-concertos',
    'Chopin & Liszt: Piano Concertos No. 1',
    '蕭邦・李斯特',
    'Martha Argerich 鋼琴・Claudio Abbado 指揮・London Symphony Orchestra',
    'classical',
    '["C","L"]',
    'Deutsche Grammophon',
    '139 383',
    '價格待定',
    '品相待確認',
    '/records/chopin-liszt-piano-concertos.jpeg',
    1,
    'published',
    '2026-09-03T00:00:00.000Z',
    '2026-09-03T00:00:00.000Z'
  );
