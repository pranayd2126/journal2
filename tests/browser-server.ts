import { MongoMemoryServer } from "mongodb-memory-server";
import { createServer } from "node:https";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
process.env.AI_ENABLED = "false";
const mongo = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB = "journal_browser_test";
process.env.NODE_ENV = "production";
process.env.APP_ORIGIN = "https://localhost:3100";
const certDir = mkdtempSync(join(tmpdir(), "journal-browser-tls-"));
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-keyout",
    join(certDir, "key.pem"),
    "-out",
    join(certDir, "cert.pem"),
    "-days",
    "1",
    "-subj",
    "/CN=localhost",
  ],
  { stdio: "ignore" },
);
const { createApp } = await import("../server.ts");
const server = createServer(
  {
    key: readFileSync(join(certDir, "key.pem")),
    cert: readFileSync(join(certDir, "cert.pem")),
  },
  await createApp(),
);
server.listen(3100, "127.0.0.1");
process.on("SIGTERM", async () => {
  server.close();
  await mongo.stop();
  rmSync(certDir, { recursive: true, force: true });
  process.exit(0);
});
