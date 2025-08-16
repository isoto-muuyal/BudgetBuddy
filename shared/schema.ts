import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
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
  expenses: jsonb("expenses").$type<Array<{
    description: string;
    amount: number;
    category: '50%' | '30%' | '20%' | 'undefined';
    subcategory?: string;
  }>>(),
  recommendations: text("recommendations"),
  analysisStatus: text("analysis_status").default("pending"), // pending, completed, failed
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
  monthlyIncome: z.string().transform((val) => parseFloat(val)),
});

export const insertBudgetAnalysisSchema = createInsertSchema(budgetAnalyses).omit({
  id: true,
  uploadDate: true,
  analysisStatus: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginUser = z.infer<typeof loginSchema>;
export type SignupUser = z.infer<typeof signupSchema>;
export type IncomeInput = z.infer<typeof incomeSchema>;
export type BudgetAnalysis = typeof budgetAnalyses.$inferSelect;
export type InsertBudgetAnalysis = z.infer<typeof insertBudgetAnalysisSchema>;
