import { useState, useEffect } from "react";
import { useAuth, AppUser } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, UserPlus, Shield, Loader2, Coins, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addUserCredits } from "@/lib/api";

export default function AdminUsers() {
  const { users, addUser, removeUser, user: currentUser, fetchUsers, loading } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isCreditsOpen, setIsCreditsOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [creditAmount, setCreditAmount] = useState("");
  const [creditDescription, setCreditDescription] = useState("");
  const [isAddingCredits, setIsAddingCredits] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && currentUser) {
      setIsLoadingUsers(true);
      setFetchError(null);
      fetchUsers()
        .catch((err) => {
          console.error("Failed to fetch users:", err);
          setFetchError("Failed to load users. Please try again.");
        })
        .finally(() => setIsLoadingUsers(false));
    }
  }, [loading, currentUser]);

  // Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "User">("Admin");

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole
      });
      setIsAddOpen(false);
      resetForm();
      toast({ title: "User Added", description: `${newName} has been added to the system.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to add user.", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Action Failed", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    if (confirm("Are you sure you want to remove this user?")) {
      try {
        await removeUser(id);
        toast({ title: "User Removed", description: "User access has been revoked." });
      } catch (error) {
        toast({ title: "Error", description: "Failed to remove user.", variant: "destructive" });
      }
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("Admin");
  };

  const handleOpenCreditsDialog = (userId: string) => {
    setSelectedUserId(userId);
    setCreditAmount("");
    setCreditDescription("");
    setIsCreditsOpen(true);
  };

  const handleAddCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    
    const amount = parseInt(creditAmount, 10);
    if (isNaN(amount) || amount < 1 || amount > 1000000) {
      toast({ title: "Invalid Amount", description: "Please enter a whole number between 1 and 1,000,000.", variant: "destructive" });
      return;
    }
    
    setIsAddingCredits(true);
    try {
      const result = await addUserCredits(
        selectedUserId,
        amount,
        creditDescription || "Admin credit adjustment"
      );
      
      setIsCreditsOpen(false);
      await fetchUsers();
      toast({ 
        title: "Credits Added", 
        description: `Successfully added ${amount.toLocaleString()} credits. New balance: ${result.credits?.toLocaleString() || 'updated'}` 
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to add credits.", variant: "destructive" });
    } finally {
      setIsAddingCredits(false);
    }
  };

  const selectedUser = users.find(u => u.id === selectedUserId);
  const parsedAmount = parseInt(creditAmount, 10);
  const isValidAmount = !isNaN(parsedAmount) && parsedAmount >= 1 && parsedAmount <= 1000000;

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Users</h1>
          <p className="text-muted-foreground">Manage system access and permissions.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-user">
              <UserPlus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="e.g. John Doe" data-testid="input-user-name" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" placeholder="name@company.com" data-testid="input-user-email" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} required type="password" data-testid="input-user-password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger data-testid="select-user-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="User">User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" data-testid="button-submit-user">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium" data-testid={`text-username-${user.id}`}>{user.name}</p>
                      {user.id === currentUser?.id && (
                        <Badge variant="outline" className="text-[10px] mt-0.5">You</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "Admin" ? "default" : "secondary"} className="flex items-center gap-1 w-fit" data-testid={`badge-role-${user.id}`}>
                      {user.role === "Admin" && <Shield className="h-3 w-3" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground" data-testid={`text-email-${user.id}`}>{user.email}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium" data-testid={`text-credits-${user.id}`}>
                        {(user as any).credits?.toLocaleString() || 0}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenCreditsDialog(user.id)}
                        title="Add Credits"
                        data-testid={`button-add-credits-${user.id}`}
                      >
                        <Plus className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDelete(user.id)}
                      disabled={user.id === currentUser?.id}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {isLoadingUsers && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    <div className="flex items-center justify-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading users...
                    </div>
                  </TableCell>
                </TableRow>
              )}
              {fetchError && !isLoadingUsers && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-destructive">
                    {fetchError}
                    <Button variant="link" onClick={() => {
                      setIsLoadingUsers(true);
                      setFetchError(null);
                      fetchUsers()
                        .catch(() => setFetchError("Failed to load users. Please try again."))
                        .finally(() => setIsLoadingUsers(false));
                    }}>
                      Try again
                    </Button>
                  </TableCell>
                </TableRow>
              )}
              {!isLoadingUsers && !fetchError && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No users found. Add the first user to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isCreditsOpen} onOpenChange={setIsCreditsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Add Credits
            </DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <form onSubmit={handleAddCredits} className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Adding credits to:</p>
                <p className="font-medium">{selectedUser.name}</p>
                <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                <p className="text-sm mt-1">Current balance: <span className="font-medium">{(selectedUser as any).credits?.toLocaleString() || 0}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Amount to Add</Label>
                <Input
                  type="number"
                  min="1"
                  max="1000000"
                  step="1"
                  value={creditAmount}
                  onChange={e => setCreditAmount(e.target.value)}
                  required
                  placeholder="e.g. 1000"
                  className={creditAmount && !isValidAmount ? "border-destructive" : ""}
                  data-testid="input-credit-amount"
                />
                {creditAmount && !isValidAmount && (
                  <p className="text-xs text-destructive">Please enter a whole number between 1 and 1,000,000</p>
                )}
                {isValidAmount && (
                  <p className="text-xs text-muted-foreground">
                    New balance will be: <span className="font-medium">{((selectedUser as any).credits || 0) + parsedAmount}</span> credits
                  </p>
                )}
                {!creditAmount && (
                  <p className="text-xs text-muted-foreground">Enter the number of credits to add (1 - 1,000,000)</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Input
                  value={creditDescription}
                  onChange={e => setCreditDescription(e.target.value)}
                  placeholder="e.g. Promotional credit, adjustment, etc."
                  data-testid="input-credit-description"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreditsOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isAddingCredits || !isValidAmount} data-testid="button-submit-credits">
                  {isAddingCredits && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Credits
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
