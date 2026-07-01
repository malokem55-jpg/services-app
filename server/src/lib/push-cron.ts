import cron, { ScheduledTask } from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';
import { getNotificationSchedule } from '../services/notification-settings.service.js';

// كل المواعيد تُحسب بتوقيت السعودية (UTC+3 بلا توقيت صيفي) بصرف النظر عن توقيت
// المُشغِّل نفسه. على Cloudflare يُشغِّل Cron Trigger كل 5 دقائق runPushTick()،
// وعلى Node المحلي يفعل node-cron نفس الشيء.
const TIMEZONE = 'Asia/Riyadh';

// الوقت الحالي بتوقيت الرياض: التاريخ + عدد الدقائق منذ منتصف الليل.
function nowInRiyadh(): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const hour = parseInt(get('hour'), 10) % 24; // بعض البيئات تُرجع 24 عند منتصف الليل
  const minute = parseInt(get('minute'), 10);
  return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + minute };
}

// نافذة (بالدقائق) بعد موعد الإرسال المختار تظل فيها النبضة تُطلق إرسال اليوم.
// يجب أن تتجاوز فترة النبض (5 دقائق) حتى لا يفوت يوم؛ وrunPushNotificationCheck
// يمنع التكرار عبر جدول قاعدة البيانات فلا ضرر من نبضات إضافية داخل النافذة.
const SEND_WINDOW_MIN = 10;

// نبضة الإشعارات: تُقرأ من المُجدول (Cron Trigger على Cloudflare / node-cron محلياً).
// تُرسل تنبيهات اليوم مرة واحدة عند بلوغ الموعد المختار من التطبيق. منع التكرار
// يتم عبر جدول "أُرسل من قبل" في القاعدة، لذا إعادة النبض داخل اليوم بلا أثر.
export async function runPushTick(): Promise<void> {
  try {
    const now = nowInRiyadh();
    const { hour, minute } = await getNotificationSchedule();
    const delta = now.minutes - (hour * 60 + minute);
    if (delta < 0 || delta >= SEND_WINDOW_MIN) return; // خارج نافذة الإرسال
    await runPushNotificationCheck();
  } catch (err) {
    console.error('Push tick error:', err);
  }
}

let pollTask: ScheduledTask | null = null;

// محلي فقط (Node). على Cloudflare يقود Cron Trigger في wrangler.jsonc الدالة
// runPushTick() بدلاً من node-cron.
export function startPushCron(): void {
  if (pollTask) {
    void pollTask.stop();
    pollTask = null;
  }
  pollTask = cron.schedule('*/5 * * * *', () => void runPushTick());
  void runPushTick();
}

// يُستدعى من مسار الإعدادات بعد تغيير موعد الإرسال: إن كان الموعد الجديد قد مضى
// اليوم نُرسل فوراً (نفس السلوك القديم). التكرار محمي بجدول القاعدة. المُستدعي على
// Cloudflare يجب أن ينتظر هذه الدالة (await) لتكتمل قبل انتهاء الرد.
export async function reschedulePushCron(hour: number, minute: number): Promise<void> {
  const now = nowInRiyadh();
  if (now.minutes >= hour * 60 + minute) {
    await runPushNotificationCheck();
  }
}
