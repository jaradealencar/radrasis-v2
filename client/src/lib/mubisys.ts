/** Tela do orçamento no sistema web do MubiSys (mesma URL montada em
 * server/integrations/mubisys-client.ts, urlOrcamentoMubiSys — duplicada aqui porque
 * aquele arquivo importa ENV do servidor e não pode entrar no bundle do cliente).
 * `id` é o id INTERNO do orçamento na API (ex.: 34709), não o `sequencial_orcamento`
 * exibido (ex.: 28775). */
export function urlOrcamentoMubiSys(id: string | number): string {
  return `https://mubisys.com/index.php?modulo=NovosOrcamentos&item=${id}`;
}
