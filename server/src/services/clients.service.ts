import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { NO_CARD } from '../lib/card-types.js';
import { createIssuanceInTx } from './card-issuances.service.js';

// Relations included in every single-client response
const clientInclude = {
  service: { select: { id: true, name: true } },
  organization: { select: { id: true, name: true } },
  arrivalPlace: { select: { id: true, name: true } },
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
  notes?: string;
  paymentType?: string;
  nextPaymentDate?: string;
  amount?: number;
  /** المبلغ المستلم عند التحويل من شهري إلى سنوي — يُسجَّل كدفعة أولى */
  receivedAmount?: number;
  serviceId?: number;
  organizationId?: number;
  lastStepId?: number;
  /** جهة القدوم (اختيارية) — null تمسحها */
  arrivalPlaceId?: number | null;
};

// ─── جدول الأقساط الشهرية ─────────────────────────────────────────────────────

const MONTHLY = 'شهري';

// خطأ تحقق يصل للواجهة برسالته العربية كاستجابة 400 عبر errorHandler
class ValidationError extends Error {
  statusCode = 400;
}

function parseReceiptDay(value: string | null | undefined): number {
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    throw new ValidationError('يوم الاستلام من كل شهر مطلوب للدفع الشهري (رقم بين 1 و 31)');
  }
  return day;
}

// تاريخ الاستحقاق في شهر معيّن مع تثبيت اليوم داخل طول الشهر (مثلاً 31 في فبراير → 28/29)
function dueDateIn(year: number, monthIndex: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(day, lastDay)));
}

/**
 * يولّد دفعية لكل شهر في "يوم الاستلام" حتى تاريخ انتهاء الإقامة.
 * بدون startAfter يبدأ من أقرب يوم استلام قادم (التحويل/الإنشاء)،
 * ومع startAfter يبدأ من الشهر التالي لآخر دفعية موجودة (تجديد الإقامة).
 */
function buildMonthlySchedule(
  day: number,
  amount: number,
  iqamaEndDate: Date,
  startAfter?: Date | null,
) {
  const now = new Date();
  let cursor: Date;
  if (startAfter) {
    cursor = dueDateIn(startAfter.getUTCFullYear(), startAfter.getUTCMonth() + 1, day);
  } else {
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    cursor = dueDateIn(today.getUTCFullYear(), today.getUTCMonth(), day);
    if (cursor < today) cursor = dueDateIn(today.getUTCFullYear(), today.getUTCMonth() + 1, day);
  }

  const entries: Prisma.ClientPaymentMonthlyCreateManyInput[] = [];
  while (cursor <= iqamaEndDate) {
    entries.push({
      // مجاراة صيغة الشهر الموجودة في البيانات ("MM")
      month: String(cursor.getUTCMonth() + 1).padStart(2, '0'),
      receivedDate: cursor,
      amount,
      status: 'un-paid',
      iqamaEndDate,
      createdAt: now,
      updatedAt: now,
    });
    cursor = dueDateIn(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, day);
  }
  return entries;
}

// إعادة تسعير الدفعيات غير المسدّدة بالقسط الجديد مع الحفاظ على المبالغ المرحّلة فوقه
async function repriceUnpaidInstallments(
  tx: Prisma.TransactionClient,
  clientId: number,
  amount: number,
) {
  const unpaid = await tx.clientPaymentMonthly.findMany({
    where: { clientId, status: { not: 'paid' } },
    select: { id: true, carriedOverAmount: true },
  });
  for (const installment of unpaid) {
    await tx.clientPaymentMonthly.update({
      where: { id: installment.id },
      data: { amount: amount + (installment.carriedOverAmount ?? 0), updatedAt: new Date() },
    });
  }
}

// مدخلات الجدول الشهري بعد التحقق: القسط ويوم الاستلام وتاريخ انتهاء الإقامة كلها إلزامية
function monthlyScheduleInputs(data: ClientCreateInput, fallback?: {
  boardNumber: string | null;
  iqamaEndDate: Date | null;
  amount: number | null;
}) {
  const day = parseReceiptDay(data.boardNumber ?? fallback?.boardNumber);
  const iqamaEndDate = data.iqamaEndDate ? new Date(data.iqamaEndDate) : fallback?.iqamaEndDate;
  if (!iqamaEndDate) {
    throw new ValidationError('تاريخ انتهاء الإقامة مطلوب للدفع الشهري');
  }
  const amount = data.amount ?? fallback?.amount;
  if (!amount || amount <= 0) {
    throw new ValidationError('القسط الشهري مطلوب');
  }
  return { day, iqamaEndDate, amount };
}

export async function listClients(search?: string, organizationId?: number) {
  const where: Prisma.ClientWhereInput = {
    ...(organizationId ? { organizationId } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { iqamaNumber: { contains: search } },
          ],
        }
      : {}),
  };

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
      arrivalPlace: { select: { id: true, name: true } },
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
  const isMonthly = data.paymentType === MONTHLY;

  if (!data.organizationId) {
    throw new ValidationError('المؤسسة مطلوبة');
  }
  const organizationId = data.organizationId;
  // كرت غير "بدون" عند الإدخال = إصدار فعلي يُخصم من رصيد المؤسسة.
  // "بدون" تعني عميلًا جاء بكرته من جهة سابقة أو بلا كرت — لا خصم ولا سجل.
  const issuedCardType = data.cardType && data.cardType !== NO_CARD ? data.cardType : null;

  const createData: Prisma.ClientUncheckedCreateInput = {
    name: data.name,
    phone: data.phone,
    passport: data.passport,
    boardNumber: data.boardNumber,
    visaNumber: data.visaNumber,
    iqamaNumber: data.iqamaNumber,
    iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : undefined,
    cardType: data.cardType,
    notes: data.notes,
    paymentType: data.paymentType,
    // الدفعة المخصصة (nextPaymentDate) خاصية سنوية فقط — العميل الشهري لا يملكها
    nextPaymentDate: isMonthly ? null : data.nextPaymentDate ? new Date(data.nextPaymentDate) : undefined,
    amount: data.amount,
    serviceId: data.serviceId,
    organizationId: data.organizationId,
    lastStepId: data.lastStepId,
    arrivalPlaceId: data.arrivalPlaceId ?? undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // عميل شهري جديد: يُولَّد جدول الأقساط كاملاً حتى تاريخ انتهاء الإقامة
  let schedule: Prisma.ClientPaymentMonthlyCreateManyInput[] = [];
  if (isMonthly) {
    const { day, iqamaEndDate, amount } = monthlyScheduleInputs(data);
    schedule = buildMonthlySchedule(day, amount, iqamaEndDate);
    if (schedule.length === 0) {
      throw new ValidationError('تاريخ انتهاء الإقامة يجب أن يكون بعد أقرب يوم استلام قادم');
    }
  }

  if (!isMonthly && !issuedCardType) {
    return prisma.client.create({ data: createData, include: clientInclude });
  }

  return prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: createData });
    if (issuedCardType) {
      await createIssuanceInTx(tx, {
        clientId: client.id,
        clientName: client.name ?? null,
        organizationId,
        cardType: issuedCardType,
      });
    }
    if (isMonthly) {
      await tx.clientPaymentMonthly.createMany({
        data: schedule.map((entry) => ({ ...entry, clientId: client.id })),
      });
    }
    return tx.client.findUniqueOrThrow({ where: { id: client.id }, include: clientInclude });
  }, { timeout: 20000, maxWait: 10000 });
}

export async function updateClient(id: number, data: ClientCreateInput) {
  const existing = await prisma.client.findUnique({
    where: { id },
    select: { paymentType: true, boardNumber: true, iqamaEndDate: true, amount: true },
  });
  if (!existing) return null;

  const wasMonthly = existing.paymentType === MONTHLY;
  const staysMonthly = data.paymentType !== undefined ? data.paymentType === MONTHLY : wasMonthly;

  const updateData: Prisma.ClientUncheckedUpdateInput = {
    ...(data.name !== undefined && { name: data.name }),
    ...(data.phone !== undefined && { phone: data.phone }),
    ...(data.passport !== undefined && { passport: data.passport }),
    ...(data.boardNumber !== undefined && { boardNumber: data.boardNumber }),
    ...(data.visaNumber !== undefined && { visaNumber: data.visaNumber }),
    ...(data.iqamaNumber !== undefined && { iqamaNumber: data.iqamaNumber }),
    ...(data.iqamaEndDate !== undefined && {
      iqamaEndDate: data.iqamaEndDate ? new Date(data.iqamaEndDate) : null,
    }),
    // cardType مقفول هنا عمدًا: الحقل مرآة لسجل الإصدارات ولا يتغير إلا عبره
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.paymentType !== undefined && { paymentType: data.paymentType }),
    ...(data.nextPaymentDate !== undefined && {
      nextPaymentDate: data.nextPaymentDate ? new Date(data.nextPaymentDate) : null,
    }),
    ...(data.amount !== undefined && { amount: data.amount }),
    ...(data.serviceId !== undefined && { serviceId: data.serviceId }),
    ...(data.organizationId !== undefined && { organizationId: data.organizationId }),
    ...(data.lastStepId !== undefined && { lastStepId: data.lastStepId }),
    ...(data.arrivalPlaceId !== undefined && { arrivalPlaceId: data.arrivalPlaceId }),
    updatedAt: new Date(),
  };

  if (!staysMonthly) {
    // التحويل من شهري إلى سنوي: يُمحى السجل المالي القديم بالكامل، يُمسح يوم
    // الاستلام، وتُسجَّل الدفعة الأولى بالمبلغ المستلم داخل نفس المعاملة
    if (wasMonthly) {
      if (!data.amount || data.amount <= 0) {
        throw new ValidationError('المبلغ الإجمالي مطلوب');
      }
      const receivedAmount = data.receivedAmount;
      if (receivedAmount === undefined) {
        throw new ValidationError('المبلغ المستلم مطلوب');
      }
      if (receivedAmount > data.amount) {
        throw new ValidationError('المبلغ المستلم لا يتجاوز المبلغ الإجمالي');
      }
      if (!data.nextPaymentDate) {
        throw new ValidationError('تاريخ الدفعة القادمة مطلوب للتحويل إلى سنوي');
      }
      // يوم الاستلام الشهري المخزَّن في boardNumber لم يعد له معنى للعميل السنوي
      updateData.boardNumber = null;

      return prisma.$transaction(async (tx) => {
        await tx.clientPaymentMonthly.deleteMany({ where: { clientId: id } });
        await tx.clientPayment.deleteMany({ where: { clientId: id } });
        await tx.client.update({ where: { id }, data: updateData });
        if (receivedAmount > 0) {
          await tx.clientPayment.create({
            data: {
              clientId: id,
              amount: receivedAmount,
              isDone: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });
        }
        return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
      }, { timeout: 20000, maxWait: 10000 });
    }

    return prisma.client.update({ where: { id }, data: updateData, include: clientInclude });
  }

  // الدفعة المخصصة خاصية سنوية فقط — تُمسح دائماً للعميل الشهري
  updateData.nextPaymentDate = null;

  // التحويل من سنوي إلى شهري: يُمحى السجل المالي القديم بالكامل (دفعات سنوية
  // ودفعيات شهرية، مسدّدة وغير مسدّدة) ويُولَّد جدول أقساط جديد
  if (!wasMonthly) {
    const { day, iqamaEndDate, amount } = monthlyScheduleInputs(data, existing);
    const schedule = buildMonthlySchedule(day, amount, iqamaEndDate);
    if (schedule.length === 0) {
      throw new ValidationError('تاريخ انتهاء الإقامة يجب أن يكون بعد أقرب يوم استلام قادم');
    }

    return prisma.$transaction(async (tx) => {
      await tx.clientPaymentMonthly.deleteMany({ where: { clientId: id } });
      await tx.clientPayment.deleteMany({ where: { clientId: id } });
      await tx.client.update({ where: { id }, data: updateData });
      await tx.clientPaymentMonthly.createMany({
        data: schedule.map((entry) => ({ ...entry, clientId: id })),
      });
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
  }

  // تغيير القسط لعميل شهري قائم يعيد تسعير كل الدفعيات غير المسدّدة
  const amountChanged = data.amount !== undefined && data.amount !== existing.amount;

  // شهري يبقى شهرياً مع تحديث تاريخ انتهاء الإقامة: مزامنة كاملة للجدول —
  // التمديد يضيف دفعيات حتى التاريخ الجديد، والتقصير يحذف غير المسدّدة بعده
  // (المسدّدة لا تُمس). يسري على أي مصدر للتعديل: الفورم العادي أو نافذة التجديد.
  if (data.iqamaEndDate) {
    const { day, iqamaEndDate, amount } = monthlyScheduleInputs(data, existing);
    // آخر دفعية ضمن الحد الجديد هي نقطة استكمال التوليد
    const lastInstallment = await prisma.clientPaymentMonthly.findFirst({
      where: { clientId: id, receivedDate: { lte: iqamaEndDate } },
      orderBy: { receivedDate: 'desc' },
      select: { receivedDate: true },
    });
    const schedule = buildMonthlySchedule(day, amount, iqamaEndDate, lastInstallment?.receivedDate);

    return prisma.$transaction(async (tx) => {
      await tx.clientPaymentMonthly.deleteMany({
        where: { clientId: id, status: { not: 'paid' }, receivedDate: { gt: iqamaEndDate } },
      });
      await tx.client.update({ where: { id }, data: updateData });
      if (amountChanged) {
        await repriceUnpaidInstallments(tx, id, amount);
      }
      if (schedule.length > 0) {
        await tx.clientPaymentMonthly.createMany({
          data: schedule.map((entry) => ({ ...entry, clientId: id })),
        });
      }
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
  }

  if (amountChanged) {
    return prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: updateData });
      await repriceUnpaidInstallments(tx, id, data.amount as number);
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
  }

  return prisma.client.update({ where: { id }, data: updateData, include: clientInclude });
}

// عنصر دين واحد في تفاصيل أرشيف العميل المحذوف:
// overdue = دفعية شهرية متأخرة، carried = مبلغ مرحّل على دفعية مستقبلية، remaining = المتبقي للعميل السنوي
export type DeletedDueDetail = {
  type: 'overdue' | 'carried' | 'remaining';
  amount: number;
  receivedDate?: string;
  carriedFromMonth?: string | null;
};

/**
 * الدين المستحق على العميل لحظة الحذف:
 * - شهري: الدفعيات المتأخرة (استحقاقها اليوم أو قبله) كاملةً + المبالغ المرحّلة على دفعيات مستقبلية
 * - سنوي وغيره: المبلغ المتبقي (الإجمالي ناقص الدفعات المنجزة)
 */
export function computeOutstandingDues(client: {
  paymentType: string | null;
  amount: number | null;
  payments: { isDone: boolean | null; amount: number | null }[];
  paymentMonthlies: {
    status: string | null;
    receivedDate: Date | null;
    amount: number | null;
    carriedOverAmount: number | null;
    carriedFromMonth: string | null;
  }[];
}): { totalDue: number; details: DeletedDueDetail[] } {
  const details: DeletedDueDetail[] = [];
  let totalDue = 0;

  if (client.paymentType === MONTHLY) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    for (const m of client.paymentMonthlies) {
      if (m.status === 'paid' || !m.receivedDate) continue;
      const receivedDate = m.receivedDate.toISOString().slice(0, 10);
      if (m.receivedDate <= today) {
        const amount = m.amount ?? 0;
        if (amount <= 0) continue;
        totalDue += amount;
        details.push({ type: 'overdue', amount, receivedDate, carriedFromMonth: m.carriedFromMonth });
      } else if ((m.carriedOverAmount ?? 0) > 0) {
        const amount = m.carriedOverAmount as number;
        totalDue += amount;
        details.push({ type: 'carried', amount, receivedDate, carriedFromMonth: m.carriedFromMonth });
      }
    }
    // الترتيب حسب تاريخ الاستحقاق ليُعرض الأقدم أولاً
    details.sort((a, b) => (a.receivedDate ?? '').localeCompare(b.receivedDate ?? ''));
  } else {
    const paid = client.payments
      .filter((p) => p.isDone)
      .reduce((sum, p) => sum + (p.amount ?? 0), 0);
    const remaining = (client.amount ?? 0) - paid;
    if (remaining > 0) {
      totalDue = remaining;
      details.push({ type: 'remaining', amount: remaining });
    }
  }

  return { totalDue, details };
}

export async function deleteClient(id: number) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true } },
      payments: { select: { isDone: true, amount: true } },
      paymentMonthlies: {
        select: {
          status: true,
          receivedDate: true,
          amount: true,
          carriedOverAmount: true,
          carriedFromMonth: true,
        },
      },
    },
  });
  if (!client) return null;

  const { totalDue, details } = computeOutstandingDues(client);

  return prisma.$transaction(async (tx) => {
    if (totalDue > 0) {
      const now = new Date();
      await tx.deletedClientDue.create({
        data: {
          clientName: client.name,
          phone: client.phone,
          passport: client.passport,
          iqamaNumber: client.iqamaNumber,
          serviceName: client.service?.name ?? null,
          organizationName: client.organization?.name ?? null,
          paymentType: client.paymentType,
          totalDue,
          collectedAmount: 0,
          status: 'pending',
          details,
          collections: [],
          notes: client.notes,
          deletedAt: now,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    return tx.client.delete({ where: { id } });
  });
}
