import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import RetrabalhForm, { FormData } from "@/components/RetrabalhForm";
import { MultipleRetrabalhosSelector } from "@/components/MultipleRetrabalhosSelector";
import { ArrowLeft, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

export default function NovoRetrabalho() {
  const [, setLocation] = useLocation();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedErrorIds, setSelectedErrorIds] = useState<number[]>([]);
  const utils = trpc.useUtils();

  const createMut = trpc.retrabalhos.create.useMutation({
    onSuccess: () => {
      toast.success("Retrabalho registrado com sucesso!");
      utils.retrabalhos.list.invalidate();
      utils.dashboard.kpis.invalidate();
      utils.dashboard.bySetor.invalidate();
      setLocation("/retrabalhos");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const createBatchMut = trpc.retrabalhos.createBatch.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.count} retrabalho(s) registrado(s) com sucesso!`);
      utils.retrabalhos.list.invalidate();
      utils.dashboard.kpis.invalidate();
      utils.dashboard.bySetor.invalidate();
      setSelectedErrorIds([]);
      setLocation("/retrabalhos");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleSubmit = (form: FormData) => {
    const total = (parseFloat(form.custo || "0") + parseFloat(form.frete || "0")).toFixed(2);
    createMut.mutate({
      titulo: form.titulo || null,
      osRetrabalhada: form.osRetrabalhada,
      osOriginal: form.osOriginal,
      data: new Date(form.data + "T12:00:00"),
      setor: form.setor,
      tipo: form.tipo,
      custo: form.custo || "0",
      frete: form.frete || "0",
      total,
      codigoErro: form.codigoErro || null,
      responsavel: form.responsavel || "",
      tipoResponsavel: (form as any).tipoResponsavel || "operador",
      descricao: form.descricao || null,
      classe: form.classe,
      horasImpacto: form.horasImpacto ? parseFloat(form.horasImpacto) : undefined,
      mes: form.mes || null,
      tipoRegistro: form.tipoRegistro || "retrabalho",
    });
  };

  const handleBatchSubmit = (form: FormData) => {
    if (selectedErrorIds.length < 2) {
      toast.error("Selecione pelo menos 2 erros para lançamento em lote");
      return;
    }
    const total = (parseFloat(form.custo || "0") + parseFloat(form.frete || "0")).toFixed(2);
    createBatchMut.mutate({
      titulo: form.titulo || null,
      osRetrabalhada: form.osRetrabalhada,
      osOriginal: form.osOriginal,
      data: new Date(form.data + "T12:00:00"),
      setor: form.setor,
      tipo: form.tipo,
      custo: form.custo || "0",
      frete: form.frete || "0",
      total,
      responsavel: form.responsavel || "",
      tipoResponsavel: (form as any).tipoResponsavel || "operador",
      descricao: form.descricao || null,
      classe: form.classe,
      horasImpacto: form.horasImpacto ? parseFloat(form.horasImpacto) : undefined,
      mes: form.mes || null,
      tipoRegistro: form.tipoRegistro || "retrabalho",
      errorIds: selectedErrorIds,
    });
  };

  return (
      <div className="p-6 max-w-3xl mx-auto">
        <button
          onClick={() => setLocation("/retrabalhos")}
          className="flex items-center gap-2 text-sm mb-6 text-slate-500 hover:text-slate-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Retrabalhos
        </button>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="mb-6 flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Novo Registro
              </p>
              <h1 className="text-xl font-bold text-slate-800">Cadastrar Retrabalho</h1>
              <p className="text-sm mt-0.5 text-slate-500">
                Preencha os dados da ocorrência de retrabalho
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectorOpen(true)}
              className="gap-2"
            >
              <Copy size={16} />
              Lançamento em Lote
            </Button>
          </div>

          {selectedErrorIds.length > 0 && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-semibold text-blue-900">
                {selectedErrorIds.length} erro(s) selecionado(s) para lançamento em lote
              </p>
              <p className="text-xs text-blue-700 mt-1">
                Preencha o formulário abaixo e clique em "Registrar Lote" para lançar todos os retrabalhos
              </p>
            </div>
          )}

          <RetrabalhForm
            onSubmit={selectedErrorIds.length > 0 ? handleBatchSubmit : handleSubmit}
            loading={createMut.isPending || createBatchMut.isPending}
            submitLabel={
              selectedErrorIds.length > 0
                ? `Registrar Lote (${selectedErrorIds.length})`
                : "Registrar Retrabalho"
            }
          />
        </div>

        <MultipleRetrabalhosSelector
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          onSelect={setSelectedErrorIds}
          tipoRegistro="retrabalho"
        />
      </div>
  );
}
