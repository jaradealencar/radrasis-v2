import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, DollarSign, Wrench, Users, BarChart3,
  Save, Info, AlertTriangle, CheckCircle2, Zap, Plus, Pencil, Trash2,
  Package, ChevronUp, ChevronDown, ArrowRight, Shuffle
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MESES = [
  { num: 1, label: "Janeiro" }, { num: 2, label: "Fevereiro" }, { num: 3, label: "Março" },
  { num: 4, label: "Abril" }, { num: 5, label: "Maio" }, { num: 6, label: "Junho" },
  { num: 7, label: "Julho" }, { num: 8, label: "Agosto" }, { num: 9, label: "Setembro" },
  { num: 10, label: "Outubro" }, { num: 11, label: "Novembro" }, { num: 12, label: "Dezembro" },
];
const ANO_ATUAL = new Date().getFullYear();
const ANOS = [ANO_ATUAL - 1, ANO_ATUAL, ANO_ATUAL + 1];

function fmt(v: number, decimals = 2) {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtR(v: number) { return `R$ ${fmt(v)}`; }
function parseN(v: string) { return parseFloat(v.replace(",", ".")) || 0; }

// ─── Custo de Solda (conteúdo migrado do CustoSolda.tsx) ─────────────────────
interface SoldaParams {
  soldadorSalarioBase: string;
  soldadorHorasExtras: string;
  soldadorValorHoraExtra: string;
  soldadorOutrosCustos: string;
  custoMetroTerceirizado: string;
  precoVendaMetro: string;
  producaoInternaSolda: string;
  metrosTerceirizados: string;
}

function calcularSolda(p: SoldaParams) {
  const salario = parseN(p.soldadorSalarioBase);
  const horasExtras = parseN(p.soldadorHorasExtras);
  const valorHE = parseN(p.soldadorValorHoraExtra);
  const outros = parseN(p.soldadorOutrosCustos);
  const custoTerceiro = parseN(p.custoMetroTerceirizado);
  const precoVenda = parseN(p.precoVendaMetro);
  const metrosInternos = parseN(p.producaoInternaSolda);
  const metrosTerceirizados = parseN(p.metrosTerceirizados);
  const custoHE = horasExtras * valorHE;
  const custoTotalSoldador = salario + custoHE + outros;
  const custoMetroInterno = metrosInternos > 0 ? custoTotalSoldador / metrosInternos : 0;
  const custoMetroTerceirizadoCalc = custoTerceiro;
  const margemInterno = precoVenda > 0 ? precoVenda - custoMetroInterno : null;
  const margemTerceirizado = precoVenda > 0 ? precoVenda - custoMetroTerceirizadoCalc : null;
  const margemPctInterno = precoVenda > 0 && custoMetroInterno > 0
    ? ((precoVenda - custoMetroInterno) / precoVenda) * 100 : null;
  const margemPctTerceirizado = precoVenda > 0 && custoMetroTerceirizadoCalc > 0
    ? ((precoVenda - custoMetroTerceirizadoCalc) / precoVenda) * 100 : null;
  const diferencaCustoPorMetro = custoMetroInterno > 0 && custoMetroTerceirizadoCalc > 0
    ? custoMetroTerceirizadoCalc - custoMetroInterno : null;
  const totalMetros = metrosInternos + metrosTerceirizados;
  const custoTotalMes = custoTotalSoldador + (metrosTerceirizados * custoTerceiro);
  return {
    salario, horasExtras, valorHE, outros, custoHE, custoTotalSoldador,
    custoMetroInterno, custoMetroTerceirizadoCalc, margemInterno, margemTerceirizado,
    margemPctInterno, margemPctTerceirizado, diferencaCustoPorMetro,
    metrosInternos, metrosTerceirizados, totalMetros, custoTotalMes, precoVenda,
  };
}

function CustoSoldaTab() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [params, setParams] = useState<SoldaParams>({
    soldadorSalarioBase: "", soldadorHorasExtras: "", soldadorValorHoraExtra: "",
    soldadorOutrosCustos: "", custoMetroTerceirizado: "", precoVendaMetro: "",
    producaoInternaSolda: "", metrosTerceirizados: "",
  });
  const [saved, setSaved] = useState(false);

  const utils = trpc.useUtils();
  const { data: registro, isLoading } = trpc.performance.getByMesAno.useQuery({ mes, ano });
  const upsertMut = trpc.performance.upsert.useMutation({
    onSuccess: () => { toast.success("Dados salvos!"); setSaved(true); utils.performance.getByMesAno.invalidate({ mes, ano }); },
    onError: () => toast.error("Erro ao salvar"),
  });

  // Preencher campos quando registro carrega
  useMemo(() => {
    if (registro) {
      setParams({
        soldadorSalarioBase: registro.soldadorSalarioBase ?? "",
        soldadorHorasExtras: registro.soldadorHorasExtras ?? "",
        soldadorValorHoraExtra: registro.soldadorValorHoraExtra ?? "",
        soldadorOutrosCustos: registro.soldadorOutrosCustos ?? "",
        custoMetroTerceirizado: registro.custoMetroTerceirizado ?? "",
        precoVendaMetro: registro.precoVendaMetro ?? "",
        producaoInternaSolda: registro.producaoInternaSolda != null ? String(registro.producaoInternaSolda) : "",
        metrosTerceirizados: registro.metrosTerceirizados != null ? String(registro.metrosTerceirizados) : "",
      });
      setSaved(true);
    } else {
      setParams({ soldadorSalarioBase: "", soldadorHorasExtras: "", soldadorValorHoraExtra: "", soldadorOutrosCustos: "", custoMetroTerceirizado: "", precoVendaMetro: "", producaoInternaSolda: "", metrosTerceirizados: "" });
      setSaved(false);
    }
  }, [registro]);

  const calc = useMemo(() => calcularSolda(params), [params]);

  function handleSave() {
    upsertMut.mutate({
      mes, ano,
      soldadorSalarioBase: params.soldadorSalarioBase || null,
      soldadorHorasExtras: params.soldadorHorasExtras || null,
      soldadorValorHoraExtra: params.soldadorValorHoraExtra || null,
      soldadorOutrosCustos: params.soldadorOutrosCustos || null,
      custoMetroTerceirizado: params.custoMetroTerceirizado || null,
      precoVendaMetro: params.precoVendaMetro || null,
      producaoInternaSolda: params.producaoInternaSolda ? parseInt(params.producaoInternaSolda) : null,
      metrosTerceirizados: params.metrosTerceirizados ? parseInt(params.metrosTerceirizados) : null,
    } as any);
  }

  function field(key: keyof SoldaParams, label: string, hint?: string) {
    return (
      <div>
        <Label className="text-xs text-slate-600 mb-1">{label}</Label>
        <Input
          value={params[key]}
          onChange={e => { setParams(p => ({ ...p, [key]: e.target.value })); setSaved(false); }}
          placeholder="0"
          className="h-8 text-sm"
        />
        {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Seletor de período */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
          <SelectTrigger className="w-36 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{MESES.map(m => <SelectItem key={m.num} value={String(m.num)}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
          <SelectTrigger className="w-24 h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
        </Select>
        {saved && <Badge variant="outline" className="text-green-600 border-green-300 text-xs"><CheckCircle2 size={11} className="mr-1" />Salvo</Badge>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formulário de entrada */}
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Users size={14} />Soldador Interno</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {field("soldadorSalarioBase", "Salário Base (R$)")}
              {field("soldadorHorasExtras", "Horas Extras (h)")}
              {field("soldadorValorHoraExtra", "Valor/Hora Extra (R$)")}
              {field("soldadorOutrosCustos", "Outros Custos (R$)", "Encargos, benefícios, etc.")}
            </CardContent>
          </Card>
          <Card className="shadow-sm border border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Wrench size={14} />Produção</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {field("producaoInternaSolda", "Metros Soldados (interno)")}
              {field("metrosTerceirizados", "Metros Terceirizados")}
              {field("custoMetroTerceirizado", "Custo/Metro Terceirizado (R$)")}
              {field("precoVendaMetro", "Preço de Venda/Metro (R$)")}
            </CardContent>
          </Card>
          <Button onClick={handleSave} disabled={upsertMut.isPending} className="w-full h-9 bg-blue-600 hover:bg-blue-700 text-white">
            <Save size={14} className="mr-2" />{upsertMut.isPending ? "Salvando..." : "Salvar Dados do Mês"}
          </Button>
        </div>

        {/* Resultados calculados */}
        <div className="space-y-4">
          <Card className="shadow-sm border border-slate-200">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2"><BarChart3 size={14} />Análise de Custo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Custo total soldador/mês</span>
                <span className="font-semibold text-slate-700">{calc.custoTotalSoldador > 0 ? fmtR(calc.custoTotalSoldador) : "—"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Custo/metro interno</span>
                <span className="font-semibold text-blue-700">{calc.custoMetroInterno > 0 ? fmtR(calc.custoMetroInterno) : "—"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Custo/metro terceirizado</span>
                <span className="font-semibold text-orange-600">{calc.custoMetroTerceirizadoCalc > 0 ? fmtR(calc.custoMetroTerceirizadoCalc) : "—"}</span>
              </div>
              {calc.totalMetros > 0 && (
                <>
                  <div className="flex justify-between pb-1.5">
                    <span className="text-slate-500">% produção interna</span>
                    <span className="font-semibold text-slate-700">{fmt((calc.metrosInternos / calc.totalMetros) * 100, 1)}%</span>
                  </div>
                  <div className="flex justify-between pb-1.5">
                    <span className="text-slate-500">% produção terceirizada</span>
                    <span className="font-semibold text-slate-700">{fmt((calc.metrosTerceirizados / calc.totalMetros) * 100, 1)}%</span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          {calc.custoMetroInterno > 0 && calc.custoMetroTerceirizadoCalc > 0 && (
            <Card className="shadow-sm border border-slate-200">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-slate-700">Comparativo Visual — Custo por Metro</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const max = Math.max(calc.custoMetroInterno, calc.custoMetroTerceirizadoCalc, calc.precoVenda || 0);
                  return (
                    <>
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span className="font-medium text-blue-700">Interno (soldador)</span>
                          <span className="font-bold text-blue-700">{fmtR(calc.custoMetroInterno)}/m</span>
                        </div>
                        <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${(calc.custoMetroInterno / max) * 100}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                          <span className="font-medium text-orange-600">Terceirizado</span>
                          <span className="font-bold text-orange-600">{fmtR(calc.custoMetroTerceirizadoCalc)}/m</span>
                        </div>
                        <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${(calc.custoMetroTerceirizadoCalc / max) * 100}%` }} />
                        </div>
                      </div>
                      {calc.precoVenda > 0 && (
                        <div>
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span className="font-medium text-green-700">Preço de Venda</span>
                            <span className="font-bold text-green-700">{fmtR(calc.precoVenda)}/m</span>
                          </div>
                          <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${(calc.precoVenda / max) * 100}%` }} />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Custo de LED ─────────────────────────────────────────────────────────────
interface LedTipoForm {
  id?: number;
  nome: string;
  descricao: string;
  custoUnitario: string;
  unidade: string;
}

interface LancamentoForm {
  id?: number;
  os: string;
  ledTipoId: string;
  ledTipoEfetivoId: string;
  qtdPrevista: string;
  qtdEfetiva: string;
  observacao: string;
}

function CustoLedTab() {
  const hoje = new Date();
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [ano, setAno] = useState(hoje.getFullYear());

  // Modal tipo LED
  const [tipoModal, setTipoModal] = useState(false);
  const [tipoForm, setTipoForm] = useState<LedTipoForm>({ nome: "", descricao: "", custoUnitario: "", unidade: "un" });

  // Modal lançamento
  const [lancModal, setLancModal] = useState(false);
  const [lancForm, setLancForm] = useState<LancamentoForm>({ os: "", ledTipoId: "", ledTipoEfetivoId: "", qtdPrevista: "", qtdEfetiva: "", observacao: "" });

  // Queries
  const utils = trpc.useUtils();
  const { data: tipos = [] } = trpc.custoLed.listTipos.useQuery();
  const { data: resumo } = trpc.custoLed.getResumoMensal.useQuery({ mes, ano });

  // Mutations
  const upsertTipo = trpc.custoLed.upsertTipo.useMutation({
    onSuccess: () => { toast.success("Tipo de LED salvo!"); setTipoModal(false); utils.custoLed.listTipos.invalidate(); utils.custoLed.getResumoMensal.invalidate(); },
    onError: () => toast.error("Erro ao salvar tipo de LED"),
  });
  const deleteTipo = trpc.custoLed.deleteTipo.useMutation({
    onSuccess: () => { toast.success("Tipo removido"); utils.custoLed.listTipos.invalidate(); utils.custoLed.getResumoMensal.invalidate(); },
    onError: () => toast.error("Erro ao remover"),
  });
  const upsertLanc = trpc.custoLed.upsertLancamento.useMutation({
    onSuccess: () => { toast.success("Lançamento salvo!"); setLancModal(false); utils.custoLed.getResumoMensal.invalidate(); },
    onError: () => toast.error("Erro ao salvar lançamento"),
  });
  const deleteLanc = trpc.custoLed.deleteLancamento.useMutation({
    onSuccess: () => { toast.success("Lançamento removido"); utils.custoLed.getResumoMensal.invalidate(); },
    onError: () => toast.error("Erro ao remover"),
  });

  function openNewTipo() {
    setTipoForm({ nome: "", descricao: "", custoUnitario: "", unidade: "un" });
    setTipoModal(true);
  }
  function openEditTipo(t: typeof tipos[0]) {
    setTipoForm({ id: t.id, nome: t.nome, descricao: t.descricao ?? "", custoUnitario: String(t.custoUnitario), unidade: t.unidade });
    setTipoModal(true);
  }
  function saveTipo() {
    if (!tipoForm.nome || !tipoForm.custoUnitario) { toast.error("Preencha nome e custo"); return; }
    upsertTipo.mutate({ id: tipoForm.id, nome: tipoForm.nome, descricao: tipoForm.descricao || undefined, custoUnitario: parseN(tipoForm.custoUnitario), unidade: tipoForm.unidade });
  }

  function openNewLanc() {
    setLancForm({ os: "", ledTipoId: tipos[0] ? String(tipos[0].id) : "", ledTipoEfetivoId: "", qtdPrevista: "", qtdEfetiva: "", observacao: "" });
    setLancModal(true);
  }
  function openEditLanc(l: NonNullable<typeof resumo>["lancamentos"][0]) {
    setLancForm({ id: l.id, os: l.os, ledTipoId: String(l.ledTipoId), ledTipoEfetivoId: l.ledTipoEfetivoId ? String(l.ledTipoEfetivoId) : "", qtdPrevista: String(l.qtdPrevista), qtdEfetiva: l.qtdEfetiva != null ? String(l.qtdEfetiva) : "", observacao: l.observacao ?? "" });
    setLancModal(true);
  }
  function saveLanc() {
    if (!lancForm.os || !lancForm.ledTipoId || !lancForm.qtdPrevista) { toast.error("Preencha OS, tipo e quantidade prevista"); return; }
    upsertLanc.mutate({
      id: lancForm.id,
      os: lancForm.os,
      ledTipoId: Number(lancForm.ledTipoId),
      ledTipoEfetivoId: lancForm.ledTipoEfetivoId && lancForm.ledTipoEfetivoId !== "__none" ? Number(lancForm.ledTipoEfetivoId) : null,
      qtdPrevista: parseN(lancForm.qtdPrevista),
      qtdEfetiva: lancForm.qtdEfetiva ? parseN(lancForm.qtdEfetiva) : null,
      mes, ano,
      observacao: lancForm.observacao || undefined,
    });
  }

  const lancamentos = resumo?.lancamentos ?? [];
  const totalPrevisto = resumo?.totalPrevisto ?? 0;
  const totalEfetivo = resumo?.totalEfetivo ?? 0;
  const diferenca = resumo?.diferenca ?? 0;

  return (
    <div className="space-y-6">
      {/* ─── Seção: Cadastro de Tipos de LED ─── */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Zap size={14} className="text-yellow-500" />
              Tipos de LED Cadastrados
            </CardTitle>
            <Button size="sm" onClick={openNewTipo} className="h-7 text-xs bg-yellow-500 hover:bg-yellow-600 text-white">
              <Plus size={12} className="mr-1" />Novo Tipo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tipos.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Nenhum tipo de LED cadastrado. Clique em "Novo Tipo" para começar.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Custo Unit.</TableHead>
                    <TableHead className="text-center">Unidade</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tipos.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-slate-800">{t.nome}</TableCell>
                      <TableCell className="text-slate-500">{t.descricao || "—"}</TableCell>
                      <TableCell className="text-right font-semibold text-blue-700">{fmtR(parseFloat(String(t.custoUnitario)))}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-xs">{t.unidade}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEditTipo(t)} className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600">
                            <Pencil size={13} />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este tipo de LED?")) deleteTipo.mutate({ id: t.id }); }} className="h-7 w-7 p-0 text-slate-500 hover:text-red-600">
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Seção: Lançamentos por OS ─── */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Package size={14} className="text-blue-500" />
              Lançamentos por OS
            </CardTitle>
            <div className="flex items-center gap-2">
              <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                <SelectTrigger className="w-32 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map(m => <SelectItem key={m.num} value={String(m.num)}>{m.label}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                <SelectTrigger className="w-20 h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={openNewLanc} disabled={tipos.length === 0} className="h-7 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Plus size={12} className="mr-1" />Novo Lançamento
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {lancamentos.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {tipos.length === 0
                    ? "Cadastre pelo menos um tipo de LED antes de adicionar lançamentos."
                    : `Nenhum lançamento em ${MESES.find(m => m.num === mes)?.label} ${ano}. Clique em "Novo Lançamento" para adicionar.`}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>OS</TableHead>
                    <TableHead>Tipo LED</TableHead>
                    <TableHead className="text-right">Qtd Prevista</TableHead>
                    <TableHead className="text-right">Custo Previsto</TableHead>
                    <TableHead className="text-right">Qtd Efetiva</TableHead>
                    <TableHead className="text-right">Custo Efetivo</TableHead>
                    <TableHead className="text-right">Resultado</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lancamentos.map(l => {
                    const resultado = l.diferenca;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono font-semibold text-slate-800">{l.os}</TableCell>
                        <TableCell className="text-slate-600">
                          <span>{l.tipoNome}</span>
                          {l.isMistura && (
                            <span className="ml-1 inline-flex items-center gap-0.5 text-xs text-amber-600 font-medium">
                              <ArrowRight size={10} />
                              <span className="bg-amber-50 border border-amber-200 rounded px-1">{l.tipoEfetivoNome}</span>
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-slate-700">{fmt(parseFloat(String(l.qtdPrevista)), 0)}</TableCell>
                        <TableCell className="text-right font-medium text-slate-700">{fmtR(l.custoPrevisto)}</TableCell>
                        <TableCell className="text-right">
                          {l.qtdEfetiva != null
                            ? <span className="text-slate-700">{fmt(parseFloat(String(l.qtdEfetiva)), 0)}</span>
                            : <span className="text-slate-300 italic text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {l.custoEfetivo != null
                            ? <span className="text-slate-700">{fmtR(l.custoEfetivo)}</span>
                            : <span className="text-slate-300 italic text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-right">
                          {resultado != null ? (
                            <span className={`font-bold flex items-center justify-end gap-1 ${resultado <= 0 ? "text-green-600" : "text-red-600"}`}>
                              {resultado <= 0 ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
                              {resultado <= 0 ? "−" : "+"}{fmtR(Math.abs(resultado))}
                            </span>
                          ) : <span className="text-slate-300 italic text-xs">—</span>}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEditLanc(l)} className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600">
                              <Pencil size={13} />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este lançamento?")) deleteLanc.mutate({ id: l.id }); }} className="h-7 w-7 p-0 text-slate-500 hover:text-red-600">
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Apuração Mensal ─── */}
      {lancamentos.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500 mb-1">Total Previsto</p>
              <p className="text-xl font-bold text-slate-800">{fmtR(totalPrevisto)}</p>
              <p className="text-xs text-slate-400 mt-1">{MESES.find(m => m.num === mes)?.label} {ano}</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border border-slate-200">
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500 mb-1">Total Efetivo</p>
              <p className="text-xl font-bold text-slate-800">{totalEfetivo > 0 ? fmtR(totalEfetivo) : "—"}</p>
              <p className="text-xs text-slate-400 mt-1">Lançamentos com qtd efetiva</p>
            </CardContent>
          </Card>
          <Card className={`shadow-sm border ${diferenca > 0 ? "border-red-200 bg-red-50" : diferenca < 0 ? "border-green-200 bg-green-50" : "border-slate-200"}`}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-slate-500 mb-1">Resultado do Mês</p>
              {totalEfetivo > 0 ? (
                <>
                  <p className={`text-xl font-bold flex items-center gap-1 ${diferenca > 0 ? "text-red-600" : "text-green-600"}`}>
                    {diferenca > 0 ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                    {diferenca > 0 ? "+" : "−"}{fmtR(Math.abs(diferenca))}
                  </p>
                  <p className={`text-xs mt-1 ${diferenca > 0 ? "text-red-500" : "text-green-500"}`}>
                    {diferenca > 0 ? "Acima do previsto (prejuízo)" : "Abaixo do previsto (economia)"}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400 italic">Preencha as quantidades efetivas</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ─── Modal: Tipo de LED ─── */}
      <Dialog open={tipoModal} onOpenChange={setTipoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-500" />
              {tipoForm.id ? "Editar Tipo de LED" : "Novo Tipo de LED"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Nome *</Label>
              <Input value={tipoForm.nome} onChange={e => setTipoForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Módulo LED Branco 6cm" className="h-8 text-sm mt-1" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Descrição</Label>
              <Input value={tipoForm.descricao} onChange={e => setTipoForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Descrição opcional" className="h-8 text-sm mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Custo Unitário (R$) *</Label>
                <Input value={tipoForm.custoUnitario} onChange={e => setTipoForm(f => ({ ...f, custoUnitario: e.target.value }))} placeholder="0,00" className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Unidade</Label>
                <Select value={tipoForm.unidade} onValueChange={v => setTipoForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un</SelectItem>
                    <SelectItem value="metro">metro</SelectItem>
                    <SelectItem value="rolo">rolo</SelectItem>
                    <SelectItem value="fita">fita</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoModal(false)} className="h-8 text-sm">Cancelar</Button>
            <Button onClick={saveTipo} disabled={upsertTipo.isPending} className="h-8 text-sm bg-yellow-500 hover:bg-yellow-600 text-white">
              <Save size={13} className="mr-1" />{upsertTipo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Lançamento ─── */}
      <Dialog open={lancModal} onOpenChange={setLancModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package size={16} className="text-blue-500" />
              {lancForm.id ? "Editar Lançamento" : "Novo Lançamento de LED"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-slate-600">Número da OS *</Label>
              <Input value={lancForm.os} onChange={e => setLancForm(f => ({ ...f, os: e.target.value }))} placeholder="Ex: 6500" className="h-8 text-sm mt-1 font-mono" />
            </div>
            <div>
              <Label className="text-xs text-slate-600">Tipo de LED *</Label>
              <Select value={lancForm.ledTipoId} onValueChange={v => setLancForm(f => ({ ...f, ledTipoId: v }))}>
                <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                <SelectContent>
                  {tipos.map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome} — {fmtR(parseFloat(String(t.custoUnitario)))}/{t.unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-600">Qtd Prevista *</Label>
                <Input value={lancForm.qtdPrevista} onChange={e => setLancForm(f => ({ ...f, qtdPrevista: e.target.value }))} placeholder="0" className="h-8 text-sm mt-1" />
              </div>
              <div>
                <Label className="text-xs text-slate-600">Qtd Efetiva</Label>
                <Input value={lancForm.qtdEfetiva} onChange={e => setLancForm(f => ({ ...f, qtdEfetiva: e.target.value }))} placeholder="Preencher após execução" className="h-8 text-sm mt-1" />
              </div>
            </div>
            {/* Tipo de LED Efetivo (mistura) */}
            <div className="border border-amber-200 bg-amber-50/50 rounded-lg p-3">
              <Label className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                <Shuffle size={12} />
                Tipo de LED Efetivo (se diferente do previsto)
              </Label>
              <p className="text-[11px] text-amber-600 mb-2">Selecione apenas se o LED realmente utilizado foi diferente do previsto acima.</p>
              <Select value={lancForm.ledTipoEfetivoId} onValueChange={v => setLancForm(f => ({ ...f, ledTipoEfetivoId: v }))}>
                <SelectTrigger className="h-8 text-sm bg-white"><SelectValue placeholder="Mesmo tipo do previsto" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Mesmo tipo do previsto</SelectItem>
                  {tipos.filter(t => String(t.id) !== lancForm.ledTipoId).map(t => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.nome} — {fmtR(parseFloat(String(t.custoUnitario)))}/{t.unidade}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {lancForm.ledTipoId && lancForm.qtdPrevista && (
              <div className="bg-blue-50 rounded-lg p-3 text-sm">
                {(() => {
                  const tipoPrev = tipos.find(t => t.id === Number(lancForm.ledTipoId));
                  const tipoEfet = lancForm.ledTipoEfetivoId && lancForm.ledTipoEfetivoId !== "__none"
                    ? tipos.find(t => t.id === Number(lancForm.ledTipoEfetivoId))
                    : null;
                  const custoPrev = tipoPrev ? parseFloat(String(tipoPrev.custoUnitario)) : 0;
                  const custoEfet = tipoEfet ? parseFloat(String(tipoEfet.custoUnitario)) : custoPrev;
                  const previsto = parseN(lancForm.qtdPrevista) * custoPrev;
                  const efetivo = lancForm.qtdEfetiva ? parseN(lancForm.qtdEfetiva) * custoEfet : null;
                  return (
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Custo previsto:</span>
                        <span className="font-semibold text-blue-700">{fmtR(previsto)}</span>
                      </div>
                      {tipoEfet && (
                        <div className="flex justify-between text-amber-700">
                          <span className="text-xs">Custo unit. efetivo ({tipoEfet.nome}):</span>
                          <span className="font-semibold text-xs">{fmtR(custoEfet)}/{tipoEfet.unidade}</span>
                        </div>
                      )}
                      {efetivo != null && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Custo efetivo:</span>
                            <span className="font-semibold text-slate-700">{fmtR(efetivo)}</span>
                          </div>
                          <div className="flex justify-between border-t border-blue-200 pt-1">
                            <span className="text-slate-500">Resultado:</span>
                            <span className={`font-bold ${efetivo > previsto ? "text-red-600" : "text-green-600"}`}>
                              {efetivo > previsto ? "+" : "−"}{fmtR(Math.abs(efetivo - previsto))}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div>
              <Label className="text-xs text-slate-600">Observação</Label>
              <Input value={lancForm.observacao} onChange={e => setLancForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Opcional" className="h-8 text-sm mt-1" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLancModal(false)} className="h-8 text-sm">Cancelar</Button>
            <Button onClick={saveLanc} disabled={upsertLanc.isPending} className="h-8 text-sm bg-blue-600 hover:bg-blue-700 text-white">
              <Save size={13} className="mr-1" />{upsertLanc.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ─── Página Principal: Custo de LED ─────────────────────────────────────────────────
export default function CustoLed() {
  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Zap size={22} className="text-yellow-500" />
            Custo de LED
          </h1>
          <p className="text-sm text-slate-500 mt-1">Controle de consumo e custo de LED por OS</p>
        </div>
        <CustoLedTab />
      </div>
    </DashboardLayout>
  );
}
