import cron from 'node-cron';
import { ensureRollingMonthlyInstallments } from '../services/clients.service.js';

/**
 * فحص يومي للعملاء الشهريين المفعَّل عندهم "التوليد بعد انتهاء الإقامة":
 * يضمن وجود دفعية أقرب يوم استلام قادم لكل منهم حتى لو لم يفتح أحد التطبيق.
 * يعمل مرة عند الإقلاع (تعويض فترات توقف السيرفر) ثم يومياً بعد منتصف الليل.
 */
export function startMonthlyRollingCron() {
  const run = async () => {
    try {
      await ensureRollingMonthlyInstallments();
    } catch (err) {
      console.error('[monthly-rolling] cron error:', err);
    }
  };
  cron.schedule('15 0 * * *', run);
  void run();
}
