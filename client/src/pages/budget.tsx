import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "react-i18next";

export default function Budget() {
  const [, setLocation] = useLocation();
  const { t } = useTranslation();

  const { data: user, isLoading } = useQuery<any>({
    queryKey: ["/api/user/profile"],
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
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const monthlyIncome = parseFloat(user?.monthlyIncome || "0");
  const needs = monthlyIncome * 0.5;
  const wants = monthlyIncome * 0.3;
  const savings = monthlyIncome * 0.2;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="max-w-md mx-auto">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-budget">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <HandCoins className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-budget-title">
              {t("budget.title")}
            </h2>
            <p className="text-slate-300" data-testid="text-budget-description">
              {t("budget.description", { income: `$${monthlyIncome.toFixed(2)}` })}
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4" data-testid="card-needs">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold needs-text">{t("budget.needs")}</h3>
                <span className="text-xl font-bold needs-text" data-testid="text-needs-amount">
                  ${needs.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-slate-300">{t("budget.needsDesc")}</p>
              <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "50%" }}></div>
              </div>
            </div>

            <div className="rounded-lg border border-sky-400/20 bg-sky-400/10 p-4" data-testid="card-wants">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold wants-text">{t("budget.wants")}</h3>
                <span className="text-xl font-bold wants-text" data-testid="text-wants-amount">
                  ${wants.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-slate-300">{t("budget.wantsDesc")}</p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: "30%" }}></div>
              </div>
            </div>

            <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 p-4" data-testid="card-savings">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold savings-text">{t("budget.savings")}</h3>
                <span className="text-xl font-bold savings-text" data-testid="text-savings-amount">
                  ${savings.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-slate-300">{t("budget.savingsDesc")}</p>
              <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: "20%" }}></div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setLocation("/upload")}
            className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
            data-testid="button-upload"
          >
            {t("budget.upload")}
          </Button>
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
