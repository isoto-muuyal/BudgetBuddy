import { Link, useLocation } from "wouter";
import { PieChart, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Navigation() {
  const [location] = useLocation();
  const isAuthPage = location === "/" || location === "/login" || location === "/signup";

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-2" data-testid="link-home">
            <PieChart className="text-2xl text-brand-blue" />
            <span className="text-xl font-bold gradient-brand-text">BudgetWise</span>
          </Link>
          
          {isAuthPage && (
            <div className="hidden md:flex items-center space-x-4">
              <span className="text-gray-600 hover:text-brand-blue transition-colors cursor-pointer">About</span>
              <span className="text-gray-600 hover:text-brand-blue transition-colors cursor-pointer">Features</span>
              <Link href="/login" data-testid="button-login">
                <Button className="gradient-brand text-white hover:opacity-90 transition-opacity">
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
