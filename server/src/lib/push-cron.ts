import cron from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';

// runs every day at 3:47 PM
export function startPushCron() {
  cron.schedule('47 15 * * *', async () => {
    try {
      await runPushNotificationCheck();
    } catch (err) {
      console.error('Push cron error:', err);
    }
  });
}
