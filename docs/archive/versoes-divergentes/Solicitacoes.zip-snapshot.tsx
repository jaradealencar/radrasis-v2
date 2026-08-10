import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Truck, MapPin, Package, MessageSquare, ChevronLeft, ChevronRight, X, CheckCircle2, Eye, Copy, ClipboardCheck, Home, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLocalAuth } from "@/contexts/LocalAuthContext";
import { Link } from "wouter";

const STATUS_LABELS: Record<string, string> = {
  fila: "Fila",
  em_cotacao: "Em Cotação",
  pronto: "Pronto — Aguardando Envio",
  concluido: "Concluído",
};
const STATUS_COLORS: Record<string, string> = {
  fila: "bg-slate-100 text-slate-700 border-slate-200",
  em_cotacao: "bg-amber-50 text-amber-700 border-amber-200",
  pronto: "bg-blue-50 text-blue-700 border-blue-200",
  concluido: "bg-green-50 text-green-700 border-green-200",
};
const STATUS_HEADER_COLORS: Record<string, string> = {
  fila: "bg-slate-50 border-slate-200",
  em_cotacao: "bg-amber-50 border-amber-200",
  pronto: "bg-blue-50 border-blue-200",
  concluido: "bg-green-50 border-green-200",
};

type Cotacao = {
  id: number;
  destinatarioNome: string | null;
  destinatarioCnpj: string | null;
  municipio: string | null;
  estado: string | null;
  pesoKg: string | null;
  valorNf: string | null;
  observacoes: string | null;
  observacaoGol: string | null;
  fotoUrl: string | null;
  empacotamentoPedidoId: number | null;
  empacotamentoPedidoNumero: string | null;
  pedidoCnpj: string | null;
  pedidoCep: string | null;
  pedidoEndereco: string | null;
  dimensoesLargura: string | null;
  dimensoesAltura: string | null;
  dimensoesComprimento: string | null;
  cepDestino: string | null;
  status: string;
  solicitanteNome: string | null;
  horarioDecisaoMs: string | null;
  tipoMaterial: string | null;
  dataEntregaPrevista: string | null;
  dataDespacho: Date | null;
  createdAt: Date;
  opcoes: Array<{
    id: number;
    transportadoraNome: string | null;
    valorFrete: string;
    prazoDias: number | null;
    tipoPrazo: string | null;
    selecionada: string;
  }>;
};

const CNPJ_REMETENTE = "11.073.532/0001-77"; // Letreiros Express

function TemplateTransportadora({
  cotacao, novoCep, novaMunicipio, novoEstado, novoCnpj, novoValorNf
}: {
  cotacao: Cotacao;
  novoCep: string;
  novaMunicipio: string;
  novoEstado: string;
  novoCnpj: string;
  novoValorNf: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [tipoMaterial, setTipoMaterial] = useState(cotacao.tipoMaterial || "Letreiro / Sinalização");

  const cep = novoCep || cotacao.cepDestino || cotacao.pedidoCep || "(não informado)";
  const municipio = novaMunicipio || cotacao.municipio || "(não informado)";
  const estado = novoEstado || cotacao.estado || "";
  const cnpjDest = novoCnpj || cotacao.destinatarioCnpj || cotacao.pedidoCnpj || "(não informado)";
  const valorNf = novoValorNf || cotacao.valorNf || "(não informado)";
  const peso = cotacao.pesoKg ? `${cotacao.pesoKg} kg` : "(não informado)";
  const dimensoes = (cotacao.dimensoesLargura && cotacao.dimensoesAltura && cotacao.dimensoesComprimento)
    ? `${cotacao.dimensoesLargura} x ${cotacao.dimensoesAltura} x ${cotacao.dimensoesComprimento} cm`
    : "(não informado)";

  const enderecoCompleto = cotacao.pedidoEndereco
    ? `${cotacao.pedidoEndereco}, ${municipio}${estado ? `/${estado}` : ""} — CEP: ${cep}`
    : `${municipio}${estado ? `/${estado}` : ""} — CEP: ${cep}`;
  const template = [
    `*SOLICITAÇÃO DE FRETE — OS #${cotacao.empacotamentoPedidoNumero || cotacao.id}*`,
    ``,
    `*Remetente:* Radra Indústria LTDA`,
    `*CNPJ Remetente:* ${CNPJ_REMETENTE}`,
    ``,
    `*Destinatário:* ${cotacao.destinatarioNome || "(não informado)"}`,
    `*CNPJ Destinatário:* ${cnpjDest}`,
    `*Endereço Destino:* ${enderecoCompleto}`,
    ``,
    `*Tipo de Material:* ${tipoMaterial || "Letreiro / Sinalização"}`,
    `*Dimensões:* ${dimensoes}`,
    `*Peso:* ${peso}`,
    `*Valor NF:* R$ ${valorNf}`,
    ``,
    `*Tipo de Frete:* FOB`,
    `*CNPJ Pagador:* ${CNPJ_REMETENTE}`,
  ].join("\n");

  const copiar = () => {
    navigator.clipboard.writeText(template).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    });
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-700 flex items-center gap-1">
          <Truck className="w-3.5 h-3.5" /> Template para Transportadoras
        </p>
        <Button
          size="sm"
          variant={copiado ? "default" : "outline"}
          className={`h-7 px-3 text-xs gap-1.5 ${copiado ? "bg-green-600 hover:bg-green-600 text-white" : ""}`}
          onClick={copiar}
        >
          {copiado ? <><ClipboardCheck className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar Template</>}
        </Button>
      </div>
      <div className="mb-2">
        <label className="text-xs text-slate-500 font-medium">Tipo de Material</label>
        <input
          type="text"
          value={tipoMaterial}
          onChange={e => setTipoMaterial(e.target.value)}
          className="w-full mt-0.5 text-xs border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-slate-400"
          placeholder="Ex: Letreiro / Sinalização"
        />
      </div>
      <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono bg-white border border-slate-100 rounded p-2 leading-relaxed">{template}</pre>
    </div>
  );
}

function CotacaoCard({ cotacao, onRefresh, isVendedor }: { cotacao: Cotacao; onRefresh: () => void; isVendedor?: boolean }) {
  const [open, setOpen] = useState(false);
  const [novaOpcao, setNovaOpcao] = useState({ transportadoraNome: "", transportadoraId: undefined as number | undefined, valorFrete: "", prazoDias: "", tipoPrazo: "uteis" as "uteis" | "corridos" });
  const [novaOpcaoAC, setNovaOpcaoAC] = useState(false); // autocomplete aberto
  const [horarioDecisaoMs, setHorarioDecisaoMs] = useState(cotacao.horarioDecisaoMs ?? "");
  const [comentario, setComentario] = useState("");
  const [novaObs, setNovaObs] = useState(cotacao.observacoes ?? "");
  const [novaObsGol, setNovaObsGol] = useState(cotacao.observacaoGol ?? "");
  const [editandoDestino, setEditandoDestino] = useState(false);
  const [novaMunicipio, setNovaMunicipio] = useState(cotacao.municipio ?? "");
  const [novoEstado, setNovoEstado] = useState(cotacao.estado ?? "");
  const [buscaCidade, setBuscaCidade] = useState("");
  const [novoCnpj, setNovoCnpj] = useState(cotacao.destinatarioCnpj ?? "");
  const [novoCep, setNovoCep] = useState(cotacao.cepDestino ?? "");
  const [novoValorNf, setNovoValorNf] = useState(cotacao.valorNf ?? "");
  const [autoFetching, setAutoFetching] = useState(false);
  // Verificar se campos críticos estão faltando (card veio do Empacotamento)
  const camposFaltantes = cotacao.empacotamentoPedidoId && (
    !cotacao.destinatarioCnpj || !cotacao.cepDestino ||
    cotacao.municipio === "(a preencher)" || !cotacao.municipio ||
    !cotacao.valorNf || !cotacao.solicitanteNome
  );
  // CNPJ faltando é condição separada — deve buscar sempre que vazio, mesmo que outros campos estejam preenchidos
  const cnpjFaltando = !!(cotacao.empacotamentoPedidoId && !cotacao.destinatarioCnpj);
  // Auto-fetch sempre que o card do empacotamento for aberto e o CNPJ ainda não estiver preenchido
  // Auto-fetch quando: modal aberto + tem número de OS + CNPJ está ausente ou vazio
  const deveAutoFetch = open && !!(cotacao.empacotamentoPedidoNumero) && !(cotacao.destinatarioCnpj?.trim());
  const utils = trpc.useUtils();

  // Auto-preencher dados ao abrir o modal quando campos estão faltando
  // Prioridade: Mub (pelo número da OS) → BrasilAPI (pelo CNPJ)
  const buscarDadosQuery = trpc.cotacoesFrete.buscarDadosOs.useQuery(
    {
      numeroOs: cotacao.empacotamentoPedidoNumero ?? undefined,
      cnpj: (cotacao.pedidoCnpj || cotacao.destinatarioCnpj) ?? undefined,
    },
    {
      enabled: deveAutoFetch,
      staleTime: 30_000,
    }
  );
  useEffect(() => {
    if (!open || (!camposFaltantes && !cnpjFaltando && cotacao.destinatarioCnpj?.trim())) return;
    if (!buscarDadosQuery.data) return;
    const d = buscarDadosQuery.data;
    const cepFmt = d.cep ? d.cep.replace(/(\d{5})(\d{3})/, "$1-$2") : "";
    if (cepFmt) setNovoCep(cepFmt);
    if (d.cidade) setNovaMunicipio(d.cidade);
    if (d.estado) setNovoEstado(d.estado);
    if (d.cnpj) setNovoCnpj(d.cnpj);
    // Preencher valor da NF e nome do vendedor vindos do Mubisys
    if (d.valorNf && !cotacao.valorNf) setNovoValorNf(d.valorNf);
    const fonte = d.fonte === "mub" ? "Mub" : "Receita Federal";
    updateObs.mutate({
      id: cotacao.id,
      destinatarioCnpj: d.cnpj || cotacao.destinatarioCnpj || "",
      cepDestino: cepFmt || cotacao.cepDestino || cotacao.pedidoCep || "",
      municipio: d.cidade || cotacao.municipio || "",
      estado: d.estado || cotacao.estado || "",
      // Preencher valorNf e solicitanteNome automaticamente via Mubisys
      ...(d.valorNf && !cotacao.valorNf ? { valorNf: d.valorNf } : {}),
      ...(d.vendedor && !cotacao.solicitanteNome ? { solicitanteNome: d.vendedor } : {}),
      // Salvar dataEntregaPrevista vinda do Mubisys
      ...(d.dataEntregaPrevista && !cotacao.dataEntregaPrevista ? { dataEntregaPrevista: d.dataEntregaPrevista } : {}),
    }, { onSuccess: () => { onRefresh(); toast.success(`Dados preenchidos automaticamente via ${fonte}!`); } });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buscarDadosQuery.data]);

  const { localUser: cardUser } = useLocalAuth();
  // Admin/logistica podem excluir em qualquer estágio; vendedor pode excluir nos estágios 1, 2 e 3
  const podeExcluir = ["admin", "supervisor", "master", "logistica"].includes(cardUser?.role ?? "")
    || (cardUser?.role === "vendas" && cotacao.status !== "concluido");
  const { data: detalhe } = trpc.cotacoesFrete.get.useQuery({ id: cotacao.id }, { enabled: open });
  const updateStatus = trpc.cotacoesFrete.updateStatus.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Status atualizado"); },
  });
  const updateObs = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); toast.success("Observações salvas"); },
  });
  // Autocomplete de transportadoras
  const { data: transportadorasAC } = trpc.transportadoras.list.useQuery(
    { search: novaOpcao.transportadoraNome, apenasAtivas: true },
    { enabled: novaOpcao.transportadoraNome.length >= 2 && novaOpcaoAC, staleTime: 60_000 }
  );
  const addOpcao = trpc.cotacoesFrete.addOpcao.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); setNovaOpcao({ transportadoraNome: "", transportadoraId: undefined, valorFrete: "", prazoDias: "", tipoPrazo: "uteis" }); setNovaOpcaoAC(false); },
  });
  const updateHorarioDecisao = trpc.cotacoesFrete.update.useMutation({
    onSuccess: () => { onRefresh(); toast.success("Horário de decisão salvo!"); },
  });
  const selecionarOpcao = trpc.cotacoesFrete.selecionarOpcao.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); onRefresh(); toast.success("Opção selecionada! Cotação movida para Concluído."); },
  });
  const addComentario = trpc.cotacoesFrete.addComentario.useMutation({
    onSuccess: () => { utils.cotacoesFrete.get.invalidate({ id: cotacao.id }); setComentario(""); },
  });
  const deleteCotacao = trpc.cotacoesFrete.delete.useMutation({
    onSuccess: () => { onRefresh(); setOpen(false); },
  });

  const nextStatus: Record<string, string> = { fila: "em_cotacao", em_cotacao: "pronto", pronto: "concluido" };
  const nextLabel: Record<string, string> = { fila: "Iniciar Cotação", em_cotacao: "Marcar Pronto", pronto: "Despachado" };
  const prevStatus: Record<string, string> = { em_cotacao: "fila", pronto: "em_cotacao", concluido: "pronto" };
  const prevLabel: Record<string, string> = { em_cotacao: "← Voltar para Fila", pronto: "← Voltar para Em Cotação", concluido: "← Voltar para Pronto" };

  // Opção selecionada (transportadora escolhida)
  const opcaoSelecionada = cotacao.opcoes.find(o => o.selecionada === "sim");

  return (
    <div className="relative group">
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setNovaObs(cotacao.observacoes ?? ""); }}>
      <DialogTrigger asChild>
        <div className={`rounded-lg border p-3 cursor-pointer hover:shadow-md transition-shadow ${STATUS_COLORS[cotacao.status]} ${camposFaltantes ? "ring-2 ring-amber-400" : ""}`}>
          {/* Alerta de campos faltantes no card */}
          {camposFaltantes && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs px-2 py-1 rounded mb-2 font-medium">
              ⚠️ Preencher dados para cotação
            </div>
          )}
          {/* Foto do empacotamento (integração automática) */}
          {cotacao.fotoUrl && (
            <div className="rounded overflow-hidden h-20 mb-2 bg-gray-100">
              <img src={cotacao.fotoUrl} alt="foto" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {cotacao.empacotamentoPedidoNumero && (
                <p className="text-xs font-bold text-indigo-700 mb-0.5">OS #{cotacao.empacotamentoPedidoNumero}</p>
              )}
              <p className="font-medium text-sm truncate">{cotacao.destinatarioNome || "Sem destinatário"}</p>
              <p className="text-xs opacity-70 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{cotacao.municipio}/{cotacao.estado}
              </p>
            </div>
            <Badge variant="outline" className="text-xs shrink-0">{STATUS_LABELS[cotacao.status].split(" ")[0]}</Badge>
          </div>
          {cotacao.solicitanteNome && (
            <p className="text-xs opacity-60 mt-1">Por: {cotacao.solicitanteNome}</p>
          )}
          {/* Bug 2 fix: mostrar transportadora selecionada no card */}
          {opcaoSelecionada && (
            <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="w-3 h-3" />
              {opcaoSelecionada.transportadoraNome} — R$ {opcaoSelecionada.valorFrete}
            </div>
          )}
          {!opcaoSelecionada && cotacao.opcoes.length > 0 && (
            <p className="text-xs mt-1 opacity-70">{cotacao.opcoes.length} opção(ões) disponível(is)</p>
          )}
          {/* Obs Gol no card */}
          {cotacao.observacaoGol && (
            <p className="text-xs mt-1 text-amber-700 font-medium">✈️ {cotacao.observacaoGol}</p>
          )}
        </div>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") e.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Cotação #{cotacao.id} — {cotacao.destinatarioNome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Dados */}
          <div className="grid grid-cols-2 gap-3 text-sm bg-muted/30 rounded-lg p-3">
            <div className="col-span-2 flex items-center justify-between">
              <div>
                <span className="text-muted-foreground">Destino:</span>{" "}
                {editandoDestino ? null : <strong>{cotacao.municipio}/{cotacao.estado}</strong>}
              </div>
              {!editandoDestino && (
                <Button size="sm" variant="ghost" className="text-xs h-6 px-2" onClick={() => { setEditandoDestino(true); setNovaMunicipio(cotacao.municipio ?? ""); setNovoEstado(cotacao.estado ?? ""); setBuscaCidade(""); }}>
                  Editar destino
                </Button>
              )}
            </div>
            {editandoDestino && (
              <div className="col-span-2 space-y-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">Buscar cidade</Label>
                    <Input
                      value={buscaCidade}
                      onChange={e => {
                        setBuscaCidade(e.target.value);
                        const parts = e.target.value.split("/");
                        if (parts.length === 2) {
                          setNovaMunicipio(parts[0].trim());
                          setNovoEstado(parts[1].trim().toUpperCase().slice(0, 2));
                        } else {
                          setNovaMunicipio(e.target.value);
                        }
                      }}
                      placeholder="Ex: São Paulo/SP ou Belo Horizonte/MG"
                      className="text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-0.5">Digite cidade/UF (ex: Curitiba/PR)</p>
                  </div>
                  <div className="w-16">
                    <Label className="text-xs">UF</Label>
                    <Input value={novoEstado} onChange={e => setNovoEstado(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} className="text-sm" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1" disabled={!novaMunicipio || !novoEstado}
                    onClick={() => updateObs.mutate({ id: cotacao.id, municipio: novaMunicipio, estado: novoEstado }, {
                      onSuccess: () => { setEditandoDestino(false); toast.success("Destino atualizado!"); }
                    })}>
                    Salvar Destino
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setEditandoDestino(false)}>Cancelar</Button>
                </div>
              </div>
            )}
            {cotacao.pesoKg && !cotacao.empacotamentoPedidoId && <div><span className="text-muted-foreground">Peso:</span> <strong>{cotacao.pesoKg} kg</strong></div>}
            {cotacao.valorNf && <div><span className="text-muted-foreground">Valor NF:</span> <strong>R$ {cotacao.valorNf}</strong></div>}
            {detalhe?.cepDestino && <div><span className="text-muted-foreground">CEP:</span> <strong>{detalhe.cepDestino}</strong></div>}
            <div><span className="text-muted-foreground">Solicitante:</span> <strong>{cotacao.solicitanteNome || "—"}</strong></div>
            <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-xs ${STATUS_COLORS[cotacao.status]}`}>{STATUS_LABELS[cotacao.status]}</Badge></div>
          </div>

          {/* Dados da expedição (integração automática com Empacotamento) */}
          {cotacao.empacotamentoPedidoId && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> Dados preenchidos pela Expedição (OS #{cotacao.empacotamentoPedidoNumero})
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {cotacao.fotoUrl && (
                  <div className="col-span-2">
                    <img src={cotacao.fotoUrl} alt="foto" className="w-full rounded-lg max-h-40 object-contain bg-white border" />
                  </div>
                )}
                {(cotacao.dimensoesLargura || cotacao.dimensoesAltura || cotacao.dimensoesComprimento) && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Dimensões:</span>{" "}
                    <strong>{cotacao.dimensoesLargura} × {cotacao.dimensoesAltura} × {cotacao.dimensoesComprimento} cm</strong>
                  </div>
                )}
                {cotacao.pesoKg && (
                  <div><span className="text-muted-foreground">Peso:</span> <strong>{cotacao.pesoKg} kg</strong></div>
                )}
              </div>
            </div>
          )}
          {/* ── Botão de copiar template para transportadoras ── */}
          {cotacao.empacotamentoPedidoId && (
            <TemplateTransportadora cotacao={cotacao} novoCep={novoCep} novaMunicipio={novaMunicipio} novoEstado={novoEstado} novoCnpj={novoCnpj} novoValorNf={novoValorNf} />
          )}

          {/* ── Alerta de campos faltantes para cards vindos do Empacotamento ── */}
          {camposFaltantes && (
            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 space-y-3">
              <p className="text-sm font-bold text-amber-800 flex items-center gap-1.5">
                ⚠️ Campos obrigatórios para cotação de frete
              </p>
              <p className="text-xs text-amber-700">
                Este card veio da Expedição. Preencha os dados abaixo para desbloquear a cotação de frete.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs font-semibold">CNPJ do Destinatário</Label>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Input
                      value={novoCnpj || (buscarDadosQuery.isFetching ? "Buscando..." : "")}
                      readOnly
                      placeholder="Buscando automaticamente via Mubisys..."
                      className="text-sm h-8 bg-muted cursor-default"
                    />
                    {buscarDadosQuery.isFetching && (
                      <span className="text-xs text-muted-foreground animate-pulse">⏳</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">CNPJ preenchido automaticamente via Mubisys ao abrir o card.</p>
                </div>
                <div>
                  <Label className="text-xs font-semibold">CEP de Destino</Label>
                  <Input
                    value={novoCep}
                    onChange={e => setNovoCep(e.target.value)}
                    placeholder="00000-000"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Valor da NF (R$)</Label>
                  <Input
                    value={novoValorNf}
                    onChange={e => setNovoValorNf(e.target.value)}
                    placeholder="0,00"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Município</Label>
                  <Input
                    value={novaMunicipio}
                    onChange={e => setNovaMunicipio(e.target.value)}
                    placeholder="Cidade"
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">UF</Label>
                  <Input
                    value={novoEstado}
                    onChange={e => setNovoEstado(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                    className="text-sm h-8 mt-0.5"
                  />
                </div>
              </div>
              <Button
                size="sm"
                className="w-full"
                disabled={!novoCep || !novaMunicipio || !novoEstado || updateObs.isPending}
                onClick={() => updateObs.mutate({
                  id: cotacao.id,
                  destinatarioCnpj: novoCnpj || undefined,
                  cepDestino: novoCep,
                  municipio: novaMunicipio,
                  estado: novoEstado,
                  valorNf: novoValorNf || undefined,
                }, { onSuccess: () => toast.success("Dados salvos! Card pronto para cotação.") })}
              >
                Salvar Dados e Desbloquear Cotação
              </Button>
            </div>
          )}
          {/* Foto do empacotamento no modal (quando não há integração completa) */}
          {cotacao.fotoUrl && !cotacao.empacotamentoPedidoId && (
            <div>
              <p className="text-xs font-semibold text-indigo-700 mb-1">Foto do Empacotamento</p>
              <img src={cotacao.fotoUrl} alt="foto" className="w-full rounded-lg max-h-48 object-contain bg-gray-50" />
            </div>
          )}

          {/* Bug 1 fix: Observações compartilhadas — editável por todos */}
          <div>
            <Label className="text-sm font-semibold flex items-center gap-1 mb-1">
              <Eye className="w-4 h-4" />Observações (compartilhadas entre vendedor e logística)
            </Label>
            <Textarea
              value={novaObs}
              onChange={e => setNovaObs(e.target.value)}
              placeholder="Dimensões, fragilidade, urgência, instruções especiais..."
              rows={3}
              className="text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              disabled={novaObs === (cotacao.observacoes ?? "")}
              onClick={() => updateObs.mutate({ id: cotacao.id, observacoes: novaObs })}
            >
              Salvar Observações
            </Button>
          </div>

          {/* Campo de observação especial para transportadora Gol — visível em todos os estágios */}
          {(opcaoSelecionada?.transportadoraNome?.toLowerCase().includes("gol") ||
            cotacao.opcoes.some(o => o.transportadoraNome?.toLowerCase().includes("gol")) ||
            cotacao.observacaoGol) && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <Label className="text-sm font-semibold text-amber-800 flex items-center gap-1 mb-1">
                ✈️ Observação Gol (visível em todos os estágios)
              </Label>
              <Textarea
                value={novaObsGol}
                onChange={e => setNovaObsGol(e.target.value)}
                placeholder="Ex: Retirar no aeroporto do Galeão, voo GLA1234..."
                rows={2}
                className="text-sm bg-white"
              />
              <Button
                size="sm"
                variant="outline"
                className="mt-1 border-amber-300 text-amber-800 hover:bg-amber-100"
                disabled={novaObsGol === (cotacao.observacaoGol ?? "")}
                onClick={() => updateObs.mutate({ id: cotacao.id, observacaoGol: novaObsGol })}
              >
                Salvar Obs. Gol
              </Button>
              {cotacao.observacaoGol && (
                <p className="text-xs text-amber-700 mt-1 font-medium">⚠️ {cotacao.observacaoGol}</p>
              )}
            </div>
          )}

          {/* Ações de status */}
          {!isVendedor && (
            <div className="flex items-center gap-2 flex-wrap">
              {prevStatus[cotacao.status] && (
                <Button size="sm" variant="outline" onClick={() => { if (confirm(`Retroceder para "${prevLabel[cotacao.status].replace("← Voltar para ", "")}"?`)) updateStatus.mutate({ id: cotacao.id, status: prevStatus[cotacao.status] as any }); }}>
                  <ChevronLeft className="w-3 h-3 mr-1" />
                  {prevLabel[cotacao.status]}
                </Button>
              )}
              {nextStatus[cotacao.status] && (
                <Button size="sm" onClick={() => updateStatus.mutate({ id: cotacao.id, status: nextStatus[cotacao.status] as any })}>
                  <ChevronRight className="w-3 h-3 mr-1" />
                  {nextLabel[cotacao.status]}
                </Button>
              )}
            </div>
          )}

          {/* Bug 2 fix: Opções de frete com transportadora sempre visível */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Opções de Frete</h3>
            {detalhe?.opcoes && detalhe.opcoes.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Nenhuma opção adicionada ainda.</p>
            )}
            {detalhe?.opcoes.map((op) => {
              const pctFrete = (cotacao.valorNf && parseFloat(cotacao.valorNf) > 0)
                ? ((parseFloat(String(op.valorFrete).replace(/\./g,"").replace(",",".")) / parseFloat(String(cotacao.valorNf).replace(/\./g,"").replace(",","."))) * 100).toFixed(1)
                : null;
              const labelPrazo = op.tipoPrazo === "corridos" ? "dias corridos" : "dias úteis";
              return (
              <div key={op.id} className={`flex items-center justify-between p-2.5 rounded border mb-1 text-sm ${op.selecionada === "sim" ? "bg-green-50 border-green-300" : "bg-background"}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div>
                    <span className="font-medium">{op.transportadoraNome || "Transportadora não especificada"}</span>
                    <span className="text-muted-foreground ml-2">R$ {parseFloat(String(op.valorFrete).replace(",", ".")).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    {pctFrete && <span className="text-xs text-blue-600 ml-1 font-medium">({pctFrete}%)</span>}
                    {op.prazoDias && <span className="text-muted-foreground ml-2">{op.prazoDias} {labelPrazo}</span>}
                  </div>
                </div>
                {op.selecionada === "sim" ? (
                  <Badge className="bg-green-100 text-green-700 shrink-0"><CheckCircle2 className="w-3 h-3 mr-1" />Selecionada</Badge>
                ) : !isVendedor ? (
                  <Button size="sm" variant="outline" onClick={() => selecionarOpcao.mutate({ cotacaoId: cotacao.id, opcaoId: op.id })}>
                    Selecionar
                  </Button>
                ) : null}
              </div>
              );
            })}

            {/* Adicionar opção — somente logística */}
            {!isVendedor && cotacao.status !== "concluido" && (
              <div className="mt-2 border rounded-lg p-3 space-y-2 bg-muted/20">
                <p className="text-xs font-medium text-muted-foreground">Adicionar opção de frete</p>
                {/* Autocomplete de transportadora */}
                <div className="relative">
                  <Label className="text-xs">Transportadora</Label>
                  <Input
                    placeholder="Digite para buscar..."
                    value={novaOpcao.transportadoraNome}
                    onChange={e => { setNovaOpcao(p => ({ ...p, transportadoraNome: e.target.value, transportadoraId: undefined })); setNovaOpcaoAC(true); }}
                    onFocus={() => setNovaOpcaoAC(true)}
                    onBlur={() => setTimeout(() => setNovaOpcaoAC(false), 180)}
                    className="text-sm h-8 mt-0.5"
                  />
                  {novaOpcaoAC && transportadorasAC && transportadorasAC.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {transportadorasAC.map((t) => (
                        <button key={t.id} type="button"
                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0"
                          onMouseDown={() => { setNovaOpcao(p => ({ ...p, transportadoraNome: t.nome, transportadoraId: t.id })); setNovaOpcaoAC(false); }}>
                          {t.nome}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Valor (R$)</Label>
                    <Input
                      placeholder="0,00"
                      value={novaOpcao.valorFrete}
                      onChange={e => {
                        // Máscara numérica: aceita apenas dígitos, formata como moeda brasileira
                        const raw = e.target.value.replace(/\D/g, "");
                        if (!raw) { setNovaOpcao(p => ({ ...p, valorFrete: "" })); return; }
                        const num = parseInt(raw, 10) / 100;
                        const formatted = num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        setNovaOpcao(p => ({ ...p, valorFrete: formatted }));
                      }}
                      className="text-sm h-8 mt-0.5"
                      inputMode="numeric"
                    />
                    {novaOpcao.valorFrete && cotacao.valorNf && parseFloat(cotacao.valorNf.replace(",",".")) > 0 && (
                      <p className="text-xs text-blue-600 mt-0.5 font-medium">
                        = {((parseFloat(novaOpcao.valorFrete.replace(/\./g,"").replace(",",".")) / parseFloat(cotacao.valorNf.replace(/\./g,"").replace(",","."))) * 100).toFixed(1)}% do valor NF
                      </p>
                    )}
                  </div>
                  <div>
                    <Label className="text-xs">Prazo (dias)</Label>
                    <div className="flex gap-1 mt-0.5">
                      <Input placeholder="0" type="number" value={novaOpcao.prazoDias} onChange={e => setNovaOpcao(p => ({ ...p, prazoDias: e.target.value }))} className="text-sm h-8 flex-1" />
                      <select
                        value={novaOpcao.tipoPrazo}
                        onChange={e => setNovaOpcao(p => ({ ...p, tipoPrazo: e.target.value as "uteis" | "corridos" }))}
                        className="text-xs h-8 border rounded px-1 bg-background"
                      >
                        <option value="uteis">úteis</option>
                        <option value="corridos">corridos</option>
                      </select>
                    </div>
                  </div>
                </div>
                <Button size="sm" disabled={addOpcao.isPending} onClick={() => {
                  if (!novaOpcao.transportadoraNome || !novaOpcao.valorFrete) return;
                  // Converter formato brasileiro "1.234,56" → "1234.56" para o banco
                  const valorParaBanco = novaOpcao.valorFrete.replace(/\./g, "").replace(",", ".");
                  addOpcao.mutate({ cotacaoId: cotacao.id, transportadoraId: novaOpcao.transportadoraId, transportadoraNome: novaOpcao.transportadoraNome, valorFrete: valorParaBanco, prazoDias: novaOpcao.prazoDias ? parseInt(novaOpcao.prazoDias) : undefined, tipoPrazo: novaOpcao.tipoPrazo });
                }}>
                  <Plus className="w-3 h-3 mr-1" />Adicionar
                </Button>
              </div>
            )}

          </div>

          {/* Template de opcoes de frete para o vendedor */}
          {detalhe && detalhe.opcoes.length > 0 && (() => {
            const opcoesOrdenadas = [...detalhe.opcoes].sort((a, b) => parseFloat(a.valorFrete) - parseFloat(b.valorFrete));
            const valorNfNum = parseFloat((cotacao.valorNf ?? "0").replace(/\./g, "").replace(",", "."));
            const linhas = opcoesOrdenadas.map((op, i) => {
              const labelPrazo = op.tipoPrazo === "corridos" ? "dias corridos" : "dias úteis";
              const prazo = op.prazoDias ? ` — ${op.prazoDias} ${labelPrazo}` : "";
              const valorRaw = String(op.valorFrete);
              // valorFrete vem do MySQL como "60.00" (ponto decimal) — não remover pontos
              const valorNum = parseFloat(valorRaw.replace(",", "."));
              const pct = valorNfNum > 0 && valorNum > 0 ? ` (${((valorNum / valorNfNum) * 100).toFixed(1)}% do pedido)` : "";
              const valorFmt = valorNum > 0 ? valorNum.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : op.valorFrete;
              return `Opção ${i + 1}: ${op.transportadoraNome || "Transportadora"} — R$ ${valorFmt}${pct}${prazo}`;
            });
            const horarioDecisao = cotacao.horarioDecisaoMs
              ? (() => {
                  const [h, m] = cotacao.horarioDecisaoMs.split(":").map(Number);
                  const dfH = (h + 1) % 24;
                  const fmt = (n: number) => String(n).padStart(2, "0");
                  return `⏰ *Prazo para decisão:* até ${fmt(h)}h${fmt(m)} (Campo Grande/MS) | ${fmt(dfH)}h${fmt(m)} (Brasília/DF)`;
                })()
              : `⏰ *Prazo para decisão:* até 16h00 (Campo Grande/MS) | 17h00 (Brasília/DF)`;
            const templateFrete = [
              `*OPÇÕES DE FRETE — ${cotacao.destinatarioNome || "Cliente"}*`,
              `*Destino:* ${cotacao.municipio}/${cotacao.estado}`,
              ...(cotacao.pedidoEndereco ? [`*Endereço:* ${cotacao.pedidoEndereco}, ${cotacao.municipio}/${cotacao.estado} — CEP: ${cotacao.cepDestino || cotacao.pedidoCep || "(não informado)"}`] : []),
              ``,
              ...linhas,
              ``,
              horarioDecisao,
              ``,
              `_O frete é um serviço terceirizado. Havendo pequenas diferenças no valor após a chegada, informar o setor comercial._`,
              `_Nos informe qual opção ficou melhor para você!_`,
            ].join("\n");
            return (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-green-700 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5" /> Template de Opções para o Vendedor
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-3 text-xs gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
                    onClick={() => { navigator.clipboard.writeText(templateFrete).then(() => toast.success("Template copiado!")); }}
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar
                  </Button>
                </div>
                <pre className="text-xs text-green-800 whitespace-pre-wrap font-mono bg-white border border-green-100 rounded p-2 leading-relaxed">{templateFrete}</pre>
              </div>
            );
          })()}
          {/* Comentários — compartilhados */}
          <div>
            <h3 className="font-semibold text-sm mb-2 flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />Comentários da Equipe
            </h3>
            <div className="space-y-1 max-h-40 overflow-y-auto mb-2">
              {detalhe?.comentarios.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Nenhum comentário ainda.</p>
              )}
              {detalhe?.comentarios.map(c => (
                <div key={c.id} className="text-xs bg-muted/30 rounded p-2">
                  <span className="font-medium">{c.autorNome}:</span> {c.texto}
                  <span className="text-muted-foreground ml-2">{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Adicionar comentário..."
                value={comentario}
                onChange={e => setComentario(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") e.preventDefault(); }}
              />
              <Button size="sm" onClick={() => { if (comentario.trim()) addComentario.mutate({ cotacaoId: cotacao.id, autorNome: "Equipe", texto: comentario }); }}>
                Enviar
              </Button>
            </div>
          </div>

          {/* Botão Excluir — visível para usuários com permissão */}
          {podeExcluir && (
            <div className="pt-3 border-t border-red-100 flex justify-center">
              <button
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-all text-sm font-medium"
                onClick={() => {
                  const id = cotacao.id;
                  const nome = cotacao.destinatarioNome || `Cotação #${id}`;
                  deleteCotacao.mutate({ id });
                  let undone = false;
                  toast.success(`${nome} excluída`, {
                    action: {
                      label: "Desfazer",
                      onClick: () => {
                        undone = true;
                        toast.info("Não é possível desfazer — contate o administrador para restaurar.");
                      },
                    },
                    duration: 5000,
                  });
                }}
              >
                <Trash2 className="w-4 h-4" /> Excluir esta cotação
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    {/* Botão de exclusão fora do Dialog — funciona em todos os estágios */}
    {podeExcluir && (
      <div className="px-3 pb-2 -mt-1">
        <div className="pt-1 border-t border-dashed border-muted/40 flex justify-end">
          <button
            className="text-xs text-muted-foreground/50 hover:text-red-600 transition-colors flex items-center gap-1 py-0.5 px-1.5 rounded hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              const id = cotacao.id;
              const nome = cotacao.destinatarioNome || `Cotação #${id}`;
              deleteCotacao.mutate({ id });
              toast.success(`${nome} excluída`, {
                action: {
                  label: "Desfazer",
                  onClick: () => {
                    toast.info("Não é possível desfazer — contate o administrador para restaurar.");
                  },
                },
                duration: 5000,
              });
            }}
          >
            <X className="w-3 h-3" /> Excluir
          </button>
        </div>
      </div>
    )}
    </div>
  );
}
function NovaCotacaoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ destinatarioNome: "", municipio: "", estado: "", cepDestino: "", pesoKg: "", valorNf: "", observacoes: "", solicitanteNome: "" });
  const [showAC, setShowAC] = useState(false);
  const { localUser } = useLocalAuth();

  const create = trpc.cotacoesFrete.create.useMutation({
    onSuccess: () => { onSuccess(); setOpen(false); toast.success("Solicitação criada!"); setForm({ destinatarioNome: "", municipio: "", estado: "", cepDestino: "", pesoKg: "", valorNf: "", observacoes: "", solicitanteNome: "" }); },
  });
  const { data: sugestoes } = trpc.transportadoras.buscarMunicipios.useQuery(
    { q: form.municipio },
    { enabled: form.municipio.length >= 2 }
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Nova Solicitação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova Solicitação de Frete</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Destinatário *</Label>
              <Input value={form.destinatarioNome} onChange={e => setForm(p => ({ ...p, destinatarioNome: e.target.value }))} placeholder="Nome do cliente/empresa" />
            </div>
            <div className="relative">
              <Label>Município *</Label>
              <Input value={form.municipio} onChange={e => { setForm(p => ({ ...p, municipio: e.target.value })); setShowAC(true); }} onFocus={() => setShowAC(true)} onBlur={() => setTimeout(() => setShowAC(false), 150)} placeholder="Cidade de destino" />
              {showAC && sugestoes && sugestoes.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {sugestoes.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0" onMouseDown={() => { setForm(p => ({ ...p, municipio: s.cidade, estado: s.estado })); setShowAC(false); }}>
                      {s.cidade} — {s.estado}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>Estado *</Label>
              <Input value={form.estado} onChange={e => setForm(p => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" maxLength={2} />
            </div>
            <div>
              <Label>CEP</Label>
              <Input value={form.cepDestino} onChange={e => setForm(p => ({ ...p, cepDestino: e.target.value }))} placeholder="00000-000" />
            </div>
            <div>
              <Label>Peso (kg)</Label>
              <Input value={form.pesoKg} onChange={e => setForm(p => ({ ...p, pesoKg: e.target.value }))} placeholder="Ex: 15.5" />
            </div>
            <div>
              <Label>Valor NF (R$)</Label>
              <Input value={form.valorNf} onChange={e => setForm(p => ({ ...p, valorNf: e.target.value }))} placeholder="Ex: 2500,00" />
            </div>
            <div>
              <Label>Solicitante</Label>
              <Input value={form.solicitanteNome || localUser?.name || ""} onChange={e => setForm(p => ({ ...p, solicitanteNome: e.target.value }))} placeholder="Nome do vendedor" />
            </div>
          </div>
          <div>
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} placeholder="Dimensões, fragilidade, urgência..." rows={3} />
          </div>
          <Button className="w-full" disabled={!form.destinatarioNome || !form.municipio || !form.estado} onClick={() => create.mutate({ ...form, solicitanteNome: form.solicitanteNome || localUser?.name || "" })}>
            Criar Solicitação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Bug 3 fix: Kanban do vendedor — filtra apenas suas próprias cotações
function KanbanView({ cotacoes, onRefresh, isVendedor }: { cotacoes: Cotacao[]; onRefresh: () => void; isVendedor?: boolean }) {
  const columns = ["fila", "em_cotacao", "pronto", "concluido"];
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const updateStatus = trpc.cotacoesFrete.updateStatus.useMutation({
    onSuccess: () => { utils.cotacoesFrete.list.invalidate(); onRefresh(); },
  });

  const handleDrop = (col: string, id: number) => {
    const cotacao = cotacoes.find((c: any) => c.id === id);
    if (!cotacao || cotacao.status === col) return;
    updateStatus.mutate({ id, status: col as any });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => {
        const items = cotacoes.filter((c: any) => c.status === col);
        const isOver = dragOverCol === col;
        return (
          <div
            key={col}
            className="space-y-2"
            onDragOver={e => { e.preventDefault(); setDragOverCol(col); }}
            onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null); }}
            onDrop={e => { e.preventDefault(); setDragOverCol(null); if (draggedId !== null) handleDrop(col, draggedId); setDraggedId(null); }}
          >
            <div className={`flex items-center justify-between mb-1 px-2 py-1.5 rounded-md border transition-all ${STATUS_HEADER_COLORS[col]} ${isOver ? "ring-2 ring-blue-400 scale-[1.01]" : ""}`}>
              <h2 className="font-semibold text-sm">{STATUS_LABELS[col]}</h2>
              <Badge variant="secondary">{items.length}</Badge>
            </div>
            <div className={`space-y-2 min-h-[120px] rounded-lg transition-all ${isOver ? "bg-blue-50/60 ring-1 ring-blue-200" : ""}`}>
              {items.map((c: any) => (
                <div
                  key={c.id}
                  draggable
                  onDragStart={e => { e.stopPropagation(); setDraggedId(c.id); e.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDraggedId(null); setDragOverCol(null); }}
                  className={`transition-opacity ${draggedId === c.id ? "opacity-40" : "opacity-100"}`}
                >
                  <CotacaoCard cotacao={c} onRefresh={onRefresh} isVendedor={isVendedor} />
                </div>
              ))}
              {items.length === 0 && (
                <div className={`border-2 border-dashed rounded-lg p-4 text-center text-muted-foreground text-xs transition-all ${isOver ? "border-blue-400 bg-blue-50 text-blue-500" : ""}`}>
                  {isOver ? "Soltar aqui" : "Nenhuma cotação"}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Solicitacoes() {
  const utils = trpc.useUtils();
  const { localUser } = useLocalAuth();
  const { data: cotacoes = [], isLoading } = trpc.cotacoesFrete.list.useQuery({});
  const refresh = () => utils.cotacoesFrete.list.invalidate();

  const isVendedor = localUser?.role === "vendas";
  const isLogistica = localUser?.role === "logistica" || localUser?.role === "admin" || localUser?.role === "master";

  // Bug 3 fix: vendedor vê apenas suas próprias cotações
  const minhasCotacoes = isVendedor
    ? cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase())
    : cotacoes;

  if (isLoading) {
    return <div className="p-6"><div className="h-8 bg-muted animate-pulse rounded w-48" /></div>;
  }

  return (
    <div className="p-6 space-y-4">
      {/* Barra de navegação */}
      <div className="flex items-center -mx-6 -mt-6 mb-4 px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-500" />
            Solicitações de Frete
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isVendedor ? `Minhas solicitações — ${minhasCotacoes.length} total` : `Kanban de cotações — ${cotacoes.length} total`}
          </p>
        </div>
        <NovaCotacaoDialog onSuccess={refresh} />
      </div>

      {/* Bug 3 fix: abas Logística / Minhas Cotações para usuários com acesso total */}
      {isLogistica ? (
        <Tabs defaultValue="todas">
          <TabsList>
            <TabsTrigger value="todas">Todas as Cotações ({cotacoes.length})</TabsTrigger>
            <TabsTrigger value="minhas">Minhas Solicitações ({cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase()).length})</TabsTrigger>
          </TabsList>
          <TabsContent value="todas" className="mt-4">
            <KanbanView cotacoes={cotacoes as Cotacao[]} onRefresh={refresh} isVendedor={false} />
          </TabsContent>
          <TabsContent value="minhas" className="mt-4">
            <KanbanView cotacoes={cotacoes.filter((c: any) => c.solicitanteNome?.toLowerCase() === localUser?.name?.toLowerCase()) as Cotacao[]} onRefresh={refresh} isVendedor={true} />
          </TabsContent>
        </Tabs>
      ) : (
        <KanbanView cotacoes={minhasCotacoes as Cotacao[]} onRefresh={refresh} isVendedor={isVendedor} />
      )}
    </div>
  );
}
