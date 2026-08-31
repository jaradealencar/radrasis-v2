import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  GitBranch, Plus, AlertTriangle, Edit2, Trash2, ChevronDown, ChevronUp,
  Fish, Table2, X, CheckCircle2, Clock, Eye, FileDown, Sparkles
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

// ─── Constantes ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-red-100 text-red-700 border-red-200",
  em_andamento: "bg-blue-100 text-blue-700 border-blue-200",
  concluido: "bg-green-100 text-green-700 border-green-200",
  monitorando: "bg-purple-100 text-purple-700 border-purple-200",
};
const STATUS_LABELS: Record<string, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  monitorando: "Monitorando",
};

const CATEGORIAS_6M = [
  { key: "maquina",      label: "Máquina",        color: "bg-blue-100 border-blue-400 text-blue-800",   dot: "bg-blue-500" },
  { key: "mao_de_obra",  label: "Mão de Obra",    color: "bg-orange-100 border-orange-400 text-orange-800", dot: "bg-orange-500" },
  { key: "material",     label: "Material",       color: "bg-green-100 border-green-400 text-green-800",  dot: "bg-green-500" },
  { key: "metodo",       label: "Método",         color: "bg-purple-100 border-purple-400 text-purple-800", dot: "bg-purple-500" },
  { key: "medida",       label: "Medida",         color: "bg-yellow-100 border-yellow-400 text-yellow-800", dot: "bg-yellow-500" },
  { key: "meio_ambiente",label: "Meio Ambiente",  color: "bg-teal-100 border-teal-400 text-teal-800",    dot: "bg-teal-500" },
] as const;

const PRIORIDADE_COLORS: Record<string, string> = {
  alta:  "bg-red-100 text-red-700 border-red-300",
  media: "bg-yellow-100 text-yellow-700 border-yellow-300",
  baixa: "bg-green-100 text-green-700 border-green-300",
};

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PlanoForm {
  codigoErro: string;
  codigosErro: string;
  setor: string;
  titulo: string;
  problemaRaiz: string;
  responsavel: string;
  prazo: string;
  status: "pendente" | "em_andamento" | "concluido" | "monitorando";
  errosPrevenidos: string;
  errosResolvidos: string;
}

const FORM_INICIAL: PlanoForm = {
  codigoErro: "", codigosErro: "", setor: "", titulo: "", problemaRaiz: "",
  responsavel: "", prazo: "", status: "pendente",
  errosPrevenidos: "", errosResolvidos: "",
};

interface CausaForm { causa: string; prioridade: "alta" | "media" | "baixa"; }
interface AcaoForm {
  what: string; why: string; where: string; who: string;
  when: string; how: string; howMuch: string;
}
const ACAO_INICIAL: AcaoForm = { what: "", why: "", where: "", who: "", when: "", how: "", howMuch: "" };

// ─── Diagrama Ishikawa (Espinha de Peixe) ─────────────────────────────────────

function DiagramaIshikawa({ planoId, titulo }: { planoId: number; titulo: string }) {
  const { data: causas = [], isLoading } = trpc.planosAcao.listCausas.useQuery({ planoId });
  const utils = trpc.useUtils();
  const [addingCat, setAddingCat] = useState<string | null>(null);
  const [causaForm, setCausaForm] = useState<CausaForm>({ causa: "", prioridade: "media" });
  const [editingCausa, setEditingCausa] = useState<{ id: number; causa: string; prioridade: "alta" | "media" | "baixa" } | null>(null);

  const createCausa = trpc.planosAcao.createCausa.useMutation({
    onSuccess: () => { toast.success("Causa adicionada!"); utils.planosAcao.listCausas.invalidate({ planoId }); setAddingCat(null); setCausaForm({ causa: "", prioridade: "media" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateCausa = trpc.planosAcao.updateCausa.useMutation({
    onSuccess: () => { toast.success("Causa atualizada!"); utils.planosAcao.listCausas.invalidate({ planoId }); setEditingCausa(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteCausa = trpc.planosAcao.deleteCausa.useMutation({
    onSuccess: () => { utils.planosAcao.listCausas.invalidate({ planoId }); },
    onError: (e) => toast.error(e.message),
  });

  const causasPorCat = (cat: string) => causas.filter((c: any) => c.categoria === cat);

  return (
    <div className="space-y-4">
      {/* Cabeçalho do diagrama */}
      <div className="flex items-center gap-2 mb-2">
        <Fish size={18} className="text-slate-600" />
        <h3 className="font-semibold text-slate-700">Diagrama de Ishikawa — Espinha de Peixe</h3>
        <span className="text-xs text-slate-400">(6M: Máquina, Mão de Obra, Material, Método, Medida, Meio Ambiente)</span>
      </div>

      {/* Espinha central — efeito (problema) */}
      <div className="relative flex items-center justify-end mb-1">
        <div className="flex-1 h-1 bg-slate-400 rounded-l-full" />
        <div className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-lg shadow ml-2 max-w-xs text-center">
          {titulo}
        </div>
      </div>

      {/* Grid 6M */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {CATEGORIAS_6M.map((cat) => {
          const lista = causasPorCat(cat.key);
          const isAdding = addingCat === cat.key;
          return (
            <div key={cat.key} className={`border-2 rounded-xl p-3 ${cat.color}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.dot}`} />
                  <span className="font-semibold text-sm">{cat.label}</span>
                  <span className="text-xs opacity-60">({lista.length})</span>
                </div>
                <button
                  onClick={() => { setAddingCat(isAdding ? null : cat.key); setCausaForm({ causa: "", prioridade: "media" }); }}
                  className="text-xs px-2 py-0.5 rounded-full bg-white/60 hover:bg-white/90 transition-colors font-medium"
                >
                  {isAdding ? "Cancelar" : "+ Causa"}
                </button>
              </div>

              {/* Lista de causas */}
              <div className="space-y-1.5 min-h-[40px]">
                {isLoading ? <div className="text-xs opacity-50">Carregando...</div> : null}
                {lista.map((c: any) => (
                  <div key={c.id} className="group flex items-start gap-1.5 bg-white/70 rounded-lg px-2 py-1.5">
                    {editingCausa?.id === c.id && editingCausa ? (
                      <div className="flex-1 space-y-1">
                        <Input
                          value={editingCausa.causa}
                          onChange={e => setEditingCausa(ec => ec ? { ...ec, causa: e.target.value } : ec)}
                          className="h-6 text-xs"
                          autoFocus
                        />
                        <div className="flex gap-1">
                          <select
                            value={editingCausa.prioridade}
                            onChange={e => setEditingCausa(ec => ec ? { ...ec, prioridade: e.target.value as any } : ec)}
                            className="text-xs border rounded px-1 py-0.5"
                          >
                            <option value="alta">Alta</option>
                            <option value="media">Média</option>
                            <option value="baixa">Baixa</option>
                          </select>
                          {(() => { const ec = editingCausa; return <button onClick={() => updateCausa.mutate({ id: ec.id, causa: ec.causa, prioridade: ec.prioridade })} className="text-xs bg-green-600 text-white px-2 rounded">OK</button>; })()}
                          <button onClick={() => setEditingCausa(null)} className="text-xs bg-slate-200 px-2 rounded">×</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span className={`mt-0.5 text-xs px-1 py-0.5 rounded border font-medium flex-shrink-0 ${PRIORIDADE_COLORS[c.prioridade ?? "media"]}`}>
                          {c.prioridade === "alta" ? "A" : c.prioridade === "media" ? "M" : "B"}
                        </span>
                        <span className="text-xs flex-1 leading-relaxed">{c.causa}</span>
                        <div className="hidden group-hover:flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditingCausa({ id: c.id, causa: c.causa, prioridade: c.prioridade ?? "media" })} className="text-slate-400 hover:text-blue-600"><Edit2 size={11} /></button>
                          <button onClick={() => { if (confirm("Remover esta causa?")) deleteCausa.mutate({ id: c.id }); }} className="text-slate-400 hover:text-red-600"><Trash2 size={11} /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {lista.length === 0 && !isAdding && (
                  <p className="text-xs opacity-40 italic px-1">Nenhuma causa identificada</p>
                )}
              </div>

              {/* Formulário de nova causa */}
              {isAdding && (
                <div className="mt-2 space-y-1.5 bg-white/80 rounded-lg p-2">
                  <Textarea
                    placeholder="Descreva a causa..."
                    value={causaForm.causa}
                    onChange={e => setCausaForm(f => ({ ...f, causa: e.target.value }))}
                    rows={2}
                    className="text-xs"
                    autoFocus
                  />
                  <div className="flex gap-2 items-center">
                    <select
                      value={causaForm.prioridade}
                      onChange={e => setCausaForm(f => ({ ...f, prioridade: e.target.value as any }))}
                      className="text-xs border rounded px-1.5 py-1 flex-1"
                    >
                      <option value="alta">Alta prioridade</option>
                      <option value="media">Média prioridade</option>
                      <option value="baixa">Baixa prioridade</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!causaForm.causa.trim()) return;
                        createCausa.mutate({ planoId, categoria: cat.key as any, causa: causaForm.causa, prioridade: causaForm.prioridade });
                      }}
                      disabled={!causaForm.causa.trim() || createCausa.isPending}
                      className="text-xs bg-slate-700 text-white px-3 py-1 rounded-lg disabled:opacity-50"
                    >
                      {createCausa.isPending ? "..." : "Adicionar"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tabela 5W2H ─────────────────────────────────────────────────────────────

function Tabela5W2H({ planoId, titulo, problemaRaiz, codigoErro }: { planoId: number; titulo: string; problemaRaiz?: string | null; codigoErro: string }) {
  const { data: acoes = [], isLoading } = trpc.planosAcao.listAcoes.useQuery({ planoId });
  const utils = trpc.useUtils();
  const [addingOpen, setAddingOpen] = useState(false);
  const [form, setForm] = useState<AcaoForm>(ACAO_INICIAL);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<AcaoForm>(ACAO_INICIAL);

  const createAcao = trpc.planosAcao.createAcao.useMutation({
    onSuccess: () => { toast.success("Ação adicionada!"); utils.planosAcao.listAcoes.invalidate({ planoId }); setAddingOpen(false); setForm(ACAO_INICIAL); },
    onError: (e) => toast.error(e.message),
  });
  const gerarIA = trpc.planosAcao.gerarAcoesIA.useMutation({
    onSuccess: (res) => { toast.success(`${res.count} ações geradas pela IA!`); utils.planosAcao.listAcoes.invalidate({ planoId }); },
    onError: (e) => toast.error(e.message),
  });
  const updateAcao = trpc.planosAcao.updateAcao.useMutation({
    onSuccess: () => { toast.success("Ação atualizada!"); utils.planosAcao.listAcoes.invalidate({ planoId }); setEditingId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteAcao = trpc.planosAcao.deleteAcao.useMutation({
    onSuccess: () => { utils.planosAcao.listAcoes.invalidate({ planoId }); },
    onError: (e) => toast.error(e.message),
  });

  const STATUS_ACAO_COLORS: Record<string, string> = {
    pendente: "bg-red-100 text-red-700",
    em_andamento: "bg-blue-100 text-blue-700",
    concluido: "bg-green-100 text-green-700",
  };
  const STATUS_ACAO_LABELS: Record<string, string> = {
    pendente: "Pendente", em_andamento: "Em Andamento", concluido: "Concluído",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Table2 size={18} className="text-slate-600" />
          <h3 className="font-semibold text-slate-700">Plano de Ação 5W2H</h3>
          <span className="text-xs text-slate-400">({acoes.length} ações)</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => gerarIA.mutate({ planoId, titulo, problemaRaiz: problemaRaiz ?? undefined, codigoErro, quantidade: 5 })} disabled={gerarIA.isPending} className="gap-1.5 h-8 text-purple-600 border-purple-200 hover:bg-purple-50">
            {gerarIA.isPending ? <Spinner className="size-[13px]" /> : <Sparkles size={13} />} Gerar com IA
          </Button>
          <Button size="sm" onClick={() => setAddingOpen(true)} className="gap-1.5 h-8">
            <Plus size={13} /> Nova Ação
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-6 text-slate-400 text-sm">Carregando ações...</div>
      ) : acoes.length === 0 && !addingOpen ? (
        <Empty className="border-2 border-slate-200 rounded-xl">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Table2 /></EmptyMedia>
            <EmptyTitle>Nenhuma ação cadastrada</EmptyTitle>
            <EmptyDescription>Clique em "Nova Ação" para adicionar ações práticas ao plano</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-xl border border-slate-200">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-[160px]">O Quê? <span className="font-normal text-slate-400">(What)</span></TableHead>
                <TableHead className="min-w-[120px]">Por Quê? <span className="font-normal text-slate-400">(Why)</span></TableHead>
                <TableHead className="min-w-[100px]">Onde? <span className="font-normal text-slate-400">(Where)</span></TableHead>
                <TableHead className="min-w-[100px]">Quem? <span className="font-normal text-slate-400">(Who)</span></TableHead>
                <TableHead className="min-w-[90px]">Quando? <span className="font-normal text-slate-400">(When)</span></TableHead>
                <TableHead className="min-w-[140px]">Como? <span className="font-normal text-slate-400">(How)</span></TableHead>
                <TableHead className="min-w-[90px]">Quanto? <span className="font-normal text-slate-400">(How Much)</span></TableHead>
                <TableHead className="min-w-[110px]">Status</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acoes.map((a: any, idx: number) => (
                <TableRow key={a.id}>
                  {editingId === a.id ? (
                    <>
                      <TableCell className="text-slate-400">{idx + 1}</TableCell>
                      <TableCell className="px-2 py-1"><Textarea value={editForm.what} onChange={e => setEditForm(f => ({ ...f, what: e.target.value }))} rows={2} className="text-xs min-w-[140px]" /></TableCell>
                      <TableCell className="px-2 py-1"><Textarea value={editForm.why} onChange={e => setEditForm(f => ({ ...f, why: e.target.value }))} rows={2} className="text-xs min-w-[100px]" /></TableCell>
                      <TableCell className="px-2 py-1"><Input value={editForm.where} onChange={e => setEditForm(f => ({ ...f, where: e.target.value }))} className="text-xs h-7" /></TableCell>
                      <TableCell className="px-2 py-1"><Input value={editForm.who} onChange={e => setEditForm(f => ({ ...f, who: e.target.value }))} className="text-xs h-7" /></TableCell>
                      <TableCell className="px-2 py-1"><Input value={editForm.when} onChange={e => setEditForm(f => ({ ...f, when: e.target.value }))} className="text-xs h-7" /></TableCell>
                      <TableCell className="px-2 py-1"><Textarea value={editForm.how} onChange={e => setEditForm(f => ({ ...f, how: e.target.value }))} rows={2} className="text-xs min-w-[120px]" /></TableCell>
                      <TableCell className="px-2 py-1"><Input value={editForm.howMuch} onChange={e => setEditForm(f => ({ ...f, howMuch: e.target.value }))} className="text-xs h-7" /></TableCell>
                      <TableCell className="px-2 py-1 text-slate-400 text-xs">—</TableCell>
                      <TableCell className="px-2 py-1">
                        <div className="flex gap-1">
                          <button onClick={() => updateAcao.mutate({ id: a.id, ...editForm })} className="text-xs bg-green-600 text-white px-2 py-1 rounded">OK</button>
                          <button onClick={() => setEditingId(null)} className="text-xs bg-slate-200 px-2 py-1 rounded">×</button>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-slate-400 font-medium">{idx + 1}</TableCell>
                      <TableCell className="font-medium text-slate-800 leading-relaxed">{a.what}</TableCell>
                      <TableCell className="text-slate-600 leading-relaxed">{a.why || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-slate-600">{a.where || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-slate-600">{a.who || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-slate-600">{a.when || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-slate-600 leading-relaxed">{a.how || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell className="text-slate-600">{a.howMuch || <span className="text-slate-300">—</span>}</TableCell>
                      <TableCell>
                        <select
                          value={a.status ?? "pendente"}
                          onChange={e => updateAcao.mutate({ id: a.id, status: e.target.value as any })}
                          className={`text-xs px-2 py-1 rounded-full border font-medium cursor-pointer ${STATUS_ACAO_COLORS[a.status ?? "pendente"]}`}
                        >
                          <option value="pendente">Pendente</option>
                          <option value="em_andamento">Em Andamento</option>
                          <option value="concluido">Concluído</option>
                        </select>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <button onClick={() => { setEditingId(a.id); setEditForm({ what: a.what ?? "", why: a.why ?? "", where: a.where ?? "", who: a.who ?? "", when: a.when ?? "", how: a.how ?? "", howMuch: a.howMuch ?? "" }); }} className="text-slate-400 hover:text-blue-600"><Edit2 size={12} /></button>
                          <button onClick={() => { if (confirm("Remover esta ação?")) deleteAcao.mutate({ id: a.id }); }} className="text-slate-400 hover:text-red-600"><Trash2 size={12} /></button>
                        </div>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Formulário de nova ação */}
      {addingOpen && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm font-semibold text-blue-800 flex items-center justify-between">
              Nova Ação 5W2H
              <button onClick={() => { setAddingOpen(false); setForm(ACAO_INICIAL); }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-blue-700">O Quê? (What) *</Label>
                <Textarea placeholder="Descreva a ação a ser executada..." value={form.what} onChange={e => setForm(f => ({ ...f, what: e.target.value }))} rows={2} className="text-sm" autoFocus />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-blue-700">Por Quê? (Why)</Label>
                <Textarea placeholder="Justificativa da ação..." value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))} rows={2} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-blue-700">Onde? (Where)</Label>
                <Input placeholder="Local de execução" value={form.where} onChange={e => setForm(f => ({ ...f, where: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-blue-700">Quem? (Who)</Label>
                <Input placeholder="Responsável pela ação" value={form.who} onChange={e => setForm(f => ({ ...f, who: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-blue-700">Quando? (When)</Label>
                <Input placeholder="Ex: Semana 1, até 30/06" value={form.when} onChange={e => setForm(f => ({ ...f, when: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-blue-700">Quanto Custa? (How Much)</Label>
                <Input placeholder="Ex: R$ 500, Sem custo" value={form.howMuch} onChange={e => setForm(f => ({ ...f, howMuch: e.target.value }))} className="text-sm" />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs font-semibold text-blue-700">Como? (How)</Label>
                <Textarea placeholder="Descreva o método de execução..." value={form.how} onChange={e => setForm(f => ({ ...f, how: e.target.value }))} rows={2} className="text-sm" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setAddingOpen(false); setForm(ACAO_INICIAL); }}>Cancelar</Button>
              <Button size="sm" onClick={() => createAcao.mutate({ planoId, ...form })} disabled={!form.what.trim() || createAcao.isPending}>
                {createAcao.isPending ? "Salvando..." : "Adicionar Ação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Detalhe do Plano (Ishikawa + 5W2H + Erros) ──────────────────────────────

function ProgressBar({ total, concluidas, emAndamento }: { total: number; concluidas: number; emAndamento: number }) {
  if (total === 0) return <p className="text-xs text-slate-400 italic">Nenhuma ação cadastrada</p>;
  const pctConc = Math.round((concluidas / total) * 100);
  const pctAnd = Math.round((emAndamento / total) * 100);
  const pctPend = 100 - pctConc - pctAnd;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">{pctConc}% concluído</span>
        <span className="text-slate-400">{concluidas}/{total} ações</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-slate-100 flex">
        <div className="bg-green-500 transition-all duration-500" style={{ width: `${pctConc}%` }} />
        <div className="bg-blue-400 transition-all duration-500" style={{ width: `${pctAnd}%` }} />
        <div className="bg-slate-200" style={{ width: `${pctPend}%` }} />
      </div>
      <div className="flex gap-3 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Concluído ({concluidas})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Em andamento ({emAndamento})</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-200 inline-block" />Pendente ({total - concluidas - emAndamento})</span>
      </div>
    </div>
  );
}

function DetalhePlano({ plano, onClose }: { plano: any; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"ishikawa" | "5w2h">("ishikawa");
  const [exporting, setExporting] = useState(false);
  const errosPrevenidos: string[] = (() => { try { return JSON.parse(plano.errosPrevenidos || "[]"); } catch { return []; } })();
  const errosResolvidos: string[] = (() => { try { return JSON.parse(plano.errosResolvidos || "[]"); } catch { return []; } })();

  const { data: exportData } = trpc.planosAcao.exportData.useQuery({ id: plano.id });

  const exportPdf = useCallback(() => {
    if (!exportData) { toast.error("Dados ainda carregando, tente novamente."); return; }
    setExporting(true);
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const { plano: p, causas, acoes } = exportData;
      const errosPrev: string[] = (() => { try { return JSON.parse(p.errosPrevenidos || "[]"); } catch { return []; } })();
      const errosRes: string[] = (() => { try { return JSON.parse(p.errosResolvidos || "[]"); } catch { return []; } })();

      // ── Cabeçalho ──
      doc.setFillColor(30, 41, 59);
      doc.rect(0, 0, 297, 22, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PLANO DE AÇÃO", 14, 10);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Metodologia: Ishikawa (6M) + 5W2H", 14, 16);
      doc.text(`Gerado em: ${new Date().toLocaleDateString("pt-BR")}`, 220, 16);

      // ── Dados do plano ──
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text(p.titulo ?? "", 14, 30);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      let yPos = 36;
      if (p.codigoErro) { doc.text(`Código: ${p.codigoErro}`, 14, yPos); }
      if (p.setor) { doc.text(`Setor: ${p.setor}`, 60, yPos); }
      if (p.responsavel) { doc.text(`Responsável: ${p.responsavel}`, 110, yPos); }
      if (p.prazo) { doc.text(`Prazo: ${new Date(p.prazo).toLocaleDateString("pt-BR")}`, 190, yPos); }
      yPos += 5;
      if (p.problemaRaiz) {
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "italic");
        const lines = doc.splitTextToSize(`Problema raiz: ${p.problemaRaiz}`, 265) as string[];
        doc.text(lines, 14, yPos);
        yPos += lines.length * 4 + 2;
      }
      if (errosPrev.length > 0) { doc.setFont("helvetica", "normal"); doc.setTextColor(59, 130, 246); doc.text(`Previne: ${errosPrev.join(", ")}`, 14, yPos); yPos += 5; }
      if (errosRes.length > 0) { doc.setFont("helvetica", "normal"); doc.setTextColor(34, 197, 94); doc.text(`Resolve: ${errosRes.join(", ")}`, 14, yPos); yPos += 5; }

      // ── Ishikawa ──
      yPos += 3;
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("DIAGRAMA DE ISHIKAWA — 6M", 14, yPos);
      yPos += 4;

      const cats6m = [
        { key: "maquina", label: "Máquina" },
        { key: "mao_de_obra", label: "Mão de Obra" },
        { key: "material", label: "Material" },
        { key: "metodo", label: "Método" },
        { key: "medida", label: "Medida" },
        { key: "meio_ambiente", label: "Meio Ambiente" },
      ];
      const ishikawaRows: string[][] = [];
      for (const cat of cats6m) {
        const causasCat = causas.filter((c: any) => c.categoria === cat.key);
        if (causasCat.length === 0) continue;
        causasCat.forEach((c: any, i: number) => {
          ishikawaRows.push([
            i === 0 ? cat.label : "",
            c.prioridade === "alta" ? "Alta" : c.prioridade === "media" ? "Média" : "Baixa",
            c.causa,
          ]);
        });
      }
      autoTable(doc, {
        startY: yPos,
        head: [["Categoria (6M)", "Prioridade", "Causa Identificada"]],
        body: ishikawaRows,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold" },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 35 }, 1: { cellWidth: 22 }, 2: { cellWidth: "auto" } },
        margin: { left: 14, right: 14 },
      });

      // ── 5W2H ──
      const finalY = (doc as any).lastAutoTable?.finalY ?? yPos + 40;
      let y5w2h = finalY + 8;
      if (y5w2h > 185) { doc.addPage(); y5w2h = 14; }
      doc.setTextColor(30, 41, 59);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("PLANO DE AÇÃO 5W2H", 14, y5w2h);
      y5w2h += 4;

      const acaoRows = acoes.map((a: any, i: number) => [
        String(i + 1),
        a.what ?? "",
        a.why ?? "",
        a.where ?? "",
        a.who ?? "",
        a.when ?? "",
        a.how ?? "",
        a.howMuch ?? "",
        a.status === "concluido" ? "Concluído" : a.status === "em_andamento" ? "Em Andamento" : "Pendente",
      ]);
      autoTable(doc, {
        startY: y5w2h,
        head: [["#", "O Quê?", "Por Quê?", "Onde?", "Quem?", "Quando?", "Como?", "Quanto?", "Status"]],
        body: acaoRows,
        styles: { fontSize: 7, cellPadding: 1.5, overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7 },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 35 },
          2: { cellWidth: 30 },
          3: { cellWidth: 22 },
          4: { cellWidth: 22 },
          5: { cellWidth: 20 },
          6: { cellWidth: 35 },
          7: { cellWidth: 20 },
          8: { cellWidth: 22 },
        },
        margin: { left: 14, right: 14 },
      });

      doc.save(`Plano_Acao_${(p.codigoErro ?? p.titulo ?? "plano").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
      toast.success("PDF exportado com sucesso!");
    } catch (err) {
      toast.error("Erro ao gerar PDF");
      console.error(err);
    } finally {
      setExporting(false);
    }
  }, [exportData]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl my-4">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="text-lg font-bold text-slate-800">{plano.titulo}</h2>
              {plano.codigoErro && <Badge variant="outline" className="font-mono text-xs">{plano.codigoErro}</Badge>}
              {plano.setor && <Badge variant="secondary" className="text-xs">{plano.setor}</Badge>}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[plano.status ?? "pendente"]}`}>
                {STATUS_LABELS[plano.status ?? "pendente"]}
              </span>
            </div>
            {plano.problemaRaiz && <p className="text-sm text-slate-500">{plano.problemaRaiz}</p>}
          </div>
          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={exportPdf}
              disabled={exporting || !exportData}
              className="gap-1.5 text-xs h-8"
            >
              {exporting ? <Spinner className="size-3" /> : <FileDown size={12} />}
              {exporting ? "Gerando..." : "Exportar PDF"}
            </Button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
          </div>
        </div>
        {/* Erros prevenidos / resolvidos */}
        {(errosPrevenidos.length > 0 || errosResolvidos.length > 0) && (
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex flex-wrap gap-4">
            {errosPrevenidos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Previne:</span>
                <div className="flex flex-wrap gap-1">
                  {errosPrevenidos.map(e => <Badge key={e} className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{e}</Badge>)}
                </div>
              </div>
            )}
            {errosResolvidos.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Resolve:</span>
                <div className="flex flex-wrap gap-1">
                  {errosResolvidos.map(e => <Badge key={e} className="bg-green-100 text-green-700 border-green-200 text-xs">{e}</Badge>)}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setActiveTab("ishikawa")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "ishikawa" ? "border-slate-700 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            <Fish size={15} /> Ishikawa (6M)
          </button>
          <button
            onClick={() => setActiveTab("5w2h")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === "5w2h" ? "border-slate-700 text-slate-800" : "border-transparent text-slate-400 hover:text-slate-600"}`}
          >
            <Table2 size={15} /> 5W2H
          </button>
        </div>
        {/* Conteúdo */}
        <div className="p-5">
          {activeTab === "ishikawa" && <DiagramaIshikawa planoId={plano.id} titulo={plano.titulo} />}
          {activeTab === "5w2h" && <Tabela5W2H planoId={plano.id} titulo={plano.titulo ?? ""} problemaRaiz={plano.problemaRaiz} codigoErro={plano.codigoErro ?? ""} />}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Criação/Edição do Plano ─────────────────────────────────────────

function ModalPlano({
  open, onClose, editingId, initialForm, onSaved,
}: {
  open: boolean; onClose: () => void; editingId: number | null;
  initialForm: PlanoForm; onSaved: () => void;
}) {
  const [form, setForm] = useState<PlanoForm>(initialForm);
  const utils = trpc.useUtils();

  const createMut = trpc.planosAcao.create.useMutation({
    onSuccess: () => { toast.success("Plano criado!"); onSaved(); onClose(); utils.planosAcao.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.planosAcao.update.useMutation({
    onSuccess: () => { toast.success("Plano atualizado!"); onSaved(); onClose(); utils.planosAcao.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const parseTagInput = (val: string) => val.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);

  const salvar = () => {
    const codigosErroList = parseTagInput(form.codigosErro);
    const payload = {
      titulo: form.titulo,
      codigoErro: form.codigoErro,
      setor: form.setor || undefined,
      problemaRaiz: form.problemaRaiz || undefined,
      responsavel: form.responsavel || undefined,
      prazo: form.prazo || undefined,
      errosPrevenidos: parseTagInput(form.errosPrevenidos),
      errosResolvidos: parseTagInput(form.errosResolvidos),
      codigosErro: codigosErroList,
    };
    if (editingId) {
      updateMut.mutate({ id: editingId, ...payload, status: form.status });
    } else {
      createMut.mutate(payload);
    }
  };

  // Sync form when initialForm changes (e.g. when opening edit)
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm(initialForm);
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Plano de Ação" : "Novo Plano de Ação"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Título *</Label>
            <Input placeholder="Ex: Redução de Retrabalho na Pintura" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Código do Erro</Label>
              <Input placeholder="Ex: PIN-001" value={form.codigoErro} onChange={e => setForm(f => ({ ...f, codigoErro: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Input placeholder="Ex: Pintura" value={form.setor} onChange={e => setForm(f => ({ ...f, setor: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Códigos de Erro Vinculados</Label>
            <Input
              placeholder="Ex: PIN-001, PIN-002, PIN-003 (separados por vírgula)"
              value={form.codigosErro}
              onChange={e => setForm(f => ({ ...f, codigosErro: e.target.value }))}
            />
            <p className="text-xs text-slate-400">Todos os códigos de erro que este plano abrange (separados por vírgula)</p>
          </div>
          <div className="space-y-1">
            <Label>Problema / Causa Raiz</Label>
            <Textarea placeholder="Descreva o problema raiz identificado..." value={form.problemaRaiz} onChange={e => setForm(f => ({ ...f, problemaRaiz: e.target.value }))} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Responsável</Label>
              <Input placeholder="Nome do responsável" value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
          </div>

          {/* Erros prevenidos / resolvidos */}
          <div className="space-y-1">
            <Label>Erros que este plano <span className="text-blue-600 font-semibold">previne</span></Label>
            <Input
              placeholder="Ex: PIN-001, PIN-002, PIN-003 (separados por vírgula)"
              value={form.errosPrevenidos}
              onChange={e => setForm(f => ({ ...f, errosPrevenidos: e.target.value }))}
            />
            <p className="text-xs text-slate-400">Códigos de erros que serão evitados com este plano</p>
          </div>
          <div className="space-y-1">
            <Label>Erros que este plano <span className="text-green-600 font-semibold">resolve</span></Label>
            <Input
              placeholder="Ex: PIN-004, PIN-005 (separados por vírgula)"
              value={form.errosResolvidos}
              onChange={e => setForm(f => ({ ...f, errosResolvidos: e.target.value }))}
            />
            <p className="text-xs text-slate-400">Códigos de erros que serão corrigidos com este plano</p>
          </div>

          {editingId && (
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_andamento">Em Andamento</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="monitorando">Monitorando</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={!form.titulo || createMut.isPending || updateMut.isPending}>
            {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar Plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function PlanosAcao() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formInicial, setFormInicial] = useState<PlanoForm>(FORM_INICIAL);
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [detalhePlano, setDetalhePlano] = useState<any | null>(null);

  const { data: planos = [], isLoading } = trpc.planosAcao.list.useQuery({});
  const { data: reincidencias = [] } = trpc.dashboard.reincidencia.useQuery({});
  const utils = trpc.useUtils();

  const deleteMut = trpc.planosAcao.delete.useMutation({
    onSuccess: () => { toast.success("Plano removido."); utils.planosAcao.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const abrirNovo = (codigoErro?: string) => {
    setEditingId(null);
    setFormInicial({ ...FORM_INICIAL, codigoErro: codigoErro ?? "", titulo: codigoErro ? `Plano para ${codigoErro}` : "" });
    setModalOpen(true);
  };

  const abrirEditar = (p: any) => {
    const errosPrevenidos: string[] = (() => { try { return JSON.parse(p.errosPrevenidos || "[]"); } catch { return []; } })();
    const errosResolvidos: string[] = (() => { try { return JSON.parse(p.errosResolvidos || "[]"); } catch { return []; } })();
    setEditingId(p.id);
    const codigosErroArr: string[] = (() => { try { return JSON.parse(p.codigosErro || "[]"); } catch { return []; } })();
    setFormInicial({
      codigoErro: p.codigoErro ?? "",
      codigosErro: codigosErroArr.join(", "),
      setor: p.setor ?? "",
      titulo: p.titulo ?? "",
      problemaRaiz: p.problemaRaiz ?? "",
      responsavel: p.responsavel ?? "",
      prazo: p.prazo ? new Date(p.prazo).toISOString().split("T")[0] : "",
      status: p.status ?? "pendente",
      errosPrevenidos: errosPrevenidos.join(", "),
      errosResolvidos: errosResolvidos.join(", "),
    });
    setModalOpen(true);
  };

  const filtrados = planos.filter((p: any) => filtroStatus === "todos" || p.status === filtroStatus);
  const codigosComPlano = new Set<string>(
    planos.flatMap((p: any) => {
      const extras: string[] = (() => { try { return JSON.parse(p.codigosErro || "[]"); } catch { return []; } })();
      return [p.codigoErro, ...extras].filter(Boolean);
    })
  );
  const reincidenciasSemPlano = (reincidencias as any[]).filter(r => r.codigoErro && !codigosComPlano.has(r.codigoErro) && (r.total ?? r.count ?? 0) >= 3);

  return (
      <div className="space-y-6">
        {/* Header */}
        <PageHeader
          title="Planos de Ação"
          description="Metodologia Ishikawa (6M) + 5W2H para análise e eliminação de causas de retrabalho."
          actions={
            <Button onClick={() => abrirNovo()} className="gap-2">
              <Plus size={15} /> Novo Plano
            </Button>
          }
        />

        {/* Alerta de reincidências sem plano */}
        {reincidenciasSemPlano.length > 0 && (
          <Card className="border-orange-300 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={18} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-800 text-sm">
                    {reincidenciasSemPlano.length} erro(s) reincidente(s) sem plano de ação
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {reincidenciasSemPlano.map((r: any) => (
                      <button
                        key={r.codigoErro}
                        onClick={() => abrirNovo(r.codigoErro)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-200 text-orange-800 hover:bg-orange-300 transition-colors cursor-pointer"
                      >
                        <span className="font-mono">{r.codigoErro}</span>
                        <span className="text-orange-600">({r.total ?? r.count}x)</span>
                        <Plus size={11} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtro */}
        <div className="flex gap-3">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="pendente">Pendentes</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="concluido">Concluídos</SelectItem>
              <SelectItem value="monitorando">Monitorando</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Lista de planos */}
        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : filtrados.length === 0 ? (
          <Empty className="border-2 border-slate-300">
            <EmptyHeader>
              <EmptyMedia variant="icon"><GitBranch /></EmptyMedia>
              <EmptyTitle>Nenhum plano de ação encontrado</EmptyTitle>
              <EmptyDescription>Crie um plano para erros reincidentes ou causas raiz identificadas.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="space-y-3">
            {filtrados.map((p: any) => {
              const prazoVencido = p.prazo && p.status !== "concluido" && p.status !== "monitorando" && new Date(p.prazo) < new Date();
              const errosPrevenidos: string[] = (() => { try { return JSON.parse(p.errosPrevenidos || "[]"); } catch { return []; } })();
              const errosResolvidos: string[] = (() => { try { return JSON.parse(p.errosResolvidos || "[]"); } catch { return []; } })();
              return (
                <Card key={p.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-slate-800">{p.titulo}</span>
                          {p.codigoErro && <Badge variant="outline" className="font-mono text-xs">{p.codigoErro}</Badge>}
                          {(() => { try { const arr: string[] = JSON.parse(p.codigosErro || "[]"); return arr.filter(c => c !== p.codigoErro).map(c => <Badge key={c} variant="outline" className="font-mono text-xs bg-slate-50">{c}</Badge>); } catch { return null; } })()}
                          {p.setor && <Badge variant="secondary" className="text-xs">{p.setor}</Badge>}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[p.status ?? "pendente"]}`}>
                            {STATUS_LABELS[p.status ?? "pendente"]}
                          </span>
                        </div>
                        {p.problemaRaiz && <p className="text-sm text-slate-500 mt-1 line-clamp-2">{p.problemaRaiz}</p>}

                        {/* Erros prevenidos / resolvidos */}
                        {(errosPrevenidos.length > 0 || errosResolvidos.length > 0) && (
                          <div className="flex flex-wrap gap-3 mt-2">
                            {errosPrevenidos.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Previne:</span>
                                {errosPrevenidos.map(e => <Badge key={e} className="bg-blue-100 text-blue-700 border-blue-200 text-xs">{e}</Badge>)}
                              </div>
                            )}
                            {errosResolvidos.length > 0 && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-400">Resolve:</span>
                                {errosResolvidos.map(e => <Badge key={e} className="bg-green-100 text-green-700 border-green-200 text-xs">{e}</Badge>)}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Barra de progresso das ações */}
                        <div className="mt-3">
                          <ProgressBar
                            total={p._totalAcoes ?? 0}
                            concluidas={p._acoesConc ?? 0}
                            emAndamento={p._acoesAndamento ?? 0}
                          />
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                          {p.responsavel && <span>👤 {p.responsavel}</span>}
                          {p.prazo && (
                            <span className={prazoVencido ? "text-red-600 font-semibold" : ""}>
                              📅 {new Date(p.prazo).toLocaleDateString("pt-BR")}
                              {prazoVencido && " ⚠️ Vencido"}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button size="sm" variant="outline" onClick={() => setDetalhePlano(p)} className="gap-1.5 text-xs h-8">
                          <Eye size={12} /> Ver Plano
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => abrirEditar(p)}><Edit2 size={13} /></Button>
                        <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => { if (confirm("Remover este plano?")) deleteMut.mutate({ id: p.id }); }}><Trash2 size={13} /></Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Modal criar/editar */}
        <ModalPlano
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          editingId={editingId}
          initialForm={formInicial}
          onSaved={() => utils.planosAcao.list.invalidate()}
        />

        {/* Detalhe do plano (Ishikawa + 5W2H) */}
        {detalhePlano && (
          <DetalhePlano plano={detalhePlano} onClose={() => setDetalhePlano(null)} />
        )}
      </div>
  );
}
