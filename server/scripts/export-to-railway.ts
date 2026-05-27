/**
 * export-to-railway.ts
 * ينقل البيانات من قاعدة البيانات المحلية إلى Railway MySQL
 *
 * الاستخدام:
 *   cd server
 *   npx tsx scripts/export-to-railway.ts
 *
 * تأكد أن DATABASE_URL في ملف .env يشير إلى Railway (MYSQL_PUBLIC_URL)
 */

import 'dotenv/config';
import mysql from 'mysql2/promise';

// ── المصدر: قاعدة البيانات المحلية ────────────────────────────────────────
const SOURCE_CONFIG = {
  host: '127.0.0.1',
  port: 3307,
  database: 'servicesofficeapp',
  user: 'root',
  password: 'rootpassword',
  timezone: '+00:00',
};

// ── الهدف: Railway MySQL (من متغير البيئة) ───────────────────────────────
function parseUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    database: u.pathname.replace('/', ''),
    user: u.username,
    password: u.password,
    timezone: '+00:00',
    ssl: { rejectUnauthorized: false },
  };
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL غير موجود في .env');
    process.exit(1);
  }

  console.log('🔌 جاري الاتصال بقواعد البيانات...');
  const source = await mysql.createConnection(SOURCE_CONFIG);
  const target = await mysql.createConnection(parseUrl(dbUrl));
  console.log('✅ تم الاتصال بنجاح\n');

  try {
    await target.query('SET FOREIGN_KEY_CHECKS = 0');

    // ── تفريغ الجداول ────────────────────────────────────────────────────
    console.log('🗑️  جاري تفريغ قاعدة بيانات Railway...');
    for (const table of [
      'client_payment_monthlies',
      'client_payments',
      'client_steps',
      'clients',
      'service_steps',
      'organizations',
      'services',
      'users',
    ]) {
      await target.query(`TRUNCATE TABLE ${table}`);
    }
    console.log('✅ تم التفريغ\n');

    // ── 1. users ──────────────────────────────────────────────────────────
    const [users] = await source.query<any[]>('SELECT * FROM users');
    for (const r of users) {
      await target.query(
        `INSERT IGNORE INTO users (id, name, username, phone, password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.username, r.phone, r.password, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ users                    : ${(users as any[]).length} صف`);

    // ── 2. services ───────────────────────────────────────────────────────
    const [services] = await source.query<any[]>('SELECT * FROM services');
    for (const r of services) {
      await target.query(
        `INSERT IGNORE INTO services (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        [r.id, r.name, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ services                 : ${(services as any[]).length} صف`);

    // ── 3. organizations ──────────────────────────────────────────────────
    const [orgs] = await source.query<any[]>('SELECT * FROM organizations');
    for (const r of orgs) {
      await target.query(
        `INSERT IGNORE INTO organizations (id, name, number, expired_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.number, r.expired_date, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ organizations            : ${(orgs as any[]).length} صف`);

    // ── 4. service_steps ──────────────────────────────────────────────────
    const [steps] = await source.query<any[]>('SELECT * FROM service_steps');
    for (const r of steps) {
      await target.query(
        `INSERT IGNORE INTO service_steps (id, name, number, \`order\`, service_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.number, r.order, r.service_id, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ service_steps            : ${(steps as any[]).length} صف`);

    // ── 5. clients ────────────────────────────────────────────────────────
    const [clients] = await source.query<any[]>('SELECT * FROM clients');
    for (const r of clients) {
      await target.query(
        `INSERT IGNORE INTO clients
           (id, name, phone, passport, board_number, visa_number,
            iqama_number, iqama_end_date, card_type, card_value,
            notes, payment_type, next_payment_date, amount,
            service_id, organization_id, last_step_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id, r.name, r.phone, r.passport,
          r.board_number, r.visa_number, r.iqama_number, r.iqama_end_date,
          r.card_type, r.card_value, r.notes, r.payment_type,
          r.next_payment_date, r.amount,
          r.service_id, r.organization_id, r.last_step_id,
          r.created_at, r.updated_at,
        ]
      );
    }
    console.log(`✓ clients                  : ${(clients as any[]).length} صف`);

    // ── 6. client_steps ───────────────────────────────────────────────────
    const [clientSteps] = await source.query<any[]>('SELECT * FROM client_steps');
    for (const r of clientSteps) {
      await target.query(
        `INSERT IGNORE INTO client_steps (id, step_date, client_id, step_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [r.id, r.step_date, r.client_id, r.step_id, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ client_steps             : ${(clientSteps as any[]).length} صف`);

    // ── 7. client_payments ────────────────────────────────────────────────
    const [payments] = await source.query<any[]>('SELECT * FROM client_payments');
    for (const r of payments) {
      await target.query(
        `INSERT IGNORE INTO client_payments
           (id, client_id, amount, next_payment_date, is_done, last_payment, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.client_id, r.amount, r.next_payment_date, r.is_done, r.last_payment, r.notes, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ client_payments          : ${(payments as any[]).length} صف`);

    // ── 8. client_payment_monthlies ───────────────────────────────────────
    const [monthlies] = await source.query<any[]>('SELECT * FROM client_payment_monthlies');
    for (const r of monthlies) {
      await target.query(
        `INSERT IGNORE INTO client_payment_monthlies
           (id, client_id, iqama_end_date, month, received_date,
            amount, received_amount, status, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.client_id, r.iqama_end_date, r.month, r.received_date,
         r.amount, r.received_amount, r.status, r.notes, r.created_at, r.updated_at]
      );
    }
    console.log(`✓ client_payment_monthlies : ${(monthlies as any[]).length} صف`);

    await target.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 تم نقل البيانات إلى Railway بنجاح!');

  } catch (err) {
    console.error('\n❌ خطأ أثناء النقل:', err);
    process.exit(1);
  } finally {
    await source.end();
    await target.end();
  }
}

main();
