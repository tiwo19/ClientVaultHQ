import { useState, useCallback } from "react";
import { useData } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Upload, Sparkles, FileImage, Check, X, Loader2, AlertCircle, ArrowRight, Calendar, User, FileText } from "lucide-react";
import { Link } from "wouter";

interface AIAnalysis {
  matchedPartyId: string | null;
  matchedPartyName: string | null;
  confidence: number;
  date: string | null;
  activityType: string;
  summary: string;
  reasoning: string;
}

interface FileInfo {
  id: string;
  path: string;
  originalName: string;
  mimeType: string;
}

interface AnalysisResult {
  analysis: AIAnalysis;
  file: FileInfo;
}

export default function AIBucket() {
  const { parties } = useData();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isDragOver, setIsDragOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const [editedPartyId, setEditedPartyId] = useState<string>("");
  const [editedDate, setEditedDate] = useState<string>("");
  const [editedActivityType, setEditedActivityType] = useState<string>("");
  const [editedSummary, setEditedSummary] = useState<string>("");

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      analyzeFile(file);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      analyzeFile(file);
    }
  };

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          analyzeFile(file);
        }
        break;
      }
    }
  }, []);

  const analyzeFile = async (file: File) => {
    setIsAnalyzing(true);
    setAnalysisResult(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/ai-bucket/analyze", {
        method: "POST",
        body: formData,
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error("Analysis failed");
      }

      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      
      setEditedPartyId(result.analysis.matchedPartyId || "");
      setEditedDate(result.analysis.date || format(new Date(), "yyyy-MM-dd"));
      setEditedActivityType(result.analysis.activityType || "Email");
      setEditedSummary(result.analysis.summary || "");

      toast({
        title: "Analysis Complete",
        description: result.analysis.matchedPartyName 
          ? `Matched to ${result.analysis.matchedPartyName} with ${Math.round(result.analysis.confidence * 100)}% confidence`
          : "Could not automatically match to a party"
      });
    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: "Could not analyze the file. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleConfirm = async () => {
    if (!editedPartyId || !editedDate || !editedActivityType || !editedSummary.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsConfirming(true);
    try {
      const response = await fetch("/api/ai-bucket/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          partyId: editedPartyId,
          date: editedDate,
          activityType: editedActivityType,
          summary: editedSummary,
          filePath: analysisResult?.file.path,
          originalName: analysisResult?.file.originalName
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create activity");
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/activities"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/documents"] });

      const createdParty = parties.find(p => p.id === editedPartyId);
      toast({
        title: "Activity Created",
        description: `Activity added to ${createdParty?.name || "party"}'s timeline.`
      });

      setAnalysisResult(null);
      setPreviewUrl(null);
      setEditedPartyId("");
      setEditedDate("");
      setEditedActivityType("");
      setEditedSummary("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create activity. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleCancel = () => {
    setAnalysisResult(null);
    setPreviewUrl(null);
    setEditedPartyId("");
    setEditedDate("");
    setEditedActivityType("");
    setEditedSummary("");
  };

  const selectedParty = parties.find(p => p.id === editedPartyId);

  return (
    <div className="space-y-6" onPaste={handlePaste}>
      <div>
        <h1 className="text-3xl font-serif font-bold text-primary flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500" />
          AI Bucket
        </h1>
        <p className="text-muted-foreground mt-1">
          Drop or paste an image, PDF, or DOCX file and AI will figure out which client it belongs to and create a timeline entry
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload or Paste
            </CardTitle>
            <CardDescription>
              Drag and drop a file, paste with Ctrl+V, or click to select
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-lg p-12 text-center transition-all cursor-pointer
                ${isDragOver 
                  ? "border-primary bg-primary/5" 
                  : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
                }
                ${isAnalyzing ? "pointer-events-none opacity-50" : ""}
              `}
              onClick={() => document.getElementById("file-input")?.click()}
              data-testid="dropzone-ai-bucket"
            >
              <input
                id="file-input"
                type="file"
                className="hidden"
                accept="image/*,.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileSelect}
                disabled={isAnalyzing}
                data-testid="input-file-ai-bucket"
              />
              
              {isAnalyzing ? (
                <div className="space-y-4">
                  <Loader2 className="h-16 w-16 mx-auto text-primary animate-spin" />
                  <div>
                    <p className="text-lg font-medium">Analyzing with AI...</p>
                    <p className="text-sm text-muted-foreground">This may take a few seconds</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileImage className="h-16 w-16 mx-auto text-muted-foreground/50" />
                  <div>
                    <p className="text-lg font-medium">Drop your file here</p>
                    <p className="text-sm text-muted-foreground">
                      or <span className="text-primary underline">click to browse</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Supports: PNG, JPG, GIF, WebP, PDF, DOCX
                    </p>
                  </div>
                </div>
              )}
            </div>

            {previewUrl && !analysisResult && (
              <div className="mt-4">
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="max-h-48 rounded-lg border mx-auto"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {analysisResult ? (
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Analysis Result
              </CardTitle>
              <CardDescription>
                Review and adjust the detected information before creating the activity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {previewUrl && (
                <div className="mb-4">
                  <img 
                    src={previewUrl} 
                    alt="Analyzed document" 
                    className="max-h-32 rounded-lg border"
                  />
                </div>
              )}

              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span className="font-medium">AI Reasoning:</span>
                </div>
                <p className="text-muted-foreground">{analysisResult.analysis.reasoning}</p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="party-select" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Party / Client
                    {analysisResult.analysis.confidence > 0 && (
                      <Badge variant={analysisResult.analysis.confidence > 0.7 ? "default" : "secondary"}>
                        {Math.round(analysisResult.analysis.confidence * 100)}% match
                      </Badge>
                    )}
                  </Label>
                  <Select value={editedPartyId} onValueChange={setEditedPartyId}>
                    <SelectTrigger data-testid="select-party-ai-bucket">
                      <SelectValue placeholder="Select a party" />
                    </SelectTrigger>
                    <SelectContent>
                      {parties.map(party => (
                        <SelectItem key={party.id} value={party.id}>
                          {party.name} ({party.type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="date-input" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Date
                  </Label>
                  <Input
                    id="date-input"
                    type="date"
                    value={editedDate}
                    onChange={(e) => setEditedDate(e.target.value)}
                    data-testid="input-date-ai-bucket"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type-select" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Activity Type
                  </Label>
                  <Select value={editedActivityType} onValueChange={setEditedActivityType}>
                    <SelectTrigger data-testid="select-type-ai-bucket">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Email">Email</SelectItem>
                      <SelectItem value="Call">Call</SelectItem>
                      <SelectItem value="Meeting">Meeting</SelectItem>
                      <SelectItem value="LetterSent">Letter Sent</SelectItem>
                      <SelectItem value="InternalNote">Internal Note</SelectItem>
                      <SelectItem value="CourtFiling">Court Filing</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary-input">Summary</Label>
                  <Textarea
                    id="summary-input"
                    value={editedSummary}
                    onChange={(e) => setEditedSummary(e.target.value)}
                    placeholder="Brief summary of the activity..."
                    rows={3}
                    data-testid="input-summary-ai-bucket"
                  />
                </div>
              </div>

              <Separator />

              <div className="flex gap-3">
                <Button 
                  onClick={handleConfirm} 
                  disabled={isConfirming || !editedPartyId}
                  className="flex-1"
                  data-testid="button-confirm-ai-bucket"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Create Activity
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleCancel}
                  disabled={isConfirming}
                  data-testid="button-cancel-ai-bucket"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>

              {selectedParty && (
                <Link href={`/parties/${selectedParty.id}`}>
                  <Button variant="ghost" className="w-full text-primary">
                    View {selectedParty.name}'s Timeline
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center h-full min-h-[400px] text-center">
              <Sparkles className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No Analysis Yet</h3>
              <p className="text-sm text-muted-foreground/70 max-w-xs mt-2">
                Upload or paste an image, PDF, or DOCX and the AI will analyze it to extract client information, dates, and create a timeline entry.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
