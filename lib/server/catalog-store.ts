import type {
  RecordCategory,
  RecordStatus,
  ShopifySyncStatus,
  VinylRecord,
} from '@/lib/catalog';

type RecordRow = {
  id: string;
  title: string;
  composers: string;
  performers: string;
  category: RecordCategory;
  index_letters: string;
  label: string;
  catalog_number: string;
  price: string;
  condition: string;
  condition_notes: string;
  image_url: string;
  is_new_arrival: number;
  status: RecordStatus;
  created_at: string;
  available: number;
  shopify_sync_status: ShopifySyncStatus;
  shopify_sync_error: string | null;
  shopify_synced_at: string | null;
  sold_at: string | null;
};

export function mapRecordRow(row: RecordRow): VinylRecord {
  let indexLetters: string[] = [];

  try {
    const parsed = JSON.parse(row.index_letters) as unknown;
    if (Array.isArray(parsed)) {
      indexLetters = parsed.filter(
        (value): value is string => typeof value === 'string',
      );
    }
  } catch {
    indexLetters = [];
  }

  return {
    id: row.id,
    title: row.title,
    composers: row.composers,
    performers: row.performers,
    category: row.category,
    indexLetters,
    label: row.label,
    catalogNumber: row.catalog_number,
    image: row.image_url,
    newArrival: row.is_new_arrival === 1,
    price: row.price,
    condition: row.condition,
    conditionNotes: row.condition_notes,
    status: row.status,
    createdAt: row.created_at,
    available: row.available === 1,
    shopifySyncStatus: row.shopify_sync_status,
    shopifySyncError: row.shopify_sync_error ?? undefined,
    shopifySyncedAt: row.shopify_synced_at ?? undefined,
    soldAt: row.sold_at ?? undefined,
  };
}

export async function listPublishedRecords(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, title, composers, performers, category, index_letters,
        label, catalog_number, price, condition, condition_notes, image_url, is_new_arrival,
        status, created_at, available, shopify_sync_status, shopify_sync_error,
        shopify_synced_at, sold_at
      FROM records
      WHERE status = ? AND available = 1
      ORDER BY created_at DESC`,
    )
    .bind('published')
    .all<RecordRow>();

  return result.results.map(mapRecordRow);
}

export async function listAdminRecords(db: D1Database) {
  const result = await db
    .prepare(
      `SELECT id, title, composers, performers, category, index_letters,
        label, catalog_number, price, condition, condition_notes, image_url, is_new_arrival,
        status, created_at, available, shopify_sync_status, shopify_sync_error,
        shopify_synced_at, sold_at
      FROM records
      ORDER BY updated_at DESC, created_at DESC`,
    )
    .all<RecordRow>();

  return result.results.map(mapRecordRow);
}
