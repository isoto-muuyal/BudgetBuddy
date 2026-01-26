import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BarChart3, Bot, Download, Upload, FileText, Calendar, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { generateAndDownloadPDF } from "@/components/ExpenseReportPDF";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

interface ResultsProps {
  params: { id: string };
}

export default function Results({ params }: ResultsProps) {
  const [, setLocation] = useLocation();
  const analysisId = params.id;
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [debtForm, setDebtForm] = useState({
    name: "",
    totalAmount: "",
    monthlyPayment: "",
  });

  const { data: analysis, isLoading } = useQuery<any>({
    queryKey: ["/api/analysis", analysisId],
    enabled: !!analysisId,
    refetchInterval: (query) => {
      // Poll every 3 seconds if analysis is still pending
      return query.state.data?.analysisStatus === "pending" ? 3000 : false;
    },
  });

  const { data: analysisHistory, isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ["/api/analysis"],
  });

  const { data: historyPatterns, isLoading: patternsLoading } = useQuery<{ patterns: string }>({
    queryKey: ["/api/analysis/patterns"],
    enabled: !!analysisHistory?.length,
  });

  const { data: userProfile } = useQuery<any>({
    queryKey: ["/api/user/profile"],
  });

  const { data: debts = [], isLoading: debtsLoading } = useQuery<any[]>({
    queryKey: ["/api/debts"],
  });

  const addDebtMutation = useMutation({
    mutationFn: async (payload: { name: string; totalAmount: string; monthlyPayment: string }) => {
      const response = await apiRequest("POST", "/api/debts", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setDebtForm({ name: "", totalAmount: "", monthlyPayment: "" });
      toast({
        title: t("common.success"),
        description: t("results.debtAdded"),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("common.error"),
        description: error?.message || t("results.debtAddFailed"),
        variant: "destructive",
      });
    },
  });

  const deleteDebtMutation = useMutation({
    mutationFn: async (debtId: string) => {
      await apiRequest("DELETE", `/api/debts/${debtId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
    },
  });

  const monthlyIncome = parseFloat(analysis?.monthlyIncome ?? "0");

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
            <p className="text-gray-600">{t("results.notFound")}</p>
            <Button onClick={() => setLocation("/upload")} className="mt-4">
              {t("results.uploadNew")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isProcessing = analysis.analysisStatus === "pending";
  const hasFailed = analysis.analysisStatus === "failed";
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

  const handleDownloadReport = async () => {
    if (!analysis || !userProfile) {
      toast({
        title: t("common.error"),
        description: t("results.reportMissing"),
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPDF(true);
    try {
      const reportData = {
        user: {
          fullName: userProfile.fullName,
          email: userProfile.email,
        },
        analysis: {
          id: analysis.id,
          monthlyIncome: analysis.monthlyIncome,
          actualNeeds: analysis.actualNeeds,
          actualWants: analysis.actualWants,
          actualSavings: analysis.actualSavings,
          recommendedNeeds: analysis.recommendedNeeds,
          recommendedWants: analysis.recommendedWants,
          recommendedSavings: analysis.recommendedSavings,
          recommendations: analysis.recommendations,
          expenses: analysis.expenses || [],
          originalFileName: analysis.originalFileName,
          uploadDate: analysis.uploadDate,
        },
      };

      await generateAndDownloadPDF(reportData);
      toast({
        title: t("common.success"),
        description: t("results.reportDownloaded"),
      });
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: t("common.error"),
        description: t("results.reportFailed"),
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleAddDebt = () => {
    if (!debtForm.name || !debtForm.totalAmount || !debtForm.monthlyPayment) {
      toast({
        title: t("common.error"),
        description: t("results.debtFieldsMissing"),
        variant: "destructive",
      });
      return;
    }

    addDebtMutation.mutate({
      name: debtForm.name,
      totalAmount: debtForm.totalAmount,
      monthlyPayment: debtForm.monthlyPayment,
    });
  };

  const handleDownloadRecommendations = () => {
    if (!analysis?.recommendations) {
      toast({
        title: t("common.error"),
        description: t("results.recsMissing"),
        variant: "destructive",
      });
      return;
    }

    const dateStamp = new Date().toISOString().slice(0, 10);
    const fileName = `BudgetBuddy-Recommendations-${analysis.id ?? "analysis"}-${dateStamp}.txt`;
    const content = [
      "BudgetBuddy Recommendations",
      "",
      `Date: ${new Date().toLocaleDateString()}`,
      `Monthly Income: $${analysis.monthlyIncome ?? "N/A"}`,
      "",
      analysis.recommendations,
      "",
    ].join("\n");

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast({
      title: t("common.success"),
      description: t("results.recsDownloaded"),
    });
  };

  const defaultTab = new URLSearchParams(window.location.search).get("tab") || "analysis";

  const parseAmount = (value: unknown) => {
    const num = typeof value === "string" ? Number.parseFloat(value) : Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const formatCurrency = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const debtMetrics = useMemo(() => {

    // Add a guard clause at the top of the memo
  if (!analysis) {
    return {
      totalMonthlyDebtPayments: 0,
      dti: 0,
      dtiCategory: "N/A",
      extraSource: "none",
      extraAmount: 0,
    };
  }

    const totalMonthlyDebtPayments = debts.reduce(
      (sum, debt) => sum + parseAmount(debt.monthlyPayment),
      0
    );
    const dti = monthlyIncome ? (totalMonthlyDebtPayments / monthlyIncome) * 100 : 0;

    const dtiCategory =
      dti < 20
        ? "Excellent"
        : dti <= 35
          ? "Good/Manageable"
          : dti <= 40
            ? "Fair/Caution"
            : dti <= 49
              ? "High Risk"
              : "Danger Zone";

    const recommendedWants = parseAmount(analysis?.recommendedWants);
    const recommendedSavings = parseAmount(analysis?.recommendedSavings);
    const actualWants = parseAmount(analysis?.actualWants);
    const actualSavings = parseAmount(analysis?.actualSavings);

    let extraSource: "wants" | "savings" | "none" = "none";
    let extraAmount = 0;

    if (actualWants > recommendedWants) {
      extraSource = "wants";
      extraAmount = actualWants - recommendedWants;
    } else if (actualSavings > recommendedSavings) {
      extraSource = "savings";
      extraAmount = actualSavings - recommendedSavings;
    }

    return {
      totalMonthlyDebtPayments,
      dti,
      dtiCategory,
      extraSource,
      extraAmount,
    };
  }, [analysis.actualSavings, analysis.actualWants, analysis.recommendedSavings, analysis.recommendedWants, debts, monthlyIncome]);

  const debtPlan = useMemo(() => {
    const normalizedDebts = debts
      .map((debt) => ({
        id: debt.id,
        name: debt.name,
        balance: parseAmount(debt.totalAmount),
        monthlyPayment: parseAmount(debt.monthlyPayment),
        paidOff: false,
      }))
      .filter((debt) => debt.balance > 0 && debt.monthlyPayment > 0)
      .sort((a, b) => a.balance - b.balance);

    if (!normalizedDebts.length || !monthlyIncome) {
      return { rows: [], monthsToHealthy: null, monthsToDebtFree: null };
    }

    const rows: Array<{
      month: number;
      focusDebt: string;
      totalPayment: number;
      extraApplied: number;
      remainingBalance: number;
      dti: number;
    }> = [];

    let rollingExtra = Math.max(0, debtMetrics.extraAmount);
    let month = 1;
    let monthsToHealthy: number | null = null;

    const maxMonths = 240;

    while (month <= maxMonths && normalizedDebts.some((debt) => debt.balance > 0)) {
      normalizedDebts.sort((a, b) => a.balance - b.balance);
      const focusDebt = normalizedDebts.find((debt) => debt.balance > 0);
      const focusName = focusDebt ? focusDebt.name : "—";

      let totalMinPayment = 0;

      for (const debt of normalizedDebts) {
        if (debt.balance <= 0) continue;
        const minPay = Math.min(debt.monthlyPayment, debt.balance);
        debt.balance -= minPay;
        totalMinPayment += minPay;
      }

      let extraApplied = 0;
      let remainingExtra = rollingExtra;

      for (const debt of normalizedDebts) {
        if (remainingExtra <= 0) break;
        if (debt.balance <= 0) continue;
        const extraPay = Math.min(remainingExtra, debt.balance);
        debt.balance -= extraPay;
        extraApplied += extraPay;
        remainingExtra -= extraPay;
      }

      let newlyFreed = 0;
      for (const debt of normalizedDebts) {
        if (debt.balance <= 0 && !debt.paidOff) {
          debt.paidOff = true;
          newlyFreed += debt.monthlyPayment;
        }
      }

      rollingExtra += newlyFreed;

      const remainingBalance = normalizedDebts.reduce((sum, debt) => sum + Math.max(0, debt.balance), 0);
      const dti = monthlyIncome ? (totalMinPayment / monthlyIncome) * 100 : 0;

      if (monthsToHealthy === null && dti <= 35) {
        monthsToHealthy = month;
      }

      rows.push({
        month,
        focusDebt: focusName,
        totalPayment: totalMinPayment + extraApplied,
        extraApplied,
        remainingBalance,
        dti,
      });

      month += 1;
    }

    const monthsToDebtFree = rows.length ? rows[rows.length - 1].month : null;
    return { rows, monthsToHealthy, monthsToDebtFree };
  }, [debts, debtMetrics.extraAmount, monthlyIncome]);

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-results">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-green-400 to-blue-500 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-results-title">
              {t("results.title")}
            </h2>
            <p className="text-gray-600" data-testid="text-results-description">
              {t("results.description")}
            </p>
          </div>

          <Tabs defaultValue={defaultTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="analysis">{t("results.title")}</TabsTrigger>
              <TabsTrigger value="history">{t("results.history")}</TabsTrigger>
              <TabsTrigger value="debt">{t("results.debtPlan")}</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis">
              {/* Current vs Recommended Comparison */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-3 text-center">{t("results.current")}</h3>
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                          <span className="text-sm text-blue-800">{t("results.analyzing")}</span>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                          <span className="text-sm text-blue-800">{t("results.analyzing")}</span>
                        </div>
                      </div>
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                          <span className="text-sm text-blue-800">{t("results.analyzing")}</span>
                        </div>
                      </div>
                    </div>
                  ) : hasFailed ? (
                    <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                      <p className="text-sm text-red-800 text-center">{t("results.failed")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <div className="flex justify-between">
                          <span className="text-sm text-red-800">{t("results.needs")}</span>
                          <span className="font-semibold text-red-800" data-testid="text-actual-needs-percent">
                            {analysis.actualNeeds ? `${actualNeedsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-red-600" data-testid="text-actual-needs-amount">
                          {analysis.actualNeeds ? `$${analysis.actualNeeds}` : t("results.calculating")}
                        </div>
                      </div>
                      <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                        <div className="flex justify-between">
                          <span className="text-sm text-orange-800">{t("results.wants")}</span>
                          <span className="font-semibold text-orange-800" data-testid="text-actual-wants-percent">
                            {analysis.actualWants ? `${actualWantsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-orange-600" data-testid="text-actual-wants-amount">
                          {analysis.actualWants ? `$${analysis.actualWants}` : t("results.calculating")}
                        </div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <div className="flex justify-between">
                          <span className="text-sm text-red-800">{t("results.savings")}</span>
                          <span className="font-semibold text-red-800" data-testid="text-actual-savings-percent">
                            {analysis.actualSavings ? `${actualSavingsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-red-600" data-testid="text-actual-savings-amount">
                          {analysis.actualSavings ? `$${analysis.actualSavings}` : t("results.calculating")}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-3 text-center">{t("results.recommended")}</h3>
                  <div className="space-y-2">
                    <div className="needs-bg p-3 rounded-lg border">
                      <div className="flex justify-between">
                        <span className="text-sm needs-text">{t("results.needs")}</span>
                        <span className="font-semibold needs-text">50%</span>
                      </div>
                      <div className="text-xs text-gray-600">${analysis.recommendedNeeds}</div>
                    </div>
                    <div className="wants-bg p-3 rounded-lg border">
                      <div className="flex justify-between">
                        <span className="text-sm wants-text">{t("results.wants")}</span>
                        <span className="font-semibold wants-text">30%</span>
                      </div>
                      <div className="text-xs text-gray-600">${analysis.recommendedWants}</div>
                    </div>
                    <div className="savings-bg p-3 rounded-lg border">
                      <div className="flex justify-between">
                        <span className="text-sm savings-text">{t("results.savings")}</span>
                        <span className="font-semibold savings-text">20%</span>
                      </div>
                      <div className="text-xs text-gray-600">${analysis.recommendedSavings}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Recommendations */}
              {isProcessing && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                    <Bot className="text-brand-blue mr-2" />
                    {t("results.recommendations")}
                  </h3>
                  <div className="flex items-center text-sm text-gray-700">
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    {t("results.recommendationsLoading")}
                  </div>
                </div>
              )}
              {!isProcessing && analysis.recommendations && (
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900 flex items-center">
                      <Bot className="text-brand-blue mr-2" />
                      {t("results.recommendations")}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadRecommendations}
                      data-testid="button-download-recommendations"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t("results.downloadRecs")}
                    </Button>
                  </div>
                  <div className="text-sm text-gray-700" data-testid="text-recommendations">
                    {analysis.recommendations}
                  </div>
                </div>
              )}

              {/* Detailed Expense Breakdown */}
              {isProcessing && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{t("results.breakdown")}</h3>
                  <div className="bg-gray-50 p-6 rounded-lg text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">{t("results.processing")}</p>
                  </div>
                </div>
              )}
              {!isProcessing && analysis.expenses && analysis.expenses.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-semibold text-gray-900 mb-4">{t("results.breakdown")}</h3>
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
                  {t("results.uploadNew")}
                </Button>
                <Button
                  onClick={handleDownloadReport}
                  disabled={isGeneratingPDF || !userProfile || isProcessing}
                  className="flex-1 bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isGeneratingPDF ? t("results.generating") : t("results.download")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-history">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900 flex items-center">
                    <FileText className="mr-2 text-blue-500" />
                    {t("results.history")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {patternsLoading ? (
                    <div className="mb-4 bg-gray-50 rounded-lg p-4">
                      <div className="flex items-center text-sm text-gray-600">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t("results.patternsLoading")}
                      </div>
                    </div>
                  ) : historyPatterns?.patterns ? (
                    <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-semibold text-gray-900 mb-2">{t("results.patterns")}</h4>
                      <div className="text-sm text-gray-700 whitespace-pre-line">
                        {historyPatterns.patterns}
                      </div>
                    </div>
                  ) : null}

                  {historyLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : !analysisHistory || analysisHistory.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>{t("results.historyNone")}</p>
                      <p className="text-sm">{t("results.historyHint")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">{t("history.fileName")}</TableHead>
                            <TableHead>{t("history.uploadDate")}</TableHead>
                            <TableHead>{t("history.status")}</TableHead>
                            <TableHead className="text-right">{t("history.needs")}</TableHead>
                            <TableHead className="text-right">{t("history.wants")}</TableHead>
                            <TableHead className="text-right">{t("history.savings")}</TableHead>
                            <TableHead className="w-[100px]">{t("history.action")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysisHistory
                            .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
                            .map((historyItem) => (
                              <TableRow 
                                key={historyItem.id} 
                                className={historyItem.id === analysisId ? "bg-blue-50" : ""}
                                data-testid={`history-row-${historyItem.id}`}
                              >
                                <TableCell className="font-medium">
                                  <div className="flex items-center">
                                    <FileText className="mr-2 h-4 w-4 text-gray-400" />
                                    <span className="truncate max-w-[150px]" title={historyItem.originalFileName}>
                                      {historyItem.originalFileName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center text-sm text-gray-600">
                                    <Calendar className="mr-1 h-3 w-3" />
                                    {new Date(historyItem.uploadDate).toLocaleDateString()}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge 
                                    variant={
                                      historyItem.analysisStatus === "completed" 
                                        ? "default" 
                                        : historyItem.analysisStatus === "failed" 
                                        ? "destructive" 
                                        : "secondary"
                                    }
                                    data-testid={`status-${historyItem.id}`}
                                  >
                                    {historyItem.analysisStatus}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                  {historyItem.actualNeeds ? `$${parseFloat(historyItem.actualNeeds).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {historyItem.actualWants ? `$${parseFloat(historyItem.actualWants).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right">
                                  {historyItem.actualSavings ? `$${parseFloat(historyItem.actualSavings).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell>
                                  {historyItem.id !== analysisId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setLocation(`/results/${historyItem.id}`)}
                                      data-testid={`button-view-${historyItem.id}`}
                                    >
                                      {t("history.view")}
                                    </Button>
                                  )}
                                  {historyItem.id === analysisId && (
                                    <Badge variant="outline" className="text-xs">
                                      {t("results.currentBadge")}
                                    </Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="debt">
              <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-debt-plan">
                <CardHeader>
                  <CardTitle className="text-xl font-bold text-gray-900">{t("results.debtPlan")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="grid gap-3">
                      <div className="grid grid-cols-1 gap-3">
                        <Input
                          placeholder={t("results.debtName")}
                          value={debtForm.name}
                          onChange={(event) => setDebtForm({ ...debtForm, name: event.target.value })}
                          data-testid="input-debt-name"
                        />
                        <Input
                          placeholder={t("results.debtTotal")}
                          value={debtForm.totalAmount}
                          onChange={(event) => setDebtForm({ ...debtForm, totalAmount: event.target.value })}
                          data-testid="input-debt-total"
                        />
                        <Input
                          placeholder={t("results.debtMonthly")}
                          value={debtForm.monthlyPayment}
                          onChange={(event) => setDebtForm({ ...debtForm, monthlyPayment: event.target.value })}
                          data-testid="input-debt-monthly"
                        />
                      </div>
                      <Button
                        onClick={handleAddDebt}
                        disabled={addDebtMutation.isPending}
                        className="bg-blue-500 text-white hover:bg-blue-600"
                        data-testid="button-add-debt"
                      >
                        {t("results.debtAdd")}
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">{t("results.debtList")}</h4>
                        <span className="text-sm text-gray-500">
                          {debtsLoading ? t("debt.loading") : `${debts.length} item(s)`}
                        </span>
                      </div>
                      {debts.length === 0 ? (
                        <div className="text-sm text-gray-500">{t("results.debtEmpty")}</div>
                      ) : (
                        <div className="space-y-2">
                          {debts.map((debt) => (
                            <div
                              key={debt.id}
                              className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                              data-testid={`debt-row-${debt.id}`}
                            >
                              <div>
                                <div className="font-medium text-gray-900">{debt.name}</div>
                                <div className="text-xs text-gray-500">
                                  Total: ${formatCurrency(parseAmount(debt.totalAmount))} • Monthly: ${formatCurrency(parseAmount(debt.monthlyPayment))}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteDebtMutation.mutate(debt.id)}
                                data-testid={`button-delete-debt-${debt.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gray-200 p-4">
                        <div className="text-sm text-gray-600">{t("results.dti")}</div>
                        <div className="text-xl font-semibold text-gray-900">{debtMetrics.dti.toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">{debtMetrics.dtiCategory}</div>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4">
                        <div className="text-sm text-gray-600">{t("results.extraSource")}</div>
                        <div className="text-xl font-semibold text-gray-900">
                          {debtMetrics.extraSource === "none"
                            ? t("results.extraNone")
                            : `${debtMetrics.extraSource === "wants" ? t("results.extraWants") : t("results.extraSavings")}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {debtMetrics.extraAmount > 0
                            ? t("results.extraAvailable", { amount: `$${formatCurrency(debtMetrics.extraAmount)}` })
                            : t("results.extraNoneDetail")}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-lg border border-gray-200 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-900">{t("results.snowball")}</h4>
                        <span className="text-xs text-gray-500">{t("results.noInterest")}</span>
                      </div>
                      {debtPlan.rows.length === 0 ? (
                        <div className="text-sm text-gray-500">
                          {t("results.noPlan")}
                        </div>
                      ) : (
                        <>
                          <div className="text-sm text-gray-600 mb-3">
                            {debtPlan.monthsToHealthy
                              ? t("results.monthsHealthy", { months: debtPlan.monthsToHealthy })
                              : t("results.monthsHealthyNone")}
                          </div>
                          <div className="text-sm text-gray-600 mb-4">
                            {debtPlan.monthsToDebtFree
                              ? t("results.monthsDebtFree", { months: debtPlan.monthsToDebtFree })
                              : t("results.monthsDebtFreeNone")}
                          </div>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{t("results.month")}</TableHead>
                                  <TableHead>{t("results.focusDebt")}</TableHead>
                                  <TableHead className="text-right">{t("results.totalPayment")}</TableHead>
                                  <TableHead className="text-right">{t("results.extraApplied")}</TableHead>
                                  <TableHead className="text-right">{t("results.remainingBalance")}</TableHead>
                                  <TableHead className="text-right">DTI</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {debtPlan.rows.slice(0, 12).map((row) => (
                                  <TableRow key={row.month}>
                                    <TableCell>{row.month}</TableCell>
                                    <TableCell>{row.focusDebt}</TableCell>
                                    <TableCell className="text-right">${formatCurrency(row.totalPayment)}</TableCell>
                                    <TableCell className="text-right">${formatCurrency(row.extraApplied)}</TableCell>
                                    <TableCell className="text-right">${formatCurrency(row.remainingBalance)}</TableCell>
                                    <TableCell className="text-right">{row.dti.toFixed(1)}%</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
