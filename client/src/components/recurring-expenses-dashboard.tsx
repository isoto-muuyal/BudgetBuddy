import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Plus, RefreshCw, Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { RECURRING_EXPENSE_FREQUENCIES, type RecurringExpenseFrequency } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface RecurringExpenseRow {
  id: string;
  name: string;
  amount: string;
  frequency: RecurringExpenseFrequency;
}

interface RecurringExpensesDashboardProps {
  monthlyIncome?: number;
}

const FREQUENCY_MONTHLY_MULTIPLIERS: Record<RecurringExpenseFrequency, number> = {
  daily: 365 / 12,
  weekly: 52 / 12,
  bi_weekly: 26 / 12,
  monthly: 1,
  semi_monthly: 2,
  bi_monthly: 0.5,
  yearly: 1 / 12,
};

function parseMoney(value: string | number): number {
  const parsed = Number.parseFloat(String(value).replace(/[$,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toMonthlyEquivalent(amount: number, frequency: RecurringExpenseFrequency): number {
  return amount * FREQUENCY_MONTHLY_MULTIPLIERS[frequency];
}

export default function RecurringExpensesDashboard({ monthlyIncome = 0 }: RecurringExpensesDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [expenseForm, setExpenseForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly" as RecurringExpenseFrequency,
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({
    name: "",
    amount: "",
    frequency: "monthly" as RecurringExpenseFrequency,
  });

  const { data: expenses = [], isLoading } = useQuery<RecurringExpenseRow[]>({
    queryKey: ["/api/recurring-expenses"],
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload: { name: string; amount: string; frequency: RecurringExpenseFrequency }) => {
      const response = await apiRequest("POST", "/api/recurring-expenses", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      setExpenseForm({ name: "", amount: "", frequency: "monthly" });
      toast({ title: t("budget.addedTitle"), description: t("budget.addedDesc") });
    },
    onError: (error: any) => {
      toast({
        title: t("budget.addErrorTitle"),
        description: error?.message || t("budget.addErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: async (payload: { expenseId: string; name: string; amount: string; frequency: RecurringExpenseFrequency }) => {
      const response = await apiRequest("PATCH", `/api/recurring-expenses/${payload.expenseId}`, {
        name: payload.name,
        amount: payload.amount,
        frequency: payload.frequency,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      setEditingExpenseId(null);
      toast({ title: t("budget.updatedTitle"), description: t("budget.updatedDesc") });
    },
    onError: (error: any) => {
      toast({
        title: t("budget.updateErrorTitle"),
        description: error?.message || t("budget.updateErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/recurring-expenses/${expenseId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] }),
  });

  const monthlyTotal = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency),
        0
      ),
    [expenses]
  );

  const monthlyShare = monthlyIncome ? (monthlyTotal / monthlyIncome) * 100 : 0;

  const handleAddExpense = () => {
    if (!expenseForm.name || !expenseForm.amount) {
      toast({
        title: t("budget.missingFieldsTitle"),
        description: t("budget.missingFieldsDesc"),
        variant: "destructive",
      });
      return;
    }
    addExpenseMutation.mutate(expenseForm);
  };

  const startEditing = (expense: RecurringExpenseRow) => {
    setEditingExpenseId(expense.id);
    setEditingForm({
      name: expense.name,
      amount: String(parseMoney(expense.amount)),
      frequency: expense.frequency,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricPanel
          icon={<Wallet className="h-4 w-4" />}
          label={t("budget.totalRecurring")}
          value={`$${formatCurrency(monthlyTotal)}`}
          detail={t("budget.monthlyEquivalent")}
        />
        <MetricPanel
          icon={<RefreshCw className="h-4 w-4" />}
          label={t("budget.expenseCount")}
          value={String(expenses.length)}
          detail={t("budget.trackedExpenses")}
        />
        <MetricPanel
          icon={<CalendarClock className="h-4 w-4" />}
          label={t("budget.incomeShare")}
          value={monthlyIncome ? `${monthlyShare.toFixed(1)}%` : t("common.notAvailable")}
          detail={t("budget.ofMonthlyIncome")}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("budget.addExpense")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input
              placeholder={t("budget.expenseName")}
              value={expenseForm.name}
              onChange={(event) => setExpenseForm({ ...expenseForm, name: event.target.value })}
              className="border-white/10 bg-[#171827] text-white"
            />
            <Input
              placeholder={t("budget.expenseAmount")}
              value={expenseForm.amount}
              onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
              className="border-white/10 bg-[#171827] text-white"
              inputMode="decimal"
            />
            <div>
              <label className="mb-2 block text-xs text-slate-400">{t("budget.frequencyLabel")}</label>
              <Select
                value={expenseForm.frequency}
                onValueChange={(value) => setExpenseForm({ ...expenseForm, frequency: value as RecurringExpenseFrequency })}
              >
                <SelectTrigger className="border-white/10 bg-[#171827] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_EXPENSE_FREQUENCIES.map((frequency) => (
                    <SelectItem key={frequency} value={frequency}>
                      {t(`budget.frequency.${frequency}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleAddExpense}
              disabled={addExpenseMutation.isPending}
              className="bg-amber-500 text-slate-950 hover:bg-amber-400"
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("budget.addExpenseButton")}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">{t("budget.referenceNoteTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-slate-300">
            <p>{t("budget.referenceNoteDesc")}</p>
            <div className="rounded-lg border border-white/10 bg-[#171827] p-4">
              <div className="text-xs uppercase tracking-wide text-slate-400">{t("budget.exampleTitle")}</div>
              <div className="mt-2 space-y-1">
                <div>{t("budget.exampleRent")}</div>
                <div>{t("budget.exampleStreaming")}</div>
                <div>{t("budget.exampleInsurance")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-base">{t("budget.currentExpenses")}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-slate-400">{t("budget.loading")}</div>
          ) : expenses.length === 0 ? (
            <div className="text-sm text-slate-400">{t("budget.empty")}</div>
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <div key={expense.id} className="rounded-lg border border-white/10 bg-[#171827] p-4">
                  {editingExpenseId === expense.id ? (
                    <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.9fr_auto] md:items-end">
                      <Input
                        value={editingForm.name}
                        onChange={(event) => setEditingForm({ ...editingForm, name: event.target.value })}
                        className="border-white/10 bg-[#202133] text-white"
                      />
                      <Input
                        value={editingForm.amount}
                        onChange={(event) => setEditingForm({ ...editingForm, amount: event.target.value })}
                        className="border-white/10 bg-[#202133] text-white"
                        inputMode="decimal"
                      />
                      <Select
                        value={editingForm.frequency}
                        onValueChange={(value) =>
                          setEditingForm({ ...editingForm, frequency: value as RecurringExpenseFrequency })
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-[#202133] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRING_EXPENSE_FREQUENCIES.map((frequency) => (
                            <SelectItem key={frequency} value={frequency}>
                              {t(`budget.frequency.${frequency}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() =>
                            updateExpenseMutation.mutate({
                              expenseId: expense.id,
                              ...editingForm,
                            })
                          }
                        >
                          <Save className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 bg-transparent text-white hover:bg-white/10"
                          onClick={() => setEditingExpenseId(null)}
                        >
                          {t("budget.cancelEdit")}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="font-semibold">{expense.name}</div>
                        <div className="text-xs text-slate-400">
                          ${formatCurrency(parseMoney(expense.amount))} · {t(`budget.frequency.${expense.frequency}`)} ·{" "}
                          {t("budget.monthlyEquivalentShort", {
                            amount: formatCurrency(toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency)),
                          })}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 bg-transparent text-white hover:bg-white/10"
                          onClick={() => startEditing(expense)}
                        >
                          {t("budget.editExpense")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-white/10 bg-transparent text-white hover:bg-white/10"
                          onClick={() => deleteExpenseMutation.mutate(expense.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricPanel({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
      <CardContent className="p-5">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#171827] text-amber-400">
          {icon}
        </div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-slate-400">{detail}</div>
      </CardContent>
    </Card>
  );
}
