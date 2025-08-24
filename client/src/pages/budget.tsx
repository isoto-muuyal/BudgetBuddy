import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { PieChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Budget() {
  const [, setLocation] = useLocation();
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
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-budget">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="gradient-brand w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <PieChart className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-budget-title">
              Your Budget Plan
            </h2>
            <p className="text-gray-600" data-testid="text-budget-description">
              Based on monthly income of ${monthlyIncome.toFixed(2)}
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="needs-bg p-4 rounded-lg border" data-testid="card-needs">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold needs-text">Needs (50%)</h3>
                <span className="text-xl font-bold needs-text" data-testid="text-needs-amount">
                  ${needs.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600">Rent, groceries, utilities, minimum debt payments</p>
              <div className="w-full bg-green-200 rounded-full h-2 mt-2">
                <div className="bg-green-500 h-2 rounded-full" style={{ width: "50%" }}></div>
              </div>
            </div>

            <div className="wants-bg p-4 rounded-lg border" data-testid="card-wants">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold wants-text">Wants (30%)</h3>
                <span className="text-xl font-bold wants-text" data-testid="text-wants-amount">
                  ${wants.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600">Entertainment, dining out, hobbies, subscriptions</p>
              <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: "30%" }}></div>
              </div>
            </div>

            <div className="savings-bg p-4 rounded-lg border" data-testid="card-savings">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-semibold savings-text">Savings (20%)</h3>
                <span className="text-xl font-bold savings-text" data-testid="text-savings-amount">
                  ${savings.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-600">Emergency fund, retirement, investments</p>
              <div className="w-full bg-purple-200 rounded-full h-2 mt-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: "20%" }}></div>
              </div>
            </div>
          </div>

          <Button
            onClick={() => setLocation("/upload")}
            className="w-full bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
            data-testid="button-upload"
          >
            Upload Bank Statement
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
