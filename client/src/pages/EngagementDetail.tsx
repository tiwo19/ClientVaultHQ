import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Save, Users, Building2, FileText, Briefcase, Plus, Trash2, Loader2, Calendar, Shield, Clock, MessageSquare, Phone, Mail, FileUp, AlertCircle, Download, File, History, CheckSquare, Circle, CheckCircle2 } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { uploadEngagementDocument, deleteEngagementDocument, getDocumentDownloadUrl, fetchDocumentVersions, uploadDocumentVersion } from "@/lib/api";
import type { Engagement, Party, Agreement, User, Activity, activityTypes, Document, Task } from "@shared/schema";
import { documentCategories, taskPriorities, taskStatuses } from "@shared/schema";

const userActivityTypes = ["Call", "Email", "LetterSent", "InternalNote", "Meeting", "CourtFiling"] as const;

const engagementTypes = ["Contract", "Loan", "JointVenture", "VendorAgreement", "Dispute", "Collection", "Litigation", "Advisory", "Other"] as const;
const engagementStatuses = ["Active", "OnHold", "Closed", "Archived"] as const;
const engagementRoles = ["owner", "internal_admin", "internal_user", "external_partner", "viewer", "auditor"] as const;

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  OnHold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  Closed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  Archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
};

const roleLabels: Record<string, string> = {
  owner: "Owner",
  internal_admin: "Internal Admin",
  internal_user: "Internal User",
  external_partner: "External Partner",
  viewer: "Viewer",
  auditor: "Auditor"
};

export default function EngagementDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [isAddPartyOpen, setIsAddPartyOpen] = useState(false);
  const [isAddAgreementOpen, setIsAddAgreementOpen] = useState(false);

  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editRefNumber, setEditRefNumber] = useState("");

  const [newMemberUserId, setNewMemberUserId] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("viewer");
  const [newPartyId, setNewPartyId] = useState("");
  const [newPartyRole, setNewPartyRole] = useState("");
  const [newAgreementId, setNewAgreementId] = useState("");

  // Timeline state
  const [isAddActivityOpen, setIsAddActivityOpen] = useState(false);
  const [newActivityType, setNewActivityType] = useState<string>("InternalNote");
  const [newActivityContent, setNewActivityContent] = useState("");
  const [timelineTypeFilter, setTimelineTypeFilter] = useState<string>("all");
  const [timelineStartDate, setTimelineStartDate] = useState<string>("");
  const [timelineEndDate, setTimelineEndDate] = useState<string>("");

  // Documents state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("Other");
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null);
  const [documentVersions, setDocumentVersions] = useState<Document[]>([]);

  // Tasks state
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState<string>("Medium");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");

  const { data: engagement, isLoading } = useQuery<Engagement>({
    queryKey: ["/api/engagements", id],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch engagement");
      return res.json();
    },
    enabled: !!id
  });

  const { data: members = [] } = useQuery<any[]>({
    queryKey: ["/api/engagements", id, "members"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/members`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch members");
      return res.json();
    },
    enabled: !!id
  });

  const { data: engagementParties = [] } = useQuery<any[]>({
    queryKey: ["/api/engagements", id, "parties"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/parties`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch parties");
      return res.json();
    },
    enabled: !!id
  });

  const { data: engagementAgreements = [] } = useQuery<any[]>({
    queryKey: ["/api/engagements", id, "agreements"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/agreements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch agreements");
      return res.json();
    },
    enabled: !!id
  });

  const { data: availableUsers = [] } = useQuery<User[]>({
    queryKey: ["/api/engagements", id, "available-users"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/available-users`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const { data: allParties = [] } = useQuery<Party[]>({
    queryKey: ["/api/parties"],
    queryFn: async () => {
      const res = await fetch("/api/parties", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  const { data: allAgreements = [] } = useQuery<Agreement[]>({
    queryKey: ["/api/agreements"],
    queryFn: async () => {
      const res = await fetch("/api/agreements", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Timeline query with server-side filtering
  const { data: timeline = [] } = useQuery<Activity[]>({
    queryKey: ["/api/engagements", id, "timeline", timelineTypeFilter, timelineStartDate, timelineEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (timelineTypeFilter && timelineTypeFilter !== "all") params.append("type", timelineTypeFilter);
      if (timelineStartDate) params.append("startDate", timelineStartDate);
      if (timelineEndDate) params.append("endDate", timelineEndDate);
      const queryString = params.toString();
      const url = `/api/engagements/${id}/timeline${queryString ? `?${queryString}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // Documents query
  const { data: engagementDocuments = [] } = useQuery<Document[]>({
    queryKey: ["/api/engagements", id, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/documents`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  // Tasks query
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/engagements", id, "tasks"],
    queryFn: async () => {
      const res = await fetch(`/api/engagements/${id}/tasks`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/engagements/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update engagement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id] });
      setIsEditing(false);
      toast({ title: "Engagement Updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const addMemberMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/engagements/${id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add member");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "members"] });
      setIsAddMemberOpen(false);
      setNewMemberUserId("");
      setNewMemberRole("viewer");
      toast({ title: "Member Added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (membershipId: string) => {
      const res = await fetch(`/api/engagements/${id}/members/${membershipId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to remove member");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "members"] });
      toast({ title: "Member Removed" });
    }
  });

  const addPartyMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/engagements/${id}/parties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to add party");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "parties"] });
      setIsAddPartyOpen(false);
      setNewPartyId("");
      setNewPartyRole("");
      toast({ title: "Party Added" });
    }
  });

  const removePartyMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await fetch(`/api/engagements/${id}/parties/${linkId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to remove party");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "parties"] });
      toast({ title: "Party Removed" });
    }
  });

  const addAgreementMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/engagements/${id}/agreements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to add agreement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "agreements"] });
      setIsAddAgreementOpen(false);
      setNewAgreementId("");
      toast({ title: "Agreement Added" });
    }
  });

  const removeAgreementMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const res = await fetch(`/api/engagements/${id}/agreements/${linkId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to remove agreement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "agreements"] });
      toast({ title: "Agreement Removed" });
    }
  });

  // Timeline mutations
  const addActivityMutation = useMutation({
    mutationFn: async (data: { type: string; content: string }) => {
      const res = await fetch(`/api/engagements/${id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to add activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      setIsAddActivityOpen(false);
      setNewActivityType("InternalNote");
      setNewActivityContent("");
      toast({ title: "Activity Added" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      const res = await fetch(`/api/engagements/${id}/timeline/${activityId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete activity");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      toast({ title: "Activity Removed" });
    }
  });

  // Task mutations
  const addTaskMutation = useMutation({
    mutationFn: async (data: { title: string; description?: string; priority: string; dueDate?: string; assigneeId?: string }) => {
      const res = await fetch(`/api/engagements/${id}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      setIsAddTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskDescription("");
      setNewTaskPriority("Medium");
      setNewTaskDueDate("");
      setNewTaskAssignee("");
      toast({ title: "Task Created" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      const res = await fetch(`/api/engagements/${id}/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to update task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      toast({ title: "Task Updated" });
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const res = await fetch(`/api/engagements/${id}/tasks/${taskId}`, {
        method: "DELETE",
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to delete task");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      toast({ title: "Task Deleted" });
    }
  });

  // Document upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    try {
      await uploadEngagementDocument({
        engagementId: id,
        file,
        type: file.type.includes("pdf") ? "PDF" : file.type.includes("image") ? "Image" : "Other",
        category: uploadCategory
      });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      toast({ title: "Document Uploaded" });
      setUploadCategory("Other"); // Reset category
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const deleteDocumentMutation = useMutation({
    mutationFn: async (docId: string) => {
      if (!id) throw new Error("Engagement ID required");
      await deleteEngagementDocument(id, docId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/engagements", id, "timeline"] });
      toast({ title: "Document Deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    }
  });

  // Timeline is now filtered server-side, so just use the data directly
  const filteredTimeline = timeline;

  const startEditing = () => {
    if (engagement) {
      setEditName(engagement.name);
      setEditDescription(engagement.description || "");
      setEditType(engagement.type);
      setEditStatus(engagement.status);
      setEditRefNumber(engagement.referenceNumber || "");
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    updateMutation.mutate({
      name: editName,
      description: editDescription || null,
      type: editType,
      status: editStatus,
      referenceNumber: editRefNumber || null
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!engagement) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Engagement not found</h2>
        <Link href="/engagements">
          <Button variant="link">Back to Engagements</Button>
        </Link>
      </div>
    );
  }

  // Calculate user's role in this engagement
  const myMembership = members.find((m: any) => m.userId === currentUser?.id);
  const myRole = myMembership?.role || (currentUser?.role === "Admin" ? "internal_admin" : null);
  
  // Permission checks based on engagement role
  const canEdit = myRole === "owner" || myRole === "internal_admin";
  const canManageMembers = myRole === "owner" || myRole === "internal_admin";
  const canLinkEntities = ["owner", "internal_admin", "internal_user"].includes(myRole || "");
  const canEditTimeline = ["owner", "internal_admin", "internal_user"].includes(myRole || "");
  const canDeleteActivity = myRole === "owner" || myRole === "internal_admin";

  // Derived lists for available items (server-side filtered for users)
  const existingPartyIds = engagementParties.map((ep: any) => ep.partyId);
  const availablePartyList = allParties.filter((p: Party) => !existingPartyIds.includes(p.id));

  const existingAgreementIds = engagementAgreements.map((ea: any) => ea.agreementId);
  const availableAgreementList = allAgreements.filter((a: Agreement) => !existingAgreementIds.includes(a.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/engagements">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{engagement.name}</h1>
            <Badge className={statusColors[engagement.status]}>{engagement.status}</Badge>
          </div>
          {engagement.referenceNumber && (
            <p className="text-sm text-muted-foreground">Ref: {engagement.referenceNumber}</p>
          )}
        </div>
        {canEdit && (
          !isEditing ? (
            <Button variant="outline" onClick={startEditing} data-testid="button-edit-engagement">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending} data-testid="button-save-engagement">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
            </div>
          )
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <Briefcase className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members" data-testid="tab-members">
            <Users className="mr-2 h-4 w-4" />
            Members ({members.length})
          </TabsTrigger>
          <TabsTrigger value="parties" data-testid="tab-parties">
            <Building2 className="mr-2 h-4 w-4" />
            Parties ({engagementParties.length})
          </TabsTrigger>
          <TabsTrigger value="agreements" data-testid="tab-agreements">
            <FileText className="mr-2 h-4 w-4" />
            Agreements ({engagementAgreements.length})
          </TabsTrigger>
          <TabsTrigger value="timeline" data-testid="tab-timeline">
            <Clock className="mr-2 h-4 w-4" />
            Timeline ({timeline.length})
          </TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-documents">
            <File className="mr-2 h-4 w-4" />
            Documents ({engagementDocuments.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">
            <CheckSquare className="mr-2 h-4 w-4" />
            Tasks ({tasks.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Engagement Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input value={editName} onChange={e => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Reference Number</Label>
                      <Input value={editRefNumber} onChange={e => setEditRefNumber(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} rows={3} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={editType} onValueChange={setEditType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {engagementTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={editStatus} onValueChange={setEditStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {engagementStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <Label className="text-muted-foreground">Type</Label>
                    <p className="font-medium">{engagement.type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Status</Label>
                    <p><Badge className={statusColors[engagement.status]}>{engagement.status}</Badge></p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Description</Label>
                    <p className="font-medium">{engagement.description || "No description"}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Created</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {engagement.createdAt ? format(new Date(engagement.createdAt), "PPP") : "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Last Updated</Label>
                    <p className="font-medium">
                      {engagement.updatedAt ? format(new Date(engagement.updatedAt), "PPP") : "-"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Team Members</CardTitle>
                <CardDescription>Users with access to this engagement</CardDescription>
              </div>
              {canManageMembers && (
                <Dialog open={isAddMemberOpen} onOpenChange={setIsAddMemberOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-member">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Member
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Team Member</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>User</Label>
                        <Select value={newMemberUserId} onValueChange={setNewMemberUserId}>
                          <SelectTrigger><SelectValue placeholder="Select user..." /></SelectTrigger>
                          <SelectContent>
                            {availableUsers.map((u: any) => (
                              <SelectItem key={u.id} value={u.id}>{u.name} ({u.email})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={newMemberRole} onValueChange={setNewMemberRole}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {engagementRoles.map(r => (
                              <SelectItem key={r} value={r}>{roleLabels[r]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        onClick={() => addMemberMutation.mutate({ userId: newMemberUserId, role: newMemberRole })}
                        disabled={!newMemberUserId || addMemberMutation.isPending}
                      >
                        Add Member
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No members yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{m.user?.name || "Unknown"}</div>
                            <div className="text-sm text-muted-foreground">{m.user?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="flex items-center gap-1 w-fit">
                            <Shield className="h-3 w-3" />
                            {roleLabels[m.role] || m.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.invitedAt ? format(new Date(m.invitedAt), "MMM d, yyyy") : "-"}
                        </TableCell>
                        {canManageMembers && m.role !== "owner" && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Remove this member?")) {
                                  removeMemberMutation.mutate(m.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parties">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Linked Parties</CardTitle>
                <CardDescription>Companies and individuals involved in this engagement</CardDescription>
              </div>
              {canLinkEntities && (
                <Dialog open={isAddPartyOpen} onOpenChange={setIsAddPartyOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-party">
                      <Plus className="mr-2 h-4 w-4" />
                      Link Party
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Link Party to Engagement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Party</Label>
                        <Select value={newPartyId} onValueChange={setNewPartyId}>
                          <SelectTrigger><SelectValue placeholder="Select party..." /></SelectTrigger>
                          <SelectContent>
                            {availablePartyList.map((p: Party) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.type})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Role in Engagement</Label>
                        <Input
                          value={newPartyRole}
                          onChange={e => setNewPartyRole(e.target.value)}
                          placeholder="e.g., Counterparty, Guarantor, Counsel..."
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => addPartyMutation.mutate({ partyId: newPartyId, roleInEngagement: newPartyRole || null })}
                        disabled={!newPartyId || addPartyMutation.isPending}
                      >
                        Link Party
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {engagementParties.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No parties linked</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Party</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagementParties.map((ep: any) => (
                      <TableRow key={ep.id}>
                        <TableCell>
                          <Link href={`/parties/${ep.party?.id}`}>
                            <span className="font-medium hover:underline">{ep.party?.name || "Unknown"}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ep.party?.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {ep.roleInEngagement || "-"}
                        </TableCell>
                        {canLinkEntities && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Remove this party from engagement?")) {
                                  removePartyMutation.mutate(ep.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreements">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Linked Agreements</CardTitle>
                <CardDescription>Contracts and agreements in this engagement</CardDescription>
              </div>
              {canLinkEntities && (
                <Dialog open={isAddAgreementOpen} onOpenChange={setIsAddAgreementOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" data-testid="button-add-agreement">
                      <Plus className="mr-2 h-4 w-4" />
                      Link Agreement
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Link Agreement to Engagement</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Agreement</Label>
                        <Select value={newAgreementId} onValueChange={setNewAgreementId}>
                          <SelectTrigger><SelectValue placeholder="Select agreement..." /></SelectTrigger>
                          <SelectContent>
                            {availableAgreementList.map((a: Agreement) => (
                              <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => addAgreementMutation.mutate({ agreementId: newAgreementId })}
                        disabled={!newAgreementId || addAgreementMutation.isPending}
                      >
                        Link Agreement
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {engagementAgreements.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No agreements linked</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agreement</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagementAgreements.map((ea: any) => (
                      <TableRow key={ea.id}>
                        <TableCell>
                          <Link href={`/agreements/${ea.agreement?.id}`}>
                            <span className="font-medium hover:underline">{ea.agreement?.title || "Unknown"}</span>
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{ea.agreement?.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge>{ea.agreement?.performanceStatus}</Badge>
                        </TableCell>
                        {canLinkEntities && (
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm("Remove this agreement from engagement?")) {
                                  removeAgreementMutation.mutate(ea.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Engagement Timeline</CardTitle>
                <CardDescription>Activity history and communications log</CardDescription>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={timelineTypeFilter} onValueChange={setTimelineTypeFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activities</SelectItem>
                    {userActivityTypes.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-1">
                  <Input
                    type="date"
                    value={timelineStartDate}
                    onChange={(e) => setTimelineStartDate(e.target.value)}
                    className="w-36"
                    placeholder="Start date"
                    data-testid="input-timeline-start-date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={timelineEndDate}
                    onChange={(e) => setTimelineEndDate(e.target.value)}
                    className="w-36"
                    placeholder="End date"
                    data-testid="input-timeline-end-date"
                  />
                  {(timelineStartDate || timelineEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTimelineStartDate("");
                        setTimelineEndDate("");
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {canEditTimeline && (
                  <Dialog open={isAddActivityOpen} onOpenChange={setIsAddActivityOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm" data-testid="button-add-activity">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Activity
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Timeline Entry</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Activity Type</Label>
                          <Select value={newActivityType} onValueChange={setNewActivityType}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {userActivityTypes.map(t => (
                                <SelectItem key={t} value={t}>{t}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Content</Label>
                          <Textarea 
                            value={newActivityContent} 
                            onChange={e => setNewActivityContent(e.target.value)}
                            placeholder="Describe the activity..."
                            rows={4}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          onClick={() => addActivityMutation.mutate({ type: newActivityType, content: newActivityContent })}
                          disabled={!newActivityContent.trim() || addActivityMutation.isPending}
                        >
                          Add Activity
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredTimeline.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No timeline entries yet</p>
              ) : (
                <div className="space-y-4">
                  {filteredTimeline.map((activity: Activity) => (
                    <div key={activity.id} className="flex gap-4 border-l-2 border-muted pl-4 pb-4" data-testid={`timeline-entry-${activity.id}`}>
                      <div className="flex-shrink-0 mt-1">
                        {activity.type === "Call" && <Phone className="h-4 w-4 text-blue-500" />}
                        {activity.type === "Email" && <Mail className="h-4 w-4 text-green-500" />}
                        {activity.type === "Meeting" && <Users className="h-4 w-4 text-purple-500" />}
                        {activity.type === "InternalNote" && <MessageSquare className="h-4 w-4 text-gray-500" />}
                        {activity.type === "LetterSent" && <FileText className="h-4 w-4 text-orange-500" />}
                        {activity.type === "CourtFiling" && <FileUp className="h-4 w-4 text-red-500" />}
                        {activity.type?.startsWith("Member") && <Users className="h-4 w-4 text-blue-400" />}
                        {activity.type?.includes("Linked") && <Building2 className="h-4 w-4 text-teal-500" />}
                        {activity.type?.includes("Unlinked") && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-xs">{activity.type}</Badge>
                            <span className="text-xs text-muted-foreground">{activity.date}</span>
                            <span className="text-xs text-muted-foreground">by {activity.user}</span>
                          </div>
                          {canDeleteActivity && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                if (confirm("Delete this timeline entry?")) {
                                  deleteActivityMutation.mutate(activity.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <p className="text-sm mt-1 whitespace-pre-wrap">{activity.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Documents</CardTitle>
                <CardDescription>Files and documents attached to this engagement</CardDescription>
              </div>
              {canLinkEntities && (
                <div className="flex items-center gap-2">
                  <Select value={uploadCategory} onValueChange={setUploadCategory}>
                    <SelectTrigger className="w-40" data-testid="select-upload-category">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {documentCategories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif"
                  />
                  <Button
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    data-testid="button-upload-document"
                  >
                    {isUploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileUp className="mr-2 h-4 w-4" />
                    )}
                    Upload Document
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              {engagementDocuments.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No documents uploaded</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {engagementDocuments.map((doc: Document) => (
                      <TableRow key={doc.id} data-testid={`document-row-${doc.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.type}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.category}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">v{doc.version}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {doc.dateUploaded ? format(new Date(doc.dateUploaded), "MMM d, yyyy") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              asChild
                              title="Download"
                            >
                              <a href={getDocumentDownloadUrl(doc.id)} target="_blank" rel="noopener noreferrer">
                                <Download className="h-4 w-4" />
                              </a>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Version History"
                              onClick={async () => {
                                const parentId = doc.parentDocumentId || doc.id;
                                const versions = await fetchDocumentVersions(parentId);
                                setDocumentVersions(versions);
                                setShowVersionHistory(parentId);
                              }}
                            >
                              <History className="h-4 w-4" />
                            </Button>
                            {canLinkEntities && (
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete"
                                onClick={() => {
                                  if (confirm("Delete this document?")) {
                                    deleteDocumentMutation.mutate(doc.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Version History Dialog */}
          <Dialog open={!!showVersionHistory} onOpenChange={() => setShowVersionHistory(null)}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Version History</DialogTitle>
                <DialogDescription>All versions of this document</DialogDescription>
              </DialogHeader>
              <div className="max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Uploaded</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentVersions.map((ver) => (
                      <TableRow key={ver.id}>
                        <TableCell>
                          <Badge variant="secondary">v{ver.version}</Badge>
                        </TableCell>
                        <TableCell>{ver.name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {ver.dateUploaded ? format(new Date(ver.dateUploaded), "MMM d, yyyy HH:mm") : "-"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            asChild
                          >
                            <a href={getDocumentDownloadUrl(ver.id)} target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Tasks</CardTitle>
                <CardDescription>Action items and to-dos for this engagement</CardDescription>
              </div>
              {canLinkEntities && (
                <Dialog open={isAddTaskOpen} onOpenChange={setIsAddTaskOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-task">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Task</DialogTitle>
                      <DialogDescription>Add an action item for this engagement</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Title</Label>
                        <Input
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                          placeholder="Enter task title"
                          data-testid="input-task-title"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description (optional)</Label>
                        <Textarea
                          value={newTaskDescription}
                          onChange={(e) => setNewTaskDescription(e.target.value)}
                          placeholder="Enter task description"
                          rows={3}
                          data-testid="input-task-description"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                            <SelectTrigger data-testid="select-task-priority">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taskPriorities.map(p => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date (optional)</Label>
                          <Input
                            type="date"
                            value={newTaskDueDate}
                            onChange={(e) => setNewTaskDueDate(e.target.value)}
                            data-testid="input-task-due-date"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Assign To (optional)</Label>
                        <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                          <SelectTrigger data-testid="select-task-assignee">
                            <SelectValue placeholder="Select assignee" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {members.map((m: any) => (
                              <SelectItem key={m.userId} value={m.userId}>{m.user?.name || m.userId}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={() => addTaskMutation.mutate({
                          title: newTaskTitle,
                          description: newTaskDescription || undefined,
                          priority: newTaskPriority,
                          dueDate: newTaskDueDate || undefined,
                          assigneeId: newTaskAssignee || undefined
                        })}
                        disabled={!newTaskTitle.trim() || addTaskMutation.isPending}
                        data-testid="button-submit-task"
                      >
                        Create Task
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent>
              {tasks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No tasks yet</p>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task: Task) => (
                    <div
                      key={task.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${
                        task.status === "Completed" ? "bg-muted/50" : ""
                      }`}
                      data-testid={`task-row-${task.id}`}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 mt-0.5"
                        onClick={() => updateTaskMutation.mutate({
                          taskId: task.id,
                          data: { status: task.status === "Completed" ? "Open" : "Completed" }
                        })}
                        data-testid={`task-toggle-${task.id}`}
                      >
                        {task.status === "Completed" ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </Button>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium ${task.status === "Completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </span>
                          <Badge
                            variant={task.priority === "Urgent" ? "destructive" : task.priority === "High" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {task.priority}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {task.status}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          {task.dueDate && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Due: {format(new Date(task.dueDate), "MMM d, yyyy")}
                            </span>
                          )}
                          {task.assigneeId && (
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {members.find((m: any) => m.userId === task.assigneeId)?.user?.name || "Assigned"}
                            </span>
                          )}
                        </div>
                      </div>
                      {canLinkEntities && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Delete this task?")) {
                              deleteTaskMutation.mutate(task.id);
                            }
                          }}
                          data-testid={`task-delete-${task.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
