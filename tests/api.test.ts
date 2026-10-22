import sharp from "sharp";
import { v2 as cloudinary } from "cloudinary";
import { beforeAll, afterAll, it, expect, vi } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient, ObjectId } from "mongodb";
import { makeHandler } from "../server/handler";
import { makeVercelHandler } from "../server/vercelHandler";
import { hash } from "../server/security";
let mongo: MongoMemoryServer, client: MongoClient, db: any, handler: any;
async function call(
  path: string,
  method = "GET",
  body: any = undefined,
  cookie = "",
  headers: any = {},
) {
  let status = 200,
    data: any,
    head: any = {};
  const req = {
    url: "/api?__route=" + encodeURIComponent(path),
    method,
    body,
    headers: {
      host: "localhost",
      "content-type": "application/json",
      cookie,
      ...headers,
    },
    ip: "test",
  };
  const res = {
    status(n: number) {
      status = n;
      return this;
    },
    json(d: any) {
      data = d;
      return this;
    },
    send(d: any) {
      data = d;
      return this;
    },
    setHeader(k: string, v: any) {
      head[k] = v;
    },
  };
  await handler(req, res);
  return {
    status,
    data,
    cookie: head["Set-Cookie"]?.split(";")[0],
    headers: head,
  };
}
const payload = {
  symbol: "TEST",
  side: "LONG",
  entryPrice: 100,
  exitPrice: 110,
  quantity: 10,
  brokerage: 5,
  setupType: "Test",
  entryTime: "2026-01-01T08:00:00Z",
  exitTime: "2026-01-01T09:00:00Z",
};
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await MongoClient.connect(mongo.getUri());
  db = client.db("test");
  await db.collection("trades").createIndex(
    { userId: 1, submissionId: 1 },
    {
      unique: true,
      partialFilterExpression: { submissionId: { $type: "string" } },
    },
  );
  handler = makeVercelHandler(makeHandler(async () => db));
});
afterAll(async () => {
  await client?.close();
  await mongo?.stop();
});
it("rejects 5, accepts 6 and longer; session roundtrip, isolation, writes, revocation", async () => {
  expect(
    (
      await call("auth/signup", "POST", {
        email: "short@test.com",
        password: "12345",
        name: "Short",
      })
    ).status,
  ).toBe(400);
  const a = await call("auth/signup", "POST", {
      email: "a@test.com",
      password: "123456",
      name: "A",
    }),
    b = await call("auth/signup", "POST", {
      email: "b@test.com",
      password: "longpassword",
      name: "B",
    });
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(a.headers["Set-Cookie"]).toContain("HttpOnly");
  expect(a.data.password).toBeUndefined();
  expect((await call("auth/session", "GET", undefined, a.cookie)).data.id).toBe(
    a.data.id,
  );
  expect(
    (await call(`${b.data.id}/trades`, "GET", undefined, a.cookie)).status,
  ).toBe(403);
  for (const collection of ["trades", "settings", "checklists", "insights"])
    expect(
      (await call(`${b.data.id}/${collection}`, "GET", undefined, a.cookie))
        .status,
    ).toBe(403);
  expect((await call(`${a.data.id}/trades`)).status).toBe(401);
  expect(
    (await call(`${a.data.id}/trades`, "GET", undefined, "journal_session=bad"))
      .status,
  ).toBe(401);
  const route = `${a.data.id}/trades`,
    headers = { "idempotency-key": "12345678-1234-1234-1234-123456789000" };
  const created = await call(
    route,
    "POST",
    { ...payload, pnl: 9999, userId: b.data.id },
    a.cookie,
    headers,
  );
  expect(created.status).toBe(201);
  const duplicate = await call(
    route,
    "POST",
    { ...payload, pnl: 9999, userId: b.data.id },
    a.cookie,
    headers,
  );
  expect(duplicate.data.id).toBe(created.data.id);
  expect(
    (await call(route, "POST", { ...payload, quantity: 20 }, a.cookie, headers))
      .status,
  ).toBe(409);
  const saved = await call(
    `${route}/${created.data.id}`,
    "GET",
    undefined,
    a.cookie,
  );
  expect(saved.data.pnl).toBe(95);
  expect(saved.data.userId).toBe(a.data.id);
  const edited = await call(
    `${route}/${created.data.id}`,
    "PATCH",
    { version: 0, exitPrice: 120 },
    a.cookie,
  );
  expect(edited.data.pnl).toBe(195);
  expect(edited.data.entryTime).toBe(payload.entryTime);
  expect(
    (
      await call(
        `${route}/${created.data.id}`,
        "PATCH",
        { version: 0, exitPrice: 130 },
        a.cookie,
      )
    ).status,
  ).toBe(409);
  expect(
    (
      await call(
        `${route}/${created.data.id}`,
        "PATCH",
        { version: 1, userId: b.data.id, tradeReason: "review" },
        a.cookie,
      )
    ).data.userId,
  ).toBe(a.data.id);
  expect(
    (await call(`${route}/${created.data.id}`, "DELETE", {}, b.cookie)).status,
  ).toBe(403);
  expect(
    (await call(`${route}/${created.data.id}`, "DELETE", {}, a.cookie)).status,
  ).toBe(200);
  expect((await call(route, "GET", undefined, a.cookie)).data).toHaveLength(0);
  expect(
    (await call(route, "POST", { ...payload, quantity: -1 }, a.cookie, headers))
      .status,
  ).toBe(400);
  expect(
    (
      await call(route, "POST", payload, a.cookie, {
        ...headers,
        origin: "https://evil.example",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await call(
        "upload",
        "POST",
        { image: "https://internal.example" },
        a.cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await call(
        "upload",
        "POST",
        { image: "data:image/png;base64,aGVsbG8=" },
        a.cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (await call("upload", "POST", { image: "x".repeat(2800001) }, a.cookie))
      .status,
  ).toBe(400);
  await call(
    `${a.data.id}/settings`,
    "PATCH",
    { dailyLossLimit: 250 },
    a.cookie,
  );
  expect(
    (await call(`${a.data.id}/settings`, "GET", undefined, a.cookie)).data
      .dailyLossLimit,
  ).toBe(250);
  const checklist = {
    date: "2026-01-01",
    followedRisk: true,
    noFOMO: true,
    waitedForConfirmation: false,
    avoidedNews: false,
    plannedTrade: false,
  };
  const c = await call(`${a.data.id}/checklists`, "POST", checklist, a.cookie),
    c2 = await call(`${a.data.id}/checklists`, "POST", checklist, a.cookie);
  expect(c.data.id).toBe(c2.data.id);
  expect(c.data.disciplineScore).toBe(40);
  expect(
    (
      await call("auth/login", "POST", {
        email: "a@test.com",
        password: "wrong",
      })
    ).status,
  ).toBe(401);
  await call("auth/logout", "POST", {}, a.cookie);
  expect((await call("auth/session", "GET", undefined, a.cookie)).status).toBe(
    401,
  );
  const login = await call("auth/login", "POST", {
    email: "a@test.com",
    password: "123456",
  });
  expect(login.status).toBe(200);
  await db
    .collection("sessions")
    .updateMany({ userId: a.data.id }, { $set: { expiresAt: new Date(0) } });
  expect(
    (await call("auth/session", "GET", undefined, login.cookie)).status,
  ).toBe(401);
});
it("rate limits repeated login attempts", async () => {
  let last: any;
  for (let i = 0; i < 17; i++)
    last = await call("auth/login", "POST", {
      email: "limit@test.com",
      password: "wrong",
    });
  expect(last.status).toBe(429);
});
it("preserves legacy P&L for notes-only edits and revokes sessions on password change", async () => {
  const a = await call("auth/signup", "POST", {
    email: "legacy@test.com",
    password: "123456",
    name: "Legacy",
  });
  const result = await db.collection("trades").insertOne({
    ...payload,
    userId: a.data.id,
    pnl: 1234,
    unknownLegacyField: "preserve",
  });
  const update = await call(
    `${a.data.id}/trades/${result.insertedId}`,
    "PATCH",
    { version: 0, tradeReason: "Notes only", charges: 0, multiplier: 1 },
    a.cookie,
  );
  expect(update.status).toBe(200);
  expect(update.data.pnl).toBe(1234);
  expect(update.data.unknownLegacyField).toBe("preserve");
  expect(
    (
      await call(
        "auth/password",
        "POST",
        { currentPassword: "123456", password: "12345" },
        a.cookie,
      )
    ).status,
  ).toBe(400);
  const change = await call(
    "auth/password",
    "POST",
    { currentPassword: "123456", password: "abcdef" },
    a.cookie,
  );
  expect(change.status).toBe(200);
  expect((await call("auth/session", "GET", undefined, a.cookie)).status).toBe(
    401,
  );
  expect(
    (await call("auth/session", "GET", undefined, change.cookie)).status,
  ).toBe(200);
  expect(
    (await call(`${a.data.id}/review`, "POST", {}, change.cookie)).status,
  ).toBe(503);
});
it("rejects malformed financial dates and changes to another account records", async () => {
  const a = await call("auth/signup", "POST", {
    email: "validate@test.com",
    password: "123456",
    name: "Validate",
  });
  const h = { "idempotency-key": "validation-123456789000" };
  expect(
    (
      await call(
        `${a.data.id}/trades`,
        "POST",
        { ...payload, exitTime: "2025-01-01T00:00:00Z" },
        a.cookie,
        h,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await call(
        `${a.data.id}/trades`,
        "POST",
        { ...payload, quantity: Infinity },
        a.cookie,
        h,
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await call(
        `${a.data.id}/trades`,
        "POST",
        { ...payload, imageUrl: "https://example.com/other.png" },
        a.cookie,
        h,
      )
    ).status,
  ).toBe(400);
  expect(
    (await call(`${a.data.id}/trades/not-an-id`, "GET", undefined, a.cookie))
      .status,
  ).toBe(400);
  expect(
    (
      await call(
        `${a.data.id}/settings`,
        "PATCH",
        { totalCapital: -1 },
        a.cookie,
      )
    ).status,
  ).toBe(400);
});
it("validates and privately stores an image using a mocked Cloudinary provider", async () => {
  const a = await call("auth/signup", "POST", {
    email: "images@test.com",
    name: "Images",
    password: "123456",
  });
  const b = await call("auth/signup", "POST", {
    email: "otherimage@test.com",
    name: "Other",
    password: "123456",
  });
  const bytes = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "#123456" },
  })
    .png()
    .toBuffer();
  vi.stubEnv("CLOUDINARY_API_SECRET", "synthetic-test-key");
  const upload = vi
    .spyOn(cloudinary.uploader, "upload")
    .mockResolvedValue({ public_id: "synthetic/image", format: "webp" } as any);
  try {
    const result = await call(
      "upload",
      "POST",
      { image: `data:image/png;base64,${bytes.toString("base64")}` },
      a.cookie,
    );
    expect(result.status).toBe(200);
    expect(result.data.url).toContain(`/api/${a.data.id}/uploads/`);
    expect(upload.mock.calls[0][1]).toMatchObject({
      type: "authenticated",
      resource_type: "image",
    });
    expect(
      (await call(result.data.url.slice(5), "GET", undefined, b.cookie)).status,
    ).toBe(403);
    const write = await call(
      `${a.data.id}/trades`,
      "POST",
      { ...payload, imageUrl: result.data.url },
      a.cookie,
      { "idempotency-key": "image-trade-123456789" },
    );
    expect(write.status).toBe(201);
  } finally {
    upload.mockRestore();
    vi.unstubAllEnvs();
  }
});
it("isolates versioned notebooks and preserves financial data in manual reviews", async () => {
  const a = await call("auth/signup", "POST", {
    email: "notebook@test.com",
    password: "123456",
    name: "Notebook",
  });
  const b = await call("auth/signup", "POST", {
    email: "notebook-other@test.com",
    password: "123456",
    name: "Other",
  });
  const path = `${a.data.id}/notebook`,
    entry = {
      kind: "WEEK",
      period: "2026-10-19",
      notes: "Plan",
      observations: "Patient",
      lesson: "Wait",
      focus: "One setup",
      reviewed: false,
    };
  expect((await call(path)).status).toBe(401);
  expect((await call(path, "GET", undefined, b.cookie)).status).toBe(403);
  const created = await call(path, "POST", entry, a.cookie);
  expect(created.status).toBe(201);
  expect(created.data.version).toBe(1);
  expect((await call(path, "POST", entry, a.cookie)).status).toBe(409);
  const updated = await call(
    path,
    "POST",
    { ...entry, version: 1, reviewed: true },
    a.cookie,
  );
  expect(updated.data.version).toBe(2);
  expect(
    (await call(path, "POST", { ...entry, version: 1 }, a.cookie)).status,
  ).toBe(409);
  expect(
    (await call(path, "POST", { ...entry, period: "2026-10-20" }, a.cookie))
      .status,
  ).toBe(400);
  expect(
    (
      await call(
        path,
        "POST",
        { ...entry, kind: "DAY", period: "2026-02-30" },
        a.cookie,
      )
    ).status,
  ).toBe(400);
  expect(
    (await call(`${b.data.id}/notebook`, "GET", undefined, b.cookie)).data,
  ).toEqual([]);
  const trade = await call(`${a.data.id}/trades`, "POST", payload, a.cookie, {
    "idempotency-key": "notebook-test-000000001",
  });
  const id = trade.data.id;
  const before = await call(
    `${a.data.id}/trades/${id}`,
    "GET",
    undefined,
    a.cookie,
  );
  const review = {
    status: "REVIEWED",
    rating: 4,
    wentWell: "Waited",
    improve: "Exit",
    lesson: "Plan",
  };
  const result = await call(
    `${a.data.id}/trades/${id}`,
    "PATCH",
    { version: before.data.version, review },
    a.cookie,
  );
  expect(result.status).toBe(200);
  expect(result.data.pnl).toBe(95);
  expect(result.data.entryPrice).toBe(100);
  expect(result.data.review).toEqual(review);
  expect(
    (
      await call(
        `${a.data.id}/trades/${id}`,
        "PATCH",
        { version: before.data.version, review },
        a.cookie,
      )
    ).status,
  ).toBe(409);
});
