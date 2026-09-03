import { trpc } from "@/lib/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { toast } from "sonner";
import {
  Lightbulb, CheckCircle, XCircle, Clock, User, MessageSquare, ChevronDown, ChevronUp, Sparkles
} from "lucide-react";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pendente: { label: "Pendente", color: "#b45309", bg: "#fef3c7" },
  aprovado: { label: "Aprovado", color: "#166534", bg: "#dcfce7" },
  rejeitado: { label: "Rejeitado", color: "#991b1b", bg: "#fee2e2" },
};

export default function SugestoesConhecimento() {
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [observacao, setObservacao] = useState<Record<number, string>>({});

  const { user } = useAuth();
  const isMaster = user?.role === "master" || user?.role === "admin";

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.knowledgeSuggestions.list.useQuery(
    { status: statusFilter || undefined },
    { refetchInterval: 15000 }
  );

  const approveMut = trpc.knowledgeSuggestions.approve.useMutation({
    onSuccess: () => {
      toast.success("Artigo incorporado à Base de Conhecimento!");
      utils.knowledgeSuggestions.list.invalidate();
      utils.knowledge.list.invalidate();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao aprovar."),
  });

  const rejectMut = trpc.knowledgeSuggestions.reject.useMutation({
    onSuccess: () => { toast.success("Sugestão rejeitada."); utils.knowledgeSuggestions.list.invalidate(); },
    onError: (e: any) => toast.error(e.message || "Erro ao rejeitar."),
  });

  const suggestions = data ?? [];

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <Lightbulb size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Sugestões de Conhecimento</h1>
            <p className="text-sm text-gray-500">Sugestões de incorporação geradas pelo Gemini ou enviadas por usuários</p>
          </div>
        </div>
      </div>

      {/* Filtro de status */}
      <div className="flex gap-2 mb-5">
        {["", "pendente", "aprovado", "rejeitado"].map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors"
            style={statusFilter === s
              ? { background: "oklch(0.52 0.18 240)", color: "white", borderColor: "oklch(0.52 0.18 240)" }
              : { background: "white", color: "#374151", borderColor: "#e5e7eb" }
            }
          >
            {s === "" ? "Todas" : STATUS_LABELS[s]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : suggestions.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><Lightbulb /></EmptyMedia>
            <EmptyTitle>Nenhuma sugestão encontrada.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s: any) => {
            const st = STATUS_LABELS[s.status] ?? STATUS_LABELS.pendente;
            const isExpanded = expandedId === s.id;
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Header do card */}
                <div
                  className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                >
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Sparkles size={14} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{s.tituloSugerido || s.pergunta}</p>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}
                      >
                        {st.label}
                      </span>
                      {s.categoriaSugerida && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{s.categoriaSugerida}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User size={11} /> {s.sugeridoPorNome || "Usuário"}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock size={11} /> {new Date(s.criadoEm).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </div>

                {/* Conteúdo expandido */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {/* Pergunta original */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Pergunta original</p>
                      <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{s.pergunta}</p>
                    </div>

                    {/* Conteúdo sugerido */}
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Conteúdo sugerido</p>
                      <p className="text-sm text-gray-700 bg-green-50 rounded-lg p-3 whitespace-pre-wrap border border-green-100">{s.conteudoSugerido}</p>
                    </div>

                    {/* Observação do master (se rejeitado) */}
                    {s.observacaoMaster && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Observação do master</p>
                        <p className="text-sm text-gray-700 bg-red-50 rounded-lg p-3 border border-red-100">{s.observacaoMaster}</p>
                      </div>
                    )}

                    {/* Ações do master */}
                    {isMaster && s.status === "pendente" && (
                      <div className="flex flex-col gap-2">
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Observação (opcional)</label>
                          <input
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                            placeholder="Observação para o usuário..."
                            value={observacao[s.id] ?? ""}
                            onChange={e => setObservacao(prev => ({ ...prev, [s.id]: e.target.value }))}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveMut.mutate({
                              id: s.id,
                              titulo: s.tituloSugerido || s.pergunta,
                              categoria: s.categoriaSugerida || "Geral",
                              conteudo: s.conteudoSugerido,
                              observacao: observacao[s.id],
                            })}
                            disabled={approveMut.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle size={14} />
                            {approveMut.isPending ? "Incorporando..." : "Incorporar na Base"}
                          </button>
                          <button
                            onClick={() => rejectMut.mutate({ id: s.id, observacao: observacao[s.id] })}
                            disabled={rejectMut.isPending}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
                          >
                            <XCircle size={14} />
                            {rejectMut.isPending ? "Rejeitando..." : "Rejeitar"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Mensagem para não-master */}
                    {!isMaster && s.status === "pendente" && (
                      <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                        <MessageSquare size={13} />
                        Aguardando revisão do master.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
