import app from './app.js';
import { httpServerHandler } from 'cloudflare:node';
import { runWithEnv, getStore } from './lib/runtime-env.js';
import { runPushTick } from './lib/push-cron.js';
import { runMonthlyTickIfDue } from './lib/monthly-cron.js';
import type { PrismaClient } from './generated/prisma/client.js';

// Cloudflare Workers entry point. Express has no place to "listen" on Workers,
// so we start it on an in-Worker port and let httpServerHandler() bridge each
// incoming fetch to it. Every invocation runs inside runWithEnv() so the
// captured env (incl. the Hyperdrive binding) and a per-request Prisma client
// are reachable from the Express handlers via AsyncLocalStorage. Scheduling
// (notifications + monthly rolling) is handled by the Cron Triggers declared in
// wrangler.jsonc — see scheduled() below.
app.listen(8080);

const http = httpServerHandler({ port: 8080 });

// Map the Worker's plain-string vars/secrets onto process.env once, so the
// existing code that reads process.env.JWT_SECRET / VAPID_* /
// CREDENTIALS_ENCRYPTION_KEY works unchanged. Object bindings (HYPERDRIVE) are
// skipped. Values are static across requests, so setting them is race-free.
function hydrateProcessEnv(env: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string' && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Close the request-scoped Prisma client (and its Hyperdrive socket) once the
// work is done. Deferred via waitUntil so it never delays the response.
function disposeClient(ctx: { waitUntil(p: Promise<unknown>): void }) {
  const client = getStore()?.client as PrismaClient | undefined;
  if (client) ctx.waitUntil(client.$disconnect());
}

export default {
  fetch(request: Request, env: Record<string, unknown>, ctx: { waitUntil(p: Promise<unknown>): void }) {
    hydrateProcessEnv(env);
    return runWithEnv(env, async () => {
      try {
        return await (http.fetch as (r: Request, e: unknown, c: unknown) => Promise<Response>)(request, env, ctx);
      } finally {
        disposeClient(ctx);
      }
    });
  },
  async scheduled(_controller: { cron: string }, env: Record<string, unknown>, _ctx: { waitUntil(p: Promise<unknown>): void }) {
    hydrateProcessEnv(env);
    await runWithEnv(env, async () => {
      try {
        // نبضة موحّدة كل 5 دقائق: الإشعارات دائماً، والتوليد الشهري داخل نافذته فقط.
        await runPushTick();
        await runMonthlyTickIfDue();
      } finally {
        const client = getStore()?.client as PrismaClient | undefined;
        if (client) await client.$disconnect();
      }
    });
  },
};
