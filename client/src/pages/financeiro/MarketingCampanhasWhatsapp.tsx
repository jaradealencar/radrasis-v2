import { useState } from "react";
import { AlertTriangle, BanIcon, BarChart3, CalendarDays, Copy, History, ListChecks, Megaphone, MoreHorizontal, Pencil, Plus, Send, Siren, CalendarClock, LayoutList, Trash2, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import KpiCard from "@/components/KpiCard";
import { formatarDataBr } from "@shared/campanhas-whatsapp";
import CalendarioCampanhas from "./campanhasWhatsapp/CalendarioCampanhas";
import CampanhaFormDialog from "./campanhasWhatsapp/CampanhaFormDialog";
import ContatosCampanhaDialog from "./campanhasWhatsapp/ContatosCampanhaDialog";
import DuplicarCampanhaDialog from "./campanhasWhatsapp/DuplicarCampanhaDialog";
import ExcluirCampanhaDialog from "./campanhasWhatsapp/ExcluirCampanhaDialog";
import NaoReceberMensagens from "./campanhasWhatsapp/NaoReceberMensagens";
import HistoricoDialog from "./campanhasWhatsapp/HistoricoDialog";
import RegistrarDisparoDialog from "./campanhasWhatsapp/RegistrarDisparoDialog";
import RelatorioPeriodo from "./campanhasWhatsapp/RelatorioPeriodo";
import VendasPosVendaDialog from "./campanhasWhatsapp/VendasPosVendaDialog";
import { StatusCampanhaBadge, type CampanhaLinha } from "./campanhasWhatsapp/comuns";

function BotaoIcone({ rotulo, onClick, children }: { rotulo: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClick} aria-label={rotulo}>{children}</Button>
      </TooltipTrigger>
      <TooltipContent>{rotulo}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Aba "Campanhas WhatsApp" do Marketing (ao lado de "ROI Marketing"): cadência dos disparos, semáforo de prazo,
 * quarentena anti-spam por telefone e pós-venda por data da venda. Ver docs/campanhas-whatsapp.md.
 */
export default function MarketingCampanhasWhatsapp() {
  const { data, isLoading, isError, error, refetch } = trpc.campanhasWhatsapp.listar.useQuery();
  const { data: categorias } = trpc.campanhasWhatsapp.listarCategorias.useQuery();
  // Fallback pra própria chave: só aconteceria se a categoria tivesse sido excluída fisicamente por fora
  // (a tela nunca permite excluir uma em uso) — nunca deixa a coluna em branco.
  const labelCategoria = (chave: string) => categorias?.find(c => c.chave === chave)?.label ?? chave;

  // `undefined` = diálogo fechado; `null` no formulário = nova campanha.
  const [formulario, setFormulario] = useState<CampanhaLinha | null | undefined>(undefined);
  const [registrar, setRegistrar] = useState<CampanhaLinha | null>(null);
  const [historico, setHistorico] = useState<CampanhaLinha | null>(null);
  const [vendas, setVendas] = useState<CampanhaLinha | null>(null);
  const [duplicar, setDuplicar] = useState<CampanhaLinha | null>(null);
  const [verContatos, setVerContatos] = useState<CampanhaLinha | null>(null);
  const [excluir, setExcluir] = useState<CampanhaLinha | null>(null);

  if (isLoading) {
    return <div className="flex justify-center py-20"><Spinner className="size-7 text-muted-foreground" /></div>;
  }
  if (isError || !data) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-muted-foreground">
        <AlertTriangle size={28} className="text-amber-500" />
        <p className="text-sm">Não foi possível carregar as campanhas{error ? `: ${error.message}` : "."}</p>
        <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  const { hoje, campanhas, resumo } = data;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <Megaphone size={18} className="text-emerald-600" /> Campanhas e cadência no WhatsApp
          </h2>
          <p className="text-sm text-muted-foreground">
            Controle de frequência dos disparos, alerta de prazo e trava anti-spam por telefone.
          </p>
        </div>
        <Button className="gap-1.5" onClick={() => setFormulario(null)}><Plus size={15} /> Nova campanha</Button>
      </div>

      <Tabs defaultValue="painel">
        <TabsList>
          <TabsTrigger value="painel" className="gap-1.5"><LayoutList size={14} /> Painel</TabsTrigger>
          <TabsTrigger value="calendario" className="gap-1.5"><CalendarDays size={14} /> Calendário</TabsTrigger>
          <TabsTrigger value="relatorios" className="gap-1.5"><BarChart3 size={14} /> Relatórios</TabsTrigger>
          <TabsTrigger value="nao-receber" className="gap-1.5"><BanIcon size={14} /> Não quer receber</TabsTrigger>
        </TabsList>

        <TabsContent value="painel" className="space-y-4 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <KpiCard variant="border" label="Campanhas ativas" value={resumo.ativas} icon={Megaphone} color="#1e6fd9" />
            <KpiCard
              variant="border" label="Pendentes para hoje" value={resumo.pendentesHoje} icon={Siren} color="#dc2626"
              sub="Disparar hoje ou atrasadas"
            />
            <KpiCard
              variant="border" label="Campanhas da semana" value={resumo.daSemana} icon={CalendarClock} color="#d97706"
              sub="Vencem nos próximos 7 dias"
            />
          </div>

          {campanhas.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon"><Megaphone /></EmptyMedia>
                <EmptyTitle>Nenhuma campanha cadastrada</EmptyTitle>
                <EmptyDescription>Crie a primeira para acompanhar prazos e evitar disparos repetidos para o mesmo contato.</EmptyDescription>
              </EmptyHeader>
              <Button className="gap-1.5" onClick={() => setFormulario(null)}><Plus size={15} /> Nova campanha</Button>
            </Empty>
          ) : (
            <div className="rounded-lg border bg-white overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campanha</TableHead>
                    <TableHead>Frequência</TableHead>
                    <TableHead>Envios</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right sticky right-0 bg-white">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campanhas.map(c => (
                    <TableRow key={c.id} className={c.status !== "ativa" ? "opacity-60" : undefined}>
                      <TableCell className="font-medium min-w-[13rem] max-w-[17rem] align-top">
                        <span title={c.descricao ?? undefined}>{c.nome}</span>
                        <div className="text-[11px] font-normal text-muted-foreground">
                          {labelCategoria(c.categoria)}
                          {" · "}{c.tipo === "gatilho_venda" ? "Gatilho de venda" : "Recorrente"}
                          {c.quarentenaDias > 0 && ` · quarentena ${c.quarentenaDias}d`}
                        </div>
                        {c.descricao && (
                          <div className="text-[11px] font-normal text-muted-foreground mt-0.5 line-clamp-2" title={c.descricao}>
                            {c.descricao}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <span className="whitespace-nowrap">{c.frequenciaDias} dias</span>
                        {c.tipo === "gatilho_venda" && (
                          <div className="mt-0.5 max-w-[9.5rem] text-[11px] leading-tight text-muted-foreground">
                            após a venda, e só depois de 16 dias úteis da aprovação
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap align-top text-sm">
                        <div><span className="text-[11px] text-muted-foreground">Último: </span>{c.ultimoEnvio ? formatarDataBr(c.ultimoEnvio) : "—"}</div>
                        <div><span className="text-[11px] text-muted-foreground">Próximo: </span>{c.proximoEnvio ? formatarDataBr(c.proximoEnvio) : "—"}</div>
                      </TableCell>
                      <TableCell className="align-top min-w-[11rem]">
                        <div className="whitespace-nowrap"><StatusCampanhaBadge campanha={c} hoje={hoje} /></div>
                        {c.tipo === "gatilho_venda" && c.status === "ativa" && (c.clientesAguardando ?? 0) > 0 && (
                          <div className="mt-1 max-w-[11rem] text-[11px] leading-tight text-muted-foreground" title="Compraram há menos de 16 dias úteis: ainda não podem receber a mensagem.">
                            + {fmtNum(c.clientesAguardando ?? 0)} aguardando os 16 dias úteis
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="sticky right-0 bg-white align-top shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.12)]">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm" variant="outline" className="gap-1.5 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            disabled={c.status !== "ativa"} onClick={() => setRegistrar(c)}
                          >
                            <Send size={13} /> Registrar disparo
                          </Button>
                          <BotaoIcone rotulo="Ver contatos" onClick={() => (c.tipo === "gatilho_venda" ? setVendas(c) : setVerContatos(c))}><Users size={15} /></BotaoIcone>
                          <BotaoIcone rotulo="Editar campanha" onClick={() => setFormulario(c)}><Pencil size={15} /></BotaoIcone>
                          {/* Ações secundárias num menu: a coluna fica estreita e os ícones sempre alinhados. */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-8" aria-label="Mais ações"><MoreHorizontal size={16} /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {c.tipo === "gatilho_venda" && (
                                <DropdownMenuItem onSelect={() => setVendas(c)}><ListChecks size={14} /> Ver vendas do pós-venda</DropdownMenuItem>
                              )}
                              <DropdownMenuItem onSelect={() => setHistorico(c)}><History size={14} /> Ver histórico</DropdownMenuItem>
                              <DropdownMenuItem onSelect={() => setDuplicar(c)}><Copy size={14} /> Duplicar campanha</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onSelect={() => setExcluir(c)}><Trash2 size={14} /> Excluir campanha</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="calendario" className="pt-3">
          <CalendarioCampanhas />
        </TabsContent>

        <TabsContent value="relatorios" className="pt-3">
          <RelatorioPeriodo />
        </TabsContent>

        <TabsContent value="nao-receber" className="pt-3">
          <NaoReceberMensagens />
        </TabsContent>
      </Tabs>

      <CampanhaFormDialog
        open={formulario !== undefined}
        onOpenChange={v => { if (!v) setFormulario(undefined); }}
        campanha={formulario ?? null}
      />
      <RegistrarDisparoDialog campanha={registrar} hoje={hoje} onClose={() => setRegistrar(null)} />
      <HistoricoDialog campanha={historico} onClose={() => setHistorico(null)} />
      <VendasPosVendaDialog campanha={vendas} onClose={() => setVendas(null)} />
      <DuplicarCampanhaDialog campanha={duplicar} onClose={() => setDuplicar(null)} />
      <ContatosCampanhaDialog campanha={verContatos} onClose={() => setVerContatos(null)} />
      <ExcluirCampanhaDialog campanha={excluir} onClose={() => setExcluir(null)} />
    </div>
  );
}
