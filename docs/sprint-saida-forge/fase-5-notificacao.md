# Fase 5 — Notificação ao dono: Forge → alertas do próprio app

> Leia o `README.md` desta pasta antes de começar.

**Objetivo:** `notifyOwner` para de chamar o serviço de notificação do Forge
e passa a criar um alerta dentro do próprio sistema.

**Pré-requisitos:** nenhum. Esta fase é independente das outras.

**Arquivos que você vai tocar:**
- `drizzle/schema.ts` + uma migration nova
- `server/db/alertas-helpers.ts` (novo)
- `server/_core/notification.ts` (reimplementação)
- `server/routers/qualidade.ts` (mover uma função)
- `client/src/pages/qualidade/Alertas.tsx` (uma linha)

---

## Por que reaproveitar os alertas

O projeto **já tem** um sistema de notificação in-app completo, hoje usado só
pra alertas automáticos de qualidade:

- tabela `alertasSistema` (`drizzle/schema.ts:1022`) — já tem `titulo`,
  `descricao`, `severidade` e `status` (`ativo`/`lido`/`arquivado`);
- `alertasRouter` (`server/routers/qualidade.ts:638`) — listar, contar,
  marcar como lido, arquivar;
- página `client/src/pages/qualidade/Alertas.tsx`;
- **badge de contagem já visível em todas as telas**
  (`DashboardLayout.tsx:158`, com `refetchInterval: 60000`).

Ou seja: a parte cara já está pronta. Esta fase é só plugar `notifyOwner`
nessa estrutura — é a versão "dentro do app" mais próxima do que o Forge
fazia, sem provedor externo nem e-mail pra configurar.

O único call site real de `notifyOwner` é `Empacotamento.tsx`, que avisa
quando um pedido chega ao pátio.

---

## Tarefa 5.1 — Migration: novo valor no enum de tipo

`alertaTipoEnum` (`drizzle/schema.ts:38`) é fechado:

```ts
["reincidencia", "meta_excedida", "sem_acao", "prazo_vencido", "novo_retrabalho", "atraso_expedicao"]
```

Nenhum serve pra notificação manual. Adicione `"manual"`.

Siga o fluxo de migration do `AGENTS.md` — **não rode `ALTER TYPE` na mão**:

1. edite o enum em `drizzle/schema.ts`;
2. `npx drizzle-kit generate`;
3. **revise o SQL gerado.** Deve ser um `ALTER TYPE alerta_tipo ADD VALUE
   'manual'` simples. Como você está *adicionando* um valor (não renomeando
   nem removendo), não precisa do `USING CASE` que o `AGENTS.md` menciona pra
   enums já em uso;
4. `npx drizzle-kit migrate`.

Depois, em `client/src/pages/qualidade/Alertas.tsx`, adicione a entrada
correspondente no `TIPO_LABELS` (~linha 10):

```ts
manual: "Notificação",
```

Sem isso o alerta aparece na lista sem rótulo legível.

---

## Tarefa 5.2 — Extrair o helper `criarAlerta`

A função que insere em `alertasSistema` (`criarAlerta`,
`server/routers/qualidade.ts:16-37`) hoje é privada dentro daquele router.

Mova para `server/db/alertas-helpers.ts` (ao lado dos outros
`server/db/*-helpers.ts` que já existem) e exporte. `qualidade.ts` passa a
importar dali.

Motivo: `server/_core/notification.ts` é infra e **não deve importar de dentro
de `server/routers/`** — a dependência tem que apontar pro contrário.

---

## Tarefa 5.3 — Reimplementar `notifyOwner`

Em `server/_core/notification.ts`, jogue fora o `fetch` pro Forge e a
construção de endpoint. **Mantenha a assinatura exatamente igual** —
`notifyOwner({ title, content }): Promise<boolean>` — porque
`server/_core/systemRouter.ts` e o client dependem dela.

O corpo passa a ser uma inserção via o helper da 5.2:

```ts
tipo: "manual",
severidade: "aviso",
titulo: title,
descricao: content,
status: "ativo",
```

**Mantenha as validações de payload que já existem** (título e conteúdo
obrigatórios, limites de tamanho) — elas continuam válidas e viram a única
proteção, já que agora a escrita é direto no banco. Confira que os limites
batem com as colunas: `titulo` é `varchar(256)`, mas a validação atual
permite 1200 caracteres. **Ajuste o limite do título pra 256**, senão um
título longo passa na validação e estoura no `INSERT`.

Sobre o `try/catch` que hoje devolve `false` quando o serviço está
inalcançável: não existe mais serviço remoto pra ficar inalcançável. Pode
deixar o erro de banco propagar, ou manter o `catch` por robustez — decisão
de estilo, tanto faz. Só não deixe engolindo erro em silêncio.

---

## Tarefa 5.4 — Decidir quem vê (verificar, não mudar de lado)

`alertas.list` e `alertas.countAtivos` são `publicProcedure` hoje — qualquer
sessão vê todos os alertas.

Isso significa que a notificação de "pedido no pátio", que antes ia só pro
dono, passa a ser visível pra quem abrir a página Alertas. Provavelmente é
aceitável (só `adminProcedure` consegue **criar** via `system.notifyOwner`),
mas **confirme com o dono do projeto**.

⚠️ Se a resposta for "tem que restringir": trocar essas procedures pra
`requireRole("admin", "master")` afeta **todos** os alertas do sistema,
inclusive os automáticos de qualidade que já existem e que outras pessoas
usam hoje. **Não faça essa mudança de lado dentro desta fase** — vira tarefa
própria, com validação de quem usa a página.

---

## O que NÃO fazer nesta fase

- Não instale `resend` nem nenhum provedor de e-mail. Essa opção foi
  descartada (ver README).
- Não redesenhe a página de Alertas nem adicione sino no header — o badge já
  existe e funciona.
- Não mude a permissão das procedures de alerta (ver 5.4).

---

## Verificação

1. `npx tsc --noEmit` — mesma contagem de erros de antes (17).
2. Mova um pedido pro pátio em Empacotamento.
3. Confirme que o alerta aparece na lista de `Alertas.tsx` **e** que o badge
   do `DashboardLayout` incrementa em até 60s (o intervalo do polling).
4. Marque o alerta como lido e confirme que o badge desce.

**Commit sugerido:** `feat(notificacao): notifyOwner passa a criar alerta in-app (Fase 5)`
