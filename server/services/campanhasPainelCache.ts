export const CAMPANHAS_PAINEL_CACHE_TTL_MS = 60_000;

interface EntradaCache {
  expiraEm: number;
  valor: unknown;
}

const cache = new Map<string, EntradaCache>();
const emAndamento = new Map<string, Promise<unknown>>();
let versao = 0;

/** Cache curto, local ao processo, somente para os resumos exibidos no painel. */
export function comCacheCampanhasPainel<T>(
  chave: string,
  carregar: () => Promise<T>
): Promise<T> {
  const atual = cache.get(chave);
  if (atual && atual.expiraEm > Date.now())
    return Promise.resolve(atual.valor as T);
  if (atual) cache.delete(chave);

  const pendente = emAndamento.get(chave);
  if (pendente) return pendente as Promise<T>;

  const versaoDaLeitura = versao;
  const tarefa = carregar()
    .then(valor => {
      if (versao === versaoDaLeitura) {
        cache.set(chave, {
          expiraEm: Date.now() + CAMPANHAS_PAINEL_CACHE_TTL_MS,
          valor,
        });
      }
      return valor;
    })
    .finally(() => {
      if (emAndamento.get(chave) === tarefa) emAndamento.delete(chave);
    });
  emAndamento.set(chave, tarefa);
  return tarefa;
}

/** Invalidar após sincronizações e mutações para não reaproveitar contagens antigas no processo atual. */
export function invalidarCacheCampanhasPainel(): void {
  versao++;
  cache.clear();
  emAndamento.clear();
}

/** Exclusivo para testes: limpa também promessas em voo e evita estado entre casos. */
export function limparCacheCampanhasPainelParaTeste(): void {
  versao++;
  cache.clear();
  emAndamento.clear();
}
