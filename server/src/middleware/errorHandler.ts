import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof Error) {
    const status = (err as Error & { statusCode?: number }).statusCode;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ error: err.message });
      return;
    }
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}
