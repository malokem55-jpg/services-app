/**
 * نقل بيانات لمرة واحدة: قاعدة ريلوي (MySQL) → سكيما hameed في Supabase (Postgres).
 * يقرأ من MySQL فقط (لا يحذف منها). الهدف يُفرَّغ ثم يُملأ داخل معاملة واحدة
 * (كل شيء أو لا شيء). يحافظ على المعرّفات الأصلية ثم يعيد ضبط تسلسلات id.
 *
 * التشغيل: npm run prisma  ← لا. استخدم:  npx tsx scripts/migrate-from-railway.ts
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import pg from 'pg';

const MYSQL_URL = process.env.MYSQL_SOURCE_URL;
const PG_URL = process.env.DIRECT_DATABASE_URL;
const SCHEMA = process.env.DB_SCHEMA ?? 'hameed';

if (!MYSQL_URL || !PG_URL) {
  throw new Error('Missing MYSQL_SOURCE_URL or DIRECT_DATABASE_URL in .env');
}

// ترتيب يحترم المفاتيح الأجنبية: الآباء قبل الأبناء.
const TABLES = [
  'users', 'services', 'organizations', 'arrival_places', 'login_platforms', 'chamber_cities',
  'notification_settings', 'ui_settings', 'malik_settings', 'mobile_fill', 'credential_import_drafts',
  'card_grant_settings', 'deleted_client_dues', 'push_subscriptions', 'sent_push_notifications',
  'service_steps', 'organization_credentials', 'clients',
  'client_steps', 'client_payments', 'client_payment_monthlies', 'card_issuances', 'receipt_day_changes',
];

// أعمدة نوعها boolean في Postgres (MySQL يخزّنها 0/1).
const BOOL_COLS = new Set([
  'enabled', 'generate_monthly_after_iqama', 'tafweed_done', 'is_done', 'last_payment', 'after_iqama',
  'push_monthly_payment', 'push_custom_payment', 'push_iqama_soon', 'push_iqama_expired', 'push_tafweed',
  'show_bell_custom_payments', 'show_bell_monthly_payments', 'show_bell_iqama_soon', 'show_bell_iqama_expired',
  'show_bell_tafweed', 'show_under_procedure_page', 'show_deleted_dues_page', 'show_iqama_alerts_page',
  'show_custom_mobile_version', 'run_on_mobile',
]);
// أعمدة jsonb.
const JSON_COLS = new Set(['details', 'collections']);

function convert(col: string, val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (BOOL_COLS.has(col)) return Number(val) !== 0;
  if (JSON_COLS.has(col)) return typeof val === 'string' ? val : JSON.stringify(val);
  return val; // dateStrings=true يجعل التواريخ نصوصاً (يتفادى انزياح المنطقة الزمنية)
}

async function main(): Promise<void> {
  const u = new URL(MYSQL_URL!);
  const my = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
    dateStrings: true,
  });

  const client = new pg.Client({
    connectionString: PG_URL!.split('?')[0],
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query(`SET search_path TO "${SCHEMA}"`);

  await client.query('BEGIN');
  try {
    // تفريغ الهدف (بالعكس: الأبناء أولاً)
    for (const t of [...TABLES].reverse()) {
      await client.query(`DELETE FROM "${SCHEMA}"."${t}"`);
    }

    const report: Record<string, number> = {};
    for (const t of TABLES) {
      // أعمدة الجدول في Postgres (نقتصر عليها لتفادي أي اختلاف مع MySQL)
      const pgColsRes = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
        [SCHEMA, t],
      );
      const pgCols = new Set(pgColsRes.rows.map((r: { column_name: string }) => r.column_name));

      let rows: Record<string, unknown>[];
      try {
        const [res] = await my.query(`SELECT * FROM \`${t}\``);
        rows = res as Record<string, unknown>[];
      } catch {
        console.log(`- ${t}: (غير موجود في المصدر) تخطّي`);
        report[t] = 0;
        continue;
      }
      if (rows.length === 0) {
        report[t] = 0;
        console.log(`- ${t}: 0`);
        continue;
      }

      const cols = Object.keys(rows[0]).filter((c) => pgCols.has(c));
      const colList = cols.map((c) => `"${c}"`).join(', ');
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const insertSql = `INSERT INTO "${SCHEMA}"."${t}" (${colList}) VALUES (${placeholders})`;

      for (const row of rows) {
        const vals = cols.map((c) => convert(c, row[c]));
        await client.query(insertSql, vals);
      }

      // إعادة ضبط تسلسل id ليبدأ بعد أكبر معرّف منقول
      if (pgCols.has('id')) {
        await client.query(
          `SELECT setval(pg_get_serial_sequence('"${SCHEMA}"."${t}"', 'id'),
                         GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${SCHEMA}"."${t}"), 1))`,
        );
      }
      report[t] = rows.length;
      console.log(`- ${t}: ${rows.length}`);
    }

    await client.query('COMMIT');
    const total = Object.values(report).reduce((s, n) => s + n, 0);
    console.log(`\n✔ تمّ النقل داخل معاملة واحدة. الإجمالي: ${total} صفّاً في ${Object.keys(report).length} جدولاً.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('✗ فشل النقل — تراجعت المعاملة، لم يتغيّر شيء في الهدف.');
    throw err;
  } finally {
    await my.end();
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
