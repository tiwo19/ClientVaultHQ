import { parties, persons, Party } from "@/lib/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

export default function Parties() {
  const [search, setSearch] = useState("");
  
  const filteredParties = parties.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.type.toLowerCase().includes(search.toLowerCase())
  );

  const getPersonCount = (partyId: string) => persons.filter(p => p.partyId === partyId).length;

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Parties</h1>
          <p className="text-muted-foreground">Legal entities, counterparties, and individuals.</p>
        </div>
        <button className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md text-sm font-medium transition-colors">
          Add Party
        </button>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredParties.map((party) => (
                <TableRow key={party.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium text-primary">{party.name}</TableCell>
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
                </TableRow>
              ))}
              {filteredParties.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
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
