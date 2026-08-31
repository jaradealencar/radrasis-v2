import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Streamdown } from "streamdown";
import PageHeader from "@/components/PageHeader";
import { STATUS_COLORS } from "@/lib/chartColors";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  Brain, Sparkles, ChevronLeft, ChevronRight, AlertTriangle, Send,
  Users, UserPlus, TrendingUp, Percent,
} from "lucide-react";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface RespostaIA {
  id: string;
  titulo: string;
  texto: string;
  timestamp: Date;
}

export default function InsightsIA() {
  const hoje = new Date();
  const [mesSel, setMesSel] = useState(hoje.getMonth() + 1);
  const [anoSel, setAnoSel] = useState(hoje.getFullYear());
  const [perguntaLivre, setPerguntaLivre] = useState("");
  const [respostas, setRespostas] = useState<RespostaIA[]>([]);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  function irParaMesAnterior() {
    if (mesSel <= 1) { setMesSel(12); setAnoSel(a => a - 1); }
    else setMesSel(m => m - 1);
  }
  function irParaProximoMes() {
    if (mesSel >= 12) { setMesSel(1); setAnoSel(a => a + 1); }
    else setMesSel(m => m + 1);
  }

  const diagnosticoMut = trpc.insightsComerciais.gerarDiagnostico.useMutation();
  const perguntarMut = trpc.insightsComerciais.perguntar.useMutation();
  const carregando = diagnosticoMut.isPending || perguntarMut.isPending;

  async function handleGerarDiagnostico() {
    setErroMsg(null);
    try {
      const resultado = await diagnosticoMut.mutateAsync({ mes: mesSel, ano: anoSel });
      setRespostas(prev => [{
        id: Date.now().toString(),
        titulo: `Diagnóstico Completo — ${MESES[mesSel - 1]}/${anoSel}`,
        texto: resultado.analise,
        timestamp: new Date(),
      }, ...prev]);
    } catch (e: any) {
      setErroMsg(e.message || "Erro ao gerar diagnóstico. Tente novamente.");
    }
  }

  async function handlePerguntar() {
    if (!perguntaLivre.trim() || carregando) return;
    setErroMsg(null);
    const pergunta = perguntaLivre;
    try {
      const resultado = await perguntarMut.mutateAsync({ mes: mesSel, ano: anoSel, pergunta });
      setRespostas(prev => [{
        id: Date.now().toString(),
        titulo: pergunta,
        texto: resultado.resposta,
        timestamp: new Date(),
      }, ...prev]);
      setPerguntaLivre("");
    } catch (e: any) {
      setErroMsg(e.message || "Erro ao consultar a IA. Tente novamente.");
    }
  }

  const resumo = diagnosticoMut.data?.resumo;

  return (
    <>
      <PageHeader
        title="Insights de IA — Comercial"
        description="Análise de performance comercial e financeira com dicas para vender mais e lucrar mais"
        icon={Brain}
        iconColor={STATUS_COLORS.destaque}
        actions={
          <Badge variant="outline" className="flex items-center gap-1.5 text-purple-700 border-purple-200 bg-purple-50">
            <Sparkles size={12} />
            Gerado por IA
          </Badge>
        }
        className="mb-6"
      />

      {/* Seletor de mês */}
      <div className="flex items-center gap-3 flex-wrap mb-6">
        <Button variant="outline" size="sm" onClick={irParaMesAnterior}>
          <ChevronLeft size={14} />
        </Button>
        <h2 className="text-lg font-semibold min-w-[180px] text-center">
          {MESES[mesSel - 1]} / {anoSel}
        </h2>
        <Button variant="outline" size="sm" onClick={irParaProximoMes}>
          <ChevronRight size={14} />
        </Button>
        <div className="flex-1" />
        <Button
          onClick={handleGerarDiagnostico}
          disabled={carregando}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
        >
          {diagnosticoMut.isPending ? <Spinner className="size-4 mr-1.5" /> : <Sparkles size={16} className="mr-1.5" />}
          {diagnosticoMut.isPending ? "Analisando..." : "Gerar Diagnóstico Completo"}
        </Button>
      </div>

      {/* Resumo dos dados usados na última análise */}
      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <TrendingUp size={14} className="text-blue-500" /> Faturamento
              </div>
              <p className="text-lg font-bold text-slate-800">{fmtR(resumo.faturamento)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{resumo.totalOs} OS · margem {resumo.margemPct.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Percent size={14} className="text-purple-500" /> Conversão
              </div>
              <p className="text-lg font-bold text-slate-800">{resumo.taxaConversao.toFixed(1)}%</p>
              <p className="text-xs text-muted-foreground mt-0.5">{resumo.totalOrcamentos} orçamentos</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users size={14} className="text-green-500" /> Clientes Únicos
              </div>
              <p className="text-lg font-bold text-slate-800">{resumo.clientesUnicos}</p>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <UserPlus size={14} className="text-amber-500" /> Novos/Reativados
              </div>
              <p className="text-lg font-bold text-slate-800">{resumo.clientesNovos}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pergunta livre */}
      <Card className="mb-6 border-purple-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} className="text-purple-500" />
            Pergunta Livre sobre {MESES[mesSel - 1]}/{anoSel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              value={perguntaLivre}
              onChange={e => setPerguntaLivre(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handlePerguntar()}
              placeholder="Ex: Por que a margem caiu esse mês? Qual vendedor precisa de mais atenção?"
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              disabled={carregando}
            />
            <Button
              onClick={handlePerguntar}
              disabled={carregando || !perguntaLivre.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5"
            >
              {perguntarMut.isPending ? <Spinner className="size-4" /> : <Send size={16} />}
            </Button>
          </div>
          {erroMsg && (
            <p className="mt-2 text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle size={14} />
              {erroMsg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Carregando */}
      {carregando && (
        <Card className="mb-4 border-purple-100 bg-purple-50/50">
          <CardContent className="py-6">
            <div className="flex items-center gap-3 text-purple-700">
              <Spinner className="size-5" />
              <span className="text-sm font-medium">Analisando performance comercial e financeira de {MESES[mesSel - 1]}/{anoSel}...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Respostas */}
      {respostas.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Análises Realizadas</h2>
          {respostas.map(r => (
            <Card key={r.id} className="border-slate-200 overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-700 line-clamp-2">{r.titulo}</p>
                <span className="text-xs text-slate-400 shrink-0">
                  {r.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "oklch(0.45 0.22 280 / 0.1)" }}>
                    <Brain size={14} style={{ color: "oklch(0.45 0.22 280)" }} />
                  </div>
                  <div className="flex-1 text-sm text-slate-700 prose prose-sm max-w-none">
                    <Streamdown>{r.texto}</Streamdown>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {respostas.length === 0 && !carregando && (
        <Card className="border-dashed border-slate-200">
          <CardContent className="py-12">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><Brain /></EmptyMedia>
                <EmptyTitle>Nenhuma análise gerada ainda</EmptyTitle>
                <EmptyDescription>Clique em "Gerar Diagnóstico Completo" ou faça uma pergunta livre acima</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}
    </>
  );
}
