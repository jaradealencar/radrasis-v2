import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  STATUS_CAMPANHA, STATUS_CAMPANHA_LABEL, TIPO_CAMPANHA_LABEL, TIPOS_CAMPANHA,
  type StatusCampanha, type TipoCampanha,
} from "@shared/campanhas-whatsapp";
import GerenciarCategoriasPopover from "./GerenciarCategoriasPopover";
import type { CampanhaLinha } from "./comuns";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** `null` = nova campanha. */
  campanha: CampanhaLinha | null;
}

function inteiro(v: string): number | null {
  return /^\d+$/.test(v.trim()) ? Number(v.trim()) : null;
}

export default function CampanhaFormDialog({ open, onOpenChange, campanha }: Props) {
  const utils = trpc.useUtils();
  const editando = !!campanha;

  const { data: categorias, isLoading: carregandoCategorias } = trpc.campanhasWhatsapp.listarCategorias.useQuery(undefined, { enabled: open });

  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("");
  const [tipo, setTipo] = useState<TipoCampanha>("recorrente");
  const [frequencia, setFrequencia] = useState("30");
  const [quarentena, setQuarentena] = useState("0");
  const [status, setStatus] = useState<StatusCampanha>("ativa");
  const [aPartirDe, setAPartirDe] = useState("");

  useEffect(() => {
    if (!open) return;
    setNome(campanha?.nome ?? "");
    setDescricao(campanha?.descricao ?? "");
    setCategoria(campanha?.categoria ?? "");
    setTipo(campanha?.tipo ?? "recorrente");
    setFrequencia(String(campanha?.frequenciaDias ?? 30));
    setQuarentena(String(campanha?.quarentenaDias ?? 0));
    setStatus(campanha?.status ?? "ativa");
    setAPartirDe(campanha?.gatilhoAPartirDe ?? "");
  }, [open, campanha]);

  // Nova campanha: assim que a lista de categorias chegar, pré-seleciona a primeira ativa (sem sobrescrever
  // se o usuário já escolheu — por isso `categoria` está na lista de dependências, não só `categorias`).
  useEffect(() => {
    if (!open || categoria || campanha || !categorias) return;
    const primeira = categorias.find(c => c.ativo)?.chave;
    if (primeira) setCategoria(primeira);
  }, [open, categoria, campanha, categorias]);

  // Ativas + a categoria atual da campanha mesmo se foi arquivada depois (senão ela sumiria do Select).
  const opcoesCategoria = useMemo(() => {
    if (!categorias) return [];
    const ativas = categorias.filter(c => c.ativo);
    const arquivadaEmUso = campanha ? categorias.find(c => c.chave === campanha.categoria && !c.ativo) : undefined;
    return arquivadaEmUso ? [...ativas, arquivadaEmUso] : ativas;
  }, [categorias, campanha]);

  const aoSalvar = () => {
    utils.campanhasWhatsapp.invalidate();
    toast.success(editando ? "Campanha atualizada." : "Campanha criada.");
    onOpenChange(false);
  };
  const criar = trpc.campanhasWhatsapp.criar.useMutation({ onSuccess: aoSalvar, onError: e => toast.error(e.message) });
  const atualizar = trpc.campanhasWhatsapp.atualizar.useMutation({ onSuccess: aoSalvar, onError: e => toast.error(e.message) });
  const salvando = criar.isPending || atualizar.isPending;

  const freq = inteiro(frequencia);
  const quar = inteiro(quarentena);
  const erro = !nome.trim() ? "Informe o nome da campanha."
    : !categoria ? "Selecione a categoria."
    : freq === null || freq < 1 || freq > 730 ? "A frequência deve ser um número de 1 a 730 dias."
    : quar === null || quar > 365 ? "A quarentena deve ser um número de 0 a 365 dias."
    : null;

  const salvar = () => {
    if (erro || freq === null || quar === null) return toast.error(erro ?? "Confira os campos.");
    const base = {
      nome: nome.trim(), descricao: descricao.trim() || null, categoria, frequenciaDias: freq, quarentenaDias: quar,
      gatilhoAPartirDe: tipo === "gatilho_venda" && aPartirDe ? aPartirDe : null,
    };
    if (campanha) atualizar.mutate({ id: campanha.id, ...base, status });
    else criar.mutate({ ...base, tipo });
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!salvando) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editando ? "Editar campanha" : "Nova campanha"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="camp-nome">Nome da campanha</Label>
            <Input id="camp-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={160}
              placeholder="Ex.: Reativação — orçamentos parados" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="camp-descricao">Descrição (opcional)</Label>
            <Textarea id="camp-descricao" value={descricao} onChange={e => setDescricao(e.target.value)} maxLength={2000}
              rows={3} placeholder="Objetivo da campanha, público-alvo, roteiro combinado..." />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Categoria</Label>
                <GerenciarCategoriasPopover />
              </div>
              <Select value={categoria} onValueChange={setCategoria} disabled={carregandoCategorias}>
                <SelectTrigger><SelectValue placeholder={carregandoCategorias ? "Carregando..." : "Selecione"} /></SelectTrigger>
                <SelectContent>
                  {opcoesCategoria.map(c => (
                    <SelectItem key={c.chave} value={c.chave}>{c.label}{!c.ativo && " (arquivada)"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={v => setTipo(v as TipoCampanha)} disabled={editando}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS_CAMPANHA.map(t => <SelectItem key={t} value={t}>{TIPO_CAMPANHA_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
              {editando && <p className="text-[11px] text-muted-foreground">O tipo não muda depois de criada.</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="camp-freq">{tipo === "gatilho_venda" ? "Dias após a venda" : "Cadência (dias entre envios)"}</Label>
              <Input id="camp-freq" inputMode="numeric" value={frequencia} onChange={e => setFrequencia(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                {tipo === "gatilho_venda"
                  ? "Contato individual: data de faturamento da venda + este número de dias."
                  : "Próximo envio = último envio + este número de dias."}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="camp-quar">Quarentena (dias)</Label>
              <Input id="camp-quar" inputMode="numeric" value={quarentena} onChange={e => setQuarentena(e.target.value)} />
              <p className="text-[11px] text-muted-foreground">
                Descanso mínimo de um telefone desde qualquer campanha. 0 = sem trava.
              </p>
            </div>
          </div>

          {tipo === "gatilho_venda" && (
            <div className="space-y-1.5">
              <Label htmlFor="camp-apartir">Só vendas faturadas a partir de (opcional)</Label>
              <Input id="camp-apartir" type="date" value={aPartirDe} onChange={e => setAPartirDe(e.target.value)} className="sm:w-48" />
              <p className="text-[11px] text-muted-foreground">
                Vazio = sem limite: toda venda com prazo vencido e ainda não contatada entra na lista. Use para evitar
                que a primeira lista traga o histórico inteiro.
              </p>
            </div>
          )}

          {editando && (
            <div className="space-y-1.5">
              <Label>Situação</Label>
              <Select value={status} onValueChange={v => setStatus(v as StatusCampanha)}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_CAMPANHA.map(s => <SelectItem key={s} value={s}>{STATUS_CAMPANHA_LABEL[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Pausada e arquivada saem do semáforo e dos contadores; o histórico é mantido.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={salvar} disabled={salvando}>
            {salvando && <Spinner className="mr-2" />}{editando ? "Salvar" : "Criar campanha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
