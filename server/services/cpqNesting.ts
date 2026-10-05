import { spawn } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { BobinaCustoConfig } from "../../shared/bobina";

export type CpqChapa = {
  id: number;
  mubisysMateriaPrimaId: number;
  nome: string;
  larguraMm: number;
  alturaMm: number;
  principal?: boolean;
  /** Bobina: `alturaMm` é a largura fixa e `larguraMm` só o teto de comprimento do rolo. */
  bobina?: boolean;
};

export type CpqNestingPeca = {
  id: string;
  svg: string;
  larguraMm: number;
  alturaMm: number;
};

export type CpqNestingPlacement = {
  id: number;
  source?: number;
  origemId?: string;
  xMm: number;
  yMm: number;
  larguraMm: number;
  alturaMm: number;
  rotacaoGraus: number;
};

export type CpqMaterial = {
  id: number;
  nome: string;
  custoUnitario: number;
  unidadeCusto: string;
  chapas: CpqChapa[];
  /** Lote geométrico isolado desta matéria-prima; sem ele usa as peças globais. */
  pecas?: CpqNestingPeca[];
  /** Bobina: como o custo do MubiSys é cobrado (cadastro local). Sem isso, deduz pela unidade de custo. */
  bobinaCusto?: BobinaCustoConfig | null;
};

type DeepnestWorkerResult = {
  completo: boolean;
  quantidadePecas: number;
  quantidadePosicionada: number;
  areaLiquidaMm2: number;
  perimetroTotalMm: number;
  placements: CpqNestingPlacement[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
};

export type CpqNestingMaterialResult = {
  id_materia_prima: number;
  materia_prima: string;
  custo_unitario: number | null;
  unidade_custo: string;
  custo_material_estimado: number | null;
  custo_sobra_estimado: number | null;
  alerta_custo: string | null;
  area_liquida_m2: number;
  area_sobra_m2: number;
  perimetro_total_m: number;
  area_chapa_utilizada_m2: number;
  porcentagem_aproveitamento: number;
  criterio_escolha: "menor_chapa_que_comporta" | "menor_sobra_financeira" | "maior_aproveitamento";
  id_chapa_utilizada: number;
  nome_chapa_utilizada: string;
  chapa_principal: boolean;
  /** Em bobina, `largura_mm` é o comprimento consumido (cobrado) e `altura_mm` a largura do rolo. */
  chapa: { largura_mm: number; altura_mm: number };
  formato: "chapa" | "bobina";
  /** Só em bobina: comprimento do rolo consumido pelo layout, em mm. */
  comprimento_consumido_mm?: number;
  /** Só em bobina: largura do rolo, em mm. */
  largura_bobina_mm?: number;
  posicionamentos: CpqNestingPlacement[];
};

export type CpqNestingResultadoAssinavel = Pick<
  CpqNestingMaterialResult,
  | "id_materia_prima"
  | "materia_prima"
  | "custo_unitario"
  | "unidade_custo"
  | "custo_material_estimado"
  | "custo_sobra_estimado"
  | "alerta_custo"
  | "area_liquida_m2"
  | "area_sobra_m2"
  | "perimetro_total_m"
  | "area_chapa_utilizada_m2"
  | "porcentagem_aproveitamento"
  | "criterio_escolha"
  | "id_chapa_utilizada"
  | "nome_chapa_utilizada"
  | "chapa_principal"
  | "chapa"
  | "formato"
  | "comprimento_consumido_mm"
  | "largura_bobina_mm"
>;

/** Tempo máximo do Deepnest por tentativa (formato de chapa ou comprimento de bobina). */
const TEMPO_MOTOR_MS = 20_000;

function nestingSecret(): string {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new CpqNestingError("JWT_SECRET precisa ter pelo menos 32 caracteres para assinar o resultado de nesting.", "configuration");
  return value;
}

export function emitirReciboNesting(sourceId: string, resultadoHash: string, acaoFactibilidade: string | null, result: CpqNestingMaterialResult): string {
  const claims = {
    kind: "cpq-nesting",
    sourceId,
    resultadoHash,
    acaoFactibilidade,
    result: Object.fromEntries(Object.entries(result).filter(([key]) => key !== "posicionamentos")),
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const signature = createHmac("sha256", nestingSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verificarReciboNesting(ticket: string, sourceId: string, resultadoHash: string, acaoFactibilidade: string | null): CpqNestingResultadoAssinavel {
  const [payload, supplied, extra] = ticket.split(".");
  if (!payload || !supplied || extra) throw new CpqNestingError("O recibo do nesting e invalido.", "invalid_geometry");
  const expected = createHmac("sha256", nestingSecret()).update(payload).digest();
  const actual = Buffer.from(supplied, "base64url");
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new CpqNestingError("O recibo do nesting nao corresponde ao servidor.", "invalid_geometry");
  let claims: { kind?: string; sourceId?: string; resultadoHash?: string; acaoFactibilidade?: string | null; result?: CpqNestingResultadoAssinavel; exp?: number };
  try { claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")); }
  catch { throw new CpqNestingError("O recibo do nesting e invalido.", "invalid_geometry"); }
  if (claims.kind !== "cpq-nesting" || claims.sourceId !== sourceId || claims.resultadoHash !== resultadoHash || claims.acaoFactibilidade !== acaoFactibilidade || !claims.result || !claims.exp || claims.exp <= Date.now())
    throw new CpqNestingError("O recibo do nesting expirou ou nao pertence a esta cotacao.", "invalid_geometry");
  return claims.result;
}

export class CpqNestingError extends Error {
  constructor(
    message: string,
    readonly code: "configuration" | "engine" | "no_fit" | "invalid_geometry"
  ) {
    super(message);
    this.name = "CpqNestingError";
  }
}

function orientacoesChapa(chapa: CpqChapa): Array<{ larguraMm: number; alturaMm: number; ordemOrientacao: number }> {
  const orientacoes = [{
    larguraMm: chapa.larguraMm,
    alturaMm: chapa.alturaMm,
    ordemOrientacao: 0,
  }];
  // A bobina sai do rolo numa só direção: a largura do material não gira.
  if (!chapa.bobina && chapa.larguraMm !== chapa.alturaMm) {
    orientacoes.push({
      larguraMm: chapa.alturaMm,
      alturaMm: chapa.larguraMm,
      ordemOrientacao: 1,
    });
  }
  return orientacoes;
}

/** Ordena as opções; a principal só desempata resultados equivalentes. */
export function ordenarChapasMenoresPrimeiro(chapas: CpqChapa[]): CpqChapa[] {
  return [...chapas].sort((a, b) => {
    const areaA = a.larguraMm * a.alturaMm;
    const areaB = b.larguraMm * b.alturaMm;
    return areaA - areaB || Number(!!b.principal) - Number(!!a.principal) || a.id - b.id;
  });
}

/** Retângulo de consumo alinhado à borda esquerda X=0 após a translação do nesting. */
export function calcularBoundingBoxEsquerdo(
  bounds: DeepnestWorkerResult["bounds"]
): { larguraMm: number; alturaMm: number; areaM2: number } {
  if (!bounds) {
    throw new CpqNestingError("O motor não retornou os limites das peças posicionadas.", "invalid_geometry");
  }
  const larguraMm = bounds.maxX - bounds.minX;
  const alturaMm = bounds.maxY - bounds.minY;
  if (!(larguraMm > 0) || !(alturaMm > 0)) {
    throw new CpqNestingError("O bounding box do nesting tem dimensões inválidas.", "invalid_geometry");
  }
  return { larguraMm, alturaMm, areaM2: (larguraMm * alturaMm) / 1_000_000 };
}

function normalizarSvgFisico(peca: CpqNestingPeca): string {
  const { svg, larguraMm, alturaMm } = peca;
  if (!Number.isFinite(larguraMm) || !Number.isFinite(alturaMm) || larguraMm <= 0 || alturaMm <= 0 || larguraMm > 50_000 || alturaMm > 50_000) {
    throw new CpqNestingError("As dimensões físicas de cada peça precisam ser válidas em milímetros.", "invalid_geometry");
  }
  if (svg.length > 1_500_000 || /<!doctype|<!entity|<\s*(script|foreignObject|image|use)\b|\son[a-z]+\s*=|(?:href|xlink:href|transform)\s*=/i.test(svg)) {
    throw new CpqNestingError("O SVG excede o limite ou contém conteúdo não permitido para nesting.", "invalid_geometry");
  }
  const root = svg.match(/<svg\b[^>]*>/i)?.[0];
  if (!root || !/<path\b/i.test(svg) || /<\s*(rect|circle|ellipse|polygon|polyline|line|text)\b/i.test(svg)) {
    throw new CpqNestingError("Envie um SVG com caminhos vetoriais e sem formas fora de path.", "invalid_geometry");
  }
  const viewBox = root.match(/\bviewBox\s*=\s*(["'])([^"']+)\1/i)?.[2];
  const dims = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (!dims || dims.length !== 4 || !dims.every(Number.isFinite) || dims[2] <= 0 || dims[3] <= 0) {
    throw new CpqNestingError("O SVG precisa ter um viewBox válido.", "invalid_geometry");
  }
  const novoRoot = root
    .replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, "")
    .replace(/>$/, ` width="${larguraMm}mm" height="${alturaMm}mm">`);
  return svg.replace(root, novoRoot);
}

function executarMotor(
  pecas: Array<CpqNestingPeca & { svg: string }>,
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  timeoutMs: number
): Promise<DeepnestWorkerResult> {
  const nodeBin = process.env.DEEPNEST_NODE_BIN;
  const deepnestEntry = process.env.DEEPNEST_NODE_ENTRY;
  if (!nodeBin || !deepnestEntry) {
    throw new CpqNestingError("Configure DEEPNEST_NODE_BIN e DEEPNEST_NODE_ENTRY para habilitar o motor Deepnest local.", "configuration");
  }

  const workerPath = resolve(process.cwd(), "server", "scripts", "cpq-deepnest-worker.mjs");
  const child = spawn(nodeBin, [resolve(workerPath)], {
    env: { ...process.env, DEEPNEST_NODE_ENTRY: resolve(deepnestEntry) },
    cwd: dirname(resolve(deepnestEntry)),
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
  });

  return new Promise((resolvePromise, rejectPromise) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeout = setTimeout(() => {
      child.kill();
      if (!settled) {
        settled = true;
        rejectPromise(new CpqNestingError("O Deepnest excedeu o tempo de cálculo configurado.", "engine"));
      }
    }, timeoutMs + 1_000);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > 12_000_000) child.kill();
    });
    child.stderr.on("data", (chunk: string) => { stderr = (stderr + chunk).slice(-12_000); });
    child.on("error", error => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      rejectPromise(new CpqNestingError(`Não foi possível iniciar o worker Deepnest: ${error.message}`, "engine"));
    });
    child.on("close", code => {
      clearTimeout(timeout);
      if (settled) return;
      try {
        const resultado = JSON.parse(stdout) as DeepnestWorkerResult | { error?: string };
        if (code !== 0 || "error" in resultado) {
          settled = true;
          rejectPromise(new CpqNestingError(("error" in resultado ? resultado.error : null) || stderr || "O worker Deepnest encerrou com erro.", "engine"));
          return;
        }
        settled = true;
        resolvePromise(resultado as DeepnestWorkerResult);
      } catch {
        settled = true;
        rejectPromise(new CpqNestingError(stderr || "O worker Deepnest não devolveu um resultado válido.", "engine"));
      }
    });
    child.stdin.end(JSON.stringify({ pecas, larguraMm, alturaMm, espacamentoMm, timeoutMs }));
  });
}

function unidadeNormalizada(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/²/g, "2").toLowerCase().trim();
}

function estimarCustos(
  material: CpqMaterial,
  areaUsadaM2: number,
  areaChapaM2: number,
  perimetroM: number,
  /** Bobina: comprimento do rolo consumido, em metros (a área cobrada é largura × comprimento). */
  comprimentoBobinaM?: number
) {
  if (!Number.isFinite(material.custoUnitario) || material.custoUnitario <= 0) {
    return { custo: null, sobra: null, unidadeMetrica: false, alerta: "Matéria-prima sem custo válido no MubiSys; a precificação deve ficar bloqueada." };
  }
  const unidade = unidadeNormalizada(material.unidadeCusto);
  const areaSobra = Math.max(0, areaChapaM2 - areaUsadaM2);
  if (comprimentoBobinaM != null) {
    // Base de cobrança: a escolhida no cadastro da bobina; sem ela, só se deduz de m² ou metro linear.
    const base = material.bobinaCusto?.base
      ?? (["m2", "metro quadrado", "metros quadrados"].includes(unidade) ? "m2"
        : ["m", "ml", "metro", "metros", "metro linear", "metros lineares"].includes(unidade) ? "ml" : null);
    if (base === "m2") {
      return { custo: areaChapaM2 * material.custoUnitario, sobra: areaSobra * material.custoUnitario, unidadeMetrica: true, alerta: null };
    }
    if (base === "ml") {
      return { custo: comprimentoBobinaM * material.custoUnitario, sobra: null, unidadeMetrica: true, alerta: null };
    }
    if (base === "rolo") {
      const comprimentoRoloMm = material.bobinaCusto?.comprimentoRoloMm ?? 0;
      if (!(comprimentoRoloMm > 0)) {
        return { custo: null, sobra: null, unidadeMetrica: false, alerta: "Bobina cobrada por rolo sem o comprimento do rolo cadastrado; informe em Produtos > Matérias-primas antes de emitir a proposta." };
      }
      const fracaoDoRolo = (comprimentoBobinaM * 1000) / comprimentoRoloMm;
      return {
        custo: fracaoDoRolo * material.custoUnitario,
        sobra: areaChapaM2 > 0 ? fracaoDoRolo * material.custoUnitario * (areaSobra / areaChapaM2) : null,
        unidadeMetrica: true,
        alerta: null,
      };
    }
    return {
      custo: null,
      sobra: null,
      unidadeMetrica: false,
      alerta: `Unidade de custo "${material.unidadeCusto}" não converte em consumo de bobina; escolha em Produtos > Matérias-primas como o custo é cobrado (m², metro linear ou rolo) antes de emitir a proposta.`,
    };
  }
  if (["m2", "m2", "metro quadrado", "metros quadrados"].includes(unidade)) {
    return { custo: areaUsadaM2 * material.custoUnitario, sobra: areaSobra * material.custoUnitario, unidadeMetrica: true, alerta: null };
  }
  if (["chapa", "un", "und", "unidade", "unidades"].includes(unidade)) {
    return {
      custo: (areaUsadaM2 / areaChapaM2) * material.custoUnitario,
      sobra: (areaSobra / areaChapaM2) * material.custoUnitario,
      unidadeMetrica: true,
      alerta: null,
    };
  }
  if (["m", "ml", "metro linear", "metros lineares", "perimetro"].includes(unidade)) {
    return { custo: perimetroM * material.custoUnitario, sobra: null, unidadeMetrica: false, alerta: null };
  }
  return {
    custo: null,
    sobra: null,
    unidadeMetrica: false,
    alerta: `Unidade de custo "${material.unidadeCusto}" sem conversão automática; revise a regra antes de emitir a proposta.`,
  };
}

type AvaliacaoChapa = {
  chapa: CpqChapa;
  dimensoes: { larguraMm: number; alturaMm: number };
  ordemOrientacao: number;
  nesting: DeepnestWorkerResult;
  caixa: ReturnType<typeof calcularBoundingBoxEsquerdo>;
  areaChapaM2: number;
  areaLiquidaM2: number;
  aproveitamento: number;
  /** Só em bobina: comprimento consumido (mm, arredondado para cima). */
  comprimentoConsumidoMm?: number;
};

/** Comprimento de rolo oferecido ao motor: folga sobre a área das peças, limitado ao teto cadastrado. */
function comprimentoInicialBobinaMm(pecas: CpqNestingPeca[], larguraBobinaMm: number, tetoMm: number): number {
  const areaCaixasMm2 = pecas.reduce((total, peca) => total + peca.larguraMm * peca.alturaMm, 0);
  const maiorLadoMm = Math.max(...pecas.flatMap(peca => [peca.larguraMm, peca.alturaMm]));
  return Math.min(tetoMm, Math.ceil(Math.max(maiorLadoMm, (areaCaixasMm2 * 2) / larguraBobinaMm + maiorLadoMm)));
}

function compararAvaliacoes(a: AvaliacaoChapa, b: AvaliacaoChapa): number {
  return (a.dimensoes.larguraMm * a.dimensoes.alturaMm) - (b.dimensoes.larguraMm * b.dimensoes.alturaMm)
    || Number(!!b.chapa.principal) - Number(!!a.chapa.principal)
    || a.chapa.id - b.chapa.id
    || a.ordemOrientacao - b.ordemOrientacao;
}

/** Testa os formatos em ordem de área e escolhe a menor chapa que comporta todas as peças. */
export async function calcularNestingMultiMaterial(input: {
  svg?: string;
  larguraSvgMm?: number;
  alturaSvgMm?: number;
  pecas?: CpqNestingPeca[];
  espacamentoMm?: number;
  materiais: CpqMaterial[];
}): Promise<CpqNestingMaterialResult[]> {
  if (input.materiais.length === 0) throw new CpqNestingError("Selecione ao menos um material de chapa.", "invalid_geometry");
  const pecasGlobais = input.pecas?.length ? input.pecas : input.svg ? [{
    id: "peca-1",
    svg: input.svg,
    larguraMm: input.larguraSvgMm ?? 0,
    alturaMm: input.alturaSvgMm ?? 0,
  }] : [];
  if (input.materiais.some(material => (material.pecas ?? pecasGlobais).length === 0)
    || input.materiais.some(material => (material.pecas ?? pecasGlobais).length > 100)) {
    throw new CpqNestingError("Informe entre uma e cem artes vetoriais para calcular o nesting.", "invalid_geometry");
  }
  const espacamentoMm = input.espacamentoMm ?? 0;
  if (!Number.isFinite(espacamentoMm) || espacamentoMm < 0 || espacamentoMm > 50) {
    throw new CpqNestingError("O espaçamento entre peças precisa ficar entre 0 e 50 mm.", "invalid_geometry");
  }
  const ids = new Set<number>();
  const materiaisUnicos = input.materiais.filter(material => {
    if (ids.has(material.id)) return false;
    ids.add(material.id);
    return true;
  });

  return Promise.all(materiaisUnicos.map(async (material): Promise<CpqNestingMaterialResult> => {
    const chapas = ordenarChapasMenoresPrimeiro(material.chapas.filter(chapa =>
      chapa.mubisysMateriaPrimaId === material.id
      && Number.isInteger(chapa.larguraMm) && chapa.larguraMm > 0
      && Number.isInteger(chapa.alturaMm) && chapa.alturaMm > 0,
    ));
    if (!chapas.length) throw new CpqNestingError(`Não há formato de chapa cadastrado para ${material.nome} (matéria-prima ${material.id}).`, "no_fit");

    const pecasMaterialOriginal = material.pecas ?? pecasGlobais;
    const pecasMaterial = pecasMaterialOriginal.map(peca => ({ ...peca, svg: normalizarSvgFisico(peca) }));
    const avaliacoes: AvaliacaoChapa[] = [];
    for (const chapa of chapas) {
      for (const { larguraMm, alturaMm, ordemOrientacao } of orientacoesChapa(chapa)) {
        const completo = (resultado: DeepnestWorkerResult) =>
          resultado.completo && resultado.quantidadePosicionada > 0 && resultado.placements.length === resultado.quantidadePecas;
        if (chapa.bobina) {
          // Largura fixa (alturaMm); o comprimento é medido pelo layout, não cadastrado.
          const larguraBobinaMm = alturaMm;
          const comprimentoInicialMm = comprimentoInicialBobinaMm(pecasMaterialOriginal, larguraBobinaMm, larguraMm);
          // O worker real não devolve layout incompleto: sem encaixe no tempo, ele falha com erro de motor.
          // Por isso o comprimento curto que não fecha (resultado incompleto OU erro de motor) repete com o teto.
          let nesting: DeepnestWorkerResult | null = null;
          try {
            nesting = await executarMotor(pecasMaterial, comprimentoInicialMm, larguraBobinaMm, espacamentoMm, TEMPO_MOTOR_MS);
          } catch (error) {
            if (!(error instanceof CpqNestingError) || error.code !== "engine" || comprimentoInicialMm >= larguraMm) throw error;
          }
          if ((!nesting || !completo(nesting)) && comprimentoInicialMm < larguraMm)
            nesting = await executarMotor(pecasMaterial, larguraMm, larguraBobinaMm, espacamentoMm, TEMPO_MOTOR_MS);
          if (!nesting || !completo(nesting)) continue;
          const caixa = calcularBoundingBoxEsquerdo(nesting.bounds);
          const comprimentoConsumidoMm = Math.ceil(caixa.larguraMm);
          const areaCobradaM2 = (comprimentoConsumidoMm * larguraBobinaMm) / 1_000_000;
          const areaLiquidaM2 = nesting.areaLiquidaMm2 / 1_000_000;
          avaliacoes.push({
            chapa,
            dimensoes: { larguraMm: comprimentoConsumidoMm, alturaMm: larguraBobinaMm },
            ordemOrientacao,
            nesting,
            caixa,
            areaChapaM2: areaCobradaM2,
            areaLiquidaM2,
            aproveitamento: areaCobradaM2 > 0 ? (areaLiquidaM2 / areaCobradaM2) * 100 : 0,
            comprimentoConsumidoMm,
          });
          continue;
        }
        const dimensoes = { larguraMm, alturaMm };
        const nesting = await executarMotor(pecasMaterial, larguraMm, alturaMm, espacamentoMm, TEMPO_MOTOR_MS);
        if (!completo(nesting)) continue;
        const caixa = calcularBoundingBoxEsquerdo(nesting.bounds);
        const areaChapaM2 = (larguraMm * alturaMm) / 1_000_000;
        const areaLiquidaM2 = nesting.areaLiquidaMm2 / 1_000_000;
        const areaBlocoOcupadoM2 = caixa.areaM2;
        avaliacoes.push({
          chapa,
          dimensoes,
          ordemOrientacao,
          nesting,
          caixa,
          areaChapaM2,
          areaLiquidaM2,
          aproveitamento: areaChapaM2 > 0 ? (areaBlocoOcupadoM2 / areaChapaM2) * 100 : 0,
        });
      }
    }
    if (!avaliacoes.length) throw new CpqNestingError(`As peças de ${material.nome} não couberam em nenhum dos formatos de chapa cadastrados.`, "no_fit");
    avaliacoes.sort(compararAvaliacoes);
    const melhor = avaliacoes[0];
    const dimensoes = melhor.dimensoes;
    const emBobina = melhor.comprimentoConsumidoMm != null;
    // Chapa: o bloco ocupado é o consumo. Bobina: cobra-se a faixa inteira (largura do rolo × comprimento).
    const areaConsumoM2 = emBobina ? melhor.areaLiquidaM2 : melhor.caixa.areaM2;
    const custos = estimarCustos(
      material,
      areaConsumoM2,
      melhor.areaChapaM2,
      melhor.nesting.perimetroTotalMm / 1000,
      emBobina ? melhor.comprimentoConsumidoMm! / 1000 : undefined
    );
    const areaSobraM2 = Math.max(0, melhor.areaChapaM2 - areaConsumoM2);
    return {
      id_materia_prima: material.id,
      materia_prima: material.nome,
      custo_unitario: material.custoUnitario > 0 ? material.custoUnitario : null,
      unidade_custo: material.unidadeCusto,
      custo_material_estimado: custos.custo,
      custo_sobra_estimado: custos.sobra,
      alerta_custo: custos.alerta,
      area_liquida_m2: melhor.areaLiquidaM2,
      area_sobra_m2: areaSobraM2,
      perimetro_total_m: melhor.nesting.perimetroTotalMm / 1000,
      area_chapa_utilizada_m2: emBobina ? melhor.areaChapaM2 : melhor.caixa.areaM2,
      porcentagem_aproveitamento: melhor.aproveitamento,
      criterio_escolha: "menor_chapa_que_comporta",
      id_chapa_utilizada: melhor.chapa.id,
      nome_chapa_utilizada: melhor.chapa.nome,
      chapa_principal: !!melhor.chapa.principal,
      chapa: { largura_mm: dimensoes.larguraMm, altura_mm: dimensoes.alturaMm },
      formato: emBobina ? "bobina" : "chapa",
      ...(emBobina ? {
        comprimento_consumido_mm: melhor.comprimentoConsumidoMm,
        largura_bobina_mm: dimensoes.alturaMm,
      } : {}),
      posicionamentos: melhor.nesting.placements.map(position => ({
        ...position,
        origemId: pecasMaterialOriginal[position.source ?? 0]?.id,
        xMm: position.xMm - (melhor.nesting.bounds?.minX ?? 0),
      })),
    };
  }));
}
