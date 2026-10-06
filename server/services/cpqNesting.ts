import { spawn } from "node:child_process";
import { createHmac, timingSafeEqual } from "node:crypto";
import { dirname, resolve } from "node:path";
import type { BobinaCustoConfig } from "../../shared/bobina";
import { executarMotorInterno, GeometriaInvalidaMotorInterno, medidasDaPeca } from "./cpqNestingInterno";
import { rotacoesDoDeepnest, type ProcessoCorte, type RotacaoPermitida } from "../../shared/politica-corte";

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
  /** Quando o material usa mais de uma chapa: qual (0 = primeira). Ausente = chapa única. */
  chapaIndice?: number;
};

export type CpqMaterial = {
  id: number;
  nome: string;
  custoUnitario: number;
  unidadeCusto: string;
  /** Unidade de movimentação do MubiSys; desempata o rótulo genérico "Unidade/Gl/Lt/Kg" da unidade de custo (chapa). */
  unidadeMovimentacao?: string | null;
  chapas: CpqChapa[];
  /** Lote geométrico isolado desta matéria-prima; sem ele usa as peças globais. */
  pecas?: CpqNestingPeca[];
  /** Bobina: como o custo do MubiSys é cobrado (cadastro local). Sem isso, deduz pela unidade de custo. */
  bobinaCusto?: BobinaCustoConfig | null;
  /** Política de corte deste material (cadastro): espaçamento/margem próprios (mm) valem mais que o padrão do orçamento. */
  espacamentoMm?: number | null;
  margemBordaMm?: number | null;
  /** Escovado: só gira 0° e 180° ("veio"). Ausente/"livre": qualquer ângulo. */
  rotacao?: RotacaoPermitida;
  processoCorte?: ProcessoCorte | null;
};

type DeepnestWorkerResult = {
  completo: boolean;
  quantidadePecas: number;
  quantidadePosicionada: number;
  areaLiquidaMm2: number;
  perimetroTotalMm: number;
  placements: CpqNestingPlacement[];
  bounds: { minX: number; maxX: number; minY: number; maxY: number } | null;
  /** Quem calculou: o Deepnest (local ou remoto) ou o motor interno por caixas (estimativa conservadora). */
  motor?: "deepnest" | "interno";
};

export type CpqNestingFormatoResultado = {
  id_chapa: number;
  nome_chapa: string;
  chapa_principal: boolean;
  largura_cadastrada_mm: number;
  altura_cadastrada_mm: number;
  formato: "chapa" | "bobina";
  status: "apto" | "nao_cabe" | "falha";
  mensagem: string | null;
  largura_nesting_mm: number | null;
  altura_nesting_mm: number | null;
  quantidade_pecas: number;
  quantidade_posicionada: number;
  area_liquida_m2: number | null;
  area_sobra_m2: number | null;
  perimetro_total_m: number | null;
  area_chapa_utilizada_m2: number | null;
  porcentagem_aproveitamento: number | null;
  custo_material_estimado: number | null;
  custo_sobra_estimado: number | null;
  alerta_custo: string | null;
  posicionamentos: CpqNestingPlacement[];
}

export type CpqNestingMaterialResult = {
  espacamento_pecas_mm: number;
  margem_borda_mm: number;
  formatos_avaliados: CpqNestingFormatoResultado[];
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
  /** Motor que calculou este layout; "interno" = caixas giradas, sem o encaixe fino do Deepnest. */
  motor?: "deepnest" | "interno";
  /** Só em bobina: comprimento do rolo consumido pelo layout, em mm. */
  comprimento_consumido_mm?: number;
  /** Só em bobina: largura do rolo, em mm. */
  largura_bobina_mm?: number;
  /** Processo de corte e rotação que valeram neste nesting (cadastro da matéria-prima). */
  processo_corte?: ProcessoCorte | null;
  rotacao_permitida?: RotacaoPermitida;
  /** O desenho não coube numa chapa e foi distribuído em N chapas do mesmo material (consumo e custo já somam as N). */
  quantidade_chapas?: number;
  /** Estimativa (pela área) do tamanho, em % do atual, em que o desenho caberia numa só chapa. */
  escala_para_uma_chapa_pct?: number;
  /** Instrução ao vendedor quando foram necessárias várias chapas. */
  instrucao_nao_coube?: string;
  posicionamentos: CpqNestingPlacement[];
};

export type CpqNestingResultadoAssinavel = Pick<
  CpqNestingMaterialResult,
  | "espacamento_pecas_mm"
  | "margem_borda_mm"
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
    result: Object.fromEntries(Object.entries(result).filter(([key]) => key !== "posicionamentos" && key !== "formatos_avaliados")),
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

function orientacoesChapa(chapa: CpqChapa, rotacao: RotacaoPermitida = "livre"): Array<{ larguraMm: number; alturaMm: number; ordemOrientacao: number }> {
  // Escovado: o veio corre pelo lado maior da chapa (eixo X do nesting). Virar a chapa 90° faria as peças girarem 90° em relação
  // ao veio, o que a regra 0°/180° proíbe; por isso só vale a orientação com o lado maior em X.
  if (rotacao === "veio" && !chapa.bobina) {
    return [{ larguraMm: Math.max(chapa.larguraMm, chapa.alturaMm), alturaMm: Math.min(chapa.larguraMm, chapa.alturaMm), ordemOrientacao: 0 }];
  }
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

/** O serviço Deepnest remoto não respondeu (rede, autenticação ou instância fora do ar): cai no motor interno. */
class MotorIndisponivelError extends Error {}

async function executarMotorRemoto(
  url: string,
  payload: { pecas: Array<CpqNestingPeca & { svg: string }>; larguraMm: number; alturaMm: number; espacamentoMm: number; timeoutMs: number; rotacoes?: number },
): Promise<DeepnestWorkerResult> {
  const token = process.env.DEEPNEST_REMOTE_TOKEN?.trim();
  const controle = new AbortController();
  const limite = setTimeout(() => controle.abort(), payload.timeoutMs + 15_000);
  let resposta: Response;
  try {
    resposta = await fetch(`${url.replace(/\/+$/, "")}/nesting`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(payload),
      signal: controle.signal,
    });
  } catch (error) {
    throw new MotorIndisponivelError(error instanceof Error ? error.message : "Serviço Deepnest inacessível.");
  } finally {
    clearTimeout(limite);
  }
  if ([401, 403, 404, 502, 503, 504].includes(resposta.status)) throw new MotorIndisponivelError(`Serviço Deepnest respondeu ${resposta.status}.`);
  const corpo = await resposta.json().catch(() => null) as (Partial<DeepnestWorkerResult> & { error?: string }) | null;
  if (!resposta.ok || !corpo || corpo.error)
    throw new CpqNestingError(corpo?.error || `O serviço Deepnest respondeu ${resposta.status}.`, "engine");
  if (typeof corpo.completo !== "boolean" || !Array.isArray(corpo.placements) || typeof corpo.areaLiquidaMm2 !== "number")
    throw new CpqNestingError("O serviço Deepnest devolveu um resultado inválido.", "engine");
  return corpo as DeepnestWorkerResult;
}

/**
 * Escolhe o motor: serviço Deepnest remoto (DEEPNEST_REMOTE_URL) → Deepnest local (DEEPNEST_NODE_BIN/ENTRY) →
 * motor interno. Sem nenhum Deepnest configurado (ou com o remoto fora do ar) o nesting nunca trava: o motor
 * interno devolve um layout por caixas, marcado como `motor: "interno"`.
 */
async function executarMotor(
  pecas: Array<CpqNestingPeca & { svg: string }>,
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  timeoutMs: number,
  opcoes: { bobina?: boolean; rotacao?: RotacaoPermitida } = {},
): Promise<DeepnestWorkerResult> {
  const rotacoes = rotacoesDoDeepnest(opcoes.rotacao);
  const remoto = process.env.DEEPNEST_REMOTE_URL?.trim();
  if (remoto) {
    try {
      return { ...(await executarMotorRemoto(remoto, { pecas, larguraMm, alturaMm, espacamentoMm, timeoutMs, rotacoes })), motor: "deepnest" };
    } catch (error) {
      if (!(error instanceof MotorIndisponivelError)) throw error;
      console.warn(`[cpq-nesting] Deepnest remoto indisponível (${error.message}); usando o motor interno.`);
    }
  } else if (process.env.DEEPNEST_NODE_BIN && process.env.DEEPNEST_NODE_ENTRY) {
    return { ...(await executarMotorLocal(pecas, larguraMm, alturaMm, espacamentoMm, timeoutMs, rotacoes)), motor: "deepnest" };
  }
  try {
    return { ...executarMotorInterno(pecas, larguraMm, alturaMm, espacamentoMm, opcoes), motor: "interno" };
  } catch (error) {
    if (error instanceof GeometriaInvalidaMotorInterno) throw new CpqNestingError(error.message, "invalid_geometry");
    throw error;
  }
}

function executarMotorLocal(
  pecas: Array<CpqNestingPeca & { svg: string }>,
  larguraMm: number,
  alturaMm: number,
  espacamentoMm: number,
  timeoutMs: number,
  rotacoes = 72,
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
    child.stdin.end(JSON.stringify({ pecas, larguraMm, alturaMm, espacamentoMm, timeoutMs, rotacoes }));
  });
}

function unidadeNormalizada(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/²/g, "2").toLowerCase().trim();
}

const UNIDADE_CUSTO_GENERICA_MUBISYS = "unidade/gl/lt/kg";

/**
 * Unidade em que o custo da chapa é cobrado. "Unidade/Gl/Lt/Kg" é só o rótulo genérico do MubiSys e
 * não diz a base; nesse caso vale a unidade de movimentação quando ela é m² (ex.: Acrílico Branco 3mm
 * e PVC 15/20/30 mm vêm assim, com R$/m²). Qualquer outra combinação continua sem conversão e pendente.
 */
function unidadeCustoDaChapa(material: CpqMaterial): string {
  const custo = unidadeNormalizada(material.unidadeCusto);
  if (custo !== UNIDADE_CUSTO_GENERICA_MUBISYS) return custo;
  const movimentacao = unidadeNormalizada(material.unidadeMovimentacao ?? "");
  return ["m2", "metro quadrado", "metros quadrados"].includes(movimentacao) ? movimentacao : custo;
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
  const unidadeChapa = unidadeCustoDaChapa(material);
  if (["m2", "metro quadrado", "metros quadrados"].includes(unidadeChapa)) {
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
    alerta: `Unidade de custo "${material.unidadeCusto}"${material.unidadeMovimentacao ? ` (movimentação "${material.unidadeMovimentacao}")` : ""} sem conversão automática; revise a regra antes de emitir a proposta.`,
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
  /** Material consumido por este layout (m²): caixa ocupada na chapa; faixa cobrada na bobina. Menor é melhor. */
  consumoM2: number;
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

function mapearPosicionamentos(avaliacao: AvaliacaoChapa, pecas: CpqNestingPeca[], margemBordaMm: number): CpqNestingPlacement[] {
  return avaliacao.nesting.placements.map(position => ({
    ...position,
    origemId: pecas[position.source ?? 0]?.id,
    xMm: position.xMm - (avaliacao.nesting.bounds?.minX ?? 0) + margemBordaMm,
    yMm: position.yMm - (avaliacao.nesting.bounds?.minY ?? 0) + margemBordaMm,
  }));
}

const MAX_CHAPAS_POR_MATERIAL = 8;

/**
 * Aviso claro ANTES de chamar o motor: se uma peça é maior que a área útil (tamanho do formato menos a margem de borda) de TODOS os
 * formatos do material, ela não cabe em nenhuma chapa nem em várias; o motor só devolveria "não coube" depois de rodar. A conferência
 * é exata para o que é impossível (menor largura da peça em qualquer ângulo contra a menor dimensão útil; no escovado, a caixa a
 * 0°/180° contra as duas); o que passa daqui ainda pode não caber por causa do espaçamento, e aí o motor explica.
 */
function verificarPecasCabemNaAreaUtil(material: CpqMaterial, chapas: CpqChapa[], pecas: Array<CpqNestingPeca & { svg: string }>, margemBordaMm: number, rotacao: RotacaoPermitida): void {
  const formatos = chapas.map(chapa => {
    const larguraMm = chapa.bobina ? chapa.larguraMm : Math.max(chapa.larguraMm, chapa.alturaMm);
    const alturaMm = chapa.bobina ? chapa.alturaMm : Math.min(chapa.larguraMm, chapa.alturaMm);
    return { chapa, larguraUtilMm: larguraMm - 2 * margemBordaMm, alturaUtilMm: alturaMm - 2 * margemBordaMm };
  }).filter(formato => formato.larguraUtilMm > 0 && formato.alturaUtilMm > 0);
  if (!formatos.length) {
    throw new CpqNestingError(`A margem de borda de ${margemBordaMm} mm deixa sem área útil todos os formatos de ${material.nome}. Reduza a margem em Produtos > Matérias-primas (corte e encaixe).`, "no_fit");
  }
  const todasBobinas = formatos.every(formato => formato.chapa.bobina);
  const maiorLarguraUtilMm = Math.max(...formatos.map(formato => Math.min(formato.larguraUtilMm, formato.alturaUtilMm)));
  const maiorFormato = [...formatos].sort((a, b) => Math.min(b.larguraUtilMm, b.alturaUtilMm) - Math.min(a.larguraUtilMm, a.alturaUtilMm))[0];
  const rotulo = (formato: (typeof formatos)[number]) => formato.chapa.bobina
    ? `bobina de ${formato.chapa.alturaMm} mm`
    : `chapa ${formato.chapa.nome} (${formato.chapa.larguraMm} × ${formato.chapa.alturaMm} mm)`;
  for (const peca of pecas) {
    let medidas: ReturnType<typeof medidasDaPeca>;
    try { medidas = medidasDaPeca(peca); }
    catch (error) {
      // O aviso é só uma conferência antecipada: se a geometria não pode ser medida aqui, o motor (Deepnest ou interno) reporta o erro dela.
      if (error instanceof GeometriaInvalidaMotorInterno) continue;
      throw error;
    }
    if (medidas.menorLarguraMm <= 0) continue;
    const cabe = rotacao === "veio"
      ? formatos.some(formato => medidas.larguraMm <= formato.larguraUtilMm && medidas.alturaMm <= formato.alturaUtilMm)
      : formatos.some(formato => medidas.menorLarguraMm <= Math.min(formato.larguraUtilMm, formato.alturaUtilMm));
    if (cabe) continue;
    const escalaPct = Math.max(1, Math.min(99, Math.floor(100 * (rotacao === "veio" ? Math.min(maiorFormato.larguraUtilMm / medidas.larguraMm, maiorFormato.alturaUtilMm / medidas.alturaMm) : maiorLarguraUtilMm / medidas.menorLarguraMm))));
    const util = todasBobinas ? `largura útil de ${Math.round(maiorFormato.alturaUtilMm)} mm (rolo de ${maiorFormato.chapa.alturaMm} mm menos ${2 * margemBordaMm} mm de margem de borda)` : `área útil de ${Math.round(maiorFormato.larguraUtilMm)} × ${Math.round(maiorFormato.alturaUtilMm)} mm (formato menos ${2 * margemBordaMm} mm de margem de borda)`;
    const medida = rotacao === "veio"
      ? `mede ${Math.round(medidas.larguraMm)} × ${Math.round(medidas.alturaMm)} mm e o escovado só admite 0°/180° (veio)`
      : `tem largura mínima de ${Math.round(medidas.menorLarguraMm)} mm em qualquer ângulo`;
    throw new CpqNestingError(
      `A peça "${peca.id}" de ${material.nome} ${medida}, mas o maior formato cadastrado (${rotulo(maiorFormato)}) tem ${util}. Ela não cabe nem em várias ${todasBobinas ? "faixas" : "chapas"}. O que fazer: aprove a emenda, reduza o letreiro para cerca de ${escalaPct}% ou ${todasBobinas ? "cadastre uma bobina mais larga" : "cadastre uma chapa maior"} para este material.`,
      "no_fit",
    );
  }
}

/**
 * Quando o desenho não cabe numa chapa, distribui as peças em mais de uma chapa do mesmo formato (a que gastar menos no
 * total) e devolve um único resultado com o consumo e o custo somados. Usa o motor interno, que devolve também o layout
 * parcial; sem solução (peça maior que a chapa, mais de 8 chapas...) devolve null e quem chamou explica o problema.
 */
function resultadoEmVariasChapas(
  material: CpqMaterial,
  chapas: CpqChapa[],
  pecasMaterial: Array<CpqNestingPeca & { svg: string }>,
  pecasOriginais: CpqNestingPeca[],
  espacamentoMm: number,
  margemBordaMm: number,
  rotacao: RotacaoPermitida = "livre",
): CpqNestingMaterialResult | null {
  type Folha = { placements: CpqNestingPlacement[]; larguraBlocoMm: number; alturaBlocoMm: number };
  let melhor: { chapa: CpqChapa; larguraMm: number; alturaMm: number; folhas: Folha[]; areaLiquidaMm2: number; perimetroMm: number; consumoM2: number } | null = null;
  for (const chapa of chapas) {
    if (chapa.bobina) continue;
    // A maior dimensão no eixo X: o nesting avança pelo comprimento da chapa, ocupando a largura.
    const larguraMm = Math.max(chapa.larguraMm, chapa.alturaMm), alturaMm = Math.min(chapa.larguraMm, chapa.alturaMm);
    const larguraUtilMm = larguraMm - 2 * margemBordaMm, alturaUtilMm = alturaMm - 2 * margemBordaMm;
    if (larguraUtilMm <= 0 || alturaUtilMm <= 0) continue;
    let restantes = pecasMaterial.map((_, indice) => indice);
    const folhas: Folha[] = [];
    let areaLiquidaMm2 = 0, perimetroMm = 0, completo = true;
    while (restantes.length) {
      if (folhas.length >= MAX_CHAPAS_POR_MATERIAL) { completo = false; break; }
      let r: ReturnType<typeof executarMotorInterno>;
      try { r = executarMotorInterno(restantes.map(indice => pecasMaterial[indice]), larguraUtilMm, alturaUtilMm, espacamentoMm, { rotacao }); }
      catch { completo = false; break; }
      if (!folhas.length) { areaLiquidaMm2 = r.areaLiquidaMm2; perimetroMm = r.perimetroTotalMm; }
      if (!r.placements.length || !r.bounds) { completo = false; break; } // alguma peça não cabe nem sozinha numa chapa nova
      const origem = restantes, limites = r.bounds, indiceFolha = folhas.length;
      folhas.push({
        placements: r.placements.map(p => ({
          ...p,
          source: origem[p.source ?? 0],
          origemId: pecasOriginais[origem[p.source ?? 0]]?.id,
          chapaIndice: indiceFolha,
          xMm: p.xMm - limites.minX + margemBordaMm,
          yMm: p.yMm - limites.minY + margemBordaMm,
        })),
        larguraBlocoMm: limites.maxX - limites.minX,
        alturaBlocoMm: limites.maxY - limites.minY,
      });
      const usados = new Set(r.placements.map(p => p.source ?? -1));
      restantes = restantes.filter((_, k) => !usados.has(k));
    }
    if (!completo || !folhas.length) continue;
    const consumoM2 = folhas.reduce((soma, folha) => soma + ((folha.larguraBlocoMm + 2 * margemBordaMm) * (folha.alturaBlocoMm + 2 * margemBordaMm)) / 1_000_000, 0);
    if (!melhor || consumoM2 < melhor.consumoM2 - 1e-9) melhor = { chapa, larguraMm, alturaMm, folhas, areaLiquidaMm2, perimetroMm, consumoM2 };
  }
  if (!melhor) return null;

  const { chapa, larguraMm, alturaMm, folhas } = melhor;
  const n = folhas.length;
  const areaChapaM2 = (chapa.larguraMm * chapa.alturaMm) / 1_000_000;
  const areaUtilM2 = ((larguraMm - 2 * margemBordaMm) * (alturaMm - 2 * margemBordaMm)) / 1_000_000;
  const areaLiquidaM2 = melhor.areaLiquidaMm2 / 1_000_000;
  const custos = estimarCustos(material, melhor.consumoM2, areaChapaM2, melhor.perimetroMm / 1000);
  const aproveitamento = areaChapaM2 > 0 ? (melhor.consumoM2 / (n * areaChapaM2)) * 100 : 0;
  // Estimativa pela área: uma chapa costuma comportar letras com ~50% de área real.
  const escalaPct = areaLiquidaM2 > 0 ? Math.max(1, Math.min(99, Math.floor(100 * Math.sqrt((0.5 * areaUtilM2) / areaLiquidaM2)))) : 99;
  const posicionamentos = folhas.flatMap(folha => folha.placements);
  const formatos = chapas.map(outra => outra.id === chapa.id
    ? {
        id_chapa: outra.id, nome_chapa: outra.nome, chapa_principal: !!outra.principal,
        largura_cadastrada_mm: outra.larguraMm, altura_cadastrada_mm: outra.alturaMm, formato: "chapa" as const,
        status: "apto" as const, mensagem: `Distribuído em ${n} chapas`,
        largura_nesting_mm: larguraMm, altura_nesting_mm: alturaMm,
        quantidade_pecas: pecasOriginais.length, quantidade_posicionada: posicionamentos.length,
        area_liquida_m2: areaLiquidaM2, area_sobra_m2: Math.max(0, n * areaChapaM2 - melhor.consumoM2),
        perimetro_total_m: melhor.perimetroMm / 1000, area_chapa_utilizada_m2: melhor.consumoM2, porcentagem_aproveitamento: aproveitamento,
        custo_material_estimado: custos.custo, custo_sobra_estimado: custos.sobra, alerta_custo: custos.alerta, posicionamentos,
      }
    : {
        id_chapa: outra.id, nome_chapa: outra.nome, chapa_principal: !!outra.principal,
        largura_cadastrada_mm: outra.larguraMm, altura_cadastrada_mm: outra.alturaMm,
        formato: outra.bobina ? "bobina" as const : "chapa" as const, status: "nao_cabe" as const,
        mensagem: "O desenho não cabe numa chapa deste formato (nem em mais chapas do formato escolhido, com menor consumo).",
        largura_nesting_mm: null, altura_nesting_mm: null, quantidade_pecas: pecasOriginais.length, quantidade_posicionada: 0,
        area_liquida_m2: null, area_sobra_m2: null, perimetro_total_m: null, area_chapa_utilizada_m2: null, porcentagem_aproveitamento: null,
        custo_material_estimado: null, custo_sobra_estimado: null, alerta_custo: null, posicionamentos: [],
      });
  return {
    espacamento_pecas_mm: espacamentoMm,
    margem_borda_mm: margemBordaMm,
    formatos_avaliados: formatos,
    id_materia_prima: material.id,
    materia_prima: material.nome,
    custo_unitario: material.custoUnitario > 0 ? material.custoUnitario : null,
    unidade_custo: material.unidadeCusto,
    custo_material_estimado: custos.custo,
    custo_sobra_estimado: custos.sobra,
    alerta_custo: custos.alerta,
    area_liquida_m2: areaLiquidaM2,
    area_sobra_m2: Math.max(0, n * areaChapaM2 - melhor.consumoM2),
    perimetro_total_m: melhor.perimetroMm / 1000,
    area_chapa_utilizada_m2: melhor.consumoM2,
    porcentagem_aproveitamento: aproveitamento,
    criterio_escolha: "menor_chapa_que_comporta",
    id_chapa_utilizada: chapa.id,
    nome_chapa_utilizada: chapa.nome,
    chapa_principal: !!chapa.principal,
    chapa: { largura_mm: larguraMm, altura_mm: alturaMm },
    formato: "chapa",
    motor: "interno",
    processo_corte: material.processoCorte ?? null,
    rotacao_permitida: rotacao,
    quantidade_chapas: n,
    escala_para_uma_chapa_pct: escalaPct,
    instrucao_nao_coube: `O desenho de ${material.nome} não cabe em uma chapa ${chapa.nome} (${chapa.larguraMm} × ${chapa.alturaMm} mm): foi distribuído em ${n} chapas, e o consumo e o custo abaixo já somam as ${n}. Para caber em uma só: reduza o letreiro para cerca de ${escalaPct}% do tamanho atual (estimativa pela área), cadastre um formato de chapa maior ou, se o desenho tiver uma peça única maior que a chapa, aprove a emenda. Para manter o tamanho, basta seguir com as ${n} chapas.`,
    posicionamentos,
  };
}

/** Material cujo nesting não foi possível (não coube, falha do motor...). Os demais materiais seguem normalmente. */
export type CpqNestingFalhaMaterial = {
  id_materia_prima: number;
  materia_prima: string;
  mensagem: string;
  codigo: CpqNestingError["code"];
  erro: CpqNestingError;
};

/**
 * Testa os formatos em ordem de área e escolhe a menor chapa que comporta todas as peças, material por material.
 * Cada material é independente: se um não couber, os outros continuam com o resultado (e o que falhou vem em `falhas`).
 */
export async function calcularNestingMultiMaterialParcial(input: {
  svg?: string;
  larguraSvgMm?: number;
  alturaSvgMm?: number;
  pecas?: CpqNestingPeca[];
  espacamentoMm?: number;
  margemBordaMm?: number;
  materiais: CpqMaterial[];
}): Promise<{ resultados: CpqNestingMaterialResult[]; falhas: CpqNestingFalhaMaterial[] }> {
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
  // Padrões do orçamento; cada material pode ter o seu (espaçamento/margem do cadastro ou do processo de corte).
  const espacamentoPadraoMm = input.espacamentoMm ?? 0;
  const margemBordaPadraoMm = input.margemBordaMm ?? 0;
  if (!Number.isFinite(espacamentoPadraoMm) || espacamentoPadraoMm < 0 || espacamentoPadraoMm > 50) throw new CpqNestingError("O espaçamento entre peças precisa ficar entre 0 e 50 mm.", "invalid_geometry");
  if (!Number.isFinite(margemBordaPadraoMm) || margemBordaPadraoMm < 0 || margemBordaPadraoMm > 50) throw new CpqNestingError("A margem da borda precisa ficar entre 0 e 50 mm.", "invalid_geometry");
  const ids = new Set<number>();
  const materiaisUnicos = input.materiais.filter(material => {
    if (ids.has(material.id)) return false;
    ids.add(material.id);
    return true;
  });

  const liquidados = await Promise.allSettled(materiaisUnicos.map(async (material): Promise<CpqNestingMaterialResult> => {
    const espacamentoMm = material.espacamentoMm ?? espacamentoPadraoMm;
    const margemBordaMm = material.margemBordaMm ?? margemBordaPadraoMm;
    const rotacao: RotacaoPermitida = material.rotacao ?? "livre";
    if (!Number.isFinite(espacamentoMm) || espacamentoMm < 0 || espacamentoMm > 50 || !Number.isFinite(margemBordaMm) || margemBordaMm < 0 || margemBordaMm > 50)
      throw new CpqNestingError(`O espaçamento e a margem de ${material.nome} precisam ficar entre 0 e 50 mm.`, "invalid_geometry");
    const chapas = ordenarChapasMenoresPrimeiro(material.chapas.filter(chapa =>
      chapa.mubisysMateriaPrimaId === material.id
      && Number.isInteger(chapa.larguraMm) && chapa.larguraMm > 0
      && Number.isInteger(chapa.alturaMm) && chapa.alturaMm > 0,
    ));
    if (!chapas.length) throw new CpqNestingError(`Não há formato de chapa cadastrado para ${material.nome} (matéria-prima ${material.id}).`, "no_fit");

    const pecasMaterialOriginal = material.pecas ?? pecasGlobais;
    const pecasMaterial = pecasMaterialOriginal.map(peca => ({ ...peca, svg: normalizarSvgFisico(peca) }));
    verificarPecasCabemNaAreaUtil(material, chapas, pecasMaterial, margemBordaMm, rotacao);
    const avaliacoes: AvaliacaoChapa[] = [];
    const falhasFormatos = new Map<number, string>();
    for (const chapa of chapas) {
      for (const { larguraMm, alturaMm, ordemOrientacao } of orientacoesChapa(chapa, rotacao)) {
        const completo = (resultado: DeepnestWorkerResult) =>
          resultado.completo && resultado.quantidadePosicionada > 0 && resultado.placements.length === resultado.quantidadePecas;
        if (chapa.bobina) {
          // Largura fixa (alturaMm); o comprimento é medido pelo layout, não cadastrado.
          const larguraBobinaMm = alturaMm - 2 * margemBordaMm;
          const comprimentoMaximoMm = larguraMm - 2 * margemBordaMm;
          if (larguraBobinaMm <= 0 || comprimentoMaximoMm <= 0) continue;
          const comprimentoInicialMm = comprimentoInicialBobinaMm(pecasMaterialOriginal, larguraBobinaMm, comprimentoMaximoMm);
          // O worker real não devolve layout incompleto: sem encaixe no tempo, ele falha com erro de motor.
          // Por isso o comprimento curto que não fecha (resultado incompleto OU erro de motor) repete com o teto.
          let nesting: DeepnestWorkerResult | null = null;
          let erroMotor: string | null = null;
          try {
            nesting = await executarMotor(pecasMaterial, comprimentoInicialMm, larguraBobinaMm, espacamentoMm, TEMPO_MOTOR_MS, { bobina: true, rotacao });
          } catch (error) {
            if (!(error instanceof CpqNestingError) || error.code !== "engine") throw error;
            erroMotor = error.message;
          }
          if ((!nesting || !completo(nesting)) && comprimentoInicialMm < comprimentoMaximoMm) {
            try {
              nesting = await executarMotor(pecasMaterial, comprimentoMaximoMm, larguraBobinaMm, espacamentoMm, TEMPO_MOTOR_MS, { bobina: true, rotacao });
              erroMotor = null;
            } catch (error) {
              if (!(error instanceof CpqNestingError) || error.code !== "engine") throw error;
              erroMotor = error.message;
            }
          }
          if (!nesting || !completo(nesting)) {
            if (erroMotor) falhasFormatos.set(chapa.id, erroMotor);
            continue;
          }
          const caixa = calcularBoundingBoxEsquerdo(nesting.bounds);
          const comprimentoConsumidoMm = Math.ceil(caixa.larguraMm + 2 * margemBordaMm);
          const areaCobradaM2 = (comprimentoConsumidoMm * alturaMm) / 1_000_000;
          const areaLiquidaM2 = nesting.areaLiquidaMm2 / 1_000_000;
          avaliacoes.push({
            chapa,
            dimensoes: { larguraMm: comprimentoConsumidoMm, alturaMm },
            ordemOrientacao,
            nesting,
            caixa,
            areaChapaM2: areaCobradaM2,
            areaLiquidaM2,
            aproveitamento: areaCobradaM2 > 0 ? (areaLiquidaM2 / areaCobradaM2) * 100 : 0,
            consumoM2: areaCobradaM2,
            comprimentoConsumidoMm,
          });
          continue;
        }
        const larguraUtilMm = larguraMm - 2 * margemBordaMm;
        const alturaUtilMm = alturaMm - 2 * margemBordaMm;
        if (larguraUtilMm <= 0 || alturaUtilMm <= 0) continue;
        const dimensoes = { larguraMm, alturaMm };
        let nesting: DeepnestWorkerResult;
        try {
          nesting = await executarMotor(pecasMaterial, larguraUtilMm, alturaUtilMm, espacamentoMm, TEMPO_MOTOR_MS, { rotacao });
        } catch (error) {
          if (!(error instanceof CpqNestingError) || error.code !== "engine") throw error;
          falhasFormatos.set(chapa.id, error.message);
          continue;
        }
        if (!completo(nesting)) continue;
        const caixa = calcularBoundingBoxEsquerdo(nesting.bounds);
        const areaChapaM2 = (larguraMm * alturaMm) / 1_000_000;
        const areaLiquidaM2 = nesting.areaLiquidaMm2 / 1_000_000;
        const areaBlocoOcupadoM2 = ((caixa.larguraMm + 2 * margemBordaMm) * (caixa.alturaMm + 2 * margemBordaMm)) / 1_000_000;
        avaliacoes.push({
          chapa,
          dimensoes,
          ordemOrientacao,
          nesting,
          caixa,
          areaChapaM2,
          areaLiquidaM2,
          aproveitamento: areaChapaM2 > 0 ? (areaBlocoOcupadoM2 / areaChapaM2) * 100 : 0,
          consumoM2: areaBlocoOcupadoM2,
        });
      }
    }
    const melhoresPorChapa = new Map<number, AvaliacaoChapa>();
    for (const chapa of chapas) {
      const layouts = avaliacoes.filter(item => item.chapa.id === chapa.id);
      // Entre as orientações da mesma chapa vale a que consome menos material (antes escolhia a de maior caixa ocupada).
      layouts.sort((a, b) => a.consumoM2 - b.consumoM2 || a.ordemOrientacao - b.ordemOrientacao);
      if (layouts[0]) melhoresPorChapa.set(chapa.id, layouts[0]);
    }
    const candidatas = [...melhoresPorChapa.values()].sort(compararAvaliacoes);
    if (!candidatas.length) {
      const detalhesFormatos = chapas.map(chapa => `${chapa.nome} (${chapa.larguraMm} × ${chapa.alturaMm} mm): ${falhasFormatos.get(chapa.id) ?? "o desenho não coube com o espaçamento e a margem selecionados"}`).join("; ");
      const todosFalharamNoMotor = falhasFormatos.size > 0 && chapas.every(chapa => falhasFormatos.has(chapa.id));
      // Não coube numa chapa só: usa outras chapas do mesmo material em vez de travar o orçamento.
      if (!todosFalharamNoMotor) {
        const emVariasChapas = resultadoEmVariasChapas(material, chapas, pecasMaterial, pecasMaterialOriginal, espacamentoMm, margemBordaMm, rotacao);
        if (emVariasChapas) return emVariasChapas;
      }
      throw new CpqNestingError(
        todosFalharamNoMotor
          ? `O motor de nesting falhou para ${material.nome}. ${detalhesFormatos}`
          : chapas.every(chapa => chapa.bobina)
            ? `As peças de ${material.nome} não couberam na bobina cadastrada (mesmo com o comprimento máximo do rolo). ${detalhesFormatos}. O que fazer: confira o espaçamento e a margem de borda deste material, reduza o letreiro ou cadastre uma bobina mais larga.`
            : `As peças de ${material.nome} não couberam em nenhum formato cadastrado, nem distribuídas em até ${MAX_CHAPAS_POR_MATERIAL} chapas. ${detalhesFormatos}. O que fazer: se há uma peça maior que a chapa, aprove a emenda (ou reduza o letreiro em até 3%); senão cadastre um formato de chapa maior para este material ou reduza o tamanho do letreiro.`,
        todosFalharamNoMotor ? "engine" : "no_fit",
      );
    }
    const melhor = candidatas[0];
    const formatosAvaliados = chapas.map(chapa => {
      const layout = melhoresPorChapa.get(chapa.id);
      if (!layout) {
        const mensagem = falhasFormatos.get(chapa.id) ?? "As pe\u00e7as n\u00e3o couberam com o espa\u00e7amento e a margem selecionados.";
        return {
          id_chapa: chapa.id, nome_chapa: chapa.nome, chapa_principal: !!chapa.principal,
          largura_cadastrada_mm: chapa.larguraMm, altura_cadastrada_mm: chapa.alturaMm,
          formato: chapa.bobina ? "bobina" as const : "chapa" as const,
          status: falhasFormatos.has(chapa.id) ? "falha" as const : "nao_cabe" as const,
          mensagem, largura_nesting_mm: null, altura_nesting_mm: null,
          quantidade_pecas: pecasMaterialOriginal.length, quantidade_posicionada: 0,
          area_liquida_m2: null, area_sobra_m2: null, perimetro_total_m: null,
          area_chapa_utilizada_m2: null, porcentagem_aproveitamento: null,
          custo_material_estimado: null, custo_sobra_estimado: null, alerta_custo: mensagem,
          posicionamentos: [],
        };
      }
      const emBobina = layout.comprimentoConsumidoMm != null;
      const areaConsumoM2 = emBobina ? layout.areaLiquidaM2 : ((layout.caixa.larguraMm + 2 * margemBordaMm) * (layout.caixa.alturaMm + 2 * margemBordaMm)) / 1_000_000;
      const custosFormato = estimarCustos(material, areaConsumoM2, layout.areaChapaM2, layout.nesting.perimetroTotalMm / 1000, emBobina ? layout.comprimentoConsumidoMm! / 1000 : undefined);
      return {
        id_chapa: chapa.id, nome_chapa: chapa.nome, chapa_principal: !!chapa.principal,
        largura_cadastrada_mm: chapa.larguraMm, altura_cadastrada_mm: chapa.alturaMm,
        formato: emBobina ? "bobina" as const : "chapa" as const, status: "apto" as const, mensagem: null,
        largura_nesting_mm: layout.dimensoes.larguraMm, altura_nesting_mm: layout.dimensoes.alturaMm,
        quantidade_pecas: layout.nesting.quantidadePecas, quantidade_posicionada: layout.nesting.quantidadePosicionada,
        area_liquida_m2: layout.areaLiquidaM2, area_sobra_m2: Math.max(0, layout.areaChapaM2 - areaConsumoM2),
        perimetro_total_m: layout.nesting.perimetroTotalMm / 1000,
        area_chapa_utilizada_m2: emBobina ? layout.areaChapaM2 : areaConsumoM2,
        porcentagem_aproveitamento: layout.aproveitamento,
        custo_material_estimado: custosFormato.custo, custo_sobra_estimado: custosFormato.sobra, alerta_custo: custosFormato.alerta,
        posicionamentos: mapearPosicionamentos(layout, pecasMaterialOriginal, margemBordaMm),
      };
    });
    const dimensoes = melhor.dimensoes;
    const emBobina = melhor.comprimentoConsumidoMm != null;
    // Chapa: o bloco ocupado é o consumo. Bobina: cobra-se a faixa inteira (largura do rolo × comprimento).
    const areaConsumoM2 = emBobina ? melhor.areaLiquidaM2 : ((melhor.caixa.larguraMm + 2 * margemBordaMm) * (melhor.caixa.alturaMm + 2 * margemBordaMm)) / 1_000_000;
    const custos = estimarCustos(
      material,
      areaConsumoM2,
      melhor.areaChapaM2,
      melhor.nesting.perimetroTotalMm / 1000,
      emBobina ? melhor.comprimentoConsumidoMm! / 1000 : undefined
    );
    const areaSobraM2 = Math.max(0, melhor.areaChapaM2 - areaConsumoM2);
    return {
      espacamento_pecas_mm: espacamentoMm,
      margem_borda_mm: margemBordaMm,
      formatos_avaliados: formatosAvaliados,
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
      area_chapa_utilizada_m2: emBobina ? melhor.areaChapaM2 : areaConsumoM2,
      porcentagem_aproveitamento: melhor.aproveitamento,
      criterio_escolha: "menor_chapa_que_comporta",
      id_chapa_utilizada: melhor.chapa.id,
      nome_chapa_utilizada: melhor.chapa.nome,
      chapa_principal: !!melhor.chapa.principal,
      chapa: { largura_mm: dimensoes.larguraMm, altura_mm: dimensoes.alturaMm },
      formato: emBobina ? "bobina" : "chapa",
      motor: melhor.nesting.motor ?? "deepnest",
      processo_corte: material.processoCorte ?? null,
      rotacao_permitida: rotacao,
      ...(emBobina ? {
        comprimento_consumido_mm: melhor.comprimentoConsumidoMm,
        largura_bobina_mm: dimensoes.alturaMm,
      } : {}),
      posicionamentos: mapearPosicionamentos(melhor, pecasMaterialOriginal, margemBordaMm),
    };
  }));
  const resultados: CpqNestingMaterialResult[] = [];
  const falhas: CpqNestingFalhaMaterial[] = [];
  liquidados.forEach((item, indice) => {
    if (item.status === "fulfilled") { resultados.push(item.value); return; }
    if (!(item.reason instanceof CpqNestingError)) throw item.reason;
    falhas.push({ id_materia_prima: materiaisUnicos[indice].id, materia_prima: materiaisUnicos[indice].nome, mensagem: item.reason.message, codigo: item.reason.code, erro: item.reason });
  });
  return { resultados, falhas };
}

/** Versão que falha inteira se qualquer material falhar (mantida para quem precisa do tudo-ou-nada). */
export async function calcularNestingMultiMaterial(input: Parameters<typeof calcularNestingMultiMaterialParcial>[0]): Promise<CpqNestingMaterialResult[]> {
  const { resultados, falhas } = await calcularNestingMultiMaterialParcial(input);
  if (falhas.length) throw falhas[0].erro;
  return resultados;
}
