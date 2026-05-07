import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { getDb } from '../../_db';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, checklistId } = req.query;

  if (!userId || typeof userId !== 'string' || !checklistId || typeof checklistId !== 'string') {
    return res.status(400).json({ error: 'userId and checklistId are required' });
  }

  const database = await getDb();

  try {
    if (req.method === 'PATCH') {
      const update = { ...req.body };
      delete update.id;
      await database.collection('checklists').updateOne(
        { _id: new ObjectId(checklistId), userId },
        { $set: update }
      );
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
