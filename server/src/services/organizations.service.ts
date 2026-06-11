import prisma from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { TOTAL_MONTHS_PER_HIJRI_YEAR } from '../lib/card-types.js';
import { getLastGrantAt } from './card-issuances.service.js';

export type OrgCreateInput = {
  name?: string;
  number?: string;
  expiredDate?: string;
};

export async function listOrganizations(search?: string) {
  const where: Prisma.OrganizationWhereInput = search
    ? { name: { contains: search } }
    : {};

  const since = await getLastGrantAt();
  const [orgs, issuanceTotals] = await Promise.all([
    prisma.organization.findMany({
      where,
      select: {
        id: true,
        name: true,
        number: true,
        expiredDate: true,
        createdAt: true,
        _count: { select: { clients: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.cardIssuance.groupBy({
      by: ['organizationId'],
      where: { createdAt: { gt: since } },
      _sum: { months: true },
    }),
  ]);

  const usedByOrg = new Map(issuanceTotals.map((t) => [t.organizationId, t._sum.months ?? 0]));

  // الرصيد بالسنوات: المسحوبة = مجموع شهور الإصدارات منذ آخر منح ÷ 12
  return orgs.map((org) => {
    const usedMonths = usedByOrg.get(org.id) ?? 0;
    return {
      ...org,
      cardsWithdrawn: usedMonths / 12,
      cardsRemaining: (TOTAL_MONTHS_PER_HIJRI_YEAR - usedMonths) / 12,
    };
  });
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
