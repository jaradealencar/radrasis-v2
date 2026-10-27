import { z } from "zod";
import {
  somarMetricasNestingArte,
  type MetricasNestingArte,
  type ResultadoNestingArte,
} from "../../shared/arte-nesting";
import { calcularNestingMultiMaterial, CpqNestingError } from "./cpqNesting";
import { contornosFisicosDoSvg } from "./cpqFactibilidadeFabricacao";

const dimensao = z.number().finite().positive().max(50_000);
export const prepararNestingArteInput = z
  .object({
    svg: z.string().min(20).max(1_500_000),
    larguraMm: dimensao,
    alturaMm: dimensao,
  })
  .strict();

export const calcularNestingArteInput = z
  .object({
    grupoId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
    nome: z.string().trim().min(1).max(100),
    larguraChapaMm: z.number().int().min(10).max(50_000),
    alturaChapaMm: z.number().int().min(10).max(50_000),
    espacamentoMm: z.number().finite().min(0).max(50),
    margemBordaMm: z.number().finite().min(0).max(50),
    rotacao: z.enum(["livre", "veio"]).default("livre"),
    pecas: z
      .array(
        z
          .object({
            id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
            svg: z.string().min(20).max(1_500_000),
            larguraMm: dimensao,
            alturaMm: dimensao,
            cor: z.string().regex(/^#[a-f0-9]{6}$/i),
          })
          .strict()
      )
      .min(1)
      .max(100),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (new Set(input.pecas.map(peca => peca.id)).size !== input.pecas.length)
      ctx.addIssue({
        code: "custom",
        message: "Cada peça precisa ter um identificador único.",
      });
    if (input.pecas.reduce((sum, peca) => sum + peca.svg.length, 0) > 1_500_000)
      ctx.addIssue({
        code: "custom",
        message: "As peças deste nesting excedem 1,5 MB. Simplifique o vetor.",
      });
    if (
      Math.min(input.larguraChapaMm, input.alturaChapaMm) <=
      input.margemBordaMm * 2
    )
      ctx.addIssue({
        code: "custom",
        message: "A margem precisa deixar uma área útil dentro da chapa.",
      });
  });

const xml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    char =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[char]!
  );
const numero = (value: number) => Number(value.toFixed(6)).toString();

/** Usa o mesmo motor do CPQ, com formato explícito e sem catálogo, preço ou gravação de dados. */
export async function calcularNestingArte(
  input: z.infer<typeof calcularNestingArteInput>
): Promise<ResultadoNestingArte> {
  const geometrias = new Map(
    input.pecas.map(peca => {
      const polygons = contornosFisicosDoSvg(
        peca.svg,
        peca.larguraMm,
        peca.alturaMm
      );
      let areaMm2 = 0;
      let perimetroMm = 0;
      for (const polygon of polygons)
        polygon.forEach((ring, index) => {
          let dobroArea = 0;
          for (let i = 0; i < ring.length - 1; i++) {
            dobroArea +=
              ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
            perimetroMm += Math.hypot(
              ring[i + 1][0] - ring[i][0],
              ring[i + 1][1] - ring[i][1]
            );
          }
          areaMm2 += ((index === 0 ? 1 : -1) * Math.abs(dobroArea)) / 2;
        });
      return [peca.id, { peca, polygons, areaMm2, perimetroMm }] as const;
    })
  );
  const [resultado] = await calcularNestingMultiMaterial({
    pecas: input.pecas,
    espacamentoMm: input.espacamentoMm,
    margemBordaMm: input.margemBordaMm,
    materiais: [
      {
        id: 1,
        nome: input.nome,
        // Ausência de custo permanece inválida no motor; a API abaixo só devolve geometria.
        custoUnitario: Number.NaN,
        unidadeCusto: "",
        rotacao: input.rotacao,
        chapas: [
          {
            id: 1,
            mubisysMateriaPrimaId: 1,
            nome: "Formato escolhido",
            larguraMm: input.larguraChapaMm,
            alturaMm: input.alturaChapaMm,
          },
        ],
      },
    ],
  });
  const quantidadeChapas = resultado.quantidade_chapas ?? 1;
  const larguraMm = resultado.chapa.largura_mm;
  const alturaMm = resultado.chapa.altura_mm;
  const vistos = new Set<string>();
  const chapas = Array.from({ length: quantidadeChapas }, (_, indice) => {
    let maxX = 0;
    let maxY = 0;
    const metricas: MetricasNestingArte = {
      quantidadeChapas: 1,
      quantidadePecas: 0,
      areaChapaM2: (larguraMm * alturaMm) / 1e6,
      areaUtilizadaM2: 0,
      areaLiquidaM2: 0,
      perimetroM: 0,
    };
    const caminhos = resultado.posicionamentos
      .filter(pos => (pos.chapaIndice ?? 0) === indice)
      .map(pos => {
        const item = pos.origemId ? geometrias.get(pos.origemId) : undefined;
        if (!item || vistos.has(item.peca.id))
          throw new CpqNestingError(
            "O motor devolveu peças ausentes ou repetidas.",
            "engine"
          );
        vistos.add(item.peca.id);
        const rad = (pos.rotacaoGraus * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const girados = item.polygons
          .flat()
          .map(ring =>
            ring.map(
              ([x, y]) => [x * cos - y * sin, x * sin + y * cos] as const
            )
          );
        let minX = Infinity;
        let minY = Infinity;
        for (const ring of girados)
          for (const [x, y] of ring) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
          }
        const contornos = girados.map(ring =>
          ring.map(
            ([x, y]) => [x - minX + pos.xMm, y - minY + pos.yMm] as const
          )
        );
        for (const [x, y] of contornos.flat()) {
          const margem = input.margemBordaMm;
          if (
            !Number.isFinite(x + y) ||
            x < margem - 0.05 ||
            y < margem - 0.05 ||
            x > larguraMm - margem + 0.05 ||
            y > alturaMm - margem + 0.05
          )
            throw new CpqNestingError(
              "Uma peça ficou fora da área útil da chapa. Recalcule o nesting.",
              "engine"
            );
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
        metricas.quantidadePecas++;
        metricas.areaLiquidaM2 += item.areaMm2 / 1e6;
        metricas.perimetroM += item.perimetroMm / 1000;
        const d = contornos
          .map(
            ring =>
              `M ${ring
                .slice(0, -1)
                .map(([x, y]) => `${numero(x)} ${numero(y)}`)
                .join(" L ")} Z`
          )
          .join(" ");
        return `<path id="${xml(item.peca.id)}" d="${d}" fill="${item.peca.cor}" fill-rule="evenodd"/>`;
      });
    if (!metricas.quantidadePecas)
      throw new CpqNestingError("O motor devolveu uma chapa vazia.", "engine");
    metricas.areaUtilizadaM2 =
      (Math.min(larguraMm, maxX + input.margemBordaMm) *
        Math.min(alturaMm, maxY + input.margemBordaMm)) /
      1e6;
    const titulo = `${input.nome} — chapa ${indice + 1}`;
    // Só peças de corte no download: a dimensão da chapa está no viewBox, sem um retângulo extra para cortar.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${larguraMm}mm" height="${alturaMm}mm" viewBox="0 0 ${larguraMm} ${alturaMm}"><title>${xml(titulo)}</title><desc>Chapa ${numero(metricas.areaChapaM2)} m2; bloco ocupado ${numero(metricas.areaUtilizadaM2)} m2; área líquida ${numero(metricas.areaLiquidaM2)} m2; perímetro ${numero(metricas.perimetroM)} m.</desc><g id="pecas">${caminhos.join("")}</g></svg>`;
    return { indice, larguraMm, alturaMm, svg, metricas };
  });
  if (
    vistos.size !== input.pecas.length ||
    resultado.posicionamentos.length !== input.pecas.length
  )
    throw new CpqNestingError(
      "O motor não posicionou todas as peças deste nesting.",
      "engine"
    );
  return {
    grupoId: input.grupoId,
    nome: input.nome,
    motor: resultado.motor ?? "interno",
    espacamentoMm: input.espacamentoMm,
    margemBordaMm: input.margemBordaMm,
    chapas,
    total: somarMetricasNestingArte(chapas.map(chapa => chapa.metricas)),
  };
}
