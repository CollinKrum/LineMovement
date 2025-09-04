import { drizzle } from "drizzle-orm/neon-serverless";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import * as schema from "@shared/schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sql: NeonQueryFunction<false, false> = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql as any, { schema });
