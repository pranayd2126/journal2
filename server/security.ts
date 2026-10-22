import { createHash, randomBytes } from "node:crypto";
import type { Db } from "mongodb";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const hash = (v: string) => createHash("sha256").update(v).digest("hex");
export const passwordValid = (p: unknown): p is string =>
  typeof p === "string" && [...p].length >= 6 && Buffer.byteLength(p) <= 72;
export function token(req: any): string {
  const cookie = req.headers.cookie ?? "";
  return (
    cookie
      .split(";")
      .map((v: string) => v.trim())
      .find((v: string) => v.startsWith("journal_session="))
      ?.slice(16) ?? ""
  );
}
export function cookie(res: any, value: string, maxAge = 604800) {
  res.setHeader(
    "Set-Cookie",
    `journal_session=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
  );
}
export async function createSession(db: Db, userId: string, res: any) {
  const raw = randomBytes(32).toString("hex");
  await db
    .collection("sessions")
    .insertOne({
      tokenHash: hash(raw),
      userId,
      expiresAt: new Date(Date.now() + 604800000),
    });
  cookie(res, raw);
}
export async function authenticate(db: Db, req: any) {
  const raw = token(req);
  if (!/^[a-f0-9]{64}$/.test(raw)) throw new HttpError(401, "Please sign in");
  const session = await db
    .collection("sessions")
    .findOne({ tokenHash: hash(raw), expiresAt: { $gt: new Date() } });
  if (!session) throw new HttpError(401, "Session expired. Please sign in");
  return session.userId as string;
}
export function securityHeaders(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "same-origin");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    const allowed = process.env.APP_ORIGIN;
    if (
      req.headers["sec-fetch-site"] === "cross-site" ||
      (origin &&
        (allowed
          ? origin !== allowed
          : new URL(origin).host !== req.headers.host))
    )
      throw new HttpError(403, "Cross-origin request denied");
    if (!(req.headers["content-type"] ?? "").startsWith("application/json"))
      throw new HttpError(415, "JSON required");
  }
}
export async function rateLimit(
  db: Db,
  key: string,
  limit: number,
  windowMs = 900000,
) {
  const bucket = Math.floor(Date.now() / windowMs),
    id = hash(`${key}:${bucket}`);
  const record = await db
    .collection("rateLimits")
    .findOneAndUpdate(
      { _id: id as any },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) },
      },
      { upsert: true, returnDocument: "after" },
    );
  if (record!.count > limit)
    throw new HttpError(429, "Too many requests. Try again later");
}
