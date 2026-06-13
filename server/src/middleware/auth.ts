import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as { userId: number };
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── كلمة مرور لوحة /malik ──────────────────────────────────────────────────
// رمز اللوحة JWT بحمولة { malik: true } يُصدَر عند إدخال كلمة المرور الصحيحة،
// ويُرسَل في ترويسة X-Malik-Token. منفصل تمامًا عن تسجيل دخول المستخدم.

// هل تحمل الطلب رمز لوحة صالحًا؟ (دون رفض — للاستعلام عن الحالة فقط)
export function hasValidMalikToken(req: Request): boolean {
  const raw = req.headers['x-malik-token'];
  const secret = process.env.JWT_SECRET;
  if (!secret || typeof raw !== 'string' || !raw) return false;
  try {
    const payload = jwt.verify(raw, secret) as { malik?: boolean };
    return payload.malik === true;
  } catch {
    return false;
  }
}

// يتطلب رمز لوحة صالحًا (للأدوات الحساسة داخل /malik)
export function requireMalik(req: Request, res: Response, next: NextFunction): void {
  if (!process.env.JWT_SECRET) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }
  if (!hasValidMalikToken(req)) {
    res.status(401).json({ error: 'كلمة مرور اللوحة مطلوبة' });
    return;
  }
  next();
}

// يقبل إمّا تسجيل دخول المستخدم (JWT) أو رمز اللوحة — للنقاط المشتركة بينهما
// (قائمة المؤسسات وملخصات بيانات الدخول للقراءة فقط)
export function requireAuthOrMalik(req: AuthRequest, res: Response, next: NextFunction): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
    return;
  }
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(header.slice(7), secret) as { userId: number };
      req.userId = payload.userId;
      next();
      return;
    } catch {
      // تابع لتجربة رمز اللوحة
    }
  }
  if (hasValidMalikToken(req)) {
    next();
    return;
  }
  res.status(401).json({ error: 'مطلوب تسجيل الدخول أو كلمة مرور اللوحة' });
}
