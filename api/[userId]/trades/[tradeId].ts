import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, tradeId } = req.query;

  if (!userId || typeof userId !== 'string' || !tradeId || typeof tradeId !== 'string') {
    return res.status(400).json({ error: 'userId and tradeId are required' });
  }

  const database = await getDb();

  try {
    if (req.method === 'GET') {
      const trade = await database.collection('trades').findOne({
        _id: new ObjectId(tradeId),
        userId
      });
      if (trade) {
        return res.json({ ...trade, id: trade._id.toString() });
      }
      return res.status(404).json({ error: 'Trade not found' });
    }

    if (req.method === 'PATCH') {
      const update = { ...req.body, updatedAt: new Date() };
      delete update.id;
      await database.collection('trades').updateOne(
        { _id: new ObjectId(tradeId), userId },
        { $set: update }
      );
      return res.json({ success: true });
    }

    if (req.method === 'DELETE') {
      await database.collection('trades').deleteOne({
        _id: new ObjectId(tradeId),
        userId
      });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
