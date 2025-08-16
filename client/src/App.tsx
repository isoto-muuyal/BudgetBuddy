import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Income from "@/pages/income";
import Budget from "@/pages/budget";
import Upload from "@/pages/upload";
import Results from "@/pages/results";
import Navigation from "@/components/nav";
import LoadingOverlay from "@/components/loading-overlay";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <div className="min-h-screen">
      <Navigation />
      <Switch>
        <Route path="/" component={Login} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/income" component={Income} />
        <Route path="/budget" component={Budget} />
        <Route path="/upload" component={Upload} />
        <Route path="/results/:id" component={Results} />
        <Route component={NotFound} />
      </Switch>
      <LoadingOverlay />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
