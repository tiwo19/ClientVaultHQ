import { useData } from "@/lib/data";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { AlertTriangle, Gavel, Loader2, Plus, FileWarning, Scale, Clock, CheckCircle2, Shield, ArrowRight } from "lucide-react";
import type { Agreement, EnforcementCase, Engagement } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const ENFORCEMENT_COLUMNS = [
  "NeedsReview",
  "FriendlyReminder", 
  "Dunning1", 
  "Dunning2", 
  "DemandLetter", 
  "AttorneyReview", 
  "SuitFiled", 
  "Judgment", 
  "PostJudgmentCollection"
] as const;

type EnforcementStage = typeof ENFORCEMENT_COLUMNS[number];

const CASE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  monitoring: { label: "Monitoring", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Clock className="h-3 w-3" /> },
  notice_phase: { label: "Notice Phase", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <FileWarning className="h-3 w-3" /> },
  default_declared: { label: "Default Declared", color: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-3 w-3" /> },
  estoppel_established: { label: "Estoppel Established", color: "bg-red-100 text-red-800 border-red-200", icon: <Shield className="h-3 w-3" /> },
  litigation_ready: { label: "Litigation Ready", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Scale className="h-3 w-3" /> },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
};

export default function Enforcement() {
  const { agreements, parties, isLoading } = useData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newCase, setNewCase] = useState({
    engagementId: "",
    agreementId: "",
    caseNumber: "",
    governingLaw: "",
    venue: "",
    notes: ""
  });

  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
  });

  const { data: enforcementCases = [], isLoading: casesLoading } = useQuery<EnforcementCase[]>({
    queryKey: ["/api/enforcement/cases"],
  });

  const createCaseMutation = useMutation({
    mutationFn: async (caseData: typeof newCase) => {
      const res = await fetch("/api/enforcement/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(caseData),
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/enforcement/cases"] });
      setShowCreateDialog(false);
      setNewCase({ engagementId: "", agreementId: "", caseNumber: "", governingLaw: "", venue: "", notes: "" });
      toast({ title: "Enforcement case created" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const agreementsInEnforcement = useMemo(() => {
    const grouped: Record<string, Agreement[]> = {};
    ENFORCEMENT_COLUMNS.forEach(s => grouped[s] = []);
    
    agreements.forEach(a => {
      const stage = a.enforcementStage as string;
      if (a.performanceStatus === 'InDefault') {
        if (stage === 'None' || !grouped[stage]) {
          grouped["NeedsReview"].push(a);
        } else {
          grouped[stage].push(a);
        }
      } else if (stage !== 'None' && grouped[stage]) {
        grouped[stage].push(a);
      }
    });
    return grouped;
  }, [agreements]);

  const casesByStatus = useMemo(() => {
    const grouped: Record<string, EnforcementCase[]> = {};
    Object.keys(CASE_STATUS_CONFIG).forEach(s => grouped[s] = []);
    enforcementCases.forEach(c => {
      if (grouped[c.status]) {
        grouped[c.status].push(c);
      }
    });
    return grouped;
  }, [enforcementCases]);

  const getPartyName = (id: string) => parties.find(p => p.id === id)?.name || "Unknown Party";
  const getAgreementTitle = (id: string | null) => agreements.find(a => a.id === id)?.title || "No Agreement Linked";
  const getEngagementName = (id: string | null) => engagements.find((eng: Engagement) => eng.id === id)?.name || "No Engagement";
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  if (isLoading || casesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col overflow-hidden">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-8 w-8 text-destructive" />
            Enforcement & Estoppel Engine
          </h1>
          <p className="text-muted-foreground">Formal 4-tier notice ladder with notarization and court-ready evidence.</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-case">
          <Plus className="h-4 w-4 mr-2" />
          New Enforcement Case
        </Button>
      </div>

      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-lg border border-slate-700 p-4">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Scale className="h-5 w-5 text-amber-400" />
            Administrative Enforcement Cases
            <Badge variant="outline" className="ml-2 bg-amber-500/20 text-amber-300 border-amber-500/30">
              {enforcementCases.length} Active
            </Badge>
          </h2>
          
          {enforcementCases.length === 0 ? (
            <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-600 rounded-lg">
              <Scale className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No enforcement cases yet</p>
              <p className="text-sm">Create a case to begin the formal notice ladder process</p>
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Object.entries(CASE_STATUS_CONFIG).map(([status, config]) => (
                <div key={status} className="min-w-[280px] flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2 text-slate-300 text-sm font-medium">
                    {config.icon}
                    <span>{config.label}</span>
                    <Badge variant="outline" className="ml-auto bg-slate-700/50 text-slate-300 border-slate-600">
                      {casesByStatus[status]?.length || 0}
                    </Badge>
                  </div>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {casesByStatus[status]?.map(enfCase => (
                      <Link key={enfCase.id} href={`/enforcement/${enfCase.id}`}>
                        <Card className="cursor-pointer hover:border-amber-500/50 transition-colors bg-slate-800 border-slate-600" data-testid={`card-enforcement-case-${enfCase.id}`}>
                          <CardHeader className="p-3 pb-1">
                            <div className="flex items-start justify-between">
                              <Badge className={`text-[10px] ${config.color}`}>
                                {config.icon}
                                <span className="ml-1">{config.label}</span>
                              </Badge>
                            </div>
                            <CardTitle className="text-sm font-semibold text-white mt-1">
                              Case #{enfCase.caseNumber}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-3 pt-0">
                            <p className="text-xs text-slate-400 mb-1">
                              {getEngagementName(enfCase.engagementId)}
                            </p>
                            <p className="text-xs text-slate-500">
                              {enfCase.venue} • {enfCase.governingLaw}
                            </p>
                            {enfCase.currentNoticeTier && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-amber-400">
                                <FileWarning className="h-3 w-3" />
                                <span>{enfCase.currentNoticeTier.replace(/_/g, ' ')}</span>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    {(!casesByStatus[status] || casesByStatus[status].length === 0) && (
                      <div className="text-center py-4 text-xs text-slate-500 border border-dashed border-slate-600 rounded bg-slate-800/30">
                        No cases
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Agreement Enforcement Pipeline
            <Badge variant="outline" className="ml-2">Legacy View</Badge>
          </h2>
          
          <div className="flex-1 overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max h-full">
              {ENFORCEMENT_COLUMNS.map(stage => (
                <div key={stage} className="w-72 flex flex-col bg-muted/30 rounded-lg border border-border/50 h-full" data-testid={`column-${stage}`}>
                  <div className="p-2 border-b border-border/50 bg-muted/50 font-medium text-xs text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                    {stage.replace(/([A-Z])/g, ' $1').trim()}
                    <span className="bg-background text-foreground px-2 py-0.5 rounded-full text-xs border" data-testid={`count-${stage}`}>
                      {agreementsInEnforcement[stage].length}
                    </span>
                  </div>
                  
                  <div className="p-2 space-y-2 overflow-y-auto flex-1">
                    {agreementsInEnforcement[stage].map(agreement => (
                      <Link key={agreement.id} href={`/agreements/${agreement.id}`}>
                        <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-destructive" data-testid={`card-agreement-${agreement.id}`}>
                          <CardHeader className="p-2 pb-0">
                            <div className="flex justify-between items-start mb-1">
                              <Badge variant="destructive" className="text-[10px] uppercase flex items-center gap-1">
                                 <AlertTriangle className="h-3 w-3" /> Default
                              </Badge>
                            </div>
                            <CardTitle className="text-xs font-bold leading-tight text-foreground hover:underline">
                              {agreement.title}
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 pt-1">
                            <p className="text-[10px] text-muted-foreground mb-1 font-medium">
                              {getPartyName(agreement.partyId)}
                            </p>
                            <div className="text-[10px] font-medium text-destructive">
                              {formatCurrency(agreement.principalAmount || 0)}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                    
                    {agreementsInEnforcement[stage].length === 0 && (
                      <div className="text-center py-4 text-[10px] text-muted-foreground italic border border-dashed border-border rounded-md bg-muted/10">
                        Empty
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Enforcement Case</DialogTitle>
            <DialogDescription>
              Open a formal enforcement case with 4-tier notice ladder for court-ready evidence.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid gap-4">
              <div>
                <Label htmlFor="caseNumber">Case Number *</Label>
                <Input
                  id="caseNumber"
                  value={newCase.caseNumber}
                  onChange={e => setNewCase(prev => ({ ...prev, caseNumber: e.target.value }))}
                  placeholder="e.g., ENF-2024-001"
                  data-testid="input-case-number"
                />
              </div>
              
              <div>
                <Label htmlFor="engagementId">Engagement</Label>
                <Select
                  value={newCase.engagementId}
                  onValueChange={v => setNewCase(prev => ({ ...prev, engagementId: v }))}
                >
                  <SelectTrigger data-testid="select-engagement">
                    <SelectValue placeholder="Select engagement" />
                  </SelectTrigger>
                  <SelectContent>
                    {engagements.map((eng: Engagement) => (
                      <SelectItem key={eng.id} value={eng.id}>{eng.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="agreementId">Agreement</Label>
                <Select
                  value={newCase.agreementId}
                  onValueChange={v => setNewCase(prev => ({ ...prev, agreementId: v }))}
                >
                  <SelectTrigger data-testid="select-agreement">
                    <SelectValue placeholder="Select agreement" />
                  </SelectTrigger>
                  <SelectContent>
                    {agreements.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="governingLaw">Governing Law *</Label>
                  <Input
                    id="governingLaw"
                    value={newCase.governingLaw}
                    onChange={e => setNewCase(prev => ({ ...prev, governingLaw: e.target.value }))}
                    placeholder="e.g., Texas"
                    data-testid="input-governing-law"
                  />
                </div>
                <div>
                  <Label htmlFor="venue">Venue *</Label>
                  <Input
                    id="venue"
                    value={newCase.venue}
                    onChange={e => setNewCase(prev => ({ ...prev, venue: e.target.value }))}
                    placeholder="e.g., Harris County"
                    data-testid="input-venue"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newCase.notes}
                  onChange={e => setNewCase(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Initial case notes..."
                  data-testid="input-notes"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => createCaseMutation.mutate(newCase)}
              disabled={!newCase.caseNumber || !newCase.governingLaw || !newCase.venue || createCaseMutation.isPending}
              data-testid="button-submit-case"
            >
              {createCaseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
