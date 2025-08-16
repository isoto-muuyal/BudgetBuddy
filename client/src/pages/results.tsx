import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Bot, Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ResultsProps {
  params: { id: string };
}

export default function Results({ params }: ResultsProps) {
  const [, setLocation] = useLocation();
  const analysisId = params.id;

  const { data: analysis, isLoading } = useQuery<any>({
    queryKey: ["/api/analysis", analysisId],
    enabled: !!analysisId,
  });

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <Skeleton className="w-16 h-16 rounded-full mx-auto mb-4" />
              <Skeleton className="h-8 w-48 mx-auto mb-2" />
              <Skeleton className="h-4 w-64 mx-auto" />
            </div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <CardContent className="p-8 text-center">
            <p className="text-gray-600">Analysis not found</p>
            <Button onClick={() => setLocation("/upload")} className="mt-4">
              Upload New Statement
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyIncome = parseFloat(analysis.monthlyIncome);
  const actualNeedsPercent = analysis.actualNeeds ? Math.round((parseFloat(analysis.actualNeeds) / monthlyIncome) * 100) : 0;
  const actualWantsPercent = analysis.actualWants ? Math.round((parseFloat(analysis.actualWants) / monthlyIncome) * 100) : 0;
  const actualSavingsPercent = analysis.actualSavings ? Math.round((parseFloat(analysis.actualSavings) / monthlyIncome) * 100) : 0;

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "50%":
        return <Badge className="needs-bg needs-text">Needs</Badge>;
      case "30%":
        return <Badge className="wants-bg wants-text">Wants</Badge>;
      case "20%":
        return <Badge className="savings-bg savings-text">Savings</Badge>;
      default:
        return <Badge className="undefined-bg undefined-text">Unclear</Badge>;
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-results">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-green-400 to-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-results-title">
              Expense Analysis
            </h2>
            <p className="text-gray-600" data-testid="text-results-description">
              AI analysis of your spending patterns
            </p>
          </div>

          {/* Current vs Recommended Comparison */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3 text-center">Your Current Spending</h3>
              <div className="space-y-2">
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="flex justify-between">
                    <span className="text-sm text-red-800">Needs</span>
                    <span className="font-semibold text-red-800" data-testid="text-actual-needs-percent">
                      {actualNeedsPercent}%
                    </span>
                  </div>
                  <div className="text-xs text-red-600" data-testid="text-actual-needs-amount">
                    ${analysis.actualNeeds}
                  </div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                  <div className="flex justify-between">
                    <span className="text-sm text-orange-800">Wants</span>
                    <span className="font-semibold text-orange-800" data-testid="text-actual-wants-percent">
                      {actualWantsPercent}%
                    </span>
                  </div>
                  <div className="text-xs text-orange-600" data-testid="text-actual-wants-amount">
                    ${analysis.actualWants}
                  </div>
                </div>
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="flex justify-between">
                    <span className="text-sm text-red-800">Savings</span>
                    <span className="font-semibold text-red-800" data-testid="text-actual-savings-percent">
                      {actualSavingsPercent}%
                    </span>
                  </div>
                  <div className="text-xs text-red-600" data-testid="text-actual-savings-amount">
                    ${analysis.actualSavings}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-600 mb-3 text-center">Recommended</h3>
              <div className="space-y-2">
                <div className="needs-bg p-3 rounded-lg border">
                  <div className="flex justify-between">
                    <span className="text-sm needs-text">Needs</span>
                    <span className="font-semibold needs-text">50%</span>
                  </div>
                  <div className="text-xs text-gray-600">${analysis.recommendedNeeds}</div>
                </div>
                <div className="wants-bg p-3 rounded-lg border">
                  <div className="flex justify-between">
                    <span className="text-sm wants-text">Wants</span>
                    <span className="font-semibold wants-text">30%</span>
                  </div>
                  <div className="text-xs text-gray-600">${analysis.recommendedWants}</div>
                </div>
                <div className="savings-bg p-3 rounded-lg border">
                  <div className="flex justify-between">
                    <span className="text-sm savings-text">Savings</span>
                    <span className="font-semibold savings-text">20%</span>
                  </div>
                  <div className="text-xs text-gray-600">${analysis.recommendedSavings}</div>
                </div>
              </div>
            </div>
          </div>

          {/* AI Recommendations */}
          {analysis.recommendations && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Bot className="text-brand-blue mr-2" />
                AI Recommendations
              </h3>
              <div className="text-sm text-gray-700" data-testid="text-recommendations">
                {analysis.recommendations}
              </div>
            </div>
          )}

          {/* Detailed Expense Breakdown */}
          {analysis.expenses && analysis.expenses.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Expense Breakdown</h3>
              <ScrollArea className="h-60" data-testid="scroll-expenses">
                <div className="space-y-3">
                  {analysis.expenses.map((expense: any, index: number) => (
                    <div
                      key={index}
                      className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      data-testid={`expense-${index}`}
                    >
                      <div>
                        <div className="font-medium text-gray-900">{expense.description}</div>
                        {expense.subcategory && (
                          <div className="text-xs text-gray-500">{expense.subcategory}</div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {expense.amount < 0 ? "-" : "+"}${Math.abs(expense.amount).toFixed(2)}
                        </div>
                        {getCategoryBadge(expense.category)}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="flex space-x-3">
            <Button
              onClick={() => setLocation("/upload")}
              variant="outline"
              className="flex-1 py-3 rounded-lg font-medium"
              data-testid="button-upload-new"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload New
            </Button>
            <Button
              className="flex-1 bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
              data-testid="button-download"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Report
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
