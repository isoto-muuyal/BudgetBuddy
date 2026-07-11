import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, Plus, RefreshCw, Save, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { parseMoney } from "@/lib/debt-plan";
import { cn } from "@/lib/utils";
import { RECURRING_EXPENSE_CATEGORIES, type RecurringExpenseCategory } from "@shared/schema";
import { useTranslation } from "react-i18next";

interface PayPeriodExpenseRow {
  id: string;
  name: string;
  amount: string;
  category: RecurringExpenseCategory;
  paid: boolean;
  sourceRecurringExpenseId: string | null;
}

interface RecurringPoolItem {
  id: string;
  name: string;
  amount: string;
  category: RecurringExpenseCategory;
  enabled: boolean;
}

const DROP_ZONE_ID = "pay-period-drop-zone";

const DEFAULT_FORM = {
  name: "",
  amount: "",
  category: "wants" as RecurringExpenseCategory,
};

function formatCurrency(value: number): string {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function CurrentPayPeriodDashboard() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [expenseForm, setExpenseForm] = useState({ ...DEFAULT_FORM });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState({ ...DEFAULT_FORM, sourceRecurringExpenseId: null as string | null });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const { data: payPeriodExpenses = [], isLoading } = useQuery<PayPeriodExpenseRow[]>({
    queryKey: ["/api/pay-period-expenses"],
  });

  const { data: recurringPool = [] } = useQuery<RecurringPoolItem[]>({
    queryKey: ["/api/recurring-expenses"],
  });

  const enabledPool = useMemo(() => recurringPool.filter((item) => item.enabled), [recurringPool]);

  const addMutation = useMutation({
    mutationFn: async (payload: { name: string; amount: string; category: RecurringExpenseCategory; sourceRecurringExpenseId?: string | null }) => {
      const response = await apiRequest("POST", "/api/pay-period-expenses", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-period-expenses"] });
      setExpenseForm({ ...DEFAULT_FORM });
      toast({ title: t("payPeriod.addedTitle"), description: t("payPeriod.addedDesc") });
    },
    onError: (error: any) => {
      toast({
        title: t("payPeriod.addErrorTitle"),
        description: error?.message || t("payPeriod.addErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: {
      expenseId: string;
      name: string;
      amount: string;
      category: RecurringExpenseCategory;
      sourceRecurringExpenseId: string | null;
    }) => {
      const response = await apiRequest("PATCH", `/api/pay-period-expenses/${payload.expenseId}`, {
        name: payload.name,
        amount: payload.amount,
        category: payload.category,
        sourceRecurringExpenseId: payload.sourceRecurringExpenseId,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-period-expenses"] });
      setEditingExpenseId(null);
      toast({ title: t("payPeriod.updatedTitle"), description: t("payPeriod.updatedDesc") });
    },
    onError: (error: any) => {
      toast({
        title: t("payPeriod.updateErrorTitle"),
        description: error?.message || t("payPeriod.updateErrorDesc"),
        variant: "destructive",
      });
    },
  });

  const togglePaidMutation = useMutation({
    mutationFn: async (payload: { expenseId: string; paid: boolean }) => {
      const response = await apiRequest("PATCH", `/api/pay-period-expenses/${payload.expenseId}/toggle`, {
        paid: payload.paid,
      });
      return response.json();
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["/api/pay-period-expenses"] });
      const previous = queryClient.getQueryData<PayPeriodExpenseRow[]>(["/api/pay-period-expenses"]);
      queryClient.setQueryData<PayPeriodExpenseRow[]>(["/api/pay-period-expenses"], (current) =>
        (current ?? []).map((expense) =>
          expense.id === payload.expenseId ? { ...expense, paid: payload.paid } : expense
        )
      );
      return { previous };
    },
    onError: (error: any, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/pay-period-expenses"], context.previous);
      }
      toast({
        title: t("payPeriod.updateErrorTitle"),
        description: error?.message || t("payPeriod.updateErrorDesc"),
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-period-expenses"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (expenseId: string) => {
      await apiRequest("DELETE", `/api/pay-period-expenses/${expenseId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/pay-period-expenses"] }),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/pay-period-expenses/reset");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pay-period-expenses"] });
      toast({ title: t("payPeriod.resetSuccessTitle"), description: t("payPeriod.resetSuccessDesc") });
    },
  });

  const totalExpenses = useMemo(
    () => payPeriodExpenses.reduce((sum, expense) => sum + parseMoney(expense.amount), 0),
    [payPeriodExpenses]
  );
  const totalPaid = useMemo(
    () =>
      payPeriodExpenses
        .filter((expense) => expense.paid)
        .reduce((sum, expense) => sum + parseMoney(expense.amount), 0),
    [payPeriodExpenses]
  );
  const totalPending = totalExpenses - totalPaid;

  const handleAddExpense = () => {
    if (!expenseForm.name || !expenseForm.amount) {
      toast({
        title: t("payPeriod.missingFieldsTitle"),
        description: t("payPeriod.missingFieldsDesc"),
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate(expenseForm);
  };

  const startEditing = (expense: PayPeriodExpenseRow) => {
    setEditingExpenseId(expense.id);
    setEditingForm({
      name: expense.name,
      amount: String(parseMoney(expense.amount)),
      category: expense.category,
      sourceRecurringExpenseId: expense.sourceRecurringExpenseId,
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.over?.id !== DROP_ZONE_ID) return;
    const recurring = enabledPool.find((item) => item.id === event.active.id);
    if (!recurring) return;
    addMutation.mutate({
      name: recurring.name,
      amount: recurring.amount,
      category: recurring.category,
      sourceRecurringExpenseId: recurring.id,
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricPanel label={t("payPeriod.totalExpenses")} value={`$${formatCurrency(totalExpenses)}`} />
        <MetricPanel label={t("payPeriod.totalPaid")} value={`$${formatCurrency(totalPaid)}`} accent="text-emerald-400" />
        <MetricPanel label={t("payPeriod.totalPending")} value={`$${formatCurrency(totalPending)}`} accent="text-amber-400" />
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t("payPeriod.listTitle")}</CardTitle>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/10">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {t("payPeriod.startNewPeriod")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-white/10 bg-[#202133] text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("payPeriod.confirmResetTitle")}</AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-400">
                      {t("payPeriod.confirmReset")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-white/10 bg-transparent text-white hover:bg-white/10">
                      {t("payPeriod.confirmResetCancel")}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                      onClick={() => resetMutation.mutate()}
                    >
                      {t("payPeriod.confirmResetAction")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.9fr_0.9fr_auto]">
                <Input
                  placeholder={t("payPeriod.expenseName")}
                  value={expenseForm.name}
                  onChange={(event) => setExpenseForm({ ...expenseForm, name: event.target.value })}
                  className="border-white/10 bg-[#171827] text-white"
                />
                <Input
                  placeholder={t("payPeriod.expenseAmount")}
                  value={expenseForm.amount}
                  onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                  className="border-white/10 bg-[#171827] text-white"
                  inputMode="decimal"
                />
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
                <Button
                  onClick={handleAddExpense}
                  disabled={addMutation.isPending}
                  className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <DropZone isEmpty={!isLoading && payPeriodExpenses.length === 0}>
                {isLoading ? (
                  <div className="text-sm text-slate-400">{t("payPeriod.loading")}</div>
                ) : payPeriodExpenses.length === 0 ? (
                  <div className="text-center text-sm text-slate-400">{t("payPeriod.empty")}</div>
                ) : (
                  payPeriodExpenses.map((expense) => (
                    <div
                      key={expense.id}
                      className={cn(
                        "rounded-lg border p-4",
                        expense.paid ? "paid-bg" : "border-white/10 bg-[#171827]"
                      )}
                    >
                      {editingExpenseId === expense.id ? (
                        <div className="grid gap-3 md:grid-cols-[1.2fr_0.9fr_0.9fr_auto] md:items-end">
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
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() =>
                                updateMutation.mutate({
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
                              {t("payPeriod.cancelEdit")}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div className="flex items-center gap-3">
                            <Switch
                              checked={expense.paid}
                              onCheckedChange={(checked) =>
                                togglePaidMutation.mutate({ expenseId: expense.id, paid: checked })
                              }
                            />
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{expense.name}</span>
                                <Badge variant="secondary">{t(`budget.category.${expense.category}`)}</Badge>
                              </div>
                              <div className="text-xs text-slate-400">
                                ${formatCurrency(parseMoney(expense.amount))} ·{" "}
                                {expense.paid ? t("payPeriod.markPaid") : t("payPeriod.markUnpaid")}
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
                              {t("payPeriod.editExpense")}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/10 bg-transparent text-white hover:bg-white/10"
                              onClick={() => deleteMutation.mutate(expense.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </DropZone>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
            <CardHeader>
              <CardTitle className="text-base">{t("payPeriod.poolTitle")}</CardTitle>
              <p className="text-xs text-slate-400">{t("payPeriod.dragHint")}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {enabledPool.length === 0 ? (
                <div className="text-sm text-slate-400">{t("payPeriod.poolEmpty")}</div>
              ) : (
                enabledPool.map((item) => <PoolItem key={item.id} item={item} />)
              )}
            </CardContent>
          </Card>
        </div>
      </DndContext>
    </div>
  );
}

function PoolItem({ item }: { item: RecurringPoolItem }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "flex cursor-grab touch-none items-center justify-between rounded-lg border border-white/10 bg-[#171827] p-3 text-sm active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div>
        <div className="font-medium">{item.name}</div>
        <div className="text-xs text-slate-400">
          ${formatCurrency(parseMoney(item.amount))} · {t(`budget.category.${item.category}`)}
        </div>
      </div>
      <GripVertical className="h-4 w-4 shrink-0 text-slate-500" />
    </div>
  );
}

function DropZone({ children, isEmpty }: { children: ReactNode; isEmpty: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: DROP_ZONE_ID });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "space-y-3 rounded-lg border-2 border-dashed p-3 transition-colors",
        isOver ? "border-amber-400 bg-amber-400/5" : "border-white/10",
        isEmpty && "flex min-h-24 items-center justify-center"
      )}
    >
      {children}
    </div>
  );
}

function MetricPanel({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
      <CardContent className="p-5">
        <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-[#171827] text-amber-400">
          <Wallet className="h-4 w-4" />
        </div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className={cn("mt-1 text-2xl font-semibold", accent)}>{value}</div>
      </CardContent>
    </Card>
  );
}
