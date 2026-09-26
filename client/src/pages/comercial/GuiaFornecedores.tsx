import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Store, Eye, Users, MousePointerClick, MessageCircle, Plus, Trash2, ExternalLink, Loader2, Phone, RefreshCw,
  CalendarRange, Copy, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import ChartTooltip from "@/components/ChartTooltip";
import { CHART_COLORS } from "@/lib/chartColors";
import { MESES } from "@/lib/format";

// Site espelho (projeto Vercel separado, "guia-letreiros-express"). Se ganhar domínio próprio,
// trocar aqui.
const URL_SITE_PUBLICO = "https://guia-letreiros-express.vercel.app";

const diasEntre = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / 86_400_000);
function somaDias(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function isoHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isoPrimeiroDiaMes(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}
function isoUltimoDiaMes(ano: number, mes: number): string {
  const ultimo = new Date(ano, mes, 0).getDate();
  return `${ano}-${String(mes).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

/** Substitui os placeholders do template do relatório mensal. */
function montarMensagemRelatorio(template: string, quantidade: number, mes: number, ano: number): string {
  return template
    .replaceAll("{{quantidade}}", String(quantidade))
    .replaceAll("{{mes}}", `${MESES[mes - 1]} de ${ano}`);
}

/** Mesma normalização de DDI usada em formatarLinkWhatsApp no servidor — só para exibir/copiar. */
function numeroComDdi(tel: string): string {
  const digitos = tel.replace(/\D/g, "");
  const numero = digitos.length >= 12 && digitos.startsWith("55") ? digitos : `55${digitos}`;
  return `+${numero}`;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-bold text-slate-800">{value}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export default function GuiaFornecedores() {
  const utils = trpc.useUtils();
  const { data: guia, isLoading: carregandoGuia } = trpc.guiaFornecedores.listarPublico.useQuery();
  const { data: stats, isLoading: carregandoStats } = trpc.guiaFornecedores.getEstatisticas.useQuery();
  const { data: overrides } = trpc.guiaFornecedores.listarOverrides.useQuery();
  const { data: config } = trpc.guiaFornecedores.getConfig.useQuery();

  const [mensagem, setMensagem] = useState<string | null>(null);
  const mensagemAtual = mensagem ?? config?.mensagemWhatsapp ?? "";
  const salvarConfig = trpc.guiaFornecedores.salvarConfig.useMutation({
    onSuccess: () => { utils.guiaFornecedores.getConfig.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); toast.success("Mensagem salva."); },
    onError: e => toast.error(e.message),
  });

  // Estatísticas por período (dia ou mês, o usuário escolhe o intervalo) — padrão: mês corrente.
  const agora = new Date();
  const [periodoInicio, setPeriodoInicio] = useState(() => isoPrimeiroDiaMes(agora.getFullYear(), agora.getMonth() + 1));
  const [periodoFim, setPeriodoFim] = useState(() => isoHoje());
  const { data: statsPeriodo, isLoading: carregandoStatsPeriodo } = trpc.guiaFornecedores.getEstatisticasPeriodo.useQuery({ inicio: periodoInicio, fim: periodoFim });
  function aplicarPreset(preset: "hoje" | "7d" | "mes" | "mesPassado") {
    if (preset === "hoje") { const iso = isoHoje(); setPeriodoInicio(iso); setPeriodoFim(iso); }
    else if (preset === "7d") { setPeriodoFim(isoHoje()); setPeriodoInicio(somaDias(isoHoje(), -6)); }
    else if (preset === "mes") { setPeriodoInicio(isoPrimeiroDiaMes(agora.getFullYear(), agora.getMonth() + 1)); setPeriodoFim(isoHoje()); }
    else {
      const mesAnterior = agora.getMonth() === 0 ? 12 : agora.getMonth();
      const anoAnterior = agora.getMonth() === 0 ? agora.getFullYear() - 1 : agora.getFullYear();
      setPeriodoInicio(isoPrimeiroDiaMes(anoAnterior, mesAnterior));
      setPeriodoFim(isoUltimoDiaMes(anoAnterior, mesAnterior));
    }
  }

  // Relatório mensal para fornecedores (mensagem "esse mês te enviamos X indicações").
  const [relMes, setRelMes] = useState(agora.getMonth() + 1);
  const [relAno, setRelAno] = useState(agora.getFullYear());
  const { data: relatorio, isLoading: carregandoRelatorio } = trpc.guiaFornecedores.getRelatorioMensal.useQuery({ mes: relMes, ano: relAno });
  const [mensagemRelatorio, setMensagemRelatorio] = useState<string | null>(null);
  const mensagemRelatorioAtual = mensagemRelatorio ?? config?.mensagemRelatorioMensal ?? "";
  async function copiarTexto(texto: string, sucesso: string) {
    try { await navigator.clipboard.writeText(texto); toast.success(sucesso); }
    catch { toast.error("Não foi possível copiar — copie manualmente."); }
  }

  // Telefones: o histórico antigo não tem telefone gravado; o botão percorre o MubiSys em janelas
  // de 7 dias (uma chamada por vez, cada uma leva alguns segundos) e preenche o que faltar.
  const { data: plano } = trpc.guiaFornecedores.planoTelefones.useQuery();
  const completarJanela = trpc.guiaFornecedores.completarTelefonesJanela.useMutation();
  const [rodando, setRodando] = useState(false);
  const [progresso, setProgresso] = useState<{ feitas: number; total: number; rotulo: string; atualizadas: number; falhas: number } | null>(null);
  const pararRef = useRef(false);
  const semWhatsapp = (guia?.estados ?? []).flatMap(e => e.cidades.flatMap(c => c.fornecedores.filter(f => !f.whatsapp).map(f => ({ nome: f.nome, cidade: c.cidade, uf: e.uf }))));
  const pendentesTotal = (plano ?? []).filter(m => m.precisa).reduce((s, m) => s + m.pendentes, 0);

  // Se a API do MubiSys engasgar numa janela de 7 dias, tenta de novo em metades (menos carga
  // por chamada) até chegar a 1 dia.
  async function tentarJanela(di: string, df: string): Promise<{ ok: boolean; atualizadas: number }> {
    if (pararRef.current) return { ok: true, atualizadas: 0 };
    try {
      return { ok: true, atualizadas: (await completarJanela.mutateAsync({ di, df })).atualizadas };
    } catch {
      const span = diasEntre(di, df);
      if (span < 1) return { ok: false, atualizadas: 0 };
      const meio = somaDias(di, Math.floor(span / 2));
      const a = await tentarJanela(di, meio);
      const b = await tentarJanela(somaDias(meio, 1), df);
      return { ok: a.ok && b.ok, atualizadas: a.atualizadas + b.atualizadas };
    }
  }

  async function completarTelefones() {
    const janelas = (plano ?? []).filter(m => m.precisa)
      .flatMap(m => m.janelas.map(j => ({ ...j, rotulo: `${String(m.mes).padStart(2, "0")}/${m.ano}` })));
    if (janelas.length === 0) { toast.info("O histórico já está completo — o que sobrou a MubiSys não tem."); return; }

    pararRef.current = false;
    setRodando(true);
    let proxima = 0, feitas = 0, atualizadas = 0, falhas = 0, falhasSeguidas = 0;
    // 2 janelas por vez: dobra o ritmo sem sobrecarregar a API (rajadas de 5 causaram timeouts).
    const trabalhador = async () => {
      while (!pararRef.current && falhasSeguidas < 3) {
        const j = janelas[proxima++];
        if (!j) return;
        setProgresso({ feitas, total: janelas.length, rotulo: j.rotulo, atualizadas, falhas });
        const r = await tentarJanela(j.di, j.df);
        atualizadas += r.atualizadas;
        feitas++;
        if (r.ok) falhasSeguidas = 0; else { falhas++; falhasSeguidas++; }
        setProgresso({ feitas, total: janelas.length, rotulo: j.rotulo, atualizadas, falhas });
      }
    };
    await Promise.all([trabalhador(), trabalhador()]);
    setProgresso({ feitas, total: janelas.length, rotulo: "", atualizadas, falhas });
    setRodando(false);
    utils.guiaFornecedores.planoTelefones.invalidate();
    utils.guiaFornecedores.listarPublico.invalidate();
    if (falhasSeguidas >= 3) toast.error(`O MubiSys parou de responder (${atualizadas} telefone(s) preenchido(s) até aqui). Tente de novo em alguns minutos — retoma de onde parou.`);
    else if (falhas > 0) toast.warning(`${atualizadas} telefone(s) preenchido(s); ${falhas} trecho(s) sem resposta do MubiSys — clique de novo para retomar.`);
    else toast.success(`${atualizadas} telefone(s) preenchido(s).`);
  }

  // Ao abrir a aba, se há fornecedor sem WhatsApp e o histórico ainda tem O.S. sem telefone,
  // começa sozinho (uma vez por visita à tela; "Parar" interrompe, o botão retoma).
  const iniciouAutomatico = useRef(false);
  useEffect(() => {
    if (iniciouAutomatico.current || rodando || !plano || carregandoGuia) return;
    if (semWhatsapp.length === 0 || !plano.some(m => m.precisa)) return;
    iniciouAutomatico.current = true;
    void completarTelefones();
  }, [plano, carregandoGuia, semWhatsapp.length]);

  const [novoOverride, setNovoOverride] = useState<{ empresa: string; acao: "incluir" | "excluir"; telefone: string; cidade: string; estado: string } | null>(null);
  const salvarOverride = trpc.guiaFornecedores.salvarOverride.useMutation({
    onSuccess: () => { utils.guiaFornecedores.listarOverrides.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); setNovoOverride(null); toast.success("Ajuste salvo."); },
    onError: e => toast.error(e.message),
  });
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const removerOverride = trpc.guiaFornecedores.removerOverride.useMutation({
    onSuccess: () => { utils.guiaFornecedores.listarOverrides.invalidate(); utils.guiaFornecedores.listarPublico.invalidate(); setRemovendoId(null); toast.success("Ajuste removido."); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-blue-700" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Guia de Fornecedores</h1>
            <p className="text-sm text-slate-500">
              Página pública (sem login) que indica ao consumidor final os clientes ativos da Letreiros Express, por estado e cidade.
            </p>
          </div>
        </div>
        {URL_SITE_PUBLICO ? (
          <a href={URL_SITE_PUBLICO} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="gap-1.5"><ExternalLink className="h-3.5 w-3.5" /> Abrir site público</Button>
          </a>
        ) : (
          <Badge variant="outline" className="text-amber-600 border-amber-300">Site público ainda não publicado</Badge>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Store} label="No guia agora" value={carregandoGuia ? "…" : String(guia?.totalFornecedores ?? 0)} sub={`${guia?.estados.length ?? 0} estados`} />
        <StatCard icon={Eye} label="Visitas (30 dias)" value={carregandoStats ? "…" : String(stats?.visitasTotais ?? 0)} />
        <StatCard icon={Users} label="Visitantes únicos" value={carregandoStats ? "…" : String(stats?.visitantesUnicos ?? 0)} sub="últimos 30 dias" />
        <StatCard icon={MousePointerClick} label="Cliques no WhatsApp" value={carregandoStats ? "…" : String(stats?.cliques.reduce((s, c) => s + c.cliques, 0) ?? 0)} sub="desde o início" />
      </div>

      <p className="text-xs text-slate-400">
        Regra automática: entra quem teve 2+ O.S. válidas nos últimos 12 meses (rolante) e comprou há no máximo 4 meses;
        sai sozinho assim que passar dos 4 meses sem comprar. Os ajustes abaixo funcionam por cima dessa regra.
      </p>

      {/* Estatísticas por período (dia ou mês) + indicações por estado */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-700">Estatísticas por período</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicarPreset("hoje")}>Hoje</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicarPreset("7d")}>7 dias</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicarPreset("mes")}>Este mês</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => aplicarPreset("mesPassado")}>Mês passado</Button>
            <Input type="date" value={periodoInicio} max={periodoFim} onChange={e => setPeriodoInicio(e.target.value)} className="h-7 w-[138px] text-xs" />
            <span className="text-xs text-slate-400">até</span>
            <Input type="date" value={periodoFim} min={periodoInicio} onChange={e => setPeriodoFim(e.target.value)} className="h-7 w-[138px] text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Eye} label="Visitas" value={carregandoStatsPeriodo ? "…" : String(statsPeriodo?.visitasTotais ?? 0)} />
          <StatCard icon={Users} label="Visitantes únicos" value={carregandoStatsPeriodo ? "…" : String(statsPeriodo?.visitantesUnicos ?? 0)} />
          <StatCard icon={MousePointerClick} label="Cliques no WhatsApp" value={carregandoStatsPeriodo ? "…" : String(statsPeriodo?.cliquesTotais ?? 0)} />
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Os cliques anteriores a 26/09/2026 não tinham data registrada: o total do período está certo, mas a divisão por dia deles é aproximada.
        </p>

        <div className="mt-4">
          <h3 className="mb-2 text-xs font-semibold text-slate-600">Indicações por estado no período</h3>
          {!statsPeriodo || statsPeriodo.porEstado.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400">Sem cliques registrados nesse período.</p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(90, statsPeriodo.porEstado.slice(0, 15).length * 28)}>
              <BarChart data={statsPeriodo.porEstado.slice(0, 15)} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} fontSize={12} />
                <YAxis type="category" dataKey="uf" width={40} fontSize={12} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="cliques" name="Cliques" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {statsPeriodo && statsPeriodo.porFornecedor.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold text-slate-600">Cliques por fornecedor no período</h3>
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead>No guia agora?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statsPeriodo.porFornecedor.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.empresaNome}</TableCell>
                    <TableCell className="text-right font-mono">{c.cliques}</TableCell>
                    <TableCell>
                      {c.ativoNoGuia
                        ? <Badge variant="outline" className="border-green-300 text-green-700">Sim</Badge>
                        : <Badge variant="outline" className="border-slate-300 text-slate-500">Não</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Telefones do WhatsApp */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-green-600" />
            <h2 className="text-sm font-semibold text-slate-700">Telefones do WhatsApp</h2>
          </div>
          {rodando ? (
            <Button size="sm" variant="outline" onClick={() => { pararRef.current = true; }}>Parar</Button>
          ) : (
            <Button size="sm" className="gap-1.5" disabled={!plano} onClick={completarTelefones}>
              <RefreshCw className="h-3.5 w-3.5" /> Completar telefones do histórico
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {carregandoGuia ? "Carregando…" : semWhatsapp.length === 0
            ? "Todos os fornecedores do guia têm botão de WhatsApp."
            : `${semWhatsapp.length} de ${guia?.totalFornecedores ?? 0} fornecedores estão sem botão de WhatsApp.`}
          {plano && (pendentesTotal > 0
            ? ` ${pendentesTotal} O.S. dos últimos 13 meses ainda sem telefone gravado — a busca começa sozinha ao abrir esta tela (pode levar alguns minutos).`
            : " Histórico de telefones completo (as poucas O.S. sem número não têm contato na MubiSys).")}
        </p>

        {progresso && (
          <div className="mt-3 space-y-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full bg-green-500 transition-all" style={{ width: `${Math.round((progresso.feitas / Math.max(progresso.total, 1)) * 100)}%` }} />
            </div>
            <p className="text-xs text-slate-500">
              {rodando ? `Buscando ${progresso.rotulo}… ` : "Concluído. "}
              {progresso.feitas} de {progresso.total} trechos · {progresso.atualizadas} telefone(s) preenchido(s)
              {progresso.falhas > 0 && ` · ${progresso.falhas} sem resposta`}
            </p>
          </div>
        )}

        {semWhatsapp.length > 0 && (
          <div className="mt-3 max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-100">
            {semWhatsapp.map(f => (
              <div key={`${f.uf}-${f.cidade}-${f.nome}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
                <span className="truncate"><span className="font-medium text-slate-700">{f.nome}</span> <span className="text-slate-400">· {f.cidade}/{f.uf}</span></span>
                <Button size="sm" variant="ghost" className="h-7 shrink-0 text-blue-700 hover:bg-blue-50"
                  onClick={() => setNovoOverride({ empresa: f.nome, acao: "incluir", telefone: "", cidade: f.cidade, estado: f.uf })}>
                  Cadastrar telefone
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mensagem padrão do WhatsApp */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-green-600" />
          <h2 className="text-sm font-semibold text-slate-700">Mensagem padrão do botão de WhatsApp</h2>
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Já vai digitada quando o consumidor clica em qualquer fornecedor. <code>*negrito*</code> é a formatação do próprio WhatsApp.
        </p>
        <Textarea value={mensagemAtual} onChange={e => setMensagem(e.target.value)} rows={3} className="text-sm" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!mensagem || mensagem === config?.mensagemWhatsapp || salvarConfig.isPending}
            onClick={() => mensagem && salvarConfig.mutate({ mensagemWhatsapp: mensagem })}
          >
            {salvarConfig.isPending ? "Salvando..." : "Salvar mensagem"}
          </Button>
        </div>
      </div>

      {/* Ajustes manuais */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">Ajustes manuais</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNovoOverride({ empresa: "", acao: "excluir", telefone: "", cidade: "", estado: "" })}>
            <Plus className="h-3.5 w-3.5" /> Novo ajuste
          </Button>
        </div>
        {!overrides || overrides.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-400">Nenhum ajuste manual — a lista está 100% automática.</p>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Dados manuais</TableHead>
                <TableHead>Por</TableHead>
                <TableHead className="text-right">-</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {overrides.map((o: any) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.empresaNome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={o.acao === "incluir" ? "border-green-300 text-green-700" : "border-red-300 text-red-700"}>
                      {o.acao === "incluir" ? "Forçar inclusão" : "Excluir da lista"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-500">{[o.telefone, o.cidade, o.estado].filter(Boolean).join(" · ") || "—"}</TableCell>
                  <TableCell className="text-slate-500">{o.usuarioNome ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-red-600 hover:bg-red-50" onClick={() => setRemovendoId(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Ranking de cliques */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Cliques no WhatsApp por fornecedor</h2>
        {carregandoStats ? (
          <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !stats || stats.cliques.length === 0 ? (
          <Empty><EmptyHeader><EmptyTitle>Ainda sem cliques registrados.</EmptyTitle></EmptyHeader></Empty>
        ) : (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead className="text-right">Cliques</TableHead>
                <TableHead>Último clique</TableHead>
                <TableHead>No guia agora?</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.cliques.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{c.empresaNome}</TableCell>
                  <TableCell className="text-right font-mono">{c.cliques}</TableCell>
                  <TableCell className="text-slate-500">{c.ultimoCliqueEm ? new Date(c.ultimoCliqueEm).toLocaleString("pt-BR") : "—"}</TableCell>
                  <TableCell>
                    {c.ativoNoGuia
                      ? <Badge variant="outline" className="border-green-300 text-green-700">Sim</Badge>
                      : <Badge variant="outline" className="border-slate-300 text-slate-500">Não</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Relatório mensal para fornecedores — mensagem "esse mês te enviamos X indicações" */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-blue-700" />
            <h2 className="text-sm font-semibold text-slate-700">Relatório mensal para fornecedores</h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={String(relMes)} onValueChange={v => setRelMes(Number(v))}>
              <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{MESES.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(relAno)} onValueChange={v => setRelAno(Number(v))}>
              <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[agora.getFullYear(), agora.getFullYear() - 1].map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="mb-2 text-xs text-slate-400">
          Avise cada fornecedor quantas indicações ele recebeu no mês — copie a mensagem individual ou junte todos os
          números abaixo para montar sua lista de transmissão no WhatsApp. Use <code>{"{{quantidade}}"}</code> e{" "}
          <code>{"{{mes}}"}</code> no texto, que a tela substitui sozinha.
        </p>
        <Textarea value={mensagemRelatorioAtual} onChange={e => setMensagemRelatorio(e.target.value)} rows={4} className="text-sm" />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!mensagemRelatorio || mensagemRelatorio === config?.mensagemRelatorioMensal || salvarConfig.isPending}
            onClick={() => mensagemRelatorio && salvarConfig.mutate({ mensagemRelatorioMensal: mensagemRelatorio })}
          >
            {salvarConfig.isPending ? "Salvando..." : "Salvar mensagem"}
          </Button>
        </div>

        {carregandoRelatorio ? (
          <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !relatorio || relatorio.itens.length === 0 ? (
          <Empty><EmptyHeader><EmptyTitle>Nenhuma indicação registrada em {MESES[relMes - 1]}/{relAno}.</EmptyTitle></EmptyHeader></Empty>
        ) : (
          <>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {relatorio.itens.length} fornecedor(es) receberam indicação em {MESES[relMes - 1]}/{relAno}.
              </p>
              <Button
                size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                onClick={() => copiarTexto(
                  relatorio.itens.filter(i => i.telefone).map(i => `${numeroComDdi(i.telefone!)} — ${i.empresaNome}`).join("\n"),
                  "Números copiados — cole ao criar a lista de transmissão no WhatsApp.",
                )}
              >
                <Copy className="h-3 w-3" /> Copiar todos os números
              </Button>
            </div>
            <Table className="mt-2 text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead className="text-right">Indicações</TableHead>
                  <TableHead className="text-right">Mensagem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {relatorio.itens.map((item, i) => {
                  const texto = montarMensagemRelatorio(mensagemRelatorioAtual, item.quantidade, relMes, relAno);
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.empresaNome}</TableCell>
                      <TableCell className="text-slate-500">{[item.cidade, item.estado].filter(Boolean).join("/") || "—"}</TableCell>
                      <TableCell className="text-right font-mono">{item.quantidade}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-7 gap-1 text-blue-700 hover:bg-blue-50" onClick={() => copiarTexto(texto, "Mensagem copiada.")}>
                            <Copy className="h-3.5 w-3.5" /> Copiar
                          </Button>
                          {item.whatsappBase && (
                            <a href={`${item.whatsappBase}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="ghost" className="h-7 gap-1 text-green-700 hover:bg-green-50">
                                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                              </Button>
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>

      {/* Prévia do guia (o que o site público mostra) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Prévia — o que o site público mostra agora</h2>
        {carregandoGuia ? (
          <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : !guia || guia.estados.length === 0 ? (
          <Empty><EmptyHeader><EmptyTitle>Nenhum fornecedor qualifica no momento.</EmptyTitle></EmptyHeader></Empty>
        ) : (
          <div className="max-h-[26rem] space-y-4 overflow-y-auto pr-1">
            {guia.estados.map(e => (
              <div key={e.uf}>
                <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
                  <span>{e.uf} — {e.nome}</span>
                  <span className="text-slate-400">{e.total}</span>
                </div>
                {e.cidades.map(c => (
                  <div key={c.cidade} className="mb-1 flex flex-wrap gap-1 pl-2">
                    <span className="text-[11px] font-medium text-slate-400">{c.cidade}:</span>
                    {c.fornecedores.map(f => (
                      <span key={f.nome} className="text-[11px] text-slate-600">{f.nome}{f.telefone ? "" : " (sem telefone)"};</span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Diálogo: novo ajuste manual */}
      <Dialog open={!!novoOverride} onOpenChange={aberto => { if (!aberto) setNovoOverride(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo ajuste manual</DialogTitle></DialogHeader>
          {novoOverride && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Nome da empresa (como aparece no MubiSys)</label>
                <Input value={novoOverride.empresa} onChange={e => setNovoOverride({ ...novoOverride, empresa: e.target.value })} autoFocus />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Ação</label>
                <Select value={novoOverride.acao} onValueChange={(v: "incluir" | "excluir") => setNovoOverride({ ...novoOverride, acao: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excluir">Excluir da lista (mesmo que qualifique)</SelectItem>
                    <SelectItem value="incluir">Forçar inclusão (mesmo sem qualificar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {novoOverride.acao === "incluir" && (
                <>
                  <p className="text-xs text-slate-400">
                    Preencha se a empresa não tiver O.S. recente o bastante para puxar isso sozinha.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="Telefone (67999998888)" value={novoOverride.telefone} onChange={e => setNovoOverride({ ...novoOverride, telefone: e.target.value })} />
                    <Input placeholder="UF" maxLength={2} value={novoOverride.estado} onChange={e => setNovoOverride({ ...novoOverride, estado: e.target.value.toUpperCase() })} />
                  </div>
                  <Input placeholder="Cidade" value={novoOverride.cidade} onChange={e => setNovoOverride({ ...novoOverride, cidade: e.target.value })} />
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOverride(null)}>Cancelar</Button>
            <Button
              disabled={!novoOverride?.empresa.trim() || salvarOverride.isPending}
              onClick={() => novoOverride && salvarOverride.mutate({
                empresa: novoOverride.empresa, acao: novoOverride.acao,
                telefone: novoOverride.telefone || undefined, cidade: novoOverride.cidade || undefined, estado: novoOverride.estado || undefined,
              })}
            >
              {salvarOverride.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar remoção de ajuste */}
      <AlertDialog open={removendoId !== null} onOpenChange={aberto => { if (!aberto) setRemovendoId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover este ajuste?</AlertDialogTitle>
            <AlertDialogDescription>A empresa volta a seguir só a regra automática (2+ compras em 12 meses, ativa há até 4 meses).</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => removendoId != null && removerOverride.mutate({ id: removendoId })}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
