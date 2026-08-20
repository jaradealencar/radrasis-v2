import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Activity, Plus, Pencil, Trash2 } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
} from "recharts";
import { toast } from "sonner";

const UNIDADES = ["%", "un", "R$", "kg", "h", "dias"];

const EMPTY_FORM = {
  id: undefined as number | undefined,
  nome: "",
  valor: "",
  unidade: "%",
  dataApuracao: new Date().toISOString().slice(0, 10),
  observacao: "",
};

function fmtValor(v: string | number, unidade: string): string {
  const n = Number(v);
  if (isNaN(n)) return "—";
  if (unidade === "R$") return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}${unidade === "%" ? "%" : " " + unidade}`;
}

function fmtData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export default function Metricas() {
  const [filtroNome, setFiltroNome] = useState<string>("Todos");
  const [modalAberto, setModalAberto] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const utils = trpc.useUtils();
  const { data: registros = [], isLoading } = trpc.metricas.list.useQuery({
    nome: filtroNome !== "Todos" ? filtroNome : undefined,
  });
  const { data: nomesExistentes = [] } = trpc.metricas.nomesDistintos.useQuery();

  const upsertMut = trpc.metricas.create.useMutation({
    onSuccess: () => {
      toast.success("Indicador registrado!");
      setModalAberto(false);
      utils.metricas.list.invalidate();
      utils.metricas.nomesDistintos.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const updateMut = trpc.metricas.update.useMutation({
    onSuccess: () => {
      toast.success("Indicador atualizado!");
      setModalAberto(false);
      utils.metricas.list.invalidate();
      utils.metricas.nomesDistintos.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const deleteMut = trpc.metricas.delete.useMutation({
    onSuccess: () => {
      toast.success("Registro removido!");
      utils.metricas.list.invalidate();
    },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  function abrirNovo() {
    setForm({ ...EMPTY_FORM, nome: filtroNome !== "Todos" ? filtroNome : "" });
    setModalAberto(true);
  }

  function abrirEditar(r: (typeof registros)[number]) {
    setForm({
      id: r.id,
      nome: r.nome,
      valor: String(r.valor),
      unidade: r.unidade ?? "%",
      dataApuracao: r.dataApuracao,
      observacao: r.observacao ?? "",
    });
    setModalAberto(true);
  }

  function handleSave() {
    const valorNum = parseFloat(String(form.valor).replace(",", "."));
    if (!form.nome.trim()) return toast.error("Informe o nome do indicador.");
    if (isNaN(valorNum)) return toast.error("Valor inválido.");
    if (!form.dataApuracao) return toast.error("Informe a data de apuração.");

    const payload = {
      nome: form.nome.trim(),
      valor: valorNum,
      unidade: form.unidade,
      dataApuracao: form.dataApuracao,
      observacao: form.observacao || null,
    };
    if (form.id) {
      updateMut.mutate({ id: form.id, ...payload });
    } else {
      upsertMut.mutate(payload);
    }
  }

  function handleDelete(id: number, nome: string) {
    if (!window.confirm(`Remover o registro "${nome}"?`)) return;
    deleteMut.mutate({ id });
  }

  // Série pra gráfico: só faz sentido quando um indicador específico está selecionado
  const serie = useMemo(() => {
    if (filtroNome === "Todos") return [];
    return [...registros]
      .sort((a, b) => a.dataApuracao.localeCompare(b.dataApuracao))
      .map((r) => ({ data: fmtData(r.dataApuracao), valor: Number(r.valor) }));
  }, [registros, filtroNome]);

  const unidadeAtual = registros[0]?.unidade ?? "%";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Activity size={20} className="text-violet-600" />
            Métricas
          </h1>
          <p className="text-sm text-muted-foreground">
            Registre indicadores apurados manualmente, com data, e acompanhe a evolução ao longo do tempo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
            className="h-9 text-sm border rounded px-2 bg-white min-w-[220px]"
          >
            <option value="Todos">Todos os indicadores</option>
            {nomesExistentes.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={abrirNovo}>
            <Plus size={14} /> Novo Registro
          </Button>
        </div>
      </div>

      {filtroNome !== "Todos" && serie.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity size={16} className="text-violet-600" />
              Evolução — {filtroNome}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={serie} margin={{ left: 0, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={50} />
                <RTooltip formatter={(v: number) => [fmtValor(v, unidadeAtual), filtroNome]} />
                <Line type="monotone" dataKey="valor" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de Registros</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs uppercase tracking-wide">Data</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Indicador</TableHead>
                <TableHead className="text-right text-xs uppercase tracking-wide">Valor</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Observação</TableHead>
                <TableHead className="text-xs uppercase tracking-wide">Registrado por</TableHead>
                <TableHead className="text-center text-xs uppercase tracking-wide">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando…</TableCell>
                </TableRow>
              )}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum registro ainda. Clique em "Novo Registro" para começar.
                  </TableCell>
                </TableRow>
              )}
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-sm">{fmtData(r.dataApuracao)}</TableCell>
                  <TableCell className="font-medium text-sm">{r.nome}</TableCell>
                  <TableCell className="text-right font-semibold text-sm">
                    {fmtValor(r.valor, r.unidade ?? "%")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                    {r.observacao || "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.criadoPorNome || "—"}</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => abrirEditar(r)}
                        className="p-1 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(r.id, r.nome)}
                        className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                        title="Remover"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={modalAberto} onOpenChange={setModalAberto}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {form.id ? <Pencil size={16} className="text-blue-600" /> : <Plus size={16} className="text-violet-600" />}
              {form.id ? "Editar Registro" : "Novo Registro de Indicador"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="mt-nome">Nome do indicador <span className="text-red-500">*</span></Label>
              <Input
                id="mt-nome"
                list="mt-nomes-existentes"
                placeholder="Ex: % pedidos com pintura"
                value={form.nome}
                onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              />
              <datalist id="mt-nomes-existentes">
                {nomesExistentes.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mt-valor">Valor <span className="text-red-500">*</span></Label>
              <Input
                id="mt-valor"
                placeholder="Ex: 14,0"
                value={form.valor}
                onChange={(e) => setForm((f) => ({ ...f, valor: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="mt-unidade">Unidade</Label>
              <select
                id="mt-unidade"
                value={form.unidade}
                onChange={(e) => setForm((f) => ({ ...f, unidade: e.target.value }))}
                className="w-full h-9 text-sm border rounded px-2 bg-white"
              >
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="mt-data">Data de apuração <span className="text-red-500">*</span></Label>
              <Input
                id="mt-data"
                type="date"
                value={form.dataApuracao}
                onChange={(e) => setForm((f) => ({ ...f, dataApuracao: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="mt-obs">Observação</Label>
              <Input
                id="mt-obs"
                placeholder="Contexto, fonte do dado, etc."
                value={form.observacao}
                onChange={(e) => setForm((f) => ({ ...f, observacao: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={upsertMut.isPending || updateMut.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
            >
              {(upsertMut.isPending || updateMut.isPending) ? "Salvando..." : form.id ? "Salvar Alterações" : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
