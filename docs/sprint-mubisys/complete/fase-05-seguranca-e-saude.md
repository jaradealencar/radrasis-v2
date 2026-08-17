# Fase 5 — Segurança dos endpoints e saúde da integração

**Achados atacados:** A9 (endpoints admin sem autenticação), A10 (token
expirado, sem rotação nem alerta).
**Depende de:** Fase 1 (usa `verificarConexaoMubiSys`).
**Toca:** `server/routers/admin.ts`, `server/sync/scheduled-sync-os-handler.ts`,
`server/integrations/mubisys-client.ts`, `client/src/pages/admin/SincronizacaoCache.tsx`.

Independente das Fases 2, 3 e 4 — pode sair a qualquer momento depois da 1.

---

## 1. A9 — Endpoints administrativos abertos

`server/routers/admin.ts` expõe quatro procedures como `publicProcedure`:

| Procedure | Linha | O que faz sem autenticação nenhuma |
|---|---|---|
| `obterStatusSincronizacao` | 6 | Vaza estado do ERP |
| `forcarSincronizacaoManual` | 49 | **Dispara uma sincronização completa** (~25 s de API) |
| `obterHistoricoSincronizacoes` | 71 | Vaza histórico |
| `limparCacheAntigo` | 98 | **Apaga registros de `erp_os_cache`** |

`forcarSincronizacaoManual` é gatilho de negação de serviço por repetição, e
`limparCacheAntigo` destrói dado. O projeto já tem o que falta:
`adminProcedure` (`server/_core/trpc.ts:48`, exige role `admin` ou `master`).

**Trocar as quatro para `adminProcedure`.** O client
(`SincronizacaoCache.tsx`) já vive atrás da rota `/admin`; confirme no browser
que as chamadas continuam funcionando para um usuário admin e passam a falhar
com `UNAUTHORIZED` para um usuário comum.

Verificação:

```bash
grep -n "publicProcedure" server/routers/admin.ts   # tem que voltar vazio
```

### 1.1 Endpoint HTTP de status

`GET /api/scheduled/sincronizarOS/status`
(`scheduled-sync-os-handler.ts:52`) também é público — e isso está registrado
em `docs/cron-qstash.md` como conhecido. Ele expõe data da última execução,
contagem de OS e **mensagem de erro crua**, que pode conter trecho de resposta
do ERP.

Duas saídas; escolha a primeira salvo objeção:

- **Exigir o mesmo `x-cron-secret` do POST.** É o operador do QStash que
  consulta; o painel admin usa o procedure tRPC, não este endpoint.
- Manter público, mas remover `mensagemErro` do corpo da resposta.

O que **não** fazer: manter como está e só anotar de novo na documentação.

## 2. A10 — Token sem validade controlada

O JWT em `MUBISYS_ACCESS_TOKEN` tem `exp: 1777952499` → **05/05/2026, vencido
há mais de três meses**. A API continua aceitando (todas as sondagens do
levantamento funcionaram), ou seja, ela não valida expiração hoje.

Isso é uma dependência de comportamento não documentado do fornecedor: no dia
em que passarem a validar, **toda** a integração cai simultaneamente — frete,
CRM, Performance, ABC, empacotamento e o sync — e o sintoma será "sistema
inteiro parou", sem pista apontando para o token.

### 2.1 Avisar no boot

Em `mubisys-client.ts`, decodificar o `exp` do token uma vez, na carga do
módulo, e logar aviso se estiver vencido:

```ts
/** Avisa se o token está vencido. A API hoje não valida `exp` — se um dia
 *  validar, toda a integração cai de uma vez e este log é a única pista. */
function avisarSeTokenVencido(): void {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  if (!token) return;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    if (payload?.exp && payload.exp * 1000 < Date.now()) {
      console.warn(
        `⚠️ [MubiSys] Token com exp vencido em ${new Date(payload.exp * 1000).toISOString()}. ` +
        `A API ainda aceita, mas isso pode mudar sem aviso — renove no painel do ERP.`,
      );
    }
  } catch {
    // Token não-JWT ou formato inesperado: não é motivo para derrubar nada.
  }
}
avisarSeTokenVencido();
```

Não bloqueie a integração por token vencido — hoje ela funciona, e derrubá-la
por precaução seria causar a falha que se quer evitar.

### 2.2 Health check de verdade

`verificarConexaoMubiSys` (linha 217) existe e nunca foi chamada. Ela custa uma
listagem de 1 mês (~25 s) — caro demais para um health check.

Reescrever para uma consulta pontual:

```ts
export async function verificarConexaoMubiSys(): Promise<{
  ok: boolean;
  tokenExpiradoEm?: string;
  latenciaMs?: number;
  erro?: string;
}> {
  const inicio = Date.now();
  try {
    // Consulta pontual e barata (~1 s). Não usa listagem: ela leva ~25 s.
    await buscarClientePorId(1);
    return { ok: true, latenciaMs: Date.now() - inicio, tokenExpiradoEm: expDoToken() };
  } catch (erro: any) {
    return { ok: false, latenciaMs: Date.now() - inicio, erro: erro?.message };
  }
}
```

`buscarClientePorId(1)` devolvendo `null` (404) também conta como conexão
saudável — a autenticação funcionou. Só `MubiSysError` com status 0 ou 4xx de
autorização é falha.

Expor via `adminProcedure` novo em `admin.ts` (`verificarConexaoErp`) e mostrar
na tela `/admin/sincronizacao-cache`: um badge com "ERP acessível · 980 ms" ou
"ERP inacessível: <erro>", mais a data de expiração do token quando vencida.

## 3. Verificação

```bash
yarn run check
yarn test
grep -n "publicProcedure" server/routers/admin.ts    # vazio
yarn dev
```

Manual:

1. Logado como **admin**: `/admin/sincronizacao-cache` → status carrega, badge
   de conexão aparece, "Sincronizar agora" funciona.
2. Logado como usuário **comum**: as chamadas admin devem falhar com
   `UNAUTHORIZED` (a página já não deve estar acessível pelo menu).
3. Aviso de token vencido aparece uma vez no log ao subir o servidor.
4. Se optou por proteger o endpoint de status:
   `curl http://localhost:3000/api/scheduled/sincronizarOS/status` → 403; com
   `-H "x-cron-secret: $CRON_SECRET"` → 200.

## 4. Critério de pronto

- [ ] Zero `publicProcedure` em `admin.ts`.
- [ ] Endpoint HTTP de status protegido (ou sem `mensagemErro`), e
      `docs/cron-qstash.md` atualizado com o que foi feito.
- [ ] Aviso de token vencido no boot.
- [ ] `verificarConexaoMubiSys` barata, exposta e visível no painel admin.
