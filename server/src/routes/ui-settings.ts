import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getUiSettings, updateUiSettings } from '../services/ui-settings.service.js';

const router = Router();
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
