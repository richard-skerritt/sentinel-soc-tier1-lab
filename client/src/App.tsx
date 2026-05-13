import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Briefing from "@/pages/Briefing";
import Learn from "@/pages/Learn";
import Queue from "@/pages/Queue";
import AlertDetail from "@/pages/AlertDetail";
import Mentor from "@/pages/Mentor";
import Dashboard from "@/pages/Dashboard";
import Settings from "@/pages/Settings";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Briefing} />
      <Route path="/learn" component={Learn} />
      <Route path="/queue" component={Queue} />
      <Route path="/alert/:id" component={AlertDetail} />
      <Route path="/mentor" component={Mentor} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router hook={useHashLocation}>
          <AppRouter />
        </Router>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
