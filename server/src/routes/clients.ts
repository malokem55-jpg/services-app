import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listClients,
  getClient,
  createClient,
  updateClient,
  deleteClient,
} from '../services/clients.service.js';
import { runPushNotificationCheck } from '../services/push.service.js';

const router = Router();

router.use(requireAuth);

// ─── Zod schemas ────────────────────────────────────────────────────────────

const clientBodySchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  passport: z.string().optional(),
  boardNumber: z.string().optional(),
  visaNumber: z.string().optional(),
  iqamaNumber: z.string().optional(),
  iqamaEndDate: z.string().date('iqamaEndDate must be YYYY-MM-DD').optional(),
  cardType: z.string().optional(),
  notes: z.string().optional(),
  paymentType: z.string().optional(),
  nextPaymentDate: z.string().date('nextPaymentDate must be YYYY-MM-DD').optional(),
  amount: z.number().nonnegative().optional(),
  // عميل شهري: يوم الاستلام من كل شهر (1-31) — حقل مستقل عن رقم الحدود
  monthlyReceiptDay: z.number().int().min(1).max(31).optional(),
  receivedAmount: z.number().nonnegative().optional(),
  // عميل شهري: استمرار توليد الدفعيات حتى بعد انتهاء الإقامة
  generateMonthlyAfterIqama: z.boolean().optional(),
  // تاريخ تنبيه التفويض والتصديق (تحت الإجراء) — null يمسح التنبيه نهائياً
  tafweedAlertDate: z.string().date('tafweedAlertDate must be YYYY-MM-DD').nullable().optional(),
  // علامة "تم التفويض" — true تخفي التنبيه من الجرس مع إبقاء التاريخ محفوظاً
  tafweedDone: z.boolean().optional(),
  serviceId: z.number().int().positive().optional(),
  organizationId: z.number().int().positive().optional(),
  lastStepId: z.number().int().positive().optional(),
  // جهة القدوم اختيارية — null تمسحها عند التعديل
  arrivalPlaceId: z.number().int().positive().nullable().optional(),
});

// ─── GET /api/clients ────────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : undefined;
    const orgId = typeof req.query.organizationId === 'string' ? parseInt(req.query.organizationId, 10) : undefined;
    const organizationId = orgId && !isNaN(orgId) ? orgId : undefined;
    const clients = await listClients(search || undefined, organizationId);
    res.json(clients);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/clients/:id ────────────────────────────────────────────────────

router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid client id' });
    return;
  }

  try {
    const client = await getClient(id);
    if (!client) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }
    res.json(client);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/clients ───────────────────────────────────────────────────────

router.post('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const parsed = clientBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const client = await createClient(parsed.data);
    res.status(201).json(client);

    if (parsed.data.iqamaEndDate !== undefined) {
      runPushNotificationCheck().catch((err) =>
        console.error('[push] background check failed after client create:', err),
      );
    }
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/clients/:id ────────────────────────────────────────────────────

router.put('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid client id' });
    return;
  }

  const parsed = clientBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const existing = await getClient(id);
    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    const client = await updateClient(id, parsed.data);
    res.json(client);

    // Trigger push check in background if iqama-related fields changed
    if (parsed.data.iqamaEndDate !== undefined || parsed.data.iqamaNumber !== undefined) {
      runPushNotificationCheck().catch((err) =>
        console.error('[push] background check failed after client update:', err),
      );
    }
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/clients/:id ─────────────────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid client id' });
    return;
  }

  try {
    const existing = await getClient(id);
    if (!existing) {
      res.status(404).json({ error: 'Client not found' });
      return;
    }

    await deleteClient(id);
    res.json({ message: 'Client deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
