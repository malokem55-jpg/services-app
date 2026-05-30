import cron from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';

// runs every day at 8:00 AM
export function startPushCron() {
  cron.schedule('0 8 * * *', async () => {
    try {
      await runPushNotificationCheck();
    } catch (err) {
      console.error('Push cron error:', err);
    }
  });
}
