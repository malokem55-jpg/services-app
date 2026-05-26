import prisma from '../lib/prisma.js';

export type ClientPaymentMonthlyCreateInput = {
  clientId: number;
  iqamaEndDate?: string;
  month?: string;
  receivedDate?: string;
  amount?: number;
  receivedAmount?: number;
  status?: string;
  notes?: string;
};

export type ClientPaymentMonthlyUpdateInput = {
  iqamaEndDate?: string;
  month?: string;
  receivedDate?: string;
  amount?: number;
  receivedAmount?: number;
  status?: string;
  notes?: string;
};

export async function listClientPaymentMonthlies(clientId: number) {
  return prisma.clientPaymentMonthly.findMany({
    where: { clientId },
    orderBy: { month: 'desc' },
  });
}

export async function getClientPaymentMonthly(id: number) {
  return prisma.clientPaymentMonthly.findUnique({ where: { id } });
}

export async function createClientPaymentMonthly(data: ClientPaymentMonthlyCreateInput) {
  return prisma.clientPaymentMonthly.create({
    data: {
      clientId: data.clientId,
      iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : undefined,
      month: data.month,
      receivedDate: data.receivedDate ? new Date(data.receivedDate) : undefined,
      amount: data.amount,
      receivedAmount: data.receivedAmount,
      status: data.status,
      notes: data.notes,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateClientPaymentMonthly(
  id: number,
  data: ClientPaymentMonthlyUpdateInput,
) {
  return prisma.clientPaymentMonthly.update({
    where: { id },
    data: {
      ...(data.iqamaEndDate !== undefined && {
        iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : null,
      }),
      ...(data.month !== undefined && { month: data.month }),
      ...(data.receivedDate !== undefined && {
        receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
      }),
      ...(data.amount !== undefined && { amount: data.amount }),
      ...(data.receivedAmount !== undefined && { receivedAmount: data.receivedAmount }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date(),
    },
  });
}

export async function deleteClientPaymentMonthly(id: number) {
  return prisma.clientPaymentMonthly.delete({ where: { id } });
}
