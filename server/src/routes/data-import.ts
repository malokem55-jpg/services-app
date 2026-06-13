import express, { Router, Request, Response, NextFunction } from 'express';
import { requireMalik } from '../middleware/auth.js';
import { importLegacyDump } from '../services/data-import.service.js';

// محمية بكلمة مرور لوحة malik (X-Malik-Token) بدل تسجيل دخول المستخدم.
const router = Router();
router.use(requireMalik);

// يستقبل ملف الـ SQL كنص خام (وليس JSON) لأن حجمه قد يتجاوز حد الـ JSON الافتراضي
router.post(
  '/',
  express.text({ type: 'text/plain', limit: '100mb' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sql = typeof req.body === 'string' ? req.body : '';
      if (!sql.trim()) {
        res.status(400).json({ error: 'الملف فارغ أو لم يُرسل بصيغة صحيحة' });
        return;
      }
      const result = await importLegacyDump(sql);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
