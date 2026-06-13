import prisma from '../lib/prisma.js';
import { encryptCredential, decryptCredential } from '../lib/credential-crypto.js';

// مسودة استيراد بيانات الدخول: تُخزَّن الصفوف كـ JSON مشفّر في سجل واحد (تطبيق بمستخدم واحد).
// تتيح للمستخدم العودة لاحقًا وإكمال الصفوف غير المطابقة دون رفع الملف من جديد.

export async function getDraftRows(): Promise<unknown[]> {
  const draft = await prisma.credentialImportDraft.findFirst();
  if (!draft) return [];
  try {
    const parsed = JSON.parse(decryptCredential(draft.payload));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return []; // مسودة تالفة أو مفتاح تشفير مختلف — نتجاهلها بدل الإعطال
  }
}

export async function saveDraftRows(rows: unknown[]): Promise<void> {
  const payload = encryptCredential(JSON.stringify(rows));
  const now = new Date();
  const existing = await prisma.credentialImportDraft.findFirst();
  if (existing) {
    await prisma.credentialImportDraft.update({ where: { id: existing.id }, data: { payload, updatedAt: now } });
  } else {
    await prisma.credentialImportDraft.create({ data: { payload, updatedAt: now } });
  }
}

export async function clearDraft(): Promise<void> {
  await prisma.credentialImportDraft.deleteMany();
}
