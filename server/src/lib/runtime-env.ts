// Per-request context for the Cloudflare Worker.
//
// On Workers we connect to Postgres over a real TCP socket (via the Hyperdrive
// binding). workerd forbids reusing an I/O object across requests, so the Prisma
// client — which holds that socket — must be created per request, never as a
// module-global singleton. We carry both the Worker `env` (to read the
// Hyperdrive binding) and the request's lazily-created Prisma client in an
// AsyncLocalStorage store that propagates through the Express bridge.
//
// On plain Node (local scripts / dev) there is no store; callers fall back to
// env vars and a module-global client.

import { AsyncLocalStorage } from 'node:async_hooks';

export type WorkerEnv = Record<string, unknown> | undefined;

export interface RequestStore {
  env: Record<string, unknown>;
  // Lazily created per-request Prisma client (typed as unknown here to avoid a
  // circular import with lib/prisma.ts; cast at the use site).
  client?: unknown;
}

const als = new AsyncLocalStorage<RequestStore>();

// Fallback for code paths that captured env before ALS existed; also lets
// getWorkerEnv() work outside a request scope.
let globalEnv: WorkerEnv;

/** Run `fn` within a fresh request scope carrying the Worker `env`. */
export function runWithEnv<T>(env: Record<string, unknown>, fn: () => T): T {
  globalEnv = env;
  return als.run({ env }, fn);
}

/** The current request store, or undefined on plain Node / outside a request. */
export function getStore(): RequestStore | undefined {
  return als.getStore();
}

export function getWorkerEnv(): WorkerEnv {
  return als.getStore()?.env ?? globalEnv;
}

/** Read a single env value, preferring the Worker env, then process.env. */
export function readEnv(name: string): string | undefined {
  const fromWorker = getWorkerEnv()?.[name];
  if (typeof fromWorker === 'string' && fromWorker !== '') return fromWorker;
  const fromProcess = process.env[name];
  return fromProcess && fromProcess !== '' ? fromProcess : undefined;
}
