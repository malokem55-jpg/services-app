import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getUiSettings, updateUiSettings } from '../services/ui-settings.service.js';

const router = Router();

// نقطة عامة بلا مصادقة: تُرجع فقط ما إذا كان فتح الموقع على الهاتف مسموحًا،
// حتى تستطيع الواجهة حجب الجوال قبل عرض شاشة الدخول أصلاً.
router.get('/mobile-access', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await getUiSettings();
    res.json({ runOnMobile: settings.runOnMobile });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const settings = await getUiSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

const updateSchema = z
  .object({
    showBellCustomPayments: z.boolean(),
    showBellMonthlyPayments: z.boolean(),
    showBellIqamaSoon: z.boolean(),
    showBellIqamaExpired: z.boolean(),
    showUnderProcedurePage: z.boolean(),
    showDeletedDuesPage: z.boolean(),
    showIqamaAlertsPage: z.boolean(),
    showCustomMobileVersion: z.boolean(),
    runOnMobile: z.boolean(),
  })
  .partial();

router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const patch = updateSchema.parse(req.body);
    const settings = await updateUiSettings(patch);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
