import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
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
import History from "@/pages/history";
import AdminPage from "@/pages/admin";
import VisitTracker from "@/components/visit-tracker";


function Router() {
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
