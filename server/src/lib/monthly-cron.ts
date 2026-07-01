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

// محلي فقط (Node). على Cloudflare يقود Cron Trigger ("15 21 * * *" = 00:15 رياض)
// الدالة runMonthlyTick() بدلاً من node-cron.
export function startMonthlyRollingCron(): void {
  cron.schedule('15 0 * * *', () => void runMonthlyTick(), { timezone: 'Asia/Riyadh' });
  void runMonthlyTick();
}
