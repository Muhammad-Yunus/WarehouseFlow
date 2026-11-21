import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

function buildConnectionUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const host = process.env.PGHOST || 'localhost';
  const port = process.env.PGPORT || '5432';
  const database = process.env.PGDATABASE || 'postgres';
  const user = encodeURIComponent(process.env.PGUSER || 'postgres');
  const password = encodeURIComponent(process.env.PGPASSWORD || '');
  const sslMode = process.env.PGSSLMODE || 'no-verify';
  return `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=${sslMode}`;
}

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: buildConnectionUrl(),
  },
});
