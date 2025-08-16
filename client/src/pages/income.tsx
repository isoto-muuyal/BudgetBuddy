import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { incomeSchema, type IncomeInput } from "@shared/schema";

export default function Income() {
  const [, setLocation] = useLocation();
  const [budget, setBudget] = useState({ needs: 0, wants: 0, savings: 0 });
  const { toast } = useToast();

  const form = useForm({
    resolver: zodResolver(incomeSchema),
    defaultValues: {
      monthlyIncome: "",
    },
  });

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
        title: "Success",
        description: "Monthly income updated successfully",
      });
      setLocation("/budget");
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    incomeMutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-income">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-green-400 to-brand-blue w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <DollarSign className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-income-title">
              Monthly Income
            </h2>
            <p className="text-gray-600" data-testid="text-income-description">
              Enter your monthly after-tax income to calculate your budget
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="monthlyIncome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monthly Income (After Taxes)</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-4 top-3 text-gray-500 text-lg">$</span>
                        <Input
                          {...field}
                          type="number"
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="w-full pl-8 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all text-lg"
                          data-testid="input-income"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="bg-blue-50 p-4 rounded-lg" data-testid="card-budget-preview">
                <h3 className="font-medium text-gray-900 mb-2">The 50/30/20 Rule</h3>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>• 50% for Needs (essentials)</span>
                    <span data-testid="text-needs-amount">${budget.needs.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 30% for Wants (desires)</span>
                    <span data-testid="text-wants-amount">${budget.wants.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>• 20% for Savings</span>
                    <span data-testid="text-savings-amount">${budget.savings.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                disabled={incomeMutation.isPending}
                data-testid="button-calculate"
              >
                {incomeMutation.isPending ? "Calculating..." : "Calculate Budget"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
