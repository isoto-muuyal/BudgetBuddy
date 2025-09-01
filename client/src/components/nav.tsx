import { Link, useLocation } from "wouter";
import { PieChart, LogIn, LogOut, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken, removeAuthToken } from "@/lib/queryClient";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const isAuthPage = location === "/" || location === "/login" || location === "/signup";
  const isAuthenticated = !!getAuthToken();

  const handleLogout = () => {
    removeAuthToken();
    setLocation("/login");
  };

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
              <Link href="/about" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-about">
                About
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-terms">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-privacy">
                Privacy
              </Link>
              <a 
                href="https://buymeacoffee.com/israelss23" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors flex items-center"
                data-testid="link-coffee"
              >
                <Coffee className="w-4 h-4 mr-1" />
                Buy me a coffee
              </a>
              {!isAuthenticated ? (
                <Link href="/login" data-testid="button-login">
                  <Button className="gradient-brand text-white hover:opacity-90 transition-opacity">
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                </Link>
              ) : (
                <Button 
                  onClick={handleLogout}
                  variant="outline"
                  className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </Button>
              )}
            </div>
          )}

          {!isAuthPage && isAuthenticated && (
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/about" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-about">
                About
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-terms">
                Terms
              </Link>
              <Link href="/privacy" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-privacy">
                Privacy
              </Link>
              <a 
                href="https://buymeacoffee.com/israelss23" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors flex items-center"
                data-testid="link-coffee"
              >
                <Coffee className="w-4 h-4 mr-1" />
                Buy me a coffee
              </a>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
