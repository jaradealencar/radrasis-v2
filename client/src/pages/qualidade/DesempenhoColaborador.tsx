import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyContent } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import {
  Users, Hammer, ShoppingBag, Settings2, Plus, Edit3, Trash2,
  TrendingUp, TrendingDown, ChevronDown, ChevronUp, BarChart2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import ChartTooltip from "@/components/ChartTooltip";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

type Categoria = "soldador" | "vendedor" | "operador_maquinas";

const CATEGORIAS: { key: Categoria; label: string; icon: React.ReactNode; cor: string }[] = [
  { key: "soldador", label: "Soldadores", icon: <Hammer size={15} />, cor: "text-orange-600" },
  { key: "vendedor", label: "Vendedores", icon: <ShoppingBag size={15} />, cor: "text-blue-600" },
  { key: "operador_maquinas", label: "Op. de Máquinas", icon: <Settings2 size={15} />, cor: "text-purple-600" },
];

function fmtBRL(v: string | number | null | undefined): string {
  if (v == null || v === "") return "—";
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtNum(v: number | null | undefined, decimais = 0): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimais, maximumFractionDigits: decimais });
}

function Seta({ atual, anterior }: { atual: number | null; anterior: number | null }) {
  if (atual == null || anterior == null || anterior === 0) return null;
  const diff = ((atual - anterior) / Math.abs(anterior)) * 100;
  const up = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ml-1 ${up ? "text-emerald-600" : "text-red-500"}`}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
      {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

interface FormState {
  nome: string;
  categoria: Categoria;
  mes: number;
  ano: number;
  numFaltas: string;
  metrosSoldados: string;
  numRetrabalhos: string;
  numPropostas: string;
  numVendas: string;
  faturamentoVendedor: string;
  ticketMedioVendedor: string;
  numTrabalhos: string;
  notas: string;
}

function emptyForm(categoria: Categoria, ano: number): FormState {
  return {
    nome: "", categoria, mes: new Date().getMonth() + 1, ano,
    numFaltas: "", metrosSoldados: "", numRetrabalhos: "",
    numPropostas: "", numVendas: "", faturamentoVendedor: "", ticketMedioVendedor: "",
    numTrabalhos: "", notas: "",
  };
}

const tooltipFmt = (v: number) => (v > 1000 ? fmtBRL(v) : fmtNum(v, v % 1 !== 0 ? 1 : 0));

export default function DesempenhoColaborador() {
  const anoAtual = new Date().getFullYear();
  const [anoSel, setAnoSel] = useState(anoAtual);
  const [categoriaSel, setCategoriaSel] = useState<Categoria>("soldador");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<FormState>(emptyForm("soldador", anoAtual));
  const [isEditing, setIsEditing] = useState(false);
  const [expandedColab, setExpandedColab] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const { data: registros = [] } = trpc.desempenhoColabMensal.list.useQuery({
    ano: anoSel,
    categoria: categoriaSel,
  });

  const upsert = trpc.desempenhoColabMensal.upsert.useMutation({
    onSuccess: () => {
      toast.success("Dados salvos com sucesso!");
      setModalOpen(false);
      utils.desempenhoColabMensal.list.invalidate({ ano: anoSel, categoria: categoriaSel });
    },
    onError: (e) => toast.error("Erro ao salvar: " + e.message),
  });

  const deleteColab = trpc.desempenhoColabMensal.deleteColaborador.useMutation({
    onSuccess: () => { toast.success("Colaborador removido."); utils.desempenhoColabMensal.list.invalidate({ ano: anoSel, categoria: categoriaSel }); },
    onError: (e) => toast.error("Erro: " + e.message),
  });

  const colaboradores = useMemo(() => {
    const map: Record<string, typeof registros> = {};
    for (const r of registros) {
      if (!map[r.nome]) map[r.nome] = [];
      map[r.nome].push(r);
    }
    return Object.entries(map).map(([nome, meses]) => ({
      nome,
      meses: meses.sort((a, b) => a.mes - b.mes),
    }));
  }, [registros]);

  function abrirNovo() {
    setEditingForm(emptyForm(categoriaSel, anoSel));
    setIsEditing(false);
    setModalOpen(true);
  }

  function abrirEditar(r: typeof registros[0]) {
    setEditingForm({
      nome: r.nome,
      categoria: r.categoria as Categoria,
      mes: r.mes,
      ano: r.ano,
      numFaltas: r.numFaltas != null ? String(r.numFaltas) : "",
      metrosSoldados: r.metrosSoldados ?? "",
      numRetrabalhos: r.numRetrabalhos != null ? String(r.numRetrabalhos) : "",
      numPropostas: r.numPropostas != null ? String(r.numPropostas) : "",
      numVendas: r.numVendas != null ? String(r.numVendas) : "",
      faturamentoVendedor: r.faturamentoVendedor ?? "",
      ticketMedioVendedor: r.ticketMedioVendedor ?? "",
      numTrabalhos: r.numTrabalhos != null ? String(r.numTrabalhos) : "",
      notas: r.notas ?? "",
    });
    setIsEditing(true);
    setModalOpen(true);
  }

  function handleSave() {
    const f = editingForm;
    if (!f.nome.trim()) { toast.error("Informe o nome do colaborador."); return; }
    upsert.mutate({
      nome: f.nome.trim(),
      categoria: f.categoria,
      mes: f.mes,
      ano: f.ano,
      numFaltas: f.numFaltas ? parseInt(f.numFaltas) : 0,
      metrosSoldados: f.metrosSoldados ? parseFloat(f.metrosSoldados.replace(",", ".")) : null,
      numRetrabalhos: f.numRetrabalhos ? parseInt(f.numRetrabalhos) : 0,
      numPropostas: f.numPropostas ? parseInt(f.numPropostas) : 0,
      numVendas: f.numVendas ? parseInt(f.numVendas) : 0,
      faturamentoVendedor: f.faturamentoVendedor
        ? parseFloat(f.faturamentoVendedor.replace(/\./g, "").replace(",", "."))
        : null,
      ticketMedioVendedor: f.ticketMedioVendedor
        ? parseFloat(f.ticketMedioVendedor.replace(/\./g, "").replace(",", "."))
        : null,
      numTrabalhos: f.numTrabalhos ? parseInt(f.numTrabalhos) : 0,
      notas: f.notas || null,
    });
  }

  function getChartData(meses: typeof registros) {
    return MESES_ABREV.map((abrev, idx) => {
      const m = meses.find(r => r.mes === idx + 1);
      if (!m) return null;
      const base: Record<string, any> = { name: abrev };
      if (categoriaSel === "soldador") {
        base["Metros Soldados"] = m.metrosSoldados ? parseFloat(m.metrosSoldados) : 0;
        base["Retrabalhos"] = m.numRetrabalhos ?? 0;
        base["Faltas"] = m.numFaltas ?? 0;
      } else if (categoriaSel === "vendedor") {
        base["Propostas"] = m.numPropostas ?? 0;
        base["Vendas"] = m.numVendas ?? 0;
        base["Faturamento"] = m.faturamentoVendedor ? parseFloat(m.faturamentoVendedor) : 0;
        base["Faltas"] = m.numFaltas ?? 0;
      } else {
        base["Trabalhos"] = m.numTrabalhos ?? 0;
        base["Faltas"] = m.numFaltas ?? 0;
      }
      return base;
    }).filter(Boolean) as Record<string, any>[];
  }

  const catInfo = CATEGORIAS.find(c => c.key === categoriaSel)!;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <PageHeader
        title="Desempenho por Colaborador"
        description="Métricas mensais por categoria — comparativo mês a mês"
        icon={Users}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setAnoSel(a => a - 1)}>
              ← {anoSel - 1}
            </Button>
            <span className="font-semibold text-lg px-2">{anoSel}</span>
            <Button variant="outline" size="sm" onClick={() => setAnoSel(a => a + 1)}>
              {anoSel + 1} →
            </Button>
            <Button size="sm" onClick={abrirNovo} className="gap-1.5 bg-blue-600 hover:bg-blue-700">
              <Plus size={14} /> Lançar Dados
            </Button>
          </>
        }
      />

      {/* Abas de categoria */}
      <Tabs value={categoriaSel} onValueChange={(v) => setCategoriaSel(v as Categoria)}>
        <TabsList className="grid grid-cols-3 w-full max-w-lg">
          {CATEGORIAS.map(c => (
            <TabsTrigger key={c.key} value={c.key} className="flex items-center gap-1.5">
              {c.icon} {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIAS.map(cat => (
          <TabsContent key={cat.key} value={cat.key} className="mt-4 space-y-4">
            {colaboradores.length === 0 ? (
              <Card>
                <CardContent>
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><Users /></EmptyMedia>
                      <EmptyTitle>Nenhum dado lançado para {cat.label} em {anoSel}.</EmptyTitle>
                    </EmptyHeader>
                    <EmptyContent>
                      <Button size="sm" onClick={abrirNovo} className="gap-1">
                        <Plus size={13} /> Lançar primeiro registro
                      </Button>
                    </EmptyContent>
                  </Empty>
                </CardContent>
              </Card>
            ) : (
              colaboradores.map(({ nome, meses }) => {
                const isExpanded = expandedColab === nome;
                const chartData = getChartData(meses);
                const sorted = [...meses].sort((a, b) => b.mes - a.mes);
                const ultimo = sorted[0];
                const penultimo = sorted[1] ?? null;

                return (
                  <Card key={nome} className="overflow-hidden">
                    <CardHeader className="pb-0 pt-4 px-5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-md bg-muted ${cat.cor}`}>{cat.icon}</div>
                          <div>
                            <CardTitle className="text-base">{nome}</CardTitle>
                            <p className="text-xs text-muted-foreground">
                              {meses.length} meses lançados em {anoSel}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setExpandedColab(isExpanded ? null : nome)}
                            className="h-7 w-7 p-0"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => {
                              if (confirm(`Remover todos os dados de ${nome} em ${anoSel}?`)) {
                                deleteColab.mutate({ nome, categoria: cat.key });
                              }
                            }}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>

                    {/* Resumo do último mês */}
                    <CardContent className="pt-3 pb-4 px-5">
                      {ultimo && (
                        <div className="flex flex-wrap gap-4 text-sm">
                          {cat.key === "soldador" && (
                            <>
                              <span className="text-muted-foreground">
                                Metros soldados ({MESES_ABREV[ultimo.mes - 1]}):
                                <span className="font-semibold text-orange-600 ml-1">
                                  {fmtNum(ultimo.metrosSoldados ? parseFloat(ultimo.metrosSoldados) : null, 1)}m
                                </span>
                                <Seta
                                  atual={ultimo.metrosSoldados ? parseFloat(ultimo.metrosSoldados) : null}
                                  anterior={penultimo?.metrosSoldados ? parseFloat(penultimo.metrosSoldados) : null}
                                />
                              </span>
                              <span className="text-muted-foreground">
                                Retrabalhos:
                                <span className="font-semibold text-red-500 ml-1">{ultimo.numRetrabalhos ?? 0}</span>
                                <Seta atual={ultimo.numRetrabalhos} anterior={penultimo?.numRetrabalhos ?? null} />
                              </span>
                              <span className="text-muted-foreground">
                                Faltas: <span className="font-semibold ml-1">{ultimo.numFaltas ?? 0}</span>
                              </span>
                            </>
                          )}
                          {cat.key === "vendedor" && (
                            <>
                              <span className="text-muted-foreground">
                                Propostas ({MESES_ABREV[ultimo.mes - 1]}):
                                <span className="font-semibold text-blue-600 ml-1">{ultimo.numPropostas ?? 0}</span>
                                <Seta atual={ultimo.numPropostas} anterior={penultimo?.numPropostas ?? null} />
                              </span>
                              <span className="text-muted-foreground">
                                Vendas:
                                <span className="font-semibold text-emerald-600 ml-1">{ultimo.numVendas ?? 0}</span>
                                <Seta atual={ultimo.numVendas} anterior={penultimo?.numVendas ?? null} />
                              </span>
                              <span className="text-muted-foreground">
                                Faturamento:
                                <span className="font-semibold text-emerald-600 ml-1">
                                  {fmtBRL(ultimo.faturamentoVendedor)}
                                </span>
                                <Seta
                                  atual={ultimo.faturamentoVendedor ? parseFloat(ultimo.faturamentoVendedor) : null}
                                  anterior={penultimo?.faturamentoVendedor ? parseFloat(penultimo.faturamentoVendedor) : null}
                                />
                              </span>
                              <span className="text-muted-foreground">
                                Ticket médio:
                                <span className="font-semibold ml-1">{fmtBRL(ultimo.ticketMedioVendedor)}</span>
                              </span>
                              <span className="text-muted-foreground">
                                Faltas: <span className="font-semibold ml-1">{ultimo.numFaltas ?? 0}</span>
                              </span>
                            </>
                          )}
                          {cat.key === "operador_maquinas" && (
                            <>
                              <span className="text-muted-foreground">
                                Trabalhos ({MESES_ABREV[ultimo.mes - 1]}):
                                <span className="font-semibold text-purple-600 ml-1">{ultimo.numTrabalhos ?? 0}</span>
                                <Seta atual={ultimo.numTrabalhos} anterior={penultimo?.numTrabalhos ?? null} />
                              </span>
                              <span className="text-muted-foreground">
                                Faltas: <span className="font-semibold ml-1">{ultimo.numFaltas ?? 0}</span>
                              </span>
                            </>
                          )}
                        </div>
                      )}
                    </CardContent>

                    {/* Detalhes expandidos */}
                    {isExpanded && (
                      <div className="border-t px-5 pb-5 pt-4 space-y-5 bg-muted/20">
                        {/* Gráfico comparativo */}
                        {chartData.length > 0 && (
                          <div>
                            <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
                              <BarChart2 size={14} className="text-blue-500" /> Evolução Mensal
                            </div>
                            <ResponsiveContainer width="100%" height={200}>
                              <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                <YAxis tick={{ fontSize: 10 }} width={40} />
                                <Tooltip content={<ChartTooltip format={tooltipFmt} />} />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                                {cat.key === "soldador" && (
                                  <>
                                    <Bar dataKey="Metros Soldados" fill="#f97316" radius={[3, 3, 0, 0]} />
                                    <Line dataKey="Retrabalhos" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
                                    <Line dataKey="Faltas" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2 }} type="monotone" strokeDasharray="4 2" />
                                  </>
                                )}
                                {cat.key === "vendedor" && (
                                  <>
                                    <Bar dataKey="Propostas" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                                    <Bar dataKey="Vendas" fill="#10b981" radius={[3, 3, 0, 0]} />
                                    <Line dataKey="Faltas" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2 }} type="monotone" strokeDasharray="4 2" />
                                  </>
                                )}
                                {cat.key === "operador_maquinas" && (
                                  <>
                                    <Bar dataKey="Trabalhos" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                                    <Line dataKey="Faltas" stroke="#94a3b8" strokeWidth={1.5} dot={{ r: 2 }} type="monotone" strokeDasharray="4 2" />
                                  </>
                                )}
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>
                        )}

                        {/* Tabela mensal */}
                        <div>
                          <div className="text-sm font-medium mb-2">Histórico Mensal</div>
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Mês</TableHead>
                                {cat.key === "soldador" && (
                                  <>
                                    <TableHead className="text-right">Metros Soldados</TableHead>
                                    <TableHead className="text-right">Retrabalhos</TableHead>
                                    <TableHead className="text-right">Faltas</TableHead>
                                  </>
                                )}
                                {cat.key === "vendedor" && (
                                  <>
                                    <TableHead className="text-right">Propostas</TableHead>
                                    <TableHead className="text-right">Vendas</TableHead>
                                    <TableHead className="text-right">Faturamento</TableHead>
                                    <TableHead className="text-right">Ticket Médio</TableHead>
                                    <TableHead className="text-right">Faltas</TableHead>
                                  </>
                                )}
                                {cat.key === "operador_maquinas" && (
                                  <>
                                    <TableHead className="text-right">Trabalhos</TableHead>
                                    <TableHead className="text-right">Faltas</TableHead>
                                  </>
                                )}
                                <TableHead className="text-center">Ações</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {meses.map((m, i) => {
                                const prev = meses[i - 1] ?? null;
                                return (
                                  <TableRow key={m.mes}>
                                    <TableCell className="font-medium">{MESES[m.mes - 1]}</TableCell>
                                    {cat.key === "soldador" && (
                                      <>
                                        <TableCell className="text-right text-orange-600 font-semibold">
                                          {fmtNum(m.metrosSoldados ? parseFloat(m.metrosSoldados) : null, 1)}m
                                          <Seta
                                            atual={m.metrosSoldados ? parseFloat(m.metrosSoldados) : null}
                                            anterior={prev?.metrosSoldados ? parseFloat(prev.metrosSoldados) : null}
                                          />
                                        </TableCell>
                                        <TableCell className="text-right text-red-500 font-semibold">
                                          {m.numRetrabalhos ?? 0}
                                          <Seta atual={m.numRetrabalhos} anterior={prev?.numRetrabalhos ?? null} />
                                        </TableCell>
                                        <TableCell className="text-right">{m.numFaltas ?? 0}</TableCell>
                                      </>
                                    )}
                                    {cat.key === "vendedor" && (
                                      <>
                                        <TableCell className="text-right text-blue-600 font-semibold">
                                          {m.numPropostas ?? 0}
                                          <Seta atual={m.numPropostas} anterior={prev?.numPropostas ?? null} />
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600 font-semibold">
                                          {m.numVendas ?? 0}
                                          <Seta atual={m.numVendas} anterior={prev?.numVendas ?? null} />
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600 font-semibold">
                                          {fmtBRL(m.faturamentoVendedor)}
                                          <Seta
                                            atual={m.faturamentoVendedor ? parseFloat(m.faturamentoVendedor) : null}
                                            anterior={prev?.faturamentoVendedor ? parseFloat(prev.faturamentoVendedor) : null}
                                          />
                                        </TableCell>
                                        <TableCell className="text-right">{fmtBRL(m.ticketMedioVendedor)}</TableCell>
                                        <TableCell className="text-right">{m.numFaltas ?? 0}</TableCell>
                                      </>
                                    )}
                                    {cat.key === "operador_maquinas" && (
                                      <>
                                        <TableCell className="text-right text-purple-600 font-semibold">
                                          {m.numTrabalhos ?? 0}
                                          <Seta atual={m.numTrabalhos} anterior={prev?.numTrabalhos ?? null} />
                                        </TableCell>
                                        <TableCell className="text-right">{m.numFaltas ?? 0}</TableCell>
                                      </>
                                    )}
                                    <TableCell className="text-center">
                                      <Button
                                        variant="ghost" size="sm"
                                        onClick={() => abrirEditar(m)}
                                        className="h-6 w-6 p-0"
                                      >
                                        <Edit3 size={12} />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Modal de lançamento / edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Dados" : "Lançar Dados"} — {catInfo.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium">Nome do Colaborador *</Label>
                <Input
                  className="h-8 text-sm mt-1"
                  placeholder="Ex: João Silva"
                  value={editingForm.nome}
                  onChange={e => setEditingForm(f => ({ ...f, nome: e.target.value }))}
                  disabled={isEditing}
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Mês *</Label>
                <select
                  className="w-full h-8 text-sm mt-1 border rounded-md px-2 bg-background"
                  value={editingForm.mes}
                  onChange={e => setEditingForm(f => ({ ...f, mes: parseInt(e.target.value) }))}
                >
                  {MESES.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <Label className="text-xs font-medium">Categoria *</Label>
              <select
                className="w-full h-8 text-sm mt-1 border rounded-md px-2 bg-background"
                value={editingForm.categoria}
                onChange={e => setEditingForm(f => ({ ...f, categoria: e.target.value as Categoria }))}
                disabled={isEditing}
              >
                {CATEGORIAS.map(c => (
                  <option key={c.key} value={c.key}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-medium">Nº de Faltas (Abstinência)</Label>
              <Input
                className="h-8 text-sm mt-1"
                type="number" min="0"
                placeholder="0"
                value={editingForm.numFaltas}
                onChange={e => setEditingForm(f => ({ ...f, numFaltas: e.target.value }))}
              />
            </div>

            {editingForm.categoria === "soldador" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Metros Soldados</Label>
                  <Input
                    className="h-8 text-sm mt-1"
                    placeholder="Ex: 45.5"
                    value={editingForm.metrosSoldados}
                    onChange={e => setEditingForm(f => ({ ...f, metrosSoldados: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Total de metros no mês</p>
                </div>
                <div>
                  <Label className="text-xs font-medium">Nº de Retrabalhos</Label>
                  <Input
                    className="h-8 text-sm mt-1"
                    type="number" min="0"
                    placeholder="0"
                    value={editingForm.numRetrabalhos}
                    onChange={e => setEditingForm(f => ({ ...f, numRetrabalhos: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {editingForm.categoria === "vendedor" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Nº de Propostas</Label>
                  <Input
                    className="h-8 text-sm mt-1" type="number" min="0" placeholder="0"
                    value={editingForm.numPropostas}
                    onChange={e => setEditingForm(f => ({ ...f, numPropostas: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Nº de Vendas</Label>
                  <Input
                    className="h-8 text-sm mt-1" type="number" min="0" placeholder="0"
                    value={editingForm.numVendas}
                    onChange={e => setEditingForm(f => ({ ...f, numVendas: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Faturamento (R$)</Label>
                  <Input
                    className="h-8 text-sm mt-1" placeholder="Ex: 85000.00"
                    value={editingForm.faturamentoVendedor}
                    onChange={e => setEditingForm(f => ({ ...f, faturamentoVendedor: e.target.value }))}
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">Ticket médio calculado automaticamente</p>
                </div>
                <div>
                  <Label className="text-xs font-medium">
                    Ticket Médio (R$){" "}
                    <span className="text-muted-foreground font-normal">(opcional)</span>
                  </Label>
                  <Input
                    className="h-8 text-sm mt-1" placeholder="Calculado automaticamente"
                    value={editingForm.ticketMedioVendedor}
                    onChange={e => setEditingForm(f => ({ ...f, ticketMedioVendedor: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {editingForm.categoria === "operador_maquinas" && (
              <div>
                <Label className="text-xs font-medium">Nº de Trabalhos Realizados</Label>
                <Input
                  className="h-8 text-sm mt-1" type="number" min="0" placeholder="0"
                  value={editingForm.numTrabalhos}
                  onChange={e => setEditingForm(f => ({ ...f, numTrabalhos: e.target.value }))}
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-medium">Observações</Label>
              <Textarea
                className="text-sm mt-1 resize-none" rows={2}
                placeholder="Notas sobre o período..."
                value={editingForm.notas}
                onChange={e => setEditingForm(f => ({ ...f, notas: e.target.value }))}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={upsert.isPending || !editingForm.nome.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {upsert.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
