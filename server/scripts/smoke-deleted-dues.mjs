// اختبار دخاني للدورة الكاملة: عميل شهري بدفعات متأخرة → حذف → أرشفة → تحصيل جزئي
// تشغيل: node scripts/smoke-deleted-dues.mjs ثم يحذف ما أنشأه خلفه
import 'dotenv/config';
import jwt from 'jsonwebtoken';

const BASE = 'http://localhost:3000';
const token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '10m' });

async function api(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

const fail = (msg) => { console.error(`✗ ${msg}`); process.exit(1); };
const ok = (msg) => console.log(`✓ ${msg}`);

// ── 1) عميل شهري بإقامة تنتهي بعد 3 أشهر ويوم استلام يجعل أول دفعية قريبة ──────
const iqamaEnd = new Date();
iqamaEnd.setMonth(iqamaEnd.getMonth() + 3);
const day = new Date().getDate(); // أول دفعية اليوم → متأخرة فوراً
const client = await api('/api/clients', {
  method: 'POST',
  body: JSON.stringify({
    name: 'عميل اختبار - حذف الديون',
    phone: '0500000000',
    iqamaNumber: '9999999999',
    iqamaEndDate: iqamaEnd.toISOString().slice(0, 10),
    paymentType: 'شهري',
    amount: 300,
    boardNumber: String(day),
  }),
});
ok(`أُنشئ العميل #${client.id} بجدول ${client.paymentMonthlies?.length ?? 0} دفعيات`);

const detail = await api(`/api/clients/${client.id}`);
const today = new Date().toISOString().slice(0, 10);
const overdue = detail.paymentMonthlies.filter(
  (m) => m.status !== 'paid' && m.receivedDate && m.receivedDate.slice(0, 10) <= today,
);
const expectedDebt = overdue.reduce((s, m) => s + (m.amount ?? 0), 0);
ok(`الدفعيات المتأخرة: ${overdue.length} بإجمالي ${expectedDebt}`);

// ── 2) حذف العميل والتحقق من سجل الأرشيف ───────────────────────────────────────
await api(`/api/clients/${client.id}`, { method: 'DELETE' });
ok('حُذف العميل');

const dues = await api('/api/deleted-client-dues');
const due = dues.find((d) => d.clientName === 'عميل اختبار - حذف الديون');
if (expectedDebt > 0) {
  if (!due) fail('لم يُنشأ سجل أرشيف رغم وجود دين');
  if (due.totalDue !== expectedDebt) fail(`إجمالي الدين ${due.totalDue} ≠ المتوقع ${expectedDebt}`);
  if (due.status !== 'pending') fail(`الحالة ${due.status} ≠ pending`);
  if (!Array.isArray(due.details) || due.details.length !== overdue.length)
    fail(`عدد التفاصيل ${due.details?.length} ≠ ${overdue.length}`);
  ok(`سجل الأرشيف صحيح: إجمالي ${due.totalDue} و ${due.details.length} تفاصيل`);

  // ── 3) تحصيل جزئي بتاريخ يدوي ثم تحصيل الباقي ──────────────────────────────
  const part = Math.min(100, due.totalDue);
  const customDate = '2026-06-01';
  let updated = await api(`/api/deleted-client-dues/${due.id}/collections`, {
    method: 'POST',
    body: JSON.stringify({ amount: part, notes: 'تحصيل جزئي تجريبي', date: customDate }),
  });
  if (updated.collectedAmount !== part) fail(`المحصَّل ${updated.collectedAmount} ≠ ${part}`);
  if (due.totalDue > part && updated.status !== 'pending') fail('الحالة تغيّرت قبل اكتمال التحصيل');
  if (updated.collections?.[0]?.date !== customDate)
    fail(`تاريخ التحصيل ${updated.collections?.[0]?.date} ≠ ${customDate}`);
  ok(`تحصيل جزئي ${part} بتاريخ يدوي ${customDate} — الحالة: ${updated.status}`);

  // ── 3.5) تعديل الملاحظات ────────────────────────────────────────────────────
  updated = await api(`/api/deleted-client-dues/${due.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ notes: 'وعد بالسداد نهاية الشهر' }),
  });
  if (updated.notes !== 'وعد بالسداد نهاية الشهر') fail(`الملاحظات لم تُحدَّث: ${updated.notes}`);
  ok('تحديث الملاحظات يعمل');

  const rest = due.totalDue - part;
  if (rest > 0) {
    updated = await api(`/api/deleted-client-dues/${due.id}/collections`, {
      method: 'POST',
      body: JSON.stringify({ amount: rest }),
    });
    if (updated.status !== 'collected') fail(`بعد التحصيل الكامل الحالة ${updated.status} ≠ collected`);
    ok('اكتمل التحصيل وتحولت الحالة إلى collected');
  }

  // ── 3.7) تعديل تحصيلة: المبلغ يتغير وتعود الحالة pending ───────────────────
  updated = await api(`/api/deleted-client-dues/${due.id}/collections/0`, {
    method: 'PUT',
    body: JSON.stringify({ amount: 50, date: '2026-06-02', notes: 'بعد التعديل' }),
  });
  const expectedAfterEdit = due.totalDue - part + 50;
  if (updated.collectedAmount !== expectedAfterEdit)
    fail(`بعد تعديل التحصيلة: المحصَّل ${updated.collectedAmount} ≠ ${expectedAfterEdit}`);
  if (updated.status !== 'pending') fail(`بعد خفض تحصيلة: الحالة ${updated.status} ≠ pending`);
  if (updated.collections[0].date !== '2026-06-02' || updated.collections[0].notes !== 'بعد التعديل')
    fail('حقول التحصيلة لم تُحدَّث');
  ok(`تعديل التحصيلة أعاد الاحتساب (المحصَّل ${updated.collectedAmount}) وأعاد الحالة إلى pending`);

  // رفض تعديل يجعل المجموع يتجاوز إجمالي الدين
  try {
    await api(`/api/deleted-client-dues/${due.id}/collections/0`, {
      method: 'PUT',
      body: JSON.stringify({ amount: due.totalDue + 1, date: '2026-06-02' }),
    });
    fail('قُبل تعديل يتجاوز إجمالي الدين!');
  } catch (e) {
    if (!String(e.message).includes('400')) throw e;
    ok('رُفض تعديل يتجاوز إجمالي الدين (400)');
  }

  // ── 3.8) حذف تحصيلة: تُخصم من المحصَّل ─────────────────────────────────────
  updated = await api(`/api/deleted-client-dues/${due.id}/collections/0`, { method: 'DELETE' });
  if (updated.collectedAmount !== due.totalDue - part)
    fail(`بعد حذف التحصيلة: المحصَّل ${updated.collectedAmount} ≠ ${due.totalDue - part}`);
  ok(`حذف التحصيلة خصم مبلغها (المحصَّل الآن ${updated.collectedAmount})`);

  // إعادة المبلغ ليكتمل التحصيل من جديد قبل اختبار الرفض التالي
  updated = await api(`/api/deleted-client-dues/${due.id}/collections`, {
    method: 'POST',
    body: JSON.stringify({ amount: part }),
  });
  if (updated.status !== 'collected') fail(`بعد استكمال المبلغ: الحالة ${updated.status} ≠ collected`);
  ok('استكمال المبلغ أعاد الحالة إلى collected');

  // ── 4) رفض تحصيل يتجاوز المتبقي ─────────────────────────────────────────────
  try {
    await api(`/api/deleted-client-dues/${due.id}/collections`, {
      method: 'POST',
      body: JSON.stringify({ amount: 50 }),
    });
    fail('قُبل تحصيل على دين مكتمل!');
  } catch (e) {
    if (!String(e.message).includes('400')) throw e;
    ok('رُفض التحصيل الزائد (400)');
  }

  // ── 5) تنظيف ────────────────────────────────────────────────────────────────
  await api(`/api/deleted-client-dues/${due.id}`, { method: 'DELETE' });
  ok('حُذف سجل الاختبار — انتهى بنجاح');
} else {
  // لا دفعية متأخرة اليوم (حالة نادرة حسب اليوم) — يكفي التأكد من عدم إنشاء سجل
  if (due) fail('أُنشئ سجل أرشيف بلا دين');
  ok('لا دين متأخر — لم يُنشأ سجل (سلوك صحيح)');
}
