// فحص سريع لحالة قاعدة البيانات بعد محاولة الاستيراد (قراءة فقط)
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [clients, orgs, services, steps, payments, monthlies, clientSteps] = await Promise.all([
    prisma.client.count(),
    prisma.organization.count(),
    prisma.service.count(),
    prisma.serviceStep.count(),
    prisma.clientPayment.count(),
    prisma.clientPaymentMonthly.count(),
    prisma.clientStep.count(),
  ]);
  console.log({ clients, orgs, services, steps, payments, monthlies, clientSteps });

  const sample = await prisma.client.findFirst({ where: { id: 1 }, select: { id: true, name: true } });
  console.log('client id=1:', sample);
  const firstOrg = await prisma.organization.findFirst({ orderBy: { id: 'asc' }, select: { id: true, name: true } });
  console.log('first org:', firstOrg);
}

main().finally(() => prisma.$disconnect());
