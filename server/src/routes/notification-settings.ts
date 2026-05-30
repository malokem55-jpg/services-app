import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getNotificationSchedule, updateNotificationSchedule } from '../services/notification-settings.service.js';
import { reschedulePushCron } from '../lib/push-cron.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const schedule = await getNotificationSchedule();
    res.json(schedule);
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

export default router;
