import prisma from '../lib/prisma.js';

// خطأ تحقق يصل للواجهة برسالته العربية كاستجابة 400 عبر errorHandler
class ValidationError extends Error {
  statusCode = 400;
}

// تحصيل جزئي مسجَّل على دين عميل محذوف
export type DueCollectionEntry = {
  date: string;
  amount: number;
  notes?: string;
};

export async function listDeletedClientDues(status?: string) {
  return prisma.deletedClientDue.findMany({
    ...(status && { where: { status } }),
    orderBy: { deletedAt: 'desc' },
  });
}

export async function getDeletedClientDue(id: number) {
  return prisma.deletedClientDue.findUnique({ where: { id } });
}

/** تحديث ملاحظات سجل الدين (مثل: وعد بالسداد، رقم بديل للتواصل) */
export async function updateDueNotes(id: number, notes: string) {
  const due = await prisma.deletedClientDue.findUnique({ where: { id } });
  if (!due) return null;
  return prisma.deletedClientDue.update({
    where: { id },
    data: { notes: notes.trim() || null, updatedAt: new Date() },
  });
}

/** تسجيل تحصيل جزئي أو كامل؛ يتحول السجل إلى "collected" عند اكتمال المبلغ */
export async function addCollection(id: number, amount: number, notes?: string, date?: string) {
  const due = await prisma.deletedClientDue.findUnique({ where: { id } });
  if (!due) return null;

  const remaining = (due.totalDue ?? 0) - (due.collectedAmount ?? 0);
  if (remaining <= 0) {
    throw new ValidationError('تم تحصيل هذا الدين بالكامل');
  }
  if (amount > remaining) {
    throw new ValidationError(`المبلغ أكبر من المتبقي (${remaining})`);
  }

  const previous = Array.isArray(due.collections)
    ? (due.collections as DueCollectionEntry[])
    : [];
  const entry: DueCollectionEntry = {
    date: date ?? new Date().toISOString().slice(0, 10),
    amount,
    ...(notes && { notes }),
  };
  const collectedAmount = (due.collectedAmount ?? 0) + amount;

  return prisma.deletedClientDue.update({
    where: { id },
    data: {
      collections: [...previous, entry],
      collectedAmount,
      status: collectedAmount >= (due.totalDue ?? 0) ? 'collected' : 'pending',
      updatedAt: new Date(),
    },
  });
}

export async function deleteDeletedClientDue(id: number) {
  return prisma.deletedClientDue.delete({ where: { id } });
}

// إعادة احتساب المحصَّل والحالة من قائمة التحصيلات بعد أي تعديل أو حذف
function recomputeFromCollections(totalDue: number, collections: DueCollectionEntry[]) {
  const collectedAmount = collections.reduce((sum, c) => sum + (c.amount ?? 0), 0);
  return {
    collections,
    collectedAmount,
    status: collectedAmount >= totalDue ? 'collected' : 'pending',
    updatedAt: new Date(),
  };
}

function getCollections(due: { collections: unknown }): DueCollectionEntry[] {
  return Array.isArray(due.collections) ? [...(due.collections as DueCollectionEntry[])] : [];
}

/** تعديل تحصيلة بموقعها في القائمة؛ المجاميع والحالة تُعاد على أساس القيم الجديدة */
export async function updateCollection(
  id: number,
  index: number,
  data: { amount: number; date: string; notes?: string },
) {
  const due = await prisma.deletedClientDue.findUnique({ where: { id } });
  if (!due) return null;

  const collections = getCollections(due);
  if (index < 0 || index >= collections.length) {
    throw new ValidationError('التحصيلة غير موجودة');
  }

  const othersTotal = collections.reduce(
    (sum, c, i) => (i === index ? sum : sum + (c.amount ?? 0)),
    0,
  );
  const maxAllowed = (due.totalDue ?? 0) - othersTotal;
  if (data.amount > maxAllowed) {
    throw new ValidationError(`المبلغ يتجاوز إجمالي الدين — الحد الأقصى لهذه التحصيلة ${maxAllowed}`);
  }

  const notes = data.notes?.trim();
  collections[index] = { date: data.date, amount: data.amount, ...(notes && { notes }) };

  return prisma.deletedClientDue.update({
    where: { id },
    data: recomputeFromCollections(due.totalDue ?? 0, collections),
  });
}

/** حذف تحصيلة بموقعها؛ قد يعيد السجل من "محصَّل" إلى "معلّق" */
export async function removeCollection(id: number, index: number) {
  const due = await prisma.deletedClientDue.findUnique({ where: { id } });
  if (!due) return null;

  const collections = getCollections(due);
  if (index < 0 || index >= collections.length) {
    throw new ValidationError('التحصيلة غير موجودة');
  }
  collections.splice(index, 1);

  return prisma.deletedClientDue.update({
    where: { id },
    data: recomputeFromCollections(due.totalDue ?? 0, collections),
  });
}
