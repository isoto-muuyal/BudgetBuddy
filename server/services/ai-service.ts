import { config } from "../config";
import { pipeline, env } from '@huggingface/transformers';
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

export class AIService {
  private baseUrl: string;
  private model: string;
  private aiService: string;
  private accessToken: string;
  private bertClassifier: any;
  private bertSentiment: any;
  private hfClient: InferenceClient;
  private bertClasifier: any;
  //private bertSentiment: any;


  constructor() {
    this.baseUrl = config.ai.baseUrl;
    this.model = config.ai.model;
    this.aiService = config.ai.service;
    this.accessToken = config.ai.accessToken;
    this.hfClient = new InferenceClient(this.accessToken);
    this.initializeHuggingFaceModels();
  }

  private async initializeHuggingFaceModels() {
    // Skip local BERT model initialization when using HuggingFace router API
    // The finance-Llama3-8B model handles all analysis via API calls
    if (this.aiService === "huggingface") {
      console.log("Using Hugging Face router API with finance-Llama3-8B model");
    }
  }

  async analyzeExpenses(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
    if (this.aiService === "huggingface") {
      return this.analyzeWithHuggingFace(textContent, monthlyIncome);
    } else {
      return this.analyzeWithAI(textContent, monthlyIncome);
    }
  }

  private async analyzeWithAI(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
    const prompt = `
Return ONLY valid JSON. Do not include explanations or extra text. 
The JSON must strictly follow this schema:
${this.buildAnalysisPrompt(textContent, monthlyIncome)}
`;

    const userPrompt = `I earn $${monthlyIncome} per month. Here are my transactions:\n\n` + prompt;

    try {
      console.log("Sending prompt to AI service:", userPrompt);
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_mime_type: "application/json",
          stream: false,
        }),
      });

      console.log('response', response);

      if (!response.ok) {
        throw new Error(`AI API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('AI response data:', data);
      const analysisText = data.choices[0].message.content;
      console.log("AI analysis text:", analysisText);
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error("AI analysis with Hugging Face failed:", error);
      throw new Error("Failed to analyze expenses with AI");
    }
  }

// Analyze using Hugging Face Inference API with finance-Llama3-8B model
private async analyzeWithHuggingFace(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
  const prompt = this.buildAnalysisPrompt(textContent, monthlyIncome);

  try {
    console.log("Sending prompt to Hugging Face with InferenceClient");

    const result = await this.hfClient.chatCompletion({
      model: this.model, // e.g. "HuggingFaceH4/zephyr-7b-beta" or your own
      messages: [
        {
          role: "system",
          content:
            "You are a financial advisor specializing in budget analysis using the 50/30/20 rule. " +
            "Always reply ONLY with valid JSON. Do NOT invent, guess, or assume financial figures " +
            "not explicitly mentioned in the user's input, and do NOT return more expenses than received. " +
            "If uncertain about any categorization, use 'undefined'. Do NOT duplicate records."
        },
        { role: "user", content: prompt }
      ],
      // Keep it simple — only supported fields
      temperature: 0.2,
      max_tokens: 1024
    });

    console.log("✅ Hugging Face result received");
    const analysisText = result.choices?.[0]?.message?.content ?? "";

    // Save raw output in case parsing fails (for debugging)
    try {
      return this.parseAnalysisResponse(analysisText);
    } catch (parseErr) {
      console.error("⚠️ JSON parse failed, saving raw response for inspection.");
      await fs.promises.writeFile("hf_raw_response.json", analysisText, "utf-8");
      throw parseErr;
    }

  } catch (error: any) {
    console.error("❌ AI analysis with HfInference failed:", error.response?.body || error.message);
    await fs.promises.writeFile("hf_error_log.json", JSON.stringify(error, null, 2), "utf-8");
    throw new Error("Failed to analyze expenses with Hugging Face");
  }
}

  private extractTransactions(textContent: string): Array<{ description: string, amount: number }> {
    const lines = textContent.split('\n').filter(line => line.trim());
    const transactions: Array<{ description: string, amount: number }> = [];

    lines.forEach(line => {
      const amountMatch = line.match(/[-$]?[\d,]+\.?\d*/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[0].replace(/[$,]/g, ''));
        if (amount > 0) {
          transactions.push({
            description: line.trim(),
            amount: -amount // Negative for expenses
          });
        }
      }
    });

    return transactions;
  }

  private async classifyTransactionsWithBERT(transactions: Array<{ description: string, amount: number }>): Promise<Array<{
    description: string;
    amount: number;
    category: '50%' | '30%' | '20%' | 'undefined';
    subcategory?: string;
  }>> {
    const candidateLabels = [
      'essential needs housing rent mortgage',
      'essential needs food groceries utilities',
      'essential needs transportation gas insurance',
      'essential needs healthcare medical',
      'wants entertainment dining shopping',
      'wants lifestyle hobbies subscriptions',
      'savings investment transfer deposit'
    ];

    const classifiedExpenses = [];

    for (const transaction of transactions) {
      try {
        if (!this.bertClassifier) {
          // Fallback to simple rule-based classification
          const category = this.simpleClassifyTransaction(transaction.description);
          classifiedExpenses.push({
            ...transaction,
            category,
            subcategory: this.getSubcategory(transaction.description, category)
          });
          continue;
        }

        const result = await this.bertClassifier(transaction.description, candidateLabels);
        let category: '50%' | '30%' | '20%' | 'undefined' = 'undefined';
        let subcategory = '';

        if (result.scores[0] > 0.6) { // High confidence threshold
          const topLabel = result.labels[0];
          if (topLabel.includes('essential needs')) {
            category = '50%';
            if (topLabel.includes('housing')) subcategory = 'Housing';
            else if (topLabel.includes('food')) subcategory = 'Food';
            else if (topLabel.includes('transportation')) subcategory = 'Transportation';
            else if (topLabel.includes('healthcare')) subcategory = 'Healthcare';
            else subcategory = 'Essential';
          } else if (topLabel.includes('wants')) {
            category = '30%';
            if (topLabel.includes('entertainment')) subcategory = 'Entertainment';
            else if (topLabel.includes('lifestyle')) subcategory = 'Lifestyle';
            else subcategory = 'Wants';
          } else if (topLabel.includes('savings')) {
            category = '20%';
            subcategory = 'Savings';
          }
        } else {
          // Low confidence, use fallback classification
          category = this.simpleClassifyTransaction(transaction.description);
          subcategory = this.getSubcategory(transaction.description, category);
        }

        classifiedExpenses.push({
          ...transaction,
          category,
          subcategory
        });
      } catch (error) {
        console.warn('BERT classification failed for transaction:', transaction.description, error);
        // Fallback to simple classification
        const category = this.simpleClassifyTransaction(transaction.description);
        classifiedExpenses.push({
          ...transaction,
          category,
          subcategory: this.getSubcategory(transaction.description, category)
        });
      }
    }

    return classifiedExpenses;
  }

  // ---- New helper: normalize subcategory/category strings and map to 50/30/20 ----
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

  private normalizeExpenses(rawExpenses: any[]): AIExpenseAnalysis['expenses'] {
    const allowedCategories = new Set(['50%', '30%', '20%', 'undefined']);

    const normalizeKey = (s: unknown) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

    return (rawExpenses || []).map((e: any) => {
      const description = typeof e?.description === 'string' ? e.description : String(e ?? '');
      const amount = typeof e?.amount === 'number' ? e.amount : Number(e?.amount ?? 0);
      let categoryRaw = typeof e?.category === 'string' ? e.category.trim() : '';
      let category: AIExpenseAnalysis['expenses'][0]['category'] | undefined;

      // If category is already one of the allowed canonical values, use it
      if (allowedCategories.has(categoryRaw)) {
        category = categoryRaw as AIExpenseAnalysis['expenses'][0]['category'];
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
            category = (n + '%') as AIExpenseAnalysis['expenses'][0]['category'];
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

  // ---- New helper: compute totals from normalized expenses ----
  private calculateTotalsFromExpenses(expenses: AIExpenseAnalysis['expenses']): {
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

  private calculateCategoryTotals(expenses: Array<{ amount: number, category: string }>): {
    needs: number;
    wants: number;
    savings: number;
    undefined: number;
  } {
    let needs = 0;
    let wants = 0;
    let savings = 0;
    let undefined = 0;

    expenses.forEach(expense => {
      switch (expense.category) {
        case '50%':
          needs += Math.abs(expense.amount);
          break;
        case '30%':
          wants += Math.abs(expense.amount);
          break;
        case '20%':
          savings += Math.abs(expense.amount);
          break;
        default:
          undefined += Math.abs(expense.amount);
      }
    });

    return { needs, wants, savings, undefined };
  }

  private async generateBERTRecommendations(totals: any, monthlyIncome: number): Promise<string> {
    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;

    let recommendations = `Based on your BERT-analyzed spending patterns:\n\n`;

    const needsPercentage = (totals.needs / monthlyIncome) * 100;
    const wantsPercentage = (totals.wants / monthlyIncome) * 100;
    const savingsPercentage = (totals.savings / monthlyIncome) * 100;

    if (totals.needs > recommendedNeeds) {
      recommendations += `• Your essential needs spending (${needsPercentage.toFixed(1)}%) exceeds the recommended 50%. AI analysis suggests reviewing housing, food, and transportation costs for potential optimizations.\n`;
    }

    if (totals.wants > recommendedWants) {
      recommendations += `• Your discretionary spending (${wantsPercentage.toFixed(1)}%) exceeds the recommended 30%. BERT identified entertainment and lifestyle categories that could be reduced.\n`;
    }

    if (totals.savings < recommendedSavings) {
      recommendations += `• Your savings rate (${savingsPercentage.toFixed(1)}%) is below the recommended 20%. Consider automating transfers to reach your savings goals.\n`;
    }

    if (recommendations === `Based on your BERT-analyzed spending patterns:\n\n`) {
      recommendations += `• Excellent financial management! Your AI-analyzed spending aligns well with the 50/30/20 rule. Continue monitoring your patterns for sustained success.`;
    }

    return recommendations;
  }

  private fallbackRuleBasedAnalysis(textContent: string, monthlyIncome: number): AIExpenseAnalysis {
    // Fallback analysis when BERT models fail to load or process

    const lines = textContent.split('\n').filter(line => line.trim());
    const expenses: any[] = [];
    let totalNeeds = 0;
    let totalWants = 0;
    let totalSavings = 0;

    // Simple pattern matching for demo purposes
    lines.forEach(line => {
      const amountMatch = line.match(/[-$]?[\d,]+\.?\d*/);
      if (amountMatch) {
        const amount = parseFloat(amountMatch[0].replace(/[$,]/g, ''));
        if (amount > 0) {
          let category: '50%' | '30%' | '20%' | 'undefined' = 'undefined';
          let subcategory = '';

          // Basic categorization rules
          if (line.toLowerCase().includes('rent') || line.toLowerCase().includes('grocery') ||
            line.toLowerCase().includes('utility') || line.toLowerCase().includes('gas')) {
            category = '50%';
            subcategory = 'Essential';
            totalNeeds += amount;
          } else if (line.toLowerCase().includes('restaurant') || line.toLowerCase().includes('entertainment') ||
            line.toLowerCase().includes('shopping') || line.toLowerCase().includes('coffee')) {
            category = '30%';
            subcategory = 'Lifestyle';
            totalWants += amount;
          } else if (line.toLowerCase().includes('savings') || line.toLowerCase().includes('investment') ||
            line.toLowerCase().includes('transfer')) {
            category = '20%';
            subcategory = 'Savings';
            totalSavings += amount;
          }

          expenses.push({
            description: line.trim(),
            amount: -amount, // Negative for expenses
            category,
            subcategory
          });
        }
      }
    });

    const recommendedNeeds = monthlyIncome * 0.5;
    const recommendedWants = monthlyIncome * 0.3;
    const recommendedSavings = monthlyIncome * 0.2;

    let recommendations = `Based on your spending analysis:\n\n`;

    if (totalNeeds > recommendedNeeds) {
      recommendations += `• Your needs spending (${((totalNeeds / monthlyIncome) * 100).toFixed(1)}%) exceeds the recommended 50%. Consider finding ways to reduce essential expenses.\n`;
    }

    if (totalWants > recommendedWants) {
      recommendations += `• Your wants spending (${((totalWants / monthlyIncome) * 100).toFixed(1)}%) exceeds the recommended 30%. Try to cut back on non-essential purchases.\n`;
    }

    if (totalSavings < recommendedSavings) {
      recommendations += `• Your savings (${((totalSavings / monthlyIncome) * 100).toFixed(1)}%) are below the recommended 20%. Try to increase your savings rate.\n`;
    }

    if (recommendations === `Based on your spending analysis:\n\n`) {
      recommendations += `• Great job! Your spending appears to align well with the 50/30/20 rule. Keep up the good financial habits!`;
    }

    return {
      needs: totalNeeds,
      wants: totalWants,
      savings: totalSavings,
      undefined: 0,
      expenses,
      recommendations
    };
  }

  // private calculateTotalsFromExpenses(
  //   expenses: Array<{ amount: number; category: '50%' | '30%' | '20%' | 'undefined' }>
  // ): { needs: number; wants: number; savings: number; undefined: number } {
  //   let needs = 0;
  //   let wants = 0;
  //   let savings = 0;
  //   let uncategorized = 0;

  //   expenses.forEach(exp => {
  //     const value = Math.abs(exp.amount); // ensure positive for totals
  //     switch (exp.category) {
  //       case '50%':
  //         needs += value;
  //         break;
  //       case '30%':
  //         wants += value;
  //         break;
  //       case '20%':
  //         savings += value;
  //         break;
  //       default:
  //         uncategorized += value;
  //     }
  //   });

  //   return { needs, wants, savings, undefined: uncategorized };
  // }

  private buildAnalysisPrompt(textContent: string, monthlyIncome: number): string {
    return `
You are a financial advisor analyzing bank statement data. Please categorize each expense according to the 50/30/20 budgeting rule:

- 50% for NEEDS: Essential expenses like rent, groceries, utilities, minimum debt payments, insurance, transportation to work
- 30% for WANTS: Non-essential expenses like entertainment, dining out, hobbies, subscriptions, shopping
- 20% for SAVINGS: Money saved, invested, or put toward debt payments above minimums

Monthly Income: $${monthlyIncome}
Breakdown:
- Needs: $${(monthlyIncome * 0.5).toFixed(2)}
- Wants: $${(monthlyIncome * 0.3).toFixed(2)}
- Savings: $${(monthlyIncome * 0.2).toFixed(2)}

Bank Statement Content:
${textContent}

Please analyze the transactions and provide your response in the following JSON format:

The response must be a json object following the next format:
{
    expenses: [array of expenses]
    recommendations: "detailed recommendations"
}

one expense object looks like this:
{
      "description": "[transaction description]",
      "amount": [amount as number, negative for expenses, positive for income/savings],
      "category": "[50%, 30%, 20%, or undefined]",
      "subcategory": "[specific category like Housing, Food, Entertainment, etc.]"
    }

expenses looks like this
"expenses": [
    {
      "description": "[transaction description]",
      "amount": [amount as number, negative for expenses, positive for income/savings],
      "category": "[50%, 30%, 20%, or undefined]",
      "subcategory": "[specific category like Housing, Food, Entertainment, etc.]"
    }
  ],

and recommendations like this
  "recommendations": "[Detailed recommendations for improving their budget based on the 50/30/20 rule. Provide specific actionable advice.]"

The response object should look like this example

{
  "expenses": [
    {
      "description": "[transaction description]",
      "amount": [amount as number, negative for expenses, positive for income/savings],
      "category": "[50%, 30%, 20%, or undefined] this are the only categories allowed",
      "subcategory": "[specific category like Housing, Food, Entertainment, etc.]"
    }
  ],
  "recommendations": "[Detailed recommendations for improving their budget based on the 50/30/20 rule. Provide specific actionable advice.]"
}

Important:
- Be conservative with categorization - when unsure, use "undefined"
- Negative amounts are expenses, positive amounts are income or transfers to savings
- Focus on providing actionable, specific recommendations
- Consider their actual spending vs recommended percentages
- when subcategory is Wants then category must be 30%
- If subcategory is Housing then category must be 50%
`;
  }

  private parseAnalysisResponse(responseText: string): AIExpenseAnalysis {
    console.log("Parsing AI response:", responseText);
    try {
      // Extract JSON block (robust to extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in AI response");
      }

      let cleaned = jsonMatch[0]
        // remove non-printable control characters except line breaks, tabs if you want
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
        // normalize weird spacing (optional)
        .replace(/\s+/g, " ")
        .trim();

      const jsonData = JSON.parse(cleaned);
      
      // Ensure we have an array (defensive)
      const rawExpenses = Array.isArray(jsonData.expenses) ? jsonData.expenses : [];
      console.log("Extracted raw expenses:", rawExpenses);

      // Normalize categories and subcategories
      const expenses = this.normalizeExpenses(rawExpenses);
      console.log("Normalized expenses:", expenses);

      // Calculate totals from normalized expenses
      const totals = this.calculateTotalsFromExpenses(expenses);
      console.log("Calculated totals:", totals);

      return {
        needs: totals.needs,
        wants: totals.wants,
        savings: totals.savings,
        undefined: totals.undefined,
        expenses,
        recommendations: typeof jsonData.recommendations === 'string' ? jsonData.recommendations : (jsonData.recommendation || "No specific recommendations available."),
      };

    } catch (error) {

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const path = `./failed_ai_responses/ai_response_${timestamp}.txt`;
      fs.mkdirSync('./failed_ai_responses', { recursive: true });
      fs.writeFileSync(path, responseText);
      console.log(`Saved failed AI response to ${path}`);
      console.error("Failed to parse AI response: " + responseText, error);

      // Return a fallback response
      return {
        needs: 0,
        wants: 0,
        savings: 0,
        undefined: 0,
        expenses: [],
        recommendations: "Unable to analyze expenses automatically. Please review your transactions manually and categorize them according to the 50/30/20 rule.",
      };
    }
  }
}

export const aiService = new AIService();