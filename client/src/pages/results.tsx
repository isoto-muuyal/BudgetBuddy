import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bot, Download, Upload, FileText, Calendar, Loader2, Wallet, TrendingUp, Target, HandCoins } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Area, AreaChart } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { generateAndDownloadPDF } from "@/components/ExpenseReportPDF";
import { useState } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import DebtDashboard from "@/components/debt-dashboard";

interface ResultsProps {
  params: { id: string };
}

export default function Results({ params }: ResultsProps) {
  const [, setLocation] = useLocation();
  const analysisId = params.id;
  const { toast } = useToast();
  const { t } = useTranslation();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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

  const monthlyIncome = parseFloat(analysis?.monthlyIncome ?? "0");

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "50%":
        return <Badge className="needs-bg needs-text">{t("results.needs")}</Badge>;
      case "30%":
        return <Badge className="wants-bg wants-text">{t("results.wants")}</Badge>;
      case "20%":
        return <Badge className="savings-bg savings-text">{t("results.savings")}</Badge>;
      default:
        return <Badge className="undefined-bg undefined-text">{t("results.unclear")}</Badge>;
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
    const incomeValue = analysis.monthlyIncome ? `$${analysis.monthlyIncome}` : t("common.notAvailable");
    const fileName = t("results.recsFileName", {
      appName: t("appName"),
      id: analysis.id ?? "analysis",
      date: dateStamp,
    });
    const content = [
      t("results.recsFileTitle", { appName: t("appName") }),
      "",
      t("results.recsFileDate", { date: new Date().toLocaleDateString() }),
      t("results.recsFileIncome", { income: incomeValue }),
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return t("history.statusCompleted");
      case "failed":
        return t("history.statusFailed");
      case "pending":
      default:
        return t("history.statusPending");
    }
  };

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
  const totalAnalyzed = parseAmount(analysis.actualNeeds) + parseAmount(analysis.actualWants) + parseAmount(analysis.actualSavings);
  const categoryChartData = [
    { name: "Needs", actual: parseAmount(analysis.actualNeeds), recommended: parseAmount(analysis.recommendedNeeds), fill: "#22c55e" },
    { name: "Wants", actual: parseAmount(analysis.actualWants), recommended: parseAmount(analysis.recommendedWants), fill: "#38bdf8" },
    { name: "Savings", actual: parseAmount(analysis.actualSavings), recommended: parseAmount(analysis.recommendedSavings), fill: "#f59e0b" },
  ];
  const historyChartData = (analysisHistory || [])
    .filter((item) => item.analysisStatus === "completed")
    .sort((a, b) => new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime())
    .slice(-8)
    .map((item) => ({
      date: new Date(item.uploadDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      needs: parseAmount(item.actualNeeds),
      wants: parseAmount(item.actualWants),
      savings: parseAmount(item.actualSavings),
    }));

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-6 text-white sm:px-6 lg:px-8" data-testid="card-results">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#202133] text-amber-400">
              <HandCoins className="h-5 w-5" />
            </div>
            <h2 className="text-2xl font-semibold tracking-normal" data-testid="text-results-title">
              {t("results.title")}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-200" data-testid="text-results-description">
              {t("results.description")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setLocation("/upload")}
              variant="outline"
              className="border-white/10 bg-[#202133] text-white hover:bg-white/10"
              data-testid="button-upload-new"
            >
              <Upload className="mr-2 h-4 w-4" />
              {t("results.uploadNew")}
            </Button>
            <Button
              onClick={handleDownloadReport}
              disabled={isGeneratingPDF || !userProfile || isProcessing}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50"
              data-testid="button-download"
            >
              <Download className="mr-2 h-4 w-4" />
              {isGeneratingPDF ? t("results.generating") : t("results.download")}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-4">
          <DashboardMetric icon={<Wallet className="h-4 w-4" />} label="Monthly income" value={`$${formatCurrency(monthlyIncome)}`} detail={analysis.originalFileName || "Current analysis"} />
          <DashboardMetric icon={<Target className="h-4 w-4" />} label="Analyzed spending" value={`$${formatCurrency(totalAnalyzed)}`} detail={`${actualNeedsPercent}% needs | ${actualWantsPercent}% wants`} />
          <DashboardMetric icon={<TrendingUp className="h-4 w-4" />} label="Savings rate" value={`${actualSavingsPercent}%`} detail={`Recommended 20%`} />
          <DashboardMetric icon={<Calendar className="h-4 w-4" />} label="Upload date" value={analysis.uploadDate ? new Date(analysis.uploadDate).toLocaleDateString() : "-"} detail={getStatusLabel(analysis.analysisStatus)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Current vs Recommended</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData}>
                    <CartesianGrid stroke="#34364a" vertical={false} />
                    <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#171827", border: "1px solid #34364a", borderRadius: 8 }} />
                    <Bar dataKey="actual" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="recommended" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">Recent Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={historyChartData}>
                    <defs>
                      <linearGradient id="budgetTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#34364a" vertical={false} />
                    <XAxis dataKey="date" stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ background: "#171827", border: "1px solid #34364a", borderRadius: 8 }} />
                    <Area type="monotone" dataKey="savings" stroke="#f59e0b" fill="url(#budgetTrend)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={defaultTab} className="mt-6">
            <TabsList className="grid w-full grid-cols-3 bg-[#202133] text-slate-300">
              <TabsTrigger className="data-[state=active]:bg-white/10 data-[state=active]:text-white" value="analysis">{t("results.title")}</TabsTrigger>
              <TabsTrigger className="data-[state=active]:bg-white/10 data-[state=active]:text-white" value="history">{t("results.history")}</TabsTrigger>
              <TabsTrigger className="data-[state=active]:bg-white/10 data-[state=active]:text-white" value="debt">{t("results.debtPlan")}</TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="space-y-5">
              {/* Current vs Recommended Comparison */}
              <div className="grid gap-5 lg:grid-cols-2">
                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">{t("results.current")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                  {isProcessing ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />
                          <span className="text-sm text-slate-300">{t("results.analyzing")}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />
                          <span className="text-sm text-slate-300">{t("results.analyzing")}</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex items-center justify-center py-2">
                          <Loader2 className="mr-2 h-5 w-5 animate-spin text-amber-400" />
                          <span className="text-sm text-slate-300">{t("results.analyzing")}</span>
                        </div>
                      </div>
                    </div>
                  ) : hasFailed ? (
                    <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4">
                      <p className="text-center text-sm text-red-200">{t("results.failed")}</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-300">{t("results.needs")}</span>
                          <span className="font-semibold text-emerald-300" data-testid="text-actual-needs-percent">
                            {analysis.actualNeeds ? `${actualNeedsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500" data-testid="text-actual-needs-amount">
                          {analysis.actualNeeds ? `$${analysis.actualNeeds}` : t("results.calculating")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-300">{t("results.wants")}</span>
                          <span className="font-semibold text-sky-300" data-testid="text-actual-wants-percent">
                            {analysis.actualWants ? `${actualWantsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500" data-testid="text-actual-wants-amount">
                          {analysis.actualWants ? `$${analysis.actualWants}` : t("results.calculating")}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-[#171827] p-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-slate-300">{t("results.savings")}</span>
                          <span className="font-semibold text-amber-300" data-testid="text-actual-savings-percent">
                            {analysis.actualSavings ? `${actualSavingsPercent}%` : t("results.calculating")}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500" data-testid="text-actual-savings-amount">
                          {analysis.actualSavings ? `$${analysis.actualSavings}` : t("results.calculating")}
                        </div>
                      </div>
                    </div>
                  )}
                  </CardContent>
                </Card>

                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">{t("results.recommended")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <div className="space-y-2">
                    <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-emerald-200">{t("results.needs")}</span>
                        <span className="font-semibold text-emerald-200">50%</span>
                      </div>
                      <div className="text-xs text-slate-400">${analysis.recommendedNeeds}</div>
                    </div>
                    <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-sky-200">{t("results.wants")}</span>
                        <span className="font-semibold text-sky-200">30%</span>
                      </div>
                      <div className="text-xs text-slate-400">${analysis.recommendedWants}</div>
                    </div>
                    <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-3">
                      <div className="flex justify-between">
                        <span className="text-sm text-amber-200">{t("results.savings")}</span>
                        <span className="font-semibold text-amber-200">20%</span>
                      </div>
                      <div className="text-xs text-slate-400">${analysis.recommendedSavings}</div>
                    </div>
                  </div>
                  </CardContent>
                </Card>
              </div>

              {/* AI Recommendations */}
              {isProcessing && (
                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardContent className="p-6">
                  <h3 className="mb-3 flex items-center font-semibold text-white">
                    <Bot className="mr-2 text-amber-400" />
                    {t("results.recommendations")}
                  </h3>
                  <div className="flex items-center text-sm text-slate-300">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("results.recommendationsLoading")}
                  </div>
                  </CardContent>
                </Card>
              )}
              {!isProcessing && analysis.recommendations && (
                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="flex items-center font-semibold text-white">
                      <Bot className="mr-2 text-amber-400" />
                      {t("results.recommendations")}
                    </h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDownloadRecommendations}
                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
                      data-testid="button-download-recommendations"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      {t("results.downloadRecs")}
                    </Button>
                  </div>
                  <div className="whitespace-pre-line text-sm text-slate-300" data-testid="text-recommendations">
                    {analysis.recommendations}
                  </div>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Expense Breakdown */}
              {isProcessing && (
                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">{t("results.breakdown")}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-center">
                    <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-amber-400" />
                    <p className="text-sm text-slate-300">{t("results.processing")}</p>
                  </CardContent>
                </Card>
              )}
              {!isProcessing && analysis.expenses && analysis.expenses.length > 0 && (
                <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-base">{t("results.breakdown")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                  <ScrollArea className="h-60" data-testid="scroll-expenses">
                    <div className="space-y-3">
                      {analysis.expenses.map((expense: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#171827] p-3"
                          data-testid={`expense-${index}`}
                        >
                          <div>
                            <div className="font-medium text-slate-100">{expense.description}</div>
                            {expense.subcategory && (
                              <div className="text-xs text-slate-500">{expense.subcategory}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-slate-100">
                              {expense.amount < 0 ? "-" : "+"}${Math.abs(expense.amount).toFixed(2)}
                            </div>
                            {getCategoryBadge(expense.category)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  </CardContent>
                </Card>
              )}

              <div className="flex space-x-3">
                <Button
                  onClick={() => setLocation("/upload")}
                  variant="outline"
                  className="flex-1 rounded-lg border-white/10 bg-[#202133] py-3 font-medium text-white hover:bg-white/10"
                  data-testid="button-upload-new"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {t("results.uploadNew")}
                </Button>
                <Button
                  onClick={handleDownloadReport}
                  disabled={isGeneratingPDF || !userProfile || isProcessing}
                  className="flex-1 rounded-lg bg-amber-500 py-3 font-medium text-slate-950 transition-colors hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
                  data-testid="button-download"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {isGeneratingPDF ? t("results.generating") : t("results.download")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="history">
              <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-history">
                <CardHeader>
                  <CardTitle className="flex items-center text-base">
                    <FileText className="mr-2 text-amber-400" />
                    {t("results.history")}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {patternsLoading ? (
                    <div className="mb-4 rounded-lg border border-white/10 bg-[#171827] p-4">
                      <div className="flex items-center text-sm text-slate-300">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        {t("results.patternsLoading")}
                      </div>
                    </div>
                  ) : historyPatterns?.patterns ? (
                    <div className="mb-4 rounded-lg border border-white/10 bg-[#171827] p-4">
                      <h4 className="mb-2 font-semibold text-white">{t("results.patterns")}</h4>
                      <div className="whitespace-pre-line text-sm text-slate-300">
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
                    <div className="py-8 text-center text-slate-400">
                      <FileText className="mx-auto mb-4 h-12 w-12 text-slate-600" />
                      <p>{t("results.historyNone")}</p>
                      <p className="text-sm">{t("results.historyHint")}</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-white/10 hover:bg-transparent">
                            <TableHead className="w-[200px] text-slate-300">{t("history.fileName")}</TableHead>
                            <TableHead className="text-slate-300">{t("history.uploadDate")}</TableHead>
                            <TableHead className="text-slate-300">{t("history.status")}</TableHead>
                            <TableHead className="text-right text-slate-300">{t("history.needs")}</TableHead>
                            <TableHead className="text-right text-slate-300">{t("history.wants")}</TableHead>
                            <TableHead className="text-right text-slate-300">{t("history.savings")}</TableHead>
                            <TableHead className="w-[100px] text-slate-300">{t("history.action")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analysisHistory
                            .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())
                            .map((historyItem) => (
                              <TableRow 
                                key={historyItem.id} 
                                className={historyItem.id === analysisId ? "border-white/10 bg-white/10 hover:bg-white/10" : "border-white/10 hover:bg-white/5"}
                                data-testid={`history-row-${historyItem.id}`}
                              >
                                <TableCell className="font-medium text-slate-100">
                                  <div className="flex items-center">
                                    <FileText className="mr-2 h-4 w-4 text-slate-500" />
                                    <span className="truncate max-w-[150px]" title={historyItem.originalFileName}>
                                      {historyItem.originalFileName}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center text-sm text-slate-400">
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
                                    {getStatusLabel(historyItem.analysisStatus)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right text-slate-100">
                                  {historyItem.actualNeeds ? `$${parseFloat(historyItem.actualNeeds).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right text-slate-100">
                                  {historyItem.actualWants ? `$${parseFloat(historyItem.actualWants).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell className="text-right text-slate-100">
                                  {historyItem.actualSavings ? `$${parseFloat(historyItem.actualSavings).toFixed(0)}` : "-"}
                                </TableCell>
                                <TableCell>
                                  {historyItem.id !== analysisId && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
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
              <DebtDashboard monthlyIncome={monthlyIncome} />
            </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function DashboardMetric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
      <CardContent className="p-5">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-amber-400">{icon}</div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="mt-1 truncate text-2xl font-semibold">{value}</div>
        <div className="mt-1 truncate text-xs text-slate-500">{detail}</div>
      </CardContent>
    </Card>
  );
}
