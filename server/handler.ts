import { generateReview } from "./ai.js";
import bcrypt from "bcryptjs";
import { ObjectId, type Db } from "mongodb";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { getDb } from "./db.js";
import { calculatedPnl } from "../src/lib/tradingAnalytics.js";
import {
  authenticate,
  cookie,
  createSession,
  hash,
  HttpError,
  passwordValid,
  rateLimit,
  securityHeaders,
  token,
} from "./security.js";
import {
  parse,
  tradeSchema,
  settingsSchema,
  checklistSchema,
  notebookSchema,
} from "./validation.js";
const safeUser = (u: any) => ({
  id: u._id.toString(),
  email: u.email,
  name: u.name,
});
const document = (d: any) => {
  const { _id, ...rest } = d;
  return { ...rest, id: _id.toString(), version: d.version ?? 0 };
};
const oid = (id: string) => {
  if (!/^[a-f\d]{24}$/i.test(id)) throw new HttpError(400, "Invalid record ID");
  return new ObjectId(id);
};
const method = (req: any, allowed: string[]) => {
  if (!allowed.includes(req.method))
    throw new HttpError(405, "Method not allowed");
};
export function makeHandler(database = getDb) {
  return async function handler(req: any, res: any) {
    try {
      securityHeaders(req, res);
      const path = new URL(req.url, "http://localhost").pathname
        .replace(/\/$/, "")
        .split("/")
        .slice(2);
      if (path[0] === "health") {
        method(req, ["GET"]);
        return res.json({ status: "ok" });
      }
      // Reject missing cookies before attempting any database connection.
      if (path[0] !== "auth" && !/^[a-f0-9]{64}$/.test(token(req)))
        throw new HttpError(401, "Please sign in");
      const db = await database();
      if (path[0] === "auth") {
        const action = path[1];
        if (action === "session") {
          method(req, ["GET"]);
          const userId = await authenticate(db, req);
          const u = await db.collection("users").findOne({ _id: oid(userId) });
          if (!u) throw new HttpError(401, "Please sign in");
          return res.json(safeUser(u));
        }
        method(req, ["POST"]);
        if (action === "logout") {
          await db
            .collection("sessions")
            .deleteOne({ tokenHash: hash(token(req)) });
          cookie(res, "", 0);
          return res.json({ success: true });
        }
        if (action === "password") {
          const userId = await authenticate(db, req);
          await rateLimit(db, `password:${userId}`, 10);
          const u = await db.collection("users").findOne({ _id: oid(userId) });
          if (
            typeof req.body?.currentPassword !== "string" ||
            !u ||
            !(await bcrypt.compare(req.body.currentPassword, u.password))
          )
            throw new HttpError(400, "Invalid credentials");
          if (!passwordValid(req.body.password))
            throw new HttpError(
              400,
              "Password must have at least six characters and at most 72 UTF-8 bytes",
            );
          await db
            .collection("users")
            .updateOne(
              { _id: u._id },
              { $set: { password: await bcrypt.hash(req.body.password, 12) } },
            );
          await db.collection("sessions").deleteMany({ userId });
          await createSession(db, userId, res);
          return res.json({ success: true });
        }
        if (!["login", "signup"].includes(action))
          throw new HttpError(404, "Not found");
        const { email, password, name } = req.body ?? {};
        if (
          typeof email !== "string" ||
          email.length > 254 ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" ||
          Buffer.byteLength(password) > 72
        )
          throw new HttpError(400, "Invalid email or password");
        const normalized = email.trim().toLowerCase();
        // req.ip is trusted only by Express; Vercel forwarded IP supplied by platform.
        const ip = req.ip ?? req.headers["x-vercel-forwarded-for"] ?? "unknown";
        await rateLimit(db, `auth:ip:${ip}`, 50);
        await rateLimit(db, `auth:email:${normalized}`, 15);
        let u = await db.collection("users").findOne({ email: normalized });
        if (action === "signup") {
          if (!passwordValid(password))
            throw new HttpError(
              400,
              "Password must have at least six characters and at most 72 UTF-8 bytes",
            );
          if (typeof name !== "string" || !name.trim() || name.length > 100)
            throw new HttpError(
              400,
              "Name is required (maximum 100 characters)",
            );
          if (u) throw new HttpError(409, "Unable to register this email");
          // New registrations reserve normalized email atomically; legacy users remain untouched.
          try {
            await db
              .collection("emailReservations")
              .insertOne({ _id: normalized as any });
          } catch (e: any) {
            if (e.code === 11000)
              throw new HttpError(409, "Unable to register this email");
            throw e;
          }
          const entry = {
            email: normalized,
            name: name.trim(),
            password: await bcrypt.hash(password, 12),
            createdAt: new Date(),
          };
          try {
            const result = await db.collection("users").insertOne(entry);
            u = { ...entry, _id: result.insertedId };
          } catch (e) {
            await db
              .collection("emailReservations")
              .deleteOne({ _id: normalized as any });
            throw e;
          }
        } else {
          const dummy =
            "$2b$12$w7FhMfhh4Iji/OO3hxRH3.1W5ZVqoJ5HTQ7gbK0sVZK5cJDEfCR0C";
          const match = await bcrypt.compare(password, u?.password ?? dummy);
          if (!u || !match) throw new HttpError(401, "Invalid credentials");
        }
        await createSession(db, u!._id.toString(), res);
        return res.json(safeUser(u));
      }
      const userId = await authenticate(db, req);
      if (path[0] === "upload") {
        method(req, ["POST"]);
        await rateLimit(db, `upload:${userId}`, 20);
        const image = req.body?.image;
        if (
          typeof image !== "string" ||
          image.length > 2800000 ||
          !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
        )
          throw new HttpError(
            400,
            "Upload a PNG, JPEG or WebP image under 2 MB",
          );
        const buffer = Buffer.from(image.split(",")[1], "base64");
        if (buffer.length > 2 * 1024 * 1024)
          throw new HttpError(413, "Image too large");
        let clean: Buffer;
        try {
          const metadata = await sharp(buffer, {
            limitInputPixels: 16000000,
          }).metadata();
          if (!["png", "jpeg", "webp"].includes(metadata.format!))
            throw Error();
          clean = await sharp(buffer, { limitInputPixels: 16000000 })
            .rotate()
            .webp()
            .toBuffer();
        } catch {
          throw new HttpError(400, "Invalid or oversized image");
        }
        if (!process.env.CLOUDINARY_API_SECRET)
          throw new HttpError(503, "Image uploads are not configured");
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        const result = await cloudinary.uploader.upload(
          `data:image/webp;base64,${clean.toString("base64")}`,
          {
            folder: `trading_journal/${userId}`,
            resource_type: "image",
            type: "authenticated",
          },
        );
        const uploadId = new ObjectId();
        const url = `/api/${userId}/uploads/${uploadId}`;
        await db.collection("uploads").insertOne({
          _id: uploadId,
          userId,
          url,
          publicId: result.public_id,
          format: result.format,
          createdAt: new Date(),
        });
        return res.json({ url });
      }
      if (path[0] === userId && path[1] === "review") {
        method(req, ["POST"]);
        await rateLimit(db, `review:${userId}`, 5);
        return res.json(await generateReview(db, userId));
      }
      if (path[0] !== userId) throw new HttpError(403, "Access denied");
      if (path[1] === "uploads" && path.length === 3) {
        method(req, ["GET"]);
        const record = await db
          .collection("uploads")
          .findOne({ _id: oid(path[2]), userId });
        if (!record) throw new HttpError(404, "Image not found");
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key: process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        const url = cloudinary.url(record.publicId, {
          secure: true,
          sign_url: true,
          type: "authenticated",
          resource_type: "image",
          format: record.format,
        });
        const upstream = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        });
        if (!upstream.ok) throw new HttpError(503, "Image unavailable");
        const bytes = Buffer.from(await upstream.arrayBuffer());
        res.setHeader("Content-Type", "image/webp");
        return res.send(bytes);
      }
      const collection = path[1],
        id = path[2];
      if (
        !["trades", "settings", "checklists", "insights", "notebook"].includes(
          collection,
        ) ||
        path.length > 3
      )
        throw new HttpError(404, "Not found");
      const c = db.collection(collection),
        query: any = { userId };
      if (id) query._id = oid(id);
      if (req.method === "GET") {
        if (collection === "settings" || id) {
          const d = await c.findOne(query);
          if (id && !d) throw new HttpError(404, "Record not found");
          return res.json(d ? document(d) : {});
        }
        return res.json(
          (await c.find(query).sort({ createdAt: -1 }).toArray()).map(document),
        );
      }
      await rateLimit(db, `write:${userId}`, 300);
      if (collection === "notebook") {
        method(req, ["POST"]);
        const data = parse(notebookSchema, req.body);
        const key = new ObjectId(
          hash(`notebook:${userId}:${data.kind}:${data.period}`).slice(0, 24),
        );
        const old = await c.findOne({ _id: key, userId });
        if (old) {
          if (req.body.version !== old.version)
            throw new HttpError(
              409,
              "This review changed in another session. Reload before saving",
            );
          const saved = await c.findOneAndUpdate(
            { _id: key, userId, version: old.version },
            { $set: { ...data, updatedAt: new Date() }, $inc: { version: 1 } },
            { returnDocument: "after" },
          );
          if (!saved)
            throw new HttpError(
              409,
              "This review changed. Reload before saving",
            );
          return res.json(document(saved));
        }
        if (req.body.version !== undefined && req.body.version !== 0)
          throw new HttpError(409, "Review changed. Reload before saving");
        try {
          await c.insertOne({
            _id: key,
            userId,
            ...data,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        } catch (e: any) {
          if (e.code === 11000)
            throw new HttpError(
              409,
              "A review for this period already exists. Reload before saving",
            );
          throw e;
        }
        return res
          .status(201)
          .json({ ...data, id: key.toString(), version: 1 });
      }
      if (collection === "trades") {
        method(req, id ? ["PATCH", "DELETE"] : ["POST"]);
        if (req.method === "DELETE") {
          const r = await c.deleteOne(query);
          if (!r.deletedCount) throw new HttpError(404, "Record not found");
          return res.json({ success: true });
        }
        const old = id ? await c.findOne(query) : null;
        if (id && !old) throw new HttpError(404, "Record not found");
        const incoming = req.body ?? {};
        if (id && incoming.version !== (old!.version ?? 0))
          throw new HttpError(
            409,
            "This trade changed in another session. Reload before editing",
          );
        const data: any = parse(tradeSchema, { ...old, ...incoming });
        if (
          data.imageUrl &&
          data.imageUrl !== old?.imageUrl &&
          !(await db
            .collection("uploads")
            .findOne({ userId, url: data.imageUrl }))
        )
          throw new HttpError(
            400,
            "Screenshot must be uploaded by this account",
          );
        const financial = [
          "entryPrice",
          "exitPrice",
          "quantity",
          "side",
          "brokerage",
          "charges",
          "multiplier",
        ];
        const changed =
          !old ||
          financial.some(
            (k) =>
              data[k] !== old[k] &&
              !(
                old[k] === undefined &&
                (data[k] === 0 || (k === "multiplier" && data[k] === 1))
              ),
          );
        const pnl = changed ? calculatedPnl(data) : old!.pnl;
        if (pnl === null || !Number.isFinite(pnl) || Math.abs(pnl) > 1e12)
          throw new HttpError(400, "Invalid financial values");
        const update = {
          ...data,
          pnl,
          pnlSource: changed ? "calculated" : (old?.pnlSource ?? "legacy"),
          userId,
          updatedAt: new Date(),
        };
        if (id) {
          const result = await c.findOneAndUpdate(
            {
              ...query,
              ...(old!.version === undefined
                ? { version: { $exists: false } }
                : { version: old!.version }),
            },
            { $set: update, $inc: { version: 1 } },
            { returnDocument: "after" },
          );
          if (!result)
            throw new HttpError(
              409,
              "This trade changed. Reload before editing",
            );
          return res.json(document(result));
        }
        const submissionId = req.headers["idempotency-key"];
        if (
          typeof submissionId !== "string" ||
          !/^[a-zA-Z0-9-]{16,80}$/.test(submissionId)
        )
          throw new HttpError(400, "Submission ID required");
        const fingerprint = createHash("sha256")
          .update(JSON.stringify(data))
          .digest("hex");
        try {
          const result = await c.insertOne({
            ...update,
            version: 0,
            submissionId,
            fingerprint,
            createdAt: new Date(),
          });
          return res
            .status(201)
            .json({ id: result.insertedId.toString(), version: 0 });
        } catch (e: any) {
          if (e.code !== 11000) throw e;
          const existing = await c.findOne({ userId, submissionId });
          if (existing?.fingerprint !== fingerprint)
            throw new HttpError(409, "Submission ID already used");
          return res.json({
            id: existing._id.toString(),
            version: existing.version,
          });
        }
      }
      if (collection === "settings") {
        method(req, ["POST", "PATCH"]);
        const data = parse(settingsSchema, req.body);
        const old = await c.findOne({ userId });
        await c.updateOne(
          {
            _id:
              old?._id ?? new ObjectId(hash(`settings:${userId}`).slice(0, 24)),
            userId,
          },
          { $set: { ...data, userId, updatedAt: new Date() } },
          { upsert: true },
        );
        return res.json({ success: true });
      }
      if (collection === "checklists") {
        method(req, id ? ["PATCH"] : ["POST"]);
        const old = id ? await c.findOne(query) : null;
        if (id && !old) throw new HttpError(404, "Record not found");
        const data = parse(checklistSchema, { ...old, ...req.body });
        const disciplineScore =
          [
            "followedRisk",
            "noFOMO",
            "waitedForConfirmation",
            "avoidedNews",
            "plannedTrade",
          ].filter((k) => data[k]).length * 20;
        // Deterministic IDs protect new daily entries without rewriting duplicate legacy records.
        const key = new ObjectId(hash(`${userId}:${data.date}`).slice(0, 24));
        const existing = old ?? (await c.findOne({ userId, date: data.date }));
        const result = await c.findOneAndUpdate(
          { _id: existing?._id ?? key, userId },
          {
            $set: { ...data, disciplineScore, updatedAt: new Date() },
            $setOnInsert: { createdAt: new Date() },
          },
          { upsert: true, returnDocument: "after" },
        );
        return res.json(document(result));
      }
      method(req, ["POST"]);
      if (
        typeof req.body?.content !== "string" ||
        req.body.content.length > 20000 ||
        !["DAILY", "WEEKLY"].includes(req.body.type) ||
        typeof req.body.period !== "string"
      )
        throw new HttpError(400, "Invalid insight");
      const result = await c.insertOne({
        userId,
        content: req.body.content,
        type: req.body.type,
        period: req.body.period.slice(0, 30),
        createdAt: new Date(),
      });
      return res.json({ id: result.insertedId.toString() });
    } catch (e: any) {
      const status = e instanceof HttpError ? e.status : 503;
      return res.status(status).json({
        error:
          e instanceof HttpError
            ? e.message
            : "Service unavailable. Please try again later",
      });
    }
  };
}
export default makeHandler();
