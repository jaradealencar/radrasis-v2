# Integração MubiSys (ERP) — levantamento e referência

**Levantamento feito em 17/08/2026.** Os contratos abaixo não foram deduzidos
da documentação: foram **medidos** contra `https://api.mubisys.com` com as
credenciais do `.env` do projeto (chamadas somente de leitura). Onde a
documentação oficial (`docs/api/mubisys-postman-collection.json`) diverge do medido,
vale o medido — e isso está sinalizado.

O plano de correção derivado deste documento está em
[`docs/sprint-mubisys/`](sprint-mubisys/README.md).

---

## 1. Contrato real da API (medido)

| Item | Valor medido | Observação |
|---|---|---|
| Base URL | `https://api.mubisys.com/api/{publicKey}/...` | `publicKey` = `MUBISYS_PUBLIC_KEY` |
| Autenticação | header `Access-Token` | JWT em `MUBISYS_ACCESS_TOKEN` |
| Status de sucesso | **201** em listagens e em `/ordem-servico/{id}`; **200** em `/cliente/{id}` | **Não é 200 em todo lugar.** Código que testa `=== 200` quebra |
| Nada encontrado | **404** com corpo `{"error":"Não encontrado"}` | Não é lista vazia |
| `per_page` padrão | **500** | Mesmo sem passar o parâmetro |
| Envelope de lista | `{ pagination: { current_page, last_page, per_page, total }, data: [...] }` | |
| Latência `/ordem-servico?...` (1 mês, 180 OS) | **~25 s**, ~1 MB de payload | Medido 2×; é o gargalo da integração |
| Latência `/ordem-servico/numero/{n}` | **~0,2 s** | |
| Latência `/ordem-servico/{id}` | **~0,6 s** | |
| Latência `/cliente/{id}` | **~1,0 s** | |

### Endpoints usados que **não estão** na coleção oficial

`docs/api/mubisys-postman-collection.json` é uma **coleção Postman** (não um documento
OpenAPI, apesar do nome). Ela não lista:

- `GET /ordem-servico/numero/{sequencial_ordem}` — **existe e funciona**
  (verificado com a OS 6917 → HTTP 201, 226 ms). É o caminho certo para buscar
  uma OS pelo número que o usuário digita.

Parâmetros que a coleção não documenta e que **a API ignora**:

- `search` em `/produto` — verificado: `/produto?per_page=5` e
  `/produto?per_page=5&search=letreiro` devolvem exatamente o mesmo conjunto
  (`total=65`, mesmo primeiro item). Ver achado **A7**.
- `tipo=Normal` em `/ordem-servico` (usado em `performanceComercial.ts:341`) —
  não documentado; a filtragem por tipo é refeita em memória logo abaixo, então
  o parâmetro é inócuo na prática, mas não deve ser lido como filtro efetivo.

### `datainicial`/`datafinal` cortam a borda do período (fuso?)

Medido em 01/09/2026: `GET /ordem-servico?filtrodata=APROVACAO&datainicial=2026-08-01&datafinal=2026-08-31&status=TODOS`
devolveu **155** OS tipo Normal; o painel web, com o mesmo filtro, mostra
**160**. Pedindo a mesma API com 1 dia de folga em cada ponta
(`2026-07-31`..`2026-09-01`) e refiltrando pelo texto de `data_aprovacao`
(que vem sem timezone, ex. `"2026-08-03 08:38:30"`) o total bate certinho com
o painel: 160. Ou seja, o corte que a própria API aplica em `datainicial`/
`datafinal` descarta registros perto da borda do primeiro dia do período —
consistente com o servidor comparando em UTC contra um campo gravado em
horário local (BRT, UTC-3). Não foi confirmada a causa exata (não há acesso
ao código do ERP), só o efeito.

**Correção aplicada em `mubisys-client.ts`:** `listarOSMubiSys` e
`listarOrcamentosMubiSys` agora pedem a janela com 1 dia de folga em cada
ponta e refiltram os resultados no cliente comparando a parte `YYYY-MM-DD` do
campo de data correspondente ao `filtrodata` pedido. Isso é transparente para
quem chama — a assinatura e o retorno não mudaram, só o total bate com o
painel agora. Não se aplica a `filtrodata=PREV_ENTREGA`: o campo `prazo` é
texto livre ("02 dias úteis"), não há data para refiltrar.

### Formato dos campos de OS (medido na OS 6917)

```
id: 32833                      → id interno, NÃO é o número visível
sequencial_ordem: 6917         → número que o usuário digita
cliente: "AMG COMUNICACAO VISUAL"   → só o NOME, sem CNPJ embutido
cliente_id: 2931               → id do cliente (para GET /cliente/{id})
cliente_cnpj_cpf: "52.396.341/0001-21"  → CNPJ já vem na própria OS
cliente_endereco[0].id: 2924   → id do ENDEREÇO, não do cliente
data_aprovacao: "2026-08-03 08:38:30"   → datetime
data_entrega:   "2026-08-05"            → date
prazo:          "02 dias úteis"         → TEXTO LIVRE, não é data
vendedor: "Letícia Carozzo"
```

Dois detalhes que já causaram bug em produção (achados **A1** e **A6**):

1. **`cliente` não contém o CNPJ.** Todo código que extrai CNPJ da string
   `cliente` por regex está resolvendo um problema que não existe e falhando.
   O campo correto é `cliente_cnpj_cpf`, presente na própria resposta da OS.
2. **`cliente_endereco[0].id` ≠ `cliente_id`.** São chaves de tabelas
   diferentes e ambas resolvem em `GET /cliente/{id}` — devolvendo clientes
   diferentes, sem erro nenhum.

---

## 2. O que existe hoje no projeto

### 2.1 Seis implementações HTTP paralelas

Não há um cliente único. Cada consumidor reimplementou o acesso à API:

| # | Onde | Transporte | Timeout | Paginação | Trata erro? |
|---|---|---|---|---|---|
| 1 | `server/integrations/mubisys-client.ts:106` | `fetch` | **nenhum** | **não** | `throw` em `!response.ok` |
| 2 | `server/routers/crm.ts:59` | `https.get` | 25 s | sim (`fetchAllPages`) | engole tudo (`resolve(null)`) |
| 3 | `server/routers/performanceComercial.ts:100` | `https.get` | **90 s** + 3 retries | sim (`fetchAll`, cap 50 pág.) | retorna `status:0` |
| 4 | `server/routers/performanceAbc.ts:10` | `https.get` | 20 s | sim | `if (status !== 201) break` |
| 5 | `server/routers/logistica.ts:380` e `:452` | `https.get` | 8 s / 6 s | n/a | `catch { return null }` |
| 6 | `server/routers/empacotamento.ts:23` | `https.get` | 8 s | n/a | `catch { return null }` |

O "cliente oficial" (#1) é usado por **apenas dois** call sites: o sync diário
e `mubisys-frete.ts`. Suas funções `verificarConexaoMubiSys`, `buscarOSPorId`,
`listarOrcamentosMubiSys` e `listarClientesMubiSys` são **código morto** — zero
referências fora do próprio arquivo.

### 2.2 Fluxos funcionais que dependem do ERP

| Fluxo | Entrada | Caminho | Cache |
|---|---|---|---|
| Cotação de frete (`NovaCotacaoDialog`) | nº da OS | `logistica.buscarDadosOS` → `buscarDadosOSParaFrete` | `erp_os_cache` → API |
| Busca de dados da OS (logística) | nº da OS ou CNPJ | `logistica.buscarDadosOs` → cache → `fetchDadosOsMub` → BrasilAPI | `erp_os_cache` |
| Empacotamento | nº da OS | `empacotamento.buscarOsMubisys` | nenhum |
| CRM / propostas | período | `crm.getPropostas` → `/orcamento` paginado | nenhum |
| Performance Comercial | mês/ano | `/ordem-servico` + `/orcamento` paginados | memória + `mubisys_api_cache` |
| Curva ABC | mês/ano | `/ordem-servico` paginado | `abc_cache` |
| Produtos no ERP (metas) | termo de busca | `/produto?per_page=100` | nenhum |
| Sync diário | CRON | `POST /api/scheduled/sincronizarOS` → `erp_os_cache` | grava o cache |

### 2.3 Infra

- **Credenciais:** `MUBISYS_ACCESS_TOKEN`, `MUBISYS_PUBLIC_KEY` — no
  `.env.example` e lidas em `server/_core/env.ts`. Só `mubisys-client.ts` usa o
  `ENV`; os outros cinco leem `process.env` direto.
- **CRON:** `POST /api/scheduled/sincronizarOS`, protegido por `x-cron-secret`.
  Agendador é o Upstash QStash (`docs/cron-qstash.md`) — **o agendamento ainda
  não foi criado**; espera o domínio de produção (Fase 9 da sprint Vercel).
- **`maxDuration` na Vercel: 60 s** (`vercel.json`). Este número está em
  conflito direto com a latência medida da API (ver achado **A3**).
- **Tabelas:** `erp_os_cache`, `sync_logs`, `mubisys_api_cache`, `abc_cache`.

---

## 3. Achados

Severidade: 🔴 dado errado ou fluxo quebrado · 🟠 falha intermitente/em
produção · 🟡 dívida técnica.

**Status (atualizado na Fase 6 de `docs/sprint-mubisys/`, 17/08/2026): todos os
13 achados abaixo estão resolvidos.** O texto de cada achado é mantido como
foi escrito no levantamento original — é o registro do que aconteceu, não uma
lista de tarefas; a linha "✅ Resolvido" ao final de cada um diz onde.

### A1 🔴 Cotação de frete grava CNPJ e razão social de **outro cliente**

`server/routers/logistica.ts:446-478`. O código busca o CNPJ em
`json.cnpj_cpf ?? json.cnpj ?? json.cpf_cnpj ?? json.documento` — **nenhum
desses campos existe** na resposta (o correto é `cliente_cnpj_cpf`). Como não
acha, cai numa cascata de regex sobre a string `cliente` (que não contém CNPJ),
não acha de novo, e então faz `GET /cliente/{end.id}` usando o **id do
endereço** em vez de `cliente_id`.

Comprovação com a OS 6917:

| Chamada | Retorno |
|---|---|
| `GET /cliente/2931` (`cliente_id`, correto) | `AMARILDO DE ARRUDA MACHADO` · `52.396.341/0001-21` |
| `GET /cliente/2924` (`cliente_endereco[0].id`, o que o código usa) | `ALPHA COMUNICACAO VISUAL LTDA` · `40.978.080/0001-79` |

Ambas devolvem HTTP 200 sem erro. O CNPJ errado vai para a cotação, o romaneio
de despacho e o CT-e. **É o achado mais grave da integração.**

✅ **Resolvido na Fase 2** (`docs/sprint-mubisys/complete/fase-02-dados-errados-frete.md`).

### A2 🔴 `buscarOSPorNumero` quase nunca acha a OS

`server/integrations/mubisys-client.ts:171`. Para achar uma OS pelo número,
lista **6 meses** de OS e procura na resposta — mas `listarOSMubiSys` não envia
`page`/`per_page`, então só recebe a primeira página (500 registros). Com ~180
OS/mês, 6 meses ≈ 1.080 → o final da janela nunca é examinado. Some-se que a
listagem custa ~25 s por mês de janela.

Existe endpoint direto para isso: `GET /ordem-servico/numero/{n}`, 226 ms
(usado em `logistica.ts` e `empacotamento.ts`, mas **não** no cliente oficial).

✅ **Resolvido na Fase 1** (`docs/sprint-mubisys/complete/fase-01-cliente-unico.md`).

### A3 🟠 Sync diário não cabe no `maxDuration` de 60 s da Vercel

`server/sync/scheduled-sync-os.ts`. Custo medido de uma execução de 30 dias:
~25 s só na chamada da API, mais ~180 OS × 2 queries (SELECT + INSERT/UPDATE em
série) = ~360 idas ao banco. Ultrapassa 60 s com folga; a função é morta no
meio, deixando o cache parcialmente atualizado e **sem registro em
`sync_logs`** (o log só é escrito no fim).

Agrava: a mesma função também não pagina (mesma causa de A2) — se o mês tiver
mais de 500 OS, o excedente é silenciosamente ignorado.

> **Decidido em 17/08/2026:** resolver por **lotes via QStash** — o endpoint
> passa a aceitar uma janela parametrizada (`dias`/`offset`) e o agendador
> dispara 4 lotes escalonados, cobrindo os mesmos ~30 dias. Descartadas as
> alternativas de reduzir a janela coberta e de subir o `maxDuration` (que
> exigiria plano Vercel Pro). Ver `sprint-mubisys/complete/fase-03-sync-diario.md` §4.

✅ **Resolvido na Fase 3** (`docs/sprint-mubisys/complete/fase-03-sync-diario.md`).

### A4 🟠 Timeouts maiores que o tempo de vida da função

`performanceComercial.ts` usa timeout de **90 s por página, com até 3
tentativas** (`fetchMubisysWithRetry`, linha 126). Na Vercel a função morre aos
60 s: o retry nunca chega a acontecer, o usuário recebe erro genérico de
gateway, e o cache persistente não é gravado (por desenho, só grava se a busca
foi completa) — então a próxima requisição repete a busca inteira.

✅ **Resolvido na Fase 4** (`docs/sprint-mubisys/complete/fase-04-migrar-consumidores.md`) —
`performanceComercial.ts` migrado para o cliente único, sem o timeout/retry
antigo.

### A5 🟠 Fallback do cache de frete grava registro incompleto

`server/integrations/mubisys-frete.ts:150-181`. O `INSERT`/`UPDATE` de
`gravarNoCache` **não grava `dataEntregaPrevista`, `valorTotal` nem `email`**,
apesar de esses dados estarem na resposta da API. Como o guard `cacheCompleto`
(linha 72) só exige `dataAprovacao` e `vendedor`, o registro é considerado bom
na próxima leitura e o card fica permanentemente sem data de entrega e com
valor da NF zerado — até o sync diário passar por cima.

Também há inconsistência de formato: o frete grava `dataAprovacao` já
formatada (`"03/08/2026 às 08:38"`), enquanto o sync grava o valor cru
(`"2026-08-03 08:38:30"`), na mesma coluna.

✅ **Resolvido na Fase 2** (`docs/sprint-mubisys/complete/fase-02-dados-errados-frete.md`).

### A6 🟡 Extração de CNPJ por regex em `empacotamento.ts`

`server/routers/empacotamento.ts:37`. Mesma premissa errada de A1 (CNPJ
embutido na string `cliente`). Impacto menor — o CNPJ é opcional nesse fluxo —
mas o campo `cliente_cnpj_cpf` está ali, de graça.

✅ **Resolvido na Fase 4** (`docs/sprint-mubisys/complete/fase-04-migrar-consumidores.md`) —
`empacotamento.ts` migrado para o cliente único, que já expõe `cliente_cnpj_cpf`.

### A7 🟡 "Buscar Produto no ERP" não filtra nada

`performanceAbc.getProdutosERP` repassa o termo como `&search=`, que a API
ignora (verificado). O client (`MetasOperacionais.tsx:557`) não refiltra: faz
`.slice(0, 20)`. Resultado: digitar "Letreiro" devolve os 20 primeiros produtos
do cadastro, sejam quais forem. Como o cadastro tem só 65 produtos e
`per_page=100` traz todos, **filtrar em memória no server resolve**.

✅ **Resolvido na Fase 4** (`docs/sprint-mubisys/complete/fase-04-migrar-consumidores.md`).

### A8 🟡 Tratamento de 404 como falha genérica

A API devolve 404 + `{"error":"Não encontrado"}` para janela sem resultado ou
OS inexistente. Nenhum dos seis clientes distingue "não existe" de "deu erro":
`mubisys-client.ts` lança exceção genérica; os outros devolvem `null`. O
usuário vê "erro ao buscar" quando deveria ver "OS não encontrada".

✅ **Resolvido na Fase 1** (`docs/sprint-mubisys/complete/fase-01-cliente-unico.md`) para
`mubisys-client.ts`, e na Fase 4 para os consumidores migrados.

### A9 🟡 Endpoints administrativos da sync sem autenticação

`server/routers/admin.ts`: `forcarSincronizacaoManual`, `limparCacheAntigo`,
`obterStatusSincronizacao` e `obterHistoricoSincronizacoes` são
`publicProcedure`. Qualquer um que alcance `/api/trpc` dispara a sincronização
ou apaga cache. O projeto já tem `adminProcedure` (`server/_core/trpc.ts:48`).
O endpoint HTTP `GET /api/scheduled/sincronizarOS/status` também é público
(está registrado em `docs/cron-qstash.md`).

✅ **Resolvido na Fase 5** (`docs/sprint-mubisys/complete/fase-05-seguranca-e-saude.md`) —
as quatro procedures viraram `adminProcedure`, e o endpoint de status passou a
exigir `x-cron-secret`.

### A10 🟡 Token JWT com `exp` vencido, aceito pela API

O token no `.env` tem `exp: 1777952499` → **05/05/2026**. A API continua
aceitando (as sondagens deste levantamento funcionaram), ou seja, ela não
valida a expiração hoje. É uma dependência de um comportamento não
documentado do fornecedor: no dia em que passarem a validar, **toda** a
integração cai de uma vez. Não há rotação, health check nem alerta.

✅ **Resolvido na Fase 5** (`docs/sprint-mubisys/complete/fase-05-seguranca-e-saude.md`) —
aviso de token vencido no boot (`avisarSeTokenVencido`) e `verificarConexaoMubiSys`
reescrita como health check barato, exposta em `admin.verificarConexaoErp` e
visível no painel `/admin/sincronizacao-cache`. Rotação de token continua manual
(não automatizável sem acesso ao painel do ERP).

### A11 🟡 Testes que não testam a integração

`server/__tests__/mubisys.test.ts` verifica se as variáveis de ambiente
existem e faz uma chamada de conectividade que se auto-ignora em caso de
lentidão. Como a listagem leva ~25 s e o teste aborta em 20 s, **na prática o
único teste real é pulado quase sempre**. Nenhum mapeamento de campo, nenhuma
paginação, nenhum tratamento de erro tem cobertura.

✅ **Resolvido na Fase 6** (`docs/sprint-mubisys/complete/fase-06-testes-e-docs.md`) —
`mubisys.test.ts` reescrito com testes de mapeamento offline (fixture da OS 6917,
`fetch` mockado) que sempre rodam, mais um teste de contrato online, opcional,
ligado por `MUBISYS_TESTE_CONTRATO=1`.

### A12 🟡 Documentação interna desatualizada

- `AGENTS.md:174` cita `server/sync/sync-erp.ts` e `heartbeat-sync-erp.ts` —
  **não existem**.
- `docs/api/mubisys-openapi-v1.json` tem nome de OpenAPI mas é coleção Postman,
  e não cobre `/ordem-servico/numero/{n}`, que está em produção.
- `todo.md:1404` afirma "correção crítica: `filtrodata=APROVACAO` →
  `filtrodata=CADASTRO`", mas `performanceComercial.ts:341` usa `APROVACAO`
  hoje, com comentário justificando a escolha.
  **Resolvido em 17/08/2026: vale `APROVACAO`** — o faturamento do mês conta as
  OS *aprovadas* no mês. O código está certo; a linha do `todo.md` é a errada e
  será corrigida na Fase 6.

✅ **Resolvido na Fase 6** (`docs/sprint-mubisys/complete/fase-06-testes-e-docs.md`) —
`AGENTS.md` corrigido, arquivo renomeado para
`docs/api/mubisys-postman-collection.json` (com `docs/api/README.md` explicando
a lacuna do `/ordem-servico/numero/{n}`), e `todo.md:1404` corrigido.

### A13 🟡 Frete "cotado" é simulado

`obterCotacoesFreteSimuladas` (`mubisys-frete.ts:186`) devolve Sedex/PAC/Loggi
com preço `peso × 2,5 + valor × 1%`. É consumido por `logistica.ts:1340`. Não é
integração com o ERP nem com transportadora — é placeholder. Está registrado
aqui porque vive no arquivo `mubisys-frete.ts` e é fácil confundir com dado
real do ERP.

✅ **Resolvido na Fase 6** (`docs/sprint-mubisys/complete/fase-06-testes-e-docs.md`) —
escopo era só deixar explícito, não implementar cotação real (decidido desde o
início da sprint): a função agora tem um comentário `⚠️ PLACEHOLDER` no topo.
Não há UI consumindo o resultado hoje (`obterCotacoesFreteSimuladas` é
alcançável só pela procedure `logistica.obterCotacoes`, sem chamador no client).

---

## 4. Resposta curta: o que falta para "terminar" a integração

A integração **não está pela metade — está inteira, mas construída seis vezes,
de seis jeitos**, e três desses caminhos produzem dado errado ou morrem em
produção. O trabalho pendente é de consolidação e correção, não de construção:

1. **Corrigir o CNPJ/cliente errado no frete** (A1) — dado errado saindo em
   documento.
2. **Trocar a busca de OS por número pelo endpoint direto** (A2).
3. **Fazer o sync diário caber em 60 s** (A3), fatiando-o em lotes disparados
   pelo QStash — hoje ele nunca termina na Vercel, e o agendamento sequer foi
   criado.
4. **Unificar os seis clientes HTTP em um só**, com timeout, paginação, 200/201
   e 404 tratados uma vez (A4, A8).
5. **Fechar os endpoints administrativos** (A9) e criar health check + rotação
   de token (A10).
6. **Cobrir com teste o que hoje é verificado só por sondagem manual** (A11) e
   acertar a documentação (A12).

Cada item vira uma fase em [`docs/sprint-mubisys/`](sprint-mubisys/README.md).
