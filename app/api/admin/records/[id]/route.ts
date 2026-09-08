import { env } from 'cloudflare:workers';

import { normalizeIndexLetters, type RecordCategory, type RecordStatus } from '@/lib/catalog';
import { authorizeAdmin, isSameOriginRequest } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> | { id: string } };

const allowedCategories = new Set<RecordCategory>(['classical', 'jazz', 'pop', 'taiwan']);
const allowedStatuses = new Set<RecordStatus>(['draft', 'published']);
const maximumStoredImageBytes = 800_000;

function readText(formData: FormData, name: string, maxLength: number) {
  const value = formData.get(name);
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidId(id: string) {
  return id.length <= 120 && /^[a-z0-9-]+$/i.test(id);
}

function isJpeg(bytes: Uint8Array) {
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

async function authorizeMutation(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ message: '要求無效，請重新整理頁面。' }, { status: 403 });
  }

  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });
  return null;
}

export async function PATCH(request: Request, context: RouteContext) {
  const rejected = await authorizeMutation(request);
  if (rejected) return rejected;

  const { id } = await context.params;
  if (!isValidId(id)) {
    return Response.json({ message: '找不到這張唱片。' }, { status: 404 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 1_250_000) {
    return Response.json({ message: '照片處理後仍然太大，請換一張照片再試。' }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ message: '無法讀取唱片資料，請重新整理後再試。' }, { status: 400 });
  }

  const title = readText(formData, 'title', 180);
  const category = readText(formData, 'category', 20) as RecordCategory;
  const status = readText(formData, 'status', 20) as RecordStatus;
  if (!title) return Response.json({ message: '請填寫唱片名稱。' }, { status: 400 });
  if (!allowedCategories.has(category)) {
    return Response.json({ message: '請選擇唱片分類。' }, { status: 400 });
  }
  if (!allowedStatuses.has(status)) {
    return Response.json({ message: '上架狀態不正確。' }, { status: 400 });
  }

  let current: { id: string; image_url: string; image_content_type: string | null } | null;
  try {
    current = await env.DB
      .prepare('SELECT id, image_url, image_content_type FROM records WHERE id = ?')
      .bind(id)
      .first<{ id: string; image_url: string; image_content_type: string | null }>();
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_record_lookup_failed', recordId: id, error: String(error) }));
    return Response.json({ message: '暫時無法讀取唱片，請稍後再試。' }, { status: 500 });
  }
  if (!current) return Response.json({ message: '找不到這張唱片。' }, { status: 404 });

  const image = formData.get('image');
  const hasReplacementImage = image instanceof File && image.size > 0;
  let imageBytes: Uint8Array | null = null;
  if (hasReplacementImage) {
    if (image.size > maximumStoredImageBytes) {
      return Response.json({ message: '照片處理後仍然太大，請換一張照片再試。' }, { status: 413 });
    }
    if (image.type !== 'image/jpeg') {
      return Response.json({ message: '照片格式處理失敗，請重新選擇照片。' }, { status: 400 });
    }
    imageBytes = new Uint8Array(await image.arrayBuffer());
    if (!isJpeg(imageBytes)) {
      return Response.json({ message: '這個檔案不是有效的唱片照片。' }, { status: 400 });
    }
  }

  const now = new Date().toISOString();
  const imageUrl = hasReplacementImage ? `/api/covers/${id}?v=${Date.now()}` : current.image_url;
  const indexLetters = normalizeIndexLetters(readText(formData, 'indexLetters', 52));
  const statements = [
    env.DB.prepare(
      `UPDATE records SET
        title = ?, composers = ?, performers = ?, category = ?, index_letters = ?,
        label = ?, catalog_number = ?, price = ?, condition = ?, image_url = ?,
        image_content_type = ?, is_new_arrival = ?, status = ?, updated_at = ?
      WHERE id = ?`,
    ).bind(
      title,
      readText(formData, 'composers', 300),
      readText(formData, 'performers', 300),
      category,
      JSON.stringify(indexLetters),
      readText(formData, 'label', 120),
      readText(formData, 'catalogNumber', 80),
      readText(formData, 'price', 50) || '價格待定',
      readText(formData, 'condition', 80) || '品相待確認',
      imageUrl,
      hasReplacementImage ? 'image/jpeg' : current.image_content_type,
      formData.get('newArrival') === 'true' ? 1 : 0,
      status,
      now,
      id,
    ),
  ];

  if (imageBytes) {
    statements.push(
      env.DB.prepare(
        `INSERT INTO record_images (record_id, image_blob, content_type, created_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(record_id) DO UPDATE SET
            image_blob = excluded.image_blob,
            content_type = excluded.content_type,
            created_at = excluded.created_at`,
      ).bind(id, imageBytes.buffer as ArrayBuffer, 'image/jpeg', now),
    );
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_record_update_failed', recordId: id, error: String(error) }));
    return Response.json({ message: '暫時無法更新唱片，請稍後再試。' }, { status: 500 });
  }

  return Response.json({
    message: status === 'published' ? '唱片資料已更新並顯示在商店。' : '唱片已儲存並從商店隱藏。',
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const rejected = await authorizeMutation(request);
  if (rejected) return rejected;

  const { id } = await context.params;
  if (!isValidId(id)) {
    return Response.json({ message: '找不到這張唱片。' }, { status: 404 });
  }

  let existing: { id: string } | null;
  try {
    existing = await env.DB
      .prepare('SELECT id FROM records WHERE id = ?')
      .bind(id)
      .first<{ id: string }>();
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_record_lookup_failed', recordId: id, error: String(error) }));
    return Response.json({ message: '暫時無法讀取唱片，請稍後再試。' }, { status: 500 });
  }
  if (!existing) return Response.json({ message: '找不到這張唱片。' }, { status: 404 });

  try {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM record_images WHERE record_id = ?').bind(id),
      env.DB.prepare('DELETE FROM records WHERE id = ?').bind(id),
    ]);
  } catch (error) {
    console.error(JSON.stringify({ event: 'admin_record_delete_failed', recordId: id, error: String(error) }));
    return Response.json({ message: '暫時無法刪除唱片，請稍後再試。' }, { status: 500 });
  }

  return Response.json({ message: '唱片已永久刪除。' });
}
