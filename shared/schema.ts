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

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters long."),
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
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type AppVersion = typeof appVersions.$inferSelect;
export type Admin = typeof admins.$inferSelect;
