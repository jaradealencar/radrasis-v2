import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign, TrendingDown, TrendingUp, Users, ShoppingBag, Percent, Scale,
  AlertTriangle, CheckCircle2, Info, Loader2, Gauge, Landmark,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import ResultadoGeralWaterfall from "./ResultadoGeralWaterfall";
import ResultadoPorVendedor from "./ResultadoPorVendedor";
import { fmtBrl, fmtBrlCompact, fmtPct, fmtNum, MESES, MESES_ABREV } from "@/lib/format";

const COR_POSITIVO = "#16a34a";
const COR_ALERTA = "#dc2626";
const COR_PENDENTE = "#94a3b8";

const SELO_LABEL: Record<string, string> = { real: "Real", rateado: "Rateado", "sem-dado": "Sem dado" };
const SELO_COR: Record<string, string> = {
  real: "bg-emerald-50 text-emerald-700 border-emerald-200",
  rateado: "bg-amber-50 text-amber-700 border-amber-200",
  "sem-dado": "bg-slate-100 text-slate-500 border-slate-200",
};

function SeloOrigem({ origem }: { origem: string }) {
  return <Badge variant="outline" className={`text-[9px] px-1 py-0 ${SELO_COR[origem] ?? SELO_COR["sem-dado"]}`}>{SELO_LABEL[origem] ?? origem}</Badge>;
}

export default function ResultadoGeral({ anoSel }: { anoSel: number }) {
  const [mesSel, setMesSel] = useState<number | null>(null);
  const { data, isLoading } = trpc.marketingFinanceiro.getResultadoGeralAno.useQuery({ ano: anoSel });

  const meses = data?.meses ?? [];
  const mesesCompletos = useMemo(() => meses.filter(m => !m.mesParcial), [meses]);
  const selecionado = mesSel ?? mesesCompletos[mesesCompletos.length - 1]?.mes ?? meses[meses.length - 1]?.mes ?? null;
  const sel = meses.find(m => m.mes === selecionado) ?? null;
  const idxSel = sel ? meses.indexOf(sel) : -1;
  const anterior = idxSel > 0 ? meses[idxSel - 1] : null;

  const delta = (curr: number | null, prev: number | null | undefined) => {
    if (curr == null || prev == null || prev === 0) return null;
    return ((curr - prev) / Math.abs(prev)) * 100;
  };

  const etapasCascata = useMemo(() => {
    if (!sel) return [];
    const p = sel.ponte;
    return [
      { label: "Faturamento Líquido", valor: p.faturamentoLiquido, tipo: "inicio" as const },
      { label: "Custos Variáveis", valor: p.custosVariaveis != null ? -p.custosVariaveis : null, tipo: "delta" as const },
      { label: "Marketing", valor: p.investimentoMarketing != null ? -p.investimentoMarketing : null, tipo: "delta" as const },
      { label: "Custos Fixos", valor: p.custosFixos != null ? -p.custosFixos : null, tipo: "delta" as const },
      { label: "Resultado Operacional", valor: p.resultadoOperacional, tipo: "total" as const },
    ];
  }, [sel]);

  const alertas = useMemo(() => {
    type A = { tipo: "positivo" | "atencao" | "alerta"; texto: string };
    const lista: A[] = [];
    if (!sel) return lista;

    if (sel.ponte.resultadoOperacional != null && anterior?.ponte.resultadoOperacional != null) {
      const cresceuFaturamento = sel.ponte.faturamentoLiquido != null && anterior.ponte.faturamentoLiquido != null && sel.ponte.faturamentoLiquido > anterior.ponte.faturamentoLiquido;
      const caiuResultado = sel.ponte.resultadoOperacional < anterior.ponte.resultadoOperacional;
      if (cresceuFaturamento && caiuResultado) lista.push({ tipo: "atencao", texto: "O faturamento cresceu em relação ao mês anterior, mas o resultado operacional diminuiu — associado a aumento de custos proporcionalmente maior que o de receita." });
    }
    if (sel.desvioMargem.desvioPontosPct != null && sel.desvioMargem.desvioPontosPct < -3) {
      lista.push({ tipo: "alerta", texto: `A margem real (${fmtPct((sel.desvioMargem.margemRealPct ?? 0) * 100)}) ficou ${Math.abs(sel.desvioMargem.desvioPontosPct).toFixed(1)} pontos abaixo da meta administrativa (${fmtPct(sel.desvioMargem.margemMetaPct * 100)}) — impacto estimado de ${fmtBrl(sel.desvioMargem.impactoFinanceiro)}.` });
    }
    if (sel.pontoEquilibrio.distanciaAoEquilibrio != null && sel.pontoEquilibrio.distanciaAoEquilibrio < 0) {
      lista.push({ tipo: "alerta", texto: `O mês ficou abaixo do ponto de equilíbrio — faltaram ${fmtBrl(Math.abs(sel.pontoEquilibrio.distanciaAoEquilibrio))} em faturamento líquido para cobrir custos fixos e marketing.` });
    } else if (sel.pontoEquilibrio.distanciaAoEquilibrio != null) {
      lista.push({ tipo: "positivo", texto: `O mês superou o ponto de equilíbrio em ${fmtBrl(sel.pontoEquilibrio.distanciaAoEquilibrio)} (margem de segurança: ${fmtPct(sel.pontoEquilibrio.margemSegurancaPct)}).` });
    }
    if (sel.origemDados.custosFixos === "sem-dado") {
      lista.push({ tipo: "atencao", texto: "Existem custos ainda não classificados: as Despesas Fixas deste mês não foram preenchidas em Dados Mensais — ponto de equilíbrio e resultado operacional não podem ser calculados." });
    }
    if (sel.ponte.resultadoOperacional != null && sel.ponte.despesasFinanceiras == null) {
      lista.push({ tipo: "atencao", texto: "O resultado contém valores estimados/incompletos: despesas financeiras e não-operacionais não têm fonte no ERP — o resultado final acima é, na prática, o resultado operacional." });
    }
    return lista;
  }, [sel, anterior]);

  if (isLoading) return <div className="flex items-center justify-center py-24 text-muted-foreground gap-2"><Loader2 size={22} className="animate-spin" /> Carregando dados de resultado geral...</div>;
  if (!sel) return <div className="text-center py-16 text-muted-foreground text-sm">Nenhum dado disponível para {anoSel}. Cadastre os dados mensais na aba Financeiro.</div>;

  const label = MESES[sel.mes - 1];
  const lucro = sel.ponte.resultadoFinal ?? sel.ponte.resultadoOperacional;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mês de referência:</span>
        {meses.map(m => (
          <button
            key={m.mes}
            onClick={() => setMesSel(m.mes === selecionado ? null : m.mes)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              m.mes === selecionado ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-blue-300"
            }`}
          >
            {MESES_ABREV[m.mes - 1]}
            {m.mesParcial && <span className="ml-1 opacity-70">*</span>}
          </button>
        ))}
      </div>

      {alertas.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Gauge size={15} className="text-slate-500" /> Leitura Executiva — {label}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {alertas.map((a, i) => {
              const estilo = a.tipo === "positivo" ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", Icon: CheckCircle2, iconColor: "text-emerald-600" }
                : a.tipo === "atencao" ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800", Icon: AlertTriangle, iconColor: "text-amber-600" }
                : { bg: "bg-red-50", border: "border-red-200", text: "text-red-800", Icon: AlertTriangle, iconColor: "text-red-600" };
              return (
                <div key={i} className={`flex items-start gap-2 ${estilo.bg} border ${estilo.border} rounded-lg p-2.5 text-xs ${estilo.text}`}>
                  <estilo.Icon size={14} className={`mt-0.5 shrink-0 ${estilo.iconColor}`} />
                  <span>{a.texto}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-blue-500 rounded" /> Indicadores — {label}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard variant="border" color="#0ea5e9" icon={<DollarSign size={18} />} label="Faturamento Bruto" value={fmtBrl(sel.ponte.faturamentoBruto)} sub={sel.ponte.cancelamentosInformativo ? `Cancelamentos (informativo): ${fmtBrl(sel.ponte.cancelamentosInformativo)}` : undefined} />
          <KpiCard variant="border" color="#16a34a" icon={<DollarSign size={18} />} label="Faturamento Líquido" value={fmtBrl(sel.ponte.faturamentoLiquido)} sub={<SeloOrigem origem={sel.origemDados.faturamentoLiquido} />} />
          <KpiCard variant="border" color="#2563eb" icon={<ShoppingBag size={18} />} label="Pedidos" value={fmtNum(sel.qtdPedidos)} sub={`${fmtNum(sel.qtdClientesUnicos)} clientes únicos`} />
          <KpiCard variant="border" color="#475569" icon={<ShoppingBag size={18} />} label="Ticket Médio / Mediano" value={fmtBrl(sel.ticketMedio)} sub={`Mediano: ${fmtBrl(sel.ticketMediano)} · Maior: ${fmtBrl(sel.maiorPedido)}`} />

          <KpiCard variant="border" color="#f59e0b" icon={<TrendingDown size={18} />} label="Custos Variáveis" value={fmtBrl(sel.ponte.custosVariaveis)} sub={<SeloOrigem origem={sel.origemDados.custosVariaveis} />} />
          <KpiCard variant="border" color={COR_POSITIVO} icon={<TrendingUp size={18} />} label="Margem de Contribuição" value={fmtBrl(sel.ponte.margemContribuicao)} sub={sel.ponte.margemContribuicaoPct != null ? fmtPct(sel.ponte.margemContribuicaoPct * 100) : undefined} />
          <KpiCard variant="border" color="#7c3aed" icon={<Percent size={18} />} label="Investimento em Marketing" value={fmtBrl(sel.investimentoMarketingBruto)} sub={sel.custosFinanceirosIncluemMarketing ? "Já incluso nos custos fixos" : "Já subtraído na ponte"} />
          <KpiCard variant="border" color="#0d9488" icon={<TrendingUp size={18} />} label="Contribuição após Marketing" value={fmtBrl(sel.ponte.contribuicaoAposMarketing)} />

          <KpiCard variant="border" color="#dc2626" icon={<TrendingDown size={18} />} label="Custos Fixos" value={fmtBrl(sel.ponte.custosFixos)} sub={<SeloOrigem origem={sel.origemDados.custosFixos} />} />
          <KpiCard variant="border" color={sel.ponte.resultadoOperacional != null && sel.ponte.resultadoOperacional >= 0 ? COR_POSITIVO : COR_ALERTA} icon={<Landmark size={18} />} label="Resultado Operacional" value={fmtBrl(sel.ponte.resultadoOperacional)} sub={sel.ponte.resultadoOperacional != null && sel.ponte.faturamentoLiquido ? fmtPct((sel.ponte.resultadoOperacional / sel.ponte.faturamentoLiquido) * 100) : undefined} />
          <KpiCard
            variant="border" color={lucro != null && lucro >= 0 ? COR_POSITIVO : COR_ALERTA} icon={lucro != null && lucro >= 0 ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
            label={lucro != null && lucro >= 0 ? "Lucro" : "Prejuízo"} value={fmtBrl(lucro)}
            sub={delta(lucro, anterior?.ponte.resultadoFinal ?? anterior?.ponte.resultadoOperacional) != null ? `${(delta(lucro, anterior?.ponte.resultadoFinal ?? anterior?.ponte.resultadoOperacional)! >= 0 ? "+" : "")}${delta(lucro, anterior?.ponte.resultadoFinal ?? anterior?.ponte.resultadoOperacional)!.toFixed(0)}% vs mês anterior` : undefined}
          />
          <KpiCard variant="border" color="#475569" icon={<Scale size={18} />} label="Custo Fixo / Resultado por Pedido" value={fmtBrl(sel.custoFixoMedioPorPedido)} sub={sel.resultadoMedioPorPedido != null ? `Resultado: ${fmtBrl(sel.resultadoMedioPorPedido)}` : undefined} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-amber-500 rounded" /> Ponto de Equilíbrio
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard variant="border" color="#f59e0b" icon={<Gauge size={18} />} label="Ponto de Equilíbrio" value={sel.pontoEquilibrio.pontoEquilibrio != null ? fmtBrl(sel.pontoEquilibrio.pontoEquilibrio) : "—"} tooltip="(Custos Fixos + Investimento em Marketing) ÷ Margem de Contribuição %." />
          <KpiCard variant="border" color={sel.pontoEquilibrio.margemSegurancaPct != null && sel.pontoEquilibrio.margemSegurancaPct >= 0 ? COR_POSITIVO : COR_ALERTA} icon={<Percent size={18} />} label="Margem de Segurança" value={sel.pontoEquilibrio.margemSegurancaPct != null ? fmtPct(sel.pontoEquilibrio.margemSegurancaPct) : "—"} />
          <KpiCard variant="border" color={sel.pontoEquilibrio.distanciaAoEquilibrio != null && sel.pontoEquilibrio.distanciaAoEquilibrio >= 0 ? COR_POSITIVO : COR_ALERTA} icon={<TrendingUp size={18} />} label="Distância até o Equilíbrio" value={sel.pontoEquilibrio.distanciaAoEquilibrio != null ? fmtBrl(sel.pontoEquilibrio.distanciaAoEquilibrio) : "—"} />
          <KpiCard variant="border" color="#475569" icon={<ShoppingBag size={18} />} label="Pedidos p/ Equilíbrio" value={sel.pontoEquilibrio.pedidosParaEquilibrio != null ? fmtNum(sel.pontoEquilibrio.pedidosParaEquilibrio) : "—"} sub={sel.qtdPedidos ? `Atual: ${fmtNum(sel.qtdPedidos)}` : undefined} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Ponte de Resultado — {label}</CardTitle></CardHeader>
          <CardContent><ResultadoGeralWaterfall etapas={etapasCascata} /></CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Percent size={16} className="text-violet-600" /> Margem-Meta vs. Margem Real</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-muted-foreground">Meta administrativa</div><div className="font-semibold">{fmtPct(sel.desvioMargem.margemMetaPct * 100)}</div></div>
              <div><div className="text-xs text-muted-foreground">Margem real do mês</div><div className="font-semibold">{sel.desvioMargem.margemRealPct != null ? fmtPct(sel.desvioMargem.margemRealPct * 100) : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Desvio</div><div className={`font-semibold ${sel.desvioMargem.desvioPontosPct != null && sel.desvioMargem.desvioPontosPct >= 0 ? "text-emerald-600" : "text-red-500"}`}>{sel.desvioMargem.desvioPontosPct != null ? `${sel.desvioMargem.desvioPontosPct >= 0 ? "+" : ""}${sel.desvioMargem.desvioPontosPct.toFixed(1)} p.p.` : "—"}</div></div>
              <div><div className="text-xs text-muted-foreground">Impacto financeiro</div><div className={`font-semibold ${sel.desvioMargem.impactoFinanceiro != null && sel.desvioMargem.impactoFinanceiro >= 0 ? "text-emerald-600" : "text-red-500"}`}>{sel.desvioMargem.impactoFinanceiro != null ? fmtBrl(sel.desvioMargem.impactoFinanceiro) : "—"}</div></div>
            </div>
            <p className="text-[11px] text-muted-foreground border-t pt-2">A meta de {fmtPct(sel.desvioMargem.margemMetaPct * 100)} é uma decisão administrativa (configurável em Configurações), não necessariamente a margem real de todos os meses.</p>
          </CardContent>
        </Card>
      </div>

      {(sel.porFuncionario.faturamentoPorFuncionario != null) ? (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users size={15} className="text-slate-500" /> Indicadores por Funcionário — {label}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4 text-sm">
            <div><div className="text-xs text-muted-foreground">Faturamento por funcionário</div><div className="font-semibold">{fmtBrl(sel.porFuncionario.faturamentoPorFuncionario)}</div></div>
            <div><div className="text-xs text-muted-foreground">Margem por funcionário</div><div className="font-semibold">{fmtBrl(sel.porFuncionario.margemPorFuncionario)}</div></div>
            <div><div className="text-xs text-muted-foreground">Resultado por funcionário</div><div className="font-semibold">{fmtBrl(sel.porFuncionario.resultadoPorFuncionario)}</div></div>
          </CardContent>
          <CardContent className="pt-0"><p className="text-[11px] text-muted-foreground">Indicadores gerenciais — não devem ser usados isoladamente para avaliar pessoas.</p></CardContent>
        </Card>
      ) : (
        <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
          <Info size={13} className="mt-0.5 shrink-0" />
          Indicadores por funcionário indisponíveis — preencha o número de colaboradores na aba Financeiro → Dados Mensais para habilitá-los.
        </div>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Comparativo Mensal — {anoSel}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Faturamento</TableHead>
                  <TableHead className="text-right">Pedidos</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead className="text-right">Marketing</TableHead>
                  <TableHead className="text-right">Custos Fixos</TableHead>
                  <TableHead className="text-right">Resultado</TableHead>
                  <TableHead className="text-right">P. Equilíbrio</TableHead>
                  <TableHead className="text-right">Distância</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {meses.map(m => (
                  <TableRow key={m.mes} className={m.mesParcial ? "bg-blue-50/40" : m.mes === selecionado ? "bg-blue-50" : ""}>
                    <TableCell className="font-medium">{MESES_ABREV[m.mes - 1]}{m.mesParcial && <Badge variant="outline" className="ml-1 text-[9px] bg-blue-50 text-blue-700 border-blue-200">Parcial</Badge>}</TableCell>
                    <TableCell className="text-right">{m.ponte.faturamentoLiquido != null ? fmtBrlCompact(m.ponte.faturamentoLiquido) : "—"}</TableCell>
                    <TableCell className="text-right">{fmtNum(m.qtdPedidos)}</TableCell>
                    <TableCell className="text-right">{m.ponte.margemContribuicao != null ? fmtBrlCompact(m.ponte.margemContribuicao) : "—"}</TableCell>
                    <TableCell className="text-right text-purple-700">{fmtBrlCompact(m.investimentoMarketingBruto)}</TableCell>
                    <TableCell className="text-right">{m.ponte.custosFixos != null ? fmtBrlCompact(m.ponte.custosFixos) : "—"}</TableCell>
                    <TableCell className={`text-right font-semibold ${m.ponte.resultadoOperacional != null ? (m.ponte.resultadoOperacional >= 0 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground"}`}>{m.ponte.resultadoOperacional != null ? fmtBrlCompact(m.ponte.resultadoOperacional) : "—"}</TableCell>
                    <TableCell className="text-right">{m.pontoEquilibrio.pontoEquilibrio != null ? fmtBrlCompact(m.pontoEquilibrio.pontoEquilibrio) : "—"}</TableCell>
                    <TableCell className={`text-right ${m.pontoEquilibrio.distanciaAoEquilibrio != null ? (m.pontoEquilibrio.distanciaAoEquilibrio >= 0 ? "text-emerald-600" : "text-red-500") : "text-muted-foreground"}`}>{m.pontoEquilibrio.distanciaAoEquilibrio != null ? fmtBrlCompact(m.pontoEquilibrio.distanciaAoEquilibrio) : "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ResultadoPorVendedor />
    </div>
  );
}
