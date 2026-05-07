import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const database = await getDb();

  try {
    if (req.method === 'GET') {
      const trades = await database.collection('trades').find({ userId }).toArray();
      const formatted = trades.map((t: any) => ({ ...t, id: t._id.toString() }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const trade = { ...req.body, userId, createdAt: new Date() };
      const result = await database.collection('trades').insertOne(trade);
      return res.json({ id: result.insertedId.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
