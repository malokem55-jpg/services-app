import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const USERNAME = 'admin';
const PASSWORD = 'admin';

async function main() {
  const deleted = await prisma.user.deleteMany({ where: { username: USERNAME } });
  if (deleted.count > 0) {
    console.log(`Deleted ${deleted.count} existing user(s) with username "${USERNAME}".`);
  }

  const hashed = await bcrypt.hash(PASSWORD, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Admin',
      username: USERNAME,
      password: hashed,
    },
  });

  console.log(`Recreated user: ${user.username} (id=${user.id})`);
  console.log(`Password: ${PASSWORD}`);
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
