import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

export async function login(username: string, password: string): Promise<string> {
  const user = await prisma.user.findFirst({ where: { username } });

  if (!user || !user.password) {
    throw new InvalidCredentialsError();
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new InvalidCredentialsError();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');

  return jwt.sign({ userId: user.id }, secret, { expiresIn: '7d' });
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid username or password');
  }
}
