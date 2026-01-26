import { Link, useLocation } from "wouter";
import { PieChart, LogIn, LogOut, Coffee, Moon, Sun, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken, removeAuthToken } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isAuthPage = location === "/" || location === "/login" || location === "/signup";
  const isAuthenticated = !!getAuthToken();

  const handleLogout = () => {
    removeAuthToken();
    setLocation("/login");
  };

  const setLocale = (locale: string) => {
    i18n.changeLanguage(locale);
    if (typeof window !== "undefined") {
      localStorage.setItem("locale", locale);
    }
  };

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link
              href={isAuthenticated ? "/income" : "/login"}
              className="flex items-center space-x-2"
              data-testid="link-home"
            >
            <PieChart className="text-2xl text-brand-blue" />
              <span className="text-xl font-bold gradient-brand-text">{t("appName")}</span>
            </Link>

            {isAuthenticated && (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  href="/income"
                  className="text-sm font-medium text-gray-700 hover:text-brand-blue transition-colors"
                  data-testid="link-budget-analysis"
                >
                  {t("nav.budgetAnalysis")}
                </Link>
                <Link
                  href="/debt"
                  className="text-sm font-medium text-gray-700 hover:text-brand-blue transition-colors"
                  data-testid="link-debt-management"
                >
                  {t("nav.debtManagement")}
                </Link>
              </div>
            )}
          </div>
          
          {isAuthPage && (
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/about" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-about">
                {t("nav.about")}
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-terms">
                {t("nav.terms")}
              </Link>
              <Link href="/privacy" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-privacy">
                {t("nav.privacy")}
              </Link>
              <a 
                href="https://buymeacoffee.com/israelss23" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors flex items-center"
                data-testid="link-coffee"
              >
                <Coffee className="w-4 h-4 mr-1" />
                {t("nav.buyCoffee")}
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-theme">
                    {theme === "dark" ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                    {t("nav.theme")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme("light")}>{t("nav.themeLight")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>{t("nav.themeDark")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>{t("nav.themeSystem")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-language">
                    <Globe className="h-4 w-4 mr-2" />
                    {t("nav.language")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocale("en")}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("es")}>Español</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("fr")}>Français</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("ja")}>日本語</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("ru")}>Русский</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {!isAuthenticated ? (
                <Link href="/login" data-testid="button-login">
                  <Button className="gradient-brand text-white hover:opacity-90 transition-opacity">
                    <LogIn className="w-4 h-4 mr-2" />
                    {t("nav.login")}
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
                  {t("nav.logout")}
                </Button>
              )}
            </div>
          )}

          {!isAuthPage && isAuthenticated && (
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/about" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-about">
                {t("nav.about")}
              </Link>
              <Link href="/terms" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-terms">
                {t("nav.terms")}
              </Link>
              <Link href="/privacy" className="text-gray-600 hover:text-brand-blue transition-colors" data-testid="link-privacy">
                {t("nav.privacy")}
              </Link>
              <a 
                href="https://buymeacoffee.com/israelss23" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-orange-500 hover:text-orange-600 transition-colors flex items-center"
                data-testid="link-coffee"
              >
                <Coffee className="w-4 h-4 mr-1" />
                {t("nav.buyCoffee")}
              </a>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-theme">
                    {theme === "dark" ? <Moon className="h-4 w-4 mr-2" /> : <Sun className="h-4 w-4 mr-2" />}
                    {t("nav.theme")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme("light")}>{t("nav.themeLight")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("dark")}>{t("nav.themeDark")}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme("system")}>{t("nav.themeSystem")}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-language">
                    <Globe className="h-4 w-4 mr-2" />
                    {t("nav.language")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setLocale("en")}>English</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("es")}>Español</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("fr")}>Français</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("ja")}>日本語</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocale("ru")}>Русский</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button 
                onClick={handleLogout}
                variant="outline"
                className="border-brand-blue text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
                data-testid="button-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t("nav.logout")}
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
