import ExcelJS from 'exceljs';
import prisma from '../lib/prisma.js';
import { upsertCredential } from './org-credentials.service.js';
import { CHAMBER_CITY_KEYS, type ChamberCityKey } from './chamber-cities.service.js';

// استيراد بيانات دخول المؤسسات من ملف إكسل (.xlsx):
// أعمدة الملف: اسم المؤسسة | يوزر مقيم | باسويرد مقيم | يوزر الغرفة | باسويرد الغرفة | مدينة الغرفة
// الخطوة الأولى (parse) تقرأ الملف وتطابق الأسماء بالمؤسسات الموجودة وتعيد معاينة قابلة للتعديل.
// الخطوة الثانية (commit) تستقبل الصفوف بعد تعديل المستخدم وتُدخلها (استبدال للمكرر).

class BadFileError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
  }
}

// ── تطبيع النص العربي للمطابقة ──
// إزالة التطويل والتشكيل، توحيد الألف/الياء/التاء المربوطة، وضغط الفراغات.
function normalize(s: string): string {
  return s
    .replace(/[ً-ْـ]/g, '') // تشكيل + تطويل
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// ── مطابقة عمود مدينة الغرفة (نص حر → مفتاح ثابت) ──
const CITY_ALIASES: Record<string, ChamberCityKey> = {
  'الرياض': 'riyadh', 'رياض': 'riyadh', 'riyadh': 'riyadh',
  'نجران': 'najran', 'najran': 'najran',
  'عنيزة': 'onaizah', 'عنيزه': 'onaizah', 'onaizah': 'onaizah', 'unaizah': 'onaizah',
};
function mapCity(raw: string): ChamberCityKey | null {
  return CITY_ALIASES[normalize(raw)] ?? null;
}

// المدينة الافتراضية حين لا يحتوي الملف عمود مدينة — تُعرض في المعاينة وتُغيَّر يدويًا لاحقًا
const DEFAULT_CITY: ChamberCityKey = 'riyadh';

// ── تقسيم خلية مدمجة «اسم المستخدم - كلمة المرور» على أول شَرطة (-, –, —) ──
// ما قبل أول شرطة = المستخدم، وكل ما بعدها = كلمة المرور (تبقى أي شرطات لاحقة ضمنها).
function splitCombined(raw: string): { username: string; password: string } | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^([^-–—]*)[-–—]\s*(.*)$/s);
  if (!m) return { username: s, password: '' }; // بلا شرطة: نعتبره اسم مستخدم فقط (يُكمل يدويًا)
  return { username: m[1].trim(), password: m[2].trim() };
}

// ── مطابقة رؤوس الأعمدة (مرنة: مرادفات + تطبيع) ──
// كل منصة قد ترد كعمود مدمج واحد (muqeem/chamber) أو كعمودين منفصلين (user/pass).
type ColumnKey =
  | 'orgName'
  | 'muqeem'
  | 'muqeemUser'
  | 'muqeemPass'
  | 'chamber'
  | 'chamberUser'
  | 'chamberPass'
  | 'chamberCity';
const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  orgName: ['اسم المؤسسة', 'اسم المنشاة', 'المؤسسة', 'الاسم', 'اسم الشركة', 'الشركة'],
  muqeem: ['مقيم', 'مقيم مستخدم وكلمة مرور', 'بيانات مقيم'],
  muqeemUser: ['يوزر مقيم', 'مستخدم مقيم', 'اسم مستخدم مقيم'],
  muqeemPass: ['باسويرد مقيم', 'باسورد مقيم', 'كلمة مرور مقيم', 'كلمه مرور مقيم'],
  chamber: ['الغرفة التجارية', 'الغرفة', 'الغرفه التجاريه', 'بيانات الغرفة', 'غرفة'],
  chamberUser: ['يوزر الغرفة', 'مستخدم الغرفة', 'اسم مستخدم الغرفة'],
  chamberPass: ['باسويرد الغرفة', 'باسورد الغرفة', 'كلمة مرور الغرفة', 'كلمه مرور الغرفه'],
  chamberCity: ['مدينة الغرفة', 'مدينه الغرفه', 'المدينة', 'مدينة'],
};
const NORMALIZED_HEADERS: Record<ColumnKey, Set<string>> = Object.fromEntries(
  (Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]).map(([k, v]) => [
    k,
    new Set(v.map(normalize)),
  ]),
) as Record<ColumnKey, Set<string>>;

function classifyHeader(text: string): ColumnKey | null {
  const n = normalize(text);
  for (const key of Object.keys(NORMALIZED_HEADERS) as ColumnKey[]) {
    if (NORMALIZED_HEADERS[key].has(n)) return key;
  }
  return null;
}

// ── أنواع المعاينة ──
export interface ImportPreviewRow {
  rowNumber: number; // رقم السطر في الملف (للعرض)
  orgNameRaw: string; // اسم المؤسسة كما ورد في الملف
  matchedOrgId: number | null; // المؤسسة المطابقة في النظام (إن وجدت)
  matchedOrgName: string | null;
  muqeem: { username: string; password: string } | null;
  chamber: { username: string; password: string; city: ChamberCityKey | null; cityRaw: string } | null;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  totalRows: number;
  matchedCount: number;
}

// ── قراءة الملف وبناء المعاينة ──
export async function buildImportPreview(buffer: Buffer): Promise<ImportPreview> {
  const wb = new ExcelJS.Workbook();
  try {
    // أنواع exceljs تتوقع Buffer التقليدي؛ نمرّر المخزن كما هو
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new BadFileError('تعذرت قراءة الملف — تأكد أنه ملف إكسل (.xlsx) صالح');
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount === 0) {
    throw new BadFileError('الملف فارغ أو لا يحتوي أوراق عمل');
  }

  // إيجاد صف الرؤوس: أول صف يحتوي عمود «اسم المؤسسة»
  let headerRowNumber = 0;
  const columns: Partial<Record<ColumnKey, number>> = {};
  for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
    const row = ws.getRow(r);
    const found: Partial<Record<ColumnKey, number>> = {};
    row.eachCell((cell, col) => {
      const key = classifyHeader(cell.text ?? '');
      if (key && found[key] === undefined) found[key] = col;
    });
    if (found.orgName !== undefined) {
      headerRowNumber = r;
      Object.assign(columns, found);
      break;
    }
  }
  if (!headerRowNumber || columns.orgName === undefined) {
    throw new BadFileError('لم يُعثر على عمود «اسم المؤسسة» في الملف');
  }

  // خريطة الأسماء الموجودة للمطابقة (اسم مطبّع → مؤسسة)
  const orgs = await prisma.organization.findMany({ select: { id: true, name: true } });
  const orgByName = new Map<string, { id: number; name: string | null }>();
  for (const o of orgs) {
    const n = normalize(o.name ?? '');
    if (n && !orgByName.has(n)) orgByName.set(n, o);
  }

  const cell = (row: ExcelJS.Row, col: number | undefined): string =>
    col === undefined ? '' : (row.getCell(col).text ?? '').trim();

  // بيانات منصة: العمودان المنفصلان (user/pass) لهما الأولوية، وإلا العمود المدمج «مستخدم - كلمة مرور»
  const readCreds = (
    row: ExcelJS.Row,
    combinedCol?: number,
    userCol?: number,
    passCol?: number,
  ): { username: string; password: string } | null => {
    const u = cell(row, userCol);
    const p = cell(row, passCol);
    if (u || p) return { username: u, password: p };
    if (combinedCol !== undefined) return splitCombined(cell(row, combinedCol));
    return null;
  };

  const hasCityColumn = columns.chamberCity !== undefined;

  const rows: ImportPreviewRow[] = [];
  for (let r = headerRowNumber + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const orgNameRaw = cell(row, columns.orgName);
    const muqeem = readCreds(row, columns.muqeem, columns.muqeemUser, columns.muqeemPass);
    const chamberCreds = readCreds(row, columns.chamber, columns.chamberUser, columns.chamberPass);
    const cityRaw = hasCityColumn ? cell(row, columns.chamberCity) : '';

    // تجاهل الصفوف الفارغة تمامًا
    if (!orgNameRaw && !muqeem && !chamberCreds) continue;

    const matched = orgNameRaw ? orgByName.get(normalize(orgNameRaw)) : undefined;

    rows.push({
      rowNumber: r,
      orgNameRaw,
      matchedOrgId: matched?.id ?? null,
      matchedOrgName: matched?.name ?? null,
      muqeem,
      chamber:
        chamberCreds || cityRaw
          ? {
              username: chamberCreds?.username ?? '',
              password: chamberCreds?.password ?? '',
              // بلا عمود مدينة في الملف: الكل الرياض افتراضيًا (قابلة للتغيير في المعاينة)
              city: hasCityColumn ? mapCity(cityRaw) : DEFAULT_CITY,
              cityRaw,
            }
          : null,
    });
  }

  return {
    rows,
    totalRows: rows.length,
    matchedCount: rows.filter((r) => r.matchedOrgId !== null).length,
  };
}

// ── الإدخال النهائي ──
export interface CommitRow {
  organizationId: number;
  muqeem?: { username: string; password: string } | null;
  chamber?: { username: string; password: string; city: string } | null;
}

export interface CommitResult {
  muqeemCount: number;
  chamberCount: number;
  skipped: string[];
}

export async function commitCredentialsImport(rows: CommitRow[]): Promise<CommitResult> {
  // معرفات المؤسسات الصالحة للتحقق من أن الواجهة لم ترسل مؤسسة محذوفة
  const orgIds = new Set((await prisma.organization.findMany({ select: { id: true } })).map((o) => o.id));

  let muqeemCount = 0;
  let chamberCount = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    if (!orgIds.has(row.organizationId)) {
      skipped.push(`مؤسسة رقم ${row.organizationId} غير موجودة — تم تجاهلها`);
      continue;
    }

    if (row.muqeem && row.muqeem.username.trim() && row.muqeem.password) {
      await upsertCredential(row.organizationId, 'muqeem', {
        username: row.muqeem.username.trim(),
        password: row.muqeem.password,
      });
      muqeemCount++;
    }

    if (row.chamber && row.chamber.username.trim() && row.chamber.password) {
      const city = row.chamber.city as ChamberCityKey;
      if (!CHAMBER_CITY_KEYS.includes(city)) {
        skipped.push(`بيانات الغرفة لمؤسسة رقم ${row.organizationId} بلا مدينة صحيحة — تم تجاهلها`);
      } else {
        await upsertCredential(row.organizationId, 'chamber', {
          username: row.chamber.username.trim(),
          password: row.chamber.password,
          city,
        });
        chamberCount++;
      }
    }
  }

  return { muqeemCount, chamberCount, skipped };
}
