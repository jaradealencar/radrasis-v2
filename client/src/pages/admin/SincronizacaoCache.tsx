import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

export default function SincronizacaoCache() {
  const [isSyncing, setIsSyncing] = useState(false);

  // ✅ Buscar status de sincronização
  const utils = trpc.useUtils();
  const { data: status, isLoading } = trpc.admin.obterStatusSincronizacao.useQuery(
    undefined,
    {
      refetchInterval: 30000, // Atualizar a cada 30s
    }
  );

  // ✅ Health check do ERP (Fase 5) — consulta pontual e barata, não a listagem
  const { data: conexaoErp, isLoading: isLoadingConexao } = trpc.admin.verificarConexaoErp.useQuery(
    undefined,
    {
      refetchInterval: 60000, // Atualizar a cada 60s
    }
  );

  // ✅ Mutation para forçar sincronização manual
  const forcarSincronizacao = trpc.admin.forcarSincronizacaoManual.useMutation({
    onSuccess: () => {
      toast.success("✅ Sincronização iniciada! Aguarde...");
      setIsSyncing(true);
      setTimeout(() => {
        utils.admin.obterStatusSincronizacao.invalidate();
        setIsSyncing(false);
      }, 3000);
    },
    onError: (error) => {
      toast.error(`❌ Erro: ${error.message}`);
      setIsSyncing(false);
    },
  });

  const statusSincronizacao = status?.status || "DESCONHECIDO";
  const isSuccess = statusSincronizacao === "SUCESSO";
  const isError = statusSincronizacao === "ERRO";
  const isPending = statusSincronizacao === "PENDENTE";

  const getStatusColor = () => {
    if (isSuccess) return "bg-green-50 border-green-200";
    if (isError) return "bg-red-50 border-red-200";
    if (isPending) return "bg-yellow-50 border-yellow-200";
    return "bg-slate-50 border-slate-200";
  };

  const getStatusIcon = () => {
    if (isSuccess) return <CheckCircle2 className="w-5 h-5 text-green-600" />;
    if (isError) return <AlertCircle className="w-5 h-5 text-red-600" />;
    if (isPending) return <Spinner className="size-5 text-yellow-600" />;
    return <Database className="w-5 h-5 text-slate-600" />;
  };

  const getStatusLabel = () => {
    if (isSuccess) return "✅ Sincronizado";
    if (isError) return "❌ Erro";
    if (isPending) return "⏳ Pendente";
    return "❓ Desconhecido";
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="📊 Status de Sincronização ERP"
        description="Monitore o cache local de Ordens de Serviço (OSs) sincronizadas do MubiSys"
      />

      {/* ✅ Badge de conectividade com o ERP (Fase 5) */}
      <div className="flex flex-wrap items-center gap-2">
        {isLoadingConexao ? (
          <Badge variant="secondary">Verificando conexão com o ERP…</Badge>
        ) : conexaoErp?.ok ? (
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
            ✅ ERP acessível{conexaoErp.latenciaMs != null ? ` · ${conexaoErp.latenciaMs} ms` : ""}
          </Badge>
        ) : (
          <Badge variant="destructive">
            ❌ ERP inacessível{conexaoErp?.erro ? `: ${conexaoErp.erro}` : ""}
          </Badge>
        )}
        {conexaoErp?.tokenExpiradoEm && (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            ⚠️ Token vencido em {new Date(conexaoErp.tokenExpiradoEm).toLocaleDateString("pt-BR")}
          </Badge>
        )}
      </div>

      {/* ✅ Card Principal de Status */}
      <Card className={`border-2 p-6 ${getStatusColor()}`}>
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <h2 className="text-lg font-semibold">Status da Sincronização</h2>
                <p className="text-sm text-slate-600">Última execução</p>
              </div>
            </div>
            <Badge variant={isSuccess ? "default" : "secondary"} className="text-base px-3 py-1">
              {getStatusLabel()}
            </Badge>
          </div>

          {/* Grid de Informações */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {/* Total de OSs */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <p className="text-sm text-slate-600 font-medium">Total de OSs em Cache</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">
                {isLoading ? "..." : status?.totalOs || 0}
              </p>
              <p className="text-xs text-slate-500 mt-1">Últimos 30 dias</p>
            </div>

            {/* Última Sincronização */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-600" />
                <p className="text-sm text-slate-600 font-medium">Última Sincronização</p>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-2">
                {isLoading ? "..." : status?.ultimaSincronizacao
                  ? new Date(status.ultimaSincronizacao).toLocaleString("pt-BR")
                  : "Nunca"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Data e hora</p>
            </div>

            {/* Próxima Sincronização */}
            <div className="bg-white rounded-lg p-4 border border-slate-200">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-slate-600" />
                <p className="text-sm text-slate-600 font-medium">Próxima Sincronização</p>
              </div>
              <p className="text-lg font-bold text-slate-900 mt-2">
                {isLoading ? "..." : status?.proximaExecucao
                  ? new Date(status.proximaExecucao).toLocaleString("pt-BR")
                  : "Agendada"}
              </p>
              <p className="text-xs text-slate-500 mt-1">Próximo horário</p>
            </div>
          </div>

          {/* Mensagem de Erro (se houver) */}
          {status?.mensagemErro && (
            <div className="bg-red-100 border border-red-300 rounded-lg p-4 mt-4">
              <p className="text-sm text-red-800">
                <strong>Erro na última sincronização:</strong> {status.mensagemErro}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ✅ Card de Ações */}
      <Card className="p-6 border-2 border-slate-200">
        <h3 className="text-lg font-semibold mb-4">🔧 Ações Disponíveis</h3>

        <div className="space-y-3">
          <Button
            onClick={() => forcarSincronizacao.mutate()}
            disabled={isSyncing || forcarSincronizacao.isPending}
            className="w-full md:w-auto"
            size="lg"
          >
            {isSyncing || forcarSincronizacao.isPending ? (
              <>
                <Spinner className="mr-2" />
                Sincronizando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Forçar Sincronização Agora
              </>
            )}
          </Button>

          <p className="text-sm text-slate-600">
            Clique para sincronizar imediatamente as OSs dos últimos 30 dias do MubiSys.
            Isso pode levar alguns segundos.
          </p>
        </div>
      </Card>

      {/* ✅ Card de Informações */}
      <Card className="p-6 border-2 border-slate-200">
        <h3 className="text-lg font-semibold mb-4">ℹ️ Como Funciona</h3>

        <div className="space-y-3 text-sm text-slate-700">
          <div className="flex gap-3">
            <span className="font-bold text-blue-600 min-w-fit">1️⃣ Sincronização Diária:</span>
            <span>
              O sistema roda automaticamente em <strong>4 lotes</strong>, a partir das 03:00 BRT —
              é normal ver 4 linhas por dia no histórico, não é duplicação
            </span>
          </div>

          <div className="flex gap-3">
            <span className="font-bold text-blue-600 min-w-fit">2️⃣ Cache Local:</span>
            <span>As OSs dos últimos ~32 dias são armazenadas localmente para acesso rápido</span>
          </div>

          <div className="flex gap-3">
            <span className="font-bold text-blue-600 min-w-fit">3️⃣ Busca Instantânea:</span>
            <span>Quando você digita uma OS, o sistema busca primeiro no cache (&lt;1ms)</span>
          </div>

          <div className="flex gap-3">
            <span className="font-bold text-blue-600 min-w-fit">4️⃣ Fallback API:</span>
            <span>Se a OS não estiver em cache, o sistema busca na API MubiSys</span>
          </div>
        </div>
      </Card>

      {/* ✅ Card de Estatísticas */}
      {status && (
        <Card className="p-6 border-2 border-slate-200">
          <h3 className="text-lg font-semibold mb-4">📈 Estatísticas</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Tempo da Última Sincronização</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {status.tempoExecucaoMs ? `${status.tempoExecucaoMs}ms` : "N/A"}
              </p>
            </div>

            <div className="bg-slate-50 rounded-lg p-4">
              <p className="text-sm text-slate-600">Execuções (últimas 24h)</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">
                {status?.execucoes24h ?? 0}
                <span className="text-sm font-normal text-slate-500 ml-1">
                  · {status?.quantidadeImportada ?? 0} OS
                </span>
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
