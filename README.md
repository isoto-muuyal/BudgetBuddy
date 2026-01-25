# BudgetBuddy
BudgetBody is an app that will help you analyze your expenses and help you stay in the 50/30/20 budget rule

REQUIREMENTS:

- Node.js (v18 or higher)
- PostgreSQL (v13 or higher)
- Ollama (for AI analysis)

SCREENS:

Sign up
Log in
Dashboard
- Overview of expenses
- Add expense
- Edit expense
- Delete expense
- AI analysis of expenses

## Manual DB Setup (PostgreSQL)

If you need to create tables manually:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
);

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
);

CREATE TABLE IF NOT EXISTS debts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  monthly_payment numeric(10,2) NOT NULL,
  created_at timestamp DEFAULT now()
);
```
