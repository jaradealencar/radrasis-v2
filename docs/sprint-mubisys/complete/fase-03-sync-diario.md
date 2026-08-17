# Fase 3 — Sync diário em lotes via QStash

**Achado atacado:** A3 (o sync não termina na Vercel e não pagina).
**Depende de:** Fase 1 (listagem paginada e timeouts nomeados).
**Toca:** `server/sync/scheduled-sync-os.ts`,
`server/sync/scheduled-sync-os-handler.ts`, `server/routers/admin.ts`,
`docs/cron-qstash.md`.

**Estratégia decidida em 17/08/2026: lotes via QStash.** Não é janela menor nem
`maxDuration` maior — o endpoint passa a aceitar uma janela parametrizada e o
QStash dispara vários lotes escalonados. §4 detalha; não reabra a escolha.

---

## 1. O problema, com números

`sincronizarOSDoMubiSys()` hoje:

1. pede 30 dias de OS numa chamada — **~25 s medidos**, ~1 MB;
2. sem `page`/`per_page`, então pega no máximo os 500 primeiros (A2/A3);
3. itera as OS **em série**, com `SELECT` + `INSERT`/`UPDATE` separados para
   cada uma — com ~180 OS/mês são ~360 idas ao banco;
4. só escreve em `sync_logs` **no fim**.

`vercel.json` fixa `maxDuration: 60`. Somando 25 s de API + 360 queries
sequenciais no Neon (mesmo a 50 ms cada, são mais 18 s), a execução fica na
fronteira ou além. Quando a função é morta, o cache fica meio atualizado **e
não há registro nenhum** de que a execução ocorreu — o `sync_logs` só é escrito
depois de tudo.

Consequência prática: o agendamento no QStash não pode ser criado com
confiança enquanto isso não for resolvido (`docs/cron-qstash.md` já registra a
dependência).

## 2. Correções que valem em qualquer estratégia

Estas quatro entram **antes** da decisão do §4 e independem dela.

### 2.1 Paginar

Trocar a chamada da linha 38 pela listagem paginada da Fase 1:

```ts
const { itens: osLista, completo } = await listarOSMubiSys({
  datainicial: fmt(dataInicio),
  datafinal: fmt(new Date()),
});
if (!completo) {
  console.warn("[SYNC-OS] Listagem incompleta — teto de páginas atingido");
}
```

### 2.2 Registrar a execução no início, não no fim

Gravar a linha em `sync_logs` com status `PENDENTE` (o enum já tem esse valor —
`drizzle/schema.ts:47`) antes de começar, e fazer `UPDATE` para
`SUCESSO`/`ERRO` no fim. Assim uma função morta pelo `maxDuration` deixa
rastro: uma linha `PENDENTE` órfã é exatamente o sintoma a procurar.

Aproveitar e preencher `tempoExecucaoMs`, que já existe na tabela e nunca foi
usado. Sem essa medida, não há como saber se a fase funcionou.

### 2.3 Uma query por OS, não duas

O `SELECT` de existência (linha 80) é desnecessário: `erp_os_cache.numeroOs`
tem índice único (`erp_os_cache_numero_os_idx`). Trocar o par
SELECT+INSERT/UPDATE por um upsert:

```sql
INSERT INTO erp_os_cache (
  "numeroOs", "razaoSocial", cnpj, email, cep, municipio, estado, endereco,
  "dataAprovacao", "dataEntregaPrevista", vendedor, "valorTotal", status,
  "dataUltimaAtualizacao", "sincronizadoEm", "criadoEm"
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', NOW(), NOW(), NOW())
ON CONFLICT ("numeroOs") DO UPDATE SET
  "razaoSocial" = EXCLUDED."razaoSocial",
  cnpj = EXCLUDED.cnpj,
  email = EXCLUDED.email,
  cep = EXCLUDED.cep,
  municipio = EXCLUDED.municipio,
  estado = EXCLUDED.estado,
  endereco = EXCLUDED.endereco,
  "dataAprovacao" = EXCLUDED."dataAprovacao",
  "dataEntregaPrevista" = EXCLUDED."dataEntregaPrevista",
  vendedor = EXCLUDED.vendedor,
  "valorTotal" = EXCLUDED."valorTotal",
  "dataUltimaAtualizacao" = NOW(),
  "sincronizadoEm" = NOW()
```

Corta as idas ao banco pela metade. `valorTotal` entra aqui porque o sync hoje
não grava e o frete depende dele (A5).

⚠️ `selectQuery`/`mutationQuery` convertem `?` para `$n`
(`server/db/db-connection.ts:52`) — mantenha o estilo `?`.

### 2.4 Deduplicar `normalizarData`

A Fase 2 deixou uma cópia de `normalizarData` em `mubisys-frete.ts`. Mover a
função para `server/utils/date-utils.ts` (já existe) e importar nos dois
lugares. Continua valendo: `prazo` é texto, não entra como fallback de data.

## 3. Medir

Depois das correções do §2, rodar localmente e anotar os números:

```bash
yarn dev
# noutra aba:
curl -X POST http://localhost:3000/api/scheduled/sincronizarOS \
  -H "x-cron-secret: $CRON_SECRET" -w "\n\ntempo total: %{time_total}s\n"
```

Preencher a tabela de `docs/cron-qstash.md` ("Tempo de execução medido") com
data, quantidade de OS e duração — **uma linha por tamanho de lote testado**.
Local é mais rápido que a Vercel (o Neon responde de outra região): trate o
número como piso, não como garantia.

## 4. Lotes via QStash (estratégia decidida)

A execução de 30 dias não cabe em 60 s nem com o §2. A decisão é **fatiar a
janela e deixar o QStash disparar cada fatia separadamente**, em vez de reduzir
a cobertura ou pagar plano Pro.

### 4.1 Janela parametrizada no handler

`handleSincronizarOS` passa a aceitar dois parâmetros de query, ambos
opcionais:

| Parâmetro | Padrão | Significado |
|---|---|---|
| `dias` | `8` | Tamanho da janela, em dias |
| `offset` | `0` | Quantos dias atrás a janela **termina** |

A janela vai de `hoje - offset - dias` até `hoje - offset`. Assim
`?dias=8&offset=16` sincroniza o intervalo de 24 a 16 dias atrás.

```ts
const dias = Math.min(Math.max(Number(req.query.dias ?? 8), 1), 31);
const offset = Math.min(Math.max(Number(req.query.offset ?? 0), 0), 365);
const resultado = await sincronizarOSDoMubiSys({ dias, offset });
```

Validar os limites como acima: sem teto, um `?dias=3650` recria exatamente o
problema que esta fase resolve.

`sincronizarOSDoMubiSys()` troca a data fixa de 30 dias (linhas 29–30) por
essas duas entradas, mantendo o padrão `{ dias: 8, offset: 0 }` para quem
chama sem argumento.

### 4.2 Agendamento: 4 lotes escalonados

Cobertura de 32 dias (os mesmos ~30 de hoje, com sobreposição de folga):

| Lote | Query | Janela coberta | Horário (UTC) |
|---|---|---|---|
| 1 | `?dias=8&offset=0` | hoje → 8 dias atrás | `0 6 * * *` |
| 2 | `?dias=8&offset=8` | 8 → 16 dias atrás | `10 6 * * *` |
| 3 | `?dias=8&offset=16` | 16 → 24 dias atrás | `20 6 * * *` |
| 4 | `?dias=8&offset=24` | 24 → 32 dias atrás | `30 6 * * *` |

Escalonar em 10 minutos é o que evita quatro chamadas simultâneas de ~7 s cada
na mesma API — que é lenta e é a mesma que atende o usuário no horário
comercial. 06:00 UTC = 03:00 BRT, como já estava.

**Sobreposição é segura e desejada**: o upsert do §2.3 é idempotente por
`numeroOs`, então lotes que se tocam nas bordas apenas reescrevem o mesmo
registro. Nenhum dia pode ficar num vão entre dois lotes.

Escrever os quatro comandos `curl` de criação em `docs/cron-qstash.md`,
seguindo o modelo que já está lá (header `Upstash-Forward-x-cron-secret`,
retries 2). **Não executar**: a criação depende do domínio de produção e é da
Fase 9 da sprint Vercel. Esta fase entrega os comandos prontos.

### 4.3 Log por lote

Cada lote grava sua própria linha em `sync_logs` (o `PENDENTE` → `SUCESSO` do
§2.2). O dia normal passa a ter **4 linhas**, não 1 — quem olhar o histórico
esperando uma vai achar que algo duplicou.

`sync_logs` não tem coluna para identificar o lote e esta sprint **não mexe em
schema**. Então:

- a identificação (`dias`/`offset`) vai no `console.log` da execução, prefixada
  com `[SYNC-OS]`, para aparecer no log da Vercel;
- `obterStatusSincronizacao` (`admin.ts:6`) passa a agregar **as execuções das
  últimas 24 h** em vez de ler só a última linha: soma `quantidadeOsImportadas`
  e reporta `ERRO` se qualquer lote do período falhou. Sem isso o painel mostra
  só o lote 4 e parece que o sync importa 45 OS/dia;
- a tela `/admin/sincronizacao-cache` ganha uma frase dizendo que 4 execuções
  diárias é o esperado.

Uma coluna `janela` em `sync_logs` resolveria isso melhor — fica registrado
aqui como migração futura, **fora do escopo desta sprint**.

### 4.4 Sincronização manual do painel

`forcarSincronizacaoManual` (`admin.ts:49`) chama a rotina sem argumento e hoje
puxaria 30 dias — o mesmo estouro, agora no caminho do usuário. Passa a aceitar
`dias`/`offset` opcionais com o mesmo padrão (8/0), e o botão do painel usa o
padrão. Se alguém precisar de 30 dias, roda os quatro lotes manualmente.

## 5. Verificação

```bash
yarn run check
yarn test
```

Manual — simular os quatro lotes como o QStash fará:

```bash
for off in 0 8 16 24; do
  curl -X POST "http://localhost:3000/api/scheduled/sincronizarOS?dias=8&offset=$off" \
    -H "x-cron-secret: $CRON_SECRET" -w "\nlote offset=$off: %{time_total}s\n"
done
curl http://localhost:3000/api/scheduled/sincronizarOS/status
```

**Cada lote precisa fechar bem abaixo de 60 s.** Se algum passar de ~40 s,
reduza `dias` para 4 e use 8 lotes — o parâmetro existe justamente para isso, e
a mudança é só no agendamento, não no código.

```sql
-- 4 linhas SUCESSO com tempoExecucaoMs preenchido, e NENHUMA PENDENTE órfã
SELECT status, "quantidadeOsImportadas", "tempoExecucaoMs", "dataExecucao"
FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT 8;
```

Rodar o mesmo `for` duas vezes seguidas: a segunda rodada não pode criar
registro duplicado em `erp_os_cache` (o upsert é idempotente).

E na tela `/admin/sincronizacao-cache`: o total agregado das últimas 24 h tem
que refletir a soma dos quatro lotes, não só o último.

## 6. Critério de pronto

- [ ] Listagem pagina e o sync avisa quando vem incompleta.
- [ ] `sync_logs` registra `PENDENTE` no início e fecha em `SUCESSO`/`ERRO`.
- [ ] `tempoExecucaoMs` preenchido.
- [ ] Uma query por OS (upsert), com `valorTotal` incluído.
- [ ] `normalizarData` num lugar só.
- [ ] Handler aceita `dias`/`offset`, com teto validado.
- [ ] Os 4 lotes rodam localmente, cada um bem abaixo de 60 s, com os tempos
      anotados em `docs/cron-qstash.md`.
- [ ] Rodar duas vezes não duplica registro.
- [ ] `obterStatusSincronizacao` agrega as últimas 24 h.
- [ ] Sync manual do painel usa o padrão de 8 dias.
- [ ] Os 4 comandos `curl` de criação dos schedules estão escritos em
      `docs/cron-qstash.md` — **não executados**.
