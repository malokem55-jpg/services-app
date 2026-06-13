import prisma from '../lib/prisma.js';
import { encryptCredential, decryptCredential } from '../lib/credential-crypto.js';
import type { PlatformKey } from './login-platforms.service.js';

// ملخص بدون كلمات مرور: يكفي الواجهة لمعرفة أي مؤسسة سجلت بياناتها لأي منصة
// (city مطلوب للغرفة حتى تعرف الواجهة مدينة كل مؤسسة)
export async function listCredentialSummaries() {
  return prisma.organizationCredential.findMany({
    select: { organizationId: true, platform: true, username: true, city: true },
  });
}

export async function getCredential(organizationId: number, platform: PlatformKey) {
  const cred = await prisma.organizationCredential.findUnique({
    where: { organizationId_platform: { organizationId, platform } },
  });
  if (!cred) return null;
  return { username: cred.username, password: decryptCredential(cred.passwordEnc), city: cred.city };
}

export async function upsertCredential(
  organizationId: number,
  platform: PlatformKey,
  data: { username: string; password: string; city?: string | null },
) {
  const passwordEnc = encryptCredential(data.password);
  const city = platform === 'chamber' ? (data.city ?? null) : null;
  const now = new Date();
  await prisma.organizationCredential.upsert({
    where: { organizationId_platform: { organizationId, platform } },
    create: { organizationId, platform, username: data.username, passwordEnc, city, createdAt: now, updatedAt: now },
    update: { username: data.username, passwordEnc, city, updatedAt: now },
  });
  return { username: data.username, city };
}

export async function deleteCredential(organizationId: number, platform: PlatformKey) {
  await prisma.organizationCredential.deleteMany({ where: { organizationId, platform } });
}
