import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const IQAMA_STEPS = [
  { name: 'إصدار تأشيرة',    number: '1' },
  { name: 'تفويض و تصديق',   number: '2' },
  { name: 'تصديق عقد العمل', number: '3' },
  { name: 'فحص طبي',         number: '4' },
  { name: 'تأمين طبي',       number: null },
  { name: 'كرت العمل',       number: null },
  { name: 'سداد الرسوم',     number: null },
  { name: 'إصدار الإقامة',   number: null },
];

async function main() {
  const svc = await prisma.service.findFirst({ where: { name: 'اصدار اقامة جديدة' } });
  if (!svc) { console.log('Service not found'); return; }

  const existing = await prisma.serviceStep.count({ where: { serviceId: svc.id } });
  if (existing > 0) {
    console.log(`Already has ${existing} steps — skipping`);
    return;
  }

  const result = await prisma.serviceStep.createMany({
    data: IQAMA_STEPS.map((s) => ({
      name: s.name,
      number: s.number,
      serviceId: svc.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  });
  console.log(`Created ${result.count} steps for "${svc.name}"`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
