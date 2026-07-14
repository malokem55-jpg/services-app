// توقيت السعودية موحَّد لكامل النظام: Asia/Riyadh = UTC+3 بلا توقيت صيفي.
// نفس المنطقة الزمنية التي تعتمدها نبضات الكرون (push-cron / monthly-cron)،
// حتى تتطابق حدود "اليوم" في كل مكان مع منتصف ليل السعودية لا منتصف ليل UTC.
//
// أعمدة التواريخ (@db.Date) تُخزَّن كمنتصف ليل UTC لليوم التقويمي. لذلك نمثّل
// "بداية اليوم" بمنتصف ليل UTC لليوم التقويمي *بتوقيت السعودية*، فتصح المقارنة
// المباشرة مع تلك الأعمدة.
const TIMEZONE = 'Asia/Riyadh';

// تاريخ اليوم بتوقيت السعودية بصيغة YYYY-MM-DD.
export function saudiDateString(at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// بداية اليوم بتوقيت السعودية، معبَّراً عنها كـ midnight-UTC لتطابق أعمدة @db.Date.
export function saudiStartOfToday(at: Date = new Date()): Date {
  return new Date(`${saudiDateString(at)}T00:00:00.000Z`);
}

// إضافة عدد من الأيام إلى تاريخ (لا يغيّر الأصل).
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
