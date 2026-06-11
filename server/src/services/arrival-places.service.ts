import prisma from '../lib/prisma.js';

export async function listArrivalPlaces() {
  return prisma.arrivalPlace.findMany({ orderBy: { name: 'asc' } });
}

export async function createArrivalPlace(name: string) {
  return prisma.arrivalPlace.create({
    data: { name, createdAt: new Date(), updatedAt: new Date() },
  });
}

export async function updateArrivalPlace(id: number, name: string) {
  const existing = await prisma.arrivalPlace.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.arrivalPlace.update({
    where: { id },
    data: { name, updatedAt: new Date() },
  });
}

// الحذف لا يمس العملاء المرتبطين — حقل جهة القدوم عندهم يصبح فارغاً (SetNull)
export async function deleteArrivalPlace(id: number) {
  const existing = await prisma.arrivalPlace.findUnique({ where: { id } });
  if (!existing) return null;
  return prisma.arrivalPlace.delete({ where: { id } });
}
