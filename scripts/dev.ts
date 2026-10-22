import "dotenv/config";
import { mkdir } from "node:fs/promises";
import path from "node:path";
// Local development only. Configured databases always take precedence.
let localDatabase:
  import("mongodb-memory-server").MongoMemoryServer | undefined;
if (!process.env.MONGODB_URI) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Production requires MONGODB_URI");
  const { MongoMemoryServer } = await import("mongodb-memory-server");
  const dbPath = path.resolve(".local-data/mongodb");
  await mkdir(dbPath, { recursive: true });
  localDatabase = await MongoMemoryServer.create({
    instance: { dbPath, storageEngine: "wiredTiger", ip: "127.0.0.1" },
  });
  process.env.MONGODB_URI = localDatabase.getUri();
  process.env.MONGODB_DB = "journal_local";
  console.log(
    "Using persistent local development database in .local-data/mongodb (not production data).",
  );
}
const { createApp } = await import("../server.ts");
const port = Number(process.env.PORT ?? 3000);
const server = (await createApp()).listen(port, "127.0.0.1", () =>
  console.log(`Journal running at http://localhost:${port}`),
);
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  server.close();
  await localDatabase?.stop({ doCleanup: false });
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
