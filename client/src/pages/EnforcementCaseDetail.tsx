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
  Download, Gavel, ClipboardCheck, Briefcase, TriangleAlert
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
            onClick={() => setShowDefaultConfirm(true)}
            data-testid="button-declare-default"
          >
            <Gavel className="h-4 w-4 mr-2" />
            Declare Default
          </Button>
        )}
        {caseData.status === "default_declared" && (
          <Button 
            variant="destructive" 
            onClick={() => setShowEstoppelConfirm(true)}
            data-testid="button-establish-estoppel"
          >
            <Shield className="h-4 w-4 mr-2" />
            Establish Estoppel
          </Button>
        )}
      </div>

      <Tabs defaultValue="notices" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
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
