# Fase 6 — Mapas (Google Maps via proxy do Forge)

> ✅ **CONCLUÍDA.** Decisão tomada: **deletar**. `client/src/components/Map.tsx`
> foi removido e `@types/google.maps` desinstalado (`yarn remove`).
> Verificado: `npx tsc --noEmit` continua com os mesmos 17 erros
> pré-existentes (nenhum novo) e `yarn build` roda limpo.
>
> As envs `VITE_FRONTEND_FORGE_API_URL`/`VITE_FRONTEND_FORGE_API_KEY` **não
> existiam** no `.env`/`.env.example` — eram lidas só pelo `Map.tsx`, com
> valor padrão embutido no código. Não há nada de client pra remover na
> Fase 7. O resto do arquivo abaixo fica como registro da decisão.

**Objetivo:** decidir o que fazer com a última ponta do Forge no client.

**Pré-requisitos:** nenhum.

---

## A situação

`client/src/components/Map.tsx` exporta um componente `MapView` que carrega o
SDK do Google Maps através do proxy do Forge:

```ts
const API_KEY = import.meta.env.VITE_FRONTEND_FORGE_API_KEY;
const FORGE_BASE_URL = import.meta.env.VITE_FRONTEND_FORGE_API_URL || "https://forge.butterfly-effect.dev";
const MAPS_PROXY_URL = `${FORGE_BASE_URL}/v1/maps/proxy`;
```

**Nenhuma página do app importa `MapView`.** Foi confirmado por busca no repo
inteiro: os únicos lugares que mencionam o componente são o próprio arquivo e
o guia do template. É código morto herdado do template, não uma feature em
produção.

O arquivo tem ~75 linhas de comentário documentando a API do Google Maps
(marker, places, geocoder, geometry, routes) — é documentação do template,
não código nosso.

---

## Decisão a tomar (é de produto, não técnica)

**Existe alguma feature planejada que precise de mapa?**

### Se NÃO (provável) → deletar

```bash
rm client/src/components/Map.tsx
yarn remove @types/google.maps
```

Confirme antes que nada mais importa o arquivo. Carregar peso morto tem
custo: alguém vai ler, tentar entender, e talvez "consertar" um dia.

### Se SIM → trocar só a origem do script

**Não migre pra Mapbox ou outro provedor.** Isso reescreveria toda a API
usada no arquivo (`google.maps.marker.AdvancedMarkerElement`, `Geocoder`,
`DirectionsService`, `DirectionsRenderer`...) sem ganho nenhum.

O caminho de menor esforço mantém 100% do código já escrito e troca só de
onde o script vem:

1. Gere uma API key própria do **Google Maps JavaScript API**, restrita por
   domínio/referrer (sem restrição, a chave fica exposta no bundle do client
   e qualquer um pode usar na sua conta).
2. Em `Map.tsx`, troque `MAPS_PROXY_URL` por `https://maps.googleapis.com`.
3. Nova env `VITE_GOOGLE_MAPS_API_KEY`, substituindo
   `VITE_FRONTEND_FORGE_API_KEY`.

O resto do arquivo (o componente `MapView`, o `loadMapScript`, os
comentários) fica igual.

---

## Verificação

- **Se deletou:** `npx tsc --noEmit` e `yarn build` continuam funcionando, e
  uma busca por `MapView` no repo não retorna nada.
- **Se migrou:** renderize `MapView` numa página de teste e confirme que o
  mapa carrega, sem erro de chave no console do browser.

**Commit sugerido:** `chore(mapas): remove MapView morto do template` (ou
`feat(mapas): carrega Google Maps com chave própria`)
