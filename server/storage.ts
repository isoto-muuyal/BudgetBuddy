import { users, budgetAnalyses, type User, type InsertUser, type BudgetAnalysis, type InsertBudgetAnalysis } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByVerificationToken(token: string): Promise<User | undefined>;
  createUser(user: InsertUser & { verificationToken?: string }): Promise<User>;
  updateUserIncome(userId: string, monthlyIncome: number): Promise<User>;
  verifyUserEmail(userId: string): Promise<void>;

  // Budget analysis methods
  getBudgetAnalysis(id: string): Promise<BudgetAnalysis | undefined>;
  getBudgetAnalysesByUser(userId: string): Promise<BudgetAnalysis[]>;
  createBudgetAnalysis(analysis: InsertBudgetAnalysis): Promise<BudgetAnalysis>;
  updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<BudgetAnalysis>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    console.log("Fetching user by email:", JSON.stringify(email));

    const query = db.select().from(users).where(eq(users.email, email));
    const [user] = await query;

    console.log("User found.", email);
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

  async updateUserIncome(userId: string, monthlyIncome: number): Promise<User> {
    console.log("Updating income for userId:", userId, "to", monthlyIncome);
    const [user] = await db
      .update(users)
      .set({ monthlyIncome: monthlyIncome.toString() }) // 👈 ensure string for decimal
      .where(eq(users.id, userId))
      .returning();
    console.log("Updated user:", user);
    if (!user) {
      console.error("Failed to update income, user not found:", userId);
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

  async getBudgetAnalysis(id: string): Promise<BudgetAnalysis | undefined> {
    const [analysis] = await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.id, id));
    return analysis || undefined;
  }

  async getBudgetAnalysesByUser(userId: string): Promise<BudgetAnalysis[]> {
    return await db.select().from(budgetAnalyses).where(eq(budgetAnalyses.userId, userId));
  }

  async createBudgetAnalysis(insertAnalysis: InsertBudgetAnalysis): Promise<BudgetAnalysis> {
    const [analysis] = await db
      .insert(budgetAnalyses)
      .values([insertAnalysis])
      .returning();
    return analysis;
  }

  async updateBudgetAnalysis(id: string, updates: Partial<BudgetAnalysis>): Promise<BudgetAnalysis> {
    const [analysis] = await db
      .update(budgetAnalyses)
      .set(updates)
      .where(eq(budgetAnalyses.id, id))
      .returning();

    if (!analysis) {
      throw new Error("Budget analysis not found");
    }
    return analysis;
  }
}

export const storage = new DatabaseStorage();
