import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { users, budgetAnalyses, debts, appVersions, admins, type User, type InsertUser, type BudgetAnalysis, type InsertBudgetAnalysis, type Debt, type InsertDebt, type AppVersion, type Admin } from "@shared/schema";
import { db } from "./db";
import { and, desc, eq } from "drizzle-orm";
import { encrypt, decrypt } from "./utils/encryption";

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

  // Budget analysis methods
  getBudgetAnalysis(id: string): Promise<BudgetAnalysis | undefined>;
  getBudgetAnalysesByUser(userId: string): Promise<BudgetAnalysis[]>;
  createBudgetAnalysis(analysis: InsertBudgetAnalysis): Promise<BudgetAnalysis>;
  updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<BudgetAnalysis>;

  // Debt methods
  getDebtsByUser(userId: string): Promise<Debt[]>;
  createDebt(userId: string, debt: InsertDebt): Promise<Debt>;
  deleteDebt(userId: string, debtId: string): Promise<void>;

  // App version methods
  getLatestAppVersion(): Promise<AppVersion>;
  bumpAppVersion(): Promise<AppVersion>;

  // Admin methods
  getAdminByUsername(username: string): Promise<Admin | undefined>;
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

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByVerificationToken(token: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.verificationToken, token));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser & { verificationToken?: string; emailVerified?: boolean }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
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
      .set({ passwordResetToken: token, passwordResetExpiry: expiry })
      .where(eq(users.id, userId));
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    await db
      .update(users)
      .set({ password: newPassword, passwordResetToken: null, passwordResetExpiry: null })
      .where(eq(users.id, userId));
  }

  async getBudgetAnalysis(id: string): Promise<BudgetAnalysis | undefined> {
    const [analysis] = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.id, id));
    if (!analysis) return undefined;
    
    // Decrypt expenses and recommendations
    return {
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    };
  }

  async getBudgetAnalysesByUser(userId: string): Promise<BudgetAnalysis[]> {
    const analyses = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.userId, userId));
    
    // Decrypt expenses and recommendations for each analysis
    return analyses.map(analysis => ({
      ...analysis,
      expenses: this.decryptExpenses(analysis.expenses),
      recommendations: analysis.recommendations ? this.decryptString(analysis.recommendations) : analysis.recommendations,
    }));
  }

  async createBudgetAnalysis(insertAnalysis: InsertBudgetAnalysis): Promise<BudgetAnalysis> {
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

  async updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<BudgetAnalysis> {
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

  async deleteDebt(userId: string, debtId: string): Promise<void> {
    await db
      .delete(debts)
      .where(and(eq(debts.id, debtId), eq(debts.userId, userId)));
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
}

export const storage = new DatabaseStorage();
