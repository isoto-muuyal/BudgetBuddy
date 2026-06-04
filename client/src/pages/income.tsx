import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { HandCoins, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { incomeSchema, type IncomeInput } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function Income() {
  const [, setLocation] = useLocation();
  const [budget, setBudget] = useState({ needs: 0, wants: 0, savings: 0 });
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      monthlyIncome: "",
    },
  });

  const { data: userProfile } = useQuery<any>({
    queryKey: ["/api/user/profile"],
  });

  const { data: latestGlobalAdvice } = useQuery<any>({
    queryKey: ["/api/global-advice/latest"],
  });

  useEffect(() => {
    if (userProfile?.monthlyIncome) {
      form.setValue("monthlyIncome", userProfile.monthlyIncome.toString(), { shouldValidate: true });
    }
  }, [form, userProfile?.monthlyIncome]);

  const watchIncome = form.watch("monthlyIncome");

  useEffect(() => {
    const income = parseFloat(watchIncome as string) || 0;
    setBudget({
      needs: income * 0.5,
      wants: income * 0.3,
      savings: income * 0.2,
    });
  }, [watchIncome]);

  const incomeMutation = useMutation({
    mutationFn: async (data: IncomeInput) => {
      const response = await apiRequest("POST", "/api/user/income", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("income.updatedTitle"),
        description: t("income.updatedDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    incomeMutation.mutate(data);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-income">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <HandCoins className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-income-title">
              {t("income.title")}
            </h2>
            <p className="text-slate-300" data-testid="text-income-description">
              {t("income.description")}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="monthlyIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("income.label")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-slate-500 text-lg">$</span>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full rounded-lg border border-white/10 bg-[#171827] py-3 pl-8 pr-4 text-lg text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                          data-testid="input-income"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="rounded-lg border border-white/10 bg-[#171827] p-4" data-testid="card-budget-preview">
                <h3 className="font-medium text-white mb-2">{t("income.ruleTitle")}</h3>
                <div className="space-y-1 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>{t("income.needs")}</span>
                    <span data-testid="text-needs-amount">${budget.needs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("income.wants")}</span>
                    <span data-testid="text-wants-amount">${budget.wants.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("income.savings")}</span>
                    <span data-testid="text-savings-amount">${budget.savings.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4" data-testid="card-latest-global-advice">
                <h3 className="font-medium text-white mb-2">{t("income.latestGlobalAdviceTitle")}</h3>
                {latestGlobalAdvice?.advice ? (
                  <div className="space-y-2 text-sm text-slate-300 whitespace-pre-line">
                    <p>{latestGlobalAdvice.advice}</p>
                    <p className="text-xs uppercase tracking-wide text-emerald-300">
                      {t("income.latestGlobalAdviceStatus", { status: latestGlobalAdvice.progressStatus })}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">{t("income.latestGlobalAdviceEmpty")}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                disabled={incomeMutation.isPending}
                data-testid="button-calculate"
              >
                {incomeMutation.isPending ? t("income.calculating") : t("income.calculate")}
              </Button> 
              <Button
                type="button"
                className="w-full rounded-lg border border-white/10 bg-[#171827] py-3 font-medium text-white hover:bg-white/10"
                onClick={() => setLocation("/upload")}
                data-testid="button-upload-new"
              >
                {t("income.upload")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full rounded-lg border-white/10 bg-transparent py-3 font-medium text-white hover:bg-white/10 mt-3"
                onClick={() => setLocation("/history")}
                data-testid="button-view-history">
                  <History className="w-4 h-4 mr-2" />
                  {t("income.history")}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
