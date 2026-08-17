# Fase 2 — 🔴 Dados errados no frete e cache incompleto

**Achados atacados:** A1 (CNPJ e razão social de outro cliente), A5 (cache
gravado incompleto), A6 (regex de CNPJ no empacotamento).
**Depende de:** Fase 1 (usa `buscarOSPorNumero`, `buscarClientePorId`).
**Toca:** `server/routers/logistica.ts`, `server/integrations/mubisys-frete.ts`,
`server/routers/empacotamento.ts`.

**Esta é a fase mais urgente da sprint.** As outras corrigem lentidão e dívida;
esta corrige dado errado que já saiu impresso em romaneio de despacho e foi
usado para emitir CT-e.

---

## 1. O bug, comprovado

`server/routers/logistica.ts:394-478`, função `fetchDadosOsMub`:

```ts
const cnpjDedicado: string = json.cnpj_cpf ?? json.cnpj ?? json.cpf_cnpj ?? json.documento ?? "";
```

**Nenhum desses quatro campos existe** na resposta de `/ordem-servico`. O campo
correto é `cliente_cnpj_cpf`, e ele vem preenchido na própria OS. Como a
cascata não acha nada, o código tenta extrair CNPJ por regex da string
`cliente` — que contém só o nome (`"AMG COMUNICACAO VISUAL"`) — e, falhando de
novo, cai no fallback da linha 450:

```ts
if (!cnpj && end.id) {
  const clienteUrl = `.../cliente/${end.id}`;   // ← end.id é o id do ENDEREÇO
```

`end` é `cliente_endereco[0]`. Seu `id` é a chave do endereço, não do cliente.
A API aceita ambos e devolve HTTP 200 nos dois casos. Medido na OS 6917:

| Chamada | Retorno |
|---|---|
| `/cliente/2931` (`json.cliente_id`, correto) | `AMARILDO DE ARRUDA MACHADO` · `52.396.341/0001-21` |
| `/cliente/2924` (`cliente_endereco[0].id`, o que o código usa) | `ALPHA COMUNICACAO VISUAL LTDA` · `40.978.080/0001-79` |

O segundo é o que vai para o banco.

## 2. O que fazer

### 2.1 `logistica.ts` — trocar a heurística pelo campo real

Deletar `fetchDadosOsMub` inteira (linhas 374–483) e reescrever usando o
cliente da Fase 1. **Toda a lógica de regex de CNPJ sai** — não há CNPJ para
extrair de `cliente`.

```ts
import { buscarOSPorNumero, buscarClientePorId } from "../integrations/mubisys-client";

/** Formata CNPJ/CPF cru ou já pontuado. Devolve "" se não for nem um nem outro. */
function formatarDocumento(valor: string | null | undefined): string {
  const nums = String(valor ?? "").replace(/\D/g, "");
  if (nums.length === 14) return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (nums.length === 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return String(valor ?? "").trim();
}

async function fetchDadosOsMub(numeroOs: string) {
  const os = await buscarOSPorNumero(numeroOs);
  if (!os) return null;

  const end = os.cliente_endereco?.[0];

  // O CNPJ vem na própria OS. A chamada extra a /cliente só existe para o caso
  // (raro) de a OS vir sem ele — e usa cliente_id, NUNCA o id do endereço.
  let cnpj = formatarDocumento(os.cliente_cnpj_cpf);
  let nomeCliente = String(os.cliente ?? "").trim();

  if (!cnpj && os.cliente_id) {
    const cli = await buscarClientePorId(os.cliente_id);
    if (cli) {
      cnpj = formatarDocumento(cli.cnpj_cpf);
      if (!nomeCliente) nomeCliente = cli.razao_social ?? "";
    }
  }

  return {
    nomeCliente,
    cnpj,
    cep: (end?.cep ?? "").replace(/\D/g, ""),
    endereco: [end?.logradouro, end?.numero, end?.complemento, end?.bairro].filter(Boolean).join(", "),
    cidade: end?.cidade ?? "",
    estado: end?.estado ?? "",
    valorNf: os.valor_total ? String(Number(os.valor_total).toFixed(2)) : "",
    vendedor: os.vendedor ?? "",
    // `prazo` é texto livre ("02 dias úteis") — não serve como data. Só
    // data_entrega entra aqui.
    dataEntregaPrevista: os.data_entrega ?? "",
    dataAprovacao: os.data_aprovacao ?? "",
  };
}
```

Remover o `import https from "https"` de `logistica.ts` **apenas se** não
sobrar outro uso — a busca na BrasilAPI (linha ~1020) ainda usa. Verifique
antes de apagar.

### 2.2 `mubisys-frete.ts` — o mesmo campo, e cache completo

Em `buscarDadosOSParaFrete`, o bloco de fallback da API (linhas 109–141):

- `clienteCnpj` já usa `os.cliente_cnpj_cpf` primeiro — **está correto**, só
  remover a cascata `?? (os as any).cnpj ?? (os as any).cnpjCliente` que vem
  depois, pelo mesmo motivo da regra de ouro 4 (campos que não existem).
- `entrega:` hoje é `formatarDataOS(os.data_entrega ?? (os as any).prazo ?? ...)`.
  **Tirar o `prazo`** — é texto, não data.

`gravarNoCache` (linha 150) precisa gravar os três campos que faltam (A5).
Hoje o `INSERT` omite `dataEntregaPrevista`, `valorTotal` e `email`, e o guard
`cacheCompleto` (linha 72) não exige nenhum deles — então o registro capenga é
aceito para sempre.

Duas mudanças:

1. **Passar os campos que faltam.** `DadosFreteAutomatico` já carrega
   `entrega` e `valor_nf`; acrescentar `email` ao tipo e ao mapeamento vindo de
   `os.cliente_contato?.[0]?.email`.
2. **Gravar data em formato de data.** A coluna `dataEntregaPrevista` é `date`
   — `"05/08/2026"` não entra. Reaproveitar a normalização que já existe em
   `scheduled-sync-os.ts:182` (`normalizarData`); a Fase 3 move essa função
   para um lugar compartilhado. Nesta fase, **duplicar é aceitável** desde que
   a Fase 3 remova a cópia.

Além disso, uniformizar `dataAprovacao`: hoje o frete grava formatado
(`"03/08/2026 às 08:38"`) e o sync grava cru (`"2026-08-03 08:38:30"`), na
mesma coluna. **Gravar sempre o valor cru; formatar só na leitura**
(`formatarDataOS` já é chamada na leitura do cache, linha 89).

### 2.3 `empacotamento.ts` — mesma correção, menor impacto

`buscarOsMubisys` (linha 7) reimplementa HTTP e extrai CNPJ por regex do fim da
string `cliente` (linha 37). Trocar o corpo inteiro por `buscarOSPorNumero` e
`os.cliente_cnpj_cpf`. **Preservar intacta** a lógica de m² dos itens
(linhas 44–75, incluindo `itens_agrupados`) — ela está correta e não tem
relação com o bug.

## 3. Verificação

```bash
yarn run check
yarn test
yarn dev
```

Manual, no browser — **este passo não é opcional nesta fase**:

1. `/logistica/solicitacoes` → "Nova Cotação" → OS **6917** → Buscar.
   - CNPJ deve ser **52.396.341/0001-21** (era `40.978.080/0001-79`).
   - Cliente: `AMG COMUNICACAO VISUAL`. Cidade `AMAMBAI/MS`, CEP `79990-000`.
2. Repetir com uma OS **que não existe** (ex.: 999999) → mensagem de "não
   encontrada", sem erro de rede na console.
3. `/logistica/empacotamento` → nova entrada com OS 6917 → cliente e m²
   preenchidos.

Conferir também o cache, depois do passo 1:

```sql
SELECT "numeroOs", "razaoSocial", cnpj, "dataAprovacao", "dataEntregaPrevista", "valorTotal"
FROM erp_os_cache WHERE "numeroOs" = '6917';
```

Nenhuma das três últimas colunas pode estar nula.

## 4. Dívida deixada para trás (registrar no commit)

Registros de `erp_os_cache` e de `cotacoes_frete` gravados **antes** desta fase
podem conter CNPJ/razão social de outro cliente. Esta fase corrige o código,
**não faz backfill**. Levantar o estrago com:

```sql
SELECT COUNT(*) FROM erp_os_cache WHERE cnpj IS NOT NULL AND cnpj <> '';
```

e decidir com o dono do projeto se vale re-sincronizar (a Fase 3 deixa o sync
capaz de fazer isso). **Não faça o backfill por conta própria.**

## 5. Critério de pronto

- [ ] Nenhuma extração de CNPJ por regex sobrou em `logistica.ts` e `empacotamento.ts`.
- [ ] Nenhuma chamada a `/cliente/{id}` usa id de endereço.
- [ ] `prazo` não é mais usado como data em lugar nenhum.
- [ ] `gravarNoCache` grava `dataEntregaPrevista`, `valorTotal` e `email`.
- [ ] `dataAprovacao` é gravada crua pelos dois caminhos (sync e frete).
- [ ] OS 6917 no browser mostra CNPJ `52.396.341/0001-21`.
