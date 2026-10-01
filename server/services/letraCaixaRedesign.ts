import { readFileSync } from "node:fs";
import { join } from "node:path";
import { generateImageEdit } from "../_core/llm";
import { storagePut } from "../db/storage";

const PROMPT_1_PATH = join(process.cwd(), "docs/prompts/prompt-1-reconstrucao-visual.md");

/** Lido a cada chamada (não em import) para permitir editar o .md sem rebuild. */
function carregarPrompt1(): string {
  return readFileSync(PROMPT_1_PATH, "utf-8");
}

export type EscopoRedesenho = "somente_logo" | "letreiro_completo" | "elementos_selecionados";

export type RedesenharLetreiroParams = {
  imageBuffer: Buffer;
  imageFilename: string;
  imageMimeType: string;
  escopo: EscopoRedesenho;
  /** Obrigatório quando escopo === "elementos_selecionados". */
  elementosSelecionados?: string;
};

export type RedesenharLetreiroResult = {
  imageBuffer: Buffer;
  mimeType: string;
  /** Já armazenado no UploadThing — pronto para exibir na tela de aprovação. */
  url: string;
};

function instrucaoEscopo(params: RedesenharLetreiroParams): string {
  if (params.escopo === "somente_logo") {
    return 'Escopo indicado pelo operador: "logo" — assuma SOMENTE LOGO (seção 4 do prompt).';
  }
  if (params.escopo === "letreiro_completo") {
    return 'Escopo indicado pelo operador: "letreiro" — assuma LETREIRO COMPLETO (seção 4 do prompt).';
  }
  if (!params.elementosSelecionados?.trim()) {
    throw new Error(
      'escopo "elementos_selecionados" exige o campo elementosSelecionados preenchido',
    );
  }
  return `Escopo indicado pelo operador: ELEMENTOS SELECIONADOS — reconstrua apenas: ${params.elementosSelecionados.trim()}.`;
}

/**
 * Redesenho fiel (Prompt 1): transforma uma foto de letreiro/logo na reconstrução
 * visual limpa — face gráfica plana, cores chapadas, sem estrutura física (aros,
 * perfis) nem efeitos de luz (halo, reflexo, sombra) — via edição de imagem da
 * OpenAI (gpt-image-2.5-sunburst), usando docs/prompts/prompt-1-reconstrucao-visual.md como
 * instrução completa.
 *
 * A rota autenticada `POST /api/letra-caixa/redesenho` expõe esta função ao
 * protótipo servido pelo próprio app; a chave da OpenAI permanece no servidor.
 * A chamada ainda precisa ser validada com uma foto real quando a conta tiver
 * crédito disponível.
 */
export async function redesenharLetreiro(
  params: RedesenharLetreiroParams,
): Promise<RedesenharLetreiroResult> {
  const prompt = [
    carregarPrompt1(),
    "",
    "---",
    "",
    instrucaoEscopo(params),
    "A imagem anexada é a IMAGEM-ALVO desta execução (não o exemplo da seção 21).",
  ].join("\n");

  // Fundo transparente só faz sentido para "somente logo" (Prompt 1 §19); um
  // letreiro completo preserva o fundo gráfico do painel quando aplicável.
  const background = params.escopo === "somente_logo" ? "transparent" : "opaque";

  const { buffer, mimeType } = await generateImageEdit({
    imageBuffer: params.imageBuffer,
    imageFilename: params.imageFilename,
    imageMimeType: params.imageMimeType,
    prompt,
    background,
    inputFidelity: "high",
    model: "gpt-image-2.5-sunburst",
    quality: "xhigh",
    size: "auto",
  });

  const { url } = await storagePut(
    `letra-caixa/redesenho-${Date.now()}.png`,
    buffer,
    mimeType,
  );

  return { imageBuffer: buffer, mimeType, url };
}
