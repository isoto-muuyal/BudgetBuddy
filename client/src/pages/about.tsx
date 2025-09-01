import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Shield, Zap, Users } from "lucide-react";

export default function About() {
  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-about-title">
          About BudgetWise
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto" data-testid="text-about-description">
          Your personal finance companion that helps you master the art of budgeting with the proven 50/30/20 rule.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <BarChart3 className="mr-3 text-blue-500" />
              Smart Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Upload your bank statements and let our AI analyze your spending patterns. 
              Get personalized insights on how your expenses align with the 50/30/20 budgeting rule.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Shield className="mr-3 text-green-500" />
              Privacy First
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Your financial data is processed securely and never shared with third parties. 
              We believe your privacy is paramount when it comes to personal finance management.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Zap className="mr-3 text-yellow-500" />
              Instant Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Get immediate feedback on your spending habits with categorized expenses and 
              actionable recommendations to improve your financial health.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Users className="mr-3 text-purple-500" />
              Built for Everyone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              Whether you're just starting your financial journey or looking to optimize your budget, 
              BudgetWise provides clear, actionable insights for all experience levels.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl shadow-lg">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">The 50/30/20 Rule</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-red-100 text-red-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                50%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Needs</h3>
              <p className="text-sm text-gray-600">Essential expenses like rent, groceries, utilities, and minimum debt payments</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 text-orange-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                30%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Wants</h3>
              <p className="text-sm text-gray-600">Non-essential expenses like entertainment, dining out, and hobbies</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                20%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Savings</h3>
              <p className="text-sm text-gray-600">Money saved, invested, or put toward debt payments above minimums</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}