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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Edit, Save, Users, Building2, FileText, Briefcase, Plus, Trash2, Loader2, Calendar, Shield } from "lucide-react";
import { useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import type { Engagement, Party, Agreement, User } from "@shared/schema";

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
      </Tabs>
    </div>
  );
}
