import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutGrid, Target, RefreshCw, Table2, ListTree, Settings2,
  Upload, Loader2, AlertTriangle, TrendingUp, Gauge,
} from "lucide-react";
import FiltrosMarketing, { type FiltrosMarketingState } from "./FiltrosMarketing";
import MarketingVisaoGeral from "./MarketingVisaoGeral";
import MarketingAquisicao from "./MarketingAquisicao";
import MarketingReativacao from "./MarketingReativacao";
import MarketingAnaliseMensal from "./MarketingAnaliseMensal";
import MarketingConfiguracoes from "./MarketingConfiguracoes";
import MarketingDrillDownDialog from "./MarketingDrillDownDialog";
import DetalhamentoMarketing from "./DetalhamentoMarketing";
import ImportarCustoMarketing from "./ImportarCustoMarketing";
import ResultadoGeral from "./ResultadoGeral";

interface Props {
  anoSel: number;
}

type Categoria = "novo" | "recorrenteAtivo" | "reativado" | null;

export default function MarketingFinanceiro({ anoSel }: Props) {
  const [abaPrincipal, setAbaPrincipal] = useState<"marketing" | "resultado">("marketing");
  const [importOpen, setImportOpen] = useState(false);
  const [filtros, setFiltros] = useState<FiltrosMarketingState>({ mesFiltro: null, vendedor: null, cidade: null, classificacao: null });
  const [drillDown, setDrillDown] = useState<{ mes: number | null; categoria: Categoria; titulo: string } | null>(null);

  const {
    data: relatorio, isLoading, isError, refetch,
  } = trpc.marketingFinanceiro.getRelatorioAno.useQuery({ ano: anoSel, vendedor: filtros.vendedor, cidade: filtros.cidade });
  const { data: config } = trpc.marketingFinanceiro.getConfig.useQuery();
  const { data: opcoesFiltro } = trpc.marketingFinanceiro.getFiltrosDisponiveis.useQuery({ ano: anoSel });

  const mesesComDados = useMemo(() => (relatorio?.meses ?? [])
    .filter(m => m.investimentoAquisicao != null || m.investimentoReativacao != null || m.faturamentoTotalValido > 0)
    .map(m => ({ mes: m.mes, abrev: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][m.mes - 1] })),
    [relatorio]);

  if (isLoading || !config) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 size={28} className="animate-spin" />
        <p className="text-sm">Carregando dados de marketing...</p>
      </div>
    );
  }

  if (isError || !relatorio) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <AlertTriangle size={28} className="text-amber-500" />
        <p className="text-sm">Não foi possível carregar os dados. Verifique sua conexão.</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={abaPrincipal} onValueChange={v => setAbaPrincipal(v as typeof abaPrincipal)}>
        <TabsList>
          <TabsTrigger value="marketing" className="gap-1.5"><TrendingUp size={14} /> Marketing, Clientes e Receita</TabsTrigger>
          <TabsTrigger value="resultado" className="gap-1.5"><Gauge size={14} /> Resultado Geral e Ponto de Equilíbrio</TabsTrigger>
        </TabsList>

        <TabsContent value="marketing" className="pt-4">
          <Tabs defaultValue="geral">
            <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
              <TabsList>
                <TabsTrigger value="geral" className="gap-1.5"><LayoutGrid size={14} /> Visão Geral</TabsTrigger>
                <TabsTrigger value="aquisicao" className="gap-1.5"><Target size={14} /> Aquisição</TabsTrigger>
                <TabsTrigger value="reativacao" className="gap-1.5"><RefreshCw size={14} /> Reativação</TabsTrigger>
                <TabsTrigger value="mensal" className="gap-1.5"><Table2 size={14} /> Análise Mensal</TabsTrigger>
                <TabsTrigger value="fornecedor" className="gap-1.5"><ListTree size={14} /> Detalhamento por Fornecedor</TabsTrigger>
                <TabsTrigger value="config" className="gap-1.5"><Settings2 size={14} /> Configurações</TabsTrigger>
              </TabsList>
              <Button size="sm" variant="outline" className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50" onClick={() => setImportOpen(true)}>
                <Upload size={14} /> Importar planilha
              </Button>
            </div>

            <ImportarCustoMarketing open={importOpen} onOpenChange={setImportOpen} anoSel={anoSel} onImported={() => refetch()} />

            <TabsContent value="geral" className="space-y-4">
              <FiltrosMarketing
                state={filtros} onChange={setFiltros} mesesComDados={mesesComDados}
                vendedoresDisponiveis={opcoesFiltro?.vendedores ?? []} cidadesDisponiveis={opcoesFiltro?.cidades ?? []}
              />
              <MarketingVisaoGeral
                ano={anoSel} relatorio={relatorio} config={config} mesFiltro={filtros.mesFiltro}
                onDrillDown={args => setDrillDown(args)}
              />
            </TabsContent>

            <TabsContent value="aquisicao" className="space-y-4">
              <FiltrosMarketing state={filtros} onChange={setFiltros} mesesComDados={mesesComDados} vendedoresDisponiveis={opcoesFiltro?.vendedores ?? []} cidadesDisponiveis={opcoesFiltro?.cidades ?? []} ocultarClassificacao />
              <MarketingAquisicao ano={anoSel} relatorio={relatorio} mesFiltro={filtros.mesFiltro} onDrillDown={args => setDrillDown(args)} />
            </TabsContent>

            <TabsContent value="reativacao" className="space-y-4">
              <FiltrosMarketing state={filtros} onChange={setFiltros} mesesComDados={mesesComDados} vendedoresDisponiveis={opcoesFiltro?.vendedores ?? []} cidadesDisponiveis={opcoesFiltro?.cidades ?? []} ocultarClassificacao />
              <MarketingReativacao ano={anoSel} relatorio={relatorio} mesFiltro={filtros.mesFiltro} onDrillDown={args => setDrillDown(args)} />
            </TabsContent>

            <TabsContent value="mensal">
              <MarketingAnaliseMensal ano={anoSel} relatorio={relatorio} refetch={refetch} />
            </TabsContent>

            <TabsContent value="fornecedor">
              <DetalhamentoMarketing anoSel={anoSel} />
            </TabsContent>

            <TabsContent value="config">
              <MarketingConfiguracoes />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="resultado" className="pt-4">
          <ResultadoGeral anoSel={anoSel} />
        </TabsContent>
      </Tabs>

      {drillDown && (
        <MarketingDrillDownDialog
          open={!!drillDown}
          onOpenChange={(open) => { if (!open) setDrillDown(null); }}
          ano={anoSel}
          mes={drillDown.mes}
          categoria={drillDown.categoria}
          titulo={drillDown.titulo}
        />
      )}
    </div>
  );
}
