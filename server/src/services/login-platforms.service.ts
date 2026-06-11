import prisma from '../lib/prisma.js';

export const PLATFORM_KEYS = ['muqeem', 'chamber'] as const;
export type PlatformKey = (typeof PLATFORM_KEYS)[number];

const DEFAULT_LOGIN_URLS: Record<PlatformKey, string> = {
  muqeem: 'https://muqeem.sa/#/login',
  chamber: '',
};

// يضمن وجود صف لكل منصة (معطلة افتراضيًا) ثم يعيد الكل
export async function listLoginPlatforms() {
  const existing = await prisma.loginPlatform.findMany();
  const missing = PLATFORM_KEYS.filter((key) => !existing.some((p) => p.key === key));
  if (missing.length > 0) {
    await prisma.loginPlatform.createMany({
      data: missing.map((key) => ({ key, enabled: false, loginUrl: DEFAULT_LOGIN_URLS[key] })),
    });
    return prisma.loginPlatform.findMany({ orderBy: { id: 'asc' } });
  }
  return existing.sort((a, b) => a.id - b.id);
}

export async function updateLoginPlatform(
  key: PlatformKey,
  patch: { enabled?: boolean; loginUrl?: string },
) {
  await listLoginPlatforms(); // يضمن وجود الصف قبل التحديث
  return prisma.loginPlatform.update({ where: { key }, data: patch });
}
