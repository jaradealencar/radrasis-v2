import { useState, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertCircle, Plus, RefreshCw, Zap, Download, CheckCircle2,
  Clock, Factory, Wifi, WifiOff, Search, Calendar, User, Package,
  ArrowRight, Loader2, ExternalLink,
} from "lucide-react";
import { toast } from "sonner";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface SetorStatus {
  id: number;
  setorNome: string;
  status: "nao_iniciado" | "em_andamento" | "concluido" | "atrasado" | "bloqueado";
  diasAlocados: number;
  dataFimPrevista: Date;
  emRisco: boolean;
}

interface OrdemProducao {
  id: number;
  osNumero: string;
  clienteNome: string;
  dataPrazo: Date;
  statusGeral: string;
  diasUteisTotais: number;
  setores?: SetorStatus[];
}

const STATUS_COLORS: Record<string, string> = {
  nao_iniciado: "bg-gray-100 text-gray-700",
  em_andamento: "bg-blue-100 text-blue-800",
  concluido: "bg-green-100 text-green-800",
  atrasado: "bg-red-100 text-red-800",
  bloqueado: "bg-orange-100 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não Iniciado",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
  bloqueado: "Bloqueado",
};

const MUBISYS_STATUS_COLORS: Record<string, string> = {
  "Pendente": "bg-yellow-100 text-yellow-800",
  "Em produção": "bg-blue-100 text-blue-800",
  "Concluído": "bg-green-100 text-green-800",
  "Cancelado": "bg-red-100 text-red-800",
  "Pausado": "bg-orange-100 text-orange-800",
  "Entregue": "bg-purple-100 text-purple-800",
};

// ─── Componente Principal ────────────────────────────────────────────────────

export default function PCPPage() {
  const [activeTab, setActiveTab] = useState("producao");
  const [osNumero, setOsNumero] = useState("");
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemProducao | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importandoId, setImportandoId] = useState<number | null>(null);
  const [buscaMubiSys, setBuscaMubiSys] = useState("");

  // Filtros MubiSys
  const [statusFiltro, setStatusFiltro] = useState<string>("PRODUCAO");
  const [dataInicial, setDataInicial] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [dataFinal, setDataFinal] = useState(() => new Date().toISOString().split("T")[0]);

  // ─── Queries ──────────────────────────────────────────────────────────────

  const conexaoQuery = trpc.pcp.verificarConexaoMubiSys.useQuery(undefined, {
    refetchOnWindowFocus: false,
    staleTime: 60_000,
  });

  const listarOrdensQuery = trpc.pcp.listar.useQuery({});

  const osMubiSysQuery = trpc.pcp.listarOSMubiSys.useQuery(
    {
      status: statusFiltro as any,
      filtrodata: "CADASTRO",
      datainicial: dataInicial,
      datafinal: dataFinal,
    },
    {
      enabled: activeTab === "mubisys",
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    }
  );

  // ─── Mutations ────────────────────────────────────────────────────────────

  const criarOrdemMutation = trpc.pcp.criarOrdemPorOS.useMutation();
  const importarOSMutation = trpc.pcp.importarOSMubiSys.useMutation();
  const verificarAtrasosM = trpc.pcp.verificarAtrasos.useMutation();

  useEffect(() => {
    if (listarOrdensQuery.data) {
      setOrdens(listarOrdensQuery.data as any);
    }
  }, [listarOrdensQuery.data]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleCriarOrdem = async () => {
    if (!osNumero.trim()) {
      toast.error("Informe o número da OS");
      return;
    }
    try {
      await criarOrdemMutation.mutateAsync({ osNumero: osNumero.trim() });
      toast.success(`Ordem criada para OS ${osNumero}`);
      setOsNumero("");
      setIsDialogOpen(false);
      listarOrdensQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar ordem");
    }
  };

  const handleImportarOS = async (os: any) => {
    setImportandoId(os.id);
    try {
      await importarOSMutation.mutateAsync({
        osId: os.id,
        osNumero: String(os.sequencial_ordem),
        clienteNome: os.cliente,
        descricaoPedido: os.nome_trabalho,
      });
      toast.success(`OS ${os.sequencial_ordem} importada para o PCP!`);
      listarOrdensQuery.refetch();
      setActiveTab("producao");
    } catch (error: any) {
      toast.error(error.message || "Erro ao importar OS");
    } finally {
      setImportandoId(null);
    }
  };

  const handleVerificarAtrasos = async (ordemId: number) => {
    try {
      await verificarAtrasosM.mutateAsync({ ordemId });
      toast.success("Atrasos verificados");
      listarOrdensQuery.refetch();
    } catch {
      toast.error("Erro ao verificar atrasos");
    }
  };

  // ─── Dados filtrados ───────────────────────────────────────────────────────

  const osImportadas = useMemo(() => new Set(ordens.map((o) => o.osNumero)), [ordens]);

  const osFiltradas = useMemo(() => {
    const lista = osMubiSysQuery.data?.data ?? [];
    if (!buscaMubiSys.trim()) return lista;
    const q = buscaMubiSys.toLowerCase();
    return lista.filter(
      (os: any) =>
        String(os.sequencial_ordem).includes(q) ||
        os.cliente?.toLowerCase().includes(q) ||
        os.nome_trabalho?.toLowerCase().includes(q)
    );
  }, [osMubiSysQuery.data, buscaMubiSys]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PCP — Controle de Produção</h1>
          <p className="text-gray-600 mt-1">Monitore o fluxo produtivo em tempo real</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Status da conexão MubiSys */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm">
            {conexaoQuery.isLoading ? (
              <Loader2 size={14} className="animate-spin text-gray-400" />
            ) : conexaoQuery.data?.ok ? (
              <>
                <Wifi size={14} className="text-green-500" />
                <span className="text-green-700 font-medium">MubiSys conectado</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-600">{conexaoQuery.data.empresa}</span>
              </>
            ) : (
              <>
                <WifiOff size={14} className="text-red-500" />
                <span className="text-red-700 font-medium">MubiSys offline</span>
              </>
            )}
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus size={18} />
            Nova Ordem
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="producao" className="gap-2">
            <Factory size={16} />
            Em Produção ({ordens.length})
          </TabsTrigger>
          <TabsTrigger value="mubisys" className="gap-2">
            <ExternalLink size={16} />
            OSs MubiSys
            {osMubiSysQuery.data && (
              <Badge variant="secondary" className="ml-1">
                {osMubiSysQuery.data.pagination.total}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ─── Aba: Ordens em Produção ─── */}
        <TabsContent value="producao">
          <div className="flex flex-wrap gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => listarOrdensQuery.refetch()}
              disabled={listarOrdensQuery.isLoading}
              className="gap-2"
            >
              <RefreshCw size={16} className={listarOrdensQuery.isLoading ? "animate-spin" : ""} />
              Atualizar
            </Button>
          </div>

          <div className="space-y-4">
            {ordens.length === 0 ? (
              <Card className="p-10 text-center">
                <Factory className="mx-auto mb-3 text-gray-300" size={40} />
                <p className="text-gray-600 font-medium">Nenhuma ordem de produção ativa</p>
                <p className="text-sm text-gray-500 mt-1">
                  Importe OSs da aba <strong>OSs MubiSys</strong> ou clique em <strong>Nova Ordem</strong>
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 gap-2"
                  onClick={() => setActiveTab("mubisys")}
                >
                  <ExternalLink size={14} />
                  Ver OSs do MubiSys
                </Button>
              </Card>
            ) : (
              ordens.map((ordem) => (
                <Card
                  key={ordem.id}
                  className="p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => setSelectedOrdem(ordem)}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 pb-4 border-b">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-lg font-bold text-gray-900">OS {ordem.osNumero}</h3>
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[ordem.statusGeral]}`}>
                          {STATUS_LABELS[ordem.statusGeral]}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{ordem.clienteNome}</p>
                    </div>
                    <div className="flex flex-col md:text-right">
                      <p className="text-sm text-gray-500">Prazo de Entrega</p>
                      <p className="font-semibold text-gray-900">
                        {new Date(ordem.dataPrazo).toLocaleDateString("pt-BR")}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">{ordem.diasUteisTotais} dias úteis</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Setores</p>
                    <div className="flex flex-wrap gap-2">
                      {ordem.setores && ordem.setores.length > 0 ? (
                        ordem.setores.map((setor) => (
                          <div
                            key={setor.id}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${STATUS_COLORS[setor.status]} ${setor.emRisco ? "ring-2 ring-yellow-400" : ""}`}
                            title={`${setor.setorNome} — ${STATUS_LABELS[setor.status]}`}
                          >
                            <div className="flex items-center gap-1">
                              {setor.emRisco && <Zap size={11} />}
                              <span>{setor.setorNome.replace(/_/g, " ")}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-gray-400">Nenhum setor definido</p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); handleVerificarAtrasos(ordem.id); }}
                      disabled={verificarAtrasosM.isPending}
                      className="gap-1"
                    >
                      <AlertCircle size={14} />
                      Verificar Atrasos
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* ─── Aba: OSs MubiSys ─── */}
        <TabsContent value="mubisys">
          {/* Filtros */}
          <Card className="p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Status</label>
                <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TODOS">Todos</SelectItem>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="PRODUCAO">Em Produção</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                    <SelectItem value="ENTREGUE">Entregue</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                    <SelectItem value="PAUSADO">Pausado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data inicial</label>
                <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="h-9 w-36" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Data final</label>
                <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="h-9 w-36" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="text-xs font-medium text-gray-600 mb-1 block">Buscar</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="OS, cliente, trabalho..."
                    value={buscaMubiSys}
                    onChange={(e) => setBuscaMubiSys(e.target.value)}
                    className="h-9 pl-8"
                  />
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => osMubiSysQuery.refetch()}
                disabled={osMubiSysQuery.isLoading}
                className="gap-2 h-9"
              >
                <RefreshCw size={14} className={osMubiSysQuery.isLoading ? "animate-spin" : ""} />
                Buscar
              </Button>
            </div>
          </Card>

          {/* Resumo */}
          {osMubiSysQuery.data && (
            <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
              <span><strong>{osMubiSysQuery.data.pagination.total}</strong> OSs encontradas</span>
              <span>·</span>
              <span><strong>{osImportadas.size}</strong> já importadas para o PCP</span>
              <span>·</span>
              <span className="text-blue-600"><strong>{osFiltradas.filter((o: any) => !osImportadas.has(String(o.sequencial_ordem))).length}</strong> disponíveis para importar</span>
            </div>
          )}

          {/* Lista de OSs */}
          {osMubiSysQuery.isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-500">
              <Loader2 className="animate-spin mr-2" size={20} />
              Buscando OSs no MubiSys...
            </div>
          ) : osMubiSysQuery.error ? (
            <Card className="p-8 text-center">
              <WifiOff className="mx-auto mb-3 text-red-400" size={32} />
              <p className="text-red-600 font-medium">Erro ao conectar com o MubiSys</p>
              <p className="text-sm text-gray-500 mt-1">{osMubiSysQuery.error.message}</p>
            </Card>
          ) : osFiltradas.length === 0 ? (
            <Card className="p-8 text-center">
              <Package className="mx-auto mb-3 text-gray-300" size={32} />
              <p className="text-gray-600">Nenhuma OS encontrada com os filtros aplicados</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {osFiltradas.map((os: any) => {
                const jaImportada = osImportadas.has(String(os.sequencial_ordem));
                return (
                  <Card
                    key={os.id}
                    className={`p-4 transition-all ${jaImportada ? "opacity-60 bg-gray-50" : "hover:shadow-md"}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      {/* Número OS */}
                      <div className="w-20 shrink-0">
                        <p className="text-xs text-gray-500">OS</p>
                        <p className="font-bold text-gray-900 text-lg">#{os.sequencial_ordem}</p>
                      </div>

                      {/* Informações */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${MUBISYS_STATUS_COLORS[os.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {os.status}
                          </span>
                          {os.prazo && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={11} />
                              {os.prazo}
                            </span>
                          )}
                          {os.logistica && (
                            <span className="text-xs text-gray-500">{os.logistica}</span>
                          )}
                        </div>
                        <p className="font-semibold text-gray-900 truncate">{os.nome_trabalho || "Sem título"}</p>
                        <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <User size={12} />
                            {os.cliente}
                          </span>
                          {os.vendedor && (
                            <span className="text-xs text-gray-400">Vendedor: {os.vendedor}</span>
                          )}
                        </div>
                      </div>

                      {/* Datas e Valor */}
                      <div className="shrink-0 text-right hidden md:block">
                        <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
                          <Calendar size={11} />
                          {os.data_cadastro ? new Date(os.data_cadastro).toLocaleDateString("pt-BR") : "—"}
                        </p>
                        {os.data_entrega && (
                          <p className="text-xs text-orange-600 mt-0.5">
                            Entrega: {new Date(os.data_entrega).toLocaleDateString("pt-BR")}
                          </p>
                        )}
                        {os.valor_total > 0 && (
                          <p className="text-sm font-semibold text-gray-800 mt-1">
                            {Number(os.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </p>
                        )}
                      </div>

                      {/* Ação */}
                      <div className="shrink-0">
                        {jaImportada ? (
                          <div className="flex items-center gap-1.5 text-green-600 text-sm font-medium px-3 py-2">
                            <CheckCircle2 size={16} />
                            Importada
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleImportarOS(os)}
                            disabled={importandoId === os.id}
                            className="gap-2 whitespace-nowrap"
                          >
                            {importandoId === os.id ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Download size={14} />
                            )}
                            {importandoId === os.id ? "Importando..." : "Importar para PCP"}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Itens */}
                    {os.itens && os.itens.length > 0 && (
                      <div className="mt-3 pt-3 border-t flex flex-wrap gap-1.5">
                        {os.itens.slice(0, 4).map((item: any, i: number) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {item.item}
                          </span>
                        ))}
                        {os.itens.length > 4 && (
                          <span className="text-xs text-gray-400">+{os.itens.length - 4} itens</span>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog: Criar Ordem Manual */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Ordem de Produção</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Número da OS (MubiSys)
              </label>
              <Input
                placeholder="Ex: 6951"
                value={osNumero}
                onChange={(e) => setOsNumero(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCriarOrdem(); }}
              />
              <p className="text-xs text-gray-500 mt-1">
                Informe o número sequencial da OS no MubiSys. Os dados serão buscados automaticamente.
              </p>
            </div>
            <Button
              onClick={handleCriarOrdem}
              disabled={criarOrdemMutation.isPending}
              className="w-full gap-2"
            >
              {criarOrdemMutation.isPending ? (
                <><Loader2 size={16} className="animate-spin" />Buscando no MubiSys...</>
              ) : (
                <><ArrowRight size={16} />Criar Ordem</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes da Ordem */}
      {selectedOrdem && (
        <Dialog open={!!selectedOrdem} onOpenChange={() => setSelectedOrdem(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>OS {selectedOrdem.osNumero} — {selectedOrdem.clienteNome}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[selectedOrdem.statusGeral]}`}>
                    {STATUS_LABELS[selectedOrdem.statusGeral]}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Prazo de Entrega</p>
                  <p className="font-semibold">{new Date(selectedOrdem.dataPrazo).toLocaleDateString("pt-BR")}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Dias Úteis</p>
                  <p className="font-semibold">{selectedOrdem.diasUteisTotais} dias</p>
                </div>
              </div>
              {selectedOrdem.setores && selectedOrdem.setores.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Setores de Produção</p>
                  <div className="space-y-2">
                    {selectedOrdem.setores.map((setor) => (
                      <div key={setor.id} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center gap-2">
                          {setor.emRisco && <Zap size={14} className="text-yellow-500" />}
                          <span className="text-sm font-medium capitalize">{setor.setorNome.replace(/_/g, " ")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            até {new Date(setor.dataFimPrevista).toLocaleDateString("pt-BR")}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_COLORS[setor.status]}`}>
                            {STATUS_LABELS[setor.status]}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
