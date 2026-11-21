import { count, desc, eq } from 'drizzle-orm';
import { Router } from 'express';
import { z } from 'zod';
import { getDb, isDatabaseConfigured, testDatabaseConnection } from '../../db/index.ts';
import { apiKeys, authSessions, users } from '../../db/schema.ts';
import {
  type AuthenticatedRequest,
  generateIngestApiKey,
  hashPassword,
  requireDatabase,
  requireUserAuth,
  signSessionToken,
  verifyEnvPasscode,
  verifyPassword,
} from '../auth.ts';

const bootstrapSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(80).default('Lorenzo Ruiz'),
  jobTitle: z.string().trim().min(2).max(80).default('Fleet Manager'),
});

const registerSchema = z.object({
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  fullName: z.string().trim().min(2).max(80),
  jobTitle: z.string().trim().min(2).max(80).optional().default('Fleet Operator'),
});

const loginSchema = z.union([
  z.object({
    email: z.string().trim().email().max(160),
    password: z.string().min(1).max(128),
  }),
  z.object({
    passcode: z.string().min(1).max(128),
  }),
]);

const createKeySchema = z.object({
  name: z.string().trim().min(2).max(80),
  scopes: z.string().trim().min(3).max(120).optional().default('ingest:write,fleet:read'),
});

export const authRouter = Router();

authRouter.get('/setup-status', async (_req, res) => {
  const configured = isDatabaseConfigured();
  if (!configured) {
    res.json({
      dbConfigured: false,
      dbConnected: false,
      needsBootstrap: false,
      hasPasscodeEnv: Boolean(process.env.ADMIN_PASSCODE),
    });
    return;
  }

  try {
    const dbStatus = await testDatabaseConnection();
    const db = getDb();
    if (!db || !dbStatus.connected) {
      res.json({
        dbConfigured: true,
        dbConnected: false,
        needsBootstrap: false,
        hasPasscodeEnv: Boolean(process.env.ADMIN_PASSCODE),
        error: dbStatus.error,
      });
      return;
    }

    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    const hasPasscodeEnv = Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length > 0);
    res.json({
      dbConfigured: true,
      dbConnected: true,
      needsBootstrap: userCount === 0 && !hasPasscodeEnv,
      hasPasscodeEnv,
      userCount,
    });
  } catch (err) {
    res.status(500).json({
      dbConfigured: true,
      dbConnected: false,
      needsBootstrap: false,
      hasPasscodeEnv: Boolean(process.env.ADMIN_PASSCODE),
      error: err instanceof Error ? err.message : 'Status check failed',
    });
  }
});

authRouter.post('/bootstrap', requireDatabase, async (req: AuthenticatedRequest, res) => {
  if (process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.length > 0) {
    res.status(409).json({
      error: 'Admin passcode is already configured via environment secrets. Use /api/auth/login.',
    });
    return;
  }

  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid bootstrap input', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const createdUser = await db.transaction(async (tx) => {
      const [{ value: adminCount }] = await tx
        .select({ value: count() })
        .from(users)
        .where(eq(users.role, 'admin'));

      if (adminCount > 0) {
        return null;
      }

      const [inserted] = await tx
        .insert(users)
        .values({
          email: normalizedEmail,
          fullName: parsed.data.fullName,
          jobTitle: parsed.data.jobTitle,
          role: 'admin',
          passwordHash: hashPassword(parsed.data.password),
        })
        .returning({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          jobTitle: users.jobTitle,
          role: users.role,
        });

      return inserted;
    });

    if (!createdUser) {
      res.status(409).json({ error: 'Initial admin account has already been claimed.' });
      return;
    }

    const { token, tokenHash, expiresAt } = signSessionToken(createdUser);
    await db.insert(authSessions).values({
      userId: createdUser.id,
      tokenHash,
      expiresAt,
    });

    res.status(201).json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: createdUser,
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    res.status(500).json({ error: 'Failed to claim initial admin account' });
  }
});

authRouter.post('/register', requireDatabase, async (req: AuthenticatedRequest, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid registration payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const normalizedEmail = parsed.data.email.toLowerCase();

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const [created] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        fullName: parsed.data.fullName,
        jobTitle: parsed.data.jobTitle,
        role: 'operator',
        passwordHash: hashPassword(parsed.data.password),
      })
      .returning({
        id: users.id,
        email: users.email,
        fullName: users.fullName,
        jobTitle: users.jobTitle,
        role: users.role,
      });

    const { token, tokenHash, expiresAt } = signSessionToken(created);
    await db.insert(authSessions).values({
      userId: created.id,
      tokenHash,
      expiresAt,
    });

    res.status(201).json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: created,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

authRouter.post('/login', requireDatabase, async (req: AuthenticatedRequest, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid login credentials format' });
    return;
  }

  const db = req.db!;

  try {
    if ('passcode' in parsed.data) {
      if (!verifyEnvPasscode(parsed.data.passcode)) {
        res.status(401).json({ error: 'Invalid admin passcode' });
        return;
      }

      // Find or create the env-configured admin principal
      let adminRows = await db
        .select({
          id: users.id,
          email: users.email,
          fullName: users.fullName,
          jobTitle: users.jobTitle,
          role: users.role,
        })
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);

      if (adminRows.length === 0) {
        const [insertedAdmin] = await db
          .insert(users)
          .values({
            email: 'admin@wirehouseflow.local',
            fullName: 'Lorenzo Ruiz',
            jobTitle: 'Fleet Manager',
            role: 'admin',
            passwordHash: hashPassword(parsed.data.passcode),
          })
          .returning({
            id: users.id,
            email: users.email,
            fullName: users.fullName,
            jobTitle: users.jobTitle,
            role: users.role,
          });
        adminRows = [insertedAdmin];
      }

      const adminUser = adminRows[0];
      const { token, tokenHash, expiresAt } = signSessionToken(adminUser);
      await db.insert(authSessions).values({
        userId: adminUser.id,
        tokenHash,
        expiresAt,
      });

      res.json({
        token,
        expiresAt: expiresAt.toISOString(),
        user: adminUser,
      });
      return;
    }

    const normalizedEmail = parsed.data.email.toLowerCase();
    const rows = await db
      .select()
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);

    if (rows.length === 0 || !verifyPassword(parsed.data.password, rows[0].passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const userRow = {
      id: rows[0].id,
      email: rows[0].email,
      fullName: rows[0].fullName,
      jobTitle: rows[0].jobTitle,
      role: rows[0].role,
    };

    const { token, tokenHash, expiresAt } = signSessionToken(userRow);
    await db.insert(authSessions).values({
      userId: userRow.id,
      tokenHash,
      expiresAt,
    });

    res.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: userRow,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.post('/logout', requireUserAuth, async (req: AuthenticatedRequest, res) => {
  const db = req.db!;
  if (req.authTokenHash) {
    await db.delete(authSessions).where(eq(authSessions.tokenHash, req.authTokenHash));
  }
  res.json({ ok: true });
});

authRouter.get('/me', requireUserAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.authUser });
});

authRouter.get('/api-keys', requireUserAuth, async (req: AuthenticatedRequest, res) => {
  const db = req.db!;
  const rows = await db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      lastUsedAt: apiKeys.lastUsedAt,
      revoked: apiKeys.revoked,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .orderBy(desc(apiKeys.createdAt));

  res.json({ keys: rows });
});

authRouter.post('/api-keys', requireUserAuth, async (req: AuthenticatedRequest, res) => {
  const parsed = createKeySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid API key payload', details: parsed.error.flatten() });
    return;
  }

  const db = req.db!;
  const { rawKey, keyPrefix, keyHash } = generateIngestApiKey();

  const [created] = await db
    .insert(apiKeys)
    .values({
      name: parsed.data.name,
      keyPrefix,
      keyHash,
      createdBy: req.authUser!.id,
      scopes: parsed.data.scopes,
    })
    .returning({
      id: apiKeys.id,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      scopes: apiKeys.scopes,
      createdAt: apiKeys.createdAt,
    });

  res.status(201).json({
    apiKey: rawKey,
    key: created,
  });
});

authRouter.delete('/api-keys/:id', requireUserAuth, async (req: AuthenticatedRequest, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: 'Invalid API key id' });
    return;
  }

  const db = req.db!;
  const updated = await db
    .update(apiKeys)
    .set({ revoked: true })
    .where(eq(apiKeys.id, id))
    .returning({ id: apiKeys.id, revoked: apiKeys.revoked });

  if (updated.length === 0) {
    res.status(404).json({ error: 'API key not found' });
    return;
  }

  res.json({ key: updated[0] });
});
