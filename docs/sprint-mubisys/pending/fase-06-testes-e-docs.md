# Fase 6 — Testes, documentação e limpeza

**Achados atacados:** A11 (testes que não testam nada), A12 (documentação
desatualizada), A13 (frete simulado confundido com dado real).
**Depende de:** Fases 1–5.
**Toca:** `server/__tests__/mubisys.test.ts` (reescrita), `AGENTS.md`,
`docs/funcionalidades.md`, `docs/api/`, `server/integrations/mubisys-frete.ts`.

Fecha a sprint. Nenhuma mudança de comportamento.

---

## 1. A11 — Testes reais

`server/__tests__/mubisys.test.ts` hoje faz três coisas, e nenhuma testa a
integração:

- dois testes que só verificam se variáveis de ambiente existem — falham em
  qualquer ambiente sem `.env`, sem indicar bug de código;
- um teste de conectividade que aborta em 20 s e se auto-ignora — como a
  listagem leva ~25 s, **ele é pulado quase sempre**.

Reescrever com duas camadas.

### 1.1 Testes de mapeamento (offline, sempre rodam)

O que quebrou em produção foi mapeamento de campo, não rede. Testar as funções
puras com uma resposta real capturada — salvar em
`server/__tests__/fixtures/mubisys-os-6917.json` (a resposta de
`/ordem-servico/numero/6917`, com o CNPJ e o nome já anonimizados se preferir,
desde que a **estrutura** seja preservada).

Casos mínimos:

| Teste | Garante que |
|---|---|
| CNPJ vem de `cliente_cnpj_cpf` | A1 não volta |
| `cliente_id` ≠ `cliente_endereco[0].id` no fixture, e o código usa `cliente_id` | A1 não volta pela porta dos fundos |
| `prazo` (`"02 dias úteis"`) nunca vira data | A5 não volta |
| `normalizarData` aceita `dd/mm/aaaa`, ISO e devolve `null` para texto livre | contrato da coluna `date` |
| Envelope de lista com `last_page: 3` percorre as 3 páginas | A2/A3 não voltam |
| Resposta 404 vira `null`, não exceção | A8 não volta |

Os dois últimos precisam de `fetch` mockado (`vi.stubGlobal("fetch", …)`) — não
de rede.

### 1.2 Teste de contrato (online, opcional e explícito)

Um único teste que bate na API real, **pulado por padrão** e ligado por
variável:

```ts
const rodarContrato = process.env.MUBISYS_TESTE_CONTRATO === "1";
describe.skipIf(!rodarContrato)("contrato da API MubiSys (rede)", () => {
  it("busca por número devolve a OS com os campos documentados", async () => {
    const os = await buscarOSPorNumero("6917");
    expect(os?.cliente_cnpj_cpf).toBeTruthy();
    expect(os?.cliente_id).toBeTypeOf("number");
  }, 30_000);

  it("OS inexistente devolve null", async () => {
    expect(await buscarOSPorNumero("999999")).toBeNull();
  }, 30_000);
});
```

Assim `yarn test` fica rápido e determinístico, e há um comando explícito para
revalidar o contrato quando o fornecedor mudar algo:

```bash
MUBISYS_TESTE_CONTRATO=1 yarn test mubisys
```

Registrar essa variável no `.env.example` com comentário de que é só para
teste, **não** de runtime.

Os dois testes de "variável existe" saem. Se a intenção era guardar contra
deploy sem credencial, o lugar disso é o aviso de boot da Fase 5.

## 2. A12 — Documentação

| Onde | Correção |
|---|---|
| `AGENTS.md:174` | Cita `server/sync/sync-erp.ts` e `heartbeat-sync-erp.ts`, que **não existem**. A pasta tem só `scheduled-sync-os.ts` e `scheduled-sync-os-handler.ts` |
| `docs/funcionalidades.md` §13 | Descreve a integração pelo cliente antigo; atualizar para o cliente único e apontar para `docs/integracao-mubisys.md` |
| `docs/api/mubisys-openapi-v1.json` | É uma **coleção Postman**, não OpenAPI. Renomear para `mubisys-postman-collection.json` e ajustar as referências. Acrescentar um `README.md` na pasta dizendo que `/ordem-servico/numero/{n}` existe em produção e **não** está na coleção |
| `docs/cron-qstash.md` | Preencher a tabela de tempo medido por lote (Fase 3), os 4 comandos de criação dos schedules e o que a Fase 5 fez com o endpoint de status |
| `todo.md:1404` | Corrigir — ver §2.1 |
| `docs/integracao-mubisys.md` | Marcar os achados resolvidos, mantendo o texto original de cada um (é o registro do que aconteceu, não uma lista de tarefas) |

### 2.1 `filtrodata`: decidido `APROVACAO`

`performanceComercial.ts:341` usa `APROVACAO` e **está correto**: decidido em
17/08/2026 que o faturamento do mês conta as OS **aprovadas** no mês, alinhado
ao relatório de Vendas do ERP. Nada muda no código.

Quem está errado é `todo.md:1404`, que registra como "correção crítica" a troca
para `CADASTRO`. Substituir aquela linha por um registro do que vale:

```markdown
- [x] `filtrodata=APROVACAO` nas OS da API MubiSys (performanceComercial.ts) —
      confirmado em 17/08/2026: o faturamento do mês conta as OS **aprovadas**
      no mês. A entrada anterior desta linha dizia o oposto e estava errada.
```

Isso importa porque a linha antiga já induziu a leitura de que o código estava
divergente da decisão — e o próximo a mexer ali quase certamente "corrigiria" o
código para o valor errado.

## 3. A13 — Frete simulado

`obterCotacoesFreteSimuladas` (`mubisys-frete.ts:186`) devolve
Sedex/PAC/Loggi com preço `peso × 2,5 + valor × 1%`. Não vem do ERP nem de
transportadora — e vive num arquivo chamado `mubisys-frete.ts`, o que convida à
confusão.

Escopo aqui é **só deixar explícito**, não implementar cotação real:

```ts
/**
 * ⚠️ PLACEHOLDER — não é cotação real de frete.
 * Não consulta o MubiSys nem transportadora: devolve 4 transportadoras fixas
 * com preço calculado por fórmula. Consumido por logistica.ts (cotarFrete).
 * Substituir por integração real é trabalho fora da sprint de consolidação
 * do ERP (ver docs/integracao-mubisys.md, achado A13).
 */
```

E acrescentar a mesma ressalva onde o resultado aparece na UI, se ainda não
houver.

## 4. Limpeza final

```bash
# Nenhum consumidor fora do cliente único:
grep -rn "api.mubisys.com" server/ | grep -v "integrations/mubisys-client.ts"
# → só docs e testes podem aparecer

# Nenhuma leitura direta de credencial:
grep -rn "process.env.MUBISYS" server/ | grep -v "_core/env.ts"
# → vazio

# Nenhum https.get sobrando por causa do ERP:
grep -rn "https.get" server/routers/
# → só o da BrasilAPI em logistica.ts
```

## 5. Verificação

```bash
yarn run check
yarn test                                   # rápido, sem rede
MUBISYS_TESTE_CONTRATO=1 yarn test mubisys  # com rede, sob demanda
yarn build
yarn dev
```

## 6. Critério de pronto

- [ ] Testes de mapeamento passam sem rede e cobrem A1, A2, A5, A8.
- [ ] Teste de contrato existe e é pulado por padrão.
- [ ] `AGENTS.md`, `docs/funcionalidades.md`, `docs/cron-qstash.md` e a pasta
      `docs/api/` corretos.
- [ ] Pergunta do `filtrodata` formulada e registrada (respondida ou não).
- [ ] `obterCotacoesFreteSimuladas` marcada como placeholder.
- [ ] Os três `grep` da §4 retornam o esperado.
- [ ] Fases movidas de `pending/` para `complete/`.
