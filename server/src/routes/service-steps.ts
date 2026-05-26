import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listServiceSteps,
  getServiceStep,
  createServiceStep,
  updateServiceStep,
  moveServiceStep,
  deleteServiceStep,
} from '../services/service-steps.service.js';

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  name: z.string().min(1, 'name is required'),
  number: z.string().optional(),
  serviceId: z.number().int().positive('serviceId is required'),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  number: z.string().optional(),
});

// ─── GET /api/service-steps?serviceId=x ─────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const raw = req.query.serviceId;
  if (raw !== undefined) {
    const serviceId = parseId(String(raw));
    if (!serviceId) {
      res.status(400).json({ error: 'serviceId must be a positive integer' });
      return;
    }
    try {
      res.json(await listServiceSteps(serviceId));
    } catch (err) {
      next(err);
    }
    return;
  }

  try {
    res.json(await listServiceSteps());
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/service-steps ─────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    res.status(201).json(await createServiceStep(parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/service-steps/:id ──────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid service step id' }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const existing = await getServiceStep(id);
    if (!existing) { res.status(404).json({ error: 'Service step not found' }); return; }
    res.json(await updateServiceStep(id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/service-steps/:id/move ──────────────────────────────────────

router.patch('/:id/move', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid service step id' }); return; }

  const parsed = z.object({ direction: z.enum(['up', 'down']) }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'direction must be "up" or "down"' }); return; }

  try {
    const result = await moveServiceStep(id, parsed.data.direction);
    if (!result) { res.status(404).json({ error: 'Step not found or already at boundary' }); return; }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/service-steps/:id ───────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid service step id' }); return; }

  try {
    const existing = await getServiceStep(id);
    if (!existing) { res.status(404).json({ error: 'Service step not found' }); return; }
    await deleteServiceStep(id);
    res.json({ message: 'Service step deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
