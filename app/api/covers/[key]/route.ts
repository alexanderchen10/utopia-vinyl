import { env } from 'cloudflare:workers';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ key: string }> | { key: string } };

export async function GET(_request: Request, context: RouteContext) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]+\.(jpe?g|png|webp)$/i.test(key)) {
    return new Response('Not found', { status: 404 });
  }

  const object = await env.RECORD_COVERS.get(key);
  if (!object) return new Response('Not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('content-security-policy', "default-src 'none'; sandbox");
  headers.set('x-content-type-options', 'nosniff');

  return new Response(object.body, { headers });
}
