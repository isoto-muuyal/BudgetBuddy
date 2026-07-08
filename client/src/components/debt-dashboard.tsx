import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowDownUp, BadgeDollarSign, CalendarCheck, Plus, Save, Target, Trash2, WalletCards } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { buildDebtPlan, parseMoney, type DebtStrategy } from "@/lib/debt-plan";

interface DebtDashboardProps {
  monthlyIncome?: number;
}

export default function DebtDashboard({ monthlyIncome = 0 }: DebtDashboardProps) {
  const { toast } = useToast();
  const { t } = useTranslation();
  const [strategy, setStrategy] = useState<DebtStrategy>("hybrid");
  const [extraPayment, setExtraPayment] = useState("100");
  const [debtForm, setDebtForm] = useState({
    name: "",
    totalAmount: "",
    monthlyPayment: "",
    interestRate: "",
  });
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editingInterestRate, setEditingInterestRate] = useState("");

  const { data: debts = [], isLoading: debtsLoading } = useQuery<any[]>({
    queryKey: ["/api/debts"],
  });

  const addDebtMutation = useMutation({
    mutationFn: async (payload: { name: string; totalAmount: string; monthlyPayment: string; interestRate: string }) => {
      const response = await apiRequest("POST", "/api/debts", payload);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setDebtForm({ name: "", totalAmount: "", monthlyPayment: "", interestRate: "" });
      toast({ title: "Debt added", description: "Your payoff plan has been recalculated." });
    },
    onError: (error: any) => {
      toast({ title: "Unable to add debt", description: error?.message || "Check the debt fields.", variant: "destructive" });
    },
  });

  const deleteDebtMutation = useMutation({
    mutationFn: async (debtId: string) => {
      await apiRequest("DELETE", `/api/debts/${debtId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/debts"] }),
  });

  const updateDebtMutation = useMutation({
    mutationFn: async (payload: { debtId: string; interestRate: string }) => {
      const response = await apiRequest("PATCH", `/api/debts/${payload.debtId}`, {
        interestRate: payload.interestRate,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      setEditingDebtId(null);
      setEditingInterestRate("");
    },
  });

  const plan = useMemo(
    () => buildDebtPlan(debts, strategy, Math.max(0, parseMoney(extraPayment))),
    [debts, extraPayment, strategy]
  );

  const dti = monthlyIncome ? (plan.minimumPaymentTotal / monthlyIncome) * 100 : 0;
  const motivationalQuote = useMemo(() => {
    const quotes = t("debt.motivationalQuotes", { returnObjects: true }) as string[];
    if (!Array.isArray(quotes) || quotes.length === 0) return "";
    return quotes[Math.floor(Math.random() * quotes.length)];
  }, [t]);
  const payoffChart = plan.months.slice(0, 18).map((month) => ({
    month: `M${month.month}`,
    balance: Number(month.totalBalance.toFixed(2)),
    payment: Number(month.totalPayment.toFixed(2)),
  }));
  const debtBars = debts.map((debt) => ({
    name: String(debt.name).slice(0, 16),
    balance: parseMoney(debt.totalAmount),
    rate: parseMoney(debt.interestRate),
  }));

  const handleAddDebt = () => {
    if (!debtForm.name || !debtForm.totalAmount || !debtForm.monthlyPayment || !debtForm.interestRate) {
      toast({ title: "Missing debt fields", description: "Enter name, balance, minimum payment, and APR.", variant: "destructive" });
      return;
    }
    addDebtMutation.mutate(debtForm);
  };

  return (
    <div className="space-y-5">
      <DebtHealthMeter dti={dti} hasIncome={monthlyIncome > 0} quote={motivationalQuote} />

      <div className="grid gap-4 lg:grid-cols-4">
        <MetricPanel
          icon={<WalletCards className="h-4 w-4" />}
          label="Total debt"
          value={`$${formatCurrency(plan.totalBalance)}`}
          detail={`${debts.length} accounts`}
        />
        <MetricPanel
          icon={<BadgeDollarSign className="h-4 w-4" />}
          label="Minimum payments"
          value={`$${formatCurrency(plan.minimumPaymentTotal)}`}
          detail={`${dti.toFixed(1)}% of income`}
        />
        <MetricPanel
          icon={<Target className="h-4 w-4" />}
          label="Current target"
          value={plan.firstTargetName || "Add debt"}
          detail={strategyLabel(strategy)}
        />
        <MetricPanel
          icon={<CalendarCheck className="h-4 w-4" />}
          label="Debt-free estimate"
          value={plan.monthsToDebtFree ? `${plan.monthsToDebtFree} mo` : "No plan"}
          detail={`Interest est. $${formatCurrency(plan.totalInterest)}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Payoff Timeline</CardTitle>
              <p className="mt-1 text-xs text-slate-400">Balance decline over the next 18 months</p>
            </div>
            <ArrowDownUp className="h-5 w-5 text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={payoffChart}>
                  <defs>
                    <linearGradient id="debtBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.08} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#34364a" vertical={false} />
                  <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} tickFormatter={(value) => `$${Number(value) / 1000}k`} />
                  <Tooltip contentStyle={{ background: "#171827", border: "1px solid #34364a", borderRadius: 8 }} />
                  <Area type="monotone" dataKey="balance" stroke="#f59e0b" fill="url(#debtBalance)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">Strategy Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-2 block text-xs text-slate-400">Payoff method</label>
              <Select value={strategy} onValueChange={(value) => setStrategy(value as DebtStrategy)}>
                <SelectTrigger className="border-white/10 bg-[#171827] text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                  <SelectItem value="snowball">Snowball</SelectItem>
                  <SelectItem value="avalanche">Avalanche</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-xs text-slate-400">Extra payment above minimums</label>
              <Input
                value={extraPayment}
                onChange={(event) => setExtraPayment(event.target.value)}
                className="border-white/10 bg-[#171827] text-white"
                inputMode="decimal"
              />
            </div>
            <div className="rounded-lg border border-white/10 bg-[#171827] p-4 text-sm text-slate-300">
              {strategyCopy(strategy)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">Add Debt</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Input placeholder="Debt name" value={debtForm.name} onChange={(event) => setDebtForm({ ...debtForm, name: event.target.value })} className="border-white/10 bg-[#171827] text-white" />
            <Input placeholder="Current balance" value={debtForm.totalAmount} onChange={(event) => setDebtForm({ ...debtForm, totalAmount: event.target.value })} className="border-white/10 bg-[#171827] text-white" />
            <Input placeholder="Minimum payment" value={debtForm.monthlyPayment} onChange={(event) => setDebtForm({ ...debtForm, monthlyPayment: event.target.value })} className="border-white/10 bg-[#171827] text-white" />
            <Input placeholder="APR %" value={debtForm.interestRate} onChange={(event) => setDebtForm({ ...debtForm, interestRate: event.target.value })} className="border-white/10 bg-[#171827] text-white" />
            <Button onClick={handleAddDebt} disabled={addDebtMutation.isPending} className="bg-amber-500 text-slate-950 hover:bg-amber-400">
              <Plus className="mr-2 h-4 w-4" />
              Add Debt
            </Button>
          </CardContent>
        </Card>

        <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
          <CardHeader>
            <CardTitle className="text-base">Debt Mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={debtBars}>
                  <CartesianGrid stroke="#34364a" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "#171827", border: "1px solid #34364a", borderRadius: 8 }} />
                  <Bar dataKey="balance" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-base">Current Debts</CardTitle>
        </CardHeader>
        <CardContent>
          {debtsLoading ? (
            <div className="text-sm text-slate-400">Loading debts...</div>
          ) : debts.length === 0 ? (
            <div className="text-sm text-slate-400">Add debts to generate a payoff plan.</div>
          ) : (
            <div className="space-y-3">
              {debts.map((debt) => (
                <div key={debt.id} className="rounded-lg border border-white/10 bg-[#171827] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-semibold">{debt.name}</div>
                      <div className="text-xs text-slate-400">
                        Balance ${formatCurrency(parseMoney(debt.totalAmount))} | Minimum ${formatCurrency(parseMoney(debt.monthlyPayment))} | APR {parseMoney(debt.interestRate).toFixed(2)}%
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {editingDebtId === debt.id ? (
                        <>
                          <Input className="h-9 w-28 border-white/10 bg-[#202133] text-white" value={editingInterestRate} onChange={(event) => setEditingInterestRate(event.target.value)} />
                          <Button size="sm" onClick={() => updateDebtMutation.mutate({ debtId: debt.id, interestRate: editingInterestRate })}>
                            <Save className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => {
                          setEditingDebtId(debt.id);
                          setEditingInterestRate(String(parseMoney(debt.interestRate)));
                        }}>
                          Edit APR
                        </Button>
                      )}
                      <Button variant="outline" size="sm" className="border-white/10 bg-transparent text-white hover:bg-white/10" onClick={() => deleteDebtMutation.mutate(debt.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
        <CardHeader>
          <CardTitle className="text-base">First 8 Months</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-white/10 hover:bg-transparent">
                <TableHead className="text-slate-300">Month</TableHead>
                <TableHead className="text-slate-300">Target</TableHead>
                <TableHead className="text-right text-slate-300">Payment</TableHead>
                <TableHead className="text-right text-slate-300">Interest</TableHead>
                <TableHead className="text-right text-slate-300">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plan.months.slice(0, 8).map((month) => (
                <TableRow key={month.month} className="border-white/10 hover:bg-white/5">
                  <TableCell className="text-slate-100">{month.month}</TableCell>
                  <TableCell className="text-slate-300">{month.targetDebtName}</TableCell>
                  <TableCell className="text-right text-slate-100">${formatCurrency(month.totalPayment)}</TableCell>
                  <TableCell className="text-right text-slate-300">${formatCurrency(month.interestPaid)}</TableCell>
                  <TableCell className="text-right text-slate-100">${formatCurrency(month.totalBalance)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricPanel({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
      <CardContent className="p-5">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-amber-400">{icon}</div>
        <div className="text-xs text-slate-400">{label}</div>
        <div className="mt-1 truncate text-2xl font-semibold">{value}</div>
        <div className="mt-1 text-xs text-slate-500">{detail}</div>
      </CardContent>
    </Card>
  );
}

type DebtHealthStatus = "healthy" | "moderate" | "risky" | "critical";

function getDebtHealthStatus(dti: number): DebtHealthStatus {
  if (dti < 20) return "healthy";
  if (dti < 36) return "moderate";
  if (dti < 43) return "risky";
  return "critical";
}

const STATUS_TEXT_COLOR: Record<DebtHealthStatus, string> = {
  healthy: "text-emerald-400",
  moderate: "text-amber-400",
  risky: "text-orange-400",
  critical: "text-red-400",
};

function DebtHealthMeter({ dti, hasIncome, quote }: { dti: number; hasIncome: boolean; quote: string }) {
  const { t } = useTranslation();
  const status = getDebtHealthStatus(dti);
  const markerPosition = Math.min(100, Math.max(0, dti));

  return (
    <Card className="border-white/10 bg-[#202133] text-white shadow-xl">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs text-slate-400">{t("debt.meter.title")}</div>
            <div className={`mt-1 text-2xl font-semibold ${STATUS_TEXT_COLOR[status]}`}>
              {t(`debt.meter.status.${status}`)}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {hasIncome ? t("debt.meter.detail", { percent: dti.toFixed(1) }) : t("debt.meter.noIncome")}
            </div>
          </div>
          <div className="md:w-80">
            <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500">
              {hasIncome && (
                <div
                  className="absolute top-0 h-full w-0.5 bg-white shadow-[0_0_4px_rgba(255,255,255,0.9)]"
                  style={{ left: `${markerPosition}%` }}
                />
              )}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-slate-500">
              <span>0%</span>
              <span>20%</span>
              <span>36%</span>
              <span>43%+</span>
            </div>
          </div>
        </div>
        {quote && (
          <p className="mt-4 border-t border-white/10 pt-4 text-sm italic text-slate-300">"{quote}"</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatCurrency(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function strategyLabel(strategy: DebtStrategy) {
  if (strategy === "snowball") return "Smallest balance first";
  if (strategy === "avalanche") return "Highest APR first";
  return "Quick win, then APR";
}

function strategyCopy(strategy: DebtStrategy) {
  if (strategy === "snowball") {
    return "Snowball is easiest to follow: pay minimums on everything, attack the smallest balance, then roll that payment forward.";
  }
  if (strategy === "avalanche") {
    return "Avalanche is usually cheapest: pay minimums on everything, attack the highest interest rate, then roll that payment forward.";
  }
  return "Hybrid gives one quick win first, then switches to highest interest. It balances motivation with lower interest cost.";
}
