import prisma from '../lib/prisma.js';

export type ClientPaymentCreateInput = {
  clientId: number;
  amount?: number;
  nextPaymentDate?: string;
  isDone?: boolean;
  lastPayment?: boolean;
  notes?: string;
};

export type ClientPaymentUpdateInput = {
  amount?: number;
  nextPaymentDate?: string;
  isDone?: boolean;
  lastPayment?: boolean;
  notes?: string;
};

export async function listClientPayments(clientId: number) {
  return prisma.clientPayment.findMany({
    where: { clientId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getClientPayment(id: number) {
  return prisma.clientPayment.findUnique({ where: { id } });
}

export async function createClientPayment(data: ClientPaymentCreateInput) {
  return prisma.clientPayment.create({
    data: {
      clientId: data.clientId,
      amount: data.amount,
      nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : undefined,
      isDone: data.isDone ?? true,
      lastPayment: data.lastPayment ?? true,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateClientPayment(id: number, data: ClientPaymentUpdateInput) {
  return prisma.clientPayment.update({
    where: { id },
    data: {
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.nextPaymentDate !== undefined && {
        nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
      }),
      ...(data.isDone !== undefined && { isDone: data.isDone }),
      ...(data.lastPayment !== undefined && { lastPayment: data.lastPayment }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date(),
    },
  });
}

export async function deleteClientPayment(id: number) {
  return prisma.clientPayment.delete({ where: { id } });
}
