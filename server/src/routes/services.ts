import { Router, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import { listServices, getService } from '../services/services.service.js';

const router = Router();

router.use(requireAuth);

// ─── GET /api/services ───────────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listServices());
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/services/:id ───────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid service id' }); return; }

  try {
    const service = await getService(id);
    if (!service) { res.status(404).json({ error: 'Service not found' }); return; }
    res.json(service);
  } catch (err) {
    next(err);
  }
});

export default router;
