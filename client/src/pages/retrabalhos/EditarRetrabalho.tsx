import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import RetrabalhForm, { FormData } from "@/components/RetrabalhForm";
import { ArrowLeft } from "lucide-react";

export default function EditarRetrabalho() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const utils = trpc.useUtils();

  const { data: retrabalho, isLoading } = trpc.retrabalhos.byId.useQuery({ id }, { enabled: !!id });

  const updateMut = trpc.retrabalhos.update.useMutation({
    onSuccess: () => {
      toast.success("Retrabalho atualizado!");
      utils.retrabalhos.list.invalidate();
      utils.dashboard.kpis.invalidate();
      setLocation("/retrabalhos");
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const handleSubmit = (form: FormData) => {
    const total = (parseFloat(form.custo || "0") + parseFloat(form.frete || "0")).toFixed(2);
    updateMut.mutate({
      id,
      data: {
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
        responsavel: form.responsavel || null,
        tipoResponsavel: form.tipoResponsavel || "operador",
        descricao: form.descricao || null,
        classe: form.classe,
        horasImpacto: form.horasImpacto ? parseFloat(form.horasImpacto) : null,
        mes: form.mes || null,
        tipoRegistro: form.tipoRegistro || "retrabalho",
      },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-64">
        <p className="text-slate-400">Carregando...</p>
      </div>
    );
  }

  if (!retrabalho) {
    return (
      <div className="p-6">
        <p className="text-red-500">Retrabalho não encontrado.</p>
      </div>
    );
  }

  const initial: Partial<FormData> = {
    titulo: (retrabalho as any).titulo ?? "",
    osRetrabalhada: retrabalho.osRetrabalhada ?? undefined,
    osOriginal: retrabalho.osOriginal ?? undefined,
    data: new Date(retrabalho.data).toISOString().split("T")[0],
    setor: retrabalho.setor,
    tipo: retrabalho.tipo,
    custo: String(retrabalho.custo ?? "0"),
    frete: String(retrabalho.frete ?? "0"),
    horasImpacto: retrabalho.horasImpacto != null ? String(retrabalho.horasImpacto) : "",
    codigoErro: retrabalho.codigoErro ?? "",
    responsavel: retrabalho.responsavel ?? "",
    tipoResponsavel: ((retrabalho as any).tipoResponsavel ?? "operador") as "operador" | "gestor",
    descricao: retrabalho.descricao ?? "",
    classe: retrabalho.classe,
    mes: retrabalho.mes ?? "",
    tipoRegistro: ((retrabalho as any).tipoRegistro ?? "retrabalho") as "retrabalho" | "cnq",
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => setLocation("/retrabalhos")} className="flex items-center gap-2 text-sm mb-6 text-slate-500 hover:text-slate-700 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Voltar para Retrabalhos
      </button>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Editar Registro</p>
          <h1 className="text-xl font-bold text-slate-800">Editar Retrabalho #{retrabalho.osRetrabalhada}</h1>
        </div>
        <RetrabalhForm initial={initial} onSubmit={handleSubmit} loading={updateMut.isPending} submitLabel="Atualizar Retrabalho" />
      </div>
    </div>
  );
}
