import { env } from 'cloudflare:workers';

type AccessPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iss?: string;
};

type AccessHeader = {
  alg?: string;
  kid?: string;
};

type AccessJwk = JsonWebKey & { kid?: string };

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodeJson<T>(value: string): T | null {
  try {
    return JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T;
  } catch {
    return null;
  }
}

function normalizeTeamDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\.cloudflareaccess\.com\/?$/, '')
    .replace(/\/$/, '');
}

export async function authorizeAdmin(request: Request): Promise<AdminAuthResult> {
  const teamName = env.ACCESS_TEAM_DOMAIN ? normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN) : '';
  const audience = env.ACCESS_AUD?.trim() ?? '';
  const allowedEmails = new Set(
    (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

  if (!teamName || !audience || allowedEmails.size === 0) {
    return { ok: false, status: 503, message: '私人登入尚未啟用。' };
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    return { ok: false, status: 401, message: '請先登入私人管理頁面。' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    return { ok: false, status: 401, message: '登入資料無效，請重新登入。' };
  }

  const header = decodeJson<AccessHeader>(encodedHeader);
  const payload = decodeJson<AccessPayload>(encodedPayload);
  if (!header?.kid || header.alg !== 'RS256' || !payload) {
    return { ok: false, status: 401, message: '登入資料無效，請重新登入。' };
  }

  const issuer = `https://${teamName}.cloudflareaccess.com`;
  const payloadAudience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const email = payload.email?.toLowerCase();

  if (
    payload.iss !== issuer ||
    !payloadAudience.includes(audience) ||
    !payload.exp ||
    payload.exp * 1000 <= Date.now() ||
    !email
  ) {
    return { ok: false, status: 401, message: '登入已失效，請重新登入。' };
  }

  try {
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error('Unable to load Access signing keys');

    const keys = (await response.json()) as { keys?: AccessJwk[] };
    const signingKey = keys.keys?.find((key) => key.kid === header.kid);
    if (!signingKey) throw new Error('No matching Access signing key');

    const key = await crypto.subtle.importKey(
      'jwk',
      signingKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const validSignature = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      decodeBase64Url(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );

    if (!validSignature) {
      return { ok: false, status: 401, message: '登入資料無效，請重新登入。' };
    }
  } catch (error) {
    console.error('Cloudflare Access verification failed', error);
    return { ok: false, status: 503, message: '暫時無法確認登入，請稍後再試。' };
  }

  if (!allowedEmails.has(email)) {
    return { ok: false, status: 403, message: '這個帳號沒有管理權限。' };
  }

  return { ok: true, email };
}
