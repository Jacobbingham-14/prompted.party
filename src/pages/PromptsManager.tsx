import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Pencil,
  Trash2,
  Plus,
  ArrowLeft,
  ShieldAlert,
  Eye,
  Star,
  Upload,
  Copy,
  Archive,
  ArchiveRestore,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUserFriendlyErrorMessage, logErrorInDev } from "@/lib/errorUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SimpleMode = "judge" | "voting" | "duel";

const SIMPLE_MODE_TABLES: Record<SimpleMode, string> = {
  judge: "judge_prompts",
  voting: "voting_prompts",
  duel: "duel_prompts",
};

const SIMPLE_MODE_LABELS: Record<SimpleMode, string> = {
  judge: "Judge",
  voting: "Voting",
  duel: "Duel",
};

const ALL_SIMPLE_MODES: SimpleMode[] = ["judge", "voting", "duel"];

interface SimplePrompt {
  id: string;
  text: string;
  category: string[];
  archived: boolean;
  created_at: string;
}

interface ForgeryPrompt {
  id: string;
  main_prompt: string;
  forger_prompt: string;
  category: string[];
  archived: boolean;
  created_at: string;
}

interface CustomPrompt {
  id: string;
  text: string;
  judge_name: string | null;
  created_at: string;
  promoted: boolean;
  reviewed: boolean;
}

// ---------------------------------------------------------------------------
// Simple (single-text) prompt tab -- used for Judge, Voting, and Duel, which
// all share the same { id, text, category, archived } shape.
// ---------------------------------------------------------------------------
function SimplePromptsTab({ mode }: { mode: SimpleMode }) {
  const table = SIMPLE_MODE_TABLES[mode];
  const { toast } = useToast();

  const [prompts, setPrompts] = useState<SimplePrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<SimplePrompt | null>(null);
  const [formText, setFormText] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<SimpleMode>>(new Set());
  const [copyToForgeryText, setCopyToForgeryText] = useState("");
  const [copyToForgery, setCopyToForgery] = useState(false);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logErrorInDev(`Error fetching ${table}`, error);
      toast({ title: "Error fetching prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
    } else {
      setPrompts((data ?? []) as unknown as SimplePrompt[]);
    }
    setIsLoading(false);
  }, [table, toast]);

  useEffect(() => {
    fetchPrompts();
    const channel = supabase
      .channel(`${table}-changes`)
      .on("postgres_changes", { event: "*", schema: "public", table: table as any }, () => fetchPrompts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, fetchPrompts]);

  const openAdd = () => {
    setEditingPrompt(null);
    setFormText("");
    setFormCategory("");
    setIsDialogOpen(true);
  };

  const openEdit = (p: SimplePrompt) => {
    setEditingPrompt(p);
    setFormText(p.text);
    setFormCategory((p.category ?? []).join(", "));
    setIsDialogOpen(true);
  };

  const parseCategory = (raw: string) =>
    raw.split(",").map((c) => c.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!formText.trim()) {
      toast({ title: "Validation error", description: "Prompt text cannot be empty", variant: "destructive" });
      return;
    }
    const payload = { text: formText.trim(), category: parseCategory(formCategory) };

    const { error } = editingPrompt
      ? await supabase.from(table as any).update(payload).eq("id", editingPrompt.id)
      : await supabase.from(table as any).insert(payload);

    if (error) {
      toast({ title: "Error saving prompt", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: editingPrompt ? "Prompt updated" : "Prompt created" });
    setIsDialogOpen(false);
  };

  const handleBulkImport = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    const { error } = await supabase.from(table as any).insert(lines.map((text) => ({ text })));
    if (error) {
      toast({ title: "Error importing prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `Imported ${lines.length} prompt(s)` });
    setBulkText("");
    setIsBulkOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setArchivedForSelection = async (archived: boolean) => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase.from(table as any).update({ archived }).in("id", Array.from(selectedIds));
    if (error) {
      toast({ title: "Error updating prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `${archived ? "Archived" : "Restored"} ${selectedIds.size} prompt(s)` });
    setSelectedIds(new Set());
  };

  const deleteSelection = async () => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase.from(table as any).delete().in("id", Array.from(selectedIds));
    if (error) {
      toast({ title: "Error deleting prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `Deleted ${selectedIds.size} prompt(s)` });
    setSelectedIds(new Set());
  };

  const openCopyDialog = () => {
    setCopyTargets(new Set());
    setCopyToForgery(false);
    setCopyToForgeryText("");
    setIsCopyOpen(true);
  };

  const handleCopy = async () => {
    const selected = prompts.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0) return;

    for (const target of copyTargets) {
      const targetTable = SIMPLE_MODE_TABLES[target];
      const { error } = await supabase.from(targetTable as any).insert(
        selected.map((p) => ({ text: p.text, category: p.category ?? [] }))
      );
      if (error) {
        toast({ title: `Error copying to ${SIMPLE_MODE_LABELS[target]}`, description: getUserFriendlyErrorMessage(error), variant: "destructive" });
        return;
      }
    }

    if (copyToForgery) {
      if (selected.length !== 1) {
        toast({ title: "Pick exactly one prompt", description: "Copying to Forgery needs a single prompt plus its forger counterpart.", variant: "destructive" });
        return;
      }
      if (!copyToForgeryText.trim()) {
        toast({ title: "Missing forger prompt", description: "Enter the decoy/forger version of this prompt.", variant: "destructive" });
        return;
      }
      const { error } = await supabase.from("forgery_prompts").insert({
        main_prompt: selected[0].text,
        forger_prompt: copyToForgeryText.trim(),
      });
      if (error) {
        toast({ title: "Error copying to Forgery", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
        return;
      }
    }

    toast({ title: "Success", description: "Copied prompt(s)" });
    setIsCopyOpen(false);
    setSelectedIds(new Set());
  };

  const filtered = prompts.filter((p) => {
    const matchesSearch = p.text.toLowerCase().includes(search.toLowerCase());
    if (statusFilter === "active") return matchesSearch && !p.archived;
    if (statusFilter === "archived") return matchesSearch && p.archived;
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search prompts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add Prompt
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
          <span className="text-sm">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={openCopyDialog}>
            <Copy className="h-4 w-4 mr-1" /> Copy to...
          </Button>
          <Button size="sm" variant="outline" onClick={() => setArchivedForSelection(true)}>
            <Archive className="h-4 w-4 mr-1" /> Archive
          </Button>
          <Button size="sm" variant="outline" onClick={() => setArchivedForSelection(false)}>
            <ArchiveRestore className="h-4 w-4 mr-1" /> Restore
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteSelection}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading prompts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No prompts found.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Prompt Text</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                  </TableCell>
                  <TableCell className="font-medium">{p.text}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.category ?? []).map((c) => (
                        <Badge key={c} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.archived ? <Badge variant="outline">Archived</Badge> : <Badge>Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingId(p.id);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPrompt ? "Edit Prompt" : "Add New Prompt"}</DialogTitle>
            <DialogDescription>
              {editingPrompt ? `Update this ${SIMPLE_MODE_LABELS[mode]} prompt.` : `Create a new ${SIMPLE_MODE_LABELS[mode]} prompt.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="text">Prompt Text *</Label>
              <Textarea id="text" value={formText} onChange={(e) => setFormText(e.target.value)} rows={3} />
            </div>
            <div>
              <Label htmlFor="category">Tags (comma separated)</Label>
              <Input id="category" placeholder="family friendly, pop culture" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPrompt ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk import dialog */}
      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import — {SIMPLE_MODE_LABELS[mode]}</DialogTitle>
            <DialogDescription>Paste one prompt per line.</DialogDescription>
          </DialogHeader>
          <Textarea rows={10} placeholder={"A haunted breakfast cereal\nThe worst possible tattoo\n..."} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Copy dialog */}
      <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy {selectedIds.size} prompt(s) to...</DialogTitle>
            <DialogDescription>Copies are independent -- editing the original later won't change the copy.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_SIMPLE_MODES.filter((m) => m !== mode).map((m) => (
              <div key={m} className="flex items-center gap-2">
                <Checkbox
                  checked={copyTargets.has(m)}
                  onCheckedChange={(checked) =>
                    setCopyTargets((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(m);
                      else next.delete(m);
                      return next;
                    })
                  }
                />
                <span>{SIMPLE_MODE_LABELS[m]}</span>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <Checkbox checked={copyToForgery} onCheckedChange={(c) => setCopyToForgery(!!c)} disabled={selectedIds.size !== 1} />
              <span>Forgery {selectedIds.size !== 1 && <span className="text-xs text-muted-foreground">(select exactly 1 to enable)</span>}</span>
            </div>
            {copyToForgery && (
              <div>
                <Label htmlFor="forgerText">Forger (decoy) prompt for Forgery mode</Label>
                <Textarea id="forgerText" rows={2} value={copyToForgeryText} onChange={(e) => setCopyToForgeryText(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyOpen(false)}>Cancel</Button>
            <Button onClick={handleCopy}>Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the prompt. Consider archiving instead if you might want it back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingId) return;
                const { error } = await supabase.from(table as any).delete().eq("id", deletingId);
                if (error) {
                  toast({ title: "Error deleting prompt", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
                } else {
                  toast({ title: "Success", description: "Prompt deleted" });
                }
                setIsDeleteOpen(false);
                setDeletingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forgery prompts tab -- pairs of { main_prompt, forger_prompt }.
// ---------------------------------------------------------------------------
function ForgeryPromptsTab() {
  const { toast } = useToast();
  const [prompts, setPrompts] = useState<ForgeryPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ForgeryPrompt | null>(null);
  const [formMain, setFormMain] = useState("");
  const [formForger, setFormForger] = useState("");
  const [formCategory, setFormCategory] = useState("");

  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  const [isCopyOpen, setIsCopyOpen] = useState(false);
  const [copyTargets, setCopyTargets] = useState<Set<SimpleMode>>(new Set());

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPrompts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("forgery_prompts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Error fetching prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
    } else {
      setPrompts((data ?? []) as unknown as ForgeryPrompt[]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchPrompts();
    const channel = supabase
      .channel("forgery_prompts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "forgery_prompts" }, () => fetchPrompts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPrompts]);

  const openAdd = () => {
    setEditingPrompt(null);
    setFormMain("");
    setFormForger("");
    setFormCategory("");
    setIsDialogOpen(true);
  };

  const openEdit = (p: ForgeryPrompt) => {
    setEditingPrompt(p);
    setFormMain(p.main_prompt);
    setFormForger(p.forger_prompt);
    setFormCategory((p.category ?? []).join(", "));
    setIsDialogOpen(true);
  };

  const parseCategory = (raw: string) => raw.split(",").map((c) => c.trim()).filter(Boolean);

  const handleSave = async () => {
    if (!formMain.trim() || !formForger.trim()) {
      toast({ title: "Validation error", description: "Both the main and forger prompts are required", variant: "destructive" });
      return;
    }
    const payload = { main_prompt: formMain.trim(), forger_prompt: formForger.trim(), category: parseCategory(formCategory) };

    const { error } = editingPrompt
      ? await supabase.from("forgery_prompts").update(payload).eq("id", editingPrompt.id)
      : await supabase.from("forgery_prompts").insert(payload);

    if (error) {
      toast({ title: "Error saving prompt", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: editingPrompt ? "Prompt updated" : "Prompt created" });
    setIsDialogOpen(false);
  };

  const handleBulkImport = async () => {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const rows = lines
      .map((l) => l.split("|").map((s) => s.trim()))
      .filter((parts) => parts.length === 2 && parts[0] && parts[1])
      .map(([main_prompt, forger_prompt]) => ({ main_prompt, forger_prompt }));

    if (rows.length === 0) {
      toast({ title: "Nothing to import", description: "Each line needs the format: main prompt | forger prompt", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("forgery_prompts").insert(rows);
    if (error) {
      toast({ title: "Error importing prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `Imported ${rows.length} prompt pair(s)` });
    setBulkText("");
    setIsBulkOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setArchivedForSelection = async (archived: boolean) => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase.from("forgery_prompts").update({ archived }).in("id", Array.from(selectedIds));
    if (error) {
      toast({ title: "Error updating prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `${archived ? "Archived" : "Restored"} ${selectedIds.size} prompt(s)` });
    setSelectedIds(new Set());
  };

  const deleteSelection = async () => {
    if (selectedIds.size === 0) return;
    const { error } = await supabase.from("forgery_prompts").delete().in("id", Array.from(selectedIds));
    if (error) {
      toast({ title: "Error deleting prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `Deleted ${selectedIds.size} prompt(s)` });
    setSelectedIds(new Set());
  };

  const handleCopy = async () => {
    const selected = prompts.filter((p) => selectedIds.has(p.id));
    if (selected.length === 0 || copyTargets.size === 0) return;

    for (const target of copyTargets) {
      const targetTable = SIMPLE_MODE_TABLES[target];
      // Only the main_prompt carries over -- the forger/decoy pairing is Forgery-specific.
      const { error } = await supabase.from(targetTable as any).insert(
        selected.map((p) => ({ text: p.main_prompt, category: p.category ?? [] }))
      );
      if (error) {
        toast({ title: `Error copying to ${SIMPLE_MODE_LABELS[target]}`, description: getUserFriendlyErrorMessage(error), variant: "destructive" });
        return;
      }
    }
    toast({ title: "Success", description: "Copied main prompt(s) — forger pairing was dropped since other modes don't use it." });
    setIsCopyOpen(false);
    setSelectedIds(new Set());
  };

  const filtered = prompts.filter((p) => {
    const matchesSearch =
      p.main_prompt.toLowerCase().includes(search.toLowerCase()) ||
      p.forger_prompt.toLowerCase().includes(search.toLowerCase());
    if (statusFilter === "active") return matchesSearch && !p.archived;
    if (statusFilter === "archived") return matchesSearch && p.archived;
    return matchesSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-2">
        <div className="flex gap-2 flex-wrap">
          <Input placeholder="Search prompts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsBulkOpen(true)}>
            <Upload className="h-4 w-4 mr-2" /> Bulk Import
          </Button>
          <Button onClick={openAdd}>
            <Plus className="h-4 w-4 mr-2" /> Add Prompt Pair
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-muted rounded-lg p-3">
          <span className="text-sm">{selectedIds.size} selected</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCopyTargets(new Set());
              setIsCopyOpen(true);
            }}
          >
            <Copy className="h-4 w-4 mr-1" /> Copy main prompt to...
          </Button>
          <Button size="sm" variant="outline" onClick={() => setArchivedForSelection(true)}>
            <Archive className="h-4 w-4 mr-1" /> Archive
          </Button>
          <Button size="sm" variant="outline" onClick={() => setArchivedForSelection(false)}>
            <ArchiveRestore className="h-4 w-4 mr-1" /> Restore
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={deleteSelection}>
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading prompts...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No prompts found.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Main Prompt</TableHead>
                <TableHead>Forger Prompt</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Checkbox checked={selectedIds.has(p.id)} onCheckedChange={() => toggleSelected(p.id)} />
                  </TableCell>
                  <TableCell className="font-medium max-w-xs">{p.main_prompt}</TableCell>
                  <TableCell className="text-muted-foreground max-w-xs">{p.forger_prompt}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(p.category ?? []).map((c) => (
                        <Badge key={c} variant="secondary">{c}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    {p.archived ? <Badge variant="outline">Archived</Badge> : <Badge>Active</Badge>}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingId(p.id);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingPrompt ? "Edit Prompt Pair" : "Add Prompt Pair"}</DialogTitle>
            <DialogDescription>The forger prompt is the decoy secretly shown to the forger(s).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="main">Main Prompt *</Label>
              <Textarea id="main" value={formMain} onChange={(e) => setFormMain(e.target.value)} rows={2} />
            </div>
            <div>
              <Label htmlFor="forger">Forger Prompt *</Label>
              <Textarea id="forger" value={formForger} onChange={(e) => setFormForger(e.target.value)} rows={2} />
            </div>
            <div>
              <Label htmlFor="category">Tags (comma separated)</Label>
              <Input id="category" value={formCategory} onChange={(e) => setFormCategory(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editingPrompt ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBulkOpen} onOpenChange={setIsBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Import — Forgery</DialogTitle>
            <DialogDescription>One pair per line, formatted as: main prompt | forger prompt</DialogDescription>
          </DialogHeader>
          <Textarea rows={10} placeholder={"A peaceful sunny day | A stormy day\n..."} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBulkOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkImport}>Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isCopyOpen} onOpenChange={setIsCopyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy main prompt(s) to...</DialogTitle>
            <DialogDescription>Only the main prompt text carries over -- the forger/decoy pairing doesn't apply outside Forgery mode.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_SIMPLE_MODES.map((m) => (
              <div key={m} className="flex items-center gap-2">
                <Checkbox
                  checked={copyTargets.has(m)}
                  onCheckedChange={(checked) =>
                    setCopyTargets((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(m);
                      else next.delete(m);
                      return next;
                    })
                  }
                />
                <span>{SIMPLE_MODE_LABELS[m]}</span>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCopyOpen(false)}>Cancel</Button>
            <Button onClick={handleCopy}>Copy</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>This permanently deletes the prompt pair. Consider archiving instead if you might want it back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingId) return;
                const { error } = await supabase.from("forgery_prompts").delete().eq("id", deletingId);
                if (error) {
                  toast({ title: "Error deleting prompt", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
                } else {
                  toast({ title: "Success", description: "Prompt deleted" });
                }
                setIsDeleteOpen(false);
                setDeletingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Community-submitted custom prompts -- unchanged in shape, but "Promote" now
// lets the admin pick which mode's table to promote into.
// ---------------------------------------------------------------------------
function CustomPromptsTab() {
  const { toast } = useToast();
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Record<string, SimpleMode | "forgery">>({});
  const [isForgeryPromoteOpen, setIsForgeryPromoteOpen] = useState(false);
  const [forgeryPromotePrompt, setForgeryPromotePrompt] = useState<CustomPrompt | null>(null);
  const [forgeryPromoteText, setForgeryPromoteText] = useState("");

  const fetchCustomPrompts = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from("custom_prompts").select("*").order("created_at", { ascending: false });
    if (error) {
      logErrorInDev("Error fetching custom prompts", error);
      toast({ title: "Error fetching custom prompts", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
    } else {
      setCustomPrompts(data || []);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchCustomPrompts();
    const channel = supabase
      .channel("custom-prompts-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "custom_prompts" }, () => fetchCustomPrompts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchCustomPrompts]);

  const promoteInto = async (customPrompt: CustomPrompt, target: SimpleMode, forgerText?: string) => {
    const targetTable = SIMPLE_MODE_TABLES[target];
    const { error: insertError } = await supabase.from(targetTable as any).insert({ text: customPrompt.text });
    if (insertError) {
      toast({ title: "Error adding prompt", description: getUserFriendlyErrorMessage(insertError), variant: "destructive" });
      return;
    }
    await finishPromote(customPrompt);
  };

  const promoteIntoForgery = async (customPrompt: CustomPrompt, forgerText: string) => {
    const { error: insertError } = await supabase.from("forgery_prompts").insert({
      main_prompt: customPrompt.text,
      forger_prompt: forgerText,
    });
    if (insertError) {
      toast({ title: "Error adding prompt", description: getUserFriendlyErrorMessage(insertError), variant: "destructive" });
      return;
    }
    await finishPromote(customPrompt);
  };

  const finishPromote = async (customPrompt: CustomPrompt) => {
    const { error: deleteError } = await supabase.from("custom_prompts").delete().eq("id", customPrompt.id);
    if (deleteError) {
      toast({ title: "Error removing from queue", description: getUserFriendlyErrorMessage(deleteError), variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Prompt added" });
    }
  };

  const handlePromoteClick = (customPrompt: CustomPrompt) => {
    const target = promoteTarget[customPrompt.id] ?? "judge";
    if (target === "forgery") {
      setForgeryPromotePrompt(customPrompt);
      setForgeryPromoteText("");
      setIsForgeryPromoteOpen(true);
    } else {
      promoteInto(customPrompt, target);
    }
  };

  const filteredCustomPrompts = customPrompts.filter((prompt) => {
    const matchesSearch = prompt.text.toLowerCase().includes(search.toLowerCase());
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "unreviewed") return matchesSearch && !prompt.reviewed;
    if (filterStatus === "not-promoted") return matchesSearch && !prompt.promoted;
    if (filterStatus === "promoted") return matchesSearch && prompt.promoted;
    return matchesSearch;
  });

  const stats = {
    total: customPrompts.length,
    unreviewed: customPrompts.filter((p) => !p.reviewed).length,
    promoted: customPrompts.filter((p) => p.promoted).length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-muted-foreground">Total Custom</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-destructive">{stats.unreviewed}</div>
          <div className="text-sm text-muted-foreground">Unreviewed</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-2xl font-bold text-primary">{stats.promoted}</div>
          <div className="text-sm text-muted-foreground">Promoted</div>
        </div>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Search custom prompts..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-md" />
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
            <SelectItem value="not-promoted">Not Promoted</SelectItem>
            <SelectItem value="promoted">Promoted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading custom prompts...</div>
      ) : filteredCustomPrompts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">No custom prompts found. Players will create custom prompts during gameplay.</div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Prompt Text</TableHead>
                <TableHead>Judge</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Promote to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomPrompts.map((prompt) => (
                <TableRow key={prompt.id}>
                  <TableCell className="font-medium max-w-md">{prompt.text}</TableCell>
                  <TableCell>{prompt.judge_name || "Unknown"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(prompt.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {prompt.promoted && <Badge variant="default"><Star className="h-3 w-3 mr-1" />Promoted</Badge>}
                      {prompt.reviewed && !prompt.promoted && <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Reviewed</Badge>}
                      {!prompt.reviewed && <Badge variant="destructive">New</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Select
                        value={promoteTarget[prompt.id] ?? "judge"}
                        onValueChange={(v) => setPromoteTarget((prev) => ({ ...prev, [prompt.id]: v as SimpleMode | "forgery" }))}
                      >
                        <SelectTrigger className="w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="judge">Judge</SelectItem>
                          <SelectItem value="voting">Voting</SelectItem>
                          <SelectItem value="duel">Duel</SelectItem>
                          <SelectItem value="forgery">Forgery</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="sm" onClick={() => handlePromoteClick(prompt)}>
                        <Star className="h-4 w-4 mr-1" /> Add
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeletingId(prompt.id);
                          setIsDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={isForgeryPromoteOpen} onOpenChange={setIsForgeryPromoteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Forger Prompt</DialogTitle>
            <DialogDescription>Forgery mode needs a decoy prompt alongside "{forgeryPromotePrompt?.text}".</DialogDescription>
          </DialogHeader>
          <Textarea rows={2} value={forgeryPromoteText} onChange={(e) => setForgeryPromoteText(e.target.value)} placeholder="Enter the forger/decoy version..." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsForgeryPromoteOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!forgeryPromotePrompt || !forgeryPromoteText.trim()) return;
                await promoteIntoForgery(forgeryPromotePrompt, forgeryPromoteText.trim());
                setIsForgeryPromoteOpen(false);
              }}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Prompt?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingId) return;
                const { error } = await supabase.from("custom_prompts").delete().eq("id", deletingId);
                if (error) {
                  toast({ title: "Error deleting custom prompt", description: getUserFriendlyErrorMessage(error), variant: "destructive" });
                } else {
                  toast({ title: "Success", description: "Custom prompt deleted" });
                }
                setIsDeleteOpen(false);
                setDeletingId(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function PromptsManager() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) {
        logErrorInDev("Error checking admin status", error);
        setIsAdmin(false);
        return;
      }
      setIsAdmin(data === true);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {isAdmin === null && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        )}

        {isAdmin === false && (
          <div className="space-y-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="mb-4">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
              <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground mb-4">
                You need administrator privileges to manage game prompts. Please contact an administrator if you believe you should have access.
              </p>
              <Button onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back to Home
              </Button>
            </div>
          </div>
        )}

        {isAdmin === true && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Prompts Manager</h1>
                  <p className="text-muted-foreground">Each game mode has its own independent prompt pool.</p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="judge" className="w-full">
              <TabsList className="mb-6 flex-wrap h-auto">
                <TabsTrigger value="judge">Judge</TabsTrigger>
                <TabsTrigger value="voting">Voting</TabsTrigger>
                <TabsTrigger value="forgery">Forgery</TabsTrigger>
                <TabsTrigger value="duel">Duel</TabsTrigger>
                <TabsTrigger value="custom">Community Submissions</TabsTrigger>
              </TabsList>

              <TabsContent value="judge"><SimplePromptsTab mode="judge" /></TabsContent>
              <TabsContent value="voting"><SimplePromptsTab mode="voting" /></TabsContent>
              <TabsContent value="forgery"><ForgeryPromptsTab /></TabsContent>
              <TabsContent value="duel"><SimplePromptsTab mode="duel" /></TabsContent>
              <TabsContent value="custom"><CustomPromptsTab /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}
