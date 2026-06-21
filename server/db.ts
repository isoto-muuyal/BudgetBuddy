import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import bcrypt from "bcrypt";
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

  const ensureAdminTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ADMIN" (
        id SERIAL PRIMARY KEY,
        username text NOT NULL UNIQUE,
        password text NOT NULL
      )
    `);
  };

  const ensureAnalysisIntelligenceTables = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS analysis_embeddings (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        analysis_id varchar NOT NULL UNIQUE REFERENCES budget_analyses(id),
        summary text NOT NULL,
        embedding text NOT NULL,
        created_at timestamp DEFAULT now(),
        updated_at timestamp DEFAULT now()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS global_advice_snapshots (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        analysis_id varchar NOT NULL REFERENCES budget_analyses(id),
        advice text NOT NULL,
        progress_status text NOT NULL,
        supporting_analysis_ids text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
  };

  const shouldAutoPush = process.env.AUTO_DB_PUSH !== "false";
  if (!shouldAutoPush) {
    await ensureAppVersionsTable();
    await ensureAdminTable();
    await ensureAnalysisIntelligenceTables();
    return;
  }

  try {
    const result = await pool.query(`SELECT
      to_regclass('public.users') AS users,
      to_regclass('public.app_versions') AS app_versions,
      to_regclass('public."ADMIN"') AS admins`);
    const hasUsersTable = result.rows?.[0]?.users;
    const hasAppVersionsTable = result.rows?.[0]?.app_versions;
    const hasAdminTable = result.rows?.[0]?.admins;
    if (hasUsersTable && hasAppVersionsTable && hasAdminTable) {
      await ensureAppVersionsTable();
      await ensureAdminTable();
      await ensureAnalysisIntelligenceTables();
      return;
    }

    if (hasUsersTable) {
      await ensureAppVersionsTable();
      await ensureAdminTable();
      await ensureAnalysisIntelligenceTables();
      console.log("app_versions and ADMIN tables ensured successfully.");
      return;
    }

    console.log("Database tables not found. Running drizzle-kit push...");
    await execFileAsync("node", ["./node_modules/.bin/drizzle-kit", "push", "--config", "drizzle.config.ts"], {
      env: process.env,
    });
    const verify = await pool.query(`SELECT
      to_regclass('public.users') AS users,
      to_regclass('public.app_versions') AS app_versions,
      to_regclass('public."ADMIN"') AS admins`);
    const verified = verify.rows?.[0]?.users;
    const verifiedVersions = verify.rows?.[0]?.app_versions;
    const verifiedAdmins = verify.rows?.[0]?.admins;
    if (verified) {
      if (!verifiedVersions) {
        await ensureAppVersionsTable();
      }
      if (!verifiedAdmins) {
        await ensureAdminTable();
      }
      await ensureAnalysisIntelligenceTables();
      console.log("Database schema created successfully.");
      return;
    }

    console.warn("Drizzle schema push did not create tables. Falling back to SQL schema creation...");
    await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
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
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        total_amount numeric(10,2) NOT NULL,
        monthly_payment numeric(10,2) NOT NULL,
        interest_rate numeric(5,2) NOT NULL DEFAULT 0,
        created_at timestamp DEFAULT now()
      )
    `);
    await pool.query(`
      ALTER TABLE debts
      ADD COLUMN IF NOT EXISTS interest_rate numeric(5,2) NOT NULL DEFAULT 0
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        amount numeric(10,2) NOT NULL,
        frequency text NOT NULL,
        created_at timestamp DEFAULT now()
      )
    `);
    await ensureAppVersionsTable();
    await ensureAdminTable();
    await ensureAnalysisIntelligenceTables();
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

export async function ensureSeedAdmin(): Promise<void> {
  const username = process.env.SEED_ADMIN_USERNAME || "israel.soto";
  const password = process.env.SEED_ADMIN_PASSWORD || "shitokai23";

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "ADMIN" (
        id SERIAL PRIMARY KEY,
        username text NOT NULL UNIQUE,
        password text NOT NULL
      )
    `);

    const existing = await pool.query('SELECT id FROM "ADMIN" WHERE username = $1 LIMIT 1', [username]);
    if (existing.rowCount && existing.rows[0]) {
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      'INSERT INTO "ADMIN" (username, password) VALUES ($1, $2)',
      [username, passwordHash]
    );
    console.log(`Seed admin created for ${username}`);
  } catch (error) {
    console.error("Failed to seed admin:", error);
    throw error;
  }
}
