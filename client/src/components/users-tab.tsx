import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Key, Trash2, AlertTriangle, Shield, User, Eye, EyeOff } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PublicUser, UserRole } from "@shared/schema";

export function UsersTab() {
  const { toast } = useToast();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<PublicUser | null>(null);
  
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("user");
  const [passwordToChange, setPasswordToChange] = useState("");
  const [showPasswordValue, setShowPasswordValue] = useState(false);
  const [showNewPasswordValue, setShowNewPasswordValue] = useState(false);

  const { data: users = [], isLoading } = useQuery<PublicUser[]>({
    queryKey: ["/api/users"],
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; role: UserRole }) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Utente creato con successo" });
      setShowAddModal(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile creare l'utente",
        variant: "destructive" 
      });
    },
  });

  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }: { id: string; password: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}/password`, { password });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Password aggiornata con successo" });
      setShowPasswordModal(false);
      setPasswordToChange("");
      setSelectedUser(null);
    },
    onError: () => {
      toast({ 
        title: "Errore", 
        description: "Impossibile aggiornare la password",
        variant: "destructive" 
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Utente eliminato" });
      setShowDeleteModal(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile eliminare l'utente",
        variant: "destructive" 
      });
    },
  });

  const resetForm = () => {
    setNewUsername("");
    setNewPassword("");
    setNewRole("user");
  };

  const handleCreateUser = () => {
    if (!newUsername.trim() || !newPassword.trim()) {
      toast({ title: "Errore", description: "Compila tutti i campi", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Errore", description: "La password deve essere almeno 6 caratteri", variant: "destructive" });
      return;
    }
    createUserMutation.mutate({ 
      username: newUsername.trim(), 
      password: newPassword,
      role: newRole 
    });
  };

  const handleUpdatePassword = () => {
    if (!selectedUser || !passwordToChange.trim()) return;
    if (passwordToChange.length < 6) {
      toast({ title: "Errore", description: "La password deve essere almeno 6 caratteri", variant: "destructive" });
      return;
    }
    updatePasswordMutation.mutate({ id: selectedUser.id, password: passwordToChange });
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-muted-foreground">Caricamento utenti...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Gestione Utenti</h2>
        </div>
        <Button onClick={() => setShowAddModal(true)} data-testid="button-add-user">
          <Plus className="mr-2 h-4 w-4" />
          Nuovo Utente
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Utenti registrati ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  data-testid={`user-row-${user.id}`}
                >
                  <div className="flex items-center gap-3">
                    {user.role === "admin" ? (
                      <Shield className="h-5 w-5 text-amber-500" />
                    ) : (
                      <User className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">{user.username}</p>
                      <p className="text-xs text-muted-foreground">
                        Creato: {new Date(user.createdAt).toLocaleDateString("it-IT")}
                      </p>
                    </div>
                    <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                      {user.role === "admin" ? "Amministratore" : "Utente"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowPasswordModal(true);
                      }}
                      data-testid={`button-change-password-${user.id}`}
                    >
                      <Key className="mr-2 h-4 w-4" />
                      Cambia Password
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDeleteModal(true);
                      }}
                      disabled={user.role === "admin" && users.filter(u => u.role === "admin").length <= 1}
                      data-testid={`button-delete-user-${user.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Nuovo Utente
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Username</Label>
              <Input
                placeholder="Inserisci username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                data-testid="input-new-username"
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showNewPasswordValue ? "text" : "password"}
                  placeholder="Inserisci password (min. 6 caratteri)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-10"
                  data-testid="input-new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPasswordValue(!showNewPasswordValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-new-password-visibility"
                  tabIndex={-1}
                >
                  {showNewPasswordValue ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ruolo</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as UserRole)}>
                <SelectTrigger data-testid="select-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Utente</SelectItem>
                  <SelectItem value="admin">Amministratore</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddModal(false); resetForm(); }}>
              Annulla
            </Button>
            <Button 
              onClick={handleCreateUser} 
              disabled={createUserMutation.isPending}
              data-testid="button-confirm-create-user"
            >
              {createUserMutation.isPending ? "Creazione..." : "Crea Utente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Cambia Password - {selectedUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nuova Password</Label>
              <div className="relative">
                <Input
                  type={showPasswordValue ? "text" : "password"}
                  placeholder="Inserisci nuova password (min. 6 caratteri)"
                  value={passwordToChange}
                  onChange={(e) => setPasswordToChange(e.target.value)}
                  className="pr-10"
                  data-testid="input-change-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswordValue(!showPasswordValue)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-toggle-password-visibility"
                  tabIndex={-1}
                >
                  {showPasswordValue ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowPasswordModal(false); setPasswordToChange(""); setShowPasswordValue(false); }}>
              Annulla
            </Button>
            <Button 
              onClick={handleUpdatePassword} 
              disabled={updatePasswordMutation.isPending}
              data-testid="button-confirm-change-password"
            >
              {updatePasswordMutation.isPending ? "Aggiornamento..." : "Aggiorna Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Conferma Eliminazione
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Sei sicuro di voler eliminare l'utente <strong>{selectedUser?.username}</strong>?
            Questa azione non può essere annullata.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Annulla
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
              disabled={deleteUserMutation.isPending}
              data-testid="button-confirm-delete-user"
            >
              {deleteUserMutation.isPending ? "Eliminazione..." : "Elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
