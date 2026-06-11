import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  createIssuance,
  updateIssuance,
  deleteIssuance,
  listClientIssuances,
  listOrganizationIssuances,
  grantNewCards,
} from '../services/card-issuances.service.js';

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  clientId: z.number().int().positive(),
  cardType: z.string().min(1),
  issuedAt: z.string().date('issuedAt must be YYYY-MM-DD').optional(),
});

const updateSchema = z.object({
  cardType: z.string().min(1).optional(),
  issuedAt: z.string().date('issuedAt must be YYYY-MM-DD').optional(),
});

// ─── GET /api/card-issuances?clientId=X | ?organizationId=Y ─────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientId = typeof req.query.clientId === 'string' ? parseId(req.query.clientId) : undefined;
  const organizationId =
    typeof req.query.organizationId === 'string' ? parseId(req.query.organizationId) : undefined;

  if (!clientId && !organizationId) {
    res.status(400).json({ error: 'clientId or organizationId query param is required' });
    return;
  }

  try {
    if (organizationId) {
      res.json(await listOrganizationIssuances(organizationId));
      return;
    }
    res.json(await listClientIssuances(clientId as number));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/card-issuances/grant ──────────────────────────────────────────
// منح كل المؤسسات رصيد 4 كروت جديدًا الآن — لا يغيّر أي تاريخ أو سجل قائم

router.post('/grant', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    res.status(201).json({ lastGrantAt: await grantNewCards() });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/card-issuances ────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const issuance = await createIssuance(parsed.data.clientId, parsed.data.cardType, parsed.data.issuedAt);
    res.status(201).json(issuance);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/card-issuances/:id ─────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid issuance id' }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const updated = await updateIssuance(id, parsed.data);
    if (!updated) { res.status(404).json({ error: 'Issuance not found' }); return; }
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/card-issuances/:id ──────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid issuance id' }); return; }

  try {
    const deleted = await deleteIssuance(id);
    if (!deleted) { res.status(404).json({ error: 'Issuance not found' }); return; }
    res.json({ message: 'Issuance deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
