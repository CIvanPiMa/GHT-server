import { createHash, randomBytes, timingSafeEqual } from 'crypto';

// To change the password, replace this with: echo -n '$A_SECRET_PASSWORD' | sha256sum
const PASSWORD_HASH = process.env['ADMIN_PASSWORD_HASH'] ?? '7166371df9b4c22e532dceb8b521a5f9a93c600a50b11ed0cf00d8fa63c8f5c5';

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const activeSessions = new Map<string, number>();

export function verifyPassword(candidate: string): boolean {
  const candidateHash = createHash('sha256').update(candidate).digest('hex');
  const a = Buffer.from(candidateHash, 'utf8');
  const b = Buffer.from(PASSWORD_HASH, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createSession(): string {
  const token = randomBytes(32).toString('hex');
  activeSessions.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

export function validateSession(token: string | undefined): boolean {
  if (!token) return false;
  const expiry = activeSessions.get(token);
  if (!expiry) return false;
  if (Date.now() > expiry) {
    activeSessions.delete(token);
    return false;
  }
  return true;
}

export function deleteSession(token: string): void {
  activeSessions.delete(token);
}

export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(';').map((part) => {
      const [k, ...rest] = part.trim().split('=');
      return [k.trim(), decodeURIComponent(rest.join('='))];
    })
  );
}
