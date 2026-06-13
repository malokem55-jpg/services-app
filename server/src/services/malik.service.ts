import bcrypt from 'bcrypt';
import prisma from '../lib/prisma.js';

// كلمة مرور واحدة للوحة /malik (سجل مفرد id=1). تُنشأ عند أول دخول وتُغيَّر من داخلها.

async function getRow() {
  return prisma.malikSetting.findFirst();
}

export async function hasMalikPassword(): Promise<boolean> {
  const row = await getRow();
  return !!row?.passwordHash;
}

export async function setMalikPassword(plain: string): Promise<void> {
  const passwordHash = await bcrypt.hash(plain, 10);
  await prisma.malikSetting.upsert({
    where: { id: 1 },
    update: { passwordHash },
    create: { id: 1, passwordHash },
  });
}

export async function verifyMalikPassword(plain: string): Promise<boolean> {
  const row = await getRow();
  if (!row?.passwordHash) return false;
  return bcrypt.compare(plain, row.passwordHash);
}
