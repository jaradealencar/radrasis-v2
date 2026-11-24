import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { fmtBrl, fmtNum, fmtPct } from "@/lib/format";
import { unidadeConsumo } from "@shared/compras-cotacoes";
import { medidasChapaMm, precoChapaM2 } from "@shared/compras-chapas";

export function CotacaoComparativoConsumo({
  item,
  fornecedor,
  custoFinalUnitarioCompra,
  propostasAnterioresMesmoFornecedor,
  propostasAnterioresOutrosFornecedores,
  alterar,
}: {
  item: any;
  fornecedor: string;
  custoFinalUnitarioCompra: number | null;
  propostasAnterioresMesmoFornecedor: any[];
  propostasAnterioresOutrosFornecedores: any[];
  alterar: (fator: number | null, formula: string) => void;
}) {
  const medidas = medidasChapaMm(item.descricao);
  const origem = unidadeConsumo(item.unidade);
  const destino = item.materiaPrimaVinculada?.unidadeMubisys;
  const ehChapa =
    origem === "UN" &&
    (medidas != null || (destino && unidadeConsumo(destino) === "M2"));
  const [largura, setLargura] = useState(
    medidas ? String(medidas.largura) : ""
  );
  const [comprimento, setComprimento] = useState(
    medidas ? String(medidas.comprimento) : ""
  );
  const [area, setArea] = useState(
    item.fatorConversaoCotacao != null
      ? String(item.fatorConversaoCotacao)
      : origem === "M2"
        ? "1"
        : medidas
          ? String(medidas.area)
          : ""
  );
  const compra = item.ultimaCompraGeral;
  const referenciaFator =
    compra?.fatorConversao && unidadeConsumo(compra.unidadeErp ?? "") === "M2"
      ? Number(compra.fatorConversao)
      : unidadeConsumo(compra?.unidade ?? "") === "M2"
        ? 1
        : null;
  const [areaReferencia, setAreaReferencia] = useState("");
  const [referenciaEditada, setReferenciaEditada] = useState(false);
  const fator = area.trim() ? Number(area.replace(",", ".")) : null;
  const fatorValido =
    fator != null && Number.isFinite(fator) && fator > 0 ? fator : null;
  const formula =
    largura && comprimento
      ? `${largura} mm × ${comprimento} mm / 1.000.000 = ${area} m² por ${item.unidade}.`
      : `1 ${item.unidade} = ${area} m².`;
  useEffect(() => {
    if (ehChapa || origem === "M2") alterar(fatorValido, formula);
  }, [fatorValido, formula, ehChapa, origem]);
  const preco = precoChapaM2(Number(item.precoUnitario), fatorValido);
  const refFator = referenciaEditada
    ? Number(areaReferencia.replace(",", "."))
    : referenciaFator;
  const precoAnterior = compra
    ? precoChapaM2(Number(compra.precoUnitario), refFator)
    : null;
  const custo =
    destino &&
    unidadeConsumo(destino) === "M2" &&
    Number(item.materiaPrimaVinculada.custoUnitarioMubisys) > 0
      ? Number(item.materiaPrimaVinculada.custoUnitarioMubisys)
      : null;
  const custoFinal = fatorValido && custoFinalUnitarioCompra != null
    ? Number((custoFinalUnitarioCompra / fatorValido).toFixed(6))
    : null;
  const mesmaPropostaAnterior = propostasAnterioresMesmoFornecedor.find(proposta => proposta.custoFinalUnidadeConsumo != null);
  const melhorOutraProposta = propostasAnterioresOutrosFornecedores.find(proposta => proposta.custoFinalUnidadeConsumo != null);
  const variacao = (valor: number | null | undefined, referencia: number | null | undefined) =>
    valor != null && referencia != null && referencia > 0 ? (valor / referencia - 1) * 100 : null;
  const mudarDimensoes = (l: string, c: string) => {
    setLargura(l);
    setComprimento(c);
    const valor =
      (Number(l.replace(",", ".")) * Number(c.replace(",", "."))) / 1e6;
    setArea(valor > 0 ? String(Number(valor.toFixed(8))) : "");
  };
  if (!ehChapa && origem !== "M2")
    return (
      <p className="text-[11px]">
        Vincule a matéria-prima e use a calculadora de conversão abaixo para
        comparar na unidade de consumo.
      </p>
    );
  return (
    <div className="space-y-2 text-left font-sans text-[11px]">
      {origem !== "M2" && (
        <div className="grid grid-cols-3 gap-1">
          <label>
            Largura (mm)
            <Input
              aria-label={`Largura em mm: ${item.descricao}`}
              className="h-7 px-1 text-xs"
              inputMode="decimal"
              value={largura}
              onChange={e => mudarDimensoes(e.target.value, comprimento)}
            />
          </label>
          <label>
            Comprimento (mm)
            <Input
              aria-label={`Comprimento em mm: ${item.descricao}`}
              className="h-7 px-1 text-xs"
              inputMode="decimal"
              value={comprimento}
              onChange={e => mudarDimensoes(largura, e.target.value)}
            />
          </label>
          <label>
            m² por chapa
            <Input
              aria-label={`Área por chapa: ${item.descricao}`}
              className="h-7 px-1 text-xs"
              inputMode="decimal"
              value={area}
              onChange={e => {
                setArea(e.target.value);
                setLargura("");
                setComprimento("");
              }}
            />
          </label>
        </div>
      )}
      <p className="text-[10px] text-slate-500">
        {medidas
          ? "Medidas extraídas da descrição; confira e ajuste se necessário."
          : "Informe a área ou as duas medidas da chapa."}
      </p>
      <div className="rounded border border-blue-100 bg-blue-50 p-2 space-y-1">
        <p>
          <strong>{fornecedor || "Fornecedor cotado"} · preço puro:</strong>{" "}
          {preco == null ? "área pendente" : `${fmtBrl(preco)}/m²`}{" "}
          <span className="text-slate-500">({fmtBrl(Number(item.precoUnitario))}/{item.unidade})</span>
        </p>
        <p className={custoFinal != null && custo != null && custoFinal > custo ? "font-semibold text-red-800" : "font-semibold text-emerald-800"}>
          <strong>Custo final cotado · mercadoria + frete + ICMS:</strong>{" "}
          {custoFinal == null ? "pendente" : `${fmtBrl(custoFinal)}/m²`}
          {variacao(custoFinal, custo) != null && custo != null && <span> · {fmtPct(variacao(custoFinal, custo)!, 2)} vs MubiSys</span>}
        </p>
        <p><strong>MubiSys atual:</strong>{" "}{custo == null ? "vínculo/custo por m² pendente" : `${fmtBrl(custo)}/m²`}</p>
        <p>
          <strong>{compra?.fornecedor ?? "Última NF"} · custo final auditado:</strong>{" "}
          {compra?.custoRealErp == null ? compra ? "custo final não disponível" : "sem NF anterior" : `${fmtBrl(Number(compra.custoRealErp))}/${compra.unidadeErp ?? "M²"}`}
          {compra?.data && <span className="text-slate-500"> · {compra.data}</span>}
        </p>
        <p>
          <strong>Proposta anterior · mesmo fornecedor:</strong>{" "}
          {mesmaPropostaAnterior ? `${fmtBrl(mesmaPropostaAnterior.custoFinalUnidadeConsumo)}/m² · ${mesmaPropostaAnterior.data}${mesmaPropostaAnterior.rateioFreteEstimado ? " · frete estimado" : ""}` : "sem proposta anterior compatível"}
          {mesmaPropostaAnterior && variacao(custoFinal, mesmaPropostaAnterior.custoFinalUnidadeConsumo) != null && <span className="ml-1">({fmtPct(variacao(custoFinal, mesmaPropostaAnterior.custoFinalUnidadeConsumo)!, 2)})</span>}
        </p>
        <p>
          <strong>Melhor proposta anterior · outros fornecedores:</strong>{" "}
          {melhorOutraProposta ? `${fmtBrl(melhorOutraProposta.custoFinalUnidadeConsumo)}/m² · ${melhorOutraProposta.fornecedor} · ${melhorOutraProposta.data}${melhorOutraProposta.rateioFreteEstimado ? " · frete estimado" : ""}` : "sem proposta anterior compatível"}
          {melhorOutraProposta && variacao(custoFinal, melhorOutraProposta.custoFinalUnidadeConsumo) != null && <span className="ml-1">({fmtPct(variacao(custoFinal, melhorOutraProposta.custoFinalUnidadeConsumo)!, 2)})</span>}
        </p>
        {custoFinal != null && custo != null && custo > 0 && custoFinal > custo && (
          <p className="rounded bg-red-50 px-2 py-1 font-semibold text-red-800">Alerta: custo cotado {fmtPct((custoFinal / custo - 1) * 100, 2)} acima do MubiSys. Avalie reajustar o cadastro antes de aprovar o pedido.</p>
        )}
      </div>      {compra && (
        <details>
          <summary className="cursor-pointer text-blue-600">
            Conferir conversão da compra anterior
          </summary>
          <p className="mt-1">
            {fmtBrl(compra.precoUnitario)}/{compra.unidade} ÷{" "}
            {referenciaEditada
              ? areaReferencia
              : referenciaFator == null
                ? "área pendente"
                : fmtNum(referenciaFator, 6)}{" "}
            m²/{compra.unidade}
          </p>
          <p>
            {compra.baseCalculoTexto ??
              "Fórmula não registrada na compra antiga."}
          </p>
          <label>
            m² por unidade da compra antiga (simulação nesta tela)
            <Input
              className="h-7 text-xs"
              aria-label={`Área da compra anterior: ${item.descricao}`}
              value={
                referenciaEditada ? areaReferencia : (referenciaFator ?? "")
              }
              inputMode="decimal"
              onChange={e => {
                setReferenciaEditada(true);
                setAreaReferencia(e.target.value);
              }}
            />
          </label>
          <p className="text-slate-500">
            O preço convertido da compra é antes de frete e impostos. Custo
            final auditado:{" "}
            {compra.custoRealErp == null
              ? "não disponível"
              : `${fmtBrl(compra.custoRealErp)}/${compra.unidadeErp}`}
            .
          </p>
        </details>
      )}
    </div>
  );
}
