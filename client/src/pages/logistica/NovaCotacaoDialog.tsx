import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, X, Truck, CheckCircle2, Loader2, MapPin, Camera, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useCepLookup } from "@/hooks/useCepLookup";

interface Volume {
  id: string;
  quantidade: string;
  largura: string;
  comprimento: string;
  altura: string;
  peso: string;
}

// ✅ SOLUÇÃO 4: Usar sessionStorage em vez de localStorage
const STORAGE_KEY = "novaCotacaoDialog_formData";
const USE_SESSION_STORAGE = true; // Ativar sessionStorage

function getStorage() {
  if (typeof window === "undefined") return null;
  return USE_SESSION_STORAGE ? sessionStorage : localStorage;
}

export function NovaCotacaoDialog({ onSuccess }: { onSuccess: () => void }) {
  // ✓ Carregar estado persistido do sessionStorage/localStorage
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // ✅ SOLUÇÃO 3: Indicador de carregamento

  // Marca a busca corrente. Ao cancelar (X ou botão Cancelar), o id muda e a
  // resposta que chegar depois é descartada — nada preenche o formulário nem
  // dispara toast de uma busca que o usuário já interrompeu.
  const buscaAtualId = useRef(0);
  const buscaCancelada = useRef(false);
  
  // ✅ MELHORIA 3: Hook para validação de CEP em tempo real
  const { lookupCep, loading: cepLoading, error: cepError, data: cepData } = useCepLookup();
  
  const [osNumero, setOsNumero] = useState(() => {
    if (typeof window === "undefined") return "";
    try {
      const storage = getStorage();
      const saved = storage?.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).osNumero : "";
    } catch {
      return "";
    }
  });
  
  const [volumes, setVolumes] = useState<Volume[]>(() => {
    if (typeof window === "undefined") return [{ id: "1", quantidade: "1", largura: "", comprimento: "", altura: "", peso: "" }];
    try {
      const storage = getStorage();
      const saved = storage?.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).volumes : [{ id: "1", quantidade: "1", largura: "", comprimento: "", altura: "", peso: "" }];
    } catch {
      return [{ id: "1", quantidade: "1", largura: "", comprimento: "", altura: "", peso: "" }];
    }
  });

  const [form, setForm] = useState(() => {
    const vazio = { destinatarioNome: "", cnpj: "", razaoSocial: "", municipio: "", estado: "", cepDestino: "", observacoes: "", osAprovacao: "", osEntrega: "", osVendedor: "" };
    if (typeof window === "undefined") return vazio;
    try {
      const storage = getStorage();
      const saved = storage?.getItem(STORAGE_KEY);
      return saved ? { ...vazio, ...JSON.parse(saved).form } : vazio;
    } catch {
      return vazio;
    }
  });

  const [transportadorasDisponiveis, setTransportadorasDisponiveis] = useState<any[]>([]);
  const [horarioCriacao, setHorarioCriacao] = useState<Date | null>(null);
  const { user: localUser } = useAuth();
  const solicitanteNome = localUser?.name || "Usuário";

  // ── Empacotadores responsáveis pela embalagem (até 3) ──────────────────────
  const [empacotadoresSelecionados, setEmpacotadoresSelecionados] = useState<{ id: number; name: string }[]>([]);
  const { data: empacotadoresDisponiveis = [] } = trpc.localUsers.activeList.useQuery(undefined, {
    select: (users: any[]) => users.filter((u: any) => u.role === 'empacotamento'),
  });

  // ✅ SOLUÇÃO 4: Salvar estado em sessionStorage/localStorage quando mudar
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storage = getStorage();
      storage?.setItem(STORAGE_KEY, JSON.stringify({ osNumero, volumes, form }));
    } catch (e) {
      console.error("Erro ao salvar storage:", e);
    }
  }, [osNumero, volumes, form, empacotadoresSelecionados]);

  const handleResetForm = () => {
    console.log("✅ [RESET] Limpando formulário e storage...");
    setOsNumero("");
    setVolumes([{ id: "1", quantidade: "1", largura: "", comprimento: "", altura: "", peso: "" }]);
    setForm({
      destinatarioNome: "",
      cnpj: "",
      razaoSocial: "",
      municipio: "",
      estado: "",
      cepDestino: "",
      observacoes: "",
      osAprovacao: "",
      osEntrega: "",
      osVendedor: "",
    });
    setTransportadorasDisponiveis([]);
    setEmpacotadoresSelecionados([]);
    setFotosPendentes([]);
    
    // Limpar storage
    if (typeof window !== "undefined") {
      try {
        const storage = getStorage();
        storage?.removeItem(STORAGE_KEY);
        console.log("✅ [RESET] Storage limpo após sucesso");
      } catch (e) {
        console.error("Erro ao limpar storage:", e);
      }
    }
  };

  const buscarOSMutation = trpc.logistica.buscarDadosOS.useMutation({
    onSuccess: (data: any) => {
      // Busca interrompida pelo usuário: ignora o resultado por completo.
      if (buscaCancelada.current) {
        console.log("⏹️ [BUSCA] Resultado descartado: busca cancelada pelo usuário");
        return;
      }
      // ✅ SOLUÇÃO 1: Logging detalhado para debugging
      console.log("🔍 [DEBUG] Dados recebidos do mutation:", data);
      console.log("🔍 [DEBUG] Estrutura de dados:", {
        cliente: data?.cliente,
        clienteNome: data?.clienteNome,
        clienteCnpj: data?.clienteCnpj,
        endereco: data?.endereco,
      });

      // ✅ SOLUÇÃO 1: Mapeamento correto de dados da API MubiSys com fallbacks completos
      const clienteCnpj = data?.cliente?.cnpj || data?.clienteCnpj || data?.cnpj || "";
      const razaoSocial = data?.cliente?.razaoSocial || data?.clienteNome || data?.razaoSocial || data?.cliente?.nome || "";
      
      console.log("✅ [MAPEAMENTO] CNPJ:", clienteCnpj, "| Razão Social:", razaoSocial);

      setForm((prev: typeof form) => ({
        ...prev,
        destinatarioNome: data?.clienteNome || data?.cliente?.nome || "",
        cnpj: clienteCnpj,
        razaoSocial: razaoSocial,
        municipio: data?.municipio || data?.endereco?.municipio || "",
        estado: data?.estado || data?.endereco?.estado || "",
        cepDestino: data?.cep || data?.endereco?.cep || "",
        // Dados próprios desta OS
        osAprovacao: data?.aprovacao || data?.dataAprovacao || "",
        osEntrega: data?.entrega || data?.dataEntregaPrevista || "",
        osVendedor: data?.vendedor || "",
      }));

      toast.success(`✓ OS ${osNumero} carregada com sucesso`);
      console.log("✅ [SUCESSO] Dados da OS carregados e formulário preenchido");
      setIsLoading(false); // ✅ SOLUÇÃO 3: Desativar indicador de carregamento
    },
    onError: (error: any) => {
      // Busca interrompida pelo usuário: não exibe erro de algo que ele cancelou.
      if (buscaCancelada.current) {
        console.log("⏹️ [BUSCA] Erro descartado: busca cancelada pelo usuário");
        return;
      }
      console.error("Erro ao buscar OS:", error);
      setIsLoading(false); // ✅ SOLUÇÃO 3: Desativar indicador de carregamento
      if (error.message?.includes("autorizado")) {
        toast.error("Erro de autenticação com MubiSys. Preencha os dados manualmente.");
      } else {
        toast.error("OS não encontrada. Verifique o número.");
      }
    },
  });

  const handleBuscarOS = async () => {
    if (!osNumero || osNumero.length < 3) {
      toast.error("Digite um número de OS válido");
      return;
    }

    buscaCancelada.current = false; // nova busca: volta a aceitar resultado
    buscaAtualId.current += 1;
    setIsLoading(true); // ✅ SOLUÇÃO 3: Ativar indicador de carregamento
    buscarOSMutation.mutate({ osNumero });
  };

  /** Interrompe a busca de OS em andamento, liberando o formulário na hora. */
  const cancelarBuscaOS = () => {
    if (!isLoading && !buscarOSMutation.isPending) return false;
    buscaCancelada.current = true;
    buscaAtualId.current += 1; // invalida a resposta que ainda estiver a caminho
    buscarOSMutation.reset();
    setIsLoading(false);
    return true;
  };

  // ✅ SOLUÇÃO 4: NÃO resetar o formulário ao fechar (evita perda de dados ao mudar de janela).
  // Mas o X SEMPRE interrompe uma busca em andamento e fecha o modal imediatamente.
  const handleCloseDialog = (newOpen: boolean) => {
    if (!newOpen && cancelarBuscaOS()) {
      toast.info("Busca da OS interrompida");
    }
    setOpen(newOpen);
    // O reset completo acontece apenas após criar com sucesso (onSuccess do create)
  };

  const buscarTransportadoras = async (cidade: string) => {
    try {
      // Simulação de busca de transportadoras (em produção, seria uma API real)
      const transportadoras = [
        { id: 1, nome: "Sedex", cobertura: "Nacional" },
        { id: 2, nome: "PAC", cobertura: "Nacional" },
        { id: 3, nome: "Loggi", cobertura: "Principais cidades" },
        { id: 4, nome: "Transportadora Local", cobertura: "Região" },
      ];
      setTransportadorasDisponiveis(transportadoras);
    } catch (error) {
      console.error("Erro ao buscar transportadoras:", error);
    }
  };

  const addVolume = () => {
    const newId = String(Math.max(...volumes.map(v => parseInt(v.id) || 0), 0) + 1);
    setVolumes([...volumes, { id: newId, quantidade: "1", largura: "", comprimento: "", altura: "", peso: "" }]);
  };

  const removeVolume = (id: string) => {
    if (volumes.length > 1) {
      setVolumes(volumes.filter(v => v.id !== id));
    }
  };

  const updateVolume = (id: string, field: keyof Volume, value: string) => {
    console.log(`[updateVolume] id=${id}, field=${field}, value=${value}`);
    setVolumes(volumes.map(v => (v.id === id ? { ...v, [field]: value } : v)));
  };

  const pesoTotal = volumes.reduce((sum, v) => sum + (parseFloat(v.peso) || 0), 0);

  // ── Fotografias da mercadoria anexadas já na abertura da solicitação ──────
  // Os arquivos ficam em memória até a cotação existir (o upload precisa do id),
  // e são enviados ao S3 imediatamente após a criação.
  const [fotosPendentes, setFotosPendentes] = useState<Array<{ nome: string; conteudoBase64: string; tipo: string; preview: string }>>([]);
  const [lendoFotos, setLendoFotos] = useState(false);
  const uploadFotos = trpc.cotacoesFrete.uploadFotos.useMutation();

  const selecionarFotos = async (arquivos: File[]) => {
    if (arquivos.length === 0) return;
    setLendoFotos(true);
    try {
      const lidos = await Promise.all(
        arquivos.slice(0, 10).map(
          arq =>
            new Promise<{ nome: string; conteudoBase64: string; tipo: string; preview: string }>((resolve, reject) => {
              const leitor = new FileReader();
              leitor.onload = () => {
                const conteudo = String(leitor.result);
                resolve({ nome: arq.name, conteudoBase64: conteudo, tipo: arq.type || "image/jpeg", preview: conteudo });
              };
              leitor.onerror = () => reject(new Error(`Falha ao ler ${arq.name}`));
              leitor.readAsDataURL(arq);
            }),
        ),
      );
      setFotosPendentes(prev => [...prev, ...lidos].slice(0, 10));
      toast.success(`${lidos.length} fotografia(s) anexada(s) à solicitação`);
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao ler as fotografias");
    } finally {
      setLendoFotos(false);
    }
  };

  const create = trpc.cotacoesFrete.create.useMutation({
    onSuccess: async (result: any) => {
      toast.success(`✅ Solicitação #${result.id} criada com sucesso!`);
      // Envia as fotos escolhidas no formulário para que acompanhem o card
      // desde o primeiro estágio do Kanban.
      if (fotosPendentes.length > 0) {
        try {
          await uploadFotos.mutateAsync({
            id: Number(result.id),
            fotos: fotosPendentes.map(({ nome, conteudoBase64, tipo }) => ({ nome, conteudoBase64, tipo })),
          });
          toast.success(`${fotosPendentes.length} fotografia(s) anexada(s) ao card`);
        } catch (err: any) {
          toast.error(`Solicitação criada, mas as fotos falharam: ${err?.message ?? "erro desconhecido"}`);
        }
      }
      setTimeout(() => {
        handleResetForm();
        setOpen(false);
        window.location.reload();
      }, 500);
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });

  const handleCreate = () => {
    // ✅ FASE 1: VALIDAÇÃO COMPLETA
    console.log("🔍 [VALIDACAO] Iniciando validação de campos...");
    
    // Validar campos obrigatórios
    const erros: string[] = [];
    if (!form.destinatarioNome?.trim()) erros.push("Nome do destinatário");
    if (!form.municipio?.trim()) erros.push("Município");
    if (!form.estado?.trim() || form.estado.length !== 2) erros.push("Estado (UF)");
    
    if (erros.length > 0) {
      const msg = `Preencha os campos obrigatórios: ${erros.join(", ")}`;
      console.error("❌ [VALIDACAO]", msg);
      toast.error(msg);
      return;
    }
    
    // Validar volumes
    if (volumes.length === 0) {
      toast.error("❌ Adicione pelo menos um volume");
      return;
    }
    
    const volumesInvalidos = volumes.filter(v => !v.largura?.trim() || !v.comprimento?.trim() || !v.altura?.trim() || !v.peso?.trim());
    if (volumesInvalidos.length > 0) {
      toast.error(`❌ Preencha todas as dimensões dos ${volumesInvalidos.length} volume(s)`);
      return;
    }
    
    // Validar peso total
    if (pesoTotal <= 0) {
      toast.error("❌ Peso total deve ser maior que 0");
      return;
    }
    
    console.log("✅ [VALIDACAO] Todos os campos válidos!");
    
    // ✅ FASE 2: PREPARAÇÃO DE DADOS
    console.log("📄 [PREPARACAO] Preparando dados para envio...");
    const agora = new Date();
    const volumesJson = JSON.stringify(volumes);
    
    const payloadCriacao = {
      destinatarioNome: form.destinatarioNome.trim(),
      municipio: form.municipio.trim(),
      estado: form.estado.trim().toUpperCase(),
      cepDestino: form.cepDestino?.trim() || "",
      pesoKg: pesoTotal.toString(),
      valorNf: "0",
      observacoes: form.observacoes?.trim() || "",
      solicitanteNome: solicitanteNome || localUser?.name || "Sistema",
      destinatarioCnpj: form.cnpj?.trim() || "",
      osNumero: osNumero?.trim() || undefined,
      volumesJson,
      quantidadeVolumes: volumes.reduce(
        (t, v) => t + (parseInt(String(v.quantidade || "1"), 10) || 1),
        0,
      ) || volumes.length,
      empacotadores: empacotadoresSelecionados.map(e => e.name).join(', ') || undefined,
      // Dados próprios da OS consultada
      osAprovacao: form.osAprovacao?.trim() || undefined,
      osEntrega: form.osEntrega?.trim() || undefined,
      osVendedor: form.osVendedor?.trim() || undefined,
    };
    
    console.log("✅ [PREPARACAO] Payload:", payloadCriacao);
    
    // ✅ FASE 3: ENVIO PARA CRIAÇÃO
    console.log("🚀 [CRIACAO] Enviando solicitação de criação...");
    create.mutate(payloadCriacao as any);
  };

  // ✅ SOLUÇÃO 4: Dialog sempre montado (não desmonta ao perder foco)
  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Nova Solicitação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova Solicitação de Frete</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Busca de OS - CAMPO PRINCIPAL */}
          <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
            <Label className="font-bold text-blue-900">Número da Ordem de Serviço (OS) *</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={osNumero}
                onChange={e => setOsNumero(e.target.value)}
                onKeyPress={e => e.key === "Enter" && handleBuscarOS()}
                placeholder="Digite o número da OS (ex: 6906)"
                className="flex-1 text-lg"
                disabled={isLoading || buscarOSMutation.isPending}
              />
              <Button
                onClick={handleBuscarOS}
                disabled={isLoading || buscarOSMutation.isPending || osNumero.length < 3}
                className="px-6 transition-all duration-200"
                variant={isLoading || buscarOSMutation.isPending ? "secondary" : "default"}
              >
                {isLoading || buscarOSMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  "Buscar"
                )}
              </Button>
              {(isLoading || buscarOSMutation.isPending) && (
                <Button
                  type="button"
                  variant="outline"
                  className="px-3 border-red-300 bg-white text-red-700 hover:bg-red-50"
                  title="Interromper a busca da OS"
                  onClick={() => {
                    if (cancelarBuscaOS()) toast.info("Busca da OS interrompida");
                  }}
                >
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              )}
            </div>
          </div>

          {/* Dados do cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Destinatário *</Label>
              <Input
                value={form.destinatarioNome}
                onChange={e => setForm({ ...form, destinatarioNome: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div>
              <Label>CNPJ</Label>
              <Input
                value={form.cnpj}
                onChange={e => setForm({ ...form, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <div>
            <Label>Razão Social</Label>
            <Input
              value={form.razaoSocial}
              onChange={e => setForm({ ...form, razaoSocial: e.target.value })}
              placeholder="Razão social completa"
            />
          </div>

          {/* Localização */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Município *</Label>
              <Input
                value={form.municipio}
                onChange={e => setForm({ ...form, municipio: e.target.value })}
                placeholder="Cidade"
              />
            </div>
            <div>
              <Label>Estado *</Label>
              <Input
                value={form.estado}
                onChange={e => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                placeholder="UF"
                maxLength={2}
              />
            </div>
            <div>
              <Label>CEP</Label>
              <Input
                value={form.cepDestino}
                onChange={e => setForm({ ...form, cepDestino: e.target.value })}
                placeholder="00000-000"
              />
            </div>
          </div>

          {/* Dados da OS — preenchidos pela consulta, editáveis se necessário */}
          <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div>
              <Label className="text-xs">Aprovação da OS</Label>
              <Input
                value={form.osAprovacao}
                onChange={e => setForm({ ...form, osAprovacao: e.target.value })}
                placeholder="dd/mm/aaaa"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Entrega prevista</Label>
              <Input
                value={form.osEntrega}
                onChange={e => setForm({ ...form, osEntrega: e.target.value })}
                placeholder="dd/mm/aaaa"
                className="h-9"
              />
            </div>
            <div>
              <Label className="text-xs">Vendedor</Label>
              <Input
                value={form.osVendedor}
                onChange={e => setForm({ ...form, osVendedor: e.target.value })}
                placeholder="Nome do vendedor"
                className="h-9"
              />
            </div>
          </div>

          {/* Transportadoras - REMOVIDAS DO ESTÁGIO INICIAL (Fila) */}
          {/* Só aparecem no estágio "Em Cotação" */}
          {false && form.municipio && (
            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
              <Label className="font-bold text-green-900">🚚 Transportadoras que atendem {form.municipio}</Label>
              <div className="flex gap-2 mt-2 flex-wrap">
                {["Sedex", "PAC", "Loggi", "Transportadora Local"].map(t => (
                  <Button key={t} variant="outline" size="sm" className="border-green-500 text-green-700">
                    <CheckCircle2 className="w-4 h-4 mr-1" />
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Volumes */}
          <div>
            <Label className="font-bold">Volumes *</Label>
            <div className="space-y-2 mt-2">
              {volumes.map((vol, idx) => (
                <div key={vol.id} className="rounded-md border bg-slate-50/60 p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-slate-600">Volume {idx + 1}</span>
                    {volumes.length > 1 && (
                      <Button onClick={() => removeVolume(vol.id)} variant="ghost" size="sm" className="h-6 px-2">
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Qtd. volumes</Label>
                      <Input
                        inputMode="numeric"
                        placeholder="1"
                        value={vol.quantidade ?? ""}
                        onChange={e => updateVolume(vol.id, "quantidade", e.target.value.replace(/[^0-9]/g, ""))}
                        className="h-9 text-center"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Largura (cm)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={vol.largura}
                        onChange={e => updateVolume(vol.id, "largura", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Compr. (cm)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={vol.comprimento}
                        onChange={e => updateVolume(vol.id, "comprimento", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Altura (cm)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={vol.altura}
                        onChange={e => updateVolume(vol.id, "altura", e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Peso (kg)</Label>
                      <Input
                        inputMode="decimal"
                        placeholder="0"
                        value={vol.peso}
                        onChange={e => updateVolume(vol.id, "peso", e.target.value)}
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={addVolume}
              variant="outline"
              size="sm"
              className="mt-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar Volume
            </Button>
            <p className="text-sm text-gray-600 mt-2">
              Total de volumes: <strong>{volumes.reduce((t, v) => t + (parseInt(String(v.quantidade || "1"), 10) || 1), 0)}</strong>
              {" · "}Peso total: <strong>{pesoTotal.toFixed(2)} kg</strong>
            </p>
          </div>

          {/* ── Fotografias da mercadoria ───────────────────────────────────
               Anexadas já na abertura; acompanham o card em todos os estágios. */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> Fotografias da mercadoria
                <span className="text-xs font-normal text-slate-600">(até 10)</span>
              </Label>
              <label className="cursor-pointer text-xs font-medium text-blue-700 hover:text-blue-900 underline">
                {lendoFotos ? "Carregando..." : "+ Anexar fotos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  disabled={lendoFotos}
                  onChange={e => {
                    const arquivos = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    void selecionarFotos(arquivos);
                  }}
                />
              </label>
            </div>

            {fotosPendentes.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nenhuma fotografia anexada. As fotos anexadas aqui acompanham o card em todos os estágios do Kanban.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {fotosPendentes.map((foto, i) => (
                  <div key={`${foto.nome}-${i}`} className="relative">
                    <img
                      src={foto.preview}
                      alt={foto.nome}
                      className="w-16 h-16 rounded object-cover border border-slate-300"
                    />
                    <button
                      type="button"
                      onClick={() => setFotosPendentes(prev => prev.filter((_, idx) => idx !== i))}
                      aria-label={`Remover ${foto.nome}`}
                      className="absolute -top-1.5 -right-1.5 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Solicitante */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <Label className="font-bold text-blue-900">Solicitante</Label>
            <p className="text-sm text-blue-800">✓ Criado em: {new Date().toLocaleString('pt-BR')}</p>
            <p className="text-sm text-blue-800">Por: {solicitanteNome}</p>
          </div>

          {/* ── Empacotadores responsáveis pela embalagem ─────────────────── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <Label className="font-bold text-amber-900 flex items-center gap-1.5">
              📦 Empacotadores responsáveis pela embalagem
              <span className="text-xs font-normal text-amber-700">(selecione até 3)</span>
            </Label>

            {/* Selecionados */}
            {empacotadoresSelecionados.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {empacotadoresSelecionados.map(e => (
                  <span
                    key={e.id}
                    className="inline-flex items-center gap-1 bg-amber-200 text-amber-900 text-xs font-medium px-2 py-0.5 rounded-full"
                  >
                    {e.name}
                    <button
                      type="button"
                      onClick={() => setEmpacotadoresSelecionados(prev => prev.filter(x => x.id !== e.id))}
                      className="hover:text-red-700 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Dropdown de seleção */}
            {empacotadoresSelecionados.length < 3 && (
              <select
                className="w-full border border-amber-300 rounded-md text-sm px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                value=""
                onChange={e => {
                  const id = Number(e.target.value);
                  if (!id) return;
                  const user = (empacotadoresDisponiveis as any[]).find((u: any) => u.id === id);
                  if (!user) return;
                  if (empacotadoresSelecionados.some(x => x.id === id)) return;
                  setEmpacotadoresSelecionados(prev => [...prev, { id: user.id, name: user.name }]);
                }}
              >
                <option value="">— Selecionar empacotador —</option>
                {(empacotadoresDisponiveis as any[])
                  .filter((u: any) => !empacotadoresSelecionados.some(x => x.id === u.id))
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
              </select>
            )}

            {empacotadoresSelecionados.length === 0 && (
              <p className="text-xs text-amber-700 italic">Nenhum empacotador selecionado (opcional)</p>
            )}
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <textarea
              value={form.observacoes}
              onChange={e => setForm({ ...form, observacoes: e.target.value })}
              placeholder="Urgência, fragilidade, etc."
              className="w-full h-20 p-2 border rounded text-sm"
            />
          </div>

          {/* Botão de criar com indicador de carregamento */}
          <Button
            onClick={handleCreate}
            disabled={create.isPending}
            className="w-full h-12 text-base font-bold"
            size="lg"
          >
            {create.isPending ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Criando Solicitação...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Criar Solicitação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
