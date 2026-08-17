# Fase 1 — Cliente único da API MubiSys

**Achados atacados:** A2 (busca de OS por número não acha), A8 (404 tratado
como falha).
**Depende de:** nada.
**Toca:** `server/integrations/mubisys-client.ts` (reescrita), `server/_core/env.ts`.

Esta fase **não migra consumidores** — só o sync diário e `mubisys-frete.ts` já
importam este arquivo, e ambos continuam compilando. Os outros quatro
consumidores migram na Fase 4.

---

## 1. Por que

Hoje `mubisys-client.ts` tem três problemas de fundo:

- `mubisysGet` usa `fetch` **sem timeout**. Numa função serverless, uma chamada
  pendurada consome o `maxDuration` inteiro.
- `buscarOSPorNumero` lista 6 meses de OS **sem paginar** e procura na resposta.
  Custa ~25 s por mês de janela e não examina além dos 500 primeiros registros —
  ou seja, quase nunca acha (A2). Existe `GET /ordem-servico/numero/{n}`, que
  responde em ~0,2 s.
- 404 (`{"error":"Não encontrado"}`) vira `throw` genérico, indistinguível de
  falha real (A8).

## 2. O que fazer

### 2.1 Núcleo HTTP

Substituir `mubisysGet` (linha 106) por uma versão com timeout, status
correto e 404 como resultado vazio.

**Antes:**

```ts
const response = await fetch(url.toString(), {
  headers: { "Access-Token": token, "Accept": "application/json" },
});

if (!response.ok) {
  const body = await response.text().catch(() => "");
  throw new Error(`MubiSys API error ${response.status}: ${body.slice(0, 200)}`);
}

return response.json() as Promise<T>;
```

**Depois:**

```ts
/** Erro de comunicação com o ERP. 404 NÃO produz erro — ver mubisysGetOrNull. */
export class MubiSysError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "MubiSysError";
  }
}

/** Timeout padrão. A listagem de OS é lenta (~25 s/mês) — ver §2.4. */
const TIMEOUT_PADRAO_MS = 30_000;

async function mubisysGet<T>(
  path: string,
  params?: Record<string, string>,
  opts?: { timeoutMs?: number },
): Promise<T> {
  const resultado = await mubisysGetOrNull<T>(path, params, opts);
  if (resultado === null) {
    throw new MubiSysError(`MubiSys: recurso não encontrado (${path})`, 404);
  }
  return resultado;
}

/** Igual a mubisysGet, mas devolve null em 404 em vez de lançar. */
async function mubisysGetOrNull<T>(
  path: string,
  params?: Record<string, string>,
  opts?: { timeoutMs?: number },
): Promise<T | null> {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  const publicKey = ENV.MUBISYS_PUBLIC_KEY;
  if (!token || !publicKey) {
    throw new MubiSysError(
      "Credenciais MubiSys não configuradas (MUBISYS_ACCESS_TOKEN e MUBISYS_PUBLIC_KEY)",
      0,
    );
  }

  const url = new URL(`${BASE_URL}/${publicKey}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "Access-Token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_PADRAO_MS),
    });
  } catch (erro: any) {
    // AbortSignal.timeout() lança TimeoutError; falha de rede lança TypeError.
    throw new MubiSysError(`MubiSys inacessível (${erro?.name ?? "erro"}): ${path}`, 0);
  }

  // 404 = "não existe" ou "janela sem resultado". É resposta válida, não falha.
  if (response.status === 404) return null;

  // ⚠️ A API responde 201 em listagens e 200 em /cliente/{id}. Testar por
  // faixa, nunca por igualdade — ver docs/integracao-mubisys.md §1.
  if (response.status < 200 || response.status >= 300) {
    const body = await response.text().catch(() => "");
    throw new MubiSysError(
      `MubiSys API error ${response.status}: ${body.slice(0, 200)}`,
      response.status,
    );
  }

  return (await response.json()) as T;
}
```

### 2.2 Busca por número — usar o endpoint direto

Substituir `buscarOSPorNumero` (linha 171) inteira:

```ts
/**
 * Busca uma OS pelo número visível (sequencial_ordem).
 * Endpoint não documentado na coleção Postman, mas em produção e rápido
 * (~0,2 s). Devolve null quando a OS não existe (404).
 */
export async function buscarOSPorNumero(numero: string): Promise<MubiSysOS | null> {
  return mubisysGetOrNull<MubiSysOS>(`ordem-servico/numero/${encodeURIComponent(numero)}`);
}
```

Remover o bloco que montava a janela de 6 meses e o `.find(...)`.

### 2.3 Paginação de verdade

`listarOSMubiSys` e `listarOrcamentosMubiSys` hoje devolvem só a primeira
página. Manter as duas assinaturas (o sync as usa) e acrescentar o loop:

```ts
/** Percorre todas as páginas de um endpoint de lista do ERP. */
async function listarTudo<T>(
  path: string,
  params: Record<string, string>,
  opts?: { timeoutMs?: number; maxPaginas?: number },
): Promise<{ itens: T[]; completo: boolean }> {
  const maxPaginas = opts?.maxPaginas ?? 50;
  const itens: T[] = [];
  let pagina = 1;

  while (pagina <= maxPaginas) {
    const resp = await mubisysGetOrNull<MubiSysListResponse<T>>(
      path,
      { ...params, page: String(pagina), per_page: "500" },
      opts,
    );
    // 404 na primeira página = janela sem resultado. Não é erro.
    if (!resp) return { itens, completo: true };

    itens.push(...resp.data);
    const ultima = resp.pagination?.last_page ?? 1;
    if (pagina >= ultima || resp.data.length === 0) return { itens, completo: true };
    pagina++;
  }

  // Estourou o teto de páginas: o chamador precisa saber que os dados estão
  // incompletos (não gravar em cache persistente nesse caso).
  return { itens, completo: false };
}
```

`listarOSMubiSys` e `listarOrcamentosMubiSys` passam a devolver
`{ itens, completo }` em vez de `MubiSysListResponse<T>`. **Ajustar o único
chamador atual** (`server/sync/scheduled-sync-os.ts:38`) para ler `.itens` —
a Fase 3 reescreve esse arquivo, aqui basta compilar e continuar funcionando.

### 2.4 Timeouts por operação

A listagem de OS de 1 mês leva ~25 s medidos. Exportar os valores como
constantes nomeadas, para que a Fase 3 e a Fase 4 usem os mesmos números:

```ts
/** Consulta pontual (por número/id/cliente): rápida, ~0,2–1 s medidos. */
export const TIMEOUT_PONTUAL_MS = 10_000;
/** Listagem paginada: ~25 s por mês de janela, medido em 17/08/2026. */
export const TIMEOUT_LISTA_MS = 45_000;
```

Usar `TIMEOUT_PONTUAL_MS` em `buscarOSPorNumero`/`buscarOSPorId` e
`TIMEOUT_LISTA_MS` nas listagens.

### 2.5 Funções que a Fase 4 vai precisar

Acrescentar ao cliente (hoje só existem nos routers, em `https.get` solto):

```ts
export interface MubiSysCliente {
  id: number;
  razao_social: string;
  cnpj_cpf: string;
  [k: string]: unknown;
}

/** GET /cliente/{id} — responde 200 (não 201). Use SEMPRE o `cliente_id` da
 *  OS, nunca o id de `cliente_endereco[0]`: são tabelas diferentes e a API
 *  aceita os dois, devolvendo clientes distintos (ver achado A1). */
export async function buscarClientePorId(clienteId: number): Promise<MubiSysCliente | null> {
  return mubisysGetOrNull<MubiSysCliente>(`cliente/${clienteId}`, undefined, {
    timeoutMs: TIMEOUT_PONTUAL_MS,
  });
}

/** GET /produto — o parâmetro `search` da API é ignorado (verificado); filtre
 *  em memória no chamador. */
export async function listarProdutos(): Promise<any[]> {
  const { itens } = await listarTudo<any>("produto", {}, { timeoutMs: TIMEOUT_PONTUAL_MS });
  return itens;
}
```

`buscarOSPorId` passa a usar `mubisysGetOrNull` (retorno `MubiSysOS | null`).

### 2.6 Código morto

`listarClientesMubiSys` (linha 210) não é usado por ninguém e sua substituta é
`listarTudo`. **Remover.** `verificarConexaoMubiSys` também não é usada hoje,
mas **fica** — a Fase 5 a transforma em health check. Reescrevê-la para usar
`buscarOSPorNumero` de uma OS conhecida seria trocar dependência por
dependência; deixe como está e não a chame.

## 3. Verificação

```bash
yarn run check
yarn test
```

Sondagem manual (o `.env` local já tem credenciais válidas):

```bash
node -e "
require('dotenv/config');
const m = await import('./server/integrations/mubisys-client.ts');
" # ⚠️ .ts não roda direto — use um teste vitest temporário ou tsx:
npx tsx -e "
import 'dotenv/config';
import { buscarOSPorNumero } from './server/integrations/mubisys-client';
const os = await buscarOSPorNumero('6917');
console.log(os?.sequencial_ordem, os?.cliente_cnpj_cpf, os?.cliente_id);
const nao = await buscarOSPorNumero('999999');
console.log('inexistente →', nao);
"
```

**Resultado esperado:**

```
6917 52.396.341/0001-21 2931
inexistente → null
```

Se a OS inexistente lançar exceção em vez de devolver `null`, o tratamento de
404 (§2.1) está errado.

## 4. Critério de pronto

- [ ] `mubisysGet`/`mubisysGetOrNull` com timeout, faixa 2xx e 404 → `null`.
- [ ] `buscarOSPorNumero` usa `/ordem-servico/numero/{n}` e devolve `null` em 404.
- [ ] Listagens paginam e devolvem `{ itens, completo }`.
- [ ] `buscarClientePorId` e `listarProdutos` existem.
- [ ] `listarClientesMubiSys` removida.
- [ ] Zero `https.get` no arquivo. Zero `process.env` direto.
- [ ] `yarn run check` e `yarn test` passam.
