import { randomBytes } from 'crypto';
import prisma from '../lib/prisma.js';
import { getCredential } from './org-credentials.service.js';
import type { PlatformKey } from './login-platforms.service.js';

// صلاحية «التسليح»: من ضغطة فتح المنصة في التطبيق حتى ضغط الـ Bookmarklet في Safari
const ARM_TTL_MS = 10 * 60 * 1000;

// المفتاح ثابت ويُنشأ مرة واحدة حتى لا يحتاج المستخدم إعادة حفظ الـ Bookmarklet
async function getOrCreateRow() {
  const existing = await prisma.mobileFill.findFirst();
  if (existing) return existing;
  return prisma.mobileFill.create({
    data: { fillKey: randomBytes(32).toString('hex') },
  });
}

export async function getFillKey(): Promise<string> {
  const row = await getOrCreateRow();
  return row.fillKey;
}

// يسجل المؤسسة المختارة قبل فتح موقع المنصة — يجلبها الـ Bookmarklet لاحقاً
export async function armFill(organizationId: number, platform: PlatformKey) {
  const row = await getOrCreateRow();
  await prisma.mobileFill.update({
    where: { id: row.id },
    data: { organizationId, platform, armedAt: new Date() },
  });
}

/**
 * قراءة بيانات الدخول المسلّحة — لمرة واحدة: تُمسح فور القراءة وتنتهي صلاحيتها
 * بعد 10 دقائق. يتحقق بالمفتاح بدل JWT لأن توكن الدخول ينتهي كل 7 أيام
 * بينما الـ Bookmarklet محفوظ في Safari بشكل دائم.
 */
export async function consumePendingFill(fillKey: string) {
  const row = await prisma.mobileFill.findFirst({ where: { fillKey } });
  if (!row || !row.organizationId || !row.platform || !row.armedAt) return null;
  if (Date.now() - row.armedAt.getTime() > ARM_TTL_MS) return null;

  await prisma.mobileFill.update({
    where: { id: row.id },
    data: { organizationId: null, platform: null, armedAt: null },
  });

  return getCredential(row.organizationId, row.platform as PlatformKey);
}
