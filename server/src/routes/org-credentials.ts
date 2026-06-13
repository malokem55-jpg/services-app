import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, requireAuthOrMalik, AuthRequest } from '../middleware/auth.js';
import { PLATFORM_KEYS } from '../services/login-platforms.service.js';
import { CHAMBER_CITY_KEYS } from '../services/chamber-cities.service.js';
import {
  listCredentialSummaries,
  listMuqeemFillList,
  getCredential,
  upsertCredential,
  deleteCredential,
} from '../services/org-credentials.service.js';

const router = Router();

const paramsSchema = z.object({
  orgId: z.coerce.number().int().positive(),
  platform: z.enum(PLATFORM_KEYS),
});

// ملخصات بيانات الدخول (بدون كلمات مرور): تقبل تسجيل دخول المستخدم أو كلمة مرور لوحة malik
// لمعرفة المؤسسات التي لديها بيانات محفوظة قبل الاستيراد.
router.get('/', requireAuthOrMalik, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listCredentialSummaries());
  } catch (err) {
    next(err);
  }
});

// بقية المسارات تتطلب تسجيل الدخول (تكشف كلمات المرور أو تعدّلها)
router.use(requireAuth);

// كل بيانات مقيم دفعة واحدة لبناء «الزر الموحّد» (مسار مفرد المقطع فلا يصطدم بـ /:orgId/:platform)
router.get('/muqeem-fill-list', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listMuqeemFillList());
  } catch (err) {
    next(err);
  }
});

// يعيد كلمة المرور مفكوكة — تستخدمه نافذة التعديل وزر فتح صفحة الدخول
router.get('/:orgId/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, platform } = paramsSchema.parse(req.params);
    const cred = await getCredential(orgId, platform);
    if (!cred) {
      res.status(404).json({ error: 'لا توجد بيانات دخول مسجلة لهذه المنصة' });
      return;
    }
    res.json(cred);
  } catch (err) {
    next(err);
  }
});

const bodySchema = z.object({
  username: z.string().min(1, 'اسم المستخدم مطلوب').max(255),
  password: z.string().min(1, 'كلمة المرور مطلوبة').max(255),
  city: z.enum(CHAMBER_CITY_KEYS).optional(),
});

router.put('/:orgId/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, platform } = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);
    // المدينة إجبارية للغرفة: لا تُحفظ بيانات دخول دون اختيار مدينة
    if (platform === 'chamber' && !body.city) {
      res.status(400).json({ error: 'يجب اختيار المدينة' });
      return;
    }
    const result = await upsertCredential(orgId, platform, body);
    res.json({ organizationId: orgId, platform, ...result });
  } catch (err) {
    next(err);
  }
});

router.delete('/:orgId/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, platform } = paramsSchema.parse(req.params);
    await deleteCredential(orgId, platform);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
