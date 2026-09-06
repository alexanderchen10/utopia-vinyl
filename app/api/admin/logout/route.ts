import { clearAdminSessionCookie, isSameOriginRequest } from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ message: '登出要求無效。' }, { status: 403 });
  }

  return Response.json(
    { message: '已安全登出。' },
    {
      headers: {
        'cache-control': 'no-store',
        'set-cookie': clearAdminSessionCookie(request.url),
      },
    },
  );
}
