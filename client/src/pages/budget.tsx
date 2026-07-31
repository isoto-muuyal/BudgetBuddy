import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { addMonths, format, parse, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, HandCoins } from "lucide-react";
import RecurringExpensesDashboard from "@/components/recurring-expenses-dashboard";
import CurrentPayPeriodDashboard from "@/components/current-pay-period-dashboard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "react-i18next";

const MONTH_KEY_FORMAT = "yyyy-MM";

function getCurrentMonthKey(): string {
  return format(new Date(), MONTH_KEY_FORMAT);
}

function MonthSwitcher({
  selectedMonth,
  onChange,
}: {
  selectedMonth: string;
  onChange: (month: string) => void;
}) {
  const { t } = useTranslation();
  const monthDate = useMemo(() => parse(selectedMonth, MONTH_KEY_FORMAT, new Date()), [selectedMonth]);
  const isCurrentMonth = selectedMonth === getCurrentMonthKey();

  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#202133] px-2 py-1.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/10"
        onClick={() => onChange(format(subMonths(monthDate, 1), MONTH_KEY_FORMAT))}
        aria-label={t("budget.previousMonth")}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center text-sm font-semibold capitalize">
        {format(monthDate, "MMMM yyyy")}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-white hover:bg-white/10"
        onClick={() => onChange(format(addMonths(monthDate, 1), MONTH_KEY_FORMAT))}
        aria-label={t("budget.nextMonth")}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentMonth && (
        <Button
          variant="outline"
          size="sm"
          className="ml-1 border-white/10 bg-transparent text-white hover:bg-white/10"
          onClick={() => onChange(getCurrentMonthKey())}
        >
          {t("budget.jumpToToday")}
        </Button>
      )}
    </div>
  );
}

export default function Budget() {
  const { t } = useTranslation();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
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

        <div className="mb-4 flex justify-start">
          <MonthSwitcher selectedMonth={selectedMonth} onChange={setSelectedMonth} />
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
            <RecurringExpensesDashboard monthlyIncome={monthlyIncome} selectedMonth={selectedMonth} />
          </TabsContent>
          <TabsContent value="payPeriod" className="mt-4">
            <CurrentPayPeriodDashboard selectedMonth={selectedMonth} />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
