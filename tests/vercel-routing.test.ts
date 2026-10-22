import { it, expect, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { makeVercelHandler } from "../server/vercelHandler";
const response = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn(),
});
it("routes nested public API URLs without trusting query overrides", () => {
  const target = vi.fn(),
    r = response(),
    req = { url: "/api/auth/session?__route=health" };
  makeVercelHandler(target)(req, r);
  expect(target).toHaveBeenCalledWith(req, r);
  expect(req.url).toBe("/api/auth/session?__route=health");
});
it("restores rewritten auth, owner, record, upload and health paths", () => {
  for (const path of [
    "health",
    "auth/signup",
    "auth/session",
    "auth/logout",
    "auth/password",
    "upload",
    "abc123/trades",
    "abc123/trades/def456",
    "abc123/uploads/def456",
    "abc123/notebook",
    "abc123/settings",
    "abc123/checklists/def456",
  ]) {
    const target = vi.fn(),
      req = { url: "/api?__route=" + encodeURIComponent(path) },
      r = response();
    makeVercelHandler(target)(req, r);
    expect(req.url).toBe("/api/" + path);
    expect(target).toHaveBeenCalledOnce();
  }
});
it("supports platform-parsed rewrite query values", () => {
  const target = vi.fn(),
    req = { url: "/api", query: { __route: "auth/login" } };
  makeVercelHandler(target)(req, response());
  expect(req.url).toBe("/api/auth/login");
});
it("rejects absent ambiguous traversal or malformed routing parameters", () => {
  for (const query of [
    "",
    "?__route=../auth/login",
    "?__route=health&__route=auth/login",
    "?__route=https://example.com",
    "?__route=auth%2F%2E%2E%2Fhealth",
  ]) {
    const target = vi.fn(),
      r = response();
    makeVercelHandler(target)({ url: "/api" + query }, r);
    expect(r.status).toHaveBeenCalledWith(404);
    expect(target).not.toHaveBeenCalled();
  }
});
it("keeps one deployable API entry and routes API traffic before the SPA", () => {
  const files = readdirSync("api", { recursive: true })
    .map(String)
    .filter((p) => /\.(?:ts|js)$/.test(p));
  expect(files).toEqual(["index.ts"]);
  const config = JSON.parse(readFileSync("vercel.json", "utf8"));
  expect(config.rewrites[0]).toEqual({
    source: "/api/(.*)",
    destination: "/api?__route=$1",
  });
  const spa = new RegExp("^" + config.rewrites[1].source + "$");
  expect(spa.test("/analytics")).toBe(true);
  expect(spa.test("/api")).toBe(false);
  expect(spa.test("/api/health")).toBe(false);
});
