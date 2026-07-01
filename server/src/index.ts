import 'dotenv/config';
import app from './app.js';
import { startPushCron } from './lib/push-cron.js';
import { startMonthlyRollingCron } from './lib/monthly-cron.js';

// Local Node entry point. On Cloudflare Workers the entry is src/worker.ts,
// where scheduling is handled by Cron Triggers instead of node-cron.
const port = Number(process.env.PORT ?? 3000);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startPushCron();
  startMonthlyRollingCron();
});
