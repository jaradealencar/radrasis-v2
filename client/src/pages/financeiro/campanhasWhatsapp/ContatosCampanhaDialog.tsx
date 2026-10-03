import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CalendarRange, Database, Download, Pin, RefreshCw, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import PeriodoApuracao from "./PeriodoApuracao";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarTelefone, hojeCampoGrande } from "@shared/campanhas-whatsapp";
import { slugArquivo, type CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

const MAX_LISTA_TELA = 200;

/**
 * "Ver contatos" — pedido do usuário 28/09/2026: consultar e baixar a audiência de uma campanha (fontes ERP +
 * externas vinculadas) sem precisar passar pelo fluxo de "Registrar disparo" (que já processa/grava o disparo).
 * Reaproveita a mesma query só-leitura `gerarListaDaCampanha` do disparo — nada aqui grava quarentena, cadência
 * nem qualquer outro registro; é puramente consulta + exportação.
 *
 * Período (pedido do usuário 03/10/2026): data inicial/final pela data em que cada contato entrou no grupo.
 * Inicial vazia = primeiro registro do histórico; final "até hoje" = acompanha o relógio, então quem entra no
 * grupo depois aparece sozinho. "Fixar na campanha" grava o período e passa a valer também no disparo.
 */
export default function ContatosCampanhaDialog({ campanha, onClose }: Props) {
  const [aba, setAba] = useState<"aprovados" | "ignorados" | "bloqueados" | "invalidos">("aprovados");
  const hoje = hojeCampoGrande();
  const utils = trpc.useUtils();

  // Período gravado na campanha (atualizado localmente ao fixar, pois `campanha` vem de uma lista já carregada).
  const [salvo, setSalvo] = useState<{ inicio: string | null; fim: string | null }>({ inicio: null, fim: null });
  const [inicio, setInicio] = useState("");
  const [fimAteHoje, setFimAteHoje] = useState(true);
  const [fim, setFim] = useState(hoje);
  // Reinicia a partir do que está gravado sempre que o diálogo abre para uma campanha (não herda a escolha da anterior).
  useEffect(() => {
    if (!campanha) return;
    setSalvo({ inicio: campanha.periodoInicio, fim: campanha.periodoFim });
    setInicio(campanha.periodoInicio ?? "");
    setFimAteHoje(!campanha.periodoFim);
    setFim(campanha.periodoFim ?? hoje);
  }, [campanha?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const periodo = { inicio: inicio || null, fim: fimAteHoje ? null : fim || null };
  const periodoInvalido = !!periodo.inicio && !!periodo.fim && periodo.inicio > periodo.fim;
  const fixado = (periodo.inicio ?? null) === salvo.inicio && (periodo.fim ?? null) === salvo.fim;

  const { data, isFetching, isError, error } = trpc.campanhasWhatsapp.gerarListaDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0, periodo }, { enabled: !!campanha && !periodoInvalido, retry: false },
  );

  // Busca OS e orçamentos recentes no MubiSys e recalcula: quem acabou de comprar sai de "inativos", etc.
  const atualizarErp = trpc.campanhasWhatsapp.atualizarDadosErp.useMutation({
    onSuccess: r => {
      if (!r.atualizado) { toast.info(r.motivo ?? "Dados já atualizados."); return; }
      utils.campanhasWhatsapp.gerarListaDaCampanha.invalidate();
      toast.success(`MubiSys consultado: ${fmtNum(r.osProcessadas)} OS e ${fmtNum(r.orcamentosProcessados)} orçamentos atualizados.`);
    },
    onError: e => toast.error(e.message),
  });

  const fixar = trpc.campanhasWhatsapp.atualizar.useMutation({
    onSuccess: () => {
      setSalvo(periodo);
      utils.campanhasWhatsapp.listar.invalidate();
      toast.success("Período fixado na campanha.");
    },
    onError: e => toast.error(e.message),
  });

  const linhas = !data ? []
    : aba === "aprovados" ? data.aprovados
    : aba === "ignorados" ? [...data.ignoradosQuarentenaGlobal, ...data.ignoradosCadenciaCampanha]
    : aba === "bloqueados" ? data.ignoradosBloqueados
    : data.invalidosOuDuplicados;

  const baixar = () => {
    if (!campanha) return;
    const base = `${slugArquivo(campanha.nome)}-contatos-${periodo.fim ?? hoje}`;
    if (aba === "aprovados" && data) {
      exportRowsToXlsx(data.aprovados, [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], base, "Contatos");
    } else if (aba === "ignorados" && data) {
      exportRowsToXlsx([...data.ignoradosQuarentenaGlobal, ...data.ignoradosCadenciaCampanha], [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], `${base}-ignorados`, "Ignorados");
    } else if (aba === "bloqueados" && data) {
      exportRowsToXlsx(data.ignoradosBloqueados, [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], `${base}-nao-quer-receber`, "Bloqueados");
    } else if (data) {
      exportRowsToXlsx(data.invalidosOuDuplicados, [
        { header: "telefone", valor: r => r.telefoneOriginal, largura: 22 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
        { header: "motivo", valor: r => (r.motivo === "duplicado" ? "Repetido na lista" : "Telefone inválido"), largura: 20 },
      ], `${base}-invalidos`, "Invalidos");
    }
  };

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users size={18} className="text-blue-600" /> Contatos da campanha</DialogTitle>
          <DialogDescription>{campanha?.nome} — audiência resolvida pelas fontes de dados vinculadas na data de referência abaixo</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 rounded-lg border p-3">
          <div className="flex items-center gap-1.5 text-sm font-medium"><CalendarRange size={14} className="text-blue-600" /> Período de apuração (data de entrada no grupo)</div>
          <PeriodoApuracao id="contatos" inicio={inicio} onInicio={setInicio} fimAutomatico={fimAteHoje}
            onFimAutomatico={setFimAteHoje} fim={fim} onFim={setFim} hoje={hoje} inicioPadrao={data?.primeiroRegistro} />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant={fixado ? "outline" : "default"} className="gap-1.5" disabled={fixado || periodoInvalido || fixar.isPending}
              onClick={() => fixar.mutate({ id: campanha!.id, periodoInicio: periodo.inicio, periodoFim: periodo.fim })}>
              {fixar.isPending ? <Spinner className="size-3.5" /> : <Pin size={13} />}
              {fixado ? "Período fixado" : "Fixar na campanha"}
            </Button>
            {(inicio || !fimAteHoje) && (
              <Button size="sm" variant="ghost" onClick={() => { setInicio(""); setFimAteHoje(true); }}>Voltar ao padrão</Button>
            )}
          </div>
          {periodoInvalido && <p className="text-[11px] text-red-600">A data inicial não pode ser depois da final.</p>}
          <p className="text-[11px] text-muted-foreground">
            Cada fonte conta a data de entrada de um jeito: inativos = quando completaram o prazo sem comprar;
            novos e "1 compra" = data da compra; orçaram e não compraram = data do orçamento. Deixando "De" em branco,
            vale desde a primeira compra do histórico. "Novos/Reativados do mês" e "Redução de volume" olham só o
            mês/janela da data final, e listas de arquivo não têm data de entrada, então a data inicial não as afeta.
            "Primeira compra" sem data inicial considera os últimos 60 dias.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
          <Button size="sm" variant="outline" className="gap-1.5" disabled={atualizarErp.isPending} onClick={() => atualizarErp.mutate()}>
            {atualizarErp.isPending ? <Spinner className="size-3.5" /> : <RefreshCw size={13} />} Atualizar do MubiSys
          </Button>
          <span>Consulta as vendas e orçamentos mais recentes (mês atual e anterior) antes de calcular a lista.</span>
        </div>

        {isFetching ? (
          <div className="flex justify-center py-10"><Spinner className="size-6 text-muted-foreground" /></div>
        ) : isError ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {error.message}
              {error.message.includes("fonte") && " Vá em \"Editar campanha\" → \"Fontes de dados\" para vincular ao menos uma."}
            </span>
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 text-sm space-y-1.5">
              <p className="flex items-center gap-1.5"><Database size={13} className="text-slate-500" />
                <strong>{fmtNum(data.aprovados.length)}</strong> de {fmtNum(data.totalResolvido)} contatos resolvidos estão prontos para envio agora.
              </p>
              <ul className="text-[11px] text-muted-foreground list-disc list-inside">
                {data.porFonte.map((f, i) => (
                  <li key={i}>{f.fonte}: {fmtNum(f.total)} contato(s){f.semTelefone > 0 && `, ${fmtNum(f.semTelefone)} sem telefone`}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={aba === "aprovados" ? "default" : "outline"} onClick={() => setAba("aprovados")}>
                Prontos para envio ({fmtNum(data.aprovados.length)})
              </Button>
              <Button size="sm" variant={aba === "ignorados" ? "default" : "outline"} onClick={() => setAba("ignorados")}>
                Em quarentena ({fmtNum(data.ignoradosQuarentenaGlobal.length + data.ignoradosCadenciaCampanha.length)})
              </Button>
              <Button size="sm" variant={aba === "bloqueados" ? "default" : "outline"} onClick={() => setAba("bloqueados")}>
                Não querem receber ({fmtNum(data.ignoradosBloqueados.length)})
              </Button>
              <Button size="sm" variant={aba === "invalidos" ? "default" : "outline"} onClick={() => setAba("invalidos")}>
                Inválidos/repetidos ({fmtNum(data.invalidosOuDuplicados.length)})
              </Button>
            </div>

            <div className="rounded-md border max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    {aba === "invalidos" && <TableHead>Motivo</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 ? (
                    <TableRow><TableCell colSpan={aba === "invalidos" ? 3 : 2} className="text-center text-muted-foreground py-6">Nenhum contato nesta lista.</TableCell></TableRow>
                  ) : linhas.slice(0, MAX_LISTA_TELA).map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{formatarTelefone(c.telefone ?? c.telefoneOriginal ?? "")}</TableCell>
                      <TableCell>{c.nome}</TableCell>
                      {aba === "invalidos" && <TableCell className="text-[11px] text-muted-foreground">{c.motivo === "duplicado" ? "Repetido" : "Telefone inválido"}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {linhas.length > MAX_LISTA_TELA && (
              <p className="text-[11px] text-muted-foreground">Mostrando as {MAX_LISTA_TELA} primeiras — baixe a lista para ver todos os {fmtNum(linhas.length)}.</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" className="gap-1.5" onClick={baixar} disabled={!data || linhas.length === 0}>
            <Download size={14} /> Baixar esta lista (.xlsx)
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
