import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("Connecting to database:", process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3,            // small pool: Neon prefers few connections
  idleTimeoutMillis: 5000, // release idle clients quickly
  connectionTimeoutMillis: 10000, // fail fast if cannot connect
});

(async () => {
  try {
    await pool.query('SELECT 1');
    console.log("Connected to database");
  } catch (err) {
    console.error("Database connection error:", err);
  }
})();

export const db = drizzle(pool, { schema });