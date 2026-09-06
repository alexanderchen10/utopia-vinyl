import { env } from 'cloudflare:workers';

import {
  createAdminSession,
  createAdminSessionCookie,
  isAdminAuthConfigured,
  isSameOriginRequest,
  loginAttemptKey,
  verifyAdminCredentials,
} from '@/lib/server/admin-auth';

export const dynamic = 'force-dynamic';

const attemptWindowMs = 15 * 60 * 1000;
const lockoutMs = 15 * 60 * 1000;
const maximumAttempts = 5;

type AttemptRow = {
  failed_attempts: number;
  window_started_at: number;
  blocked_until: number;
};

function readLoginBody(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const body = value as { email?: unknown; password?: unknown };
  if (typeof body.email !== 'string' || typeof body.password !== 'string') return null;
  return {
    email: body.email.trim().toLowerCase().slice(0, 254),
    password: body.password.slice(0, 200),
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return Response.json({ message: '登入要求無效，請重新整理頁面。' }, { status: 403 });
  }
  if (!isAdminAuthConfigured()) {
    return Response.json({ message: '私人登入尚未啟用。' }, { status: 503 });
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 2048) {
    return Response.json({ message: '登入資料無效。' }, { status: 413 });
  }

  let body: ReturnType<typeof readLoginBody>;
  try {
    body = readLoginBody(await request.json());
  } catch {
    body = null;
  }
  if (!body?.email || !body.password) {
    return Response.json({ message: '請填寫電子郵件和密碼。' }, { status: 400 });
  }

  const clientAddress = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const attemptKey = await loginAttemptKey(body.email, clientAddress);
  const now = Date.now();
  const attempt = await env.DB
    .prepare(
      `SELECT failed_attempts, window_started_at, blocked_until
        FROM admin_login_attempts WHERE attempt_key = ?`,
    )
    .bind(attemptKey)
    .first<AttemptRow>();

  if (attempt && attempt.blocked_until > now) {
    return Response.json(
      { message: '嘗試次數太多，請十五分鐘後再試。' },
      { status: 429, headers: { 'cache-control': 'no-store', 'retry-after': '900' } },
    );
  }

  const credentials = await verifyAdminCredentials(body.email, body.password);
  if (!credentials.configured) {
    return Response.json({ message: '私人登入尚未啟用。' }, { status: 503 });
  }
  if (!credentials.ok) {
    const inCurrentWindow = Boolean(attempt && now - attempt.window_started_at < attemptWindowMs);
    const failedAttempts = inCurrentWindow ? (attempt?.failed_attempts ?? 0) + 1 : 1;
    const windowStartedAt = inCurrentWindow ? (attempt?.window_started_at ?? now) : now;
    const blockedUntil = failedAttempts >= maximumAttempts ? now + lockoutMs : 0;

    await env.DB.prepare(
      `INSERT INTO admin_login_attempts (
        attempt_key, failed_attempts, window_started_at, blocked_until
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT(attempt_key) DO UPDATE SET
        failed_attempts = excluded.failed_attempts,
        window_started_at = excluded.window_started_at,
        blocked_until = excluded.blocked_until`,
    ).bind(attemptKey, failedAttempts, windowStartedAt, blockedUntil).run();

    return Response.json(
      { message: '電子郵件或密碼不正確。' },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    );
  }

  await env.DB.prepare('DELETE FROM admin_login_attempts WHERE attempt_key = ?').bind(attemptKey).run();
  const token = await createAdminSession(body.email);

  return Response.json(
    { message: '登入成功。' },
    {
      headers: {
        'cache-control': 'no-store',
        'set-cookie': createAdminSessionCookie(token, request.url),
      },
    },
  );
}
