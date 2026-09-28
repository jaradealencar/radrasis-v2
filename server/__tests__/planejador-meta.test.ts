import { describe, it, expect } from "vitest";
import {
  mesApos, prazoValido, horizonteDaLinhaDoTempo, interpolarCenario, linhaDoTempo, primeiroMesNaMeta,
  PRAZO_PADRAO_MESES, PRAZO_MAXIMO_MESES, HORIZONTE_MINIMO_MESES,
  confiabilidadeSazonalPorMes, fatoresSazonaisNormalizados, aplicarFatorSazonal, aplicarSazonalidadeNaLinhaDoTempo,
  aplicarRecompraMecanicaNaLinhaDoTempo, aplicarRecompraMecanicaCalibradaNaLinhaDoTempo,
  aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo,
  type CurvaRecompra, type EntradaHistoricaMes,
} from "../../shared/planejador-meta";
import { resolverMeta, totaisCenario, aplicarFator, type Cenario } from "../../shared/meta-faturamento";

// Números no formato do painel real (~R$ 349 mil por mês).
const BASE: Cenario = {
  novos: { clientes: 20.1, pedidosPorCliente: 1.18, ticket: 2677 },
  reativados: { clientes: 18.3, pedidosPorCliente: 1.23, ticket: 2527 },
  recompraConquistados: { clientes: 38.4, pedidosPorCliente: 1.44, ticket: 2108 },
  carteira: { clientes: 32.6, pedidosPorCliente: 1.4, ticket: 2455 },
};
const FAT_BASE = totaisCenario(BASE).faturamento;
const META = 430_000;

describe("mesApos", () => {
  it("conta meses de calendário a partir da data de referência, virando o ano", () => {
    const ref = "2026-09-26T21:11:57.465Z";
    expect(mesApos(ref, 0)).toEqual({ ano: 2026, mes: 9, rotulo: "set/2026" });
    expect(mesApos(ref, 1).rotulo).toBe("out/2026");
    expect(mesApos(ref, 4).rotulo).toBe("jan/2027");
    expect(mesApos(ref, 16).rotulo).toBe("jan/2028");
    expect(mesApos("2026-12-31T23:59:59.000Z", 1).rotulo).toBe("jan/2027");
  });
});

describe("prazo e horizonte", () => {
  it("aceita só inteiros de 1 ao máximo e cai no padrão quando a entrada não é número", () => {
    expect(prazoValido(6)).toBe(6);
    expect(prazoValido(0)).toBe(1);
    expect(prazoValido(-3)).toBe(1);
    expect(prazoValido(7.6)).toBe(8);
    expect(prazoValido(999)).toBe(PRAZO_MAXIMO_MESES);
    expect(prazoValido(Number.NaN)).toBe(PRAZO_PADRAO_MESES);
  });

  it("mostra pelo menos 12 meses e o prazo mais uma folga, sem passar do máximo", () => {
    expect(horizonteDaLinhaDoTempo(3)).toBe(HORIZONTE_MINIMO_MESES);
    expect(horizonteDaLinhaDoTempo(12)).toBe(15);
    expect(horizonteDaLinhaDoTempo(24)).toBe(PRAZO_MAXIMO_MESES);
  });
});

describe("interpolarCenario", () => {
  const REGIME = aplicarFator(BASE, {}, 1.2);

  it("0 é o cenário de hoje, 1 é o cenário final e o meio fica a meio caminho, indicador por indicador", () => {
    expect(interpolarCenario(BASE, REGIME, 0)).toEqual(BASE);
    expect(interpolarCenario(BASE, REGIME, 1)).toEqual(REGIME);
    const meio = interpolarCenario(BASE, REGIME, 0.5);
    expect(meio.novos.clientes).toBeCloseTo((BASE.novos.clientes + REGIME.novos.clientes) / 2, 9);
    expect(meio.carteira.ticket).toBeCloseTo((BASE.carteira.ticket + REGIME.carteira.ticket) / 2, 9);
  });

  it("não passa dos extremos", () => {
    expect(interpolarCenario(BASE, REGIME, -1)).toEqual(BASE);
    expect(interpolarCenario(BASE, REGIME, 3)).toEqual(REGIME);
  });
});

describe("linhaDoTempo", () => {
  const REGIME = resolverMeta(BASE, {}, META).cenario;

  it("começa nos números de hoje, chega no cenário no prazo e depois fica estável", () => {
    const pontos = linhaDoTempo(BASE, REGIME, 6);
    expect(pontos).toHaveLength(horizonteDaLinhaDoTempo(6) + 1);
    expect(pontos[0].mes).toBe(0);
    expect(pontos[0].totais.faturamento).toBeCloseTo(FAT_BASE, 6);
    expect(pontos[6].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[7].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[pontos.length - 1].totais.faturamento).toBeCloseTo(META, 3);
    expect(pontos[6].progresso).toBe(1);
    expect(pontos[3].progresso).toBeCloseTo(0.5, 9);
  });

  it("quando todos os indicadores sobem, o faturamento só cresce até o prazo", () => {
    const fat = linhaDoTempo(BASE, REGIME, 9).map(p => p.totais.faturamento);
    for (let k = 1; k <= 9; k++) expect(fat[k]).toBeGreaterThan(fat[k - 1]);
  });

  it("prazo curto sobe mais rápido: no mesmo mês o faturamento é maior", () => {
    const curto = linhaDoTempo(BASE, REGIME, 3)[2].totais.faturamento;
    const longo = linhaDoTempo(BASE, REGIME, 12)[2].totais.faturamento;
    expect(curto).toBeGreaterThan(longo);
  });
});

describe("primeiroMesNaMeta", () => {
  const REGIME = resolverMeta(BASE, {}, META).cenario;

  it("no modo automático (cenário que fecha a meta na conta) a meta é alcançada exatamente no prazo", () => {
    for (const prazo of [1, 3, 6, 12, 18]) {
      expect(primeiroMesNaMeta(linhaDoTempo(BASE, REGIME, prazo), META)).toBe(prazo);
    }
  });

  it("um cenário que passa da meta cruza antes do fim do caminho", () => {
    const acima = resolverMeta(BASE, {}, 500_000).cenario;
    const mes = primeiroMesNaMeta(linhaDoTempo(BASE, acima, 12), META);
    expect(mes).not.toBeNull();
    expect(mes!).toBeGreaterThan(0);
    expect(mes!).toBeLessThan(12);
    const pontos = linhaDoTempo(BASE, acima, 12);
    expect(pontos[mes!].totais.faturamento).toBeGreaterThanOrEqual(META * 0.9995);
    expect(pontos[mes! - 1].totais.faturamento).toBeLessThan(META * 0.9995);
  });

  it("devolve 0 quando hoje já está na meta e null quando o cenário nunca chega lá", () => {
    expect(primeiroMesNaMeta(linhaDoTempo(BASE, BASE, 6), FAT_BASE * 0.9)).toBe(0);
    const abaixo = aplicarFator(BASE, {}, 1.05);
    expect(primeiroMesNaMeta(linhaDoTempo(BASE, abaixo, 6), META)).toBeNull();
  });
});

describe("confiabilidadeSazonalPorMes", () => {
  it("dezembro real (0,83 / 0,68 / 0,81): 3 anos concordando, ajusta com encolhimento", () => {
    const dez = confiabilidadeSazonalPorMes({ 12: [0.83, 0.68, 0.81] })[11];
    expect(dez.mes).toBe(12);
    expect(dez.observacoes).toBe(3);
    expect(dez.mediaRazao).toBeCloseTo(0.773, 2);
    expect(dez.mesmoSinalPct).toBe(1);
    expect(dez.confiavel).toBe(true);
    // encolhimento K=2: peso = 3/5 = 0,6 → fator = 1 + 0,6*(0,773-1) ≈ 0,864 (não o valor cru)
    expect(dez.fatorAjustado).toBeGreaterThan(dez.mediaRazao);
    expect(dez.fatorAjustado).toBeCloseTo(1 + 0.6 * (dez.mediaRazao - 1), 6);
  });

  it("novembro real (1,13 / 1,36 / 1,18): mesma lógica, só que pra cima", () => {
    const nov = confiabilidadeSazonalPorMes({ 11: [1.13, 1.36, 1.18] })[10];
    expect(nov.mes).toBe(11);
    expect(nov.confiavel).toBe(true);
    expect(nov.fatorAjustado).toBeGreaterThan(1);
    expect(nov.fatorAjustado).toBeLessThan(nov.mediaRazao);
  });

  it("janeiro real (0,93 / 1,01 / 0,55): 3 anos, mas discordam de lado — NÃO confiável", () => {
    const jan = confiabilidadeSazonalPorMes({ 1: [0.93, 1.01, 0.55] })[0];
    expect(jan.mes).toBe(1);
    expect(jan.observacoes).toBe(3);
    expect(jan.mesmoSinalPct).toBeLessThan(1);
    expect(jan.confiavel).toBe(false);
    expect(jan.fatorAjustado).toBe(1);
  });

  it("só 2 anos (mínimo é 3), mesmo concordando 100%: não confiável ainda", () => {
    const mai = confiabilidadeSazonalPorMes({ 5: [1.1, 1.04] })[4];
    expect(mai.mes).toBe(5);
    expect(mai.observacoes).toBe(2);
    expect(mai.mesmoSinalPct).toBe(1);
    expect(mai.confiavel).toBe(false);
  });

  it("3 anos concordando mas espalhados demais (CV alto): não confiável", () => {
    const x = confiabilidadeSazonalPorMes({ 3: [1.05, 1.4, 1.9] })[2]; // concordam (todos > 1) mas CV bem acima de 0,15
    expect(x.mesmoSinalPct).toBe(1);
    expect(x.confiavel).toBe(false);
  });

  it("mês sem observação nenhuma: neutro (fator 1), não confiável", () => {
    const x = confiabilidadeSazonalPorMes({})[6]; // julho, arbitrário — nenhum mês tem dado
    expect(x.observacoes).toBe(0);
    expect(x.confiavel).toBe(false);
    expect(x.fatorAjustado).toBe(1);
  });

  it("devolve os 12 meses, na ordem, mesmo só passando alguns", () => {
    const todos = confiabilidadeSazonalPorMes({ 12: [0.8, 0.8, 0.8] });
    expect(todos).toHaveLength(12);
    expect(todos.map(c => c.mes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("fatoresSazonaisNormalizados", () => {
  it("meses não confiáveis ficam em 1; a média dos 12 sempre fecha em 1 (não muda a meta anual)", () => {
    const conf = confiabilidadeSazonalPorMes({ 11: [1.13, 1.36, 1.18], 12: [0.83, 0.68, 0.81], 1: [0.93, 1.01, 0.55] });
    const fatores = fatoresSazonaisNormalizados(conf);
    expect(fatores).toHaveLength(12);
    expect(fatores[0]).toBeCloseTo(1, 3); // janeiro (índice 0): não confiável → sem ajuste
    expect(fatores[10]).toBeGreaterThan(1); // novembro (índice 10)
    expect(fatores[11]).toBeLessThan(1); // dezembro (índice 11)
    expect(fatores.reduce((a, b) => a + b, 0) / 12).toBeCloseTo(1, 6);
  });

  it("sem nenhum mês confiável, os 12 fatores são 1", () => {
    const fatores = fatoresSazonaisNormalizados(confiabilidadeSazonalPorMes({}));
    expect(fatores).toEqual(Array(12).fill(1));
  });
});

describe("aplicarFatorSazonal", () => {
  it("mexe só na quantidade de gráficas (pedidos/gráfica e ticket ficam iguais) e escala o faturamento na mesma proporção", () => {
    const ajustado = aplicarFatorSazonal(BASE, 0.8);
    for (const s of Object.keys(BASE) as Array<keyof typeof BASE>) {
      expect(ajustado[s].clientes).toBeCloseTo(BASE[s].clientes * 0.8, 9);
      expect(ajustado[s].pedidosPorCliente).toBe(BASE[s].pedidosPorCliente);
      expect(ajustado[s].ticket).toBe(BASE[s].ticket);
    }
    expect(totaisCenario(ajustado).faturamento).toBeCloseTo(FAT_BASE * 0.8, 3);
  });
});

describe("aplicarSazonalidadeNaLinhaDoTempo", () => {
  const REF = "2026-09-26T21:11:57.465Z"; // hoje = set/2026 (mes=0); nov=2, dez=3 meses à frente
  const fatores = Array(12).fill(1);
  fatores[10] = 1.2; // novembro (índice 10)
  fatores[11] = 0.8; // dezembro (índice 11)

  it("aplica o fator do mês de calendário de cada ponto (novembro sobe, dezembro desce) e mantém os outros", () => {
    const pontos = linhaDoTempo(BASE, BASE, 1, 5); // cenário plano — isola o efeito da sazonalidade
    const ajustados = aplicarSazonalidadeNaLinhaDoTempo(pontos, REF, fatores);
    expect(mesApos(REF, 2).rotulo).toBe("nov/2026");
    expect(mesApos(REF, 3).rotulo).toBe("dez/2026");
    expect(ajustados[2].totais.faturamento).toBeCloseTo(FAT_BASE * 1.2, 3);
    expect(ajustados[3].totais.faturamento).toBeCloseTo(FAT_BASE * 0.8, 3);
    expect(ajustados[0].totais.faturamento).toBeCloseTo(FAT_BASE, 3); // set/2026: fator 1
    expect(ajustados[1].totais.faturamento).toBeCloseTo(FAT_BASE, 3); // out/2026: fator 1
  });

  it("não muda o número de pontos nem o campo `mes`/`progresso`", () => {
    const pontos = linhaDoTempo(BASE, BASE, 1, 5);
    const ajustados = aplicarSazonalidadeNaLinhaDoTempo(pontos, REF, fatores);
    expect(ajustados.map(p => p.mes)).toEqual(pontos.map(p => p.mes));
    expect(ajustados.map(p => p.progresso)).toEqual(pontos.map(p => p.progresso));
  });
});

describe("aplicarRecompraMecanicaNaLinhaDoTempo", () => {
  // Curvas simples e artificiais (não as reais) para poder conferir a conta na mão: novos só voltam
  // (100%) no k=2; reativados só voltam (100%) no k=1. Os outros k ficam sem dado (null) de propósito,
  // pra testar que "sem taxa" não conta nada (nem quebra a conta).
  const curvaNovos: CurvaRecompra = [{ k: 2, ativosPct: 100 }];
  const curvaReativados: CurvaRecompra = [{ k: 1, ativosPct: 100 }];
  // 11 meses de histórico (índices 0..10 = plano -11..-1); só o mês -1 (índice 10) e o -2 (índice 9) têm
  // entrada, os demais são 0 — assim dá pra isolar o efeito de cada um.
  const historico11: EntradaHistoricaMes[] = Array.from({ length: 11 }, () => ({ novos: 0, reativados: 0 }));
  historico11[10] = { novos: 5, reativados: 7 }; // plano -1
  historico11[9] = { novos: 11, reativados: 13 }; // plano -2

  it("hoje (mês 0): usa só o histórico (nada do plano ainda) e aplica a taxa do k certo", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 3); // cenário plano — isola o efeito da mecânica
    const ajustados = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    // mês 0: k=1 → histórico -1 (reativados=7, taxa 100%) = 7; k=2 → histórico -2 (novos=11, taxa 100%) = 11
    expect(ajustados[0].cenario.recompraConquistados.clientes).toBeCloseTo(7 + 11, 9);
  });

  it("mistura histórico (meses antes de hoje) com o ritmo do próprio plano (meses depois de hoje)", () => {
    const regime: Cenario = { ...BASE, novos: { ...BASE.novos, clientes: 100 }, reativados: { ...BASE.reativados, clientes: 200 } };
    const pontos = linhaDoTempo(BASE, regime, 1, 3); // no mês 1 em diante, novos=100 e reativados=200 (cenário final)
    const ajustados = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    // mês 1: k=1 → mês 0 (histórico, "hoje" = base, não o regime) → reativados=BASE.reativados.clientes
    //        k=2 → histórico -1 (novos=5, taxa 100%) = 5
    expect(ajustados[1].cenario.recompraConquistados.clientes).toBeCloseTo(BASE.reativados.clientes + 5, 6);
    // mês 3: k=1 → mês 2 (já no regime: reativados=200) = 200; k=2 → mês 1 (já no regime: novos=100) = 100
    expect(ajustados[3].cenario.recompraConquistados.clientes).toBeCloseTo(200 + 100, 6);
  });

  it("k sem taxa (null) não contribui em nada — não é tratado como 0% nem quebra", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 1);
    const semCurvas = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, [], []);
    expect(semCurvas.every(p => p.cenario.recompraConquistados.clientes === 0)).toBe(true);
  });

  it("recalcula o faturamento total do ponto (não só o campo recompraConquistados)", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 0);
    const ajustados = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    expect(ajustados[0].totais.faturamento).toBeCloseTo(totaisCenario(ajustados[0].cenario).faturamento, 6);
    expect(ajustados[0].totais.faturamento).not.toBeCloseTo(FAT_BASE, 0); // mudou (a recompra não é mais a da BASE)
  });

  it("mantém pedidosPorCliente e ticket da recompra intactos — só a contagem de clientes muda", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 0);
    const ajustados = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    expect(ajustados[0].cenario.recompraConquistados.pedidosPorCliente).toBe(BASE.recompraConquistados.pedidosPorCliente);
    expect(ajustados[0].cenario.recompraConquistados.ticket).toBe(BASE.recompraConquistados.ticket);
  });
});

describe("aplicarRecompraMecanicaCalibradaNaLinhaDoTempo", () => {
  const curvaNovos: CurvaRecompra = [{ k: 2, ativosPct: 100 }];
  const curvaReativados: CurvaRecompra = [{ k: 1, ativosPct: 100 }];
  const historico11: EntradaHistoricaMes[] = Array.from({ length: 11 }, () => ({ novos: 0, reativados: 0 }));
  historico11[10] = { novos: 5, reativados: 7 };
  historico11[9] = { novos: 11, reativados: 13 };
  // bruto do mês 0 (mesma conta do describe anterior): k=1 → reativados do histórico -1 (7) + k=2 → novos do histórico -2 (11) = 18.
  const BRUTO_MES_0 = 18;

  it("o mês 0 (hoje) sempre bate exatamente com o valor real — é a própria calibração", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 3);
    const calibrada = aplicarRecompraMecanicaCalibradaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    expect(calibrada[0].cenario.recompraConquistados.clientes).toBeCloseTo(BASE.recompraConquistados.clientes, 9);
  });

  it("os outros meses seguem a MESMA proporção da versão crua, só escalados pelo fator de calibração", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 3);
    const crua = aplicarRecompraMecanicaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    const calibrada = aplicarRecompraMecanicaCalibradaNaLinhaDoTempo(pontos, historico11, curvaNovos, curvaReativados);
    const fatorEsperado = BASE.recompraConquistados.clientes / BRUTO_MES_0;
    for (let i = 0; i <= 3; i++) {
      expect(calibrada[i].cenario.recompraConquistados.clientes).toBeCloseTo(crua[i].cenario.recompraConquistados.clientes * fatorEsperado, 6);
    }
  });

  it("sem previsão nenhuma no mês 0 (bruto = 0), devolve os pontos sem mudar nada", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 2);
    const semDado = aplicarRecompraMecanicaCalibradaNaLinhaDoTempo(pontos, historico11, [], []); // curvas vazias → bruto sempre 0
    expect(semDado).toBe(pontos); // mesma referência: devolveu sem tocar
  });
});

describe("aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo", () => {
  const CONTINUIDADE = { taxaMensalPct: 50, amostras: 20, coeficienteVariacao: 0.1 };
  // Histórico "de regime": todo mês com a MESMA entrada da própria BASE — assim o pool calibrado fica
  // exatamente estável enquanto nada muda (o teste mais simples de conferir na mão).
  const ENTRADA_BASE = BASE.novos.clientes + BASE.reativados.clientes;
  const historicoRegime: EntradaHistoricaMes[] = Array.from({ length: 11 }, () => ({ novos: BASE.novos.clientes, reativados: BASE.reativados.clientes }));

  it("em regime (entradas sempre iguais às de hoje), o pool fica EXATAMENTE parado no valor real — a calibração fecha a conta", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 15); // cenário nunca muda
    const ajustados = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoRegime, CONTINUIDADE);
    for (const p of ajustados) expect(p.cenario.carteira.clientes).toBeCloseTo(BASE.carteira.clientes, 9);
  });

  it("o mês 0 (hoje) é sempre a âncora exata, mesmo com um cenário que já vai mudar depois", () => {
    const regime: Cenario = { ...BASE, novos: { ...BASE.novos, clientes: BASE.novos.clientes * 2 }, reativados: { ...BASE.reativados, clientes: BASE.reativados.clientes * 2 } };
    const pontos = linhaDoTempo(BASE, regime, 1, 24);
    const ajustados = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoRegime, CONTINUIDADE);
    expect(ajustados[0].cenario.carteira.clientes).toBeCloseTo(BASE.carteira.clientes, 9);
  });

  it("reage com atraso de 12 meses a uma mudança de ritmo, e converge pra um novo patamar proporcional", () => {
    const regime: Cenario = { ...BASE, novos: { ...BASE.novos, clientes: BASE.novos.clientes * 2 }, reativados: { ...BASE.reativados, clientes: BASE.reativados.clientes * 2 } };
    const pontos = linhaDoTempo(BASE, regime, 1, 24); // a partir do mês 1, entradas em dobro (prazo=1)
    const ajustados = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoRegime, CONTINUIDADE);
    const sobrev = CONTINUIDADE.taxaMensalPct / 100;

    // meses 1 a 12: o "olhar 12 meses atrás" ainda só enxerga o histórico antigo (ou o mês 0, que é a
    // própria base) — pool continua parado no valor real.
    for (let k = 1; k <= 12; k++) expect(ajustados[k].cenario.carteira.clientes).toBeCloseTo(BASE.carteira.clientes, 6);

    // mês 13: a 1ª entrada "em dobro" (a do mês 1) completa 12 meses e entra no pool.
    const esperadoMes13 = BASE.carteira.clientes * (2 - sobrev); // poolAnterior*sobrev + 2×ganho_normal
    expect(ajustados[13].cenario.carteira.clientes).toBeCloseTo(esperadoMes13, 6);

    // depois de muitos meses no novo ritmo (em dobro), o pool converge pra ~2× o valor real de hoje.
    expect(ajustados[24].cenario.carteira.clientes).toBeGreaterThan(BASE.carteira.clientes * 1.99);
    expect(ajustados[24].cenario.carteira.clientes).toBeLessThanOrEqual(BASE.carteira.clientes * 2 + 1e-6);
    // e cresce de forma monótona nesse trecho (sem oscilar)
    for (let k = 13; k < 24; k++) expect(ajustados[k + 1].cenario.carteira.clientes).toBeGreaterThan(ajustados[k].cenario.carteira.clientes);
  });

  it("sem taxa de continuidade medida (null), devolve os pontos sem mudar nada", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 2);
    const semTaxa = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoRegime, { taxaMensalPct: null, amostras: 0, coeficienteVariacao: null });
    expect(semTaxa).toBe(pontos);
  });

  it("sem entrada de regime pra calibrar (histórico vazio ou zerado), devolve os pontos sem mudar nada", () => {
    const pontos = linhaDoTempo(BASE, BASE, 6, 2);
    const semHistorico = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, [], CONTINUIDADE);
    expect(semHistorico).toBe(pontos);
    const historicoZerado = Array.from({ length: 11 }, () => ({ novos: 0, reativados: 0 }));
    expect(aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoZerado, CONTINUIDADE)).toBe(pontos);
  });

  it("mantém pedidosPorCliente e ticket da carteira intactos — só a contagem de clientes muda", () => {
    const regime: Cenario = { ...BASE, novos: { ...BASE.novos, clientes: BASE.novos.clientes * 2 } };
    const pontos = linhaDoTempo(BASE, regime, 1, 13);
    const ajustados = aplicarCarteiraMecanicaCalibradaNaLinhaDoTempo(pontos, historicoRegime, CONTINUIDADE);
    expect(ajustados[13].cenario.carteira.pedidosPorCliente).toBe(BASE.carteira.pedidosPorCliente);
    expect(ajustados[13].cenario.carteira.ticket).toBe(BASE.carteira.ticket);
    expect(ajustados[13].totais.faturamento).toBeCloseTo(totaisCenario(ajustados[13].cenario).faturamento, 6);
  });
});
