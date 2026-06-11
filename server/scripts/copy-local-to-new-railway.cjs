/**
 * نسخ كل البيانات من القاعدة المحلية إلى قاعدة Railway الجديدة (مرة واحدة).
 * ينسخ كل الجداول ديناميكياً بتقاطع الأعمدة بين المصدر والهدف.
 *
 * الاستخدام: node scripts/copy-local-to-new-railway.cjs "<TARGET_MYSQL_URL>"
 */
const mysql = require('mysql2/promise');

const SOURCE = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'services_app',
  timezone: '+00:00',
};

function parseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    database: u.pathname.replace('/', ''),
    user: u.username,
    password: decodeURIComponent(u.password),
    timezone: '+00:00',
  };
}

async function columns(conn, table) {
  const [rows] = await conn.query(
    'SELECT COLUMN_NAME c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?',
    [table]
  );
  return rows.map((r) => r.c);
}

async function main() {
  const targetUrl = process.argv[2];
  if (!targetUrl) {
    console.error('Usage: node copy-local-to-new-railway.cjs "<TARGET_MYSQL_URL>"');
    process.exit(1);
  }

  const source = await mysql.createConnection(SOURCE);
  const target = await mysql.createConnection(parseUrl(targetUrl));
  console.log('✅ متصل بالمصدر والهدف\n');

  // الجداول المعتمدة هي جداول الهدف (أنشأتها ترحيلات Prisma للتو)
  const [tt] = await target.query(
    "SELECT table_name t FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name <> '_prisma_migrations' ORDER BY table_name"
  );
  const targetTables = tt.map((r) => r.t);

  const [st] = await source.query(
    'SELECT table_name t FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  const sourceTables = new Set(st.map((r) => r.t));

  try {
    await target.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const table of targetTables) {
      if (!sourceTables.has(table)) {
        console.log(`- ${table}: غير موجود في المصدر، تخطّي`);
        continue;
      }
      const srcCols = await columns(source, table);
      const tgtCols = await columns(target, table);
      const cols = srcCols.filter((c) => tgtCols.includes(c));
      if (cols.length === 0) continue;

      await target.query(`TRUNCATE TABLE \`${table}\``);
      const [rows] = await source.query(`SELECT \`${cols.join('`,`')}\` FROM \`${table}\``);
      if (rows.length > 0) {
        const colList = '`' + cols.join('`,`') + '`';
        const batch = 200;
        for (let i = 0; i < rows.length; i += batch) {
          const chunk = rows.slice(i, i + batch);
          const values = chunk.map((r) => cols.map((c) => r[c]));
          await target.query(`INSERT INTO \`${table}\` (${colList}) VALUES ?`, [values]);
        }
      }
      const skipped = srcCols.filter((c) => !tgtCols.includes(c));
      console.log(
        `✓ ${table}: ${rows.length} صف` + (skipped.length ? ` (أعمدة متجاهلة: ${skipped.join(', ')})` : '')
      );
    }

    await target.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 اكتمل النقل بنجاح');
  } catch (err) {
    console.error('\n❌ خطأ أثناء النقل:', err.message);
    process.exitCode = 1;
  } finally {
    await source.end();
    await target.end();
  }
}

main();
