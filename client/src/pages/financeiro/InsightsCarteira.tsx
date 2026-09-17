import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import {
  AlertTriangle, TrendingDown, Clock3, Sprout, Target, Percent, Loader2,
  Info, ClipboardList, Radio, ShoppingBag, Users2,
} from "lucide-react";
import KpiCard from "@/components/KpiCard";
import { fmtBrl, fmtPct, fmtNum } from "@/lib/format";
import { CLASSIFICACAO_INFO } from "@/pages/comercial/InteligenteClientes";
import type { RouterOutputs } from "@/lib/trpc";
import { cacPonderado, custoReativacaoPonderado, somarOuNull } from "@shared/marketing-financeiro";

type RelatorioAno = RouterOutputs["marketingFinanceiro"]["getRelatorioAno"];

interface Props {
  ano: number;
  relatorio: RelatorioAno;
}

function periodoAno(ano: number): { dataInicial: string; dataFinal: string } {
  const hoje = new Date();
  const dataInicial = `${ano}-01-01`;
  const dataFinal = ano === hoje.getFullYear() ? hoje.toISOString().slice(0, 10) : `${ano}-12-31`;
  return { dataInicial, dataFinal };
}

const COR_AQUISICAO = "#7c3aed";
const COR_REATIVACAO = "#ea580c";
const COR_ALERTA = "#dc2626";
const COR_ATENCAO = "#d97706";
const COR_POSITIVO = "#16a34a";

/**
 * Painel de Insights e Alertas — reaproveita integralmente o sistema de
 * classificação de clientes já existente (server/services/inteligenciaClientes.ts,
 * mesmos limiares: variação de volume ±20%, atraso ≥1,5x a mediana histórica de
 * intervalo — RAZAO_ATRASO_LIMIAR/VARIACAO_VOLUME_LIMIAR_PCT) e a métrica de
 * recompra de novos/reativados (calcularRecompraNovosReativados), ambos já
 * usados pela aba "Clientes" de Inteligência de Clientes.
 *
 * Diferença proposital: aqui a janela usada é o ANO INTEIRO selecionado, não um
 * intervalo curto (mês) como o seletor padrão daquela tela — um card parecido
 * ("Segunda compra em X dias") foi removido de lá em 13/09/2026 por "amostra
 * insuficiente" justamente por operar sobre janelas curtas. Com o ano inteiro
 * a base de clientes é grande o bastante pra esses números serem estáveis.
 */
export default function InsightsCarteira({ ano, relatorio }: Props) {
  const { dataInicial, dataFinal } = useMemo(() => periodoAno(ano), [ano]);
  const { data: clientes, isLoading: loadingClientes } = trpc.performanceComercial.listarClientesInteligencia.useQuery({ dataInicial, dataFinal });
  const { data: recompra, isLoading: loadingRecompra } = trpc.performanceComercial.getRecompraNovosReativados.useQuery({ dataInicial, dataFinal });

  const mesesCompletos = useMemo(() => relatorio.meses.filter(m => !m.mesParcial), [relatorio.meses]);

  // ─── 1. Resumo executivo ──────────────────────────────────────────────
  const totais = useMemo(() => {
    const investAquis = somarOuNull(mesesCompletos.map(m => m.investimentoAquisicao));
    const investReativ = somarOuNull(mesesCompletos.map(m => m.investimentoReativacao));
    const clientesNovos = mesesCompletos.reduce((s, m) => s + m.novo.qtdClientesUnicos, 0);
    const eventosReativados = mesesCompletos.reduce((s, m) => s + m.reativado.qtdClientesUnicos, 0);
    const margemNovos = mesesCompletos.reduce((s, m) => s + m.novo.margem.margemTotal, 0);
    const margemReativados = mesesCompletos.reduce((s, m) => s + m.reativado.margem.margemTotal, 0);
    return {
      investAquis, investReativ,
      cac: cacPonderado(investAquis, clientesNovos),
      custoReativ: custoReativacaoPonderado(investReativ, eventosReativados),
      eficienciaAquis: investAquis && investAquis > 0 ? margemNovos / investAquis : null,
      eficienciaReativ: investReativ && investReativ > 0 ? margemReativados / investReativ : null,
    };
  }, [mesesCompletos]);

  const indiceRisco = useMemo(() => {
    const lista = clientes ?? [];
    const total = lista.length;
    const emRisco = lista.filter(c => c.classificacao === "reducao_volume" || c.classificacao === "intervalo_acima_habitual").length;
    return { total, emRisco, pct: total > 0 ? (emRisco / total) * 100 : null };
  }, [clientes]);

  // ─── 2. Matriz de saúde da base ───────────────────────────────────────
  const emReducao = useMemo(() => (clientes ?? [])
    .filter(c => c.classificacao === "reducao_volume")
    .sort((a, b) => (a.variacaoVolumePct ?? 0) - (b.variacaoVolumePct ?? 0)),
    [clientes]);

  const emAtraso = useMemo(() => (clientes ?? [])
    .filter(c => c.classificacao === "intervalo_acima_habitual")
    .sort((a, b) => (b.razaoAtraso ?? 0) - (a.razaoAtraso ?? 0)),
    [clientes]);

  const emOnboarding = useMemo(() => (clientes ?? [])
    .filter(c => c.classificacao === "primeira_compra")
    .sort((a, b) => new Date(b.ultimaCompra).getTime() - new Date(a.ultimaCompra).getTime()),
    [clientes]);

  const reducaoPorVendedor = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of emReducao) mapa.set(c.vendedor || "Sem vendedor", (mapa.get(c.vendedor || "Sem vendedor") ?? 0) + 1);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [emReducao]);

  // ─── 3. Diagnóstico de mídia ──────────────────────────────────────────
  const diagnosticoMidia = useMemo(() => {
    type Insight = { tipo: "alerta" | "atencao" | "positivo" | "dica"; texto: string };
    const lista: Insight[] = [];
    const comCac = mesesCompletos.filter(m => m.novo.cacPonderado != null && m.investimentoAquisicao != null);

    // Ponto de saturação: investimento subiu e CAC piorou mais que 15% no mesmo mês
    for (let i = 1; i < comCac.length; i++) {
      const atual = comCac[i], anterior = comCac[i - 1];
      const investSubiu = (atual.investimentoAquisicao ?? 0) > (anterior.investimentoAquisicao ?? 0);
      const cacAnterior = anterior.novo.cacPonderado ?? 0;
      const variacaoCac = cacAnterior > 0 ? ((atual.novo.cacPonderado! - cacAnterior) / cacAnterior) * 100 : 0;
      if (investSubiu && variacaoCac > 15) {
        lista.push({
          tipo: "atencao",
          texto: `O investimento em Aquisição subiu de ${fmtBrl(anterior.investimentoAquisicao)} para ${fmtBrl(atual.investimentoAquisicao)} entre os meses analisados, e o CAC piorou ${variacaoCac.toFixed(0)}% no mesmo intervalo — pode estar associado a um teto de eficiência da mídia atual, não necessariamente falta de demanda.`,
        });
      }
    }

    // Melhor mês de eficiência (menor CAC com clientes novos > 0)
    const melhorMes = comCac.filter(m => m.novo.qtdClientesUnicos > 0).sort((a, b) => (a.novo.cacPonderado ?? Infinity) - (b.novo.cacPonderado ?? Infinity))[0];
    if (melhorMes) {
      lista.push({
        tipo: "dica",
        texto: `O mês com melhor eficiência de aquisição foi o de CAC ${fmtBrl(melhorMes.novo.cacPonderado)} (investimento de ${fmtBrl(melhorMes.investimentoAquisicao)}) — pode servir de referência de verba mensal otimizada, mas vale checar se as condições daquele mês (sazonalidade, campanha específica) se repetem.`,
      });
    }

    // Matriz 75/25
    if (totais.investAquis != null && totais.investReativ != null && (totais.investAquis + totais.investReativ) > 0) {
      const pctAquis = (totais.investAquis / (totais.investAquis + totais.investReativ)) * 100;
      lista.push({
        tipo: "dica",
        texto: `A divisão observada no período foi ${pctAquis.toFixed(0)}% Aquisição / ${(100 - pctAquis).toFixed(0)}% Reativação.` +
          (totais.cac != null && totais.custoReativ != null && totais.custoReativ < totais.cac * 0.7
            ? ` O custo por reativado (${fmtBrl(totais.custoReativ)}) está associado a um valor bem menor que o CAC (${fmtBrl(totais.cac)}) — pode valer testar deslocar parte da verba de Aquisição para Reativação.`
            : ""),
      });
    }

    return lista;
  }, [mesesCompletos, totais]);

  const isLoading = loadingClientes || loadingRecompra;

  return (
    <div className="space-y-6">
      {/* ─── 1. Resumo Executivo ────────────────────────────────────────── */}
      <div>
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
          <div className="w-3 h-0.5 bg-purple-500 rounded" /> Resumo Executivo da Saúde Comercial
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            variant="border" color={COR_POSITIVO} icon={<Sprout size={18} />}
            label="Conversão Novos → Recompra"
            value={recompra?.novos.taxaPct != null ? fmtPct(recompra.novos.taxaPct) : "—"}
            sub={recompra ? `${fmtNum(recompra.novos.comRecompra)} de ${fmtNum(recompra.novos.total)} clientes novos${recompra.novos.total < 20 ? " · amostra pequena" : ""}` : undefined}
            tooltip="% de clientes cuja 1ª compra do período já teve pelo menos uma nova compra até hoje (sem janela fixa de dias). Observacional — não afirma que a recompra foi causada por alguma ação específica."
          />
          <KpiCard
            variant="border" color={indiceRisco.pct != null && indiceRisco.pct > 25 ? COR_ALERTA : COR_ATENCAO} icon={<AlertTriangle size={18} />}
            label="Índice de Risco da Carteira" value={indiceRisco.pct != null ? fmtPct(indiceRisco.pct) : "—"}
            sub={`${fmtNum(indiceRisco.emRisco)} de ${fmtNum(indiceRisco.total)} clientes ativos no ano`}
            tooltip="% da carteira ativa no ano classificada como 'Redução de volume' ou 'Atraso na recompra' — mesmas categorias e limiares da aba Clientes de Inteligência de Clientes."
          />
          <KpiCard
            variant="border" color={COR_AQUISICAO} icon={<Target size={18} />}
            label="CAC vs. Custo de Reativação"
            value={totais.cac != null ? fmtBrl(totais.cac) : "—"}
            sub={totais.custoReativ != null ? `Reativação: ${fmtBrl(totais.custoReativ)}` : undefined}
            tooltip="Custo ponderado (investimento total ÷ clientes) do ano — Aquisição vs. Reativação lado a lado."
          />
          <KpiCard
            variant="border" color="#0d9488" icon={<Percent size={18} />}
            label="Margem por R$ Investido"
            value={totais.eficienciaAquis != null ? `${totais.eficienciaAquis.toFixed(2)}x` : "—"}
            sub={totais.eficienciaReativ != null ? `Reativação: ${totais.eficienciaReativ.toFixed(2)}x` : undefined}
            tooltip="Margem de contribuição gerada por cada R$ 1,00 investido — Aquisição vs. Reativação. Ex.: 2,00x = R$ 2,00 de margem para cada R$ 1,00 investido."
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-10 text-muted-foreground gap-2"><Loader2 size={18} className="animate-spin" /> Calculando classificação da carteira...</div>
      )}

      {!isLoading && (
        <>
          {/* ─── 2. Matriz de Saúde da Base ──────────────────────────────── */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="w-3 h-0.5 bg-amber-500 rounded" /> Matriz de Saúde da Base e Alertas de Retenção
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Alerta amarelo — redução de volume */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-red-700"><TrendingDown size={16} /> Redução de Volume ({fmtNum(emReducao.length)})</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Queda ≥20% no valor comprado vs. o mesmo período anterior. Ação sugerida: abordagem de pós-venda antes de completar 6 meses de inatividade.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {emReducao.slice(0, 5).map(c => (
                    <div key={c.empresaKey} className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate" title={c.empresaExibicao}>{c.empresaExibicao}</div>
                        <div className="text-muted-foreground">{c.vendedor || "Sem vendedor"}</div>
                      </div>
                      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 shrink-0">{c.variacaoVolumePct != null ? fmtPct(c.variacaoVolumePct, 0) : "—"}</Badge>
                    </div>
                  ))}
                  {emReducao.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente nessa categoria no período.</p>}
                  {reducaoPorVendedor.length > 0 && (
                    <div className="pt-2 border-t text-[11px] text-muted-foreground">
                      Por vendedor: {reducaoPorVendedor.map(([v, n]) => `${v} (${n})`).join(" · ")}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Alerta vermelho — atraso */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-amber-700"><Clock3 size={16} /> Atraso na Recompra ({fmtNum(emAtraso.length)})</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Já passou 1,5x ou mais o intervalo mediano de compra do cliente. Pode ser atraso, não é perda confirmada.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {emAtraso.slice(0, 5).map(c => (
                    <div key={c.empresaKey} className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate" title={c.empresaExibicao}>{c.empresaExibicao}</div>
                        <div className="text-muted-foreground">{fmtNum(c.diasDesdeUltimaCompra)} dias sem comprar</div>
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 shrink-0">{c.razaoAtraso != null ? `${c.razaoAtraso.toFixed(1)}x` : "—"}</Badge>
                    </div>
                  ))}
                  {emAtraso.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente nessa categoria no período.</p>}
                </CardContent>
              </Card>

              {/* Oportunidade — onboarding */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2 text-blue-700"><Sprout size={16} /> Onboarding — Primeira Compra ({fmtNum(emOnboarding.length)})</CardTitle>
                  <p className="text-[11px] text-muted-foreground">Ainda não têm 2ª compra registrada. Recomendação: régua de acompanhamento para garantir o 2º pedido.</p>
                </CardHeader>
                <CardContent className="space-y-2">
                  {emOnboarding.slice(0, 5).map(c => (
                    <div key={c.empresaKey} className="flex items-center justify-between text-xs border-b pb-1.5 last:border-0">
                      <div className="min-w-0">
                        <div className="font-medium truncate" title={c.empresaExibicao}>{c.empresaExibicao}</div>
                        <div className="text-muted-foreground">{c.vendedor || "Sem vendedor"}</div>
                      </div>
                      <span className="text-emerald-700 font-medium shrink-0">{fmtBrl(c.valorTotalHistorico)}</span>
                    </div>
                  ))}
                  {emOnboarding.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Nenhum cliente nessa categoria no período.</p>}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── 3. Diagnóstico de Mídia ─────────────────────────────────── */}
          {diagnosticoMidia.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Radio size={17} className="text-purple-600" /> Diagnóstico de Performance de Mídia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {diagnosticoMidia.map((ins, i) => {
                  const estilo = ins.tipo === "alerta" ? { bg: "bg-red-50", border: "border-red-200", text: "text-red-800" }
                    : ins.tipo === "atencao" ? { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" }
                    : ins.tipo === "positivo" ? { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800" }
                    : { bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-800" };
                  return <div key={i} className={`${estilo.bg} border ${estilo.border} rounded-lg p-3 text-xs ${estilo.text}`}>{ins.texto}</div>;
                })}
              </CardContent>
            </Card>
          )}

          {/* ─── 4. Recomendações práticas ───────────────────────────────── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2"><ClipboardList size={17} className="text-slate-600" /> Recomendações — Próximos 30 Dias</CardTitle>
              <p className="text-xs text-muted-foreground">Geradas a partir dos números acima — leitura sugerida, não uma decisão automática.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <Users2 size={15} className="text-red-600 mt-0.5 shrink-0" />
                <span><strong>Comercial:</strong> {emReducao.length > 0
                  ? `Priorizar contato com os ${Math.min(5, emReducao.length)} clientes em maior queda de volume listados acima${reducaoPorVendedor[0] ? ` — ${reducaoPorVendedor[0][0]} concentra o maior número (${reducaoPorVendedor[0][1]})` : ""}.`
                  : "Nenhum cliente em redução de volume relevante no período."}</span>
              </div>
              <div className="flex items-start gap-2">
                <Target size={15} className="text-purple-600 mt-0.5 shrink-0" />
                <span><strong>Marketing:</strong> {totais.cac != null && totais.custoReativ != null && totais.custoReativ < totais.cac * 0.7
                  ? `Considerar realocar parte da verba de Aquisição (CAC ${fmtBrl(totais.cac)}) para Reativação (${fmtBrl(totais.custoReativ)} por cliente) no próximo mês.`
                  : "Manter a divisão atual de verba — não há sinal forte de desequilíbrio entre Aquisição e Reativação."}</span>
              </div>
              <div className="flex items-start gap-2">
                <ShoppingBag size={15} className="text-blue-600 mt-0.5 shrink-0" />
                <span><strong>Processos/CS:</strong> {emOnboarding.length > 0
                  ? `${fmtNum(emOnboarding.length)} cliente(s) aguardando o 2º pedido — acionar régua de acompanhamento para evitar que entrem em inatividade sem uma segunda compra.`
                  : "Nenhum cliente em onboarding pendente no período."}</span>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-[11px] text-slate-500">
            <Info size={12} className="mt-0.5 shrink-0" />
            Classificação calculada sobre {fmtNum(indiceRisco.total)} clientes ativos entre {dataInicial.split("-").reverse().join("/")} e {dataFinal.split("-").reverse().join("/")}, mesma metodologia e limiares da aba "Clientes" de Inteligência de Clientes (categorias: {Object.values(CLASSIFICACAO_INFO).map(c => c.label).join(", ")}).
          </div>
        </>
      )}
    </div>
  );
}
