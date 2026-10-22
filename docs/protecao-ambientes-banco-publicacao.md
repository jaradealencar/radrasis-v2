# Proteção dos ambientes, banco e publicação

## Estado desta preparação

As alterações locais desta fase removem migrations do build da Vercel, exigem
identificação e confirmação explícita antes de aplicar migrations, e impedem o
comando normal de testes de usar bancos remotos. O build e a etapa de migration
passam a ter comandos e registros separados.

Os logs das camadas de banco registram somente a categoria segura do erro; SQL,
parâmetros e dados completos da cotação não são enviados ao log.

**ISOLAMENTO DOS BANCOS NÃO COMPROVADO.** Neste checkout não há projeto `.vercel`
vinculado, Vercel CLI disponível nem acesso à configuração privada dos projetos
`radrasis-v2` e `radrasis-v2-wts-deploy`. Portanto, não foi possível confirmar
domínios, branches de produção, commits publicados, variáveis de ambiente,
destinos de banco ou overrides de build configurados no painel. Nenhuma consulta
ou escrita foi feita em bancos, e nenhuma migration foi aplicada.

O `main` usado como base foi verificado no GitHub em
`f6ae1bf1d196737f1a36df0488aa600e82af8070`. A migration `0115` e o journal não
foram alterados.

## Comandos

- `yarn build:vercel` compila o client e o handler da API; não recebe
  `DATABASE_URL` no workflow de build.
- `yarn db:generate` apenas gera arquivos Drizzle.
- `yarn db:migrate` aplica migrations somente depois de validar ambiente,
  identidade do banco e confirmação.
- `yarn db:push` ainda gera e aplica, mas a etapa `drizzle-kit migrate` passa
  pela mesma validação. Em produção, prefira o workflow manual de migration.
- `yarn test:safety` executa testes unitários das travas sem conectar ao banco.
- `yarn test` requer `TEST_DATABASE_URL` apontando a `localhost`, `127.0.0.1`
  ou `::1`, com nome contendo um segmento `_ci`, `_test` ou `_tests`. O runner
  sobrescreve `DATABASE_URL` do processo de testes com esse destino e seleciona
  `pg`/`node-postgres` para falar o protocolo nativo com o PostgreSQL local.
  Não execute a suíte completa com `vitest run` diretamente, porque isso ignora
  a validação do wrapper.

O alvo de migration exige estas variáveis, sem imprimir a URL ou credenciais:

- `DB_MIGRATION_TARGET`: `local`, `ci`, `staging` ou `production`.
- `APP_ENV` e `NODE_ENV` coerentes com o alvo.
- `DB_MIGRATION_EXPECTED_HOST`, `DB_MIGRATION_EXPECTED_PORT` e
  `DB_MIGRATION_EXPECTED_DATABASE`, comparados com `DATABASE_URL`.
- `DB_MIGRATION_CONFIRMATION` exatamente no formato
  `MIGRATE:<alvo>:<host>:<porta>/<banco>`.
- Para produção, também
  `DB_MIGRATION_PRODUCTION_APPROVAL` exatamente como
  `AUTHORIZE_PRODUCTION_MIGRATION:<host>:<porta>/<banco>`.

Alvos `local` e `ci` só aceitam loopback. `ci` exige ainda `CI=true`,
`APP_ENV=ci`, `NODE_ENV=test` e nome de banco identificável como CI/teste.
Staging e produção recusam loopback; exigem as identidades esperadas e
confirmações acima. O código não consegue provar a propriedade ou isolamento de
um hostname remoto: essa confirmação precisa vir do painel da Vercel e do
provedor PostgreSQL.

## Workflows adicionados

Os builds completos (`yarn build` e `yarn build:vercel`) também gravam
`dist/public/build-info.json` com `sourceCommit` e `sourceTreeState` (`clean`,
`dirty` ou `unknown`) e imprimem os dois no log do build. O SHA vem de
`VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`, `GIT_COMMIT_SHA` ou, localmente, de
`git rev-parse HEAD`. O arquivo não inclui variáveis de ambiente.

`.github/workflows/quality.yml` separa duas verificações:

1. `build-and-typecheck`: typecheck e build sem credenciais de banco.
2. `isolated-database-tests`: inicia Postgres descartável, aplica migrations
   apenas nele e executa os testes contra esse banco.

`.github/workflows/migrate.yml` é manual, aceita um dos dois projetos e staging
ou produção, requer a confirmação da identidade, compara o SHA informado com o
SHA completo do commit escolhido para release em `main`, e exige um workflow `Quality`
bem-sucedido para esse mesmo SHA. O ambiente GitHub nomeado por alvo/projeto
precisa aprovar o trabalho antes da execução. O script registra o commit e a
identidade sanitizada do destino.

O workflow agora serializa migrations pelo identificador estável do recurso do
banco e mantém uma fila sem substituir execuções pendentes. Antes do checkout ou
da migration, exige as variáveis de ambiente `DB_MIGRATION_RESOURCE_ID` e
`DB_MIGRATION_ENVIRONMENT_READY` com os valores correspondentes ao alvo, projeto
e recurso. Um ambiente criado implicitamente pelo GitHub não terá esse marcador
e falhará antes de acessar o banco. O marcador não substitui revisores obrigatórios:
eles e a opção de impedir autoaprovação precisam ser ativados no painel.

Os workflows locais não alteram configurações no GitHub ou na Vercel. Para
ativá-los com segurança, um administrador deve configurar separadamente os
ambientes GitHub abaixo, usando host/porta/banco esperados e segredo
`DATABASE_URL` próprios para cada combinação:

- `staging-radrasis-v2`
- `production-radrasis-v2`
- `staging-radrasis-v2-wts-deploy`
- `production-radrasis-v2-wts-deploy`

O ambiente de produção deve exigir revisores. Antes de cadastrar qualquer
segredo, confirme no painel de cada projeto Vercel e no provedor de Postgres se
os bancos de preview/staging e produção são destinos distintos. Não reutilize
um segredo entre projetos por conveniência.

Em cada ambiente, configure os valores não secretos `DB_MIGRATION_EXPECTED_HOST`,
`DB_MIGRATION_EXPECTED_PORT`, `DB_MIGRATION_EXPECTED_DATABASE` e
`DB_MIGRATION_RESOURCE_ID`. O ID precisa ser idêntico sempre que mais de um
projeto/alvo apontar ao mesmo recurso físico, pois é a chave de serialização.
Configure também `DB_MIGRATION_ENVIRONMENT_READY` exatamente como
`MIGRATION_ENVIRONMENT_READY:<alvo>:<projeto>:<resource-id>`. Este marcador só
deve ser cadastrado no ambiente GitHub correspondente depois de confirmar os
revisores, a branch permitida e o bloqueio de autoaprovação. A credencial
`DATABASE_URL` fica como secret de ambiente, própria daquele destino.

As verificações manuais de 22/10/2026 encontraram ambientes chamados
`Production – radrasis-v2`, `Preview – radrasis-v2`, `Production` e `Preview`,
sem secrets ou variables de ambiente. Esses nomes não correspondem aos quatro ambientes
dinâmicos requeridos pelo workflow. Não execute `migrate.yml` até que os quatro
ambientes corretos existam e tenham branches permitidas, revisores independentes
para produção, autoaprovação impedida, bypass de administrador desativado e
secrets/variables exclusivos do recurso correspondente.

## Configuração externa pendente

Para cada projeto Vercel, um administrador deve verificar:

1. domínio e branch de produção;
2. SHA do último deploy de produção;
3. destino PostgreSQL por ambiente, comparando host, porta, nome do banco e
   identificador do recurso no painel do provedor, sem copiar credenciais para
   logs ou relatórios;
4. se o comando de build do painel sobrepõe `vercel.json`; se estiver
   sobreposto, trocar para `yarn build:vercel`;
5. se há hooks, comandos ou scripts externos que ainda executem
   `yarn db:migrate` durante o build;
6. se o projeto publica automaticamente. Configure a promoção para aguardar os
   checks de qualidade e a etapa de migration aprovada; sem esses bloqueios,
   um deploy automático pode ocorrer antes da migration manual.
7. quem pode iniciar deploys pela CLI/API, redeployar, promover Preview para
   Production, reatribuir domínios, usar deploy hooks ou forçar promoção; remova
   hooks não utilizados e restrinja tokens e permissões administrativas.

No GitHub, proteja `main` e configure como checks obrigatórios os jobs
`Quality / build-and-typecheck` e `Quality / isolated-database-tests`. Configure
revisores obrigatórios nos dois ambientes de produção. Configure a proteção de
deploy da Vercel para aguardar os checks correspondentes antes da promoção. A
Vercel documenta que uma promoção forçada pode contornar Deployment Checks; trate
esse recurso como acesso administrativo de exceção e audite seu uso. Para cada
projeto, valide os checks no commit correto antes de torná-los obrigatórios; os
jobs de migration esperados são `Controlled database migration / migrate-production-radrasis-v2`
e `Controlled database migration / migrate-production-radrasis-v2-wts-deploy`,
um por projeto. O workflow de migration deve ser executado apenas contra o
projeto/alvo cujo banco foi verificado e para um commit `main` com Quality
concluído. Após a publicação, confirme no painel que o SHA publicado é o mesmo
SHA registrado pelo workflow e por `dist/public/build-info.json`.

Até essa configuração externa ser conferida, o workflow de produção deve ser
considerado indisponível e qualquer estado de isolamento permanece
**ISOLAMENTO DOS BANCOS NÃO COMPROVADO.**

## Procedimento futuro para isolar Preview

Esta sequência é uma orientação administrativa; não foi executada:

1. Suspender temporariamente a promoção de novas versões enquanto os destinos
   são identificados e a configuração é revisada.
2. No provedor PostgreSQL, confirmar o recurso operacional usado atualmente por
   Production. Registrar host, porta, banco e ID estável do recurso em local
   administrativo protegido; nunca copiar a URL de conexão para ticket, log ou
   relatório.
3. Criar ou selecionar um banco exclusivo de Preview somente depois dessa
   identificação. Usar credencial própria com permissões mínimas e dados
   sintéticos ou anonimizados. Confirmar que essa credencial não autentica no
   banco de Production.
4. Manter a variável `DATABASE_URL` de Production como está. Alterar somente o
   escopo Preview da Vercel para a credencial isolada e validar o destino por
   host, porta, nome do banco e ID do recurso.
5. Publicar primeiro uma Preview controlada e confirmar logs, funcionalidades
   essenciais e ausência de acesso ao banco produtivo. Se falhar, restaurar o
   valor anterior apenas no escopo Preview e manter Production intacta.
6. Retomar publicações somente depois de validar novamente os dois destinos, os
   checks de qualidade, as proteções de promoção e o SHA publicado.
