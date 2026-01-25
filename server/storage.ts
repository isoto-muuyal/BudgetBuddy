import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import { users, budgetAnalyses, debts, type User, type InsertUser, type BudgetAnalysis, type InsertBudgetAnalysis, type Debt, type InsertDebt } from "@shared/schema";
import { db } from "./db";
import { and, eq } from "drizzle-orm";
import { encrypt, decrypt } from "./utils/encryption";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  getUserByPasswordResetToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { verificationToken?: string }): Promise<User>;
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
}

export class DatabaseStorage implements IStorage {
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

  async createUser(insertUser: InsertUser & { verificationToken?: string }): Promise<User> {
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
      expenses: analysis.expenses ? JSON.parse(decrypt(JSON.stringify(analysis.expenses))) : analysis.expenses,
      recommendations: analysis.recommendations ? decrypt(analysis.recommendations) : analysis.recommendations,
    };
  }

  async getBudgetAnalysesByUser(userId: string): Promise<BudgetAnalysis[]> {
    const analyses = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.userId, userId));
    
    // Decrypt expenses and recommendations for each analysis
    return analyses.map(analysis => ({
      ...analysis,
      expenses: analysis.expenses ? JSON.parse(decrypt(JSON.stringify(analysis.expenses))) : analysis.expenses,
      recommendations: analysis.recommendations ? decrypt(analysis.recommendations) : analysis.recommendations,
    }));
  }

  async createBudgetAnalysis(insertAnalysis: InsertBudgetAnalysis): Promise<BudgetAnalysis> {
    // Encrypt expenses and recommendations before storing
    const encryptedAnalysis = {
      ...insertAnalysis,
      expenses: insertAnalysis.expenses ? JSON.parse(encrypt(JSON.stringify(insertAnalysis.expenses))) : insertAnalysis.expenses,
      recommendations: insertAnalysis.recommendations ? encrypt(insertAnalysis.recommendations) : insertAnalysis.recommendations,
    };
    
    const [analysis] = await db
      .insert(budgetAnalyses)
      .values([encryptedAnalysis])
      .returning();
    
    // Return decrypted version
    return {
      ...analysis,
      expenses: analysis.expenses ? JSON.parse(decrypt(JSON.stringify(analysis.expenses))) : analysis.expenses,
      recommendations: analysis.recommendations ? decrypt(analysis.recommendations) : analysis.recommendations,
    };
  }

  async updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<BudgetAnalysis> {
    // Encrypt expenses and recommendations if they're being updated
    const encryptedUpdates = {
      ...updates,
      expenses: updates.expenses ? JSON.parse(encrypt(JSON.stringify(updates.expenses))) : updates.expenses,
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
      expenses: analysis.expenses ? JSON.parse(decrypt(JSON.stringify(analysis.expenses))) : analysis.expenses,
      recommendations: analysis.recommendations ? decrypt(analysis.recommendations) : analysis.recommendations,
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
}

export const storage = new DatabaseStorage();
