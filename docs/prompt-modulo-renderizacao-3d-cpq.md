# Prompt de implementação — Renderização 3D paramétrica do CPQ Letreiros Express

Documento único, pronto para ser fornecido a Claude, GPT ou outro agente de desenvolvimento.

## Papel do agente

Atue como engenheiro de software sênior especializado em TypeScript, React 19,
Three.js, geometria computacional, materiais PBR, Express, Zod, Drizzle ORM e
PostgreSQL. Implemente no Radrasys o penúltimo estágio do ciclo do **CPQ
Letreiros Express**: um módulo de renderização 3D técnica, interativa e
paramétrica de letras-caixa.

O módulo deve receber o vetor aprovado, as medidas físicas e os itens reais da
composição; resolver os materiais visuais vinculados às matérias-primas do
MubiSys; e construir uma representação 3D explicável da face, lateral/retorno,
fundo, perfis, fixadores e iluminação.

O resultado não pode ser uma extrusão genérica colorida. Ele deve representar a
montagem industrial escolhida no CPQ, permitir visão explodida, alternância
dia/noite, inspeção orbital e gerar imagens versionadas para proposta/PDF.

## Leia antes de alterar qualquer arquivo

1. Leia o AGENTS.md integralmente e siga as regras do repositório.
2. Leia os arquivos ativos citados aqui. Não use docs/archive/ como verdade.
3. Preserve alterações existentes no worktree.
4. Use Yarn Classic; não use npm install nem pnpm.
5. Mudança estrutural de banco nasce em drizzle/schema.ts, passa por geração do
   Drizzle e tem o SQL revisado antes da aplicação.
6. Ao concluir, rode typecheck, testes e build, revise o AGENTS.md e faça um
   commit exclusivo.

## Contexto real já verificado

- O front é React 19 + Vite 7, mas o CPQ canônico ainda é o HTML monolítico
  client/public/cpq-letreiros-express.html.
- STEP_DEFS_REAL possui oito etapas. O novo fluxo deve terminar em:
  Composição → **Visualização 3D** → Orçamento/PDF.
- O snapshot já contém nestingSvg, larguraNestingMm e alturaNestingMm.
- O mapeamento de cores possui pathIndexes, corHex, Pantone, CMYK e
  matéria-prima. Reutilize isso para logos multicoloridas.
- Linhas da composição têm papel em memória e camadaFisicaKit() reconhece
  Face/Aro/Fundo, mas papel ainda não entra no snapshot.
- materia_prima_cadastros já guarda espessura, densidade e dados de perfil.
- estudio_chapas já guarda cor, transmissão, transparência e dimensões.
- materia_prima_cadastros também registra, desde a migration 0094, aparência global: modo cor/textura, cor HEX e descrição, imagem de referência e descrição de textura para IA, tipo de transparência e transmissão de luz.
- O renderizador consulta `POST /api/letra-caixa/materias-aparencia` com `{ materiaPrimaIds }` da composição; a rota autenticada devolve cada ID pedido, sinaliza cadastro ausente e fornece aparência global e dados de cor/transparência por formato. Não devolve custos. Imagem de textura é referência visual, não mapa PBR nem tile com escala física garantida.
- O snapshot usa z.object(...).strict() em server/routes/estudio-cotacoes.ts.
- O storage oficial é UploadThing.
- clipper-lib e @types/clipper-lib já existem para offsets de contorno.
- Three.js, React Three Fiber e Drei ainda não estão instalados.

## Objetivos

1. Converter o SVG aprovado em formas com vazados e escala física.
2. Associar regiões da face aos materiais e cores aprovados.
3. Construir peças separadas: face, lateral oca, fundo, perfil, LEDs, fixadores
   e parede/halo.
4. Obedecer às medidas cadastradas; nunca inventar dado ausente.
5. Oferecer visão explodida, Dia/Noite, órbita, zoom e inspeção.
6. Persistir especificação versionada e aprovação humana.
7. Gerar previews diurno, noturno e explodido para PDF.
8. Expor visualização pública sem custos internos.

## Princípios obrigatórios

### Servidor como fonte definitiva

O browser renderiza, mas não decide sozinho material, papel ou profundidade. O
servidor resolve uma CpqRender3dSpec imutável, versionada e assinada por hash.

### Aparência não altera preço

O 3D consome o snapshot. Não recalcula custo, nesting ou margem. Mudança de
composição, medida, cor, papel, profundidade ou material invalida a aprovação.

### Preview não autoriza invenção

Preset genérico serve somente para preview marcado como **estimado**. Bloqueie
aprovação com material sem vínculo visual, papel ambíguo ou dimensão ausente.

### Foto e mapa PBR são ativos diferentes

- Foto de referência serve para comparação humana.
- baseColor não contém luz/reflexo gravado.
- normal, roughness, metalness e anisotropy são mapas de dados.
- emissive descreve distribuição da emissão.

Não derive automaticamente todos os mapas de uma foto comum. Registre origem,
escala física e estado de calibração de cada ativo.

## Dependências

Instale com Yarn:

~~~bash
yarn add three @react-three/fiber@^9 @react-three/drei @react-three/postprocessing postprocessing
yarn add -D @types/three
~~~

Use React Three Fiber 9 porque o projeto está em React 19. Não carregue React,
Three.js, HDRI ou texturas por CDN em runtime.

## Integração do HTML legado com React/Vite

Não injete dependência global improvisada. Transforme a página canônica em
entrada multipágina do Vite:

1. Mova client/public/cpq-letreiros-express.html para
   client/cpq-letreiros-express.html, preservando a URL.
2. Mantenha client/public/estudio-letra-caixa.html redirecionando com query.
3. Adicione index.html e cpq-letreiros-express.html a rollupOptions.input.
4. Adicione ao HTML:

~~~html
<script type=module src=/src/cpq3d/main.tsx></script>
~~~

5. Monte uma ilha React; não migre todo o CPQ nesta tarefa.
6. Como render() reconstrói #shell, exponha ponte tipada no window e remonte a
   raiz quando #cpq-render3d-root mudar.

~~~ts
export interface Cpq3dLegacyBridge {
  getDraftInput(): CpqRender3dDraftInput;
  getApproval(): CpqRender3dApproval | null;
  setApproval(approval: CpqRender3dApproval): void;
  invalidate(reason: string): void;
  goToStep(step: number): void;
}
~~~

No fim do render/wire-up legado:

~~~js
queueMicrotask(() => window.CPQ3DIsland?.mount());
~~~

## Estrutura de arquivos sugerida

~~~text
shared/cpq-render3d.ts
client/src/cpq3d/
  main.tsx
  bridge.ts
  api.ts
  materialLibrary.ts
  textureLoader.ts
  svgToShapes.ts
  geometry/
    buildFaceGeometry.ts
    buildReturnShellGeometry.ts
    buildBackGeometry.ts
    buildLedLayout.ts
    geometryUtils.ts
  components/
    CpqRender3dApp.tsx
    CpqRender3dViewer.tsx
    LetterBoxAssembly.tsx
    LightingRig.tsx
    ExplodedLabels.tsx
    MaterialReferencePanel.tsx
server/services/cpqRender3d.ts
server/routes/estudio-render3d.ts
server/__tests__/cpq-render3d.test.ts
~~~

## Contratos compartilhados

Crie tipos serializáveis em shared/cpq-render3d.ts. O servidor nunca envia
instâncias de classes do Three.js.

~~~ts
export const CPQ_RENDER3D_SPEC_VERSION = 1 as const;

export type CpqRenderRole =
  | face | return | back | profile
  | led | fixing | finish | ignored;

export type CpqMaterialFamily =
  | acrylic_translucent | acrylic_solid
  | stainless_brushed | stainless_polished
  | galvanized_pu | aluminum_profile
  | expanded_pvc | led_module | generic_dielectric;

export type CpqTextureKind =
  | baseColor | normal | roughness | metalness
  | anisotropy | ao | emissive | reference;

export interface CpqRenderTextureAsset {
  id: number;
  kind: CpqTextureKind;
  url: string;
  storageKey: string | null;
  mimeType: string;
  sha256: string;
  widthPx: number | null;
  heightPx: number | null;
  tileWidthMm: number | null;
  tileHeightMm: number | null;
  colorSpace: srgb | linear | none;
  sourceNote: string | null;
  calibrated: boolean;
}

export interface CpqPbrParameters {
  colorHex: string;
  metalness: number;
  roughness: number;
  transmission: number;
  ior: number;
  clearcoat: number;
  clearcoatRoughness: number;
  specularIntensity: number;
  anisotropy: number;
  anisotropyRotationRad: number;
  attenuationColorHex: string;
  attenuationDistanceMm: number | null;
  normalScale: [number, number];
  emissiveHex: string;
  emissiveIntensityDay: number;
  emissiveIntensityNight: number;
}

export interface CpqResolvedRenderMaterial {
  mubisysMateriaPrimaId: number;
  materialName: string;
  role: CpqRenderRole;
  profileId: number;
  profileVersion: number;
  profileName: string;
  family: CpqMaterialFamily;
  thicknessMm: number | null;
  pbr: CpqPbrParameters;
  assets: CpqRenderTextureAsset[];
  estimated: boolean;
  warnings: string[];
}

export interface CpqRenderConstruction {
  kind: frontlight | backlight | non_illuminated;
  boxDepthMm: number;
  wallStandoffMm: number;
  faceLipMm: number;
  returnSheetThicknessMm: number;
  backThicknessMm: number;
  ledPitchMm: number | null;
  ledModuleWidthMm: number | null;
  ledModuleHeightMm: number | null;
  ledEdgeClearanceMm: number;
}

export interface CpqRenderRegion {
  regionKey: string;
  pathIndexes: number[];
  colorHex: string | null;
  materialId: number | null;
  profileId: number | null;
}

export interface CpqRender3dSpec {
  version: typeof CPQ_RENDER3D_SPEC_VERSION;
  sourceId: string;
  specHash: string;
  vectorHash: string;
  svg: string;
  widthMm: number;
  heightMm: number;
  construction: CpqRenderConstruction;
  regions: CpqRenderRegion[];
  materials: CpqResolvedRenderMaterial[];
  warnings: string[];
  blockers: string[];
  ticket: string;
}

export interface CpqRender3dApproval {
  specHash: string;
  ticket: string;
  approvedAt: string;
  approvedBy: { id: string; name: string; role: string };
  previewDayUrl: string | null;
  previewNightUrl: string | null;
  previewExplodedUrl: string | null;
}
~~~

Valide limites numéricos no servidor: profundidade/espessura positivas,
quantidade de paths, tamanho do SVG, materiais e URLs.

## Papel industrial e configuração paramétrica

Não dependa somente do texto livre papel. Adicione às linhas do kit um campo
renderRole validado no kitSchema com os valores do tipo CpqRenderRole.

- Em kits antigos, sugira renderRole usando camadaFisicaKit(), mas peça
  confirmação.
- Salve em estudio_kits.dadosJson; não há migration só por essa chave JSON.
- Inclua papel e renderRole no snapshot como campos opcionais.
- Bloqueie 3D quando chapa física estiver sem papel inequívoco.

Adicione ao kitSchema um render3dConstruction estrito:

~~~ts
const render3dConstructionSchema = z.object({
  kind: z.enum([frontlight, backlight, non_illuminated]),
  boxDepthMm: z.number().finite().min(5).max(1000),
  wallStandoffMm: z.number().finite().min(0).max(500),
  faceLipMm: z.number().finite().min(0).max(100),
  ledPitchMm: z.number().finite().min(5).max(500).nullable(),
  ledEdgeClearanceMm: z.number().finite().min(0).max(500),
}).strict();
~~~

Não use 50 ou 80 mm como default silencioso. Profundidade ausente é pendência.

## Biblioteca de materiais visuais

### Modelo persistente

Crie tabelas em drizzle/schema.ts e gere migration com Drizzle:

1. cpq_render_material_profiles: slug, nome, família, versão, ativo, pbr_json,
   notas, autor e timestamps.
2. cpq_render_material_assets: profile_id, tipo do mapa, URL/chave UploadThing,
   MIME, dimensões, SHA-256, escala física, color space, origem e calibração.
3. cpq_render_material_links: mubisys_materia_prima_id, profile_id, versão e
   overrides limitados, como cor ou rotação da escovação.
4. Opcional: cpq_render3d_approvals para auditoria por source_id/spec_hash.

Perfis usados em proposta emitida são imutáveis. Edição relevante cria nova
versão; o snapshot conserva a versão usada.

### Presets front-end

Crie client/src/cpq3d/materialLibrary.ts. Os valores são pontos iniciais de
calibração, nunca dados certificados do fabricante:

~~~ts
const pbr = (overrides: Partial<CpqPbrParameters>): CpqPbrParameters => ({
  colorHex: #ffffff, metalness: 0, roughness: 0.45,
  transmission: 0, ior: 1.5, clearcoat: 0,
  clearcoatRoughness: 0.1, specularIntensity: 1,
  anisotropy: 0, anisotropyRotationRad: 0,
  attenuationColorHex: #ffffff, attenuationDistanceMm: null,
  normalScale: [1, 1], emissiveHex: #000000,
  emissiveIntensityDay: 0, emissiveIntensityNight: 0,
  ...overrides,
});
~~~

Inclua presets:

- acrylic_translucent: roughness 0.22, transmission 0.68, IOR 1.49, clearcoat
  0.5 e emissão noturna calibrável;
- acrylic_solid: roughness 0.2, transmission quase zero, IOR 1.49 e clearcoat;
- stainless_brushed: metalness 1, roughness 0.34, anisotropy 0.9 e mapas normal,
  roughness e anisotropy;
- stainless_polished: metalness 1 e roughness inicial 0.08;
- galvanized_pu: metalness próximo de zero, roughness 0.3 e clearcoat;
- aluminum_profile: metalness 1, roughness 0.28 e anisotropia moderada;
- expanded_pvc: dielétrico, roughness 0.78 e normal sutil;
- led_module: dielétrico emissivo;
- generic_dielectric: fallback cinza, sempre marcado como estimado.

Regras físicas:

- Pintura PU é camada dielétrica; não use metalness 1 só pelo substrato.
- Em acrílico, mantenha opacity 1 e use transmission, ior, thickness,
  attenuationColor e attenuationDistance.
- Metal precisa de environment map.
- Brilho da borda laser vem de material de borda, clearcoat e bevel pequeno,
  não de bloom na peça inteira.

## Administração > Materiais 3D

Crie tela restrita a gestor, admin e master. Para cada matéria-prima MubiSys:

- selecionar ou criar perfil visual;
- mostrar dados físicos herdados;
- informar acabamento, direção do veio e escala real;
- enviar baseColor, normal, roughness, metalness, anisotropy e referências;
- informar calibração e origem;
- comparar o shader com fotos;
- mostrar status sem mapeamento, incompleto, estimado ou aprovado;
- criar nova versão sem alterar propostas antigas.

Use UploadThing. Na primeira versão aceite PNG, JPEG e WebP com limites claros.
HDRI deve ser ativo curado, local e licenciado. Registre URL, key, MIME,
dimensões, hash e escala física; nunca base64 no banco.

### Guia para criar ativos reais

1. Fotografe amostra plana, limpa, câmera perpendicular e luz difusa.
2. Use cartão de cor/cinza.
3. Remova luz, reflexos e vinheta do baseColor.
4. Faça tile seamless sem apagar o caráter do material.
5. Meça quantos milímetros reais o tile representa.
6. Capture ou produza normal e roughness separadamente.
7. Em inox escovado, registre direção e escala do veio.
8. Em acrílico, cadastre cor, transmissão e espessura.
9. Em PU, cadastre tinta/acabamento; metal só aparece em borda exposta.
10. Compare Dia/Noite no HDRI padrão com fotos reais.

Mapas de cor usam sRGB. Normal, roughness, metalness, anisotropy e AO usam
NoColorSpace. Use RepeatWrapping e repeat calculado pela dimensão física da peça
dividida pelo tamanho real do tile.

## Resolver do servidor

Crie server/services/cpqRender3d.ts com funções testáveis:

~~~ts
export async function resolveCpqRender3dSpec(input: {
  sourceId: string;
  snapshot: CpqQuoteDraftSnapshot;
  user: { id: string; name: string; role: string };
}): Promise<CpqRender3dSpec>;

export function hashCpqRender3dSpec(
  spec: Omit<CpqRender3dSpec, specHash | ticket>,
): string;

export function verifyCpqRender3dTicket(
  ticket: string,
  sourceId: string,
  specHash: string,
): CpqRender3dTicketClaims;
~~~

O resolver valida sessão/origem/SVG/medidas, lê a construção do kit, resolve
renderRole, busca espessuras e perfis, usa estudio_chapas para cor/transmissão,
cruza pathIndexes, carrega versões visuais, produz warnings/blockers e emite
hash canônico e ticket assinado.

Rotas esperadas:

~~~text
POST /api/letra-caixa/render3d/spec
POST /api/letra-caixa/render3d/aprovar
GET  /api/letra-caixa/render3d/material-profiles
POST /api/letra-caixa/render3d/material-profiles
PUT  /api/letra-caixa/render3d/material-profiles/:id
PUT  /api/letra-caixa/render3d/material-links/:mubisysMateriaPrimaId
GET  /api/letra-caixa/cotacoes/:token/render3d
GET  /api/letra-caixa/cotacoes/grupo/:grupoId/render3d
~~~

Rotas administrativas exigem gestor/admin/master. DTO público omite custos,
margem, fórmulas internas e recibos sensíveis. Com blockers, retorne 422 e lista
estruturada ligada ao campo/material.

## Conversão de SVG para formas

Use o SVG técnico aprovado, não a foto. Parseie com SVGLoader.parse() e converta
cada ShapePath com path.toShapes(), preservando vazados.

~~~ts
import { Shape } from three;
import { SVGLoader } from three/addons/loaders/SVGLoader.js;

export interface ParsedSvgShape {
  pathIndex: number;
  shapeIndex: number;
  shape: Shape;
  sourceColor: string | null;
}

export function svgToShapes(svg: string): ParsedSvgShape[] {
  const parsed = new SVGLoader().parse(svg);
  return parsed.paths.flatMap((path, pathIndex) => {
    const style = path.userData?.style as
      | { fill?: string; fillRule?: string }
      | undefined;
    const shapes = path.toShapes(style?.fillRule === evenodd);
    return shapes.map((shape, shapeIndex) => ({
      pathIndex, shapeIndex, shape, sourceColor: style?.fill ?? null,
    }));
  });
}
~~~

Antes do parse, rejeite script, foreignObject, referências externas e URLs
arbitrárias; limite nós, paths e tamanho; preserve viewBox, transforms e
fill-rule. Não execute conteúdo do SVG.

Depois do parse:

1. calcule o bounding box;
2. converta Y-down do SVG para Y-up;
3. aplique escala uniforme para widthMm/heightMm;
4. centralize o conjunto;
5. transforme diferença de aspect ratio acima da tolerância em blocker.

Adote 1 unidade Three.js = 1 metro:

~~~ts
export const mmToWorld = (mm: number) => mm / 1000;
~~~

## Construção geométrica

### Face

Crie ExtrudeGeometry fina por shape/região, com espessura real. Preserve holes.
Use bevel somente para acabamento que o justifique:

~~~ts
const geometry = new THREE.ExtrudeGeometry(shape, {
  depth: mmToWorld(faceThicknessMm),
  steps: 1,
  bevelEnabled: edgeFinish === laser_polished,
  bevelSize: edgeFinish === laser_polished ? mmToWorld(0.2) : 0,
  bevelThickness: edgeFinish === laser_polished ? mmToWorld(0.2) : 0,
  bevelSegments: edgeFinish === laser_polished ? 2 : 0,
  curveSegments: quality.curveSegments,
});
~~~

Crie material separado para borda do acrílico quando necessário.

### Lateral/retorno

Não use o miolo maciço de uma extrusão. Construa uma faixa oca:

1. extraia pontos do contorno;
2. use clipper-lib para offsets pela metade da espessura;
3. construa quads entre Z frontal e traseiro;
4. feche bordas anterior e posterior;
5. gere normais e UVs, com U no perímetro e V na profundidade;
6. preserve a direção do veio.

~~~ts
export function buildReturnShellGeometry(input: {
  shape: THREE.Shape;
  depthM: number;
  sheetThicknessM: number;
  textureTileM: [number, number];
  curveSegments: number;
}): THREE.BufferGeometry;
~~~

Teste contornos côncavos, letras A/B/O/R, ilhas e vários componentes. A malha de
renderização nunca substitui a geometria do nesting/CNC.

### Fundo, perfis e fixadores

- Fundo: peça separada, espessura real, offset negativo validado e material
  próprio.
- Perfil: use perfilFormato, altura, largura e espessura já cadastrados; modele
  tubo, cantoneira ou barra. Não duplique perfil e retorno.
- Fixadores: presets dimensionados para patinha LED, barra roscada, chapinha e
  orelhinha; não renderize quando sem_fixacao estiver selecionado.

## Layout e iluminação de LEDs

Posicione LEDs de forma determinística:

1. calcule área interna menos holes;
2. aplique ledEdgeClearanceMm;
3. gere grade por ledPitchMm;
4. aceite pontos dentro do contorno e fora dos vazados;
5. se a composição tiver quantidade física, respeite-a com distribuição
   uniforme;
6. use InstancedMesh;
7. nunca crie uma PointLight para cada módulo.

Use módulos emissivos instanciados. Em frontlight, a face recebe transmissão e
emissão moderada com luz agregada por peça. Em backlight, crie halo traseiro
contra a parede com afastamento real. Sem iluminação, não use emissive/bloom.
O halo deve acompanhar a silhueta, não ser um retângulo.

## MeshPhysicalMaterial

Combine preset, perfil persistido, cor aprovada e texturas:

~~~ts
export function createPhysicalMaterial(
  resolved: CpqResolvedRenderMaterial,
  textures: Partial<Record<CpqTextureKind, THREE.Texture>>,
  night: boolean,
): THREE.MeshPhysicalMaterial {
  const p = resolved.pbr;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(p.colorHex),
    metalness: p.metalness,
    roughness: p.roughness,
    transmission: p.transmission,
    opacity: 1,
    ior: p.ior,
    thickness: mmToWorld(resolved.thicknessMm ?? 0),
    clearcoat: p.clearcoat,
    clearcoatRoughness: p.clearcoatRoughness,
    specularIntensity: p.specularIntensity,
    anisotropy: p.anisotropy,
    anisotropyRotation: p.anisotropyRotationRad,
    attenuationColor: new THREE.Color(p.attenuationColorHex),
    attenuationDistance: p.attenuationDistanceMm == null
      ? Infinity : mmToWorld(p.attenuationDistanceMm),
    normalScale: new THREE.Vector2(...p.normalScale),
    emissive: new THREE.Color(p.emissiveHex),
    emissiveIntensity: night
      ? p.emissiveIntensityNight : p.emissiveIntensityDay,
    map: textures.baseColor ?? null,
    normalMap: textures.normal ?? null,
    roughnessMap: textures.roughness ?? null,
    metalnessMap: textures.metalness ?? null,
    anisotropyMap: textures.anisotropy ?? null,
    aoMap: textures.ao ?? null,
    emissiveMap: textures.emissive ?? null,
  });
}
~~~

Configure baseColor/emissive como SRGBColorSpace e mapas de dados como
NoColorSpace. Use RepeatWrapping, cache por URL, anisotropia suportada pelo
renderer e descarte recursos no unmount.

## Cena React Three Fiber

Implemente CpqRender3dViewer com:

- Canvas responsivo, DPR limitado entre 1 e 1.75, antialias, shadows e câmera
  PerspectiveCamera com near/far adequados à escala em metros;
- Environment carregando /render3d/environments/studio-1k.hdr, ativo local,
  otimizado e licenciado;
- LightingRig que recebe night;
- LetterBoxAssembly que recebe spec, exploded e night;
- EffectComposer/Bloom com luminanceThreshold que afete apenas emissão;
- OrbitControls com damping, limites de distância e target central;
- toolbar DOM acessível para Visão explodida e Dia/Noite;
- fallback estático quando WebGL não estiver disponível.

Não use Environment preset remoto. Faça lazy load do módulo 3D.

## Visão explodida e Dia/Noite

Mantenha cada componente em group separado. Anime Z com useFrame e
amortecimento, sem setState por frame:

~~~text
face              +2.0 × distância
aro/retorno       +0.7 × distância
perfil             0.0 × distância
LEDs              -0.5 × distância
fundo             -1.2 × distância
fixadores         -1.7 × distância
parede             fixa
~~~

A distância base é proporcional à profundidade. Exiba rótulos Face, Retorno,
LEDs, Fundo e Fixação; no modo público use nomes comerciais genéricos.

Dia e noite não são só background: no Dia aumente environment/luz principal e
reduza emissão; à Noite reduza environment, ative emissão e bloom apenas em
materiais emissivos, mantendo luz ambiente mínima. A alternância não modifica
snapshot nem composição.

## Etapa no fluxo do CPQ

Atualize STEP_DEFS_REAL:

~~~js
const STEP_DEFS_REAL = [
  {k:'proposta', n:1, label:'Proposta'},
  {k:'foto', n:2, label:'Foto e escopo'},
  {k:'redesenho', n:3, label:'Reconstrução visual'},
  {k:'vetorizacao', n:4, label:'Vetorização'},
  {k:'escala', n:5, label:'Ficha técnica'},
  {k:'nesting', n:6, label:'Nesting'},
  {k:'kit', n:7, label:'Composição'},
  {k:'render3d', n:8, label:'Visualização 3D'},
  {k:'orcamento', n:9, label:'Orçamento'},
];
~~~

Também:

- inclua render3d em REAL.approvals;
- crie REAL.render3dSpec, render3dApproval, loading e erro;
- crie realStepRender3d() com mount point React;
- atualize switch, contadores /8 para /9 e atalhos;
- invalide 3D quando vetor, escala, nesting, cor, composição, material,
  variação, profundidade ou fixação mudar;
- impeça avanço com blockers ou specHash aprovado diferente do atual;
- mantenha o preço calculável, mas só permita link/PDF após aprovação 3D.

## Snapshot, assinatura e compatibilidade

Adicione ao snapshot um objeto render3d opcional, sem default:

~~~ts
render3d: z.object({
  version: z.literal(1),
  specHash: z.string().regex(/^[a-f0-9]{64}$/),
  vectorHash: z.string().regex(/^[a-f0-9]{64}$/),
  construction: render3dConstructionSchema,
  materials: z.array(z.object({
    mubisysMateriaPrimaId: z.number().int().positive(),
    role: renderRoleSchema,
    profileId: z.number().int().positive(),
    profileVersion: z.number().int().positive(),
    thicknessMm: z.number().positive().nullable(),
  }).strict()).max(300),
  approval: z.object({
    ticket: z.string().min(20).max(6000),
    approvedAt: z.string().datetime(),
    approvedBy: z.object({
      id: z.string(), name: z.string(), role: z.string(),
    }).strict(),
    previewDayUrl: z.string().url().nullable(),
    previewNightUrl: z.string().url().nullable(),
    previewExplodedUrl: z.string().url().nullable(),
  }).strict(),
}).strict().optional(),
~~~

Na emissão, verifique ticket, sourceId, specHash, vectorHash e usuário. Compare
o hash com vetor, medidas, construção, materiais, perfis e versões. Cotações
antigas sem render3d continuam abrindo e informam que o 3D não existia nelas.

## Captura para PDF

Gere previews determinísticos:

1. vista montada diurna;
2. vista montada noturna;
3. vista explodida técnica.

Use câmera, target, resolução, fundo e exposição fixos. Não use a posição
orbital escolhida pelo vendedor. Renderize em framebuffer dedicado; não deixe
preserveDrawingBuffer ligado permanentemente só para screenshot.

Converta a captura em File, envie pelo UploadThing e persista URL/chave. O PDF
usa as imagens do snapshot e nunca executa WebGL.

## Link público

Adicione visualização read-only quando houver snapshot 3D. O endpoint público:

- valida token de cotação/grupo;
- devolve somente o necessário;
- omite custos, margem, fórmulas e recibos sensíveis;
- permite Dia/Noite, órbita e visão explodida;
- usa nomes adequados ao cliente;
- cai para imagens estáticas se WebGL falhar.

## Desempenho

- Faça lazy import do módulo 3D.
- Limite DPR, luzes e pós-processamento.
- Use InstancedMesh para LEDs/fixadores.
- Não use uma luz por LED.
- Faça cache por specHash.
- Ofereça qualidade baixa/alta para vetores complexos.
- Simplifique apenas malha visual e dentro de tolerância declarada.
- Libere recursos GPU no unmount.
- Não recrie geometria/material a cada frame.
- Considere Web Worker se triangulação bloquear a UI.

## Segurança

- Sanitize SVG e limite tamanho/complexidade.
- Não aceite shader fornecido pelo usuário.
- Não permita URL arbitrária de textura.
- Valide MIME real, extensão, dimensões e tamanho.
- Proteja rotas administrativas por role.
- Use Cache-Control private/no-store em drafts.
- Não exponha custos no endpoint público.
- Confira no banco profileId, espessura e role enviados pelo cliente.

## Testes obrigatórios

### Geometria

- SVG simples, transforms e fill-rule;
- letras A/B/O/R com vazados;
- vários paths e ilhas;
- escala uniforme e rejeição de aspect ratio incompatível;
- lateral oca com profundidade correta;
- UV proporcional ao perímetro/profundidade;
- offset côncavo com clipper-lib;
- LEDs dentro da shape e fora dos holes;
- layout determinístico.

### Resolver

- perfil completo e material sem perfil;
- preset estimado não pode ser aprovado;
- papel ambíguo e profundidade ausente viram blocker;
- cores por pathIndexes;
- nova versão de perfil não altera snapshot antigo;
- mudança de composição muda specHash;
- ticket errado/expirado é rejeitado;
- snapshot antigo continua legível.

### Integração

- gerar/aprovar spec autenticada;
- impedir emissão depois da invalidação;
- emitir com previews;
- endpoint público não contém custos;
- fallback quando WebGL não existe.

Rode:

~~~bash
yarn run check
yarn test
yarn build
~~~

Se testes integrarem banco, exporte DATABASE_URL conforme AGENTS.md. Não esconda
falha nem remova cobertura.

## Critérios de aceite

- [ ] A URL canônica funciona em dev e produção.
- [ ] O redirecionamento legado preserva query string.
- [ ] Visualização 3D aparece como etapa 8/9 e Orçamento como 9/9.
- [ ] SVG com furos gera face, lateral oca e fundo separados.
- [ ] Profundidade e espessuras usam valores cadastrados.
- [ ] Regiões multicoloridas usam pathIndexes e cores aprovadas.
- [ ] Matérias-primas MubiSys ligam-se a perfis PBR versionados.
- [ ] Fotos de referência ficam separadas de mapas PBR.
- [ ] Inox escovado usa anisotropia em escala real.
- [ ] Acrílico usa transmissão, IOR e espessura.
- [ ] Pintura PU não é tratada como metal exposto.
- [ ] LEDs usam instancing e não uma luz por módulo.
- [ ] Dia/Noite e visão explodida não alteram preço.
- [ ] OrbitControls permite inspeção com limites.
- [ ] Mudança relevante invalida aprovação 3D.
- [ ] Servidor verifica hash e ticket antes da emissão.
- [ ] PDF recebe previews estáveis.
- [ ] Link público não vaza custo/margem.
- [ ] Cotações antigas continuam abrindo.
- [ ] Typecheck, testes e build passam.
- [ ] AGENTS.md foi revisado e atualizado se necessário.
- [ ] Migration foi gerada/revisada e está no mesmo commit.
- [ ] A tarefa termina em commit próprio.

## Entrega esperada do agente

Ao finalizar, responda com:

1. resumo objetivo;
2. arquivos e migrations principais;
3. decisões de modelagem;
4. como cadastrar novo material/textura;
5. validações executadas;
6. pendências reais;
7. hash e mensagem do commit.

Não declare fidelidade industrial absoluta sem calibração. Informe que cores em
monitor e simulação luminosa são aproximações e que a amostra física aprovada é
a referência final de fabricação.

## Referências oficiais

- React Three Fiber:
  https://r3f.docs.pmnd.rs/getting-started/introduction
- Canvas:
  https://r3f.docs.pmnd.rs/api/canvas
- SVGLoader:
  https://threejs.org/docs/pages/SVGLoader.html
- ShapePath:
  https://threejs.org/docs/pages/ShapePath.html
- ExtrudeGeometry:
  https://threejs.org/docs/pages/ExtrudeGeometry.html
- MeshPhysicalMaterial:
  https://threejs.org/docs/pages/MeshPhysicalMaterial.html
- Texture:
  https://threejs.org/docs/pages/Texture.html
- Color management:
  https://threejs.org/manual/pages/color-management.html
- InstancedMesh:
  https://threejs.org/docs/pages/InstancedMesh.html
- Drei controls:
  https://drei.docs.pmnd.rs/controls/introduction
