import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Agreements from "@/pages/Agreements";
import Enforcement from "@/pages/Enforcement";
import Parties from "@/pages/Parties";
import AgreementDetail from "@/pages/AgreementDetail";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/agreements" component={Agreements} />
        <Route path="/agreements/:id" component={AgreementDetail} />
        <Route path="/enforcement" component={Enforcement} />
        <Route path="/parties" component={Parties} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Toaster />
      <Router />
    </QueryClientProvider>
  );
}

export default App;
