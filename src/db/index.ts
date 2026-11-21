import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

export type Database = NodePgDatabase<typeof schema>;

let poolInstance: Pool | null = null;
let dbInstance: Database | null = null;

export function isDatabaseConfigured(): boolean {
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return true;
  }
  return Boolean(
    process.env.PGHOST &&
      process.env.PGHOST.trim().length > 0 &&
      process.env.PGUSER &&
      process.env.PGUSER.trim().length > 0 &&
      process.env.PGPASSWORD &&
      process.env.PGPASSWORD.length > 0
  );
}

function createPool(): Pool {
  const useSsl = process.env.PGSSLMODE !== 'disable';

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0) {
    return new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 8000,
      ssl: useSsl ? { rejectUnauthorized: false } : false,
    });
  }

  return new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    database: process.env.PGDATABASE || 'postgres',
    user: process.env.PGUSER,
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
      console.error('PostgreSQL pool error:', err.message);
    });
  }
  if (!dbInstance) {
    dbInstance = drizzle(poolInstance, { schema });
  }
  return dbInstance;
}

export async function testDatabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!isDatabaseConfigured()) {
    return { configured: false, connected: false, error: 'Database environment variables not set' };
  }
  try {
    getDb();
    if (!poolInstance) {
      return { configured: false, connected: false };
    }
    await poolInstance.query('SELECT 1');
    return { configured: true, connected: true };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown database error',
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
