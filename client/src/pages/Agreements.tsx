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
import { Plus, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";

type AgreementType = "Loan" | "LOI" | "JV" | "Lease" | "Other";

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
  const { agreements, parties, addAgreement, addDocument, isLoading } = useData();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [search, setSearch] = useState("");
  
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
        isPersonalGuarantee: false
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
                      <SelectItem value="LOI">LOI</SelectItem>
                      <SelectItem value="JV">JV</SelectItem>
                      <SelectItem value="Lease">Lease</SelectItem>
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
