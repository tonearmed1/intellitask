import type { Database } from "../db/client";
import type { Env } from "./env";

export interface AppVariables {
  db: Database;
  appEnv: Env;
  userId: string;
}

export type AppEnv = { Variables: AppVariables };
