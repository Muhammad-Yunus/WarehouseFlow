import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: {
    host: (process.env.PGHOST || 'localhost').trim(),
    port: Number(process.env.PGPORT || 5432),
    database: (process.env.PGDATABASE || 'postgres').trim(),
    user: (process.env.PGUSER || 'postgres').trim(),
    password: process.env.PGPASSWORD || '',
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
  },
});
