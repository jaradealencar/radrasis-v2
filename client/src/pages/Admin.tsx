import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ShieldCheck, Users, Lock, KeyRound } from "lucide-react";

const ROLES = [
  { value: "master", label: "Master", color: "bg-purple-100 text-purple-800" },
  { value: "admin", label: "Admin", color: "bg-blue-100 text-blue-800" },
  { value: "gestor", label: "Gestor", color: "bg-indigo-100 text-indigo-800" },
  { value: "vendas", label: "Vendas", color: "bg-green-100 text-green-800" },
  { value: "logistica", label: "Logística", color: "bg-orange-100 text-orange-800" },
  { value: "producao", label: "Produção", color: "bg-yellow-100 text-yellow-800" },
  { value: "financeiro", label: "Financeiro", color: "bg-red-100 text-red-800" },
  { value: "empacotamento", label: "Empacotamento", color: "bg-teal-100 text-teal-800" },
] as const;

const PAGES = [
  { key: "painel", label: "Painel / Dashboard" },
  { key: "retrabalhos", label: "Retrabalhos (Lista)" },
  { key: "inserir", label: "Inserir Retrabalho" },
  { key: "biblioteca", label: "Biblioteca de Erros" },
  { key: "reincidencia", label: "Reincidência" },
  { key: "relatorio", label: "Relatório" },
  { key: "insights", label: "Insights IA" },
  { key: "conhecimento", label: "Base de Conhecimento" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "rotinas", label: "Rotinas" },
  { key: "regulamentos", label: "Regulamentos" },
  { key: "pops", label: "POPs" },
  { key: "admin", label: "Administração" },
];

type RoleValue = typeof ROLES[number]["value"];

function getRoleBadge(role: string) {
  const r = ROLES.find(r => r.value === role);
  return r ? (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.color}`}>
      {r.label}
    </span>
  ) : <span>{role}</span>;
}

// ─── ABA USUÁRIOS ─────────────────────────────────────────────────────────────
function UsersTab() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.localUsers.list.useQuery();

  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [resetUser, setResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendas" as RoleValue });
  const [editForm, setEditForm] = useState({ name: "", role: "vendas" as RoleValue, password: "", active: "sim" as "sim" | "nao" });

  const createMutation = trpc.localUsers.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.localUsers.list.invalidate();
      setShowCreate(false);
      setForm({ name: "", email: "", password: "", role: "vendas" });
    },
    onError: (err) => toast.error(err.message || "Erro ao criar usuário"),
  });

  const updateMutation = trpc.localUsers.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado!");
      utils.localUsers.list.invalidate();
      setEditUser(null);
    },
    onError: (err) => toast.error(err.message || "Erro ao atualizar"),
  });

  const deleteMutation = trpc.localUsers.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário removido.");
      utils.localUsers.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Erro ao remover"),
  });

  const openEdit = (u: any) => {
    setEditUser(u);
    setEditForm({ name: u.name, role: u.role, password: "", active: u.active });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-gray-900 hover:bg-gray-800 text-white gap-2">
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Nome</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Carregando...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-gray-400">Nenhum usuário cadastrado ainda.</TableCell></TableRow>
              ) : users.map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell className="text-gray-500 text-sm">{u.email}</TableCell>
                  <TableCell>{getRoleBadge(u.role)}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${u.active === "sim" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.active === "sim" ? "Ativo" : "Inativo"}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-400 text-sm">
                    {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(u)} title="Editar usuário">
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="text-blue-500 hover:text-blue-700 hover:bg-blue-50" onClick={() => { setResetUser(u); setNewPassword(""); }} title="Redefinir senha">
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                        onClick={() => { if (confirm(`Remover ${u.name}?`)) deleteMutation.mutate({ id: u.id }); }}
                        title="Remover usuário"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Modal Criar */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input placeholder="Ex: João Silva" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input type="email" placeholder="joao@letreiros.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Senha inicial</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v as RoleValue }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button
              className="bg-gray-900 hover:bg-gray-800 text-white"
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(form)}
            >
              {createMutation.isPending ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Reset Senha */}
      <Dialog open={!!resetUser} onOpenChange={() => setResetUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Redefinir Senha — {resetUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-500">Digite a nova senha para o usuário <strong>{resetUser?.name}</strong>.</p>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <Input type="password" placeholder="Mínimo 6 caracteres" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetUser(null)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white"
              disabled={newPassword.length < 6 || updateMutation.isPending}
              onClick={() => {
                updateMutation.mutate({ id: resetUser.id, password: newPassword }, {
                  onSuccess: () => { toast.success("Senha redefinida com sucesso!"); setResetUser(null); setNewPassword(""); }
                });
              }}
            >
              {updateMutation.isPending ? "Salvando..." : "Redefinir Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Editar */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário — {editUser?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil de acesso</Label>
              <Select value={editForm.role} onValueChange={v => setEditForm(f => ({ ...f, role: v as RoleValue }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nova senha (deixe em branco para manter)</Label>
              <Input type="password" placeholder="••••••••" value={editForm.password} onChange={e => setEditForm(f => ({ ...f, password: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Usuário ativo</Label>
              <Switch
                checked={editForm.active === "sim"}
                onCheckedChange={v => setEditForm(f => ({ ...f, active: v ? "sim" : "nao" }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancelar</Button>
            <Button
              className="bg-gray-900 hover:bg-gray-800 text-white"
              disabled={updateMutation.isPending}
              onClick={() => {
                const payload: any = { id: editUser.id, name: editForm.name, role: editForm.role, active: editForm.active };
                if (editForm.password) payload.password = editForm.password;
                updateMutation.mutate(payload);
              }}
            >
              {updateMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── ABA PERMISSÕES ───────────────────────────────────────────────────────────
function PermissionsTab() {
  const utils = trpc.useUtils();
  const { data: matrix, isLoading } = trpc.permissions.getAll.useQuery();

  const setPermMutation = trpc.permissions.set.useMutation({
    onSuccess: () => { toast.success("Permissão atualizada!"); utils.permissions.getAll.invalidate(); },
    onError: (err) => toast.error(err.message || "Erro ao salvar permissão"),
  });

  const editableRoles = ROLES.filter(r => r.value !== "master" && r.value !== "admin");

  if (isLoading) return <div className="py-12 text-center text-gray-400">Carregando permissões...</div>;

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
        <strong>Master</strong> e <strong>Admin</strong> têm acesso total a todas as abas e não podem ser restringidos. Configure as permissões dos demais perfis abaixo.
      </div>

      <Card className="border-0 shadow-sm overflow-auto">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="min-w-[180px]">Aba / Módulo</TableHead>
                {editableRoles.map(r => (
                  <TableHead key={r.value} className="text-center min-w-[100px]">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.color}`}>
                      {r.label}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {PAGES.map(page => (
                <TableRow key={page.key}>
                  <TableCell className="font-medium text-sm">{page.label}</TableCell>
                  {editableRoles.map(r => {
                    const hasAccess = matrix?.[r.value]?.[page.key] ?? false;
                    return (
                      <TableCell key={r.value} className="text-center">
                        <Switch
                          checked={hasAccess}
                          onCheckedChange={v => setPermMutation.mutate({ role: r.value, pageKey: page.key, canAccess: v })}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function Admin() {

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <ShieldCheck className="w-6 h-6" /> Administração
        </h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie usuários do sistema e configure permissões de acesso por perfil.</p>
      </div>

      <Tabs defaultValue="usuarios">
        <TabsList className="bg-gray-100">
          <TabsTrigger value="usuarios" className="gap-2">
            <Users className="w-4 h-4" /> Usuários
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="mt-4">
          <UsersTab />
        </TabsContent>

        <TabsContent value="permissoes" className="mt-4">
          <PermissionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
