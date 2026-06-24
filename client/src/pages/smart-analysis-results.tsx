import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import type { ExpenseItem, SmartAnalysisResult } from "@shared/schema";

interface SmartAnalysisSnapshot {
  items: ExpenseItem[];
  fiftyThirtyTwenty: { needs: number; wants: number; savings: number; monthlyIncome: number } | null;
  monthlyExpenses: { needs: number; wants: number; savings: number } | null;
}

export default function SmartAnalysisResults() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: result, isLoading } = useQuery<SmartAnalysisResult>({
    queryKey: [`/api/smart-analysis/${id}`],
  });

  const snapshot = result?.snapshot as SmartAnalysisSnapshot | undefined;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-smart-analysis-results">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
                <HandCoins className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-results-title">
                {t("smartAnalysisResults.title")}
              </h2>
            </div>

            {isLoading && (
              <p className="text-center text-slate-300" data-testid="text-results-loading">
                {t("smartAnalysisResults.loading")}
              </p>
            )}

            {!isLoading && !result && (
              <p className="text-center text-slate-300" data-testid="text-results-not-found">
                {t("smartAnalysisResults.notFound")}
              </p>
            )}

            {result && snapshot && (
              <div className="space-y-6">
                {snapshot.fiftyThirtyTwenty && (
                  <div className="rounded-lg border border-white/10 bg-[#171827] p-4" data-testid="card-fifty-thirty-twenty-summary">
                    <h3 className="font-medium text-white mb-2">{t("smartAnalysisResults.fiftyThirtyTwentyTitle")}</h3>
                    <div className="space-y-1 text-sm text-slate-300">
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.needs")}</span>
                        <span>${snapshot.fiftyThirtyTwenty.needs.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.wants")}</span>
                        <span>${snapshot.fiftyThirtyTwenty.wants.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.savings")}</span>
                        <span>${snapshot.fiftyThirtyTwenty.savings.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {snapshot.monthlyExpenses && (
                  <div className="rounded-lg border border-white/10 bg-[#171827] p-4" data-testid="card-monthly-expenses-summary">
                    <h3 className="font-medium text-white mb-2">{t("smartAnalysisResults.monthlyExpensesTitle")}</h3>
                    <div className="space-y-1 text-sm text-slate-300">
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.needs")}</span>
                        <span>${snapshot.monthlyExpenses.needs.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.wants")}</span>
                        <span>${snapshot.monthlyExpenses.wants.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>{t("smartAnalysisResults.savings")}</span>
                        <span>${snapshot.monthlyExpenses.savings.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="rounded-lg border border-white/10 bg-[#171827] p-4 overflow-x-auto" data-testid="table-actual-expenses">
                  <h3 className="font-medium text-white mb-2">{t("smartAnalysisResults.actualExpensesTitle")}</h3>
                  <table className="w-full text-sm text-slate-200">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/10">
                        <th className="py-2 pr-2">{t("smartAnalysis.colDate")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colDescription")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colBusiness")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colAmount")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colType")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colCategory")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshot.items.map((item, index) => (
                        <tr key={index} className="border-b border-white/5">
                          <td className="py-1 pr-2">{item.date}</td>
                          <td className="py-1 pr-2">{item.description}</td>
                          <td className="py-1 pr-2">{item.business}</td>
                          <td className="py-1 pr-2">${parseFloat(item.amount || "0").toFixed(2)}</td>
                          <td className="py-1 pr-2">{t(`expenseItem.type.${item.type}`)}</td>
                          <td className="py-1 pr-2">{t(`expenseItem.category.${item.category}`)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4" data-testid="card-recommendations">
                  <h3 className="font-medium text-white mb-2">{t("smartAnalysisResults.recommendationsTitle")}</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-line">{result.recommendations}</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full rounded-lg border-white/10 bg-transparent py-3 font-medium text-white hover:bg-white/10"
                  onClick={() => setLocation("/income")}
                  data-testid="button-back-to-smart-analysis"
                >
                  {t("smartAnalysisResults.backButton")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
