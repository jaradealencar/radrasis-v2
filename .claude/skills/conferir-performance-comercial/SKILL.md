---
name: conferir-performance-comercial
description: Confere se os números da Visão Geral do Performance Comercial (Faturamento, Vendas Realizadas, Clientes Únicos) batem com o relatório de Vendas mais recente baixado do MubiSys. Use quando o usuário desconfiar de números errados/desatualizados no dashboard comercial (Faturamento Gerado, Vendas Realizadas, Clientes Novos), pedir para "conferir com o MubiSys", ou mencionar que um número "parece errado" na Performance Comercial.
---

# Conferir Performance Comercial vs. relatório MubiSys

O dashboard de Performance Comercial (`client/src/pages/comercial/PerformanceComercial.tsx`,
endpoint `performanceComercial.getMes`) busca o mês vigente ao vivo na API do MubiSys, mas
essa API tem timeout de 45s (limite de `maxDuration:60s` da função serverless na Vercel) e
**cai silenciosamente para um fallback local** (`historico_os`, atualizado só pelo import
mensal) sempre que demora mais que isso — o que acontece com frequência perto do fim do mês,
quando há mais dados para buscar. O único sinal visível disso na tela é o badge no topo
("⚡ TEMPO REAL" vs "⚠️ API INDISPONÍVEL — dados locais"), fácil de não notar. Quando isso
acontece, Faturamento/Vendas Realizadas/Clientes Únicos ficam presos a um instante passado
sem nenhum erro visível — foi exatamente o que gerou a investigação de 2026-09-25 que originou
esta skill (ver memória de projeto `performance_comercial_cache_bugs_2026_09` e
`marketing_financeiro_alinhamento_mes_vigente`).

## Quando usar

- O usuário desconfia que Faturamento/Vendas/Clientes na Visão Geral estão errados ou
  desatualizados.
- Antes de investigar "bug" no código: primeiro confirme se é isso (fallback desatualizado)
  ou se é uma divergência real de regra de negócio — são causas completamente diferentes.

## Passo a passo

1. **Peça para o usuário baixar (ou confirmar que já baixou) o relatório de Vendas do
   período em questão diretamente no MubiSys**, se ainda não tiver um recente na pasta
   Downloads. O relatório se chama `Resultado_<algo>_<mes>_<ano>.xlsx`.

2. **Rode o script de comparação:**
   ```
   node ".claude/skills/conferir-performance-comercial/scripts/comparar.cjs" <mes> <ano>
   ```
   (mes/ano são opcionais — sem eles, usa o mês/ano atual). Rode a partir da raiz do
   projeto (`C:\Users\USUARIO\Documents\dev\radrasis-v2`). A chamada com `forceRefresh:true`
   pode levar até ~45s — isso é esperado, não é o script travando.

3. **Leia a saída:**
   - `Fonte dos dados: ✅ api (ao vivo)` → o número do sistema é confiável agora; compare
     as diferenças (pequenas diferenças são esperadas se o relatório foi baixado antes da
     venda mais recente).
   - `Fonte dos dados: ⚠️ local` → confirma o fallback desatualizado. Não é bug de regra de
     negócio — é a API do MubiSys tendo estourado o timeout dessa vez. Sugira tentar de
     novo em alguns minutos (a instabilidade costuma ser intermitente, não constante — já
     visto oscilar entre sucesso e timeout em tentativas de poucos minutos de intervalo).
   - A linha `Autoconferência` precisa mostrar ✅ — se não bater, o parser do script está
     desalinhado com um novo formato de relatório do MubiSys, não confie no resto da saída
     até corrigir `scripts/comparar.cjs`.

4. **"Clientes Novos"/"Reativados" não são cobertos** — `performanceComercial.getClientesNovos`
   é `protectedProcedure` (exige sessão logada), não dá pra chamar de fora do browser. Para
   esses números, peça ao usuário para clicar em "Atualizar" na própria tela (já logada) e
   comparar clientesUnicos do script como proxy de sanidade (mesma fonte de OS, mesma
   causa-raiz se divergir).

## O que o script faz (resumo — detalhes comentados em `scripts/comparar.cjs`)

Lê o `.xlsx` mais recente em Downloads com a lib `xlsx` (já em `node_modules` do projeto),
recalcula Faturamento/OS válidas/Clientes únicos aplicando a mesma regra de negócio do
sistema (exclui status "Cancelada" e tipo Retrabalho/Amostra/Cortesia — `isOsNormalDb`/
`isOsNormalApi` em `server/routers/performanceComercial.ts`), confere esse cálculo contra a
própria linha "Totalização" do rodapé do arquivo, e compara com uma chamada
`forceRefresh:true` ao endpoint público `performanceComercial.getMes` em produção
(`https://radrasis-v2.vercel.app`).

**Nota de formato:** o relatório do MubiSys usa separador de milhar `,` e decimal `.`
(`R$ 3,500.00`, padrão en-US) — diferente do formato pt-BR usado no resto do sistema. Se o
relatório mudar de formato, ajuste `parseMoneyUS` no script antes de confiar nos números.
