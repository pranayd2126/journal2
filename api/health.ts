import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.json({ status: 'ok', environment: process.env.NODE_ENV || 'production' });
}
