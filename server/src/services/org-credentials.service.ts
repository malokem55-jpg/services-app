import prisma from '../lib/prisma.js';
import { encryptCredential, decryptCredential } from '../lib/credential-crypto.js';
import type { PlatformKey } from './login-platforms.service.js';

// ملخص بدون كلمات مرور: يكفي الواجهة لمعرفة أي مؤسسة سجلت بياناتها لأي منصة
export async function listCredentialSummaries() {
  return prisma.organizationCredential.findMany({
    select: { organizationId: true, platform: true, username: true },
  });
}

export async function getCredential(organizationId: number, platform: PlatformKey) {
  const cred = await prisma.organizationCredential.findUnique({
    where: { organizationId_platform: { organizationId, platform } },
  });
  if (!cred) return null;
  return { username: cred.username, password: decryptCredential(cred.passwordEnc) };
}

export async function upsertCredential(
  organizationId: number,
  platform: PlatformKey,
  data: { username: string; password: string },
) {
  const passwordEnc = encryptCredential(data.password);
  const now = new Date();
  await prisma.organizationCredential.upsert({
    where: { organizationId_platform: { organizationId, platform } },
    create: { organizationId, platform, username: data.username, passwordEnc, createdAt: now, updatedAt: now },
    update: { username: data.username, passwordEnc, updatedAt: now },
  });
  return { username: data.username };
}

export async function deleteCredential(organizationId: number, platform: PlatformKey) {
  await prisma.organizationCredential.deleteMany({ where: { organizationId, platform } });
}
