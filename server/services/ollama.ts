import { config } from "../config";

export interface OllamaExpenseAnalysis {
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

export class OllamaService {
  private baseUrl: string;
  private model: string;

  constructor() {
    this.baseUrl = config.ollama.baseUrl;
    this.model = config.ollama.model;
  }

  async analyzeExpenses(textContent: string, monthlyIncome: number): Promise<OllamaExpenseAnalysis> {
    const prompt = this.buildAnalysisPrompt(textContent, monthlyIncome);

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
          options: {
            temperature: 0.3,
            top_p: 0.9,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
      }

      const data = await response.json();
      const analysisText = data.response;

      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error("Ollama analysis failed:", error);
      throw new Error("Failed to analyze expenses with AI");
    }
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
    "50%": [total amount for needs],
    "30%": [total amount for wants], 
    "20%": [total amount for savings],
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

  private parseAnalysisResponse(responseText: string): OllamaExpenseAnalysis {
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

export const ollamaService = new OllamaService();
