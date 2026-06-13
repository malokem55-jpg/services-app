import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import {
  listChamberCities,
  updateChamberCity,
  CHAMBER_CITY_KEYS,
} from '../services/chamber-cities.service.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const cities = await listChamberCities();
    res.json(cities.map(({ key, loginUrl }) => ({ key, loginUrl })));
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({ loginUrl: z.string().max(500) }).partial();

router.put('/:key', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const key = z.enum(CHAMBER_CITY_KEYS).parse(req.params.key);
    const patch = updateSchema.parse(req.body);
    const updated = await updateChamberCity(key, patch);
    res.json({ key: updated.key, loginUrl: updated.loginUrl });
  } catch (err) {
    next(err);
  }
});

export default router;
