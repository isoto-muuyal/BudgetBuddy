import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  users,
  budgetAnalyses,
  debts,
  recurringExpenses,
  payPeriodExpenses,
  appVersions,
  admins,
  analysisEmbeddings,
  globalAdviceSnapshots,
  pageContent,
  incomes,
  actualExpenseSets,
  smartAnalysisResults,
  quickExpenseNotes,
  siteVisits,
  trustedVisitors,
  loginEvents,
  type User,
  type InsertUser,
  type BudgetAnalysis,
  type InsertBudgetAnalysis,
  type Debt,
  type InsertDebt,
  type RecurringExpense,
  type InsertRecurringExpense,
  type PayPeriodExpense,
  type InsertPayPeriodExpense,
  type AppVersion,
  type Admin,
  type PageContent,
  type IncomeBreakdown,
  type IncomeBreakdownInput,
  type ExpenseItem,
  type ActualExpenseSet,
  type SmartAnalysisResult,
  type QuickExpenseNote,
  type QuickNoteItem,
  type SiteVisit,
  type TrustedVisitor,
} from "@shared/schema";
import { db } from "./db";
import { and, count, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { encrypt, decrypt } from "./utils/encryption";

export type StoredBudgetAnalysis = Omit<BudgetAnalysis, "expenses" | "recommendations"> & {
  expenses: unknown[];
  recommendations: string | null;
};

export interface AnalysisEmbeddingRecord {
  id: string;
  userId: string;
  analysisId: string;
  summary: string;
  embedding: number[];
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface GlobalAdviceSnapshotRecord {
  id: string;
  userId: string;
  analysisId: string;
  advice: string;
  progressStatus: string;
  supportingAnalysisIds: string[];
  createdAt: Date | null;
}

export interface AdminUserRecord {
  id: string;
  email: string;
  frozen: boolean;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  passwordResetRequestedAt: Date | null;
}

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { verificationToken?: string; emailVerified?: boolean }): Promise<User>;
  updateUserIncome(userId: string, monthlyIncome: string): Promise<User>;
  verifyUserEmail(userId: string): Promise<void>;
  setPasswordResetToken(userId: string, token: string, expiry: Date): Promise<void>;
  resetPassword(userId: string, newPassword: string): Promise<void>;
  setTemporaryPassword(userId: string, temporaryPasswordHash: string): Promise<void>;
  consumeTemporaryPassword(userId: string): Promise<void>;
  completeForcedPasswordChange(userId: string, newPassword: string): Promise<void>;
  recordLogin(userId: string): Promise<void>;

  // Admin user management methods
  listUsersForAdmin(): Promise<AdminUserRecord[]>;
  setUserFrozen(userId: string, frozen: boolean): Promise<void>;
  deleteUserCascade(userId: string): Promise<void>;
  getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalLogins: number;
    loginsLast7Days: number;
    loginsLast30Days: number;
  }>;

  // Budget analysis methods
  getBudgetAnalysis(id: string): Promise<StoredBudgetAnalysis | undefined>;
  getBudgetAnalysesByUser(userId: string): Promise<StoredBudgetAnalysis[]>;
  getCompletedBudgetAnalysesByUser(userId: string): Promise<StoredBudgetAnalysis[]>;
  createBudgetAnalysis(analysis: InsertBudgetAnalysis): Promise<StoredBudgetAnalysis>;
  updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<StoredBudgetAnalysis>;
  upsertAnalysisEmbedding(input: {
    userId: string;
    analysisId: string;
    summary: string;
    embedding: number[];
  }): Promise<AnalysisEmbeddingRecord>;
  getAnalysisEmbeddingsByUser(userId: string): Promise<AnalysisEmbeddingRecord[]>;
  createGlobalAdviceSnapshot(input: {
    userId: string;
    analysisId: string;
    advice: string;
    progressStatus: string;
    supportingAnalysisIds: string[];
  }): Promise<GlobalAdviceSnapshotRecord>;
  getLatestGlobalAdviceByUser(userId: string): Promise<GlobalAdviceSnapshotRecord | undefined>;

  // Debt methods
  getDebtsByUser(userId: string): Promise<Debt[]>;
  createDebt(userId: string, debt: InsertDebt): Promise<Debt>;
  updateDebtInterestRate(userId: string, debtId: string, interestRate: string): Promise<Debt>;
  deleteDebt(userId: string, debtId: string): Promise<void>;

  // Recurring expense methods
  getRecurringExpensesByUser(userId: string, month: string): Promise<RecurringExpense[]>;
  createRecurringExpense(userId: string, expense: InsertRecurringExpense): Promise<RecurringExpense>;
  updateRecurringExpense(userId: string, expenseId: string, expense: InsertRecurringExpense): Promise<RecurringExpense>;
  toggleRecurringExpense(userId: string, expenseId: string, enabled: boolean): Promise<RecurringExpense>;
  deleteRecurringExpense(userId: string, expenseId: string): Promise<void>;
  copyRecurringExpensesToMonth(userId: string, fromMonth: string, toMonth: string): Promise<RecurringExpense[]>;

  // Pay period expense methods
  getPayPeriodExpensesByUserAndMonth(userId: string, month: string): Promise<PayPeriodExpense[]>;
  createPayPeriodExpense(userId: string, expense: InsertPayPeriodExpense): Promise<PayPeriodExpense>;
  updatePayPeriodExpense(userId: string, expenseId: string, expense: InsertPayPeriodExpense): Promise<PayPeriodExpense>;
  togglePayPeriodExpense(userId: string, expenseId: string, paid: boolean): Promise<PayPeriodExpense>;
  deletePayPeriodExpense(userId: string, expenseId: string): Promise<void>;

  // App version methods
  getLatestAppVersion(): Promise<AppVersion>;
  bumpAppVersion(): Promise<AppVersion>;

  // Admin methods
  getAdminByUsername(username: string): Promise<Admin | undefined>;

  // Site visit methods
  trackVisit(entry: {
    timestamp: Date;
    page: string;
    button: string;
    section: string;
    location: string;
    ipAddress: string;
    userIdentifier: string;
    visitorId: string;
  }): Promise<void>;
  getVisits(params?: { limit: number; offset: number }): Promise<SiteVisit[]>;
  getVisitsCount(): Promise<number>;
  getVisitStats(): Promise<{
    topPages: Array<{ name: string; count: number }>;
    topButtons: Array<{ name: string; count: number }>;
    uniqueUsers: number;
  }>;
  getDailyVisitHistory(days?: number): Promise<Array<{ date: string; totalVisits: number; uniqueVisitors: number }>>;
  getWeeklyVisitTotals(weeks?: number): Promise<Array<{ weekStart: string; totalVisits: number }>>;
  getVisitHistory(params: {
    from: Date;
    to: Date;
    granularity: "hour" | "day";
  }): Promise<Array<{ bucket: string; totalVisits: number; uniqueVisitors: number }>>;
  getRepeatVisitorAlerts(days?: number): Promise<Array<{ date: string; identifier: string; ipAddress: string; visits: number }>>;
  listTrustedVisitors(): Promise<TrustedVisitor[]>;
  addTrustedVisitor(identifier: string, note?: string): Promise<TrustedVisitor>;
  removeTrustedVisitor(identifier: string): Promise<void>;

  // Page content methods
  getPageContent(slug: string): Promise<PageContent | undefined>;
  upsertPageContent(slug: string, content: Record<string, unknown>): Promise<PageContent>;

  // Income (50/30/20) methods
  getIncome(userId: string): Promise<IncomeBreakdown | undefined>;
  upsertIncome(
    userId: string,
    input: IncomeBreakdownInput,
    computed: { needs: string; wants: string; savings: string }
  ): Promise<IncomeBreakdown>;

  // Actual expense set methods
  listActualExpenseSets(userId: string): Promise<ActualExpenseSet[]>;
  getActualExpenseSet(userId: string, id: string): Promise<ActualExpenseSet | undefined>;
  createActualExpenseSet(userId: string, name: string, items: ExpenseItem[]): Promise<ActualExpenseSet>;
  updateActualExpenseSet(
    userId: string,
    id: string,
    updates: { name?: string; items: ExpenseItem[] }
  ): Promise<ActualExpenseSet>;

  // Smart analysis result methods
  listSmartAnalysisResults(userId: string): Promise<SmartAnalysisResult[]>;
  getSmartAnalysisResult(userId: string, id: string): Promise<SmartAnalysisResult | undefined>;
  createSmartAnalysisResult(
    userId: string,
    data: {
      actualExpenseSetId: string | null;
      includeFiftyThirtyTwenty: boolean;
      includeMonthlyExpenses: boolean;
      snapshot: Record<string, unknown>;
      recommendations: string;
    }
  ): Promise<SmartAnalysisResult>;
  getLatestSmartAnalysisResult(userId: string): Promise<SmartAnalysisResult | undefined>;

  // Quick expense note methods
  listQuickNotes(userId: string): Promise<QuickExpenseNote[]>;
  getQuickNote(userId: string, id: string): Promise<QuickExpenseNote | undefined>;
  createQuickNote(userId: string, description: string, items: QuickNoteItem[]): Promise<QuickExpenseNote>;
  updateQuickNote(
    userId: string,
    id: string,
    updates: { description: string; items: QuickNoteItem[] }
  ): Promise<QuickExpenseNote>;
  deleteQuickNote(userId: string, id: string): Promise<void>;
  saveQuickNoteReview(
    userId: string,
    id: string,
    review: { review: string; context: string }
  ): Promise<QuickExpenseNote>;
}

export class DatabaseStorage implements IStorage {
  private looksEncrypted(value: string): boolean {
    return /^[0-9a-f]{32}:[0-9a-f]+$/i.test(value);
  }

  private decryptString(value: string | null): string | null {
    if (!value) return value;
    const decrypted = decrypt(value);
    if (decrypted === value && this.looksEncrypted(value)) {
      return null;
    }
    return decrypted;
  }

  private serializeExpenses(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  private encryptExpenses(value: unknown): string | null {
    const serialized = this.serializeExpenses(value);
    if (!serialized) return null;
    return encrypt(serialized);
  }

  private decryptExpenses(value: string | null): unknown[] {
    if (!value) return [];
    const decrypted = this.decryptString(value);
    if (!decrypted) return [];
    try {
      const parsed = JSON.parse(decrypted);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      if (decrypted === value && this.looksEncrypted(value)) {
        return [];
      }
      return [];
    }
  }

  private serializeEmbedding(value: number[] | string): string {
    if (typeof value === "string") return value;
    return JSON.stringify(value);
  }

  private deserializeEmbedding(value: string): number[] {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => Number(item) || 0) : [];
    } catch {
      return [];
    }
  }

  private serializeStringArray(value: string[]): string {
    return JSON.stringify(value);
  }

  private deserializeStringArray(value: string | null): string[] {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      return [];
    }
  }

  private toEmbeddingRecord(record: typeof analysisEmbeddings.$inferSelect): AnalysisEmbeddingRecord {
    return {
      ...record,
      summary: this.decryptString(record.summary) || "",
      embedding: this.deserializeEmbedding(record.embedding),
    };
  }

  private toGlobalAdviceRecord(record: typeof globalAdviceSnapshots.$inferSelect): GlobalAdviceSnapshotRecord {
    return {
      ...record,
      advice: this.decryptString(record.advice) || "",
      supportingAnalysisIds: this.deserializeStringArray(record.supportingAnalysisIds),
    };
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email.trim().toLowerCase()));
    return user || undefined;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { verificationToken?: string; emailVerified?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, email: insertUser.email.trim().toLowerCase() })
      .returning();
    return user;
  }

  async updateUserIncome(userId: string, monthlyIncome: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ monthlyIncome })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }

  async verifyUserEmail(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ emailVerified: true, verificationToken: null })
      .where(eq(users.id, userId));
  }

  async getUserByPasswordResetToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.passwordResetToken, token));
    return user || undefined;
  }

  async setPasswordResetToken(userId: string, token: string, expiry: Date): Promise<void> {
    await db
      .update(users)
      .set({ passwordResetToken: token, passwordResetExpiry: expiry, passwordResetRequestedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: newPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        temporaryPasswordHash: null,
        forcePasswordChange: false,
      })
      .where(eq(users.id, userId));
  }

  async setTemporaryPassword(userId: string, temporaryPasswordHash: string): Promise<void> {
    await db
      .update(users)
      .set({
        temporaryPasswordHash,
        temporaryPasswordUsedAt: null,
        forcePasswordChange: true,
      })
      .where(eq(users.id, userId));
  }

  async consumeTemporaryPassword(userId: string): Promise<void> {
    await db
      .update(users)
      .set({
        temporaryPasswordHash: null,
        temporaryPasswordUsedAt: new Date(),
        forcePasswordChange: true,
      })
      .where(eq(users.id, userId));
  }

  async completeForcedPasswordChange(userId: string, newPassword: string): Promise<void> {
    await db
      .update(users)
      .set({
        password: newPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
        temporaryPasswordHash: null,
        forcePasswordChange: false,
      })
      .where(eq(users.id, userId));
  }

  async recordLogin(userId: string): Promise<void> {
    await db.insert(loginEvents).values({ userId });
  }

  async listUsersForAdmin(): Promise<AdminUserRecord[]> {
    return db
      .select({
        id: users.id,
        email: users.email,
        frozen: users.frozen,
        createdAt: users.createdAt,
        lastLoginAt: sql<Date | null>`max(${loginEvents.timestamp})`,
        passwordResetRequestedAt: users.passwordResetRequestedAt,
      })
      .from(users)
      .leftJoin(loginEvents, eq(loginEvents.userId, users.id))
      .groupBy(users.id, users.email, users.frozen, users.createdAt, users.passwordResetRequestedAt)
      .orderBy(desc(users.createdAt));
  }

  async setUserFrozen(userId: string, frozen: boolean): Promise<void> {
    await db.update(users).set({ frozen }).where(eq(users.id, userId));
  }

  async deleteUserCascade(userId: string): Promise<void> {
    await db.transaction(async (tx) => {
      const userAnalyses = await tx
        .select({ id: budgetAnalyses.id })
        .from(budgetAnalyses)
        .where(eq(budgetAnalyses.userId, userId));
      const analysisIds = userAnalyses.map((analysis) => analysis.id);

      await tx.delete(analysisEmbeddings).where(eq(analysisEmbeddings.userId, userId));
      await tx.delete(globalAdviceSnapshots).where(eq(globalAdviceSnapshots.userId, userId));
      await tx.delete(smartAnalysisResults).where(eq(smartAnalysisResults.userId, userId));
      if (analysisIds.length > 0) {
        await tx.delete(analysisEmbeddings).where(inArray(analysisEmbeddings.analysisId, analysisIds));
        await tx.delete(globalAdviceSnapshots).where(inArray(globalAdviceSnapshots.analysisId, analysisIds));
        await tx.execute(sql`
          DELETE FROM smart_analysis_results
          WHERE legacy_analysis_id IN (${sql.join(analysisIds.map((id) => sql`${id}`), sql`, `)})
        `);
      }
      await tx.delete(payPeriodExpenses).where(eq(payPeriodExpenses.userId, userId));
      await tx.delete(actualExpenseSets).where(eq(actualExpenseSets.userId, userId));
      await tx.delete(recurringExpenses).where(eq(recurringExpenses.userId, userId));
      await tx.delete(debts).where(eq(debts.userId, userId));
      await tx.delete(budgetAnalyses).where(eq(budgetAnalyses.userId, userId));
      await tx.delete(incomes).where(eq(incomes.userId, userId));
      await tx.delete(loginEvents).where(eq(loginEvents.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }

  async getUserStats(): Promise<{
    totalUsers: number;
    verifiedUsers: number;
    totalLogins: number;
    loginsLast7Days: number;
    loginsLast30Days: number;
  }> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [[totalUsersRow], [verifiedUsersRow], [totalLoginsRow], [loginsLast7DaysRow], [loginsLast30DaysRow]] = await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(users).where(eq(users.emailVerified, true)),
      db.select({ value: count() }).from(loginEvents),
      db.select({ value: count() }).from(loginEvents).where(gte(loginEvents.timestamp, sevenDaysAgo)),
      db.select({ value: count() }).from(loginEvents).where(gte(loginEvents.timestamp, thirtyDaysAgo)),
    ]);

    return {
      totalUsers: totalUsersRow?.value ?? 0,
      verifiedUsers: verifiedUsersRow?.value ?? 0,
      totalLogins: totalLoginsRow?.value ?? 0,
      loginsLast7Days: loginsLast7DaysRow?.value ?? 0,
      loginsLast30Days: loginsLast30DaysRow?.value ?? 0,
    };
  }

  async getBudgetAnalysis(id: string): Promise<StoredBudgetAnalysis | undefined> {
    const [analysis] = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.id, id));
    if (!analysis) return undefined;
    
    // Decrypt expenses and recommendations
    return {
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    };
  }

  async getBudgetAnalysesByUser(userId: string): Promise<StoredBudgetAnalysis[]> {
    const analyses = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.userId, userId));
    
    // Decrypt expenses and recommendations for each analysis
    return analyses.map(analysis => ({
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    }));
  }

  async getCompletedBudgetAnalysesByUser(userId: string): Promise<StoredBudgetAnalysis[]> {
    const analyses = await db
      .select()
      .from(budgetAnalyses)
      .where(and(eq(budgetAnalyses.userId, userId), eq(budgetAnalyses.analysisStatus, "completed")));

    return analyses.map(analysis => ({
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    }));
  }

  async createBudgetAnalysis(insertAnalysis: InsertBudgetAnalysis): Promise<StoredBudgetAnalysis> {
    // Encrypt expenses and recommendations before storing
    const encryptedAnalysis = {
      ...insertAnalysis,
      expenses: this.encryptExpenses(insertAnalysis.expenses),
      recommendations: insertAnalysis.recommendations ? encrypt(insertAnalysis.recommendations) : insertAnalysis.recommendations,
    };
    
    const [analysis] = await db
      .insert(budgetAnalyses)
      .values([encryptedAnalysis])
      .returning();
    
    // Return decrypted version
    return {
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    };
  }

  async updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<StoredBudgetAnalysis> {
    // Encrypt expenses and recommendations if they're being updated
    const encryptedUpdates = {
      ...updates,
      expenses: this.encryptExpenses(updates.expenses),
      recommendations: updates.recommendations ? encrypt(updates.recommendations) : updates.recommendations,
    };
    
    const [analysis] = await db
      .update(budgetAnalyses)
      .set(encryptedUpdates)
      .where(eq(budgetAnalyses.id, id))
      .returning();
    
    if (!analysis) {
      throw new Error("Budget analysis not found");
    }
    
    // Return decrypted version
    return {
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    };
  }

  async upsertAnalysisEmbedding(input: {
    userId: string;
    analysisId: string;
    summary: string;
    embedding: number[];
  }): Promise<AnalysisEmbeddingRecord> {
    const existing = await db
      .select()
      .from(analysisEmbeddings)
      .where(eq(analysisEmbeddings.analysisId, input.analysisId))
      .limit(1);

    const encryptedSummary = encrypt(input.summary);
    const serializedEmbedding = this.serializeEmbedding(input.embedding);

    if (existing[0]) {
      const [updated] = await db
        .update(analysisEmbeddings)
        .set({
          summary: encryptedSummary,
          embedding: serializedEmbedding,
          updatedAt: new Date(),
        })
        .where(eq(analysisEmbeddings.analysisId, input.analysisId))
        .returning();

      if (!updated) {
        throw new Error("Failed to update analysis embedding");
      }

      return this.toEmbeddingRecord(updated);
    }

    const [created] = await db
      .insert(analysisEmbeddings)
      .values({
        userId: input.userId,
        analysisId: input.analysisId,
        summary: encryptedSummary,
        embedding: serializedEmbedding,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create analysis embedding");
    }

    return this.toEmbeddingRecord(created);
  }

  async getAnalysisEmbeddingsByUser(userId: string): Promise<AnalysisEmbeddingRecord[]> {
    const rows = await db
      .select()
      .from(analysisEmbeddings)
      .where(eq(analysisEmbeddings.userId, userId));

    return rows.map((row) => this.toEmbeddingRecord(row));
  }

  async createGlobalAdviceSnapshot(input: {
    userId: string;
    analysisId: string;
    advice: string;
    progressStatus: string;
    supportingAnalysisIds: string[];
  }): Promise<GlobalAdviceSnapshotRecord> {
    const [created] = await db
      .insert(globalAdviceSnapshots)
      .values({
        userId: input.userId,
        analysisId: input.analysisId,
        advice: encrypt(input.advice),
        progressStatus: input.progressStatus,
        supportingAnalysisIds: this.serializeStringArray(input.supportingAnalysisIds),
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create global advice snapshot");
    }

    return this.toGlobalAdviceRecord(created);
  }

  async getLatestGlobalAdviceByUser(userId: string): Promise<GlobalAdviceSnapshotRecord | undefined> {
    const [row] = await db
      .select()
      .from(globalAdviceSnapshots)
      .where(eq(globalAdviceSnapshots.userId, userId))
      .orderBy(desc(globalAdviceSnapshots.createdAt))
      .limit(1);

    return row ? this.toGlobalAdviceRecord(row) : undefined;
  }

  async getDebtsByUser(userId: string): Promise<Debt[]> {
    return await db.select().from(debts).where(eq(debts.userId, userId));
  }

  async createDebt(userId: string, debtInput: InsertDebt): Promise<Debt> {
    const [debt] = await db
      .insert(debts)
      .values({ ...debtInput, userId })
      .returning();

    if (!debt) {
      throw new Error("Failed to create debt");
    }
    return debt;
  }

  async updateDebtInterestRate(userId: string, debtId: string, interestRate: string): Promise<Debt> {
    const [debt] = await db
      .update(debts)
      .set({ interestRate })
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)))
      .returning();

    if (!debt) {
      throw new Error("Debt not found");
    }

    return debt;
  }

  async deleteDebt(userId: string, debtId: string): Promise<void> {
    await db
      .delete(debts)
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)));
  }

  async getRecurringExpensesByUser(userId: string, month: string): Promise<RecurringExpense[]> {
    return await db
      .select()
      .from(recurringExpenses)
      .where(and(eq(recurringExpenses.userId, userId), eq(recurringExpenses.month, month)));
  }

  async createRecurringExpense(userId: string, expenseInput: InsertRecurringExpense): Promise<RecurringExpense> {
    const [expense] = await db
      .insert(recurringExpenses)
      .values({ ...expenseInput, userId })
      .returning();

    if (!expense) {
      throw new Error("Failed to create recurring expense");
    }
    return expense;
  }

  async updateRecurringExpense(
    userId: string,
    expenseId: string,
    expenseInput: InsertRecurringExpense
  ): Promise<RecurringExpense> {
    const [expense] = await db
      .update(recurringExpenses)
      .set(expenseInput)
      .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
      .returning();

    if (!expense) {
      throw new Error("Recurring expense not found");
    }

    return expense;
  }

  async toggleRecurringExpense(userId: string, expenseId: string, enabled: boolean): Promise<RecurringExpense> {
    const [expense] = await db
      .update(recurringExpenses)
      .set({ enabled })
      .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
      .returning();

    if (!expense) {
      throw new Error("Recurring expense not found");
    }

    return expense;
  }

  async deleteRecurringExpense(userId: string, expenseId: string): Promise<void> {
    await db
      .delete(recurringExpenses)
      .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)));
  }

  async copyRecurringExpensesToMonth(userId: string, fromMonth: string, toMonth: string): Promise<RecurringExpense[]> {
    const sourceExpenses = await this.getRecurringExpensesByUser(userId, fromMonth);
    if (sourceExpenses.length === 0) {
      return [];
    }

    return await db
      .insert(recurringExpenses)
      .values(
        sourceExpenses.map((expense) => ({
          userId,
          name: expense.name,
          amount: expense.amount,
          frequency: expense.frequency,
          category: expense.category,
          type: expense.type,
          enabled: expense.enabled,
          month: toMonth,
        }))
      )
      .returning();
  }

  async getPayPeriodExpensesByUserAndMonth(userId: string, month: string): Promise<PayPeriodExpense[]> {
    return await db
      .select()
      .from(payPeriodExpenses)
      .where(and(eq(payPeriodExpenses.userId, userId), eq(payPeriodExpenses.month, month)));
  }

  async createPayPeriodExpense(userId: string, expenseInput: InsertPayPeriodExpense): Promise<PayPeriodExpense> {
    const [expense] = await db
      .insert(payPeriodExpenses)
      .values({ ...expenseInput, userId })
      .returning();

    if (!expense) {
      throw new Error("Failed to create pay period expense");
    }
    return expense;
  }

  async updatePayPeriodExpense(
    userId: string,
    expenseId: string,
    expenseInput: InsertPayPeriodExpense
  ): Promise<PayPeriodExpense> {
    const [expense] = await db
      .update(payPeriodExpenses)
      .set(expenseInput)
      .where(and(eq(payPeriodExpenses.id, expenseId), eq(payPeriodExpenses.userId, userId)))
      .returning();

    if (!expense) {
      throw new Error("Pay period expense not found");
    }

    return expense;
  }

  async togglePayPeriodExpense(userId: string, expenseId: string, paid: boolean): Promise<PayPeriodExpense> {
    const [expense] = await db
      .update(payPeriodExpenses)
      .set({ paid })
      .where(and(eq(payPeriodExpenses.id, expenseId), eq(payPeriodExpenses.userId, userId)))
      .returning();

    if (!expense) {
      throw new Error("Pay period expense not found");
    }

    return expense;
  }

  async deletePayPeriodExpense(userId: string, expenseId: string): Promise<void> {
    await db
      .delete(payPeriodExpenses)
      .where(and(eq(payPeriodExpenses.id, expenseId), eq(payPeriodExpenses.userId, userId)));
  }

  private getNextPatchVersion(version: string): string {
    const parts = version.split(".");
    if (parts.length !== 3) {
      return "0.1.1";
    }

    const [major, minor, patch] = parts.map((part) => Number(part));
    if ([major, minor, patch].some((part) => Number.isNaN(part) || part < 0)) {
      return "0.1.1";
    }

    return `${major}.${minor}.${patch + 1}`;
  }

  async getLatestAppVersion(): Promise<AppVersion> {
    const [versionRow] = await db
      .select()
      .from(appVersions)
      .orderBy(desc(appVersions.id))
      .limit(1);

    if (versionRow) {
      return versionRow;
    }

    const [seededVersion] = await db
      .insert(appVersions)
      .values({ version: "0.1.1" })
      .returning();

    if (!seededVersion) {
      throw new Error("Failed to initialize app version");
    }

    return seededVersion;
  }

  async bumpAppVersion(): Promise<AppVersion> {
    const current = await this.getLatestAppVersion();
    const nextVersion = this.getNextPatchVersion(current.version);

    const [updatedVersion] = await db
      .insert(appVersions)
      .values({ version: nextVersion })
      .returning();

    if (!updatedVersion) {
      throw new Error("Failed to bump app version");
    }

    return updatedVersion;
  }

  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username));

    return admin || undefined;
  }

  async trackVisit(entry: {
    timestamp: Date;
    page: string;
    button: string;
    section: string;
    location: string;
    ipAddress: string;
    userIdentifier: string;
    visitorId: string;
  }): Promise<void> {
    await db.insert(siteVisits).values(entry);
  }

  async getVisits(params?: { limit: number; offset: number }): Promise<SiteVisit[]> {
    if (params) {
      return db
        .select()
        .from(siteVisits)
        .orderBy(desc(siteVisits.timestamp))
        .limit(params.limit)
        .offset(params.offset);
    }
    return db.select().from(siteVisits).orderBy(desc(siteVisits.timestamp));
  }

  async getVisitsCount(): Promise<number> {
    const [row] = await db.select({ value: count() }).from(siteVisits);
    return row?.value ?? 0;
  }

  async getVisitStats(): Promise<{
    topPages: Array<{ name: string; count: number }>;
    topButtons: Array<{ name: string; count: number }>;
    uniqueUsers: number;
  }> {
    const [topPagesRows, topButtonsRows, [uniqueUsersRow]] = await Promise.all([
      db
        .select({ name: siteVisits.page, value: count() })
        .from(siteVisits)
        .where(sql`${siteVisits.page} <> ''`)
        .groupBy(siteVisits.page)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ name: siteVisits.button, value: count() })
        .from(siteVisits)
        .where(sql`${siteVisits.button} <> ''`)
        .groupBy(siteVisits.button)
        .orderBy(desc(count()))
        .limit(10),
      db
        .select({ value: sql<number>`count(distinct ${siteVisits.userIdentifier})` })
        .from(siteVisits)
        .where(sql`${siteVisits.userIdentifier} <> ''`),
    ]);

    return {
      topPages: topPagesRows.map((row) => ({ name: row.name ?? "", count: Number(row.value) })),
      topButtons: topButtonsRows.map((row) => ({ name: row.name ?? "", count: Number(row.value) })),
      uniqueUsers: Number(uniqueUsersRow?.value ?? 0),
    };
  }

  async getDailyVisitHistory(days = 30): Promise<Array<{ date: string; totalVisits: number; uniqueVisitors: number }>> {
    const dayExpr = sql`date_trunc('day', ${siteVisits.timestamp})`;
    const rows = await db
      .select({
        date: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
        totalVisits: count(),
        uniqueVisitors: sql<number>`count(distinct coalesce(nullif(${siteVisits.visitorId}, ''), nullif(${siteVisits.ipAddress}, '')))`,
      })
      .from(siteVisits)
      .where(sql`${siteVisits.timestamp} >= now() - interval '1 day' * ${days}`)
      .groupBy(dayExpr)
      .orderBy(dayExpr);

    const byDate = new Map(
      rows.map((row) => [row.date, { totalVisits: Number(row.totalVisits), uniqueVisitors: Number(row.uniqueVisitors) }])
    );

    // Fill in days with no visits so the chart has a continuous series.
    const result: Array<{ date: string; totalVisits: number; uniqueVisitors: number }> = [];
    for (let i = days - 1; i >= 0; i--) {
      const key = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const existing = byDate.get(key);
      result.push({ date: key, totalVisits: existing?.totalVisits ?? 0, uniqueVisitors: existing?.uniqueVisitors ?? 0 });
    }
    return result;
  }

  async getWeeklyVisitTotals(weeks = 12): Promise<Array<{ weekStart: string; totalVisits: number }>> {
    const weekExpr = sql`date_trunc('week', ${siteVisits.timestamp})`;
    const rows = await db
      .select({
        weekStart: sql<string>`to_char(${weekExpr}, 'YYYY-MM-DD')`,
        totalVisits: count(),
      })
      .from(siteVisits)
      .where(sql`${siteVisits.timestamp} >= now() - interval '1 week' * ${weeks}`)
      .groupBy(weekExpr)
      .orderBy(weekExpr);

    return rows.map((row) => ({ weekStart: row.weekStart, totalVisits: Number(row.totalVisits) }));
  }

  async getVisitHistory(params: {
    from: Date;
    to: Date;
    granularity: "hour" | "day";
  }): Promise<Array<{ bucket: string; totalVisits: number; uniqueVisitors: number }>> {
    const bucketExpr =
      params.granularity === "hour"
        ? sql`date_trunc('hour', ${siteVisits.timestamp})`
        : sql`date_trunc('day', ${siteVisits.timestamp})`;
    const bucketFormat = params.granularity === "hour" ? "YYYY-MM-DD HH24:00" : "YYYY-MM-DD";

    const rows = await db
      .select({
        bucket: sql<string>`to_char(${bucketExpr}, ${bucketFormat})`,
        totalVisits: count(),
        uniqueVisitors: sql<number>`count(distinct coalesce(nullif(${siteVisits.visitorId}, ''), nullif(${siteVisits.ipAddress}, '')))`,
      })
      .from(siteVisits)
      .where(and(gte(siteVisits.timestamp, params.from), lte(siteVisits.timestamp, params.to)))
      .groupBy(bucketExpr)
      .orderBy(bucketExpr);

    const byBucket = new Map(
      rows.map((row) => [row.bucket, { totalVisits: Number(row.totalVisits), uniqueVisitors: Number(row.uniqueVisitors) }])
    );

    // Fill in buckets with no visits so the chart has a continuous series.
    const result: Array<{ bucket: string; totalVisits: number; uniqueVisitors: number }> = [];
    if (params.granularity === "hour") {
      const dayStr = params.from.toISOString().slice(0, 10);
      for (let hour = 0; hour < 24; hour++) {
        const key = `${dayStr} ${String(hour).padStart(2, "0")}:00`;
        const existing = byBucket.get(key);
        result.push({ bucket: key, totalVisits: existing?.totalVisits ?? 0, uniqueVisitors: existing?.uniqueVisitors ?? 0 });
      }
    } else {
      const cursor = new Date(Date.UTC(params.from.getUTCFullYear(), params.from.getUTCMonth(), params.from.getUTCDate()));
      const end = new Date(Date.UTC(params.to.getUTCFullYear(), params.to.getUTCMonth(), params.to.getUTCDate()));
      while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        const existing = byBucket.get(key);
        result.push({ bucket: key, totalVisits: existing?.totalVisits ?? 0, uniqueVisitors: existing?.uniqueVisitors ?? 0 });
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    return result;
  }

  async getRepeatVisitorAlerts(days = 7): Promise<Array<{ date: string; identifier: string; ipAddress: string; visits: number }>> {
    const trusted = await this.listTrustedVisitors();
    const trustedIds = trusted.map((row) => row.identifier);

    const conditions = [sql`${siteVisits.timestamp} >= now() - interval '1 day' * ${days}`];
    if (trustedIds.length > 0) {
      conditions.push(sql`coalesce(${siteVisits.visitorId}, '') <> ALL(${trustedIds})`);
      conditions.push(sql`coalesce(${siteVisits.ipAddress}, '') <> ALL(${trustedIds})`);
    }

    const dayExpr = sql`date_trunc('day', ${siteVisits.timestamp})`;
    const identifierExpr = sql<string>`coalesce(nullif(${siteVisits.visitorId}, ''), nullif(${siteVisits.ipAddress}, ''), 'unknown')`;

    const rows = await db
      .select({
        date: sql<string>`to_char(${dayExpr}, 'YYYY-MM-DD')`,
        identifier: identifierExpr,
        ipAddress: sql<string>`max(${siteVisits.ipAddress})`,
        visits: count(),
      })
      .from(siteVisits)
      .where(and(...conditions))
      .groupBy(dayExpr, identifierExpr)
      .having(sql`count(*) > 1`)
      .orderBy(desc(dayExpr), desc(count()));

    return rows.map((row) => ({
      date: row.date,
      identifier: row.identifier,
      ipAddress: row.ipAddress ?? "",
      visits: Number(row.visits),
    }));
  }

  async listTrustedVisitors(): Promise<TrustedVisitor[]> {
    return db.select().from(trustedVisitors).orderBy(desc(trustedVisitors.createdAt));
  }

  async addTrustedVisitor(identifier: string, note?: string): Promise<TrustedVisitor> {
    const [row] = await db
      .insert(trustedVisitors)
      .values({ identifier, note: note || null })
      .onConflictDoUpdate({ target: trustedVisitors.identifier, set: { note: note || null } })
      .returning();

    if (!row) {
      throw new Error("Failed to add trusted visitor");
    }
    return row;
  }

  async removeTrustedVisitor(identifier: string): Promise<void> {
    await db.delete(trustedVisitors).where(eq(trustedVisitors.identifier, identifier));
  }

  async getPageContent(slug: string): Promise<PageContent | undefined> {
    const [row] = await db
      .select()
      .from(pageContent)
      .where(eq(pageContent.slug, slug));

    return row || undefined;
  }

  async upsertPageContent(slug: string, content: Record<string, unknown>): Promise<PageContent> {
    const [row] = await db
      .insert(pageContent)
      .values({ slug, content })
      .onConflictDoUpdate({
        target: pageContent.slug,
        set: { content, updatedAt: new Date() },
      })
      .returning();

    if (!row) {
      throw new Error("Failed to save page content");
    }

    return row;
  }

  async getIncome(userId: string): Promise<IncomeBreakdown | undefined> {
    const [row] = await db.select().from(incomes).where(eq(incomes.userId, userId));
    return row || undefined;
  }

  async upsertIncome(
    userId: string,
    input: IncomeBreakdownInput,
    computed: { needs: string; wants: string; savings: string }
  ): Promise<IncomeBreakdown> {
    const [row] = await db
      .insert(incomes)
      .values({
        userId,
        mainIncome: input.mainIncome,
        otherIncomes: input.otherIncomes,
        needs: computed.needs,
        wants: computed.wants,
        savings: computed.savings,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: incomes.userId,
        set: {
          mainIncome: input.mainIncome,
          otherIncomes: input.otherIncomes,
          needs: computed.needs,
          wants: computed.wants,
          savings: computed.savings,
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new Error("Failed to save income");
    }

    return row;
  }

  async listActualExpenseSets(userId: string): Promise<ActualExpenseSet[]> {
    return await db
      .select()
      .from(actualExpenseSets)
      .where(eq(actualExpenseSets.userId, userId))
      .orderBy(desc(actualExpenseSets.createdAt));
  }

  async getActualExpenseSet(userId: string, id: string): Promise<ActualExpenseSet | undefined> {
    const [row] = await db
      .select()
      .from(actualExpenseSets)
      .where(and(eq(actualExpenseSets.id, id), eq(actualExpenseSets.userId, userId)));

    return row || undefined;
  }

  async createActualExpenseSet(userId: string, name: string, items: ExpenseItem[]): Promise<ActualExpenseSet> {
    const [row] = await db
      .insert(actualExpenseSets)
      .values({ userId, name, items })
      .returning();

    if (!row) {
      throw new Error("Failed to create actual expense set");
    }

    return row;
  }

  async updateActualExpenseSet(
    userId: string,
    id: string,
    updates: { name?: string; items: ExpenseItem[] }
  ): Promise<ActualExpenseSet> {
    const [row] = await db
      .update(actualExpenseSets)
      .set({
        ...(updates.name ? { name: updates.name } : {}),
        items: updates.items,
        updatedAt: new Date(),
      })
      .where(and(eq(actualExpenseSets.id, id), eq(actualExpenseSets.userId, userId)))
      .returning();

    if (!row) {
      throw new Error("Actual expense set not found");
    }

    return row;
  }

  async listSmartAnalysisResults(userId: string): Promise<SmartAnalysisResult[]> {
    return await db
      .select()
      .from(smartAnalysisResults)
      .where(eq(smartAnalysisResults.userId, userId))
      .orderBy(desc(smartAnalysisResults.createdAt));
  }

  async getSmartAnalysisResult(userId: string, id: string): Promise<SmartAnalysisResult | undefined> {
    const [row] = await db
      .select()
      .from(smartAnalysisResults)
      .where(and(eq(smartAnalysisResults.id, id), eq(smartAnalysisResults.userId, userId)));

    return row || undefined;
  }

  async createSmartAnalysisResult(
    userId: string,
    data: {
      actualExpenseSetId: string | null;
      includeFiftyThirtyTwenty: boolean;
      includeMonthlyExpenses: boolean;
      snapshot: Record<string, unknown>;
      recommendations: string;
    }
  ): Promise<SmartAnalysisResult> {
    const [row] = await db
      .insert(smartAnalysisResults)
      .values({
        userId,
        actualExpenseSetId: data.actualExpenseSetId,
        includeFiftyThirtyTwenty: data.includeFiftyThirtyTwenty,
        includeMonthlyExpenses: data.includeMonthlyExpenses,
        snapshot: data.snapshot,
        recommendations: data.recommendations,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create smart analysis result");
    }

    return row;
  }

  async getLatestSmartAnalysisResult(userId: string): Promise<SmartAnalysisResult | undefined> {
    const [row] = await db
      .select()
      .from(smartAnalysisResults)
      .where(eq(smartAnalysisResults.userId, userId))
      .orderBy(desc(smartAnalysisResults.createdAt))
      .limit(1);

    return row || undefined;
  }

  async listQuickNotes(userId: string): Promise<QuickExpenseNote[]> {
    return await db
      .select()
      .from(quickExpenseNotes)
      .where(eq(quickExpenseNotes.userId, userId))
      .orderBy(desc(quickExpenseNotes.updatedAt));
  }

  async getQuickNote(userId: string, id: string): Promise<QuickExpenseNote | undefined> {
    const [row] = await db
      .select()
      .from(quickExpenseNotes)
      .where(and(eq(quickExpenseNotes.id, id), eq(quickExpenseNotes.userId, userId)));

    return row || undefined;
  }

  async createQuickNote(userId: string, description: string, items: QuickNoteItem[]): Promise<QuickExpenseNote> {
    const [row] = await db
      .insert(quickExpenseNotes)
      .values({ userId, description, items })
      .returning();

    if (!row) {
      throw new Error("Failed to create quick note");
    }

    return row;
  }

  async updateQuickNote(
    userId: string,
    id: string,
    updates: { description: string; items: QuickNoteItem[] }
  ): Promise<QuickExpenseNote> {
    const [row] = await db
      .update(quickExpenseNotes)
      .set({
        description: updates.description,
        items: updates.items,
        updatedAt: new Date(),
      })
      .where(and(eq(quickExpenseNotes.id, id), eq(quickExpenseNotes.userId, userId)))
      .returning();

    if (!row) {
      throw new Error("Quick note not found");
    }

    return row;
  }

  async deleteQuickNote(userId: string, id: string): Promise<void> {
    await db
      .delete(quickExpenseNotes)
      .where(and(eq(quickExpenseNotes.id, id), eq(quickExpenseNotes.userId, userId)));
  }

  async saveQuickNoteReview(
    userId: string,
    id: string,
    review: { review: string; context: string }
  ): Promise<QuickExpenseNote> {
    const [row] = await db
      .update(quickExpenseNotes)
      .set({
        aiReview: review.review,
        aiReviewContext: review.context,
        aiReviewedAt: new Date(),
      })
      .where(and(eq(quickExpenseNotes.id, id), eq(quickExpenseNotes.userId, userId)))
      .returning();

    if (!row) {
      throw new Error("Quick note not found");
    }

    return row;
  }
}

export const storage = new DatabaseStorage();
