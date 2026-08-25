import { Hono } from "hono";
import { nowIso } from "../lib/ids";
import type { AppEnv } from "../types/hono";
import {
  getRecentlyUpdatedProjects,
  getTimeline,
  getTodayView,
} from "../services/dashboard/dashboardService";

export const dashboardRoutes = new Hono<AppEnv>();

dashboardRoutes.get("/today", async (c) => {
  const db = c.get("db");
  const currentDate = c.req.query("date") ?? nowIso().slice(0, 10);
  const view = await getTodayView(db, currentDate);
  return c.json(view);
});

dashboardRoutes.get("/timeline", async (c) => {
  const db = c.get("db");
  const currentDate = c.req.query("date") ?? nowIso().slice(0, 10);
  const entries = await getTimeline(db, currentDate);
  return c.json({ entries });
});

dashboardRoutes.get("/recent-projects", async (c) => {
  const db = c.get("db");
  const projects = await getRecentlyUpdatedProjects(db, 5);
  return c.json({ projects });
});
