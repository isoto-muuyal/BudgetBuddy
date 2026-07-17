import { Pool } from "pg";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { decrypt } from "./utils/encryption";

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

  const ensureSiteVisitsTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS site_visits (
        id SERIAL PRIMARY KEY,
        timestamp timestamp DEFAULT now() NOT NULL,
        page text NOT NULL,
        button text,
        section text,
        location text,
        ip_address text,
        user_identifier text
      )
    `);
  };

  const ensureLoginEventsTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_events (
        id SERIAL PRIMARY KEY,
        user_id varchar NOT NULL REFERENCES users(id),
        timestamp timestamp DEFAULT now() NOT NULL
      )
    `);
  };

  const ensureUsersFrozenColumn = async () => {
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false
    `);
  };

  const ensureRecurringExpensesTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        amount numeric(10,2) NOT NULL,
        frequency text NOT NULL,
        category text NOT NULL DEFAULT 'wants',
        type text NOT NULL DEFAULT 'housing',
        enabled boolean NOT NULL DEFAULT true,
        created_at timestamp DEFAULT now()
      )
    `);
    await pool.query(`
      ALTER TABLE recurring_expenses
      ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'wants'
    `);
    await pool.query(`
      ALTER TABLE recurring_expenses
      ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'housing'
    `);
    await pool.query(`
      ALTER TABLE recurring_expenses
      ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true
    `);
  };

  const ensurePayPeriodExpensesTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pay_period_expenses (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        amount numeric(10,2) NOT NULL,
        category text NOT NULL DEFAULT 'wants',
        paid boolean NOT NULL DEFAULT false,
        source_recurring_expense_id varchar REFERENCES recurring_expenses(id),
        archived_at timestamp,
        created_at timestamp DEFAULT now()
      )
    `);
    await pool.query(`
      ALTER TABLE pay_period_expenses
      ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'wants'
    `);
    await pool.query(`
      ALTER TABLE pay_period_expenses
      ADD COLUMN IF NOT EXISTS paid boolean NOT NULL DEFAULT false
    `);
    await pool.query(`
      ALTER TABLE pay_period_expenses
      ADD COLUMN IF NOT EXISTS source_recurring_expense_id varchar REFERENCES recurring_expenses(id)
    `);
    await pool.query(`
      ALTER TABLE pay_period_expenses
      ADD COLUMN IF NOT EXISTS archived_at timestamp
    `);
  };

  const ensurePageContentTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS page_content (
        slug text PRIMARY KEY,
        content jsonb NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);

    const seeds: Array<{ slug: string; content: Record<string, unknown> }> = [
      {
        slug: "about",
        content: {
          title: "About BudgetWise",
          subtitle: "Your personal finance companion that helps you master the art of budgeting with the proven 50/30/20 rule.",
          smart: "Smart Analysis",
          smartBody: "Upload your bank statements and let our AI analyze your spending patterns. Get personalized insights on how your expenses align with the 50/30/20 budgeting rule.",
          privacy: "Privacy First",
          privacyBody: "Your financial data is processed securely and never shared with third parties. We believe your privacy is paramount when it comes to personal finance management.",
          insights: "Instant Insights",
          insightsBody: "Get immediate feedback on your spending habits with categorized expenses and actionable recommendations to improve your financial health.",
          built: "Built for Everyone",
          builtBody: "Whether you're just starting your financial journey or looking to optimize your budget, BudgetWise provides clear, actionable insights for all experience levels.",
          ruleTitle: "The 50/30/20 Rule",
          ruleIntro: "This simple framework helps you balance essentials, lifestyle, and long-term goals. It makes money decisions easier because every dollar has a job.",
          ruleWhy: "Why it matters",
          ruleWhyBody: "Clear buckets reduce stress, reveal overspending early, and keep savings consistent. It's a practical baseline that works with most incomes.",
          needsTitle: "Needs",
          needsBody: "Essential expenses like rent, groceries, utilities, and minimum debt payments",
          wantsTitle: "Wants",
          wantsBody: "Non-essential expenses like entertainment, dining out, and hobbies",
          savingsTitle: "Savings",
          savingsBody: "Money saved, invested, or put toward debt payments above minimums",
        },
      },
      {
        slug: "how-it-works",
        content: {
          title: "How BudgetWise Works",
          subtitle: "From bank statement to a clear budget plan in four simple steps.",
          step1Title: "1. Create your account",
          step1Body: "Sign up in seconds and tell us your monthly income to set your baseline.",
          step2Title: "2. Upload your statement",
          step2Body: "Upload an excel file with your transactions and our AI automatically categorizes every transaction.",
          step3Title: "3. Get your 50/30/20 breakdown",
          step3Body: "See exactly how your spending compares to the recommended needs, wants, and savings split.",
          step4Title: "4. Track and improve",
          step4Body: "Manage recurring expenses, pay down debt, and revisit your analysis anytime to track your progress.",
          step5Title: "5. Security and Privacy first",
          step5Body: "My main concern is privacy, everything is encrypted, and we do not sell your data.",
          ctaTitle: "Ready to take control of your budget?",
          ctaBody: "Create a free account and upload your first statement today.",
          ctaButton: "Get Started",
        },
      },
      {
        slug: "privacy",
        content: {
          title: "Privacy Policy",
          updated: "Last updated: January 2025",
          s1Title: "1. Information We Collect",
          s1Body: "We collect information you provide directly to us, such as when you create an account, upload financial documents, or contact support.",
          s2Title: "2. How We Use Information",
          s2Body: "We use your information to provide, maintain, and improve our services:",
          s2List: [
            "Process and analyze your uploaded financial data",
            "Provide personalized budget recommendations",
            "Improve our AI analysis algorithms and service features",
            "Communicate important service updates",
          ],
          s3Title: "3. Data Storage and Security",
          s3Body: "We implement appropriate security measures to protect your information. Your data is stored securely and accessed only by authorized systems.",
          s4Title: "4. Data Sharing",
          s4Body: "We do not sell or share your personal financial data with third parties. We only share data when required by law or to provide our services.",
          s5Title: "5. Your Rights",
          s5Body: "You have the right to access, update, or delete your data. Contact support if you want to exercise these rights.",
          s6Title: "6. Cookies",
          s6Body: "We use cookies to keep you signed in and improve the user experience.",
          s7Title: "7. Contact",
          s7Body: "If you have questions about this Privacy Policy, please contact us through the support channels provided in the application.",
        },
      },
    ];

    for (const seed of seeds) {
      await pool.query(
        `INSERT INTO page_content (slug, content)
         VALUES ($1, $2)
         ON CONFLICT (slug) DO NOTHING`,
        [seed.slug, JSON.stringify(seed.content)]
      );
    }
  };

  const ensureIncomesTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS incomes (
        user_id varchar PRIMARY KEY REFERENCES users(id),
        main_income numeric(10,2) NOT NULL DEFAULT 0,
        other_incomes jsonb NOT NULL DEFAULT '[]'::jsonb,
        needs numeric(10,2) NOT NULL DEFAULT 0,
        wants numeric(10,2) NOT NULL DEFAULT 0,
        savings numeric(10,2) NOT NULL DEFAULT 0,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
  };

  const ensureActualExpenseSetsTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS actual_expense_sets (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        name text NOT NULL,
        items jsonb NOT NULL DEFAULT '[]'::jsonb,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      )
    `);
  };

  const ensureSmartAnalysisResultsTable = async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS smart_analysis_results (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
        user_id varchar NOT NULL REFERENCES users(id),
        actual_expense_set_id varchar REFERENCES actual_expense_sets(id),
        include_fifty_thirty_twenty boolean NOT NULL DEFAULT true,
        include_monthly_expenses boolean NOT NULL DEFAULT true,
        snapshot jsonb NOT NULL,
        recommendations text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      )
    `);
    await pool.query(`
      ALTER TABLE smart_analysis_results
      ADD COLUMN IF NOT EXISTS legacy_analysis_id varchar REFERENCES budget_analyses(id)
    `);
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS smart_analysis_results_legacy_analysis_id_idx
      ON smart_analysis_results (legacy_analysis_id)
      WHERE legacy_analysis_id IS NOT NULL
    `);
    await migrateLegacyBudgetAnalyses();
  };

  // Maps the old free-form AI "subcategory" strings to the new fixed expense-item category enum.
  const LEGACY_SUBCATEGORY_TO_CATEGORY: Record<string, schema.ExpenseItemCategory> = {
    groceries: "groceries",
    gas: "gas",
    dining: "restaurant",
    restaurant: "restaurant",
    entertainment: "entertainment",
    netflix: "entertainment",
    subscriptions: "entertainment",
    shopping: "clothes",
    savings: "savings",
    investment: "savings",
    transfer: "savings",
    deposit: "savings",
    "extra debt payment": "savings",
  };

  const LEGACY_CATEGORY_TO_TYPE: Record<string, schema.ExpenseItemType> = {
    "50%": "needs",
    "30%": "wants",
    "20%": "savings",
    undefined: "other",
  };

  // One-time, idempotent migration: copies completed pre-redesign budget_analyses
  // reports into the new actual_expense_sets / smart_analysis_results tables so
  // they remain visible in the Smart Analysis history. Old rows are left in place.
  const migrateLegacyBudgetAnalyses = async () => {
    const { rows: legacyRows } = await pool.query(`
      SELECT ba.* FROM budget_analyses ba
      WHERE ba.analysis_status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM smart_analysis_results sar WHERE sar.legacy_analysis_id = ba.id
        )
    `);

    for (const row of legacyRows) {
      let legacyItems: Array<{ description?: string; amount?: number | string; category?: string; subcategory?: string }> = [];
      try {
        const decrypted = row.expenses ? decrypt(row.expenses) : null;
        const parsed = decrypted ? JSON.parse(decrypted) : [];
        legacyItems = Array.isArray(parsed) ? parsed : [];
      } catch {
        legacyItems = [];
      }

      const items: schema.ExpenseItem[] = legacyItems.map((item) => ({
        date: "",
        description: item.description ?? "",
        business: "",
        amount: String(item.amount ?? "0"),
        category: LEGACY_SUBCATEGORY_TO_CATEGORY[item.subcategory ?? ""] ?? "other",
        type: LEGACY_CATEGORY_TO_TYPE[item.category ?? ""] ?? "other",
      }));

      const uploadDate = row.upload_date ? new Date(row.upload_date) : new Date();
      const [expenseSet] = (
        await pool.query(
          `INSERT INTO actual_expense_sets (user_id, name, items)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [row.user_id, `Imported - ${row.original_file_name || uploadDate.toLocaleDateString()}`, JSON.stringify(items)]
        )
      ).rows;

      let recommendations = "";
      try {
        recommendations = row.recommendations ? decrypt(row.recommendations) : "";
      } catch {
        recommendations = "";
      }

      const snapshot = {
        items,
        fiftyThirtyTwenty: {
          needs: Number(row.recommended_needs ?? 0),
          wants: Number(row.recommended_wants ?? 0),
          savings: Number(row.recommended_savings ?? 0),
          monthlyIncome: Number(row.monthly_income ?? 0),
        },
        monthlyExpenses: null,
      };

      await pool.query(
        `INSERT INTO smart_analysis_results
           (user_id, actual_expense_set_id, include_fifty_thirty_twenty, include_monthly_expenses, snapshot, recommendations, created_at, legacy_analysis_id)
         VALUES ($1, $2, true, false, $3, $4, $5, $6)`,
        [row.user_id, expenseSet.id, JSON.stringify(snapshot), recommendations, uploadDate, row.id]
      );
    }

    if (legacyRows.length > 0) {
      console.log(`Migrated ${legacyRows.length} legacy budget analysis report(s) into smart_analysis_results.`);
    }
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
    await ensureSiteVisitsTable();
    await ensureLoginEventsTable();
    await ensureUsersFrozenColumn();
    await ensureAnalysisIntelligenceTables();
    await ensureRecurringExpensesTable();
    await ensurePayPeriodExpensesTable();
    await ensurePageContentTable();
    await ensureIncomesTable();
    await ensureActualExpenseSetsTable();
    await ensureSmartAnalysisResultsTable();
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
      await ensureSiteVisitsTable();
      await ensureLoginEventsTable();
      await ensureUsersFrozenColumn();
      await ensureAnalysisIntelligenceTables();
      await ensureRecurringExpensesTable();
      await ensurePayPeriodExpensesTable();
      await ensurePageContentTable();
      await ensureIncomesTable();
      await ensureActualExpenseSetsTable();
      await ensureSmartAnalysisResultsTable();
      return;
    }

    if (hasUsersTable) {
      await ensureAppVersionsTable();
      await ensureAdminTable();
      await ensureSiteVisitsTable();
      await ensureLoginEventsTable();
      await ensureUsersFrozenColumn();
      await ensureAnalysisIntelligenceTables();
      await ensureRecurringExpensesTable();
      await ensurePayPeriodExpensesTable();
      await ensurePageContentTable();
      await ensureIncomesTable();
      await ensureActualExpenseSetsTable();
      await ensureSmartAnalysisResultsTable();
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
      await ensureSiteVisitsTable();
      await ensureLoginEventsTable();
      await ensureUsersFrozenColumn();
      await ensureAnalysisIntelligenceTables();
      await ensureRecurringExpensesTable();
      await ensurePayPeriodExpensesTable();
      await ensurePageContentTable();
      await ensureIncomesTable();
      await ensureActualExpenseSetsTable();
      await ensureSmartAnalysisResultsTable();
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
    await ensureSiteVisitsTable();
    await ensureLoginEventsTable();
    await ensureUsersFrozenColumn();
    await ensureAnalysisIntelligenceTables();
    await ensureRecurringExpensesTable();
    await ensurePayPeriodExpensesTable();
    await ensurePageContentTable();
    await ensureIncomesTable();
    await ensureActualExpenseSetsTable();
    await ensureSmartAnalysisResultsTable();
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
