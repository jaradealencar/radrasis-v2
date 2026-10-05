import { formatoPerfilUsaAltura, formatoPerfilUsaEspessura, kgPorMetroPerfil, pesoChapaKg, type FormatoPerfil } from "../../shared/peso";

/** Dados técnicos de uma matéria-prima (materia_prima_cadastros + categoria). */
export type DadosPesoMateria = {
  tipo: "chapa" | "perfil" | "bobina" | "outro";
  espessuraMm: number | null;
  densidadeGCm3: number | null;
  /** Ausente = tubo retangular oco (comportamento anterior). */
  perfilFormato?: FormatoPerfil;
  perfilAlturaMm: number | null;
  perfilLarguraMm: number | null;
  perfilComprimentoMm: number | null;
  pesoEspecificoKg: number | null;
};

export type LinhaPesoInput = {
  nome: string;
  quantidade: number;
  unidade: string;
  formulaType: string;
  /** Área líquida (m²) já multiplicada pelo fator da linha, quando o nesting informou. */
  areaLiquidaM2: number | null;
};

export type ResultadoPesoLinha = { kg: number | null; como: string; motivo: string };

const semAcento = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const fmt = (valor: number, casas: number) => Number(valor.toFixed(casas)).toLocaleString("pt-BR");

const pendente = (motivo: string): ResultadoPesoLinha => ({ kg: null, como: "", motivo });

/** Peso estimado de uma linha do kit. Sem dado suficiente, devolve motivo em vez de assumir zero. */
export function calcularPesoLinha(linha: LinhaPesoInput, dados: DadosPesoMateria | null): ResultadoPesoLinha {
  if (!dados) return pendente("Sem dados de peso cadastrados (categoria, densidade ou peso específico).");
  const quantidade = Math.max(0, linha.quantidade);

  if (dados.tipo === "chapa") {
    if (!(dados.espessuraMm && dados.espessuraMm > 0) || !(dados.densidadeGCm3 && dados.densidadeGCm3 > 0))
      return pendente("Chapa sem espessura ou densidade cadastrada.");
    if (linha.formulaType !== "area" && linha.formulaType !== "areaTotal")
      return pendente("A fórmula desta linha não é em área (m²).");
    const usaAreaLiquida = linha.formulaType === "areaTotal" && linha.areaLiquidaM2 != null;
    const areaM2 = usaAreaLiquida ? Math.max(0, linha.areaLiquidaM2 as number) : quantidade;
    const nota = linha.formulaType === "areaTotal" && !usaAreaLiquida ? " (área total, pode incluir sobra)" : "";
    return {
      kg: pesoChapaKg(areaM2, dados.espessuraMm, dados.densidadeGCm3),
      como: `${fmt(areaM2, 3)} m² × ${fmt(dados.espessuraMm, 3)} mm × ${fmt(dados.densidadeGCm3, 4)} g/cm³${nota}`,
      motivo: "",
    };
  }

  if (dados.tipo === "perfil") {
    const { perfilAlturaMm: h, perfilLarguraMm: w, espessuraMm: e, densidadeGCm3: d, perfilComprimentoMm: c } = dados;
    const formato = dados.perfilFormato ?? "tubo";
    const precisaEspessura = formatoPerfilUsaEspessura(formato);
    const precisaAltura = formatoPerfilUsaAltura(formato);
    if (!((h || !precisaAltura) && w && d && (e || !precisaEspessura)))
      return pendente(`Perfil sem ${[precisaAltura ? "altura" : "diâmetro (largura)", precisaAltura ? "largura" : null, precisaEspessura ? "espessura" : null, "densidade"].filter(Boolean).join(", ")} cadastrada.`);
    const kgPorM = kgPorMetroPerfil(h, w, e, d, formato);
    if (kgPorM == null) return pendente("Medidas do perfil incompatíveis (a parede não cabe na seção).");
    const aviso = ({ tubo: "seção oca estimada", cantoneira: "cantoneira estimada", barra: "barra maciça", u: "perfil em U estimado", redonda: "barra redonda maciça" } as const)[formato];
    const unidade = semAcento(linha.unidade);
    if ((unidade.includes("metro") && !unidade.includes("quadrad")) || unidade === "m" || unidade === "ml")
      return { kg: quantidade * kgPorM, como: `${fmt(quantidade, 2)} m × ${fmt(kgPorM, 3)} kg/m (${aviso})`, motivo: "" };
    if (c && c > 0 && (unidade.includes("unid") || unidade === "un" || unidade === "pc" || unidade.includes("barra")))
      return {
        kg: quantidade * (c / 1000) * kgPorM,
        como: `${fmt(quantidade, 2)} barra(s) × ${fmt(c / 1000, 2)} m × ${fmt(kgPorM, 3)} kg/m (${aviso})`,
        motivo: "",
      };
    return pendente("Unidade do perfil não permite converter em peso (use metro linear ou unidade com comprimento).");
  }

  if (dados.pesoEspecificoKg && dados.pesoEspecificoKg > 0)
    return {
      kg: quantidade * dados.pesoEspecificoKg,
      como: `${fmt(quantidade, 3)} × ${fmt(dados.pesoEspecificoKg, 4)} kg/${linha.unidade || "un."}`,
      motivo: "",
    };
  return pendente("Sem peso específico cadastrado.");
}

export function somarPesos(resultados: ResultadoPesoLinha[]): { totalKg: number; pendentes: number } {
  return {
    totalKg: resultados.reduce((soma, item) => soma + (item.kg ?? 0), 0),
    pendentes: resultados.filter(item => item.kg == null).length,
  };
}
