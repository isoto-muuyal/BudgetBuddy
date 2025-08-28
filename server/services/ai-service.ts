import { config } from "../config";

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
  private accessToken: string;
  private aiService: string;

  constructor() {
    this.baseUrl = config.ai.baseUrl;
    this.model = config.ai.model;
    this.accessToken = config.ai.accessToken;
    this.aiService = process.env.AI_SERVICE || "ollama"; // "ollama" or "huggingface"
  }

  async analyzeExpenses(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
    if (this.aiService === "huggingface") {
      return this.analyzeWithHuggingFace(textContent, monthlyIncome);
    } else {
      return this.analyzeWithOllama(textContent, monthlyIncome);
    }
  }

  async analyzeWithOllama(textContent: string, monthlyIncome: number): Promise<AIExpenseAnalysis> {
    const prompt = this.buildAnalysisPrompt(textContent, monthlyIncome);
    console.log("AI Service started:");
    console.log("AI Prompt:", prompt);
    console.log("Using AI model:", this.model);
    console.log("Using AI base URL:", this.baseUrl);
    console.log("Using AI access token:", this.accessToken ? "****" : "(none)");
    try {
      console.log("Sending request to HF:");
      console.log(JSON.stringify({
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt
        }),
      }, null, 2));
      console.log("Request headers:", {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      });
      const response = await fetch(`${this.baseUrl}${this.model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: prompt
        }),
      });


      if (!response.ok) {
        throw new Error(`AI API error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Raw AI response:", data);
      const analysisText = data[0]?.generated_text || "--no response--";

      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error("AI analysis failed:", error);
      throw new Error("Failed to analyze expenses with AI");
    }
  }

  async analyzeWithHuggingFace(textContent: string, monthlyIncome: number) {
    console.log("Using HuggingFace AI model:", this.model);
    console.log("Using HuggingFace AI base URL:", this.baseUrl);
    console.log("Using token:" , this.accessToken);

    const prompt = `
You are a financial advisor. Monthly income: $${monthlyIncome}.
Analyze these transactions:
${textContent}

Provide JSON output with summary (needs, wants, savings, undefined), expenses, and recommendations.
`;

    const response = await fetch(`${config.ai.baseUrl}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.ai.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: prompt,
        max_new_tokens: 512,
        temperature: 0.7
      }),
    });

    if (!response.ok) {
      throw new Error(`HF API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const textOutput = Array.isArray(data) ? data[0]?.generated_text || "" : data.generated_text || "";
    return textOutput; // parse JSON from textOutput as needed
  }

  private buildAnalysisPrompt(textContent: string, monthlyIncome: number): string {
    return `
You are a financial advisor analyzing bank statement data. Please categorize each expense according to the 50/30/20 budgeting rule:

- 50% for NEEDS: Essential expenses like rent, groceries, utilities, minimum debt payments, insurance, transportation to work
- 30% for WANTS: Non-essential expenses like entertainment, dining out, hobbies, subscriptions, shopping
- 20% for SAVINGS: Money saved, invested, or put toward debt payments above minimums

Monthly Income: $${monthlyIncome}
Recommended breakdown:
- Needs: $${(monthlyIncome * 0.5).toFixed(2)}
- Wants: $${(monthlyIncome * 0.3).toFixed(2)}
- Savings: $${(monthlyIncome * 0.2).toFixed(2)}

Bank Statement Content:
${textContent}

Please analyze the transactions and provide your response in the following JSON format:

{
  "summary": {
    "needs": [total amount for needs],
    "wants": [total amount for wants], 
    "saving": [total amount for savings],
    "undefined": [total amount for unclear categorization]
  },
  "expenses": [
    {
      "description": "[transaction description]",
      "amount": [amount as number, negative for expenses, positive for income/savings],
      "category": "[50%, 30%, 20%, or undefined]",
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
`;
  }

  private parseAnalysisResponse(responseText: string): AIExpenseAnalysis {
    try {
      // Extract JSON from the response (handle cases where Ollama adds extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No valid JSON found in Ollama response");
      }

      const jsonData = JSON.parse(jsonMatch[0]);

      return {
        needs: parseFloat(jsonData.summary?.["50%"] || "0"),
        wants: parseFloat(jsonData.summary?.["30%"] || "0"),
        savings: parseFloat(jsonData.summary?.["20%"] || "0"),
        undefined: parseFloat(jsonData.summary?.["undefined"] || "0"),
        expenses: jsonData.expenses || [],
        recommendations: jsonData.recommendations || "No specific recommendations available.",
      };
    } catch (error) {
      console.error("Failed to parse Ollama response:", error);
      console.log("Raw response:", responseText);

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
