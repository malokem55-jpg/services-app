import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { parseId } from '../lib/parseId.js';
import {
  listDeletedClientDues,
  getDeletedClientDue,
  addCollection,
  updateCollection,
  removeCollection,
  updateDueNotes,
  deleteDeletedClientDue,
} from '../services/deleted-client-dues.service.js';

const router = Router();

router.use(requireAuth);

const collectionBodySchema = z.object({
  amount: z.number().positive('مبلغ التحصيل يجب أن يكون أكبر من صفر'),
  notes: z.string().optional(),
  date: z.string().date('date must be YYYY-MM-DD').optional(),
});

const notesBodySchema = z.object({
  notes: z.string(),
});

const collectionUpdateSchema = z.object({
  amount: z.number().positive('مبلغ التحصيل يجب أن يكون أكبر من صفر'),
  date: z.string().date('date must be YYYY-MM-DD'),
  notes: z.string().optional(),
});

// موقع التحصيلة داخل القائمة — يبدأ من صفر بعكس المعرّفات
function parseIndex(value: string): number | null {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ─── GET /api/deleted-client-dues ────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const dues = await listDeletedClientDues(status);
    res.json(dues);
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/deleted-client-dues/:id/collections ───────────────────────────

router.post('/:id/collections', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid due id' });
    return;
  }

  const parsed = collectionBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const due = await addCollection(id, parsed.data.amount, parsed.data.notes, parsed.data.date);
    if (!due) {
      res.status(404).json({ error: 'Due record not found' });
      return;
    }
    res.json(due);
  } catch (err) {
    next(err);
  }
});

// ─── PUT /api/deleted-client-dues/:id/collections/:index ────────────────────

router.put('/:id/collections/:index', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  const index = parseIndex(req.params['index'] as string);
  if (!id || index === null) {
    res.status(400).json({ error: 'Invalid id or index' });
    return;
  }

  const parsed = collectionUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const due = await updateCollection(id, index, parsed.data);
    if (!due) {
      res.status(404).json({ error: 'Due record not found' });
      return;
    }
    res.json(due);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/deleted-client-dues/:id/collections/:index ─────────────────

router.delete('/:id/collections/:index', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  const index = parseIndex(req.params['index'] as string);
  if (!id || index === null) {
    res.status(400).json({ error: 'Invalid id or index' });
    return;
  }

  try {
    const due = await removeCollection(id, index);
    if (!due) {
      res.status(404).json({ error: 'Due record not found' });
      return;
    }
    res.json(due);
  } catch (err) {
    next(err);
  }
});

// ─── PATCH /api/deleted-client-dues/:id ──────────────────────────────────────

router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid due id' });
    return;
  }

  const parsed = notesBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const due = await updateDueNotes(id, parsed.data.notes);
    if (!due) {
      res.status(404).json({ error: 'Due record not found' });
      return;
    }
    res.json(due);
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/deleted-client-dues/:id ─────────────────────────────────────

router.delete('/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  const id = parseId(req.params['id'] as string);
  if (!id) {
    res.status(400).json({ error: 'Invalid due id' });
    return;
  }

  try {
    const existing = await getDeletedClientDue(id);
    if (!existing) {
      res.status(404).json({ error: 'Due record not found' });
      return;
    }

    await deleteDeletedClientDue(id);
    res.json({ message: 'Due record deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
