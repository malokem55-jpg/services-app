import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// استيراد قاعدة بيانات المشروع القديم (Laravel/MySQL dump):
// يفرّغ بيانات العمل الحالية (مع الإبقاء على المستخدمين والإعدادات)
// ثم يُدخل بيانات الملف المرفوع محافظًا على المعرفات الأصلية.

export interface ImportResult {
  counts: Record<string, number>;
  warnings: string[];
}

type SqlValue = string | number | null;
type SqlRow = Record<string, SqlValue>;

class BadDumpError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
  }
}

// ── إصلاح الترميز المزدوج (mojibake) ──
// تصديرات phpMyAdmin القديمة تُخرج النص العربي كـ UTF-8 مفسَّر بترميز cp1252
// (مثل: "Ø¨Ø¯ÙÙ" بدلًا من "بدون"). نعيد بناء البايتات الأصلية ونفك UTF-8.
const CP1252_REVERSE: Record<number, number> = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function fixMojibake(s: string): string {
  // نص بلا حروف لاتينية عالية ليس ترميزًا مزدوجًا (يشمل العربية السليمة)
  if (!/[À-ÿ]/.test(s)) return s;
  const bytes: number[] = [];
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (cp < 0x100) bytes.push(cp);
    else if (CP1252_REVERSE[cp] !== undefined) bytes.push(CP1252_REVERSE[cp]);
    else return s; // يحتوي حروفًا خارج cp1252 → النص سليم أصلًا
  }
  const decoded = Buffer.from(bytes).toString('utf8');
  return decoded.includes('�') ? s : decoded;
}

// ── محلّل جمل INSERT ──
// يستخرج صفوف INSERT INTO `table` (`cols`) VALUES (...),(...); مع احترام
// النصوص المقتبسة ومحارف الهروب (\' و '' و \\).
export function parseInserts(sql: string): Map<string, SqlRow[]> {
  const tables = new Map<string, SqlRow[]>();
  const headerRe = /INSERT INTO `(\w+)`\s*\(([^)]+)\)\s*VALUES/g;
  let match: RegExpExecArray | null;

  while ((match = headerRe.exec(sql)) !== null) {
    const tableName = match[1];
    const columns = match[2].split(',').map((c) => c.trim().replace(/`/g, ''));
    const rows = tables.get(tableName) ?? [];
    tables.set(tableName, rows);

    let i = headerRe.lastIndex;
    parseTuples: for (;;) {
      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] !== '(') break;
      i++;
      const values: SqlValue[] = [];
      let current = '';
      let inString = false;
      let valueIsString = false;

      for (; i < sql.length; i++) {
        const ch = sql[i];
        if (inString) {
          if (ch === '\\' && i + 1 < sql.length) {
            const next = sql[i + 1];
            current +=
              next === 'n' ? '\n' : next === 'r' ? '\r' : next === 't' ? '\t' :
              next === '0' ? '\0' : next;
            i++;
          } else if (ch === "'") {
            if (sql[i + 1] === "'") {
              current += "'";
              i++;
            } else {
              inString = false;
            }
          } else {
            current += ch;
          }
          continue;
        }
        if (ch === "'") {
          // علامة اقتباس افتتاحية: نتجاهل أي فراغات سبقتها خارج النص
          if (!valueIsString) current = '';
          inString = true;
          valueIsString = true;
        } else if (ch === ',' || ch === ')') {
          const raw = current.trim();
          if (valueIsString) values.push(fixMojibake(current));
          else if (raw === '' || raw.toUpperCase() === 'NULL') values.push(null);
          else values.push(Number(raw));
          current = '';
          valueIsString = false;
          if (ch === ')') {
            i++;
            break;
          }
        } else {
          current += ch;
        }
      }

      if (values.length !== columns.length) {
        throw new BadDumpError(`صف غير صالح في جدول ${tableName}: عدد القيم لا يطابق عدد الأعمدة`);
      }
      const row: SqlRow = {};
      columns.forEach((col, idx) => (row[col] = values[idx]));
      rows.push(row);

      while (i < sql.length && /\s/.test(sql[i])) i++;
      if (sql[i] === ',') {
        i++;
        continue;
      }
      break parseTuples;
    }
    headerRe.lastIndex = i;
  }

  return tables;
}

// ── محوّلات القيم ──
function asString(v: SqlValue): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function asNumber(v: SqlValue): number | null {
  if (v === null || typeof v !== 'number' || Number.isNaN(v)) return null;
  return v;
}

function asBool(v: SqlValue): boolean | null {
  if (v === null) return null;
  return Number(v) !== 0;
}

function asDate(v: SqlValue): Date | null {
  const s = asString(v);
  if (!s || !/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const d = new Date(`${s.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asDateTime(v: SqlValue): Date | null {
  const s = asString(v);
  if (!s) return null;
  const d = new Date(`${s.replace(' ', 'T')}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function importLegacyDump(sql: string): Promise<ImportResult> {
  const tables = parseInserts(sql);
  const warnings: string[] = [];

  const services = tables.get('services') ?? [];
  const serviceSteps = tables.get('service_steps') ?? [];
  const organizations = tables.get('organizations') ?? [];
  const clients = tables.get('clients') ?? [];
  const clientSteps = tables.get('client_steps') ?? [];
  const clientPayments = tables.get('client_payments') ?? [];
  const clientPaymentMonthlies = tables.get('client_payment_monthlies') ?? [];

  if (services.length === 0 && organizations.length === 0 && clients.length === 0) {
    throw new BadDumpError('الملف لا يحتوي بيانات معروفة (services / organizations / clients)');
  }

  // مجموعات المعرفات الصالحة للتحقق من الروابط
  const serviceIds = new Set(services.map((r) => asNumber(r.id)));
  const stepIds = new Set(serviceSteps.map((r) => asNumber(r.id)));
  const orgIds = new Set(organizations.map((r) => asNumber(r.id)));
  const clientIds = new Set(clients.map((r) => asNumber(r.id)));

  function fkOrNull(value: SqlValue, validIds: Set<number | null>, label: string, rowDesc: string): number | null {
    const id = asNumber(value);
    if (id === null) return null;
    if (validIds.has(id)) return id;
    warnings.push(`${rowDesc}: مرجع ${label} رقم ${id} غير موجود — تم تفريغه`);
    return null;
  }

  // ── تجهيز بيانات الإدخال ──
  const serviceData: Prisma.ServiceCreateManyInput[] = services.map((r) => ({
    id: asNumber(r.id)!,
    name: asString(r.name),
    createdAt: asDateTime(r.created_at),
    updatedAt: asDateTime(r.updated_at),
  }));

  // ترتيب الخطوات: المخطط الحالي يعتمد عمود order — نولّده تسلسليًا داخل كل خدمة حسب المعرف القديم
  const stepsByService = new Map<number | null, SqlRow[]>();
  for (const r of serviceSteps) {
    const sid = asNumber(r.service_id);
    const list = stepsByService.get(sid) ?? [];
    list.push(r);
    stepsByService.set(sid, list);
  }
  const stepOrder = new Map<number, number>();
  for (const list of stepsByService.values()) {
    list
      .slice()
      .sort((a, b) => (asNumber(a.id) ?? 0) - (asNumber(b.id) ?? 0))
      .forEach((r, idx) => stepOrder.set(asNumber(r.id)!, idx + 1));
  }
  const serviceStepData: Prisma.ServiceStepCreateManyInput[] = serviceSteps.map((r) => ({
    id: asNumber(r.id)!,
    name: asString(r.name),
    number: asString(r.number),
    order: stepOrder.get(asNumber(r.id)!) ?? null,
    serviceId: fkOrNull(r.service_id, serviceIds, 'الخدمة', `خطوة ${asString(r.name) ?? r.id}`),
    createdAt: asDateTime(r.created_at),
    updatedAt: asDateTime(r.updated_at),
  }));

  // المخطط الحالي للمؤسسات لا يحتوي أعمدة type/capacity/owner/phone — تُتجاهل
  const droppedOrgFields = organizations.filter(
    (r) => asString(r.type) || asNumber(r.capacity) !== null || asString(r.owner) || asString(r.phone),
  ).length;
  if (droppedOrgFields > 0) {
    warnings.push(`تم تجاهل حقول (النوع/السعة/المالك/الهاتف) لعدد ${droppedOrgFields} مؤسسة — غير موجودة في النظام الحالي`);
  }
  const organizationData: Prisma.OrganizationCreateManyInput[] = organizations.map((r) => ({
    id: asNumber(r.id)!,
    name: asString(r.name),
    number: asString(r.number),
    expiredDate: asDate(r.expired_date),
    createdAt: asDateTime(r.created_at),
    updatedAt: asDateTime(r.updated_at),
  }));

  // card_value غير موجود في النظام الحالي (الكروت تُدار عبر سجل الإصدارات)
  const droppedCardValues = clients.filter((r) => (asNumber(r.card_value) ?? 0) > 0).length;
  if (droppedCardValues > 0) {
    warnings.push(`تم تجاهل قيمة الكرت (card_value) لعدد ${droppedCardValues} عميل — نوع الكرت نُقل كنص فقط`);
  }
  const clientData: Prisma.ClientCreateManyInput[] = clients.map((r) => {
    const desc = `العميل ${asString(r.name) ?? r.id}`;
    return {
      id: asNumber(r.id)!,
      name: asString(r.name),
      phone: asString(r.phone),
      passport: asString(r.passport),
      boardNumber: asString(r.board_number),
      visaNumber: asString(r.visa_number),
      iqamaNumber: asString(r.iqama_number),
      iqamaEndDate: asDate(r.iqama_end_date),
      cardType: asString(r.card_type) ?? 'بدون',
      notes: asString(r.notes),
      paymentType: asString(r.payment_type),
      nextPaymentDate: asDate(r.next_payment_date),
      amount: asNumber(r.amount),
      serviceId: fkOrNull(r.service_id, serviceIds, 'الخدمة', desc),
      organizationId: fkOrNull(r.organization_id, orgIds, 'المؤسسة', desc),
      lastStepId: fkOrNull(r.last_step_id, stepIds, 'الخطوة', desc),
      createdAt: asDateTime(r.created_at),
      updatedAt: asDateTime(r.updated_at),
    };
  });

  // صفوف الجداول التابعة التي تشير لعميل غير موجود تُستبعد
  function clientRef(r: SqlRow, table: string): number | null {
    const id = asNumber(r.client_id);
    if (id !== null && clientIds.has(id)) return id;
    warnings.push(`${table}: سجل رقم ${r.id} يشير لعميل غير موجود (${id ?? 'فارغ'}) — تم استبعاده`);
    return null;
  }

  const clientStepData: Prisma.ClientStepCreateManyInput[] = clientSteps.flatMap((r) => {
    const clientId = clientRef(r, 'خطوات العملاء');
    if (clientId === null) return [];
    return [{
      id: asNumber(r.id)!,
      clientId,
      stepId: fkOrNull(r.step_id, stepIds, 'الخطوة', `خطوة العميل رقم ${r.id}`),
      stepDate: asDate(r.step_date),
      createdAt: asDateTime(r.created_at),
      updatedAt: asDateTime(r.updated_at),
    }];
  });

  const clientPaymentData: Prisma.ClientPaymentCreateManyInput[] = clientPayments.flatMap((r) => {
    const clientId = clientRef(r, 'دفعات العملاء');
    if (clientId === null) return [];
    return [{
      id: asNumber(r.id)!,
      clientId,
      amount: asNumber(r.amount),
      nextPaymentDate: asDate(r.next_payment_date),
      isDone: asBool(r.is_done),
      lastPayment: asBool(r.last_payment),
      notes: asString(r.notes),
      createdAt: asDateTime(r.created_at),
      updatedAt: asDateTime(r.updated_at),
    }];
  });

  const clientPaymentMonthlyData: Prisma.ClientPaymentMonthlyCreateManyInput[] =
    clientPaymentMonthlies.flatMap((r) => {
      const clientId = clientRef(r, 'الدفعات الشهرية');
      if (clientId === null) return [];
      return [{
        id: asNumber(r.id)!,
        clientId,
        iqamaEndDate: asDate(r.iqama_end_date),
        month: asString(r.month),
        receivedDate: asDate(r.received_date),
        amount: asNumber(r.amount),
        receivedAmount: asNumber(r.received_amount),
        status: asString(r.status),
        notes: asString(r.notes),
        createdAt: asDateTime(r.created_at),
        updatedAt: asDateTime(r.updated_at),
      }];
    });

  // ── التنفيذ: حذف بيانات العمل ثم الإدخال، كل ذلك في معاملة واحدة ──
  await prisma.$transaction(
    async (tx) => {
      // الحذف بترتيب يحترم الروابط
      await tx.cardIssuance.deleteMany();
      await tx.clientStep.deleteMany();
      await tx.clientPayment.deleteMany();
      await tx.clientPaymentMonthly.deleteMany();
      await tx.client.deleteMany();
      await tx.serviceStep.deleteMany();
      await tx.service.deleteMany();
      await tx.organizationCredential.deleteMany();
      await tx.organization.deleteMany();
      await tx.arrivalPlace.deleteMany();
      await tx.deletedClientDue.deleteMany();
      // سجل تكرار الإشعارات يشير لمعرفات العملاء القدامى — يُفرّغ لتفادي كبت إشعارات صحيحة
      await tx.sentPushNotification.deleteMany();

      await tx.service.createMany({ data: serviceData });
      await tx.serviceStep.createMany({ data: serviceStepData });
      await tx.organization.createMany({ data: organizationData });
      await tx.client.createMany({ data: clientData });
      await tx.clientStep.createMany({ data: clientStepData });
      await tx.clientPayment.createMany({ data: clientPaymentData });
      await tx.clientPaymentMonthly.createMany({ data: clientPaymentMonthlyData });
    },
    { timeout: 120_000, maxWait: 15_000 },
  );

  return {
    counts: {
      services: serviceData.length,
      serviceSteps: serviceStepData.length,
      organizations: organizationData.length,
      clients: clientData.length,
      clientSteps: clientStepData.length,
      clientPayments: clientPaymentData.length,
      clientPaymentMonthlies: clientPaymentMonthlyData.length,
    },
    warnings,
  };
}
