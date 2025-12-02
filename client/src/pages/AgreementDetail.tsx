import { agreements, parties, activities, documents, persons } from "@/lib/mockData";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  DollarSign, 
  FileText, 
  Shield, 
  User, 
  Download, 
  Plus, 
  Phone, 
  Mail,
  AlertTriangle
} from "lucide-react";
import { format } from "date-fns";

export default function AgreementDetail() {
  const [, params] = useRoute("/agreements/:id");
  const id = params?.id;
  
  const agreement = agreements.find(a => a.id === id);
  
  if (!agreement) {
    return <div className="p-8 text-center">Agreement not found</div>;
  }

  const party = parties.find(p => p.id === agreement.partyId);
  const relatedActivities = activities.filter(a => a.agreementId === id).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const relatedDocuments = documents.filter(d => d.agreementId === id);
  const relatedPersons = persons.filter(p => p.partyId === agreement.partyId);

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

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
          <Button variant="outline">Edit Agreement</Button>
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
            </TabsContent>

            <TabsContent value="timeline" className="pt-6">
              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                {relatedActivities.map((activity) => (
                  <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-background shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                      {activity.type === "Email" ? <Mail className="w-4 h-4 text-muted-foreground" /> : 
                       activity.type === "Call" ? <Phone className="w-4 h-4 text-muted-foreground" /> :
                       <FileText className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    
                    {/* Card */}
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
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {relatedDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-muted flex items-center justify-center rounded">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium text-sm">{doc.name}</p>
                            <p className="text-xs text-muted-foreground">Uploaded {format(new Date(doc.dateUploaded), 'MMM d, yyyy')}</p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4 mr-2" /> Download
                        </Button>
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
