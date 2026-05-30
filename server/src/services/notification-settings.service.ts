import prisma from '../lib/prisma.js';

const DEFAULT_HOUR = 15;
const DEFAULT_MINUTE = 47;

export async function getNotificationSchedule(): Promise<{ hour: number; minute: number }> {
  const setting = await prisma.notificationSetting.findFirst();
  if (!setting) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE };
  return { hour: setting.cronHour, minute: setting.cronMinute };
}

export async function updateNotificationSchedule(hour: number, minute: number): Promise<void> {
  await prisma.notificationSetting.upsert({
    where: { id: 1 },
    update: { cronHour: hour, cronMinute: minute },
    create: { id: 1, cronHour: hour, cronMinute: minute },
  });
}
