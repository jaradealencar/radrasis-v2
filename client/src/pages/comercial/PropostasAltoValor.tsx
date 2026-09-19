import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { AlertTriangle, MessageCircle, CheckCircle2, Check, Clock, Phone, Star } from "lucide-react";
import { fmtBrl } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";

const VALOR_MINIMO_PADRAO = 7800;

// Estrela ao lado da empresa: amarela = cliente novo (nenhuma compra registrada), vermelha =
// reativado (6+ meses sem comprar). Mesma regra dos relatórios de Clientes Novos/Reativados.
const ESTRELA_NOVO = "fill-yellow-400 text-yellow-500";
const ESTRELA_REATIVADO = "fill-red-500 text-red-600";

// ── Mensagem padrão do botão de WhatsApp ─────────────────────────────────────
// Abre a conversa já com este texto digitado (o WhatsApp só preenche a caixa — quem clica
// revisa e envia). Para mudar o texto, é só editar a função abaixo.
function mensagemWhatsAppProposta(nomeContato: string): string {
  return `Oi${nomeContato ? ` ${nomeContato}` : ""}, Daniel aqui, diretor da Letreiros Express. `
    + `Estou analisando uns orçamentos e resolvi te mandar uma mensagem.`;
}

// "JOSE" → "Jose"; "Jorge / Alexandre" → "Jorge"; "Tadeu Mota" → "Tadeu" (só o primeiro nome do primeiro contato)
function primeiroNome(contato: string | null | undefined): string {
  const primeiro = (contato ?? "").split(/[\/,;&]/)[0].trim().split(/\s+/)[0] ?? "";
  return primeiro ? primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase() : "";
}

// whatsappLink vem como https://wa.me/<número>; o texto entra em ?text= já codificado
function linkWhatsAppComMensagem(link: string, nomeContato: string | null | undefined): string {
  return `${link}?text=${encodeURIComponent(mensagemWhatsAppProposta(primeiroNome(nomeContato)))}`;
}

// "5567998513463" → "(67) 99851-3463". Se o formato não for reconhecido, devolve como veio.
function fmtTelefone(tel: string | null | undefined): string {
  if (!tel) return "";
  const digitos = tel.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return tel;
}

function fmtDataHora(d: string | Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  return dt.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// dataCadastro vem do historico_orcamentos com datas em formato misto (dd/mm/aaaa
// na maioria, algumas em ISO) — ver memória "Histórico: datas em formato misto".
function extrairDiaDoMes(dataStr: string | null | undefined): number | null {
  if (!dataStr) return null;
  const texto = String(dataStr).trim();
  const br = texto.match(/^(\d{2})\/\d{2}\/\d{4}/);
  if (br) return parseInt(br[1], 10);
  const iso = texto.match(/^\d{4}-\d{2}-(\d{2})/);
  if (iso) return parseInt(iso[1], 10);
  const dt = new Date(texto);
  return isNaN(dt.getTime()) ? null : dt.getDate();
}

export default function PropostasAltoValor({ mes, ano }: { mes: number; ano: number }) {
  const [listaAberta, setListaAberta] = useState(false);
  const [propostaFollowup, setPropostaFollowup] = useState<{ orcNumero: string; empresa: string } | null>(null);
  const [motivo, setMotivo] = useState("");
  const [diaDe, setDiaDe] = useState("");
  const [diaAte, setDiaAte] = useState("");

  const utils = trpc.useUtils();
  const { user } = useAuth();
  const queryInput = { mes, ano, valorMinimo: VALOR_MINIMO_PADRAO };
  const { data, isLoading, refetch } = trpc.performanceComercial.getPropostasAltoValor.useQuery(
    queryInput,
    { enabled: listaAberta || true, staleTime: 5 * 60 * 1000 }
  );

  // Caixinha "Contatado": atualização otimista (a consulta de propostas é pesada demais para
  // refazer a cada clique) e volta ao estado anterior se o servidor recusar.
  const marcarContatada = trpc.performanceComercial.setPropostaContatada.useMutation({
    onMutate: async (vars) => {
      await utils.performanceComercial.getPropostasAltoValor.cancel(queryInput);
      const anterior = utils.performanceComercial.getPropostasAltoValor.getData(queryInput);
      utils.performanceComercial.getPropostasAltoValor.setData(queryInput, old => old && ({
        ...old,
        propostas: old.propostas.map(p => p.orcNumero !== vars.orcNumero ? p : {
          ...p,
          contatado: vars.contatado,
          contatadoPor: vars.contatado ? (user?.name ?? null) : null,
          contatadoEm: vars.contatado ? new Date() : null,
        }),
      }));
      return { anterior };
    },
    onError: (_erro, _vars, contexto) => {
      if (contexto?.anterior) utils.performanceComercial.getPropostasAltoValor.setData(queryInput, contexto.anterior);
    },
  });

  const registrarFollowup = trpc.performanceComercial.registrarFollowupProposta.useMutation({
    onSuccess: () => {
      utils.performanceComercial.getPropostasAltoValor.invalidate(queryInput);
      setPropostaFollowup(null);
      setMotivo("");
    },
  });

  const propostas = data?.propostas ?? [];
  const totalContatadas = propostas.filter(p => p.contatado).length;
  const totalNovos = propostas.filter(p => p.clienteStatus === "novo").length;
  const totalReativados = propostas.filter(p => p.clienteStatus === "reativado").length;

  const propostasFiltradas = useMemo(() => {
    const de = diaDe ? parseInt(diaDe, 10) : null;
    const ate = diaAte ? parseInt(diaAte, 10) : null;
    if (de == null && ate == null) return propostas;
    return propostas.filter(p => {
      const dia = extrairDiaDoMes(p.dataCadastro);
      if (dia == null) return true;
      if (de != null && dia < de) return false;
      if (ate != null && dia > ate) return false;
      return true;
    });
  }, [propostas, diaDe, diaAte]);

  // Telefone e link do MubiSys só vêm do cache de orçamentos do MubiSys, que pode ainda estar
  // esquentando quando a consulta roda ao montar a página. Se faltou algum, reconsulta ao abrir.
  function abrirRelatorio() {
    setListaAberta(true);
    if (propostas.some(p => !p.whatsappLink || !p.mubisysLink)) refetch();
  }

  function confirmarFollowup() {
    if (!propostaFollowup || motivo.trim().length < 3) return;
    registrarFollowup.mutate({
      orcNumero: propostaFollowup.orcNumero,
      empresa: propostaFollowup.empresa,
      mes,
      ano,
      motivo: motivo.trim(),
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <div>
            <h2 className="text-sm font-semibold text-slate-700">
              Propostas acima de {fmtBrl(VALOR_MINIMO_PADRAO)}
            </h2>
            <p className="text-xs text-slate-400">Propostas em aberto do mês que merecem follow-up prioritário</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={abrirRelatorio}>
          Ver relatório
          {!isLoading && propostas.length > 0 && (
            <Badge variant="secondary" className="ml-2">{propostas.length}</Badge>
          )}
        </Button>
      </div>

      <Dialog open={listaAberta} onOpenChange={setListaAberta}>
        {/* O prefixo sm: é necessário: o DialogContent base fixa sm:max-w-lg, que um max-w-* sem breakpoint não sobrescreve.
            Largura = 96% da tela (até 1400px): com o antigo max-w-6xl (1152px) a tabela de 8 colunas não cabia. */}
        <DialogContent className="sm:max-w-[min(96vw,1400px)] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Propostas acima de {fmtBrl(VALOR_MINIMO_PADRAO)} — em aberto</DialogTitle>
          </DialogHeader>

          {!isLoading && propostas.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
              <span className="font-medium">Filtrar por dia do mês:</span>
              <Input
                type="number" min={1} max={31} placeholder="De"
                value={diaDe} onChange={e => setDiaDe(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              <span>até</span>
              <Input
                type="number" min={1} max={31} placeholder="Até"
                value={diaAte} onChange={e => setDiaAte(e.target.value)}
                className="w-16 h-7 text-xs"
              />
              {(diaDe || diaAte) && (
                <Button
                  size="sm" variant="ghost" className="h-7 px-2 text-xs"
                  onClick={() => { setDiaDe(""); setDiaAte(""); }}
                >
                  Limpar
                </Button>
              )}
              <span className="ml-auto">
                {propostasFiltradas.length} de {propostas.length} proposta{propostas.length > 1 ? "s" : ""}
                {totalContatadas > 0 && <> · <span className="text-green-600 font-medium">{totalContatadas} contatada{totalContatadas > 1 ? "s" : ""}</span></>}
              </span>
            </div>
          )}

          {!isLoading && propostas.length > 0 && (
            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-500 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <Star className={`w-3.5 h-3.5 ${ESTRELA_NOVO}`} />
                Cliente novo — nenhuma compra registrada <strong className="text-slate-600">({totalNovos})</strong>
              </span>
              <span className="inline-flex items-center gap-1">
                <Star className={`w-3.5 h-3.5 ${ESTRELA_REATIVADO}`} />
                Reativado — 6+ meses sem comprar <strong className="text-slate-600">({totalReativados})</strong>
              </span>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-slate-400">Carregando propostas...</div>
          ) : propostas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhuma proposta em aberto acima do valor de corte neste mês.</div>
          ) : propostasFiltradas.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">Nenhuma proposta cadastrada nesse intervalo de dias.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead title="Número do orçamento no MubiSys">Nº Orçamento</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-center">WhatsApp</TableHead>
                  <TableHead className="text-center" title="Marque quando já tiver conversado com o cliente sobre esta proposta">Contatado</TableHead>
                  <TableHead>Follow-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propostasFiltradas.map(p => (
                  <TableRow key={p.orcNumero} className={p.contatado ? "bg-green-50 hover:bg-green-100" : ""}>
                    <TableCell className="font-mono">
                      {p.mubisysLink ? (
                        <a
                          href={p.mubisysLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:text-blue-900 underline underline-offset-2"
                          title="Abrir este orçamento no MubiSys"
                        >
                          {p.orcNumero}
                        </a>
                      ) : (
                        <span className="text-blue-700" title="Link indisponível: os dados do MubiSys deste mês ainda não foram carregados">
                          {p.orcNumero || "—"}
                        </span>
                      )}
                    </TableCell>
                    {/* Empresa, Vendedor e Data quebram linha: sem isso a tabela passa da largura do
                        modal e as colunas da direita (Contatado, Follow-up) somem atrás da rolagem horizontal */}
                    <TableCell className="font-medium whitespace-normal">
                      <div className="flex items-start gap-1.5">
                        {p.clienteStatus && (
                          <span
                            className="shrink-0 mt-0.5"
                            title={p.clienteStatus === "novo"
                              ? "Cliente novo — nenhuma compra registrada no sistema antes deste mês"
                              : `Cliente reativado — sem comprar há ${p.mesesSemComprar} meses${p.ultimaCompra ? ` (última compra em ${p.ultimaCompra})` : ""}`}
                          >
                            <Star className={`w-4 h-4 ${p.clienteStatus === "novo" ? ESTRELA_NOVO : ESTRELA_REATIVADO}`} />
                          </span>
                        )}
                        <div>
                          {p.empresa}
                          {p.contato && <div className="text-xs text-slate-400">{p.contato}</div>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-normal">{p.vendedor}</TableCell>
                    <TableCell className="text-right font-mono font-medium text-green-700 whitespace-nowrap">{fmtBrl(p.valor)}</TableCell>
                    <TableCell className="text-sm text-slate-500 whitespace-normal">{p.dataCadastro}</TableCell>
                    <TableCell className="text-center">
                      {p.whatsappLink ? (
                        <a
                          href={linkWhatsAppComMensagem(p.whatsappLink, p.contato)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full transition-colors whitespace-nowrap"
                          title={`Abrir conversa${p.contato ? ` com ${p.contato}` : ""} no WhatsApp, com a mensagem padrão já digitada`}
                        >
                          <MessageCircle className="w-3 h-3" />
                          {fmtTelefone(p.telefone)}
                        </a>
                      ) : (
                        <span className="text-slate-300 text-xs inline-flex items-center gap-1 whitespace-nowrap">
                          <Phone className="w-3 h-3" /> sem tel.
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => marcarContatada.mutate({
                          orcNumero: p.orcNumero, empresa: p.empresa, mes, ano, contatado: !p.contatado,
                        })}
                        disabled={marcarContatada.isPending || !p.orcNumero}
                        aria-pressed={p.contatado}
                        className={`w-5 h-5 rounded border-2 inline-flex items-center justify-center transition-colors cursor-pointer ${
                          p.contatado
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-slate-300 hover:border-green-400 bg-white"
                        }`}
                        title={p.contatado
                          ? `Contatado${p.contatadoPor ? ` por ${p.contatadoPor}` : ""}${p.contatadoEm ? ` em ${fmtDataHora(p.contatadoEm)}` : ""} — clique para desmarcar`
                          : "Marcar como contatado"}
                      >
                        {p.contatado && <Check className="w-3 h-3" />}
                      </button>
                    </TableCell>
                    {/* O botão de registrar follow-up fica dentro desta coluna (antes era uma coluna
                        "Ações" à parte): com ela, a tabela passava ~50px do modal em telas de ~1240px */}
                    <TableCell>
                      <div className="flex flex-col items-start gap-1.5">
                        {p.qtdFollowups === 0 ? (
                          <Badge variant="outline" className="text-amber-600 border-amber-300">Sem contato</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                              {p.qtdFollowups} contato{p.qtdFollowups > 1 ? "s" : ""}
                            </Badge>
                            <div className="text-xs text-slate-400 flex flex-col gap-0.5">
                              {p.followups.slice(0, 3).map((f: (typeof p.followups)[number]) => (
                                <div key={f.id} className="flex items-start gap-1" title={f.motivo}>
                                  <Clock className="w-3 h-3 mt-0.5 shrink-0" />
                                  <span className="truncate max-w-[220px]">
                                    <strong>{f.usuarioNome}</strong> ({fmtDataHora(f.contatadoEm)}): {f.motivo}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 whitespace-nowrap"
                          onClick={() => setPropostaFollowup({ orcNumero: p.orcNumero, empresa: p.empresa })}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Contato realizado
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!propostaFollowup} onOpenChange={(open) => { if (!open) { setPropostaFollowup(null); setMotivo(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar contato — {propostaFollowup?.empresa}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-600">O que foi feito nesse follow-up?</label>
            <Textarea
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: liguei e o cliente pediu para retornar semana que vem"
              rows={4}
              autoFocus
            />
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => { setPropostaFollowup(null); setMotivo(""); }}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFollowup}
              disabled={motivo.trim().length < 3 || registrarFollowup.isPending}
            >
              {registrarFollowup.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
