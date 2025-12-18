import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Search, File, FileText, Image, Calendar, Tag, Loader2, Check, X, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { documentCategories } from "@shared/schema";
import type { Document } from "@shared/schema";

interface DocumentLinkerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  engagementId: string;
  onDocumentLinked: () => void;
}

export function DocumentLinkerDialog({ open, onOpenChange, engagementId, onDocumentLinked }: DocumentLinkerDialogProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (open) {
      searchDocuments();
    } else {
      setQuery("");
      setCategory("all");
      setSelectedDoc(null);
      setDocuments([]);
    }
  }, [open]);

  useEffect(() => {
    if (open) {
      const debounce = setTimeout(() => {
        searchDocuments();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [query, category]);

  const searchDocuments = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      if (category && category !== "all") params.set("category", category);
      params.set("excludeEngagementId", engagementId);
      
      const res = await fetch(`/api/documents/search?${params}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Failed to search documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async () => {
    if (!selectedDoc) return;
    setLinking(true);
    try {
      const res = await fetch(`/api/documents/${selectedDoc.id}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ engagementId })
      });
      if (res.ok) {
        onDocumentLinked();
        onOpenChange(false);
      }
    } catch (error) {
      console.error("Failed to link document:", error);
    } finally {
      setLinking(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.toLowerCase().includes("image") || type === "Image") {
      return <Image className="h-4 w-4 text-purple-500" />;
    }
    if (type.toLowerCase().includes("pdf") || type === "PDF") {
      return <FileText className="h-4 w-4 text-red-500" />;
    }
    return <File className="h-4 w-4 text-blue-500" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Link Document to Engagement</DialogTitle>
          <DialogDescription>
            Search for existing documents to associate with this engagement
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-3 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, notes, or type..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
              data-testid="input-document-search"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-48" data-testid="select-document-category">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {documentCategories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-1 gap-4 mt-4 min-h-0">
          <div className="flex-1 min-w-0">
            <ScrollArea className="h-[350px] border rounded-lg">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <File className="h-8 w-8 mb-2" />
                  <p className="text-sm">No documents found</p>
                  <p className="text-xs">Try adjusting your search</p>
                </div>
              ) : (
                <div className="p-1">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoc(doc)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedDoc?.id === doc.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted border border-transparent"
                      }`}
                      data-testid={`document-item-${doc.id}`}
                    >
                      {getFileIcon(doc.type)}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{doc.category}</Badge>
                          <span>{doc.type}</span>
                        </div>
                      </div>
                      {selectedDoc?.id === doc.id && (
                        <Check className="h-4 w-4 text-primary shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {selectedDoc && (
            <div className="w-72 shrink-0 border rounded-lg p-4 bg-muted/30">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                {getFileIcon(selectedDoc.type)}
                Document Details
              </h4>
              <Separator className="mb-3" />
              <div className="space-y-3 text-sm">
                <div>
                  <label className="text-muted-foreground text-xs">Name</label>
                  <p className="font-medium break-words">{selectedDoc.name}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs">Type</label>
                  <p>{selectedDoc.type}</p>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs">Category</label>
                  <Badge variant="secondary">{selectedDoc.category}</Badge>
                </div>
                <div>
                  <label className="text-muted-foreground text-xs flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Uploaded
                  </label>
                  <p>{format(new Date(selectedDoc.dateUploaded), "MMM d, yyyy")}</p>
                </div>
                {selectedDoc.expirationDate && (
                  <div>
                    <label className="text-muted-foreground text-xs flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Expires
                    </label>
                    <p>{format(new Date(selectedDoc.expirationDate), "MMM d, yyyy")}</p>
                  </div>
                )}
                {selectedDoc.notes && (
                  <div>
                    <label className="text-muted-foreground text-xs">Notes</label>
                    <p className="text-xs text-muted-foreground">{selectedDoc.notes}</p>
                  </div>
                )}
                {selectedDoc.version > 1 && (
                  <div>
                    <label className="text-muted-foreground text-xs">Version</label>
                    <Badge variant="outline">v{selectedDoc.version}</Badge>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-link">
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button 
            onClick={handleLink} 
            disabled={!selectedDoc || linking}
            data-testid="button-confirm-link"
          >
            {linking ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4 mr-2" />
            )}
            Link to Engagement
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
