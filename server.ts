import 'dotenv/config';
import path from 'node:path';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import express from 'express';
import { getDb, isDatabaseConfigured } from './src/db/index.ts';
import { authRouter } from './src/server/routes/authRoutes.ts';
import { dashboardRouter } from './src/server/routes/dashboardRoutes.ts';
import { ingestRouter } from './src/server/routes/ingestRoutes.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

async function bootstrapDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn(
      '[WirehouseFlow] PostgreSQL env variables not configured yet; API waiting for DB secrets.'
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
    console.error(
      '[WirehouseFlow] PostgreSQL initialization warning:',
      err instanceof Error ? err.message : err
    );
  }
}

async function startServer(): Promise<void> {
  await bootstrapDatabase();

  const app = express();
  app.set('trust proxy', 1);

  // Security headers without restricting iframe embedding in AI Studio preview
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.use('/api/auth', authRouter);
  app.use('/api/ingest', ingestRouter);
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
