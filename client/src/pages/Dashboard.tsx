import { useData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, FileText, AlertTriangle, Loader2, TrendingUp } from "lucide-react";
import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  Draft: "#94a3b8",
  Sent: "#60a5fa",
  Executed: "#818cf8",
  Performing: "#22c55e",
  InGracePeriod: "#f59e0b",
  InDefault: "#ef4444",
  Settled: "#14b8a6",
  WrittenOff: "#64748b"
};

const PARTY_COLORS = ["#1e3a5f", "#c9a227", "#3b82f6", "#8b5cf6", "#ec4899"];

export default function Dashboard() {
  const { agreements, parties, isLoading } = useData();
  
  const totalPrincipal = agreements.reduce((sum, a) => sum + (a.principalAmount || 0), 0);
  const activeAgreements = agreements.filter(a => a.performanceStatus !== "WrittenOff" && a.performanceStatus !== "Settled").length;
  const inDefault = agreements.filter(a => a.performanceStatus === "InDefault").length;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const statusChartData = useMemo(() => {
    const statuses = ["Draft", "Sent", "Executed", "Performing", "InGracePeriod", "InDefault", "Settled"];
    return statuses.map(status => ({
      name: status.replace(/([A-Z])/g, ' $1').trim(),
      value: agreements.filter(a => a.performanceStatus === status).length,
      amount: agreements.filter(a => a.performanceStatus === status).reduce((sum, a) => sum + (a.principalAmount || 0), 0),
      fill: STATUS_COLORS[status] || "#94a3b8"
    })).filter(d => d.value > 0);
  }, [agreements]);

  const partyTypeData = useMemo(() => {
    const types = ["Company", "Individual", "Trust", "Bank", "JVPartner"];
    return types.map((type, i) => ({
      name: type.replace(/([A-Z])/g, ' $1').trim(),
      count: parties.filter(p => p.type === type).length,
      fill: PARTY_COLORS[i]
    })).filter(d => d.count > 0);
  }, [parties]);

  const agreementTypeData = useMemo(() => {
    const types = ["Loan", "LOI", "JV", "Lease", "Other"];
    return types.map(type => ({
      name: type,
      count: agreements.filter(a => a.type === type).length,
      amount: agreements.filter(a => a.type === type).reduce((sum, a) => sum + (a.principalAmount || 0), 0)
    })).filter(d => d.count > 0);
  }, [agreements]);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-status-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Agreement Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={false}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value, name, props) => [
                      `${value} agreements (${formatCurrency(props.payload.amount)})`,
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No agreements to display
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card data-testid="card-party-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Party Type Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {partyTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={partyTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="count"
                    nameKey="name"
                    label={({ name, count }) => `${name}: ${count}`}
                    labelLine={false}
                  >
                    {partyTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value) => [`${value} parties`, 'Count']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground">
                No parties to display
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-agreement-types">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Agreements by Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          {agreementTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={agreementTypeData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis 
                  dataKey="name" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <Tooltip 
                  formatter={(value, name) => {
                    if (name === 'count') return [`${value} agreements`, 'Count'];
                    if (name === 'amount') return [formatCurrency(value as number), 'Principal'];
                    return [value, name];
                  }}
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar dataKey="count" name="Count" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
                <Bar dataKey="amount" name="Principal ($)" fill="#c9a227" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              No agreement data to display
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
