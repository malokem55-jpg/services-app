/**
 * migrate-data.ts
 * ينقل البيانات من قاعدة بيانات Laravel القديمة إلى قاعدة بيانات Node.js الجديدة
 *
 * المصدر : MySQL port 3306 — database: servicesOfficeApp — password: root
 * الهدف  : MySQL port 3307 — database: servicesofficeapp — password: rootpassword
 *
 * الاستخدام:
 *   cd server
 *   npx tsx scripts/migrate-data.ts
 */

import mysql from 'mysql2/promise';

// ── إعدادات الاتصال ────────────────────────────────────────────────────────
const SOURCE_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  database: 'servicesOfficeApp',
  user: 'root',
  password: 'root',
  timezone: '+00:00',
};

const TARGET_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  database: 'servicesofficeapp',
  user: 'root',
  password: 'rootpassword',
  timezone: '+00:00',
};

// ── دالة مساعدة ────────────────────────────────────────────────────────────
function log(msg: string) {
  console.log(msg);
}

// ── السكريبت الرئيسي ───────────────────────────────────────────────────────
async function migrate() {
  log('🔌 جاري الاتصال بقواعد البيانات...');

  const source = await mysql.createConnection(SOURCE_CONFIG);
  const target = await mysql.createConnection(TARGET_CONFIG);

  log('✅ تم الاتصال بنجاح\n');

  try {
    // تعطيل فحص المفاتيح الأجنبية مؤقتاً لتسهيل الحذف والإدخال
    await target.query('SET FOREIGN_KEY_CHECKS = 0');

    // ── تفريغ الجداول قبل النقل (بالترتيب العكسي للعلاقات) ──────────────
    log('🗑️  جاري تفريغ قاعدة البيانات...');
    await target.query('TRUNCATE TABLE client_payment_monthlies');
    await target.query('TRUNCATE TABLE client_payments');
    await target.query('TRUNCATE TABLE client_steps');
    await target.query('TRUNCATE TABLE clients');
    await target.query('TRUNCATE TABLE service_steps');
    await target.query('TRUNCATE TABLE organizations');
    await target.query('TRUNCATE TABLE services');
    log('✅ تم تفريغ الجداول\n');

    // ── 1. services ──────────────────────────────────────────────────────
    const [services] = await source.query<any[]>('SELECT * FROM services');
    let count = 0;
    for (const row of services) {
      await target.query(
        `INSERT IGNORE INTO services (id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [row.id, row.name, row.created_at, row.updated_at]
      );
      count++;
    }
    log(`✓ services            : ${count} صف`);

    // ── 2. organizations ─────────────────────────────────────────────────
    const [orgs] = await source.query<any[]>('SELECT * FROM organizations');
    count = 0;
    for (const row of orgs) {
      await target.query(
        `INSERT IGNORE INTO organizations
           (id, name, number, expired_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.number, row.expired_date, row.created_at, row.updated_at]
      );
      count++;
    }
    log(`✓ organizations       : ${count} صف`);

    // ── 3. service_steps ─────────────────────────────────────────────────
    const [steps] = await source.query<any[]>('SELECT * FROM service_steps');
    count = 0;
    for (const row of steps) {
      await target.query(
        `INSERT IGNORE INTO service_steps
           (id, name, number, service_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.name, row.number, row.service_id, row.created_at, row.updated_at]
      );
      count++;
    }
    log(`✓ service_steps       : ${count} صف`);

    // ── 4. clients ───────────────────────────────────────────────────────
    const [clients] = await source.query<any[]>('SELECT * FROM clients');
    count = 0;
    for (const row of clients) {
      await target.query(
        `INSERT IGNORE INTO clients
           (id, name, phone, passport, board_number, visa_number,
            iqama_number, iqama_end_date, card_type, card_value,
            notes, payment_type, next_payment_date, amount,
            service_id, organization_id, last_step_id,
            created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.name, row.phone, row.passport,
          row.board_number, row.visa_number, row.iqama_number, row.iqama_end_date,
          row.card_type, row.card_value, row.notes, row.payment_type,
          row.next_payment_date, row.amount,
          row.service_id, row.organization_id, row.last_step_id,
          row.created_at, row.updated_at,
        ]
      );
      count++;
    }
    log(`✓ clients             : ${count} صف`);

    // ── 5. client_steps ──────────────────────────────────────────────────
    const [clientSteps] = await source.query<any[]>('SELECT * FROM client_steps');
    count = 0;
    for (const row of clientSteps) {
      await target.query(
        `INSERT IGNORE INTO client_steps
           (id, step_date, client_id, step_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [row.id, row.step_date, row.client_id, row.step_id, row.created_at, row.updated_at]
      );
      count++;
    }
    log(`✓ client_steps        : ${count} صف`);

    // ── 6. client_payments ───────────────────────────────────────────────
    const [payments] = await source.query<any[]>('SELECT * FROM client_payments');
    count = 0;
    for (const row of payments) {
      await target.query(
        `INSERT IGNORE INTO client_payments
           (id, client_id, amount, next_payment_date, is_done, last_payment, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.client_id, row.amount, row.next_payment_date,
          row.is_done, row.last_payment, row.notes,
          row.created_at, row.updated_at,
        ]
      );
      count++;
    }
    log(`✓ client_payments     : ${count} صف`);

    // ── 7. client_payment_monthlies ──────────────────────────────────────
    const [monthlies] = await source.query<any[]>('SELECT * FROM client_payment_monthlies');
    count = 0;
    for (const row of monthlies) {
      await target.query(
        `INSERT IGNORE INTO client_payment_monthlies
           (id, client_id, iqama_end_date, month, received_date,
            amount, received_amount, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id, row.client_id, row.iqama_end_date, row.month, row.received_date,
          row.amount, row.received_amount, row.status, row.notes,
          row.created_at, row.updated_at,
        ]
      );
      count++;
    }
    log(`✓ client_payment_monthlies: ${count} صف`);

    // إعادة تفعيل فحص المفاتيح الأجنبية
    await target.query('SET FOREIGN_KEY_CHECKS = 1');

    log('\n🎉 تم نقل البيانات بنجاح!');
  } catch (err) {
    console.error('\n❌ خطأ أثناء الترحيل:', err);
    process.exit(1);
  } finally {
    await source.end();
    await target.end();
  }
}

migrate();
