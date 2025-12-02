import { useData } from "@/lib/data";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  FileText, 
  User, 
  Download, 
  Plus, 
  Phone, 
  Mail,
  Upload,
  Trash2,
  Building2,
  MapPin,
  CreditCard,
  Shield,
  Calendar,
  AlertTriangle,
  FileCheck,
  Clock,
  MessageSquare,
  Video,
  Send,
  FileEdit,
  Gavel,
  Pencil
} from "lucide-react";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getDocumentDownloadUrl } from "@/lib/api";
import { DocumentCategory } from "@/lib/mockData";

const IDENTITY_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "Passport", label: "Passport" },
  { value: "DriversLicense", label: "Driver's License" },
  { value: "StateID", label: "State ID" },
  { value: "ProofOfAddress", label: "Proof of Address" },
  { value: "SSNCard", label: "SSN Card" },
];

const CORPORATE_CATEGORIES: { value: DocumentCategory; label: string }[] = [
  { value: "EIN", label: "EIN / Tax ID" },
  { value: "ArticlesOfIncorporation", label: "Articles of Incorporation" },
  { value: "OperatingAgreement", label: "Operating Agreement" },
  { value: "CertificateOfGoodStanding", label: "Certificate of Good Standing" },
  { value: "InsuranceBinder", label: "Insurance Binder" },
  { value: "W9", label: "W-9 Form" },
  { value: "BankStatement", label: "Bank Statement" },
  { value: "FinancialStatement", label: "Financial Statement" },
];

const ALL_CATEGORIES = [...IDENTITY_CATEGORIES, ...CORPORATE_CATEGORIES, { value: "Other" as DocumentCategory, label: "Other" }];

function getCategoryLabel(category: string) {
  return ALL_CATEGORIES.find(c => c.value === category)?.label || category;
}

function getCategoryIcon(category: string) {
  if (IDENTITY_CATEGORIES.some(c => c.value === category)) {
    return <User className="h-4 w-4" />;
  }
  if (CORPORATE_CATEGORIES.some(c => c.value === category)) {
    return <Building2 className="h-4 w-4" />;
  }
  return <FileText className="h-4 w-4" />;
}

function getActivityIcon(type: string) {
  switch (type) {
    case "Call": return <Phone className="h-4 w-4" />;
    case "Email": return <Mail className="h-4 w-4" />;
    case "Meeting": return <Video className="h-4 w-4" />;
    case "LetterSent": return <Send className="h-4 w-4" />;
    case "InternalNote": return <FileEdit className="h-4 w-4" />;
    case "CourtFiling": return <Gavel className="h-4 w-4" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
}

function getActivityColor(type: string) {
  switch (type) {
    case "Call": return "bg-blue-500";
    case "Email": return "bg-green-500";
    case "Meeting": return "bg-purple-500";
    case "LetterSent": return "bg-orange-500";
    case "InternalNote": return "bg-gray-500";
    case "CourtFiling": return "bg-red-500";
    default: return "bg-primary";
  }
}

export default function PartyDetail() {
  const [, params] = useRoute("/parties/:id");
  const id = params?.id;
  const { parties, persons, agreements, documents, activities, addDocument, removeDocument, addPerson, removePerson, addActivity, updateParty, isLoading } = useData();
  const { toast } = useToast();
  
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>("Other");
  const [uploadExpiration, setUploadExpiration] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  
  const [isAddContactOpen, setIsAddContactOpen] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactRole, setContactRole] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const [isLogActivityOpen, setIsLogActivityOpen] = useState(false);
  const [activityType, setActivityType] = useState<string>("Call");
  const [activityContent, setActivityContent] = useState("");
  const [activityDate, setActivityDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Company");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTaxId, setEditTaxId] = useState("");
  const [editJurisdiction, setEditJurisdiction] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const party = parties.find(p => p.id === id);
  
  useEffect(() => {
    if (party) {
      setEditName(party.name);
      setEditType(party.type);
      setEditEmail(party.email || "");
      setEditPhone(party.phone || "");
      setEditAddress(party.address || "");
      setEditTaxId(party.taxId || "");
      setEditJurisdiction(party.jurisdictionOfFormation || "");
      setEditNotes(party.notes || "");
    }
  }, [party]);
  
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  if (!party) {
    return <div className="p-8 text-center">Party not found</div>;
  }

  const relatedPersons = persons.filter(p => p.partyId === id);
  const relatedAgreements = agreements.filter(a => a.partyId === id);
  const partyDocuments = documents.filter(d => d.partyId === id);
  
  const identityDocs = partyDocuments.filter(d => IDENTITY_CATEGORIES.some(c => c.value === d.category));
  const corporateDocs = partyDocuments.filter(d => CORPORATE_CATEGORIES.some(c => c.value === d.category));
  const otherDocs = partyDocuments.filter(d => !IDENTITY_CATEGORIES.some(c => c.value === d.category) && !CORPORATE_CATEGORIES.some(c => c.value === d.category));

  const relatedAgreementIds = relatedAgreements.map(a => a.id);
  const partyActivities = activities
    .filter(a => a.partyId === id || (a.agreementId && relatedAgreementIds.includes(a.agreementId)))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    try {
      await addDocument({
        partyId: id,
        name: uploadFile.name,
        type: "PDF",
        category: uploadCategory,
        expirationDate: uploadExpiration || undefined,
        notes: uploadNotes || undefined,
        file: uploadFile
      });
      
      setIsUploadOpen(false);
      resetUploadForm();
      toast({ title: "Document Uploaded", description: `${getCategoryLabel(uploadCategory)} has been added to this party.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to upload document.", variant: "destructive" });
    }
  };

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadCategory("Other");
    setUploadExpiration("");
    setUploadNotes("");
  };

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      await addPerson({
        partyId: id,
        name: contactName,
        role: contactRole,
        email: contactEmail,
        phone: contactPhone
      });
      
      setIsAddContactOpen(false);
      resetContactForm();
      toast({ title: "Contact Added", description: `${contactName} has been added as a contact.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add contact.", variant: "destructive" });
    }
  };

  const resetContactForm = () => {
    setContactName("");
    setContactRole("");
    setContactEmail("");
    setContactPhone("");
  };

  const handleDeleteContact = async (personId: string, personName: string) => {
    if (confirm(`Are you sure you want to remove ${personName} as a contact?`)) {
      try {
        await removePerson(personId);
        toast({ title: "Contact Removed" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to remove contact.", variant: "destructive" });
      }
    }
  };

  const handleLogActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !activityContent.trim()) return;

    try {
      await addActivity({
        partyId: id,
        agreementId: null,
        type: activityType,
        content: activityContent,
        date: activityDate
      });
      
      setIsLogActivityOpen(false);
      resetActivityForm();
      toast({ title: "Activity Logged", description: `${activityType} has been recorded.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
    }
  };

  const resetActivityForm = () => {
    setActivityType("Call");
    setActivityContent("");
    setActivityDate(format(new Date(), "yyyy-MM-dd"));
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

  const handleEditParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      await updateParty(id, {
        name: editName,
        type: editType as any,
        email: editEmail || null,
        phone: editPhone || null,
        address: editAddress || null,
        taxId: editTaxId || null,
        jurisdictionOfFormation: editJurisdiction || null,
        notes: editNotes || null
      });
      setIsEditOpen(false);
      toast({ title: "Party Updated", description: "Changes have been saved." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update party.", variant: "destructive" });
    }
  };

  const isExpiringSoon = (expirationDate: string | null | undefined) => {
    if (!expirationDate) return false;
    const expDate = new Date(expirationDate);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isExpired = (expirationDate: string | null | undefined) => {
    if (!expirationDate) return false;
    return new Date(expirationDate) < new Date();
  };

  const DocumentCard = ({ doc }: { doc: typeof documents[0] }) => (
    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 bg-muted flex items-center justify-center rounded">
          {getCategoryIcon(doc.category)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-sm">{doc.name}</p>
            {isExpired(doc.expirationDate) && (
              <Badge variant="destructive" className="text-[10px]">Expired</Badge>
            )}
            {isExpiringSoon(doc.expirationDate) && !isExpired(doc.expirationDate) && (
              <Badge variant="outline" className="text-[10px] border-yellow-500 text-yellow-600">Expiring Soon</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {getCategoryLabel(doc.category)}
            {doc.expirationDate && ` • Expires ${format(new Date(doc.expirationDate), 'MMM d, yyyy')}`}
          </p>
          {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {doc.filePath && (
          <Button variant="ghost" size="sm" asChild data-testid={`button-download-doc-${doc.id}`}>
            <a href={getDocumentDownloadUrl(doc.id)} download>
              <Download className="h-4 w-4 mr-2" /> Download
            </a>
          </Button>
        )}
        <Button 
          variant="ghost" 
          size="icon" 
          className="opacity-0 group-hover:opacity-100 transition-opacity" 
          onClick={() => handleDeleteDoc(doc.id)}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="outline" className="uppercase tracking-wider">{party.type}</Badge>
          </div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{party.name}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {party.email}</span>
            <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {party.phone}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" /> {party.address}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-edit-party">
                <Pencil className="mr-2 h-4 w-4" />
                Edit Party
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Edit Party</DialogTitle>
                <DialogDescription>
                  Update party information.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEditParty} className="space-y-4">
                <div className="space-y-2">
                  <Label>Party Name</Label>
                  <Input 
                    value={editName} 
                    onChange={e => setEditName(e.target.value)} 
                    required 
                    data-testid="input-edit-party-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Party Type</Label>
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger data-testid="select-edit-party-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Company">Company</SelectItem>
                      <SelectItem value="Individual">Individual</SelectItem>
                      <SelectItem value="Trust">Trust</SelectItem>
                      <SelectItem value="Bank">Bank</SelectItem>
                      <SelectItem value="Fund">Fund</SelectItem>
                      <SelectItem value="JVPartner">JV Partner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      type="email"
                      value={editEmail} 
                      onChange={e => setEditEmail(e.target.value)}
                      data-testid="input-edit-party-email"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={editPhone} 
                      onChange={e => setEditPhone(e.target.value)}
                      data-testid="input-edit-party-phone"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Address</Label>
                  <Input 
                    value={editAddress} 
                    onChange={e => setEditAddress(e.target.value)}
                    data-testid="input-edit-party-address"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tax ID / EIN</Label>
                    <Input 
                      value={editTaxId} 
                      onChange={e => setEditTaxId(e.target.value)}
                      data-testid="input-edit-party-taxid"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Jurisdiction</Label>
                    <Input 
                      value={editJurisdiction} 
                      onChange={e => setEditJurisdiction(e.target.value)}
                      placeholder="e.g. Delaware"
                      data-testid="input-edit-party-jurisdiction"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea 
                    value={editNotes} 
                    onChange={e => setEditNotes(e.target.value)}
                    placeholder="Internal notes about this party..."
                    rows={3}
                    data-testid="input-edit-party-notes"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" data-testid="button-save-party">Save Changes</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload Document</DialogTitle>
                <DialogDescription>
                  Add identity or corporate documents to this party.
                </DialogDescription>
              </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={uploadCategory} onValueChange={(v: any) => setUploadCategory(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header-identity" disabled className="font-bold text-xs text-muted-foreground">
                      — Identity Documents —
                    </SelectItem>
                    {IDENTITY_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                    <SelectItem value="header-corporate" disabled className="font-bold text-xs text-muted-foreground mt-2">
                      — Corporate Documents —
                    </SelectItem>
                    {CORPORATE_CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                    <Separator className="my-1" />
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>File</Label>
                <Input 
                  type="file" 
                  onChange={e => setUploadFile(e.target.files?.[0] || null)} 
                  required 
                  className="cursor-pointer"
                />
              </div>

              <div className="space-y-2">
                <Label>Expiration Date (Optional)</Label>
                <Input 
                  type="date" 
                  value={uploadExpiration} 
                  onChange={e => setUploadExpiration(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">For licenses, insurance, or other documents that expire</p>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea 
                  value={uploadNotes} 
                  onChange={e => setUploadNotes(e.target.value)} 
                  placeholder="Any additional notes about this document..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="submit" disabled={!uploadFile}>Upload Document</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-6">
              <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">
                <Clock className="h-4 w-4 mr-2" />
                Timeline ({partyActivities.length})
              </TabsTrigger>
              <TabsTrigger value="identity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">
                <User className="h-4 w-4 mr-2" />
                Identity ({identityDocs.length})
              </TabsTrigger>
              <TabsTrigger value="corporate" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">
                <Building2 className="h-4 w-4 mr-2" />
                Corporate ({corporateDocs.length})
              </TabsTrigger>
              <TabsTrigger value="other" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-4 py-3">
                <FileText className="h-4 w-4 mr-2" />
                Other ({otherDocs.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="timeline" className="pt-6">
              <div className="flex justify-end mb-4">
                <Dialog open={isLogActivityOpen} onOpenChange={setIsLogActivityOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-log-activity">
                      <Plus className="h-4 w-4 mr-2" />
                      Log Activity
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Log Activity</DialogTitle>
                      <DialogDescription>
                        Record a call, email, meeting, or internal note.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleLogActivity} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Type</Label>
                          <Select value={activityType} onValueChange={setActivityType}>
                            <SelectTrigger data-testid="select-activity-type">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Call">Phone Call</SelectItem>
                              <SelectItem value="Email">Email</SelectItem>
                              <SelectItem value="Meeting">Meeting</SelectItem>
                              <SelectItem value="LetterSent">Letter Sent</SelectItem>
                              <SelectItem value="InternalNote">Internal Note</SelectItem>
                              <SelectItem value="CourtFiling">Court Filing</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Date</Label>
                          <Input 
                            type="date" 
                            value={activityDate} 
                            onChange={e => setActivityDate(e.target.value)}
                            required
                            data-testid="input-activity-date"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Details</Label>
                        <Textarea 
                          value={activityContent} 
                          onChange={e => setActivityContent(e.target.value)} 
                          required 
                          placeholder="Describe the interaction or note..."
                          rows={4}
                          data-testid="input-activity-content"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={!activityContent.trim()} data-testid="button-submit-activity">
                          Log Activity
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              {partyActivities.length > 0 ? (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                  <div className="space-y-6">
                    {partyActivities.map((activity, index) => {
                      const linkedAgreement = activity.agreementId 
                        ? relatedAgreements.find(a => a.id === activity.agreementId)
                        : null;
                      
                      return (
                        <div key={activity.id} className="relative pl-10" data-testid={`timeline-item-${activity.id}`}>
                          <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center text-white ${getActivityColor(activity.type)}`}>
                            {getActivityIcon(activity.type)}
                          </div>
                          <Card className="hover:shadow-md transition-shadow">
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] uppercase">
                                    {activity.type.replace(/([A-Z])/g, ' $1').trim()}
                                  </Badge>
                                  {linkedAgreement && (
                                    <Link href={`/agreements/${linkedAgreement.id}`}>
                                      <Badge variant="secondary" className="text-[10px] cursor-pointer hover:bg-primary/20">
                                        {linkedAgreement.title}
                                      </Badge>
                                    </Link>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground">
                                  {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                                </span>
                              </div>
                              <p className="text-sm text-foreground">{activity.content}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                by {activity.user}
                              </p>
                            </CardContent>
                          </Card>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No activities recorded yet.</p>
                  <p className="text-xs mt-1">Calls, emails, meetings, and notes will appear here.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="identity" className="pt-6 space-y-3">
              {identityDocs.length > 0 ? (
                identityDocs.map(doc => <DocumentCard key={doc.id} doc={doc} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No identity documents uploaded yet.</p>
                  <p className="text-xs mt-1">Upload passports, driver's licenses, or proof of address.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="corporate" className="pt-6 space-y-3">
              {corporateDocs.length > 0 ? (
                corporateDocs.map(doc => <DocumentCard key={doc.id} doc={doc} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No corporate documents uploaded yet.</p>
                  <p className="text-xs mt-1">Upload EIN, Articles of Incorporation, or Insurance binders.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="other" className="pt-6 space-y-3">
              {otherDocs.length > 0 ? (
                otherDocs.map(doc => <DocumentCard key={doc.id} doc={doc} />)
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No other documents uploaded yet.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Related Agreements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {relatedAgreements.length > 0 ? (
                <div className="space-y-3">
                  {relatedAgreements.map(agreement => (
                    <Link key={agreement.id} href={`/agreements/${agreement.id}`}>
                      <div className="p-3 border rounded-md hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className="text-[10px]">{agreement.type}</Badge>
                          <Badge variant={
                            agreement.performanceStatus === "InDefault" ? "destructive" :
                            agreement.performanceStatus === "Performing" ? "default" : "secondary"
                          } className="text-[10px]">
                            {agreement.performanceStatus}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-primary">{agreement.title}</p>
                        <p className="text-xs text-muted-foreground">
                          ${agreement.principalAmount.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No agreements linked to this party.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">Key Contacts</CardTitle>
              <Dialog open={isAddContactOpen} onOpenChange={setIsAddContactOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-add-contact">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Contact</DialogTitle>
                    <DialogDescription>
                      Add a new contact person for this party.
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddContact} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name</Label>
                      <Input 
                        value={contactName} 
                        onChange={e => setContactName(e.target.value)} 
                        required 
                        placeholder="John Smith"
                        data-testid="input-contact-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Input 
                        value={contactRole} 
                        onChange={e => setContactRole(e.target.value)} 
                        required 
                        placeholder="CFO, Legal Counsel, etc."
                        data-testid="input-contact-role"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Email</Label>
                        <Input 
                          type="email"
                          value={contactEmail} 
                          onChange={e => setContactEmail(e.target.value)} 
                          required 
                          placeholder="john@company.com"
                          data-testid="input-contact-email"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input 
                          value={contactPhone} 
                          onChange={e => setContactPhone(e.target.value)} 
                          required 
                          placeholder="(555) 123-4567"
                          data-testid="input-contact-phone"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" data-testid="button-submit-contact">Add Contact</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {relatedPersons.length > 0 ? (
                <div className="space-y-4">
                  {relatedPersons.map(person => (
                    <div key={person.id} className="flex items-center justify-between group" data-testid={`contact-${person.id}`}>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{person.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{person.name}</p>
                          <p className="text-xs text-muted-foreground">{person.role}</p>
                          <div className="flex items-center gap-3 mt-1">
                            {person.email && (
                              <a href={`mailto:${person.email}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {person.email}
                              </a>
                            )}
                            {person.phone && (
                              <a href={`tel:${person.phone}`} className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {person.phone}
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteContact(person.id, person.name)}
                        data-testid={`button-delete-contact-${person.id}`}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No contacts listed.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
