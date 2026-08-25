import type { Database } from "../db/client";
import type { Env } from "./env";

export interface AppVariables {
  db: Database;
  userId: string;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
