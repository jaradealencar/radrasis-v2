# Inteligência de Clientes (Performance Comercial)

Reescrita completa em setembro/2026, a partir de um prompt de especificação
("Inteligência de Mercado") fornecido pelo usuário. Implementa a parte que
corresponde à sub-aba já existente: clientes e recompra (RFM, classificação,
ficha por cliente, coorte de segunda compra, concentração, margem, fila de
ações) mais funil de orçamentos e previsões 30/60/90 dias.

Fora do escopo desta implementação (não construído): radar externo de
mercado (sinais de expansão, notícias, editais) e assistente de IA em chat —
ambos dependem de decisões de negócio (região de atuação, fontes pagas,
custo por consulta de LLM) que precisam ser combinadas com o usuário antes.

## Onde está o código

- `server/services/inteligenciaClientes.ts` — todo o cálculo (puro, sem I/O):
  construção da base de clientes, RFM, classificação, coorte de segunda
  compra, concentração, margem, fila de ações candidatas, funil de
  orçamentos, previsão comercial. Contém `DICIONARIO_METRICAS`.
- `server/routers/performanceComercial.ts` — endpoints tRPC que carregam os
  dados do banco e chamam o serviço acima:
  `getVisaoGeralClientes`, `listarClientesInteligencia`, `getFichaCliente`,
  `getFilaAcoesClientes`, `atualizarAcaoCliente`, `getFunilOrcamentos`,
  `getPrevisaoComercial`.
- `client/src/pages/comercial/InteligenteClientes.tsx` — a tela, com 5 vistas
  internas: Visão Geral, Clientes, Fila de Ações, Funil, Previsões.
- `drizzle/schema.ts` — tabela `inteligencia_acoes_clientes` (fila de ações
  persistente e idempotente). Substituiu `inteligencia_clientes_cache` (do
  mecanismo antigo de congelamento, removida).

## Decisão central: fonte de dados

Todo o cálculo usa **`historico_os`** e **`historico_orcamentos`** (Postgres
local, importado do MubiSys — ver `docs/integracao-mubisys.md`), nunca a API
MubiSys ao vivo. A implementação anterior desta sub-aba consultava a API em
tempo real por ano selecionado (25-45s/mês) e por isso precisava de um
mecanismo de "congelar" o resultado. Como `historico_os` já cobre 2023-09 a
2026-09 com custo e contribuição calculados pelo ERP em 100% das linhas, o
cálculo passou a ser local, determinístico e rápido — não há mais
congelamento nem indicador de "tempo real vs. cache".

`historico_orcamentos` cobre **só 2026** (a importação de orçamentos começou
depois da de OS) — isso limita a comparação histórica do funil a um único
ano; a tela avisa isso explicitamente.

## Bug de parsing de data corrigido nesta reescrita

Os campos de data de `historico_os`/`historico_orcamentos`
(`dataAprovacao`, `dataEntrega`, `dataFaturamento`, `dataCadastro`) têm
**formato misto**: ~97% dos registros (o import em lote do XLSX do MubiSys)
estão em `dd/mm/aaaa[ hh:mm[:ss]]`, e o restante (registros mais recentes,
vindos da API ao vivo) em `aaaa-mm-dd[ hh:mm:ss]`. Um parser que assumisse só
um dos formatos ficaria com a esmagadora maioria das datas erradas ou
inválidas — foi auditado diretamente no banco durante esta implementação e
corrigido em `parseDataFlexivel` (`server/services/inteligenciaClientes.ts`).
Qualquer novo código que leia essas colunas de data deve reaproveitar esse
parser (ou replicar a mesma lógica) em vez de assumir um formato único.

## "Pedido válido"

Reaproveita `isOsNormalDb` (já usado em todo o resto da Performance
Comercial, `financeiro.ts` e `insightsComerciais.ts`): exclui Retrabalho,
Amostra, Cortesia, status Cancelada, e linhas com `tipoOs` nulo (duplicatas
de importações antigas sem custo).

## Dicionário de métricas

Ver `DICIONARIO_METRICAS` em `server/services/inteligenciaClientes.ts` —
também acessível na tela pelo botão "O que significa isso?" na Visão Geral.
Cobre: pedido válido, data do pedido, clientes compradores no período,
primeira compra observada, recompra no período, RFM (recência/frequência/
valor), razão de atraso na recompra, segunda compra em X dias, concentração,
margem de contribuição, classificação do cliente.

## Classificação de cliente

Calculada por cliente na data de referência (hoje), usando todo o histórico
dele — não apenas o período selecionado na tela:

- **Primeira compra**: só tem 1 compra válida em todo o histórico local.
- **Histórico insuficiente**: 2 compras válidas (não dá para calcular
  mediana de intervalo com confiança) — confiança da classificação marcada
  como "baixa".
- **Intervalo acima do habitual**: razão de atraso (dias desde a última
  compra ÷ mediana dos intervalos do próprio cliente) ≥ 1,5.
- **Em crescimento** / **Redução de volume**: variação ≥ 20% (para mais ou
  para menos) entre o valor comprado na janela selecionada e o valor
  comprado na janela imediatamente anterior de mesmo tamanho.
- **Recompra observada**: os demais casos com 3+ compras válidas.

Todos os limiares (`RAZAO_ATRASO_LIMIAR`, `VARIACAO_VOLUME_LIMIAR_PCT`,
`HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA`, janelas de segunda compra, etc.)
são constantes exportadas em `inteligenciaClientes.ts`, documentadas ali com
o motivo do valor escolhido — heurísticas explícitas, não probabilidades
calibradas.

## Fila de ações

Três tipos de ação candidata, gerados a partir do estado atual de todo o
histórico (independente do período selecionado na tela):

1. **`primeira_sem_segunda`** — 1 compra válida, entre 30 e 120 dias atrás
   (janela de oportunidade de contato).
2. **`atraso_recompra`** — 3+ compras válidas, razão de atraso ≥ 1,5, e não
   mais que 365 dias desde a última compra (evita reabrir clientes já
   claramente inativos há muito tempo).
3. **`alto_volume_baixa_margem`** — top 20% da carteira por valor comprado
   nos últimos 12 meses, com margem de contribuição desses 12 meses abaixo
   de 15%.

Prioridade (0-100) = `urgência × 0,6 + relevância econômica × 0,4` — pesos
explícitos, é prioridade operacional, não percentual de chance de compra.

Persistência: tabela `inteligencia_acoes_clientes`, upsert idempotente por
`(tipo, empresaKey)` a cada carregamento da fila — uma ação concluída ou
descartada não é recriada por `DIAS_COOLDOWN_ACAO_RESOLVIDA` (30) dias; uma
ação adiada não é recriada até o prazo do adiamento passar.

## Funil de orçamentos

Baseado em `historico_orcamentos` (só 2026). Reaproveita o vocabulário de
status já usado pela equipe no ERP (`Em aberto`, `Aprovado`, `Em produção`,
`Entregue`, `Concluída`, `Reprovado`, `Cancelada`, e o caso ambíguo
`ORC.: Aprovado | OS.:Cancelada`, contado à parte — não entra no numerador
nem no denominador da taxa de conversão, pois representa uma decisão que
mudou depois de aprovada).

**Limitação registrada**: não há campo que ligue um `orcNumero` ao
`osNumero` que ele gerou nos dados exportados do MubiSys — reconciliação
orçamento→pedido por identificador não é possível. O funil e a carteira de
pedidos (`historico_os`) são visões complementares, nunca somadas.

Já existe um CRM operacional de orçamentos
(`server/routers/crm.ts::getPropostas`, `client/src/pages/comercial/CRM.tsx`)
que busca ao vivo na API MubiSys e gerencia follow-up (contatos, ganha/
perdida) — o funil desta aba é **analítico** (histórico local), não duplica
esse fluxo operacional.

## Previsão comercial (30/60/90 dias)

Três camadas, deliberadamente não somadas:

1. **Carteira confirmada**: OS com status `Aprovado`/`Em produção`, válidas,
   usando `dataEntrega` como proxy do prazo prometido (confirmado nesta
   sessão que a coluna já vem preenchida também para OS ainda em produção —
   funciona como data prevista, não só real).
2. **Oportunidades abertas (estimativa)**: orçamentos `Em aberto` ainda não
   vencidos, alocados na faixa pela data de vencimento da validade, com o
   valor ponderado pela taxa de conversão histórica do funil (não é a
   carteira confirmada, é estimativa).
3. **Referência de sazonalidade**: média do valor faturado no mesmo mês nos
   até 3 anos anteriores — comparação, não parcela a somar.

## Validações realizadas

Nesta sessão, os números do serviço foram conferidos por script (`tsx`)
contra consultas SQL diretas no banco: clientes compradores em um mês
(bateu exatamente), distribuição de OS confirmadas por faixa de dias até a
entrega (bateu), e a descoberta/correção do bug de formato misto de data
(97% dos registros estavam sendo descartados como data inválida antes da
correção).

**Não testado formalmente com `vitest`** — não havia suíte de testes para
`performanceComercial.ts` antes desta mudança; `server/__tests__/crm.test.ts`
(não relacionado) continua passando. Considerar adicionar testes unitários
para `inteligenciaClientes.ts` (função pura, fácil de testar sem banco) como
próximo passo.
