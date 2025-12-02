import { useData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, AlertTriangle, Loader2 } from "lucide-react";

export default function Dashboard() {
  const { agreements, parties, isLoading } = useData();
  
  const totalPrincipal = agreements.reduce((sum, a) => sum + (a.principalAmount || 0), 0);
  const activeAgreements = agreements.filter(a => a.performanceStatus !== "WrittenOff" && a.performanceStatus !== "Settled").length;
  const inDefault = agreements.filter(a => a.performanceStatus === "InDefault").length;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of portfolio performance and risk.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-principal">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Principal Deployed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-principal">{formatCurrency(totalPrincipal)}</div>
            <p className="text-xs text-muted-foreground">Active portfolio value</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-agreements">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-active-agreements">{activeAgreements}</div>
            <p className="text-xs text-muted-foreground">Across {parties.length} parties</p>
          </CardContent>
        </Card>

        <Card data-testid="card-parties">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-parties-count">{parties.length}</div>
            <p className="text-xs text-muted-foreground">Companies, individuals, trusts</p>
          </CardContent>
        </Card>

        <Card className={inDefault > 0 ? "border-destructive/50 bg-destructive/5" : ""} data-testid="card-in-default">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">In Default</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="text-in-default">{inDefault}</div>
            <p className="text-xs text-destructive/80">{inDefault > 0 ? "Action required" : "No defaults"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Agreement Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["Draft", "Sent", "Executed", "Performing", "InDefault", "Settled", "WrittenOff"].map(status => {
                const count = agreements.filter(a => a.performanceStatus === status).length;
                const percentage = agreements.length > 0 ? (count / agreements.length) * 100 : 0;
                return (
                  <div key={status} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{status.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${status === "InDefault" ? "bg-destructive" : status === "Performing" ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
        
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Party Type Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {["Company", "Individual", "Trust", "Bank", "JVPartner"].map(type => {
                const count = parties.filter(p => p.type === type).length;
                const percentage = parties.length > 0 ? (count / parties.length) * 100 : 0;
                return (
                  <div key={type} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{type.replace(/([A-Z])/g, ' $1').trim()}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
