import { FormEvent, useEffect, useState } from "react";
import { Switch, Route, useLocation } from "wouter";
import { apiRequest, queryClient, getAuthToken } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { useToast } from "@/hooks/use-toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Income from "@/pages/income";
import FiftyThirtyTwenty from "@/pages/fifty-thirty-twenty";
import SmartAnalysisResults from "@/pages/smart-analysis-results";
import Budget from "@/pages/budget";
import Debt from "@/pages/debt";
import About from "@/pages/about";
import HowItWorks from "@/pages/how-it-works";
import Contact from "@/pages/contact";
import Terms from "@/pages/terms";
import Privacy from "@/pages/privacy";
import Navigation from "@/components/nav";
import LoadingOverlay from "@/components/loading-overlay";
import NotFound from "@/pages/not-found";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import VerifyEmail from "@/pages/verify-email";
import History from "@/pages/history";
import AdminPage from "@/pages/admin";
import VisitTracker from "@/components/visit-tracker";


const AUTH_ONLY_PAGES = ["/", "/login", "/signup"];
const FORCE_PASSWORD_CHANGE_KEY = "force_password_change";
const FORCE_PASSWORD_CHANGE_EVENT = "force-password-change-changed";

function ForcedPasswordChangeModal() {
  const [required, setRequired] = useState(localStorage.getItem(FORCE_PASSWORD_CHANGE_KEY) === "true");
  const [newPassword, setNewPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let active = true;

    const refreshRequiredState = () => {
      if (!getAuthToken()) {
        if (active) setRequired(false);
        localStorage.removeItem(FORCE_PASSWORD_CHANGE_KEY);
        return;
      }

      apiRequest("GET", "/api/user/profile")
        .then((response) => response.json())
        .then((user) => {
          if (!active) return;
          const mustChangePassword = Boolean(user.forcePasswordChange);
          setRequired(mustChangePassword);
          if (mustChangePassword) {
            localStorage.setItem(FORCE_PASSWORD_CHANGE_KEY, "true");
          } else {
            localStorage.removeItem(FORCE_PASSWORD_CHANGE_KEY);
          }
        })
        .catch(() => {
          if (active && localStorage.getItem(FORCE_PASSWORD_CHANGE_KEY) === "true") {
            setRequired(true);
          }
        });
    };

    window.addEventListener(FORCE_PASSWORD_CHANGE_EVENT, refreshRequiredState);
    refreshRequiredState();

    return () => {
      active = false;
      window.removeEventListener(FORCE_PASSWORD_CHANGE_EVENT, refreshRequiredState);
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await apiRequest("POST", "/api/auth/complete-password-change", { newPassword });
      const data = await response.json();
      setRequired(false);
      setNewPassword("");
      localStorage.removeItem(FORCE_PASSWORD_CHANGE_KEY);
      window.dispatchEvent(new Event(FORCE_PASSWORD_CHANGE_EVENT));
      toast({
        title: "Password updated",
        description: data.message || "Your password was updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Could not update password",
        description: error instanceof Error ? error.message : "Password update failed.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={required} onOpenChange={() => undefined}>
      <DialogContent className="[&>button]:hidden">
        <DialogHeader>
          <DialogTitle>Set a New Password</DialogTitle>
          <DialogDescription>
            You signed in with a temporary password. Create a new password before continuing.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="New password"
            minLength={6}
            required
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Password"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Router() {
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (getAuthToken() && AUTH_ONLY_PAGES.includes(location)) {
      setLocation("/income");
    }
  }, [location, setLocation]);

  return (
    <div className="min-h-screen">
      <Navigation />
      <VisitTracker />
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/fifty-thirty-twenty" component={FiftyThirtyTwenty} />
        <Route path="/budget" component={Budget} />
        <Route path="/income" component={Income} />
        <Route path="/smart-analysis/:id" component={SmartAnalysisResults} />
        <Route path="/debt" component={Debt} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/verify-email" component={VerifyEmail} />
        <Route path="/history" component={History} />
        <Route path="/about" component={About} />
        <Route path="/how-it-works" component={HowItWorks} />
        <Route path="/contact" component={Contact} />
        <Route path="/terms" component={Terms} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/admin" component={AdminPage} />
        <Route component={NotFound} />
      </Switch>
      <LoadingOverlay />
      <ForcedPasswordChangeModal />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
