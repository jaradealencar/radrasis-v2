# Proteção dos ambientes, banco e publicação

## Estado desta preparação

As alterações locais desta fase removem migrations do build da Vercel, exigem
identificação e confirmação explícita antes de aplicar migrations, e impedem o
comando normal de testes de usar bancos remotos. O build e a etapa de migration
passam a ter comandos e registros separados.

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
  sobrescreve `DATABASE_URL` do processo de testes com esse destino.

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

No GitHub, proteja `main` e configure como checks obrigatórios os jobs
`Quality / build-and-typecheck` e `Quality / isolated-database-tests`. Configure
revisores obrigatórios nos dois ambientes de produção. Configure a proteção de
deploy da Vercel para aguardar os checks correspondentes antes da promoção. O
workflow de migration deve ser executado apenas contra o projeto/alvo cujo banco
foi verificado e para um commit `main` com Quality concluído. Após a publicação,
confirme no painel que o SHA publicado é o mesmo SHA registrado pelo workflow.

Até essa configuração externa ser conferida, o workflow de produção deve ser
considerado indisponível e qualquer estado de isolamento permanece
**ISOLAMENTO DOS BANCOS NÃO COMPROVADO.**
