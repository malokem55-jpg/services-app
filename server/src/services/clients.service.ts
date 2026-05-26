import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

// Relations included in every single-client response
const clientInclude = {
  service: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
  steps: {
    include: { step: { select: { id: true, name: true, number: true, order: true } } },
    orderBy: { stepDate: 'desc' as const },
  },
  payments: { orderBy: { createdAt: 'desc' as const } },
  paymentMonthlies: { orderBy: { month: 'desc' as const } },
} satisfies Prisma.ClientInclude;

export type ClientCreateInput = {
  name?: string;
  phone?: string;
  passport?: string;
  boardNumber?: string;
  visaNumber?: string;
  iqamaNumber?: string;
  iqamaEndDate?: string;
  cardType?: string;
  cardValue?: number;
  notes?: string;
  paymentType?: string;
  nextPaymentDate?: string;
  amount?: number;
  serviceId?: number;
  organizationId?: number;
  lastStepId?: number;
};

export async function listClients(search?: string) {
  const where: Prisma.ClientWhereInput = search
    ? {
        OR: [
          { name: { contains: search } },
          { iqamaNumber: { contains: search } },
        ],
      }
    : {};

  return prisma.client.findMany({
    where,
    select: {
      id: true,
      name: true,
      phone: true,
      iqamaNumber: true,
      iqamaEndDate: true,
      passport: true,
      boardNumber: true,
      cardType: true,
      paymentType: true,
      nextPaymentDate: true,
      amount: true,
      lastStepId: true,
      service: { select: { id: true, name: true } },
      organization: { select: { id: true, name: true, number: true } },
      steps: {
        take: 1,
        orderBy: { stepDate: 'desc' as const },
        select: { step: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClient(id: number) {
  return prisma.client.findUnique({ where: { id }, include: clientInclude });
}

export async function createClient(data: ClientCreateInput) {
  return prisma.client.create({
    data: {
      name: data.name,
      phone: data.phone,
      passport: data.passport,
      boardNumber: data.boardNumber,
      visaNumber: data.visaNumber,
      iqamaNumber: data.iqamaNumber,
      iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : undefined,
      cardType: data.cardType,
      cardValue: data.cardValue,
      notes: data.notes,
      paymentType: data.paymentType,
      nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : undefined,
      amount: data.amount,
      serviceId: data.serviceId,
      organizationId: data.organizationId,
      lastStepId: data.lastStepId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: clientInclude,
  });
}

export async function updateClient(id: number, data: ClientCreateInput) {
  return prisma.client.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.passport !== undefined && { passport: data.passport }),
      ...(data.boardNumber !== undefined && { boardNumber: data.boardNumber }),
      ...(data.visaNumber !== undefined && { visaNumber: data.visaNumber }),
      ...(data.iqamaNumber !== undefined && { iqamaNumber: data.iqamaNumber }),
      ...(data.iqamaEndDate !== undefined && {
        iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : null,
      }),
      ...(data.cardType !== undefined && { cardType: data.cardType }),
      ...(data.cardValue !== undefined && { cardValue: data.cardValue }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.paymentType !== undefined && { paymentType: data.paymentType }),
      ...(data.nextPaymentDate !== undefined && {
        nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
      }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
      ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
      ...(data.lastStepId !== undefined && { lastStepId: data.lastStepId }),
      updatedAt: new Date(),
    },
    include: clientInclude,
  });
}

export async function deleteClient(id: number) {
  return prisma.client.delete({ where: { id } });
}
