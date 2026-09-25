import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Filter, MessageCircle, XCircle, Download, Loader2,
  Users2, Target, RefreshCw, MessageSquareText, Rocket, Megaphone,
  ChevronDown, ChevronRight, Inbox,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { fmtBrl, fmtDateTime, fmtDate, fmtPct } from "@/lib/format";
import { toast } from "sonner";
import { ScriptsRetencaoPopover } from "@/components/ScriptsRetencaoPopover";
import { linkWhatsAppComTexto } from "@/lib/faixasCrm";
import { primeiroNome as primeiroNomeMensagem } from "@/lib/mensagensCrm";
import { capitalizarNomeProprio } from "@shared/capitalizar-nome";

/**
 * Retenção de Clientes Novos — 4 mensagens em 6 meses, organizadas em
 * campanhas (sub-aba de Inteligência de Clientes). 70% dos clientes que
 * fazem a 1ª compra não voltam a comprar; meta: 50%.
 *
 * Campanha (pedido do usuário, 24/09/2026): agrupar por data exata gerava
 * grupos de 1 cliente, inútil para planejar o disparo. Agora, todo o lote
 * pendente de um estágio vira 1 campanha numerada, disparada em massa.
 */

type EstagioJornada = "d16u" | "d30" | "d90" | "d180";

interface ContatoInfo { contato: string; telefone: string; whatsappLink: string }

type LinhaCliente = {
  id: number;
  empresaKey: string;
  empresa: string;
  osNumero: string | null;
  vendedor: string | null;
  valorPrimeiraCompra: string | null;
  dataPrimeiraCompra: string;
  estagio: EstagioJornada;
  dataAgendada: string;
  status: "pendente" | "disparado" | "descartado";
  diasUteisDecorridos: number;
};

type GrupoCampanha = {
  chave: string;
  estagio: EstagioJornada;
  numero: number | null;
  disparadaEm: string | null;
  disparadoPor: string | null;
  clientes: LinhaCliente[];
};

function baixarCsv(nomeArquivo: string, linhas: string[][]) {
  const csv = linhas.map(l => l.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = nomeArquivo; link.click();
  URL.revokeObjectURL(url);
}

export default function VistaRetencao() {
  const [status, setStatus] = useState<"pendente" | "disparado" | "descartado">("pendente");
  const [estagio, setEstagio] = useState<EstagioJornada | "">("");
  const [apenasVencidos, setApenasVencidos] = useState(true);
  const [contatos, setContatos] = useState<Record<string, ContatoInfo | "carregando">>({});
  const [carregandoGrupo, setCarregandoGrupo] = useState<string | null>(null);
  const [exportandoGrupo, setExportandoGrupo] = useState<string | null>(null);
  // Painel de "Campanhas disparadas": cada campanha é um cartão que começa fechado
  // (só número/data/quantidade) — clica pra abrir e ver os contatos de dentro dela.
  // Pendentes/Descartados continuam sempre abertos (é onde o vendedor age agora).
  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const utils = trpc.useUtils();
  const { data: resumo } = trpc.retencaoClientesNovos.getResumoConversao.useQuery();
  const { data: estagios } = trpc.retencaoClientesNovos.getEstagios.useQuery();
  const { data, isLoading, refetch } = trpc.retencaoClientesNovos.getGrupos.useQuery({
    status, estagio: estagio || undefined, apenasVencidos,
  });

  const marcarDescartadoMut = trpc.retencaoClientesNovos.marcarDescartado.useMutation({ onSuccess: () => refetch() });
  const dispararCampanhaMut = trpc.retencaoClientesNovos.dispararCampanha.useMutation({
    onSuccess: (res) => {
      if (res.ok) toast.success(`Campanha ${res.numero} disparada para ${res.quantidadeClientes} cliente(s)!`);
      else toast.error("Nada pendente e vencido para disparar neste estágio.");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const estagioLabel: Record<string, string> = Object.fromEntries((estagios ?? []).map(e => [e.id, e.label]));

  /** Busca (e cacheia em `contatos`) o contato de quem ainda não tem — usado tanto pelo
   * botão "Carregar contatos" quanto pela exportação de CSV, que não pode depender de o
   * usuário ter clicado em carregar antes. */
  async function garantirContatosDoGrupo(grupo: GrupoCampanha): Promise<Record<string, ContatoInfo>> {
    const faltando = grupo.clientes.filter(c => !contatos[c.empresaKey] && c.osNumero);
    const resultado: Record<string, ContatoInfo> = {};
    for (const c of grupo.clientes) {
      const jaCarregado = contatos[c.empresaKey];
      if (jaCarregado && jaCarregado !== "carregando") resultado[c.empresaKey] = jaCarregado;
    }
    if (faltando.length > 0) {
      setContatos(prev => {
        const novo = { ...prev };
        for (const c of faltando) novo[c.empresaKey] = "carregando";
        return novo;
      });
      await Promise.all(faltando.map(async (c) => {
        try {
          const info = await utils.retencaoClientesNovos.getContatoCliente.fetch({ empresaKey: c.empresaKey, osNumero: c.osNumero! });
          resultado[c.empresaKey] = info;
          setContatos(prev => ({ ...prev, [c.empresaKey]: info }));
        } catch {
          const vazio = { contato: "", telefone: "", whatsappLink: "" };
          resultado[c.empresaKey] = vazio;
          setContatos(prev => ({ ...prev, [c.empresaKey]: vazio }));
        }
      }));
    }
    return resultado;
  }

  async function carregarContatosDoGrupo(grupo: GrupoCampanha) {
    setCarregandoGrupo(grupo.chave);
    await garantirContatosDoGrupo(grupo);
    setCarregandoGrupo(null);
  }

  async function exportarCsv(grupo: GrupoCampanha) {
    setExportandoGrupo(grupo.chave);
    try {
      const contatosDoGrupo = await garantirContatosDoGrupo(grupo);
      // Só nome (primeiro nome, do cadastro do MubiSys) e telefone — pedido explícito do
      // usuário (24/09/2026): nada de empresa/datas/estágio na planilha de disparo. Sem
      // fallback para o nome da empresa quando o contato não foi encontrado: melhor deixar
      // em branco do que mostrar um "nome" que na verdade é razão social/CNPJ.
      const header = ["primeiro_nome", "telefone"];
      const linhas = grupo.clientes.map(c => {
        const info = contatosDoGrupo[c.empresaKey];
        const nomeContato = info?.contato ? capitalizarNomeProprio(info.contato) : "";
        return [
          primeiroNomeMensagem(nomeContato),
          info?.whatsappLink ? info.whatsappLink.replace("https://wa.me/", "") : "",
        ];
      });
      const semContato = linhas.filter(l => !l[0] || !l[1]).length;
      if (semContato > 0) toast.warning(`${semContato} cliente(s) sem nome/telefone encontrado — OS sem contato cadastrado no MubiSys.`);
      const nomeCampanha = grupo.numero ? `campanha-${grupo.numero}-${grupo.estagio}` : `${grupo.estagio}-${status}`;
      baixarCsv(`retencao-${nomeCampanha}.csv`, [header, ...linhas]);
    } finally {
      setExportandoGrupo(null);
    }
  }

  const totalClientes = data?.totalClientes ?? 0;
  const grupos = (data?.grupos ?? []) as GrupoCampanha[];

  return (
    <div className="space-y-4">
      {/* Card de conversão: taxa atual vs. meta */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <Target className="w-3 h-3" /> Taxa de recompra — clientes novos (últimos 12 meses)
            </p>
            <p className="text-2xl font-extrabold text-slate-800 mt-1">
              {resumo ? fmtPct(resumo.taxaAtualPct) : "—"}
              <span className="text-sm font-medium text-slate-400 ml-2">meta: {resumo?.metaPct ?? 50}%</span>
            </p>
          </div>
          <p className="text-[11px] text-slate-400 max-w-sm text-right">
            70% dos clientes que compram pela 1ª vez hoje não voltam a comprar. Esta régua acompanha
            cada cliente novo por 6 meses, em 4 mensagens organizadas em campanhas, para reduzir essa taxa.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          {(["pendente", "disparado", "descartado"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                status === s ? "bg-emerald-600 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200 hover:border-emerald-400"
              }`}
            >
              {s === "pendente" ? "Pendentes" : s === "disparado" ? "Campanhas disparadas" : "Descartados"}
            </button>
          ))}
          <div className="w-px h-5 bg-slate-200 mx-1" />
          <select value={estagio} onChange={e => setEstagio(e.target.value as EstagioJornada | "")} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700">
            <option value="">Todos os estágios</option>
            {(estagios ?? []).map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
          {status === "pendente" && (
            <label className="flex items-center gap-1.5 text-xs text-slate-600 ml-1">
              <input type="checkbox" checked={apenasVencidos} onChange={e => setApenasVencidos(e.target.checked)} />
              Só vencidos (data já chegou)
            </label>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1">
            <Users2 className="w-3 h-3" /> {totalClientes} cliente{totalClientes !== 1 ? "s" : ""} neste filtro
          </Badge>
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600">
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>
      </div>

      {isLoading && <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />}
      {!isLoading && grupos.length === 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
          <Empty><EmptyHeader><EmptyMedia variant="icon"><Users2 /></EmptyMedia><EmptyTitle>Nenhum cliente nesta situação</EmptyTitle><EmptyDescription>Ajuste os filtros acima para ver outros grupos da jornada.</EmptyDescription></EmptyHeader></Empty>
        </div>
      )}

      <div className="space-y-4">
        {grupos.map(grupo => {
          const isPainelCampanhas = status === "disparado";
          const isVazio = isPainelCampanhas && grupo.numero === null && grupo.clientes.length === 0;
          const expandido = !isPainelCampanhas || !!expandidos[grupo.chave];

          if (isVazio) {
            return (
              <div key={grupo.chave} className="bg-slate-50 rounded-xl border border-dashed border-slate-300 px-4 py-3 flex items-center gap-2">
                <Inbox className="w-4 h-4 text-slate-300" />
                <span className="text-sm font-medium text-slate-400">{estagioLabel[grupo.estagio] ?? grupo.estagio} — nenhuma campanha disparada ainda</span>
              </div>
            );
          }

          return (
          <div key={grupo.chave} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div
              className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 ${isPainelCampanhas ? "cursor-pointer" : ""}`}
              onClick={isPainelCampanhas ? () => setExpandidos(prev => ({ ...prev, [grupo.chave]: !prev[grupo.chave] })) : undefined}
            >
              <div className="flex items-center gap-2 flex-wrap">
                {isPainelCampanhas && (expandido ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />)}
                <Megaphone className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-bold text-slate-700">
                  {grupo.numero ? `Campanha ${grupo.numero}` : "Disparo avulso"} — {estagioLabel[grupo.estagio] ?? grupo.estagio}
                </span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">{grupo.clientes.length} cliente{grupo.clientes.length > 1 ? "s" : ""}</Badge>
                {status === "pendente" && <Badge className="bg-amber-100 text-amber-700 border-amber-300">sugerida — ainda não disparada</Badge>}
                {status === "disparado" && grupo.disparadaEm && (
                  <span className="text-[11px] text-slate-400">disparada em {fmtDateTime(grupo.disparadaEm)}{grupo.disparadoPor ? ` por ${grupo.disparadoPor}` : ""}</span>
                )}
              </div>
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => carregarContatosDoGrupo(grupo)}
                  disabled={carregandoGrupo === grupo.chave}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
                >
                  {carregandoGrupo === grupo.chave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  Carregar contatos
                </button>
                <button
                  onClick={() => exportarCsv(grupo)}
                  disabled={exportandoGrupo === grupo.chave}
                  title="Busca automaticamente o WhatsApp e o nome de quem ainda não tem contato carregado"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
                >
                  {exportandoGrupo === grupo.chave ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  {exportandoGrupo === grupo.chave ? "Buscando contatos..." : "Exportar CSV"}
                </button>
                {status === "pendente" && (
                  <button
                    onClick={() => dispararCampanhaMut.mutate({ estagio: grupo.estagio })}
                    disabled={dispararCampanhaMut.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {dispararCampanhaMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                    Disparar campanha ({grupo.clientes.length})
                  </button>
                )}
              </div>
            </div>

            {expandido && <div className="divide-y divide-slate-100">
              {grupo.clientes.map(c => {
                const info = contatos[c.empresaKey];
                const nomeContato = info && info !== "carregando" ? capitalizarNomeProprio(info.contato) : null;
                const whatsappLink = info && info !== "carregando" ? info.whatsappLink : null;
                return (
                  <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex-1 min-w-[220px]">
                      <p className="text-sm font-bold text-slate-800">{capitalizarNomeProprio(c.empresa)}</p>
                      <p className="text-xs text-slate-500">
                        {info === "carregando" ? "Buscando contato..." : nomeContato ? `Contato: ${nomeContato}` : "Contato ainda não carregado"}
                        {" · "}1ª compra: {fmtDate(c.dataPrimeiraCompra)} ({fmtBrl(Number(c.valorPrimeiraCompra ?? 0))})
                        {" · "}{c.diasUteisDecorridos} dias úteis desde a compra
                      </p>
                      {c.vendedor && <p className="text-[10px] text-slate-400">Vendedor: {c.vendedor}</p>}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <ScriptsRetencaoPopover
                        estagio={c.estagio}
                        label={estagioLabel[c.estagio] ?? c.estagio}
                        nomeCliente={primeiroNomeMensagem(nomeContato ?? c.empresa)}
                        vendedor={c.vendedor ?? undefined}
                        whatsappLink={whatsappLink}
                      >
                        <button className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold hover:bg-emerald-100">
                          <MessageSquareText className="w-3 h-3" /> Scripts
                        </button>
                      </ScriptsRetencaoPopover>
                      {whatsappLink && (
                        <a
                          href={linkWhatsAppComTexto(whatsappLink, `Olá, ${primeiroNomeMensagem(nomeContato ?? c.empresa)}! `)}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2.5 py-1 bg-green-500 text-white rounded-lg text-[11px] font-bold hover:bg-green-600"
                        >
                          <MessageCircle className="w-3 h-3" /> WhatsApp
                        </a>
                      )}
                      {status === "pendente" && (
                        <button
                          onClick={() => marcarDescartadoMut.mutate({ empresaKey: c.empresaKey, estagio: c.estagio })}
                          title="Remover este cliente da campanha (não entra no próximo disparo em massa)"
                          className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-100"
                        >
                          <XCircle className="w-3 h-3" /> Remover
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>}
          </div>
          );
        })}
      </div>
    </div>
  );
}
