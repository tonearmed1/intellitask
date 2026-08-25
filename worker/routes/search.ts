import { Hono } from "hono";
import type { AppEnv } from "../types/hono";
import { search } from "../services/search/searchService";

export const searchRoutes = new Hono<AppEnv>();

searchRoutes.get("/", async (c) => {
  const db = c.get("db");
  const q = c.req.query("q") ?? "";
  const results = await search(db, q);
  return c.json(results);
});
