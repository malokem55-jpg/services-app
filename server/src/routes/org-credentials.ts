import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { PLATFORM_KEYS } from '../services/login-platforms.service.js';
import {
  listCredentialSummaries,
  getCredential,
  upsertCredential,
  deleteCredential,
} from '../services/org-credentials.service.js';

const router = Router();
router.use(requireAuth);

const paramsSchema = z.object({
  orgId: z.coerce.number().int().positive(),
  platform: z.enum(PLATFORM_KEYS),
});

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listCredentialSummaries());
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
});

router.put('/:orgId/:platform', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { orgId, platform } = paramsSchema.parse(req.params);
    const body = bodySchema.parse(req.body);
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
