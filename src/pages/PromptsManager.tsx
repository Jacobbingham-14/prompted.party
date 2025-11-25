import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { Pencil, Trash2, Plus, ArrowLeft, ShieldAlert, CheckCircle2, Eye, Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getUserFriendlyErrorMessage, logErrorInDev } from "@/lib/errorUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Prompt {
  id: string;
  text: string;
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

export default function PromptsManager() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [customPrompts, setCustomPrompts] = useState<CustomPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCustomLoading, setIsCustomLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCustomDeleteDialogOpen, setIsCustomDeleteDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [deletingPromptId, setDeletingPromptId] = useState<string | null>(null);
  const [deletingCustomPromptId, setDeletingCustomPromptId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ text: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const [customSearchQuery, setCustomSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Check if user is admin on mount
  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (error) {
      logErrorInDev('Error checking admin status', error);
      setIsAdmin(false);
      return;
    }

    setIsAdmin(data === true);
  };

  useEffect(() => {
    if (isAdmin === true) {
      fetchPrompts();
      fetchCustomPrompts();
      subscribeToPrompts();
      subscribeToCustomPrompts();
    }
  }, [isAdmin]);

  const fetchPrompts = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("prompts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logErrorInDev('Error fetching prompts', error);
      toast({
        title: "Error fetching prompts",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } else {
      setPrompts(data || []);
    }
    setIsLoading(false);
  };

  const subscribeToPrompts = () => {
    const channel = supabase
      .channel("prompts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "prompts",
        },
        () => {
          fetchPrompts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleOpenDialog = (prompt?: Prompt) => {
    if (prompt) {
      setEditingPrompt(prompt);
      setFormData({ text: prompt.text });
    } else {
      setEditingPrompt(null);
      setFormData({ text: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPrompt(null);
    setFormData({ text: "" });
  };

  const handleSubmit = async () => {
    if (!formData.text.trim()) {
      toast({
        title: "Validation error",
        description: "Prompt text cannot be empty",
        variant: "destructive",
      });
      return;
    }

    const promptData = {
      text: formData.text.trim(),
    };

    if (editingPrompt) {
      const { error } = await supabase
        .from("prompts")
        .update(promptData)
        .eq("id", editingPrompt.id);

      if (error) {
        logErrorInDev('Error updating prompt', error);
        toast({
          title: "Error updating prompt",
          description: getUserFriendlyErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Prompt updated successfully",
        });
        handleCloseDialog();
      }
    } else {
      const { error } = await supabase.from("prompts").insert(promptData);

      if (error) {
        logErrorInDev('Error creating prompt', error);
        toast({
          title: "Error creating prompt",
          description: getUserFriendlyErrorMessage(error),
          variant: "destructive",
        });
      } else {
        toast({
          title: "Success",
          description: "Prompt created successfully",
        });
        handleCloseDialog();
      }
    }
  };

  const handleDeleteClick = (promptId: string) => {
    setDeletingPromptId(promptId);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPromptId) return;

    const { error } = await supabase
      .from("prompts")
      .delete()
      .eq("id", deletingPromptId);

    if (error) {
      logErrorInDev('Error deleting prompt', error);
      toast({
        title: "Error deleting prompt",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Prompt deleted successfully",
      });
    }

    setIsDeleteDialogOpen(false);
    setDeletingPromptId(null);
  };

  const fetchCustomPrompts = async () => {
    setIsCustomLoading(true);
    const { data, error } = await supabase
      .from("custom_prompts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      logErrorInDev('Error fetching custom prompts', error);
      toast({
        title: "Error fetching custom prompts",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } else {
      setCustomPrompts(data || []);
    }
    setIsCustomLoading(false);
  };

  const subscribeToCustomPrompts = () => {
    const channel = supabase
      .channel("custom-prompts-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "custom_prompts",
        },
        () => {
          fetchCustomPrompts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handlePromoteCustomPrompt = async (customPrompt: CustomPrompt) => {
    // Add to official prompts
    const { error: insertError } = await supabase
      .from("prompts")
      .insert({ text: customPrompt.text });

    if (insertError) {
      logErrorInDev('Error adding prompt', insertError);
      toast({
        title: "Error adding prompt",
        description: getUserFriendlyErrorMessage(insertError),
        variant: "destructive",
      });
      return;
    }

    // Delete from custom prompts
    const { error: deleteError } = await supabase
      .from("custom_prompts")
      .delete()
      .eq("id", customPrompt.id);

    if (deleteError) {
      logErrorInDev('Error deleting custom prompt', deleteError);
      toast({
        title: "Error deleting custom prompt",
        description: getUserFriendlyErrorMessage(deleteError),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Prompt added to official prompts",
      });
    }
  };


  const handleDeleteCustomPrompt = async () => {
    if (!deletingCustomPromptId) return;

    const { error } = await supabase
      .from("custom_prompts")
      .delete()
      .eq("id", deletingCustomPromptId);

    if (error) {
      logErrorInDev('Error deleting custom prompt', error);
      toast({
        title: "Error deleting custom prompt",
        description: getUserFriendlyErrorMessage(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Custom prompt deleted",
      });
    }

    setIsCustomDeleteDialogOpen(false);
    setDeletingCustomPromptId(null);
  };

  const filteredPrompts = prompts.filter((prompt) =>
    prompt.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCustomPrompts = customPrompts.filter((prompt) => {
    const matchesSearch = prompt.text.toLowerCase().includes(customSearchQuery.toLowerCase());
    
    if (filterStatus === "all") return matchesSearch;
    if (filterStatus === "unreviewed") return matchesSearch && !prompt.reviewed;
    if (filterStatus === "not-promoted") return matchesSearch && !prompt.promoted;
    if (filterStatus === "promoted") return matchesSearch && prompt.promoted;
    
    return matchesSearch;
  });

  const customPromptsStats = {
    total: customPrompts.length,
    unreviewed: customPrompts.filter(p => !p.reviewed).length,
    promoted: customPrompts.filter(p => p.promoted).length,
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Loading state while checking admin status */}
        {isAdmin === null && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        )}

        {/* Non-admin warning */}
        {isAdmin === false && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="mb-4"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="border border-destructive/50 bg-destructive/10 rounded-lg p-8 text-center">
              <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Admin Access Required</h2>
              <p className="text-muted-foreground mb-4">
                You need administrator privileges to manage game prompts. Please contact
                an administrator if you believe you should have access.
              </p>
              <Button onClick={() => navigate("/")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Home
              </Button>
            </div>
          </div>
        )}

        {/* Admin content */}
        {isAdmin === true && (
          <>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                  <h1 className="text-3xl font-bold">Prompts Manager</h1>
                  <p className="text-muted-foreground">
                    Manage official and custom prompts
                  </p>
                </div>
              </div>
            </div>

            <Tabs defaultValue="official" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="official">
                  Official Prompts ({filteredPrompts.length})
                </TabsTrigger>
                <TabsTrigger value="custom">
                  Custom Prompts ({customPromptsStats.total})
                  {customPromptsStats.unreviewed > 0 && (
                    <Badge variant="destructive" className="ml-2">
                      {customPromptsStats.unreviewed} new
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Official Prompts Tab */}
              <TabsContent value="official" className="space-y-6">
                <div className="flex justify-between items-center">
                  <Input
                    placeholder="Search prompts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
                  <Button onClick={() => handleOpenDialog()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Prompt
                  </Button>
                </div>

                {isLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading prompts...
                  </div>
                ) : filteredPrompts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No prompts found. Add your first prompt to get started!
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prompt Text</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPrompts.map((prompt) => (
                          <TableRow key={prompt.id}>
                            <TableCell className="font-medium">{prompt.text}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleOpenDialog(prompt)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteClick(prompt.id)}
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
              </TabsContent>

              {/* Custom Prompts Tab */}
              <TabsContent value="custom" className="space-y-6">
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="border rounded-lg p-4">
                    <div className="text-2xl font-bold">{customPromptsStats.total}</div>
                    <div className="text-sm text-muted-foreground">Total Custom</div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="text-2xl font-bold text-destructive">{customPromptsStats.unreviewed}</div>
                    <div className="text-sm text-muted-foreground">Unreviewed</div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="text-2xl font-bold text-primary">{customPromptsStats.promoted}</div>
                    <div className="text-sm text-muted-foreground">Promoted</div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Input
                    placeholder="Search custom prompts..."
                    value={customSearchQuery}
                    onChange={(e) => setCustomSearchQuery(e.target.value)}
                    className="max-w-md"
                  />
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

                {isCustomLoading ? (
                  <div className="text-center py-12 text-muted-foreground">
                    Loading custom prompts...
                  </div>
                ) : filteredCustomPrompts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    No custom prompts found. Players will create custom prompts during gameplay.
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Prompt Text</TableHead>
                          <TableHead>Judge</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredCustomPrompts.map((prompt) => (
                          <TableRow key={prompt.id}>
                            <TableCell className="font-medium max-w-md">{prompt.text}</TableCell>
                            <TableCell>{prompt.judge_name || "Unknown"}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(prompt.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                {prompt.promoted && (
                                  <Badge variant="default">
                                    <Star className="h-3 w-3 mr-1" />
                                    Promoted
                                  </Badge>
                                )}
                                {prompt.reviewed && !prompt.promoted && (
                                  <Badge variant="secondary">
                                    <Eye className="h-3 w-3 mr-1" />
                                    Reviewed
                                  </Badge>
                                )}
                                {!prompt.reviewed && (
                                  <Badge variant="destructive">New</Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePromoteCustomPrompt(prompt)}
                                >
                                  <Star className="h-4 w-4 mr-1" />
                                  Add
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setDeletingCustomPromptId(prompt.id);
                                    setIsCustomDeleteDialogOpen(true);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? "Edit Prompt" : "Add New Prompt"}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt
                ? "Update the prompt text."
                : "Create a new prompt for your game."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="text">Prompt Text *</Label>
              <Textarea
                id="text"
                placeholder="Enter the prompt text..."
                value={formData.text}
                onChange={(e) =>
                  setFormData({ text: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingPrompt ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the prompt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isCustomDeleteDialogOpen} onOpenChange={setIsCustomDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Custom Prompt?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the custom prompt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCustomPrompt}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
