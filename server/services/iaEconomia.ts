/**
 * Economia de IA: regras comuns aos chats que usam a API paga da Anthropic (Consultor da Meta,
 * Assistente de Inteligência de Clientes e chat do Painel Financeiro).
 *
 * O custo de uma pergunta vem de três coisas: os dados que vão junto (contexto), a conversa anterior,
 * que é reenviada e cobrada a cada pergunta, e o tamanho da resposta (a parte mais cara por token).
 * Aqui ficam os limites da conversa, o freio por usuário e a leitura segura da resposta. O reaproveitamento
 * do contexto (cache do prompt) é feito em cada chamada, marcando o último bloco que não muda.
 *
 * Tudo aqui é puro (sem rede, sem banco).
 */

export interface MensagemChat { role: "user" | "assistant"; texto: string }

/** Só as últimas mensagens seguem na conversa: cada uma é reenviada (e cobrada) a cada pergunta. */
export const MAX_MENSAGENS_HISTORICO = 6;
export const MAX_CARACTERES_MENSAGEM = 4000;
/** Respostas antigas só servem de contexto (o começo traz a conclusão) e entram resumidas; a última segue inteira para as perguntas de seguimento. */
export const MAX_CARACTERES_RESPOSTA_ANTIGA = 800;

/** Mantém só as últimas mensagens, limita o tamanho de cada uma e normaliza a sequência de papéis
 * (os provedores exigem começar por "user" e não aceitam bem o mesmo papel duas vezes seguidas). */
export function limitarHistorico(historico: MensagemChat[]): MensagemChat[] {
  const recentes = historico
    .filter(m => (m.role === "user" || m.role === "assistant") && m.texto.trim().length > 0)
    .slice(-MAX_MENSAGENS_HISTORICO)
    .map(m => ({ role: m.role, texto: m.texto.slice(0, MAX_CARACTERES_MENSAGEM) }));
  const saida: MensagemChat[] = [];
  for (const m of recentes) {
    if (saida.length === 0 && m.role === "assistant") continue;
    const ultima = saida[saida.length - 1];
    if (ultima && ultima.role === m.role) ultima.texto = `${ultima.texto}\n\n${m.texto}`.slice(0, MAX_CARACTERES_MENSAGEM);
    else saida.push({ ...m });
  }
  const ultimaResposta = saida.map(m => m.role).lastIndexOf("assistant");
  return saida.map((m, i) => (
    m.role === "assistant" && i !== ultimaResposta && m.texto.length > MAX_CARACTERES_RESPOSTA_ANTIGA
      ? { ...m, texto: `${m.texto.slice(0, MAX_CARACTERES_RESPOSTA_ANTIGA).trimEnd()}…` }
      : m
  ));
}

/** Limite de perguntas por usuário numa janela deslizante (em memória: por instância do servidor). */
export function criarLimitador(maximo: number, janelaMs: number) {
  const registros = new Map<string, number[]>();
  return {
    permitir(chave: string, agora: number = Date.now()): { ok: boolean; reiniciaEmSegundos: number } {
      const recentes = (registros.get(chave) ?? []).filter(t => agora - t < janelaMs);
      if (recentes.length >= maximo) {
        registros.set(chave, recentes);
        return { ok: false, reiniciaEmSegundos: Math.ceil((recentes[0] + janelaMs - agora) / 1000) };
      }
      recentes.push(agora);
      registros.set(chave, recentes);
      return { ok: true, reiniciaEmSegundos: 0 };
    },
  };
}

export function mensagemLimiteAtingido(reiniciaEmSegundos: number): string {
  return `Limite de perguntas por hora atingido. Tente de novo em ${Math.max(1, Math.ceil(reiniciaEmSegundos / 60))} min.`;
}

/** Anexada quando a resposta bateu no teto de tokens e foi cortada no meio. */
export const NOTA_RESPOSTA_CORTADA = "\n\n(A resposta foi cortada por ficar longa demais. Peça “continue” para ver o resto.)";

/** Junta os blocos de texto da resposta do Claude (o raciocínio, se houver, fica de fora). Sem texto nenhum
 * é erro com o motivo: com o raciocínio ligado, ele pode gastar o teto de tokens inteiro e não escrever nada. */
export function extrairTextoClaude(r: { content: Array<{ type: string; text?: string }>; stop_reason: string | null }): string {
  const texto = r.content.filter(b => b.type === "text").map(b => b.text ?? "").join("\n").trim();
  if (!texto) throw new Error(`Claude não retornou texto (stop_reason=${r.stop_reason})`);
  return r.stop_reason === "max_tokens" ? `${texto}${NOTA_RESPOSTA_CORTADA}` : texto;
}
