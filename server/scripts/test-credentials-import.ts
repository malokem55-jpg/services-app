// اختبار شامل لميزة استيراد بيانات الدخول من إكسل:
// 1) يولّد ملف .xlsx بالأعمدة العربية وبيانات تغطي حالات المطابقة/التطبيع/المدينة.
// 2) يشغّل buildImportPreview على قاعدة البيانات الحقيقية (قراءة فقط).
// 3) يختبر commitCredentialsImport بجولة ذهاب-وإياب آمنة (كتابة ثم تنظيف).
// تشغيل: npx tsx scripts/test-credentials-import.ts
import ExcelJS from 'exceljs';
import prisma from '../src/lib/prisma.js';
import {
  buildImportPreview,
  commitCredentialsImport,
} from '../src/services/org-credentials-import.service.js';
import { getCredential, deleteCredential } from '../src/services/org-credentials.service.js';

function perturb(name: string): string {
  // محاكاة اختلافات بسيطة لاختبار التطبيع: ألف/تاء مربوطة/فراغات زائدة
  return `  ${name.replace(/ة/g, 'ه').replace(/[أإآ]/g, 'ا').replace(/ /g, '  ')}  `;
}

async function buildXlsx(headers: string[], rows: (string | undefined)[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('بيانات');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}

async function main() {
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true }, take: 5 });
  if (orgs.length < 2) {
    console.error('تحتاج مؤسستين على الأقل في قاعدة البيانات لتشغيل الاختبار.');
    process.exit(1);
  }
  const [orgA, orgB] = orgs;
  console.log('مؤسسات الاختبار:', { A: orgA.name, B: orgB.name });

  // ── 1) ملف اختباري بالصيغة الجديدة: 3 أعمدة، خلية مدمجة «مستخدم - كلمة مرور»، بلا عمود مدينة ──
  const buf = await buildXlsx(
    ['اسم الشركة', 'مقيم', 'الغرفة التجارية'],
    [
      [orgA.name ?? '', 'muqeemA - passA', ''], // مطابقة تامة، مقيم فقط
      [perturb(orgB.name ?? ''), '', 'chamberB - passB-with-dash'], // تطبيع + كلمة مرور بها شرطة
      ['شركة وهمية لا توجد ٩٩٩', 'mU - mP', 'cU - cP'], // غير مطابقة
      [orgA.name ?? '', 'onlyuser', ''], // بلا شرطة → مستخدم فقط، كلمة مرور فارغة
      ['', '', ''], // صف فارغ → يُتجاهل
    ],
  );

  console.log('\n── 2) نتيجة buildImportPreview (صيغة مدمجة، بلا عمود مدينة) ──');
  const preview = await buildImportPreview(buf);
  console.log(`إجمالي الصفوف (بلا الفارغة): ${preview.totalRows} | المطابقة: ${preview.matchedCount}`);
  for (const r of preview.rows) {
    console.log({
      سطر: r.rowNumber,
      منالملف: r.orgNameRaw,
      مطابقة: r.matchedOrgName ?? '— غير مطابقة —',
      orgId: r.matchedOrgId,
      مقيم: r.muqeem ? `${r.muqeem.username}/${r.muqeem.password}` : null,
      غرفة: r.chamber ? `${r.chamber.username} city=${r.chamber.city ?? 'null'}(${r.chamber.cityRaw})` : null,
    });
  }

  // تحققات منطقية
  const rowA = preview.rows.find((r) => r.rowNumber === 2); // orgA + مقيم مدمج
  const rowB = preview.rows.find((r) => r.rowNumber === 3); // orgB (مطبّع) + غرفة مدمجة
  const rowNoDash = preview.rows.find((r) => r.rowNumber === 5); // مقيم بلا شرطة
  const assert = (cond: boolean, msg: string) => console.log(`${cond ? '✅' : '❌'} ${msg}`);
  assert(rowA?.matchedOrgId === orgA.id, 'المطابقة التامة ربطت المؤسسة A');
  assert(rowA?.muqeem?.username === 'muqeemA' && rowA?.muqeem?.password === 'passA', 'قُسِّمت خلية مقيم المدمجة إلى مستخدم/كلمة مرور');
  assert(rowB?.matchedOrgId === orgB.id, 'التطبيع ربط المؤسسة B رغم اختلاف الكتابة');
  assert(rowB?.chamber?.username === 'chamberB' && rowB?.chamber?.password === 'passB-with-dash', 'كلمة المرور التي بها شرطة بقيت كاملة بعد القسمة على أول شرطة');
  assert(rowB?.chamber?.city === 'riyadh', 'المدينة الافتراضية = الرياض (لا يوجد عمود مدينة)');
  assert(preview.rows.find((r) => r.orgNameRaw.includes('وهمية'))?.matchedOrgId === null, 'الاسم الوهمي بقي غير مطابق');
  assert(rowNoDash?.muqeem?.username === 'onlyuser' && rowNoDash?.muqeem?.password === '', 'خلية بلا شرطة → مستخدم فقط وكلمة مرور فارغة');
  assert(preview.rows.every((r) => r.orgNameRaw !== '' || r.muqeem || r.chamber), 'الصف الفارغ تم تجاهله');

  // ── 3) اختبار commit: نختار مؤسسة بلا بيانات مقيم حاليًا، نكتب ثم ننظّف ──
  console.log('\n── 3) اختبار commitCredentialsImport (ذهاب-وإياب) ──');
  const muqeemCreds = await prisma.organizationCredential.findMany({
    where: { platform: 'muqeem' },
    select: { organizationId: true },
  });
  const usedMuqeem = new Set(muqeemCreds.map((c) => c.organizationId));
  const target = orgs.find((o) => !usedMuqeem.has(o.id));

  if (!target) {
    console.log('⚠️  كل المؤسسات المختبرة لها بيانات مقيم محفوظة — تخطّي اختبار الكتابة لتفادي لمس بيانات حقيقية.');
  } else {
    try {
      const result = await commitCredentialsImport([
        { organizationId: target.id, muqeem: { username: '__test_user__', password: '__test_pass__' }, chamber: null },
        { organizationId: 999999999, muqeem: { username: 'x', password: 'y' }, chamber: null }, // مؤسسة غير موجودة → تُتجاهل
        { organizationId: target.id, muqeem: null, chamber: { username: 'cu', password: 'cp', city: '' } }, // غرفة بلا مدينة → تُتجاهل
      ]);
      console.log('نتيجة الإدخال:', result);
      assert(result.muqeemCount === 1, 'أُدخلت بيانات مقيم واحدة');
      assert(result.skipped.length === 2, 'تم تجاهل صفّين (مؤسسة غير موجودة + غرفة بلا مدينة)');

      const saved = await getCredential(target.id, 'muqeem');
      assert(saved?.username === '__test_user__', 'اسم المستخدم حُفظ صحيحًا');
      assert(saved?.password === '__test_pass__', 'كلمة المرور تُفك بشكل صحيح (تشفير/فك سليم)');
    } finally {
      await deleteCredential(target.id, 'muqeem');
      console.log(`🧹 تنظيف: حُذفت بيانات الاختبار من المؤسسة «${target.name}».`);
    }
  }

  await prisma.$disconnect();
  console.log('\nانتهى الاختبار.');
}

main().catch(async (e) => {
  console.error('فشل الاختبار:', e);
  await prisma.$disconnect();
  process.exit(1);
});
