type Handler = (req: any, res: any) => unknown;
/** Vercel may expose either the public URL or the rewritten function URL. */
export function makeVercelHandler(handler: Handler): Handler {
  return (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (
      ["/api", "/api/", "/api/index", "/api/index.ts"].includes(url.pathname)
    ) {
      const values = url.searchParams.getAll("__route");
      const route = values.length
        ? values.length === 1
          ? values[0]
          : null
        : req.query?.__route;
      if (
        typeof route !== "string" ||
        !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(route)
      ) {
        res.setHeader("Cache-Control", "no-store");
        return res.status(404).json({ error: "Not found" });
      }
      req.url = `/api/${route}`;
    }
    return handler(req, res);
  };
}
