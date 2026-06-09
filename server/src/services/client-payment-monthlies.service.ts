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

export type PayClientPaymentMonthlyInput = {
  receivedAmount: number;
  notes?: string;
};

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * تسديد دفعية شهرية: يسجّل المبلغ المستلم، وإن كان أقل من مبلغ الدفعية
 * يُرحَّل الفرق ويُضاف إلى الدفعية الشهرية القادمة التي تُنشأ تلقائياً.
 */
export async function payClientPaymentMonthly(id: number, data: PayClientPaymentMonthlyInput) {
  return prisma.$transaction(async (tx) => {
    const record = await tx.clientPaymentMonthly.findUnique({
      where: { id },
      include: { client: { select: { id: true, amount: true, iqamaEndDate: true } } },
    });
    if (!record) return null;

    const due = record.amount ?? 0;
    const carryOver = due - data.receivedAmount;

    const paid = await tx.clientPaymentMonthly.update({
      where: { id },
      data: {
        receivedAmount: data.receivedAmount,
        status: 'paid',
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      },
    });

    // الدفعية القادمة = القسط الشهري الأساسي + الفرق المرحَّل
    const baseAmount = record.client?.amount ?? due;
    const nextDueDate = addMonths(record.receivedDate ?? new Date(), 1);

    const next = await tx.clientPaymentMonthly.create({
      data: {
        clientId: record.clientId,
        iqamaEndDate: record.client?.iqamaEndDate ?? record.iqamaEndDate,
        month: nextDueDate.toISOString().slice(0, 7),
        receivedDate: nextDueDate,
        amount: baseAmount + carryOver,
        status: 'un-paid',
        notes: carryOver > 0
          ? `يشمل مبلغ مرحّل (${carryOver}) من دفعية ${record.month ?? ''}`.trim()
          : undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    if (record.clientId) {
      await tx.client.update({
        where: { id: record.clientId },
        data: { nextPaymentDate: nextDueDate, updatedAt: new Date() },
      });
    }

    return { paid, next };
  });
}
