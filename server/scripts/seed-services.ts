import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIXED_SERVICES = ['نقل داخلي', 'اصدار اقامة جديدة'];

async function main() {
  for (const name of FIXED_SERVICES) {
    const existing = await prisma.service.findFirst({ where: { name } });
    if (!existing) {
      await prisma.service.create({ data: { name, createdAt: new Date(), updatedAt: new Date() } });
      console.log(`Created service: ${name}`);
    } else {
      console.log(`Already exists: ${name}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
