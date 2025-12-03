import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Agreements from "@/pages/Agreements";
import Enforcement from "@/pages/Enforcement";
import Parties from "@/pages/Parties";
import PartyDetail from "@/pages/PartyDetail";
import AgreementDetail from "@/pages/AgreementDetail";
import AIBucket from "@/pages/AIBucket";
import Credits from "@/pages/Credits";
import Login from "@/pages/Login";
import AdminUsers from "@/pages/AdminUsers";
import NotFound from "@/pages/not-found";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider } from "@/lib/data";
import { useEffect } from "react";

// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user) {
      setLocation("/login");
    }
  }, [user, loading, setLocation]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

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
      <Route path="/parties/:id">
        <ProtectedRoute component={PartyDetail} />
      </Route>
      <Route path="/admin/users">
        <ProtectedRoute component={AdminUsers} />
      </Route>
      <Route path="/ai-bucket">
        <ProtectedRoute component={AIBucket} />
      </Route>
      <Route path="/credits">
        <ProtectedRoute component={Credits} />
      </Route>
      
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <Toaster />
          <Router />
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
