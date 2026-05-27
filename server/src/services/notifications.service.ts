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
  const in3Days = addDays(today, 3);

  return prisma.clientPaymentMonthly.findMany({
    where: {
      receivedDate: { lte: in3Days },
      status: 'un-paid',
    },
    include: {
      client: {
        select: {
          name: true,
          iqamaNumber: true,
          service: { select: { name: true } },
          organization: { select: { name: true } },
        },
      },
    },
    orderBy: { receivedDate: 'asc' },
  });
}

export async function getCustomPaymentAlerts() {
  const today = startOfToday();
  const in10Days = addDays(today, 10);

  return prisma.client.findMany({
    where: {
      nextPaymentDate: { not: null, lt: in10Days },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true } },
    },
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
