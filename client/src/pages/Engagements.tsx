import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Briefcase, Calendar, ChevronRight, Users, FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { format } from "date-fns";
import type { Engagement } from "@shared/schema";

const engagementTypes = [
  "Contract",
  "Loan",
  "JointVenture",
  "VendorAgreement",
  "Dispute",
  "Collection",
  "Litigation",
  "Advisory",
  "Other"
] as const;

const engagementStatuses = [
  "Active",
  "OnHold",
  "Closed",
  "Archived"
] as const;

const statusColors: Record<string, string> = {
  Active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  OnHold: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  Closed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  Archived: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
};

const typeIcons: Record<string, string> = {
  Contract: "📄",
  Loan: "💰",
  JointVenture: "🤝",
  VendorAgreement: "🛒",
  Dispute: "⚖️",
  Collection: "📋",
  Litigation: "🏛️",
  Advisory: "💡",
  Other: "📁"
};

export default function Engagements() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newType, setNewType] = useState<string>("Contract");
  const [newStatus, setNewStatus] = useState<string>("Active");
  const [newRefNumber, setNewRefNumber] = useState("");

  const { data: engagements = [], isLoading } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
    queryFn: async () => {
      const res = await fetch("/api/engagements", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch engagements");
      return res.json();
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error("Failed to create engagement");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/engagements"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "Engagement Created", description: "New engagement workspace has been created." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  });

  const filteredEngagements = engagements.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.description?.toLowerCase().includes(search.toLowerCase())) ||
    (e.referenceNumber?.toLowerCase().includes(search.toLowerCase())) ||
    e.type.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: newName,
      description: newDescription || null,
      type: newType,
      status: newStatus,
      referenceNumber: newRefNumber || null
    });
  };

  const resetForm = () => {
    setNewName("");
    setNewDescription("");
    setNewType("Contract");
    setNewStatus("Active");
    setNewRefNumber("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Engagements</h1>
          <p className="text-muted-foreground">Manage client matters, projects, and workspaces.</p>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-engagement">
              <Plus className="mr-2 h-4 w-4" />
              New Engagement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Engagement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  required
                  placeholder="e.g., ABC Corp Loan Agreement"
                  data-testid="input-engagement-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  placeholder="Brief description of this engagement..."
                  rows={3}
                  data-testid="input-engagement-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={newType} onValueChange={setNewType}>
                    <SelectTrigger data-testid="select-engagement-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {engagementTypes.map(t => (
                        <SelectItem key={t} value={t}>{typeIcons[t]} {t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={newStatus} onValueChange={setNewStatus}>
                    <SelectTrigger data-testid="select-engagement-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {engagementStatuses.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  value={newRefNumber}
                  onChange={e => setNewRefNumber(e.target.value)}
                  placeholder="e.g., MATTER-2024-001"
                  data-testid="input-engagement-reference"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-engagement">
                  {createMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Create Engagement
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              All Engagements ({filteredEngagements.length})
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search engagements..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
                data-testid="input-search-engagements"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredEngagements.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? "No engagements match your search." : "No engagements yet. Create your first engagement to get started."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[300px]">Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEngagements.map(engagement => (
                  <TableRow
                    key={engagement.id}
                    className="cursor-pointer hover:bg-muted/50"
                    data-testid={`row-engagement-${engagement.id}`}
                  >
                    <TableCell>
                      <Link href={`/engagements/${engagement.id}`}>
                        <div className="flex items-center gap-3">
                          <div className="text-2xl">{typeIcons[engagement.type] || "📁"}</div>
                          <div>
                            <div className="font-medium text-foreground">{engagement.name}</div>
                            {engagement.description && (
                              <div className="text-sm text-muted-foreground line-clamp-1">
                                {engagement.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{engagement.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[engagement.status] || ""}>
                        {engagement.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {engagement.referenceNumber || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {engagement.createdAt ? format(new Date(engagement.createdAt), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/engagements/${engagement.id}`}>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
