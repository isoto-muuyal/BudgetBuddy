import { useQuery } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import RecurringExpensesDashboard from "@/components/recurring-expenses-dashboard";
import CurrentPayPeriodDashboard from "@/components/current-pay-period-dashboard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

export default function Budget() {
  const { t } = useTranslation();
  const { data: user } = useQuery<any>({
    queryKey: ["/api/user/profile"],
  });

  const monthlyIncome = Number.parseFloat(user?.monthlyIncome || "0");

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-[#202133] text-amber-400">
              <HandCoins className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-normal">{t("budget.pageTitle")}</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-200">{t("budget.pageDescription")}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-[#202133] px-4 py-3 text-right">
            <div className="text-xs text-slate-400">{t("budget.monthlyIncome")}</div>
            <div className="text-lg font-semibold">
              ${monthlyIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        <Tabs defaultValue="recurring">
          <TabsList className="border border-white/10 bg-[#202133]">
            <TabsTrigger
              value="recurring"
              className="text-slate-300 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950"
            >
              {t("budget.tabs.recurring")}
            </TabsTrigger>
            <TabsTrigger
              value="payPeriod"
              className="text-slate-300 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950"
            >
              {t("budget.tabs.payPeriod")}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="recurring" className="mt-4">
            <RecurringExpensesDashboard monthlyIncome={monthlyIncome} />
          </TabsContent>
          <TabsContent value="payPeriod" className="mt-4">
            <CurrentPayPeriodDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
