import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listClientSteps,
  getClientStep,
  createClientStep,
  deleteClientStep,
} from '../services/client-steps.service.js';

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  clientId: z.number().int().positive('clientId is required'),
  stepId: z.number().int().positive('stepId is required'),
  stepDate: z.string().date('stepDate must be YYYY-MM-DD').optional(),
});

// ─── GET /api/client-steps?clientId=x ───────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientId = parseId(String(req.query.clientId ?? ''));
  if (!clientId) {
    res.status(400).json({ error: 'clientId query param is required and must be a positive integer' });
    return;
  }

  try {
    res.json(await listClientSteps(clientId));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/client-steps ──────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    // createClientStep also updates clients.last_step_id in a transaction
    res.status(201).json(await createClientStep(parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/client-steps/:id ────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid client step id' }); return; }

  try {
    const existing = await getClientStep(id);
    if (!existing) { res.status(404).json({ error: 'Client step not found' }); return; }
    await deleteClientStep(id);
    res.json({ message: 'Client step deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
