import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import PageHeader from "@/components/PageHeader";
import { Target, CheckCircle2, AlertTriangle, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { MESES_ABREV, fmtBrl } from "@/lib/format";
import { chartColor } from "@/lib/chartColors";

export default function Metas() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMeta, setEditingMeta] = useState<any>(null);
  const [form, setForm] = useState({
    metaMaxRetrabalhosMes: "",
    metaMaxCustoMes: "",
    metaMaxPercFaturamento: "",
    metaMaxPercEvitaveis: "",
    metaMinResolucaoDias: "",
    metaMaxReincidencias: "",
    observacoes: "",
  });

  const { data: metas = [] } = trpc.metasRetrabalho.list.useQuery();
  const { data: metaVigente } = trpc.metasRetrabalho.vigente.useQuery();
  const { data: kpis } = trpc.dashboard.kpis.useQuery({});
  const { data: evolucao = [] } = trpc.dashboard.evolucaoMensal.useQuery();
  const utils = trpc.useUtils();

  const upsertMut = trpc.metasRetrabalho.upsert.useMutation({
    onSuccess: () => {
      toast.success("Meta salva com sucesso!");
      setModalOpen(false);
      utils.metasRetrabalho.list.invalidate();
      utils.metasRetrabalho.vigente.invalidate();
    },
    onError: (e) => toast.error(e.message || "Erro ao salvar"),
  });

  const anoAtual = new Date().getFullYear();

  const abrirModal = (meta?: any) => {
    setEditingMeta(meta ?? null);
    setForm({
      metaMaxRetrabalhosMes: meta?.metaMaxRetrabalhosMes ? String(meta.metaMaxRetrabalhosMes) : "",
      metaMaxCustoMes: meta?.metaMaxCustoMes ? String(meta.metaMaxCustoMes) : "",
      metaMaxPercFaturamento: meta?.metaMaxPercFaturamento ? String(meta.metaMaxPercFaturamento) : "",
      metaMaxPercEvitaveis: meta?.metaMaxPercEvitaveis ? String(meta.metaMaxPercEvitaveis) : "",
      metaMinResolucaoDias: meta?.metaMinResolucaoDias ? String(meta.metaMinResolucaoDias) : "",
      metaMaxReincidencias: meta?.metaMaxReincidencias ? String(meta.metaMaxReincidencias) : "",
      observacoes: meta?.observacoes ?? "",
    });
    setModalOpen(true);
  };

  const salvar = () => {
    upsertMut.mutate({
      ano: editingMeta?.ano ?? anoAtual,
      metaMaxRetrabalhosMes: form.metaMaxRetrabalhosMes ? Number(form.metaMaxRetrabalhosMes) : undefined,
      metaMaxCustoMes: form.metaMaxCustoMes ? Number(form.metaMaxCustoMes) : undefined,
      metaMaxPercFaturamento: form.metaMaxPercFaturamento ? Number(form.metaMaxPercFaturamento) : undefined,
      metaMaxPercEvitaveis: form.metaMaxPercEvitaveis ? Number(form.metaMaxPercEvitaveis) : undefined,
      metaMinResolucaoDias: form.metaMinResolucaoDias ? Number(form.metaMinResolucaoDias) : undefined,
      metaMaxReincidencias: form.metaMaxReincidencias ? Number(form.metaMaxReincidencias) : undefined,
      observacoes: form.observacoes || undefined,
    });
  };

  // Dados para gráfico
  const chartData = (evolucao as any[]).map((e, i) => ({
    mes: MESES_ABREV[i] ?? String(i + 1),
    retrabalhos: e.total ?? 0,
    custo: Number(e.custoTotal ?? 0),
  }));

  const pctFaturamento = 0; // calculado externamente
  const totalRetrabalhos = kpis?.total ?? 0;
  const custoTotal = Number(kpis?.custoTotal ?? 0);

  // Verificar se está dentro das metas
  const checkMeta = (atual: number, meta: number | null | undefined, tipo: "max" | "min") => {
    if (meta === null || meta === undefined) return null;
    return tipo === "max" ? atual <= meta : atual >= meta;
  };

  const indicadores = metaVigente ? [
    {
      label: "Retrabalhos / Mês",
      meta: metaVigente.metaMaxRetrabalhosMes ? `≤ ${metaVigente.metaMaxRetrabalhosMes}` : null,
      atual: String(totalRetrabalhos),
      ok: checkMeta(totalRetrabalhos, metaVigente.metaMaxRetrabalhosMes, "max"),
    },
    {
      label: "% sobre Faturamento",
      meta: metaVigente.metaMaxPercFaturamento ? `≤ ${metaVigente.metaMaxPercFaturamento}%` : null,
      atual: `${pctFaturamento.toFixed(2)}%`,
      ok: checkMeta(pctFaturamento, Number(metaVigente.metaMaxPercFaturamento ?? null), "max"),
    },
    {
      label: "Custo Máximo / Mês",
      meta: metaVigente.metaMaxCustoMes ? fmtBrl(Number(metaVigente.metaMaxCustoMes)) : null,
      atual: fmtBrl(custoTotal),
      ok: checkMeta(custoTotal, Number(metaVigente.metaMaxCustoMes ?? null), "max"),
    },
    {
      label: "Máx. Reincidências / Erro",
      meta: metaVigente.metaMaxReincidencias ? `≤ ${metaVigente.metaMaxReincidencias}x` : null,
      atual: "—",
      ok: null,
    },
  ] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Metas e Benchmarks"
        description="Defina metas anuais e acompanhe o desempenho em relação a elas."
        actions={
          <Button onClick={() => abrirModal(metaVigente ?? undefined)} className="gap-2">
            <Target size={15} />
            {metaVigente ? `Editar Meta ${anoAtual}` : `Definir Meta ${anoAtual}`}
          </Button>
        }
      />

      {/* Indicadores vs Meta */}
      {metaVigente ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {indicadores.map(item => (
            <Card key={item.label} className={`border-2 ${item.ok === true ? "border-green-300 bg-green-50" : item.ok === false ? "border-red-300 bg-red-50" : "border-slate-200"}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide leading-tight">{item.label}</div>
                  {item.ok === true && <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />}
                  {item.ok === false && <AlertTriangle size={16} className="text-red-600 flex-shrink-0" />}
                </div>
                {item.meta ? (
                  <div className="flex items-end gap-3">
                    <div>
                      <div className="text-[10px] text-slate-400">Meta</div>
                      <div className="text-base font-bold text-slate-700">{item.meta}</div>
                    </div>
                    <div className="text-slate-300">→</div>
                    <div>
                      <div className="text-[10px] text-slate-400">Atual</div>
                      <div className={`text-base font-bold ${item.ok === true ? "text-green-700" : item.ok === false ? "text-red-700" : "text-slate-700"}`}>{item.atual}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-400 italic">Meta não definida</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Empty className="border-2 border-slate-300">
          <EmptyHeader>
            <EmptyMedia variant="icon"><Target /></EmptyMedia>
            <EmptyTitle>Nenhuma meta definida para {anoAtual}</EmptyTitle>
            <EmptyDescription>Clique em "Definir Meta" para estabelecer os benchmarks do ano.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}

      {/* Gráfico de evolução mensal */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolução Mensal de Retrabalhos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="retrabalhos" name="Retrabalhos" fill={chartColor(0)} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Histórico de metas */}
      {metas.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Histórico de Metas por Ano</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Ano</TableHead>
                  <TableHead>Máx. Retrabalhos/Mês</TableHead>
                  <TableHead>Máx. % Faturamento</TableHead>
                  <TableHead>Máx. Custo/Mês</TableHead>
                  <TableHead>Máx. Reincidências</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(metas as any[]).map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="font-bold text-slate-800">{m.ano}{m.mes ? `/${String(m.mes).padStart(2, "0")}` : ""}</TableCell>
                    <TableCell className="text-slate-600">{m.metaMaxRetrabalhosMes ?? "—"}</TableCell>
                    <TableCell className="text-slate-600">{m.metaMaxPercFaturamento ? `≤ ${m.metaMaxPercFaturamento}%` : "—"}</TableCell>
                    <TableCell className="text-slate-600">{m.metaMaxCustoMes ? fmtBrl(Number(m.metaMaxCustoMes)) : "—"}</TableCell>
                    <TableCell className="text-slate-600">{m.metaMaxReincidencias ?? "—"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => abrirModal(m)} className="gap-1">
                        <Edit2 size={13} /> Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingMeta ? `Editar Meta ${editingMeta.ano}` : `Definir Meta ${anoAtual}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Máx. Retrabalhos / Mês</Label>
                <Input type="number" placeholder="Ex: 10" value={form.metaMaxRetrabalhosMes} onChange={e => setForm(f => ({ ...f, metaMaxRetrabalhosMes: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Máx. % sobre Faturamento</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="0.01" placeholder="Ex: 2.5" value={form.metaMaxPercFaturamento} onChange={e => setForm(f => ({ ...f, metaMaxPercFaturamento: e.target.value }))} />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Custo Máximo / Mês (R$)</Label>
                <Input type="number" step="0.01" placeholder="Ex: 5000" value={form.metaMaxCustoMes} onChange={e => setForm(f => ({ ...f, metaMaxCustoMes: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Máx. % Evitáveis</Label>
                <div className="flex items-center gap-1">
                  <Input type="number" step="1" placeholder="Ex: 80" value={form.metaMaxPercEvitaveis} onChange={e => setForm(f => ({ ...f, metaMaxPercEvitaveis: e.target.value }))} />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Prazo Máx. Resolução (dias)</Label>
                <Input type="number" placeholder="Ex: 7" value={form.metaMinResolucaoDias} onChange={e => setForm(f => ({ ...f, metaMinResolucaoDias: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Máx. Reincidências / Erro</Label>
                <Input type="number" placeholder="Ex: 3" value={form.metaMaxReincidencias} onChange={e => setForm(f => ({ ...f, metaMaxReincidencias: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Contexto ou justificativa das metas..." value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={upsertMut.isPending}>
              {upsertMut.isPending ? "Salvando..." : "Salvar Meta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
