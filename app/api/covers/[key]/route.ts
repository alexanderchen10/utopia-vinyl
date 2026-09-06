import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ key: string }> | { key: string } };

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]+$/i.test(key)) {
    return new Response('Not found', { status: 404 });
  }

  const image = await env.DB
    .prepare('SELECT image_blob, content_type FROM record_images WHERE record_id = ?')
    .bind(key)
    .first<{ image_blob: number[]; content_type: string }>();
  if (!image) return new Response('Not found', { status: 404 });

  const imageBytes = Uint8Array.from(image.image_blob);

  return new Response(imageBytes.buffer as ArrayBuffer, {
    headers: {
      'cache-control': 'public, max-age=31536000, immutable',
      'content-security-policy': "default-src 'none'; sandbox",
      'content-type': image.content_type,
      'x-content-type-options': 'nosniff',
    },
  });
}
