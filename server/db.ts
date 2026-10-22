import { MongoClient, type Db } from "mongodb";
let connection: Promise<Db> | undefined;
export async function getDb(): Promise<Db> {
  if (!connection) {
    connection = (async () => {
      if (!process.env.MONGODB_URI)
        throw new Error("Database is not configured");
      const client = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      });
      await client.connect();
      const db = client.db(process.env.MONGODB_DB ?? "trading_journal");
      await Promise.all([
        db
          .collection("sessions")
          .createIndex({ tokenHash: 1 }, { unique: true }),
        db
          .collection("sessions")
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db
          .collection("rateLimits")
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
        db.collection("trades").createIndex({ userId: 1, exitTime: 1 }),
        db.collection("trades").createIndex(
          { userId: 1, submissionId: 1 },
          {
            unique: true,
            partialFilterExpression: { submissionId: { $type: "string" } },
          },
        ),
        ...["settings", "checklists", "insights", "notebook"].map((c) =>
          db.collection(c).createIndex({ userId: 1 }),
        ),
        db.collection("users").createIndex({ email: 1 }),
      ]);
      return db;
    })().catch((e) => {
      connection = undefined;
      throw e;
    });
  }
  return connection;
}
