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
  const ensureAppVersionsTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_versions (
        id SERIAL PRIMARY KEY,
        version text NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);

    await pool.query(`
      INSERT INTO app_versions (version, updated_at)
      SELECT '0.1.1', now()
      WHERE NOT EXISTS (SELECT 1 FROM app_versions)
    `);
  };

  const shouldAutoPush = process.env.AUTO_DB_PUSH !== "false";
  if (!shouldAutoPush) {
    await ensureAppVersionsTable();
    return;
  }

  try {
    const result = await pool.query("SELECT to_regclass('public.users') AS users, to_regclass('public.app_versions') AS app_versions");
    const hasUsersTable = result.rows?.[0]?.users;
    const hasAppVersionsTable = result.rows?.[0]?.app_versions;
    if (hasUsersTable && hasAppVersionsTable) {
      await ensureAppVersionsTable();
      return;
    }

    if (hasUsersTable && !hasAppVersionsTable) {
      await ensureAppVersionsTable();
      console.log("app_versions table created successfully.");
      return;
    }

    console.log("Database tables not found. Running drizzle-kit push...");
    await execFileAsync("node", ["./node_modules/.bin/drizzle-kit", "push", "--config", "drizzle.config.ts"], {
      env: process.env,
    });
    const verify = await pool.query("SELECT to_regclass('public.users') AS users, to_regclass('public.app_versions') AS app_versions");
    const verified = verify.rows?.[0]?.users;
    const verifiedVersions = verify.rows?.[0]?.app_versions;
    if (verified) {
      if (!verifiedVersions) {
        await ensureAppVersionsTable();
      }
      console.log("Database schema created successfully.");
      return;
    }

    console.warn("Drizzle schema push did not create tables. Falling back to SQL schema creation...");
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        full_name text NOT NULL,
        password text NOT NULL,
        monthly_income numeric(10,2),
        email_verified boolean DEFAULT false,
        verification_token text,
        created_at timestamp DEFAULT now(),
        password_reset_token text,
        password_reset_expiry timestamp
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_analyses (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        file_name text NOT NULL,
        original_file_name text NOT NULL,
        upload_date timestamp DEFAULT now(),
        monthly_income numeric(10,2) NOT NULL,
        recommended_needs numeric(10,2) NOT NULL,
        recommended_wants numeric(10,2) NOT NULL,
        recommended_savings numeric(10,2) NOT NULL,
        actual_needs numeric(10,2),
        actual_wants numeric(10,2),
        actual_savings numeric(10,2),
        actual_undefined numeric(10,2),
        expenses text,
        recommendations text,
        analysis_status text DEFAULT 'pending'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS debts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        total_amount numeric(10,2) NOT NULL,
        monthly_payment numeric(10,2) NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    await ensureAppVersionsTable();
    console.log("Database schema created using fallback SQL.");
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
  const passwordHash = process.env.SEED_USER_PASSWORD_HASH || "$2b$12$XXhNF4jnMH2jicp8UNPKO.Zyrw735cfPozZVKruUpOV4EvghO29Gy";
  const fullName = process.env.SEED_USER_FULL_NAME || "Israel Soto";

  if (!email || passwordHash === "REPLACE_ME") {
    console.warn("Seed user is not configured; skipping seed user creation.");
    return;
  }

  try {
    const tableCheck = await pool.query("SELECT to_regclass('public.users') AS users");
    const hasUsersTable = tableCheck.rows?.[0]?.users;
    if (!hasUsersTable) {
      console.warn("Seed user skipped because users table is missing.");
      return;
    }

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
