import webpush from 'web-push';
import prisma from '../lib/prisma.js';
import {
  getMonthlyPaymentAlerts,
  getCustomPaymentAlerts,
  getIqamaExpirySoonAlerts,
  getIqamaExpiryUrgentAlerts,
} from './notifications.service.js';

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

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

async function sendToAll(payload: object) {
  const subscriptions = await prisma.pushSubscription.findMany();
  const body = JSON.stringify(payload);

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body,
        );
      } catch (err: unknown) {
        // subscription expired or invalid — remove it
        if (
          err &&
          typeof err === 'object' &&
          'statusCode' in err &&
          (err.statusCode === 404 || err.statusCode === 410)
        ) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: sub.endpoint } });
        }
      }
    }),
  );
}

function toDateOnly(date: Date | string): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
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

    await sendToAll({
      type: 'monthly_payment',
      title: 'دفعة شهرية قريبة',
      body: `${payment.client?.name ?? ''} — ${payment.month ?? ''} — ${payment.amount ?? ''} ر.س`,
      clientName: payment.client?.name,
    });
    await markSent('monthly_payment', payment.id, refDate);
  }

  for (const client of customPayments) {
    if (!client.nextPaymentDate) continue;
    const refDate = toDateOnly(client.nextPaymentDate);
    if (await alreadySent('custom_payment', client.id, refDate)) continue;

    await sendToAll({
      type: 'custom_payment',
      title: 'دفعة مخصصة قريبة',
      body: `${client.name ?? ''} — ${client.amount ?? ''} ر.س`,
      clientName: client.name,
    });
    await markSent('custom_payment', client.id, refDate);
  }

  for (const client of iqamaExpirySoon) {
    if (!client.iqamaEndDate) continue;
    const refDate = toDateOnly(client.iqamaEndDate);
    if (await alreadySent('iqama_expiry_soon', client.id, refDate)) continue;

    await sendToAll({
      type: 'iqama_expiry_soon',
      title: 'إقامة ستنتهي قريباً',
      body: `${client.name ?? ''} — تنتهي في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
      clientName: client.name,
    });
    await markSent('iqama_expiry_soon', client.id, refDate);
  }

  for (const client of iqamaExpired) {
    if (!client.iqamaEndDate) continue;
    const refDate = toDateOnly(client.iqamaEndDate);
    if (await alreadySent('iqama_expired', client.id, refDate)) continue;

    await sendToAll({
      type: 'iqama_expired',
      title: 'إقامة منتهية أو عاجلة',
      body: `${client.name ?? ''} — انتهت في ${new Date(client.iqamaEndDate).toLocaleDateString('ar-SA')}`,
      clientName: client.name,
    });
    await markSent('iqama_expired', client.id, refDate);
  }
}
