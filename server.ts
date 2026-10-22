import "dotenv/config";
import express from "express";
import path from "node:path";
import { pathToFileURL } from "node:url";
import handler from "./server/handler";
export async function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "same-origin");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=31536000");
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
      );
    }
    next();
  });
  app.use(express.json({ limit: "3mb" }));
  app.use("/api", (req, res) => {
    req.url = req.originalUrl;
    return handler(req, res);
  });
  app.use((err: any, _req: any, res: any, _next: any) =>
    res
      .status(err.status === 413 ? 413 : 400)
      .json({ error: "Invalid or oversized request" }),
  );
  if (process.env.NODE_ENV !== "production") {
    const { createServer } = await import("vite");
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve("dist")));
    app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
  }
  return app;
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
)
  createApp().then((app) =>
    app.listen(Number(process.env.PORT ?? 3000), "127.0.0.1", () =>
      console.log("Journal available on localhost"),
    ),
  );
