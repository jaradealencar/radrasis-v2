import { useState } from "react";
import { AlertTriangle, CalendarPlus, Megaphone, MessageSquareText, PauseCircle, Send, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import KpiCard from "@/components/KpiCard";
import { formatarDataBr, hojeCampoGrande, somarDias } from "@shared/campanhas-whatsapp";
import AgendarCampanhaDialog from "./AgendarCampanhaDialog";
import { AgendamentoItem } from "./comuns";

type Periodo = { inicio: string; fim: string };

function inicioDoMes(iso: string): string { return `${iso.slice(0, 8)}01`; }
function fimDoMes(iso: string): string {
  const ano = Number(iso.slice(0, 4));
  const mes = Number(iso.slice(5, 7));
  return somarDias(mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, "0")}-01`, -1);
}

const criarAtalhos = (hoje: string): Array<{ label: string; periodo: Periodo }> => {
  const mesPassadoAncora = somarDias(inicioDoMes(hoje), -1);
  return [
    { label: "Este mês", periodo: { inicio: inicioDoMes(hoje), fim: fimDoMes(hoje) } },
    { label: "Mês passado", periodo: { inicio: inicioDoMes(mesPassadoAncora), fim: fimDoMes(mesPassadoAncora) } },
    { label: "Últimos 30 dias", periodo: { inicio: somarDias(hoje, -29), fim: hoje } },
    { label: "Este ano", periodo: { inicio: `${hoje.slice(0, 4)}-01-01`, fim: `${hoje.slice(0, 4)}-12-31` } },
  ];
};

/**
 * Relatório de campanhas por período (pedido do usuário 27/09/2026): campanhas ativas/inativas (estado atual),
 * contatos alcançados e disparos realizados dentro do recorte de datas escolhido, com o detalhamento por
 * campanha — inclusive os agendamentos do Planner, para marcar ali mesmo se dispararam ou não.
 */
export default function RelatorioPeriodo() {
  const hoje = hojeCampoGrande();
  const [periodo, setPeriodo] = useState<Periodo>(() => ({ inicio: inicioDoMes(hoje), fim: fimDoMes(hoje) }));
  const [agendarPara, setAgendarPara] = useState<{ id: number; nome: string } | null>(null);

  const { data: categorias } = trpc.campanhasWhatsapp.listarCategorias.useQuery();
  const labelCategoria = (chave: string) => categorias?.find(c => c.chave === chave)?.label ?? chave;

  const { data, isFetching, isError, error, refetch } = trpc.campanhasWhatsapp.relatorioPeriodo.useQuery(
    periodo, { placeholderData: prev => prev },
  );

  const atalhos = criarAtalhos(hoje);
  const atalhoAtivo = atalhos.find(a => a.periodo.inicio === periodo.inicio && a.periodo.fim === periodo.fim)?.label;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {atalhos.map(a => (
          <Button key={a.label} size="sm" variant={atalhoAtivo === a.label ? "default" : "outline"} onClick={() => setPeriodo(a.periodo)}>
            {a.label}
          </Button>
        ))}
        <span className="text-slate-300 mx-1">·</span>
        <Input type="date" value={periodo.inicio} max={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} className="w-40" />
        <span className="text-muted-foreground text-sm">até</span>
        <Input type="date" value={periodo.fim} min={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} className="w-40" />
        {isFetching && <Spinner />}
      </div>

      {isError && (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertTriangle size={26} className="text-amber-500" />
          <p className="text-sm">Não consegui carregar o relatório{error ? `: ${error.message}` : "."}</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>Tentar novamente</Button>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard variant="border" label="Campanhas ativas" value={data.kpis.campanhasAtivas} icon={Megaphone} color="#1e6fd9" sub="Estado atual" />
            <KpiCard variant="border" label="Campanhas inativas" value={data.kpis.campanhasInativas} icon={PauseCircle} color="#64748b" sub="Pausadas + arquivadas" />
            <KpiCard
              variant="border" label="Contatos alcançados" value={data.kpis.contatosCadastradosNoPeriodo} icon={Users} color="#059669"
              sub="Telefones distintos no período"
            />
            <KpiCard variant="border" label="Disparos realizados" value={data.kpis.disparosRealizadosNoPeriodo} icon={Send} color="#d97706" sub="Registros de envio no período" />
            <KpiCard
              variant="border" label="Mensagens enviadas" value={data.kpis.contatosEnviadosNoPeriodo} icon={MessageSquareText} color="#7c3aed"
              sub="Soma dos disparos do período"
            />
          </div>

          <div className="rounded-lg border bg-white overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Disparos no período</TableHead>
                  <TableHead className="text-right">Contatos enviados</TableHead>
                  <TableHead className="min-w-64">Agendamentos no período</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.porCampanha.map(c => (
                  <TableRow key={c.id} className={c.status !== "ativa" ? "opacity-60" : undefined}>
                    <TableCell className="font-medium">{c.nome}</TableCell>
                    <TableCell>{labelCategoria(c.categoria)}</TableCell>
                    <TableCell className="text-right">{c.disparosNoPeriodo}</TableCell>
                    <TableCell className="text-right">{c.contatosEnviadosNoPeriodo}</TableCell>
                    <TableCell>
                      {c.agendamentos.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">Nenhum agendamento neste período</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {c.agendamentos.map(a => <AgendamentoItem key={a.id} agendamento={{ ...a, campanhaId: c.id, nome: c.nome, categoria: c.categoria }} />)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" className="gap-1.5" disabled={c.status !== "ativa"} onClick={() => setAgendarPara({ id: c.id, nome: c.nome })}>
                        <CalendarPlus size={14} /> Agendar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-[11px] text-muted-foreground">
            "Contatos alcançados" conta telefones distintos cujo último envio (de qualquer campanha) caiu dentro
            do período — se um telefone recebeu de novo depois do recorte, ele só aparece no período mais recente.
          </p>
        </>
      )}

      <AgendarCampanhaDialog
        open={!!agendarPara} onOpenChange={v => { if (!v) setAgendarPara(null); }}
        campanhaIdInicial={agendarPara?.id}
      />
    </div>
  );
}
