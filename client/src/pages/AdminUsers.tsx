import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Trash2, UserPlus, Edit2, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AppUser } from "@/lib/mockData";

export default function AdminUsers() {
  const { users, addUser, removeUser, updateUser, user: currentUser } = useAuth();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const { toast } = useToast();

  // Form State
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"Admin" | "User">("Admin");

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    addUser({
      name: newName,
      email: newEmail,
      password: newPassword,
      role: newRole
    });
    setIsAddOpen(false);
    resetForm();
    toast({ title: "User Added", description: `${newName} has been added to the system.` });
  };

  const handleDelete = (id: string) => {
    if (id === currentUser?.id) {
      toast({ title: "Action Failed", description: "You cannot delete your own account.", variant: "destructive" });
      return;
    }
    if (confirm("Are you sure you want to remove this user?")) {
      removeUser(id);
      toast({ title: "User Removed", description: "User access has been revoked." });
    }
  };

  const resetForm = () => {
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewRole("Admin");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Users</h1>
          <p className="text-muted-foreground">Manage system access and permissions.</p>
        </div>
        
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input value={newName} onChange={e => setNewName(e.target.value)} required placeholder="e.g. John Doe" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={newEmail} onChange={e => setNewEmail(e.target.value)} required type="email" placeholder="name@company.com" />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} required type="password" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newRole} onValueChange={(v: any) => setNewRole(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                    <SelectItem value="User">User (Read Only)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit">Create User</Button>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{user.name}</span>
                    {user.id === currentUser?.id && <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={user.role === "Admin" ? "default" : "secondary"} className="flex w-fit items-center gap-1">
                      {user.role === "Admin" && <Shield className="h-3 w-3" />}
                      {user.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} disabled={user.id === currentUser?.id}>
                      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
