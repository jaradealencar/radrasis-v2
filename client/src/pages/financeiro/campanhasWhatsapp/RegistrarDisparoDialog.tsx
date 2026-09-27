import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, ListChecks, Send, Upload } from "lucide-react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { enviarArquivo } from "@/lib/upload";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import { lerListaContatos, type LeituraLista } from "@/lib/listaContatos";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { diasEntre, formatarDataBr } from "@shared/campanhas-whatsapp";
import { slugArquivo, type CampanhaLinha } from "./comuns";

type Resultado = RouterOutputs["campanhasWhatsapp"]["registrarDisparo"];

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  hoje: string;
  onClose: () => void;
}

function Numero({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className={`text-2xl font-bold ${cor}`}>{fmtNum(valor)}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{rotulo}</div>
    </div>
  );
}

export default function RegistrarDisparoDialog({ campanha, hoje, onClose }: Props) {
  const utils = trpc.useUtils();
  const inputRef = useRef<HTMLInputElement>(null);
  const ehGatilho = campanha?.tipo === "gatilho_venda";

  const [fonte, setFonte] = useState<"arquivo" | "vendas" | "fontes">("arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [leitura, setLeitura] = useState<LeituraLista | null>(null);
  const [lendo, setLendo] = useState(false);
  const [dataEnvio, setDataEnvio] = useState(hoje);
  const [observacoes, setObservacoes] = useState("");
  const [enviandoArquivo, setEnviandoArquivo] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  useEffect(() => {
    if (!campanha) return;
    setFonte("arquivo"); setArquivo(null); setLeitura(null); setLendo(false);
    setDataEnvio(hoje); setObservacoes(""); setResultado(null);
  }, [campanha?.id, hoje]); // eslint-disable-line react-hooks/exhaustive-deps

  const vendas = trpc.campanhasWhatsapp.vendasPosVenda.useQuery(
    { campanhaId: campanha?.id ?? 0 },
    { enabled: !!campanha && ehGatilho && fonte === "vendas" },
  );

  // Sempre habilitada (não só quando fonte==="fontes"): decide se o botão "Usar fontes de dados" aparece.
  const fontesVinculadas = trpc.campanhasWhatsapp.listarFontesDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0 }, { enabled: !!campanha },
  );
  const gerarLista = trpc.campanhasWhatsapp.gerarListaDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0, dataEnvio },
    { enabled: !!campanha && fonte === "fontes", retry: false },
  );

  const registrar = trpc.campanhasWhatsapp.registrarDisparo.useMutation({
    onSuccess: r => {
      setResultado(r);
      utils.campanhasWhatsapp.invalidate();
    },
    onError: e => toast.error(e.message),
  });

  const contatos: Array<{ telefone: string; nome: string; osNumero?: string }> = fonte === "vendas"
    ? (vendas.data?.contatosDisparo ?? [])
    : fonte === "fontes" ? (gerarLista.data?.aprovados ?? [])
    : leitura?.ok ? leitura.contatos : [];
  // A lista já vem da venda mais antiga para a mais nova; a primeira serve de alerta contra disparo em massa "do histórico inteiro".
  const vendaMaisAntiga = fonte === "vendas" ? vendas.data?.pendentes[0]?.dataFaturamento ?? null : null;
  const vendaMaisAntigaEhAntiga = !!vendaMaisAntiga && diasEntre(vendaMaisAntiga, hoje) > 180;
  const processando = enviandoArquivo || registrar.isPending;
  const podeProcessar = !!campanha && contatos.length > 0 && !processando
    && (fonte === "vendas" ? !vendas.isFetching : fonte === "fontes" ? !gerarLista.isFetching : !lendo);

  async function escolherArquivo(file: File | undefined) {
    if (!file) return;
    setArquivo(file); setLeitura(null); setLendo(true);
    setLeitura(await lerListaContatos(file));
    setLendo(false);
  }

  async function processar() {
    if (!campanha) return;
    let arquivoUrl: string | undefined;
    let arquivoNome: string | undefined;
    if (fonte === "arquivo" && arquivo) {
      setEnviandoArquivo(true);
      try {
        const up = await enviarArquivo("documento", arquivo);
        if (up.url.length <= 512) { arquivoUrl = up.url; arquivoNome = up.fileName.slice(0, 256); }
      } catch {
        toast.warning("Não consegui anexar o arquivo original — o disparo será registrado mesmo assim.");
      } finally {
        setEnviandoArquivo(false);
      }
    }
    registrar.mutate({
      campanhaId: campanha.id,
      dataEnvio,
      contatos: contatos.map(c => ({ telefone: c.telefone, nome: c.nome, osNumero: c.osNumero })),
      observacoes: observacoes.trim() || null,
      arquivoUrl, arquivoNome,
    });
  }

  const baixar = (tipo: "enviar" | "ignorados" | "invalidos") => {
    if (!resultado || !campanha) return;
    const base = `${slugArquivo(campanha.nome)}-${dataEnvio}`;
    if (tipo === "enviar") {
      exportRowsToXlsx(resultado.enviar, [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], `${base}-higienizada`, "Enviar");
    } else if (tipo === "ignorados") {
      exportRowsToXlsx(resultado.ignoradosQuarentena, [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
        { header: "ultimo_contato", valor: r => formatarDataBr(r.ultimoContatoEm), largura: 16 },
        { header: "disponivel_em", valor: r => formatarDataBr(r.disponivelEm), largura: 16 },
      ], `${base}-quarentena`, "Quarentena");
    } else {
      exportRowsToXlsx(resultado.invalidosLista, [
        { header: "telefone", valor: r => r.telefoneOriginal, largura: 22 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
        { header: "motivo", valor: r => (r.motivo === "duplicado" ? "Repetido na lista" : "Telefone inválido"), largura: 20 },
      ], `${base}-invalidos`, "Invalidos");
    }
  };

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v && !processando) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Send size={18} className="text-emerald-600" /> Registrar novo disparo</DialogTitle>
          <DialogDescription>
            {campanha?.nome}
            {campanha && campanha.quarentenaDias > 0 && ` · quarentena de ${campanha.quarentenaDias} dias`}
          </DialogDescription>
        </DialogHeader>

        {resultado ? (
          <div className="space-y-4">
            <p className="text-sm font-medium">
              {fmtNum(resultado.recebidos)} contatos processados, {fmtNum(resultado.ignorados)} contatos ignorados por estarem em
              período de quarentena de comunicação.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Numero rotulo="Processados" valor={resultado.recebidos} cor="text-slate-700" />
              <Numero rotulo="Para enviar" valor={resultado.enviados} cor="text-emerald-600" />
              <Numero rotulo="Em quarentena" valor={resultado.ignorados} cor="text-amber-600" />
              <Numero rotulo="Inválidos / repetidos" valor={resultado.invalidos} cor="text-slate-500" />
            </div>

            {resultado.registrado ? (
              <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <span>
                  Disparo registrado.{" "}
                  {resultado.proximaData
                    ? <>Próximo envio previsto: <strong>{formatarDataBr(resultado.proximaData)}</strong>.</>
                    : fonte === "vendas" ? "As vendas dos contatos enviados saíram da lista de pendentes." : null}
                </span>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>Nenhum contato pôde ser enviado, então nada foi registrado e o próximo envio não mudou.</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" disabled={resultado.enviados === 0} onClick={() => baixar("enviar")}>
                <Download size={14} /> Lista higienizada (.xlsx)
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={resultado.ignorados === 0} onClick={() => baixar("ignorados")}>
                <Download size={14} /> Ignorados por quarentena
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={resultado.invalidos === 0} onClick={() => baixar("invalidos")}>
                <Download size={14} /> Inválidos e repetidos
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Envie apenas a lista higienizada: quem está em quarentena já foi descartado do registro.
            </p>
            <DialogFooter><Button onClick={onClose}>Fechar</Button></DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {(ehGatilho || !!fontesVinculadas.data?.length) && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant={fonte === "arquivo" ? "default" : "outline"} className="gap-1.5" onClick={() => setFonte("arquivo")}>
                  <Upload size={14} /> Enviar arquivo
                </Button>
                {ehGatilho && (
                  <Button size="sm" variant={fonte === "vendas" ? "default" : "outline"} className="gap-1.5" onClick={() => setFonte("vendas")}>
                    <ListChecks size={14} /> Usar vendas pendentes
                    {campanha?.vendasPendentes != null && ` (${fmtNum(campanha.vendasPendentes)})`}
                  </Button>
                )}
                {!!fontesVinculadas.data?.length && (
                  <Button size="sm" variant={fonte === "fontes" ? "default" : "outline"} className="gap-1.5" onClick={() => setFonte("fontes")}>
                    <Database size={14} /> Usar fontes de dados ({fontesVinculadas.data.length})
                  </Button>
                )}
              </div>
            )}

            {fonte === "arquivo" ? (
              <div className="space-y-2">
                <Label>Lista de contatos (.csv ou .xlsx)</Label>
                <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                  onChange={e => { escolherArquivo(e.target.files?.[0]); e.target.value = ""; }} />
                <div className="flex items-center gap-3 flex-wrap">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => inputRef.current?.click()} disabled={processando}>
                    <FileSpreadsheet size={14} /> {arquivo ? "Trocar arquivo" : "Escolher arquivo"}
                  </Button>
                  {arquivo && <span className="text-sm text-muted-foreground truncate max-w-xs">{arquivo.name}</span>}
                  {lendo && <Spinner />}
                </div>
                <p className="text-[11px] text-muted-foreground">Colunas obrigatórias: <code>telefone</code> e <code>nome_cliente</code>.</p>

                {leitura && !leitura.ok && (
                  <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" /> <span>{leitura.erro}</span>
                  </div>
                )}
                {leitura?.ok && (
                  <div className="space-y-2">
                    <p className="text-sm text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 size={14} /> {fmtNum(leitura.contatos.length)} contatos lidos
                    </p>
                    <div className="rounded-md border max-h-40 overflow-auto">
                      <Table>
                        <TableHeader><TableRow><TableHead>telefone</TableHead><TableHead>nome_cliente</TableHead></TableRow></TableHeader>
                        <TableBody>
                          {leitura.contatos.slice(0, 5).map((c, i) => (
                            <TableRow key={i}><TableCell>{c.telefone || "—"}</TableCell><TableCell>{c.nome || "—"}</TableCell></TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {leitura.contatos.length > 5 && <p className="text-[11px] text-muted-foreground">Mostrando as 5 primeiras linhas.</p>}
                  </div>
                )}
              </div>
            ) : fonte === "fontes" ? (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                {gerarLista.isFetching ? <Spinner /> : gerarLista.isError ? (
                  <span className="text-red-700">Não consegui gerar a lista: {gerarLista.error.message}</span>
                ) : gerarLista.data ? (
                  <>
                    <p><strong>{fmtNum(gerarLista.data.aprovados.length)}</strong> de {fmtNum(gerarLista.data.totalResolvido)} contatos resolvidos serão incluídos.</p>
                    <ul className="text-[11px] text-muted-foreground list-disc list-inside">
                      {gerarLista.data.porFonte.map((f, i) => (
                        <li key={i}>{f.fonte}: {fmtNum(f.total)} contato(s){f.semTelefone > 0 && `, ${fmtNum(f.semTelefone)} sem telefone`}</li>
                      ))}
                    </ul>
                    {gerarLista.data.ignoradosQuarentenaGlobal.length > 0 && (
                      <p className="text-amber-700">{fmtNum(gerarLista.data.ignoradosQuarentenaGlobal.length)} em quarentena de outra campanha.</p>
                    )}
                    {gerarLista.data.ignoradosCadenciaCampanha.length > 0 && (
                      <p className="text-amber-700">{fmtNum(gerarLista.data.ignoradosCadenciaCampanha.length)} já receberam esta campanha recentemente (cadência).</p>
                    )}
                    {gerarLista.data.invalidosOuDuplicados.length > 0 && (
                      <p className="text-muted-foreground">{fmtNum(gerarLista.data.invalidosOuDuplicados.length)} sem telefone válido ou duplicados entre as fontes.</p>
                    )}
                  </>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border p-3 text-sm space-y-1">
                {vendas.isFetching ? <Spinner /> : vendas.isError ? (
                  <span className="text-red-700">Não consegui carregar as vendas: {vendas.error.message}</span>
                ) : vendas.data && vendas.data.contatosDisparo.length > 0 ? (
                  <>
                    <p><strong>{fmtNum(vendas.data.contatosDisparo.length)}</strong> vendas com prazo vencido e telefone serão incluídas.</p>
                    {vendaMaisAntiga && (
                      <p className={vendaMaisAntigaEhAntiga ? "text-amber-700" : "text-muted-foreground"}>
                        A venda pendente mais antiga foi faturada em {formatarDataBr(vendaMaisAntiga)}.
                        {vendaMaisAntigaEhAntiga && " Vendas muito antigas podem não fazer mais sentido para pós-venda — considere definir “Só vendas faturadas a partir de” na campanha (lápis na tabela)."}
                      </p>
                    )}
                    {vendas.data.pendentesSemTelefone > 0 && (
                      <p className="text-amber-700">{fmtNum(vendas.data.pendentesSemTelefone)} venda(s) sem telefone ficam de fora.</p>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground">Nenhuma venda pendente com telefone no momento.</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[12rem_1fr] gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="disp-data">Data do envio</Label>
                <Input id="disp-data" type="date" value={dataEnvio} max={hoje} onChange={e => setDataEnvio(e.target.value || hoje)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="disp-obs">Observações (opcional)</Label>
                <Textarea id="disp-obs" rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)}
                  placeholder="Ex.: taxa de resposta, texto usado..." maxLength={2000} />
              </div>
            </div>

            {campanha && campanha.quarentenaDias > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Quem recebeu qualquer campanha nos últimos {campanha.quarentenaDias} dias será ignorado e não entra na lista higienizada.
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={processando}>Cancelar</Button>
              <Button onClick={processar} disabled={!podeProcessar} className="gap-1.5">
                {processando ? <Spinner /> : <Send size={14} />}
                {enviandoArquivo ? "Anexando arquivo..." : registrar.isPending ? "Processando..." : "Processar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
