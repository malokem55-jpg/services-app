import prisma from '../lib/prisma.js';

const DEFAULT_HOUR = 15;
const DEFAULT_MINUTE = 47;

// مفاتيح التنبيهات الخمسة التي يمكن تشغيل/إيقاف إرسالها للهاتف
export interface PushChannels {
  pushMonthlyPayment: boolean;
  pushCustomPayment: boolean;
  pushIqamaSoon: boolean;
  pushIqamaExpired: boolean;
  pushTafweed: boolean;
}

export interface NotificationSettings extends PushChannels {
  hour: number;
  minute: number;
}

const DEFAULT_CHANNELS: PushChannels = {
  pushMonthlyPayment: true,
  pushCustomPayment: true,
  pushIqamaSoon: true,
  pushIqamaExpired: true,
  pushTafweed: true,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  const setting = await prisma.notificationSetting.findFirst();
  if (!setting) return { hour: DEFAULT_HOUR, minute: DEFAULT_MINUTE, ...DEFAULT_CHANNELS };
  return {
    hour: setting.cronHour,
    minute: setting.cronMinute,
    pushMonthlyPayment: setting.pushMonthlyPayment,
    pushCustomPayment: setting.pushCustomPayment,
    pushIqamaSoon: setting.pushIqamaSoon,
    pushIqamaExpired: setting.pushIqamaExpired,
    pushTafweed: setting.pushTafweed,
  };
}

export async function getNotificationSchedule(): Promise<{ hour: number; minute: number }> {
  const { hour, minute } = await getNotificationSettings();
  return { hour, minute };
}

export async function getPushChannels(): Promise<PushChannels> {
  const settings = await getNotificationSettings();
  return {
    pushMonthlyPayment: settings.pushMonthlyPayment,
    pushCustomPayment: settings.pushCustomPayment,
    pushIqamaSoon: settings.pushIqamaSoon,
    pushIqamaExpired: settings.pushIqamaExpired,
    pushTafweed: settings.pushTafweed,
  };
}

export async function updateNotificationSchedule(hour: number, minute: number): Promise<void> {
  await prisma.notificationSetting.upsert({
    where: { id: 1 },
    update: { cronHour: hour, cronMinute: minute },
    create: { id: 1, cronHour: hour, cronMinute: minute, ...DEFAULT_CHANNELS },
  });
}

export async function updatePushChannels(channels: Partial<PushChannels>): Promise<void> {
  await prisma.notificationSetting.upsert({
    where: { id: 1 },
    update: channels,
    create: {
      id: 1,
      cronHour: DEFAULT_HOUR,
      cronMinute: DEFAULT_MINUTE,
      ...DEFAULT_CHANNELS,
      ...channels,
    },
  });
}
