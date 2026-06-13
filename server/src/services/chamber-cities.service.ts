import prisma from '../lib/prisma.js';

// مدن الغرفة التجارية الثابتة — رابط دخول قابل للتعديل لكل مدينة
export const CHAMBER_CITY_KEYS = ['riyadh', 'najran', 'onaizah'] as const;
export type ChamberCityKey = (typeof CHAMBER_CITY_KEYS)[number];

// يضمن وجود صف لكل مدينة (برابط فارغ) ثم يعيد الكل مرتبة
export async function listChamberCities() {
  const existing = await prisma.chamberCity.findMany();
  const missing = CHAMBER_CITY_KEYS.filter((key) => !existing.some((c) => c.key === key));
  if (missing.length > 0) {
    await prisma.chamberCity.createMany({
      data: missing.map((key) => ({ key, loginUrl: '' })),
    });
    return prisma.chamberCity.findMany({ orderBy: { id: 'asc' } });
  }
  return existing.sort((a, b) => a.id - b.id);
}

export async function updateChamberCity(key: ChamberCityKey, patch: { loginUrl?: string }) {
  await listChamberCities(); // يضمن وجود الصف قبل التحديث
  return prisma.chamberCity.update({ where: { key }, data: patch });
}
