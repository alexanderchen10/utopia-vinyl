import { env } from 'cloudflare:workers';

const sessionCookieName = 'utopia_admin_session';
const sessionDurationSeconds = 7 * 24 * 60 * 60;
const encoder = new TextEncoder();

type SessionPayload = {
  email: string;
  expiresAt: number;
};

export type AdminAuthResult =
  | { ok: true; email: string }
  | { ok: false; status: 401 | 403 | 503; message: string };

function allowedEmails() {
  return new Set(
    (env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

function encodeBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function decodePayload(value: string): SessionPayload | null {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as Partial<SessionPayload>;
    if (typeof parsed.email !== 'string' || typeof parsed.expiresAt !== 'number') return null;
    return { email: parsed.email.toLowerCase(), expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

function findCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return '';
  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = cookie.trim().split('=');
    if (cookieName === name) return valueParts.join('=');
  }
  return '';
}

function decodeHex(value: string) {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (byte) => Number.parseInt(byte, 16));
}

async function importSessionKey() {
  const secret = env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) return null;
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function signatureFor(value: string) {
  const key = await importSessionKey();
  if (!key) return null;
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return new Uint8Array(signature);
}

async function verifySignature(value: string, signature: Uint8Array) {
  const key = await importSessionKey();
  if (!key) return false;
  return crypto.subtle.verify('HMAC', key, signature.buffer as ArrayBuffer, encoder.encode(value));
}

async function passwordHashMatches(supplied: Uint8Array, expected: Uint8Array) {
  const challenge = encoder.encode('utopia-vinyl-admin-password-check');
  const suppliedKey = await crypto.subtle.importKey(
    'raw',
    supplied.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expectedKey = await crypto.subtle.importKey(
    'raw',
    expected.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const signature = await crypto.subtle.sign('HMAC', suppliedKey, challenge);
  return crypto.subtle.verify('HMAC', expectedKey, signature, challenge);
}

export function isAdminAuthConfigured() {
  return Boolean(
    allowedEmails().size > 0 &&
    decodeHex(env.ADMIN_PASSWORD_HASH?.trim() ?? '') &&
    env.ADMIN_SESSION_SECRET?.trim(),
  );
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get('origin');
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function verifyAdminCredentials(email: string, password: string) {
  const expectedPasswordHash = decodeHex(env.ADMIN_PASSWORD_HASH?.trim() ?? '');
  if (!expectedPasswordHash || !env.ADMIN_SESSION_SECRET?.trim() || allowedEmails().size === 0) {
    return { configured: false, ok: false } as const;
  }

  const suppliedPasswordHash = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(password)));
  const emailAllowed = allowedEmails().has(email.trim().toLowerCase());
  const passwordMatches = await passwordHashMatches(suppliedPasswordHash, expectedPasswordHash);
  return { configured: true, ok: emailAllowed && passwordMatches } as const;
}

export async function createAdminSession(email: string) {
  const payload: SessionPayload = {
    email: email.trim().toLowerCase(),
    expiresAt: Date.now() + sessionDurationSeconds * 1000,
  };
  const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
  const signature = await signatureFor(encodedPayload);
  if (!signature) throw new Error('Admin session secret is unavailable');
  return `${encodedPayload}.${encodeBase64Url(signature)}`;
}

export function createAdminSessionCookie(token: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secure}`;
}

export function clearAdminSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === 'https:' ? '; Secure' : '';
  return `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export async function verifyAdminSession(cookieHeader: string | null): Promise<AdminAuthResult> {
  if (!isAdminAuthConfigured()) {
    return { ok: false, status: 503, message: '私人登入尚未啟用。' };
  }

  const token = findCookie(cookieHeader, sessionCookieName);
  const [encodedPayload, encodedSignature] = token.split('.');
  if (!encodedPayload || !encodedSignature) {
    return { ok: false, status: 401, message: '請先登入私人管理頁面。' };
  }

  const payload = decodePayload(encodedPayload);
  let suppliedSignature: Uint8Array;
  try {
    suppliedSignature = decodeBase64Url(encodedSignature);
  } catch {
    return { ok: false, status: 401, message: '登入資料無效，請重新登入。' };
  }

  if (
    !payload ||
    !(await verifySignature(encodedPayload, suppliedSignature)) ||
    payload.expiresAt <= Date.now()
  ) {
    return { ok: false, status: 401, message: '登入已失效，請重新登入。' };
  }

  if (!allowedEmails().has(payload.email)) {
    return { ok: false, status: 403, message: '這個帳號沒有管理權限。' };
  }

  return { ok: true, email: payload.email };
}

export async function loginAttemptKey(email: string, clientAddress: string) {
  const signature = await signatureFor(`login:${email.trim().toLowerCase()}:${clientAddress}`);
  if (!signature) throw new Error('Admin session secret is unavailable');
  return Array.from(signature, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function authorizeAdmin(request: Request): Promise<AdminAuthResult> {
  return verifyAdminSession(request.headers.get('cookie'));
}
