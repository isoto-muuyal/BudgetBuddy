import { config } from "../config";
import { InferenceClient } from '@huggingface/inference';
import fs from 'fs';

export interface AIExpenseAnalysis {
  needs: number;
  wants: number;
  savings: number;
  undefined: number;
  expenses: Array<{
    description: string;
    amount: number;
    category: '50%' | '30%' | '20%' | 'undefined';
    subcategory?: string;
  }>;
  recommendations: string;
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

interface CategorizedExpense {
    description: string;
    amount: number;
    category: '50%' | '30%' | '20%' | 'undefined';
    subcategory?: string;
}

interface CategorizationResponse {
  expenses: CategorizedExpense[];
}

export class AIService {
  private aiService: string;
  private hfClient: InferenceClient;
  private categorizationClient: InferenceClient;
  private recommendationsClient: InferenceClient;

  // Mapping for subcategory to category normalization
  private static SUBCATEGORY_TO_CATEGORY: Record<string, '50%' | '30%' | '20%'> = {
    // Needs (50%)
    housing: '50%',
    rent: '50%',
    mortgage: '50%',
    food: '50%',
    groceries: '50%',
    utilities: '50%',
    transportation: '50%',
    gas: '50%',
    insurance: '50%',
    health: '50%',
    medical: '50%',

    // Wants (30%)
    entertainment: '30%',
    dining: '30%',
    restaurant: '30%',
    shopping: '30%',
    subscriptions: '30%',
    netflix: '30%',
    coffee: '30%',
    lifestyle: '30%',

    // Savings (20%)
    savings: '20%',
    investment: '20%',
    transfer: '20%',
    'extra debt payment': '20%',
    'deposit': '20%',
  };

  constructor() {
    this.aiService = config.ai.service;
    const categorizationToken = config.ai.categorization.accessToken;
    const recommendationsToken = config.ai.recommendations.accessToken;
    
    this.categorizationClient = new InferenceClient(categorizationToken);
    this.recommendationsClient = new InferenceClient(recommendationsToken);
    this.hfClient = new InferenceClient(config.ai.accessToken);
  }

  /**
   * Main entry point: Analyzes expenses by first categorizing them, then generating recommendations
   */
  async analyzeExpenses(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
    try {
      // Step 1: Categorize expenses using categorization AI
      console.log("Step 1: Categorizing expenses...");
      const categorizedExpenses = await this.categorizeExpenses(textContent, monthlyIncome);
      
      // Step 2: Generate recommendations using recommendations AI
      console.log("Step 2: Generating recommendations...");
      const recommendations = await this.generateRecommendations(
        categorizedExpenses,
        monthlyIncome
      );

      // Step 3: Calculate totals from categorized expenses
      const totals = this.calculateTotalsFromExpenses(categorizedExpenses);

      return {
        needs: totals.needs,
        wants: totals.wants,
        savings: totals.savings,
        undefined: totals.undefined,
        expenses: categorizedExpenses,
        recommendations,
      };
    } catch (error) {
      console.error("Error in analyzeExpenses:", error);
      // Fallback to rule-based analysis
      return this.fallbackRuleBasedAnalysis(textContent, monthlyIncome);
    }
  }

  /**
   * Step 1: Categorize expenses using AI optimized for structured JSON output
   */
  private async categorizeExpenses(
    textContent: string,
    monthlyIncome: number
  ): Promise<CategorizedExpense[]> {
    const prompt = this.buildCategorizationPrompt(textContent, monthlyIncome);

    try {
      console.log("Calling categorization AI API...");
      
      const result = await this.categorizationClient.chatCompletion({
        model: config.ai.categorization.model,
        messages: [
          {
            role: "system",
            content: "You are a financial transaction categorization expert. " +
              "Your task is to categorize expenses according to the 50/30/20 budgeting rule. " +
              "Always return ONLY valid JSON. " +
              "**DO NOT invent, guess, or assume any financial figures or categories not explicitly mentioned in the user's input.** " +
              "**DO NOT return more expenses than received.** " +
              "If uncertain about any categorization, use 'undefined'. " +
              "Do NOT duplicate records."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 4096,
        temperature: 0.1,
        repetition_penalty: 1.2,
        response_format: { type: "json_object" }
      });

      const responseText = result.choices[0]?.message?.content ?? "";
      console.log("Categorization AI response received");
      
      return this.parseCategorizationResponse(responseText);
    } catch (error: any) {
      console.error("Categorization AI failed:", error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }
      
      // Fallback to rule-based categorization
      console.log("Falling back to rule-based categorization");
      return this.ruleBasedCategorization(textContent);
    }
  }

  /**
   * Step 2: Generate recommendations using AI optimized for analysis and advice
   */
  private async generateRecommendations(
    expenses: CategorizedExpense[],
    monthlyIncome: number
  ): Promise<string> {
    const prompt = this.buildRecommendationsPrompt(expenses, monthlyIncome);

    try {
      console.log("Calling recommendations AI API...");
      
      const result = await this.recommendationsClient.chatCompletion({
        model: config.ai.recommendations.model,
        messages: [
          {
            role: "system",
            content: "You are a financial advisor specializing in budget analysis using the 50/30/20 rule. " +
              "Provide detailed, actionable recommendations based on the categorized expenses. " +
              "Focus on specific, practical advice that helps users improve their financial habits."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 2048,
        temperature: 0.7, // Higher temperature for more creative recommendations
      });

      const recommendations = result.choices[0]?.message?.content ?? "";
      console.log("Recommendations AI response received");
      
      return this.parseRecommendationsResponse(recommendations);
    } catch (error: any) {
      console.error("Recommendations AI failed:", error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }
      
      // Fallback to rule-based recommendations
      console.log("Falling back to rule-based recommendations");
      return this.ruleBasedRecommendations(expenses, monthlyIncome);
    }
  }

  /**
   * Analyze historical completed analyses for patterns and trends
   */
  async analyzeHistoryPatterns(rows: AIHistoryPatternRow[]): Promise<string> {
    if (!rows.length) {
      return "Not enough completed analyses to detect meaningful patterns yet.";
    }

    const prompt = this.buildHistoryPatternsPrompt(rows);

    try {
      console.log("Calling recommendations AI API for history patterns...");
      const result = await this.recommendationsClient.chatCompletion({
        model: config.ai.recommendations.model,
        messages: [
          {
            role: "system",
            content: "You are a financial analyst. Identify patterns and trends across multiple monthly analyses. " +
              "Focus on consistent overspending or underspending categories, and summarize clear behavioral patterns."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: 1024,
        temperature: 0.4,
      });

      const patterns = result.choices[0]?.message?.content ?? "";
      return this.parseRecommendationsResponse(patterns);
    } catch (error: any) {
      console.error("History patterns AI failed:", error);
      if (error.httpResponse) {
        console.error("HTTP error status:", error.httpResponse.status);
        console.error("HTTP error body:", JSON.stringify(error.httpResponse.body, null, 2));
      }
      return "Unable to generate historical patterns at this time. Please try again later.";
    }
  }

  /**
   * Build prompt for categorization AI
   */
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
- Be conservative with categorization - when unsure, use "undefined"
- Negative amounts are expenses, positive amounts are income or transfers to savings
- DO NOT invent transactions not in the statement
- DO NOT duplicate transactions
- Return ONLY the JSON object, no explanations or extra text
- If subcategory is "Housing" then category must be "50%"
- If subcategory is "Wants" then category must be "30%"
`;
  }

  /**
   * Build prompt for recommendations AI
   */
  private buildRecommendationsPrompt(
    expenses: CategorizedExpense[],
    monthlyIncome: number
  ): string {
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;

    const needsPercentage = ((totals.needs / monthlyIncome) * 100).toFixed(1);
    const wantsPercentage = ((totals.wants / monthlyIncome) * 100).toFixed(1);
    const savingsPercentage = ((totals.savings / monthlyIncome) * 100).toFixed(1);

    return `
You are analyzing a user's spending patterns based on the 50/30/20 budgeting rule.

Monthly Income: $${monthlyIncome}

Recommended Budget:
- Needs (50%): $${recommendedNeeds.toFixed(2)}
- Wants (30%): $${recommendedWants.toFixed(2)}
- Savings (20%): $${recommendedSavings.toFixed(2)}

Actual Spending:
- Needs: $${totals.needs.toFixed(2)} (${needsPercentage}%)
- Wants: $${totals.wants.toFixed(2)} (${wantsPercentage}%)
- Savings: $${totals.savings.toFixed(2)} (${savingsPercentage}%)
- Undefined: $${totals.undefined.toFixed(2)}

Categorized Expenses:
${JSON.stringify(expenses, null, 2)}

Provide detailed, actionable recommendations for improving their budget. Focus on:
1. Specific areas where they're over or under budget
2. Practical steps they can take to align with the 50/30/20 rule
3. Suggestions for reducing expenses in categories that exceed recommendations
4. Ways to increase savings if below 20%
5. Identify specific "Wants" expenses that can be cut and redirected toward debt payments, with estimated amounts

Format your response as clear, actionable advice with bullet points. Be specific and encouraging.
`;
  }

  /**
   * Build prompt for historical pattern analysis
   */
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

  /**
   * Parse categorization response from AI
   */
  private parseCategorizationResponse(responseText: string): CategorizedExpense[] {
    try {
      // Extract JSON block (robust to extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in categorization response");
      }

      let cleaned = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const jsonData: CategorizationResponse = JSON.parse(cleaned);
      const rawExpenses = Array.isArray(jsonData.expenses) ? jsonData.expenses : [];
      
      console.log(`Parsed ${rawExpenses.length} categorized expenses`);
      
      // Normalize and validate expenses
      return this.normalizeExpenses(rawExpenses);
    } catch (error) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = `./failed_ai_responses/categorization_${timestamp}.txt`;
      fs.mkdirSync('./failed_ai_responses', { recursive: true });
      fs.writeFileSync(path, responseText);
      console.log(`Saved failed categorization response to ${path}`);
      console.error("Failed to parse categorization response:", error);
      throw error;
    }
  }

  /**
   * Parse recommendations response from AI
   */
  private parseRecommendationsResponse(responseText: string): string {
    // Clean up the response
    let cleaned = responseText.trim();
    
    // Remove markdown code blocks if present
    cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
    cleaned = cleaned.replace(/^#+\s*/gm, ''); // Remove markdown headers
    
    // If response is too short or empty, return default
    if (cleaned.length < 50) {
      return "Unable to generate specific recommendations. Please review your spending patterns and aim to follow the 50/30/20 rule.";
    }
    
    return cleaned;
  }

  /**
   * Normalize and validate expense categories
   */
  private normalizeExpenses(rawExpenses: any[]): CategorizedExpense[] {
    const allowedCategories = new Set(['50%', '30%', '20%', 'undefined']);

    const normalizeKey = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

    return (rawExpenses || []).map((e: any) => {
      const description = typeof e?.description === 'string' ? e.description : String(e ?? '');
      const amount = typeof e?.amount === 'number' ? e.amount : Number(e?.amount ?? 0);
      let categoryRaw = typeof e?.category === 'string' ? e.category.trim() : '';
      let category: CategorizedExpense['category'] | undefined;

      // If category is already one of the allowed canonical values, use it
      if (allowedCategories.has(categoryRaw)) {
        category = categoryRaw as CategorizedExpense['category'];
      }

      const subcat = normalizeKey(e?.subcategory || '');

      // 1) If category missing or 'undefined', try mapping from subcategory
      if ((!category || category === 'undefined') && subcat) {
        const mapped = (AIService.SUBCATEGORY_TO_CATEGORY as any)[subcat];
        if (mapped) category = mapped;
      }

      // 2) If subcategory looks like a number (e.g. '50' or '50%'), convert to '50%'
      if (!category && subcat) {
        const numMatch = subcat.match(/^(\d{1,3})%?$/);
        if (numMatch) {
          const n = numMatch[1];
          if (n === '50' || n === '30' || n === '20') {
            category = (n + '%') as CategorizedExpense['category'];
          }
        }
      }

      // 3) Try mapping using category text if it's a descriptive word (e.g. 'Housing')
      if (!category && categoryRaw) {
        const mapped = (AIService.SUBCATEGORY_TO_CATEGORY as any)[normalizeKey(categoryRaw)];
        if (mapped) category = mapped;
      }

      // 4) Fallback: if still missing, keep 'undefined'
      if (!category) category = 'undefined';

      return {
        description,
        amount,
        category,
        subcategory: e?.subcategory ? String(e.subcategory) : undefined,
      };
    });
  }

  /**
   * Calculate totals from categorized expenses
   */
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

    for (const exp of expenses) {
      const val = Math.abs(Number(exp.amount) || 0);
      switch (exp.category) {
        case '50%':
          needs += val;
          break;
        case '30%':
          wants += val;
          break;
        case '20%':
          savings += val;
          break;
        default:
          undef += val;
      }
    }

    return { needs, wants, savings, undefined: undef };
  }

  /**
   * Fallback: Rule-based categorization when AI fails
   */
  private ruleBasedCategorization(textContent: string): CategorizedExpense[] {
    const lines = textContent.split('\n').filter(line => line.trim());
    const expenses: CategorizedExpense[] = [];

    lines.forEach(line => {
      const amountMatch = line.match(/[-$]?[\d,]+\.?\d*/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[0].replace(/[$,]/g, ''));
        if (amount > 0) {
          const category = this.simpleClassifyTransaction(line);
          expenses.push({
            description: line.trim(),
            amount: -amount, // Negative for expenses
            category,
            subcategory: this.getSubcategory(line, category)
          });
        }
      }
    });

    return expenses;
  }

  /**
   * Fallback: Rule-based recommendations when AI fails
   */
  private ruleBasedRecommendations(
    expenses: CategorizedExpense[],
    monthlyIncome: number
  ): string {
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;

    let recommendations = `Based on your spending analysis:\n\n`;

    const needsPercentage = ((totals.needs / monthlyIncome) * 100).toFixed(1);
    const wantsPercentage = ((totals.wants / monthlyIncome) * 100).toFixed(1);
    const savingsPercentage = ((totals.savings / monthlyIncome) * 100).toFixed(1);

    if (totals.needs > recommendedNeeds) {
      recommendations += `• Your essential needs spending (${needsPercentage}%) exceeds the recommended 50%. Consider finding ways to reduce essential expenses like housing, food, and transportation.\n`;
    }

    if (totals.wants > recommendedWants) {
      const extraFromWants = (totals.wants - recommendedWants).toFixed(2);
      recommendations += `• Your discretionary spending (${wantsPercentage}%) exceeds the recommended 30%. Try to cut back on non-essential purchases like entertainment and dining out.\n`;
      recommendations += `• Consider redirecting about $${extraFromWants} from Wants toward extra debt payments.\n`;
    }

    if (totals.savings < recommendedSavings) {
      recommendations += `• Your savings (${savingsPercentage}%) are below the recommended 20%. Try to increase your savings rate by automating transfers.\n`;
    }

    if (recommendations === `Based on your spending analysis:\n\n`) {
      recommendations += `• Great job! Your spending appears to align well with the 50/30/20 rule. Keep up the good financial habits!`;
    }

    return recommendations;
  }

  /**
   * Complete fallback analysis when both AI calls fail
   */
  private fallbackRuleBasedAnalysis(textContent: string, monthlyIncome: number): AIExpenseAnalysis {
    const expenses = this.ruleBasedCategorization(textContent);
    const totals = this.calculateTotalsFromExpenses(expenses);
    const recommendations = this.ruleBasedRecommendations(expenses, monthlyIncome);

    return {
      needs: totals.needs,
      wants: totals.wants,
      savings: totals.savings,
      undefined: totals.undefined,
      expenses,
      recommendations,
    };
  }

  /**
   * Simple rule-based transaction classification
   */
  private simpleClassifyTransaction(description: string): '50%' | '30%' | '20%' | 'undefined' {
    const desc = description.toLowerCase();

    // Needs (50%)
    if (desc.includes('rent') || desc.includes('mortgage') || desc.includes('grocery') ||
      desc.includes('utility') || desc.includes('gas') || desc.includes('insurance') ||
      desc.includes('phone') || desc.includes('internet') || desc.includes('medical') ||
      desc.includes('pharmacy') || desc.includes('hospital')) {
      return '50%';
    }

    // Wants (30%)
    if (desc.includes('restaurant') || desc.includes('entertainment') || desc.includes('shopping') ||
      desc.includes('coffee') || desc.includes('movie') || desc.includes('gym') ||
      desc.includes('subscription') || desc.includes('clothing') || desc.includes('beauty') ||
      desc.includes('amazon') || desc.includes('netflix') || desc.includes('spotify')) {
      return '30%';
    }

    // Savings (20%)
    if (desc.includes('savings') || desc.includes('investment') || desc.includes('transfer') ||
      desc.includes('deposit') || desc.includes('401k') || desc.includes('ira')) {
      return '20%';
    }

    return 'undefined';
  }

  /**
   * Get subcategory based on description and category
   */
  private getSubcategory(description: string, category: string): string {
    const desc = description.toLowerCase();

    if (category === '50%') {
      if (desc.includes('rent') || desc.includes('mortgage')) return 'Housing';
      if (desc.includes('grocery') || desc.includes('food')) return 'Food';
      if (desc.includes('gas') || desc.includes('car') || desc.includes('transport')) return 'Transportation';
      if (desc.includes('utility') || desc.includes('electric') || desc.includes('water')) return 'Utilities';
      if (desc.includes('medical') || desc.includes('health')) return 'Healthcare';
      return 'Essential';
    }

    if (category === '30%') {
      if (desc.includes('restaurant') || desc.includes('dining')) return 'Dining';
      if (desc.includes('entertainment') || desc.includes('movie')) return 'Entertainment';
      if (desc.includes('shopping') || desc.includes('clothing')) return 'Shopping';
      if (desc.includes('subscription') || desc.includes('streaming')) return 'Subscriptions';
      return 'Lifestyle';
    }

    if (category === '20%') {
      if (desc.includes('investment') || desc.includes('stock')) return 'Investment';
      if (desc.includes('401k') || desc.includes('retirement')) return 'Retirement';
      return 'Savings';
    }

    return 'Other';
  }
}

export const aiService = new AIService();
