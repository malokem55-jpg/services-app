import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  getMonthlyPaymentAlerts,
  getCustomPaymentAlerts,
  getIqamaExpirySoonAlerts,
  getIqamaExpiryUrgentAlerts,
} from '../services/notifications.service.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const [monthlyPayments, customPayments, iqamaExpirySoon, iqamaExpired] = await Promise.all([
      getMonthlyPaymentAlerts(),
      getCustomPaymentAlerts(),
      getIqamaExpirySoonAlerts(),
      getIqamaExpiryUrgentAlerts(),
    ]);
    res.json({ monthlyPayments, customPayments, iqamaExpirySoon, iqamaExpired });
  } catch (err) {
    next(err);
  }
});

export default router;
