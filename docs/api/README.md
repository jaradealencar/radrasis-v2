# docs/api/

## `mubisys-postman-collection.json`

Apesar do nome antigo (`mubisys-openapi-v1.json`), isto é uma **coleção do
Postman** (`schema: v2.1.0/collection.json`), não um documento OpenAPI —
renomeado na Fase 6 de `docs/sprint-mubisys/` para refletir o que o arquivo
realmente é.

**Faltando na coleção, mas em produção:** `GET
/ordem-servico/numero/{sequencial_ordem}` — usado por
`buscarOSPorNumero` (`server/integrations/mubisys-client.ts`) para buscar uma
OS pelo número que o usuário digita. Verificado contra a API real em
17/08/2026 (OS 6917 → HTTP 201, ~226 ms). Ver
[`docs/integracao-mubisys.md`](../integracao-mubisys.md) §1 para o contrato
medido (inclusive onde diverge desta coleção) e §3 (achado A12) para o
histórico dessa divergência.
