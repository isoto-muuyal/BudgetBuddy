import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

// Optional: simple connectivity check
(async () => {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`SELECT 1`;
    console.log("✅ Connected to database");
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

// Create the drizzle instance (no Pool, no SSL options needed)
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
