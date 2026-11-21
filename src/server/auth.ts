import crypto from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { NextFunction, Request, Response } from 'express';
import { extractDbErrorMessage, getDb, type Database } from '../db/index.ts';
import { apiKeys, authSessions, users } from '../db/schema.ts';

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  jobTitle: string;
  role: string;
}

export interface IngestPrincipal {
  type: 'user' | 'api_key';
  userId: number | null;
  apiKeyId: number | null;
  label: string;
  scopes: string[];
}

export interface AuthenticatedRequest extends Request {
  db?: Database;
  authUser?: AuthUser;
  authTokenHash?: string;
  ingestPrincipal?: IngestPrincipal;
}

// Per security policy: read SESSION_SECRET from process.env with in-memory crypto.randomBytes(32) fallback.
const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto.randomBytes(32).toString('hex');

const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  const expectedBuf = Buffer.from(hexHash, 'hex');
  const actualBuf = crypto.scryptSync(password, salt, 64);
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export function verifyEnvPasscode(candidate: string): boolean {
  const configured = process.env.ADMIN_PASSCODE;
  if (!configured || configured.length === 0) return false;
  const a = Buffer.from(candidate, 'utf8');
  const b = Buffer.from(configured, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function signSessionToken(user: AuthUser): {
  token: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const payload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    jti: crypto.randomBytes(16).toString('hex'),
    exp: expiresAt.getTime(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sigB64 = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');
  const token = `wf_${payloadB64}.${sigB64}`;
  return {
    token,
    tokenHash: hashToken(token),
    expiresAt,
  };
}

export function verifySignedTokenFormat(token: string): { sub: number; exp: number } | null {
  if (!token.startsWith('wf_')) return null;
  const body = token.slice(3);
  const dotIdx = body.indexOf('.');
  if (dotIdx <= 0) return null;
  const payloadB64 = body.slice(0, dotIdx);
  const sigB64 = body.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      sub?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.sub !== 'number' || typeof parsed.exp !== 'number') return null;
    if (parsed.exp <= Date.now()) return null;
    return { sub: parsed.sub, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function generateIngestApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const secretPart = crypto.randomBytes(24).toString('hex');
  const rawKey = `wf_live_${secretPart}`;
  const keyPrefix = rawKey.slice(0, 14);
  return {
    rawKey,
    keyPrefix,
    keyHash: hashToken(rawKey),
  };
}

export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  return match ? match[1].trim() : null;
}

export function requireDatabase(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const db = getDb();
  if (!db) {
    res.status(503).json({
      error: 'Database is not configured. Add PostgreSQL credentials to environment secrets.',
    });
    return;
  }
  req.db = db;
  next();
}

async function resolveBearerUser(
  db: Database,
  rawToken: string
): Promise<{ user: AuthUser; tokenHash: string } | null> {
  const verified = verifySignedTokenFormat(rawToken);
  if (!verified) return null;

  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      fullName: users.fullName,
      jobTitle: users.jobTitle,
      role: users.role,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    user: {
      id: row.userId,
      email: row.email,
      fullName: row.fullName,
      jobTitle: row.jobTitle,
      role: row.role,
    },
    tokenHash,
  };
}

export async function requireUserAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const db = req.db ?? getDb();
  if (!db) {
    res.status(503).json({ error: 'Database is not configured' });
    return;
  }
  req.db = db;

  const rawToken = extractBearerToken(req);
  if (!rawToken) {
    res.status(401).json({ error: 'Missing Authorization Bearer token' });
    return;
  }

  try {
    const resolved = await resolveBearerUser(db, rawToken);
    if (!resolved) {
      res.status(401).json({ error: 'Invalid or expired session token' });
      return;
    }
    req.authUser = resolved.user;
    req.authTokenHash = resolved.tokenHash;
    next();
  } catch (err) {
    const { message, isConnectionError } = extractDbErrorMessage(err);
    res.status(isConnectionError ? 503 : 500).json({
      error: isConnectionError ? `PostgreSQL unavailable: ${message}` : 'Authentication verification failed',
    });
  }
}

export async function requireIngestAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const db = req.db ?? getDb();
  if (!db) {
    res.status(503).json({ error: 'Database is not configured' });
    return;
  }
  req.db = db;

  const bearerToken = extractBearerToken(req);
  const headerApiKey =
    typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].trim() : null;

  const candidateKey =
    headerApiKey || (bearerToken && bearerToken.startsWith('wf_live_') ? bearerToken : null);

  try {
    if (candidateKey) {
      const keyHash = hashToken(candidateKey);
      const found = await db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.revoked, false)))
        .limit(1);

      if (found.length === 0) {
        res.status(401).json({ error: 'Invalid or revoked ingest API key' });
        return;
      }

      const keyRow = found[0];
      const scopes = keyRow.scopes.split(',').map((s) => s.trim());
      if (!scopes.includes('ingest:write')) {
        res.status(403).json({ error: 'API key lacks ingest:write scope' });
        return;
      }

      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, keyRow.id));

      req.ingestPrincipal = {
        type: 'api_key',
        userId: keyRow.createdBy ?? null,
        apiKeyId: keyRow.id,
        label: `key:${keyRow.keyPrefix}`,
        scopes,
      };
      next();
      return;
    }

    if (bearerToken) {
      const resolved = await resolveBearerUser(db, bearerToken);
      if (!resolved) {
        res.status(401).json({ error: 'Invalid or expired session token' });
        return;
      }
      req.authUser = resolved.user;
      req.authTokenHash = resolved.tokenHash;
      req.ingestPrincipal = {
        type: 'user',
        userId: resolved.user.id,
        apiKeyId: null,
        label: `user:${resolved.user.email}`,
        scopes: ['ingest:write', 'fleet:read'],
      };
      next();
      return;
    }

    res.status(401).json({
      error: 'Authentication required. Provide Authorization: Bearer <token> or X-API-Key header.',
    });
  } catch (err) {
    const { message, isConnectionError } = extractDbErrorMessage(err);
    res.status(isConnectionError ? 503 : 500).json({
      error: isConnectionError ? `PostgreSQL unavailable: ${message}` : 'Ingest authentication failed',
    });
  }
}
