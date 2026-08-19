import type { Express } from "express";
import { createServer, type Server } from "http";
import { promises as fs } from "fs";
import multer from "multer";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { adminService } from "./services/admin";
import { emailService } from "./services/email";
import { aiService } from "./services/ai-service";
import { fileProcessor } from "./services/file-processor";
import { authenticateToken, type AuthenticatedRequest } from "./middleware/auth";
import { authenticateAdminToken, type AuthenticatedAdminRequest } from "./middleware/admin-auth";
import {
  loginSchema,
  signupSchema,
  incomeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  contactFormSchema,
  debtInputSchema,
  debtUpdateSchema,
  recurringExpenseInputSchema,
  recurringExpenseUpdateSchema,
  recurringExpenseToggleSchema,
  recurringExpenseImportSchema,
  payPeriodExpenseInputSchema,
  payPeriodExpenseUpdateSchema,
  payPeriodExpenseToggleSchema,
  monthKeySchema,
  pageContentUpdateSchema,
  PAGE_CONTENT_SLUGS,
  incomeBreakdownInputSchema,
  actualExpenseSetUpdateSchema,
  smartAnalysisRequestSchema,
  RECURRING_EXPENSE_FREQUENCIES,
  type RecurringExpenseFrequency,
  type ExpenseItem,
} from "@shared/schema";
import { config } from "./config";
import * as openidClient from "openid-client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { logger } from "./services/logger";

// Configure multer for CSV uploads of actual expenses
const upload = multer({
  dest: config.uploads.directory,
  limits: {
    fileSize: config.uploads.maxSize,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel'];
    const isCsvExtension = file.originalname.toLowerCase().endsWith('.csv');

    if (allowedTypes.includes(file.mimetype) || isCsvExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  },
});

const FREQUENCY_MONTHLY_MULTIPLIERS: Record<RecurringExpenseFrequency, number> = {
  daily: 365 / 12,
  weekly: 52 / 12,
  bi_weekly: 26 / 12,
  monthly: 1,
  semi_monthly: 2,
  bi_monthly: 0.5,
  yearly: 1 / 12,
};

function toMonthlyEquivalent(amount: number, frequency: RecurringExpenseFrequency): number {
  return amount * (FREQUENCY_MONTHLY_MULTIPLIERS[frequency] ?? 1);
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const googleStateStore = new Map<string, { codeVerifier: string; createdAt: number }>();
  let googleConfig: openidClient.Configuration | undefined;

  async function getGoogleConfig() {
    if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUrl) {
      throw new Error("Google OAuth is not configured");
    }
    if (!googleConfig) {
      googleConfig = await openidClient.discovery(
        new URL("https://accounts.google.com"),
        config.google.clientId,
        config.google.clientSecret
      );
    }
    return googleConfig;
  }

  function cleanupGoogleStates() {
    const now = Date.now();
    for (const [key, value] of Array.from(googleStateStore.entries())) {
      if (now - value.createdAt > 10 * 60 * 1000) {
        googleStateStore.delete(key);
      }
    }
  }

  app.use("/api", async (req, _res, next) => {
    try {
      const isVersionRead = req.method === "GET" && req.path === "/version";
      if (!isVersionRead) {
        await storage.bumpAppVersion();
      }
      next();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/version", async (_req, res) => {
    try {
      const version = await storage.getLatestAppVersion();
      res.json(version);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/login", async (req, res) => {
    try {
      const username = typeof req.body?.username === "string" ? req.body.username : "";
      const password = typeof req.body?.password === "string" ? req.body.password : "";
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }

      const result = await adminService.login(username, password);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  });

  app.post("/api/visits/track", async (req, res) => {
    try {
      const page = typeof req.body?.page === "string" ? req.body.page : "unknown";
      const button = typeof req.body?.button === "string" ? req.body.button : "";
      const section = typeof req.body?.section === "string" ? req.body.section : "";

      if (page.startsWith("/admin")) {
        return res.json({ message: "Admin visits are ignored" });
      }

      await adminService.trackVisit({
        timestamp: new Date().toISOString(),
        page,
        button,
        section,
        location: adminService.getVisitorLocation(req.headers as Record<string, unknown>),
        ipAddress: adminService.getClientIp(req.headers as Record<string, unknown>, req.ip),
        userIdentifier: typeof req.body?.userIdentifier === "string" ? req.body.userIdentifier : "",
        visitorId: typeof req.body?.visitorId === "string" ? req.body.visitorId : "",
      });

      res.json({ message: "Visit tracked" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const ALLOWED_VISIT_PAGE_SIZES = [20, 50, 100];

  app.get("/api/admin/visits", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const requestedPageSize = parseInt(String(req.query.pageSize ?? "20"), 10);
      const pageSize = ALLOWED_VISIT_PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 20;
      const requestedPage = parseInt(String(req.query.page ?? "1"), 10);
      const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
      const offset = (page - 1) * pageSize;

      const [rows, total] = await Promise.all([
        adminService.getVisits({ limit: pageSize, offset }),
        adminService.getVisitsCount(),
      ]);

      res.json({ rows, total, page, pageSize });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/stats", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const stats = await adminService.getVisitStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/export", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const visits = await adminService.getVisits();
      const csv = adminService.buildVisitsCsv(visits);
      const filename = `visit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/daily", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const requestedDays = parseInt(String(req.query.days ?? "30"), 10);
      const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 90) : 30;
      const history = await adminService.getDailyVisitHistory(days);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/weekly", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const requestedWeeks = parseInt(String(req.query.weeks ?? "12"), 10);
      const weeks = Number.isFinite(requestedWeeks) && requestedWeeks > 0 ? Math.min(requestedWeeks, 52) : 12;
      const totals = await adminService.getWeeklyVisitTotals(weeks);
      res.json(totals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/repeat", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const requestedDays = parseInt(String(req.query.days ?? "7"), 10);
      const days = Number.isFinite(requestedDays) && requestedDays > 0 ? Math.min(requestedDays, 30) : 7;
      const alerts = await adminService.getRepeatVisitorAlerts(days);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits/trusted", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const trusted = await adminService.listTrustedVisitors();
      res.json(trusted);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/visits/trusted", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const identifier = typeof req.body?.identifier === "string" ? req.body.identifier.trim() : "";
      const note = typeof req.body?.note === "string" ? req.body.note : undefined;
      if (!identifier) {
        return res.status(400).json({ message: "identifier is required" });
      }
      const trusted = await adminService.addTrustedVisitor(identifier, note);
      res.json(trusted);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/admin/visits/trusted/:identifier", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      await adminService.removeTrustedVisitor(req.params.identifier);
      res.json({ message: "Trusted visitor removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/users", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const users = await storage.listUsersForAdmin();
      res.json(users);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/freeze", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const frozen = req.body?.frozen !== false;
      await storage.setUserFrozen(req.params.id, frozen);
      res.json({ message: frozen ? "User frozen" : "User unfrozen" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/password-reset", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await authService.sendPasswordResetByAdmin(req.params.id);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ message: error.message });
    }
  });

  app.post("/api/admin/users/:id/temporary-password", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await authService.generateTemporaryPasswordByAdmin(req.params.id);
      res.json(result);
    } catch (error: any) {
      const statusCode = error.message === "User not found" ? 404 : 500;
      res.status(statusCode).json({ message: error.message });
    }
  });

  app.delete("/api/admin/users/:id", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      await storage.deleteUserCascade(req.params.id);
      res.json({ message: "User deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/stats", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const stats = await storage.getUserStats();
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = signupSchema.parse(req.body);
      const result = await authService.signup(userData, req.traceId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      const result = await authService.login(loginData, req.traceId);
      res.json(result);
    } catch (error: any) {
      res.status(401).json({ message: error.message });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { token } = req.body;
      if (!token) {
        return res.status(400).json({ message: "Verification token required" });
      }

      const result = await authService.verifyEmail(token);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => { 
    try {
      const data = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(data);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const data = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(data);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/complete-password-change", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const newPassword = typeof req.body?.newPassword === "string" ? req.body.newPassword : "";
      const result = await authService.completeForcedPasswordChange(req.user.id, newPassword);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = contactFormSchema.parse(req.body);
      await emailService.sendContactFormEmail(name, email, subject, message);
      res.json({ message: "Message sent successfully" });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/content/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      if (!PAGE_CONTENT_SLUGS.includes(slug as any)) {
        return res.status(404).json({ message: "Content not found" });
      }
      const page = await storage.getPageContent(slug);
      if (!page) {
        return res.status(404).json({ message: "Content not found" });
      }
      res.json(page);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/content/:slug", authenticateAdminToken, async (req: AuthenticatedAdminRequest, res) => {
    try {
      const { slug } = req.params;
      if (!PAGE_CONTENT_SLUGS.includes(slug as any)) {
        return res.status(404).json({ message: "Content not found" });
      }
      const { content } = pageContentUpdateSchema.parse(req.body);
      const page = await storage.upsertPageContent(slug, content);
      res.json(page);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Protected user routes
  app.get("/api/user/profile", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const user = req.user;
      res.json({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        monthlyIncome: user.monthlyIncome,
        emailVerified: user.emailVerified,
        forcePasswordChange: user.forcePasswordChange,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/user/income", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const incomeData = incomeSchema.parse(req.body);
      const updatedUser = await storage.updateUserIncome(req.user.id, incomeData.monthlyIncome);
      
      res.json({
        message: "Income updated successfully",
        monthlyIncome: updatedUser.monthlyIncome,
      });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // 50/30/20 income routes
  app.get("/api/income", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const income = await storage.getIncome(req.user.id);
      res.json(income ?? null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/income", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const input = incomeBreakdownInputSchema.parse(req.body);
      const mainIncome = parseFloat(input.mainIncome) || 0;
      const otherIncomeTotal = input.otherIncomes.reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);
      const totalIncome = mainIncome + otherIncomeTotal;

      const income = await storage.upsertIncome(req.user.id, input, {
        needs: (totalIncome * 0.5).toString(),
        wants: (totalIncome * 0.3).toString(),
        savings: (totalIncome * 0.2).toString(),
      });

      await storage.updateUserIncome(req.user.id, totalIncome.toString());

      res.json(income);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Actual expense set routes
  app.get("/api/actual-expense-sets", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const sets = await storage.listActualExpenseSets(req.user.id);
      res.json(sets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/actual-expense-sets/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const set = await storage.getActualExpenseSet(req.user.id, req.params.id);
      if (!set) {
        return res.status(404).json({ message: "Actual expense set not found" });
      }
      res.json(set);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post(
    "/api/actual-expense-sets/upload",
    authenticateToken,
    upload.single("file"),
    async (req: AuthenticatedRequest, res) => {
      let filePath: string | undefined;
      try {
        if (!req.file) {
          return res.status(400).json({ message: "No file uploaded" });
        }

        const fileName = fileProcessor.generateFileName(req.user.email, req.file.originalname);
        filePath = await fileProcessor.saveFile(req.file.buffer || (await fs.readFile(req.file.path)), fileName);

        const rows = await fileProcessor.parseCsvRows(filePath);
        const rawItems = rows.map((row) => {
          const values = Object.values(row);
          const keys = Object.keys(row).map((key) => key.toLowerCase());
          const pick = (candidates: string[]) => {
            const index = keys.findIndex((key) => candidates.some((candidate) => key.includes(candidate)));
            return index >= 0 ? String(values[index] ?? "") : "";
          };

          return {
            date: pick(["date"]),
            description: pick(["description", "memo", "details"]),
            business: pick(["business", "merchant", "payee", "vendor"]),
            amount: pick(["amount", "value", "total"]),
          };
        });

        const classified = await aiService.classifyActualExpenses(rawItems);
        const name = req.body?.name && typeof req.body.name === "string" ? req.body.name : req.file.originalname;
        const set = await storage.createActualExpenseSet(req.user.id, name, classified);

        res.json(set);
      } catch (error: any) {
        logger.error("Actual expense upload failed", { traceId: req.traceId, error: error instanceof Error ? error.message : String(error) });
        res.status(500).json({ message: error.message });
      } finally {
        if (filePath) {
          await fileProcessor.deleteFile(filePath);
        }
      }
    }
  );

  app.patch("/api/actual-expense-sets/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const updates = actualExpenseSetUpdateSchema.parse(req.body);
      const set = await storage.updateActualExpenseSet(req.user.id, req.params.id, updates);
      res.json(set);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Smart analysis routes
  app.get("/api/smart-analysis", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const results = await storage.listSmartAnalysisResults(req.user.id);
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/smart-analysis/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const result = await storage.getSmartAnalysisResult(req.user.id, req.params.id);
      if (!result) {
        return res.status(404).json({ message: "Smart analysis result not found" });
      }
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/smart-analysis", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const input = smartAnalysisRequestSchema.parse(req.body);
      const expenseSet = await storage.getActualExpenseSet(req.user.id, input.actualExpenseSetId);
      if (!expenseSet) {
        return res.status(404).json({ message: "Actual expense set not found" });
      }

      const items = expenseSet.items as ExpenseItem[];

      let fiftyThirtyTwenty: { needs: number; wants: number; savings: number; monthlyIncome: number } | undefined;
      if (input.includeFiftyThirtyTwenty) {
        const income = await storage.getIncome(req.user.id);
        if (income) {
          const monthlyIncome = parseFloat(income.mainIncome) +
            (Array.isArray(income.otherIncomes)
              ? (income.otherIncomes as Array<{ amount: string }>).reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0)
              : 0);
          fiftyThirtyTwenty = {
            needs: parseFloat(income.needs),
            wants: parseFloat(income.wants),
            savings: parseFloat(income.savings),
            monthlyIncome,
          };
        }
      }

      let monthlyExpenses: { needs: number; wants: number; savings: number } | undefined;
      if (input.includeMonthlyExpenses) {
        const recurring = await storage.getRecurringExpensesByUser(req.user.id, getCurrentMonthKey());
        const totals = { needs: 0, wants: 0, savings: 0 };
        for (const expense of recurring) {
          if (!expense.enabled) continue;
          const monthlyAmount = toMonthlyEquivalent(Number(expense.amount), expense.frequency as RecurringExpenseFrequency);
          if (expense.category === "needs") totals.needs += monthlyAmount;
          else if (expense.category === "wants") totals.wants += monthlyAmount;
          else if (expense.category === "savings") totals.savings += monthlyAmount;
        }
        monthlyExpenses = totals;
      }

      const recommendations = await aiService.generateSmartAnalysisRecommendation({
        items,
        fiftyThirtyTwenty,
        monthlyExpenses,
      });

      const snapshot = {
        items,
        fiftyThirtyTwenty: fiftyThirtyTwenty ?? null,
        monthlyExpenses: monthlyExpenses ?? null,
      };

      const result = await storage.createSmartAnalysisResult(req.user.id, {
        actualExpenseSetId: expenseSet.id,
        includeFiftyThirtyTwenty: input.includeFiftyThirtyTwenty,
        includeMonthlyExpenses: input.includeMonthlyExpenses,
        snapshot,
        recommendations,
      });

      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.get("/api/debts", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const debts = await storage.getDebtsByUser(req.user.id);
      res.json(debts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/debts", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const debtData = debtInputSchema.parse(req.body);
      const debt = await storage.createDebt(req.user.id, {
        name: debtData.name,
        totalAmount: debtData.totalAmount,
        monthlyPayment: debtData.monthlyPayment,
        interestRate: debtData.interestRate,
      });
      res.json(debt);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/debts/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const debtData = debtUpdateSchema.parse(req.body);
      const debt = await storage.updateDebtInterestRate(req.user.id, req.params.id, debtData.interestRate);
      res.json(debt);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/debts/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteDebt(req.user.id, req.params.id);
      res.json({ message: "Debt deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/recurring-expenses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const month = monthKeySchema.parse(req.query.month);
      const expenses = await storage.getRecurringExpensesByUser(req.user.id, month);
      res.json(expenses);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/recurring-expenses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const expenseData = recurringExpenseInputSchema.parse(req.body);
      const expense = await storage.createRecurringExpense(req.user.id, {
        name: expenseData.name,
        amount: expenseData.amount,
        frequency: expenseData.frequency,
        category: expenseData.category,
        type: expenseData.type,
        month: expenseData.month,
      });
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/recurring-expenses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const expenseData = recurringExpenseUpdateSchema.parse(req.body);
      const expense = await storage.updateRecurringExpense(req.user.id, req.params.id, {
        name: expenseData.name,
        amount: expenseData.amount,
        frequency: expenseData.frequency,
        category: expenseData.category,
        type: expenseData.type,
        month: expenseData.month,
      });
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/recurring-expenses/import", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { fromMonth, toMonth } = recurringExpenseImportSchema.parse(req.body);
      const expenses = await storage.copyRecurringExpensesToMonth(req.user.id, fromMonth, toMonth);
      res.json(expenses);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/recurring-expenses/:id/toggle", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { enabled } = recurringExpenseToggleSchema.parse(req.body);
      const expense = await storage.toggleRecurringExpense(req.user.id, req.params.id, enabled);
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/recurring-expenses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deleteRecurringExpense(req.user.id, req.params.id);
      res.json({ message: "Recurring expense deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/pay-period-expenses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const month = monthKeySchema.parse(req.query.month);
      const expenses = await storage.getPayPeriodExpensesByUserAndMonth(req.user.id, month);
      res.json(expenses);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/pay-period-expenses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const expenseData = payPeriodExpenseInputSchema.parse(req.body);
      const expense = await storage.createPayPeriodExpense(req.user.id, {
        name: expenseData.name,
        amount: expenseData.amount,
        category: expenseData.category,
        sourceRecurringExpenseId: expenseData.sourceRecurringExpenseId ?? null,
        month: expenseData.month,
      });
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/pay-period-expenses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const expenseData = payPeriodExpenseUpdateSchema.parse(req.body);
      const expense = await storage.updatePayPeriodExpense(req.user.id, req.params.id, {
        name: expenseData.name,
        amount: expenseData.amount,
        category: expenseData.category,
        sourceRecurringExpenseId: expenseData.sourceRecurringExpenseId ?? null,
        month: expenseData.month,
      });
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.patch("/api/pay-period-expenses/:id/toggle", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const { paid } = payPeriodExpenseToggleSchema.parse(req.body);
      const expense = await storage.togglePayPeriodExpense(req.user.id, req.params.id, paid);
      res.json(expense);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.delete("/api/pay-period-expenses/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      await storage.deletePayPeriodExpense(req.user.id, req.params.id);
      res.json({ message: "Pay period expense deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/google", async (_req, res) => {
    try {
      cleanupGoogleStates();
      const googleAuthConfig = await getGoogleConfig();
      const codeVerifier = openidClient.randomPKCECodeVerifier();
      const codeChallenge = await openidClient.calculatePKCECodeChallenge(codeVerifier);
      const state = openidClient.randomState();

      googleStateStore.set(state, { codeVerifier, createdAt: Date.now() });

      const authUrl = openidClient.buildAuthorizationUrl(googleAuthConfig, {
        redirect_uri: config.google.redirectUrl,
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      res.redirect(authUrl.href);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const state = typeof req.query.state === "string" ? req.query.state : "";
      const code = typeof req.query.code === "string" ? req.query.code : "";
      if (!state || !code) {
        return res.status(400).json({ message: "Missing OAuth parameters" });
      }

      const stateEntry = googleStateStore.get(state);
      if (!stateEntry) {
        return res.status(400).json({ message: "Invalid OAuth state" });
      }
      googleStateStore.delete(state);

      const googleAuthConfig = await getGoogleConfig();
      const currentUrl = new URL(req.originalUrl, config.google.redirectUrl);
      const tokenSet = await openidClient.authorizationCodeGrant(googleAuthConfig, currentUrl, {
        pkceCodeVerifier: stateEntry.codeVerifier,
        expectedState: state,
      });

      const subject = tokenSet.claims()?.sub;
      if (!subject) {
        return res.status(400).json({ message: "Google account subject not available" });
      }
      const userInfo = await openidClient.fetchUserInfo(googleAuthConfig, tokenSet.access_token, subject);
      const email = typeof userInfo.email === "string" ? userInfo.email : "";
      if (!email) {
        return res.status(400).json({ message: "Google account email not available" });
      }

      const fullName = typeof userInfo.name === "string" && userInfo.name ? userInfo.name : email.split("@")[0];
      let user = await storage.getUserByEmail(email);

      if (!user) {
        const password = randomBytes(32).toString("hex");
        const hashedPassword = await bcrypt.hash(password, 12);
        user = await storage.createUser({
          email,
          fullName,
          password: hashedPassword,
          emailVerified: true,
        });
      }

      let authResponse;
      try {
        authResponse = await authService.completeLogin(user, req.traceId);
      } catch (loginError: any) {
        if (config.google.frontendRedirect) {
          const redirectUrl = new URL(config.google.frontendRedirect);
          redirectUrl.searchParams.set("error", loginError.message);
          return res.redirect(redirectUrl.toString());
        }
        return res.status(403).json({ message: loginError.message });
      }

      if (config.google.frontendRedirect) {
        const redirectUrl = new URL(config.google.frontendRedirect);
        redirectUrl.searchParams.set("token", authResponse.token);
        return res.redirect(redirectUrl.toString());
      }

      res.json(authResponse);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
