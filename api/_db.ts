import { MongoClient } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: any = null;

export async function getDb() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables.');
  }

  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
  }

  await cachedClient.connect();
  cachedDb = cachedClient.db('trading_journal');
  return cachedDb;
}
