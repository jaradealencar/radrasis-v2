import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import { Spinner } from "@/components/ui/spinner";
import { Sparkles, Send, Bot, User } from "lucide-react";

interface Mensagem {
  role: "user" | "assistant";
  texto: string;
}

const SUGESTOES = [
  "Como está a margem EBITDA dos últimos meses?",
  "Faça uma análise de variância do trimestre",
  "Quais meses tiveram o pior resultado e por quê?",
];

export default function ChatFinanceiro() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [pergunta, setPergunta] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const perguntarMut = trpc.financeiro.perguntarIA.useMutation({
    onSuccess: (data) => {
      setMensagens(m => [...m, { role: "assistant", texto: data.resposta }]);
    },
    onError: (e) => {
      toast.error("Erro ao consultar a IA: " + e.message);
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [mensagens, perguntarMut.isPending]);

  function enviar(texto: string) {
    const pergunta = texto.trim();
    if (!pergunta || perguntarMut.isPending) return;

    const historico = mensagens;
    setMensagens(m => [...m, { role: "user", texto: pergunta }]);
    setPergunta("");
    perguntarMut.mutate({ pergunta, historico });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      enviar(pergunta);
    }
  }

  return (
    <Card>
      <CardContent className="p-0 flex flex-col h-[70vh]">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Sparkles size={16} className="text-purple-500" />
          <span className="font-semibold text-sm">Assistente Financeiro (CFO virtual)</span>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {mensagens.length === 0 && (
            <div className="text-sm text-muted-foreground space-y-3">
              <p>Pergunte sobre faturamento, despesas, margens, EBITDA, tendências ou peça análises (variância, cenários, projeções) sobre os dados do Painel Financeiro.</p>
              <div className="flex flex-col gap-2 items-start">
                {SUGESTOES.map(s => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="text-xs text-left px-3 py-1.5 rounded-full border bg-muted/40 hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mensagens.map((m, i) => (
            <div key={i} className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Bot size={14} />
                </div>
              )}
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === "user" ? "bg-emerald-600 text-white" : "bg-muted"
              }`}>
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <Streamdown>{m.texto}</Streamdown>
                  </div>
                ) : m.texto}
              </div>
              {m.role === "user" && (
                <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <User size={14} />
                </div>
              )}
            </div>
          ))}

          {perguntarMut.isPending && (
            <div className="flex gap-2 justify-start">
              <div className="h-7 w-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2 text-muted-foreground">
                <Spinner className="h-3.5 w-3.5" /> Analisando...
              </div>
            </div>
          )}
        </div>

        <div className="border-t p-3 flex gap-2 items-end">
          <Textarea
            value={pergunta}
            onChange={e => setPergunta(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre seus dados financeiros..."
            className="min-h-[44px] max-h-32 resize-none text-sm"
            disabled={perguntarMut.isPending}
          />
          <Button
            size="sm"
            className="h-[44px] gap-1.5"
            onClick={() => enviar(pergunta)}
            disabled={perguntarMut.isPending || !pergunta.trim()}
          >
            <Send size={14} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
