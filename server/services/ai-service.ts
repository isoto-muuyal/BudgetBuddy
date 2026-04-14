import fs from "fs";
import { InferenceClient } from "@huggingface/inference";
import { config } from "../config";
import { storage } from "../storage";
import { vectorStoreService } from "./vector-store-service";

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

export class AIService {
  private readonly agentClient: InferenceClient;
  private readonly agentModel: string;

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
    const token =
      config.ai.recommendations.accessToken ||
      config.ai.categorization.accessToken ||
      config.ai.accessToken;

    this.agentClient = new InferenceClient(token);
    this.agentModel = config.ai.recommendations.model || config.ai.categorization.model;
  }

  async analyzeExpenses(
    textContent: string,
    monthlyIncome: number,
    context: AnalysisAgentContext = {}
  ): Promise<AIExpenseAnalysis> {
    try {
      const expenses = await this.runCategorizerAgent(textContent, monthlyIncome);
      const recommendations = await this.runAdvisorAgent(expenses, monthlyIncome);
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
      console.error("Error in analyzeExpenses:", error);
      return this.fallbackRuleBasedAnalysis(textContent, monthlyIncome);
    }
  }

  async analyzeHistoryPatterns(rows: AIHistoryPatternRow[]): Promise<string> {
    if (!rows.length) {
      return "Not enough completed analyses to detect meaningful patterns yet.";
    }

    try {
      const response = await this.runTextCompletion({
        systemPrompt:
          "You are a financial analyst. Identify patterns and trends across multiple monthly analyses. Focus on consistent overspending or underspending categories, and summarize clear behavioral patterns.",
        userPrompt: this.buildHistoryPatternsPrompt(rows),
        maxTokens: 1024,
        temperature: 0.4,
      });

      return this.parseRecommendationsResponse(response);
    } catch (error: any) {
      console.error("History patterns AI failed:", error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }
      return "Unable to generate historical patterns at this time. Please try again later.";
    }
  }

  private async runCategorizerAgent(textContent: string, monthlyIncome: number): Promise<CategorizedExpense[]> {
    console.log(`${CATEGORIZER_AGENT}: preparing categorization request`);
    return this.runCategorizerTool(textContent, monthlyIncome);
  }

  private async runCategorizerTool(textContent: string, monthlyIncome: number): Promise<CategorizedExpense[]> {
    const prompt = this.buildCategorizationPrompt(textContent, monthlyIncome);

    try {
      console.log(`${CATEGORIZER_TOOL}: calling AI`);
      const responseText = await this.runJsonCompletion({
        systemPrompt:
          "You are a financial transaction categorization expert. Your task is to categorize expenses according to the 50/30/20 budgeting rule. Always return ONLY valid JSON. Do not invent or duplicate transactions. If uncertain, use 'undefined'.",
        userPrompt: prompt,
        maxTokens: 4096,
        temperature: 0.1,
      });

      return this.parseCategorizationResponse(responseText);
    } catch (error: any) {
      console.error(`${CATEGORIZER_TOOL} failed:`, error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }

      console.log(`${CATEGORIZER_TOOL}: falling back to rule-based categorization`);
      return this.ruleBasedCategorization(textContent);
    }
  }

  private async runAdvisorAgent(expenses: CategorizedExpense[], monthlyIncome: number): Promise<string> {
    console.log(`${ADVISOR_AGENT}: preparing recommendations request`);
    return this.runAdvisorTool(expenses, monthlyIncome);
  }

  private async runAdvisorTool(expenses: CategorizedExpense[], monthlyIncome: number): Promise<string> {
    const prompt = this.buildRecommendationsPrompt(expenses, monthlyIncome);

    try {
      console.log(`${ADVISOR_TOOL}: calling AI`);
      const responseText = await this.runTextCompletion({
        systemPrompt:
          "You are a financial advisor specializing in budget analysis using the 50/30/20 rule. Provide detailed, actionable recommendations based on the categorized expenses.",
        userPrompt: prompt,
        maxTokens: 2048,
        temperature: 0.7,
      });

      return this.parseRecommendationsResponse(responseText);
    } catch (error: any) {
      console.error(`${ADVISOR_TOOL} failed:`, error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }

      console.log(`${ADVISOR_TOOL}: falling back to rule-based recommendations`);
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
    console.log(`${GLOBAL_ADVISOR_AGENT}: building historical context`);

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
      console.log(`${GLOBAL_ADVISOR_TOOL}: calling AI`);
      const responseText = await this.runJsonCompletion({
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
      console.error(`${GLOBAL_ADVISOR_TOOL} failed:`, error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }

      return this.buildRuleBasedGlobalAdvice(input.historicalAnalyses);
    }
  }

  private async runTextCompletion(input: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    const result = await this.agentClient.chatCompletion({
      model: this.agentModel,
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
    systemPrompt: string;
    userPrompt: string;
    maxTokens: number;
    temperature: number;
  }): Promise<string> {
    const result = await this.agentClient.chatCompletion({
      model: this.agentModel,
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

  private buildCategorizationPrompt(textContent: string, monthlyIncome: number): string {
    return `
You are categorizing financial transactions according to the 50/30/20 budgeting rule:

- 50% for NEEDS: Essential expenses like rent, groceries, utilities, minimum debt payments, insurance, transportation to work
- 30% for WANTS: Non-essential expenses like entertainment, dining out, hobbies, subscriptions, shopping
- 20% for SAVINGS: Money saved, invested, or put toward debt payments above minimums

Monthly Income: $${monthlyIncome}

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

  private buildRecommendationsPrompt(expenses: CategorizedExpense[], monthlyIncome: number): string {
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;
    const divisor = monthlyIncome || 1;

    return `
You are analyzing a user's spending patterns based on the 50/30/20 budgeting rule.

Monthly Income: $${monthlyIncome}

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
      console.error("Failed to parse categorization response:", error);
      throw error;
    }
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
}

export const aiService = new AIService();
