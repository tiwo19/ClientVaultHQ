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
  Users,
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
import { 
  getDocumentDownloadUrl,
  fetchContactPointsByParty,
  createContactPoint,
  deleteContactPoint,
  fetchAddressesByParty,
  createAddress,
  deleteAddress
} from "@/lib/api";
import { DocumentCategory } from "@/lib/mockData";
import { Checkbox } from "@/components/ui/checkbox";
import type { ContactPoint, Address } from "@shared/schema";

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
  const { parties, persons, agreements, documents, activities, partyRelationships, addDocument, removeDocument, addPerson, removePerson, addActivity, removeActivity, updateParty, addPartyRelationship, removePartyRelationship, isLoading } = useData();
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
  const [activityImage, setActivityImage] = useState<File | null>(null);
  const [activityImagePreview, setActivityImagePreview] = useState<string | null>(null);
  const [isSubmittingActivity, setIsSubmittingActivity] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("Company");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editTaxId, setEditTaxId] = useState("");
  const [editJurisdiction, setEditJurisdiction] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [isAddRelationshipOpen, setIsAddRelationshipOpen] = useState(false);
  const [relToPartyId, setRelToPartyId] = useState("");
  const [relType, setRelType] = useState("Parent");
  const [relNotes, setRelNotes] = useState("");

  const [contactPoints, setContactPoints] = useState<ContactPoint[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoadingDueDiligence, setIsLoadingDueDiligence] = useState(false);

  const [isAddContactPointOpen, setIsAddContactPointOpen] = useState(false);
  const [cpType, setCpType] = useState<"email" | "phone">("email");
  const [cpValue, setCpValue] = useState("");
  const [cpLabel, setCpLabel] = useState("Work");
  const [cpIsPrimary, setCpIsPrimary] = useState(false);
  const [cpIsVerified, setCpIsVerified] = useState(false);
  const [cpNotes, setCpNotes] = useState("");

  const [isAddAddressOpen, setIsAddAddressOpen] = useState(false);
  const [addrLabel, setAddrLabel] = useState("Primary");
  const [addrStreet1, setAddrStreet1] = useState("");
  const [addrStreet2, setAddrStreet2] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPostalCode, setAddrPostalCode] = useState("");
  const [addrCountry, setAddrCountry] = useState("USA");
  const [addrIsPrimary, setAddrIsPrimary] = useState(false);
  const [addrIsVerified, setAddrIsVerified] = useState(false);
  const [addrNotes, setAddrNotes] = useState("");

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

  useEffect(() => {
    if (id) {
      const fetchDueDiligenceData = async () => {
        setIsLoadingDueDiligence(true);
        try {
          const [contactPointsData, addressesData] = await Promise.all([
            fetchContactPointsByParty(id),
            fetchAddressesByParty(id)
          ]);
          setContactPoints(contactPointsData);
          setAddresses(addressesData);
        } catch (error) {
          console.error("Failed to fetch due diligence data:", error);
        } finally {
          setIsLoadingDueDiligence(false);
        }
      };
      fetchDueDiligenceData();
    }
  }, [id]);
  
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
  
  const relatedRelationships = partyRelationships.filter(r => r.fromPartyId === id || r.toPartyId === id);
  const otherParties = parties.filter(p => p.id !== id);

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
    if (!id || !activityContent.trim() || isSubmittingActivity) return;

    setIsSubmittingActivity(true);
    try {
      let imageUrl: string | null = null;
      
      if (activityImage) {
        const uploadedDoc = await addDocument({
          partyId: id,
          name: `Screenshot_${format(new Date(), "yyyy-MM-dd_HHmmss")}.png`,
          type: "Image",
          category: "Other",
          file: activityImage
        });
        if (uploadedDoc?.filePath) {
          imageUrl = `/api/documents/${uploadedDoc.id}/download`;
        }
      }
      
      await addActivity({
        partyId: id,
        agreementId: null,
        type: activityType,
        content: activityContent,
        date: activityDate,
        imageUrl
      });
      
      setIsLogActivityOpen(false);
      resetActivityForm();
      toast({ title: "Activity Logged", description: `${activityType} has been recorded.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to log activity.", variant: "destructive" });
    } finally {
      setIsSubmittingActivity(false);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (confirm("Are you sure you want to delete this activity entry?")) {
      try {
        await removeActivity(activityId);
        toast({ title: "Activity Deleted" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete activity.", variant: "destructive" });
      }
    }
  };

  const handleActivityPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const timestamp = format(new Date(), "yyyyMMdd_HHmmss");
          const file = new File([blob], `screenshot_${timestamp}.png`, { type: "image/png" });
          setActivityImage(file);
          const reader = new FileReader();
          reader.onload = (event) => {
            setActivityImagePreview(event.target?.result as string);
          };
          reader.readAsDataURL(blob);
          toast({ title: "Image Pasted", description: "Screenshot attached to activity." });
        }
        break;
      }
    }
  };

  const removeActivityImage = () => {
    setActivityImage(null);
    setActivityImagePreview(null);
  };

  const resetActivityForm = () => {
    setActivityType("Call");
    setActivityContent("");
    setActivityDate(format(new Date(), "yyyy-MM-dd"));
    setActivityImage(null);
    setActivityImagePreview(null);
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

  const handleAddRelationship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !relToPartyId) return;

    try {
      await addPartyRelationship({
        fromPartyId: id,
        toPartyId: relToPartyId,
        relationshipType: relType,
        notes: relNotes || undefined
      });
      setIsAddRelationshipOpen(false);
      setRelToPartyId("");
      setRelType("Parent");
      setRelNotes("");
      toast({ title: "Relationship Added", description: "Party relationship has been created." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add relationship.", variant: "destructive" });
    }
  };

  const handleRemoveRelationship = async (relationshipId: string) => {
    if (confirm("Are you sure you want to remove this relationship?")) {
      try {
        await removePartyRelationship(relationshipId);
        toast({ title: "Relationship Removed" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to remove relationship.", variant: "destructive" });
      }
    }
  };

  const handleAddContactPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!cpValue.trim()) {
      toast({ title: "Validation Error", description: "Please enter a value for the contact point.", variant: "destructive" });
      return;
    }

    if (cpType === "email" && !cpValue.includes("@")) {
      toast({ title: "Validation Error", description: "Please enter a valid email address.", variant: "destructive" });
      return;
    }

    try {
      const newContactPoint = await createContactPoint({
        ownerType: "party",
        partyId: id,
        type: cpType,
        value: cpValue.trim(),
        label: cpLabel,
        isPrimary: cpIsPrimary,
        isVerified: cpIsVerified,
        notes: cpNotes || undefined
      });
      setContactPoints([...contactPoints, newContactPoint]);
      setIsAddContactPointOpen(false);
      resetContactPointForm();
      toast({ title: "Contact Point Added", description: `${cpType === "email" ? "Email" : "Phone"} has been added.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add contact point.", variant: "destructive" });
    }
  };

  const resetContactPointForm = () => {
    setCpType("email");
    setCpValue("");
    setCpLabel("Work");
    setCpIsPrimary(false);
    setCpIsVerified(false);
    setCpNotes("");
  };

  const handleDeleteContactPoint = async (contactPointId: string) => {
    if (confirm("Are you sure you want to delete this contact point?")) {
      try {
        await deleteContactPoint(contactPointId);
        setContactPoints(contactPoints.filter(cp => cp.id !== contactPointId));
        toast({ title: "Contact Point Deleted" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete contact point.", variant: "destructive" });
      }
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    if (!addrStreet1.trim()) {
      toast({ title: "Validation Error", description: "Street address is required.", variant: "destructive" });
      return;
    }

    if (!addrCity.trim()) {
      toast({ title: "Validation Error", description: "City is required.", variant: "destructive" });
      return;
    }

    try {
      const newAddress = await createAddress({
        ownerType: "party",
        partyId: id,
        label: addrLabel,
        street1: addrStreet1.trim(),
        street2: addrStreet2.trim() || undefined,
        city: addrCity.trim(),
        state: addrState.trim() || undefined,
        postalCode: addrPostalCode.trim() || undefined,
        country: addrCountry,
        isPrimary: addrIsPrimary,
        isVerified: addrIsVerified,
        notes: addrNotes || undefined
      });
      setAddresses([...addresses, newAddress]);
      setIsAddAddressOpen(false);
      resetAddressForm();
      toast({ title: "Address Added", description: "Address has been added." });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add address.", variant: "destructive" });
    }
  };

  const resetAddressForm = () => {
    setAddrLabel("Primary");
    setAddrStreet1("");
    setAddrStreet2("");
    setAddrCity("");
    setAddrState("");
    setAddrPostalCode("");
    setAddrCountry("USA");
    setAddrIsPrimary(false);
    setAddrIsVerified(false);
    setAddrNotes("");
  };

  const handleDeleteAddress = async (addressId: string) => {
    if (confirm("Are you sure you want to delete this address?")) {
      try {
        await deleteAddress(addressId);
        setAddresses(addresses.filter(a => a.id !== addressId));
        toast({ title: "Address Deleted" });
      } catch (error) {
        toast({ title: "Error", description: "Failed to delete address.", variant: "destructive" });
      }
    }
  };

  const getRelatedParty = (relationship: typeof partyRelationships[0]) => {
    const relatedPartyId = relationship.fromPartyId === id ? relationship.toPartyId : relationship.fromPartyId;
    return parties.find(p => p.id === relatedPartyId);
  };

  const getRelationshipDirection = (relationship: typeof partyRelationships[0]) => {
    return relationship.fromPartyId === id ? "outgoing" : "incoming";
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
            <div className="overflow-x-auto">
              <TabsList className="w-max min-w-full justify-start border-b rounded-none h-auto p-0 bg-transparent gap-2">
                <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap">
                  <Clock className="h-4 w-4 mr-1.5" />
                  Timeline ({partyActivities.length})
                </TabsTrigger>
                <TabsTrigger value="contact" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap" data-testid="tab-contact-info">
                  <Shield className="h-4 w-4 mr-1.5" />
                  Contact Info ({contactPoints.length + addresses.length})
                </TabsTrigger>
                <TabsTrigger value="identity" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap">
                  <User className="h-4 w-4 mr-1.5" />
                  Identity ({identityDocs.length})
                </TabsTrigger>
                <TabsTrigger value="corporate" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap">
                  <Building2 className="h-4 w-4 mr-1.5" />
                  Corporate ({corporateDocs.length})
                </TabsTrigger>
                <TabsTrigger value="other" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap">
                  <FileText className="h-4 w-4 mr-1.5" />
                  Other ({otherDocs.length})
                </TabsTrigger>
                <TabsTrigger value="relationships" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none px-3 py-3 text-sm whitespace-nowrap">
                  <Users className="h-4 w-4 mr-1.5" />
                  Relationships ({relatedRelationships.length})
                </TabsTrigger>
              </TabsList>
            </div>
            
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
                          onPaste={handleActivityPaste}
                          required 
                          placeholder="Describe the interaction or note... (Paste screenshots with Ctrl+V)"
                          rows={4}
                          data-testid="input-activity-content"
                        />
                      </div>
                      
                      {activityImagePreview && (
                        <div className="space-y-2">
                          <Label>Attached Screenshot</Label>
                          <div className="relative border rounded-lg p-2 bg-muted/50">
                            <img 
                              src={activityImagePreview} 
                              alt="Screenshot preview" 
                              className="max-h-48 rounded object-contain mx-auto"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-2 right-2"
                              onClick={removeActivityImage}
                              data-testid="button-remove-activity-image"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      {!activityImagePreview && (
                        <div className="text-xs text-muted-foreground text-center py-2 border border-dashed rounded-lg">
                          <Upload className="h-4 w-4 inline-block mr-1" />
                          Paste a screenshot (Ctrl+V) in the text area above
                        </div>
                      )}
                      
                      <DialogFooter>
                        <Button type="submit" disabled={!activityContent.trim() || isSubmittingActivity} data-testid="button-submit-activity">
                          {isSubmittingActivity ? "Saving..." : "Log Activity"}
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
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(activity.date), 'MMM d, yyyy h:mm a')}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => handleDeleteActivity(activity.id)}
                                    data-testid={`button-delete-activity-${activity.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-foreground">{activity.content}</p>
                              {activity.imageUrl && (
                                <div className="mt-3">
                                  <img 
                                    src={activity.imageUrl} 
                                    alt="Activity screenshot" 
                                    className="max-h-64 rounded-lg border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                                    onClick={() => window.open(activity.imageUrl!, '_blank')}
                                    data-testid={`activity-image-${activity.id}`}
                                  />
                                </div>
                              )}
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

            <TabsContent value="relationships" className="pt-6">
              <div className="flex justify-end mb-4">
                <Dialog open={isAddRelationshipOpen} onOpenChange={setIsAddRelationshipOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-add-relationship">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Relationship
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Party Relationship</DialogTitle>
                      <DialogDescription>
                        Link this party to another party (e.g., Parent Company, Guarantor, Joint Venture Partner).
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleAddRelationship} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Related Party</Label>
                        <Select value={relToPartyId} onValueChange={setRelToPartyId}>
                          <SelectTrigger data-testid="select-related-party">
                            <SelectValue placeholder="Select a party..." />
                          </SelectTrigger>
                          <SelectContent>
                            {otherParties.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Relationship Type</Label>
                        <Select value={relType} onValueChange={setRelType}>
                          <SelectTrigger data-testid="select-relationship-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Parent">Parent Company</SelectItem>
                            <SelectItem value="Subsidiary">Subsidiary</SelectItem>
                            <SelectItem value="Affiliate">Affiliate</SelectItem>
                            <SelectItem value="Guarantor">Guarantor</SelectItem>
                            <SelectItem value="JVPartner">JV Partner</SelectItem>
                            <SelectItem value="Lender">Lender</SelectItem>
                            <SelectItem value="Borrower">Borrower</SelectItem>
                            <SelectItem value="Agent">Agent</SelectItem>
                            <SelectItem value="Trustee">Trustee</SelectItem>
                            <SelectItem value="Beneficiary">Beneficiary</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea 
                          value={relNotes} 
                          onChange={e => setRelNotes(e.target.value)} 
                          placeholder="Additional context about this relationship..."
                          rows={2}
                          data-testid="input-relationship-notes"
                        />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={!relToPartyId} data-testid="button-submit-relationship">
                          Add Relationship
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              
              {relatedRelationships.length > 0 ? (
                <div className="space-y-3">
                  {relatedRelationships.map(rel => {
                    const relatedParty = getRelatedParty(rel);
                    const direction = getRelationshipDirection(rel);
                    if (!relatedParty) return null;
                    
                    return (
                      <div key={rel.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors" data-testid={`relationship-${rel.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-primary/10 flex items-center justify-center rounded-full">
                            <Users className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/parties/${relatedParty.id}`}>
                                <span className="font-medium text-sm text-primary hover:underline cursor-pointer">{relatedParty.name}</span>
                              </Link>
                              <Badge variant="outline" className="text-[10px]">{relatedParty.type}</Badge>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="secondary" className="text-[10px]">
                                {direction === "outgoing" ? `→ ${rel.relationshipType}` : `← ${rel.relationshipType}`}
                              </Badge>
                              {rel.notes && <span className="text-xs text-muted-foreground italic">{rel.notes}</span>}
                            </div>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveRelationship(rel.id)}
                          data-testid={`button-remove-relationship-${rel.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No relationships defined yet.</p>
                  <p className="text-xs mt-1">Link this party to parent companies, subsidiaries, or guarantors.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="contact" className="pt-6 space-y-8">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Contact Points
                  </h3>
                  <Dialog open={isAddContactPointOpen} onOpenChange={setIsAddContactPointOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-contact-point">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Contact Point
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Add Contact Point</DialogTitle>
                        <DialogDescription>
                          Add an email address or phone number for this party.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddContactPoint} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select value={cpType} onValueChange={(v) => setCpType(v as "email" | "phone")}>
                              <SelectTrigger data-testid="select-cp-type">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="phone">Phone</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Label</Label>
                            <Select value={cpLabel} onValueChange={setCpLabel}>
                              <SelectTrigger data-testid="select-cp-label">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Work">Work</SelectItem>
                                <SelectItem value="Mobile">Mobile</SelectItem>
                                <SelectItem value="Home">Home</SelectItem>
                                <SelectItem value="Personal">Personal</SelectItem>
                                <SelectItem value="Fax">Fax</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Value</Label>
                          <Input 
                            value={cpValue} 
                            onChange={e => setCpValue(e.target.value)} 
                            required 
                            placeholder={cpType === "email" ? "email@example.com" : "+1 (555) 123-4567"}
                            data-testid="input-cp-value"
                          />
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="cp-primary" 
                              checked={cpIsPrimary} 
                              onCheckedChange={(checked) => setCpIsPrimary(!!checked)}
                              data-testid="checkbox-cp-primary"
                            />
                            <Label htmlFor="cp-primary" className="text-sm font-normal">Primary</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="cp-verified" 
                              checked={cpIsVerified} 
                              onCheckedChange={(checked) => setCpIsVerified(!!checked)}
                              data-testid="checkbox-cp-verified"
                            />
                            <Label htmlFor="cp-verified" className="text-sm font-normal">Verified</Label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (Optional)</Label>
                          <Textarea 
                            value={cpNotes} 
                            onChange={e => setCpNotes(e.target.value)} 
                            placeholder="Additional notes about this contact point..."
                            rows={2}
                            data-testid="input-cp-notes"
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={!cpValue.trim()} data-testid="button-submit-contact-point">
                            Add Contact Point
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {isLoadingDueDiligence ? (
                  <div className="text-center py-8 text-muted-foreground">Loading contact points...</div>
                ) : contactPoints.length > 0 ? (
                  <div className="space-y-3">
                    {contactPoints.map(cp => (
                      <div key={cp.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group" data-testid={`contact-point-${cp.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-full">
                            {cp.type === "email" ? <Mail className="h-5 w-5" /> : <Phone className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{cp.value}</span>
                              <Badge variant="outline" className="text-[10px]">{cp.label}</Badge>
                              {cp.isPrimary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                              {cp.isVerified && <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Verified</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground capitalize">{cp.type}</p>
                            {cp.notes && <p className="text-xs text-muted-foreground mt-1 italic">{cp.notes}</p>}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteContactPoint(cp.id)}
                          data-testid={`button-delete-contact-point-${cp.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No contact points recorded yet.</p>
                    <p className="text-xs mt-1">Add email addresses and phone numbers for due diligence.</p>
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Known Addresses
                  </h3>
                  <Dialog open={isAddAddressOpen} onOpenChange={setIsAddAddressOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" data-testid="button-add-address">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Address
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Add Address</DialogTitle>
                        <DialogDescription>
                          Add a known address for this party.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleAddAddress} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Label</Label>
                          <Select value={addrLabel} onValueChange={setAddrLabel}>
                            <SelectTrigger data-testid="select-addr-label">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Primary">Primary</SelectItem>
                              <SelectItem value="Mailing">Mailing</SelectItem>
                              <SelectItem value="Business">Business</SelectItem>
                              <SelectItem value="Registered">Registered</SelectItem>
                              <SelectItem value="Previous">Previous</SelectItem>
                              <SelectItem value="Alternate">Alternate</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Street Address 1</Label>
                          <Input 
                            value={addrStreet1} 
                            onChange={e => setAddrStreet1(e.target.value)} 
                            required 
                            placeholder="123 Main Street"
                            data-testid="input-addr-street1"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Street Address 2 (Optional)</Label>
                          <Input 
                            value={addrStreet2} 
                            onChange={e => setAddrStreet2(e.target.value)} 
                            placeholder="Suite 100, Floor 2, etc."
                            data-testid="input-addr-street2"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>City</Label>
                            <Input 
                              value={addrCity} 
                              onChange={e => setAddrCity(e.target.value)} 
                              required 
                              placeholder="New York"
                              data-testid="input-addr-city"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>State</Label>
                            <Input 
                              value={addrState} 
                              onChange={e => setAddrState(e.target.value)} 
                              placeholder="NY"
                              data-testid="input-addr-state"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Postal Code</Label>
                            <Input 
                              value={addrPostalCode} 
                              onChange={e => setAddrPostalCode(e.target.value)} 
                              placeholder="10001"
                              data-testid="input-addr-postal"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Country</Label>
                            <Input 
                              value={addrCountry} 
                              onChange={e => setAddrCountry(e.target.value)} 
                              placeholder="USA"
                              data-testid="input-addr-country"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="addr-primary" 
                              checked={addrIsPrimary} 
                              onCheckedChange={(checked) => setAddrIsPrimary(!!checked)}
                              data-testid="checkbox-addr-primary"
                            />
                            <Label htmlFor="addr-primary" className="text-sm font-normal">Primary</Label>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox 
                              id="addr-verified" 
                              checked={addrIsVerified} 
                              onCheckedChange={(checked) => setAddrIsVerified(!!checked)}
                              data-testid="checkbox-addr-verified"
                            />
                            <Label htmlFor="addr-verified" className="text-sm font-normal">Verified</Label>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Notes (Optional)</Label>
                          <Textarea 
                            value={addrNotes} 
                            onChange={e => setAddrNotes(e.target.value)} 
                            placeholder="Additional notes about this address..."
                            rows={2}
                            data-testid="input-addr-notes"
                          />
                        </div>
                        <DialogFooter>
                          <Button type="submit" disabled={!addrStreet1.trim() || !addrCity.trim()} data-testid="button-submit-address">
                            Add Address
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                
                {isLoadingDueDiligence ? (
                  <div className="text-center py-8 text-muted-foreground">Loading addresses...</div>
                ) : addresses.length > 0 ? (
                  <div className="space-y-3">
                    {addresses.map(addr => (
                      <div key={addr.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors group" data-testid={`address-${addr.id}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center rounded-full">
                            <MapPin className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-[10px]">{addr.label}</Badge>
                              {addr.isPrimary && <Badge variant="default" className="text-[10px]">Primary</Badge>}
                              {addr.isVerified && <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700">Verified</Badge>}
                            </div>
                            <p className="text-sm font-medium">
                              {addr.street1}
                              {addr.street2 && `, ${addr.street2}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {addr.city}
                              {addr.state && `, ${addr.state}`}
                              {addr.postalCode && ` ${addr.postalCode}`}
                              {addr.country && `, ${addr.country}`}
                            </p>
                            {addr.notes && <p className="text-xs text-muted-foreground mt-1 italic">{addr.notes}</p>}
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteAddress(addr.id)}
                          data-testid={`button-delete-address-${addr.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                    <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No addresses recorded yet.</p>
                    <p className="text-xs mt-1">Add known addresses for due diligence.</p>
                  </div>
                )}
              </div>
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
