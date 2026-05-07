import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getDb } from '../../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: 'userId is required' });
  }

  const database = await getDb();

  try {
    if (req.method === 'GET') {
      const insights = await database.collection('insights').find({ userId }).toArray();
      const formatted = insights.map((i: any) => ({ ...i, id: i._id.toString() }));
      return res.json(formatted);
    }

    if (req.method === 'POST') {
      const insight = { ...req.body, userId, createdAt: new Date() };
      const result = await database.collection('insights').insertOne(insight);
      return res.json({ id: result.insertedId.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
