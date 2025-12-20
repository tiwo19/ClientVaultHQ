import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { 
  ArrowLeft, Loader2, Scale, FileWarning, AlertTriangle, Clock, CheckCircle2, Shield, Send, 
  FileText, Upload, MessageSquare, Calendar, Lock, ChevronRight, Plus, Stamp, Sparkles,
  Download, Gavel, ClipboardCheck, Briefcase, TriangleAlert, ShieldAlert, AlertOctagon,
  Eye, EyeOff, Gauge, FileSearch, Package, Network, UserCheck
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import type { EnforcementCase, EnforcementNotice, EnforcementDocument, EnforcementResponse, EnforcementTimeline, EnforcementAffidavit, EvidenceExport } from "@shared/schema";

const CASE_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  monitoring: { label: "Monitoring", color: "bg-blue-100 text-blue-800 border-blue-200", icon: <Clock className="h-4 w-4" /> },
  notice_phase: { label: "Notice Phase", color: "bg-amber-100 text-amber-800 border-amber-200", icon: <FileWarning className="h-4 w-4" /> },
  default_declared: { label: "Default Declared", color: "bg-orange-100 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-4 w-4" /> },
  estoppel_established: { label: "Estoppel Established", color: "bg-red-100 text-red-800 border-red-200", icon: <Shield className="h-4 w-4" /> },
  litigation_ready: { label: "Litigation Ready", color: "bg-purple-100 text-purple-800 border-purple-200", icon: <Scale className="h-4 w-4" /> },
  resolved: { label: "Resolved", color: "bg-green-100 text-green-800 border-green-200", icon: <CheckCircle2 className="h-4 w-4" /> },
};

const TIER_CONFIG: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  tier1_administrative: { 
    name: "Administrative Notice", 
    description: "Initial formal notification of issue",
    icon: <FileText className="h-5 w-5" />
  },
  tier2_opportunity: { 
    name: "Opportunity to Cure", 
    description: "Formal opportunity to remedy default",
    icon: <Clock className="h-5 w-5" />
  },
  tier3_default: { 
    name: "Notice of Default", 
    description: "Declaration of default status",
    icon: <AlertTriangle className="h-5 w-5" />
  },
  tier4_estoppel: { 
    name: "Notice of Estoppel", 
    description: "Final notice establishing estoppel",
    icon: <Shield className="h-5 w-5" />
  },
};

const TIER_ORDER = ["tier1_administrative", "tier2_opportunity", "tier3_default", "tier4_estoppel"];

interface CaseDetailData extends EnforcementCase {
  notices: EnforcementNotice[];
  documents: EnforcementDocument[];
  responses: EnforcementResponse[];
  timeline: EnforcementTimeline[];
}

const AI_NOTICE_TYPES: Record<string, { tier: string; label: string }> = {
  notice_record: { tier: "tier1_administrative", label: "Administrative Notice of Record" },
  notice_cure: { tier: "tier2_opportunity", label: "Notice of Opportunity to Cure" },
  notice_default: { tier: "tier3_default", label: "Notice of Default and Demand" },
  notice_estoppel: { tier: "tier4_estoppel", label: "Notice of Estoppel" },
  affidavit_silence: { tier: "affidavit", label: "Affidavit of Non-Response" }
};

const THRESHOLD_CONFIG: Record<string, { label: string; color: string; bgColor: string; description: string }> = {
  none: { label: "No Indicators", color: "text-slate-600", bgColor: "bg-slate-100", description: "No fraud indicators detected" },
  watch: { label: "Watch Level", color: "text-amber-600", bgColor: "bg-amber-100", description: "Some indicators present - monitoring recommended" },
  elevated: { label: "Elevated Risk", color: "text-orange-600", bgColor: "bg-orange-100", description: "Significant indicators - review before proceeding" },
  referral_ready: { label: "Referral Ready", color: "text-red-600", bgColor: "bg-red-100", description: "Strong fraud pattern - consider law enforcement referral" }
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode }> = {
  identity: { label: "Identity", icon: <Eye className="h-4 w-4" /> },
  misrepresentation: { label: "Misrepresentation", icon: <FileSearch className="h-4 w-4" /> },
  funds_flow: { label: "Funds Flow", icon: <AlertOctagon className="h-4 w-4" /> },
  communications: { label: "Communications", icon: <MessageSquare className="h-4 w-4" /> },
  insurance: { label: "Insurance", icon: <Shield className="h-4 w-4" /> },
  regulatory: { label: "Regulatory", icon: <Scale className="h-4 w-4" /> },
  pattern: { label: "Pattern", icon: <Gauge className="h-4 w-4" /> }
};

interface FraudIndicator {
  id: string;
  code: string;
  category: string;
  description: string;
  severityWeight: number;
  legalCitations: string | null;
  requiredEvidence: string | null;
  active: boolean;
}

interface FraudFinding {
  id: string;
  fraudAssessmentId: string;
  fraudIndicatorId: string;
  confidence: "low" | "medium" | "high";
  summary: string | null;
  observedFacts: string[];
  openQuestions: string[];
  evidenceLinks: Array<{ type: string; id: string }>;
  active: boolean;
  indicator?: FraudIndicator;
}

interface FraudAssessment {
  id: string;
  enforcementCaseId: string;
  scoreTotal: number;
  thresholdLevel: "none" | "watch" | "elevated" | "referral_ready";
  lastRunAt: string | null;
}

interface FraudData {
  assessment: FraudAssessment | null;
  findings: FraudFinding[];
  indicators: FraudIndicator[];
}

// Deficiencies Panel - Missing Document Tracking
function DeficienciesPanel({ caseId }: { caseId: string }) {
  const { data: artifacts, isLoading } = useQuery({
    queryKey: [`/api/enforcement/${caseId}/artifacts`],
    enabled: !!caseId
  });

  const { data: letters } = useQuery({
    queryKey: [`/api/enforcement/${caseId}/deficiency-letters`],
    enabled: !!caseId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-500" />
            Document Deficiencies
          </CardTitle>
          <CardDescription>
            Track required documents and generate deficiency letters
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!artifacts || (artifacts as any[]).length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileWarning className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No artifact requirements tracked yet</p>
              <p className="text-sm">Add required documents to monitor deficiencies</p>
            </div>
          ) : (
            <div className="space-y-2">
              {(artifacts as any[]).map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{req.ruleId}</p>
                    <p className="text-sm text-muted-foreground">Status: {req.status}</p>
                  </div>
                  <Badge variant={req.status === "received" ? "default" : "destructive"}>
                    {req.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {letters && Array.isArray(letters) && letters.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Deficiency Letters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {letters.map((letter: any) => (
                <div key={letter.id} className="p-3 border rounded-lg">
                  <p className="font-medium">{letter.letterType}</p>
                  <p className="text-sm text-muted-foreground">Status: {letter.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// Compliance Panel - Party KYC/KYB
function CompliancePanel({ caseId, partyId }: { caseId: string; partyId: string }) {
  const hasParty = !!partyId && partyId.length > 0;

  const { data: profile, isLoading } = useQuery({
    queryKey: [`/api/parties/${partyId}/compliance`],
    enabled: hasParty
  });

  const { data: requests } = useQuery({
    queryKey: [`/api/parties/${partyId}/compliance/requests`],
    enabled: hasParty
  });

  if (!hasParty) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            Party Compliance (KYC/KYB)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No counterparty linked to this case</p>
            <p className="text-sm">Link a counterparty to enable compliance tracking</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-500" />
            Party Compliance (KYC/KYB)
          </CardTitle>
          <CardDescription>
            Identity verification and compliance status for the counterparty
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!profile ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No compliance profile created yet</p>
              <p className="text-sm">Create a KYC/KYB profile to track required information</p>
              <Button className="mt-4" variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Profile
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Profile Type:</span>
                <Badge>{(profile as any).profileType}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span>Status:</span>
                <Badge variant={(profile as any).status === "complete" ? "default" : "destructive"}>
                  {(profile as any).status}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {requests && Array.isArray(requests) && requests.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Compliance Requests</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {requests.map((req: any) => (
                <div key={req.id} className="p-3 border rounded-lg">
                  <p className="font-medium">{req.requestType}</p>
                  <p className="text-sm text-muted-foreground">Status: {req.status}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// Professionals Panel - Attorney/Paymaster Tracking
function ProfessionalsPanel({ caseId }: { caseId: string }) {
  const { data: professionals, isLoading } = useQuery({
    queryKey: [`/api/enforcement/${caseId}/professionals`],
    enabled: !!caseId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-purple-500" />
                Professional Roles
              </CardTitle>
              <CardDescription>
                Track attorneys, paymasters, escrow agents, and their required deliverables
              </CardDescription>
            </div>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Add Professional
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {(!professionals || (professionals as any[]).length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCheck className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No professional roles added yet</p>
              <p className="text-sm">Add attorneys, paymasters, or escrow agents to track accountability</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(professionals as any[]).map((prof: any) => (
                <div key={prof.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{prof.roleType.replace(/_/g, " ")}</span>
                    <Badge variant={prof.status === "active" ? "default" : "secondary"}>
                      {prof.status}
                    </Badge>
                  </div>
                  {prof.licenseId && (
                    <p className="text-sm text-muted-foreground">
                      License: {prof.licenseId} ({prof.licenseState})
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Patterns Panel - Entity Graph Pattern Detection
function PatternsPanel({ caseId }: { caseId: string }) {
  const { data: patternHits, isLoading } = useQuery({
    queryKey: [`/api/enforcement/${caseId}/patterns`],
    enabled: !!caseId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5 text-indigo-500" />
            Pattern Detection
          </CardTitle>
          <CardDescription>
            Cross-case entity matching and suspicious pattern alerts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!patternHits || (patternHits as any[]).length === 0) ? (
            <div className="text-center py-8 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No pattern matches detected</p>
              <p className="text-sm">Entities from this case will be matched against other cases automatically</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(patternHits as any[]).map((hit: any) => (
                <div key={hit.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Cluster Match</span>
                    <Badge variant={
                      hit.severity === "critical" ? "destructive" :
                      hit.severity === "elevated" ? "default" : "secondary"
                    }>
                      {hit.severity}
                    </Badge>
                  </div>
                  {hit.summary && (
                    <p className="text-sm text-muted-foreground">{hit.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Contradictions Panel - Claim vs Evidence Analysis
function ContradictionsPanel({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: [`/api/enforcement/${caseId}/contradictions`],
    enabled: !!caseId
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const contradictionSet = data ? (data as any).set : null;
  const items = data ? (data as any).items : [];

  // Thresholds: watch >= 15, elevated >= 30, critical >= 60
  const getThresholdLevel = (score: number) => {
    if (score >= 60) return { level: "critical", color: "bg-red-500" };
    if (score >= 30) return { level: "elevated", color: "bg-orange-500" };
    if (score >= 15) return { level: "watch", color: "bg-amber-500" };
    return { level: "none", color: "bg-slate-300" };
  };

  const threshold = contradictionSet ? getThresholdLevel(contradictionSet.scoreTotal) : { level: "none", color: "bg-slate-300" };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-red-500" />
            Contradictions Analysis
          </CardTitle>
          <CardDescription>
            Detect and document inconsistencies between claims and evidence
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contradictionSet && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Contradiction Score</span>
                <span className="text-lg font-bold">{contradictionSet.scoreTotal}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className={`h-3 rounded-full transition-all ${threshold.color}`}
                  style={{ width: `${Math.min((contradictionSet.scoreTotal / 60) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>Watch (15)</span>
                <span>Elevated (30)</span>
                <span>Critical (60)</span>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Scale className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No contradictions detected</p>
              <p className="text-sm">Run AI analysis to scan for inconsistencies in evidence</p>
              <Button className="mt-4" variant="outline" size="sm">
                <Sparkles className="h-4 w-4 mr-2" />
                Run AI Scan
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item: any) => (
                <div key={item.id} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">{item.title}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        item.severity === "critical" ? "destructive" :
                        item.severity === "material" ? "default" : "secondary"
                      }>
                        {item.severity}
                      </Badge>
                      <Badge variant="outline">{item.status}</Badge>
                    </div>
                  </div>
                  {item.explanation && (
                    <p className="text-sm text-muted-foreground">{item.explanation}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800">Compliance Notice</p>
              <p className="text-amber-700">
                All contradiction findings must be evidence-bound. The system never accuses or speculates—
                it only documents observed inconsistencies with exhibit references for neutral clarification requests.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FraudAnalysisPanel({ caseId }: { caseId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: fraudData, isLoading } = useQuery<FraudData>({
    queryKey: [`/api/enforcement/${caseId}/fraud`],
    enabled: !!caseId
  });

  const initMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/enforcement/${caseId}/fraud/init`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/${caseId}/fraud`] });
      toast({ title: "Fraud analysis initiated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const recalcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/enforcement/${caseId}/fraud/recalc`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/${caseId}/fraud`] });
      toast({ title: "Score recalculated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const toggleFindingMutation = useMutation({
    mutationFn: async (finding: FraudFinding) => {
      const res = await fetch(`/api/fraud/findings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: finding.id,
          fraudAssessmentId: finding.fraudAssessmentId,
          fraudIndicatorId: finding.fraudIndicatorId,
          confidence: finding.confidence,
          summary: finding.summary,
          observedFacts: finding.observedFacts,
          openQuestions: finding.openQuestions,
          evidenceLinks: finding.evidenceLinks,
          active: !finding.active
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update finding");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/${caseId}/fraud`] });
      recalcMutation.mutate();
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const generateReferralMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/enforcement/${caseId}/referral/export`, {
        method: "POST",
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/${caseId}/fraud`] });
      toast({ title: "Referral packet generated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading fraud analysis...</p>
        </CardContent>
      </Card>
    );
  }

  if (!fraudData?.assessment) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <ShieldAlert className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Fraud & Criminal Indicators Engine</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            AI-powered analysis identifies potential fraud patterns from case evidence. 
            All findings require human activation and evidence linking before affecting the case.
          </p>
          <Button 
            onClick={() => initMutation.mutate()} 
            disabled={initMutation.isPending}
            data-testid="button-init-fraud-analysis"
          >
            {initMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Sparkles className="h-4 w-4 mr-2" />
            Initialize AI Analysis
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { assessment, findings } = fraudData;
  const thresholdConfig = THRESHOLD_CONFIG[assessment.thresholdLevel];
  const activeFindings = findings.filter(f => f.active);
  const suggestedFindings = findings.filter(f => !f.active);

  const scorePercentage = Math.min((assessment.scoreTotal / 60) * 100, 100);

  return (
    <div className="space-y-6">
      <Card className={`border-2 ${thresholdConfig.bgColor}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-full ${thresholdConfig.bgColor}`}>
                <Gauge className={`h-8 w-8 ${thresholdConfig.color}`} />
              </div>
              <div>
                <CardTitle className={`text-xl ${thresholdConfig.color}`}>
                  {thresholdConfig.label}
                </CardTitle>
                <CardDescription>{thresholdConfig.description}</CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${thresholdConfig.color}`}>
                {assessment.scoreTotal}
              </div>
              <p className="text-xs text-muted-foreground">Risk Score</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-3 bg-slate-200 rounded-full overflow-hidden mb-4">
            <div 
              className={`h-full transition-all duration-500 ${
                assessment.thresholdLevel === "referral_ready" ? "bg-red-500" :
                assessment.thresholdLevel === "elevated" ? "bg-orange-500" :
                assessment.thresholdLevel === "watch" ? "bg-amber-500" : "bg-slate-400"
              }`}
              style={{ width: `${scorePercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0 - None</span>
            <span>10 - Watch</span>
            <span>25 - Elevated</span>
            <span>45+ Referral</span>
          </div>
          <div className="flex gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => recalcMutation.mutate()}
              disabled={recalcMutation.isPending}
              data-testid="button-recalc-score"
            >
              {recalcMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Recalculate Score
            </Button>
            {assessment.thresholdLevel === "referral_ready" && (
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => generateReferralMutation.mutate()}
                disabled={generateReferralMutation.isPending}
                data-testid="button-generate-referral"
              >
                {generateReferralMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Package className="h-4 w-4 mr-2" />
                Generate Referral Packet
              </Button>
            )}
          </div>
          {assessment.lastRunAt && (
            <p className="text-xs text-muted-foreground mt-2">
              Last analyzed: {new Date(assessment.lastRunAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {activeFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertOctagon className="h-5 w-5 text-red-600" />
              Active Findings ({activeFindings.length})
            </CardTitle>
            <CardDescription>
              These indicators are counting toward the risk score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeFindings.map(finding => (
                <div 
                  key={finding.id} 
                  className="flex items-start justify-between p-3 border rounded-lg bg-red-50 border-red-200"
                  data-testid={`finding-active-${finding.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {finding.indicator && CATEGORY_CONFIG[finding.indicator.category]?.icon}
                      <span className="font-medium">{finding.indicator?.code}</span>
                      <Badge variant={finding.confidence === "high" ? "destructive" : finding.confidence === "medium" ? "default" : "secondary"}>
                        {finding.confidence}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        +{finding.indicator ? finding.indicator.severityWeight * (finding.confidence === "high" ? 3 : finding.confidence === "medium" ? 2 : 1) : 0} pts
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{finding.indicator?.description}</p>
                    {finding.summary && (
                      <p className="text-sm mt-1 italic">"{finding.summary}"</p>
                    )}
                    {finding.evidenceLinks.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {finding.evidenceLinks.length} evidence link(s)
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleFindingMutation.mutate(finding)}
                    disabled={toggleFindingMutation.isPending}
                    data-testid={`button-deactivate-${finding.id}`}
                  >
                    <EyeOff className="h-4 w-4 mr-1" />
                    Deactivate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {suggestedFindings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-amber-600" />
              AI Suggestions ({suggestedFindings.length})
            </CardTitle>
            <CardDescription>
              Potential indicators identified by AI - activate with evidence to count toward score
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestedFindings.map(finding => (
                <div 
                  key={finding.id} 
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-slate-50"
                  data-testid={`finding-suggested-${finding.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {finding.indicator && CATEGORY_CONFIG[finding.indicator.category]?.icon}
                      <span className="font-medium">{finding.indicator?.code}</span>
                      <Badge variant="outline">{finding.confidence}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{finding.indicator?.description}</p>
                    {finding.summary && (
                      <p className="text-sm mt-1 italic">"{finding.summary}"</p>
                    )}
                    {finding.openQuestions.length > 0 && (
                      <div className="mt-2 text-xs">
                        <span className="font-medium">Open Questions:</span>
                        <ul className="list-disc list-inside text-muted-foreground">
                          {finding.openQuestions.slice(0, 2).map((q, i) => (
                            <li key={i}>{q}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (finding.evidenceLinks.length === 0) {
                        toast({ 
                          title: "Evidence Required", 
                          description: "Link evidence documents before activating this finding",
                          variant: "destructive"
                        });
                        return;
                      }
                      toggleFindingMutation.mutate(finding);
                    }}
                    disabled={toggleFindingMutation.isPending}
                    data-testid={`button-activate-${finding.id}`}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Activate
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-slate-50">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-slate-600">Important Notice</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>This system does not accuse anyone of fraud.</strong> It identifies patterns 
            in case evidence that may warrant further investigation by qualified professionals.
          </p>
          <p>
            All AI suggestions are advisory only and require human review and activation. 
            Findings cannot be activated without linking to specific evidence documents.
          </p>
          <p>
            Referral packets are prepared for law enforcement review only and do not constitute 
            legal findings or accusations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EnforcementCaseDetail() {
  const [, params] = useRoute("/enforcement/:id");
  const caseId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showNoticeDialog, setShowNoticeDialog] = useState(false);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);
  const [showEstoppelConfirm, setShowEstoppelConfirm] = useState(false);
  const [confirmJustification, setConfirmJustification] = useState("");
  const [showFraudGate, setShowFraudGate] = useState<"default" | "estoppel" | null>(null);
  const [newNotice, setNewNotice] = useState({
    title: "",
    content: "",
    responseDeadlineDays: 15,
    responseDeadlineDate: "",
    deliveryMethod: "certified_mail",
    recipientAddress: ""
  });

  const { data: caseData, isLoading } = useQuery<CaseDetailData>({
    queryKey: [`/api/enforcement/cases/${caseId}`],
    enabled: !!caseId
  });

  const { data: fraudData, isLoading: isFraudLoading } = useQuery<FraudData>({
    queryKey: [`/api/enforcement/${caseId}/fraud`],
    enabled: !!caseId
  });

  const hasFraudGate = fraudData?.assessment && 
    (fraudData.assessment.thresholdLevel === "elevated" || 
     fraudData.assessment.thresholdLevel === "referral_ready");
  
  const isGateCheckPending = isFraudLoading;

  const handleDeclareDefaultClick = () => {
    if (hasFraudGate) {
      setShowFraudGate("default");
    } else {
      setShowDefaultConfirm(true);
    }
  };

  const handleEstoppelClick = () => {
    if (hasFraudGate) {
      setShowFraudGate("estoppel");
    } else {
      setShowEstoppelConfirm(true);
    }
  };

  const createNoticeMutation = useMutation({
    mutationFn: async (data: typeof newNotice & { tier: string }) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}/notices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      setShowNoticeDialog(false);
      setNewNotice({
        title: "",
        content: "",
        responseDeadlineDays: 15,
        responseDeadlineDate: "",
        deliveryMethod: "certified_mail",
        recipientAddress: ""
      });
      toast({ title: "Notice created successfully" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateNoticeMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<EnforcementNotice> }) => {
      const res = await fetch(`/api/enforcement/notices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      toast({ title: "Notice updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateCaseStatusMutation = useMutation({
    mutationFn: async (newStatus: string) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      toast({ title: "Case status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const generateAINoticeMutation = useMutation({
    mutationFn: async ({ noticeType, deadlineDays }: { noticeType: string; deadlineDays: number }) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeType, deadlineDays }),
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "AI generation failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      setShowNoticeDialog(false);
      toast({ 
        title: data.type === "affidavit" ? "Affidavit Generated" : "Notice Generated",
        description: "AI has generated the document based on case records"
      });
    },
    onError: (err: Error) => {
      toast({ title: "AI Generation Error", description: err.message, variant: "destructive" });
    }
  });

  const declareDefaultMutation = useMutation({
    mutationFn: async (justification: string) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}/declare-default`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, justification }),
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to declare default");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      setShowDefaultConfirm(false);
      setConfirmJustification("");
      toast({ title: "Default Declared", description: "Case status updated to Default Declared" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const establishEstoppelMutation = useMutation({
    mutationFn: async (justification: string) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}/establish-estoppel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true, justification }),
        credentials: "include"
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to establish estoppel");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      setShowEstoppelConfirm(false);
      setConfirmJustification("");
      toast({ title: "Estoppel Established", description: "Case status updated to Estoppel Established" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const requestExportMutation = useMutation({
    mutationFn: async (exportType: string) => {
      const res = await fetch(`/api/enforcement/cases/${caseId}/exports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exportType }),
        credentials: "include"
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/enforcement/cases/${caseId}`] });
      toast({ title: "Export Requested", description: "Evidence binder export is being prepared" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Enforcement case not found</p>
        <Link href="/enforcement">
          <Button variant="link">Return to Enforcement</Button>
        </Link>
      </div>
    );
  }

  const statusConfig = CASE_STATUS_CONFIG[caseData.status] || CASE_STATUS_CONFIG.monitoring;
  
  const getNextTier = () => {
    const existingTiers = caseData.notices.map(n => n.tier);
    for (const tier of TIER_ORDER) {
      if (!existingTiers.includes(tier)) return tier;
    }
    return null;
  };

  const nextTier = getNextTier();

  const openNoticeDialog = (tier: string) => {
    setSelectedTier(tier);
    const tierConfig = TIER_CONFIG[tier];
    setNewNotice(prev => ({
      ...prev,
      title: tierConfig?.name || tier,
      responseDeadlineDate: new Date(Date.now() + prev.responseDeadlineDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    }));
    setShowNoticeDialog(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/enforcement">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Enforcement
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Scale className="h-8 w-8 text-amber-500" />
            Case #{caseData.caseNumber}
          </h1>
          <p className="text-muted-foreground mt-1">
            {caseData.venue} • {caseData.governingLaw} Law
          </p>
        </div>
        <Badge className={`text-sm px-3 py-1 ${statusConfig.color}`}>
          {statusConfig.icon}
          <span className="ml-2">{statusConfig.label}</span>
        </Badge>
      </div>

      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-slate-700 text-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-400" />
            4-Tier Notice Ladder
          </CardTitle>
          <CardDescription className="text-slate-400">
            Formal escalation sequence for administrative enforcement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {TIER_ORDER.map((tier, index) => {
              const tierConfig = TIER_CONFIG[tier];
              const notice = caseData.notices.find(n => n.tier === tier);
              const isComplete = !!notice;
              const isCurrent = tier === nextTier;
              const isLocked = notice?.isLocked;

              return (
                <div key={tier} className="flex items-center flex-1">
                  <div 
                    className={`flex-1 p-3 rounded-lg border transition-all ${
                      isComplete 
                        ? isLocked 
                          ? "bg-green-900/30 border-green-500/50" 
                          : "bg-amber-900/30 border-amber-500/50"
                        : isCurrent 
                          ? "bg-slate-700 border-amber-400 border-dashed" 
                          : "bg-slate-800/50 border-slate-600 opacity-50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {isComplete ? (
                        isLocked ? <Lock className="h-4 w-4 text-green-400" /> : <CheckCircle2 className="h-4 w-4 text-amber-400" />
                      ) : (
                        <div className={`h-4 w-4 rounded-full border-2 ${isCurrent ? "border-amber-400" : "border-slate-500"}`} />
                      )}
                      <span className={`text-xs font-medium ${isComplete ? "text-white" : "text-slate-400"}`}>
                        Tier {index + 1}
                      </span>
                    </div>
                    <p className={`text-sm font-semibold ${isComplete ? "text-white" : "text-slate-400"}`}>
                      {tierConfig.name}
                    </p>
                    {notice && (
                      <div className="mt-2 text-xs text-slate-400">
                        <p>Status: <Badge variant="outline" className="text-[10px] ml-1">{notice.status}</Badge></p>
                        {notice.responseDeadlineDate && (
                          <p className="mt-1">Deadline: {notice.responseDeadlineDate}</p>
                        )}
                      </div>
                    )}
                    {isCurrent && !isComplete && (
                      <Button 
                        size="sm" 
                        className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-black"
                        onClick={() => openNoticeDialog(tier)}
                        data-testid={`button-create-notice-${tier}`}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Create Notice
                      </Button>
                    )}
                  </div>
                  {index < TIER_ORDER.length - 1 && (
                    <ChevronRight className="h-5 w-5 text-slate-600 mx-1 flex-shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2 mb-4">
        {caseData.status === "notice_phase" && (
          <Button 
            variant="destructive" 
            onClick={handleDeclareDefaultClick}
            disabled={isGateCheckPending}
            data-testid="button-declare-default"
          >
            {isGateCheckPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Gavel className="h-4 w-4 mr-2" />
            )}
            Declare Default
            {hasFraudGate && <ShieldAlert className="h-4 w-4 ml-2 text-amber-300" />}
          </Button>
        )}
        {caseData.status === "default_declared" && (
          <Button 
            variant="destructive" 
            onClick={handleEstoppelClick}
            disabled={isGateCheckPending}
            data-testid="button-establish-estoppel"
          >
            {isGateCheckPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Establish Estoppel
            {hasFraudGate && <ShieldAlert className="h-4 w-4 ml-2 text-amber-300" />}
          </Button>
        )}
      </div>

      <Tabs defaultValue="notices" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 w-full">
          <TabsTrigger value="notices" data-testid="tab-notices">
            Notices ({caseData.notices.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            Evidence ({caseData.documents.length})
          </TabsTrigger>
          <TabsTrigger value="responses" data-testid="tab-responses">
            Responses ({caseData.responses.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="deficiencies" data-testid="tab-deficiencies" className="flex items-center gap-1">
            <FileWarning className="h-4 w-4" />
            Deficiencies
          </TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance" className="flex items-center gap-1">
            <ClipboardCheck className="h-4 w-4" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="professionals" data-testid="tab-professionals" className="flex items-center gap-1">
            <UserCheck className="h-4 w-4" />
            Professionals
          </TabsTrigger>
          <TabsTrigger value="patterns" data-testid="tab-patterns" className="flex items-center gap-1">
            <Network className="h-4 w-4" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="contradictions" data-testid="tab-contradictions" className="flex items-center gap-1">
            <Scale className="h-4 w-4" />
            Contradictions
          </TabsTrigger>
          <TabsTrigger value="fraud" data-testid="tab-fraud" className="flex items-center gap-1">
            <ShieldAlert className="h-4 w-4" />
            Fraud
          </TabsTrigger>
          <TabsTrigger value="court-path" data-testid="tab-court-path">
            Court Path
          </TabsTrigger>
          <TabsTrigger value="exports" data-testid="tab-exports">
            Exports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="notices" className="mt-4">
          <div className="space-y-4">
            {caseData.notices.length === 0 ? (
              <Card className="text-center py-8">
                <CardContent>
                  <FileWarning className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No notices created yet</p>
                  <p className="text-sm text-muted-foreground">Start with Tier 1: Administrative Notice</p>
                </CardContent>
              </Card>
            ) : (
              caseData.notices.map(notice => (
                <Card key={notice.id} className={notice.isLocked ? "border-green-500/50" : ""} data-testid={`notice-${notice.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          {TIER_CONFIG[notice.tier]?.icon}
                          {notice.title}
                          {notice.isLocked && <Lock className="h-4 w-4 text-green-500" />}
                        </CardTitle>
                        <CardDescription>
                          {TIER_CONFIG[notice.tier]?.name} • Created {new Date(notice.createdAt).toLocaleDateString()}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{notice.status}</Badge>
                        {notice.notarizedAt && (
                          <Badge className="bg-purple-100 text-purple-800">
                            <Stamp className="h-3 w-3 mr-1" />
                            Notarized
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {notice.content && (
                      <p className="text-sm text-muted-foreground mb-4 whitespace-pre-wrap">{notice.content}</p>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Delivery Method</p>
                        <p className="font-medium">{notice.deliveryMethod || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Response Deadline</p>
                        <p className="font-medium">{notice.responseDeadlineDate || "Not set"}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Sent At</p>
                        <p className="font-medium">
                          {notice.deliverySentAt ? new Date(notice.deliverySentAt).toLocaleDateString() : "Not sent"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Delivery Confirmed</p>
                        <p className="font-medium">
                          {notice.deliveryConfirmedAt ? new Date(notice.deliveryConfirmedAt).toLocaleDateString() : "Pending"}
                        </p>
                      </div>
                    </div>
                    
                    {!notice.isLocked && (
                      <div className="flex gap-2 mt-4 pt-4 border-t">
                        {notice.status === "draft" && (
                          <Button 
                            size="sm" 
                            onClick={() => updateNoticeMutation.mutate({ id: notice.id, updates: { status: "sent" } })}
                            data-testid={`button-send-notice-${notice.id}`}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Mark as Sent
                          </Button>
                        )}
                        {!notice.notarizedAt && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => updateNoticeMutation.mutate({ 
                              id: notice.id, 
                              updates: { notarizedAt: new Date() } 
                            })}
                            data-testid={`button-notarize-${notice.id}`}
                          >
                            <Stamp className="h-4 w-4 mr-2" />
                            Mark Notarized
                          </Button>
                        )}
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => updateNoticeMutation.mutate({ id: notice.id, updates: { isLocked: true } })}
                          data-testid={`button-lock-notice-${notice.id}`}
                        >
                          <Lock className="h-4 w-4 mr-2" />
                          Lock for Evidence
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Evidence Documents</CardTitle>
              <CardDescription>Supporting documents for court-ready evidence package</CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.documents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No evidence documents uploaded yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {caseData.documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`document-${doc.id}`}>
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">{doc.category} • {doc.type}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {doc.isLocked && <Lock className="h-4 w-4 text-green-500" />}
                        <Badge variant="outline">{doc.category}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="responses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Counterparty Responses</CardTitle>
              <CardDescription>Documented responses from the counterparty</CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.responses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No responses recorded</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {caseData.responses.map(response => (
                    <div key={response.id} className="p-4 border rounded-lg" data-testid={`response-${response.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="font-medium">Response via {response.receivedVia}</p>
                          <p className="text-sm text-muted-foreground">
                            Received: {new Date(response.receivedAt).toLocaleString()}
                          </p>
                        </div>
                        {response.classification && (
                          <Badge variant="outline">{response.classification}</Badge>
                        )}
                      </div>
                      {response.summary && (
                        <p className="text-sm mt-2">{response.summary}</p>
                      )}
                      {response.sufficiency && (
                        <Badge className="mt-2" variant={response.sufficiency === "sufficient" ? "default" : "secondary"}>
                          {response.sufficiency}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Case Timeline</CardTitle>
              <CardDescription>Complete audit trail of all case events</CardDescription>
            </CardHeader>
            <CardContent>
              {caseData.timeline.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No timeline events yet</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-4">
                    {caseData.timeline.map(event => (
                      <div key={event.id} className="relative pl-10" data-testid={`timeline-${event.id}`}>
                        <div className="absolute left-2 w-4 h-4 bg-background border-2 border-primary rounded-full" />
                        <div className="p-3 border rounded-lg bg-muted/30">
                          <div className="flex items-center justify-between mb-1">
                            <Badge variant="outline" className="text-xs">{event.eventType}</Badge>
                            <span className="text-xs text-muted-foreground">
                              {new Date(event.occurredAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="court-path" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Briefcase className="h-5 w-5" />
                  Small Claims Packet
                </CardTitle>
                <CardDescription>Documents needed for small claims court filing</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Original Agreement/Contract", check: !!caseData.agreementId },
                    { label: "Administrative Notice (Tier 1)", check: caseData.notices.some(n => n.tier === "tier1_administrative" && n.status === "sent") },
                    { label: "Opportunity to Cure Notice (Tier 2)", check: caseData.notices.some(n => n.tier === "tier2_opportunity" && n.status === "sent") },
                    { label: "Notice of Default (Tier 3)", check: caseData.notices.some(n => n.tier === "tier3_default" && n.status === "sent") },
                    { label: "Delivery Proof for Each Notice", check: caseData.notices.filter(n => n.deliveryConfirmedAt).length >= 2 },
                    { label: "Affidavit of Non-Response", check: caseData.status === "estoppel_established" || caseData.status === "litigation_ready" },
                    { label: "Payment/Performance Ledger", check: caseData.documents.some(d => d.category === "payment_ledger") }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border">
                      {item.check ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                      )}
                      <span className={item.check ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Scale className="h-5 w-5" />
                  Circuit Court Packet
                </CardTitle>
                <CardDescription>Full litigation package for circuit court</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "All Small Claims Items", check: caseData.notices.filter(n => n.status === "sent").length >= 3 },
                    { label: "Notice of Estoppel (Tier 4)", check: caseData.notices.some(n => n.tier === "tier4_estoppel" && n.status === "sent") },
                    { label: "Estoppel Status Established", check: caseData.status === "estoppel_established" || caseData.status === "litigation_ready" },
                    { label: "Sworn Affidavit Notarized", check: caseData.status === "litigation_ready" },
                    { label: "Evidence Record Locked", check: caseData.evidenceLock },
                    { label: "Complete Chronology Export", check: false },
                    { label: "SHA-256 Hashed Evidence Bundle", check: false }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded border">
                      {item.check ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted flex-shrink-0" />
                      )}
                      <span className={item.check ? "text-foreground" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Readiness Checklist
                </CardTitle>
                <CardDescription>Administrative readiness indicators for enforcement</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {[
                    { label: "Counterparty Address Verified", check: !!caseData.counterpartyId },
                    { label: "Governing Law Identified", check: !!caseData.governingLaw },
                    { label: "Venue/Court Identified", check: !!caseData.venue },
                    { label: "All Notices Delivered with Proof", check: caseData.notices.filter(n => n.deliveryConfirmedAt).length === caseData.notices.length && caseData.notices.length > 0 },
                    { label: "Response Deadline Expired", check: caseData.status !== "monitoring" },
                    { label: "Affidavit Generated", check: caseData.status === "estoppel_established" || caseData.status === "litigation_ready" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded border bg-muted/30">
                      {item.check ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                      ) : (
                        <TriangleAlert className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      )}
                      <span className="text-sm">{item.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="exports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5" />
                Evidence Binder Exports
              </CardTitle>
              <CardDescription>Generate court-ready evidence packages with SHA-256 hashes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 mb-6">
                <Button 
                  onClick={() => requestExportMutation.mutate("small_claims")}
                  disabled={requestExportMutation.isPending}
                  className="h-auto py-4 flex-col"
                  data-testid="button-export-small-claims"
                >
                  <Briefcase className="h-6 w-6 mb-2" />
                  <span>Small Claims Package</span>
                </Button>
                <Button 
                  onClick={() => requestExportMutation.mutate("circuit_court")}
                  disabled={requestExportMutation.isPending}
                  className="h-auto py-4 flex-col"
                  data-testid="button-export-circuit-court"
                >
                  <Scale className="h-6 w-6 mb-2" />
                  <span>Circuit Court Package</span>
                </Button>
                <Button 
                  onClick={() => requestExportMutation.mutate("full")}
                  disabled={requestExportMutation.isPending}
                  variant="outline"
                  className="h-auto py-4 flex-col"
                  data-testid="button-export-full"
                >
                  <Download className="h-6 w-6 mb-2" />
                  <span>Full Evidence Bundle</span>
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                <p>Export packages include PDF chronology, CSV timeline, and ZIP of all evidence documents.</p>
                <p className="mt-1">All files are SHA-256 hashed for integrity verification.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deficiencies" className="mt-4">
          <DeficienciesPanel caseId={caseId!} />
        </TabsContent>

        <TabsContent value="compliance" className="mt-4">
          <CompliancePanel caseId={caseId!} partyId={caseData.counterpartyId || ""} />
        </TabsContent>

        <TabsContent value="professionals" className="mt-4">
          <ProfessionalsPanel caseId={caseId!} />
        </TabsContent>

        <TabsContent value="patterns" className="mt-4">
          <PatternsPanel caseId={caseId!} />
        </TabsContent>

        <TabsContent value="contradictions" className="mt-4">
          <ContradictionsPanel caseId={caseId!} />
        </TabsContent>

        <TabsContent value="fraud" className="mt-4">
          <FraudAnalysisPanel caseId={caseId!} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={showDefaultConfirm} onOpenChange={setShowDefaultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Gavel className="h-5 w-5" />
              Declare Default
            </AlertDialogTitle>
            <AlertDialogDescription>
              This is a significant administrative action. By declaring default, you are formally establishing that the counterparty has failed to perform their obligations under the agreement despite proper notice and opportunity to cure.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="justification">Justification (optional)</Label>
            <Textarea
              id="justification"
              value={confirmJustification}
              onChange={e => setConfirmJustification(e.target.value)}
              placeholder="Enter any notes or justification for this declaration..."
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => declareDefaultMutation.mutate(confirmJustification)}
              className="bg-red-600 hover:bg-red-700"
              disabled={declareDefaultMutation.isPending}
            >
              {declareDefaultMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Default Declaration
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEstoppelConfirm} onOpenChange={setShowEstoppelConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Establish Estoppel
            </AlertDialogTitle>
            <AlertDialogDescription>
              By establishing estoppel, you are formally determining that the counterparty is estopped from denying or disputing the matters set forth in the administrative notices due to their silence and non-response.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="estoppel-justification">Justification (optional)</Label>
            <Textarea
              id="estoppel-justification"
              value={confirmJustification}
              onChange={e => setConfirmJustification(e.target.value)}
              placeholder="Enter any notes or justification..."
              rows={3}
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => establishEstoppelMutation.mutate(confirmJustification)}
              className="bg-red-600 hover:bg-red-700"
              disabled={establishEstoppelMutation.isPending}
            >
              {establishEstoppelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Estoppel Establishment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showFraudGate !== null} onOpenChange={() => setShowFraudGate(null)}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <ShieldAlert className="h-5 w-5" />
              Fraud Indicators Detected
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                This case has <strong className={fraudData?.assessment?.thresholdLevel === "referral_ready" ? "text-red-600" : "text-orange-600"}>
                  {fraudData?.assessment?.thresholdLevel === "referral_ready" ? "Referral Ready" : "Elevated"}
                </strong> fraud indicator status with a score of <strong>{fraudData?.assessment?.scoreTotal || 0}</strong>.
              </p>
              <p>
                Before proceeding with <strong>{showFraudGate === "default" ? "Default Declaration" : "Estoppel Establishment"}</strong>, 
                please review the Fraud tab to ensure you have considered all potential fraud patterns identified in this case.
              </p>
              {fraudData?.assessment?.thresholdLevel === "referral_ready" && (
                <p className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                  <strong>Important:</strong> At this threshold level, you may want to consider generating a Law Enforcement Referral Packet 
                  before proceeding with formal enforcement actions.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => setShowFraudGate(null)}>
              Go Back
            </AlertDialogCancel>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowFraudGate(null);
              }}
              data-testid="button-review-fraud"
            >
              <Eye className="h-4 w-4 mr-2" />
              Review Fraud Tab
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (showFraudGate === "default") {
                  setShowFraudGate(null);
                  setShowDefaultConfirm(true);
                } else if (showFraudGate === "estoppel") {
                  setShowFraudGate(null);
                  setShowEstoppelConfirm(true);
                }
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Acknowledge & Proceed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showNoticeDialog} onOpenChange={setShowNoticeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTier && TIER_CONFIG[selectedTier]?.icon}
              Create {selectedTier && TIER_CONFIG[selectedTier]?.name}
            </DialogTitle>
            <DialogDescription>
              {selectedTier && TIER_CONFIG[selectedTier]?.description}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="noticeTitle">Notice Title *</Label>
              <Input
                id="noticeTitle"
                value={newNotice.title}
                onChange={e => setNewNotice(prev => ({ ...prev, title: e.target.value }))}
                data-testid="input-notice-title"
              />
            </div>
            
            <div>
              <Label htmlFor="noticeContent">Notice Content</Label>
              <Textarea
                id="noticeContent"
                value={newNotice.content}
                onChange={e => setNewNotice(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                placeholder="Enter the notice text..."
                data-testid="input-notice-content"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deliveryMethod">Delivery Method</Label>
                <Select
                  value={newNotice.deliveryMethod}
                  onValueChange={v => setNewNotice(prev => ({ ...prev, deliveryMethod: v }))}
                >
                  <SelectTrigger data-testid="select-delivery-method">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="certified_mail">Certified Mail</SelectItem>
                    <SelectItem value="registered_mail">Registered Mail</SelectItem>
                    <SelectItem value="courier">Courier/Process Server</SelectItem>
                    <SelectItem value="email">Email (with confirmation)</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="responseDeadlineDays">Response Days</Label>
                <Input
                  id="responseDeadlineDays"
                  type="number"
                  value={newNotice.responseDeadlineDays}
                  onChange={e => {
                    const days = parseInt(e.target.value) || 15;
                    setNewNotice(prev => ({ 
                      ...prev, 
                      responseDeadlineDays: days,
                      responseDeadlineDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    }));
                  }}
                  data-testid="input-deadline-days"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="responseDeadlineDate">Response Deadline Date</Label>
              <Input
                id="responseDeadlineDate"
                type="date"
                value={newNotice.responseDeadlineDate}
                onChange={e => setNewNotice(prev => ({ ...prev, responseDeadlineDate: e.target.value }))}
                data-testid="input-deadline-date"
              />
            </div>

            <div>
              <Label htmlFor="recipientAddress">Recipient Address</Label>
              <Textarea
                id="recipientAddress"
                value={newNotice.recipientAddress}
                onChange={e => setNewNotice(prev => ({ ...prev, recipientAddress: e.target.value }))}
                rows={2}
                placeholder="Full mailing address..."
                data-testid="input-recipient-address"
              />
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowNoticeDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="secondary"
              onClick={() => {
                if (selectedTier) {
                  const noticeTypeMap: Record<string, string> = {
                    tier1_administrative: "notice_record",
                    tier2_opportunity: "notice_cure",
                    tier3_default: "notice_default",
                    tier4_estoppel: "notice_estoppel"
                  };
                  const noticeType = noticeTypeMap[selectedTier];
                  if (noticeType) {
                    generateAINoticeMutation.mutate({ 
                      noticeType, 
                      deadlineDays: newNotice.responseDeadlineDays 
                    });
                  }
                }
              }}
              disabled={generateAINoticeMutation.isPending}
              data-testid="button-generate-ai-notice"
            >
              {generateAINoticeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="h-4 w-4 mr-2" />
              )}
              Generate with AI
            </Button>
            <Button 
              onClick={() => {
                if (selectedTier) {
                  createNoticeMutation.mutate({ ...newNotice, tier: selectedTier });
                }
              }}
              disabled={!newNotice.title || createNoticeMutation.isPending}
              data-testid="button-submit-notice"
            >
              {createNoticeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create Manually
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
