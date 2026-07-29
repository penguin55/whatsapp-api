import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

const COOKIE_NAME = 'wa_dashboard_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;

interface DashboardSessionPayload {
  userId: string;
  csrf: string;
  expiresAt: number;
}

function sign(value: string): string {
  return createHmac('sha256', env.apiSecret).update(value).digest('base64url');
}

export function createDashboardSession(userId: string): {
  cookie: string;
  csrfToken: string;
} {
  const payload: DashboardSessionPayload = {
    userId,
    csrf: randomBytes(32).toString('base64url'),
    expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const token = `${encoded}.${sign(encoded)}`;
  const secure = env.isProd ? '; Secure' : '';

  return {
    cookie: `${COOKIE_NAME}=${token}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure}`,
    csrfToken: payload.csrf,
  };
}

export function clearDashboardSessionCookie(): string {
  const secure = env.isProd ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function readDashboardSession(cookieHeader?: string): DashboardSessionPayload | null {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  if (!cookie) return null;

  try {
    const token = cookie.slice(COOKIE_NAME.length + 1);
    const [encoded, providedSignature] = token.split('.');
    if (!encoded || !providedSignature) return null;

    const expectedSignature = sign(encoded);
    const expected = Buffer.from(expectedSignature);
    const provided = Buffer.from(providedSignature);
    if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    ) as DashboardSessionPayload;
    if (!payload.userId || !payload.csrf || payload.expiresAt <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

