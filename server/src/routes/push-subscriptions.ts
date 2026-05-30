import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { saveSubscription, deleteSubscription } from '../services/push.service.js';

const router = Router();

router.use(requireAuth);

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = subscribeSchema.parse(req.body);
    await saveSubscription(data);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = z.object({ endpoint: z.string() }).parse(req.body);
    await deleteSubscription(endpoint);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
