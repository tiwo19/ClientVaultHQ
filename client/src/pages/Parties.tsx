import { useData } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Plus, FileText, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PartyType } from "@/lib/mockData";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Parties() {
  const { parties, persons, documents, addParty, removeParty } = useData();
  const [search, setSearch] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();
  
  // Form State
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<PartyType>("Company");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAddress, setNewAddress] = useState("");

  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  const getPersonCount = (partyId: string) => persons.filter(p => p.partyId === partyId).length;
  const getDocumentCount = (partyId: string) => documents.filter(d => d.partyId === partyId).length;

  const handleAddParty = (e: React.FormEvent) => {
    e.preventDefault();
    addParty({
      name: newName,
      type: newType,
      email: newEmail || null,
      phone: newPhone || null,
      address: newAddress || null,
      notes: null,
      taxId: null,
      jurisdictionOfFormation: null
    });
    setIsAddOpen(false);
    resetForm();
    toast({ title: "Party Added", description: `${newName} has been added.` });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to remove this party?")) {
      removeParty(id);
      toast({ title: "Party Removed", description: "Party has been removed from the system." });
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewType("Company");
    setNewEmail("");
    setNewPhone("");
    setNewAddress("");
  };

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Parties</h1>
          <p className="text-muted-foreground">Legal entities, counterparties, and individuals.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Party
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Party</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddParty} className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="Legal Entity Name" />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Company">Company</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Trust">Trust</SelectItem>
                    <SelectItem value="Bank">Bank</SelectItem>
                    <SelectItem value="JVPartner">JV Partner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} type="email" placeholder="contact@domain.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="+1..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={newAddress} onChange={e => setNewAddress(e.target.value)} placeholder="Full Address" />
              </div>
              <DialogFooter>
                <Button type="submit">Create Party</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative w-full max-w-sm">
             <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
             <Input 
               placeholder="Filter parties..." 
               className="pl-9" 
               value={search}
               onChange={(e) => setSearch(e.target.value)}
             />
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Contact Info</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Contacts</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParties.map((party) => (
                <TableRow key={party.id} className="cursor-pointer hover:bg-muted/50 group">
                  <TableCell className="font-medium">
                    <Link href={`/parties/${party.id}`} className="text-primary hover:underline flex items-center gap-1">
                      {party.name}
                      <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal text-muted-foreground">
                      {party.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <div className="flex flex-col">
                      <span>{party.email}</span>
                      <span className="text-xs">{party.phone}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {party.address}
                  </TableCell>
                  <TableCell>
                    {getPersonCount(party.id)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <FileText className="h-3 w-3" />
                      <span className="text-sm">{getDocumentCount(party.id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8" onClick={(e) => handleDelete(party.id, e)}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {filteredParties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No parties found matching "{search}"
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
