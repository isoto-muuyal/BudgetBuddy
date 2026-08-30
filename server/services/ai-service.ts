import fs from "fs";
import OpenAI from "openai";
import { config } from "../config";
import { storage } from "../storage";
import { vectorStoreService } from "./vector-store-service";
import { mcpClientService } from "./mcp-client-service";
import { logger } from "./logger";
import { metricsService } from "./metrics-service";
import {
  EXPENSE_ITEM_TYPES,
  EXPENSE_ITEM_CATEGORIES,
  type ExpenseItem,
  type ExpenseItemType,
  type ExpenseItemCategory,
  type QuickNoteItem,
} from "@shared/schema";

export const CATEGORIZER_AGENT = "CATEGORIZER_AGENT";
export const CATEGORIZER_TOOL = "CATEGORIZER_TOOL";
export const ADVISOR_AGENT = "ADVISOR_AGENT";
export const ADVISOR_TOOL = "ADVISOR_TOOL";
export const GLOBAL_ADVISOR_AGENT = "GLOBAL_ADVISOR_AGENT";
export const GLOBAL_ADVISOR_TOOL = "GLOBAL_ADVISOR_TOOL";

type ExpenseCategory = "50%" | "30%" | "20%" | "undefined";

export interface AIExpenseAnalysis {
  needs: number;
  wants: number;
  savings: number;
  undefined: number;
  expenses: CategorizedExpense[];
  recommendations: string;
  globalAdvice?: GlobalAdviceResult;
}

export interface AIHistoryPatternRow {
  uploadDate: string;
  monthlyIncome: number;
  actualNeeds: number;
  actualWants: number;
  actualSavings: number;
  needsPercent: number;
  wantsPercent: number;
  savingsPercent: number;
  recommendations: string;
}

export interface GlobalAdviceResult {
  advice: string;
  progressStatus: "improving" | "declining" | "steady" | "insufficient_data";
  supportingAnalysisIds: string[];
}

export interface AnalysisAgentContext {
  userId?: string;
  analysisId?: string;
  runGlobalAdvisor?: boolean;
  recurringExpenses?: RecurringExpenseReference[];
}

export interface RecurringExpenseReference {
  name: string;
  amount: number;
  frequency: string;
}

interface CategorizedExpense {
  description: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
}

interface CategorizationResponse {
  expenses: CategorizedExpense[];
}

interface GlobalAdviceResponse {
  progressStatus?: string;
  advice?: string;
}

interface McpCategorizationResponse extends Record<string, unknown> {
  expenses?: CategorizedExpense[];
}

interface McpRecommendationsResponse extends Record<string, unknown> {
  recommendations?: string;
  advice?: string;
  text?: string;
}

export class AIService {
  private readonly agentClient: OpenAI;

  private static readonly SUBCATEGORY_TO_CATEGORY: Record<string, Exclude<ExpenseCategory, "undefined">> = {
    housing: "50%",
    rent: "50%",
    mortgage: "50%",
    food: "50%",
    groceries: "50%",
    utilities: "50%",
    transportation: "50%",
    gas: "50%",
    insurance: "50%",
    health: "50%",
    medical: "50%",
    entertainment: "30%",
    dining: "30%",
    restaurant: "30%",
    shopping: "30%",
    subscriptions: "30%",
    netflix: "30%",
    coffee: "30%",
    lifestyle: "30%",
    savings: "20%",
    investment: "20%",
    transfer: "20%",
    "extra debt payment": "20%",
    deposit: "20%",
  };

  constructor() {
    this.agentClient = new OpenAI({
      baseURL: config.ai.baseUrl,
      apiKey: config.ai.apiKey,
    });
  }

  async analyzeExpenses(
    textContent: string,
    monthlyIncome: number,
    context: AnalysisAgentContext = {}
  ): Promise<AIExpenseAnalysis> {
    try {
      const recurringExpenses = context.recurringExpenses ?? [];
      const expenses = await this.runCategorizerAgent(textContent, monthlyIncome, recurringExpenses);
      const recommendations = await this.runAdvisorAgent(expenses, monthlyIncome, recurringExpenses);
      const totals = this.calculateTotalsFromExpenses(expenses);

      const result: AIExpenseAnalysis = {
        needs: totals.needs,
        wants: totals.wants,
        savings: totals.savings,
        undefined: totals.undefined,
        expenses,
        recommendations,
      };

      if (context.runGlobalAdvisor && context.userId && context.analysisId) {
        result.globalAdvice = await this.runGlobalAdvisorAgent({
          userId: context.userId,
          analysisId: context.analysisId,
          monthlyIncome,
          expenses,
          recommendations,
          totals,
        });
      }

      return result;
    } catch (error) {
      metricsService.increment("ai_analysis_failures_total");
      logger.error("AI analysis failed; using fallback", { error: this.errorMessage(error) });
      return this.fallbackRuleBasedAnalysis(textContent, monthlyIncome);
    }
  }

  async analyzeHistoryPatterns(rows: AIHistoryPatternRow[]): Promise<string> {
    if (!rows.length) {
      return "Not enough completed analyses to detect meaningful patterns yet.";
    }

    try {
      if (mcpClientService.isEnabled()) {
        const response = await mcpClientService.callTool<string | McpRecommendationsResponse>(
          config.mcp.tools.generateHistoryPatterns,
          { rows }
        );
        return this.extractMcpText(response, "patterns");
      }

      const response = await this.runTextCompletion({
        model: config.ai.advisorModel,
        systemPrompt:
          "You are a financial analyst. Identify patterns and trends across multiple monthly analyses. Focus on consistent overspending or underspending categories, and summarize clear behavioral patterns.",
        userPrompt: this.buildHistoryPatternsPrompt(rows),
        maxTokens: 1024,
        temperature: 0.4,
      });

      return this.parseRecommendationsResponse(response);
    } catch (error: any) {
      metricsService.increment("ai_tool_failures_total", { tool: "history_patterns" });
      logger.error("History patterns AI failed", { error: this.errorMessage(error) });
      if (error.status) {
        console.error("HTTP error status:", error.status);
        console.error("HTTP error body:", JSON.stringify(error.error, null, 2));
      }
      return "Unable to generate historical patterns at this time. Please try again later.";
    }
  }

  private async runCategorizerAgent(
    textContent: string,
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): Promise<CategorizedExpense[]> {
    logger.info("Preparing categorization request", { agent: CATEGORIZER_AGENT });
    return this.runCategorizerTool(textContent, monthlyIncome, recurringExpenses);
  }

  private async runCategorizerTool(
    textContent: string,
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): Promise<CategorizedExpense[]> {
    const prompt = this.buildCategorizationPrompt(textContent, monthlyIncome, recurringExpenses);

    try {
      if (mcpClientService.isEnabled()) {
        logger.info("Calling MCP categorizer tool", { tool: config.mcp.tools.categorizeTransactions });
        metricsService.increment("ai_tool_requests_total", { tool: "categorize_transactions", provider: "mcp" });
        const response = await mcpClientService.callTool<McpCategorizationResponse | CategorizedExpense[]>(
          config.mcp.tools.categorizeTransactions,
          {
            textContent,
            monthlyIncome,
            recurringExpenses,
            ruleset: "50/30/20",
            categories: ["50%", "30%", "20%", "undefined"],
          }
        );
        const expenses = Array.isArray(response) ? response : response.expenses;
        return this.normalizeExpenses(Array.isArray(expenses) ? expenses : []);
      }

      logger.info("Calling AI categorizer tool", { provider: "openai", model: config.ai.categorizerModel });
      metricsService.increment("ai_tool_requests_total", { tool: "categorize_transactions", provider: "openai" });
      const responseText = await this.runJsonCompletion({
        model: config.ai.categorizerModel,
        systemPrompt:
          "You are a financial transaction categorization expert. Your task is to categorize expenses according to the 50/30/20 budgeting rule. Always return ONLY valid JSON. Do not invent or duplicate transactions. If uncertain, use 'undefined'.",
        userPrompt: prompt,
        maxTokens: 4096,
        temperature: 0.1,
      });

      return this.parseCategorizationResponse(responseText);
    } catch (error: any) {
      metricsService.increment("ai_tool_failures_total", { tool: "categorize_transactions" });
      logger.error("Categorizer tool failed", { error: this.errorMessage(error) });
      if (error.status) {
        console.error("HTTP error status:", error.status);
        console.error("HTTP error body:", JSON.stringify(error.error, null, 2));
      }

      logger.warn("Falling back to rule-based categorization", { tool: CATEGORIZER_TOOL });
      return this.ruleBasedCategorization(textContent);
    }
  }

  private async runAdvisorAgent(
    expenses: CategorizedExpense[],
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): Promise<string> {
    logger.info("Preparing recommendations request", { agent: ADVISOR_AGENT });
    return this.runAdvisorTool(expenses, monthlyIncome, recurringExpenses);
  }

  private async runAdvisorTool(
    expenses: CategorizedExpense[],
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): Promise<string> {
    const prompt = this.buildRecommendationsPrompt(expenses, monthlyIncome, recurringExpenses);

    try {
      if (mcpClientService.isEnabled()) {
        logger.info("Calling MCP recommendations tool", { tool: config.mcp.tools.generateBudgetRecommendations });
        metricsService.increment("ai_tool_requests_total", { tool: "generate_budget_recommendations", provider: "mcp" });
        const totals = this.calculateTotalsFromExpenses(expenses);
        const response = await mcpClientService.callTool<string | McpRecommendationsResponse>(
          config.mcp.tools.generateBudgetRecommendations,
          {
            expenses,
            monthlyIncome,
            recurringExpenses,
            totals,
            recommended: {
              needs: monthlyIncome * 0.5,
              wants: monthlyIncome * 0.3,
              savings: monthlyIncome * 0.2,
            },
            ruleset: "50/30/20",
          }
        );
        return this.extractMcpText(response, "recommendations");
      }

      logger.info("Calling AI recommendations tool", { provider: "openai", model: config.ai.advisorModel });
      metricsService.increment("ai_tool_requests_total", { tool: "generate_budget_recommendations", provider: "openai" });
      const responseText = await this.runTextCompletion({
        model: config.ai.advisorModel,
        systemPrompt:
          "You are a financial advisor specializing in budget analysis using the 50/30/20 rule. Provide detailed, actionable recommendations based on the categorized expenses.",
        userPrompt: prompt,
        maxTokens: 2048,
        temperature: 0.7,
      });

      return this.parseRecommendationsResponse(responseText);
    } catch (error: any) {
      metricsService.increment("ai_tool_failures_total", { tool: "generate_budget_recommendations" });
      logger.error("Advisor tool failed", { error: this.errorMessage(error) });
      if (error.status) {
        console.error("HTTP error status:", error.status);
        console.error("HTTP error body:", JSON.stringify(error.error, null, 2));
      }

      logger.warn("Falling back to rule-based recommendations", { tool: ADVISOR_TOOL });
      return this.ruleBasedRecommendations(expenses, monthlyIncome);
    }
  }

  private async runGlobalAdvisorAgent(input: {
    userId: string;
    analysisId: string;
    monthlyIncome: number;
    expenses: CategorizedExpense[];
    recommendations: string;
    totals: {
      needs: number;
      wants: number;
      savings: number;
      undefined: number;
    };
  }): Promise<GlobalAdviceResult> {
    logger.info("Building global advisor historical context", { agent: GLOBAL_ADVISOR_AGENT });

    const currentSummary = this.buildAnalysisSummary({
      monthlyIncome: input.monthlyIncome,
      totals: input.totals,
      recommendations: input.recommendations,
      expenses: input.expenses,
    });

    await vectorStoreService.upsertAnalysisDocument({
      userId: input.userId,
      analysisId: input.analysisId,
      summary: currentSummary,
    });

    const historicalAnalyses = (await storage.getCompletedBudgetAnalysesByUser(input.userId)).filter(
      (analysis) => analysis.id !== input.analysisId
    );

    for (const analysis of historicalAnalyses) {
      const summary = this.buildHistoricalAnalysisSummary(analysis);
      await vectorStoreService.upsertAnalysisDocument({
        userId: input.userId,
        analysisId: analysis.id,
        summary,
      });
    }

    const similarAnalyses = await vectorStoreService.searchSimilarAnalyses({
      userId: input.userId,
      queryText: currentSummary,
      excludeAnalysisIds: [input.analysisId],
      limit: 3,
    });

    const advice = await this.runGlobalAdvisorTool({
      analysisId: input.analysisId,
      currentSummary,
      historicalAnalyses,
      similarAnalyses,
    });

    await storage.createGlobalAdviceSnapshot({
      userId: input.userId,
      analysisId: input.analysisId,
      advice: advice.advice,
      progressStatus: advice.progressStatus,
      supportingAnalysisIds: advice.supportingAnalysisIds,
    });

    return advice;
  }

  private async runGlobalAdvisorTool(input: {
    analysisId: string;
    currentSummary: string;
    historicalAnalyses: Array<{
      id: string;
      uploadDate: Date | null;
      monthlyIncome: string;
      actualNeeds: string | null;
      actualWants: string | null;
      actualSavings: string | null;
      recommendations: string | null;
      expenses: unknown;
    }>;
    similarAnalyses: Array<{ analysisId: string; summary: string; score: number }>;
  }): Promise<GlobalAdviceResult> {
    if (!input.historicalAnalyses.length) {
      const advice = [
        "This is your first completed analysis, so there is no historical baseline yet.",
        "Use this result as your starting point for future comparisons.",
        "Upload another analysis next cycle so BudgetWise can measure real progress.",
      ].join("\n");

      return {
        advice,
        progressStatus: "insufficient_data",
        supportingAnalysisIds: [],
      };
    }

    const recentHistory = [...input.historicalAnalyses]
      .sort((left, right) => {
        const leftTime = left.uploadDate ? new Date(left.uploadDate).getTime() : 0;
        const rightTime = right.uploadDate ? new Date(right.uploadDate).getTime() : 0;
        return rightTime - leftTime;
      })
      .slice(0, 5)
      .map((analysis) => ({
        analysisId: analysis.id,
        summary: this.buildHistoricalAnalysisSummary(analysis),
      }));

    const prompt = this.buildGlobalAdvicePrompt({
      currentSummary: input.currentSummary,
      recentHistory,
      similarAnalyses: input.similarAnalyses.map((analysis) => ({
        analysisId: analysis.analysisId,
        score: Number(analysis.score.toFixed(4)),
        summary: analysis.summary,
      })),
    });

    try {
      if (mcpClientService.isEnabled()) {
        logger.info("Calling MCP global advisor tool", { tool: config.mcp.tools.generateGlobalAdvice });
        metricsService.increment("ai_tool_requests_total", { tool: "generate_global_advice", provider: "mcp" });
        const response = await mcpClientService.callTool<GlobalAdviceResponse>(
          config.mcp.tools.generateGlobalAdvice,
          {
            analysisId: input.analysisId,
            currentSummary: input.currentSummary,
            recentHistory,
            similarAnalyses: input.similarAnalyses.map((analysis) => ({
              analysisId: analysis.analysisId,
              score: Number(analysis.score.toFixed(4)),
              summary: analysis.summary,
            })),
          }
        );
        return {
          advice: this.normalizeThreeLineAdvice(response.advice || ""),
          progressStatus: this.normalizeProgressStatus(response.progressStatus),
          supportingAnalysisIds: input.similarAnalyses.map((analysis) => analysis.analysisId),
        };
      }

      logger.info("Calling AI global advisor tool", { provider: "openai", model: config.ai.advisorModel });
      metricsService.increment("ai_tool_requests_total", { tool: "generate_global_advice", provider: "openai" });
      const responseText = await this.runJsonCompletion({
        model: config.ai.advisorModel,
        systemPrompt:
          "You are a financial progress analyst. Compare the current budget analysis against prior analyses and return ONLY JSON with a progressStatus and a three-line advice summary.",
        userPrompt: prompt,
        maxTokens: 1024,
        temperature: 0.3,
      });

      return this.parseGlobalAdviceResponse(
        responseText,
        input.similarAnalyses.map((analysis) => analysis.analysisId)
      );
    } catch (error: any) {
      metricsService.increment("ai_tool_failures_total", { tool: "generate_global_advice" });
      logger.error("Global advisor tool failed", { error: this.errorMessage(error) });
      if (error.status) {
        console.error("HTTP error status:", error.status);
        console.error("HTTP error body:", JSON.stringify(error.error, null, 2));
      }

      return this.buildRuleBasedGlobalAdvice(input.historicalAnalyses);
    }
  }

  private async runTextCompletion(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    const result = await this.agentClient.chat.completions.create({
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
    });

    return result.choices[0]?.message?.content ?? "";
  }

  private async runJsonCompletion(input: {
    model: string;
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    const result = await this.agentClient.chat.completions.create({
      model: input.model,
      messages: [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.userPrompt },
      ],
      max_tokens: input.maxTokens,
      temperature: input.temperature,
      response_format: { type: "json_object" },
    });

    return result.choices[0]?.message?.content ?? "";
  }

  /*
   * Optional experimental path for the CATEGORIZER_TOOL.
   * This is intentionally not wired into production flow yet.
   * If you want to test it, temporarily call this method from runCategorizerTool().
   * It uses the installed @huggingface/transformers package for local zero-shot labeling.
   */
  private async categorizeExpensesWithTransformersLibrary(lines: string[]): Promise<CategorizedExpense[]> {
    const { pipeline } = await import("@huggingface/transformers");
    const classifier = await pipeline("zero-shot-classification", "Xenova/bart-large-mnli");
    const labels = ["Needs", "Wants", "Savings"];

    const categorized = await Promise.all(
      lines.map(async (line) => {
        const amountMatch = line.match(/-?[$]?[\d,]+\.?\d*/);
        const amount = amountMatch ? Number(amountMatch[0].replace(/[$,]/g, "")) : 0;
        const result = (await classifier(line, labels)) as { labels?: string[] } | Array<{ labels?: string[] }>;
        const normalizedResult = Array.isArray(result) ? result[0] : result;
        const topLabel = Array.isArray(normalizedResult?.labels) ? String(normalizedResult.labels[0] || "") : "";

        let category: ExpenseCategory = "undefined";
        if (topLabel === "Needs") category = "50%";
        if (topLabel === "Wants") category = "30%";
        if (topLabel === "Savings") category = "20%";

        return {
          description: line.trim(),
          amount,
          category,
          subcategory: topLabel || undefined,
        };
      })
    );

    return categorized;
  }

  private buildCategorizationPrompt(
    textContent: string,
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): string {
    const recurringSection = recurringExpenses.length
      ? `
Known Recurring Expenses (user-provided reference):
${JSON.stringify(recurringExpenses, null, 2)}

Use these recurring expenses as reference when matching and categorizing transactions from the statement.
`
      : "";

    return `
You are categorizing financial transactions according to the 50/30/20 budgeting rule:

- 50% for NEEDS: Essential expenses like rent, groceries, utilities, minimum debt payments, insurance, transportation to work
- 30% for WANTS: Non-essential expenses like entertainment, dining out, hobbies, subscriptions, shopping
- 20% for SAVINGS: Money saved, invested, or put toward debt payments above minimums

Monthly Income: $${monthlyIncome}
${recurringSection}
Bank Statement Content:
${textContent}

Categorize each transaction and return ONLY a JSON object in this exact format:
{
  "expenses": [
    {
      "description": "[transaction description from the statement]",
      "amount": [amount as number, negative for expenses, positive for income/savings],
      "category": "[50%, 30%, 20%, or undefined]",
      "subcategory": "[specific category like Housing, Food, Entertainment, etc.]"
    }
  ]
}

Important rules:
- Be conservative with categorization
- Negative amounts are expenses, positive amounts are income or transfers to savings
- Do not invent transactions
- Do not duplicate transactions
- If uncertain, use "undefined"
`;
  }

  private buildRecommendationsPrompt(
    expenses: CategorizedExpense[],
    monthlyIncome: number,
    recurringExpenses: RecurringExpenseReference[] = []
  ): string {
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;
    const divisor = monthlyIncome || 1;
    const recurringSection = recurringExpenses.length
      ? `
Known Recurring Expenses (user-provided reference):
${JSON.stringify(recurringExpenses, null, 2)}

Compare actual spending against these expected recurring expenses when making recommendations.
`
      : "";

    return `
You are analyzing a user's spending patterns based on the 50/30/20 budgeting rule.

Monthly Income: $${monthlyIncome}
${recurringSection}
Recommended Budget:
- Needs (50%): $${recommendedNeeds.toFixed(2)}
- Wants (30%): $${recommendedWants.toFixed(2)}
- Savings (20%): $${recommendedSavings.toFixed(2)}

Actual Spending:
- Needs: $${totals.needs.toFixed(2)} (${((totals.needs / divisor) * 100).toFixed(1)}%)
- Wants: $${totals.wants.toFixed(2)} (${((totals.wants / divisor) * 100).toFixed(1)}%)
- Savings: $${totals.savings.toFixed(2)} (${((totals.savings / divisor) * 100).toFixed(1)}%)
- Undefined: $${totals.undefined.toFixed(2)}

Categorized Expenses:
${JSON.stringify(expenses, null, 2)}

Provide actionable recommendations for improving the budget.
Focus on overspending, under-saving, and where Wants can be reduced and redirected.
`;
  }

  private buildGlobalAdvicePrompt(input: {
    currentSummary: string;
    recentHistory: Array<{ analysisId: string; summary: string }>;
    similarAnalyses: Array<{ analysisId: string; score: number; summary: string }>;
  }): string {
    return `
Compare the user's current budget analysis with historical analyses.

Current analysis summary:
${input.currentSummary}

Most recent historical analyses:
${JSON.stringify(input.recentHistory, null, 2)}

RAG retrieval from the vector store:
${JSON.stringify(input.similarAnalyses, null, 2)}

Return ONLY JSON in this format:
{
  "progressStatus": "improving | declining | steady",
  "advice": "Line 1\\nLine 2\\nLine 3"
}

Rules:
- advice must be exactly 3 short lines
- state clearly whether the user is progressing or not
- use the historical context and retrieved analyses
- if the trend is mixed, use "steady"
`;
  }

  private buildHistoryPatternsPrompt(rows: AIHistoryPatternRow[]): string {
    return `
Analyze the user's historical budget analyses and identify patterns or trends.
Each row includes actual spending percentages and the recommendations provided.

Historical rows:
${JSON.stringify(rows, null, 2)}

Provide:
- Recurring overspending/underspending patterns
- Notable changes over time
- A short summary of the most common recommendation themes

Keep the response concise and actionable with bullet points.
`;
  }

  private parseCategorizationResponse(responseText: string): CategorizedExpense[] {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in categorization response");
      }

      const jsonData: CategorizationResponse = JSON.parse(
        jsonMatch[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, " ").replace(/\s+/g, " ").trim()
      );

      return this.normalizeExpenses(Array.isArray(jsonData.expenses) ? jsonData.expenses : []);
    } catch (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = `./failed_ai_responses/categorization_${timestamp}.txt`;
      fs.mkdirSync("./failed_ai_responses", { recursive: true });
      fs.writeFileSync(filePath, responseText);
      logger.error("Failed to parse categorization response", { error: this.errorMessage(error), filePath });
      throw error;
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private parseGlobalAdviceResponse(responseText: string, supportingAnalysisIds: string[]): GlobalAdviceResult {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in global advice response");
    }

    const parsed: GlobalAdviceResponse = JSON.parse(jsonMatch[0]);
    const normalizedStatus = this.normalizeProgressStatus(parsed.progressStatus);
    const advice = this.normalizeThreeLineAdvice(parsed.advice || "");

    return {
      advice,
      progressStatus: normalizedStatus,
      supportingAnalysisIds,
    };
  }

  private parseRecommendationsResponse(responseText: string): string {
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/```[\s\S]*?```/g, "");
    cleaned = cleaned.replace(/^#+\s*/gm, "");

    if (cleaned.length < 50) {
      return "Unable to generate specific recommendations. Please review your spending patterns and aim to follow the 50/30/20 rule.";
    }

    return cleaned;
  }

  private extractMcpText(response: string | Record<string, unknown>, preferredKey: string): string {
    if (typeof response === "string") {
      return this.parseRecommendationsResponse(response);
    }

    const candidates = [
      response[preferredKey],
      response.recommendations,
      response.patterns,
      response.advice,
      response.text,
      response.message,
    ];

    const text = candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0);
    if (!text) {
      throw new Error(`MCP response did not include text field "${preferredKey}"`);
    }

    return this.parseRecommendationsResponse(text);
  }

  private normalizeExpenses(rawExpenses: any[]): CategorizedExpense[] {
    const allowedCategories = new Set(["50%", "30%", "20%", "undefined"]);
    const normalizeKey = (value: unknown) => (typeof value === "string" ? value.trim().toLowerCase() : "");

    return rawExpenses.map((expense) => {
      const description = typeof expense?.description === "string" ? expense.description : String(expense ?? "");
      const amount = typeof expense?.amount === "number" ? expense.amount : Number(expense?.amount ?? 0);
      const categoryRaw = typeof expense?.category === "string" ? expense.category.trim() : "";
      const subcategory = normalizeKey(expense?.subcategory || "");

      let category: ExpenseCategory | undefined;

      if (allowedCategories.has(categoryRaw)) {
        category = categoryRaw as ExpenseCategory;
      }

      if ((!category || category === "undefined") && subcategory) {
        category = AIService.SUBCATEGORY_TO_CATEGORY[subcategory] || category;
      }

      if (!category && subcategory) {
        const numericMatch = subcategory.match(/^(\d{1,3})%?$/);
        if (numericMatch) {
          const normalized = `${numericMatch[1]}%`;
          if (allowedCategories.has(normalized)) {
            category = normalized as ExpenseCategory;
          }
        }
      }

      if (!category && categoryRaw) {
        category = AIService.SUBCATEGORY_TO_CATEGORY[normalizeKey(categoryRaw)] || "undefined";
      }

      return {
        description,
        amount,
        category: category || "undefined",
        subcategory: expense?.subcategory ? String(expense.subcategory) : undefined,
      };
    });
  }

  private calculateTotalsFromExpenses(expenses: CategorizedExpense[]): {
    needs: number;
    wants: number;
    savings: number;
    undefined: number;
  } {
    let needs = 0;
    let wants = 0;
    let savings = 0;
    let undef = 0;

    for (const expense of expenses) {
      const value = Math.abs(Number(expense.amount) || 0);
      if (expense.category === "50%") needs += value;
      else if (expense.category === "30%") wants += value;
      else if (expense.category === "20%") savings += value;
      else undef += value;
    }

    return { needs, wants, savings, undefined: undef };
  }

  private buildAnalysisSummary(input: {
    monthlyIncome: number;
    totals: { needs: number; wants: number; savings: number; undefined: number };
    recommendations: string;
    expenses: CategorizedExpense[];
  }): string {
    const divisor = input.monthlyIncome || 1;
    const largestExpenses = [...input.expenses]
      .sort((left, right) => Math.abs(right.amount) - Math.abs(left.amount))
      .slice(0, 8)
      .map((expense) => `${expense.description} | ${expense.category} | ${Math.abs(expense.amount).toFixed(2)}`);

    return [
      `Monthly income: ${input.monthlyIncome.toFixed(2)}`,
      `Needs: ${input.totals.needs.toFixed(2)} (${((input.totals.needs / divisor) * 100).toFixed(1)}%)`,
      `Wants: ${input.totals.wants.toFixed(2)} (${((input.totals.wants / divisor) * 100).toFixed(1)}%)`,
      `Savings: ${input.totals.savings.toFixed(2)} (${((input.totals.savings / divisor) * 100).toFixed(1)}%)`,
      `Undefined: ${input.totals.undefined.toFixed(2)}`,
      `Top expenses: ${largestExpenses.join(" ; ")}`,
      `Recommendations: ${input.recommendations}`,
    ].join("\n");
  }

  private buildHistoricalAnalysisSummary(analysis: {
    monthlyIncome: string;
    actualNeeds: string | null;
    actualWants: string | null;
    actualSavings: string | null;
    recommendations: string | null;
    expenses?: unknown;
  }): string {
    const monthlyIncome = Number(analysis.monthlyIncome || 0);
    const actualNeeds = Number(analysis.actualNeeds || 0);
    const actualWants = Number(analysis.actualWants || 0);
    const actualSavings = Number(analysis.actualSavings || 0);
    const divisor = monthlyIncome || 1;
    const expenses = Array.isArray(analysis.expenses) ? analysis.expenses.slice(0, 8) : [];

    return [
      `Monthly income: ${monthlyIncome.toFixed(2)}`,
      `Needs: ${actualNeeds.toFixed(2)} (${((actualNeeds / divisor) * 100).toFixed(1)}%)`,
      `Wants: ${actualWants.toFixed(2)} (${((actualWants / divisor) * 100).toFixed(1)}%)`,
      `Savings: ${actualSavings.toFixed(2)} (${((actualSavings / divisor) * 100).toFixed(1)}%)`,
      `Expenses sample: ${JSON.stringify(expenses)}`,
      `Recommendations: ${analysis.recommendations || ""}`,
    ].join("\n");
  }

  private buildRuleBasedGlobalAdvice(
    historicalAnalyses: Array<{
      id: string;
      monthlyIncome: string;
      actualNeeds: string | null;
      actualWants: string | null;
      actualSavings: string | null;
    }>
  ): GlobalAdviceResult {
    const sample = historicalAnalyses.slice(0, 3);
    const averages = sample.reduce(
      (accumulator, analysis) => {
        const income = Number(analysis.monthlyIncome || 0) || 1;
        accumulator.needs += (Number(analysis.actualNeeds || 0) / income) * 100;
        accumulator.wants += (Number(analysis.actualWants || 0) / income) * 100;
        accumulator.savings += (Number(analysis.actualSavings || 0) / income) * 100;
        return accumulator;
      },
      { needs: 0, wants: 0, savings: 0 }
    );

    const count = sample.length || 1;
    const averageNeeds = averages.needs / count;
    const averageWants = averages.wants / count;
    const averageSavings = averages.savings / count;
    const delta = averageSavings - averageWants;

    const progressStatus: GlobalAdviceResult["progressStatus"] =
      delta > 0 ? "improving" : delta < -10 ? "declining" : "steady";

    const advice = this.normalizeThreeLineAdvice(
      [
        `Progress looks ${progressStatus} based on your most recent completed analyses.`,
        `Recent averages were Needs ${averageNeeds.toFixed(1)}%, Wants ${averageWants.toFixed(1)}%, Savings ${averageSavings.toFixed(1)}%.`,
        "Upload another statement after your next cycle so the trend can be measured with higher confidence.",
      ].join("\n")
    );

    return {
      advice,
      progressStatus,
      supportingAnalysisIds: sample.map((analysis) => analysis.id),
    };
  }

  private normalizeProgressStatus(value?: string): GlobalAdviceResult["progressStatus"] {
    const normalized = (value || "").trim().toLowerCase();
    if (normalized === "improving") return "improving";
    if (normalized === "declining") return "declining";
    if (normalized === "steady") return "steady";
    return "insufficient_data";
  }

  private normalizeThreeLineAdvice(value: string): string {
    const lines = value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3);

    while (lines.length < 3) {
      lines.push("Continue tracking new analyses to strengthen the trend.");
    }

    return lines.join("\n");
  }

  private ruleBasedCategorization(textContent: string): CategorizedExpense[] {
    const lines = textContent.split("\n").filter((line) => line.trim());
    const expenses: CategorizedExpense[] = [];

    for (const line of lines) {
      const amountMatch = line.match(/[-$]?[\d,]+\.?\d*/);
      if (!amountMatch) continue;

      const amount = parseFloat(amountMatch[0].replace(/[$,]/g, ""));
      if (amount > 0) {
        const category = this.simpleClassifyTransaction(line);
        expenses.push({
          description: line.trim(),
          amount: -amount,
          category,
          subcategory: this.getSubcategory(line, category),
        });
      }
    }

    return expenses;
  }

  private ruleBasedRecommendations(expenses: CategorizedExpense[], monthlyIncome: number): string {
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;
    const needsPercentage = ((totals.needs / (monthlyIncome || 1)) * 100).toFixed(1);
    const wantsPercentage = ((totals.wants / (monthlyIncome || 1)) * 100).toFixed(1);
    const savingsPercentage = ((totals.savings / (monthlyIncome || 1)) * 100).toFixed(1);

    let recommendations = "Based on your spending analysis:\n\n";

    if (totals.needs > recommendedNeeds) {
      recommendations += `• Your essential needs spending (${needsPercentage}%) exceeds the recommended 50%.\n`;
    }

    if (totals.wants > recommendedWants) {
      recommendations += `• Your discretionary spending (${wantsPercentage}%) exceeds the recommended 30%.\n`;
      recommendations += `• Consider redirecting about $${(totals.wants - recommendedWants).toFixed(2)} from Wants toward debt or savings.\n`;
    }

    if (totals.savings < recommendedSavings) {
      recommendations += `• Your savings (${savingsPercentage}%) are below the recommended 20%.\n`;
    }

    if (recommendations === "Based on your spending analysis:\n\n") {
      recommendations += "• Great job. Your spending appears to align well with the 50/30/20 rule.";
    }

    return recommendations;
  }

  private fallbackRuleBasedAnalysis(textContent: string, monthlyIncome: number): AIExpenseAnalysis {
    const expenses = this.ruleBasedCategorization(textContent);
    const totals = this.calculateTotalsFromExpenses(expenses);

    return {
      needs: totals.needs,
      wants: totals.wants,
      savings: totals.savings,
      undefined: totals.undefined,
      expenses,
      recommendations: this.ruleBasedRecommendations(expenses, monthlyIncome),
    };
  }

  private simpleClassifyTransaction(description: string): ExpenseCategory {
    const value = description.toLowerCase();

    if (
      value.includes("rent") ||
      value.includes("mortgage") ||
      value.includes("grocery") ||
      value.includes("utility") ||
      value.includes("gas") ||
      value.includes("insurance") ||
      value.includes("medical")
    ) {
      return "50%";
    }

    if (
      value.includes("restaurant") ||
      value.includes("entertainment") ||
      value.includes("shopping") ||
      value.includes("coffee") ||
      value.includes("gym") ||
      value.includes("subscription") ||
      value.includes("amazon") ||
      value.includes("netflix")
    ) {
      return "30%";
    }

    if (value.includes("savings") || value.includes("investment") || value.includes("transfer") || value.includes("ira")) {
      return "20%";
    }

    return "undefined";
  }

  private getSubcategory(description: string, category: ExpenseCategory): string {
    const value = description.toLowerCase();

    if (category === "50%") {
      if (value.includes("rent") || value.includes("mortgage")) return "Housing";
      if (value.includes("grocery") || value.includes("food")) return "Food";
      if (value.includes("gas") || value.includes("transport")) return "Transportation";
      if (value.includes("utility")) return "Utilities";
      return "Essential";
    }

    if (category === "30%") {
      if (value.includes("restaurant") || value.includes("dining")) return "Dining";
      if (value.includes("entertainment")) return "Entertainment";
      if (value.includes("shopping")) return "Shopping";
      if (value.includes("subscription")) return "Subscriptions";
      return "Lifestyle";
    }

    if (category === "20%") {
      if (value.includes("investment")) return "Investment";
      return "Savings";
    }

    return "Other";
  }

  async classifyActualExpenses(rawItems: Partial<ExpenseItem>[]): Promise<ExpenseItem[]> {
    if (!rawItems.length) {
      return [];
    }

    try {
      const responseText = await this.runJsonCompletion({
        model: config.ai.categorizerModel,
        systemPrompt:
          "You are a financial transaction classification expert. For each expense, decide its type (one of: " +
          EXPENSE_ITEM_TYPES.join(", ") +
          ") and its category (one of: " +
          EXPENSE_ITEM_CATEGORIES.join(", ") +
          `). If you cannot determine the type or category with confidence, use "other". Always return ONLY valid JSON.`,
        userPrompt: this.buildExpenseClassificationPrompt(rawItems),
        maxTokens: 4096,
        temperature: 0.1,
      });

      return this.parseExpenseClassificationResponse(responseText, rawItems);
    } catch (error) {
      metricsService.increment("ai_tool_failures_total", { tool: "classify_actual_expenses" });
      logger.error("Expense classification failed; using fallback", { error: this.errorMessage(error) });
      return rawItems.map((item) => this.ruleBasedExpenseClassification(item));
    }
  }

  async generateSmartAnalysisRecommendation(input: {
    items: ExpenseItem[];
    fiftyThirtyTwenty?: { needs: number; wants: number; savings: number; monthlyIncome: number };
    monthlyExpenses?: { needs: number; wants: number; savings: number };
  }): Promise<string> {
    try {
      const responseText = await this.runTextCompletion({
        model: config.ai.advisorModel,
        systemPrompt:
          "You are a financial analyst. Compare a user's actual expenses against their 50/30/20 targets and/or expected recurring expenses, then provide clear, actionable recommendations.",
        userPrompt: this.buildSmartAnalysisPrompt(input),
        maxTokens: 1024,
        temperature: 0.4,
      });

      return this.parseRecommendationsResponse(responseText);
    } catch (error) {
      metricsService.increment("ai_tool_failures_total", { tool: "smart_analysis_recommendation" });
      logger.error("Smart analysis recommendation failed; using fallback", { error: this.errorMessage(error) });
      return this.buildRuleBasedSmartAnalysisRecommendation(input);
    }
  }

  async reviewQuickNote(input: {
    description: string;
    items: QuickNoteItem[];
    userContext?: string;
    lastAnalysis?: { snapshot: unknown; recommendations: string; createdAt: Date };
  }): Promise<string> {
    try {
      const responseText = await this.runTextCompletion({
        model: config.ai.advisorModel,
        systemPrompt:
          "You are a friendly, direct personal finance advisor. The user jotted down a quick, informal expense note (not a full budget) and wants a short, practical opinion on it - point out anything that looks tight, excessive, or risky, and factor in their most recent financial analysis if it's provided. Keep the response conversational and brief (3-5 sentences).",
        userPrompt: this.buildQuickNoteReviewPrompt(input),
        maxTokens: 512,
        temperature: 0.6,
      });

      return responseText.trim() || "The AI didn't return a response. Please try again.";
    } catch (error) {
      metricsService.increment("ai_tool_failures_total", { tool: "review_quick_note" });
      logger.error("Quick note review failed", { error: this.errorMessage(error) });
      return "Unable to review this note right now. Please try again in a moment.";
    }
  }

  private buildQuickNoteReviewPrompt(input: {
    description: string;
    items: QuickNoteItem[];
    userContext?: string;
    lastAnalysis?: { snapshot: unknown; recommendations: string; createdAt: Date };
  }): string {
    const totalAmount = input.items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalPaid = input.items.reduce((sum, item) => sum + (Number(item.paidAmount) || 0), 0);

    const rows =
      input.items
        .map((item) => {
          const paid = item.paidAmount ? `, paid $${item.paidAmount}` : "";
          const due = item.dueDate ? `, due ${item.dueDate}` : "";
          return `- ${item.name || "(unnamed)"}: amount $${item.amount || "0"}${paid}${due}`;
        })
        .join("\n") || "(no line items yet)";

    const contextSection = input.userContext ? `\nUser's added context: ${input.userContext}\n` : "";

    return `
Quick expense note: "${input.description}"

Line items:
${rows}

Totals: amount $${totalAmount.toFixed(2)}, paid $${totalPaid.toFixed(2)}
${contextSection}
User's most recent financial analysis on file:
${this.summarizeLastAnalysis(input.lastAnalysis)}

Give a short, practical opinion on this expense note - is it reasonable, tight, or risky given their situation? Suggest one concrete adjustment if relevant.
`;
  }

  private summarizeLastAnalysis(
    analysis: { snapshot: unknown; recommendations: string; createdAt: Date } | undefined
  ): string {
    if (!analysis) {
      return "No prior Smart Analysis on file for this user.";
    }

    const snapshot = analysis.snapshot as {
      fiftyThirtyTwenty?: { needs: number; wants: number; savings: number; monthlyIncome: number };
      monthlyExpenses?: { needs: number; wants: number; savings: number };
    } | null;

    const lines = [`Last analysis date: ${analysis.createdAt.toISOString().slice(0, 10)}`];

    if (snapshot?.fiftyThirtyTwenty) {
      const targets = snapshot.fiftyThirtyTwenty;
      lines.push(
        `Monthly income: $${targets.monthlyIncome.toFixed(2)}, Needs: $${targets.needs.toFixed(2)}, Wants: $${targets.wants.toFixed(2)}, Savings: $${targets.savings.toFixed(2)}`
      );
    }

    if (snapshot?.monthlyExpenses) {
      const actual = snapshot.monthlyExpenses;
      lines.push(
        `Actual monthly spend - Needs: $${actual.needs.toFixed(2)}, Wants: $${actual.wants.toFixed(2)}, Savings: $${actual.savings.toFixed(2)}`
      );
    }

    lines.push(`Recommendations given: ${analysis.recommendations}`);

    return lines.join("\n");
  }

  private buildExpenseClassificationPrompt(rawItems: Partial<ExpenseItem>[]): string {
    return `
Classify each of the following expenses according to:
- type: one of ${EXPENSE_ITEM_TYPES.join(", ")} (use "other" if uncertain)
- category: one of ${EXPENSE_ITEM_CATEGORIES.join(", ")} (use "other" if uncertain)

Expenses:
${JSON.stringify(rawItems, null, 2)}

Return ONLY a JSON object in this exact format:
{
  "expenses": [
    {
      "date": "[date if present, otherwise empty string]",
      "description": "[description]",
      "business": "[business/merchant name]",
      "amount": "[amount as string]",
      "category": "[one of ${EXPENSE_ITEM_CATEGORIES.join(", ")}]",
      "type": "[one of ${EXPENSE_ITEM_TYPES.join(", ")}]"
    }
  ]
}

Return exactly ${rawItems.length} expenses, preserving their original order.
`;
  }

  private parseExpenseClassificationResponse(
    responseText: string,
    fallbackItems: Partial<ExpenseItem>[]
  ): ExpenseItem[] {
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in expense classification response");
      }

      const parsed: { expenses?: Array<Partial<ExpenseItem>> } = JSON.parse(
        jsonMatch[0].replace(/[ --]/g, " ").trim()
      );

      const classified = Array.isArray(parsed.expenses) ? parsed.expenses : [];
      if (!classified.length) {
        throw new Error("Expense classification response contained no expenses");
      }

      return fallbackItems.map((item, index) => this.normalizeExpenseItem(classified[index] ?? item, item));
    } catch (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filePath = `./failed_ai_responses/expense_classification_${timestamp}.txt`;
      fs.mkdirSync("./failed_ai_responses", { recursive: true });
      fs.writeFileSync(filePath, responseText);
      logger.error("Failed to parse expense classification response", { error: this.errorMessage(error), filePath });
      return fallbackItems.map((item) => this.ruleBasedExpenseClassification(item));
    }
  }

  private normalizeExpenseItem(value: Partial<ExpenseItem>, fallback: Partial<ExpenseItem>): ExpenseItem {
    const type = EXPENSE_ITEM_TYPES.includes(value.type as ExpenseItemType) ? (value.type as ExpenseItemType) : "other";
    const category = EXPENSE_ITEM_CATEGORIES.includes(value.category as ExpenseItemCategory)
      ? (value.category as ExpenseItemCategory)
      : "other";

    return {
      date: typeof value.date === "string" ? value.date : fallback.date || "",
      description: typeof value.description === "string" ? value.description : fallback.description || "",
      business: typeof value.business === "string" ? value.business : fallback.business || "",
      amount: typeof value.amount === "string" ? value.amount : String(fallback.amount ?? "0"),
      category,
      type,
    };
  }

  private ruleBasedExpenseClassification(item: Partial<ExpenseItem>): ExpenseItem {
    const text = `${item.description || ""} ${item.business || ""}`.toLowerCase();

    let category: ExpenseItemCategory = "other";
    if (text.includes("restaurant") || text.includes("dining")) category = "restaurant";
    else if (text.includes("movie") || text.includes("cinema")) category = "movies";
    else if (text.includes("entertainment") || text.includes("netflix") || text.includes("spotify")) category = "entertainment";
    else if (text.includes("cloth") || text.includes("apparel")) category = "clothes";
    else if (text.includes("grocery") || text.includes("market")) category = "groceries";
    else if (text.includes("gas") || text.includes("fuel")) category = "gas";
    else if (text.includes("saving") || text.includes("invest")) category = "savings";

    let type: ExpenseItemType = "other";
    if (category === "savings") type = "savings";
    else if (["groceries", "gas"].includes(category)) type = "needs";
    else if (["restaurant", "entertainment", "movies", "clothes"].includes(category)) type = "wants";

    return {
      date: item.date || "",
      description: item.description || "",
      business: item.business || "",
      amount: String(item.amount ?? "0"),
      category,
      type,
    };
  }

  private buildSmartAnalysisPrompt(input: {
    items: ExpenseItem[];
    fiftyThirtyTwenty?: { needs: number; wants: number; savings: number; monthlyIncome: number };
    monthlyExpenses?: { needs: number; wants: number; savings: number };
  }): string {
    const totals = input.items.reduce(
      (acc, item) => {
        const amount = Number(item.amount) || 0;
        if (item.type === "needs") acc.needs += amount;
        else if (item.type === "wants") acc.wants += amount;
        else if (item.type === "savings") acc.savings += amount;
        else acc.other += amount;
        return acc;
      },
      { needs: 0, wants: 0, savings: 0, other: 0 }
    );

    const targetSection = input.fiftyThirtyTwenty
      ? `
50/30/20 Targets (based on monthly income of $${input.fiftyThirtyTwenty.monthlyIncome.toFixed(2)}):
- Needs (50%): $${input.fiftyThirtyTwenty.needs.toFixed(2)}
- Wants (30%): $${input.fiftyThirtyTwenty.wants.toFixed(2)}
- Savings (20%): $${input.fiftyThirtyTwenty.savings.toFixed(2)}
`
      : "";

    const expectedSection = input.monthlyExpenses
      ? `
Expected Monthly Recurring Expenses:
- Needs: $${input.monthlyExpenses.needs.toFixed(2)}
- Wants: $${input.monthlyExpenses.wants.toFixed(2)}
- Savings: $${input.monthlyExpenses.savings.toFixed(2)}
`
      : "";

    return `
Analyze the user's actual expenses against the targets provided below.
${targetSection}${expectedSection}
Actual Spending (from uploaded expenses):
- Needs: $${totals.needs.toFixed(2)}
- Wants: $${totals.wants.toFixed(2)}
- Savings: $${totals.savings.toFixed(2)}
- Other/Unclassified: $${totals.other.toFixed(2)}

Actual Expense Items:
${JSON.stringify(input.items, null, 2)}

Provide actionable recommendations comparing actual spending to the targets above. Focus on overspending, under-saving, and where Wants can be reduced and redirected.
`;
  }

  private buildRuleBasedSmartAnalysisRecommendation(input: {
    items: ExpenseItem[];
    fiftyThirtyTwenty?: { needs: number; wants: number; savings: number; monthlyIncome: number };
    monthlyExpenses?: { needs: number; wants: number; savings: number };
  }): string {
    const totals = input.items.reduce(
      (acc, item) => {
        const amount = Number(item.amount) || 0;
        if (item.type === "needs") acc.needs += amount;
        else if (item.type === "wants") acc.wants += amount;
        else if (item.type === "savings") acc.savings += amount;
        return acc;
      },
      { needs: 0, wants: 0, savings: 0 }
    );

    const lines: string[] = [];
    if (input.fiftyThirtyTwenty) {
      lines.push(
        totals.needs > input.fiftyThirtyTwenty.needs
          ? `Your needs spending ($${totals.needs.toFixed(2)}) is above your 50% target ($${input.fiftyThirtyTwenty.needs.toFixed(2)}).`
          : `Your needs spending is within your 50% target.`
      );
      lines.push(
        totals.wants > input.fiftyThirtyTwenty.wants
          ? `Your wants spending ($${totals.wants.toFixed(2)}) is above your 30% target ($${input.fiftyThirtyTwenty.wants.toFixed(2)}).`
          : `Your wants spending is within your 30% target.`
      );
      lines.push(
        totals.savings < input.fiftyThirtyTwenty.savings
          ? `Your savings ($${totals.savings.toFixed(2)}) are below your 20% target ($${input.fiftyThirtyTwenty.savings.toFixed(2)}).`
          : `Your savings meet or exceed your 20% target.`
      );
    } else {
      lines.push("Add your 50/30/20 income breakdown for a target-based comparison.");
    }

    return lines.join("\n");
  }
}

export const aiService = new AIService();
