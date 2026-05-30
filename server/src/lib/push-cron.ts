import cron from 'node-cron';
import { runPushNotificationCheck } from '../services/push.service.js';

// runs every day at 3:40 PM
export function startPushCron() {
  cron.schedule('40 15 * * *', async () => {
    try {
      await runPushNotificationCheck();
    } catch (err) {
      console.error('Push cron error:', err);
    }
  });
}
