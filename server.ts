import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { MongoClient, ObjectId, ServerApiVersion } from 'mongodb';
import { createServer as createViteServer } from 'vite';
import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import bcrypt from 'bcryptjs';

console.log('--- SERVER INITIALIZING ---');

// Cloudinary Config - loaded from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = multer.memoryStorage();
const upload = multer({ storage });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let client: MongoClient | null = null;
let db: any = null;

async function getDb() {
  if (db) return db;
  
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in environment variables. Check your .env file.');
  }

  if (!client) {
    client = new MongoClient(uri, {
      serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
    });
  }

  try {
    await client.connect();
    db = client.db("trading_journal");
    return db;
  } catch (err: any) {
    console.error("CRITICAL: MongoDB Connection Error:", err.message);
    throw new Error(`Database connection failed: ${err.message}`);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Health check - Verify API is alive
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV || 'development' });
  });

  // --- AUTH ROUTES ---
  app.post('/api/auth/signup', async (req, res) => {
    console.log('POST /api/auth/signup');
    try {
      const { email, password, name } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      const database = await getDb();
      const existingUser = await database.collection('users').findOne({ email: email.toLowerCase() });
      
      if (existingUser) return res.status(400).json({ error: 'Email already registered' });

      const hashedPassword = await bcrypt.hash(password, 10);
      const result = await database.collection('users').insertOne({
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        createdAt: new Date()
      });

      const user = { id: result.insertedId.toString(), email, name };
      res.json(user);
    } catch (err: any) {
      console.error('Signup Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    console.log('POST /api/auth/login');
    try {
      const { email, password } = req.body;
      const database = await getDb();
      
      console.log('Validating user:', email);
      const user = await database.collection('users').findOne({ email: email.toLowerCase() });
      if (!user) {
        console.log('User not found:', email);
        return res.status(400).json({ error: 'User not found' });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        console.log('Invalid password for user:', email);
        return res.status(400).json({ error: 'Invalid credentials' });
      }

      console.log('Login successful:', email);
      res.json({
        id: user._id.toString(),
        email: user.email,
        name: user.name
      });
    } catch (err: any) {
      console.error('Login Error:', err);
      res.status(500).json({ error: err.message });
    }
  });
  // --- END AUTH ROUTES ---

  // API Routes
  app.get('/api/:userId/trades', async (req, res) => {
    try {
      const database = await getDb();
      const trades = await database.collection('trades').find({ userId: req.params.userId }).toArray();
      const formattedTrades = trades.map((t: any) => ({ ...t, id: t._id.toString() }));
      res.json(formattedTrades);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/:userId/trades', async (req, res) => {
    try {
      const database = await getDb();
      const trade = { ...req.body, userId: req.params.userId, createdAt: new Date() };
      const result = await database.collection('trades').insertOne(trade);
      res.json({ id: result.insertedId.toString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/:userId/trades/:tradeId', async (req, res) => {
    try {
      const database = await getDb();
      const { tradeId } = req.params;
      const update = { ...req.body, updatedAt: new Date() };
      delete update.id;
      await database.collection('trades').updateOne(
        { _id: new ObjectId(tradeId), userId: req.params.userId },
        { $set: update }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete('/api/:userId/trades/:tradeId', async (req, res) => {
    try {
      const database = await getDb();
      const { tradeId } = req.params;
      await database.collection('trades').deleteOne({ 
        _id: new ObjectId(tradeId), 
        userId: req.params.userId 
      });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image Upload to Cloudinary
  app.post('/api/upload', upload.single('image'), async (req: any, res: any) => {
    console.log('--- Upload Request Received ---');
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: 'trading_journal_trades',
        resource_type: 'auto'
      });
      res.json({ url: result.secure_url });
    } catch (err: any) {
      console.error('Cloudinary upload error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/:userId/trades/:tradeId', async (req, res) => {
    try {
      const database = await getDb();
      const { tradeId } = req.params;
      const trade = await database.collection('trades').findOne({ 
        _id: new ObjectId(tradeId), 
        userId: req.params.userId 
      });
      if (trade) {
        res.json({ ...trade, id: trade._id.toString() });
      } else {
        res.status(404).json({ error: 'Trade not found' });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings Management
  app.get('/api/:userId/settings', async (req, res) => {
    try {
      const database = await getDb();
      const settings = await database.collection('settings').findOne({ userId: req.params.userId });
      res.json(settings || {});
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/:userId/settings', async (req, res) => {
    try {
      const database = await getDb();
      await database.collection('settings').updateOne(
        { userId: req.params.userId },
        { $set: { ...req.body, userId: req.params.userId, updatedAt: new Date() } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Insights Management
  app.get('/api/:userId/insights', async (req, res) => {
    try {
      const database = await getDb();
      const insights = await database.collection('insights').find({ userId: req.params.userId }).toArray();
      const formatted = insights.map((i: any) => ({ ...i, id: i._id.toString() }));
      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/:userId/insights', async (req, res) => {
    try {
      const database = await getDb();
      const insight = { ...req.body, userId: req.params.userId, createdAt: new Date() };
      const result = await database.collection('insights').insertOne(insight);
      res.json({ id: result.insertedId.toString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Checklists Management
  app.get('/api/:userId/checklists', async (req, res) => {
    try {
      const database = await getDb();
      const checklists = await database.collection('checklists').find({ userId: req.params.userId }).toArray();
      const formatted = checklists.map((c: any) => ({ ...c, id: c._id.toString() }));
      res.json(formatted);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/:userId/checklists', async (req, res) => {
    try {
      const database = await getDb();
      const checklist = { ...req.body, userId: req.params.userId, createdAt: new Date() };
      const result = await database.collection('checklists').insertOne(checklist);
      res.json({ id: result.insertedId.toString() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch('/api/:userId/checklists/:checklistId', async (req, res) => {
    try {
      const database = await getDb();
      const { checklistId } = req.params;
      const update = { ...req.body };
      delete update.id;
      await database.collection('checklists').updateOne(
        { _id: new ObjectId(checklistId), userId: req.params.userId },
        { $set: update }
      );
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite Middleware for Development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      console.log('Catch-all route hit:', req.method, req.url);
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('SERVER STARTUP ERROR:', err);
});
