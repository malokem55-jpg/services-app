import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth.js';
import clientsRouter from './routes/clients.js';
import servicesRouter from './routes/services.js';
import organizationsRouter from './routes/organizations.js';
import serviceStepsRouter from './routes/service-steps.js';
import clientStepsRouter from './routes/client-steps.js';
import clientPaymentsRouter from './routes/client-payments.js';
import clientPaymentMonthliesRouter from './routes/client-payment-monthlies.js';
import statsRouter from './routes/stats.js';
import notificationsRouter from './routes/notifications.js';
import pushSubscriptionsRouter from './routes/push-subscriptions.js';
import notificationSettingsRouter from './routes/notification-settings.js';
import { errorHandler } from './middleware/errorHandler.js';
import { startPushCron } from './lib/push-cron.js';

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/services', servicesRouter);
app.use('/api/organizations', organizationsRouter);
app.use('/api/service-steps', serviceStepsRouter);
app.use('/api/client-steps', clientStepsRouter);
app.use('/api/client-payments', clientPaymentsRouter);
app.use('/api/client-payment-monthlies', clientPaymentMonthliesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/push/subscribe', pushSubscriptionsRouter);
app.use('/api/notification-settings', notificationSettingsRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  startPushCron();
});
