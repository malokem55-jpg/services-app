import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listClientPaymentMonthlies,
  getClientPaymentMonthly,
  createClientPaymentMonthly,
  updateClientPaymentMonthly,
  deleteClientPaymentMonthly,
  payClientPaymentMonthly,
} from '../services/client-payment-monthlies.service.js';

const router = Router();

router.use(requireAuth);

const createSchema = z.object({
  clientId: z.number().int().positive('clientId is required'),
  iqamaEndDate: z.string().date('iqamaEndDate must be YYYY-MM-DD').optional(),
  month: z.string().optional(),
  receivedDate: z.string().date('receivedDate must be YYYY-MM-DD').optional(),
  amount: z.number().nonnegative().optional(),
  receivedAmount: z.number().nonnegative().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  iqamaEndDate: z.string().date('iqamaEndDate must be YYYY-MM-DD').optional(),
  month: z.string().optional(),
  receivedDate: z.string().date('receivedDate must be YYYY-MM-DD').optional(),
  amount: z.number().nonnegative().optional(),
  receivedAmount: z.number().nonnegative().optional(),
  status: z.string().optional(),
  notes: z.string().optional(),
});

const paySchema = z.object({
  receivedAmount: z.number().positive('المبلغ المستلم مطلوب'),
  notes: z.string().optional(),
});

// ─── GET /api/client-payment-monthlies?clientId=x ───────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const clientId = parseId(String(req.query.clientId ?? ''));
  if (!clientId) {
    res.status(400).json({ error: 'clientId query param is required and must be a positive integer' });
    return;
  }

  try {
    res.json(await listClientPaymentMonthlies(clientId));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/client-payment-monthlies ─────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    res.status(201).json(await createClientPaymentMonthly(parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/client-payment-monthlies/:id ───────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid monthly payment id' }); return; }

  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const existing = await getClientPaymentMonthly(id);
    if (!existing) { res.status(404).json({ error: 'Monthly payment not found' }); return; }
    const effectiveAmount = parsed.data.amount ?? existing.amount ?? 0;
    if (parsed.data.receivedAmount !== undefined && parsed.data.receivedAmount > effectiveAmount) {
      res.status(400).json({ error: 'لا يمكن إدخال مبلغ أكبر من مبلغ الدفعية' });
      return;
    }
    res.json(await updateClientPaymentMonthly(id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/client-payment-monthlies/:id/pay ──────────────────────────────
// تسديد دفعية شهرية مع ترحيل الفرق (إن وجد) للدفعية القادمة

router.post('/:id/pay', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid monthly payment id' }); return; }

  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.errors[0].message }); return; }

  try {
    const existing = await getClientPaymentMonthly(id);
    if (!existing) { res.status(404).json({ error: 'Monthly payment not found' }); return; }
    if (existing.status === 'paid') { res.status(400).json({ error: 'هذه الدفعية مسدّدة بالفعل' }); return; }
    if (parsed.data.receivedAmount > (existing.amount ?? 0)) {
      res.status(400).json({ error: 'لا يمكن إدخال مبلغ أكبر من مبلغ الدفعية' });
      return;
    }
    res.json(await payClientPaymentMonthly(id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/client-payment-monthlies/:id ────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) { res.status(400).json({ error: 'Invalid monthly payment id' }); return; }

  try {
    const existing = await getClientPaymentMonthly(id);
    if (!existing) { res.status(404).json({ error: 'Monthly payment not found' }); return; }
    await deleteClientPaymentMonthly(id);
    res.json({ message: 'Monthly payment deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
