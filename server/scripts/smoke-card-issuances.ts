// اختبار دخاني لمنطق كروت العمل (نموذج المنح اليدوي) — ينشئ بيانات تجريبية ثم ينظف خلفه
// ويستعيد علامة آخر منح كما كانت حتى لا يتأثر النظام الفعلي.
import 'dotenv/config';
import prisma from '../src/lib/prisma.js';
import { createClient } from '../src/services/clients.service.js';
import { listOrganizations } from '../src/services/organizations.service.js';
import {
  createIssuance,
  updateIssuance,
  deleteIssuance,
  listClientIssuances,
  listOrganizationIssuances,
  grantNewCards,
} from '../src/services/card-issuances.service.js';

let failures = 0;
function check(label: string, ok: boolean, extra = '') {
  console.log(`${ok ? '✅' : '❌'} ${label}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures++;
}

async function main() {
  // حفظ حالة علامة المنح لاستعادتها في النهاية
  const prevGrant = await prisma.cardGrantSetting.findFirst();

  const org = await prisma.organization.create({
    data: { name: '__SMOKE_ORG__', createdAt: new Date(), updatedAt: new Date() },
  });

  // 1) إنشاء عميل بكرت 6 شهور → إصدار تلقائي ورصيد مستهلك 0.5
  const client = await createClient({
    name: '__SMOKE_CLIENT__',
    organizationId: org.id,
    cardType: '6 شهور',
  });
  let log = await listClientIssuances(client.id);
  check('إنشاء عميل بكرت يسجل إصدارًا', log.length === 1 && log[0].cardType === '6 شهور');

  let orgLog = await listOrganizationIssuances(org.id);
  check('المسحوبة 0.5 بعد الإدخال', orgLog.usedYears === 0.5, `used=${orgLog.usedYears}`);

  // 2) إنشاء عميل بلا مؤسسة يُرفض
  let rejected = false;
  try {
    await createClient({ name: '__SMOKE_NO_ORG__' });
  } catch (e) {
    rejected = e instanceof Error && e.message.includes('المؤسسة مطلوبة');
  }
  check('رفض عميل بلا مؤسسة', rejected);

  // 3) إصدار سنتين بالزر → المسحوبة 2.5 والمرآة "سنتين"
  await createIssuance(client.id, 'سنتين');
  orgLog = await listOrganizationIssuances(org.id);
  const mirrored = await prisma.client.findUnique({ where: { id: client.id }, select: { cardType: true } });
  check('إصدار ثانٍ يخصم (2.5)', orgLog.usedYears === 2.5, `used=${orgLog.usedYears}`);
  check('الحقل مرآة لآخر إصدار', mirrored?.cardType === 'سنتين', `cardType=${mirrored?.cardType}`);

  // 4) إصدار يتجاوز الرصيد (سنتين أخريان = 4.5) يُرفض
  rejected = false;
  try {
    await createIssuance(client.id, 'سنتين');
  } catch (e) {
    rejected = e instanceof Error && e.message.includes('غير كاف');
  }
  orgLog = await listOrganizationIssuances(org.id);
  check('منع تجاوز الرصيد', rejected && orgLog.usedYears === 2.5, `used=${orgLog.usedYears}`);

  // 5) تعديل إصدار السنتين إلى سنة → المسحوبة 1.5 والمرآة "سنة"
  log = await listClientIssuances(client.id);
  const latest = log[0];
  await updateIssuance(latest.id, { cardType: 'سنة' });
  orgLog = await listOrganizationIssuances(org.id);
  const afterEdit = await prisma.client.findUnique({ where: { id: client.id }, select: { cardType: true } });
  check('تعديل إصدار يعيد الحساب (1.5)', orgLog.usedYears === 1.5, `used=${orgLog.usedYears}`);
  check('المرآة بعد التعديل "سنة"', afterEdit?.cardType === 'سنة', `cardType=${afterEdit?.cardType}`);

  // 6) حذف آخر إصدار → المرآة ترجع "6 شهور" والمسحوبة 0.5
  await deleteIssuance(latest.id);
  orgLog = await listOrganizationIssuances(org.id);
  const afterDelete = await prisma.client.findUnique({ where: { id: client.id }, select: { cardType: true } });
  check('حذف إصدار يسترجع الرصيد (0.5)', orgLog.usedYears === 0.5, `used=${orgLog.usedYears}`);
  check('المرآة ترجع للإصدار السابق', afterDelete?.cardType === '6 شهور', `cardType=${afterDelete?.cardType}`);

  // 7) حذف العميل لا يسترد الرصيد (السطر يبقى باسم محفوظ)
  await prisma.client.delete({ where: { id: client.id } });
  orgLog = await listOrganizationIssuances(org.id);
  check('حذف العميل لا يسترد الرصيد', orgLog.usedYears === 0.5, `used=${orgLog.usedYears}`);
  check('اسم العميل محفوظ بعد حذفه', orgLog.issuances[0]?.clientName === '__SMOKE_CLIENT__');

  // 8) قائمة المؤسسات ترجع الأعمدة الجديدة
  let orgs = await listOrganizations('__SMOKE_ORG__');
  let row = orgs.find((o) => o.id === org.id);
  check('جدول المؤسسات: مسحوبة 0.5 / متبقية 3.5',
    row?.cardsWithdrawn === 0.5 && row?.cardsRemaining === 3.5,
    `withdrawn=${row?.cardsWithdrawn} remaining=${row?.cardsRemaining}`);

  // 9) المنح اليدوي → الرصيد يتجدد (0 / 4) دون مساس بالسجل أو التواريخ
  const issuanceBefore = await prisma.cardIssuance.findFirst({ where: { organizationId: org.id } });
  await grantNewCards();
  orgs = await listOrganizations('__SMOKE_ORG__');
  row = orgs.find((o) => o.id === org.id);
  check('بعد المنح: مسحوبة 0 / متبقية 4',
    row?.cardsWithdrawn === 0 && row?.cardsRemaining === 4,
    `withdrawn=${row?.cardsWithdrawn} remaining=${row?.cardsRemaining}`);

  const issuanceAfter = await prisma.cardIssuance.findFirst({ where: { organizationId: org.id } });
  check('السجل القديم باقٍ بتاريخه وسنته دون أي تغيير',
    issuanceAfter != null &&
    issuanceAfter.issuedAt.getTime() === issuanceBefore?.issuedAt.getTime() &&
    issuanceAfter.hijriYear === issuanceBefore?.hijriYear);

  orgLog = await listOrganizationIssuances(org.id);
  check('سجل المؤسسة يعرض ما بعد المنح فقط', orgLog.issuances.length === 0 && orgLog.usedYears === 0);

  // 10) إصدار جديد بعد المنح يخصم من الرصيد الجديد
  const client2 = await createClient({
    name: '__SMOKE_CLIENT_2__',
    organizationId: org.id,
    cardType: '3 شهور',
  });
  orgs = await listOrganizations('__SMOKE_ORG__');
  row = orgs.find((o) => o.id === org.id);
  check('إصدار بعد المنح يخصم (0.25)',
    row?.cardsWithdrawn === 0.25 && row?.cardsRemaining === 3.75,
    `withdrawn=${row?.cardsWithdrawn} remaining=${row?.cardsRemaining}`);

  // 11) علامة "يخصم من الرصيد الحالي" في سجل العميل
  let client2Log = await listClientIssuances(client2.id);
  check('إصدار بعد آخر منح معلَّم كخاصم من الرصيد', client2Log[0]?.countsTowardBalance === true);

  await grantNewCards();
  client2Log = await listClientIssuances(client2.id);
  check('بعد منح جديد يصبح الإصدار معلَّمًا كسنة سابقة', client2Log[0]?.countsTowardBalance === false);

  // استعادة علامة المنح كما كانت قبل الاختبار
  if (prevGrant) {
    await prisma.cardGrantSetting.updateMany({ data: { lastGrantAt: prevGrant.lastGrantAt } });
  } else {
    await prisma.cardGrantSetting.deleteMany({});
  }

  // تنظيف (حذف المؤسسة يحذف إصداراتها تتاليًا، والعميل الثاني يُحذف صراحة)
  await prisma.client.delete({ where: { id: client2.id } });
  await prisma.organization.delete({ where: { id: org.id } });

  console.log(failures === 0 ? '\nكل الفحوص نجحت ✅' : `\n${failures} فحص فشل ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
