import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { PLATFORM_KEYS } from '../services/login-platforms.service.js';
import { getFillKey, armFill, consumePendingFill } from '../services/mobile-fill.service.js';

const router = Router();

// ─── GET /api/mobile-fill/pending?key=... ────────────────────────────────────
// يستدعيه الـ Bookmarklet من داخل صفحة مقيم في Safari — بلا JWT، التحقق بالمفتاح.
// قبل requireAuth عمداً.

router.get('/pending', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    const creds = key ? await consumePendingFill(key) : null;
    if (!creds) {
      res.status(404).json({ error: 'لا توجد بيانات دخول جاهزة — افتح المنصة من التطبيق أولاً' });
      return;
    }
    res.json(creds);
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth);

// ─── GET /api/mobile-fill/key ────────────────────────────────────────────────
// تستخدمه صفحة الإعدادات لتوليد رابط الـ Bookmarklet

router.get('/key', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json({ key: await getFillKey() });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/mobile-fill/arm ───────────────────────────────────────────────
// يستدعيه التطبيق المخصص قبل فتح موقع المنصة

const armSchema = z.object({
  organizationId: z.number().int().positive(),
  platform: z.enum(PLATFORM_KEYS),
});

router.post('/arm', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const body = armSchema.parse(req.body);
    await armFill(body.organizationId, body.platform);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
