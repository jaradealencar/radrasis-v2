# Fase 11 — Estados de carregando e vazio

**Depende de:** Fase 1.
Independente das fases 2–10 — pode sair a qualquer momento depois da 1.
**Só não rode em paralelo com outra fase** (toca os mesmos arquivos).

## Objetivo

O projeto tem `ui/spinner.tsx` e `ui/empty.tsx` (shadcn) instalados com
**adoção zero**. Enquanto isso, as páginas montam à mão o estado de
carregando (`<Loader2 className="animate-spin" />` em ~11 arquivos, 47
ocorrências) e o estado vazio (`<p>Nenhum registro encontrado</p>` em
variações espalhadas).

Esta fase padroniza os dois.

---

## Parte A — Carregando → `<Spinner>`

### Encontrar

```bash
grep -rn "Loader2" --include="*.tsx" client/src/pages
```

Concentração: `comercial/CRM.tsx` (9), `logistica/Assertividade.tsx` (6),
`retrabalhos/BibliotecaErros.tsx` (5), `financeiro/PCP.tsx` (5),
`operacoes/Conhecimento.tsx` (4), `logistica/LogisticaDashboard.tsx` (4), e
mais 5 arquivos com 2–3 cada.

### Conversão

```tsx
// ANTES
import { Loader2 } from "lucide-react";
…
<Loader2 className="w-4 h-4 animate-spin" />

// DEPOIS
import { Spinner } from "@/components/ui/spinner";
…
<Spinner />
```

O `Spinner` já é `size-4 animate-spin` com `role="status"` e
`aria-label="Loading"` — ganho de acessibilidade de graça.

Tamanhos diferentes passam por `className`:

```tsx
<Spinner className="size-6" />          // era w-6 h-6
<Spinner className="size-8 text-blue-600" />
```

### ⚠️ Não converta

- **`Loader2` dentro de um `<Button>` em estado de submit** só se o botão já
  usa `disabled={isPending}` — nesse caso converta normalmente, é o mesmo
  ícone. Mas **não** mude o `disabled`, o texto do botão ou a lógica de
  `isPending`.
- **`Loader2` com animação/rotação customizada** (`animate-[spin_2s_linear_infinite]`,
  transform próprio). Deixe.
- **Outros ícones de lucide** que não sejam `Loader2`.

---

## Parte B — Vazio → `<Empty>`

### Encontrar

```bash
grep -rniE "nenhum|nada encontrado|sem registros|sem dados|vazio" \
  --include="*.tsx" client/src/pages
```

### API do `ui/empty`

```tsx
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty";
```

### Conversão

```tsx
// ANTES
<div className="text-center py-12 text-slate-400">
  <FileX className="w-10 h-10 mx-auto mb-3 opacity-40" />
  <p className="text-sm">Nenhum plano de ação cadastrado</p>
  <Button className="mt-4" onClick={abrirModal}>Criar o primeiro</Button>
</div>

// DEPOIS
<Empty>
  <EmptyHeader>
    <EmptyMedia variant="icon"><FileX /></EmptyMedia>
    <EmptyTitle>Nenhum plano de ação cadastrado</EmptyTitle>
  </EmptyHeader>
  <EmptyContent>
    <Button onClick={abrirModal}>Criar o primeiro</Button>
  </EmptyContent>
</Empty>
```

Sem ícone e sem ação:

```tsx
<Empty>
  <EmptyHeader>
    <EmptyTitle>Nenhum resultado para os filtros aplicados</EmptyTitle>
    <EmptyDescription>Tente ampliar o período ou limpar os filtros.</EmptyDescription>
  </EmptyHeader>
</Empty>
```

> **Leia `client/src/components/ui/empty.tsx` antes de começar** para
> confirmar as props de `EmptyMedia` (`variant`) na versão instalada aqui.
> Se a assinatura diferir do exemplo, siga o arquivo, não este doc.

### ⚠️ Não converta

- **Estado vazio dentro de tabela.** A linha
  `<TableRow><TableCell colSpan={7}>Nenhum registro</TableCell></TableRow>`
  precisa continuar sendo uma linha de tabela — `<Empty>` ali quebra o
  layout. **Deixe como está.**
- **Estado vazio dentro de `<SelectContent>`, `<CommandEmpty>` ou dropdown.**
  Esses componentes têm o próprio slot de vazio.
- **Mensagem de erro** (`Erro ao carregar`, `Falha na requisição`). É outro
  estado; `Empty` é para "não há nada", não para "deu ruim". Deixe.
- **Textos que só aparecem condicionalmente no meio de um parágrafo.** Se
  não é um bloco de estado vazio da tela, não é alvo.

---

## Parte C — `Skeleton` (opcional, só se sobrar tempo)

`ui/skeleton.tsx` está em 3 arquivos. Onde uma página hoje mostra um spinner
gigante centralizado no lugar de uma lista/tabela que vai carregar, um
skeleton comunica melhor.

**Isto é melhoria de UX, não redução de código.** Faça no máximo em 2 ou 3
páginas de alto tráfego (Dashboard, CRM) e só se as partes A e B já
estiverem prontas e verificadas. Se estiver em dúvida, **pule** — não é
requisito da fase.

---

## Verificação

```bash
yarn run check
yarn test
yarn build
```

```bash
# deve cair bastante (de ~47)
grep -rn "Loader2" --include="*.tsx" client/src/pages | wc -l

# deve subir de 0
grep -rn "<Spinner" --include="*.tsx" client/src/pages | wc -l
grep -rn "<Empty" --include="*.tsx" client/src/pages | wc -l
```

Rode `yarn dev`. Estados de carregando e vazio são difíceis de ver com o
banco cheio e a rede rápida. Para forçá-los:

- **Carregando** — DevTools → Network → throttling "Slow 3G", recarregue a
  página e observe o spinner antes dos dados chegarem.
- **Vazio** — aplique um filtro que não retorna nada (período futuro, texto
  de busca sem correspondência).

Confira em pelo menos: CRM, Assertividade, Biblioteca de Erros, PCP,
Conhecimento.

## Definição de pronto

- [ ] `Loader2` substituído por `Spinner` onde o mapeamento se aplica
- [ ] Blocos de estado vazio substituídos por `Empty`, exceto os dentro de
      tabela / select / erro
- [ ] Estados forçados e conferidos em pelo menos 5 páginas
- [ ] Nenhuma lógica de `isPending`/`isLoading` foi alterada
- [ ] `yarn run check`, `yarn test`, `yarn build` passando
- [ ] Commit: `refactor(pages): padroniza estados de loading e vazio (sprint pages, fase 11)`
