import { useEffect, useRef, useState, type ReactNode } from "react";
import { Send, Sparkles, Trash2, Loader2 } from "lucide-react";
import type { MensagemConsultor } from "./tipos";

const SUGESTOES = [
  "Por onde eu começo para chegar na minha meta?",
  "Explique em palavras simples o que é taxa de conversão e quantos orçamentos por semana eu preciso enviar.",
  "O que acontece se eu conseguir 50 gráficas novas por mês?",
  "Qual vendedor devo treinar primeiro e como?",
  "Vale a pena investir mais em marketing para trazer gráficas novas?",
  "Monte meu plano da próxima semana.",
];

/** Negrito **assim** dentro de uma linha (só React nodes — nada de HTML vindo da IA). */
function comNegrito(linha: string): ReactNode[] {
  return linha.split(/(\*\*[^*]+\*\*)/g).map((parte, i) =>
    parte.startsWith("**") && parte.endsWith("**") && parte.length > 4
      ? <strong key={i} className="font-semibold text-slate-900">{parte.slice(2, -2)}</strong>
      : <span key={i}>{parte}</span>,
  );
}

/** Mini formatador seguro: parágrafos, listas com "-" e itens numerados, títulos e negrito. */
export function TextoFormatado({ texto }: { texto: string }) {
  const blocos: ReactNode[] = [];
  let lista: string[] = [];
  const fecharLista = () => {
    if (lista.length === 0) return;
    blocos.push(
      <ul key={`ul${blocos.length}`} className="list-disc pl-5 space-y-0.5">
        {lista.map((item, i) => <li key={i}>{comNegrito(item)}</li>)}
      </ul>,
    );
    lista = [];
  };
  texto.split("\n").forEach((bruta, idx) => {
    const linha = bruta.trimEnd();
    const item = linha.match(/^\s*[-*•]\s+(.*)$/);
    if (item) { lista.push(item[1]); return; }
    fecharLista();
    if (linha.trim() === "") return;
    const titulo = linha.match(/^#{1,4}\s+(.*)$/);
    if (titulo) { blocos.push(<p key={idx} className="font-semibold text-slate-900">{comNegrito(titulo[1])}</p>); return; }
    const numerado = linha.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (numerado) { blocos.push(<p key={idx} className="pl-1"><span className="font-semibold text-blue-700">{numerado[1]}.</span> {comNegrito(numerado[2])}</p>); return; }
    blocos.push(<p key={idx}>{comNegrito(linha)}</p>);
  });
  fecharLista();
  return <div className="space-y-2 leading-relaxed">{blocos}</div>;
}

export default function Consultor({ mensagens, pendente, erro, onEnviar, onLimpar }: {
  mensagens: MensagemConsultor[];
  pendente: boolean;
  erro: string | null;
  onEnviar: (texto: string) => void;
  onLimpar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);

  useEffect(() => { fim.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [mensagens.length, pendente]);

  const enviar = (t: string) => {
    if (!t.trim() || pendente) return;
    onEnviar(t);
    setTexto("");
  };

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-900 flex items-start gap-2">
        <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p><strong>Seu consultor de crescimento (IA).</strong> Ele lê todos os números deste painel — inclusive o cenário que você montou no Simulador — e conversa com você em português simples: explica o que cada indicador significa, sugere prioridades e o que fazer esta semana.</p>
          <p>Ele só usa os números calculados aqui e não responde sobre outros assuntos. Pode errar: confira valores importantes nas abas 1 a 5. Cada pergunta usa a chave de IA do servidor (limite de 40 perguntas por hora).</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SUGESTOES.map(s => (
          <button
            key={s}
            type="button"
            disabled={pendente}
            onClick={() => enviar(s)}
            className="text-xs px-3 py-1.5 bg-white border border-slate-200 rounded-full text-slate-600 hover:border-purple-300 hover:text-purple-700 disabled:opacity-50 text-left"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {mensagens.map((m, i) => (
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-blue-600 text-white rounded-2xl rounded-br-sm px-3.5 py-2 text-sm max-w-[85%] whitespace-pre-wrap">{m.texto}</div>
            </div>
          ) : (
            <div key={i} className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-700 max-w-[92%] shadow-sm">
                <TextoFormatado texto={m.texto} />
                {m.provedor && <p className="text-[11px] text-slate-400 mt-2">Respondido por {m.provedor}{m.modelo ? ` (${m.modelo})` : ""}</p>}
              </div>
            </div>
          )
        ))}
        {pendente && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Analisando os números… (costuma levar de 10 a 20 segundos)
            </div>
          </div>
        )}
        {erro && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800">{erro}</div>}
        <div ref={fim} />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-end gap-2 sticky bottom-2">
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(texto); } }}
          rows={2}
          maxLength={1500}
          placeholder="Pergunte sobre suas metas, orçamentos, gráficas, vendedores… (Enter envia, Shift+Enter quebra a linha)"
          aria-label="Pergunta para o consultor"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-purple-300 resize-none"
        />
        <button
          type="button"
          onClick={() => enviar(texto)}
          disabled={pendente || !texto.trim()}
          aria-label="Enviar pergunta"
          className="p-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg"
        >
          <Send className="w-4 h-4" />
        </button>
        {mensagens.length > 0 && (
          <button
            type="button"
            onClick={onLimpar}
            disabled={pendente}
            title="Apagar a conversa"
            aria-label="Limpar conversa"
            className="p-2.5 border border-slate-200 text-slate-500 hover:text-red-600 rounded-lg disabled:opacity-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
