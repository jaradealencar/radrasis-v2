import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  Database,
  FolderInput,
  Loader2,
  Plus,
  Settings2,
  Target,
  Upload,
  X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { enviarArquivo } from "@/lib/upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type CampoRegra = "days_since_purchase" | "total_orders" | "orders_last_90_days" | "quote_status" | "days_since_quote" | "orders_after_latest_quote";
type RegraUI = { campo: CampoRegra; operador: "eq" | "neq" | "gt" | "gte" | "lt" | "lte"; valor: string };

const CAMPOS_REGRA: Array<{ valor: CampoRegra; label: string; tipo: "numero" | "status" }> = [
  { valor: "days_since_purchase", label: "Dias sem comprar", tipo: "numero" },
  { valor: "total_orders", label: "Total de pedidos", tipo: "numero" },
  { valor: "orders_last_90_days", label: "Pedidos nos últimos 90 dias", tipo: "numero" },
  { valor: "quote_status", label: "Status do orçamento mais recente", tipo: "status" },
  { valor: "days_since_quote", label: "Dias após o orçamento", tipo: "numero" },
  { valor: "orders_after_latest_quote", label: "Pedidos após o orçamento", tipo: "numero" },
];

/**
 * Gerenciamento das fontes de dados tipo "arquivo" (as 4 "erp" são fixas — só podem ser arquivadas/reativadas,
 * nunca criadas/excluídas pela tela). Fundido com "Arquivos" (decisão do usuário): o upload aqui cria um
 * arquivo "solto" (campanhas_whatsapp_arquivos sem campanhaId) e a fonte só referencia esse arquivo — os
 * contatos são extraídos dele sob demanda ao gerar a lista (server/services/fontesErpCampanhas.ts).
 */
export default function GerenciarFontesPopover() {
  const [open, setOpen] = useState(false);
  const [criando, setCriando] = useState(false);
  const [criandoRegra, setCriandoRegra] = useState(false);
  const [label, setLabel] = useState("");
  const [optInConfirmado, setOptInConfirmado] = useState(false);
  const [regras, setRegras] = useState<RegraUI[]>([{ campo: "total_orders", operador: "gte", valor: "5" }]);
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const { data: fontes, isLoading } =
    trpc.campanhasWhatsapp.listarFontes.useQuery(undefined, { enabled: open });
  const invalidar = () => utils.campanhasWhatsapp.listarFontes.invalidate();

  const adicionarArquivo =
    trpc.campanhasWhatsapp.adicionarArquivo.useMutation();
  const criarFonteArquivo =
    trpc.campanhasWhatsapp.criarFonteArquivo.useMutation({
      onSuccess: () => {
        setLabel("");
        setCriando(false);
        invalidar();
        toast.success("Fonte criada.");
      },
      onError: e => toast.error(e.message),
    });
  const criarFonteCampanhaArquivos =
    trpc.campanhasWhatsapp.criarFonteCampanhaArquivos.useMutation({
      onSuccess: () => {
        setLabel("");
        setCriando(false);
        invalidar();
        toast.success(
          "Fonte criada. Anexe a lista em cada campanha, em Arquivos."
        );
      },
      onError: e => toast.error(e.message),
    });
  const criarFonteRegras = trpc.campanhasWhatsapp.criarFonteRegrasErp.useMutation({
    onSuccess: () => {
      setLabel(""); setCriandoRegra(false); setRegras([{ campo: "total_orders", operador: "gte", valor: "5" }]);
      invalidar(); toast.success("Regra dinâmica ERP criada.");
    },
    onError: e => toast.error(e.message),
  });
  const arquivar = trpc.campanhasWhatsapp.arquivarFonte.useMutation({
    onSuccess: invalidar,
    onError: e => toast.error(e.message),
  });

  async function escolherArquivo(file: File | undefined) {
    if (!file || !label.trim()) {
      if (!label.trim())
        toast.error("Dê um nome à fonte antes de escolher o arquivo.");
      return;
    }
    const ehLista = /\.(csv|txt|xls|xlsx|xml)$/i.test(file.name);
    if (ehLista && !optInConfirmado) {
      toast.error("Confirme o opt-in dos contatos da planilha.");
      return;
    }
    setEnviando(true);
    try {
      const up = await enviarArquivo("documento", file);
      const arquivo = await adicionarArquivo.mutateAsync({
        nome: file.name,
        url: up.url,
        tamanhoBytes: file.size,
        optInConfirmado: ehLista && optInConfirmado,
      });
      await criarFonteArquivo.mutateAsync({
        label: label.trim(),
        arquivoId: arquivo.id,
      });
    } catch {
      toast.error("Não consegui salvar essa fonte. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const ocupado =
    enviando || arquivar.isPending || criarFonteCampanhaArquivos.isPending || criarFonteRegras.isPending;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs gap-1 text-muted-foreground"
        >
          <Settings2 size={12} /> Gerenciar fontes
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="w-96 max-w-[calc(100vw-2rem)] max-h-(--radix-popover-content-available-height) overflow-y-auto p-3 space-y-3"
      >
        <p className="text-xs font-semibold text-slate-700">Fontes de dados</p>

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : (
          <ul className="space-y-0.5 max-h-64 overflow-y-auto">
            {fontes?.map(f => (
              <li
                key={f.id}
                className="flex items-center gap-1.5 text-sm rounded px-1.5 py-1 hover:bg-slate-50"
              >
                {f.tipo === "erp" || f.tipo === "regras_erp" ? (
                  <span
                    title="Fonte automática do histórico local"
                    className="text-blue-500 shrink-0"
                  >
                    ⚙
                  </span>
                ) : f.tipo === "retargeting" ? (
                  <span
                    title="Audiência dinâmica de retargeting via IA"
                    className="shrink-0"
                  >
                    <Target size={13} className="text-violet-600" />
                  </span>
                ) : (
                  <FolderInput size={13} className="text-amber-600 shrink-0" />
                )}
                <span
                  className={`flex-1 truncate ${!f.ativo ? "text-muted-foreground line-through" : ""}`}
                  title={f.descricao ?? undefined}
                >
                  {f.label}
                </span>
                {f.tipo === "retargeting" && (
                  <span className="text-[10px] text-violet-700 bg-violet-50 px-1 rounded">
                    retargeting
                  </span>
                )}
                {f.tipo === "regras_erp" && (
                  <span className="text-[10px] text-blue-700 bg-blue-50 px-1 rounded">regra ERP</span>
                )}
                {f.tipo === "campanha_arquivos" && (
                  <span className="text-[10px] text-muted-foreground">
                    lista por campanha
                  </span>
                )}
                {f.tipo === "arquivo" && f.arquivo && (
                  <span
                    className="text-[10px] text-muted-foreground truncate max-w-[6rem]"
                    title={f.arquivo.nome}
                  >
                    {f.arquivo.nome}
                  </span>
                )}
                <button
                  className="p-1 text-slate-500 hover:bg-slate-100 rounded shrink-0"
                  title={f.ativo ? "Arquivar" : "Reativar"}
                  disabled={ocupado}
                  onClick={() => arquivar.mutate({ id: f.id, ativo: !f.ativo })}
                >
                  {f.ativo ? (
                    <Archive size={13} />
                  ) : (
                    <ArchiveRestore size={13} />
                  )}
                </button>
              </li>
            ))}
            {fontes?.length === 0 && (
              <li className="text-xs text-muted-foreground text-center py-2">
                Nenhuma fonte ainda.
              </li>
            )}
          </ul>
        )}

        <div className="pt-2 border-t space-y-2">
          {!criando && !criandoRegra ? (
            <div className="space-y-1.5">
            <button
              onClick={() => setCriando(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50"
            >
              <Plus size={14} /> Nova fonte externa (upload)
            </button>
            <button
              onClick={() => setCriandoRegra(true)}
              className="w-full flex items-center justify-center gap-1.5 text-xs font-medium py-2 rounded border border-dashed border-blue-400 text-blue-700 hover:bg-blue-50"
            >
              <Database size={14} /> Nova regra dinâmica do ERP
            </button>
            </div>
          ) : criandoRegra ? (
            <div className="space-y-2">
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nome do segmento" className="h-8 text-xs" maxLength={120} />
              {regras.map((regra, index) => {
                const campo = CAMPOS_REGRA.find(c => c.valor === regra.campo)!;
                return <div key={index} className="space-y-1 rounded border bg-white p-2">
                  <Select value={regra.campo} onValueChange={v => setRegras(current => current.map((r, i) => i === index ? { ...r, campo: v as CampoRegra, operador: v === "quote_status" ? "eq" : r.operador, valor: v === "quote_status" ? "pending" : "0" } : r))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CAMPOS_REGRA.map(c => <SelectItem key={c.valor} value={c.valor}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                  <div className="grid grid-cols-[1fr_1fr_28px] gap-1.5">
                    <Select value={regra.operador} onValueChange={v => setRegras(current => current.map((r, i) => i === index ? { ...r, operador: v as RegraUI["operador"] } : r))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="eq">igual</SelectItem><SelectItem value="neq">diferente</SelectItem>{campo.tipo === "numero" && <><SelectItem value="gt">maior que</SelectItem><SelectItem value="gte">maior/igual</SelectItem><SelectItem value="lt">menor que</SelectItem><SelectItem value="lte">menor/igual</SelectItem></>}</SelectContent>
                    </Select>
                    {campo.tipo === "status" ? <Select value={regra.valor} onValueChange={v => setRegras(current => current.map((r, i) => i === index ? { ...r, valor: v } : r))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pending">Pendente</SelectItem><SelectItem value="won">Ganho</SelectItem><SelectItem value="lost">Perdido</SelectItem><SelectItem value="other">Outro</SelectItem></SelectContent>
                    </Select> : <Input type="number" min={0} value={regra.valor} onChange={e => setRegras(current => current.map((r, i) => i === index ? { ...r, valor: e.target.value } : r))} className="h-8 text-xs" />}
                    <Button type="button" size="icon" variant="ghost" disabled={regras.length <= 1} onClick={() => setRegras(current => current.filter((_, i) => i !== index))}><X size={13} /></Button>
                  </div>
                </div>;
              })}
              <p className="text-[10px] text-muted-foreground">Todas as condições precisam ser verdadeiras (AND).</p>
              <div className="flex gap-1.5">
                <Button type="button" size="sm" variant="outline" className="flex-1" disabled={ocupado || !label.trim() || regras.some(r => !r.valor.trim() || (r.campo !== "quote_status" && !/^\d+$/.test(r.valor)))} onClick={() => criarFonteRegras.mutate({
                  label: label.trim(),
                  regras: regras.map(r => ({ campo: r.campo, operador: r.operador, valor: r.campo === "quote_status" ? r.valor as "pending" | "won" | "lost" | "other" : Number(r.valor) })),
                })}>Criar regra</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => { setCriandoRegra(false); setLabel(""); }}>Cancelar</Button>
              </div>
              <Button type="button" variant="link" size="sm" className="h-7 p-0" onClick={() => setRegras(current => [...current, { campo: "days_since_purchase", operador: "gte", valor: "60" }])} disabled={regras.length >= 10}><Plus size={13} /> Adicionar condição</Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="Nome da fonte (ex.: Prospecção Google Maps)"
                className="h-8 text-xs"
                maxLength={120}
                autoFocus
              />
              <input
                ref={inputRef}
                type="file"
                className="hidden"
                onChange={e => {
                  escolherArquivo(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <label className="flex items-start gap-2 text-[11px] text-slate-700">
                <Checkbox checked={optInConfirmado} onCheckedChange={v => setOptInConfirmado(v === true)} className="mt-0.5" />
                Confirmo que a planilha contém contatos com opt-in válido para WhatsApp.
              </label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 flex-1"
                  disabled={ocupado}
                  onClick={() => inputRef.current?.click()}
                >
                  {ocupado ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}{" "}
                  {ocupado ? "Salvando..." : "Escolher arquivo"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  disabled={ocupado}
                  onClick={() => {
                    setCriando(false);
                    setLabel("");
                  }}
                >
                  <X size={14} />
                </Button>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 w-full gap-1.5"
                disabled={ocupado}
                onClick={() =>
                  label.trim()
                    ? criarFonteCampanhaArquivos.mutate({ label: label.trim() })
                    : toast.error("Dê um nome à fonte.")
                }
              >
                <FolderInput size={14} /> Criar sem arquivo (cada campanha anexa
                a sua lista)
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Mesmo formato do disparo: colunas <code>telefone</code> e{" "}
                <code>nome_cliente</code>.
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
