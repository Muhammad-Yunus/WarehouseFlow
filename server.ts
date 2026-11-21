import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import express from 'express';
import { extractDbErrorMessage, getDb, isDatabaseConfigured, testDatabaseConnection } from './src/db/index.ts';
import { authRouter } from './src/server/routes/authRoutes.ts';
import { dashboardRouter } from './src/server/routes/dashboardRoutes.ts';
import { ingestRouter } from './src/server/routes/ingestRoutes.ts';
import { createRateLimiter } from './src/server/rateLimit.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

const apiLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 300,
  bucketPrefix: 'api',
  message: 'API rate limit exceeded. Please slow down requests.',
});

const ingestLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 180,
  bucketPrefix: 'ingest',
  keyGenerator: (req) => {
    const apiKeyHeader = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'].slice(0, 14) : '';
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    return apiKeyHeader ? `${ip}:${apiKeyHeader}` : ip;
  },
  message: 'Telemetry ingest rate limit exceeded.',
});

function isOriginAllowed(req: express.Request, origin: string): boolean {
  const host = (req.get('x-forwarded-host') || req.get('host') || '').toLowerCase();
  try {
    const parsed = new URL(origin);
    if (host && parsed.host.toLowerCase() === host) {
      return true;
    }
  } catch {
    return false;
  }

  const extra = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return extra.includes(origin.toLowerCase());
}

async function bootstrapDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn(
      '[WirehouseFlow] PostgreSQL env variables not configured yet; API waiting for DB secrets.'
    );
    return;
  }

  const health = await testDatabaseConnection();
  if (!health.connected) {
    console.warn(
      `[WirehouseFlow] PostgreSQL connection skipped at startup (${health.error || 'unreachable'}). Verify PGHOST/PGUSER/PGPASSWORD secrets.`
    );
    return;
  }

  const db = getDb();
  if (!db) return;

  try {
    await migrate(db, {
      migrationsFolder: path.resolve(process.cwd(), 'drizzle'),
    });
    console.log('[WirehouseFlow] PostgreSQL migrations verified (no auto-seeding).');
  } catch (err) {
    const { message } = extractDbErrorMessage(err);
    console.warn('[WirehouseFlow] PostgreSQL migration warning:', message);
  }
}

async function startServer(): Promise<void> {
  await bootstrapDatabase();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  // Hardened security headers without blocking AI Studio iframe preview
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    if (IS_PROD) {
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self';"
      );
    }

    const origin = req.headers.origin;
    if (origin) {
      if (isOriginAllowed(req, origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-API-Key');
        if (req.method === 'OPTIONS') {
          res.status(204).end();
          return;
        }
      } else if (req.path.startsWith('/api')) {
        res.status(403).json({ error: 'Cross-origin request rejected by CORS policy' });
        return;
      }
    }

    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.use('/api', apiLimiter);
  app.use('/api/auth', authRouter);
  app.use('/api/ingest', ingestLimiter, ingestRouter);
  app.use('/api', dashboardRouter);

  // Consistent JSON 404 for unknown API endpoints
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found' });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[WirehouseFlow] Express server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[WirehouseFlow] Fatal server startup error:', err);
  process.exit(1);
});
