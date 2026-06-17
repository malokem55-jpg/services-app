import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { CARD_MONTHS, NO_CARD, TOTAL_MONTHS_PER_HIJRI_YEAR } from '../lib/card-types.js';
import { hijriYearOf } from '../lib/hijri.js';

// خطأ تحقق يصل للواجهة برسالته العربية كاستجابة 400 عبر errorHandler
class ValidationError extends Error {
  statusCode = 400;
}

type Tx = Prisma.TransactionClient;

/**
 * لحظة آخر منح كروت — الإصدارات المسجلة بعدها هي وحدها التي تخصم من الرصيد.
 * لا منح تلقائيًا: الزر هو المصدر الوحيد. قبل أول ضغطة تُحسب كل الإصدارات (علامة في أقدم الأزمنة).
 */
export async function getLastGrantAt(db: Tx | typeof prisma = prisma): Promise<Date> {
  const setting = await db.cardGrantSetting.findFirst();
  return setting?.lastGrantAt ?? new Date(0);
}

// بدء سنة هجرية جديدة: يمنح كل المؤسسات رصيد 4 كروت من جديد، ويمسح سجل كل
// إصدارات الكروت، ويعيد حقل «كرت العمل» لكل العملاء إلى «بدون» — بداية نظيفة للسنة.
export async function grantNewCards(): Promise<Date> {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const setting = await tx.cardGrantSetting.findFirst();
    if (setting) {
      await tx.cardGrantSetting.update({
        where: { id: setting.id },
        data: { lastGrantAt: now },
      });
    } else {
      await tx.cardGrantSetting.create({ data: { lastGrantAt: now } });
    }
    await tx.cardIssuance.deleteMany({});
    await tx.client.updateMany({ data: { cardType: NO_CARD, updatedAt: now } });
    return now;
  });
}

function monthsOf(cardType: string): number {
  const months = CARD_MONTHS[cardType];
  if (months === undefined || cardType === NO_CARD) {
    throw new ValidationError('نوع كرت العمل غير صالح');
  }
  return months;
}

function toDate(value: string | undefined): Date {
  if (!value) return new Date();
  const date = new Date(value);
  if (isNaN(date.getTime())) throw new ValidationError('تاريخ الإصدار غير صالح');
  return date;
}

// مجموع الشهور المخصومة من رصيد المؤسسة منذ آخر منح (مع استثناء إصدار يجري تعديله)
async function usedMonths(
  tx: Tx,
  organizationId: number,
  since: Date,
  excludeIssuanceId?: number,
): Promise<number> {
  const result = await tx.cardIssuance.aggregate({
    where: {
      organizationId,
      createdAt: { gt: since },
      ...(excludeIssuanceId !== undefined && { id: { not: excludeIssuanceId } }),
    },
    _sum: { months: true },
  });
  return result._sum.months ?? 0;
}

async function assertBalanceAllows(
  tx: Tx,
  organizationId: number,
  since: Date,
  addedMonths: number,
  excludeIssuanceId?: number,
): Promise<void> {
  const used = await usedMonths(tx, organizationId, since, excludeIssuanceId);
  const remaining = TOTAL_MONTHS_PER_HIJRI_YEAR - used;
  if (addedMonths > remaining) {
    const remainingYears = remaining / 12;
    throw new ValidationError(
      `رصيد المؤسسة غير كافٍ — المتبقي ${remainingYears % 1 === 0 ? remainingYears : remainingYears.toFixed(2)} من 4`,
    );
  }
}

// حقل كرت العمل عند العميل مرآة للسجل: آخر إصدار متبقٍ، أو "بدون" إذا خلا السجل
async function syncClientCardType(tx: Tx, clientId: number | null): Promise<void> {
  if (clientId == null) return;
  const latest = await tx.cardIssuance.findFirst({
    where: { clientId },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
    select: { cardType: true },
  });
  await tx.client.update({
    where: { id: clientId },
    data: { cardType: latest?.cardType ?? NO_CARD, updatedAt: new Date() },
  });
}

/**
 * إنشاء إصدار داخل معاملة قائمة — تستخدمه خدمة العملاء عند الإدخال بكرت،
 * ومسار الإصدار المستقل. يتحقق من الرصيد ويزامن حقل العميل.
 */
export async function createIssuanceInTx(
  tx: Tx,
  input: { clientId: number; clientName: string | null; organizationId: number; cardType: string; issuedAt?: string },
) {
  const months = monthsOf(input.cardType);
  const issuedAt = toDate(input.issuedAt);
  // السنة الهجرية معلومة وصفية للعرض فقط (من تاريخ الإصدار) — لا علاقة لها بالرصيد
  const hijriYear = hijriYearOf(issuedAt);
  const since = await getLastGrantAt(tx);

  await assertBalanceAllows(tx, input.organizationId, since, months);

  const issuance = await tx.cardIssuance.create({
    data: {
      clientId: input.clientId,
      clientName: input.clientName,
      organizationId: input.organizationId,
      cardType: input.cardType,
      months,
      hijriYear,
      issuedAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  await syncClientCardType(tx, input.clientId);
  return issuance;
}

export async function createIssuance(clientId: number, cardType: string, issuedAt?: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, organizationId: true },
  });
  if (!client) throw new ValidationError('العميل غير موجود');
  if (!client.organizationId) {
    throw new ValidationError('العميل غير مرتبط بمؤسسة — أضفه لمؤسسة أولًا');
  }
  const organizationId = client.organizationId;

  return prisma.$transaction((tx) =>
    createIssuanceInTx(tx, {
      clientId: client.id,
      clientName: client.name,
      organizationId,
      cardType,
      issuedAt,
    }),
  );
}

export async function updateIssuance(id: number, data: { cardType?: string; issuedAt?: string }) {
  const existing = await prisma.cardIssuance.findUnique({ where: { id } });
  if (!existing) return null;

  const cardType = data.cardType ?? existing.cardType;
  const months = monthsOf(cardType);
  const issuedAt = data.issuedAt !== undefined ? toDate(data.issuedAt) : existing.issuedAt;
  const hijriYear = hijriYearOf(issuedAt);
  const since = await getLastGrantAt();
  // إصدار سابق على آخر منح لا يخصم من الرصيد الحالي — تعديله لا يحتاج فحص رصيد
  const countsTowardBalance = existing.createdAt != null && existing.createdAt > since;

  return prisma.$transaction(async (tx) => {
    if (countsTowardBalance) {
      await assertBalanceAllows(tx, existing.organizationId, since, months, id);
    }
    const updated = await tx.cardIssuance.update({
      where: { id },
      data: { cardType, months, hijriYear, issuedAt, updatedAt: new Date() },
    });
    await syncClientCardType(tx, existing.clientId);
    return updated;
  });
}

export async function deleteIssuance(id: number) {
  const existing = await prisma.cardIssuance.findUnique({ where: { id } });
  if (!existing) return null;

  return prisma.$transaction(async (tx) => {
    await tx.cardIssuance.delete({ where: { id } });
    await syncClientCardType(tx, existing.clientId);
    return existing;
  });
}

export async function listClientIssuances(clientId: number) {
  const since = await getLastGrantAt();
  const issuances = await prisma.cardIssuance.findMany({
    where: { clientId },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
  });
  // علامة لكل إصدار: هل سُجّل بعد آخر منح (يخصم من الرصيد الحالي) أم قبله —
  // نفس معيار حساب الرصيد بالضبط، فلا تتعارض الشارة مع الأرقام أبدًا
  return issuances.map((issuance) => ({
    ...issuance,
    countsTowardBalance: issuance.createdAt != null && issuance.createdAt > since,
  }));
}

// إصدارات المؤسسة منذ آخر منح (التي تخصم من الرصيد الحالي) + ملخص الرصيد
export async function listOrganizationIssuances(organizationId: number) {
  const since = await getLastGrantAt();
  const issuances = await prisma.cardIssuance.findMany({
    where: { organizationId, createdAt: { gt: since } },
    orderBy: [{ issuedAt: 'desc' }, { id: 'desc' }],
  });
  const used = issuances.reduce((sum, i) => sum + i.months, 0);
  return {
    lastGrantAt: since.getTime() === 0 ? null : since,
    usedYears: used / 12,
    remainingYears: (TOTAL_MONTHS_PER_HIJRI_YEAR - used) / 12,
    issuances,
  };
}
