import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, Layers, Plus, RefreshCw, Save, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RECURRING_EXPENSE_FREQUENCIES,
  RECURRING_EXPENSE_CATEGORIES,
  RECURRING_EXPENSE_TYPES,
  type RecurringExpenseFrequency,
  type RecurringExpenseCategory,
  type RecurringExpenseType,
} from "@shared/schema";
import { useTranslation } from "react-i18next";

interface RecurringExpenseRow {
  id: string;
  name: string;
  amount: string;
  frequency: RecurringExpenseFrequency;
  category: RecurringExpenseCategory;
  type: RecurringExpenseType;
  enabled: boolean;
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

function remainingColor(spentPercent: number): string {
  if (spentPercent <= 50) return "text-green-400";
  if (spentPercent <= 80) return "text-yellow-400";
  if (spentPercent <= 90) return "text-orange-400";
  return "text-red-400";
}

const DEFAULT_FORM = {
  name: "",
  amount: "",
  frequency: "monthly" as RecurringExpenseFrequency,
  category: "wants" as RecurringExpenseCategory,
  type: "housing" as RecurringExpenseType,
};

export default function RecurringExpensesDashboard({ monthlyIncome = 0 }: RecurringExpensesDashboardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [expenseForm, setExpenseForm] = useState({ ...DEFAULT_FORM });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({ ...DEFAULT_FORM });
  const [filterCategory, setFilterCategory] = useState<RecurringExpenseCategory | "all">("all");
  const [filterType, setFilterType] = useState<RecurringExpenseType | "all">("all");
  const [groupModalOpen, setGroupModalOpen] = useState(false);

  const { data: expenses = [], isLoading } = useQuery<RecurringExpenseRow[]>({
    queryKey: ["/api/recurring-expenses"],
  });

  const addExpenseMutation = useMutation({
    mutationFn: async (payload: typeof DEFAULT_FORM) => {
      const response = await apiRequest("POST", "/api/recurring-expenses", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
      setExpenseForm({ ...DEFAULT_FORM });
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
    mutationFn: async (payload: { expenseId: string } & typeof DEFAULT_FORM) => {
      const response = await apiRequest("PATCH", `/api/recurring-expenses/${payload.expenseId}`, {
        name: payload.name,
        amount: payload.amount,
        frequency: payload.frequency,
        category: payload.category,
        type: payload.type,
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

  const toggleExpenseMutation = useMutation({
    mutationFn: async (payload: { expenseId: string; enabled: boolean }) => {
      const response = await apiRequest("PATCH", `/api/recurring-expenses/${payload.expenseId}/toggle`, {
        enabled: payload.enabled,
      });
      return response.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/recurring-expenses"] });
      const previous = queryClient.getQueryData<RecurringExpenseRow[]>(["/api/recurring-expenses"]);
      queryClient.setQueryData<RecurringExpenseRow[]>(["/api/recurring-expenses"], (current) =>
        (current ?? []).map((expense) =>
          expense.id === payload.expenseId ? { ...expense, enabled: payload.enabled } : expense
        )
      );
      return { previous };
    },
    onError: (error: any, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/recurring-expenses"], context.previous);
      }
      toast({
        title: t("budget.updateErrorTitle"),
        description: error?.message || t("budget.updateErrorDesc"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/recurring-expenses/${expenseId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/recurring-expenses"] }),
  });

  const monthlyTotalAll = useMemo(
    () =>
      expenses.reduce(
        (total, expense) => total + toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency),
        0
      ),
    [expenses]
  );

  const activeExpenses = useMemo(() => expenses.filter((expense) => expense.enabled), [expenses]);

  const monthlyTotalActive = useMemo(
    () =>
      activeExpenses.reduce(
        (total, expense) => total + toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency),
        0
      ),
    [activeExpenses]
  );

  const monthlyShare = monthlyIncome ? (monthlyTotalActive / monthlyIncome) * 100 : 0;
  const remaining = monthlyIncome - monthlyTotalActive;

  const filteredExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (filterCategory !== "all" && expense.category !== filterCategory) return false;
        if (filterType !== "all" && expense.type !== filterType) return false;
        return true;
      }),
    [expenses, filterCategory, filterType]
  );

  const categoryTotals = useMemo(() => {
    const totals: Record<RecurringExpenseCategory, number> = { needs: 0, wants: 0, savings: 0 };
    for (const expense of filteredExpenses) {
      totals[expense.category] += toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency);
    }
    return totals;
  }, [filteredExpenses]);

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
      category: expense.category,
      type: expense.type,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricPanel
          icon={<Wallet className="h-4 w-4" />}
          label={t("budget.totalAllLabel")}
          value={`$${formatCurrency(monthlyTotalAll)}`}
          detail={t("budget.monthlyEquivalent")}
        />
        <MetricPanel
          icon={<RefreshCw className="h-4 w-4" />}
          label={t("budget.totalActiveLabel")}
          value={`$${formatCurrency(monthlyTotalActive)}`}
          detail={t("budget.monthlyEquivalent")}
        />
        <MetricPanel
          icon={<CalendarClock className="h-4 w-4" />}
          label={t("budget.incomeShare")}
          value={monthlyIncome ? `${monthlyShare.toFixed(1)}%` : t("common.notAvailable")}
          detail={t("budget.ofMonthlyIncome")}
        />
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardContent className="p-5">
            <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#171827] text-amber-400">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="text-xs text-slate-400">{t("budget.remainingLabel")}</div>
            <div className={`mt-1 text-2xl font-semibold ${remainingColor(monthlyShare)}`}>
              ${formatCurrency(remaining)}
            </div>
            <div className="mt-1 text-xs text-slate-400">{t("budget.remainingDetail")}</div>
          </CardContent>
        </Card>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-2 block text-xs text-slate-400">{t("budget.categoryLabel")}</label>
                <Select
                  value={expenseForm.category}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value as RecurringExpenseCategory })}
                >
                  <SelectTrigger className="border-white/10 bg-[#171827] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_EXPENSE_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {t(`budget.category.${category}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-2 block text-xs text-slate-400">{t("budget.typeLabel")}</label>
                <Select
                  value={expenseForm.type}
                  onValueChange={(value) => setExpenseForm({ ...expenseForm, type: value as RecurringExpenseType })}
                >
                  <SelectTrigger className="border-white/10 bg-[#171827] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRING_EXPENSE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`budget.type.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <CardTitle className="text-base">{t("budget.currentExpenses")}</CardTitle>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-slate-400">{t("budget.filterCategoryLabel")}</label>
              <Select value={filterCategory} onValueChange={(value) => setFilterCategory(value as RecurringExpenseCategory | "all")}>
                <SelectTrigger className="w-40 border-white/10 bg-[#171827] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("budget.filterAll")}</SelectItem>
                  {RECURRING_EXPENSE_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {t(`budget.category.${category}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">{t("budget.filterTypeLabel")}</label>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as RecurringExpenseType | "all")}>
                <SelectTrigger className="w-44 border-white/10 bg-[#171827] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("budget.filterAll")}</SelectItem>
                  {RECURRING_EXPENSE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {t(`budget.type.${type}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-white/10 bg-transparent text-white hover:bg-white/10"
              onClick={() => setGroupModalOpen(true)}
            >
              <Layers className="mr-2 h-4 w-4" />
              {t("budget.groupButton")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-slate-400">{t("budget.loading")}</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="text-sm text-slate-400">{t("budget.empty")}</div>
          ) : (
            <div className="space-y-3">
              {filteredExpenses.map((expense) => (
                <div key={expense.id} className="rounded-lg border border-white/10 bg-[#171827] p-4">
                  {editingExpenseId === expense.id ? (
                    <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.9fr_0.9fr_0.9fr_auto] md:items-end">
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
                      <Select
                        value={editingForm.category}
                        onValueChange={(value) =>
                          setEditingForm({ ...editingForm, category: value as RecurringExpenseCategory })
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-[#202133] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRING_EXPENSE_CATEGORIES.map((category) => (
                            <SelectItem key={category} value={category}>
                              {t(`budget.category.${category}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editingForm.type}
                        onValueChange={(value) =>
                          setEditingForm({ ...editingForm, type: value as RecurringExpenseType })
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-[#202133] text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RECURRING_EXPENSE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {t(`budget.type.${type}`)}
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
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={expense.enabled}
                          onCheckedChange={(checked) =>
                            toggleExpenseMutation.mutate({ expenseId: expense.id, enabled: checked })
                          }
                        />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`font-semibold ${expense.enabled ? "" : "text-slate-500 line-through"}`}>
                              {expense.name}
                            </span>
                            <Badge variant="secondary">{t(`budget.category.${expense.category}`)}</Badge>
                            <Badge variant="outline" className="border-white/20 text-slate-300">
                              {t(`budget.type.${expense.type}`)}
                            </Badge>
                          </div>
                          <div className="text-xs text-slate-400">
                            ${formatCurrency(parseMoney(expense.amount))} · {t(`budget.frequency.${expense.frequency}`)} ·{" "}
                            {t("budget.monthlyEquivalentShort", {
                              amount: formatCurrency(toMonthlyEquivalent(parseMoney(expense.amount), expense.frequency)),
                            })}{" "}
                            · {expense.enabled ? t("budget.enabledLabel") : t("budget.disabledLabel")}
                          </div>
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

      <Dialog open={groupModalOpen} onOpenChange={setGroupModalOpen}>
        <DialogContent className="border-white/10 bg-[#202133] text-white">
          <DialogHeader>
            <DialogTitle>{t("budget.groupModalTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {RECURRING_EXPENSE_CATEGORIES.map((category) => (
              <div
                key={category}
                className="flex items-center justify-between rounded-lg border border-white/10 bg-[#171827] p-4"
              >
                <span className="font-medium">{t(`budget.category.${category}`)}</span>
                <span className="font-semibold">${formatCurrency(categoryTotals[category])}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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
