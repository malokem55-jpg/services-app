// اختبار محلّل ملف الاستيراد بدون لمس قاعدة البيانات:
// npx tsx scripts/test-import-parse.ts <path-to-sql>
import { readFileSync } from 'node:fs';
import { parseInserts } from '../src/services/data-import.service.js';

const path = process.argv[2];
if (!path) {
  console.error('Usage: npx tsx scripts/test-import-parse.ts <path-to-sql>');
  process.exit(1);
}

const sql = readFileSync(path, 'utf8');
const tables = parseInserts(sql);

for (const [name, rows] of tables) {
  console.log(`${name}: ${rows.length} rows`);
}

const services = tables.get('services') ?? [];
console.log('\nservices names:', services.map((r) => r.name));

const steps = tables.get('service_steps') ?? [];
console.log('service_steps names:', steps.map((r) => r.name));

const orgs = tables.get('organizations') ?? [];
console.log('\nfirst 5 organizations:', orgs.slice(0, 5).map((r) => r.name));

const clients = tables.get('clients') ?? [];
console.log('\nfirst 3 clients:', clients.slice(0, 3).map((r) => ({
  id: r.id, name: r.name, card: r.card_type, pay: r.payment_type, iqama: r.iqama_end_date,
})));
console.log('client 222 (card type with value):', clients.find((r) => r.id === 222));

const monthlies = tables.get('client_payment_monthlies') ?? [];
console.log('\nmonthly statuses:', [...new Set(monthlies.map((r) => r.status))]);

const payments = tables.get('client_payments') ?? [];
const noteRow = payments.find((r) => r.notes !== null);
console.log('payment with notes:', noteRow);
