import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { listLoginPlatforms, updateLoginPlatform, PLATFORM_KEYS } from '../services/login-platforms.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const platforms = await listLoginPlatforms();
    res.json(platforms.map(({ key, enabled, loginUrl }) => ({ key, enabled, loginUrl })));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z
  .object({
    enabled: z.boolean(),
    loginUrl: z.string().max(500),
  })
  .partial();

router.put('/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = z.enum(PLATFORM_KEYS).parse(req.params.key);
    const patch = updateSchema.parse(req.body);
    const updated = await updateLoginPlatform(key, patch);
    res.json({ key: updated.key, enabled: updated.enabled, loginUrl: updated.loginUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
