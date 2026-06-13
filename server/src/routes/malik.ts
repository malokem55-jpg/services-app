import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import jwt from 'jsonwebtoken';
import { requireMalik, hasValidMalikToken } from '../middleware/auth.js';
import {
  hasMalikPassword,
  setMalikPassword,
  verifyMalikPassword,
} from '../services/malik.service.js';

// كلمة مرور واحدة للوحة /malik: إنشاء عند أول دخول، إدخال للفتح، وتغيير من الداخل.
const router = Router();

// رمز اللوحة: JWT بحمولة { malik: true } صالح 30 يومًا
function issueMalikToken(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return jwt.sign({ malik: true }, secret, { expiresIn: '30d' });
}

const passwordSchema = z.object({
  password: z.string().min(4, 'كلمة المرور قصيرة جدًا (4 أحرف على الأقل)').max(128),
});

// GET /api/malik/status — هل أُنشئت كلمة مرور؟ وهل الطلب الحالي مفتوح برمز صالح؟
router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ hasPassword: await hasMalikPassword(), unlocked: hasValidMalikToken(req) });
  } catch (err) {
    next(err);
  }
});

// POST /api/malik/setup — إنشاء كلمة المرور لأول مرة فقط (لا يوجد واحدة بعد)
router.post('/setup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (await hasMalikPassword()) {
      res.status(409).json({ error: 'توجد كلمة مرور بالفعل، استخدم الدخول' });
      return;
    }
    const { password } = passwordSchema.parse(req.body);
    await setMalikPassword(password);
    res.json({ token: issueMalikToken() });
  } catch (err) {
    next(err);
  }
});

// POST /api/malik/unlock — التحقق من كلمة المرور وإصدار رمز
router.post('/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = passwordSchema.parse(req.body);
    if (!(await verifyMalikPassword(password))) {
      res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
      return;
    }
    res.json({ token: issueMalikToken() });
  } catch (err) {
    next(err);
  }
});

// PUT /api/malik/password — تغيير كلمة المرور (من داخل اللوحة) ثم إعادة إصدار رمز
router.put('/password', requireMalik, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { password } = passwordSchema.parse(req.body);
    await setMalikPassword(password);
    res.json({ token: issueMalikToken() });
  } catch (err) {
    next(err);
  }
});

export default router;
