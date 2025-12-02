import { agreements, parties, Agreement, EnforcementStage } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useMemo } from "react";
import { AlertTriangle, Gavel } from "lucide-react";

const ENFORCEMENT_COLUMNS: EnforcementStage[] = [
  "FriendlyReminder", 
  "Dunning1", 
  "Dunning2", 
  "DemandLetter", 
  "AttorneyReview", 
  "SuitFiled", 
  "Judgment", 
  "PostJudgmentCollection"
];

export default function Enforcement() {
  const agreementsInEnforcement = useMemo(() => {
    const grouped: Record<string, Agreement[]> = {};
    ENFORCEMENT_COLUMNS.forEach(s => grouped[s] = []);
    
    agreements.forEach(a => {
      // Include if in default or has an enforcement stage set (and not None)
      if ((a.performanceStatus === 'InDefault' || a.enforcementStage !== 'None') && grouped[a.enforcementStage]) {
        grouped[a.enforcementStage].push(a);
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
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-8 w-8 text-destructive" />
            Enforcement
          </h1>
          <p className="text-muted-foreground">Collections, litigation, and recovery pipeline.</p>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max h-full">
          {ENFORCEMENT_COLUMNS.map(stage => (
            <div key={stage} className="w-80 flex flex-col bg-muted/30 rounded-lg border border-border/50 h-full">
              <div className="p-3 border-b border-border/50 bg-muted/50 font-medium text-sm text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                {stage.replace(/([A-Z])/g, ' $1').trim()}
                <span className="bg-background text-foreground px-2 py-0.5 rounded-full text-xs border">
                  {agreementsInEnforcement[stage].length}
                </span>
              </div>
              
              <div className="p-3 space-y-3 overflow-y-auto flex-1">
                {agreementsInEnforcement[stage].map(agreement => (
                  <Link key={agreement.id} href={`/agreements/${agreement.id}`}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive">
                      <CardHeader className="p-3 pb-0">
                        <div className="flex justify-between items-start mb-1">
                          <Badge variant="destructive" className="text-[10px] uppercase flex items-center gap-1">
                             <AlertTriangle className="h-3 w-3" /> Default
                          </Badge>
                          {agreement.isPersonalGuarantee && <Badge variant="outline" className="text-[10px]">PG Signed</Badge>}
                        </div>
                        <CardTitle className="text-sm font-bold leading-tight text-foreground hover:underline">
                          {agreement.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-3 pt-2">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          {getPartyName(agreement.partyId)}
                        </p>
                        <div className="bg-destructive/5 p-2 rounded border border-destructive/10">
                           <div className="flex justify-between text-xs font-medium text-destructive mb-1">
                             <span>Outstanding</span>
                             <span>{formatCurrency(agreement.principalAmount)}</span>
                           </div>
                           <div className="text-[10px] text-destructive/80">
                             Owner: {agreement.internalOwner}
                           </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
                
                {agreementsInEnforcement[stage].length === 0 && (
                  <div className="text-center py-8 text-xs text-muted-foreground italic border-2 border-dashed border-border rounded-md bg-muted/10">
                    Nothing in {stage.replace(/([A-Z])/g, ' $1').toLowerCase()}
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
