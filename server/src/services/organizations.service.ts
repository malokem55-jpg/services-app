import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';

export type OrgCreateInput = {
  name?: string;
  number?: string;
  expiredDate?: string;
};

const CARD_VALUES: Record<string, number> = {
  'بدون': 0,
  '3 شهور': 0.25,
  '6 شهور': 0.50,
  '9 شهور': 0.75,
  'سنة': 1,
  'سنة و 3 شهور': 1.25,
  'سنة و 6 شهور': 1.50,
  'سنة و 9 شهور': 1.75,
  'سنتين': 2,
};

export async function listOrganizations(search?: string) {
  const where: Prisma.OrganizationWhereInput = search
    ? { name: { contains: search } }
    : {};

  const orgs = await prisma.organization.findMany({
    where,
    select: {
      id: true,
      name: true,
      number: true,
      expiredDate: true,
      createdAt: true,
      _count: { select: { clients: true } },
      clients: { select: { cardType: true } },
    },
    orderBy: { name: 'asc' },
  });

  return orgs.map(({ clients, ...org }) => ({
    ...org,
    cardTotal: clients.reduce(
      (sum, c) => sum + (CARD_VALUES[c.cardType ?? 'بدون'] ?? 0),
      0
    ),
  }));
}

export async function getOrganization(id: number) {
  return prisma.organization.findUnique({ where: { id } });
}

export async function createOrganization(data: OrgCreateInput) {
  return prisma.organization.create({
    data: {
      name: data.name,
      number: data.number,
      expiredDate: data.expiredDate ? new Date(data.expiredDate) : undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function updateOrganization(id: number, data: OrgCreateInput) {
  return prisma.organization.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.number !== undefined && { number: data.number }),
      ...(data.expiredDate !== undefined && {
        expiredDate: data.expiredDate ? new Date(data.expiredDate) : null,
      }),
      updatedAt: new Date(),
    },
  });
}

export async function deleteOrganization(id: number) {
  return prisma.organization.delete({ where: { id } });
}
