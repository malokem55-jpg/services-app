import prisma from '../lib/prisma.js';

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function getMonthlyPaymentAlerts() {
  const today = startOfToday();
  const in7Days = addDays(today, 7);

  return prisma.client.findMany({
    where: {
      nextPaymentDate: { gte: today, lte: in7Days },
    },
    include: { service: { select: { name: true } } },
    orderBy: { nextPaymentDate: 'asc' },
  });
}

export async function getIqamaExpirySoonAlerts() {
  const today = startOfToday();
  const in7Days = addDays(today, 7);
  const in30Days = addDays(today, 30);

  return prisma.client.findMany({
    where: {
      iqamaEndDate: { gt: in7Days, lte: in30Days },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { iqamaEndDate: 'asc' },
  });
}

export async function getIqamaExpiryUrgentAlerts() {
  const today = startOfToday();
  const in7Days = addDays(today, 7);

  return prisma.client.findMany({
    where: {
      iqamaEndDate: { lte: in7Days },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true } },
    },
    orderBy: { iqamaEndDate: 'asc' },
  });
}
