import { Link, useLocation } from "wouter";
import { HandCoins, LogIn, LogOut, Coffee, Moon, Sun, Globe, X } from "lucide-react";
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

const CONTENT_PAGES = ["/about", "/how-it-works", "/contact", "/terms", "/privacy"];

export default function Navigation() {
  const [location, setLocation] = useLocation();
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const isAuthPage = location === "/" || location === "/login" || location === "/signup";
  const isContentPage = CONTENT_PAGES.includes(location);
  const isAuthenticated = !!getAuthToken();
  const showPublicNav = isAuthPage || isContentPage || isAuthenticated;
  const closeContentPage = () => setLocation(isAuthenticated ? "/income" : "/login");

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
    <nav className="border-b border-white/10 bg-[#202133] shadow-sm">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-6">
            <Link
              href={isAuthenticated ? "/income" : "/login"}
              className="flex items-center space-x-2"
              data-testid="link-home"
            >
            <HandCoins className="text-2xl text-amber-400" />
              <span className="text-xl font-bold text-white">{t("appName")}</span>
            </Link>

            {isContentPage && (
              <Button
                onClick={closeContentPage}
                variant="outline"
                size="icon"
                title={t("nav.close")}
                className="border-white/10 bg-transparent text-white hover:bg-white/10 transition-colors"
                data-testid="button-close-content"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {isAuthenticated && (
              <div className="hidden md:flex items-center space-x-4">
                <Link
                  href="/budget"
                  className="text-sm font-medium text-slate-300 hover:text-amber-300 transition-colors"
                  data-testid="link-budget"
                >
                  {t("nav.budget")}
                </Link>
                <Link
                  href="/income"
                  className="text-sm font-medium text-slate-300 hover:text-amber-300 transition-colors"
                  data-testid="link-budget-analysis"
                >
                  {t("nav.budgetAnalysis")}
                </Link>
                <Link
                  href="/debt"
                  className="text-sm font-medium text-slate-300 hover:text-amber-300 transition-colors"
                  data-testid="link-debt-management"
                >
                  {t("nav.debtManagement")}
                </Link>
              </div>
            )}
          </div>
          
          {showPublicNav && (
            <div className="hidden md:flex items-center space-x-4">
              <Link href="/about" className="text-slate-300 hover:text-amber-300 transition-colors" data-testid="link-about">
                {t("nav.about")}
              </Link>
              <Link href="/how-it-works" className="text-slate-300 hover:text-amber-300 transition-colors" data-testid="link-how-it-works">
                {t("nav.howItWorks")}
              </Link>
              <Link href="/contact" className="text-slate-300 hover:text-amber-300 transition-colors" data-testid="link-contact">
                {t("nav.contactUs")}
              </Link>
              <Link href="/terms" className="text-slate-300 hover:text-amber-300 transition-colors" data-testid="link-terms">
                {t("nav.terms")}
              </Link>
              <Link href="/privacy" className="text-slate-300 hover:text-amber-300 transition-colors" data-testid="link-privacy">
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
                  <Button variant="outline" size="icon" title={t("nav.theme")} data-testid="button-theme">
                    {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
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
                  <Button variant="outline" size="icon" title={t("nav.language")} data-testid="button-language">
                    <Globe className="h-4 w-4" />
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
                  <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors">
                    <LogIn className="w-4 h-4 mr-2" />
                    {t("nav.login")}
                  </Button>
                </Link>
              ) : (
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="icon"
                  title={t("nav.logout")}
                  className="border-white/10 bg-transparent text-white hover:bg-white/10 transition-colors"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
