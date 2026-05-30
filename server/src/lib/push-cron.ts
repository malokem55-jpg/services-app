import cron, { ScheduledTask } from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';
import { getNotificationSchedule } from '../services/notification-settings.service.js';

let currentTask: ScheduledTask | null = null;

function buildCronExpression(hour: number, minute: number): string {
  return `${minute} ${hour} * * *`;
}

export function reschedulePushCron(hour: number, minute: number) {
  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }
  currentTask = cron.schedule(buildCronExpression(hour, minute), async () => {
    try {
      await runPushNotificationCheck();
    } catch (err) {
      console.error('Push cron error:', err);
    }
  });
}

export async function startPushCron() {
  const { hour, minute } = await getNotificationSchedule();
  reschedulePushCron(hour, minute);
}
