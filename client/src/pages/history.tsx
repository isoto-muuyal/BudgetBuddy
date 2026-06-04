import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FileText, Calendar, HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "react-i18next";

export default function History() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: analysisHistory, isLoading } = useQuery<any[]>({
    queryKey: ["/api/analysis"],
  });

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

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="mx-auto max-w-6xl">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-history">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-white flex items-center">
              <HandCoins className="mr-3 h-8 w-8 text-amber-400" />
              {t("history.title")}
            </CardTitle>
            <Button
              onClick={() => setLocation("/upload")}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
              data-testid="button-new-analysis"
            >
              {t("history.newAnalysis")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : !analysisHistory || analysisHistory.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <FileText className="mx-auto h-16 w-16 text-slate-600 mb-4" />
              <p className="text-lg font-medium">{t("history.emptyTitle")}</p>
              <p className="text-sm mb-6">{t("history.emptyDesc")}</p>
              <Button
                onClick={() => setLocation("/upload")}
                className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                data-testid="button-upload-first"
              >
                {t("history.uploadFirst")}
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-transparent">
                    <TableHead className="w-[250px] text-slate-300">{t("history.fileName")}</TableHead>
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
                        data-testid={`history-row-${historyItem.id}`}
                      >
                        <TableCell className="font-medium text-slate-100">
                          <div className="flex items-center">
                            <FileText className="mr-2 h-4 w-4 text-slate-500" />
                            <span className="truncate max-w-[200px]" title={historyItem.originalFileName}>
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
                          <Button
                            variant="outline"
                            size="sm"
                          className="border-white/10 bg-transparent text-white hover:bg-white/10"
                          onClick={() => setLocation(`/results/${historyItem.id}`)}
                          data-testid={`button-view-${historyItem.id}`}
                        >
                          {t("history.view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
