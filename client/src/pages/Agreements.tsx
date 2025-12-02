import { useData } from "@/lib/data";
import type { Agreement } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, CheckSquare, Square, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";

type AgreementType = "Loan" | "LOI" | "JV" | "Lease" | "Trading" | "Investment" | "PrivatePlacement" | "ServiceAgreement" | "Other";

const STATUS_COLUMNS = [
  "Draft", 
  "Sent", 
  "Executed", 
  "Performing", 
  "InGracePeriod", 
  "InDefault", 
  "Settled"
];

export default function Agreements() {
  const { agreements, parties, addAgreement, addDocument, updateAgreement, bulkUpdateAgreementStatus, isLoading } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAgreements, setSelectedAgreements] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("");
  const [partyId, setPartyId] = useState("");
  const [type, setType] = useState<AgreementType>("Other");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const getPartyName = (id: string) => parties.find(p => p.id === id)?.name || "Unknown Party";

  const filteredAgreements = useMemo(() => {
    if (!search.trim()) return agreements;
    const searchLower = search.toLowerCase();
    return agreements.filter(a => 
      a.title.toLowerCase().includes(searchLower) ||
      a.type.toLowerCase().includes(searchLower) ||
      getPartyName(a.partyId).toLowerCase().includes(searchLower)
    );
  }, [agreements, search, parties]);

  const agreementsByStatus = useMemo(() => {
    const grouped: Record<string, Agreement[]> = {};
    STATUS_COLUMNS.forEach(s => grouped[s] = []);
    
    filteredAgreements.forEach(a => {
      if (grouped[a.performanceStatus]) {
        grouped[a.performanceStatus].push(a);
      }
    });
    return grouped;
  }, [filteredAgreements]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;
    
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;
    
    const newStatus = destination.droppableId;
    const agreement = agreements.find(a => a.id === draggableId);
    
    if (!agreement) return;
    
    try {
      await updateAgreement(draggableId, { performanceStatus: newStatus as any });
      toast({ 
        title: "Status Updated", 
        description: `Moved "${agreement.title}" to ${newStatus.replace(/([A-Z])/g, ' $1').trim()}` 
      });
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update status.", 
        variant: "destructive" 
      });
    }
  };

  const handleAddAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Create Agreement
      const newAgreement = await addAgreement({
        title,
        partyId,
        type,
        principalAmount: Number(amount),
        interestRateAnnual: null,
        governingLaw: "NY",
        venueJurisdiction: "NY",
        effectiveDate: date,
        maturityDate: null,
        internalOwner: user?.name || "Admin",
        counterpartyRiskRating: "Medium",
        performanceStatus: "Draft",
        enforcementStage: "None",
        isClientVisible: false,
        isSecured: false,
        isPersonalGuarantee: false,
        notes: null
      });

      // Upload File if attached
      if (file && newAgreement) {
        await addDocument({
          agreementId: newAgreement.id,
          name: file.name,
          type: "PDF",
          file: file
        });
        toast({ title: "File Uploaded", description: `${file.name} attached to new agreement.` });
      }

      setIsAddOpen(false);
      resetForm();
      toast({ title: "Agreement Created", description: "New agreement has been added to Drafts." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create agreement.", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setTitle("");
    setPartyId("");
    setType("Other");
    setAmount("");
    setDate("");
    setFile(null);
  };

  const toggleAgreementSelection = (agreementId: string) => {
    const newSelection = new Set(selectedAgreements);
    if (newSelection.has(agreementId)) {
      newSelection.delete(agreementId);
    } else {
      newSelection.add(agreementId);
    }
    setSelectedAgreements(newSelection);
  };

  const selectAllInColumn = (status: string) => {
    const agreementsInColumn = agreementsByStatus[status] || [];
    const columnIds = agreementsInColumn.map(a => a.id);
    const allColumnSelected = columnIds.every(id => selectedAgreements.has(id));
    
    const newSelection = new Set(selectedAgreements);
    if (allColumnSelected) {
      columnIds.forEach(id => newSelection.delete(id));
    } else {
      columnIds.forEach(id => newSelection.add(id));
    }
    setSelectedAgreements(newSelection);
  };

  const isColumnFullySelected = (status: string) => {
    const agreementsInColumn = agreementsByStatus[status] || [];
    if (agreementsInColumn.length === 0) return false;
    return agreementsInColumn.every(a => selectedAgreements.has(a.id));
  };

  const clearSelection = () => {
    setSelectedAgreements(new Set());
    setSelectionMode(false);
  };

  const handleBulkStatusUpdate = async (newStatus: string) => {
    if (selectedAgreements.size === 0) return;
    
    const count = selectedAgreements.size;
    try {
      await bulkUpdateAgreementStatus(Array.from(selectedAgreements), newStatus);
      toast({ 
        title: "Bulk Update Complete", 
        description: `${count} agreement(s) moved to ${newStatus.replace(/([A-Z])/g, ' $1').trim()}` 
      });
      clearSelection();
    } catch (error) {
      toast({ 
        title: "Error", 
        description: "Failed to update some agreements.", 
        variant: "destructive" 
      });
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Agreements</h1>
          <p className="text-muted-foreground">Active deal flow and portfolio management.</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter agreements..."
              className="pl-8 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-agreements"
            />
          </div>
          
          {selectionMode ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="h-8 px-3" data-testid="badge-selection-count">
                {selectedAgreements.size} selected
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={selectedAgreements.size === 0} data-testid="button-bulk-actions">
                    <Settings className="h-4 w-4 mr-2" />
                    Bulk Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-xs font-medium text-muted-foreground" disabled>Move to Status:</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {STATUS_COLUMNS.map(status => (
                    <DropdownMenuItem 
                      key={status} 
                      onClick={() => handleBulkStatusUpdate(status)}
                      data-testid={`bulk-action-${status}`}
                    >
                      {status.replace(/([A-Z])/g, ' $1').trim()}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={clearSelection} data-testid="button-cancel-selection">
                Cancel
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setSelectionMode(true)} data-testid="button-select-mode">
              <CheckSquare className="h-4 w-4 mr-2" />
              Select
            </Button>
          )}
        
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Agreement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Agreement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddAgreement} className="space-y-4">
              <div className="space-y-2">
                <Label>Agreement Title</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Series B Note" />
              </div>
              
              <div className="space-y-2">
                <Label>Counterparty</Label>
                <Select value={partyId} onValueChange={setPartyId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a party" />
                  </SelectTrigger>
                  <SelectContent>
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={(v: any) => setType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Loan">Loan</SelectItem>
                      <SelectItem value="LOI">LOI (Letter of Intent)</SelectItem>
                      <SelectItem value="JV">JV (Joint Venture)</SelectItem>
                      <SelectItem value="Lease">Lease</SelectItem>
                      <SelectItem value="Trading">Trading Agreement</SelectItem>
                      <SelectItem value="Investment">Investment Agreement</SelectItem>
                      <SelectItem value="PrivatePlacement">Private Placement</SelectItem>
                      <SelectItem value="ServiceAgreement">Service Agreement</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Principal Amount ($)</Label>
                  <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} required placeholder="0.00" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Effective Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} required />
              </div>

              <div className="space-y-2">
                <Label>Upload Document (Optional)</Label>
                <Input 
                  type="file" 
                  className="cursor-pointer" 
                  onChange={(e) => setFile(e.target.files?.[0] || null)} 
                />
              </div>

              <DialogFooter>
                <Button type="submit">Create Agreement</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex-1 overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max h-full">
            {STATUS_COLUMNS.map(status => (
              <div key={status} className="w-80 flex flex-col bg-muted/30 rounded-lg border border-border/50 h-full">
                <div className="p-3 border-b border-border/50 bg-muted/50 font-medium text-sm text-muted-foreground uppercase tracking-wider flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {selectionMode && agreementsByStatus[status].length > 0 && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-5 w-5 p-0" 
                        onClick={() => selectAllInColumn(status)}
                        data-testid={`button-select-all-${status}`}
                      >
                        {isColumnFullySelected(status) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {status.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <span className="bg-background text-foreground px-2 py-0.5 rounded-full text-xs border">
                    {agreementsByStatus[status].length}
                  </span>
                </div>
                
                <Droppable droppableId={status}>
                  {(provided, snapshot) => (
                    <div 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`p-3 space-y-3 overflow-y-auto flex-1 transition-colors ${snapshot.isDraggingOver ? 'bg-primary/5' : ''}`}
                    >
                      {agreementsByStatus[status].map((agreement, index) => (
                        <Draggable key={agreement.id} draggableId={agreement.id} index={index} isDragDisabled={selectionMode}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              className={`${snapshot.isDragging ? 'opacity-90 shadow-lg' : ''} relative`}
                            >
                              {selectionMode && (
                                <div 
                                  className="absolute top-2 left-2 z-10"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleAgreementSelection(agreement.id);
                                  }}
                                >
                                  <Checkbox 
                                    checked={selectedAgreements.has(agreement.id)}
                                    className="h-5 w-5 bg-background border-2"
                                    data-testid={`checkbox-agreement-${agreement.id}`}
                                  />
                                </div>
                              )}
                              {selectionMode ? (
                                <div 
                                  onClick={() => toggleAgreementSelection(agreement.id)}
                                  className="cursor-pointer"
                                >
                                  <Card className={`hover:shadow-md transition-shadow border-l-4 ${selectedAgreements.has(agreement.id) ? 'border-l-primary ring-2 ring-primary/30' : 'border-l-muted'}`} data-testid={`card-agreement-${agreement.id}`}>
                                    <CardHeader className="p-3 pb-0 pl-9">
                                      <div className="flex justify-between items-start mb-1">
                                        <Badge variant="outline" className="text-[10px] uppercase">{agreement.type}</Badge>
                                        {agreement.isSecured && <Badge variant="secondary" className="text-[10px]">Secured</Badge>}
                                      </div>
                                      <CardTitle className="text-sm font-bold leading-tight">
                                        {agreement.title}
                                      </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-3 pt-2 pl-9">
                                      <p className="text-xs text-muted-foreground mb-2 font-medium">
                                        {getPartyName(agreement.partyId)}
                                      </p>
                                      <div className="flex justify-between items-center text-xs text-foreground/80 border-t pt-2 mt-2">
                                        <span className="font-mono font-semibold">{formatCurrency(agreement.principalAmount)}</span>
                                        <span className="text-muted-foreground">{new Date(agreement.effectiveDate).toLocaleDateString()}</span>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </div>
                              ) : (
                                <Link href={`/agreements/${agreement.id}`}>
                                  <Card className="cursor-pointer hover:shadow-md transition-shadow border-l-4 border-l-primary" data-testid={`card-agreement-${agreement.id}`}>
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
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      
                      {agreementsByStatus[status].length === 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground italic border-2 border-dashed border-border rounded-md">
                          Drop agreements here
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            ))}
          </div>
        </div>
      </DragDropContext>
    </div>
  );
}
