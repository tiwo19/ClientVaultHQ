import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Agreements from "@/pages/Agreements";
import Enforcement from "@/pages/Enforcement";
import Parties from "@/pages/Parties";
import AgreementDetail from "@/pages/AgreementDetail";
import Login from "@/pages/Login";
import AdminUsers from "@/pages/AdminUsers";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useEffect } from "react";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!user) {
      setLocation("/login");
    }
  }, [user, setLocation]);

  if (!user) return null;

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/agreements">
        <ProtectedRoute component={Agreements} />
      </Route>
      <Route path="/agreements/:id">
        <ProtectedRoute component={AgreementDetail} />
      </Route>
      <Route path="/enforcement">
        <ProtectedRoute component={Enforcement} />
      </Route>
      <Route path="/parties">
        <ProtectedRoute component={Parties} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        <Toaster />
        <Router />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
