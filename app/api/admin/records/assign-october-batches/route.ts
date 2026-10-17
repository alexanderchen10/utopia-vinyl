import { env } from 'cloudflare:workers';

import { authorizeAdmin, isSameOriginRequest } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ message: '要求無效，請重新整理頁面。' }, { status: 403 });
  }

  const auth = await authorizeAdmin(request);
  if (!auth.ok) return Response.json({ message: auth.message }, { status: auth.status });

  try {
    const result = await env.DB.prepare(
      'SELECT id FROM records ORDER BY updated_at DESC, created_at DESC',
    ).all<{ id: string }>();
    const ids = result.results.map((row) => row.id);
    if (ids.length !== 93) {
      return Response.json(
        { message: `安全檢查未通過：目前共有 ${ids.length} 張唱片，預期為 93 張。沒有變更任何資料。` },
        { status: 409 },
      );
    }

    const now = new Date().toISOString();
    await env.DB.batch(ids.map((id, index) => {
      const batchNumber = `OCT-B${String(Math.floor(index / 25) + 1).padStart(2, '0')}`;
      return env.DB.prepare('UPDATE records SET batch_number = ?, updated_at = ? WHERE id = ?')
        .bind(batchNumber, now, id);
    }));

    return Response.json({
      message: '93 張唱片已整理完成：OCT-B01、B02、B03 各 25 張，OCT-B04 18 張。',
      counts: { 'OCT-B01': 25, 'OCT-B02': 25, 'OCT-B03': 25, 'OCT-B04': 18 },
    });
  } catch (error) {
    console.error(JSON.stringify({ event: 'assign_october_batches_failed', error: String(error) }));
    return Response.json({ message: '批次整理失敗，沒有完成變更，請稍後再試。' }, { status: 500 });
  }
}
