import prisma from '../lib/prisma.js';

export interface Stats {
  clientsCount: number;
  organizationsCount: number;
  usersCount: number;
}

export async function getStats(): Promise<Stats> {
  const [clientsCount, organizationsCount, usersCount] =
    await Promise.all([
      prisma.client.count(),
      prisma.organization.count(),
      prisma.user.count(),
    ]);

  return { clientsCount, organizationsCount, usersCount };
}
