import { useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { fmtBrlCompact, fmtBrl } from "@/lib/format";

export interface EtapaCascata {
  label: string;
  valor: number | null;
  /** "inicio"/"total" desenham a barra cheia a partir do zero; "delta" empilha
   * a partir do acumulado do passo anterior (técnica padrão de gráfico
   * cascata com recharts — que não tem tipo "waterfall" nativo). */
  tipo: "inicio" | "delta" | "total";
}

function construirDadosCascata(etapas: EtapaCascata[]) {
  let acumulado = 0;
  return etapas.map(e => {
    const v = e.valor ?? 0;
    if (e.tipo === "inicio" || e.tipo === "total") {
      acumulado = v;
      return { label: e.label, base: 0, positivo: v >= 0 ? v : 0, negativo: v < 0 ? -v : 0, valorReal: e.valor, ehTotal: e.tipo === "total" };
    }
    const base = v >= 0 ? acumulado : acumulado + v;
    acumulado += v;
    return { label: e.label, base, positivo: v >= 0 ? v : 0, negativo: v < 0 ? -v : 0, valorReal: e.valor, ehTotal: false };
  });
}

/** Gráfico de cascata (faturamento → deduções → lucro/prejuízo) — implementado
 * com BarChart empilhado (série "base" invisível + "positivo"/"negativo"
 * visíveis), já que recharts não tem tipo waterfall nativo. */
export default function ResultadoGeralWaterfall({ etapas }: { etapas: EtapaCascata[] }) {
  const dados = useMemo(() => construirDadosCascata(etapas), [etapas]);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={dados} margin={{ top: 8, right: 8, left: 0, bottom: 40 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtBrlCompact(v)} />
        <Tooltip
          formatter={(_v: number, _n: string, item: any) => [fmtBrl(item.payload.valorReal), ""]}
          labelFormatter={(l) => l}
        />
        <Bar dataKey="base" stackId="cascata" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="positivo" stackId="cascata" radius={[3, 3, 0, 0]}>
          {dados.map((d, i) => <Cell key={i} fill={d.ehTotal ? (d.valorReal ?? 0) >= 0 ? "#16a34a" : "#dc2626" : "#16a34a"} />)}
        </Bar>
        <Bar dataKey="negativo" stackId="cascata" fill="#dc2626" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
