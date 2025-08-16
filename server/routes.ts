import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { ollamaService } from "./services/ollama";
import { fileProcessor } from "./services/file-processor";
import { authenticateToken, type AuthenticatedRequest } from "./middleware/auth";
import { loginSchema, signupSchema, incomeSchema } from "@shared/schema";
import { config } from "./config";

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
      'application/vnd.ms-excel'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF and Excel files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
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
      const updatedUser = await storage.updateUserIncome(req.user.id, incomeData.monthlyIncome.toString());
      
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
      const filePath = await fileProcessor.saveFile(req.file.buffer || await require('fs').promises.readFile(req.file.path), fileName);

      // Create budget analysis record
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
      processFileAsync(analysis.id, filePath, monthlyIncome);

      res.json({
        message: "File uploaded successfully",
        analysisId: analysis.id,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
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

  app.get("/api/analysis", authenticateToken, async (req: AuthenticatedRequest, res) => {
    try {
      const analyses = await storage.getBudgetAnalysesByUser(req.user.id);
      res.json(analyses);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Async file processing function
async function processFileAsync(analysisId: string, filePath: string, monthlyIncome: number) {
  try {
    console.log(`Starting analysis for ${analysisId}`);

    // Extract text from file
    const textContent = await fileProcessor.processFile(filePath, path.basename(filePath));
    
    // Analyze with Ollama
    const ollamaResult = await ollamaService.analyzeExpenses(textContent, monthlyIncome);

    // Update analysis with results
    await storage.updateBudgetAnalysis(analysisId, {
      actualNeeds: ollamaResult.needs.toString(),
      actualWants: ollamaResult.wants.toString(),
      actualSavings: ollamaResult.savings.toString(),
      actualUndefined: ollamaResult.undefined.toString(),
      expenses: ollamaResult.expenses,
      recommendations: ollamaResult.recommendations,
      analysisStatus: "completed",
    });

    console.log(`Analysis completed for ${analysisId}`);
  } catch (error) {
    console.error(`Analysis failed for ${analysisId}:`, error);
    
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
