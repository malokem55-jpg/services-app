import prisma from '../lib/prisma.js';

export interface Stats {
  clientsCount: number;
  underProcedureCount: number;
  organizationsCount: number;
  usersCount: number;
}

export async function getStats(): Promise<Stats> {
  const [clientsCount, underProcedureCount, organizationsCount, usersCount] =
    await Promise.all([
      prisma.client.count(),
      // عميل تحت الإجراء = لم يصدر له رقم إقامة بعد
      prisma.client.count({
        where: { OR: [{ iqamaNumber: null }, { iqamaNumber: '' }] },
      }),
      prisma.organization.count(),
      prisma.user.count(),
    ]);

  return { clientsCount, underProcedureCount, organizationsCount, usersCount };
}
