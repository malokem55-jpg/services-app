import webpush from 'web-push';
import prisma from '../lib/prisma.js';
import {
  getMonthlyPaymentAlerts,
  getCustomPaymentAlerts,
  getIqamaExpirySoonAlerts,
  getIqamaExpiryUrgentAlerts,
} from './notifications.service.js';

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

async function sendToAll(subs: SubRecord[], payload: object) {
  const wp = getWebPush();
  if (!wp) return;

  const body = JSON.stringify(payload);

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
          console.error('[push] sendNotification failed for', sub.endpoint, err);
        }
      }
    }),
  );
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
  await prisma.sentPushNotification.create({
    data: { alertType, referenceId, referenceDate },
  });
}

export async function runPushNotificationCheck() {
  if (!getWebPush()) return;

  // Fetch subscriptions once — avoids one DB query per alert
  const subs = await prisma.pushSubscription.findMany();
  if (subs.length === 0) return;

  const [monthlyPayments, customPayments, iqamaExpirySoon, iqamaExpired] = await Promise.all([
    getMonthlyPaymentAlerts(),
    getCustomPaymentAlerts(),
    getIqamaExpirySoonAlerts(),
    getIqamaExpiryUrgentAlerts(),
  ]);

  for (const payment of monthlyPayments) {
    if (!payment.receivedDate) continue;
    const refDate = toDateOnly(payment.receivedDate);
    if (await alreadySent('monthly_payment', payment.id, refDate)) continue;
    // Mark before send: a missed send is better than a duplicate
    await markSent('monthly_payment', payment.id, refDate);
    await sendToAll(subs, {
      type: 'monthly_payment',
      title: 'دفعة شهرية قريبة',
      body: `${payment.client?.name ?? ''} — ${payment.month ?? ''} — ${payment.amount ?? ''} ر.س`,
    });
  }

  for (const client of customPayments) {
    if (!client.nextPaymentDate) continue;
    const refDate = toDateOnly(client.nextPaymentDate);
    if (await alreadySent('custom_payment', client.id, refDate)) continue;
    await markSent('custom_payment', client.id, refDate);
    await sendToAll(subs, {
      type: 'custom_payment',
      title: 'دفعة مخصصة قريبة',
      body: `${client.name ?? ''} — ${client.amount ?? ''} ر.س`,
    });
  }

  for (const client of iqamaExpirySoon) {
    if (!client.iqamaEndDate) continue;
    const refDate = toDateOnly(client.iqamaEndDate);
    if (await alreadySent('iqama_expiry_soon', client.id, refDate)) continue;
    await markSent('iqama_expiry_soon', client.id, refDate);
    await sendToAll(subs, {
      type: 'iqama_expiry_soon',
      title: 'إقامة ستنتهي قريباً',
      body: `${client.name ?? ''} — تنتهي في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
    });
  }

  for (const client of iqamaExpired) {
    if (!client.iqamaEndDate) continue;
    const refDate = toDateOnly(client.iqamaEndDate);
    if (await alreadySent('iqama_expired', client.id, refDate)) continue;
    await markSent('iqama_expired', client.id, refDate);
    await sendToAll(subs, {
      type: 'iqama_expired',
      title: 'إقامة منتهية أو عاجلة',
      body: `${client.name ?? ''} — انتهت في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
    });
  }
}
