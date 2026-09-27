# Campanhas WhatsApp — cadência, quarentena e pós-venda

Controle da frequência dos disparos de WhatsApp (prospecção, orçamentos perdidos, reativação, pós-venda): quando
cada campanha vence, quem já recebeu algo recentemente (trava anti-spam) e o pós-venda por data individual da venda.

**Onde fica:** Inteligência de Clientes › **Crescimento e Resultado** › Marketing, Clientes e Receita › aba
**Campanhas WhatsApp** (ao lado de "ROI Marketing"). Visível para `admin`, `master` e `gestor` — as procedures do
servidor exigem os mesmos roles (a lista guarda telefones de clientes). Não há rota nem item de menu próprios.

Código: `client/src/pages/financeiro/MarketingCampanhasWhatsapp.tsx` (+ pasta `campanhasWhatsapp/`),
`server/routers/campanhasWhatsapp.ts`, `server/services/campanhasWhatsapp.ts` (regra pura),
`shared/campanhas-whatsapp.ts` (datas, telefone, semáforo), `server/routes/campanhas-whatsapp-api.ts` (webhooks).

## Regras de negócio

**Datas.** Tudo é `YYYY-MM-DD` e "hoje" é o dia em **America/Campo_Grande** (a Vercel roda em UTC; depois das 21h
locais `new Date()` já é o dia seguinte). Para exibir uma data ISO use `formatarDataBr` — `new Date("2026-09-26")`
é lido como meia-noite UTC e no Brasil apareceria um dia antes.

**Próximo envio (campanha recorrente).** `último envio + frequência`, sempre com a frequência *atual* da campanha
(editar a frequência muda o prazo na hora). O `proxima_data` gravado em cada disparo é o fato histórico daquele
momento e alimenta o calendário. Campanha nunca disparada nasce **vermelha** ("1º disparo pendente"), com prazo na
data de criação.

**Semáforo.** 🔴 `hoje >= próximo envio` (atrasada ou disparar hoje) · 🟡 faltam até 3 dias · 🟢 faltam mais de 3.
Pausada/arquivada não tem semáforo e sai dos contadores. Cartões do topo: *Ativas*; *Pendentes para hoje* (vermelhas);
*Da semana* (prazo entre amanhã e +7 dias).

**Quarentena.** Ao registrar um disparo, cada telefone é normalizado (só dígitos, DDI 55) e comparado com o último
contato que recebeu de **qualquer** campanha registrada aqui. É ignorado se o último contato está a **menos de
`quarentena_dias`** da data do envio (em qualquer sentido — registro retroativo também respeita a trava). Com 30 dias,
quem recebeu há exatamente 30 já pode receber. `quarentena_dias = 0` desliga a trava. Telefone inválido e repetido na
lista são separados e reportados. Só o **último** contato por telefone é guardado (uma linha por telefone).

**Registro retroativo não recua a quarentena:** o upsert só avança `ultimo_contato_em`.

**Se ninguém puder ser enviado** (todos em quarentena/inválidos) nada é gravado — o próximo envio não é adiado à toa.

**Pós-venda (`gatilho_venda`).** Prazo de cada venda = **data de faturamento** (`historico_os.dataFaturamento`, formatos
dd/mm/aaaa e ISO) + `frequencia_dias`. Só OS "normais" (mesma regra `isOsNormalDb`: sem retrabalho, amostra, cortesia
ou cancelada). *Para contatar* = prazo vencido e ainda não contatada, **sem limite de atraso**; o campo opcional
**"só vendas faturadas a partir de"** existe para conter a 1ª lista (sem ele, a primeira lista pode trazer o histórico
inteiro — em teste local vieram vendas de 2023). O diálogo de disparo mostra a data da venda pendente mais antiga.
Venda de contato **ignorado por quarentena continua pendente** e reaparece quando a quarentena vence. Vendas sem
telefone (OS antigas: a coluna só existe desde 21/09/2026; backfill em `/api/scheduled/completarTelefones`) aparecem
marcadas e ficam fora do envio.

**Categorias são editáveis pelo usuário** (não é mais um enum fixo — migration `0046`): criar, renomear (só o
`label`; a `chave`/slug gravada em `campanhas_whatsapp.categoria` é imutável) e arquivar/reativar sem perder o
rótulo de campanhas antigas. Excluir de fato só é permitido quando nenhuma campanha usa a categoria
(`listarCategorias` devolve `emUso` para a tela decidir se oferece excluir ou só arquivar). UI em
`GerenciarCategoriasPopover.tsx`, aberto a partir do formulário de campanha.

## Modelo de dados (migrations `0045`–`0047`)

| Tabela | Papel |
|---|---|
| `campanhas_whatsapp` | campanha: nome, `descricao` (livre, opcional, sem regra de negócio), categoria, tipo, `frequencia_dias`, `quarentena_dias`, status, `gatilho_a_partir_de` |
| `campanhas_whatsapp_categorias` | categorias editáveis: `chave` (slug imutável), `label`, `ativo`, `ordem` |
| `campanhas_whatsapp_disparos` | log de cada disparo (contagens, próxima data, arquivo, observações, origem `app`/`api`) |
| `campanhas_whatsapp_quarentena` | último contato por telefone (`telefone` único) |
| `campanhas_whatsapp_gatilhos` | OS de pós-venda já contatadas por campanha (`campanha_id`+`os_numero` único) |

O registro de um disparo (log + quarentena + vendas contatadas) é **um único statement SQL com CTEs** — atômico no
Postgres. `db.transaction` não serve aqui: o driver Neon roda em modo HTTP (`server/db/db-connection.ts`).

**Adaptações à especificação original** (UUID/inglês): PK `serial`, tabelas/colunas em português snake_case e enums
minúsculos, como no resto do repo. Mapeamento: `NOVO_LEAD→novo_lead`, `ORCAMENTO_PERDIDO→orcamento_perdido`,
`REATIVACAO_INATIVO→reativacao_inativo`, `POS_VENDA→pos_venda`, `OUTBOUND→outbound`; `RECURRENT→recorrente`,
`TRIGGER_BASED→gatilho_venda`; `ACTIVE/PAUSED/ARCHIVED→ativa/pausada/arquivada`. Campanha não é excluída: arquivar
preserva o histórico.

## Fluxo "Registrar disparo" (tela)

Arquivo `.csv` (UTF-8, `;` `,` ou tab) ou `.xlsx`, com colunas **`telefone`** e **`nome_cliente`** (aceita apelidos:
celular, whatsapp, cliente, nome…). Lido no navegador (`client/src/lib/listaContatos.ts`, até 20.000 linhas). "Processar"
higieniza, grava e mostra *"X contatos processados, Y contatos ignorados por estarem em período de quarentena de
comunicação"*, com download da **lista higienizada** (é ela que deve ser enviada), dos ignorados e dos inválidos. O
arquivo original é anexado no UploadThing (falha no anexo não impede o registro). Em campanha de pós-venda também é
possível **"Usar vendas pendentes"** no lugar do arquivo.

## Tooltips de ajuda no formulário de campanha

Nome, Categoria, Tipo, Cadência e Quarentena têm um ícone (i) ao lado do label (`LabelComAjuda` em
`campanhasWhatsapp/comuns.tsx`) com a explicação do campo e valores sugeridos — pedido do usuário para orientar
quem cadastra a campanha e reduzir risco de configurar uma cadência/quarentena que gere spam ou bloqueio no
WhatsApp. Abre no hover/foco (`Tooltip` padrão do repo, mesmo de `KpiCard.tsx`) e também no clique/toque (estado
controlado), para funcionar em telas sem mouse. É só texto de orientação — os valores citados (ex.: "quarentena
15 dias") não são impostos por nenhuma validação.

## Webhooks REST (para disparador/API oficial do WhatsApp)

Autenticação: `Authorization: Bearer <CAMPANHAS_API_KEY>` (ou `x-api-key`), comparação em tempo constante. **Sem a
variável configurada o servidor responde 503** — nunca fica aberto. Defina `CAMPANHAS_API_KEY` na Vercel (e no `.env`
para testar localmente); a tela e o tRPC funcionam sem ela.

```bash
# Registrar um envio já feito por fora
curl -X POST https://<app>/api/v1/campaigns/12/log-send \
  -H "Authorization: Bearer $CAMPANHAS_API_KEY" -H "Content-Type: application/json" \
  -d '{"sent_at":"2026-09-26","contacts":[{"phone":"(67) 99999-0001","name":"Ana"}],"notes":"lote 3"}'
# 201 → {"logged":true,"log_id":8,"next_due_date":"2026-10-11","processed":1,"sent":1,
#        "ignored_quarantine":0,"quarantine_violations":0,"invalid":0,"ignored_phones":[]}

# Consultar a trava antes de enviar (campaign_id usa a quarentena da campanha; ou informe quarantine_days)
curl -X POST https://<app>/api/v1/contacts/check-quarantine \
  -H "Authorization: Bearer $CAMPANHAS_API_KEY" -H "Content-Type: application/json" \
  -d '{"phones":["67999990001","67999990002"],"campaign_id":12}'
# 200 → {"quarantine_days":30,"results":[{"phone":"67999990001","normalized_phone":"5567999990001","valid":true,
#        "in_quarantine":true,"last_contacted_at":"2026-09-10","available_at":"2026-10-10"}, ...],
#        "summary":{"total":2,"in_quarantine":1,"available":1,"invalid":0}}
```

`log-send` parte do princípio de que a lista **já foi enviada**: registra tudo que é válido e apenas **reporta**
(`quarantine_violations`) quem violava a quarentena — descartar do registro quem de fato recebeu deixaria a trava
cega. Envie `"apply_quarantine": true` para o comportamento da tela (descartar os em quarentena). Códigos: 400 payload
inválido/data futura/campanha pausada, 401 chave inválida, 404 campanha inexistente, 503 API desligada. Limites: 20.000
contatos por `log-send`, 5.000 telefones por `check-quarantine`.

## Limitações conhecidas

- A quarentena só enxerga envios registrados **neste módulo** (upload, "vendas pendentes" ou API). Os disparos da
  Retenção de Clientes Novos e os cliques de WhatsApp do CRM **não** a alimentam — eles trabalham por empresa, sem
  telefone gravado.
- Não há histórico por contato (só o último) e nem status de entrega/resposta.
- As procedures exigem admin/master/gestor no servidor; o restante do acesso é o da tela de Inteligência de Clientes.
- A aba mora dentro de `MarketingFinanceiro.tsx`, mas **não depende** do relatório de marketing (busca ao vivo no
  MubiSys): só as abas que leem esse relatório esperam por ele.

## Testes

`server/__tests__/campanhas-whatsapp.test.ts` (regras puras + autenticação/validação dos webhooks),
`server/__tests__/campanhas-whatsapp-db.test.ts` (banco real: quarentena, retroativo, modo webhook, gatilho, role) e
`client/src/lib/listaContatos.test.ts` (leitura de CSV/XLSX).
