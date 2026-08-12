import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Streamdown } from "streamdown";
import {
  FileText, Sparkles, Save, Truck, Package, TrendingUp, TrendingDown,
  AlertTriangle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function fmtR(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPerc(v: number) {
  return (v * 100).toFixed(1) + "%";
}

export default function ObservacoesMensais({ anoSel }: { anoSel: number }) {
  const [mesSel, setMesSel] = useState(() => {
    const now = new Date();
    return now.getFullYear() === anoSel ? now.getMonth() + 1 : 1;
  });

  // Queries
  const { data: obs, refetch: refetchObs } = trpc.observacoesFinanceiras.get.useQuery(
    { mes: mesSel, ano: anoSel },
    { enabled: mesSel > 0 }
  );
  const { data: dados } = trpc.observacoesFinanceiras.getDadosComplementares.useQuery(
    { mes: mesSel, ano: anoSel },
    { enabled: mesSel > 0 }
  );

  // Mutations
  const salvarMut = trpc.observacoesFinanceiras.salvar.useMutation({
    onSuccess: () => { toast.success("Observações salvas!"); refetchObs(); },
    onError: (e) => toast.error("Erro: " + e.message),
  });
  const gerarAnaliseMut = trpc.observacoesFinanceiras.gerarAnalise.useMutation({
    onSuccess: () => { toast.success("Análise gerada com sucesso!"); refetchObs(); },
    onError: (e) => toast.error("Erro ao gerar análise: " + e.message),
  });

  // Estado local do editor
  const [observacoesManuais, setObservacoesManuais] = useState("");
  const [contextosTexto, setContextosTexto] = useState("");
  const [editando, setEditando] = useState(false);

  // Sincronizar com dados do banco
  useMemo(() => {
    if (obs) {
      setObservacoesManuais(obs.observacoesManuais || "");
      try {
        const ctxs = JSON.parse(obs.contextosEspecificos || "[]");
        setContextosTexto(Array.isArray(ctxs) ? ctxs.join("\n") : "");
      } catch { setContextosTexto(""); }
    } else {
      setObservacoesManuais("");
      setContextosTexto("");
    }
  }, [obs]);

  function handleSalvar() {
    const contextos = contextosTexto
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);
    salvarMut.mutate({
      mes: mesSel,
      ano: anoSel,
      observacoesManuais,
      contextosEspecificos: JSON.stringify(contextos),
    });
    setEditando(false);
  }

  function handleGerarAnalise() {
    // Salvar primeiro, depois gerar
    const contextos = contextosTexto
      .split("\n")
      .map(l => l.trim())
      .filter(l => l.length > 0);
    salvarMut.mutate({
      mes: mesSel,
      ano: anoSel,
      observacoesManuais,
      contextosEspecificos: JSON.stringify(contextos),
    }, {
      onSuccess: () => {
        gerarAnaliseMut.mutate({ mes: mesSel, ano: anoSel });
      }
    });
  }

  // Transportadoras ordenadas por valor
  const transpOrdenadas = useMemo(() => {
    if (!dados?.transportadoras?.porNome) return [];
    return Object.entries(dados.transportadoras.porNome)
      .map(([nome, v]) => ({ nome, total: v.total, qtd: v.qtd }))
      .sort((a, b) => b.total - a.total);
  }, [dados]);

  // Embalagem por insumo ordenado
  const embalagemOrdenada = useMemo(() => {
    if (!dados?.embalagem?.porInsumo) return [];
    return Object.entries(dados.embalagem.porInsumo)
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => b.total - a.total);
  }, [dados]);

  return (
    <div className="space-y-6">
      {/* Seletor de mês */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMesSel(m => Math.max(1, m - 1))}
          disabled={mesSel <= 1}
        >
          <ChevronLeft size={14} />
        </Button>
        <h2 className="text-lg font-semibold min-w-[180px] text-center">
          {MESES[mesSel - 1]} / {anoSel}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setMesSel(m => Math.min(12, m + 1))}
          disabled={mesSel >= 12}
        >
          <ChevronRight size={14} />
        </Button>
        <div className="flex gap-1 ml-4 flex-wrap">
          {MESES.map((m, i) => (
            <button
              key={i}
              onClick={() => setMesSel(i + 1)}
              className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                mesSel === i + 1
                  ? "bg-blue-600 text-white"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Cards de dados complementares */}
      {dados && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Custos Fixos Previsto vs Real */}
          <Card className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {dados.custosFixos.variacao > 0 ? (
                  <TrendingUp size={16} className="text-red-500" />
                ) : (
                  <TrendingDown size={16} className="text-green-500" />
                )}
                Custos Fixos — Previsto vs Real
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Previsto (cadastro):</span>
                <span className="font-medium">{fmtR(dados.custosFixos.previstos)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Real (DRE):</span>
                <span className="font-medium">{fmtR(dados.custosFixos.reais)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-sm font-semibold">
                <span>Variação:</span>
                <span className={dados.custosFixos.variacao > 0 ? "text-red-600" : "text-green-600"}>
                  {dados.custosFixos.variacao > 0 ? "+" : ""}{fmtR(dados.custosFixos.variacao)}
                </span>
              </div>
              {dados.custosFixos.previstos > 0 && (
                <div className="text-xs text-muted-foreground text-right">
                  {fmtPerc(dados.custosFixos.variacao / dados.custosFixos.previstos)} do previsto
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transportadoras */}
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Truck size={16} className="text-blue-500" />
                Gastos com Transportadoras
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total gasto:</span>
                <span className="font-bold text-blue-700">{fmtR(dados.transportadoras.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">CTe emitidos:</span>
                <span className="font-medium">{dados.transportadoras.qtdCtes}</span>
              </div>
              {transpOrdenadas.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Top transportadoras:</p>
                  {transpOrdenadas.slice(0, 4).map(t => (
                    <div key={t.nome} className="flex justify-between text-xs">
                      <span className="truncate max-w-[140px]">{t.nome}</span>
                      <span className="font-medium">{fmtR(t.total)} ({t.qtd})</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Embalagem */}
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package size={16} className="text-purple-500" />
                Custo de Embalagem
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total estimado:</span>
                <span className="font-bold text-purple-700">{fmtR(dados.embalagem.total)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pedidos embalados:</span>
                <span className="font-medium">{dados.embalagem.qtdPedidos}</span>
              </div>
              {dados.embalagem.qtdPedidos > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Custo médio/pedido:</span>
                  <span className="font-medium">{fmtR(dados.embalagem.total / dados.embalagem.qtdPedidos)}</span>
                </div>
              )}
              {embalagemOrdenada.length > 0 && (
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Por insumo:</p>
                  {embalagemOrdenada.slice(0, 4).map(e => (
                    <div key={e.nome} className="flex justify-between text-xs">
                      <span className="truncate max-w-[140px]">{e.nome}</span>
                      <span className="font-medium">{fmtR(e.total)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Editor de Observações Manuais */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText size={18} className="text-amber-600" />
              Observações do Mês — {MESES[mesSel - 1]}/{anoSel}
            </CardTitle>
            <div className="flex gap-2">
              {!editando ? (
                <Button size="sm" variant="outline" onClick={() => setEditando(true)}>
                  <FileText size={14} className="mr-1" /> Editar
                </Button>
              ) : (
                <Button size="sm" onClick={handleSalvar} disabled={salvarMut.isPending}>
                  <Save size={14} className="mr-1" /> Salvar
                </Button>
              )}
              <Button
                size="sm"
                variant="default"
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                onClick={handleGerarAnalise}
                disabled={gerarAnaliseMut.isPending || salvarMut.isPending}
              >
                {gerarAnaliseMut.isPending ? (
                  <Spinner className="size-3.5 mr-1" />
                ) : (
                  <Sparkles size={14} className="mr-1" />
                )}
                {gerarAnaliseMut.isPending ? "Gerando..." : "Gerar Análise IA"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Observações manuais */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Observações gerais (escreva livremente sobre o que aconteceu neste mês)
            </label>
            {editando ? (
              <Textarea
                value={observacoesManuais}
                onChange={e => setObservacoesManuais(e.target.value)}
                placeholder="Ex: Em abril tivemos um prejuízo expressivo por conta de reposição de estoque que não estava prevista. Pagamos honorários de contabilidade em atraso..."
                className="min-h-[120px] text-sm"
              />
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 min-h-[80px] text-sm whitespace-pre-wrap">
                {observacoesManuais || <span className="text-muted-foreground italic">Nenhuma observação registrada. Clique em "Editar" para adicionar.</span>}
              </div>
            )}
          </div>

          {/* Contextos específicos */}
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-1 block">
              Contextos específicos (um por linha — a IA vai considerar cada um na análise)
            </label>
            {editando ? (
              <Textarea
                value={contextosTexto}
                onChange={e => setContextosTexto(e.target.value)}
                placeholder={"Reposição de estoque de chapas de ACM\nPagamento em duplicidade da ajuda de custo (abril+maio)\nHonorários de contabilidade atrasados\nFormação de estoque de LED"}
                className="min-h-[100px] text-sm font-mono"
              />
            ) : (
              <div className="bg-muted/30 rounded-lg p-4 min-h-[60px]">
                {contextosTexto ? (
                  <div className="flex flex-wrap gap-2">
                    {contextosTexto.split("\n").filter(l => l.trim()).map((ctx, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <AlertTriangle size={10} className="mr-1" />
                        {ctx}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground italic text-sm">Nenhum contexto específico. Clique em "Editar" para adicionar.</span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Análise gerada pela IA */}
      {(obs?.analiseIa || gerarAnaliseMut.isPending) && (
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/50 to-blue-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles size={18} className="text-purple-600" />
              Análise Financeira — {MESES[mesSel - 1]}/{anoSel}
              <Badge variant="secondary" className="text-xs ml-2">Gerado por IA</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {gerarAnaliseMut.isPending ? (
              <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
                <Spinner className="size-5" />
                <span>Analisando dados financeiros e gerando relatório...</span>
              </div>
            ) : obs?.analiseIa ? (
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <Streamdown>{obs.analiseIa}</Streamdown>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
