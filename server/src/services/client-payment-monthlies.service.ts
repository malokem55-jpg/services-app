import prisma from '../lib/prisma.js';
import { ensureUpcomingInstallment } from './clients.service.js';

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
 * يُرحَّل الفرق إلى الدفعية القادمة الموجودة في الجدول. إن كانت هذه آخر
 * دفعية في الجدول تُنشأ دفعية إضافية بمبلغ الفرق فقط حتى لا يضيع الدين.
 */
export async function payClientPaymentMonthly(id: number, data: PayClientPaymentMonthlyInput) {
  // القراءات خارج الـ transaction لتقليل زمنها (قاعدة البيانات بعيدة وكل استعلام يكلف زمن ذهاب وإياب)
  const record = await prisma.clientPaymentMonthly.findUnique({
    where: { id },
    include: {
      client: {
        select: { id: true, iqamaEndDate: true, amount: true, generateMonthlyAfterIqama: true },
      },
    },
  });
  if (!record) return null;

  // خيار "التوليد بعد انتهاء الإقامة" مفعَّل: الأشهر مستمرة بلا نهاية،
  // فدفعية الشهر التالي المنشأة هنا تكون قسطاً كاملاً (+ المرحَّل إن وجد)
  const rolling = record.client?.generateMonthlyAfterIqama === true;

  // الدفعية القادمة غير المسدّدة إن كانت منشأة مسبقاً
  const nextExisting = await prisma.clientPaymentMonthly.findFirst({
    where: {
      clientId: record.clientId,
      id: { not: record.id },
      status: { not: 'paid' },
      ...(record.receivedDate && { receivedDate: { gt: record.receivedDate } }),
    },
    orderBy: { receivedDate: 'asc' },
  });

  const due = record.amount ?? 0;
  const carryOver = due - data.receivedAmount;
  const carriedFromDate = record.receivedDate
    ? record.receivedDate.toISOString().slice(0, 10)
    : record.month ?? '';
  const carriedNote = `يشمل مبلغ مرحّل (${carryOver}) من دفعية ${carriedFromDate}`.trim();

  const result = await prisma.$transaction(async (tx) => {
    const paid = await tx.clientPaymentMonthly.update({
      where: { id },
      data: {
        receivedAmount: data.receivedAmount,
        status: 'paid',
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: new Date(),
      },
    });

    // الجدول مُنشأ مقدماً حتى انتهاء الإقامة: التسديد الكامل يعلّم الدفعية فقط،
    // والفرق الجزئي يُضاف إلى الدفعية القادمة الموجودة دون إنشاء جديدة
    let next = nextExisting;

    if (carryOver > 0) {
      if (nextExisting) {
        next = await tx.clientPaymentMonthly.update({
          where: { id: nextExisting.id },
          data: {
            amount: (nextExisting.amount ?? 0) + carryOver,
            carriedOverAmount: (nextExisting.carriedOverAmount ?? 0) + carryOver,
            carriedFromMonth: carriedFromDate,
            notes: nextExisting.notes ? `${nextExisting.notes}\n${carriedNote}` : carriedNote,
            updatedAt: new Date(),
          },
        });
      } else {
        // تسديد جزئي في آخر دفعية بالجدول: دفعية إضافية بمبلغ الفرق فقط —
        // ومع خيار التوليد المستمر يكون الشهر التالي مستحقاً فتشمل قسطه كاملاً
        const nextDueDate = addMonths(record.receivedDate ?? new Date(), 1);
        const clientIqamaEnd = record.client?.iqamaEndDate ?? record.iqamaEndDate;
        const baseAmount = rolling ? record.client?.amount ?? 0 : 0;
        next = await tx.clientPaymentMonthly.create({
          data: {
            clientId: record.clientId,
            iqamaEndDate: clientIqamaEnd,
            // مجاراة صيغة الشهر الموجودة في البيانات ("MM")
            month: nextDueDate.toISOString().slice(5, 7),
            receivedDate: nextDueDate,
            amount: baseAmount + carryOver,
            carriedOverAmount: carryOver,
            carriedFromMonth: carriedFromDate,
            status: 'un-paid',
            notes: carriedNote,
            afterIqama: rolling && (!clientIqamaEnd || nextDueDate > clientIqamaEnd),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }
    }

    return { paid, next };
  }, { timeout: 20000, maxWait: 10000 });

  // تسديد كامل لآخر دفعية مع خيار التوليد المستمر: ضمان توليد دفعية
  // الشهر التالي عند حلول موعدها (الدالة نفسها تتحقق من تفعيل الخيار)
  if (rolling && record.clientId) {
    await ensureUpcomingInstallment(record.clientId);
  }
  return result;
}
