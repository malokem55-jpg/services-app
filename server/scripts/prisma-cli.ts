/**
 * Wrapper around the Prisma CLI.
 *
 * The Prisma CLI (migrate, generate, db, ...) does not run our application code.
 * prisma.config.ts supplies the CLI with the connection URL from
 * DIRECT_DATABASE_URL; this wrapper just loads .env first and forwards every
 * argument to the real `prisma` binary.
 *
 * Usage: `npm run prisma -- migrate dev`, `npm run prisma -- generate`, ...
 */
import 'dotenv/config';
import { spawnSync } from 'node:child_process';

const result = spawnSync('prisma', process.argv.slice(2), {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
