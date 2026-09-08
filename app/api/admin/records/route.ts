import { env } from 'cloudflare:workers';

import { normalizeIndexLetters, type RecordCategory, type RecordStatus } from '@/lib/catalog';
import { authorizeAdmin, isSameOriginRequest } from '@/lib/server/admin-auth';
import { listAdminRecords } from '@/lib/server/catalog-store';

export const dynamic = 'force-dynamic';

const allowedCategories = new Set<RecordCategory>(['classical', 'jazz', 'pop', 'taiwan']);
const allowedStatuses = new Set<RecordStatus>(['draft', 'published']);
const maximumStoredImageBytes = 800_000;

function readText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isSupportedImage(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (contentType === 'image/webp') {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

export async function GET(request: Request) {
  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  try {
    const records = await listAdminRecords(env.DB);
    return Response.json({ records });
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_records_read_failed', error: String(error) }));
    return Response.json({ message: '暫時無法讀取唱片，請稍後再試。' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ message: '儲存要求無效，請重新整理頁面。' }, { status: 403 });
  }

  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_250_000) {
    return Response.json({ message: '照片處理後仍然太大，請換一張照片再試。' }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: '無法讀取表格，請重新選擇照片後再試。' }, { status: 400 });
  }

  const image = formData.get('image');
  const title = readText(formData, 'title', 180);
  const category = readText(formData, 'category', 20) as RecordCategory;
  const status = readText(formData, 'status', 20) as RecordStatus;

  if (!(image instanceof File) || image.size === 0) {
    return Response.json({ message: '請先選擇唱片封面照片。' }, { status: 400 });
  }
  if (image.size > maximumStoredImageBytes) {
    return Response.json({ message: '照片處理後仍然太大，請換一張照片再試。' }, { status: 413 });
  }
  if (image.type !== 'image/jpeg') {
    return Response.json({ message: '照片格式處理失敗，請重新選擇照片。' }, { status: 400 });
  }
  if (!title) {
    return Response.json({ message: '請填寫唱片名稱。' }, { status: 400 });
  }
  if (!allowedCategories.has(category)) {
    return Response.json({ message: '請選擇唱片分類。' }, { status: 400 });
  }
  if (!allowedStatuses.has(status)) {
    return Response.json({ message: '上架狀態不正確。' }, { status: 400 });
  }

  const bytes = new Uint8Array(await image.arrayBuffer());
  if (!isSupportedImage(bytes, image.type)) {
    return Response.json({ message: '這個檔案不是有效的唱片照片。' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const imageUrl = `/api/covers/${id}?v=${Date.now()}`;
  const now = new Date().toISOString();
  const newArrival = formData.get('newArrival') === 'true' ? 1 : 0;
  const indexLetters = normalizeIndexLetters(readText(formData, 'indexLetters', 52));
  const composers = readText(formData, 'composers', 300);
  const performers = readText(formData, 'performers', 300);
  const label = readText(formData, 'label', 120);
  const catalogNumber = readText(formData, 'catalogNumber', 80);
  const price = readText(formData, 'price', 50) || '價格待定';
  const condition = readText(formData, 'condition', 80) || '品相待確認';

  try {
    await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO records (
          id, title, composers, performers, category, index_letters, label,
          catalog_number, price, condition, image_url, image_key,
          image_content_type, is_new_arrival, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id,
        title,
        composers,
        performers,
        category,
        JSON.stringify(indexLetters),
        label,
        catalogNumber,
        price,
        condition,
        imageUrl,
        null,
        image.type,
        newArrival,
        status,
        now,
        now,
      ),
      env.DB.prepare(
        `INSERT INTO record_images (record_id, image_blob, content_type, created_at)
          VALUES (?, ?, ?, ?)`,
      ).bind(id, bytes.buffer as ArrayBuffer, image.type, now),
    ]);
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_record_create_failed', error: String(error) }));
    return Response.json({ message: '暫時無法儲存唱片，請稍後再試。' }, { status: 500 });
  }

  return Response.json(
    {
      message: status === 'published' ? '唱片已成功上架！' : '草稿已儲存。',
      record: { id, image: imageUrl, status },
    },
    { status: 201 },
  );
}
