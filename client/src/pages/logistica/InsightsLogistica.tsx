import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, Sparkles, TrendingUp, Package, Truck, AlertTriangle, RefreshCw, ChevronRight, BarChart2 } from "lucide-react";
import { Streamdown } from "streamdown";

const ANALISES_PREDEFINIDAS = [
  { id: "eficiencia", label: "Eficiência de Entregas", icon: <Truck size={16} />, prompt: "Analise a eficiência das entregas da logística da empresa Letreiros Express. Avalie prazos, transportadoras com melhor e pior desempenho, e dê recomendações práticas para melhorar a assertividade." },
  { id: "custos", label: "Análise de Custos de Frete", icon: <BarChart2 size={16} />, prompt: "Analise os custos de frete da empresa Letreiros Express. Identifique oportunidades de redução de custos, compare transportadoras e sugira estratégias de negociação." },
  { id: "embalagem", label: "Otimização de Embalagem", icon: <Package size={16} />, prompt: "Analise o processo de empacotamento e embalagem da Letreiros Express. Identifique riscos de avaria, sugira melhorias no processo e como reduzir retrabalhos causados por problemas de embalagem." },
  { id: "riscos", label: "Riscos Operacionais", icon: <AlertTriangle size={16} />, prompt: "Identifique os principais riscos operacionais na logística da Letreiros Express. Considere avarias, atrasos, retrabalhos de expedição e proponha um plano de mitigação." },
  { id: "tendencias", label: "Tendências e Oportunidades", icon: <TrendingUp size={16} />, prompt: "Analise as tendências do setor de logística para empresas de letreiros e sinalização. Identifique oportunidades de melhoria e inovação que a Letreiros Express pode implementar." },
];

interface MensagemIA {
  id: string;
  pergunta: string;
  resposta: string;
  timestamp: Date;
  tipo: "predefinida" | "livre";
}

export default function InsightsLogistica() {
  const [perguntaLivre, setPerguntaLivre] = useState("");
  const [historico, setHistorico] = useState<MensagemIA[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erroMsg, setErroMsg] = useState<string | null>(null);

  // Dados de logística para contexto (usando cotações de frete como proxy)
  const dashboardData = null;
  const askAI = trpc.knowledge.askAI.useMutation();

  async function fazerPergunta(pergunta: string, tipo: "predefinida" | "livre") {
    if (!pergunta.trim() || carregando) return;
    setCarregando(true);
    setErroMsg(null);
    try {
      // Monta contexto de logística se disponível
      let contextoLogistica = "";
      if (dashboardData) {
        const d = dashboardData as any;
        contextoLogistica = `\n\nContexto atual da logística da empresa:
- Total de solicitações de frete: ${d.totalSolicitacoes ?? "N/D"}
- Solicitações pendentes: ${d.pendentes ?? "N/D"}
- Solicitações aprovadas: ${d.aprovadas ?? "N/D"}
- Transportadoras cadastradas: ${d.totalTransportadoras ?? "N/D"}
- Cotações realizadas este mês: ${d.cotacoesMes ?? "N/D"}`;
      }

      const perguntaCompleta = `${pergunta}${contextoLogistica}`;
      const resultado = await askAI.mutateAsync({ question: perguntaCompleta });
      const novaMensagem: MensagemIA = {
        id: Date.now().toString(),
        pergunta,
        resposta: resultado.geminiAnswer,
        timestamp: new Date(),
        tipo,
      };
      setHistorico(prev => [novaMensagem, ...prev]);
      if (tipo === "livre") setPerguntaLivre("");
    } catch (e: any) {
      setErroMsg(e.message || "Erro ao consultar a IA. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "oklch(0.45 0.22 280 / 0.12)" }}>
            <Brain size={20} style={{ color: "oklch(0.45 0.22 280)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Insights de IA — Logística</h1>
            <p className="text-sm text-slate-500">Análises inteligentes do setor de logística com Gemini AI</p>
          </div>
        </div>
        <Badge variant="outline" className="flex items-center gap-1.5 text-purple-700 border-purple-200 bg-purple-50">
          <Sparkles size={12} />
          Powered by Gemini
        </Badge>
      </div>

      {/* Análises Predefinidas */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Análises Rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {ANALISES_PREDEFINIDAS.map(analise => (
            <button
              key={analise.id}
              onClick={() => fazerPergunta(analise.prompt, "predefinida")}
              disabled={carregando}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <span className="text-purple-600 group-hover:scale-110 transition-transform">{analise.icon}</span>
              <span className="text-sm font-medium text-slate-700">{analise.label}</span>
              <ChevronRight size={14} className="ml-auto text-slate-400 group-hover:text-purple-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Pergunta Livre */}
      <Card className="mb-6 border-purple-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={16} className="text-purple-500" />
            Pergunta Livre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <input
              type="text"
              value={perguntaLivre}
              onChange={e => setPerguntaLivre(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fazerPergunta(perguntaLivre, "livre")}
              placeholder="Ex: Como reduzir o prazo médio de entrega? Quais transportadoras têm melhor custo-benefício?"
              className="flex-1 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
              disabled={carregando}
            />
            <Button
              onClick={() => fazerPergunta(perguntaLivre, "livre")}
              disabled={carregando || !perguntaLivre.trim()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-5"
            >
              {carregando ? <RefreshCw size={16} className="animate-spin" /> : <Brain size={16} />}
              {carregando ? "Analisando..." : "Analisar"}
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
              <RefreshCw size={18} className="animate-spin" />
              <span className="text-sm font-medium">Gemini está analisando os dados de logística...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Histórico de Respostas */}
      {historico.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Análises Realizadas</h2>
          {historico.map(msg => (
            <Card key={msg.id} className="border-slate-200 overflow-hidden">
              {/* Pergunta */}
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className={`mt-0.5 text-xs shrink-0 ${msg.tipo === "predefinida" ? "border-purple-200 text-purple-700 bg-purple-50" : "border-blue-200 text-blue-700 bg-blue-50"}`}>
                    {msg.tipo === "predefinida" ? "Análise Rápida" : "Pergunta Livre"}
                  </Badge>
                  <p className="text-sm font-medium text-slate-700 line-clamp-2">{msg.pergunta.split('\n\n')[0]}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">
                  {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {/* Resposta */}
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ background: "oklch(0.45 0.22 280 / 0.1)" }}>
                    <Brain size={14} style={{ color: "oklch(0.45 0.22 280)" }} />
                  </div>
                  <div className="flex-1 text-sm text-slate-700 prose prose-sm max-w-none">
                    <Streamdown>{msg.resposta}</Streamdown>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Estado vazio */}
      {historico.length === 0 && !carregando && (
        <Card className="border-dashed border-slate-200">
          <CardContent className="py-12 text-center">
            <Brain size={40} className="mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500 font-medium">Nenhuma análise realizada ainda</p>
            <p className="text-sm text-slate-400 mt-1">Clique em uma análise rápida ou faça uma pergunta livre acima</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
}
