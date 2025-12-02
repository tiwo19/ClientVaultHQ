import { agreements, parties, Agreement, PerformanceStatus } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useMemo } from "react";

const STATUS_COLUMNS: PerformanceStatus[] = [
  "Draft", 
  "Sent", 
  "Executed", 
  "Performing", 
  "InGracePeriod", 
  "InDefault", 
  "Settled"
];

export default function Agreements() {
  const agreementsByStatus = useMemo(() => {
    const grouped: Record<string, Agreement[]> = {};
    STATUS_COLUMNS.forEach(s => grouped[s] = []);
    
    agreements.forEach(a => {
      // Only include active pipeline statuses, or if it's relevant here
      if (grouped[a.performanceStatus]) {
        grouped[a.performanceStatus].push(a);
      }
    });
    return grouped;
  }, []);

  const getPartyName = (id: string) => parties.find(p => p.id === id)?.name || "Unknown Party";
  
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agreements</h1>
          <p className="text-muted-foreground">Active deal flow and portfolio management.</p>
        </div>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors">
          New Agreement
        </button>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {STATUS_COLUMNS.map(status => (
            <div key={status} className="w-80 flex flex-col bg-muted/30 rounded-lg border border-border/50 h-full">
              <div className="p-3 border-b border-border/50 bg-muted/50 font-medium text-sm text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                {status.replace(/([A-Z])/g, ' $1').trim()}
                <span className="bg-background text-foreground px-2 py-0.5 rounded-full text-xs border">
                  {agreementsByStatus[status].length}
                </span>
              </div>
              
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {agreementsByStatus[status].map(agreement => (
                  <Link key={agreement.id} href={`/agreements/${agreement.id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary">
                      <CardHeader className="p-3 pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="outline" className="text-[10px] uppercase">{agreement.type}</Badge>
                          {agreement.isSecured && <Badge variant="secondary" className="text-[10px]">Secured</Badge>}
                        </div>
                        <CardTitle className="text-sm font-bold leading-tight text-primary hover:underline">
                          {agreement.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          {getPartyName(agreement.partyId)}
                        </p>
                        <div className="flex justify-between items-center text-xs text-foreground/80 border-t pt-2 mt-2">
                          <span className="font-mono font-semibold">{formatCurrency(agreement.principalAmount)}</span>
                          <span className="text-muted-foreground">{new Date(agreement.effectiveDate).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                
                {agreementsByStatus[status].length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground italic border-2 border-dashed border-border rounded-md">
                    No agreements
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
