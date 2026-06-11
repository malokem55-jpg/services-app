import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listArrivalPlaces,
  createArrivalPlace,
  updateArrivalPlace,
  deleteArrivalPlace,
} from '../services/arrival-places.service.js';

const router = Router();

router.use(requireAuth);

const bodySchema = z.object({
  name: z.string().trim().min(1, 'اسم الجهة مطلوب'),
});

// ─── GET /api/arrival-places ─────────────────────────────────────────────────

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.json(await listArrivalPlaces());
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/arrival-places ────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const place = await createArrivalPlace(parsed.data.name);
    res.status(201).json(place);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/arrival-places/:id ─────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid arrival place id' }); return; }

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const updated = await updateArrivalPlace(id, parsed.data.name);
    if (!updated) { res.status(404).json({ error: 'Arrival place not found' }); return; }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/arrival-places/:id ──────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid arrival place id' }); return; }

  try {
    const deleted = await deleteArrivalPlace(id);
    if (!deleted) { res.status(404).json({ error: 'Arrival place not found' }); return; }
    res.json({ message: 'Arrival place deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
