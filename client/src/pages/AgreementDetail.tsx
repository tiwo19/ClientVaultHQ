import { useData } from "@/lib/data";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  FileText, 
  Shield, 
  User, 
  Download, 
  Plus, 
  Phone, 
  Mail,
  AlertTriangle,
  Upload,
  Trash2,
  Pencil
} from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getDocumentDownloadUrl } from "@/lib/api";

export default function AgreementDetail() {
  const [, params] = useRoute("/agreements/:id");
  const id = params?.id;
  const { agreements, parties, activities, documents, persons, addDocument, removeDocument, updateAgreement } = useData();
  const { toast } = useToast();
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState("Other");
  const [editAmount, setEditAmount] = useState("");
  const [editInterestRate, setEditInterestRate] = useState("");
  const [editEffectiveDate, setEditEffectiveDate] = useState("");
  const [editMaturityDate, setEditMaturityDate] = useState("");
  const [editPerformanceStatus, setEditPerformanceStatus] = useState("Draft");
  const [editEnforcementStage, setEditEnforcementStage] = useState("None");
  const [editIsSecured, setEditIsSecured] = useState(false);
  const [editIsPersonalGuarantee, setEditIsPersonalGuarantee] = useState(false);
  const [editGoverningLaw, setEditGoverningLaw] = useState("");
  const [editVenueJurisdiction, setEditVenueJurisdiction] = useState("");
  const [editInternalOwner, setEditInternalOwner] = useState("");
  const [editRiskRating, setEditRiskRating] = useState("Low");
  const [editNotes, setEditNotes] = useState("");

  const agreement = agreements.find(a => a.id === id);
  
  useEffect(() => {
    if (agreement) {
      setEditTitle(agreement.title);
      setEditType(agreement.type);
      setEditAmount(agreement.principalAmount.toString());
      setEditInterestRate(agreement.interestRateAnnual?.toString() || "");
      setEditEffectiveDate(agreement.effectiveDate.split("T")[0]);
      setEditMaturityDate(agreement.maturityDate?.split("T")[0] || "");
      setEditPerformanceStatus(agreement.performanceStatus);
      setEditEnforcementStage(agreement.enforcementStage);
      setEditIsSecured(agreement.isSecured);
      setEditIsPersonalGuarantee(agreement.isPersonalGuarantee);
      setEditGoverningLaw(agreement.governingLaw);
      setEditVenueJurisdiction(agreement.venueJurisdiction);
      setEditInternalOwner(agreement.internalOwner);
      setEditRiskRating(agreement.counterpartyRiskRating);
      setEditNotes(agreement.notes || "");
    }
  }, [agreement]);
  
  if (!agreement) {
    return <div className="p-8 text-center">Agreement not found</div>;
  }

  const party = parties.find(p => p.id === agreement.partyId);
  const relatedActivities = activities.filter(a => a.agreementId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const relatedDocuments = documents.filter(d => d.agreementId === id);
  const relatedPersons = persons.filter(p => p.partyId === agreement.partyId);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      await addDocument({
        agreementId: id,
        partyId: agreement.partyId,
        name: uploadFile.name,
        type: "PDF",
        file: uploadFile
      });
      
      setIsUploadOpen(false);
      setUploadFile(null);
      toast({ title: "Document Uploaded", description: "File has been attached to the agreement." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload document.", variant: "destructive" });
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (confirm("Are you sure you want to delete this document?")) {
      try {
        await removeDocument(docId);
        toast({ title: "Document Removed" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
      }
    }
  };

  const handleEditAgreement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateAgreement(agreement.id, {
        title: editTitle,
        type: editType as any,
        principalAmount: parseFloat(editAmount) || 0,
        interestRateAnnual: editInterestRate ? parseFloat(editInterestRate) : null,
        effectiveDate: editEffectiveDate,
        maturityDate: editMaturityDate || null,
        performanceStatus: editPerformanceStatus as any,
        enforcementStage: editEnforcementStage as any,
        isSecured: editIsSecured,
        isPersonalGuarantee: editIsPersonalGuarantee,
        governingLaw: editGoverningLaw,
        venueJurisdiction: editVenueJurisdiction,
        internalOwner: editInternalOwner,
        counterpartyRiskRating: editRiskRating as any,
        notes: editNotes || null
      });
      setIsEditOpen(false);
      toast({ title: "Agreement Updated", description: "Changes have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update agreement.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
           <div className="flex items-center gap-3 mb-2">
             <Badge variant="outline" className="uppercase tracking-wider">{agreement.type}</Badge>
             {agreement.performanceStatus === "InDefault" && (
               <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> IN DEFAULT</Badge>
             )}
             <Badge variant={agreement.performanceStatus === "Performing" ? "default" : "secondary"}>
               {agreement.performanceStatus}
             </Badge>
           </div>
           <h1 className="text-3xl font-serif font-bold text-foreground">{agreement.title}</h1>
           <p className="text-muted-foreground mt-1 flex items-center gap-2">
             <User className="h-4 w-4" />
             {party?.name}
           </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-edit-agreement">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Agreement
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Agreement</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleEditAgreement} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input 
                    value={editTitle} 
                    onChange={e => setEditTitle(e.target.value)} 
                    required 
                    data-testid="input-edit-title"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select value={editType} onValueChange={setEditType}>
                      <SelectTrigger data-testid="select-edit-type">
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
                    <Input 
                      type="number" 
                      value={editAmount} 
                      onChange={e => setEditAmount(e.target.value)} 
                      required 
                      data-testid="input-edit-amount"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (Annual %)</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      value={editInterestRate} 
                      onChange={e => setEditInterestRate(e.target.value)} 
                      placeholder="e.g. 5.5"
                      data-testid="input-edit-interest-rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Risk Rating</Label>
                    <Select value={editRiskRating} onValueChange={setEditRiskRating}>
                      <SelectTrigger data-testid="select-edit-risk">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Effective Date</Label>
                    <Input 
                      type="date" 
                      value={editEffectiveDate} 
                      onChange={e => setEditEffectiveDate(e.target.value)} 
                      required 
                      data-testid="input-edit-effective-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Maturity Date</Label>
                    <Input 
                      type="date" 
                      value={editMaturityDate} 
                      onChange={e => setEditMaturityDate(e.target.value)}
                      data-testid="input-edit-maturity-date"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Performance Status</Label>
                    <Select value={editPerformanceStatus} onValueChange={setEditPerformanceStatus}>
                      <SelectTrigger data-testid="select-edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Performing">Performing</SelectItem>
                        <SelectItem value="InDefault">In Default</SelectItem>
                        <SelectItem value="Settled">Settled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Enforcement Stage</Label>
                    <Select value={editEnforcementStage} onValueChange={setEditEnforcementStage}>
                      <SelectTrigger data-testid="select-edit-enforcement">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="None">None</SelectItem>
                        <SelectItem value="Dunning">Dunning</SelectItem>
                        <SelectItem value="PreSuit">Pre-Suit</SelectItem>
                        <SelectItem value="SuitFiled">Suit Filed</SelectItem>
                        <SelectItem value="Judgment">Judgment</SelectItem>
                        <SelectItem value="Garnishment">Garnishment</SelectItem>
                        <SelectItem value="Closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Governing Law</Label>
                    <Input 
                      value={editGoverningLaw} 
                      onChange={e => setEditGoverningLaw(e.target.value)}
                      placeholder="e.g. State of New York"
                      data-testid="input-edit-governing-law"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Venue / Jurisdiction</Label>
                    <Input 
                      value={editVenueJurisdiction} 
                      onChange={e => setEditVenueJurisdiction(e.target.value)}
                      placeholder="e.g. New York County"
                      data-testid="input-edit-venue"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Internal Owner</Label>
                  <Input 
                    value={editInternalOwner} 
                    onChange={e => setEditInternalOwner(e.target.value)}
                    placeholder="e.g. John Smith"
                    data-testid="input-edit-owner"
                  />
                </div>

                <div className="flex gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-secured" 
                      checked={editIsSecured} 
                      onCheckedChange={(checked) => setEditIsSecured(!!checked)}
                      data-testid="checkbox-edit-secured"
                    />
                    <Label htmlFor="edit-secured" className="cursor-pointer">Secured Agreement</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox 
                      id="edit-pg" 
                      checked={editIsPersonalGuarantee} 
                      onCheckedChange={(checked) => setEditIsPersonalGuarantee(!!checked)}
                      data-testid="checkbox-edit-pg"
                    />
                    <Label htmlFor="edit-pg" className="cursor-pointer">Personal Guarantee</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Internal Notes</Label>
                  <Textarea 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Add internal comments or notes about this agreement..."
                    className="min-h-[80px]"
                    data-testid="textarea-edit-notes"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="button-save-agreement">Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Button>Add Activity</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Key Info & Financials */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Summary Card */}
          <Card className="bg-sidebar text-sidebar-foreground border-none shadow-lg">
            <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-6">
               <div>
                 <p className="text-sidebar-foreground/60 text-xs uppercase tracking-wider font-medium mb-1">Principal Amount</p>
                 <div className="text-3xl font-bold text-sidebar-primary-foreground flex items-baseline gap-1">
                   {formatCurrency(agreement.principalAmount)}
                 </div>
               </div>
               <div>
                 <p className="text-sidebar-foreground/60 text-xs uppercase tracking-wider font-medium mb-1">Interest Rate</p>
                 <div className="text-2xl font-semibold text-sidebar-primary-foreground">
                   {agreement.interestRateAnnual ? `${agreement.interestRateAnnual}%` : "N/A"}
                 </div>
               </div>
               <div>
                 <p className="text-sidebar-foreground/60 text-xs uppercase tracking-wider font-medium mb-1">Maturity Date</p>
                 <div className="text-2xl font-semibold text-sidebar-primary-foreground">
                   {agreement.maturityDate ? format(new Date(agreement.maturityDate), 'MMM d, yyyy') : "Perpetual"}
                 </div>
               </div>
            </CardContent>
          </Card>

          {/* Tabs for Details / Timeline / Docs */}
          <Tabs defaultValue="details" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
              <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">Details</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">Timeline ({relatedActivities.length})</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">Documents ({relatedDocuments.length})</TabsTrigger>
            </TabsList>
            
            <TabsContent value="details" className="pt-6 space-y-6">
               <Card>
                 <CardHeader>
                   <CardTitle>Terms & Jurisdiction</CardTitle>
                 </CardHeader>
                 <CardContent className="grid grid-cols-2 gap-y-6 gap-x-4">
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Effective Date</h4>
                      <p className="text-sm">{format(new Date(agreement.effectiveDate), 'MMMM d, yyyy')}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Governing Law</h4>
                      <p className="text-sm">{agreement.governingLaw}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Venue / Jurisdiction</h4>
                      <p className="text-sm">{agreement.venueJurisdiction}</p>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-muted-foreground mb-1">Internal Owner</h4>
                      <p className="text-sm">{agreement.internalOwner}</p>
                    </div>
                 </CardContent>
               </Card>

               <Card>
                 <CardHeader>
                   <CardTitle>Security & Risk</CardTitle>
                 </CardHeader>
                 <CardContent className="space-y-4">
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Secured Agreement</span>
                      <Badge variant={agreement.isSecured ? "default" : "outline"}>{agreement.isSecured ? "Yes" : "No"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Personal Guarantee</span>
                      <Badge variant={agreement.isPersonalGuarantee ? "default" : "outline"}>{agreement.isPersonalGuarantee ? "Yes" : "No"}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b">
                      <span className="text-sm font-medium">Counterparty Risk</span>
                      <Badge className={
                        agreement.counterpartyRiskRating === "High" ? "bg-destructive text-destructive-foreground" : 
                        agreement.counterpartyRiskRating === "Medium" ? "bg-yellow-500 text-white" : 
                        "bg-green-600 text-white"
                      }>{agreement.counterpartyRiskRating}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="text-sm font-medium">Enforcement Stage</span>
                      <span className="text-sm font-mono text-muted-foreground">{agreement.enforcementStage}</span>
                    </div>
                 </CardContent>
               </Card>

               {agreement.notes && (
                 <Card>
                   <CardHeader>
                     <CardTitle>Internal Notes</CardTitle>
                   </CardHeader>
                   <CardContent>
                     <p className="text-sm text-muted-foreground whitespace-pre-wrap" data-testid="text-agreement-notes">
                       {agreement.notes}
                     </p>
                   </CardContent>
                 </Card>
               )}
            </TabsContent>

            <TabsContent value="timeline" className="pt-6">
              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {relatedActivities.map((activity) => (
                  <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {activity.type === "Email" ? <Mail className="w-4 h-4 text-muted-foreground" /> : 
                       activity.type === "Call" ? <Phone className="w-4 h-4 text-muted-foreground" /> :
                       <FileText className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    
                    <Card className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-bold text-sm">{activity.type}</span>
                        <time className="text-xs text-muted-foreground">{format(new Date(activity.date), 'MMM d, HH:mm')}</time>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{activity.content}</p>
                      <div className="text-xs text-primary font-medium">{activity.user}</div>
                    </Card>
                  </div>
                ))}
                {relatedActivities.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">No activities recorded yet.</div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="documents" className="pt-6">
              <div className="flex justify-end mb-4">
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Document
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Document</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleUpload} className="space-y-4">
                      <div className="space-y-2">
                        <Label>File</Label>
                        <Input type="file" onChange={e => setUploadFile(e.target.files?.[0] || null)} required />
                      </div>
                      <DialogFooter>
                        <Button type="submit">Upload</Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {relatedDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center rounded">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">Uploaded {format(new Date(doc.dateUploaded), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <a href={getDocumentDownloadUrl(doc.id)} download>
                              <Download className="h-4 w-4 mr-2" /> Download
                            </a>
                          </Button>
                          <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleDeleteDoc(doc.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {relatedDocuments.length === 0 && (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        No documents attached.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Column: Party & Contacts */}
        <div className="space-y-6">
          <Card>
             <CardHeader>
               <CardTitle className="text-base">Counterparty</CardTitle>
             </CardHeader>
             <CardContent>
               <div className="flex flex-col gap-4">
                 <div className="flex items-start gap-3">
                   <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                     <Shield className="h-5 w-5 text-primary" />
                   </div>
                   <div>
                     <p className="font-bold text-foreground">{party?.name}</p>
                     <p className="text-xs text-muted-foreground">{party?.type}</p>
                   </div>
                 </div>
                 
                 <Separator />
                 
                 <div className="space-y-2 text-sm">
                   <div className="flex items-center gap-2 text-muted-foreground">
                     <Mail className="h-3 w-3" /> {party?.email}
                   </div>
                   <div className="flex items-center gap-2 text-muted-foreground">
                     <Phone className="h-3 w-3" /> {party?.phone}
                   </div>
                 </div>
               </div>
             </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Related Persons</CardTitle>
              <Button variant="ghost" size="icon" className="h-8 w-8"><Plus className="h-4 w-4" /></Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {relatedPersons.map(person => (
                  <div key={person.id} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{person.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{person.name}</p>
                        <p className="text-xs text-muted-foreground">{person.role}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {relatedPersons.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No persons listed.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
