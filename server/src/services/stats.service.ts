import prisma from '../lib/prisma.js';

export interface Stats {
  clientsCount: number;
  servicesCount: number;
  organizationsCount: number;
  pendingPaymentsCount: number;
}

export async function getStats(): Promise<Stats> {
  const [clientsCount, servicesCount, organizationsCount, pendingPaymentsCount] =
    await Promise.all([
      prisma.client.count(),
      prisma.service.count(),
      prisma.organization.count(),
      prisma.clientPayment.count({ where: { isDone: false } }),
    ]);

  return { clientsCount, servicesCount, organizationsCount, pendingPaymentsCount };
}
