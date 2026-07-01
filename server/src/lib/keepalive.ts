import prisma from './prisma.js';

// Keep-alive tick — the cheapest possible query. Free Supabase projects pause
// after 7 days idle; a daily tick keeps the shared project (and every schema in
// it, incl. `hameed`) awake. Wired to the Worker's scheduled() handler (Cron
// Trigger) and to node-cron locally.
export async function keepAliveTick(): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('keep-alive ok');
  } catch (err) {
    console.error('keep-alive failed', err);
  }
}
