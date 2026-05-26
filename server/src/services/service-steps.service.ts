import prisma from '../lib/prisma.js';

export type ServiceStepCreateInput = {
  name: string;
  number?: string;
  serviceId: number;
};

export type ServiceStepUpdateInput = {
  name?: string;
  number?: string;
};

export async function listServiceSteps(serviceId?: number) {
  return prisma.serviceStep.findMany({
    where: serviceId ? { serviceId } : {},
    orderBy: [{ serviceId: 'asc' }, { order: 'asc' }],
  });
}

export async function getServiceStep(id: number) {
  return prisma.serviceStep.findUnique({ where: { id } });
}

export async function createServiceStep(data: ServiceStepCreateInput) {
  const service = await prisma.service.findUnique({
    where: { id: data.serviceId },
    select: { name: true },
  });
  if (service?.name === 'نقل داخلي') {
    throw Object.assign(new Error('خدمة نقل داخلي لا تحتوي على خطوات'), { statusCode: 400 });
  }

  const last = await prisma.serviceStep.findFirst({
    where: { serviceId: data.serviceId },
    orderBy: { order: 'desc' },
    select: { order: true },
  });
  const nextOrder = (last?.order ?? 0) + 1;

  return prisma.serviceStep.create({
    data: {
      name: data.name,
      number: data.number,
      order: nextOrder,
      serviceId: data.serviceId,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateServiceStep(id: number, data: ServiceStepUpdateInput) {
  return prisma.serviceStep.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.number !== undefined && { number: data.number }),
      updatedAt: new Date(),
    },
  });
}

export async function moveServiceStep(id: number, direction: 'up' | 'down') {
  const step = await prisma.serviceStep.findUnique({ where: { id } });
  if (!step || step.serviceId === null || step.order === null) return null;

  const neighbor = await prisma.serviceStep.findFirst({
    where: {
      serviceId: step.serviceId,
      order: direction === 'up' ? { lt: step.order } : { gt: step.order },
    },
    orderBy: { order: direction === 'up' ? 'desc' : 'asc' },
  });

  if (!neighbor || neighbor.order === null) return null;

  await prisma.$transaction([
    prisma.serviceStep.update({ where: { id: step.id }, data: { order: neighbor.order } }),
    prisma.serviceStep.update({ where: { id: neighbor.id }, data: { order: step.order } }),
  ]);

  return prisma.serviceStep.findMany({
    where: { serviceId: step.serviceId },
    orderBy: { order: 'asc' },
  });
}

export async function deleteServiceStep(id: number) {
  return prisma.serviceStep.delete({ where: { id } });
}
