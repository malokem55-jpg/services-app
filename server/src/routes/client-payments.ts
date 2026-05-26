import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listClientPayments,
  getClientPayment,
  createClientPayment,
  updateClientPayment,
  deleteClientPayment,
} from '../services/client-payments.service.js';

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  clientId: z.number().int().positive('clientId is required'),
  amount: z.number().nonnegative().optional(),
  nextPaymentDate: z.string().date('nextPaymentDate must be YYYY-MM-DD').optional(),
  isDone: z.boolean().optional(),
  lastPayment: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  amount: z.number().nonnegative().optional(),
  nextPaymentDate: z.string().date('nextPaymentDate must be YYYY-MM-DD').optional(),
  isDone: z.boolean().optional(),
  lastPayment: z.boolean().optional(),
  notes: z.string().optional(),
});

// ─── GET /api/client-payments?clientId=x ────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientId = parseId(String(req.query.clientId ?? ''));
  if (!clientId) {
    res.status(400).json({ error: 'clientId query param is required and must be a positive integer' });
    return;
  }

  try {
    res.json(await listClientPayments(clientId));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/client-payments ───────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    res.status(201).json(await createClientPayment(parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/client-payments/:id ────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid payment id' }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const existing = await getClientPayment(id);
    if (!existing) { res.status(404).json({ error: 'Payment not found' }); return; }
    res.json(await updateClientPayment(id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/client-payments/:id ─────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid payment id' }); return; }

  try {
    const existing = await getClientPayment(id);
    if (!existing) { res.status(404).json({ error: 'Payment not found' }); return; }
    await deleteClientPayment(id);
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
