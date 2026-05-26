import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getMonthlyPaymentAlerts,
  getIqamaExpirySoonAlerts,
  getIqamaExpiryUrgentAlerts,
} from '../services/notifications.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [monthlyPayments, iqamaExpirySoon, iqamaExpired] = await Promise.all([
      getMonthlyPaymentAlerts(),
      getIqamaExpirySoonAlerts(),
      getIqamaExpiryUrgentAlerts(),
    ]);
    res.json({ monthlyPayments, iqamaExpirySoon, iqamaExpired });
  } catch (err) {
    next(err);
  }
});

export default router;
