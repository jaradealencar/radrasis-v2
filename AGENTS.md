# AGENTS.md

Guia para agentes de IA (e humanos) trabalhando neste repositório.

## O que é este projeto

Radrasys — sistema interno de gestão (logística, qualidade, comercial,
financeiro, RH) originado do template "Manus webdev fullstack", mas já sem
nenhuma dependência do Forge (Manus) ou do Gemini — banco é Postgres, auth é
Better Auth local-only, LLM é OpenAI, storage é UploadThing (ver
`docs/webdev-template-guide.md` para as convenções originais do
template — **cuidado**: esse doc ainda descreve o template original em
MySQL/Manus OAuth/Forge "puro"; onde ele divergir do que está escrito aqui,
este AGENTS.md vale, não ele).

Stack: React 19 + Tailwind 4 + Vite 7 no client (SPA servida pelo próprio
Express); Express 4 + tRPC 11 no server (`superjson` como transformer —
`Date`/`Map`/etc. atravessam o wire sem serialização manual); Drizzle ORM
**sobre PostgreSQL (Neon)**, driver `@neondatabase/serverless` com Drizzle `neon-serverless`;
autenticação própria via **Better Auth** (local-only, e-mail+senha); LLM via
**OpenAI** (`server/_core/llm.ts`); storage de arquivo via **UploadThing**
(`server/db/storage.ts`).

⚠️ **Migração em andamento MySQL→PostgreSQL + auth própria (Better Auth) —
Fases 1-3 concluídas, falta a Fase 5.** O banco já é Postgres de verdade e
a auth já é 100% Better Auth (Fases 1-3); só falta a Fase 5 (remover
`mysql2` do `package.json` — continua ali só porque nada mais depende
dele, é limpeza final, sem urgência funcional). Plano completo, histórico
do que já foi feito: `docs/migracao-postgres-better-auth.md`.

## Norte do Comercial: CPQ (Configure, Price, Quote)

**CPQ Letreiros Express** é um produto de **Configurar, Preço e Orçamento**:

- **Configure / Configurar:** escolher produto, composição, kits, modelos,
  variações e medidas do nesting; permitir ajustes rastreáveis.
- **Price / Preço:** transformar escolhas e medidas em consumo, custo, preço e
  margem, com regras comerciais e validações de engenharia.
- **Quote / Orçamento:** emitir uma proposta revisada, com snapshot do cálculo,
  apresentação para o cliente e registro da resposta.

Ao desenvolver Produtos, CPQ Letreiros Express, Propostas e integrações,
tratar cada orçamento como uma configuração rastreável: **produto →
composição (matérias-primas e kits) → modelos → variações → medidas do nesting
→ consumo → custo → preço e margem → proposta**. O objetivo é montar propostas
complexas em minutos, com revisão explícita dos dados que afetam preço e
engenharia. Esta seção define a direção do produto; não significa que todos
esses controles já estejam implementados.

- Reaproveitar composições importadas, modelos, variações e configurações
  aprovadas, mantendo a liberdade de incluir, excluir e ajustar materiais em
  cada orçamento. As escolhas devem recalcular consumo e preço imediatamente.
- Exibir a origem, unidade, fórmula, quantidade e custo de cada insumo e a
  regra que formou o preço. Custo ausente, unidade incompatível ou medida
  essencial desconhecida devem ficar visíveis e impedir a emissão até serem
  resolvidos; nunca assumir custo zero silenciosamente.
- Centralizar no servidor o cálculo definitivo de consumo, preço e margem.
  Ajustes manuais precisam de validação de margem; exceções abaixo do piso
  exigem aprovação identificável. Salvar um snapshot versionado dos dados,
  regras e decisões usados na proposta emitida.
- Validar medidas e limites físicos do nesting, desperdício e compatibilidade
  entre peças, materiais, modelos e variações antes de liberar a proposta.
  Priorizar padrões úteis, importação de dados e um resumo claro do que falta
  para cotar, de modo que a rapidez não dependa de digitação repetida.
- Visão futura: cada projeto começa numa interface conversacional do CPQ; o
  vendedor anexa imagens e explica por texto ou áudio o letreiro desejado.
  O briefing editável orienta a busca de modelos e materiais reais do MubiSys,
  usando também tags de contexto cadastradas nos produtos, a estimativa de
  cores, o redesenho, a validação da geometria, o nesting e a proposta. O chat
  coleta tipo de iluminação, origem das medidas e nível de acabamento; pode
  comparar versões prontas para instalar e semiacabadas. IA deve mostrar
  evidências e incertezas, sem inventar itens, custos ou medidas. Materiais,
  cores, desenho, medidas extraídas e opções de produto precisam ser confirmados;
  quantidades vêm de geometria validada; todo preço automático continua exigindo
  aprovação humana.

Plano de melhorias e riscos atuais: `docs/configurador-inteligente-vendas.md`.

**Nome público do configurador:** CPQ Letreiros Express. A página canônica é
`/cpq-letreiros-express.html`; `/estudio-letra-caixa.html` redireciona para ela
preservando a query string dos links de cotação antigos. Nomes técnicos já
persistidos (`estudio_*`, `/api/letra-caixa/*`, `[ESTUDIO_COTACAO_V1]`) continuam
iguais para manter dados e integrações compatíveis. Use o nome novo em toda
interface, proposta e documentação atual.

## Gerenciador de pacotes

**Yarn (classic, 1.x)** — não use `npm install` nem `pnpm`. O projeto foi
migrado de pnpm para yarn; o lockfile é `yarn.lock`.

```bash
yarn install     # instala dependências (roda patch-package automaticamente)
yarn dev         # servidor de desenvolvimento (Vite + Express na mesma porta)
yarn build       # build de produção (client via Vite, server via esbuild)
yarn start       # roda o build de produção
yarn run check   # tsc --noEmit — precisa do "run"! `yarn check` sozinho
                 # dispara o comando nativo do Yarn (valida lockfile), não
                 # o script do package.json, e retorna resultado errado
yarn test        # vitest run
yarn format      # prettier --write .
yarn db:push     # drizzle-kit generate && drizzle-kit migrate
```

Variáveis de ambiente: ver `.env.example`. `DATABASE_URL` (string de conexão
**PostgreSQL**, ex: `postgresql://user:pass@host/db?sslmode=require` — o
projeto roda contra Neon) é obrigatória para rodar o server ou os scripts em
`scripts/`.

## Banco de dados — sempre via migration

Consultas avulsas por `getPool().query()` usam HTTP via Neon. Transações
Drizzle (`db.transaction`) reservam um `PoolClient` por WebSocket e exigem
runtime Node com suporte a WebSocket. Dentro do callback, use apenas o `tx`
recebido para garantir que todas as queries participem da mesma transação.

Dialeto: **PostgreSQL** (`drizzle.config.ts` tem `dialect: "postgresql"`).
Nunca altere o schema do banco rodando SQL direto (`psql`, script one-off,
`selectQuery`/`mutationQuery` solto para `ALTER TABLE`/`CREATE TYPE`/etc.).
Toda mudança de estrutura (coluna, tipo, enum, índice) segue este fluxo:

1. Edite `drizzle/schema.ts` (tabelas em `pg-core`: `pgTable`, `pgEnum`, etc.
   — Postgres exige enums nomeados, diferente do enum inline do MySQL).
2. Rode `npx drizzle-kit generate` para gerar a migration numerada em `drizzle/`.
3. **Revise o SQL gerado antes de aplicar** — drizzle-kit não lida sozinho
   com tudo (ex: mudar os valores de um enum já em uso exige editar a
   migration à mão para adicionar um `USING CASE ...` que remapeia os
   dados já gravados; senão o `ALTER TYPE` quebra contra linhas existentes).
4. Aplique com `npx drizzle-kit migrate` (ou `yarn db:push`, que já faz
   generate + migrate).

Scripts one-off pra *dado* (backfill pontual, copiar de uma tabela legada)
são aceitáveis fora desse fluxo — a regra é sobre *estrutura*. Migration
sempre vai commitada junto com a mudança de `schema.ts` que a gerou.

⚠️ **Se criar uma migration à mão** (ex: só um `INSERT` de seed, sem passar
por `drizzle-kit generate`) e precisar registrar a entrada em
`drizzle/meta/_journal.json` manualmente: o `when` (timestamp) **precisa
ficar em ordem crescente estrita** com as migrations vizinhas — nunca
invente um valor arbitrário grande "pra garantir". O migrator do
drizzle-kit aplica uma migration só se seu `when` for maior que o **último**
`created_at` já gravado na tabela de controle (`drizzle.__drizzle_migrations`,
comparando 1 valor só, não por hash individual) — um `when` fora de ordem
faz a **migration seguinte** ser silenciosamente pulada (sem erro, sem
aviso, `migrate` reporta sucesso do mesmo jeito). Aconteceu de verdade em
27/09/2026 (migration 0050, manual, ganhou um "when" maior que o da 0051
gerada depois — a 0051 nunca rodou até isso ser percebido rodando os
testes). Prefira sempre gerar via `drizzle-kit generate` (mesmo que o SQL
gerado fique vazio por não haver mudança de schema, o `when` sai correto) e
só editar o SQL resultante — nunca criar o par migration+entrada do zero.

Migrations antigas do MySQL (pré-migração) foram arquivadas em
`docs/archive/mysql-migrations/` — não são mais aplicáveis, só referência
histórica caso precise comparar o design de uma tabela antes/depois.

## Autenticação (Better Auth, local-only)

`server/_core/auth.ts` — instância `betterAuth()` sobre o Drizzle adapter
(mesmo Postgres/Neon do resto do app). Só e-mail+senha (sem OAuth/social —
a plataforma Manus não é mais usada). Pontos que fogem do padrão "out of
the box" do Better Auth, todos por causa do vocabulário de negócio já
existente antes da migração (`master, admin, gestor, vendas, logistica,
producao, financeiro, empacotamento`, ver `AppRole`/`APP_ROLES` em
`drizzle/schema.ts`):

- **Hash de senha em bcrypt** (`emailAndPassword.password.hash/verify`
  sobrescritos com `bcryptjs`), não o scrypt padrão do Better Auth — mesma
  lib usada em todo o resto do app pra senha admin-provisionada.
- **Plugin `admin`**: `roles` precisa listar as 8 roles de negócio (não só
  `admin`/`user`) — o plugin rejeita em runtime qualquer `role` passado
  pra `createUser`/`setRole` que não seja uma chave desse mapa, mesmo já
  validado pelo enum do Postgres.
- **Plugin `username`**: login por e-mail OU por nome (roles sem e-mail
  real, ex. `producao`/`empacotamento`, continuam logando só com o nome).
  Usuários sem e-mail ganham um e-mail sintético interno
  (`<slug-do-nome>@local.internal`, nunca exibido) só pra satisfazer a
  coluna `email` (núcleo, obrigatória mesmo com o plugin `username`
  habilitado); o `username` de fato é o e-mail normalizado (com e-mail
  real) ou o slug do nome (sem e-mail). O client (`LocalLogin.tsx`)
  normaliza o texto digitado do mesmo jeito antes de chamar
  `signIn.username()` — replicar essa normalização (`slugifyName`) em
  qualquer novo ponto que crie ou autentique usuário sem e-mail.
- `active: "sim"/"nao"` (vocabulário usado no resto do app) é mapeado a
  partir de `banned` do Better Auth em `localUsers.list`/`.update`
  (`server/routers.ts`) — banir/desbanir via `auth.api.banUser`/`unbanUser`.

`ctx.user` (único, sem mais a síntese dupla `user`/`localUser` de antes)
é resolvido em `server/_core/context.ts` via
`auth.api.getSession({ headers: fromNodeHeaders(req.headers) })`.
`server/_core/trpc.ts` expõe `requireRole(...roles)` — middleware reusável
pra checagem de role de negócio, usado tanto em procedures
(`.use(requireRole("admin","master"))`) quanto redefinindo `adminProcedure`.
CRUD administrativo de usuários (`localUsers.create/update/delete` em
`server/routers.ts`) continua com lógica própria (modo bootstrap: se não
há nenhum usuário ainda, qualquer um pode criar o primeiro) chamando
`auth.api.createUser`/`adminUpdateUser`/`setUserPassword`/`removeUser`
diretamente — sem equivalente pronto no plugin admin pra essas regras.

Client: hook único `client/src/hooks/useAuth.ts` (substitui os antigos
`useAuth` do OAuth Manus e `useLocalAuth`) — usa
`client/src/lib/auth-client.ts` (`createAuthClient`/`useSession` do
Better Auth) pra identidade/sessão, combinado com a query tRPC
`permissions.myPermissions` (tabela `role_permissions`, intocada pela
migração) pra permissão por página. Sem sessão: sistema aberto, tudo
visível (`canAccess` retorna `true`) — comportamento deliberado, não um
bug. Gate de rota por página: `client/src/components/ProtectedRoute.tsx`.
Login: `client/src/pages/LocalLogin.tsx`.

Endpoint de CRON (`POST /api/scheduled/sincronizarOS`,
`server/sync/scheduled-sync-os-handler.ts`) usa um segredo compartilhado
simples (header `x-cron-secret` == env `CRON_SECRET`) — antes da Fase 3
checava um campo (`user.isCron`) que nunca existiu de verdade no SDK do
Manus (achado durante a migração: só funcionava por acaso/nunca, escondido
atrás de um cast `as any`). Se algo externo dispara esse endpoint
periodicamente, precisa ser reconfigurado com o novo header/segredo.

## Commits ao final de sprint/tarefa/fix

**Toda sprint, tarefa ou fix concluído termina com um commit** — não deixe
trabalho pronto (e validado: typecheck/testes relevantes rodados) parado
sem commitar, e não acumule várias tarefas/fixes não relacionados num
commit só. Isso vale tanto pra fases numeradas de um doc de planejamento
(ex: `docs/migracao-postgres-better-auth.md`) quanto pra qualquer tarefa
avulsa (bugfix, ajuste pontual, feature pequena) pedida fora de um doc de
sprint.

- Documentos de planejamento/sprint dividem o trabalho em fases/tarefas
  numeradas. Ao concluir uma fase ou tarefa inteira, faça um commit
  próprio pra ela antes de seguir pra próxima. Atualize o próprio
  documento (marcando a tarefa como concluída, registrando achados) como
  parte desse commit.
- Fora de um doc de sprint: ao terminar qualquer tarefa/fix pedido, revise
  o que está pendente (`git status`/`git diff`) e commit antes de
  considerar a tarefa encerrada — não espere o usuário pedir o commit
  explicitamente.
- Exceção: se o próprio usuário pedir explicitamente pra não commitar
  ainda (quer revisar antes, trabalho intermediário/experimental), respeite
  e avise que o commit ficou pendente.

**Ao final de toda tarefa** (não só as de um doc de planejamento — vale pra
qualquer trabalho concluído no repo), verifique se este `AGENTS.md`
precisa de ajuste antes de considerar a tarefa pronta: stack/dependência
nova, comando novo ou trocado, pasta/arquivo que mudou de lugar, ponta
solta que foi resolvida (remova da lista), ponta solta nova que ficou pra
trás, ou uma fase da migração que avançou (ex: Fase 3/Better Auth
concluída deve atualizar a seção de Autenticação e o aviso no topo). Se
nada mudou, não precisa tocar no arquivo — mas o hábito é checar, não
assumir que continua certo.

## Estrutura

```
client/src/          frontend (Vite root = client/)
  pages/              uma pasta por módulo (logistica/, admin/, comercial/, ...)
  components/         componentes compartilhados entre páginas
  hooks/               hooks do app, incluindo useAuth.ts (identidade/permissões)
  lib/                 trpc.ts, auth-client.ts (client do Better Auth)
server/
  routers.ts          appRouter raiz do tRPC — registra todos os sub-routers
  routers/             sub-routers por domínio (logistica.ts, admin.ts, ...)
  db/                  acesso a dados (Drizzle + pg puro via getPool()): db.ts, db-connection.ts,
                       db-helpers*.ts, storage.ts
  integrations/        clientes de APIs externas: mubisys-client.ts, mubisys-frete.ts,
                       opencnpj-client.ts (consulta de CNPJ, sem chave)
  services/            lógica de domínio reutilizada por routers; manter funções
                       puras quando não precisarem de I/O:
                       inteligenciaClientes.ts (RFM/classificação/funil/previsão
                       comercial), qualificacaoLeadCnpj.ts (score de lead por CNPJ)
                       (telefones das campanhas: `server/sync/clientes-mubisys.ts` espelha o cadastro
                       de clientes do MubiSys em `mubisys_clientes_cache`, atualizado sozinho ao abrir
                       o painel de Campanhas; 429 da API tem retentativa e o lote tem orçamento de 40s),
                       cpqPrecoAssistente.ts (sugestões GPT e recibos assinados
                       de aprovação humana de preço),
                       cpqFactibilidadeFabricacao.ts (fit-to-sheet, emendas e áreas SVG)
                       e cpqCoresMateriais.ts (CIEDE2000 e custeio por região de cor)
  routes/              rotas REST fora do tRPC: publico-guia-fornecedores.ts (CORS aberto, site
                       espelho), campanhas-whatsapp-api.ts (webhooks com chave CAMPANHAS_API_KEY)
                       e price-table-api.ts (export somente-leitura da Tabela de Preços com chave
                       PRICE_TABLE_API_KEY, para o precificador automatizado externo),
                       estudio-cotacoes.ts (cotações do HTML estático do CPQ),
                       estudio-clientes.ts (cadastro e busca autenticados de clientes do CPQ),
                       estudio-kits.ts (composições de produto por modelo, compartilhadas no Postgres),
                       estudio-catalogo-mubisys.ts (catálogos de produtos e matérias-primas
                       via API MubiSys, com sessão autenticada) e
                       estudio-configuracoes.ts (configurações compartilhadas do CPQ),
                       estudio-nesting.ts (CRUD de chapas e execução local do Deepnest),
                       estudio-factibilidade.ts (validação geométrica e decisões de fabricação),
                       estudio-cores.ts (catálogo local, análise e aprovação de cores antes do nesting),
                       letra-caixa-redesenho.ts (reconstrução com até 2 referências extras da mesma logo, vetor e upload de imagens do CPQ)
  sync/                sincronização com o ERP: scheduled-sync-os.ts,
                       scheduled-sync-os-handler.ts
  utils/               helpers puros: date-utils.ts, transportadoras-completude.ts
  scripts/             scripts de seed do server (seed.mjs, seed-operacoes.mjs)
  __tests__/           testes do server (*.test.ts)
  _core/               infra do server: auth.ts (Better Auth), context.ts/trpc.ts
                       (contexto e middlewares tRPC), vite dev middleware
shared/               tipos e constantes usados por client e server
drizzle/              schema.ts + migrations (numeradas, geradas por drizzle-kit)
scripts/              scripts de seed/importação reutilizáveis (rodar com `node scripts/x.mjs`)
                       — scripts de migração/ajuste pontuais já aplicados foram removidos;
                       só ficou o que serve pra popular um banco novo
docs/                 documentação viva + docs/archive (ver abaixo)
```

Import aliases (`vite.config.ts` / `tsconfig.json`): `@/` → `client/src/`,
`@shared/` → `shared/`.

## Convenções do client (`client/src/pages`)

Fruto da sprint de refatoração de `pages/` — reaproveite estes componentes
em vez de reescrever o padrão:

- Tabela de dados usa `@/components/ui/table` — **não** escreva `<table>` na
  mão. Exceção: HTML montado em string para exportação (Excel/impressão).
- Cabeçalho de página usa `@/components/PageHeader`.
- Card de indicador usa `@/components/KpiCard`.
- Tooltip de gráfico recharts usa `@/components/ChartTooltip`.
- Formatação de moeda/número/data/percentual vem de `@/lib/format` — não
  crie `toLocaleString` inline nem formatador local.
- Cor de série de gráfico vem de `@/lib/chartColors` (`chartColor(i)` para
  categórica, `STATUS_COLORS` para semântica).
- Estados de carregando e vazio usam `@/components/ui/spinner` e
  `@/components/ui/empty`.
- Tabela de Preços > Pág. 4 (Fontes Chaveadas) tem a **Calculadora de fontes**: o vendedor escolhe o LED (fitas 12/24 V e módulos, as
  mesmas tabelas da página, com os nomes editados) e a quantidade, e a lógica pura de `shared/led-fontes-calculo.ts` (testes em
  `server/__tests__/led-fontes-calculo.test.ts`) indica quais fontes e quantas: trabalha com 85% de uso da fonte e aceita até 93% antes de
  sugerir outra (nesse caso mostra também a opção que fica em 85%); menos fontes primeiro, depois menor potência instalada. O consumo por
  módulo vem de `LedModuleTable.wattsPerModule` (`server/services/ledPowerSources.ts`), não do texto do subtítulo.
- Resultado que o vendedor mostra ao cliente (simuladores de cartão e de boletos, Tabela de Preços > Pág. 6) ganha
  `@/components/BotaoCopiarImagem`: desenha um PNG em canvas (`@/lib/imagemCopia`) e o coloca na área de transferência (sem
  permissão do navegador, baixa o arquivo). Não use `html2canvas` para isso — ele não lê as cores `oklch()` do Tailwind 4.

## Testes

`yarn test` (vitest, `environment: "node"`) roda tudo que casar com
`server/**/*.test.ts` (config em `vitest.config.ts`). **`DATABASE_URL`
precisa estar exportada no shell antes de rodar** — os testes importam os
módulos de `server/db/` direto e pulam `server/_core/index.ts` (que é quem
normalmente carrega `dotenv/config`), então sem a env var no ambiente as
suítes que tocam banco falham na conexão, não só pulam. Vários testes usam
o banco real (Neon) via fixtures de SQL cru — não há banco de teste isolado
nem mocks da camada de dados.

## docs/ — quais valem como fonte de verdade

- `docs/migracao-postgres-better-auth.md` — plano ativo da migração
  MySQL→Postgres/Better Auth (ver aviso no topo deste arquivo). **O doc mais
  importante pra entender o estado real do banco/auth agora.**
- `docs/campanhas-whatsapp.md` — módulo Campanhas WhatsApp (aba ao lado de ROI Marketing): regras de
  cadência/quarentena/pós-venda, modelo de dados e contrato dos webhooks REST.
- `docs/cpq-cores-materiais-pre-nesting.md` — análise, aprovação e custo de cores do CPQ antes do nesting.
- `docs/webdev-template-guide.md` — guia original do template Manus
  webdev fullstack. Descreve o template genérico (MySQL, só OAuth) — várias
  partes já não valem pra este repo, ver aviso na seção "O que é este
  projeto" acima.
- `docs/sprint-saida-forge/` — **sprint concluída**: tirou a dependência do
  Forge (Manus) e do Gemini do repo (LLM na OpenAI, storage no UploadThing,
  notificação via alertas do próprio app, extração de texto sem LLM, e
  limpeza final dos módulos/envs/config residuais). **Formato diferente dos
  outros docs de sprint: é uma pasta, com `README.md` (contexto + decisões)
  e um arquivo por fase, cada fase concluída movida pra
  `docs/sprint-saida-forge/complete/`.** Mantida como histórico — não é mais
  plano ativo.
- `docs/base-conhecimento-*.md`, `docs/tabela-precos-conteudo.md` —
  conteúdo/dados de negócio usados para popular features específicas (base
  de conhecimento do chat, tabela de preços), não documentação de
  arquitetura.
- `docs/archive/` — histórico, nunca fonte de verdade (ver seção abaixo).

## docs/archive/

Este projeto foi reorganizado a partir de dois estados divergentes: um
export em zip do Manus (já extraído — o zip original foi descartado por
ser redundante) e ~50 arquivos soltos na raiz do repo que representavam
edições feitas depois desse export. Onde os dois lados divergiam de verdade, a versão mais
recente (a solta) venceu; a versão do zip que perdeu ficou arquivada em
`docs/archive/versoes-divergentes/*.zip-snapshot.*` só para referência —
não são mais usadas pelo app.

`docs/archive/anexos/` tem PDFs, screenshots (`pasted_file_*.png`) e
relatórios de diagnóstico (`.md`) que eram anexos de conversas, sem valor
de código — mantidos só como histórico.

**Não use nada dentro de `docs/archive/` como fonte de verdade.** Se
precisar investigar uma decisão antiga, é aí que está, mas o código ativo
é sempre o que está fora dessa pasta.

## Pontas soltas conhecidas (não introduzidas por esta reorganização)

- `docs/archive/versoes-divergentes/0003_aromatic_lilith.sql` é uma migration
  órfã (o número 0003 colide com uma migration já existente na sequência
  do Drizzle). Não aplique sem antes conferir contra `drizzle/schema.ts`.
- `npx tsc --noEmit` (rode assim, não `yarn check` — esse é o comando nativo
  do Yarn pra checar o lockfile, não o script `check` do `package.json`) não
  acusa erros de tipo (checado na Fase 6 do `docs/sprint-mubisys/`, 17/08/2026).
  Os protótipos mortos citados em versões anteriores desta nota
  (`server/sync/heartbeat-sync-erp.ts`, `server/routers/logistica-refactor.ts`)
  não existem mais no repo.
- **A API pública do MubiSys não expõe composição de produto** (testado ao
  vivo em 28/09/2026 contra `produto/{id}` e `materia-prima/{id}`): o
  cadastro básico do produto (`produto`/`produto/{id}`, com `modelos[]` e
  `variacoes[]`) e o custo da matéria-prima (`materia-prima`/
  `materia-prima/{id}`, campo `valor_custo`) existem, mas o vínculo
  produto↔matéria-prima com quantidade/unidade de consumo só existe na tela
  logada do MubiSys, via AJAX interno
  (`index.php?modulo=matModelos&acao=cadastrados`, autenticado por sessão de
  usuário, não pelo `Access-Token`). O **CPQ Letreiros Express** agora tem
  conexão opcional pelo formulário da própria tela: a senha é transitória;
  a sessão fica cifrada com AES-256-GCM em cookie `HttpOnly` por até 8 horas,
  por navegador, sem persistência no banco. O catálogo do CPQ lê as
  variações pela API pública e tenta importar a ficha da variação/modelo
  pelo AJAX interno; os custos continuam vindo ao vivo de
  `listarMateriasPrimas()`.
  No CPQ, a fórmula padrão acompanha a unidade de consumo da linha MubiSys
  e as medidas do nesting: área usa a área total das peças, consumo linear usa
  perímetro externo e demais unidades usam quantidade fixa; o vendedor pode
  trocar a fórmula no cadastro do kit. Se a sessão expirar, o formato interno
  mudar ou não houver composição para a variação, o fluxo preserva a composição
  manual do CPQ como fallback. A tela autenticada é uma interface interna e
  não oficial do MubiSys: alterações nela podem exigir ajuste do parser e a
  conexão deve ser validada com uma sessão real após publicar a mudança.
  O módulo **Produtos** (`client/src/pages/comercial/Produtos.tsx`,
  `server/routers/produtos.ts`, tabelas `produtos`/
  `produto_composicao_materiais`/`produto_kit_itens`) importa a ficha comum do
  modelo e as fichas de todas as variações pela mesma sessão; mostra
  quantidade, unidade e custo atual para revisão; e grava as linhas no banco
  local com id, nome e indicador padrão da variação. As unidades MubiSys são
  mapeadas para o enum local (`m2`, `ml`, `perimetro`, `unidade`) com
  possibilidade de ajuste antes de salvar. Cada linha continua podendo ser
  removida, e a ação "Clonar composição de outro produto" mantém o produto
  atual e substitui matérias-primas (incluindo seus vínculos de variação) e
  itens de kit por cópias de um produto de origem. O custo continua vindo ao
  vivo de `listarMateriasPrimas()`. Em Administração > Produtos, a aba
  Matérias-primas classifica o catálogo em categorias locais editáveis
  (Iluminação, Chapas, Insumos Gerais, Elétrica, Insumos Solda e, desde 06/10/2026 — migration `0093`, só um seed idempotente —, **Produtividade para soldar**, a mão de obra de solda: sem dados técnicos de chapa/bobina/perfil, e a classificação de material, tipo de solda e tamanho continua decidida pelo nome da matéria-prima, não pela categoria). Elas e os
  dados técnicos ficam nas tabelas `materia_prima_categorias` e
  `materia_prima_cadastros`; nomes, custos e unidades continuam vindo do
  MubiSys, que não oferece gravação pública para esses campos. Marcar uma
  categoria com `usa_dados_chapa` exige espessura, densidade e pelo menos um
  tamanho ativo, salvo como formato em `estudio_chapas` e normalizado para
  orientação horizontal. Categorias de perfil (migrations `0079` e `0081`) abrem altura, largura, espessura, comprimento e densidade, sem formatos; a densidade é digitada em g/cm³ e gravada em kg/m³ (×1000), e matérias-primas fora de chapa/perfil têm `peso_especifico_kg` (kg por unidade de consumo), base do cálculo de peso do letreiro, implementado no fim do orçamento do CPQ (`blocoPesoReal`, uso interno; chapa = área líquida × espessura × densidade, perfil = tubo oco, cantoneira (L) ou barra maciça conforme `perfil_formato`, migration `0084` (padrão tubo; a barra dispensa espessura), demais = quantidade × peso específico; itens sem dado ficam destacados). Espessura é digitada em mm ou µm e gravada em mm; bobina tem só altura (largura do rolo) e espessura. Gestor, admin e master podem editar categorias e
  especificações. **Produtividade (pedido de 05/10/2026):** matérias-primas cujo nome contém "produtividade"
  (exceto "Produtividade Geral …", ex.: #4373 Hora; 42 no catálogo de 05/10/2026) ganham no diálogo de edição uma
  subclassificação interna, independente da categoria: até 3 tipos de solda (barra roscada, patinha para LED,
  chapinha dupla-face, orelhinha, sem fixação — esta não combina com as outras), o tamanho (≤ 11 cm e/ou > 11 cm) e os
  materiais a que a solda se aplica (inox, galvanizado, latão, acrílico, alumínio; multisseleção sem limite).
  **Cada um dos três grupos aceita mais de uma marcação** (tipo de solda até 3; material e tamanho sem limite): uma produtividade
  que serve aos dois tamanhos recebe os dois, e o motor de solda a considera válida para as duas faixas (pontua menos que a
  marca exata de uma faixa).
  Ficam em `materia_prima_cadastros.produtividade_tipos_solda` (`text[]`), `produtividade_tamanhos` (`text[]`, migration `0092`; substitui `produtividade_tamanho` da migration `0089`, cujos valores a 0092 copiou) e
  `produtividade_materiais` (`text[]`, migration `0090`). A coluna antiga `produtividade_tamanho` continua no banco e no
  `schema.ts` só como **legado** (nada a lê nem grava); remova-a numa migration futura, depois que nenhum deploy anterior a use;
  regras e rótulos em `shared/produtividade-solda.ts`; o servidor valida e decide pelo nome vindo do catálogo
  (`ehMateriaProdutividade`), ignorando o que vier para as demais. A página 5 da Tabela de Preços, Produtividades de solda, consulta o catálogo do MubiSys e permite filtrar e editar classificações de
  material, tipo de solda e tamanho. A classificação é manual (não deduzida do texto do nome); nenhum cálculo de custo ou
  preço lê esses campos ainda. **Estilo do letreiro (pedido de 06/10/2026, migration `0095`):** quatro grupos a mais, também
  de marcação múltipla — categoria (Frontlight ou Tradicionais), aro (normal ou recuado; só existe junto de Frontlight, e o servidor
  recusa aro sem ele), formato (cursiva ou tradicional) e fundo (com ou sem fundo) —, em `materia_prima_cadastros.produtividade_categorias`,
  `produtividade_aros`, `produtividade_formatos` e `produtividade_fundos` (`text[]`). Filtros (o de aro só aparece com Frontlight
  escolhido), coluna "Estilo" e edição estão na página 5 da Tabela de Preços e no cadastro de Produtos > Matérias-primas; os campos são
  opcionais no `salvar`/`produtividadeClassificacaoSalvar` (tela antiga que não os envia não apaga o que está marcado). O motor de
  escolha de solda do CPQ **ainda não lê** esses quatro grupos (continua usando o nome/título para cursivo, aro recuado e frontlight): ligá-los
  ao `sugerirProdutividades` é o passo seguinte. **Produtividades relacionadas ao produto (pedido de 06/10/2026):** no editor de produto do
  CPQ (Administração > Produtos & kits), todo produto de categoria **Letreiros** tem a lista fechada "Produtividades de solda
  relacionadas", com marcação múltipla, filtro (nome, #código, tipo de solda, tamanho, material) e a classificação de cada
  produtividade. Os IDs ficam em `estudio_kits.dadosJson.produtividadesRelacionadas` (JSON, sem migration; salvo pela gravação
  automática do kit). O servidor (`server/routes/estudio-kits.ts`) só aceita a lista em produto de categoria Letreiros, sem
  repetidos, e só IDs que sejam produtividade no catálogo do MubiSys (`ehMateriaProdutividade`; o catálogo só é consultado
  para IDs recém-adicionados, e sem MubiSys a gravação com IDs novos responde 503). Trocar a categoria para fora de Letreiros pede
  confirmação e apaga a lista. A rota `GET /api/letra-caixa/materias-cadastro` devolve `produtividade` (tipos, tamanhos,
  materiais) por matéria-prima para o HTML mostrar os chips; as regras do HTML repetem as de `shared/produtividade-solda.ts`.
  O motor de escolha automática de solda lê esta lista como conjunto de candidatas. As condições comerciais armazenadas historicamente na página 5 são apresentadas na página 6; os registros do banco não são migrados. O PDF da tabela inclui a página 5 com custos atuais do MubiSys. O CPQ permite selecionar várias
  variações do modelo e soma a composição comum às linhas específicas
  escolhidas; salva as medidas do nesting e os materiais calculados no
  snapshot da cotação. Comercial > Propostas pode importar medidas de uma
  cotação salva no CPQ, permite ajustá-las manualmente, combinar
  variações e excluir materiais da composição daquele item.
  A ficha é lida pela interface interna não oficial do MubiSys. Mudanças no
  formato podem exigir ajuste no parser; valide a integração com sessão real
  após publicar. O campo `produtos.idPrecificacao`
  referencia um `id` de linha/regra da Tabela de Preços (ver
  `shared/price-table.ts`) só por número — não há resolução automática de
  qual coluna/faixa de valor usar ainda.
- **Aparência de matérias-primas para renderização 3D (pedido de 06/10/2026; migration `0094`):** em Administração > Produtos > Matérias-primas, cada item pode informar cor (HEX/descrição), textura (imagem de referência enviada ao UploadThing e descrição para IA) ou deixar a aparência sem informação, além de opacidade/translucidez/transparência e transmissão de luz. A foto é referência visual, não mapa PBR calibrado. A rota autenticada `POST /api/letra-caixa/materias-aparencia` aceita `{ materiaPrimaIds }` (até 300) e devolve um registro por ID, inclusive sem cadastro local (`cadastroDisponivel: false`), com aparência e cores/transparências de formatos de chapa; não retorna custos. `GET /api/letra-caixa/materias-cadastro` também inclui `aparencia`. O servidor aceita URLs de imagem apenas do UploadThing.
- **Módulo Proposta (cotação) é diferente de `crm_propostas`.** A tabela
  `crm_propostas` no schema é órfã — nenhum router lê/escreve nela; o "CRM
  de Propostas" (`client/src/pages/comercial/CRM.tsx`,
  `server/routers/crm.ts`) na verdade lê orçamentos ao vivo do MubiSys (sem
  lista de itens, só um `valor` total). O módulo **Propostas** novo
  (`client/src/pages/comercial/Propostas.tsx`,
  `server/routers/propostas.ts`, tabelas `propostas`/`proposta_itens`/
  `configuracoes_comerciais`) é outra coisa: uma cotação montada a partir do
  catálogo de Produtos, com link público (token em `propostas.token`, sem
  login) pro cliente ver, ligar/desligar item pra simular o valor (escolha
  persiste) e baixar PDF — decisão do usuário 28/09/2026. `precoUnitario`
  em `proposta_itens` é um snapshot manual (não recalcula automaticamente
  se o produto mudar depois — a margem da Tabela de Preços não é resolvida
  automaticamente, ver ponta solta do módulo Produtos acima).
  Cada linha de `proposta_itens` também tem `descricao`, texto livre por
  produto preenchido pelo vendedor, exibido no link público e no PDF.
  `proposta_itens.configuracaoJson` guarda, por item, as variações marcadas,
  o nesting de origem, suas medidas ajustáveis e as matérias-primas com
  fórmula, quantidade e custo calculados. Propostas importa nestings entre as
  cotações salvas do CPQ; o link público mostra os nomes das variações,
  sem revelar custos ou a composição interna.
  Produtos da mesma cotação podem ser associados por `grupoId` e ganhar uma
  `grupoDescricao` compartilhada: o cálculo interno mantém os componentes
  separados, enquanto o link público e o PDF mostram um único conjunto com
  valor agregado; o cliente ativa/desativa o conjunto inteiro.
  **Exceções abaixo do piso técnico**: o formulário consulta `precoPiso`
  antes de adicionar o item e abre a alçada quando o preço fica abaixo do
  cálculo do servidor. Só gestor, admin e master podem informar justificativa
  com pelo menos 10 caracteres. `itemAdicionar` e `itemAtualizar` recalculam
  o preço no servidor, emitem recibo assinado e gravam item e auditoria na
  mesma transação. A tabela `propostas_excecoes_margem` não tem operações de
  edição/exclusão; sua migration também bloqueia `UPDATE`, `DELETE` e
  `TRUNCATE` no banco.
  **Padrão de rota pública**: diferente do site espelho do Guia de
  Fornecedores (`server/routes/publico-guia-fornecedores.ts`, REST fora do
  tRPC por ser outro deploy Vercel/outra origem), a Proposta pública é
  servida pelo mesmo app React — usa `publicProcedure` do tRPC direto
  (`server/routers/propostas.ts`, sub-router `publico`) e a rota
  `/proposta/:token` tem um bypass dedicado no `AuthGate`
  (`client/src/App.tsx`), sem exigir sessão. Reaproveitar esse padrão
  (`publicProcedure` + bypass no `AuthGate`) para qualquer link público
  futuro dentro do próprio app — só usar o padrão REST+CORS do Guia de
  Fornecedores quando for de fato um domínio/deploy diferente. Exceção
  específica: o HTML estático do CPQ Letreiros Express não usa React/tRPC;
  suas cotações concluídas usam `/api/letra-caixa/cotacoes` no mesmo host,
  com sessão para criar/listar e token público para abrir a cotação e enviar
  a resposta do cliente. A cotação guarda o WhatsApp configurado para o
  vendedor; ao escolher uma reação, o link público abre `wa.me` com a resposta
  e o número da cotação preenchidos, sem enviar a mensagem automaticamente.
  No editor de kit (Administração > Produtos), as variações ativas do modelo vêm do MubiSys
  (`modelos[].variacoes[]`) e cada linha tem "Vale para" (`variacaoModeloId`, vazio = comum a todas); o
  orçamento filtra a composição do Radrasys pelas variações escolhidas.
  Precificação do cadastro do kit tem três modos: margem por faixa da Tabela de Preços, **% de lucro do
  produto** (`precificacao = {modo:'lucro', margemPct}`, margem sobre o preço: preço = custo ÷ (1 − lucro)) e
  preço fixo. Produtos vinculados ao kit (`kitProdutos`) guardam modelo e variação padrão
  (`variacaoPadraoId`); na cotação o vendedor troca modelo e variações de cada um (`REAL.kitProdutosSel`) e as
  matérias-primas deles entram em `REAL.kit` com `origemKitProduto`. Esses itens não passam por papel/nesting
  próprio: usam as fórmulas simples sobre a geometria do produto principal.
  **Base de cobrança do produto (pedido de 06/10/2026):** o cadastro do kit (Administração > Produtos) tem "Como este
  produto é cobrado" — `estudio_kits.dadosJson.baseCobranca` (sem migration; `shared/base-cobranca-produto.ts`, validada em
  `estudio-kits.ts`, lista repetida em `BASES_COBRANCA_PRODUTO` do HTML, conferida por `kit-base-cobranca.test.ts`): área líquida,
  área do nesting, área geral, perímetro externo, perímetro total ou unidade, as mesmas fórmulas das matérias-primas. Com a base
  definida, cada linha da composição é a quantidade **por unidade da base** (ex.: LED = módulos por m² de área líquida × custo atual
  da matéria-prima) e as linhas novas já nascem com essa fórmula; trocar a base oferece reaplicá-la às linhas existentes, e a
  linha com outra fórmula fica marcada "≠ base do produto". É só uma base padrão para o cadastro: o que vai ao orçamento continua
  sendo o `formulaType` de cada linha (nenhuma fórmula nova no snapshot/servidor de cotações). Vale para qualquer produto, inclusive
  os de categoria Pintura, **mas o assistente de pintura do orçamento (`resolverItensPintura`) continua escolhendo matérias-primas
  por nome, não lê os produtos cadastrados**. A API do MubiSys não traz custo por variação (`valor_final` das variações da
  Iluminação LED, produto 208, é 0): o custo de cada variação vem das matérias-primas ligadas a ela em "Vale para". Produto vinculado
  ao kit sem nenhuma linha de composição avisa no passo de Composição que nada será somado (antes somava zero em silêncio).
  **Gabarito de Fixação (MubiSys produto 127, pedido de 05/10/2026):** entra automaticamente no kit de todo
  produto (`kitProdutosPadrao`, slot implícito `127_570` = modelo Kraft), com checkbox para excluir
  (`REAL.gabaritoAtivo`) e troca de modelo na cotação (MDF/Eucadur e Papelão Onda B usam a composição normal).
  No kraft (#1098, bobina de 1200 mm), `formulaType: "gabaritoKraft"` cobra faixas × 1,2 m × largura do letreiro
  aberto na prancha, com faixas = ceil(altura ÷ 1200 mm); regra em `shared/gabarito.ts` e repetida em
  `FORMULA_TYPES` do HTML, validada no servidor (`estudio-cotacoes.ts`). O custo é por m² de bobina; a base de
  cobrança real do #1098 (m²/ml/rolo) ainda não é lida pelo CPQ, então confira no cadastro da bobina.
  **A composição só aparece depois do nesting** (pedido de 05/10/2026): o fluxo é Nesting (6) → Composição (7) →
  Orçamento (8), e o passo da Proposta mostra só um aviso curto (`renderComposicaoDoModelo`), sem lista de matérias-primas,
  produtos do kit nem variações — tudo isso é conferido e ajustado no passo 7.
  No passo de Composição o vendedor também acrescenta/remove produtos do kit (busca + modelo/variações, `htmlProdutosDoKit` no HTML do CPQ) e liga/desliga a embalagem. O passo de Nesting só mostra as chapas da composição e roda sozinho: a análise de cores (sem perguntas; padrões: sem iluminação, vinil branco, face acrílica detectada pelo kit, sem laminação) e a aprovação automática acontecem em segundo plano (`iniciarNestingAutomatico` no HTML do CPQ), sem parar: quando não há chapa de acrílico equivalente (ΔE00 ≤ 2), entra acrílico transparente + adesivo Imprimax e o cliente é avisado (`htmlAvisoCoresAutomaticas`, nos passos de Nesting e Composição; o cliente envia `autorizaAdesivoSobreAcrilico: true` sozinho, decisão do usuário 05/10/2026, que substitui a autorização manual abaixo). As linhas de adesivo aparecem na tabela da Composição (`htmlLinhasAdesivoComposicao`) só como exibição: o custo já entra no orçamento por `custoMateriaisCorTotal`, não em `REAL.kit`. A caixa de Pintura fica no passo de Composição.
  **Regra de pendência das cores (pedido de 05/10/2026):** se a análise de cores sugere adesivo, ele **entra na
  Composição** mesmo quando o custo não fecha (bobina/preço do vinil sem cadastro) — nunca é descartado nem vira
  custo zero. `aprovarCoresESeguirReal` aplica a face/adesivo, tenta aprovar e, se o servidor recusar, guarda a
  mensagem em `colorAnalysis.pendenciaAprovacao` e **roda o nesting do mesmo jeito**. `htmlPendenciasCores` destaca o
  problema (passos Nesting, Composição e Orçamento) com as opções de decisão e o botão "Refazer análise de cores e
  nesting"; `resumoCustoCoresReal` conta a pendência com ou sem aprovação, o que bloqueia aprovar o preço, e o servidor
  continua exigindo o mapeamento aprovado para emitir.
  **Cores da face indicadas no desenho (pedido de 06/10/2026):** a leitura automática das cores pode errar (ex.: letras brancas
  redesenhadas em preto, lidas como #000000). Na **Ficha técnica (passo 5)** o cartão "Cores da face" (`htmlCartaoCoresFace`, `#cores-face-card`)
  mostra a face com cada peça clicável: o vendedor seleciona peças (clique, "Selecionar" por cor ou "Selecionar todas") e indica a cor
  por paleta (uma cor por matéria-prima de chapa com cor cadastrada, `GET /api/letra-caixa/cores/paleta`), pelas cores do desenho ou por
  seletor livre. A cor é por **caminho do SVG** (mesma numeração do servidor: todo `<path>` fora de `<defs>`, de 0 em diante; o Vectorizer.AI
  dá um caminho por forma — `group_by=none` —, o traçador local junta as formas de uma cor num caminho só). `REAL.coresFace.mapa` guarda as
  indicações, amarradas à assinatura da arte (`assinaturaSvgArte`: outra arte descarta). Elas vão em `coresManuais` para
  `POST /api/letra-caixa/cores/analisar-svg` (`aplicarCoresManuais` em `cpqCoresMateriais.ts`: o caminho vira região sólida da cor
  indicada, sem Pantone/CMYK/degradê, e a região ganha o aviso "Cor indicada pelo vendedor…" no snapshot). O servidor então casa o acrílico mais
  parecido como antes, e **cada cor de acrílico vira uma matéria-prima na Face, com o seu próprio nesting; o fundo (PVC) sempre cobre
  o letreiro inteiro** (deriva de todas as peças da camada Face, não só das de uma cor) — coberto por `cpq-duas-cores-nesting.test.ts`.
  Mudar uma cor invalida a análise de cores, o nesting e as aprovações dependentes (`aoMudarCoresFace`).
  **Troca do material sugerido (mesma data):** no aviso do passo Nesting (`htmlAvisoCoresAutomaticas(true)`) cada cor sólida tem o menu
  "Trocar o material desta cor" (chapas por matéria-prima, adesivos Imprimax e adesivo impresso; `listarOpcoesCor`, devolvido em `opcoes` ao lado
  de `resultados`, **fora** do snapshot). A escolha segue em `escolhas` (`{regionKey, corHex, tipo, id}`, casada por chave **e** cor) e o
  servidor a valida (`CpqEscolhaCorInvalida`: material inativo, ou incompatível com a iluminação — transmissão zero/abaixo do mínimo; sem
  transmissão cadastrada fica escolhível **com aviso**): inválida cai na sugestão automática com aviso, sem derrubar a análise. O resultado
  traz `escolhaManual: true` (também em `estudio_mapeamento_cores_cotacao.detalhes_json` e no schema/validação do snapshot, opcional sem default), e
  a lista `alternativas` continua com no máximo 5 itens, com a escolhida sempre dentro. No passo Composição o aviso é só leitura.
  **Embalagem Acabamento (MubiSys #4258, pedido de 05/10/2026):** item especial do CPQ, incluído em toda
  cotação e removível pelo vendedor (checkbox no Resumo financeiro). Não tem consumo: cobra 3,5% sobre o
  preço de todos os outros itens (`EMBALAGEM_PCT`/`aplicarEmbalagem` no HTML); o snapshot guarda
  `embalagemPct`/`embalagemValor` e `estudio-cotacoes.ts` confere a fórmula. **Ainda não existe em
  Comercial > Propostas** (módulo React).
  Em Administração > Configurações, formas de pagamento e as taxas totais do
  cartão por plano (1x a 6x) ficam em `config/geral`. Cada cotação salva um
  snapshot das opções e taxas: o link começa em PIX dividido em duas partes
  iguais (50% + 50%), permite simular cartão, boleto e TED/DOC conforme
  habilitados, e inclui a condição escolhida na mensagem do WhatsApp e na
  resposta registrada para o vendedor.
  O catálogo do CPQ deriva um SKU Radrasys determinístico do ID MubiSys de
  cada produto (`SKU-000123`) e compõe um SKU de modelo com o ID da variante
  (`SKU-000123-M007`); os dois aparecem no fluxo e podem ser buscados na
  Administração. Não há coluna nova no banco, pois os códigos derivam dos IDs
  já estáveis do catálogo.
  A composição e descrição comercial são configuradas por produto/modelo no
  cadastro de kit e gravadas em `estudio_kits` no Postgres. A descrição é
  pré-preenchida na proposta do vendedor; o snapshot público registra o texto
  final da cotação.
  O cadastro de kit também permite clonar a composição e os produtos vinculados
  de outro modelo. Cada linha de matéria-prima pode ter opções de variação e
  uma opção padrão para novos orçamentos; “Nenhuma” mantém o material
  principal. A busca inclui matérias-primas de todas as unidades. Ao cadastrar
  uma opção com unidade diferente, o editor avisa que o orçamento usará a
  quantidade calculada sem conversão automática. O vendedor pode trocar a
  escolha em cada orçamento, recalculando o custo sem alterar o padrão salvo.
  O snapshot da cotação pública salva e exibe as variações escolhidas.
  No cadastro do cliente do CPQ, razão social/fantasia/endereço vêm da
  consulta de CNPJ, enquanto e-mail e WhatsApp são informados manualmente e
  incluídos no snapshot da cotação; os campos de contato da API são ignorados.
  Para CPF, o nome informado manualmente também preenche o nome fantasia.
  O cliente é salvo em `estudio_clientes` quando inicia e conclui uma cotação,
  pode ser localizado pelo CPF/CNPJ no próximo cadastro e é listado na aba
  Clientes da Administração. Cotações antigas alimentam essa base na migration
  de criação da tabela.
  Na etapa raster → SVG do CPQ, a foto passa obrigatoriamente pela reconstrução
  com GPT Image no servidor antes do Vectorizer.AI. Para “somente logo”, a
  chamada inclui `docs/prompts/prompt-1b-extracao-logo-vetorizacao.md`; o usuário
  revisa e aprova a imagem antes da vetorização. Um ticket HMAC com `JWT_SECRET`
  vincula o usuário e o hash SHA-256 do PNG à rota `/api/letra-caixa/vetorizacao`
  e expira em 30 minutos. Após uma vetorização bem-sucedida, outro ticket permite
  rasterizar edições do SVG no editor e vetorizar novamente. Configure
  `VECTORIZER_API_ID` e `VECTORIZER_API_SECRET`; a produção cobra 1 crédito por
  chamada. SVG já vetorizado passa direto. No passo raster → SVG, o CPQ aplica
  o Prompt 2: normaliza caminhos vetoriais para preenchimento branco e contorno
  preto; rejeita raster, texto, formas fora de caminho, transforms, recursos
  externos, duplicados e contornos abertos; e compara a silhueta rasterizada
  com a arte aprovada em 1024 px (aprovado: IoU ≥ 95% ou, aceitando diferença de borda de ~0,4%, ≥ 97%, com
  variação de proporção e deslocamento ≤ 1%; revisão manual do vendedor: IoU ≥ 85%, proporção ≤ 3% e deslocamento
  ≤ 2%; abaixo disso, bloqueado. A faixa manual é de 05/10/2026: o limite único de 95% reprovava vetorizações
  boas de letras finas). Sobreposição, mapa de diferenças, preview PNG e relatório
  podem ser baixados. O nesting local só é liberado após passar nos limites e
  o vendedor confirmar letras, símbolo e isolamento. SVG recebido sem bitmap
  de referência exige a mesma revisão manual, com validação estrutural. Após
  receber o SVG, o CPQ calcula caminhos e nesting localmente (não há API
  externa de nesting configurada), e ainda exige confirmação de escala física.
  Cada cotação mantém seu snapshot em `propostas.observacoes` com o prefixo
  `[ESTUDIO_COTACAO_V1]`; esses snapshots são excluídos da lista do módulo
  comercial Propostas.
  Em 03/10/2026, ambos os fluxos ganharam análise consultiva de preço com
  `gpt-5-mini` e aprovação humana obrigatória: novo item de Propostas e link
  final do CPQ exigem assinatura de preço aprovada por `gestor`, `admin` ou
  `master`. O recibo HMAC usa `JWT_SECRET`, registra o aprovador no snapshot e
  fica vinculado aos custos, medidas, composição e preço base; mudanças nesses
  dados exigem nova aprovação. Sugestão GPT expira em 20 minutos e aprovação
  em 7 dias. O modelo não consulta mercado nem determina o preço final. O
  servidor confere subtotais e fórmula enviados, mas ainda não reconsulta toda
  a composição/custo do MubiSys nem resolve a margem da Tabela de Preços; a
  centralização completa do cálculo segue no plano
  `docs/configurador-inteligente-vendas.md`.
- **Nomenclatura "Gemini" sobrevivendo na UI e em nomes de campo**, apesar de
  o LLM já ser 100% OpenAI desde a Fase 1 do `docs/sprint-saida-forge`:
  `geminiAnswer`/`geminiAnswerIsGeneral` (`server/routers.ts`,
  `client/src/pages/operacoes/Conhecimento.tsx`), o enum
  `z.enum(["gemini", "manual"])` em `server/routers.ts`, e textos "Powered by
  Gemini"/"Gemini está analisando..." em
  `client/src/pages/logistica/InsightsLogistica.tsx` e
  `client/src/pages/operacoes/SugestoesConhecimento.tsx`. Não é integração
  ativa (não chama SDK/API do Gemini) — é só nome/copy que ficou pra trás.
  Fora do escopo da Fase 7 (que tratava só de módulos/env/config mortos do
  Forge); renomear é tarefa separada, cuidado com o enum `"gemini"` que pode
  estar persistido em dados existentes.
- **Sem rate limiting de aplicação quando roda na Vercel.** O
  `express-rate-limit` de `server/_core/app.ts` fica atrás de um
  `if (!IS_SERVERLESS)`: o MemoryStore dele conta por processo, e em
  serverless isso significa um contador por instância — limite efetivo
  indeterminado e reset a cada cold start. Foi uma decisão consciente da
  `docs/sprint-migracao-vercel` (Fase 4), não um esquecimento. No `yarn dev` /
  `yarn start` o rate limiting continua ativo e inalterado (300 req/min geral,
  10/min em sign-in e sign-up). Para reativar em produção seria preciso um
  store distribuído (Redis) ou regra de firewall na Vercel — nenhum dos dois
  está implementado.
- **Pré-processamento e redesenho de letra caixa via GPT Image ainda sem validação real.**
  `client/public/cpq-letreiros-express.html` chama a rota autenticada
  `POST /api/letra-caixa/redesenho`; a chave OpenAI fica no servidor. A
  reconstrução é obrigatória para raster antes da rota do Vectorizer; no escopo
  “somente logo”, o serviço concatena Prompt 1B. O fluxo usa
  `server/services/letraCaixaRedesign.ts` e `generateImageEdit`
  (`server/_core/llm.ts`), endpoint `/v1/images/edits`, modelo
  `gpt-image-2.5-sunburst`, qualidade `xhigh`, tamanho automático e saída PNG.
  Em 28/09/2026 a chamada real devolveu 429 `insufficient_quota`; em
  05/10/2026, já com crédito, o endpoint aceitou a foto principal + 2 imagens
  extras (arte sintética, qualidade `low`), mas ainda falta uma reconstrução
  real em `xhigh` com uma foto de fachada.
  **Referências adicionais da mesma logo (05/10/2026):** o passo da foto aceita
  até 2 imagens extras (site oficial, rede social, papelaria, outra) escolhidas
  pelo vendedor; nada é buscado na internet (o Prompt 1 §12 proíbe busca
  automática e a chamada não tem ferramenta web). Com extras, o navegador reduz
  as imagens (JPEG; principal ≤ 1,3 MB, extras ≤ 0,8 MB — o corpo na Vercel é
  limitado a 4,5 MB) e envia JSON para `POST /api/letra-caixa/redesenho-referencias`
  (`server/services/cpqReferenciasLogo.ts` valida bytes/tipo e monta a instrução:
  a foto principal manda na versão da logo, extras só tiram dúvidas e versões
  diferentes não se misturam). Sem extras, o fluxo antigo (`/redesenho`, corpo
  binário) segue igual. Ambas as rotas devolvem o mesmo ticket `X-Redesenho-Token`.
- **Geometria dos Prompts 2 e 3 do CPQ ainda exige validação de engenharia.** Os
  PDFs do usuário foram transcritos em `docs/prompts/prompt-2-vetorizacao.md` e
  `docs/prompts/prompt-3-area-perimetro-prancha.md`. Raster aprovado é enviado
  pelo servidor ao Vectorizer.AI e o SVG de caminhos volta para o navegador,
  que calcula medidas e prancha. Configure `VECTORIZER_API_ID` e
  `VECTORIZER_API_SECRET`; produção cobra 1 crédito por chamada. A integração
  ainda precisa de uma vetorização real para validar o parser e a geometria. A
  área é aproximada por amostragem; caixas de peças que se cruzam geram aviso,
  pois o protótipo não faz união booleana de formas sobrepostas.
  **Altura dos elementos na Ficha técnica (pedido de 05/10/2026):** o passo 5 do CPQ
  (`painelAlturaElementos`, `classificarAlturasElementos` no HTML) conta quantos
  elementos têm até 11 cm e quantos têm mais de 11 cm de altura vertical, com
  desenho numerado e tabela por elemento. Elemento = contorno externo de
  `REAL.geomRaw.pieces` (o ponto do "i" e acentos contam à parte; letras coladas
  pelo vetorizador contam como um só); altura = caixa envolvente da peça na
  escala física, comparada em mm inteiros (110,4 mm ainda é "até 11 cm"); peça a
  até 5 mm do limite recebe aviso, por causa da tolerância de ±1% da escala. O
  objetivo é alimentar as linhas "Produtividade Solda" por tamanho
  (`shared/produtividade-solda.ts`): `contagemElementosPorAltura()` devolve
  `{ate, acima}` para isso, mas **a ligação com a composição/orçamento ainda não
  existe** — a contagem só é exibida e não entra no snapshot da cotação.
  **Produtividade de solda automática (pedido de 06/10/2026):** o vendedor escolhe só o tipo de
  fixação (etapa 1); o sistema escolhe as "Produtividade Solda …" na Ficha técnica e as acrescenta ao orçamento,
  quantificadas pelo **perímetro total (externo + vazados, em metros) de cada faixa de altura** (≤ 11 cm e > 11 cm).
  O produto não cadastra produtividade na composição. O motor é puro, em `server/services/cpqSoldaProdutividade.ts`:
  `detectarMaterialLetreiro` (subcategoria do kit > tipo do produto > título > composição; divergência só informa) e
  `sugerirProdutividades` (tamanho como filtro — marca exata da faixa +30, marcada para os dois tamanhos +20, outra faixa exclui —, fixação por **igualdade de conjunto**, material e estilo — cursivo, aro
  recuado, frontlight, F/F… — pelo título/tipo contra o nome, devolvendo motivos e confiança alta/média/baixa; **regras
  treinadas vencem a heurística**). As candidatas são as produtividades relacionadas ao produto
  (`estudio_kits.dadosJson.produtividadesRelacionadas`) ou, se não houver nenhuma, todo o cadastro. Rotas em
  `server/routes/estudio-solda-produtividade.ts` (`/api/letra-caixa/solda/*`): `sugerir` e `correcoes` (o vendedor trocou a
  sugestão) para qualquer usuário logado; `regras`, `correcoes` (listar, descartar, virar regra) e `simular` só para
  gestor/admin/master. Tabelas `cpq_solda_regras` e `cpq_solda_correcoes` (migration `0091`); uma regra exige ao menos uma
  condição e a fixação dela é um conjunto exato. A unidade da produtividade no MubiSys não é conferida: a quantidade é o
  perímetro em metros (só avisa se a unidade for hora ou área).
  **No CPQ (HTML):** `REAL.tiposFixacao` na etapa 1 (`htmlFixacaoSolda`; até 3, "sem fixação" exclusivo; **obrigatório só
  quando `adminState.kits[chave].categoria === 'Letreiros'`**). `classifyGeometry` guarda `len` de peças e contornos e
  `classificarAlturasElementos` soma o perímetro de cada elemento (contorno + vazados) por faixa
  (`perimetrosPorAltura`). `garantirSugestaoSolda` consulta `/solda/sugerir` quando o pedido muda (mesmo padrão do peso: a
  chave é o próprio pedido) e `painelSoldaProdutividade` aparece na Ficha técnica e na Composição, com material (detectado ou
  escolhido), troca de produtividade por faixa, motivos, confiança e custo. As linhas entram em `REAL.kit`
  (`origemSoldaAuto`) com as fórmulas `soldaPerimAte11`/`soldaPerimAcima11` quando a Ficha técnica é confirmada, e **no
  snapshot viram `fixo` com a quantidade já calculada** (`formulaParaServidor`), então `estudio-cotacoes.ts` e a importação
  em Propostas não conhecem a fórmula nova; o resumo da escolha vai em `soldaProdutividade` e a fixação em `tiposFixacao`
  (ambos `.optional()` **sem default**, para não mudar a assinatura de cotações antigas). Remover a linha automática a
  dispensa até "Refazer sugestão"; produtividade ausente, ambígua ou removida **só avisa** (Composição e Orçamento), não
  bloqueia. A troca do vendedor é enviada como correção ao confirmar a composição (uma vez por combinação). Mão de obra de
  solda fica fora do peso.
  **Configurador (treino):** Administração > Produtividades de solda (`adminSolda`, `soldaAdmin` no HTML; as rotas exigem
  gestor/admin/master e a tela só mostra o erro do servidor). Três seções: correções pendentes (transformar em regra,
  escolhendo quais condições do contexto entram — material, fixação, faixa, tipo do produto — mais palavras do título e
  prioridade; ou descartar), regras (criar, editar, ativar/desativar, excluir) e simulador (o que o sistema escolheria, com
  motivos e alternativas). Regra nova é o jeito de corrigir um erro recorrente: a primeira que combina vence a pontuação.

## CPQ nesting backend

`server/routes/estudio-nesting.ts` exposes authenticated `POST /api/letra-caixa/nesting`
and manager-only CRUD for chapa formats at `/api/letra-caixa/chapas`. Chapa dimensions
are stored in local Postgres table `estudio_chapas`, keyed by MubiSys raw-material ID;
the MubiSys API supplies the current material name and cost, but not sheet dimensions.
Migration `0064_narrow_strong_guy.sql` creates this table. Format rows must be entered
before the material can be nested. Migration `0065_clammy_roulette.sql` adds
the preferred-board flag and stores the CPQ proposal title and reference/redesign
image URLs.

**Motor de nesting (decisão de 05/10/2026):** `executarMotor` em `server/services/cpqNesting.ts` escolhe, nesta ordem,
(1) serviço Deepnest remoto (`DEEPNEST_REMOTE_URL` + `DEEPNEST_REMOTE_TOKEN`; o serviço é
`server/scripts/cpq-deepnest-service.mjs`, que embrulha o worker abaixo e roda numa máquina com o Deepnest),
(2) Deepnest local (`DEEPNEST_NODE_BIN`/`DEEPNEST_NODE_ENTRY`) e (3) o **motor interno**
(`server/services/cpqNestingInterno.ts`, roda em qualquer servidor, inclusive Vercel; calcula dois empacotamentos e fica
com o de menor consumo: caixas giradas de 5 em 5° com MaxRects, e **contorno real** em `cpqNestingRaster.ts` — máscara
de células conservadora por peça e ângulo (4 lados + alinhamento da maior aresta), posição mais à esquerda/abaixo,
avançando pelo comprimento da chapa como quem fatia um pão; peças pequenas entram nos vazados das grandes; espaçamento
respeitado (verificado por geometria em `cpq-nesting-contorno.test.ts`); prazo de 12 s por chamada, depois vale o de
caixas). Entre as duas orientações da mesma chapa vale a de **menor consumo** (antes escolhia a de maior). É uma
estimativa conservadora (máscara até 1 célula maior por borda).
**Política de corte por matéria-prima (pedido de 05/10/2026):** `materia_prima_cadastros` (migration `0088`) ganhou
`processo_corte` (laser/router/plasma/faca), `rotacao_permitida` (`livre` | `veio`), `espacamento_mm` e `margem_borda_mm`; edita-se
em Administração > Produtos > Matérias-primas (**só chapa**: por decisão do usuário em 06/10/2026 bobina e perfil não têm o bloco "Corte e encaixe (nesting)"; salvar uma bobina zera esses campos). Precedência de espaçamento/margem: valor próprio > padrão
do processo > padrão do orçamento (`shared/politica-corte.ts`, resolvido no servidor por `carregarPoliticaCorte`). **Só o material
escovado tem regra de rotação**: `veio` limita as peças a 0° e 180° (motor interno e `rotations: 2` no Deepnest local/remoto);
os demais ficam `livre`, como sempre. A margem própria vale também na factibilidade (`CpqFactibilidadeMaterial.margemBordaMm`)
e cada resultado do nesting traz `espacamento_pecas_mm`, `margem_borda_mm`, `processo_corte` e `rotacao_permitida`. Valores
iniciais dos processos são pontos de partida (laser 3/8, router 8/12, plasma 10/20, faca 3/5 mm), não normas.
**Auditoria do nesting (05/10/2026):** (1) no escovado a **chapa também não vira 90°** (`orientacoesChapa`): virar a chapa
giraria as peças 90° em relação ao veio, que corre pelo lado maior; só vale a orientação com o lado maior em X, e a factibilidade
recebe a mesma regra (`CpqFactibilidadeMaterial.rotacao`: a peça não gira 90° e a emenda também não). (2) Na **bobina a peça gira 90°**
(só o rolo não gira): antes a factibilidade tratava uma peça mais alta que o rolo como "não cabe" e pedia emenda/redução mesmo
cabendo deitada. (3) Antes de chamar o motor, `verificarPecasCabemNaAreaUtil` recusa com aviso claro (peça, medida, área útil =
formato − 2×margem, o que fazer) a peça que **não cabe em ângulo nenhum** (menor largura da envoltória convexa contra a menor
dimensão útil; no escovado, a caixa a 0°/180°); o que passa dali ainda pode falhar por causa do espaçamento e o motor explica.
(4) **Perfil nunca entra no nesting** (regra do usuário, 05/10/2026): o consumo dele vem do perímetro já medido na prancha técnica. O HTML já
só envia chapa/bobina com formato; o servidor agora também recusa (422) perfil em `POST /api/letra-caixa/nesting` e na factibilidade, e o
cadastro legado de formato (`/api/letra-caixa/chapas`) responde 409 para matéria-prima de perfil (`server/db/materiaPerfil.ts`).
Como o cadastro nem sempre está classificado como perfil (o servidor só reconhece a categoria), o HTML também deixa de fora a linha cujo
**papel ou nome da matéria-prima tem a palavra "perfil"** (`linhaEhPerfil`, fix de 06/10/2026): um perfil com formato antigo em
`estudio_chapas` entrava como camada `aro` sem contornos no SVG ("Não há contornos fechados nas camadas aro…") e derrubava o nesting inteiro.
**Emendas inteligentes (pedido de 05/10/2026):** peça maior que a chapa é fatiada por `clipToSheets`
(`cpqFactibilidadeFabricacao.ts`); as linhas de corte vão para o ponto de **menor material** (`limitesDeCorte`, janela de 70–100%
do tamanho útil; vãos entre letras e hastes finas), cada linha informa `materialCortadoMm` e o painel REQUER_APROVACAO_EMENDA
lista as linhas antes de qualquer corte — que só acontece depois da aprovação (gestor/admin/master, recibo assinado).
Corrigido na mesma mudança: o recorte antes partia de x=0 mesmo para peças deslocadas e **perdia material** (agora usa
coordenadas locais da peça). A posição vem da geometria, não de IA de visão (que não mede); uma IA poderia só comentar as opções.
**Prancha de nesting (pedido de 05/10/2026):** o resultado do nesting no CPQ segue o estilo da prancha técnica — uma prancha
1800×1120 por chapa (`pranchaNestingSvg`: título, desenho com cotas, bloco ocupado tracejado e painel RESULTADOS com material,
% da chapa utilizada, % com peças, áreas, **área líquida** e **perímetro de corte** calculados no navegador sobre o contorno das
peças posicionadas — `metricasChapaNesting`), tabela-resumo por material (`resumoNesting`), download em PNG (2400 px) e em SVG
em mm. **Carregar uma logo por vez** (pedido de 05/10/2026): o passo da foto, o envio de SVG e a escala avisam que a escala é
dimensionada logo por logo; outras logos do projeto entram em "Adicionar desenho" (`htmlAvisoUmaLogoPorVez`).
**Várias chapas (pedido de 05/10/2026):** se o desenho não cabe numa chapa de nenhum formato, `resultadoEmVariasChapas`
(`cpqNesting.ts`) distribui as peças em até 8 chapas do mesmo formato (o de menor consumo total), com a maior dimensão ao
longo do eixo X; o resultado é UM por material, com consumo e custo somados, `quantidade_chapas`, `chapaIndice` em cada
posicionamento, `escala_para_uma_chapa_pct` (estimativa pela área) e `instrucao_nao_coube`; o CPQ mostra uma vista por chapa
e baixa todas no SVG. Cada material é independente (`calcularNestingMultiMaterialParcial`): se um não coube nem assim, o outro
segue e a falha vem em `falhas` com o que fazer. Sem solução (peça maior que qualquer chapa) o erro `no_fit` diz o que fazer.
O
resultado traz `motor: "interno"` e o CPQ mostra o aviso. Remoto indisponível (rede/401/404/5xx) cai no interno;
falha de cálculo do Deepnest (tempo) continua sendo erro de motor. Nenhum fork do Deepnest com a API `nest(svgs,
onUpdate, opts)` que o worker espera foi encontrado/validado: o worker e o serviço só foram testados com motor
falso.

The nesting endpoint runs `server/scripts/cpq-deepnest-worker.mjs` with a separate
Node 20 executable (`DEEPNEST_NODE_BIN`) and a local Deepnest Node entry
(`DEEPNEST_NODE_ENTRY`). This isolates Deepnest's native addon from the Radrasys
Node 22 process. It requires a self-hosted server with the Deepnest checkout and
compiled addon; the current Vercel serverless deployment cannot execute this local
worker. Configure the two variables in `.env` only on a compatible self-hosted node.

The endpoint needs the approved SVG canvas width/height in millimeters and the IDs
of the selected sheet materials. It evaluates each active format in its registered
orientation and rotated 90 degrees (once for square sheets), then chooses the
smallest physical sheet area that returns a complete layout. Equal-area formats
prefer the principal format and then the lower ID. Material cost estimates do not
change sheet selection. `porcentagem_aproveitamento` is the placed-layout bounding-
box area divided by the total selected sheet area. `area_sobra_m2` and estimated
waste cost represent sheet area outside that bounding box; the bounding box is the
area treated as occupied/consumed. The worker translates the layout so its leftmost
X coordinate is zero.
Deepnest uses true-shape polygons, automatic contour containment for holes, gravity
placement, and 72 discrete rotations (5-degree increments). Cubic SVG paths are
polygonized with a 0.3 internal-unit tolerance (about 0.106 mm at the configured
scale), so area/perimeter are high-precision polygon approximations, not analytic
exact values. Cost is estimated only for recognized MubiSys cost units; unsupported
units or missing cost return an alert and null estimate. Fix de 06/10/2026: o
MubiSys manda "Unidade/Gl/Lt/Kg" como **rótulo genérico** de unidade de custo (Acrílico Branco 3mm #1134 e PVC 5/15/20/30 mm
vêm assim) e a base real está em `unidade_movimentacao`; para chapa, esse rótulo genérico passa a valer a unidade de
movimentação **quando ela é m²** (`unidadeCustoDaChapa` em `cpqNesting.ts`, `CpqMaterial.unidadeMovimentacao`; o resultado e
o recibo continuam com a `unidade_custo` original). Qualquer outra combinação segue pendente e bloqueia o "Confirmar nesting e
avançar" (`custosNestCompletos` no HTML) — a bobina continua pedindo a base de cobrança no cadastro.

**Bobinas (adesivo comum, papel kraft; pedido de 05/10/2026):** rolo tem só a largura
fixa (hoje 1200 mm nos dois); o comprimento nunca é cadastrado. Em Administração >
Produtos > Matérias-primas, categorias marcadas como "de bobina" (seed `Bobinas`,
migration `0078_bobinas_materias_primas.sql`; chapa e bobina são exclusivas) abrem só
largura(s) do rolo e espessura. A linha fica em `estudio_chapas` com
`bobina = true`, `altura_mm` = largura e `largura_mm` = teto de 50 000 mm
(`shared/bobina.ts`), então factibilidade e junção de propostas leem sem mudança; a
sugestão de cor (`estudio-cores.ts`) ignora bobinas. No nesting
(`calcularNestingMultiMaterial`) a bobina não gira, o motor recebe um comprimento
finito (folga sobre a área das peças, repetindo com o teto se não fechar) e o consumo é
o comprimento realmente ocupado (bounding box em X, arredondado para cima). O cobrado é
largura × esse comprimento: `area_chapa_utilizada_m2` = faixa cobrada, `area_sobra_m2`
= faixa − área líquida, `porcentagem_aproveitamento` = área líquida / faixa, e `chapa`
= `{largura_mm: comprimento consumido, altura_mm: largura do rolo}`; o resultado traz
`formato: "bobina"`, `comprimento_consumido_mm` e `largura_bobina_mm`. Custo em m² usa
a faixa cobrada, em m/ml usa o comprimento consumido (não o perímetro); outra unidade
bloqueia com alerta. Com várias larguras vence a que cobra menos material. Margem
lateral de borda do rolo e o espaçamento entre peças vêm do padrão do orçamento (a bobina não tem política de corte própria desde 06/10/2026;
a margem vale nas duas bordas do rolo e no início/fim do comprimento consumido; o cadastro da bobina tem uma só largura, não há
"largura total × útil" separadas). Linhas de bobina gravadas antes disso podem ainda ter `margem_borda_mm`/`espacamento_mm`, que o
nesting continua lendo até a bobina ser salva de novo na tela. Dimensões
de material (largura, altura, espessura, comprimento) ficam sempre em mm; m²/m do
resultado e unidades de custo do MubiSys, e as métricas de produção em metros da
Operações (solda), seguem como estão. A bobina exige espessura (mm ou µm na tela) e densidade em g/cm³: o peso do letreiro usa área × espessura × densidade, como a chapa (sem densidade ou com fórmula que não é em área, cai no peso específico). A densidade é sempre g/cm³ na tela e kg/m³ no banco; o campo "peso específico" (kg por unidade de custo) NÃO é densidade e só aparece para categorias sem chapa, perfil ou bobina. A
base de cobrança do custo (`materia_prima_cadastros.bobina_custo_base`: `m2`, `ml` ou `rolo`, com
`bobina_comprimento_rolo_mm` para rolo; migration 0083) é obrigatória no cadastro da bobina e vale mais que a
unidade de custo do MubiSys (`server/db/bobinaCusto.ts` alimenta o nesting e a junção de propostas); sem ela, só
m² e metro linear se deduzem da unidade. O
worker real do Deepnest nunca devolve layout incompleto (só falha por tempo), então a
bobina repete com o teto também quando o motor dá erro. A rota antiga
`/api/letra-caixa/chapas` e a lista antiga de chapas do HTML do CPQ **não editam**
bobinas (PUT/DELETE em bobina e POST em matéria-prima de categoria bobina respondem 409;
a lista mostra "Bobina / Rolo"), e o resultado do nesting mostra "Bobina / Rolo".
O nesting de bobina **ainda não foi validado com o Deepnest real** (o ambiente de
desenvolvimento não o tem): rodar `server/scripts/validar-bobina-deepnest.ts` onde ele
existir. Checklist de produção (migrations 0078+, cadastro do kraft #1098 e do adesivo
comum, unidade de custo no MubiSys): `docs/cpq-bobinas-producao.md`.

**Cadastro de matérias-primas (05/10/2026):** cada matéria-prima mostra o selo **Atualizada / Incompleta / Sem
categoria** (regra única em `server/services/cpqCadastroMateria.ts`: categorizada e com os dados que a categoria
exige — chapa, bobina ou perfil — conta como atualizada; a "Produtividade …" com a classificação interna salva — tipo de
solda, tamanho ou material — também conta como atualizada, mesmo sem categoria, para o gestor ver o que já editou), no `listar` do tRPC (Produtos, com contadores e filtro)
e em `GET /api/letra-caixa/materias-cadastro` (lista da administração do CPQ). O diálogo de edição tem **Clonar
dados de outra matéria-prima**: preenche o formulário com categoria, espessura, densidade, formatos/larguras,
perfil e peso específico da origem (sem ids, nomes em branco, cor só se o vendedor marcar), sem salvar. `estudio_chapas.pantone_code` guarda até 6
referências Pantone separadas por vírgula (migration 0085; `separarPantones`/`normalizarListaPantone` em
`shared/pantone-referencia.ts` aceitam também "021 C  804 C", "+", "/", "e", "ou"). O casamento de cor
(`labsCatalogo` em `cpqCoresMateriais.ts`) considera cor hex, CMYK e cada Pantone da lista e usa a mais próxima
(ΔE00); código fora da tabela de amostras (ex.: 804 C) só casa pelo código exato da arte.

`server/services/cpqFactibilidadeFabricacao.ts` contains the geometry checks for
sheet fit and oversized-piece seams. The authenticated
`server/routes/estudio-factibilidade.ts` route calls it before nesting and records
the decision receipt for approved seams or reductions.

`server/services/cpqCoresMateriais.ts` extracts color regions and ranks material
matches with CIEDE2000. The authenticated `server/routes/estudio-cores.ts` route
loads local sheet and Imprimax color catalogs, persists the per-quote analysis,
and records human approval. Color analysis is required before factibility; unknown
print costs block price approval and quote issuance. Migration
`0068_estudio_cores.sql` adds its catalog, pricing and quote-mapping tables plus
optional Pantone/CMYK/light-transmission fields on sheet formats. Migration
`0069_abnormal_avengers.sql` records the light transmission of white and transparent
print-vinyl bases. Provider catalog
data and print costs are maintained by managers; this service does not query an
Imprimax API.
Regras de cor definidas pelo usuário em 04/10/2026: arte sem cor sólida (gradiente/complexa) vira adesivo
impresso; cor sólida sem chapa de acrílico equivalente usa o adesivo Imprimax **mais próximo** (sempre, avisando o
vendedor quando o ΔE00 passa de 5). Nos dois casos, se a face for de acrílico (detectada pela linha Face do kit
ou escolhida na tela), a composição é **acrílico transparente + adesivo**, e o vendedor precisa marcar a
autorização na tela (o servidor recusa a aprovação sem `autorizaAdesivoSobreAcrilico`). O adesivo **impresso** é
cobrado com a dimensão do letreiro inteiro (união dos contornos da face, `caixaLetreiroMm`), uma única peça; o
Imprimax sólido segue por contorno. **Rolo padrão do adesivo (06/10/2026):** sem largura de bobina cadastrada em
`estudio_precos_impressao`, `calcularConsumosBobina` usa 1200 mm de largura por 5000 mm de comprimento
(`BOBINA_ADESIVO_PADRAO`, informado pelo usuário), com aviso em cada região; layout acima de 5000 mm bloqueia o consumo. O **custo continua
pendente** enquanto faltar o preço do vinil/impressão (nunca vira zero) e isso ainda impede aprovar o preço e emitir. **Desconsiderar adesivo
(06/10/2026):** a leitura de adesivo pode ser erro da arte; o botão "O projeto não precisa de adesivo" (passo Nesting/Composição) manda
`semAdesivo: true` para `POST /api/letra-caixa/cores/analisar-svg`, e `desconsiderarAdesivoDaSugestao` regrava as regiões de adesivo como
`pendente` (sem chapa-base, custo ou consumo; a face volta à composição do kit). Como o servidor compara o snapshot com o mapeamento gravado,
a decisão passa por ele — esconder o aviso só na tela quebraria a emissão. `REAL.colorAnalysis.semAdesivo` sobrevive a "Refazer análise";
"Voltar a considerar o adesivo" desfaz. O catálogo Imprimax de 05/08/2026 (155 cores sólidas) está em
`shared/imprimax-catalogo-2026-08.ts` e é carregado pelo gestor em Administração > Chapas para nesting
(`PUT /api/letra-caixa/cores/imprimax-padrao`, preserva preço/Pantone/CMYK já cadastrados). Os códigos `IMX-…` são
internos (o PDF não traz código Imprimax) e o hex vem da foto do catálogo, não de Pantone/CMYK oficiais.
O CPQ abre até 6 orçamentos em paralelo (pedido de 05/10/2026): a página de topo (`montarAbasOrcamento`) só
desenha as abas e cada orçamento roda em um quadro (iframe `?orc=N`) com estado, requisições e temporizadores
isolados, de modo que um orçamento continua processando em segundo plano enquanto o vendedor usa outro. As abas
leem `window.__cpqResumo()` de cada quadro (cliente, etapa, o que está ocupado). Links públicos (`?cotacao=`) e
`?semabas` abrem a página sem abas. Cada orçamento aceita até 3 desenhos (um produto em cada), cada um num
quadro próprio; o novo desenho herda o cliente do primeiro. Cada desenho continua sendo uma cotação normal
(validada e com preço aprovado por desenho); elas se ligam por `grupo {id, posicao}`, gravado no snapshot **fora**
das assinaturas de preço. O cliente recebe um link único `?grupo=...` com os desenhos e o total somado
(`GET /api/letra-caixa/cotacoes/grupo/:id`), e uma única resposta (`POST .../grupo/:id/resposta`) vale para todos.
O servidor limita o grupo a 3 desenhos, do mesmo cliente (CPF/CNPJ), sem posição repetida.
Vetorização pensada para o corte CNC (05/10/2026): `parametrosVetorizacao` (`server/services/vectorizerAi.ts`, nomes da
OpenAPI oficial do Vectorizer.AI) pede formas recortadas umas das outras (`shape_stacking=cutouts`, sem contorno
duplo), sem o preenchedor de frestas, sem arcos e sem ruídos minúsculos. Opcionalmente (padrão ligado, +1 crédito)
uma segunda chamada `?modo=corte` (`max_colors=1`) devolve só a silhueta que a CNC corta; o CPQ valida (sem fundo
cheio, mesmas dimensões e silhueta igual à do vetor completo) e, quando **toda** a face é adesivo sobre acrílico
transparente, o nesting usa esse contorno (`contornoCorte` na factibilidade) em vez dos caminhos por cor. O SVG
enviado à factibilidade recebe o grupo `Face` (`svgComCamadaFace`): sem ele o SVG do Vectorizer não tinha peças na
camada Face. Fotos dentro do logotipo (20+ cores sólidas pequenas) são reunidas numa região complexa →
adesivo impresso (`consolidarRegioesFotograficas`). A "área total" de uma região é a soma das caixas de cada
contorno, como a conferência de consumo de bobina exige.
Leitura da arte antes de vetorizar (05/10/2026): `POST /api/letra-caixa/analise-arte` (`server/services/cpqAnaliseArte.ts`)
manda o PNG aprovado (mesmo ticket da vetorização) a um modelo de visão (OpenAI `gpt-5-mini`, saída JSON estrita,
uma chamada barata por vetorização) que descreve fundo, textos, foto/degradê, nº de cores chapadas e detalhes finos.
Daí sai uma recomendação padrão (poucas cores chapadas: limite = cores + 2; foto/degradê: 32; detalhes finos: área
mínima 2). O administrador escreve regras em palavras em Administração > Configurações (`regrasLeituraArte`, em
`estudio_configuracoes`); o modelo as usa para sugerir ajustes que **vencem** a recomendação padrão. Só existem três
ajustes (`maxCores` 2–48, `minAreaPx` 0,5–30, `tolerancia` 0,02–0,5), sempre limitados por
`limitarAjustesVetorizacao`; texto da imagem nunca vira regra. Os ajustes viajam como `?maxCores&minArea&tolerancia`
na vetorização e aparecem no quadro "Leitura da arte". A leitura só informa (fundo, textos): não bloqueia nada e, se
falhar, a vetorização usa os parâmetros padrão.
Ajuste por conversa (05/10/2026): a API do Vectorizer.AI **não** tem recurso conversacional (só parâmetros); a conversa é
nossa. Na etapa de vetorização o vendedor descreve o problema e `POST /api/letra-caixa/ajuste-conversa`
(`server/services/cpqAjusteConversa.ts`, `gpt-5-mini`) recebe a mensagem, uma imagem do vetor com cada elemento
numerado, a tabela de elementos e o resultado da validação. Devolve um plano de ações de lista fechada
(`revetorizar` com os 3 ajustes permitidos, ou `apagar`/`mover`/`escalar`/`girar`/`espelhar` por número de elemento),
com valores e índices limitados em `sanearAcoes`. Nada roda sem o vendedor aprovar o plano na tela: `revetorizar`
gasta crédito (1, ou 2 com o contorno de corte) e as edições não gastam; as edições usam o mesmo motor do editor
vetorial (`finalizarEdicaoVetor`) e `REAL.vetorAnterior` permite desfazer. Revetorizar e editar nunca vão no mesmo
plano (a numeração muda). Erro na arte aprovada (letra errada) não é corrigido ali: o assistente orienta refazer a
reconstrução.
**Plano B da vetorização (decisão de 05/10/2026):** o passo de vetorização tem um seletor de motor
(`REAL.motorVetorizacao`: `auto` | `vectorizer` | `local` | `gpt`). No `auto`, `retrace` tenta Vectorizer.AI →
traçador local → GPT e desce a lista quando um motor falha (erro, sem crédito, SVG fora do padrão) ou a silhueta
reprova na validação contra a arte aprovada; fica com o melhor resultado e mostra "Plano B acionado" com os motivos.
(1) **Traçador local**: `client/public/cpq-vetorizador-local.js`, JavaScript puro, roda no navegador (canvas), sem
crédito: separa o fundo, agrupa cores (k-means), traça cada cor com marching squares + Douglas-Peucker e entrega um
`<path>` composto por cor, com os vazados como subcaminhos; modo `corte` gera a silhueta única (substitui a 2ª chamada
do Vectorizer.AI). Testado no Node (`server/__tests__/cpq-vetorizador-local.test.ts`) e num Edge real (IoU ≈ 98%).
Fundo = tudo que é transparente ou perto da cor mais comum da borda, inclusive miolos de letras (viram vazados).
(2) **GPT escreve o SVG**: `POST /api/letra-caixa/vetorizacao-gpt` (`server/services/cpqPlanoBArte.ts`, modelo
`gpt-5.5` ou `CPQ_GPT_SVG_MODEL`, saída JSON estrita de camadas `{cor, d}`; só comandos M L H V C S Q T Z fechados,
sem outros elementos). **Testado com a API real em 05/10/2026** (logo sintético de 2 cores): `gpt-5.5` fez 95% de
coincidência de silhueta em 45 s; o `gpt-5` fez só 21% em 160 s (letras deformadas) — por isso o padrão é o 5.5.
Continua aproximado: o SVG passa pela validação de silhueta e pela conferência do vendedor. (3) **Limpar fundo com
GPT**: `POST /api/letra-caixa/limpar-fundo` devolve a arte sobre branco liso (GPT Image, ~17 s) com novo ticket, e a
vetorização roda de novo; testado com a API real (tirou degradê e ruído, manteve letras e cores). O `gpt-image-2.5-sunburst`
**recusa `input_fidelity`** e a saída pode vir em outra proporção/tamanho (2170×725 de uma entrada 1024×320). As duas
rotas usam o mesmo ticket HMAC da vetorização; a chave de teste local fica no `.env` (ignorado pelo git).
A leitura das cores (`extrairRegioesCorSvg`) tolera o cabeçalho `<?xml?>`/DOCTYPE simples do Vectorizer.AI e
transparência parcial; cada recusa informa o motivo exato.
O editor vetorial direto do CPQ (`abrirEditorVetorial`) edita os caminhos do SVG sem revetorizar e obriga a
reconfirmar o tamanho real do letreiro antes do nesting.
`shared/pantone-referencia.ts` guarda a tabela Pantone de referência (guia da Promobrace, 925 cores com
amostra em hex) e `server/services/cpqPantone.ts` sugere o Pantone mais próximo (CIEDE2000) e um CMYK
aproximado. Em Administração > Chapas para nesting, o gestor escolhe o Pantone de cada chapa (lista, ou cor
+ "Sugerir Pantone mais próximo"); a matéria-prima da chapa sem CMYK passa a usar a amostra do Pantone no
cálculo de cor. A análise de cores da arte mostra Pantone e CMYK **aproximados** (rotas
`/api/letra-caixa/cores/pantone` e `/pantone/referencias`); eles não substituem o catálogo físico e não
entram no custo nem na decisão de material.
Printed and solid-vinyl costs also use each visible closed contour's bounding box
with configurable per-edge bleed (default 3 mm). The approved quote snapshot
retains the individual boxes, billed area, and roll parameters. Admin settings store roll width,
usable width, and bleed in `estudio_precos_impressao`; default charged consumption
is full roll width times the shortest fitting linear length across either orientation.
Only an explicit reusable-scrap setting charges the union of expanded contour boxes.
Missing width/geometry or an unfit layout leaves cost pending and blocks approval.
Migrations `0075_chubby_tenebrous.sql` and `0076_reconciliar_retalho_bobina.sql`
add the settings.

**Papéis das peças e como os materiais de um letreiro se combinam (informação do usuário, 06/10/2026):** o select "Papel na
peça" (composição do CPQ, cadastro do kit e vínculo das camadas do nesting; as opções vêm de Administração > Configurações, e `Aro`
está sempre presente, logo depois de `Face` — helper `papeisDePeca` no HTML) diz o que cada matéria-prima faz no produto.
**Aro** é sempre uma chapa metálica (ex.: galvanizada) da qual se corta o miolo, sobrando só as bordas: uma faixa que acompanha o
contorno de cada letra/símbolo e sustenta o acrílico da face nos letreiros *frontlight* de face iluminada. Exemplo real (Império das
Rações, desenho do usuário): **Aro galvanizado com perfil lateral de 80 mm soldado** nele + **Face em acrílico branco** + **Fundo em
PVC 10 mm**. Os três desenhos seguem o mesmo contorno do logo; no desenho do Aro cada letra/símbolo tem contorno duplo (a faixa de
metal que sobra) e na Face e no Fundo o contorno é simples. O usuário definiu a largura padrão da faixa em **6 mm** (06/10/2026).

**Aro gerado da face (pedido de 06/10/2026):** sempre que uma linha do kit tem o papel `Aro` (só esse papel: `Lateral`, `Perfil` e
`Contorno` também caem na camada física `aro`, mas não ganham a faixa — `papelEhAro`), o projeto ganha o aro como **faixa só das
bordas**: aro = silhueta da face − silhueta deslocada para dentro pela largura da faixa, **6 mm por padrão** (`shared/faixa-aro.ts`,
ajustável em Administração > Configurações, `larguraFaixaAroMm` em `config/geral`, de 1 a 50 mm). Cada contorno externo ganha a
faixa por dentro, cada vazado (miolo do P, do O, do R) ganha a faixa em volta dele e haste mais fina que o dobro da largura vira peça
inteira; cada anel é uma peça de metal separada no nesting (`faixaDeBorda` em `server/services/cpqFaixaAro.ts`, deslocamento pelo
`clipper-lib`, JS puro, que por isso também entra em `includeFiles` do `vercel.json`). O HTML envia `faixaMm` em
`camadasMateriais` só para a linha com papel Aro; o servidor repassa como `faixaDaFaceMm` ao lote e só gera a faixa se o SVG **não**
tiver camada `Aro` própria (o desenho do usuário vence), com aviso no resultado. Área líquida, perímetro de corte e custo vêm da
geometria da faixa pelo nesting. Testado na factibilidade e na rota; o fluxo completo do CPQ (foto → nesting → orçamento) ainda não
foi conferido com um logo real, e a visualização 3D do projeto pronto será feita à parte.

The static CPQ HTML calls the factibility and nesting routes. Kit roles Face,
Aro and Fundo select matching named SVG layers (só chapa/bobina com formato cadastrado entra no nesting; perfil não;
SVG vetorizado de imagem só tem a camada Face, então o Fundo **deriva da silhueta da face** — `fundoSegueSilhuetaDaFace`
em `cpqFactibilidadeFabricacao.ts`, com aviso no resultado; Aro em chapa sem camada própria vira a faixa de borda da face, ver acima); approved color path indexes can
split Face geometry across materials. Each material receives its own signed piece
batch, and the server compares all active formats before returning the chosen
board, placement metrics and estimated material/waste cost.
The budget and price snapshot use that nesting cost when it has a recognized cost
unit; an unsupported unit keeps the MubiSys cost and shows a review alert.

The CPQ stores project title and reference/redrawn image URLs on `propostas` and
inside `[ESTUDIO_COTACAO_V1]` snapshots. The static CPQ public quote shows both
images with zoom. Commercial Propostas also stores a project title and optional
image URLs, shows the images publicly with zoom, and includes the title in its PDF.
Image uploads use the authenticated UploadThing-backed route registered by
`server/routes/letra-caixa-redesenho.ts`.

The Propostas tab `Junção de propostas` simulates a Deepnest batch for 2–10 open
CPQ quotes belonging to one customer and sharing a chapa material. It redistributes
the estimated material cost by project geometry and reapplies each stored pricing
rule (including a stored Tabela de Preços line ID). The preview does not change
issued quotes; each recalculated price still needs a fresh human approval before
another commercial link is generated.

### Comercial > Propostas: decupador e painel executivo

`server/services/decupadorPreco.ts` decompõe o preço bruto em materiais,
mão de obra, custo fixo, comissão, impostos, custo financeiro e margem.
O custo unitário de mão de obra fica no produto; vendedor e percentuais
comerciais são parametrizados em Admin > Propostas > Parâmetros. Cada item
guarda `proposta_itens.decupagem_json` como snapshot versionado das taxas,
custos e parcelas usadas. `decupagemObter` e o painel exigem role `gestor`,
`admin` ou `master`; as consultas públicas e o PDF não incluem esse snapshot.
O painel agrega propostas e itens do módulo comercial Propostas, filtrados por
data de criação; cotações do CPQ Letreiros Express continuam excluídas.

## Patches

`wouter` está fixado em `3.7.1` (não use `^`) porque há um patch aplicado
via `patch-package` em `patches/wouter+3.7.1.patch` (injeta
`window.__WOUTER_ROUTES__` para debug). Rodar `yarn install` aplica o patch
automaticamente via `postinstall`.
