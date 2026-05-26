import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from '../services/organizations.service.js';

const router = Router();

router.use(requireAuth);

const orgBodySchema = z.object({
  name: z.string().optional(),
  number: z.string().optional(),
  expiredDate: z.string().date('expiredDate must be YYYY-MM-DD').optional(),
});

// ─── GET /api/organizations ──────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    res.json(await listOrganizations(search || undefined));
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/organizations/:id ──────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid organization id' }); return; }

  try {
    const org = await getOrganization(id);
    if (!org) { res.status(404).json({ error: 'Organization not found' }); return; }
    res.json(org);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/organizations ─────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = orgBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    res.status(201).json(await createOrganization(parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/organizations/:id ──────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid organization id' }); return; }

  const parsed = orgBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const existing = await getOrganization(id);
    if (!existing) { res.status(404).json({ error: 'Organization not found' }); return; }
    res.json(await updateOrganization(id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/organizations/:id ───────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid organization id' }); return; }

  try {
    const existing = await getOrganization(id);
    if (!existing) { res.status(404).json({ error: 'Organization not found' }); return; }
    await deleteOrganization(id);
    res.json({ message: 'Organization deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
