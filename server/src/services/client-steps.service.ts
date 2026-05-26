import prisma from '../lib/prisma.js';

export type ClientStepCreateInput = {
  clientId: number;
  stepId: number;
  stepDate?: string;
};

export async function listClientSteps(clientId: number) {
  return prisma.clientStep.findMany({
    where: { clientId },
    include: {
      step: { select: { id: true, name: true, order: true } },
    },
    orderBy: { stepDate: 'desc' },
  });
}

export async function getClientStep(id: number) {
  return prisma.clientStep.findUnique({ where: { id } });
}

export async function createClientStep(data: ClientStepCreateInput) {
  // Single transaction: insert the step and update last_step_id on the client.
  const [clientStep] = await prisma.$transaction([
    prisma.clientStep.create({
      data: {
        clientId: data.clientId,
        stepId: data.stepId,
        stepDate: data.stepDate ? new Date(data.stepDate) : new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      include: {
        step: { select: { id: true, name: true, order: true } },
      },
    }),
    prisma.client.update({
      where: { id: data.clientId },
      data: { lastStepId: data.stepId, updatedAt: new Date() },
    }),
  ]);

  return clientStep;
}

export async function deleteClientStep(id: number) {
  return prisma.clientStep.delete({ where: { id } });
}
