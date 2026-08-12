import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Users, Plus, Shield, Edit, Trash2, Key, CheckCircle, XCircle,
  Lock, Unlock, ChevronDown, ChevronUp
} from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

const ROLES: Record<string, { label: string; color: string; description: string }> = {
  master: { label: "Master", color: "bg-purple-100 text-purple-700", description: "Acesso total ao sistema, gerencia usuários e permissões" },
  admin: { label: "Admin", color: "bg-red-100 text-red-700", description: "Acesso a todos os módulos exceto configurações de sistema" },
  gestor: { label: "Gestor", color: "bg-rose-100 text-rose-700", description: "Gestor de setor — responsável por retrabalhos sem funcionário direto" },
  vendas: { label: "Vendas", color: "bg-blue-100 text-blue-700", description: "Acesso ao módulo comercial e solicitações de frete" },
  logistica: { label: "Logística", color: "bg-green-100 text-green-700", description: "Acesso ao módulo de logística e cotações" },
  producao: { label: "Produção", color: "bg-orange-100 text-orange-700", description: "Acesso ao módulo de retrabalhos e operações" },
  financeiro: { label: "Financeiro", color: "bg-yellow-100 text-yellow-700", description: "Acesso a relatórios e dados financeiros" },
  empacotamento: { label: "Empacotamento", color: "bg-emerald-100 text-emerald-700", description: "Acesso ao módulo de empacotamento/expedição (visão operacional)" },
};

// Mapeamento de páginas para exibição amigável
const PAGE_GROUPS = [
  {
    group: "Painel e Retrabalhos",
    pages: [
      { key: "painel", label: "Dashboard Principal" },
      { key: "retrabalhos", label: "Lista de Retrabalhos" },
      { key: "inserir", label: "Inserir Retrabalho" },
      { key: "biblioteca", label: "Biblioteca de Erros" },
      { key: "reincidencia", label: "Análise de Reincidência" },
      { key: "relatorio", label: "Relatórios" },
      { key: "insights", label: "Insights com IA" },
      { key: "auditoria", label: "Auditoria de Retrabalhos" },
    ],
  },
  {
    group: "Operações",
    pages: [
      { key: "conhecimento", label: "Base de Conhecimento" },
      { key: "fornecedores", label: "Fornecedores" },
      { key: "rotinas", label: "Rotinas" },
      { key: "regulamentos", label: "Regulamentos" },
      { key: "pops", label: "POPs" },
      { key: "pops-relatorio", label: "Relatório de Acessos POPs" },
      { key: "cargos-funcoes", label: "Cargos e Funções" },
      { key: "operacoes-performance", label: "Visão de Performance" },
      { key: "operacoes-custo-solda", label: "Custo de Solda" },
    ],
  },
  {
    group: "Comercial",
    pages: [
      { key: "tabela-preco", label: "Tabela de Preços" },
      { key: "crm-auditoria", label: "Auditoria do CRM" },
    ],
  },
  {
    group: "Logística",
    pages: [
      { key: "logistica-dashboard", label: "Dashboard Logística" },
      { key: "logistica-solicitacoes", label: "Solicitações de Frete" },
      { key: "logistica-minhas-cotacoes", label: "Minhas Cotações" },
      { key: "logistica-transportadoras", label: "Transportadoras" },
      { key: "logistica-consulta", label: "Consulta de Cobertura" },
      { key: "logistica-importar-cte", label: "Importar CT-e" },
      { key: "logistica-assertividade", label: "Assertividade (IA)" },
      { key: "logistica-empacotamento", label: "Empacotamento" },
    ],
  },
  {
    group: "Administração",
    pages: [
      { key: "admin", label: "Painel Admin" },
      { key: "admin-usuarios", label: "Usuários e Permissões" },
      { key: "admin-permissoes", label: "Configurar Permissões" },
    ],
  },
];

// Permissões padrão por role
const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  master: PAGE_GROUPS.flatMap(g => g.pages.map(p => p.key)),
  admin: ["painel","retrabalhos","inserir","biblioteca","reincidencia","relatorio","insights","auditoria","conhecimento","fornecedores","rotinas","regulamentos","pops","pops-relatorio","cargos-funcoes","operacoes-performance","operacoes-custo-solda","tabela-preco","crm-auditoria","logistica-dashboard","logistica-solicitacoes","logistica-transportadoras","logistica-consulta","logistica-importar-cte","logistica-assertividade","logistica-empacotamento","admin","admin-usuarios"],
  vendas: ["painel","conhecimento","tabela-preco","logistica-minhas-cotacoes"],
  logistica: ["painel","logistica-dashboard","logistica-solicitacoes","logistica-transportadoras","logistica-consulta","logistica-importar-cte","logistica-assertividade","logistica-empacotamento"],
  producao: ["painel","retrabalhos","inserir","biblioteca","reincidencia","rotinas","regulamentos","pops","cargos-funcoes","operacoes-performance","operacoes-custo-solda"],
  financeiro: ["painel","retrabalhos","relatorio","insights","tabela-preco","operacoes-custo-solda"],
  gestor: ["painel","retrabalhos","inserir","biblioteca","reincidencia","relatorio","insights","auditoria","rotinas","regulamentos","pops","operacoes-performance"],
  empacotamento: ["logistica-empacotamento"],
};

function RoleBadge({ role }: { role: string }) {
  const r = ROLES[role] ?? { label: role, color: "bg-gray-100 text-gray-700" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${r.color}`}>{r.label}</span>;
}

// ─── Painel de Permissões por Role ───────────────────────────────────────────
function PermissoesPanel() {
  const utils = trpc.useUtils();
  const { data: perms = [] } = trpc.permissions.getAll.useQuery();
  const setPermission = trpc.permissions.set.useMutation({
    onSuccess: () => utils.permissions.getAll.invalidate(),
  });

  const isAllowed = (role: string, pageKey: string) => {
    const matrix = perms as Record<string, Record<string, boolean>>;
    if (matrix[role]?.[pageKey] !== undefined) return matrix[role][pageKey];
    return DEFAULT_PERMISSIONS[role]?.includes(pageKey) ?? false;
  };

  const toggle = (role: string, pageKey: string) => {
    const current = isAllowed(role, pageKey);
    setPermission.mutate({ role: role as any, pageKey, canAccess: !current });
  };

  const roleKeys = Object.keys(ROLES);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground bg-blue-50 border border-blue-100 rounded-lg p-3">
        <Shield className="w-4 h-4 text-blue-500 shrink-0" />
        <span>Esta matriz define o que cada função pode acessar. Alterações têm efeito imediato para todos os usuários com aquela função.</span>
      </div>

      {PAGE_GROUPS.map(group => (
        <div key={group.group}>
          <h3 className="font-semibold text-sm mb-2 text-muted-foreground uppercase tracking-wide">{group.group}</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Página / Módulo</TableHead>
                  {roleKeys.map(r => (
                    <TableHead key={r} className="text-center min-w-[80px]">
                      <RoleBadge role={r} />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.pages.map((page, idx) => (
                  <TableRow key={page.key} className={idx % 2 === 0 ? "bg-background" : "bg-muted/20"}>
                    <TableCell className="font-medium">{page.label}</TableCell>
                    {roleKeys.map(role => {
                      const allowed = isAllowed(role, page.key);
                      const isMaster = role === "master";
                      return (
                        <TableCell key={role} className="text-center">
                          {isMaster ? (
                            <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                          ) : (
                            <button
                              onClick={() => toggle(role, page.key)}
                              className={`w-8 h-5 rounded-full transition-colors mx-auto flex items-center justify-center ${allowed ? "bg-green-500" : "bg-gray-200"}`}
                              title={allowed ? "Clique para revogar acesso" : "Clique para conceder acesso"}
                            >
                              <span className={`w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${allowed ? "translate-x-1.5" : "-translate-x-1.5"}`}></span>
                            </button>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Lista de Usuários ────────────────────────────────────────────────────────
function UsuariosList() {
  const utils = trpc.useUtils();
  const { data: usuarios = [], isLoading } = trpc.localUsers.list.useQuery();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");

  const [form, setForm] = useState({ name: "", email: "", password: "", role: "vendas" as string });

  const create = trpc.localUsers.create.useMutation({
    onSuccess: () => { utils.localUsers.list.invalidate(); setShowCreate(false); toast.success("Usuário criado!"); setForm({ name: "", email: "", password: "", role: "vendas" }); },
    onError: (e) => toast.error(e.message),
  });
  const update = trpc.localUsers.update.useMutation({
    onSuccess: () => { utils.localUsers.list.invalidate(); setEditingId(null); toast.success("Usuário atualizado!"); },
  });
  const del = trpc.localUsers.delete.useMutation({
    onSuccess: () => { utils.localUsers.list.invalidate(); toast.success("Usuário removido"); },
    onError: (e) => toast.error(e.message),
  });
  const resetPwd = trpc.localUsers.update.useMutation({
    onSuccess: () => { setResetPasswordId(null); setNewPassword(""); toast.success("Senha redefinida!"); },
  });
  const toggleActive = trpc.localUsers.update.useMutation({
    onSuccess: () => { toast.success("Status do usuário atualizado!"); utils.localUsers.list.invalidate(); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{usuarios.length} usuário(s) cadastrado(s)</p>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />Novo Usuário
        </Button>
      </div>

      {/* Modal criar */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3 overflow-hidden">
            <div>
              <Label>Nome completo *</Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome do usuário" />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v, email: (v === "producao" || v === "empacotamento") ? "" : p.email }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ROLES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="font-medium">{v.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.role !== "producao" && form.role !== "empacotamento" && (
              <div>
                <Label>E-mail *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="usuario@empresa.com" />
              </div>
            )}
            <div>
              <Label>Senha temporária *</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" />
            </div>
            {form.role === "producao" || form.role === "empacotamento" ? (
              <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700">
                Usuário de produção: login feito com <strong>nome</strong> e senha. Não é necessário e-mail.
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded p-2 text-xs text-amber-700">
                O usuário poderá fazer login com e-mail e senha. Recomende que altere a senha no primeiro acesso.
              </div>
            )}
            <Button
              className="w-full"
              disabled={!form.name || (form.role !== "producao" && form.role !== "empacotamento" && !form.email) || !form.password}
              onClick={() => {
                const payload: any = { name: form.name, password: form.password, role: form.role };
                if (form.email && form.email.trim()) payload.email = form.email.trim();
                create.mutate(payload);
              }}
            >
              Criar Usuário
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal redefinir senha */}
      <Dialog open={resetPasswordId !== null} onOpenChange={open => !open && setResetPasswordId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Redefinir Senha</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nova senha *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button className="w-full" disabled={newPassword.length < 6} onClick={() => resetPwd.mutate({ id: resetPasswordId!, password: newPassword })}>
              Redefinir Senha
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}</div>
      ) : usuarios.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhum usuário cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {usuarios.map((u: any) => (
            <div key={u.id} className={`border rounded-lg p-3 ${u.active === "nao" ? "opacity-60" : ""}`}>
              {editingId === u.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs">Nome</Label>
                      <Input defaultValue={u.name} id={`name-${u.id}`} className="h-8 text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs">Função</Label>
                      <Select defaultValue={u.role} onValueChange={v => {
                        (document.getElementById(`role-${u.id}`) as HTMLInputElement).value = v;
                      }}>
                        <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(ROLES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <input type="hidden" id={`role-${u.id}`} defaultValue={u.role} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Nova senha <span className="text-muted-foreground">(deixe em branco para manter)</span></Label>
                    <Input type="password" id={`pwd-${u.id}`} className="h-8 text-sm" placeholder="Mínimo 6 caracteres" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => {
                      const nameEl = document.getElementById(`name-${u.id}`) as HTMLInputElement;
                      const roleEl = document.getElementById(`role-${u.id}`) as HTMLInputElement;
                      const pwdEl = document.getElementById(`pwd-${u.id}`) as HTMLInputElement;
                      const payload: any = { id: u.id, name: nameEl?.value || u.name, role: (roleEl?.value || u.role) as any };
                      if (pwdEl?.value && pwdEl.value.length >= 6) payload.password = pwdEl.value;
                      else if (pwdEl?.value && pwdEl.value.length > 0) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
                      update.mutate(payload);
                    }}>Salvar</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancelar</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{u.name}</p>
                      <RoleBadge role={u.role} />
                      {u.active === "nao" && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Editar" onClick={() => setEditingId(u.id)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Redefinir senha" onClick={() => setResetPasswordId(u.id)}>
                      <Key className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => toggleActive.mutate({ id: u.id, active: u.active === "sim" ? "nao" : "sim" })}>
                      {u.active === "sim" ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" title="Excluir" onClick={() => { if (confirm(`Excluir ${u.name}?`)) del.mutate({ id: u.id }); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function Usuarios() {
  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Usuários e Permissões"
        description="Gerencie usuários do sistema e configure o que cada função pode acessar"
        icon={Users}
      />

      {/* Legenda de funções */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4" />Funções do Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {Object.entries(ROLES).map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
                <RoleBadge role={k} />
                <p className="text-xs text-muted-foreground leading-tight">{v.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="usuarios">
        <TabsList>
          <TabsTrigger value="usuarios" className="flex items-center gap-1">
            <Users className="w-4 h-4" />Usuários
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex items-center gap-1">
            <Shield className="w-4 h-4" />Matriz de Permissões
          </TabsTrigger>
        </TabsList>

        <TabsContent value="usuarios" className="pt-4">
          <UsuariosList />
        </TabsContent>

        <TabsContent value="permissoes" className="pt-4">
          <PermissoesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
