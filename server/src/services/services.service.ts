import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

const serviceWithSteps = {
  steps: { orderBy: { order: 'asc' as const } },
} satisfies Prisma.ServiceInclude;

export type ServiceCreateInput = {
  name?: string;
};

export async function listServices() {
  return prisma.service.findMany({
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { steps: true, clients: true } },
    },
    orderBy: { name: 'asc' },
  });
}

export async function getService(id: number) {
  return prisma.service.findUnique({ where: { id }, include: serviceWithSteps });
}

export async function createService(data: ServiceCreateInput) {
  return prisma.service.create({
    data: {
      name: data.name,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: serviceWithSteps,
  });
}

export async function updateService(id: number, data: ServiceCreateInput) {
  return prisma.service.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      updatedAt: new Date(),
    },
    include: serviceWithSteps,
  });
}

export async function deleteService(id: number) {
  return prisma.service.delete({ where: { id } });
}
