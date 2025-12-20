import { useData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { DollarSign, Users, FileText, AlertTriangle, Loader2, TrendingUp, Clock, Calendar, Settings, GripVertical, RotateCcw } from "lucide-react";
import { useMemo, useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
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

const STORAGE_KEY = "dashboard_layout";

type WidgetId = "kpis" | "maturities" | "expiring_docs" | "status_chart" | "party_chart" | "agreement_types";

interface WidgetConfig {
  id: WidgetId;
  title: string;
  description: string;
  visible: boolean;
  size: "full" | "half" | "quarter";
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "kpis", title: "Key Metrics", description: "Portfolio overview cards", visible: true, size: "full" },
  { id: "maturities", title: "Upcoming Maturities", description: "Agreements nearing maturity", visible: true, size: "half" },
  { id: "expiring_docs", title: "Expiring Documents", description: "Documents nearing expiration", visible: true, size: "half" },
  { id: "status_chart", title: "Agreement Status", description: "Status distribution chart", visible: true, size: "half" },
  { id: "party_chart", title: "Party Types", description: "Party type distribution", visible: true, size: "half" },
  { id: "agreement_types", title: "Agreements by Type", description: "Agreement type breakdown", visible: true, size: "full" },
];

interface DashboardLayoutState {
  widgets: WidgetConfig[];
  version: number;
}

function loadLayout(): WidgetConfig[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: DashboardLayoutState = JSON.parse(stored);
      if (parsed.version === 1 && Array.isArray(parsed.widgets)) {
        const widgetIds = new Set(parsed.widgets.map(w => w.id));
        const merged = parsed.widgets.filter(w => DEFAULT_WIDGETS.some(d => d.id === w.id));
        DEFAULT_WIDGETS.forEach(dw => {
          if (!widgetIds.has(dw.id)) {
            merged.push(dw);
          }
        });
        return merged;
      }
    }
  } catch (e) {
    console.error("Failed to load dashboard layout", e);
  }
  return DEFAULT_WIDGETS;
}

function saveLayout(widgets: WidgetConfig[]) {
  try {
    const state: DashboardLayoutState = { widgets, version: 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Failed to save dashboard layout", e);
  }
}

export default function Dashboard() {
  const { agreements, parties, documents, isLoading } = useData();
  const [widgets, setWidgets] = useState<WidgetConfig[]>(loadLayout);
  const [settingsOpen, setSettingsOpen] = useState(false);
  
  useEffect(() => {
    saveLayout(widgets);
  }, [widgets]);

  const totalPrincipal = agreements.reduce((sum, a) => sum + (a.principalAmount || 0), 0);
  const activeAgreements = agreements.filter(a => a.performanceStatus !== "WrittenOff" && a.performanceStatus !== "Settled").length;
  const inDefault = agreements.filter(a => a.performanceStatus === "InDefault").length;
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const getDaysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = date.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const upcomingMaturities = useMemo(() => {
    return agreements
      .filter(a => a.maturityDate && a.performanceStatus !== "Settled" && a.performanceStatus !== "WrittenOff")
      .map(a => ({
        ...a,
        daysUntil: getDaysUntil(a.maturityDate),
        partyName: parties.find(p => p.id === a.partyId)?.name || "Unknown"
      }))
      .filter(a => a.daysUntil !== null && a.daysUntil <= 90)
      .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0))
      .slice(0, 8);
  }, [agreements, parties]);

  const expiringDocuments = useMemo(() => {
    return documents
      .filter(d => d.expirationDate)
      .map(d => ({
        ...d,
        daysUntil: getDaysUntil(d.expirationDate),
        partyName: parties.find(p => p.id === d.partyId)?.name || "N/A"
      }))
      .filter(d => d.daysUntil !== null && d.daysUntil <= 90)
      .sort((a, b) => (a.daysUntil || 0) - (b.daysUntil || 0))
      .slice(0, 8);
  }, [documents, parties]);

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

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;
    
    const visibleOnly = widgets.filter(w => w.visible);
    const sourceWidget = visibleOnly[result.source.index];
    const destWidget = visibleOnly[result.destination.index];
    
    if (!sourceWidget || !destWidget) return;
    
    const sourceIdx = widgets.findIndex(w => w.id === sourceWidget.id);
    const destIdx = widgets.findIndex(w => w.id === destWidget.id);
    
    if (sourceIdx === -1 || destIdx === -1) return;
    
    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(sourceIdx, 1);
    items.splice(destIdx, 0, reorderedItem);
    
    setWidgets(items);
  }, [widgets]);

  const toggleWidget = useCallback((widgetId: WidgetId) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, visible: !w.visible } : w
    ));
  }, []);

  const resetLayout = useCallback(() => {
    setWidgets(DEFAULT_WIDGETS);
  }, []);

  const visibleWidgets = widgets.filter(w => w.visible);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const renderWidget = (widget: WidgetConfig, isDragging: boolean) => {
    const dragHandle = (
      <div className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
    );

    switch (widget.id) {
      case "kpis":
        return (
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
        );

      case "maturities":
        return (
          <Card data-testid="card-maturity-alerts" className={`h-full ${upcomingMaturities.some(a => (a.daysUntil || 0) <= 7) ? "border-amber-500/50" : ""}`}>
            <CardHeader className="flex flex-row items-center gap-2">
              {dragHandle}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Upcoming Maturities
                  {upcomingMaturities.length > 0 && (
                    <span className="ml-auto inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground badge-static">{upcomingMaturities.length}</span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingMaturities.length > 0 ? (
                <div className="space-y-3 max-h-[280px] overflow-y-auto">
                  {upcomingMaturities.map(agreement => (
                    <Link key={agreement.id} href={`/agreements/${agreement.id}`}>
                      <div className="flex items-center justify-between p-2 rounded-md border hover:bg-muted/50 transition-colors cursor-pointer" data-testid={`alert-maturity-${agreement.id}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{agreement.title}</p>
                          <p className="text-xs text-muted-foreground">{agreement.partyName}</p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(agreement.maturityDate!).toLocaleDateString()}
                          </span>
                          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap badge-static ${
                            agreement.daysUntil! <= 7 ? 'bg-destructive/10 text-destructive' :
                            agreement.daysUntil! <= 30 ? 'bg-amber-500/10 text-amber-700' :
                            'bg-secondary text-secondary-foreground'
                          }`}>
                            {agreement.daysUntil! < 0 ? `${Math.abs(agreement.daysUntil!)}d overdue` : 
                             agreement.daysUntil === 0 ? "Today" : `${agreement.daysUntil}d`}
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                  No maturities in the next 90 days
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "expiring_docs":
        return (
          <Card data-testid="card-expiring-docs" className={`h-full ${expiringDocuments.some(d => (d.daysUntil || 0) <= 7) ? "border-amber-500/50" : ""}`}>
            <CardHeader className="flex flex-row items-center gap-2">
              {dragHandle}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-amber-500" />
                  Expiring Documents
                  {expiringDocuments.length > 0 && (
                    <span className="ml-auto inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground badge-static">{expiringDocuments.length}</span>
                  )}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {expiringDocuments.length > 0 ? (
                <div className="space-y-3 max-h-[280px] overflow-y-auto">
                  {expiringDocuments.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-2 rounded-md border" data-testid={`alert-doc-${doc.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">{doc.category} • {doc.partyName}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(doc.expirationDate!).toLocaleDateString()}
                        </span>
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap badge-static ${
                          doc.daysUntil! <= 7 ? 'bg-destructive/10 text-destructive' :
                          doc.daysUntil! <= 30 ? 'bg-amber-500/10 text-amber-700' :
                          'bg-secondary text-secondary-foreground'
                        }`}>
                          {doc.daysUntil! < 0 ? `${Math.abs(doc.daysUntil!)}d expired` : 
                           doc.daysUntil === 0 ? "Today" : `${doc.daysUntil}d`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">
                  No documents expiring in the next 90 days
                </div>
              )}
            </CardContent>
          </Card>
        );

      case "status_chart":
        return (
          <Card data-testid="card-status-chart" className="h-full">
            <CardHeader className="flex flex-row items-center gap-2">
              {dragHandle}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Agreement Status Distribution
                </CardTitle>
              </div>
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
        );
        
      case "party_chart":
        return (
          <Card data-testid="card-party-chart" className="h-full">
            <CardHeader className="flex flex-row items-center gap-2">
              {dragHandle}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Party Type Distribution
                </CardTitle>
              </div>
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
        );

      case "agreement_types":
        return (
          <Card data-testid="card-agreement-types" className="h-full">
            <CardHeader className="flex flex-row items-center gap-2">
              {dragHandle}
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Agreements by Type
                </CardTitle>
              </div>
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
        );

      default:
        return null;
    }
  };

  const getWidgetGridClass = (widget: WidgetConfig) => {
    if (widget.id === "kpis") return "col-span-2";
    if (widget.size === "full") return "col-span-2";
    return "col-span-2 lg:col-span-1";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
          <p className="text-muted-foreground">Overview of portfolio performance and risk. Drag widgets to rearrange.</p>
        </div>
        <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" data-testid="button-dashboard-settings">
              <Settings className="h-4 w-4 mr-2" />
              Customize
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Customize Dashboard</DialogTitle>
              <DialogDescription>
                Choose which widgets to display on your dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {widgets.map(widget => (
                <div key={widget.id} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={`widget-${widget.id}`} className="text-sm font-medium">
                      {widget.title}
                    </Label>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <Switch
                    id={`widget-${widget.id}`}
                    checked={widget.visible}
                    onCheckedChange={() => toggleWidget(widget.id)}
                    data-testid={`switch-widget-${widget.id}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={resetLayout} data-testid="button-reset-layout">
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Default
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="dashboard-widgets">
          {(provided) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              className="grid grid-cols-2 gap-6"
            >
              {visibleWidgets.map((widget, index) => (
                <Draggable 
                  key={widget.id} 
                  draggableId={widget.id} 
                  index={index}
                  isDragDisabled={widget.id === "kpis"}
                >
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                      className={`${getWidgetGridClass(widget)} ${snapshot.isDragging ? "opacity-90 shadow-lg" : ""}`}
                      data-testid={`widget-${widget.id}`}
                    >
                      {renderWidget(widget, snapshot.isDragging)}
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </div>
  );
}
