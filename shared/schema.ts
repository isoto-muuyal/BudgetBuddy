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
  passwordResetRequestedAt: timestamp("password_reset_requested_at"),
  temporaryPasswordHash: text("temporary_password_hash"),
  temporaryPasswordUsedAt: timestamp("temporary_password_used_at"),
  forcePasswordChange: boolean("force_password_change").notNull().default(false),
  frozen: boolean("frozen").notNull().default(false),
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
  month: text("month").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payPeriodExpenses = pgTable("pay_period_expenses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  category: text("category").notNull().default("wants"),
  paid: boolean("paid").notNull().default(false),
  sourceRecurringExpenseId: varchar("source_recurring_expense_id").references(() => recurringExpenses.id),
  archivedAt: timestamp("archived_at"),
  month: text("month").notNull(),
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

export const siteVisits = pgTable("site_visits", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  page: text("page").notNull(),
  button: text("button"),
  section: text("section"),
  location: text("location"),
  ipAddress: text("ip_address"),
  userIdentifier: text("user_identifier"),
  visitorId: text("visitor_id"),
});

export const trustedVisitors = pgTable("trusted_visitors", {
  identifier: text("identifier").primaryKey(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const loginEvents = pgTable("login_events", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
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

export const MONTH_KEY_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export const monthKeySchema = z.string().regex(MONTH_KEY_REGEX, "Invalid month, expected YYYY-MM");

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
  month: monthKeySchema,
});

export const recurringExpenseUpdateSchema = recurringExpenseInputSchema;

export const recurringExpenseToggleSchema = z.object({
  enabled: z.boolean(),
});

export const recurringExpenseImportSchema = z.object({
  fromMonth: monthKeySchema,
  toMonth: monthKeySchema,
});

export const insertPayPeriodExpenseSchema = createInsertSchema(payPeriodExpenses).omit({
  id: true,
  createdAt: true,
  userId: true,
  archivedAt: true,
});

export const payPeriodExpenseInputSchema = z.object({
  name: z.string().min(1, "Expense name is required"),
  amount: z.string().min(1, "Amount is required"),
  category: z.enum(RECURRING_EXPENSE_CATEGORIES),
  sourceRecurringExpenseId: z.string().optional().nullable(),
  month: monthKeySchema,
});

export const payPeriodExpenseUpdateSchema = payPeriodExpenseInputSchema;

export const payPeriodExpenseToggleSchema = z.object({
  paid: z.boolean(),
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

export const otherIncomeEntrySchema = z.object({
  label: z.string().min(1, "Label is required"),
  amount: z.string().min(1, "Amount is required"),
});

export type OtherIncomeEntry = z.infer<typeof otherIncomeEntrySchema>;

export const incomeBreakdownInputSchema = z.object({
  mainIncome: z.string().min(1, "Main income is required"),
  otherIncomes: z.array(otherIncomeEntrySchema).default([]),
});

export type IncomeBreakdownInput = z.infer<typeof incomeBreakdownInputSchema>;

export const incomes = pgTable("incomes", {
  userId: varchar("user_id").primaryKey().references(() => users.id),
  mainIncome: decimal("main_income", { precision: 10, scale: 2 }).notNull().default("0"),
  otherIncomes: jsonb("other_incomes").notNull().default(sql`'[]'::jsonb`),
  needs: decimal("needs", { precision: 10, scale: 2 }).notNull().default("0"),
  wants: decimal("wants", { precision: 10, scale: 2 }).notNull().default("0"),
  savings: decimal("savings", { precision: 10, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type IncomeBreakdown = typeof incomes.$inferSelect;

export const EXPENSE_ITEM_TYPES = ["needs", "wants", "savings", "other"] as const;

export type ExpenseItemType = (typeof EXPENSE_ITEM_TYPES)[number];

export const EXPENSE_ITEM_CATEGORIES = [
  "restaurant",
  "entertainment",
  "movies",
  "clothes",
  "groceries",
  "gas",
  "savings",
  "other",
] as const;

export type ExpenseItemCategory = (typeof EXPENSE_ITEM_CATEGORIES)[number];

export const expenseItemSchema = z.object({
  date: z.string().optional().default(""),
  description: z.string().default(""),
  business: z.string().default(""),
  amount: z.string().default("0"),
  category: z.enum(EXPENSE_ITEM_CATEGORIES).default("other"),
  type: z.enum(EXPENSE_ITEM_TYPES).default("other"),
});

export type ExpenseItem = z.infer<typeof expenseItemSchema>;

export const actualExpenseSets = pgTable("actual_expense_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const actualExpenseSetUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  items: z.array(expenseItemSchema),
});

export type ActualExpenseSet = typeof actualExpenseSets.$inferSelect;
export type ActualExpenseSetUpdateInput = z.infer<typeof actualExpenseSetUpdateSchema>;

export const smartAnalysisResults = pgTable("smart_analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  actualExpenseSetId: varchar("actual_expense_set_id").references(() => actualExpenseSets.id),
  includeFiftyThirtyTwenty: boolean("include_fifty_thirty_twenty").notNull().default(true),
  includeMonthlyExpenses: boolean("include_monthly_expenses").notNull().default(true),
  snapshot: jsonb("snapshot").notNull(),
  recommendations: text("recommendations").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const smartAnalysisRequestSchema = z.object({
  actualExpenseSetId: z.string().min(1, "Select an actual expenses set"),
  includeFiftyThirtyTwenty: z.boolean().default(true),
  includeMonthlyExpenses: z.boolean().default(true),
});

export type SmartAnalysisResult = typeof smartAnalysisResults.$inferSelect;
export type SmartAnalysisRequestInput = z.infer<typeof smartAnalysisRequestSchema>;

export const quickExpenseNotes = pgTable("quick_expense_notes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  description: text("description").notNull(),
  items: jsonb("items").notNull().default(sql`'[]'::jsonb`),
  aiReview: text("ai_review"),
  aiReviewContext: text("ai_review_context"),
  aiReviewedAt: timestamp("ai_reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quickNoteItemSchema = z.object({
  name: z.string().default(""),
  amount: z.string().default(""),
  paidAmount: z.string().optional().default(""),
  dueDate: z.string().optional().default(""),
});

export type QuickNoteItem = z.infer<typeof quickNoteItemSchema>;

export const quickNoteInputSchema = z.object({
  description: z.string().default(""),
  items: z.array(quickNoteItemSchema).default([]),
});

export const quickNoteReviewRequestSchema = z.object({
  context: z.string().optional().default(""),
});

export type QuickExpenseNote = typeof quickExpenseNotes.$inferSelect;
export type QuickNoteInput = z.infer<typeof quickNoteInputSchema>;
export type QuickNoteReviewRequestInput = z.infer<typeof quickNoteReviewRequestSchema>;

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
export type RecurringExpenseImportInput = z.infer<typeof recurringExpenseImportSchema>;
export type PayPeriodExpense = typeof payPeriodExpenses.$inferSelect;
export type InsertPayPeriodExpense = z.infer<typeof insertPayPeriodExpenseSchema>;
export type PayPeriodExpenseInput = z.infer<typeof payPeriodExpenseInputSchema>;
export type PayPeriodExpenseToggleInput = z.infer<typeof payPeriodExpenseToggleSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ContactFormInput = z.infer<typeof contactFormSchema>;
export type AppVersion = typeof appVersions.$inferSelect;
export type Admin = typeof admins.$inferSelect;
export type SiteVisit = typeof siteVisits.$inferSelect;
export type TrustedVisitor = typeof trustedVisitors.$inferSelect;
export type LoginEvent = typeof loginEvents.$inferSelect;
export type PageContent = typeof pageContent.$inferSelect;
export type PageContentUpdateInput = z.infer<typeof pageContentUpdateSchema>;
