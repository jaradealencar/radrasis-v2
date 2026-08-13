# Sprint: refatoração do `client/src/pages`

Sprint única, dividida em **12 fases — uma fase por arquivo nesta pasta, uma
fase por commit**. O objetivo é reduzir o volume de código em
`client/src/pages/` reaproveitando componentes que **já existem** no repo
(`client/src/components/ui/*`, shadcn) e extraindo para `components/` /
`lib/` os padrões que hoje estão copiados e colados em dezenas de páginas.

> **Como usar este material.** Ao atacar uma fase, cole **este README inteiro
> + o arquivo daquela fase** como contexto inicial da conversa. Não carregue
> as outras fases: cada arquivo de fase é auto-contido e diz explicitamente o
> que assumir das fases anteriores.
>
> Este material foi escrito para ser executado por **modelos menores**. Por
> isso cada fase é mecânica, tem lista fechada de arquivos, exemplos
> literais de antes/depois e um comando de verificação objetivo. Se uma fase
> parecer exigir decisão de design, ela está mal escrita — pare e pergunte,
> não improvise.

## Índice das fases

| # | Arquivo | O que faz | Depende de |
|---|---------|-----------|------------|
| 1 | ✅ [fase-01-fundacao.md](fase-01-fundacao.md) | Cria as primitivas compartilhadas + refatora 1 página piloto | — |
| 2 | ✅ [fase-02-formatadores.md](fase-02-formatadores.md) | Substitui formatadores locais por `lib/format.ts` | 1 |
| 3 | ✅ [fase-03-page-header.md](fase-03-page-header.md) | 134 cabeçalhos manuais → `<PageHeader>` | 1 |
| 4 | ✅ [fase-04-kpi-card.md](fase-04-kpi-card.md) | 7 `KpiCard` locais → `components/KpiCard.tsx` | 1, 2 |
| 5 | ✅ [fase-05-graficos.md](fase-05-graficos.md) | 7 `CustomTooltip` locais + paleta de cores hardcoded | 1, 2 |
| 6 | ✅ [fase-06-tabelas-a-qualidade-retrabalhos-admin.md](fase-06-tabelas-a-qualidade-retrabalhos-admin.md) | `<table>` cru → `ui/table` (8 arq., 8 tabelas) | 1 |
| 7 | ✅ [fase-07-tabelas-b-financeiro.md](fase-07-tabelas-b-financeiro.md) | idem — financeiro (5 arq., 9 tabelas) | 6 |
| 8 | ✅ [fase-08-tabelas-c-logistica.md](fase-08-tabelas-c-logistica.md) | idem — logística (4 arq., 10 tabelas) | 6 |
| 9 | ✅ [fase-09-tabelas-d-operacoes.md](fase-09-tabelas-d-operacoes.md) | idem — operações (4 arq., 15 tabelas) | 6 |
| 10 | ✅ [fase-10-tabelas-e-comercial.md](fase-10-tabelas-e-comercial.md) | idem — comercial (7 arq., 23 tabelas) | 6 |
| 11 | ✅ [fase-11-estados-loading-vazio.md](fase-11-estados-loading-vazio.md) | Loading/vazio ad-hoc → `ui/spinner` + `ui/empty` | 1 |
| 12 | ✅ [fase-12-limpeza.md](fase-12-limpeza.md) | Varredura final, remoção de mortos, fechamento | 1–11 |

**Ordem obrigatória: a Fase 1 vem primeiro.** Ela cria os arquivos que todas
as outras importam. Depois disso:

- **2 → 3 → 4 → 5** na ordem (a 4 e a 5 usam os formatadores da 2).
- **6 → 7, 8, 9, 10** — a 6 é o aquecimento (tabelas mais simples) e
  estabelece o padrão; 7/8/9/10 podem sair em qualquer ordem depois dela.
- **11** é independente das 2–10, pode sair a qualquer momento após a 1.
- **12** por último.

⚠️ **Nunca rode duas fases em paralelo.** Várias fases tocam o mesmo arquivo
(ex.: `financeiro/PainelDRE.tsx` aparece nas fases 2, 3, 4, 5 e 7). Em série
não há conflito; em paralelo há.

---

## Contexto: por que esta sprint existe

`client/src/pages/` tem hoje **71 arquivos e ~43.200 linhas**. Boa parte
disso é repetição de coisas que o projeto já tem prontas mas não usa.

### Levantamento (números reais, medidos no início da sprint)

**Tabelas — o maior ganho isolado.** O projeto tem
`client/src/components/ui/table.tsx` (shadcn) instalado. Ele é usado em
**2 arquivos**. Em paralelo, **29 páginas escrevem `<table>`/`<thead>`/`<th>`
na mão**, num total de **65 tabelas cruas**, cada uma repetindo as mesmas
classes Tailwind de borda, padding, hover e tipografia do cabeçalho.

**Componentes redefinidos localmente em várias páginas:**

| Componente | Definido localmente em |
|---|---|
| `KpiCard` | 7 arquivos (`Dashboard`, `PerformanceComercial`, `InteligenteClientes`, `CustosFixos`, `MarketingFinanceiro`, `PainelDRE`, `operacoes/Performance`) |
| `CustomTooltip` (recharts) | 7 arquivos |
| `ProgressBar` | 3 arquivos |
| `formatDate` / `fmtDate` / `fmtBrl` / `formatCurrency` | 10+ arquivos, todas variações da mesma coisa |

**Cabeçalho de página:** 134 ocorrências de `<h1 className="text-2xl
font-bold …">` montadas à mão, cada uma com sua própria combinação de
`style={{ color: "#0f172a" }}`, ícone e subtítulo.

**Cores:** a paleta de gráficos está hardcoded como hex espalhado —
`#f59e0b` aparece 49×, `#ef4444` 44×, `#22c55e` 42×, `#3b82f6` 35×. São
~380 usos de `style={{ … }}` inline nas páginas.

**Componentes shadcn instalados e com adoção zero:** `ui/empty`,
`ui/spinner`, `ui/chart`, `ui/field`, `ui/item`, `ui/input-group`,
`ui/button-group`. `ui/skeleton` está em 3 arquivos, `ui/pagination` em 1.

### O que esta sprint NÃO faz

- **Não muda comportamento.** Nenhuma query tRPC, nenhuma regra de negócio,
  nenhum cálculo. Se o diff de uma fase altera o que aparece na tela além de
  espaçamento/borda, algo saiu errado.
- **Não redesenha nada.** O visual final deve ficar equivalente ao atual.
  Pequenas diferenças de padding/borda vindas do shadcn são aceitáveis e
  esperadas; mudança de cor, de ordem de coluna ou de conteúdo, não.
- **Não mexe em `server/`.** É sprint de client, só.
- **Não quebra `logistica/Empacotamento.tsx` em arquivos menores.** Esse
  arquivo tem 5.012 linhas e merece uma sprint própria; aqui ele só recebe a
  troca de tabelas (Fase 8).
- **Não toca em `ComponentShowcase.tsx`.** É a vitrine dos componentes,
  serve de referência viva — deixe como está.

---

## Regras de ouro (valem para todas as fases)

1. **Uma fase = um commit.** Mensagem no padrão do repo:
   `refactor(pages): <o que fez> (sprint pages, fase N)`.
2. **Não invente componente novo fora da Fase 1.** Se uma fase 2–12 parecer
   precisar de uma primitiva que não existe, pare e reporte — não crie.
3. **Preserve o `key` de toda lista.** Ao trocar `<tr>` por `<TableRow>`, o
   `key` vai junto. Perder `key` é bug de render silencioso.
4. **Preserve handlers e `data-*`.** `onClick`, `onChange`, `colSpan`,
   `rowSpan`, `title`, `data-testid` — tudo migra para o componente novo.
5. **Classes condicionais continuam funcionando.** `<TableRow>`,
   `<TableCell>` etc. aceitam `className` e fazem merge via `cn()`. Um
   `className={cond ? "bg-red-50" : ""}` continua valendo.
6. **Nunca use `git checkout --`, `git reset --hard` ou `git clean`** para
   "desfazer" um passo. Se errou, corrija editando.
7. **Não formate arquivo inteiro.** Rodar `yarn format` num arquivo de 2.000
   linhas gera um diff impossível de revisar. Edite só o trecho alvo.

## Verificação (rode ao fim de toda fase, sem exceção)

```bash
yarn run check    # tsc --noEmit — precisa do "run"! (ver AGENTS.md)
yarn test         # vitest run
yarn build        # o build precisa passar
```

`yarn run check` é o portão mais importante: quase todo erro de migração de
tabela (prop trocada, import faltando, tag não fechada) aparece ali.

Depois, confira visualmente as páginas tocadas com `yarn dev`. As fases
listam quais rotas abrir.

### Como saber se a fase realmente reduziu código

Antes e depois de cada fase:

```bash
# total de linhas em pages/
find client/src/pages -name "*.tsx" -not -name "*.test.tsx" -exec cat {} + | wc -l

# tabelas cruas restantes (a meta das fases 6–10 é chegar a 2)
grep -rn "<table" --include="*.tsx" client/src/pages | wc -l
```

> As duas ocorrências que **devem sobrar** são strings de exportação HTML,
> não JSX: `comercial/TabelaPrecos.tsx:716` e `financeiro/Financeiro.tsx:294`
> montam HTML em template string para gerar arquivo Excel/impressão. **Não
> converta essas duas.**

## Meta da sprint

| Métrica | Antes | Meta | Real |
|---|---|---|---|
| Linhas em `pages/` | ~43.200 | ≤ 38.000 | 42.779 |
| `<table>` cru em JSX | 65 | 0 (2 export ficam) | 4 (2 export + 2 adiadas, ver abaixo) |
| Arquivos usando `ui/table` | 2 | ~31 | 28 |
| `KpiCard` definidos localmente | 7 | 0 | 2 (justificados, ver abaixo) |
| `CustomTooltip` definidos localmente | 7 | 0 | 2 (justificados, ver abaixo) |
| Formatadores de data/moeda locais | 10+ | 0 | 4 (justificados, ver abaixo) |

A redução de linhas ficou bem abaixo da meta (42.779 vs. ≤ 38.000) — como
previsto no guia da Fase 12, não forçamos o número. O ganho real desta
sprint não é a contagem de linhas e sim a eliminação de duplicação:
`ui/table` foi de 2 para 28 arquivos, e a maior parte das 65 tabelas cruas,
dos 7 `KpiCard` e dos 7 `CustomTooltip` locais viraram componente
compartilhado. Páginas grandes como `logistica/Empacotamento.tsx` (5.012
linhas) continuam praticamente do mesmo tamanho porque a sprint não mexeu
em quebra de arquivo — só em duplicação de padrão de UI.

## Não feito nesta sprint

- **`retrabalhos/Retrabalhos.tsx` e `retrabalhos/Relatorio.tsx`** continuam
  com `<table>` cru. Dependem inteiramente da classe `.tech-table`
  (`client/src/index.css:274-290`, sem paddings/cores Tailwind de
  fallback); a Fase 6 já registrou essa decisão no commit
  `8c81cfc` e a Fase 12 não teve como verificar visualmente a conversão
  (sem ferramenta de screenshot no ambiente), então manteve o adiamento.
  Fica para quando alguém puder conferir na tela.
- **`comercial/PerformanceComercial.tsx`** mantém `KpiCardComMeta` e
  `CustomTooltip` locais — os cards precisam de `meta`/`metaReal`/
  `metaTarget` e o tooltip escolhe o formato (R$ / % / número cru) por
  nome de série, nenhum dos dois coberto pelo `KpiCard`/`ChartTooltip`
  compartilhados.
- **`operacoes/Performance.tsx`** mantém `KpiCardOperacoes` local — mesma
  razão do item acima: barra de status, badge de % de meta e seta de
  tendência não têm equivalente no `KpiCard` compartilhado.
- **`comercial/EvolucaoVendedor.tsx`** mantém `CustomTooltip` local — ordena
  as séries por valor decrescente e formata cada uma pelo indicador
  selecionado; o `ChartTooltip` compartilhado não ordena payload.
- **`comercial/CrmAuditoria.tsx`** mantém `formatDate`/`formatDateShort`
  locais — fazem parsing de string `YYYY-MM-DD` sem passar por `Date`,
  evitando o shift de fuso horário que `new Date("YYYY-MM-DD")` introduz;
  `formatDateShort` também inclui o dia da semana, que `lib/format` não
  tem.
- **`comercial/EvolucaoDiariaVendedor.tsx`** mantém `fmtBrl` local — sem
  casas decimais (rótulo de gráfico), diferente do `fmtBrl` compartilhado
  (sempre 2 casas).
- **`logistica/Transportadoras.tsx`** mantém `formatDate` local — em caso
  de data inválida devolve a string original em vez de "—", um fallback
  que `lib/format` não replica.
- `logistica/Empacotamento.tsx` (5.012 linhas) precisa ser quebrado em
  componentes — sprint própria.
- `comercial/PerformanceComercial.tsx` (2.773 linhas) — idem.
- `operacoes/Performance.tsx` (1.980 linhas) — idem.
- Adoção de `ui/chart.tsx` (shadcn) nos gráficos recharts — sprint própria.
- `ui/field`, `ui/item`, `ui/input-group`, `ui/button-group` seguem com
  adoção zero; os formulários das páginas ainda montam `Label` + `Input`
  na mão.
- `ui/pagination` usado em 1 arquivo; várias listas longas ainda renderizam
  tudo de uma vez.
- Encontramos, fora do escopo mecânico da Fase 12 (que só varre
  `formatDate`/`fmtBrl`/`formatCurrency`/`fmtDate`), outras ~20 páginas com
  variações locais de `fmtNum`/`fmtBRL`/`MESES`/`MESES_ABREV` que duplicam
  `lib/format.ts` — não convertidas aqui para não expandir o escopo da fase
  de fechamento; candidato a uma sprint de formatadores fase 2.
