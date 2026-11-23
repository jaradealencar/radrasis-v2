import { useState } from "react";
import { Calculator, Check, X } from "lucide-react";
import { fmtNum } from "@/lib/format";

export type TipoFormulaConversao =
  | "chapa_kg_m2"
  | "perfil_kg_ml"
  | "lote_un_m2"
  | "pacote_un"
  | "rendimento_kg"
  | "direto";

export interface ModalCalculadoraFatorProps {
  aberto: boolean;
  onFechar: () => void;
  unidadeCompra: string;
  unidadeErp: string;
  descricaoNf: string;
  nomeMp: string;
  fatorInicial?: number | null;
  baseCalculoTextoInicial?: string | null;
  onAplicar: (fator: number, baseCalculoTexto: string) => void;
}

const DENSIDADES_COMUNS = [
  { nome: "Inox 430", gCm3: 7.7 },
  { nome: "Inox 304", gCm3: 7.93 },
  { nome: "Galvanizado", gCm3: 7.85 },
  { nome: "Alumínio", gCm3: 2.7 },
  { nome: "Acrílico", gCm3: 1.19 },
  { nome: "PVC Expandido", gCm3: 0.55 },
];

const CAMPO_CLASS =
  "w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs";

function lerDecimal(valor: string): number | null {
  const normalizado = valor.trim().replace(/\s/g, "").replace(",", ".");
  if (!normalizado || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalizado))
    return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function fatorComPrecisaoPersistida(valor: number): number {
  return Number(valor.toFixed(8));
}

function formatarFator(valor: number): string {
  return fmtNum(valor, 8).replace(/0+$/, "").replace(/,$/, "");
}

function CampoDecimal({
  label,
  value,
  onChange,
  placeholder,
  className = CAMPO_CLASS,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-slate-600 mb-1 font-medium">{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </label>
  );
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function detectarDensidade(texto: string): number {
  const s = normalizarTexto(texto);
  if (s.includes("inox 304")) return 7.93;
  if (s.includes("inox 430") || s.includes("inox")) return 7.7;
  if (s.includes("galvaniz")) return 7.85;
  if (s.includes("alumin")) return 2.7;
  if (s.includes("acril")) return 1.19;
  if (s.includes("pvc expand")) return 0.55;
  if (s.includes("aco") || s.includes("aço")) return 7.85;
  return 0;
}

function detectarEspessuraMm(texto: string): number {
  const m = texto.match(/(\d+(?:[.,]\d+)?)\s*mm\b/i);
  return m ? (lerDecimal(m[1]) ?? 0) : 0;
}

function detectarLarguraMm(texto: string): number {
  const m = texto.match(/(?:larg(?:ura)?\s*)?(\d{2,4}(?:[.,]\d+)?)\s*mm\b/i);
  return m ? (lerDecimal(m[1]) ?? 0) : 0;
}

function itemPareceChapa(texto: string): boolean {
  const s = normalizarTexto(texto);
  return /\b(chapa|placa|painel)\b/.test(s);
}

function itemPareceEmbalagem(texto: string): boolean {
  const s = normalizarTexto(texto);
  return /\b(fita|filme|stretch|gomada|crepe|embalagem|bobina|rolo|pacote|caixa|adesiva|papel)\b/.test(
    s
  );
}

function itemPareceMetal(texto: string): boolean {
  const s = normalizarTexto(texto);
  return /\b(chapa|inox|galvaniz|aco|alumin)\b/.test(s);
}

function itemParecePerfil(texto: string): boolean {
  const s = normalizarTexto(texto);
  return /\b(perfil|tira|cantoneira|tubo|barra)\b/.test(s);
}

function escolherFormulaInicial(
  unidadeCompra: string,
  unidadeErp: string,
  textoItem: string,
  fatorInicial: number | null | undefined
): TipoFormulaConversao {
  if (fatorInicial != null && Number.isFinite(fatorInicial) && fatorInicial > 0)
    return "direto";
  const origem = unidadeCompra.trim().toUpperCase();
  const destino = unidadeErp.trim().toUpperCase();
  const embalagem = itemPareceEmbalagem(textoItem);
  if (
    origem === "KG" &&
    destino === "M2" &&
    itemPareceMetal(textoItem) &&
    !embalagem
  )
    return "chapa_kg_m2";
  if (
    origem === "KG" &&
    destino === "ML" &&
    itemParecePerfil(textoItem) &&
    !embalagem
  )
    return "perfil_kg_ml";
  if (origem === "KG" && (destino === "M2" || destino === "ML"))
    return "rendimento_kg";
  if (
    origem === "UN" &&
    destino === "M2" &&
    itemPareceChapa(textoItem) &&
    !embalagem
  )
    return "lote_un_m2";
  if (origem === "UN" && (destino === "ML" || destino === "UN"))
    return "pacote_un";
  return "direto";
}

function formulaCompativel(
  formula: TipoFormulaConversao,
  origem: string,
  destino: string
): boolean {
  if (formula === "direto") return true;
  if (formula === "chapa_kg_m2") return origem === "KG" && destino === "M2";
  if (formula === "perfil_kg_ml") return origem === "KG" && destino === "ML";
  if (formula === "lote_un_m2") return origem === "UN" && destino === "M2";
  if (formula === "pacote_un")
    return origem === "UN" && (destino === "ML" || destino === "UN");
  return (
    formula === "rendimento_kg" &&
    origem === "KG" &&
    (destino === "ML" || destino === "M2")
  );
}

export default function ModalCalculadoraFator({
  aberto,
  onFechar,
  unidadeCompra,
  unidadeErp,
  descricaoNf,
  nomeMp,
  fatorInicial,
  baseCalculoTextoInicial,
  onAplicar,
}: ModalCalculadoraFatorProps) {
  const textoItem = descricaoNf + " " + nomeMp;
  const [tipoFormula, setTipoFormula] = useState<TipoFormulaConversao>(() =>
    escolherFormulaInicial(unidadeCompra, unidadeErp, textoItem, fatorInicial)
  );

  const [espessuraChapaMm, setEspessuraChapaMm] = useState(() =>
    detectarEspessuraMm(textoItem) > 0
      ? String(detectarEspessuraMm(textoItem))
      : ""
  );
  const [densidadeChapa, setDensidadeChapa] = useState(() => {
    const densidade = detectarDensidade(textoItem);
    return densidade > 0 ? String(densidade) : "";
  });
  const [larguraTiraMm, setLarguraTiraMm] = useState(() =>
    detectarLarguraMm(textoItem) > 0 ? String(detectarLarguraMm(textoItem)) : ""
  );
  const [espessuraTiraMm, setEspessuraTiraMm] = useState(() =>
    detectarEspessuraMm(textoItem) > 0
      ? String(detectarEspessuraMm(textoItem))
      : ""
  );
  const [densidadeTira, setDensidadeTira] = useState(() => {
    const densidade = detectarDensidade(textoItem);
    return densidade > 0 ? String(densidade) : "";
  });
  const [comprimentoChapaMm, setComprimentoChapaMm] = useState("");
  const [larguraChapaMm, setLarguraChapaMm] = useState("");
  const [qtdChapasPorUnidade, setQtdChapasPorUnidade] = useState("1");
  const [rolosPorUnidade, setRolosPorUnidade] = useState("");
  const [metrosOuUnidadesPorRolo, setMetrosOuUnidadesPorRolo] = useState("");
  const [baseRendimento, setBaseRendimento] = useState<
    "gramatura" | "espessura"
  >("gramatura");
  const [gramatura, setGramatura] = useState("");
  const [espessuraBobina, setEspessuraBobina] = useState("");
  const [unidadeEspessuraBobina, setUnidadeEspessuraBobina] = useState<
    "micras" | "mm"
  >("micras");
  const [densidadeBobina, setDensidadeBobina] = useState("");
  const [larguraBobinaMm, setLarguraBobinaMm] = useState("");
  const [descontoTubetePerda, setDescontoTubetePerda] = useState("0");
  const [fatorLivreTexto, setFatorLivreTexto] = useState(() =>
    fatorInicial != null && Number.isFinite(fatorInicial) && fatorInicial > 0
      ? String(fatorInicial)
      : ""
  );

  if (!aberto) return null;

  const origem = unidadeCompra.trim().toUpperCase();
  const destino = unidadeErp.trim().toUpperCase();
  const opcoesFormula: {
    tipo: TipoFormulaConversao;
    titulo: string;
    detalhe: string;
  }[] = [];
  if (formulaCompativel("chapa_kg_m2", origem, destino)) {
    opcoesFormula.push({
      tipo: "chapa_kg_m2",
      titulo: "Chapa (KG → M²)",
      detalhe: "Espessura × densidade",
    });
  }
  if (formulaCompativel("perfil_kg_ml", origem, destino)) {
    opcoesFormula.push({
      tipo: "perfil_kg_ml",
      titulo: "Perfil / Tira (KG → ML)",
      detalhe: "Largura × espessura × densidade",
    });
  }
  if (formulaCompativel("lote_un_m2", origem, destino)) {
    opcoesFormula.push({
      tipo: "lote_un_m2",
      titulo: "Chapa / Lote (UN → M²)",
      detalhe: "Comprimento × largura",
    });
  }
  if (formulaCompativel("pacote_un", origem, destino)) {
    opcoesFormula.push({
      tipo: "pacote_un",
      titulo: "Pacote / Caixa (UN → " + destino + ")",
      detalhe: "Rolos/itens × conteúdo por rolo",
    });
  }
  if (formulaCompativel("rendimento_kg", origem, destino)) {
    opcoesFormula.push({
      tipo: "rendimento_kg",
      titulo: "Bobina / Material (KG → " + destino + ")",
      detalhe: "Gramatura ou espessura + densidade",
    });
  }
  opcoesFormula.push({
    tipo: "direto",
    titulo: "Fator Livre",
    detalhe: "Digitar número diretamente",
  });

  let fatorCalculado = 0;
  let explicacaoTexto = "";

  if (tipoFormula === "chapa_kg_m2") {
    const espessura = lerDecimal(espessuraChapaMm) ?? 0;
    const densidade = lerDecimal(densidadeChapa) ?? 0;
    const kgPorM2 = espessura * densidade;
    if (kgPorM2 > 0) {
      fatorCalculado = fatorComPrecisaoPersistida(1 / kgPorM2);
      explicacaoTexto =
        "Chapa: " +
        espessura +
        " mm × " +
        densidade +
        " g/cm³ = " +
        fmtNum(kgPorM2, 8) +
        " kg/m²; 1 kg ÷ " +
        fmtNum(kgPorM2, 8) +
        " kg/m² = " +
        formatarFator(fatorCalculado) +
        " M².";
    }
  } else if (tipoFormula === "perfil_kg_ml") {
    const largura = lerDecimal(larguraTiraMm) ?? 0;
    const espessura = lerDecimal(espessuraTiraMm) ?? 0;
    const densidade = lerDecimal(densidadeTira) ?? 0;
    const kgPorMetro = (largura * espessura * densidade) / 1000;
    if (kgPorMetro > 0) {
      fatorCalculado = fatorComPrecisaoPersistida(1 / kgPorMetro);
      explicacaoTexto =
        "Perfil/tira: (" +
        largura +
        " mm × " +
        espessura +
        " mm × " +
        densidade +
        " g/cm³) ÷ 1000 = " +
        fmtNum(kgPorMetro, 8) +
        " kg/ML; 1 kg ÷ " +
        fmtNum(kgPorMetro, 8) +
        " kg/ML = " +
        formatarFator(fatorCalculado) +
        " ML.";
    }
  } else if (tipoFormula === "lote_un_m2") {
    const comprimento = lerDecimal(comprimentoChapaMm) ?? 0;
    const largura = lerDecimal(larguraChapaMm) ?? 0;
    const quantidade = lerDecimal(qtdChapasPorUnidade) ?? 0;
    const areaM2 = (comprimento * largura * quantidade) / 1_000_000;
    if (areaM2 > 0) {
      fatorCalculado = fatorComPrecisaoPersistida(areaM2);
      explicacaoTexto =
        "(" +
        comprimento +
        " mm × " +
        largura +
        " mm ÷ 1.000.000) × " +
        quantidade +
        " chapa(s) = " +
        formatarFator(fatorCalculado) +
        " M² por UN.";
    }
  } else if (tipoFormula === "pacote_un") {
    const rolos = lerDecimal(rolosPorUnidade) ?? 0;
    const conteudoPorRolo = lerDecimal(metrosOuUnidadesPorRolo) ?? 0;
    const total = rolos * conteudoPorRolo;
    if (total > 0) {
      fatorCalculado = fatorComPrecisaoPersistida(total);
      const unidadeConteudo = destino === "ML" ? "ML" : "UN";
      explicacaoTexto =
        rolos +
        " rolo(s)/item(ns) por UN da NF × " +
        conteudoPorRolo +
        " " +
        unidadeConteudo +
        " por rolo/item = " +
        formatarFator(fatorCalculado) +
        " " +
        destino +
        " por UN.";
    }
  } else if (tipoFormula === "rendimento_kg") {
    const perdaInformada =
      descontoTubetePerda.trim() === "" ? 0 : lerDecimal(descontoTubetePerda);
    const perdaPct = perdaInformada ?? -1;
    const larguraMm = lerDecimal(larguraBobinaMm) ?? 0;
    let gramasPorM2 = 0;
    let textoBase = "";
    if (baseRendimento === "gramatura") {
      gramasPorM2 = lerDecimal(gramatura) ?? 0;
      if (gramasPorM2 > 0) textoBase = "1000 g ÷ " + gramasPorM2 + " g/m²";
    } else {
      const espessura = lerDecimal(espessuraBobina) ?? 0;
      const densidade = lerDecimal(densidadeBobina) ?? 0;
      const espessuraMm =
        unidadeEspessuraBobina === "micras" ? espessura / 1000 : espessura;
      gramasPorM2 = espessuraMm * densidade * 1000;
      if (gramasPorM2 > 0) {
        textoBase =
          "(" +
          espessura +
          " " +
          unidadeEspessuraBobina +
          " ÷ " +
          (unidadeEspessuraBobina === "micras" ? "1000) " : "1) ") +
          "× " +
          densidade +
          " g/cm³ × 1000 = " +
          fmtNum(gramasPorM2, 8) +
          " g/m²";
      }
    }
    if (gramasPorM2 > 0 && perdaPct >= 0 && perdaPct < 100) {
      const areaM2PorKg = 1000 / gramasPorM2;
      const larguraM = larguraMm / 1000;
      const comprimentoMlPorKg =
        destino === "ML" && larguraM > 0 ? areaM2PorKg / larguraM : areaM2PorKg;
      if (destino === "M2" || (destino === "ML" && larguraM > 0)) {
        fatorCalculado = fatorComPrecisaoPersistida(
          comprimentoMlPorKg * (1 - perdaPct / 100)
        );
        const areaExpressao = "1000 g ÷ " + fmtNum(gramasPorM2, 8) + " g/m²";
        const rendimentoBruto =
          destino === "ML"
            ? "(" + areaExpressao + ") ÷ (" + larguraMm + " mm ÷ 1000)"
            : areaExpressao;
        const origemGramatura =
          baseRendimento === "espessura"
            ? " Espessura/densidade: " + textoBase + "."
            : "";
        explicacaoTexto =
          "(" +
          rendimentoBruto +
          ") × (1 - " +
          perdaPct +
          "% ÷ 100) = " +
          formatarFator(fatorCalculado) +
          " " +
          destino +
          " por KG." +
          origemGramatura;
      }
    }
  } else {
    const valorManual = lerDecimal(fatorLivreTexto);
    if (valorManual != null && valorManual > 0) {
      fatorCalculado = fatorComPrecisaoPersistida(valorManual);
      if (
        fatorInicial != null &&
        fatorInicial > 0 &&
        fatorCalculado === fatorComPrecisaoPersistida(fatorInicial) &&
        baseCalculoTextoInicial
      ) {
        explicacaoTexto = baseCalculoTextoInicial;
      } else {
        explicacaoTexto =
          "Fator livre definido manualmente: 1 " +
          origem +
          " = " +
          formatarFator(fatorCalculado) +
          " " +
          destino +
          ".";
      }
    }
  }

  const handleConfirmar = () => {
    if (!Number.isFinite(fatorCalculado) || fatorCalculado <= 0) return;
    onAplicar(fatorCalculado, explicacaoTexto);
    onFechar();
  };

  const selecionarDensidadeChapa = (valor: number) =>
    setDensidadeChapa(String(valor));
  const selecionarDensidadeTira = (valor: number) =>
    setDensidadeTira(String(valor));
  const classeOpcao = (selecionada: boolean) =>
    "p-2.5 rounded-lg border text-left transition-all " +
    (selecionada
      ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-semibold"
      : "border-slate-200 hover:bg-slate-50 text-slate-700");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-2xl max-h-[92vh] rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-slate-800 text-sm">
              Assistente de Conversão de Unidade
            </h3>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1">
            <div>
              <span className="text-slate-400">Item NF:</span>{" "}
              <span className="font-semibold text-slate-800">
                {descricaoNf}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Conversão desejada:</span>{" "}
              <span className="font-bold text-blue-700">
                {origem} (Compra) → {destino} (Mubisys)
              </span>
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1.5">
              Escolha uma fórmula compatível:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {opcoesFormula.map(opcao => (
                <button
                  key={opcao.tipo}
                  type="button"
                  onClick={() => setTipoFormula(opcao.tipo)}
                  className={classeOpcao(tipoFormula === opcao.tipo)}
                >
                  {opcao.titulo}
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                    {opcao.detalhe}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {tipoFormula === "chapa_kg_m2" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-slate-500">
                Preencha apenas as propriedades confirmadas da chapa.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <CampoDecimal
                  label="Espessura da chapa (mm)"
                  value={espessuraChapaMm}
                  onChange={setEspessuraChapaMm}
                  placeholder="Ex.: 0,6"
                />
                <CampoDecimal
                  label="Densidade (g/cm³)"
                  value={densidadeChapa}
                  onChange={setDensidadeChapa}
                  placeholder="Ex.: 7,85"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">
                  Atalhos de densidade
                </span>
                <div className="flex flex-wrap gap-1">
                  {DENSIDADES_COMUNS.map(d => (
                    <button
                      key={d.nome}
                      type="button"
                      onClick={() => selecionarDensidadeChapa(d.gCm3)}
                      className={
                        "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors " +
                        (lerDecimal(densidadeChapa) === d.gCm3
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100")
                      }
                    >
                      {d.nome} ({fmtNum(d.gCm3, 2)})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {tipoFormula === "perfil_kg_ml" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-slate-500">
                Informe largura, espessura e densidade confirmadas do
                perfil/tira.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <CampoDecimal
                  label="Largura (mm)"
                  value={larguraTiraMm}
                  onChange={setLarguraTiraMm}
                  placeholder="Ex.: 80"
                />
                <CampoDecimal
                  label="Espessura (mm)"
                  value={espessuraTiraMm}
                  onChange={setEspessuraTiraMm}
                  placeholder="Ex.: 0,6"
                />
                <CampoDecimal
                  label="Densidade (g/cm³)"
                  value={densidadeTira}
                  onChange={setDensidadeTira}
                  placeholder="Ex.: 7,85"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {DENSIDADES_COMUNS.map(d => (
                  <button
                    key={d.nome}
                    type="button"
                    onClick={() => selecionarDensidadeTira(d.gCm3)}
                    className={
                      "px-2 py-0.5 rounded text-[10px] font-medium border " +
                      (lerDecimal(densidadeTira) === d.gCm3
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "bg-white text-slate-600 border-slate-200")
                    }
                  >
                    {d.nome} ({fmtNum(d.gCm3, 2)})
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipoFormula === "lote_un_m2" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-slate-500">
                Informe as medidas reais. Os tamanhos rápidos só são aplicados
                quando selecionados.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <CampoDecimal
                  label="Comprimento (mm)"
                  value={comprimentoChapaMm}
                  onChange={setComprimentoChapaMm}
                  placeholder="Ex.: 2440"
                />
                <CampoDecimal
                  label="Largura (mm)"
                  value={larguraChapaMm}
                  onChange={setLarguraChapaMm}
                  placeholder="Ex.: 1220"
                />
                <CampoDecimal
                  label="Chapas por UN da NF"
                  value={qtdChapasPorUnidade}
                  onChange={setQtdChapasPorUnidade}
                  placeholder="1"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { nome: "1220 × 2440", w: 1220, h: 2440 },
                  { nome: "1250 × 3000", w: 1250, h: 3000 },
                  { nome: "1000 × 2000", w: 1000, h: 2000 },
                ].map(tam => (
                  <button
                    key={tam.nome}
                    type="button"
                    onClick={() => {
                      setLarguraChapaMm(String(tam.w));
                      setComprimentoChapaMm(String(tam.h));
                    }}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100"
                  >
                    {tam.nome} mm
                  </button>
                ))}
              </div>
            </div>
          )}

          {tipoFormula === "pacote_un" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-slate-600">
                Calcule o conteúdo de cada UN da NF, por exemplo: 3 rolos × 50
                ML = 150 ML por pacote.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <CampoDecimal
                  label="Rolos/itens por UN da NF"
                  value={rolosPorUnidade}
                  onChange={setRolosPorUnidade}
                  placeholder="Ex.: 3"
                />
                <CampoDecimal
                  label={
                    destino === "ML"
                      ? "Metros por rolo/item"
                      : "Unidades por rolo/item"
                  }
                  value={metrosOuUnidadesPorRolo}
                  onChange={setMetrosOuUnidadesPorRolo}
                  placeholder={destino === "ML" ? "Ex.: 50" : "Ex.: 12"}
                />
              </div>
            </div>
          )}

          {tipoFormula === "rendimento_kg" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <p className="text-slate-600">
                Informe a gramatura ou as propriedades físicas do material da
                bobina/rolo.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBaseRendimento("gramatura")}
                  className={
                    "px-3 py-1 rounded border " +
                    (baseRendimento === "gramatura"
                      ? "border-blue-600 bg-blue-100 text-blue-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  Usar gramatura
                </button>
                <button
                  type="button"
                  onClick={() => setBaseRendimento("espessura")}
                  className={
                    "px-3 py-1 rounded border " +
                    (baseRendimento === "espessura"
                      ? "border-blue-600 bg-blue-100 text-blue-900 font-semibold"
                      : "border-slate-200 bg-white text-slate-600")
                  }
                >
                  Usar espessura + densidade
                </button>
              </div>
              {baseRendimento === "gramatura" ? (
                <CampoDecimal
                  label="Gramatura (g/m²)"
                  value={gramatura}
                  onChange={setGramatura}
                  placeholder="Ex.: 80"
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <CampoDecimal
                    label="Espessura"
                    value={espessuraBobina}
                    onChange={setEspessuraBobina}
                    placeholder="Ex.: 20"
                  />
                  <label className="block min-w-0">
                    <span className="block text-slate-600 mb-1 font-medium">
                      Unidade da espessura
                    </span>
                    <select
                      value={unidadeEspessuraBobina}
                      onChange={event =>
                        setUnidadeEspessuraBobina(
                          event.target.value as "micras" | "mm"
                        )
                      }
                      className={CAMPO_CLASS}
                    >
                      <option value="micras">Micras (µm)</option>
                      <option value="mm">Milímetros (mm)</option>
                    </select>
                  </label>
                  <CampoDecimal
                    label="Densidade (g/cm³)"
                    value={densidadeBobina}
                    onChange={setDensidadeBobina}
                    placeholder="Ex.: 0,92"
                  />
                </div>
              )}
              {destino === "ML" && (
                <CampoDecimal
                  label="Largura da bobina (mm)"
                  value={larguraBobinaMm}
                  onChange={setLarguraBobinaMm}
                  placeholder="Ex.: 500"
                />
              )}
              <CampoDecimal
                label="% de desconto de tubete/perda (opcional)"
                value={descontoTubetePerda}
                onChange={setDescontoTubetePerda}
                placeholder="0"
              />
              <p className="text-[10px] text-slate-500">
                Para ML, o rendimento em M² é dividido pela largura da bobina em
                metros. O desconto reduz o rendimento líquido.
              </p>
            </div>
          )}

          {tipoFormula === "direto" && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <CampoDecimal
                label={"1 " + origem + " equivale a quantos " + destino + "?"}
                value={fatorLivreTexto}
                onChange={setFatorLivreTexto}
                placeholder="Ex.: 150 ou 0,21645"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                Aceita decimal com vírgula ou ponto; o fator é salvo com até 8
                casas decimais.
              </p>
            </div>
          )}

          <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-emerald-900 text-xs">
                Fator Resultante:
              </span>
              <span className="font-mono text-lg font-black text-emerald-800">
                {fatorCalculado > 0
                  ? "1 " +
                    origem +
                    " = " +
                    formatarFator(fatorCalculado) +
                    " " +
                    destino
                  : "Preencha os dados para calcular " + destino}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-mono leading-relaxed">
              {explicacaoTexto ||
                "O fator será aplicado e o custo unitário será exibido por " +
                  destino +
                  "."}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 rounded font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!Number.isFinite(fatorCalculado) || fatorCalculado <= 0}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            Aplicar e Salvar no Item
          </button>
        </div>
      </div>
    </div>
  );
}
