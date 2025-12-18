import { useState, useMemo, useEffect } from "react";
import { useData } from "@/lib/data";
import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Users, Building, User, Briefcase, FolderKanban } from "lucide-react";
import { useLocation } from "wouter";
import type { Engagement } from "@shared/schema";

interface SearchResult {
  id: string;
  type: "party" | "agreement" | "person" | "document" | "engagement";
  title: string;
  subtitle: string;
  href: string;
}

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();
  const { parties, agreements, persons, documents } = useData();

  const { data: engagements = [] } = useQuery<Engagement[]>({
    queryKey: ["/api/engagements"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/engagements", { credentials: "include" });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },
    staleTime: 30000,
    retry: false
  });

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  const results = useMemo(() => {
    if (!search.trim() || search.length < 2) return [];

    const searchLower = search.toLowerCase();
    const results: SearchResult[] = [];

    parties.forEach(party => {
      if (
        party.name.toLowerCase().includes(searchLower) ||
        party.email?.toLowerCase().includes(searchLower) ||
        party.type.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: party.id,
          type: "party",
          title: party.name,
          subtitle: `${party.type}${party.email ? ` • ${party.email}` : ""}`,
          href: `/parties/${party.id}`
        });
      }
    });

    agreements.forEach(agreement => {
      const partyName = parties.find(p => p.id === agreement.partyId)?.name || "";
      if (
        agreement.title.toLowerCase().includes(searchLower) ||
        agreement.type.toLowerCase().includes(searchLower) ||
        partyName.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: agreement.id,
          type: "agreement",
          title: agreement.title,
          subtitle: `${agreement.type} • ${partyName}`,
          href: `/agreements/${agreement.id}`
        });
      }
    });

    persons.forEach(person => {
      const partyName = parties.find(p => p.id === person.partyId)?.name || "";
      if (
        person.name.toLowerCase().includes(searchLower) ||
        person.email.toLowerCase().includes(searchLower) ||
        person.role.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: person.id,
          type: "person",
          title: person.name,
          subtitle: `${person.role} at ${partyName}`,
          href: `/parties/${person.partyId}`
        });
      }
    });

    documents.forEach(doc => {
      if (
        doc.name.toLowerCase().includes(searchLower) ||
        doc.category.toLowerCase().includes(searchLower)
      ) {
        const targetHref = doc.agreementId 
          ? `/agreements/${doc.agreementId}`
          : doc.partyId 
            ? `/parties/${doc.partyId}` 
            : "/";
        results.push({
          id: doc.id,
          type: "document",
          title: doc.name,
          subtitle: doc.category,
          href: targetHref
        });
      }
    });

    engagements.forEach(engagement => {
      if (
        engagement.name.toLowerCase().includes(searchLower) ||
        engagement.description?.toLowerCase().includes(searchLower) ||
        engagement.type.toLowerCase().includes(searchLower) ||
        engagement.referenceNumber?.toLowerCase().includes(searchLower)
      ) {
        results.push({
          id: engagement.id,
          type: "engagement",
          title: engagement.name,
          subtitle: `${engagement.type} • ${engagement.status}`,
          href: `/engagements/${engagement.id}`
        });
      }
    });

    return results.slice(0, 15);
  }, [search, parties, agreements, persons, documents, engagements]);

  const handleSelect = (result: SearchResult) => {
    setLocation(result.href);
    onOpenChange(false);
  };

  const getIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "party":
        return <Building className="h-4 w-4" />;
      case "agreement":
        return <Briefcase className="h-4 w-4" />;
      case "person":
        return <User className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "engagement":
        return <FolderKanban className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "party":
        return "Party";
      case "agreement":
        return "Agreement";
      case "person":
        return "Contact";
      case "document":
        return "Document";
      case "engagement":
        return "Engagement";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Everything
          </DialogTitle>
        </DialogHeader>
        
        <div className="p-4">
          <Input
            placeholder="Search parties, agreements, contacts, documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            className="h-12 text-base"
            data-testid="input-global-search"
          />
        </div>

        {results.length > 0 ? (
          <div className="max-h-[400px] overflow-y-auto border-t">
            {results.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left border-b last:border-b-0"
                data-testid={`search-result-${result.type}-${result.id}`}
              >
                <div className="flex-shrink-0 text-muted-foreground">
                  {getIcon(result.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{result.title}</p>
                  <p className="text-sm text-muted-foreground truncate">{result.subtitle}</p>
                </div>
                <Badge variant="outline" className="flex-shrink-0">
                  {getTypeLabel(result.type)}
                </Badge>
              </button>
            ))}
          </div>
        ) : search.length >= 2 ? (
          <div className="p-8 text-center text-muted-foreground border-t">
            No results found for "{search}"
          </div>
        ) : search.length > 0 ? (
          <div className="p-8 text-center text-muted-foreground border-t">
            Type at least 2 characters to search
          </div>
        ) : null}

        <div className="p-3 border-t bg-muted/30 text-xs text-muted-foreground flex justify-between">
          <span>Press <kbd className="px-1.5 py-0.5 rounded bg-muted border text-[10px]">ESC</kbd> to close</span>
          <span>{results.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
