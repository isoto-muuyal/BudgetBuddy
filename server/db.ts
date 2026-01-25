import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set. Did you forget to provision a database?");
}

console.log("Connecting to database:", process.env.DATABASE_URL);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  // {
   // rejectUnauthorized: false, // needed for Neon (self-signed certs) 
    //},
});

pool.connect()
.then( client => {
  console.log("Connected to database");
  return client;
}).catch( err => {
  console.error("Database connection error:", err);
  throw err;
});

export const db = drizzle(pool, { schema });

const execFileAsync = promisify(execFile);

export async function ensureDatabaseSchema(): Promise<void> {
  const shouldAutoPush = process.env.AUTO_DB_PUSH !== "false";
  if (!shouldAutoPush) {
    return;
  }

  try {
    const result = await pool.query("SELECT to_regclass('public.users') AS users");
    const hasUsersTable = result.rows?.[0]?.users;
    if (hasUsersTable) {
      return;
    }

    console.log("Database tables not found. Running drizzle-kit push...");
    await execFileAsync("node", ["./node_modules/.bin/drizzle-kit", "push", "--config", "drizzle.config.ts"], {
      env: process.env,
    });
    console.log("Database schema created successfully.");
  } catch (error) {
    console.error("Failed to ensure database schema:", error);
    throw error;
  }
}

export async function ensureSeedUser(): Promise<void> {
  const shouldSeed = process.env.AUTO_SEED_USER !== "false";
  if (!shouldSeed) {
    return;
  }

  const email = process.env.SEED_USER_EMAIL || "israel.soto@muuyal.tech";
  const passwordHash = process.env.SEED_USER_PASSWORD_HASH || "REPLACE_ME";
  const fullName = process.env.SEED_USER_FULL_NAME || "Israel Soto";

  if (!email || passwordHash === "REPLACE_ME") {
    console.warn("Seed user is not configured; skipping seed user creation.");
    return;
  }

  try {
    const existing = await pool.query("SELECT id FROM users WHERE email = $1 LIMIT 1", [email]);
    if (existing.rowCount && existing.rows[0]) {
      return;
    }

    await pool.query(
      `INSERT INTO users (id, email, full_name, password, email_verified, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, true, now())`,
      [email, fullName, passwordHash]
    );
    console.log(`Seed user created for ${email}`);
  } catch (error) {
    console.error("Failed to seed user:", error);
    throw error;
  }
}
