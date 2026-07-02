import cron from 'node-cron';
import { ensureRollingMonthlyInstallments } from '../services/clients.service.js';

/**
 * فحص يومي للعملاء الشهريين المفعَّل عندهم "التوليد بعد انتهاء الإقامة":
 * يضمن وجود دفعية أقرب يوم استلام قادم لكل منهم حتى لو لم يفتح أحد التطبيق.
 * idempotent (يضمن الوجود فقط) فلا ضرر من إعادة التشغيل.
 */
export async function runMonthlyTick(): Promise<void> {
  try {
    await ensureRollingMonthlyInstallments();
  } catch (err) {
    console.error('[monthly-rolling] tick error:', err);
  }
}

// نسخة تُستدعى من النبضة الموحّدة (كل 5 دقائق): تشغّل التوليد فقط داخل نافذة
// 00:15–00:25 بتوقيت الرياض. idempotent فلا ضرر من التقاطها مرتين داخل النافذة.
export async function runMonthlyTickIfDue(): Promise<void> {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const mins = (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10);
  if (mins >= 15 && mins < 25) await runMonthlyTick();
}

// محلي فقط (Node). على Cloudflare تقود النبضة الموحّدة runMonthlyTickIfDue().
export function startMonthlyRollingCron(): void {
  cron.schedule('15 0 * * *', () => void runMonthlyTick(), { timezone: 'Asia/Riyadh' });
  void runMonthlyTick();
}
