import { trpc } from "@/lib/trpc";
import DashboardLayout from "../../components/DashboardLayout";
import { useState } from "react";
import FilterBar, { FilterState } from "@/components/FilterBar";
import { Brain, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Streamdown } from "streamdown";

const INFO_CARDS = [
  { icon: "📊", title: "Diagnóstico Geral", desc: "Análise crítica dos padrões identificados nos dados de retrabalho" },
  { icon: "🎯", title: "Problemas Críticos", desc: "Top 3 problemas mais urgentes com maior impacto financeiro" },
  { icon: "💬", title: "Relatos dos Operadores", desc: "Padrões identificados nas descrições do ocorrido registradas" },
  { icon: "🔧", title: "Plano de Ação", desc: "5 ações concretas e implementáveis imediatamente na produção" },
];

export default function Insights() {
  const [filter, setFilter] = useState<FilterState>({});
  const [content, setContent] = useState<string>("");
  const [generated, setGenerated] = useState(false);

  const generateMut = trpc.insights.generate.useMutation({
    onSuccess: (data) => {
      setContent(typeof data.content === "string" ? data.content : "");
      setGenerated(true);
    },
    onError: (e) => {
      setContent(`Erro ao gerar insights: ${e.message}`);
    },
  });

  const handleGenerate = () => {
    setContent("");
    setGenerated(false);
    generateMut.mutate(filter);
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-purple-600 mb-0.5">Inteligência Artificial</p>
          <h1 className="text-2xl font-bold text-slate-800">Insights por IA</h1>
          <p className="text-sm mt-0.5 text-slate-500">
            Análise automática dos padrões de retrabalho com recomendações de melhoria
          </p>
        </div>

        <FilterBar filter={filter} onChange={setFilter} />

        {/* Generate button */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-lg shrink-0 bg-purple-50">
              <Sparkles className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800 mb-1">Análise Inteligente de Retrabalhos</h3>
              <p className="text-sm mb-4 text-slate-500">
                O sistema irá analisar todos os dados de retrabalho registrados (KPIs, setores, erros, responsáveis, reincidências e{" "}
                <strong className="text-slate-700">descrições do ocorrido</strong> relatadas pelos operadores)
                e gerar um diagnóstico completo com plano de ação prioritário e metas sugeridas.
              </p>
              <Button onClick={handleGenerate} disabled={generateMut.isPending} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                {generateMut.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Analisando dados...</>
                ) : generated ? (
                  <><RefreshCw className="w-4 h-4" />Regenerar Insights</>
                ) : (
                  <><Brain className="w-4 h-4" />Gerar Insights com IA</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {generateMut.isPending && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-2 animate-spin border-purple-200 border-t-purple-600" />
                <Brain className="w-6 h-6 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-purple-600" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 mb-1">Analisando padrões de retrabalho...</p>
                <p className="text-sm text-slate-500">
                  Processando KPIs, erros, reincidências, descrições do ocorrido e histórico de custos
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {content && !generateMut.isPending && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-purple-100 bg-purple-50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold uppercase tracking-widest text-purple-700">
                  Análise Gerada pela IA
                </span>
              </div>
              <span className="text-xs text-slate-400">
                {new Date().toLocaleDateString("pt-BR")}{" "}
                {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <div className="p-6">
              <div className="prose prose-slate prose-sm max-w-none">
                <Streamdown>{content}</Streamdown>
              </div>
            </div>
          </div>
        )}

        {/* Info cards */}
        {!content && !generateMut.isPending && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {INFO_CARDS.map((item, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 text-center">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h4 className="font-semibold text-slate-800 text-sm mb-1">{item.title}</h4>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
