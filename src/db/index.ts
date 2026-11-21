import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export type Database = NodePgDatabase<typeof schema>;

let poolInstance: Pool | null = null;
let dbInstance: Database | null = null;

function hasDiscretePgVars(): boolean {
  return Boolean(
    process.env.PGHOST &&
      process.env.PGHOST.trim().length > 0 &&
      process.env.PGUSER &&
      process.env.PGUSER.trim().length > 0 &&
      process.env.PGPASSWORD &&
      process.env.PGPASSWORD.length > 0
  );
}

export function isDatabaseConfigured(): boolean {
  return hasDiscretePgVars();
}

function createPool(): Pool {
  const useSsl = process.env.PGSSLMODE !== 'disable';

  return new Pool({
    host: process.env.PGHOST!.trim(),
    port: Number(process.env.PGPORT || 5432),
    database: (process.env.PGDATABASE || 'postgres').trim(),
    user: process.env.PGUSER!.trim(),
    password: process.env.PGPASSWORD,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    ssl: useSsl ? { rejectUnauthorized: false } : false,
  });
}

export function getDb(): Database | null {
  if (!isDatabaseConfigured()) {
    return null;
  }
  if (!poolInstance) {
    poolInstance = createPool();
    poolInstance.on('error', (err) => {
      console.warn('PostgreSQL idle pool warning:', err.message);
    });
  }
  if (!dbInstance) {
    dbInstance = drizzle(poolInstance, { schema });
  }
  return dbInstance;
}

export function extractDbErrorMessage(err: unknown): {
  message: string;
  isConnectionError: boolean;
} {
  const errObj = err as { message?: string; code?: string; cause?: { message?: string; code?: string } } | null;
  const causeMsg = errObj?.cause?.message;
  const rootMsg = errObj?.message;
  const code = errObj?.cause?.code || errObj?.code || '';
  const combined = [causeMsg, rootMsg].filter(Boolean).join(' | ') || 'Unknown database error';

  const isConnectionError =
    /^(28P01|28000|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|ECONNRESET|57P01|57P02|57P03)$/i.test(code) ||
    /password authentication|ECIRCUITBREAKER|ECONNREFUSED|ETIMEDOUT|timeout|getaddrinfo|connection terminated|remaining connection slots/i.test(
      combined
    );

  return {
    message: causeMsg || rootMsg || 'Unknown database error',
    isConnectionError,
  };
}

function getNonSecretConnectionMeta(): {
  source: 'PG_VARS' | 'none';
  host?: string;
  port?: number;
  database?: string;
  user?: string;
} {
  if (hasDiscretePgVars()) {
    return {
      source: 'PG_VARS',
      host: process.env.PGHOST!.trim(),
      port: Number(process.env.PGPORT || 5432),
      database: (process.env.PGDATABASE || 'postgres').trim(),
      user: process.env.PGUSER!.trim(),
    };
  }
  return { source: 'none' };
}

export async function testDatabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  source?: string;
  host?: string;
  user?: string;
  error?: string;
}> {
  const meta = getNonSecretConnectionMeta();
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      source: meta.source,
      error: 'Database environment variables not set',
    };
  }
  try {
    getDb();
    if (!poolInstance) {
      return { configured: false, connected: false, source: meta.source };
    }
    await poolInstance.query('SELECT 1');
    return {
      configured: true,
      connected: true,
      source: meta.source,
      host: meta.host,
      user: meta.user,
    };
  } catch (err) {
    const { message } = extractDbErrorMessage(err);
    return {
      configured: true,
      connected: false,
      source: meta.source,
      host: meta.host,
      user: meta.user,
      error: message,
    };
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (poolInstance) {
    await poolInstance.end();
    poolInstance = null;
    dbInstance = null;
  }
}
