// NOTE: env loading is done by the entry points (local Node via dotenv, and
// Cloudflare Workers via bindings). This module must stay free of `dotenv` so it
// can be bundled for Workers without pulling in fs.

/**
 * The direct (TCP) Supabase connection string used by the Prisma CLI for
 * migrations and by local Node scripts. Single source of truth:
 * DIRECT_DATABASE_URL (Supabase → Project Settings → Database → Connection
 * string → "Direct connection", port 5432).
 */
export function requireDirectDatabaseUrl(): string {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url || url.trim() === '') {
    throw new Error('Missing required environment variable: DIRECT_DATABASE_URL');
  }
  return url;
}
