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
**sobre PostgreSQL (Neon)**, driver `pg`/`drizzle-orm/node-postgres`;
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
  cores, o redesenho, a validação da geometria, o nesting e a proposta. IA deve
  mostrar evidências e incertezas, sem inventar itens, custos ou medidas.
  Materiais, cores e desenho precisam ser confirmados; quantidades vêm de
  geometria validada; todo preço automático continua exigindo aprovação humana.

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
                       e cpqPrecoAssistente.ts (sugestões GPT e recibos assinados
                       de aprovação humana de preço)
  routes/              rotas REST fora do tRPC: publico-guia-fornecedores.ts (CORS aberto, site
                       espelho), campanhas-whatsapp-api.ts (webhooks com chave CAMPANHAS_API_KEY)
                       e price-table-api.ts (export somente-leitura da Tabela de Preços com chave
                       PRICE_TABLE_API_KEY, para o precificador automatizado externo),
                       estudio-cotacoes.ts (cotações do HTML estático do CPQ),
                       estudio-clientes.ts (cadastro e busca autenticados de clientes do CPQ),
                       estudio-kits.ts (composições de produto por modelo, compartilhadas no Postgres),
                       estudio-catalogo-mubisys.ts (catálogos de produtos e matérias-primas
                       via API MubiSys, com sessão autenticada) e
                       estudio-configuracoes.ts (configurações compartilhadas do CPQ)
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
  vivo de `listarMateriasPrimas()`. O CPQ permite selecionar várias
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
- **Redesenho de letra caixa via GPT Image ainda sem validação real.**
  `client/public/cpq-letreiros-express.html` chama a rota autenticada
  `POST /api/letra-caixa/redesenho`; a chave OpenAI fica no servidor. O fluxo
  usa `server/services/letraCaixaRedesign.ts` e `generateImageEdit`
  (`server/_core/llm.ts`), modelo `gpt-image-2.5-sunburst`, qualidade `xhigh`,
  fidelidade alta à imagem de entrada e tamanho automático para preservar a
  proporção da foto. A última chamada real conhecida devolveu 429
  `insufficient_quota` em 28/09/2026. Os parâmetros atuais foram conferidos na
  documentação oficial em 30/09/2026, mas ainda é necessária uma geração real
  com uma foto depois de haver crédito disponível.
- **Prompts 2 e 3 do CPQ são executados por funções locais.** Os PDFs do
  usuário foram transcritos em `docs/prompts/prompt-2-vetorizacao.md` e
  `docs/prompts/prompt-3-area-perimetro-prancha.md`. O navegador vetoriza com
  ImageTracer, calcula uma coincidência de silhueta pixel/SVG e gera as medidas
  e a prancha sem chamadas adicionais ao GPT. A área é aproximada por amostragem;
  caixas de peças que se cruzam geram um aviso, pois o protótipo não faz união
  booleana de formas sobrepostas.

## Patches

`wouter` está fixado em `3.7.1` (não use `^`) porque há um patch aplicado
via `patch-package` em `patches/wouter+3.7.1.patch` (injeta
`window.__WOUTER_ROUTES__` para debug). Rodar `yarn install` aplica o patch
automaticamente via `postinstall`.
