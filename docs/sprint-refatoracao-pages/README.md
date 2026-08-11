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
| 1 | [fase-01-fundacao.md](fase-01-fundacao.md) | Cria as primitivas compartilhadas + refatora 1 página piloto | — |
| 2 | [fase-02-formatadores.md](fase-02-formatadores.md) | Substitui formatadores locais por `lib/format.ts` | 1 |
| 3 | [fase-03-page-header.md](fase-03-page-header.md) | 134 cabeçalhos manuais → `<PageHeader>` | 1 |
| 4 | [fase-04-kpi-card.md](fase-04-kpi-card.md) | 7 `KpiCard` locais → `components/KpiCard.tsx` | 1, 2 |
| 5 | [fase-05-graficos.md](fase-05-graficos.md) | 7 `CustomTooltip` locais + paleta de cores hardcoded | 1, 2 |
| 6 | [fase-06-tabelas-a-qualidade-retrabalhos-admin.md](fase-06-tabelas-a-qualidade-retrabalhos-admin.md) | `<table>` cru → `ui/table` (8 arq., 8 tabelas) | 1 |
| 7 | [fase-07-tabelas-b-financeiro.md](fase-07-tabelas-b-financeiro.md) | idem — financeiro (5 arq., 9 tabelas) | 6 |
| 8 | [fase-08-tabelas-c-logistica.md](fase-08-tabelas-c-logistica.md) | idem — logística (4 arq., 10 tabelas) | 6 |
| 9 | [fase-09-tabelas-d-operacoes.md](fase-09-tabelas-d-operacoes.md) | idem — operações (4 arq., 15 tabelas) | 6 |
| 10 | [fase-10-tabelas-e-comercial.md](fase-10-tabelas-e-comercial.md) | idem — comercial (7 arq., 23 tabelas) | 6 |
| 11 | [fase-11-estados-loading-vazio.md](fase-11-estados-loading-vazio.md) | Loading/vazio ad-hoc → `ui/spinner` + `ui/empty` | 1 |
| 12 | [fase-12-limpeza.md](fase-12-limpeza.md) | Varredura final, remoção de mortos, fechamento | 1–11 |

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

| Métrica | Antes | Meta |
|---|---|---|
| Linhas em `pages/` | ~43.200 | ≤ 38.000 |
| `<table>` cru em JSX | 65 | 0 |
| Arquivos usando `ui/table` | 2 | ~31 |
| `KpiCard` definidos localmente | 7 | 0 |
| `CustomTooltip` definidos localmente | 7 | 0 |
| Formatadores de data/moeda locais | 10+ | 0 |
