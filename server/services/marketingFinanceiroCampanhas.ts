import { diasEntre, normalizarTelefone } from "../../shared/campanhas-whatsapp";

const UFS_VALIDAS = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG",
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
]);

export interface EnvioCampanhaParaRanking {
  telefone: string | null;
  dataEnvio: string;
}

export interface VendaCampanhaParaRanking {
  osNumero: string | null;
  telefone: string | null;
  estado: string | null;
  dataCompra: string;
  valor: number;
}

export interface EstadoCampanhaResumo {
  uf: string;
  receitaAtribuida: number;
  totalOs: number;
  clientesConvertidos: number;
}

/** Atribui cada O.S. ao disparo elegível mais recente dentro da janela e conta
 * a venda uma única vez, mesmo que o cliente tenha recebido campanhas distintas. */
export function resumirEstadosCampanhas(
  vendas: VendaCampanhaParaRanking[],
  envios: EnvioCampanhaParaRanking[],
  janelaDias = 30,
) {
  const enviosPorTelefone = new Map<string, string[]>();
  const chavesEnvio = new Set<string>();
  for (const envio of envios) {
    const telefone = normalizarTelefone(envio.telefone);
    if (!telefone || !/^\d{4}-\d{2}-\d{2}$/.test(envio.dataEnvio)) continue;
    const chave = `${telefone}|${envio.dataEnvio}`;
    if (chavesEnvio.has(chave)) continue;
    chavesEnvio.add(chave);
    const datas = enviosPorTelefone.get(telefone) ?? [];
    datas.push(envio.dataEnvio);
    enviosPorTelefone.set(telefone, datas);
  }
  for (const datas of enviosPorTelefone.values()) datas.sort();

  const estados = new Map<string, { receita: number; totalOs: number; clientes: Set<string> }>();
  const ordensVistas = new Set<string>();
  let totalOsAtribuidas = 0;
  let receitaTotalAtribuida = 0;
  let vendasSemEstado = 0;
  let receitaSemEstado = 0;

  for (const venda of vendas) {
    const telefone = normalizarTelefone(venda.telefone);
    if (!telefone) continue;
    const datasEnvio = enviosPorTelefone.get(telefone);
    if (!datasEnvio?.length) continue;

    const dataUltimoEnvioElegivel = datasEnvio.reduce<string | null>((maisRecente, dataEnvio) => {
      const dias = diasEntre(dataEnvio, venda.dataCompra);
      if (dias < 0 || dias > janelaDias) return maisRecente;
      return maisRecente == null || dataEnvio > maisRecente ? dataEnvio : maisRecente;
    }, null);
    if (!dataUltimoEnvioElegivel) continue;

    const osKey = venda.osNumero?.trim();
    if (osKey && ordensVistas.has(osKey)) continue;
    if (osKey) ordensVistas.add(osKey);

    const valor = Number.isFinite(venda.valor) ? venda.valor : 0;
    totalOsAtribuidas++;
    receitaTotalAtribuida += valor;

    const uf = venda.estado?.trim().toUpperCase() ?? "";
    if (!UFS_VALIDAS.has(uf)) {
      vendasSemEstado++;
      receitaSemEstado += valor;
      continue;
    }

    const resumo = estados.get(uf) ?? { receita: 0, totalOs: 0, clientes: new Set<string>() };
    resumo.receita += valor;
    resumo.totalOs++;
    resumo.clientes.add(telefone);
    estados.set(uf, resumo);
  }

  const topEstados: EstadoCampanhaResumo[] = [...estados.entries()]
    .map(([uf, resumo]) => ({
      uf,
      receitaAtribuida: Math.round(resumo.receita * 100) / 100,
      totalOs: resumo.totalOs,
      clientesConvertidos: resumo.clientes.size,
    }))
    .sort((a, b) => b.receitaAtribuida - a.receitaAtribuida || b.totalOs - a.totalOs || a.uf.localeCompare(b.uf))
    .slice(0, 3);

  return {
    janelaDias,
    topEstados,
    totalOsAtribuidas,
    receitaTotalAtribuida: Math.round(receitaTotalAtribuida * 100) / 100,
    vendasSemEstado,
    receitaSemEstado: Math.round(receitaSemEstado * 100) / 100,
  };
}
