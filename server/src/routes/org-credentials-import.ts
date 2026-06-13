import express, { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireMalik } from '../middleware/auth.js';
import {
  buildImportPreview,
  commitCredentialsImport,
} from '../services/org-credentials-import.service.js';

// محمية بكلمة مرور لوحة malik (X-Malik-Token) بدل تسجيل دخول المستخدم.
const router = Router();
router.use(requireMalik);

// POST /api/org-credentials-import/parse — يستقبل ملف الإكسل كبيانات ثنائية خام
// (الوسيط العام express.json يتجاوزه لأن نوع المحتوى ليس JSON)
router.post(
  '/parse',
  express.raw({
    type: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/octet-stream',
      'application/vnd.ms-excel',
    ],
    limit: '20mb',
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        res.status(400).json({ error: 'لم يُرفع ملف، أو لم يُرسل بصيغة صحيحة' });
        return;
      }
      res.json(await buildImportPreview(body));
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/org-credentials-import/commit — يستقبل الصفوف بعد تعديل المستخدم ويُدخلها
const credPair = z.object({
  username: z.string().max(255),
  password: z.string().max(255),
});
const commitSchema = z.object({
  rows: z
    .array(
      z.object({
        organizationId: z.number().int().positive(),
        muqeem: credPair.nullable().optional(),
        chamber: credPair.extend({ city: z.string().max(32) }).nullable().optional(),
      }),
    )
    .min(1, 'لا توجد صفوف للإدخال'),
});

router.post('/commit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = commitSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }
    res.json(await commitCredentialsImport(parsed.data.rows));
  } catch (err) {
    next(err);
  }
});

export default router;
