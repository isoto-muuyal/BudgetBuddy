import type { Express } from "express";
import { createServer, type Server } from "http";
import { promises as fs } from "fs";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { adminService } from "./services/admin";
import { aiService } from "./services/ai-service";
import { fileProcessor } from "./services/file-processor";
import { authenticateToken, type AuthenticatedRequest } from "./middleware/auth";
import { authenticateAdminToken, type AuthenticatedAdminRequest } from "./middleware/admin-auth";
import { loginSchema, signupSchema, incomeSchema, forgotPasswordSchema, resetPasswordSchema, debtInputSchema, debtUpdateSchema, recurringExpenseInputSchema, recurringExpenseUpdateSchema } from "@shared/schema";
import { config } from "./config";
import * as openidClient from "openid-client";
import bcrypt from "bcrypt";
import { randomBytes } from "crypto";
import { logger } from "./services/logger";
import { metricsService } from "./services/metrics-service";

// Configure multer for file uploads
const upload = multer({
  dest: config.uploads.directory,
  limits: {
    fileSize: config.uploads.maxSize,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Excel files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  const googleStateStore = new Map<string, { codeVerifier: string; createdAt: number }>();

  async function getGoogleClient() {
    if (!config.google.clientId || !config.google.clientSecret || !config.google.redirectUrl) {
      throw new Error("Google OAuth is not configured");
    }
    const openid = openidClient as any;
    const issuer = await openid.Issuer.discover("https://accounts.google.com");
    return new issuer.Client({
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uris: [config.google.redirectUrl],
      response_types: ["code"],
    });
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
      });

      res.json({ message: "Visit tracked" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/visits", authenticateAdminToken, async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const visits = await adminService.getVisits();
      res.json(visits);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const userData = signupSchema.parse(req.body);
      const result = await authService.signup(userData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const loginData = loginSchema.parse(req.body);
      const result = await authService.login(loginData);
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

  // File upload and analysis routes
  app.post("/api/analysis/upload", authenticateToken, upload.single('file'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const user = req.user;
      if (!user.monthlyIncome) {
        return res.status(400).json({ message: "Monthly income not set. Please set your income first." });
      }

      // Generate unique filename
      const fileName = fileProcessor.generateFileName(user.email, req.file.originalname);
      
      // Save file with new name
      const filePath = await fileProcessor.saveFile(req.file.buffer || await fs.readFile(req.file.path), fileName);

      // Create budget analysis record
      logger.info("Analysis upload accepted", {
        traceId: req.traceId,
        userId: user.id,
        originalFileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      });
      const monthlyIncome = parseFloat(user.monthlyIncome);
      const analysis = await storage.createBudgetAnalysis({
        userId: user.id,
        fileName,
        originalFileName: req.file.originalname,
        monthlyIncome: monthlyIncome.toString(),
        recommendedNeeds: (monthlyIncome * 0.5).toString(),
        recommendedWants: (monthlyIncome * 0.3).toString(),
        recommendedSavings: (monthlyIncome * 0.2).toString(),
      });

      // Start async processing
      processFileAsync(user.id, analysis.id, filePath, monthlyIncome);

      res.json({
        message: "File uploaded successfully",
        analysisId: analysis.id,
      });
    } catch (error: any) {
      metricsService.increment("analysis_upload_failures_total");
      logger.error("Upload failed", { traceId: req.traceId, error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const analyses = await storage.getBudgetAnalysesByUser(req.user.id);
      res.json(analyses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/global-advice/latest", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const latestAdvice = await storage.getLatestGlobalAdviceByUser(req.user.id);
      res.json(latestAdvice ?? null);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/patterns", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const analyses = await storage.getBudgetAnalysesByUser(req.user.id);
      const completed = analyses.filter((analysis) =>
        analysis.analysisStatus === "completed" &&
        analysis.actualNeeds &&
        analysis.actualWants &&
        analysis.actualSavings &&
        analysis.recommendations
      );

      if (!completed.length) {
        return res.json({ patterns: "Not enough completed analyses to detect meaningful patterns yet." });
      }

      const rows = completed.map((analysis) => {
        const monthlyIncome = parseFloat(analysis.monthlyIncome || "0");
        const actualNeeds = parseFloat(analysis.actualNeeds || "0");
        const actualWants = parseFloat(analysis.actualWants || "0");
        const actualSavings = parseFloat(analysis.actualSavings || "0");
        const divisor = monthlyIncome || 1;

        return {
          uploadDate: analysis.uploadDate ? new Date(analysis.uploadDate).toISOString() : "",
          monthlyIncome,
          actualNeeds,
          actualWants,
          actualSavings,
          needsPercent: (actualNeeds / divisor) * 100,
          wantsPercent: (actualWants / divisor) * 100,
          savingsPercent: (actualSavings / divisor) * 100,
          recommendations: analysis.recommendations || "",
        };
      });

      const patterns = await aiService.analyzeHistoryPatterns(rows);
      res.json({ patterns });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/analysis/:id", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const analysisId = req.params.id;
      const analysis = await storage.getBudgetAnalysis(analysisId);

      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }

      if (analysis.userId !== req.user.id) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(analysis);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
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
      const expenses = await storage.getRecurringExpensesByUser(req.user.id);
      res.json(expenses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/recurring-expenses", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const expenseData = recurringExpenseInputSchema.parse(req.body);
      const expense = await storage.createRecurringExpense(req.user.id, {
        name: expenseData.name,
        amount: expenseData.amount,
        frequency: expenseData.frequency,
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
      });
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

  app.get("/api/auth/google", async (_req, res) => {
    try {
      cleanupGoogleStates();
      const client = await getGoogleClient();
      const openid = openidClient as any;
      const codeVerifier = openid.generators.codeVerifier();
      const codeChallenge = openid.generators.codeChallenge(codeVerifier);
      const state = openid.generators.state();

      googleStateStore.set(state, { codeVerifier, createdAt: Date.now() });

      const authUrl = client.authorizationUrl({
        scope: "openid email profile",
        state,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      });

      res.redirect(authUrl);
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

      const client = await getGoogleClient();
      const tokenSet = await client.callback(
        config.google.redirectUrl,
        { code, state },
        { code_verifier: stateEntry.codeVerifier }
      );

      const userInfo = await client.userinfo(tokenSet.access_token as string);
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

      const authResponse = authService.buildAuthResponse(user);
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

// Async file processing function
async function processFileAsync(userId: string, analysisId: string, filePath: string, monthlyIncome: number) {
  const started = Date.now();
  try {
    logger.info("Analysis processing started", { userId, analysisId });
    metricsService.increment("analysis_jobs_started_total");

    // Extract text from file
    const textContent = await fileProcessor.processFile(filePath, path.basename(filePath));

    const recurringExpenses = await storage.getRecurringExpensesByUser(userId);
    
    // Analyze with AI
    const aiResult = await aiService.analyzeExpenses(textContent, monthlyIncome, {
      userId,
      analysisId,
      runGlobalAdvisor: true,
      recurringExpenses: recurringExpenses.map((expense) => ({
        name: expense.name,
        amount: Number(expense.amount),
        frequency: expense.frequency,
      })),
    });
    logger.info("AI analysis completed", {
      userId,
      analysisId,
      expenseCount: aiResult.expenses.length,
      hasGlobalAdvice: Boolean(aiResult.globalAdvice),
    });

    // Update analysis with results
    await storage.updateBudgetAnalysis(analysisId, {
      actualNeeds: aiResult.needs.toString(),
      actualWants: aiResult.wants.toString(),
      actualSavings: aiResult.savings.toString(),
      actualUndefined: aiResult.undefined.toString(),
      expenses: JSON.stringify(aiResult.expenses),
      recommendations: aiResult.recommendations,
      analysisStatus: "completed",
    });

    metricsService.increment("analysis_jobs_completed_total");
    metricsService.observe("analysis_job_duration_seconds", { status: "completed" }, (Date.now() - started) / 1000, [1, 5, 10, 30, 60, 120, 300, 600]);
    logger.info("Analysis processing completed", { userId, analysisId, durationMs: Date.now() - started });
  } catch (error) {
    metricsService.increment("analysis_jobs_failed_total");
    metricsService.observe("analysis_job_duration_seconds", { status: "failed" }, (Date.now() - started) / 1000, [1, 5, 10, 30, 60, 120, 300, 600]);
    logger.error("Analysis processing failed", {
      userId,
      analysisId,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    
    // Update analysis with error status
    await storage.updateBudgetAnalysis(analysisId, {
      analysisStatus: "failed",
      recommendations: "Analysis failed. Please try uploading your file again or contact support if the issue persists.",
    });
  } finally {
    // Clean up the uploaded file
    await fileProcessor.deleteFile(filePath);
  }
}
