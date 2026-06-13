import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getNotificationSettings,
  updateNotificationSchedule,
  updatePushChannels,
} from '../services/notification-settings.service.js';
import { reschedulePushCron } from '../lib/push-cron.js';
import { runPushNotificationCheck } from '../services/push.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await getNotificationSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  hour: z.number().int().min(0).max(23),
  minute: z.number().int().min(0).max(59),
});

router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { hour, minute } = updateSchema.parse(req.body);
    await updateNotificationSchedule(hour, minute);
    reschedulePushCron(hour, minute);
    res.json({ ok: true, hour, minute });
  } catch (err) {
    next(err);
  }
});

// تحديد أي التنبيهات الخمسة تُرسَل كإشعار للهاتف
const channelsSchema = z
  .object({
    pushMonthlyPayment: z.boolean(),
    pushCustomPayment: z.boolean(),
    pushIqamaSoon: z.boolean(),
    pushIqamaExpired: z.boolean(),
    pushTafweed: z.boolean(),
  })
  .partial();

router.put('/channels', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const channels = channelsSchema.parse(req.body);
    await updatePushChannels(channels);
    const settings = await getNotificationSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// إرسال جميع التنبيهات المختارة فوراً حتى لو كانت مُرسَلة من قبل
router.post('/send-now', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await runPushNotificationCheck({ force: true });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
