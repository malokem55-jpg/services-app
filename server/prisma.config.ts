import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 moves the CLI's connection URL out of schema.prisma into this file.
// Migrations/introspection use the direct (TCP) Supabase connection on port
// 5432 (DIRECT_DATABASE_URL). The application runtime connects over the
// Hyperdrive binding (Workers) or the same direct URL (local Node) via the pg
// driver adapter — see src/lib/prisma.ts.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    path: path.join('prisma', 'migrations'),
  },
  datasource: {
    url: process.env.DIRECT_DATABASE_URL,
  },
});
