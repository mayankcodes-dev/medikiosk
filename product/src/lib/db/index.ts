// src/lib/db/index.ts
// Neon + Drizzle database client
// Uses HTTP driver — works on Cloudflare Pages edge runtime

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

export * from "./schema";
