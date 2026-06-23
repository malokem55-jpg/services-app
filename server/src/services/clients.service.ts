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
  /** عميل شهري: يوم الاستلام من كل شهر (1-31) — حقل مستقل عن رقم الحدود */
  monthlyReceiptDay?: number;
  /** المبلغ المستلم عند التحويل من شهري إلى سنوي — يُسجَّل كدفعة أولى */
  receivedAmount?: number;
  /** عميل شهري: استمرار توليد الدفعيات الشهرية حتى بعد انتهاء الإقامة */
  generateMonthlyAfterIqama?: boolean;
  /** تاريخ تنبيه التفويض والتصديق — null يمسح التنبيه نهائياً */
  tafweedAlertDate?: string | null;
  /** علامة "تم التفويض" — true تخفي التنبيه من الجرس مع إبقاء التاريخ */
  tafweedDone?: boolean;
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

// تنبيه التفويض غرضه التذكير مستقبلاً — تاريخ في الماضي مرفوض عند الإدخال أو التغيير
function assertTafweedDateNotPast(dateStr: string) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (dateStr < todayStr) {
    throw new ValidationError('تاريخ تنبيه التفويض لا يمكن أن يكون سابقاً لتاريخ اليوم');
  }
}

function parseReceiptDay(value: number | string | null | undefined): number {
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

/**
 * عميل شهري مفعَّل عنده "التوليد بعد انتهاء الإقامة": يضمن وجود دفعية واحدة في
 * أقرب يوم استلام قادم فقط، من الآن فصاعداً وبلا تعويض رجعي للأشهر الفائتة —
 * إن لم توجد أي دفعية مستحقة اليوم أو لاحقاً تُنشأ دفعية أقرب يوم استلام قادم.
 * الدفعية الواقعة بعد تاريخ انتهاء الإقامة تُعلَّم afterIqama حتى لا تمسّها
 * مزامنة الجدول عند تعديل تاريخ الإقامة أو إلغاء تفعيل الخيار لاحقاً.
 * يرجع true إذا أُنشئت دفعية جديدة.
 */
export async function ensureUpcomingInstallment(clientId: number): Promise<boolean> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      paymentType: true,
      generateMonthlyAfterIqama: true,
      monthlyReceiptDay: true,
      amount: true,
      iqamaEndDate: true,
    },
  });
  if (!client || client.paymentType !== MONTHLY || !client.generateMonthlyAfterIqama) return false;
  const day = Number(client.monthlyReceiptDay);
  if (!Number.isInteger(day) || day < 1 || day > 31) return false;
  if (!client.amount || client.amount <= 0) return false;

  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let target = dueDateIn(today.getUTCFullYear(), today.getUTCMonth(), day);
  if (target < today) target = dueDateIn(today.getUTCFullYear(), today.getUTCMonth() + 1, day);

  // التوليد "من الآن فصاعداً": وجود أي دفعية مستحقة اليوم أو لاحقاً يعني أن
  // العميل لا يزال لديه دفعية قادمة فلا حاجة لإنشاء جديدة (ولا تعويض رجعي).
  const upcoming = await prisma.clientPaymentMonthly.findFirst({
    where: { clientId, receivedDate: { gte: today } },
    select: { id: true },
  });
  if (upcoming) return false;

  await prisma.clientPaymentMonthly.create({
    data: {
      clientId,
      month: String(target.getUTCMonth() + 1).padStart(2, '0'),
      receivedDate: target,
      amount: client.amount,
      status: 'un-paid',
      iqamaEndDate: client.iqamaEndDate,
      afterIqama: !client.iqamaEndDate || target > client.iqamaEndDate,
      createdAt: now,
      updatedAt: now,
    },
  });
  return true;
}

/** الفحص الدوري: يمرّ على كل العملاء الشهريين المفعَّل عندهم الخيار */
export async function ensureRollingMonthlyInstallments() {
  const clients = await prisma.client.findMany({
    where: { paymentType: MONTHLY, generateMonthlyAfterIqama: true },
    select: { id: true },
  });
  for (const c of clients) {
    try {
      await ensureUpcomingInstallment(c.id);
    } catch (err) {
      console.error(`[monthly-rolling] failed for client ${c.id}:`, err);
    }
  }
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

// نقل يوم الاستلام لكل الدفعيات القادمة غير المسدّدة إلى اليوم الجديد، مع تثبيت
// اليوم داخل طول الشهر (31 في فبراير → 28/29). الدفعيات المتأخرة (قبل اليوم)
// لا تُمسّ — التعديل يطال "القادمة" فقط كما هي الحاجة.
async function shiftUpcomingInstallmentDays(
  tx: Prisma.TransactionClient,
  clientId: number,
  day: number,
) {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const upcoming = await tx.clientPaymentMonthly.findMany({
    where: { clientId, status: { not: 'paid' }, receivedDate: { gte: today } },
    select: { id: true, receivedDate: true },
  });
  for (const installment of upcoming) {
    const current = installment.receivedDate;
    if (!current) continue;
    const shifted = dueDateIn(current.getUTCFullYear(), current.getUTCMonth(), day);
    if (shifted.getTime() === current.getTime()) continue;
    await tx.clientPaymentMonthly.update({
      where: { id: installment.id },
      data: { receivedDate: shifted, updatedAt: now },
    });
  }
}

// تسجيل تغيير يوم الاستلام لعميل شهري في سجل التغييرات (لعرضه في لوحة malik).
// يُستدعى داخل نفس المعاملة بعد نقل الدفعيات القادمة لليوم الجديد.
async function recordReceiptDayChange(
  tx: Prisma.TransactionClient,
  clientId: number,
  clientName: string | null,
  oldDay: number | null,
  newDay: number,
) {
  await tx.receiptDayChange.create({
    data: { clientId, clientName, oldDay, newDay, changedAt: new Date() },
  });
}

// مدخلات الجدول الشهري بعد التحقق: القسط ويوم الاستلام وتاريخ انتهاء الإقامة كلها إلزامية
function monthlyScheduleInputs(data: ClientCreateInput, fallback?: {
  monthlyReceiptDay: number | null;
  iqamaEndDate: Date | null;
  amount: number | null;
}) {
  const day = parseReceiptDay(data.monthlyReceiptDay ?? fallback?.monthlyReceiptDay);
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
      monthlyReceiptDay: true,
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
  // التوليد بعد انتهاء الإقامة خاصية شهرية فقط، ومفعَّل افتراضياً للعميل الشهري
  const rollingEnabled = isMonthly ? data.generateMonthlyAfterIqama ?? true : false;

  if (!data.organizationId) {
    throw new ValidationError('المؤسسة مطلوبة');
  }
  if (data.tafweedAlertDate) {
    assertTafweedDateNotPast(data.tafweedAlertDate);
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
    // يوم الاستلام خاصية شهرية فقط — يُمسح لغير الشهري
    monthlyReceiptDay: isMonthly ? data.monthlyReceiptDay ?? null : null,
    // الدفعة المخصصة (nextPaymentDate) خاصية سنوية فقط — العميل الشهري لا يملكها
    nextPaymentDate: isMonthly ? null : data.nextPaymentDate ? new Date(data.nextPaymentDate) : undefined,
    // التوليد بعد انتهاء الإقامة خاصية شهرية فقط — مفعَّل افتراضياً للعميل الشهري
    generateMonthlyAfterIqama: rollingEnabled,
    tafweedAlertDate: data.tafweedAlertDate ? new Date(data.tafweedAlertDate) : undefined,
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
    // مع خيار التوليد بعد انتهاء الإقامة تُقبل الإضافة بجدول فارغ (إقامة منتهية)
    // وتتكفل ensureUpcomingInstallment بإنشاء دفعية أقرب يوم استلام قادم
    if (schedule.length === 0 && !rollingEnabled) {
      throw new ValidationError('تاريخ انتهاء الإقامة يجب أن يكون بعد أقرب يوم استلام قادم');
    }
  }

  if (!isMonthly && !issuedCardType) {
    return prisma.client.create({ data: createData, include: clientInclude });
  }

  const created = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({ data: createData });
    if (issuedCardType) {
      await createIssuanceInTx(tx, {
        clientId: client.id,
        clientName: client.name ?? null,
        organizationId,
        cardType: issuedCardType,
      });
    }
    if (isMonthly && schedule.length > 0) {
      await tx.clientPaymentMonthly.createMany({
        data: schedule.map((entry) => ({ ...entry, clientId: client.id })),
      });
    }
    return tx.client.findUniqueOrThrow({ where: { id: client.id }, include: clientInclude });
  }, { timeout: 20000, maxWait: 10000 });

  if (rollingEnabled) {
    const added = await ensureUpcomingInstallment(created.id);
    if (added) {
      return prisma.client.findUniqueOrThrow({ where: { id: created.id }, include: clientInclude });
    }
  }
  return created;
}

type ClientWithInclude = Prisma.ClientGetPayload<{ include: typeof clientInclude }>;

// بعد تعديل عميل شهري مفعَّل عنده التوليد بعد انتهاء الإقامة: ضمان وجود
// الدفعية القادمة، وإرجاع نسخة محدثة من العميل إن أُضيفت دفعيات جديدة
async function finalizeRolling(clientId: number, enabled: boolean, result: ClientWithInclude) {
  if (!enabled) return result;
  const added = await ensureUpcomingInstallment(clientId);
  if (!added) return result;
  return prisma.client.findUniqueOrThrow({ where: { id: clientId }, include: clientInclude });
}

export async function updateClient(id: number, data: ClientCreateInput) {
  const existing = await prisma.client.findUnique({
    where: { id },
    select: {
      name: true,
      paymentType: true,
      monthlyReceiptDay: true,
      iqamaEndDate: true,
      amount: true,
      generateMonthlyAfterIqama: true,
      tafweedAlertDate: true,
      tafweedDone: true,
    },
  });
  if (!existing) return null;

  // تاريخ تنبيه تفويض جديد أو مغيَّر لا يكون في الماضي. إبقاء تاريخ تنبيه نشط
  // كما هو مسموح حتى لا تتعطل تعديلات الحقول الأخرى، أما إعادة تفعيل تنبيه
  // منجز ("تم التفويض") فتُعامل كتاريخ جديد ويُرفض الماضي
  if (data.tafweedAlertDate) {
    const existingTafweed = existing.tafweedAlertDate?.toISOString().slice(0, 10) ?? null;
    const unchangedActive = data.tafweedAlertDate === existingTafweed && !existing.tafweedDone;
    if (!unchangedActive) {
      assertTafweedDateNotPast(data.tafweedAlertDate);
    }
  }

  const wasMonthly = existing.paymentType === MONTHLY;
  const staysMonthly = data.paymentType !== undefined ? data.paymentType === MONTHLY : wasMonthly;
  // تغيُّر يوم الاستلام لعميل شهري قائم: تُنقل كل دفعياته القادمة إلى اليوم الجديد
  const dayChanged =
    wasMonthly && staysMonthly &&
    data.monthlyReceiptDay !== undefined &&
    data.monthlyReceiptDay !== existing.monthlyReceiptDay;
  // القيمة الفعلية للخيار بعد هذا التعديل — تحكم التوليد بعد انتهاء الإقامة
  const rollingEnabled = data.generateMonthlyAfterIqama ?? existing.generateMonthlyAfterIqama;

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
    ...(data.monthlyReceiptDay !== undefined && { monthlyReceiptDay: data.monthlyReceiptDay }),
    ...(data.generateMonthlyAfterIqama !== undefined && {
      generateMonthlyAfterIqama: data.generateMonthlyAfterIqama,
    }),
    ...(data.tafweedAlertDate !== undefined && {
      tafweedAlertDate: data.tafweedAlertDate ? new Date(data.tafweedAlertDate) : null,
    }),
    ...(data.tafweedDone !== undefined && { tafweedDone: data.tafweedDone }),
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
      // يوم الاستلام الشهري لم يعد له معنى للعميل السنوي
      updateData.monthlyReceiptDay = null;
      // وكذلك خيار التوليد بعد انتهاء الإقامة — خاصية شهرية فقط
      updateData.generateMonthlyAfterIqama = false;

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
    // مع خيار التوليد بعد انتهاء الإقامة يُقبل جدول فارغ (إقامة منتهية)
    if (schedule.length === 0 && !rollingEnabled) {
      throw new ValidationError('تاريخ انتهاء الإقامة يجب أن يكون بعد أقرب يوم استلام قادم');
    }

    const converted = await prisma.$transaction(async (tx) => {
      await tx.clientPaymentMonthly.deleteMany({ where: { clientId: id } });
      await tx.clientPayment.deleteMany({ where: { clientId: id } });
      await tx.client.update({ where: { id }, data: updateData });
      if (schedule.length > 0) {
        await tx.clientPaymentMonthly.createMany({
          data: schedule.map((entry) => ({ ...entry, clientId: id })),
        });
      }
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
    return finalizeRolling(id, rollingEnabled, converted);
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

    const synced = await prisma.$transaction(async (tx) => {
      // الدفعيات المعلَّمة afterIqama متولدة من خيار "التوليد بعد انتهاء الإقامة"
      // وليست جزءاً من جدول الإقامة — تبقى كما هي ولا تمسّها المزامنة
      await tx.clientPaymentMonthly.deleteMany({
        where: {
          clientId: id,
          status: { not: 'paid' },
          receivedDate: { gt: iqamaEndDate },
          afterIqama: false,
        },
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
      if (dayChanged) {
        await shiftUpcomingInstallmentDays(tx, id, day);
        await recordReceiptDayChange(tx, id, existing.name, existing.monthlyReceiptDay, day);
      }
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
    return finalizeRolling(id, rollingEnabled, synced);
  }

  if (amountChanged || dayChanged) {
    const updatedTx = await prisma.$transaction(async (tx) => {
      await tx.client.update({ where: { id }, data: updateData });
      if (amountChanged) {
        await repriceUnpaidInstallments(tx, id, data.amount as number);
      }
      if (dayChanged) {
        const newDay = parseReceiptDay(data.monthlyReceiptDay);
        await shiftUpcomingInstallmentDays(tx, id, newDay);
        await recordReceiptDayChange(tx, id, existing.name, existing.monthlyReceiptDay, newDay);
      }
      return tx.client.findUniqueOrThrow({ where: { id }, include: clientInclude });
    }, { timeout: 20000, maxWait: 10000 });
    return finalizeRolling(id, rollingEnabled, updatedTx);
  }

  const updated = await prisma.client.update({ where: { id }, data: updateData, include: clientInclude });
  return finalizeRolling(id, rollingEnabled, updated);
}

// آخر 20 تغييرًا ليوم الاستلام في الدفعيات الشهرية — لعرضها في لوحة malik
export async function listRecentReceiptDayChanges() {
  return prisma.receiptDayChange.findMany({
    orderBy: { changedAt: 'desc' },
    take: 20,
    select: {
      id: true,
      clientName: true,
      oldDay: true,
      newDay: true,
      changedAt: true,
    },
  });
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
