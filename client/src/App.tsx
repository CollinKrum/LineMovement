import { Switch, Route, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import { Toaster } from "@/components/ui/toaster";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Switch>
        {/* Home / Landing */}
        <Route path="/" component={Landing} />

        {/* Dashboard */}
        <Route path="/dashboard" component={Dashboard} />

        {/* Legacy or convenience paths */}
        <Route path="/app">
          <Redirect to="/dashboard" />
        </Route>

        {/* Catch-all → landing (or your NotFound page if you prefer) */}
        <Route>
          <Redirect to="/" />
        </Route>
      </Switch>

      <Toaster />
    </QueryClientProvider>
  );
}
