import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { HandCoins, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { incomeBreakdownInputSchema, type IncomeBreakdownInput, type IncomeBreakdown } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function FiftyThirtyTwenty() {
  const [budget, setBudget] = useState({ needs: 0, wants: 0, savings: 0, total: 0 });
  const [showResults, setShowResults] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<IncomeBreakdownInput>({
    resolver: zodResolver(incomeBreakdownInputSchema),
    defaultValues: {
      mainIncome: "",
      otherIncomes: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "otherIncomes",
  });

  const { data: existingIncome } = useQuery<IncomeBreakdown | null>({
    queryKey: ["/api/income"],
  });

  useEffect(() => {
    if (existingIncome) {
      form.reset({
        mainIncome: existingIncome.mainIncome?.toString() ?? "",
        otherIncomes: Array.isArray(existingIncome.otherIncomes)
          ? (existingIncome.otherIncomes as { label: string; amount: string }[])
          : [],
      });
      setBudget({
        needs: parseFloat(existingIncome.needs) || 0,
        wants: parseFloat(existingIncome.wants) || 0,
        savings: parseFloat(existingIncome.savings) || 0,
        total:
          (parseFloat(existingIncome.mainIncome) || 0) +
          (Array.isArray(existingIncome.otherIncomes)
            ? (existingIncome.otherIncomes as { amount: string }[]).reduce(
                (sum, entry) => sum + (parseFloat(entry.amount) || 0),
                0
              )
            : 0),
      });
      setShowResults(true);
    }
  }, [existingIncome, form]);

  const calculateMutation = useMutation({
    mutationFn: async (data: IncomeBreakdownInput) => {
      const response = await apiRequest("POST", "/api/income", data);
      return (await response.json()) as IncomeBreakdown;
    },
    onSuccess: (data) => {
      const total =
        (parseFloat(data.mainIncome) || 0) +
        (Array.isArray(data.otherIncomes)
          ? (data.otherIncomes as { amount: string }[]).reduce(
              (sum, entry) => sum + (parseFloat(entry.amount) || 0),
              0
            )
          : 0);
      setBudget({
        needs: parseFloat(data.needs) || 0,
        wants: parseFloat(data.wants) || 0,
        savings: parseFloat(data.savings) || 0,
        total,
      });
      setShowResults(true);
      queryClient.setQueryData(["/api/income"], data);
      queryClient.invalidateQueries({ queryKey: ["/api/user/profile"] });
      toast({
        title: t("fiftyThirtyTwenty.savedTitle"),
        description: t("fiftyThirtyTwenty.savedDesc"),
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

  const onSubmit = (data: IncomeBreakdownInput) => {
    calculateMutation.mutate(data);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-fifty-thirty-twenty">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
                <HandCoins className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-page-title">
                {t("fiftyThirtyTwenty.title")}
              </h2>
              <p className="text-slate-300" data-testid="text-page-description">
                {t("fiftyThirtyTwenty.description")}
              </p>
              <p className="mt-2 text-sm text-amber-300" data-testid="text-page-instructions">
                {t("fiftyThirtyTwenty.instructions")}
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="mainIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">{t("fiftyThirtyTwenty.mainIncomeLabel")}</FormLabel>
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
                            data-testid="input-main-income"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <FormLabel className="text-slate-300">{t("fiftyThirtyTwenty.otherIncomesLabel")}</FormLabel>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
                      onClick={() => append({ label: "", amount: "" })}
                      data-testid="button-add-other-income"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {t("fiftyThirtyTwenty.addOtherIncome")}
                    </Button>
                  </div>

                  {fields.length === 0 && (
                    <p className="text-sm text-slate-400" data-testid="text-no-other-incomes">
                      {t("fiftyThirtyTwenty.noOtherIncomes")}
                    </p>
                  )}

                  {fields.map((item, index) => (
                    <div key={item.id} className="flex items-center gap-3" data-testid={`row-other-income-${index}`}>
                      <FormField
                        control={form.control}
                        name={`otherIncomes.${index}.label`}
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormControl>
                              <Input
                                {...field}
                                placeholder={t("fiftyThirtyTwenty.otherIncomeLabelPlaceholder")}
                                className="rounded-lg border border-white/10 bg-[#171827] text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                                data-testid={`input-other-income-label-${index}`}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`otherIncomes.${index}.amount`}
                        render={({ field }) => (
                          <FormItem className="w-40">
                            <FormControl>
                              <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                                <Input
                                  {...field}
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  className="rounded-lg border border-white/10 bg-[#171827] pl-7 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                                  data-testid={`input-other-income-amount-${index}`}
                                />
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/10"
                        onClick={() => remove(index)}
                        data-testid={`button-remove-other-income-${index}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  type="submit"
                  className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                  disabled={calculateMutation.isPending}
                  data-testid="button-calculate"
                >
                  {calculateMutation.isPending ? t("fiftyThirtyTwenty.calculating") : t("fiftyThirtyTwenty.calculate")}
                </Button>
              </form>
            </Form>

            {showResults && (
              <div
                className="mt-6 rounded-lg border border-white/10 bg-[#171827] p-4"
                data-testid="card-budget-results"
              >
                <h3 className="font-medium text-white mb-2">{t("fiftyThirtyTwenty.ruleTitle")}</h3>
                <div className="space-y-1 text-sm text-slate-300">
                  <div className="flex justify-between">
                    <span>{t("fiftyThirtyTwenty.needs")}</span>
                    <span data-testid="text-needs-amount">${budget.needs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("fiftyThirtyTwenty.wants")}</span>
                    <span data-testid="text-wants-amount">${budget.wants.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("fiftyThirtyTwenty.savings")}</span>
                    <span data-testid="text-savings-amount">${budget.savings.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-white/10 pt-1 mt-1 font-medium text-white">
                    <span>{t("fiftyThirtyTwenty.totalIncome")}</span>
                    <span data-testid="text-total-income">${budget.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
