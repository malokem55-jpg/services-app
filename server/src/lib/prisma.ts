import type { PrismaClient } from '../generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import { getStore } from './runtime-env.js';

// Two generated clients share one identical API surface: the `workerd` client
// runs inside the Worker; the `nodejs` client runs in local dev and CLI scripts.
// They are loaded with a CONDITIONAL DYNAMIC import (not static) so that the
// unused one is never *evaluated* on the current runtime — the node client's
// top-level `fileURLToPath(import.meta.url)` crashes under workerd, and the
// workerd client's `?module` WASM import can't be evaluated under Node. Only the
// awaited branch's module body executes; the other is bundled but dormant.
const isWorkerd =
  typeof navigator !== 'undefined' && (navigator as { userAgent?: string }).userAgent === 'Cloudflare-Workers';

// The node-client path is assembled at runtime so the bundler can't statically
// follow it — this keeps the node client (and its base64 WASM) OUT of the Worker
// bundle, which must stay under Cloudflare's size limit. The Worker only ever
// loads the workerd client (imported by a literal specifier); Node/dev resolves
// the computed path at runtime.
const nodeClientSpecifier = ['..', 'generated', 'prisma-node', 'client.js'].join('/');

const ClientCtor = (
  isWorkerd
    ? await import('../generated/prisma/client.js')
    : await import(/* @vite-ignore */ nodeClientSpecifier)
).PrismaClient as unknown as new (opts: unknown) => PrismaClient;

// Connection strategy (Cloudflare + Supabase, no Prisma Accelerate):
//  - On Cloudflare Workers we reach Supabase Postgres over the HYPERDRIVE
//    binding (edge connection pooling + a real TCP socket). That socket cannot
//    be shared across requests, so we build ONE PrismaClient per request and
//    cache it on the request store (see lib/runtime-env.ts). worker.ts disposes
//    it after the response.
//  - On plain Node (local scripts / dev) we connect directly using
//    DIRECT_DATABASE_URL with a module-global client.
//
// All app tables live in the dedicated `hameed` Postgres schema; the adapter
// qualifies every generated query with it (DB_SCHEMA overrides if set). This
// keeps this app's data isolated from the other apps (salon/beba) sharing the
// same Supabase database.
const SCHEMA = process.env.DB_SCHEMA ?? 'hameed';

// Keep the per-request pool small: this database is shared with other apps, so a
// low `max` avoids exhausting Supabase's connection budget.
function makeWorkerClient(connectionString: string): PrismaClient {
  return new ClientCtor({
    adapter: new PrismaPg({ connectionString, max: 3 }, { schema: SCHEMA }),
  }) as unknown as PrismaClient;
}

let nodeClient: PrismaClient | undefined;

function makeNodeClient(): PrismaClient {
  const directUrl = process.env.DIRECT_DATABASE_URL;
  if (!directUrl) {
    throw new Error('No database connection configured: set DIRECT_DATABASE_URL (local Node).');
  }
  // Strip query params (?schema=…&sslmode=…): the schema is applied via the
  // adapter option below, and leaving `sslmode=require` in the URL makes
  // node-postgres verify Supabase's cert chain (which it rejects). TLS is
  // instead configured explicitly with rejectUnauthorized:false.
  const runtimeUrl = directUrl.split('?')[0];
  return new ClientCtor({
    adapter: new PrismaPg(
      { connectionString: runtimeUrl, ssl: { rejectUnauthorized: false } },
      { schema: SCHEMA },
    ),
  }) as unknown as PrismaClient;
}

function resolveClient(): PrismaClient {
  const store = getStore();
  if (store) {
    if (!store.client) {
      const hyperdrive = (store.env as { HYPERDRIVE?: { connectionString?: string } }).HYPERDRIVE;
      const connectionString = hyperdrive?.connectionString;
      if (!connectionString) {
        throw new Error('HYPERDRIVE binding is missing its connectionString on the Worker env.');
      }
      store.client = makeWorkerClient(connectionString);
    }
    return store.client as PrismaClient;
  }

  // Plain Node fallback (local scripts / dev).
  if (!nodeClient) nodeClient = makeNodeClient();
  return nodeClient;
}

// A Proxy keeps the singleton import shape (`import prisma from '../lib/prisma'`)
// used across the codebase while resolving to the correct per-request client.
// Top-level client methods ($transaction, $queryRaw, ...) are bound to the real
// client so their internal `this` stays correct; model delegates are objects and
// are returned as-is.
const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = resolveClient();
    const value = client[prop as keyof PrismaClient];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
}) as PrismaClient;

export default prisma;
