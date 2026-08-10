import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Plus, RefreshCw, Zap } from "lucide-react";
import { toast } from "sonner";

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
  nao_iniciado: "bg-gray-200 text-gray-800",
  em_andamento: "bg-blue-200 text-blue-800",
  concluido: "bg-green-200 text-green-800",
  atrasado: "bg-red-200 text-red-800",
  bloqueado: "bg-orange-200 text-orange-800",
};

const STATUS_LABELS: Record<string, string> = {
  nao_iniciado: "Não Iniciado",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  atrasado: "Atrasado",
  bloqueado: "Bloqueado",
};

export default function PCPPage() {
  const [osNumero, setOsNumero] = useState("");
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [selectedOrdem, setSelectedOrdem] = useState<OrdemProducao | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const criarOrdemMutation = trpc.pcp.criarOrdemPorOS.useMutation();
  const listarOrdensQuery = trpc.pcp.listar.useQuery({});
  const verificarAtrasosM = trpc.pcp.verificarAtrasos.useMutation();

  useEffect(() => {
    if (listarOrdensQuery.data) {
      setOrdens(listarOrdensQuery.data as any);
    }
  }, [listarOrdensQuery.data]);

  const handleCriarOrdem = async () => {
    if (!osNumero.trim()) {
      toast.error("Informe o número da OS");
      return;
    }

    try {
      const resultado = await criarOrdemMutation.mutateAsync({
        osNumero: osNumero.trim(),
      });

      toast.success(`Ordem de produção criada para OS ${osNumero}`);
      setOsNumero("");
      setIsDialogOpen(false);
      listarOrdensQuery.refetch();
    } catch (error: any) {
      toast.error(error.message || "Erro ao criar ordem");
    }
  };

  const handleVerificarAtrasos = async (ordemId: number) => {
    try {
      await verificarAtrasosM.mutateAsync({ ordemId });
      toast.success("Atrasos verificados");
      listarOrdensQuery.refetch();
    } catch (error: any) {
      toast.error("Erro ao verificar atrasos");
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">PCP - Programa de Controle de Produção</h1>
          <p className="text-gray-600 mt-1">Monitore o fluxo produtivo em tempo real</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus size={18} />
              Nova Ordem
            </Button>
          </DialogTrigger>
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
                  placeholder="Ex: OS-2026-001"
                  value={osNumero}
                  onChange={(e) => setOsNumero(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCriarOrdem();
                  }}
                />
              </div>
              <Button
                onClick={handleCriarOrdem}
                disabled={criarOrdemMutation.isPending}
                className="w-full"
              >
                {criarOrdemMutation.isPending ? "Criando..." : "Criar Ordem"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filtros e Ações */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => listarOrdensQuery.refetch()}
          disabled={listarOrdensQuery.isLoading}
          className="gap-2"
        >
          <RefreshCw size={16} />
          Atualizar
        </Button>
      </div>

      {/* Lista de Ordens */}
      <div className="space-y-4">
        {ordens.length === 0 ? (
          <Card className="p-8 text-center">
            <AlertCircle className="mx-auto mb-3 text-gray-400" size={32} />
            <p className="text-gray-600">Nenhuma ordem de produção criada ainda</p>
            <p className="text-sm text-gray-500 mt-1">Clique em "Nova Ordem" para começar</p>
          </Card>
        ) : (
          ordens.map((ordem) => (
            <Card
              key={ordem.id}
              className="p-4 md:p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => setSelectedOrdem(ordem)}
            >
              {/* Cabeçalho da Ordem */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4 pb-4 border-b">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-900">OS {ordem.osNumero}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${STATUS_COLORS[ordem.statusGeral]}`}
                    >
                      {STATUS_LABELS[ordem.statusGeral]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{ordem.clienteNome}</p>
                </div>

                <div className="flex flex-col md:text-right">
                  <p className="text-sm text-gray-600">Prazo de Entrega</p>
                  <p className="font-semibold text-gray-900">
                    {new Date(ordem.dataPrazo).toLocaleDateString("pt-BR")}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{ordem.diasUteisTotais} dias úteis</p>
                </div>
              </div>

              {/* Timeline de Setores */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase">Setores</p>
                <div className="flex flex-wrap gap-2">
                  {ordem.setores && ordem.setores.length > 0 ? (
                    ordem.setores.map((setor) => (
                      <div
                        key={setor.id}
                        className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                          STATUS_COLORS[setor.status]
                        } ${setor.emRisco ? "ring-2 ring-yellow-400" : ""}`}
                        title={`${setor.setorNome} - ${STATUS_LABELS[setor.status]}`}
                      >
                        <div className="flex items-center gap-1">
                          {setor.emRisco && <Zap size={12} />}
                          <span>{setor.setorNome}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-gray-500">Nenhum setor definido</p>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleVerificarAtrasos(ordem.id);
                  }}
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

      {/* Modal de Detalhes (Placeholder para próxima fase) */}
      {selectedOrdem && (
        <Dialog open={!!selectedOrdem} onOpenChange={() => setSelectedOrdem(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Detalhes da Ordem - OS {selectedOrdem.osNumero}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Cliente</p>
                  <p className="font-semibold">{selectedOrdem.clienteNome}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Prazo</p>
                  <p className="font-semibold">
                    {new Date(selectedOrdem.dataPrazo).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-600">
                Modal de detalhes será implementado na próxima fase
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
