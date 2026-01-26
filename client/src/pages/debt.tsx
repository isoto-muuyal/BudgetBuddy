import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

export default function Debt() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: analysisHistory, isLoading } = useQuery<any[]>({
    queryKey: ["/api/analysis"],
  });

  useEffect(() => {
    if (!analysisHistory || analysisHistory.length === 0) return;
    const latest = [...analysisHistory]
      .filter((item) => item.analysisStatus === "completed")
      .sort((a, b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime())[0];

    if (latest?.id) {
      setLocation(`/results/${latest.id}?tab=debt`);
    }
  }, [analysisHistory, setLocation]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <CardContent className="p-8 text-center text-gray-600">
            {t("debt.loading")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <CardContent className="p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">{t("debt.title")}</h2>
          <p className="text-gray-600 mb-4">{t("debt.noAnalysis")}</p>
          <Button onClick={() => setLocation("/upload")} className="bg-blue-400 text-white hover:bg-blue-600">
            {t("debt.goUpload")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
