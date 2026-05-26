import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERNAME = 'admin';
const PASSWORD = 'OfficeApp@2026';

async function main() {
  const existing = await prisma.user.findFirst({ where: { username: USERNAME } });
  if (existing) {
    console.log(`User "${USERNAME}" already exists (id=${existing.id}). Skipping.`);
    return;
  }

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      username: USERNAME,
      password: hashed,
    },
  });

  console.log(`Created user: ${user.username} (id=${user.id})`);
  console.log(`Password: ${PASSWORD}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
