import { useState } from "react";
import { Calculator, Check, X } from "lucide-react";
import { fmtNum } from "@/lib/format";

export type TipoFormulaConversao =
  | "chapa_kg_m2"
  | "perfil_kg_ml"
  | "lote_un_m2"
  | "direto";

export interface ModalCalculadoraFatorProps {
  aberto: boolean;
  onFechar: () => void;
  unidadeCompra: string;
  unidadeErp: string;
  descricaoNf: string;
  nomeMp: string;
  onAplicar: (fator: number, baseCalculoTexto: string) => void;
}

// Densidades padrão do setor (g/cm³) para preenchimento com 1 clique
const DENSIDADES_COMUNS = [
  { nome: "Inox 430", gCm3: 7.70 },
  { nome: "Inox 304", gCm3: 7.93 },
  { nome: "Galvanizado", gCm3: 7.85 },
  { nome: "Alumínio", gCm3: 2.70 },
  { nome: "Acrílico", gCm3: 1.19 },
  { nome: "PVC Expandido", gCm3: 0.55 },
];

export default function ModalCalculadoraFator({
  aberto,
  onFechar,
  unidadeCompra,
  unidadeErp,
  descricaoNf,
  nomeMp,
  onAplicar,
}: ModalCalculadoraFatorProps) {
  if (!aberto) return null;

  // Tenta inferir espessura a partir do texto (ex: 0,60 ou 0.80 ou #24)
  const inferirEspessura = () => {
    const m = (descricaoNf + " " + nomeMp).match(/(0[.,]\d{1,2})\s*mm?/i);
    return m ? Number(m[1].replace(",", ".")) : 0.60;
  };

  // Tenta inferir largura de tira (ex: 80mm ou 50mm)
  const inferirLargura = () => {
    const m = (descricaoNf + " " + nomeMp).match(/(\d{2,3})\s*mm/i);
    return m ? Number(m[1]) : 80;
  };

  const [tipoFormula, setTipoFormula] = useState<TipoFormulaConversao>(
    unidadeCompra === "KG" && unidadeErp === "M2"
      ? "chapa_kg_m2"
      : unidadeCompra === "KG" && unidadeErp === "ML"
      ? "perfil_kg_ml"
      : unidadeCompra === "UN" && unidadeErp === "M2"
      ? "lote_un_m2"
      : "chapa_kg_m2"
  );

  // Parâmetros Fórmula 1: Chapa plana (KG → M²)
  const [espessuraChapaMm, setEspessuraChapaMm] = useState<number>(inferirEspessura());
  const [densidadeChapa, setDensidadeChapa] = useState<number>(7.70); // Inox 430 padrão

  // Parâmetros Fórmula 2: Perfil / Tira dobrada (KG → Metro Linear)
  const [larguraTiraMm, setLarguraTiraMm] = useState<number>(inferirLargura());
  const [espessuraTiraMm, setEspessuraTiraMm] = useState<number>(inferirEspessura());
  const [densidadeTira, setDensidadeTira] = useState<number>(7.70);

  // Parâmetros Fórmula 3: Chapa / Lote (UN → M²)
  const [comprimentoChapaMm, setComprimentoChapaMm] = useState<number>(2440);
  const [larguraChapaMm, setLarguraChapaMm] = useState<number>(1220);
  const [qtdChapasPorUnidade, setQtdChapasPorUnidade] = useState<number>(1);

  // Fator manual livre
  const [fatorLivre, setFatorLivre] = useState<number>(1);

  // Cálculo ao vivo do resultado dependendo da fórmula escolhida
  let fatorCalculado = 0;
  let explicacaoTexto = "";

  if (tipoFormula === "chapa_kg_m2") {
    // 1 m² de chapa pesa: espessura (mm) × densidade (g/cm³) kg
    const kgPorM2 = espessuraChapaMm * densidadeChapa;
    if (kgPorM2 > 0) {
      fatorCalculado = Number((1 / kgPorM2).toFixed(6));
      explicacaoTexto = `Chapa: ${espessuraChapaMm}mm espessura × ${densidadeChapa} g/cm³ = ${kgPorM2.toFixed(4)} kg/m² → 1 kg = ${fatorCalculado} m².`;
    }
  } else if (tipoFormula === "perfil_kg_ml") {
    // 1 metro de tira pesa: largura (m) × espessura (m) × densidade (kg/m³)
    const kgPorM = (larguraTiraMm * espessuraTiraMm * densidadeTira) / 1000;
    if (kgPorM > 0) {
      fatorCalculado = Number((1 / kgPorM).toFixed(6));
      explicacaoTexto = `Perfil/Tira: ${larguraTiraMm}mm larg × ${espessuraTiraMm}mm esp × ${densidadeTira} g/cm³ = ${kgPorM.toFixed(4)} kg/m → 1 kg = ${fatorCalculado} ml.`;
    }
  } else if (tipoFormula === "lote_un_m2") {
    // Área de 1 chapa em m² × quantidade no lote
    const areaUmaChapaM2 = (comprimentoChapaMm * larguraChapaMm) / 1_000_000;
    const areaTotalM2 = areaUmaChapaM2 * (qtdChapasPorUnidade || 1);
    fatorCalculado = Number(areaTotalM2.toFixed(6));
    explicacaoTexto = `Chapa/Lote: ${comprimentoChapaMm}×${larguraChapaMm}mm (${areaUmaChapaM2.toFixed(4)} m²)` +
      (qtdChapasPorUnidade > 1 ? ` × ${qtdChapasPorUnidade} chapas = ${areaTotalM2.toFixed(4)} m² por unidade da NF.` : ` = ${areaTotalM2.toFixed(4)} m² por chapa.`);
  } else {
    fatorCalculado = fatorLivre;
    explicacaoTexto = `Fator livre definido manualmente: 1 ${unidadeCompra} = ${fatorLivre} ${unidadeErp}.`;
  }

  const handleConfirmar = () => {
    if (fatorCalculado <= 0) return;
    onAplicar(fatorCalculado, explicacaoTexto);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
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

        <div className="p-5 space-y-4 text-xs">
          {/* Contexto do item */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-slate-600 space-y-1">
            <div>
              <span className="text-slate-400">Item NF:</span>{" "}
              <span className="font-semibold text-slate-800">{descricaoNf}</span>
            </div>
            <div>
              <span className="text-slate-400">Conversão desejada:</span>{" "}
              <span className="font-bold text-blue-700">
                {unidadeCompra} (Compra) → {unidadeErp} (Mubisys)
              </span>
            </div>
          </div>

          {/* Seletor de Fórmula */}
          <div>
            <label className="block font-medium text-slate-700 mb-1.5">
              Escolha a fórmula pronta:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTipoFormula("chapa_kg_m2")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  tipoFormula === "chapa_kg_m2"
                    ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                📏 Chapa (KG → M²)
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Espessura × Densidade
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTipoFormula("perfil_kg_ml")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  tipoFormula === "perfil_kg_ml"
                    ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                📐 Perfil / Tira (KG → ML)
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Largura × Esp. × Dens.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTipoFormula("lote_un_m2")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  tipoFormula === "lote_un_m2"
                    ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                📦 Chapa / Lote (UN → M²)
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Comprimento × Largura
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTipoFormula("direto")}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  tipoFormula === "direto"
                    ? "border-blue-600 bg-blue-50 text-blue-900 ring-1 ring-blue-500 font-semibold"
                    : "border-slate-200 hover:bg-slate-50 text-slate-700"
                }`}
              >
                ✍️ Fator Livre
                <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                  Digitar número direto
                </span>
              </button>
            </div>
          </div>

          {/* Parâmetros Fórmula: Chapa KG -> M2 */}
          {tipoFormula === "chapa_kg_m2" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Espessura da Chapa (mm):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={espessuraChapaMm}
                    onChange={(e) => setEspessuraChapaMm(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Densidade (g/cm³):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={densidadeChapa}
                    onChange={(e) => setDensidadeChapa(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
              </div>

              {/* Botões rápidos de material */}
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">
                  Atalhos de Densidade:
                </span>
                <div className="flex flex-wrap gap-1">
                  {DENSIDADES_COMUNS.map((d) => (
                    <button
                      key={d.nome}
                      type="button"
                      onClick={() => setDensidadeChapa(d.gCm3)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                        densidadeChapa === d.gCm3
                          ? "bg-blue-600 text-white border-blue-600 font-bold"
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {d.nome} ({d.gCm3})
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Parâmetros Fórmula: Perfil Tira KG -> ML */}
          {tipoFormula === "perfil_kg_ml" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Largura Tira (mm):
                  </label>
                  <input
                    type="number"
                    value={larguraTiraMm}
                    onChange={(e) => setLarguraTiraMm(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Espessura (mm):
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={espessuraTiraMm}
                    onChange={(e) => setEspessuraTiraMm(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Densidade (g/cm³):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={densidadeTira}
                    onChange={(e) => setDensidadeTira(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {DENSIDADES_COMUNS.slice(0, 4).map((d) => (
                  <button
                    key={d.nome}
                    type="button"
                    onClick={() => setDensidadeTira(d.gCm3)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                      densidadeTira === d.gCm3
                        ? "bg-blue-600 text-white border-blue-600 font-bold"
                        : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    {d.nome} ({d.gCm3})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Parâmetros Fórmula: Chapa / Lote UN -> M2 */}
          {tipoFormula === "lote_un_m2" && (
            <div className="space-y-3 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Comprimento (mm):
                  </label>
                  <input
                    type="number"
                    value={comprimentoChapaMm}
                    onChange={(e) => setComprimentoChapaMm(Number(e.target.value))}
                    placeholder="2440"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Largura (mm):
                  </label>
                  <input
                    type="number"
                    value={larguraChapaMm}
                    onChange={(e) => setLarguraChapaMm(Number(e.target.value))}
                    placeholder="1220"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1 font-medium">
                    Chapas por Un.:
                  </label>
                  <input
                    type="number"
                    value={qtdChapasPorUnidade}
                    onChange={(e) => setQtdChapasPorUnidade(Number(e.target.value))}
                    placeholder="1"
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-1.5">
                {[
                  { nome: "1220 × 2440 (Padrão)", w: 1220, h: 2440 },
                  { nome: "1250 × 3000 (Inox)", w: 1250, h: 3000 },
                  { nome: "1000 × 2000", w: 1000, h: 2000 },
                ].map((tam) => (
                  <button
                    key={tam.nome}
                    type="button"
                    onClick={() => {
                      setLarguraChapaMm(tam.w);
                      setComprimentoChapaMm(tam.h);
                    }}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600 hover:bg-slate-100"
                  >
                    {tam.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fórmula Direta */}
          {tipoFormula === "direto" && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <label className="block text-slate-600 mb-1 font-medium">
                1 {unidadeCompra} equivale a quantos {unidadeErp}?
              </label>
              <input
                type="number"
                step="0.000001"
                value={fatorLivre}
                onChange={(e) => setFatorLivre(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-mono text-xs"
              />
            </div>
          )}

          {/* Resultado do Fator Calculado */}
          <div className="p-3.5 bg-emerald-50 rounded-lg border border-emerald-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-900 text-xs">
                Fator Resultante:
              </span>
              <span className="font-mono text-lg font-black text-emerald-800">
                1 {unidadeCompra} = {fatorCalculado} {unidadeErp}
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 font-mono leading-relaxed">
              {explicacaoTexto}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 bg-slate-50">
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
            disabled={fatorCalculado <= 0}
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
