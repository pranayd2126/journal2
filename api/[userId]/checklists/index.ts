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
      const checklists = await database.collection('checklists').find({ userId }).toArray();
      const formatted = checklists.map((c: any) => ({ ...c, id: c._id.toString() }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const checklist = { ...req.body, userId, createdAt: new Date() };
      const result = await database.collection('checklists').insertOne(checklist);
      return res.json({ id: result.insertedId.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
