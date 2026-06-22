import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  password: text("password").notNull(),
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }),
  emailVerified: boolean("email_verified").default(false),
  verificationToken: text("verification_token"),
  createdAt: timestamp("created_at").defaultNow(),
  passwordResetToken: text("password_reset_token"),
  passwordResetExpiry: timestamp("password_reset_expiry"),
});

export const budgetAnalyses = pgTable("budget_analyses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  originalFileName: text("original_file_name").notNull(),
  uploadDate: timestamp("upload_date").defaultNow(),
  monthlyIncome: decimal("monthly_income", { precision: 10, scale: 2 }).notNull(),
  recommendedNeeds: decimal("recommended_needs", { precision: 10, scale: 2 }).notNull(),
  recommendedWants: decimal("recommended_wants", { precision: 10, scale: 2 }).notNull(),
  recommendedSavings: decimal("recommended_savings", { precision: 10, scale: 2 }).notNull(),
  actualNeeds: decimal("actual_needs", { precision: 10, scale: 2 }),
  actualWants: decimal("actual_wants", { precision: 10, scale: 2 }),
  actualSavings: decimal("actual_savings", { precision: 10, scale: 2 }),
  actualUndefined: decimal("actual_undefined", { precision: 10, scale: 2 }),
  expenses: text("expenses"), // encrypted JSON string
  recommendations: text("recommendations"),
  analysisStatus: text("analysis_status").default("pending"), // pending, completed, failed
});

export const analysisEmbeddings = pgTable("analysis_embeddings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  analysisId: varchar("analysis_id").notNull().references(() => budgetAnalyses.id).unique(),
  summary: text("summary").notNull(),
  embedding: text("embedding").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const globalAdviceSnapshots = pgTable("global_advice_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  analysisId: varchar("analysis_id").notNull().references(() => budgetAnalyses.id),
  advice: text("advice").notNull(),
  progressStatus: text("progress_status").notNull(),
  supportingAnalysisIds: text("supporting_analysis_ids").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const debts = pgTable("debts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const RECURRING_EXPENSE_FREQUENCIES = [
  "daily",
  "weekly",
  "bi_weekly",
  "monthly",
  "semi_monthly",
  "bi_monthly",
  "yearly",
] as const;

export type RecurringExpenseFrequency = (typeof RECURRING_EXPENSE_FREQUENCIES)[number];

export const RECURRING_EXPENSE_CATEGORIES = ["needs", "wants", "savings"] as const;

export type RecurringExpenseCategory = (typeof RECURRING_EXPENSE_CATEGORIES)[number];

export const RECURRING_EXPENSE_TYPES = [
  "housing",
  "food",
  "eating_out",
  "savings",
  "credit_payment",
  "vacations",
  "electronics",
  "coffee",
  "mobility",
] as const;

export type RecurringExpenseType = (typeof RECURRING_EXPENSE_TYPES)[number];

export const recurringExpenses = pgTable("recurring_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  frequency: text("frequency").notNull(),
  category: text("category").notNull().default("wants"),
  type: text("type").notNull().default("housing"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const appVersions = pgTable("app_versions", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const admins = pgTable("ADMIN", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const pageContent = pgTable("page_content", {
  slug: text("slug").primaryKey(),
  content: jsonb("content").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  emailVerified: true,
  verificationToken: true,
  createdAt: true,
});

export const loginSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
});

export const signupSchema = createInsertSchema(users).pick({
  email: true,
  fullName: true,
  password: true,
});

export const incomeSchema = z.object({
  monthlyIncome: z.string().min(1, "Monthly income is required"),
});

export const insertBudgetAnalysisSchema = createInsertSchema(budgetAnalyses).omit({
  id: true,
  uploadDate: true,
  analysisStatus: true,
});

export const insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const debtInputSchema = z.object({
  name: z.string().min(1, "Debt name is required"),
  totalAmount: z.string().min(1, "Total amount is required"),
  monthlyPayment: z.string().min(1, "Monthly payment is required"),
  interestRate: z.string().min(1, "Interest rate is required"),
});

export const debtUpdateSchema = z.object({
  interestRate: z.string().min(1, "Interest rate is required"),
});

export const insertRecurringExpenseSchema = createInsertSchema(recurringExpenses).omit({
  id: true,
  createdAt: true,
  userId: true,
});

export const recurringExpenseInputSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.string().min(1, "Amount is required"),
  frequency: z.enum(RECURRING_EXPENSE_FREQUENCIES),
  category: z.enum(RECURRING_EXPENSE_CATEGORIES),
  type: z.enum(RECURRING_EXPENSE_TYPES),
});

export const recurringExpenseUpdateSchema = recurringExpenseInputSchema;

export const recurringExpenseToggleSchema = z.object({
  enabled: z.boolean(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters long."),
});

export const contactFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(1, "Message is required"),
});

export const PAGE_CONTENT_SLUGS = ["about", "how-it-works", "privacy"] as const;

export type PageContentSlug = (typeof PAGE_CONTENT_SLUGS)[number];

export const pageContentUpdateSchema = z.object({
  content: z.record(z.string(), z.any()),
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type SignupUser = z.infer<typeof signupSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type BudgetAnalysis = typeof budgetAnalyses.$inferSelect;
export type InsertBudgetAnalysis = z.infer<typeof insertBudgetAnalysisSchema>;
export type AnalysisEmbedding = typeof analysisEmbeddings.$inferSelect;
export type GlobalAdviceSnapshot = typeof globalAdviceSnapshots.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type InsertDebt = z.infer<typeof insertDebtSchema>;
export type RecurringExpense = typeof recurringExpenses.$inferSelect;
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;
export type RecurringExpenseInput = z.infer<typeof recurringExpenseInputSchema>;
export type RecurringExpenseToggleInput = z.infer<typeof recurringExpenseToggleSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type AppVersion = typeof appVersions.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type PageContent = typeof pageContent.$inferSelect;
export type PageContentUpdateInput = z.infer<typeof pageContentUpdateSchema>;
