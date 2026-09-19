import { useState, type ReactNode } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { substituirVariaveis } from "@/components/ScriptsFaixaPopover";
import { linkWhatsAppComTexto } from "@/lib/faixasCrm";

/** Mesmos grupos de mensagens do painel de scripts do CRM (crm.listScripts): 0 = pós-orçamento,
 * 1/2/3 = faixas de follow-up, 11/12/13 = situação da resposta, 20 = objeções de preço. */
export type GrupoScripts = 0 | 1 | 2 | 3 | 11 | 12 | 13 | 20;

const GRUPOS: Array<{ faixa: GrupoScripts; rotulo: string }> = [
  { faixa: 0, rotulo: "Pós-orçamento" },
  { faixa: 1, rotulo: "Faixa 1" },
  { faixa: 2, rotulo: "Faixa 2" },
  { faixa: 3, rotulo: "Faixa 3" },
  { faixa: 11, rotulo: "Não retornou" },
  { faixa: 12, rotulo: "Esperando cliente" },
  { faixa: 13, rotulo: "Garantiu fechamento" },
  { faixa: 20, rotulo: "Objeções de preço" },
];

interface Props {
  /** https://wa.me/<número> do contato (sem texto) */
  link: string;
  /** Grupo de mensagens que abre selecionado (a faixa em que a proposta está hoje) */
  faixaSugerida: GrupoScripts;
  /** Rótulos das faixas 1/2/3 com os dias configurados (ex.: "Faixa 1 (1-2 du)") */
  rotulosFaixa?: Partial<Record<1 | 2 | 3, string>>;
  /** Nome mostrado no topo (contato ou empresa) */
  titulo?: string;
  // Dados da proposta para preencher {nome_cliente}, {produto}, {valor} e {vendedor}
  nomeCliente?: string;
  produto?: string;
  valor?: string;
  vendedor?: string;
  /** O botão/ícone que abre o seletor */
  children: ReactNode;
}

/**
 * Botão de WhatsApp com escolha da mensagem: ao clicar, lista as mensagens (scripts) do grupo
 * sugerido para o momento da proposta — com botões para trocar de grupo — e o clique numa delas
 * abre a conversa do WhatsApp já com o texto digitado e as variáveis preenchidas. Evita o
 * caminho antigo: copiar a mensagem no painel, abrir o WhatsApp e colar.
 */
export function WhatsAppScriptsPopover({
  link, faixaSugerida, rotulosFaixa, titulo, nomeCliente, produto, valor, vendedor, children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [grupo, setGrupo] = useState<GrupoScripts>(faixaSugerida);

  const { data: scripts, isLoading } = trpc.crm.listScripts.useQuery(
    { faixa: grupo },
    { enabled: open, staleTime: 5 * 60 * 1000 },
  );
  const incrementCopia = trpc.crm.incrementCopiaCount.useMutation();
  const vars = { nomeCliente, produto, valor, vendedor };

  const rotuloDe = (faixa: GrupoScripts, padrao: string) =>
    (faixa === 1 || faixa === 2 || faixa === 3 ? rotulosFaixa?.[faixa] : undefined) ?? padrao;

  function aoAbrir(aberto: boolean) {
    setOpen(aberto);
    if (aberto) setGrupo(faixaSugerida); // sempre abre na faixa sugerida do momento
  }

  function enviar(script: { id: number; conteudo: string }) {
    const texto = substituirVariaveis(script.conteudo, vars);
    window.open(linkWhatsAppComTexto(link, texto), "_blank", "noopener,noreferrer");
    incrementCopia.mutate({ id: script.id }); // conta como uso da mensagem, igual a "Copiar"
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={aoAbrir}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-[420px] p-0 overflow-hidden"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
      >
        <div className="border-b bg-green-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm font-bold text-green-800">
            <MessageCircle className="h-4 w-4" />
            Enviar por WhatsApp{titulo ? ` — ${titulo}` : ""}
          </div>
          <p className="mt-0.5 text-[11px] text-green-700">
            Escolha a mensagem: a conversa abre com o texto já digitado.
          </p>
        </div>

        <div className="flex flex-wrap gap-1 border-b bg-white px-3 py-2">
          {GRUPOS.map(g => {
            const selecionado = g.faixa === grupo;
            return (
              <button
                key={g.faixa}
                type="button"
                onClick={() => setGrupo(g.faixa)}
                title={g.faixa === faixaSugerida ? "Sugerida para o momento desta proposta" : undefined}
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  selecionado
                    ? "border-green-600 bg-green-600 text-white"
                    : "border-gray-200 bg-gray-50 text-gray-600 hover:border-green-400 hover:bg-green-50"
                }`}
              >
                {g.faixa === faixaSugerida && (
                  <span className={`h-1.5 w-1.5 rounded-full ${selecionado ? "bg-white" : "bg-green-500"}`} />
                )}
                {rotuloDe(g.faixa, g.rotulo)}
              </button>
            );
          })}
        </div>

        <div className="space-y-2 bg-gray-50 p-3">
          {isLoading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando mensagens...
            </div>
          )}
          {!isLoading && scripts?.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">
              Nenhuma mensagem cadastrada neste grupo.
            </p>
          )}
          {scripts?.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => enviar(s)}
              className="group w-full rounded-lg border bg-white px-3 py-2 text-left shadow-sm transition-colors hover:border-green-400 hover:bg-green-50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-gray-800">{s.titulo || "Mensagem"}</span>
                <span className="flex flex-shrink-0 items-center gap-1 text-[10px] font-semibold text-green-600 opacity-0 transition-opacity group-hover:opacity-100">
                  <MessageCircle className="h-3 w-3" /> Enviar
                </span>
              </div>
              <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-[11px] leading-relaxed text-gray-600">
                {substituirVariaveis(s.conteudo, vars)}
              </p>
            </button>
          ))}
        </div>

        <div className="border-t bg-white px-3 py-2 text-right">
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="text-[11px] font-medium text-gray-500 underline underline-offset-2 hover:text-green-700"
          >
            Abrir a conversa sem mensagem
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
