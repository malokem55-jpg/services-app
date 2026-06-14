import webpush from 'web-push';
import prisma from '../lib/prisma.js';
import {
  getMonthlyPaymentAlerts,
  getCustomPaymentAlerts,
  getIqamaExpirySoonAlerts,
  getIqamaExpiryUrgentAlerts,
  getTafweedAlerts,
} from './notifications.service.js';
import { getPushChannels } from './notification-settings.service.js';

let vapidInitialized = false;

function getWebPush(): typeof webpush | null {
  if (vapidInitialized) return webpush;

  const email = process.env.VAPID_EMAIL;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!email || !publicKey || !privateKey) {
    console.warn('[push] VAPID env vars missing — push notifications disabled');
    return null;
  }

  webpush.setVapidDetails(email, publicKey, privateKey);
  vapidInitialized = true;
  return webpush;
}

export async function saveSubscription(subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
    create: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function deleteSubscription(endpoint: string) {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

type SubRecord = { endpoint: string; p256dh: string; auth: string };

// تُرجع عدد حالات الفشل القابلة لإعادة المحاولة (الاشتراك المنتهي لا يُحتسب فشلاً لأنه يُحذف)
async function sendToAll(subs: SubRecord[], payload: object): Promise<number> {
  const wp = getWebPush();
  if (!wp) return 0;

  const body = JSON.stringify(payload);
  let failures = 0;

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await wp.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: unknown) {
        if (
          err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          (err.statusCode === 404 || err.statusCode === 410)
        ) {
          // subscription expired or invalid — remove it
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        } else {
          failures++;
          console.error('[push] sendNotification failed for', sub.endpoint, err);
        }
      }
    }),
  );

  return failures;
}

// Uses UTC to avoid timezone-dependent dedup mismatches
function toDateOnly(date: Date | string): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

async function alreadySent(alertType: string, referenceId: number, referenceDate: Date) {
  const existing = await prisma.sentPushNotification.findUnique({
    where: { alertType_referenceId_referenceDate: { alertType, referenceId, referenceDate } },
  });
  return existing !== null;
}

async function markSent(alertType: string, referenceId: number, referenceDate: Date) {
  // upsert: في وضع الإرسال الفوري (force) قد يكون التنبيه مُعلَّماً مسبقاً
  await prisma.sentPushNotification.upsert({
    where: { alertType_referenceId_referenceDate: { alertType, referenceId, referenceDate } },
    update: {},
    create: { alertType, referenceId, referenceDate },
  });
}

export interface RunPushOptions {
  // الإرسال الفوري: يتجاهل سجل "أُرسل من قبل" فيُعيد إرسال كل التنبيهات المختارة
  force?: boolean;
  // عند تحديده يُرسَل فقط أحدث N تنبيهات (الأقرب تاريخاً) — يفرض وضع الإرسال الفوري
  limit?: number;
}

// تنبيه مرشَّح للإرسال: يحمل بياناته الكاملة لتمكين الترتيب ثم الاختيار
interface PushCandidate {
  alertType: string;
  refId: number;
  refDate: Date;
  sortTime: number; // وقت مرجع الترتيب: الأحدث أولاً
  // phone/message اختياريان: يُرسَلان فقط لتنبيه الدفعة الشهرية لتمكين زر «محادثة العميل»
  payload: { type: string; title: string; body: string; phone?: string; message?: string };
}

// رسالة تذكير الدفعة الشهرية المُعبَّأة مسبقاً في محادثة الواتساب.
// تطابق منطق client/src/lib/paymentReminder.ts (نسخة الخادم لأن التواريخ هنا كائنات Date).
function monthlyReminderMessage(payment: {
  client?: { name?: string | null } | null;
  receivedDate?: Date | string | null;
  amount?: number | null;
  carriedOverAmount?: number | null;
  carriedFromMonth?: Date | string | null;
}): string {
  const name = payment.client?.name ?? '';
  const date = payment.receivedDate ? new Date(payment.receivedDate).toISOString().slice(0, 10) : '';
  const carried = payment.carriedOverAmount ?? 0;
  const carriedFrom = payment.carriedFromMonth
    ? new Date(payment.carriedFromMonth).toISOString().slice(0, 10)
    : '';

  if (payment.amount != null && carried > 0) {
    const base = payment.amount - carried;
    return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date}.\nقسط الشهر: ${base} ريال بتاريخ ${date}\nمبلغ مرحّل من دفعة سابقة: ${carried} ريال بتاريخ ${carriedFrom}\nالمجموع: ${payment.amount} ريال (${base} + ${carried})\nنشكر لكم تعاونكم.`;
  }

  const amount = payment.amount != null ? `${payment.amount} ريال` : '';
  return `السلام عليكم ${name}،\nنذكّركم بدفعتكم الشهرية المستحقة بتاريخ ${date} بمبلغ ${amount}.\nنشكر لكم تعاونكم.`;
}

export async function runPushNotificationCheck(options: RunPushOptions = {}): Promise<{ failures: number }> {
  const { limit } = options;
  // تحديد عدد التنبيهات يفرض إعادة الإرسال (force) للأحدث بغض النظر عن سجل الإرسال
  const force = options.force || limit != null;
  if (!getWebPush()) return { failures: 0 };

  // Fetch subscriptions once — avoids one DB query per alert
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return { failures: 0 };

  let failures = 0;

  // تحديد أي التنبيهات الخمسة مُفعَّلة للإرسال للهاتف
  const channels = await getPushChannels();

  const [monthlyPayments, customPayments, iqamaExpirySoon, iqamaExpired, tafweedAlerts] = await Promise.all([
    getMonthlyPaymentAlerts(),
    getCustomPaymentAlerts(),
    getIqamaExpirySoonAlerts(),
    getIqamaExpiryUrgentAlerts(),
    getTafweedAlerts(),
  ]);

  // بناء قائمة المرشَّحين من الأنواع المُفعَّلة فقط
  const candidates: PushCandidate[] = [];

  if (channels.pushMonthlyPayment) {
    for (const payment of monthlyPayments) {
      if (!payment.receivedDate) continue;
      const refDate = toDateOnly(payment.receivedDate);
      const carriedNote =
        payment.carriedOverAmount && payment.carriedOverAmount > 0
          ? ` (منها ${payment.carriedOverAmount} مرحّلة من دفعية بتاريخ ${payment.carriedFromMonth ?? '—'})`
          : '';
      candidates.push({
        alertType: 'monthly_payment',
        refId: payment.id,
        refDate,
        sortTime: refDate.getTime(),
        payload: {
          type: 'monthly_payment',
          title: 'دفعة شهرية قريبة',
          body: `${payment.client?.name ?? ''} — ${payment.month ?? ''} — ${payment.amount ?? ''} ر.س${carriedNote}`,
          // يُمكّنان زر «محادثة العميل» في الإشعار (أندرويد) أو فتح الواتساب بالضغط (آيفون)
          phone: payment.client?.phone ?? undefined,
          message: monthlyReminderMessage(payment),
        },
      });
    }
  }

  if (channels.pushCustomPayment) {
    for (const client of customPayments) {
      if (!client.nextPaymentDate) continue;
      const refDate = toDateOnly(client.nextPaymentDate);
      candidates.push({
        alertType: 'custom_payment',
        refId: client.id,
        refDate,
        sortTime: refDate.getTime(),
        payload: {
          type: 'custom_payment',
          title: 'دفعة مخصصة قريبة',
          body: `${client.name ?? ''} — ${client.amount ?? ''} ر.س`,
        },
      });
    }
  }

  if (channels.pushIqamaSoon) {
    for (const client of iqamaExpirySoon) {
      if (!client.iqamaEndDate) continue;
      const refDate = toDateOnly(client.iqamaEndDate);
      candidates.push({
        alertType: 'iqama_expiry_soon',
        refId: client.id,
        refDate,
        sortTime: refDate.getTime(),
        payload: {
          type: 'iqama_expiry_soon',
          title: 'إقامة ستنتهي قريباً',
          body: `${client.name ?? ''} — تنتهي في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
        },
      });
    }
  }

  if (channels.pushIqamaExpired) {
    for (const client of iqamaExpired) {
      if (!client.iqamaEndDate) continue;
      const refDate = toDateOnly(client.iqamaEndDate);
      candidates.push({
        alertType: 'iqama_expired',
        refId: client.id,
        refDate,
        sortTime: refDate.getTime(),
        payload: {
          type: 'iqama_expired',
          title: 'إقامة منتهية أو عاجلة',
          body: `${client.name ?? ''} — انتهت في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
        },
      });
    }
  }

  if (channels.pushTafweed) {
    for (const client of tafweedAlerts) {
      if (!client.tafweedAlertDate) continue;
      const refDate = toDateOnly(client.tafweedAlertDate);
      candidates.push({
        alertType: 'tafweed',
        refId: client.id,
        refDate,
        sortTime: refDate.getTime(),
        payload: {
          type: 'tafweed',
          title: 'تنبيه التفويض والتصديق',
          body: `تذكير: يجب إجراء التفويض للعميل ${client.name ?? ''} على مؤسسة (${client.organization?.name ?? '—'}) اليوم`,
        },
      });
    }
  }

  // وضع «أحدث N تنبيهات»: نرتّب الكل بالأحدث تاريخاً ونأخذ أوّل N فقط ثم نرسلها
  if (limit != null) {
    const latest = [...candidates].sort((a, b) => b.sortTime - a.sortTime).slice(0, limit);
    for (const c of latest) {
      const f = await sendToAll(subs, c.payload);
      if (f === 0) await markSent(c.alertType, c.refId, c.refDate);
      failures += f;
    }
    return { failures };
  }

  for (const c of candidates) {
    if (!force && (await alreadySent(c.alertType, c.refId, c.refDate))) continue;
    // علّم "أُرسل" بعد التسليم فقط: الفشل العابر يُترك بلا تعليم ليُعاد إرساله لاحقاً بدل أن يضيع
    const f = await sendToAll(subs, c.payload);
    if (f === 0) await markSent(c.alertType, c.refId, c.refDate);
    failures += f;
  }

  // تذكير أسبوعي مجمَّع بديون العملاء المحذوفين المعلّقة — مرة واحدة كل أسبوع
  // (referenceDate = بداية الأسبوع "الأحد"، و referenceId = 0 لأنه إشعار مجمَّع)
  // ليس ضمن التنبيهات الخمسة القابلة للاختيار، لذا لا يُرسَل في وضع الإرسال الفوري
  if (!force) {
    const pendingDues = await prisma.deletedClientDue.findMany({
      where: { status: 'pending' },
      select: { totalDue: true, collectedAmount: true },
    });
    if (pendingDues.length > 0) {
      const weekStart = toDateOnly(new Date());
      weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
      if (!(await alreadySent('deleted_client_dues', 0, weekStart))) {
        const totalRemaining = pendingDues.reduce(
          (sum, d) => sum + (d.totalDue ?? 0) - (d.collectedAmount ?? 0),
          0,
        );
        const f = await sendToAll(subs, {
          type: 'deleted_client_dues',
          title: 'تذكير: ديون عملاء محذوفين',
          body: `لديك ${pendingDues.length} ديون معلّقة لعملاء محذوفين بإجمالي متبقٍ ${totalRemaining} ر.س`,
        });
        if (f === 0) await markSent('deleted_client_dues', 0, weekStart);
        failures += f;
      }
    }
  }

  return { failures };
}
