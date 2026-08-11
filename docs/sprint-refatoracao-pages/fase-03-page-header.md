# Fase 3 — Cabeçalhos de página → `<PageHeader>`

**Depende de:** Fase 1 (assume `client/src/components/PageHeader.tsx` criado).

## Objetivo

Substituir os **134 cabeçalhos montados à mão** por `<PageHeader>`. Cada um
hoje é um bloco de 6 a 12 linhas de JSX repetindo a mesma estrutura com
pequenas variações de cor e espaçamento.

## API do componente (referência)

```tsx
import PageHeader from "@/components/PageHeader";

<PageHeader
  title="POPs"
  description="Procedimentos operacionais padrão"
  icon={FileText}              // opcional — componente lucide, SEM <>
  iconColor="#1e6fd9"          // opcional
  actions={<Button …>Novo</Button>}  // opcional
/>
```

## Como encontrar os alvos

```bash
grep -rn "text-2xl font-bold\|text-3xl font-bold" --include="*.tsx" client/src/pages
```

São 134 ocorrências. **Nem toda ocorrência é um cabeçalho de página** — ver
a seção "O que NÃO converter" abaixo. Espere converter em torno de 60–70.

---

## Os três formatos em uso, e a conversão de cada um

### Formato 1 — só título

```tsx
// ANTES
<div className="mb-6">
  <h1 className="text-2xl font-bold text-slate-800">Metas e Benchmarks</h1>
</div>

// DEPOIS
<PageHeader title="Metas e Benchmarks" />
```

### Formato 2 — título + subtítulo + ações à direita

```tsx
// ANTES
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-slate-800">Custos Fixos</h1>
    <p className="text-sm text-muted-foreground">Gestão de despesas recorrentes</p>
  </div>
  <Button onClick={abrirModal}>
    <Plus className="w-4 h-4 mr-2" /> Novo custo
  </Button>
</div>

// DEPOIS
<PageHeader
  title="Custos Fixos"
  description="Gestão de despesas recorrentes"
  actions={
    <Button onClick={abrirModal}>
      <Plus className="w-4 h-4 mr-2" /> Novo custo
    </Button>
  }
/>
```

### Formato 3 — com ícone em caixa tonalizada

Exemplo real: `operacoes/Pops.tsx:378-386`.

```tsx
// ANTES
<div className="flex items-center gap-3">
  <div className="p-2 rounded-lg" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
    <FileText size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
  </div>
  <div>
    <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>POPs</h1>
    <p className="text-sm text-slate-500">Procedimentos operacionais padrão</p>
  </div>
</div>

// DEPOIS
<PageHeader
  title="POPs"
  description="Procedimentos operacionais padrão"
  icon={FileText}
/>
```

> **Note a mudança de `<FileText size={18} />` para `icon={FileText}`** — o
> `PageHeader` recebe o *componente*, não um elemento. Sem `<>`, sem props.
> Se o import do ícone ficar sem uso em outro lugar do arquivo, remova-o.

---

## Cor do ícone

O default do `PageHeader` é `#1e6fd9` (azul da marca). **Passe `iconColor`
apenas quando o cabeçalho original usava uma cor claramente diferente de
azul** (verde, vermelho, âmbar, roxo). Se o original usava um azul qualquer
(`#1e6fd9`, `#3b82f6`, `oklch(0.52 0.18 240)`, `text-blue-600`), **omita a
prop** — a leve diferença de tom é aceitável e é o ponto de padronizar.

Quando precisar de cor, prefira o token semântico:

```tsx
import { STATUS_COLORS } from "@/lib/chartColors";

<PageHeader title="Alertas" icon={AlertTriangle} iconColor={STATUS_COLORS.atencao} />
```

---

## O que NÃO converter

O `grep` de `text-2xl font-bold` pega muita coisa que **não** é cabeçalho de
página. Antes de converter, confirme que o bloco é o título do topo da
página. Não converta:

1. **Valores de KPI.** Ex.: `financeiro/CustosFixos.tsx:95`
   (`<div className="text-2xl font-bold" style={{ color: cor }}>{valor}</div>`)
   é o número dentro de um card, não um título. Fica para a Fase 4.
2. **Títulos de `CardTitle`, `DialogTitle`, `SheetTitle`, `<TabsTrigger>`.**
   São títulos de seção, não da página. Deixe.
3. **Títulos dentro de modais/drawers.**
4. **Cabeçalhos com layout realmente diferente** — se o bloco tem breadcrumb,
   tabs embutidas, barra de progresso ou um segundo nível de navegação
   colado no título, **não force** dentro do `PageHeader`. Deixe como está e
   anote no relatório final da fase.
5. **`ComponentShowcase.tsx`** — a vitrine não se toca (regra do README).

---

## Sugestão de ordem

Vá por pasta, uma pasta por vez, verificando entre elas:

1. `pages/*.tsx` (raiz: `Dashboard`, `Auditoria`, `Home`, `AcessoNegado`, `NotFound`)
2. `pages/admin/`
3. `pages/qualidade/`
4. `pages/retrabalhos/`
5. `pages/financeiro/`
6. `pages/operacoes/`
7. `pages/logistica/`
8. `pages/comercial/`

Isso mantém o commit rastreável e permite parar no meio sem deixar o repo
quebrado.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# quantos PageHeader entraram
grep -rn "<PageHeader" --include="*.tsx" client/src/pages | wc -l

# quantos h1 manuais sobraram (o número deve cair bastante;
# o que sobrar deve ser KPI/CardTitle, verificável a olho)
grep -rn "text-2xl font-bold" --include="*.tsx" client/src/pages | wc -l
```

Rode `yarn dev` e navegue por **todas as pastas de módulo** (pelo menos uma
página de cada). O cabeçalho deve aparecer no lugar certo, com o botão de
ação à direita e nada sobrando/faltando.

## Definição de pronto

- [ ] Cabeçalhos convertidos em todas as 8 pastas listadas
- [ ] Nenhum KPI, `CardTitle` ou título de modal foi convertido por engano
- [ ] Imports de ícone órfãos removidos
- [ ] Navegação visual conferida em pelo menos 1 página por módulo
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): unifica cabeçalhos em PageHeader (sprint pages, fase 3)`
