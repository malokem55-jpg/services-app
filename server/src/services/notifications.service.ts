import prisma from '../lib/prisma.js';
import { saudiStartOfToday, addDays } from '../lib/saudi-time.js';

export async function getMonthlyPaymentAlerts() {
  const today = saudiStartOfToday();
  // يظهر التنبيه يوم استحقاق الدفعة الشهرية أو بعده (وليس قبله)
  const endOfToday = addDays(today, 1);

  return prisma.clientPaymentMonthly.findMany({
    where: {
      receivedDate: { lt: endOfToday },
      status: 'un-paid',
    },
    include: {
      client: {
        select: {
          name: true,
          phone: true,
          iqamaNumber: true,
          iqamaEndDate: true,
          service: { select: { name: true } },
          organization: { select: { name: true, number: true } },
        },
      },
    },
    orderBy: { receivedDate: 'asc' },
  });
}

export async function getCustomPaymentAlerts() {
  const today = saudiStartOfToday();
  const in10Days = addDays(today, 10);

  return prisma.client.findMany({
    where: {
      // الدفعة المخصصة خاصية سنوية فقط — العميل الشهري تنبيهاته من دفعياته الشهرية
      paymentType: 'سنوي',
      nextPaymentDate: { not: null, gte: today, lt: in10Days },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true, number: true } },
    },
    orderBy: { nextPaymentDate: 'asc' },
  });
}

// الإقامات التي تنتهي خلال 30 يوماً (من الغد حتى 30 يوماً قادمة).
// إقامة تنتهي *اليوم* تُعدّ منتهية لا قريبة، فتُستثنى هنا بـ gt وتظهر في المنتهية.
export async function getIqamaExpirySoonAlerts() {
  const today = saudiStartOfToday();
  const in30Days = addDays(today, 30);

  return prisma.client.findMany({
    where: {
      iqamaEndDate: { gt: today, lte: in30Days },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true, number: true } },
    },
    orderBy: { iqamaEndDate: 'asc' },
  });
}

// تنبيهات التفويض والتصديق: تظهر من يوم التاريخ المحدد وتبقى حتى يضغط
// المستخدم "تم التفويض" فتُعلَّم منجزة. الحد يُحسب بتوقيت السعودية معبَّراً عنه
// كمنتصف ليل UTC ليطابق العمود @db.Date المخزَّن كمنتصف ليل UTC
export async function getTafweedAlerts() {
  const today = saudiStartOfToday();

  return prisma.client.findMany({
    where: { tafweedAlertDate: { lte: today }, tafweedDone: false },
    select: {
      id: true,
      name: true,
      tafweedAlertDate: true,
      organization: { select: { name: true, number: true } },
    },
    orderBy: { tafweedAlertDate: 'asc' },
  });
}

// الإقامات المنتهية فعلاً (تاريخ انتهائها اليوم أو قبله — يوم الانتهاء يُعدّ منتهياً)
export async function getIqamaExpiryUrgentAlerts() {
  const today = saudiStartOfToday();

  return prisma.client.findMany({
    where: {
      iqamaEndDate: { lte: today },
    },
    include: {
      service: { select: { name: true } },
      organization: { select: { name: true, number: true } },
    },
    orderBy: { iqamaEndDate: 'asc' },
  });
}
