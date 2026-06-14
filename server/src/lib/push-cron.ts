import cron, { ScheduledTask } from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';
import { getNotificationSchedule } from '../services/notification-settings.service.js';

// كل المواعيد تُحسب بتوقيت السعودية (UTC+3 بلا توقيت صيفي) بصرف النظر عن توقيت الخادم نفسه.
// هذا يصحّح المشكلة القديمة: node-cron كان يُطلق بتوقيت الخادم (UTC على الاستضافة) فتصل
// الإشعارات بفارق ثابت عن الموعد المختار.
const TIMEZONE = 'Asia/Riyadh';

let pollTask: ScheduledTask | null = null;

// تاريخ آخر إرسال يومي ناجح بصيغة YYYY-MM-DD (بتوقيت الرياض) لمنع إعادة التشغيل في نفس اليوم.
// في الذاكرة فقط: لو أُعيد تشغيل الخادم بعد إرسال اليوم، تمنع جداول "أُرسل من قبل" أي تكرار.
let lastRunDate: string | null = null;

// الوقت الحالي بتوقيت الرياض: التاريخ + عدد الدقائق منذ منتصف الليل
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

// تُستدعى كل دقيقة. تُرسل تنبيهات اليوم مرة واحدة عند بلوغ الموعد، أو تلحق بها فوراً إذا كان
// الخادم متوقفاً وقت الموعد. تقرأ جدول الإرسال من قاعدة البيانات فيُحترم أي تغيير تلقائياً.
async function tick(): Promise<void> {
  try {
    const now = nowInRiyadh();
    if (lastRunDate === now.date) return; // أُرسل اليوم بنجاح بالفعل

    const { hour, minute } = await getNotificationSchedule();
    if (now.minutes < hour * 60 + minute) return; // لم يَحِن الموعد بعد اليوم

    const { failures } = await runPushNotificationCheck();
    // لا نُثبّت "تمّ اليوم" إلا إذا وصلت كل التنبيهات؛ وإلا نُعيد المحاولة في النبضة التالية
    // بدل أن يضيع الإشعار بسبب فشل عابر.
    if (failures === 0) lastRunDate = now.date;
  } catch (err) {
    console.error('Push cron error:', err);
  }
}

export async function startPushCron(): Promise<void> {
  if (pollTask) {
    await pollTask.stop();
    pollTask = null;
  }
  // نبضة كل دقيقة بدل "إطلاق واحد في لحظة محددة": تضمن الدقة في الموعد + اللحاق بعد أي توقف
  // للخادم. noOverlap يمنع تداخل نبضتين، وحارس lastRunDate يجعل العمل الفعلي مرة واحدة يومياً.
  pollTask = cron.schedule('* * * * *', tick, { noOverlap: true });
  await tick(); // فحص فوري عند الإقلاع للّحاق بأي موعد فات أثناء توقف الخادم
}

// يُستدعى من مسار الإعدادات بعد تغيير موعد الإرسال — نُعيد ضبط الحارس ليُحترم الموعد الجديد اليوم.
// التكرار محمي بجداول "أُرسل من قبل" حتى لو كان موعد اليوم قد مضى.
export function reschedulePushCron(_hour?: number, _minute?: number): void {
  lastRunDate = null;
  void tick();
}
