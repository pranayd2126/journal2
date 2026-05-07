import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import { getDb } from '../_db.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const database = await getDb();
    const existingUser = await database.collection('users').findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await database.collection('users').insertOne({
      email: email.toLowerCase(),
      password: hashedPassword,
      name,
      createdAt: new Date()
    });

    const user = { id: result.insertedId.toString(), email, name };
    return res.json(user);
  } catch (err: any) {
    console.error('Signup Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
