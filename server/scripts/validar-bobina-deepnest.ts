/**
 * Validação do nesting de bobina com o Deepnest REAL (não simulado).
 *
 * Roda em uma máquina com o checkout/compilação do Deepnest e o Node 20 do worker:
 *   DEEPNEST_NODE_BIN="C:/node20/node.exe" DEEPNEST_NODE_ENTRY="C:/deepnest/entry.mjs" \
 *   npx tsx server/scripts/validar-bobina-deepnest.ts
 *
 * Imprime, por cenário, o tempo gasto, o comprimento de rolo consumido e as métricas do resultado,
 * e termina com código 1 se alguma invariante falhar (peça fora do rolo, consumo menor que a área
 * líquida, cobrança diferente de largura × comprimento, tempo acima do limite do worker).
 */
import { calcularNestingMultiMaterial, CpqNestingError, type CpqMaterial, type CpqNestingPeca } from "../services/cpqNesting";

if (!process.env.DEEPNEST_NODE_BIN || !process.env.DEEPNEST_NODE_ENTRY) {
  console.error("DEEPNEST_NODE_BIN e DEEPNEST_NODE_ENTRY não estão configurados: sem o motor real não há o que validar aqui.");
  process.exit(2);
}

const LARGURA_ROLO_MM = 1_200;
const LIMITE_TEMPO_MS = 60_000;

const retangulo = (id: string, w: number, h: number): CpqNestingPeca => ({
  id, larguraMm: w, alturaMm: h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="M 0 0 H ${w} V ${h} H 0 Z"/></svg>`,
});
const elipse = (id: string, w: number, h: number): CpqNestingPeca => {
  const kx = (w / 2) * 0.5523, ky = (h / 2) * 0.5523, cx = w / 2, cy = h / 2;
  return {
    id, larguraMm: w, alturaMm: h,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="M ${cx} 0 C ${cx + kx} 0 ${w} ${cy - ky} ${w} ${cy} C ${w} ${cy + ky} ${cx + kx} ${h} ${cx} ${h} C ${cx - kx} ${h} 0 ${cy + ky} 0 ${cy} C 0 ${cy - ky} ${cx - kx} 0 ${cx} 0 Z"/></svg>`,
  };
};
const ele = (id: string, w: number, h: number, espessura: number): CpqNestingPeca => ({
  id, larguraMm: w, alturaMm: h,
  svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="M 0 0 H ${espessura} V ${h - espessura} H ${w} V ${h} H 0 Z"/></svg>`,
});

function bobina(unidadeCusto: string, larguras: number[] = [LARGURA_ROLO_MM]): CpqMaterial {
  return {
    id: 30, nome: "Adesivo comum (bobina)", custoUnitario: 10, unidadeCusto,
    chapas: larguras.map((largura, i) => ({ id: 300 + i, mubisysMateriaPrimaId: 30, nome: `Bobina ${largura} mm`, larguraMm: 50_000, alturaMm: largura, bobina: true })),
  };
}

type Cenario = { nome: string; pecas: CpqNestingPeca[]; material: CpqMaterial; esperaFalha?: "no_fit" | "engine" };
const cenarios: Cenario[] = [
  { nome: "3 peças pequenas (letreiro curto)", material: bobina("m2"), pecas: [retangulo("a", 400, 300), elipse("b", 350, 350), ele("c", 300, 450, 80)] },
  { nome: "peça comprida (5 m) + peças pequenas", material: bobina("m2"), pecas: [retangulo("faixa", 5_000, 250), elipse("o", 300, 300), ele("l", 300, 400, 70)] },
  { nome: "muitas peças (30 letras)", material: bobina("m2"), pecas: Array.from({ length: 30 }, (_, i) => ele(`l${i}`, 150 + (i % 5) * 20, 220 + (i % 3) * 30, 40)) },
  { nome: "duas larguras de rolo (1200 e 1000)", material: bobina("m2", [1_200, 1_000]), pecas: [retangulo("a", 900, 700), elipse("b", 600, 600)] },
  { nome: "custo em metro linear", material: bobina("ml"), pecas: [retangulo("a", 800, 400), elipse("b", 500, 500)] },
  { nome: "peça mais larga que o rolo (esperado: não cabe)", material: bobina("m2"), pecas: [retangulo("larga", 1_500, 1_400)], esperaFalha: "no_fit" },
];

let falhas = 0;
const checar = (condicao: boolean, mensagem: string) => { if (!condicao) { falhas += 1; console.log(`   ✗ ${mensagem}`); } };

for (const cenario of cenarios) {
  const inicio = Date.now();
  console.log(`\n▶ ${cenario.nome}`);
  try {
    const [r] = await calcularNestingMultiMaterial({ pecas: cenario.pecas, espacamentoMm: 5, materiais: [cenario.material] });
    const ms = Date.now() - inicio;
    if (cenario.esperaFalha) { checar(false, `esperava falha ${cenario.esperaFalha}, mas o nesting devolveu layout`); continue; }
    const comprimento = r.comprimento_consumido_mm ?? 0;
    const largura = r.largura_bobina_mm ?? 0;
    console.log(`   ${ms} ms · rolo ${largura} mm × ${comprimento} mm consumidos · aproveitamento ${r.porcentagem_aproveitamento.toFixed(1)}% · cobrado ${r.area_chapa_utilizada_m2.toFixed(4)} m² · custo ${r.custo_material_estimado?.toFixed(2) ?? "pendente"}`);
    checar(r.formato === "bobina", "formato deveria ser bobina");
    checar(ms <= LIMITE_TEMPO_MS, `demorou ${ms} ms (limite ${LIMITE_TEMPO_MS} ms)`);
    checar(Math.abs(r.area_chapa_utilizada_m2 - (largura * comprimento) / 1e6) < 1e-6, "cobrança diferente de largura × comprimento");
    checar(r.area_chapa_utilizada_m2 + 1e-9 >= r.area_liquida_m2, "cobrado menor que a área líquida das peças");
    checar(r.posicionamentos.length === cenario.pecas.length, `posicionou ${r.posicionamentos.length} de ${cenario.pecas.length} peças`);
    for (const p of r.posicionamentos) {
      checar(p.xMm >= -0.5 && p.xMm + p.larguraMm <= comprimento + 0.5, `peça ${p.origemId} fora do comprimento consumido`);
      checar(p.yMm >= -0.5 && p.yMm + p.alturaMm <= largura + 0.5, `peça ${p.origemId} fora da largura do rolo (${largura} mm)`);
    }
    if (cenario.material.chapas.length > 1) console.log(`   rolo escolhido: ${r.nome_chapa_utilizada}`);
  } catch (error) {
    const codigo = error instanceof CpqNestingError ? error.code : "desconhecido";
    const mensagem = error instanceof Error ? error.message : String(error);
    if (cenario.esperaFalha && codigo === cenario.esperaFalha) console.log(`   ok: falhou como esperado (${codigo}): ${mensagem}`);
    else checar(false, `erro inesperado (${codigo}): ${mensagem}`);
  }
}

console.log(falhas ? `\n${falhas} verificação(ões) falharam.` : "\nTodos os cenários passaram.");
process.exit(falhas ? 1 : 0);
