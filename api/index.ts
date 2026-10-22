import handler from "../server/handler.js";
import { makeVercelHandler } from "../server/vercelHandler.js";

// One function serves all public API paths through the existing shared router.
export default makeVercelHandler(handler);
export const config = { api: { bodyParser: { sizeLimit: "3mb" } } };
