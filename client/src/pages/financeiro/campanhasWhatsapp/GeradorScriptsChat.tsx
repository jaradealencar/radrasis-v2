import { useState, useRef, useEffect } from "react";
import { Send, Copy, Check, MessageSquareText, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface Mensagem {
  role: "user" | "assistant";
  conteudo: string;
  timestamp: number;
}

interface ScriptGerado {
  titulo: string;
  conteudo: string;
}

export default function GeradorScriptsChat() {
  const [aberto, setAberto] = useState(false);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [entrada, setEntrada] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [scriptCopiado, setScriptCopiado] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gerarScript = trpc.campanhasWhatsapp.gerarScriptComIA.useMutation();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [mensagens]);

  const handleEnviar = async () => {
    if (!entrada.trim() || carregando) return;

    const mensagemUsuario: Mensagem = {
      role: "user",
      conteudo: entrada,
      timestamp: Date.now(),
    };
    setMensagens(prev => [...prev, mensagemUsuario]);
    setEntrada("");
    setCarregando(true);

    try {
      const resultado = await gerarScript.mutateAsync({
        descricao: entrada,
        contextoMensagens: mensagens.map(m => ({ role: m.role, content: m.conteudo })),
      });

      const conteudoResposta = typeof resultado.resposta === 'string' ? resultado.resposta : String(resultado.resposta);
      const mensagemAssistente: Mensagem = {
        role: "assistant",
        conteudo: conteudoResposta,
        timestamp: Date.now(),
      };
      setMensagens(prev => [...prev, mensagemAssistente]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao gerar script");
    } finally {
      setCarregando(false);
    }
  };

  const copiarScript = (conteudo: string, index: number) => {
    navigator.clipboard.writeText(conteudo);
    setScriptCopiado(index);
    toast.success("Script copiado!");
    setTimeout(() => setScriptCopiado(null), 2000);
  };

  const extrairScripts = (texto: string): ScriptGerado[] => {
    const scripts: ScriptGerado[] = [];
    const regex = /(?:Script|Opção|Sugestão)\s*(?:\d+)?:?\s*([^\n]+)?\n([\s\S]*?)(?=(?:Script|Opção|Sugestão)\s*\d+|$)/gi;
    let match;
    while ((match = regex.exec(texto)) !== null) {
      const titulo = (match[1] || "Script").trim();
      const conteudo = match[2].trim();
      if (conteudo) scripts.push({ titulo, conteudo });
    }
    return scripts.length > 0 ? scripts : [];
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <MessageSquareText size={14} /> Gerar com IA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Gerador de Scripts com IA</DialogTitle>
          <DialogDescription>Descreva o tipo de mensagem que você precisa. A IA vai sugerir scripts prontos.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto border rounded-lg bg-gray-50 p-4 space-y-3" ref={containerRef}>
          {mensagens.length === 0 && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
              <p>Comece a conversa descrevendo a campanha, o objetivo, o tom e o tipo de mensagem desejada. A IA vai sugerir 2-3 scripts prontos para copiar.</p>
            </div>
          )}
          {mensagens.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg whitespace-pre-wrap text-sm ${
                  msg.role === "user"
                    ? "bg-blue-500 text-white rounded-br-none"
                    : "bg-white border text-gray-900 rounded-bl-none"
                }`}
              >
                {msg.conteudo}
              </div>
            </div>
          ))}
          {carregando && (
            <div className="flex justify-start">
              <div className="bg-white border rounded-lg rounded-bl-none px-3 py-2 flex items-center gap-2">
                <Spinner className="size-4" />
                <span className="text-sm text-muted-foreground">Gerando...</span>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 border-t pt-4">
          {mensagens.length > 0 && (
            <>
              {extrairScripts(mensagens[mensagens.length - 1]?.conteudo || "").length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-600">Scripts sugeridos:</p>
                  {extrairScripts(mensagens[mensagens.length - 1]?.conteudo || "").map((script, idx) => (
                    <div key={idx} className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-blue-900">{script.titulo}</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => copiarScript(script.conteudo, idx)}
                        >
                          {scriptCopiado === idx ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed">{script.conteudo}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Descreva o tipo de mensagem, contexto da campanha, tom..."
              value={entrada}
              onChange={e => setEntrada(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && handleEnviar()}
              disabled={carregando}
              className="text-sm"
            />
            <Button
              onClick={handleEnviar}
              disabled={carregando || !entrada.trim()}
              size="sm"
              className="px-3"
            >
              <Send size={16} />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">💡 Dica: descreva a campanha, tipo de cliente, objetivo, tom e linguagem desejados.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
