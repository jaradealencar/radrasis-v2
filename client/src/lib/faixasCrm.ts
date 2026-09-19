import type { FaixaConfig } from "@/components/FaixaDiasConfigForm";

/** yyyy-mm-dd no fuso local (mesma chave usada pelo CRM para comparar datas). */
export function chaveDia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Grupo de mensagens a sugerir para uma proposta quando o vendedor clica no WhatsApp:
 *  - a faixa cujo período contém HOJE (datas úteis D+1, D+2… a partir da criação);
 *  - 0 (Pós-orçamento) se hoje ainda é o dia do orçamento — ou antes do 1º dia útil seguinte;
 *  - se hoje já passou do fim de tudo, ou caiu num intervalo entre faixas configuradas, a última
 *    faixa cujo período já começou.
 * É só a sugestão inicial: o vendedor pode trocar de grupo no seletor.
 */
export function faixaSugerida(
  datasUteis: Date[],
  faixas: Array<Pick<FaixaConfig, "faixa" | "diasInicio" | "diasFim">>,
  hoje: Date = new Date(),
): 0 | 1 | 2 | 3 {
  if (datasUteis.length === 0) return 0;
  const hojeKey = chaveDia(hoje);
  const ordenadas = [...faixas].sort((a, b) => a.diasInicio - b.diasInicio);
  let sugerida: 0 | 1 | 2 | 3 = 0;
  for (const f of ordenadas) {
    const datas = datasUteis.slice(f.diasInicio - 1, f.diasFim);
    if (datas.length === 0) continue;
    if (datas.some(d => chaveDia(d) === hojeKey)) return f.faixa;
    if (chaveDia(datas[0]) <= hojeKey) sugerida = f.faixa; // já começou (e hoje não está dentro dela)
  }
  return sugerida;
}

/** Link do WhatsApp com a mensagem já digitada: `https://wa.me/<número>` + `?text=` codificado. */
export function linkWhatsAppComTexto(link: string, texto: string): string {
  return `${link}?text=${encodeURIComponent(texto)}`;
}
