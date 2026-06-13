import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { getDraftRows, saveDraftRows, clearDraft } from '../services/credential-import-draft.service.js';

const router = Router();
router.use(requireAuth);

// شكل صف المسودة مطابق لحالة الصف في الواجهة (EditRow)
const rowSchema = z.object({
  key: z.string(),
  rowNumber: z.number(),
  orgNameRaw: z.string(),
  orgId: z.number().int().nullable(),
  muqeemUser: z.string(),
  muqeemPass: z.string(),
  chamberUser: z.string(),
  chamberPass: z.string(),
  city: z.string(),
  includePartial: z.boolean(),
});
const bodySchema = z.object({ rows: z.array(rowSchema) });

// GET /api/credential-import-draft — الصفوف المحفوظة (أو مصفوفة فارغة)
router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ rows: await getDraftRows() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/credential-import-draft — حفظ/استبدال المسودة
router.put('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    await saveDraftRows(parsed.data.rows);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/credential-import-draft — حذف المسودة
router.delete('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await clearDraft();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
