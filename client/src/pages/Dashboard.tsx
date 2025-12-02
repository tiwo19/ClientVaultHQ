import { agreements, parties } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, AlertTriangle } from "lucide-react";

export default function Dashboard() {
  const totalPrincipal = agreements.reduce((sum, a) => sum + a.principalAmount, 0);
  const activeAgreements = agreements.filter(a => a.performanceStatus !== "WrittenOff" && a.performanceStatus !== "Settled").length;
  const inDefault = agreements.filter(a => a.performanceStatus === "InDefault").length;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Overview of portfolio performance and risk.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Principal Deployed</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalPrincipal)}</div>
            <p className="text-xs text-muted-foreground">+2.5% from last month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Agreements</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeAgreements}</div>
            <p className="text-xs text-muted-foreground">Across {parties.length} parties</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Parties</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{parties.length}</div>
            <p className="text-xs text-muted-foreground">3 new this quarter</p>
          </CardContent>
        </Card>

        <Card className={inDefault > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-destructive">In Default</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{inDefault}</div>
            <p className="text-xs text-destructive/80">Action required</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Activity chart placeholder
            </div>
          </CardContent>
        </Card>
        
        <Card className="h-[400px]">
          <CardHeader>
            <CardTitle>Portfolio Composition</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-full text-muted-foreground">
              Pie chart placeholder
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
