import { caminhosParaMeta, rankingParaMeta, type AlavancaRanking } from "@shared/meta-faturamento";
import type { PainelMetaDados } from "./tipos";
import { CampoNumero, Cartao, Selo, brlCurto, fmtNum } from "./comuns";
import { montarComparativo, calcularSensibilidades, type LinhaComparativa } from "./calculos";
import { OPCOES_FUNIL } from "./Simulador";

function formatarValor(l: LinhaComparativa, v: number | null): string {
  if (v === null) return "—";
  if (l.unidade === "brl") return `R$ ${fmtNum(v, 0)}`;
  if (l.unidade === "pct") return `${fmtNum(v, l.casas)}%`;
  return fmtNum(v, l.casas);
}

function Delta({ l, valor }: { l: LinhaComparativa; valor: number | null }) {
  if (valor === null || l.atual === null) return null;
  if (l.id === "margem") return null;
  if (l.id === "lucro" || l.id === "contribuicao") {
    const dif = valor - l.atual;
    return <span className={`text-[11px] font-semibold ${dif >= 0 ? "text-emerald-600" : "text-red-600"}`}>{dif >= 0 ? "+" : "-"}{brlCurto(Math.abs(dif))}</span>;
  }
  if (!(l.atual > 0)) return null;
  if (l.unidade === "pct") {
    const pp = valor - l.atual;
    if (Math.abs(pp) < 0.05) return <span className="text-[11px] text-slate-400">igual</span>;
    return <span className={`text-[11px] font-semibold ${pp > 0 ? "text-emerald-600" : "text-red-600"}`}>{pp > 0 ? "+" : ""}{fmtNum(pp, 1)} p.p.</span>;
  }
  const pct = (valor / l.atual - 1) * 100;
  if (Math.abs(pct) < 0.05) return <span className="text-[11px] text-slate-400">igual</span>;
  return <span className={`text-[11px] font-semibold ${pct > 0 ? "text-emerald-600" : "text-red-600"}`}>{pct > 0 ? "+" : ""}{fmtNum(pct, 1)}%</span>;
}

function formatarAlavanca(a: AlavancaRanking, v: number): string {
  if (a.unidade === "brl") return `R$ ${fmtNum(v, 0)}`;
  if (a.unidade === "pct") return `${fmtNum(v, 1)}%`;
  return fmtNum(v, 0);
}

function TabelaAlavancas({ meta, alavancas }: { meta: number; alavancas: AlavancaRanking[] }) {
  if (alavancas.length === 0) return <p className="text-xs text-slate-500">Você já está acima de {brlCurto(meta)}.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-[11px] text-slate-400 text-left">
            <th className="font-medium pb-1">Alavanca (sozinha)</th>
            <th className="font-medium pb-1 text-right">Hoje</th>
            <th className="font-medium pb-1 text-right">Precisaria</th>
            <th className="font-medium pb-1 text-right">Já atingiu</th>
            <th className="font-medium pb-1 text-right">Esforço</th>
          </tr>
        </thead>
        <tbody>
          {alavancas.map(a => (
            <tr key={a.id} className="border-t border-slate-100">
              <td className="py-1.5 text-slate-800 font-medium">{a.rotulo}</td>
              <td className="py-1.5 text-right text-slate-500">{formatarAlavanca(a, a.atual)}</td>
              <td className="py-1.5 text-right font-semibold text-slate-800">
                {a.inviavel ? "impossível" : formatarAlavanca(a, a.necessario)}
                {!a.inviavel && <span className="text-[11px] text-slate-400"> (+{fmtNum(a.variacaoPct, 0)}%)</span>}
              </td>
              <td className="py-1.5 text-right text-slate-500">{a.mesesSerie > 0 ? `${a.mesesJaAtingiu} de ${a.mesesSerie} meses` : "sem histórico"}</td>
              <td className="py-1.5 text-right"><Selo tom={a.esforco === "menor" ? "verde" : a.esforco === "medio" ? "ambar" : "vermelho"}>{a.esforco === "menor" ? "Menor" : a.esforco === "medio" ? "Médio" : "Maior"}</Selo></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function fraseEsforco(meta: number, ranking: AlavancaRanking[]): string {
  const primeira = ranking[0];
  if (!primeira) return "Para " + brlCurto(meta) + ": você já passa dessa meta.";
  if (primeira.esforco === "menor") {
    return "Para " + brlCurto(meta) + ", a alavanca de menor esforço é " + primeira.rotulo.toLowerCase() + " (o nível necessário já foi atingido em " + primeira.mesesJaAtingiu + " de " + primeira.mesesSerie + " meses).";
  }
  return "Para " + brlCurto(meta) + ", nenhuma alavanca sozinha chegou lá dentro do que você já registrou; a de menor variação é " + primeira.rotulo.toLowerCase() + " (+" + fmtNum(primeira.variacaoPct, 0) + "%), então o caminho é combinar várias.";
}

function TextoCaminhos({ data, meta }: { data: PainelMetaDados; meta: number }) {
  const base = data.media12m;
  const r = caminhosParaMeta(data, meta);
  if (r.gap <= 0) return <p className="text-xs text-slate-500">Você já está acima de {brlCurto(meta)} em média.</p>;

  const cac = data.marketing?.cacPorNovo ?? null;
  const novosAdicionais = r.novos.adicionaisPorMesEmRegime;
  const ambosAcima = (r.conversao?.acimaDoMaximoHistorico ?? true) && r.novos.acimaDoMaximoHistorico;
  const potencialVendedores = data.vendedores.impactoFecharMetadeDoGap;

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-700">Para chegar em <strong>{brlCurto(meta)}</strong> faltam <strong>{brlCurto(r.gap)}</strong> por mês. Duas formas de buscar esse valor:</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-bold text-slate-800 flex items-center gap-2">A) Converter mais dos orçamentos que já recebe {r.conversao && <Selo tom={r.conversao.acimaDoMaximoHistorico ? "ambar" : "verde"}>{r.conversao.acimaDoMaximoHistorico ? "acima do que já aconteceu" : "dentro do histórico"}</Selo>}</p>
          {r.conversao ? (
            <>
              <p>Cada ponto percentual de conversão vale <strong>{brlCurto(r.conversao.valorPorPontoPercentual)}</strong> por mês. Seriam <strong>+{fmtNum(r.conversao.pontosNecessarios, 1)} pontos</strong> (de {fmtNum(data.funil.conversaoPct, 1)}% para {fmtNum(r.conversao.conversaoNecessariaPct, 1)}%).</p>
              <p>O melhor mês que você já teve foi {fmtNum(Math.max(...data.funil.mensal.map(m => m.conversaoPct ?? 0)), 1)}%. Efeito em 1 a 2 meses e sem custo de marketing.</p>
              {potencialVendedores !== null && potencialVendedores > 0 && <p>Só alinhar os vendedores ao melhor (metade da diferença) já vale cerca de <strong>{brlCurto(potencialVendedores)}</strong> por mês.</p>}
            </>
          ) : <p>Sem orçamentos suficientes para medir a conversão.</p>}
        </div>
        <div className="rounded-lg border border-slate-200 p-3 text-xs text-slate-600 space-y-1.5">
          <p className="font-bold text-slate-800 flex items-center gap-2">B) Cadastrar mais gráficas parceiras <Selo tom={r.novos.acimaDoMaximoHistorico ? "ambar" : "verde"}>{r.novos.acimaDoMaximoHistorico ? "acima do que já aconteceu" : "dentro do histórico"}</Selo></p>
          {novosAdicionais !== null ? (
            <>
              <p>Cada gráfica nova por mês rende <strong>{brlCurto(data.coorte.ltv12m ?? 0)}</strong> em 12 meses (já <strong>{brlCurto(data.coorte.meses[0]?.receitaPorParceiro ?? 0)}</strong> na 1ª compra). Seriam <strong>+{fmtNum(novosAdicionais, 0)} gráficas novas por mês</strong> (de {fmtNum(base.cenario.novos.clientes, 0)} para {fmtNum(r.novos.novosNecessariosEmRegime ?? 0, 0)}); o melhor mês foi {fmtNum(Math.max(...data.historico.map(h => h.clientes.novos)), 0)}.</p>
              <p>O efeito pleno leva ~12 meses{cac ? `; a aquisição custa hoje ${brlCurto(cac)} por gráfica (≈ ${brlCurto(cac * novosAdicionais)} por mês a mais em marketing)` : ""}.</p>
            </>
          ) : (
            <p>Só a 1ª compra: seriam +{fmtNum(r.novos.adicionaisPorMesImediato, 0)} gráficas novas por mês (sem dados de vida do parceiro para estimar o efeito de 12 meses).</p>
          )}
        </div>
      </div>
      <p className="text-xs text-slate-800 bg-blue-50 border border-blue-200 rounded-lg p-3">
        <strong>Leitura:</strong> {ambosAcima ? "nenhum dos dois caminhos, sozinho, fecha a meta dentro do que você já realizou em algum mês — o caminho é combinar. " : ""}
        A conversão age mais rápido (1 a 2 meses) e não depende de investimento; a aquisição constrói base e rende mais nos meses seguintes. Comece pela conversão — principalmente alinhando o follow-up dos vendedores — e mantenha a aquisição crescendo em paralelo, com a retenção protegendo o que já foi conquistado.
      </p>
    </div>
  );
}

export default function Comparativo({ data, meta1, meta2, setMeta1, setMeta2, pesoConversao, setPesoConversao, margemPct }: {
  data: PainelMetaDados;
  meta1: number;
  meta2: number;
  setMeta1: (v: number) => void;
  setMeta2: (v: number) => void;
  pesoConversao: number;
  setPesoConversao: (v: number) => void;
  margemPct: number;
}) {
  const linhas = montarComparativo(data, meta1, meta2, pesoConversao, margemPct);
  const grupos = Array.from(new Set(linhas.map(l => l.grupo)));
  const rank1 = rankingParaMeta(data, meta1);
  const rank2 = rankingParaMeta(data, meta2);
  const sensibilidades = calcularSensibilidades(data);

  return (
    <div className="space-y-4">
      <Cartao titulo="Hoje × Meta 1 × Meta 2" subtitulo="Para cada meta, o caminho equilibrado: todos os indicadores sobem na mesma proporção. Edite as metas para testar outros valores.">
        <div className="flex items-center gap-4 flex-wrap mb-3">
          <label className="flex items-center gap-2 text-xs text-slate-600">Meta 1 (R$/mês)<CampoNumero valor={meta1} casas={0} onChange={setMeta1} ariaLabel="Meta 1" className="h-8 w-28 text-right text-sm font-bold" /></label>
          <label className="flex items-center gap-2 text-xs text-slate-600">Meta 2 (R$/mês)<CampoNumero valor={meta2} casas={0} onChange={setMeta2} ariaLabel="Meta 2" className="h-8 w-28 text-right text-sm font-bold" /></label>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span>Vendas a mais vêm de:</span>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden">
              {OPCOES_FUNIL.map(o => (
                <button key={o.peso} type="button" title={o.dica} onClick={() => setPesoConversao(o.peso)} className={`px-2 py-1 text-[11px] ${pesoConversao === o.peso ? "bg-blue-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>{o.rotulo}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-slate-400">
                <th className="text-left font-medium pb-1">Indicador</th>
                <th className="text-right font-medium pb-1 px-2">Hoje (média 12 meses)</th>
                <th className="text-right font-medium pb-1 px-2">Meta {brlCurto(meta1)}</th>
                <th className="text-right font-medium pb-1 pl-2">Meta {brlCurto(meta2)}</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map(g => (
                <FragmentoGrupo key={g} grupo={g} linhas={linhas.filter(l => l.grupo === g)} />
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <Cartao titulo="Se mexer numa coisa só: onde o esforço é menor?" subtitulo="Cada alavanca sozinha, com as outras como estão. O esforço vem do seu histórico: um nível que você já atingiu em vários meses é mais fácil de repetir.">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div><p className="text-xs font-bold text-slate-700 mb-2">Para {brlCurto(meta1)}</p><TabelaAlavancas meta={meta1} alavancas={rank1} /></div>
          <div><p className="text-xs font-bold text-slate-700 mb-2">Para {brlCurto(meta2)}</p><TabelaAlavancas meta={meta2} alavancas={rank2} /></div>
        </div>
        <p className="text-xs text-slate-700 mt-3">
          <strong>Leitura:</strong> {fraseEsforco(meta1, rank1)} {fraseEsforco(meta2, rank2)}{" "}
          Como orçamentos, conversão e ticket valem o mesmo em proporção (faturamento = orçamentos × conversão × ticket), o que separa uma alavanca da outra é o quanto o nível exigido já foi visto no seu histórico.
        </p>
      </Cartao>

      <Cartao titulo={`Conversão dos orçamentos × mais gráficas parceiras — para ${brlCurto(meta2)}`} subtitulo="Qual caminho rende mais por esforço?">
        <TextoCaminhos data={data} meta={meta2} />
      </Cartao>

      <Cartao titulo="Quanto vale cada movimento" subtitulo="Efeito por mês, a partir da média dos últimos 12 meses">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-[11px] text-slate-400 text-left">
              <th className="font-medium pb-1">Movimento</th>
              <th className="font-medium pb-1 text-right">Vale por mês</th>
              <th className="font-medium pb-1 pl-4">Quando aparece</th>
            </tr>
          </thead>
          <tbody>
            {sensibilidades.map(s => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="py-1.5 text-slate-800">{s.rotulo}</td>
                <td className="py-1.5 text-right font-bold text-emerald-700">+{brlCurto(s.efeito)}{s.tipo === "contribuicao" && <span className="font-normal text-slate-400"> de contribuição</span>}</td>
                <td className="py-1.5 pl-4 text-slate-500">{s.prazo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Cartao>
    </div>
  );
}

function FragmentoGrupo({ grupo, linhas }: { grupo: string; linhas: LinhaComparativa[] }) {
  return (
    <>
      <tr><td colSpan={4} className="pt-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">{grupo}</td></tr>
      {linhas.map(l => (
        <tr key={l.id} className="border-t border-slate-100 align-top">
          <td className="py-1.5 pr-2">
            <span className="text-slate-800">{l.rotulo}</span>
            {l.nota && <span className="block text-[11px] text-slate-400">{l.nota}</span>}
          </td>
          <td className="py-1.5 px-2 text-right text-slate-500">{formatarValor(l, l.atual)}</td>
          <td className="py-1.5 px-2 text-right"><span className="font-semibold text-slate-800">{formatarValor(l, l.meta1)}</span><br /><Delta l={l} valor={l.meta1} /></td>
          <td className="py-1.5 pl-2 text-right"><span className="font-semibold text-slate-800">{formatarValor(l, l.meta2)}</span><br /><Delta l={l} valor={l.meta2} /></td>
        </tr>
      ))}
    </>
  );
}
