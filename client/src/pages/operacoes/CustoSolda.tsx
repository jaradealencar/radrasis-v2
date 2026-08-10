import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, DollarSign, Wrench, Users, BarChart3,
  Save, Info, AlertTriangle, CheckCircle2, Zap
} from "lucide-react";

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
function fmtR(v: number) {
  return `R$ ${fmt(v)}`;
}

interface Params {
  // Soldador interno
  numSoldadores: string;
  soldadorSalarioBase: string;
  soldadorHorasExtras: string;
  soldadorValorHoraExtra: string;
  soldadorOutrosCustos: string;
  // Custo de produtividade do setor
  custoProdutividadeSolda: string;
  // Gestor do setor
  gestorSalarioBase: string;
  gestorHorasExtras: string;
  gestorValorHoraExtra: string;
  gestorOutrosCustos: string;
  // Terceirizado
  custoMetroTerceirizado: string;
  // Produção
  producaoInternaSolda: string;
  metrosTerceirizados: string;
}

function parseN(v: string) {
  if (!v) return 0;
  // Suporta formato brasileiro: 21.880,00 → 21880.00
  // e formato simples: 21880.00 ou 21880,00
  const s = v.trim();
  // Se tem ponto E vírgula: ponto é milhar, vírgula é decimal
  if (s.includes('.') && s.includes(',')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
  }
  // Se só tem vírgula: vírgula é decimal
  if (s.includes(',') && !s.includes('.')) {
    return parseFloat(s.replace(',', '.')) || 0;
  }
  // Se só tem ponto: pode ser milhar (1.000) ou decimal (19.29)
  // Heurística: se o ponto está na posição de milhar (3 dígitos após), é milhar
  const dotIdx = s.lastIndexOf('.');
  if (dotIdx !== -1 && s.length - dotIdx - 1 === 3 && !s.includes(',')) {
    return parseFloat(s.replace(/\./g, '')) || 0;
  }
  return parseFloat(s) || 0;
}

function calcular(p: Params) {
  const nSoldadores = Math.max(1, parseN(p.numSoldadores) || 1);
  const salarioPorSoldador = parseN(p.soldadorSalarioBase);
  const horasExtras = parseN(p.soldadorHorasExtras);
  const valorHE = parseN(p.soldadorValorHoraExtra);
  const outrosPorSoldador = parseN(p.soldadorOutrosCustos);
  const custoProdutividade = parseN(p.custoProdutividadeSolda);
  // Gestor (custo dividido por 2 pois se divide em outras funções)
  const gestorSalario = parseN(p.gestorSalarioBase);
  const gestorHE = parseN(p.gestorHorasExtras) * parseN(p.gestorValorHoraExtra);
  const gestorOutros = parseN(p.gestorOutrosCustos);
  const custoTotalGestor = gestorSalario + gestorHE + gestorOutros;
  const custoGestorRateado = custoTotalGestor / 2; // 50% alocado na solda
  const custoTerceiro = parseN(p.custoMetroTerceirizado);
  const metrosInternos = parseN(p.producaoInternaSolda);
  const metrosTerceirizados = parseN(p.metrosTerceirizados);

  // Custo total do setor de solda interno no mês:
  // (salário × nSoldadores) + (HE × valorHE × nSoldadores) + (outros × nSoldadores) + produtividade + gestor rateado
  const custoHE = horasExtras * valorHE * nSoldadores;
  const custoSalarios = salarioPorSoldador * nSoldadores;
  const custoOutros = outrosPorSoldador * nSoldadores;
  const custoTotalSetor = custoSalarios + custoHE + custoOutros + custoProdutividade + custoGestorRateado;

  // Custo por metro interno = custo total do setor / metros produzidos internamente
  const custoMetroInterno = metrosInternos > 0 ? custoTotalSetor / metrosInternos : 0;

  // Custo total terceirizado no mês
  const custoTotalTerceirizado = metrosTerceirizados * custoTerceiro;

  // Diferença de custo por metro
  const diferencaCustoPorMetro = custoMetroInterno > 0 && custoTerceiro > 0
    ? custoTerceiro - custoMetroInterno : null;

  // Economia potencial se internalizar tudo
  const totalMetros = metrosInternos + metrosTerceirizados;
  const economiaSeInternalizarTudo = totalMetros > 0 && custoMetroInterno > 0 && custoTerceiro > 0
    ? (custoTerceiro - custoMetroInterno) * metrosTerceirizados : null;

  return {
    nSoldadores, salarioPorSoldador, horasExtras, valorHE, outrosPorSoldador,
    custoProdutividade, custoHE, custoSalarios, custoOutros, custoTotalSetor,
    custoMetroInterno,
    custoTerceiro, custoTotalTerceirizado,
    metrosInternos, metrosTerceirizados, totalMetros,
    diferencaCustoPorMetro, economiaSeInternalizarTudo,
    custoTotalGestor, custoGestorRateado,
  };
}

export default function CustoSolda() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());

  const { data: registro, isLoading: isLoadingRegistro, refetch } = trpc.performance.getByMesAno.useQuery({ mes, ano });

  const upsertMut = trpc.performance.upsert.useMutation({
    onSuccess: () => {
      toast.success("Parâmetros salvos com sucesso!");
      refetch();
    },
    onError: () => toast.error("Erro ao salvar parâmetros"),
  });

  const [params, setParams] = useState<Params>({
    numSoldadores: "",
    soldadorSalarioBase: "",
    soldadorHorasExtras: "",
    soldadorValorHoraExtra: "",
    soldadorOutrosCustos: "",
    custoProdutividadeSolda: "",
    gestorSalarioBase: "",
    gestorHorasExtras: "",
    gestorValorHoraExtra: "",
    gestorOutrosCustos: "",
    custoMetroTerceirizado: "",
    producaoInternaSolda: "",
    metrosTerceirizados: "",
  });

  useEffect(() => {
    if (registro !== undefined) {
      setParams({
        numSoldadores: (registro as any)?.numSoldadores != null ? String((registro as any).numSoldadores) : "",
        soldadorSalarioBase: registro?.soldadorSalarioBase ?? "",
        soldadorHorasExtras: registro?.soldadorHorasExtras ?? "",
        soldadorValorHoraExtra: registro?.soldadorValorHoraExtra ?? "",
        soldadorOutrosCustos: registro?.soldadorOutrosCustos ?? "",
        custoProdutividadeSolda: (registro as any)?.custoProdutividadeSolda ?? "",
        gestorSalarioBase: (registro as any)?.gestorSalarioBase ?? "",
        gestorHorasExtras: (registro as any)?.gestorHorasExtras ?? "",
        gestorValorHoraExtra: (registro as any)?.gestorValorHoraExtra ?? "",
        gestorOutrosCustos: (registro as any)?.gestorOutrosCustos ?? "",
        custoMetroTerceirizado: registro?.custoMetroTerceirizado ?? "",
        producaoInternaSolda: registro?.producaoInternaSolda != null ? String(registro.producaoInternaSolda) : "",
        metrosTerceirizados: registro?.metrosTerceirizados != null ? String(registro.metrosTerceirizados) : "",
      });
    }
  }, [registro]);

  const set = (k: keyof Params, v: string) => setParams(p => ({ ...p, [k]: v }));

  const calc = useMemo(() => calcular(params), [params]);

  const handleSave = () => {
    upsertMut.mutate({
      mes, ano,
      numSoldadores: parseN(params.numSoldadores) || undefined,
      soldadorSalarioBase: parseN(params.soldadorSalarioBase) || undefined,
      soldadorHorasExtras: parseN(params.soldadorHorasExtras) || undefined,
      soldadorValorHoraExtra: parseN(params.soldadorValorHoraExtra) || undefined,
      soldadorOutrosCustos: parseN(params.soldadorOutrosCustos) || undefined,
      custoProdutividadeSolda: parseN(params.custoProdutividadeSolda) || undefined,
      gestorSalarioBase: parseN(params.gestorSalarioBase) || undefined,
      gestorHorasExtras: parseN(params.gestorHorasExtras) || undefined,
      gestorValorHoraExtra: parseN(params.gestorValorHoraExtra) || undefined,
      gestorOutrosCustos: parseN(params.gestorOutrosCustos) || undefined,
      custoMetroTerceirizado: parseN(params.custoMetroTerceirizado) || undefined,
      producaoInternaSolda: parseN(params.producaoInternaSolda) || undefined,
      metrosTerceirizados: parseN(params.metrosTerceirizados) || undefined,
    });
  };

  const hasData = calc.custoMetroInterno > 0 || calc.custoTerceiro > 0;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Análise Financeira</p>
            <h1 className="text-2xl font-bold text-slate-800">Custo Efetivo por Metro de Solda</h1>
            <p className="text-sm text-slate-500">Comparativo: solda interna (setor completo) vs. solda terceirizada</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={String(mes)} onValueChange={v => { setMes(Number(v)); }}>
              <SelectTrigger className="w-32 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MESES.map(m => <SelectItem key={m.num} value={String(m.num)}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={String(ano)} onValueChange={v => { setAno(Number(v)); }}>
              <SelectTrigger className="w-24 h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulário de Parâmetros */}
          <div className="lg:col-span-1 space-y-4">

            {/* Card: Setor de Solda Interno */}
            <Card className="border border-blue-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  Soldador Interno
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Nº de Soldadores */}
                <div>
                  <Label className="text-xs text-slate-600">Nº de Soldadores no Setor</Label>
                  <Input
                    value={params.numSoldadores}
                    onChange={e => set("numSoldadores", e.target.value)}
                    placeholder="Ex: 3"
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">Quantidade de soldadores ativos no mês</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Salário Base por Soldador (R$)</Label>
                  <Input
                    value={params.soldadorSalarioBase}
                    onChange={e => set("soldadorSalarioBase", e.target.value)}
                    placeholder="Ex: 3500,00"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Horas Extras no Mês (h) — por soldador</Label>
                  <Input
                    value={params.soldadorHorasExtras}
                    onChange={e => set("soldadorHorasExtras", e.target.value)}
                    placeholder="Ex: 20"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Valor da Hora Extra (R$/h)</Label>
                  <Input
                    value={params.soldadorValorHoraExtra}
                    onChange={e => set("soldadorValorHoraExtra", e.target.value)}
                    placeholder="Ex: 25,00"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Outros Custos por Soldador — Encargos, Benefícios (R$)</Label>
                  <Input
                    value={params.soldadorOutrosCustos}
                    onChange={e => set("soldadorOutrosCustos", e.target.value)}
                    placeholder="Ex: 1200,00"
                    className="h-8 text-sm mt-1"
                  />
                </div>

                {/* Resumo inline do custo de salários */}
                {calc.custoSalarios > 0 && (
                  <div className="bg-blue-50 rounded p-2 text-xs text-blue-700 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Salários ({calc.nSoldadores}× {fmtR(calc.salarioPorSoldador)}):</span>
                      <span className="font-semibold">{fmtR(calc.custoSalarios)}</span>
                    </div>
                    {calc.custoHE > 0 && (
                      <div className="flex justify-between">
                        <span>H.E. total:</span>
                        <span className="font-semibold">{fmtR(calc.custoHE)}</span>
                      </div>
                    )}
                    {calc.custoOutros > 0 && (
                      <div className="flex justify-between">
                        <span>Encargos/benef. total:</span>
                        <span className="font-semibold">{fmtR(calc.custoOutros)}</span>
                      </div>
                    )}
                    {calc.custoGestorRateado > 0 && (
                      <div className="flex justify-between text-teal-700">
                        <span>Gestor (50% rateado):</span>
                        <span className="font-semibold">{fmtR(calc.custoGestorRateado)}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Card: Custo de Produtividade */}
            <Card className="border border-purple-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-purple-500" />
                  Custo de Produtividade da Solda
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">Custo Total de Produtividade do Setor no Mês (R$)</Label>
                  <Input
                    value={params.custoProdutividadeSolda}
                    onChange={e => set("custoProdutividadeSolda", e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                    placeholder="Ex: 2500,00"
                    className="h-8 text-sm mt-1"
                  />
                  <p className="text-xs text-slate-400 mt-0.5">
                    Inclui: consumíveis, gases, manutenção de equipamentos, energia, etc.
                  </p>
                </div>
                {calc.custoProdutividade > 0 && (
                  <div className="bg-purple-50 rounded p-2 text-xs text-purple-700">
                    <span className="font-semibold">Custo de produtividade:</span> {fmtR(calc.custoProdutividade)}
                  </div>
                )}
                <Button
                  onClick={handleSave}
                  disabled={upsertMut.isPending}
                  size="sm"
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  {upsertMut.isPending ? "Salvando..." : "Salvar Custo de Produtividade"}
                </Button>
              </CardContent>
            </Card>

            {/* Card: Gestor do Setor */}
            <Card className="border border-teal-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Users className="w-4 h-4 text-teal-600" />
                  Gestor do Setor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">Salário Base (R$)</Label>
                  <Input
                    value={params.gestorSalarioBase}
                    onChange={e => set("gestorSalarioBase", e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                    placeholder="Ex: 3.500,00"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-slate-600">Horas Extras no Mês (h)</Label>
                    <Input
                      value={params.gestorHorasExtras}
                      onChange={e => set("gestorHorasExtras", e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                      placeholder="Ex: 20"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Valor H.E. (R$/h)</Label>
                    <Input
                      value={params.gestorValorHoraExtra}
                      onChange={e => set("gestorValorHoraExtra", e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                      placeholder="Ex: 35,00"
                      className="h-8 text-sm mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Outros Custos — Encargos, Benefícios (R$)</Label>
                  <Input
                    value={params.gestorOutrosCustos}
                    onChange={e => set("gestorOutrosCustos", e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
                    placeholder="Ex: 800,00"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                {calc.custoTotalGestor > 0 && (
                  <div className="bg-teal-50 rounded p-2 text-xs text-teal-700 space-y-0.5">
                    <div className="flex justify-between">
                      <span>Custo total do gestor:</span>
                      <span className="font-semibold">{fmtR(calc.custoTotalGestor)}</span>
                    </div>
                    <div className="flex justify-between text-teal-600">
                      <span>50% rateado na solda:</span>
                      <span className="font-semibold">{fmtR(calc.custoGestorRateado)}</span>
                    </div>
                    <p className="text-teal-400 mt-1">O gestor divide seu tempo entre outras funções; apenas 50% do custo é alocado no setor de solda.</p>
                  </div>
                )}
                <Button
                  onClick={handleSave}
                  disabled={upsertMut.isPending}
                  size="sm"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white gap-2"
                >
                  <Save className="w-3.5 h-3.5" />
                  {upsertMut.isPending ? "Salvando..." : "Salvar Gestor"}
                </Button>
              </CardContent>
            </Card>

            {/* Card: Solda Terceirizada */}
            <Card className="border border-orange-100 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-orange-500" />
                  Solda Terceirizada
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">Custo por Metro Terceirizado (R$/m)</Label>
                  <Input
                    value={params.custoMetroTerceirizado}
                    onChange={e => set("custoMetroTerceirizado", e.target.value)}
                    placeholder="Ex: 8,50"
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Card: Produção do Mês */}
            <Card className="border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  Produção do Mês
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs text-slate-600">Metros Soldados Internamente (m)</Label>
                  <Input
                    value={params.producaoInternaSolda}
                    onChange={e => set("producaoInternaSolda", e.target.value)}
                    placeholder="Ex: 2531"
                    className="h-8 text-sm mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-600">Metros Terceirizados (m)</Label>
                  <Input
                    value={params.metrosTerceirizados}
                    onChange={e => set("metrosTerceirizados", e.target.value)}
                    placeholder="Ex: 816"
                    className="h-8 text-sm mt-1"
                  />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={upsertMut.isPending} className="w-full gap-2 bg-blue-600 hover:bg-blue-700 text-white">
              <Save className="w-4 h-4" />
              {upsertMut.isPending ? "Salvando..." : "Salvar Parâmetros"}
            </Button>
          </div>

          {/* Dashboard de Resultados */}
          <div className="lg:col-span-2 space-y-4">
            {!hasData && (
              <div className="flex flex-col items-center justify-center h-64 rounded-xl border-2 border-dashed border-slate-200 text-slate-400">
                <Info className="w-10 h-10 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Preencha os parâmetros ao lado</p>
                <p className="text-xs mt-1">O comparativo será calculado automaticamente</p>
              </div>
            )}

            {hasData && (
              <>
                {/* Custo por Metro — Cards lado a lado */}
                <div className="grid grid-cols-2 gap-4">
                  <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">Custo / Metro Interno</p>
                          <p className="text-3xl font-bold text-slate-800">
                            {calc.custoMetroInterno > 0 ? fmtR(calc.custoMetroInterno) : "—"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Salários + H.E. + encargos + produtividade
                          </p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                      </div>
                      {calc.metrosInternos > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                          {fmt(calc.metrosInternos, 0)} metros · {calc.nSoldadores} soldador{calc.nSoldadores !== 1 ? "es" : ""}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-l-4 border-l-orange-400 shadow-sm">
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-1">Custo / Metro Terceirizado</p>
                          <p className="text-3xl font-bold text-slate-800">
                            {calc.custoTerceiro > 0 ? fmtR(calc.custoTerceiro) : "—"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">Valor pago ao terceiro por metro</p>
                        </div>
                        <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
                          <Wrench className="w-5 h-5 text-orange-500" />
                        </div>
                      </div>
                      {calc.metrosTerceirizados > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                          {fmt(calc.metrosTerceirizados, 0)} metros · Total: {fmtR(calc.custoTotalTerceirizado)}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Diferença de Custo */}
                {calc.diferencaCustoPorMetro !== null && (
                  <Card className={`shadow-sm ${calc.diferencaCustoPorMetro > 0 ? "border-l-4 border-l-green-500 bg-green-50" : "border-l-4 border-l-red-400 bg-red-50"}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-3">
                        {calc.diferencaCustoPorMetro > 0
                          ? <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
                          : <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
                        }
                        <div>
                          <p className={`text-sm font-bold ${calc.diferencaCustoPorMetro > 0 ? "text-green-700" : "text-red-600"}`}>
                            {calc.diferencaCustoPorMetro > 0
                              ? `Solda interna é R$ ${fmt(Math.abs(calc.diferencaCustoPorMetro))} mais barata por metro`
                              : `Solda terceirizada é R$ ${fmt(Math.abs(calc.diferencaCustoPorMetro))} mais barata por metro`
                            }
                          </p>
                          {calc.economiaSeInternalizarTudo !== null && calc.metrosTerceirizados > 0 && (
                            <p className="text-xs text-slate-600 mt-0.5">
                              {calc.diferencaCustoPorMetro > 0
                                ? `Economia potencial se internalizar os ${fmt(calc.metrosTerceirizados, 0)} m terceirizados: `
                                : `Custo extra se internalizar os ${fmt(calc.metrosTerceirizados, 0)} m terceirizados: `
                              }
                              <span className="font-semibold">{fmtR(Math.abs(calc.economiaSeInternalizarTudo))}/mês</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Resumo Mensal */}
                <Card className="shadow-sm border border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-slate-500" />
                      Resumo do Mês — {MESES.find(m => m.num === mes)?.label} {ano}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Soldadores no setor</span>
                        <span className="font-semibold text-slate-700">{calc.nSoldadores}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Total metros internos</span>
                        <span className="font-semibold text-slate-700">{fmt(calc.metrosInternos, 0)} m</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Custo salários (setor)</span>
                        <span className="font-semibold text-blue-700">{fmtR(calc.custoSalarios)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Custo H.E. (setor)</span>
                        <span className="font-semibold text-blue-600">{fmtR(calc.custoHE)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Encargos/benef. (setor)</span>
                        <span className="font-semibold text-blue-600">{fmtR(calc.custoOutros)}</span>
                      </div>
                      {calc.custoGestorRateado > 0 && (
                        <div className="flex justify-between border-b border-slate-100 pb-1.5">
                          <span className="text-slate-500">Gestor (50% rateado)</span>
                          <span className="font-semibold text-teal-600">{fmtR(calc.custoGestorRateado)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Custo produtividade</span>
                        <span className="font-semibold text-purple-700">{fmtR(calc.custoProdutividade)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Custo total setor interno</span>
                        <span className="font-bold text-blue-800">{fmtR(calc.custoTotalSetor)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Custo total terceirizado</span>
                        <span className="font-semibold text-orange-600">{fmtR(calc.custoTotalTerceirizado)}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500 font-medium">Custo/metro interno</span>
                        <span className="font-bold text-blue-700">{calc.custoMetroInterno > 0 ? fmtR(calc.custoMetroInterno) : "—"}</span>
                      </div>
                      <div className="flex justify-between border-b border-slate-100 pb-1.5">
                        <span className="text-slate-500">Custo/metro terceirizado</span>
                        <span className="font-semibold text-orange-600">{calc.custoTerceiro > 0 ? fmtR(calc.custoTerceiro) : "—"}</span>
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
                    </div>
                  </CardContent>
                </Card>

                {/* Barra visual de comparação */}
                {calc.custoMetroInterno > 0 && calc.custoTerceiro > 0 && (
                  <Card className="shadow-sm border border-slate-200">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-slate-700">Comparativo Visual — Custo por Metro</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {(() => {
                        const max = Math.max(calc.custoMetroInterno, calc.custoTerceiro);
                        const pctInterno = (calc.custoMetroInterno / max) * 100;
                        const pctTerceiro = (calc.custoTerceiro / max) * 100;
                        return (
                          <>
                            <div>
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span className="font-medium text-blue-700">Interno (setor de solda)</span>
                                <span className="font-bold text-blue-700">{fmtR(calc.custoMetroInterno)}/m</span>
                              </div>
                              <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pctInterno}%` }} />
                              </div>
                            </div>
                            <div>
                              <div className="flex justify-between text-xs text-slate-500 mb-1">
                                <span className="font-medium text-orange-600">Terceirizado</span>
                                <span className="font-bold text-orange-600">{fmtR(calc.custoTerceiro)}/m</span>
                              </div>
                              <div className="h-6 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-orange-400 rounded-full transition-all duration-500" style={{ width: `${pctTerceiro}%` }} />
                              </div>
                            </div>
                            {/* Composição do custo interno */}
                            {calc.custoTotalSetor > 0 && (
                              <div className="mt-2 pt-3 border-t border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 mb-2">Composição do custo interno</p>
                                <div className="space-y-1.5">
                                  {[
                                    { label: "Salários", value: calc.custoSalarios, color: "bg-blue-400" },
                                    { label: "Horas Extras", value: calc.custoHE, color: "bg-blue-300" },
                                    { label: "Encargos/Benef.", value: calc.custoOutros, color: "bg-indigo-300" },
                    { label: "Produtividade", value: calc.custoProdutividade, color: "bg-purple-400" },
                                    { label: "Gestor (50%)", value: calc.custoGestorRateado, color: "bg-teal-400" },
                                   ].filter(item => item.value > 0).map(item => (
                                    <div key={item.label}>
                                      <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                                        <span>{item.label}</span>
                                        <span className="font-medium">{fmtR(item.value)} ({fmt((item.value / calc.custoTotalSetor) * 100, 1)}%)</span>
                                      </div>
                                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full ${item.color} rounded-full transition-all duration-500`}
                                          style={{ width: `${(item.value / calc.custoTotalSetor) * 100}%` }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
