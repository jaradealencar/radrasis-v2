import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import * as THREE from "three";
import type { CpqTextureKind } from "@shared/cpq-render3d";
import { mesclarFaces, mesclarSimples, construirGeometriasFace } from "../geometry/buildFaceGeometry";
import { regiaoParaShape } from "../geometry/geometryUtils";
import { descartarMaterial, createEdgeMaterial, createPhysicalMaterial, familiaAceitaCorDaRegiao, presetPbr } from "../materialLibrary";
import type { CenaDados, DesenhoSpec, MaterialDoSpec } from "../cena";
import { carregarMapasDoMaterial, type MapasCarregados } from "../textureLoader";
import { ExplodedLabels, type RotuloExplodido } from "./ExplodedLabels";
import type { EstadoCena } from "./estadoCena";

/** Deslocamento em Z de cada componente na visão explodida, em múltiplos da distância base (parede fica fixa). */
const FATOR_EXPLOSAO = { face: 2.0, retorno: 0.7, perfil: 0, leds: -0.5, fundo: -1.2, fixadores: -1.7 } as const;

type MapasPorMaterial = Map<string, MapasCarregados>;
const chaveMaterial = (material: Pick<MaterialDoSpec, "mubisysMateriaPrimaId" | "role">) => `${material.role}:${material.mubisysMateriaPrimaId}`;

/** Texturas dos perfis (assíncronas): enquanto não chegam, os materiais usam só os valores paramétricos. */
function useMapas(spec: DesenhoSpec): { mapas: MapasPorMaterial; carregando: boolean } {
  const gl = useThree(estado => estado.gl);
  const invalidate = useThree(estado => estado.invalidate);
  const [mapas, setMapas] = useState<MapasPorMaterial>(() => new Map());
  const [carregando, setCarregando] = useState(false);
  useEffect(() => {
    const comMapas = spec.materials.filter(material => material.assets.some(asset => asset.kind !== "reference"));
    if (!comMapas.length) { setMapas(new Map()); return; }
    let cancelado = false;
    setCarregando(true);
    const anisotropia = gl.capabilities.getMaxAnisotropy();
    void Promise.all(comMapas.map(async material => [chaveMaterial(material), await carregarMapasDoMaterial(material.assets, anisotropia)] as const)).then(pares => {
      if (cancelado) return;
      setMapas(new Map(pares));
      setCarregando(false);
      invalidate();
    });
    return () => { cancelado = true; };
  }, [spec.specHash, spec.materials, gl, invalidate]);
  return { mapas, carregando };
}

interface MateriaisCena {
  face: Map<string, { material: THREE.MeshPhysicalMaterial; borda: THREE.MeshPhysicalMaterial | null }>;
  parede: THREE.MeshPhysicalMaterial | null;
  fundo: THREE.MeshPhysicalMaterial | null;
  led: THREE.MeshPhysicalMaterial | null;
  fixacao: THREE.MeshPhysicalMaterial | null;
  todos: THREE.Material[];
}

function criarMateriais(cena: CenaDados, mapas: MapasPorMaterial, iluminada: boolean): MateriaisCena {
  const todos: THREE.Material[] = [];
  const registrar = <T extends THREE.Material>(material: T): T => { todos.push(material); return material; };
  const para = (material: MaterialDoSpec | null, cor: string | null = null, emitir = iluminada) =>
    material ? registrar(createPhysicalMaterial(material, mapas.get(chaveMaterial(material)) ?? ({} as Partial<Record<CpqTextureKind, THREE.Texture>>), false, { corHex: cor, iluminada: emitir })) : null;

  const face = new Map<string, { material: THREE.MeshPhysicalMaterial; borda: THREE.MeshPhysicalMaterial | null }>();
  for (const grupo of cena.grupos) {
    const base = cena.materiais.face.find(item => item.mubisysMateriaPrimaId === grupo.materialId) ?? cena.materiais.face[0] ?? null;
    const material = base
      ? para(base, grupo.colorHex)!
      : registrar(createPhysicalMaterial({ pbr: presetPbr("generic_dielectric"), family: "generic_dielectric", thicknessMm: null }, {}, false, { corHex: grupo.colorHex, iluminada: false }));
    const acrilico = base?.family === "acrylic_translucent" || base?.family === "acrylic_solid";
    face.set(grupo.chave, { material, borda: acrilico ? registrar(createEdgeMaterial(material)) : null });
  }
  return {
    face,
    parede: para(cena.materiais.parede, null, false),
    fundo: para(cena.materiais.fundo, null, false),
    led: cena.materiais.led ? registrar(createPhysicalMaterial(cena.materiais.led, mapas.get(chaveMaterial(cena.materiais.led)) ?? {}, false, { iluminada })) : null,
    fixacao: para(cena.materiais.fixacao ?? null, null, false) ?? registrar(createPhysicalMaterial({ pbr: { ...presetPbr("stainless_polished"), roughness: 0.25 }, family: "stainless_polished", thicknessMm: null }, {}, false, { iluminada: false })),
    todos,
  };
}

/** Parâmetros de emissão que o `useFrame` interpola entre dia e noite. */
function aplicarEmissao(materiais: MateriaisCena, cena: CenaDados, iluminada: boolean, noite: number) {
  const ajustar = (material: THREE.MeshPhysicalMaterial | null, base: MaterialDoSpec | null, multiplicador = 1) => {
    if (!material || !base) return;
    const { emissiveIntensityDay: dia, emissiveIntensityNight: noturna } = base.pbr;
    material.emissiveIntensity = iluminada ? (dia + (noturna - dia) * noite) * multiplicador : 0;
  };
  for (const grupo of cena.grupos) {
    const entrada = materiais.face.get(grupo.chave);
    const base = cena.materiais.face.find(item => item.mubisysMateriaPrimaId === grupo.materialId) ?? cena.materiais.face[0] ?? null;
    if (!entrada || !base) continue;
    ajustar(entrada.material, base);
    ajustar(entrada.borda, base, 1.35); // a borda do acrílico guia a luz e acende um pouco mais
  }
  ajustar(materiais.led, cena.materiais.led);
}

export interface PropsAssembly {
  spec: DesenhoSpec;
  cena: CenaDados;
  estado: MutableRefObject<EstadoCena>;
  /** Nomes comerciais (link público) ou técnicos (vendedor) nos rótulos da visão explodida. */
  publico: boolean;
  onCarregandoTexturas?: (carregando: boolean) => void;
}

/**
 * Montagem completa: face (por grupo de cor/material), lateral oca, fundo, módulos LED instanciados, fixadores, halo do backlight e
 * a parede. Cada componente fica num `group` próprio; a visão explodida só anima o Z desses grupos (ref + useFrame, sem setState).
 */
export function LetterBoxAssembly({ spec, cena, estado, publico, onCarregandoTexturas }: PropsAssembly) {
  const invalidate = useThree(estadoR3f => estadoR3f.invalidate);
  const { mapas, carregando } = useMapas(spec);
  useEffect(() => { onCarregandoTexturas?.(carregando); }, [carregando, onCarregandoTexturas]);
  const iluminada = spec.construction.kind !== "non_illuminated";
  const backlight = spec.construction.kind === "backlight";

  const materiais = useMemo(() => criarMateriais(cena, mapas, iluminada), [cena, mapas, iluminada]);
  useEffect(() => () => descartarMaterial(materiais.todos), [materiais]);

  /* --- geometrias (dependem só da cena) --- */
  const faceMeshes = useMemo(() => cena.grupos.map(grupo => {
    const material = cena.materiais.face.find(item => item.mubisysMateriaPrimaId === grupo.materialId) ?? cena.materiais.face[0];
    const acrilico = material?.family === "acrylic_translucent" || material?.family === "acrylic_solid";
    const geometrias = construirGeometriasFace(grupo.regioes, { espessuraM: grupo.espessuraM, abaM: spec.construction.faceLipMm / 1000, bisel: acrilico });
    return { grupo, geometria: mesclarFaces(geometrias) };
  }), [cena, spec.construction.faceLipMm]);
  const fundoGeometria = useMemo(() => (cena.fundo ? mesclarSimples(cena.fundo.geometrias) : null), [cena]);
  const haloGeometrias = useMemo(() => cena.halo.map(camada => {
    const formas = camada.map(regiao => new THREE.ShapeGeometry(regiaoParaShape(regiao)));
    return mesclarSimples(formas);
  }).filter((geometria): geometria is THREE.BufferGeometry => !!geometria), [cena]);
  useEffect(() => () => {
    faceMeshes.forEach(item => item.geometria?.dispose());
    fundoGeometria?.dispose();
    haloGeometrias.forEach(geometria => geometria.dispose());
  }, [faceMeshes, fundoGeometria, haloGeometrias]);
  useEffect(() => () => cena.parede?.dispose(), [cena]);

  /* --- grupos animados --- */
  const refs = {
    face: useRef<THREE.Group>(null), retorno: useRef<THREE.Group>(null), leds: useRef<THREE.Group>(null),
    fundo: useRef<THREE.Group>(null), fixadores: useRef<THREE.Group>(null),
  };
  const planoParede = useRef<THREE.Mesh>(null);
  const halos = useRef<THREE.Mesh[]>([]);
  const distancia = Math.max(cena.profundidadeM, 0.03) * 0.9; // proporcional à profundidade
  const fatorRetorno = cena.materiais.parede?.role === "profile" ? FATOR_EXPLOSAO.perfil : FATOR_EXPLOSAO.retorno;
  const corHalo = useMemo(() => {
    const maior = [...cena.grupos].sort((a, b) => b.areaM2 - a.areaM2)[0];
    return maior?.colorHex ?? cena.materiais.face[0]?.pbr.colorHex ?? "#ffe9c4";
  }, [cena]);

  useFrame(() => {
    const { explodido, noite } = estado.current;
    const z = (fator: number) => fator * distancia * explodido;
    if (refs.face.current) refs.face.current.position.z = z(FATOR_EXPLOSAO.face);
    if (refs.retorno.current) refs.retorno.current.position.z = z(fatorRetorno);
    if (refs.leds.current) refs.leds.current.position.z = z(FATOR_EXPLOSAO.leds);
    if (refs.fundo.current) refs.fundo.current.position.z = z(FATOR_EXPLOSAO.fundo);
    if (refs.fixadores.current) refs.fixadores.current.position.z = z(FATOR_EXPLOSAO.fixadores);
    if (planoParede.current) {
      const material = planoParede.current.material as THREE.MeshStandardMaterial;
      material.opacity = 1 - 0.88 * explodido; // a parede não se move: some quando o conjunto se abre
      material.color.set("#bdb9b0").lerp(new THREE.Color("#15171d"), noite);
    }
    halos.current.forEach((malha, indice) => {
      if (malha) (malha.material as THREE.MeshBasicMaterial).opacity = backlight ? noite * (0.1 - indice * 0.008) : 0;
    });
    aplicarEmissao(materiais, cena, iluminada, noite);
  });
  useEffect(() => { invalidate(); }, [materiais, cena, invalidate]);

  /* --- LEDs e fixadores instanciados --- */
  const ledsMalha = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const malha = ledsMalha.current;
    if (!malha || !cena.leds) return;
    const auxiliar = new THREE.Object3D();
    cena.leds.pontos.forEach((ponto, indice) => {
      auxiliar.position.set(ponto.x, ponto.y, cena.fundoEspessuraM + cena.moduloLedM[2] / 2);
      auxiliar.updateMatrix();
      malha.setMatrixAt(indice, auxiliar.matrix);
    });
    malha.instanceMatrix.needsUpdate = true;
    malha.computeBoundingSphere();
    invalidate();
  }, [cena, invalidate]);

  const fixacao = useMemo(() => {
    const tipos = spec.construction.fixingTypes;
    if (!tipos.length || !cena.fixadores.length) return [];
    const standoff = Math.max(cena.standoffM, 0.012);
    // Cada tipo ocupa uma das âncoras, em rodízio; todos são instanciados por tipo.
    return tipos.map((tipo, indice) => {
      const pontos = cena.fixadores.filter((_, ordem) => ordem % tipos.length === indice % tipos.length);
      const geometria = tipo === "barra_roscada" ? new THREE.CylinderGeometry(0.003, 0.003, standoff, 14).rotateX(Math.PI / 2).translate(0, 0, -standoff / 2)
        : tipo === "patinha_led" ? new THREE.BoxGeometry(0.02, 0.008, 0.003).translate(0, 0, -0.0015)
        : tipo === "chapinha_dupla_face" ? new THREE.BoxGeometry(0.03, 0.015, 0.002).translate(0, 0, -0.001)
        : new THREE.BoxGeometry(0.025, 0.012, 0.002).translate(0, 0, -0.001);
      return { tipo, pontos: pontos.length ? pontos : cena.fixadores, geometria };
    });
  }, [spec.construction.fixingTypes, cena]);
  useEffect(() => () => fixacao.forEach(item => item.geometria.dispose()), [fixacao]);

  const corpoZ = cena.profundidadeM;
  const rotulos: RotuloExplodido[] = useMemo(() => {
    const x = cena.larguraM / 2 + cena.larguraM * 0.04 + 0.05;
    // Do alto para baixo, em ordem fixa e com altura própria, para os nomes nunca se sobreporem; cada um acompanha a sua peça em Z.
    const pecas: Array<{ texto: string; z: number }> = [{ texto: "Face", z: corpoZ - cena.faceEspessuraM / 2 }];
    if (cena.materiais.parede) pecas.push({ texto: cena.materiais.parede.role === "profile" ? "Perfil lateral" : "Retorno", z: corpoZ / 2 });
    if (cena.leds) pecas.push({ texto: publico ? "Iluminação" : "LEDs", z: cena.fundoEspessuraM + 0.004 });
    if (cena.fundo) pecas.push({ texto: "Fundo", z: cena.fundoEspessuraM / 2 });
    if (cena.fixadores.length && spec.construction.fixingTypes.length) pecas.push({ texto: "Fixação", z: -0.012 });
    return pecas.map((peca, indice) => ({ texto: peca.texto, posicao: [x, cena.alturaM * (0.34 - indice * 0.17), peca.z] as [number, number, number] }));
  }, [cena, corpoZ, publico, spec.construction.fixingTypes.length]);

  // Cada rótulo acompanha o grupo da sua peça.
  const rotuloPorTexto = (texto: string) => rotulos.filter(rotulo => rotulo.texto === texto);
  const zParede = -Math.max(cena.standoffM, 0.0005);
  const tamanhoParede = Math.max(cena.larguraM, cena.alturaM) * 3.2;

  return (
    <group>
      {/* parede (fixa) */}
      <mesh ref={planoParede} position={[0, 0, zParede]} receiveShadow>
        <planeGeometry args={[tamanhoParede, tamanhoParede]} />
        <meshStandardMaterial color="#bdb9b0" roughness={0.95} metalness={0} transparent />
      </mesh>

      {/* halo do backlight sobre a parede, seguindo a silhueta */}
      {haloGeometrias.map((geometria, indice) => (
        <mesh key={indice} ref={malha => { if (malha) halos.current[indice] = malha; }} geometry={geometria} position={[0, 0, zParede + 0.0004 + indice * 0.00002]} renderOrder={2}>
          <meshBasicMaterial color={corHalo} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      {/* fundo */}
      <group ref={refs.fundo}>
        {fundoGeometria && materiais.fundo && <mesh geometry={fundoGeometria} material={materiais.fundo} castShadow receiveShadow />}
        <ExplodedLabels rotulos={rotuloPorTexto("Fundo")} alturaM={cena.alturaM} estado={estado} />
      </group>

      {/* fixadores (atrás do fundo) */}
      <group ref={refs.fixadores}>
        {fixacao.map(item => (
          <Instancias key={item.tipo} geometria={item.geometria} material={materiais.fixacao!} pontos={item.pontos} z={0} />
        ))}
        <ExplodedLabels rotulos={rotuloPorTexto("Fixação")} alturaM={cena.alturaM} estado={estado} />
      </group>

      {/* LEDs instanciados: uma malha, nunca uma luz por módulo */}
      <group ref={refs.leds}>
        {cena.leds && cena.leds.pontos.length > 0 && materiais.led && (
          <instancedMesh ref={ledsMalha} args={[undefined, undefined, cena.leds.pontos.length]} material={materiais.led}>
            <boxGeometry args={cena.moduloLedM} />
          </instancedMesh>
        )}
        <ExplodedLabels rotulos={rotuloPorTexto(publico ? "Iluminação" : "LEDs")} alturaM={cena.alturaM} estado={estado} />
      </group>

      {/* lateral oca */}
      <group ref={refs.retorno}>
        {cena.parede && materiais.parede && <mesh geometry={cena.parede} material={materiais.parede} castShadow receiveShadow />}
        <ExplodedLabels rotulos={[...rotuloPorTexto("Retorno"), ...rotuloPorTexto("Perfil lateral")]} alturaM={cena.alturaM} estado={estado} />
      </group>

      {/* face, por grupo de cor/material */}
      <group ref={refs.face}>
        {faceMeshes.map(({ grupo, geometria }) => {
          const entrada = materiais.face.get(grupo.chave);
          if (!geometria || !entrada) return null;
          return (
            <mesh
              key={grupo.chave}
              geometry={geometria}
              material={entrada.borda ? [entrada.material, entrada.borda] : entrada.material}
              position={[0, 0, cena.profundidadeM - grupo.espessuraM]}
              castShadow
              receiveShadow
            />
          );
        })}
        <ExplodedLabels rotulos={rotuloPorTexto("Face")} alturaM={cena.alturaM} estado={estado} />
      </group>
    </group>
  );
}

function Instancias({ geometria, material, pontos, z }: { geometria: THREE.BufferGeometry; material: THREE.Material; pontos: Array<{ x: number; y: number }>; z: number }) {
  const malha = useRef<THREE.InstancedMesh>(null);
  const invalidate = useThree(estado => estado.invalidate);
  useLayoutEffect(() => {
    if (!malha.current) return;
    const auxiliar = new THREE.Object3D();
    pontos.forEach((ponto, indice) => {
      auxiliar.position.set(ponto.x, ponto.y, z);
      auxiliar.updateMatrix();
      malha.current!.setMatrixAt(indice, auxiliar.matrix);
    });
    malha.current.instanceMatrix.needsUpdate = true;
    malha.current.computeBoundingSphere();
    invalidate();
  }, [pontos, z, invalidate]);
  return <instancedMesh ref={malha} args={[geometria, material, pontos.length]} castShadow />;
}

export { familiaAceitaCorDaRegiao };
