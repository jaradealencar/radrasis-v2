import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Filter, MessageCircle, CheckCircle2, XCircle, Download, Loader2,
  Users2, Target, RefreshCw, MessageSquareText,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { fmtBrl, fmtDate, fmtPct } from "@/lib/format";
import { ScriptsRetencaoPopover } from "@/components/ScriptsRetencaoPopover";
import { linkWhatsAppComTexto } from "@/lib/faixasCrm";
import { primeiroNome as primeiroNomeMensagem } from "@/lib/mensagensCrm";
import { capitalizarNomeProprio } from "@shared/capitalizar-nome";

/**
 * Retenção de Clientes Novos — jornada de 1 ano (sub-aba de Inteligência de
 * Clientes). 70% dos clientes que fazem a 1ª compra não voltam a comprar;
 * meta: 50%. Ver server/services/retencaoClientesNovos.ts para as regras.
 */

type EstagioJornada = "d16u" | "d30" | "d60" | "d90" | "d180" | "d270" | "d365";

interface ContatoInfo { contato: string; telefone: string; whatsappLink: string }

type LinhaGrupo = {
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

  const utils = trpc.useUtils();
  const { data: resumo } = trpc.retencaoClientesNovos.getResumoConversao.useQuery();
  const { data: estagios } = trpc.retencaoClientesNovos.getEstagios.useQuery();
  const { data: grupos, isLoading, refetch } = trpc.retencaoClientesNovos.getGrupos.useQuery({
    status, estagio: estagio || undefined, apenasVencidos,
  });

  const marcarDisparadoMut = trpc.retencaoClientesNovos.marcarDisparado.useMutation({ onSuccess: () => refetch() });
  const marcarDescartadoMut = trpc.retencaoClientesNovos.marcarDescartado.useMutation({ onSuccess: () => refetch() });

  const estagioLabel: Record<string, string> = Object.fromEntries((estagios ?? []).map(e => [e.id, e.label]));

  async function carregarContatosDoGrupo(clientes: LinhaGrupo[]) {
    const chave = clientes[0]?.dataAgendada ?? "";
    setCarregandoGrupo(chave);
    setContatos(prev => {
      const novo = { ...prev };
      for (const c of clientes) novo[c.empresaKey] = "carregando";
      return novo;
    });
    await Promise.all(clientes.map(async (c) => {
      if (!c.osNumero) return;
      try {
        const info = await utils.retencaoClientesNovos.getContatoCliente.fetch({ empresaKey: c.empresaKey, osNumero: c.osNumero });
        setContatos(prev => ({ ...prev, [c.empresaKey]: info }));
      } catch {
        setContatos(prev => ({ ...prev, [c.empresaKey]: { contato: "", telefone: "", whatsappLink: "" } }));
      }
    }));
    setCarregandoGrupo(null);
  }

  function exportarCsv(clientes: LinhaGrupo[]) {
    const header = [
      "primeiro_nome", "nome_completo", "whatsapp", "empresa", "data_primeira_compra",
      "data_disparo_agendado", "dias_uteis_decorridos", "estagio_jornada",
      "caracteristicas_cliente", "valor_primeira_compra",
    ];
    const linhas = clientes.map(c => {
      const info = contatos[c.empresaKey];
      const nomeContato = (info && info !== "carregando") ? capitalizarNomeProprio(info.contato) : "";
      return [
        primeiroNomeMensagem(nomeContato) || capitalizarNomeProprio(c.empresa),
        nomeContato || capitalizarNomeProprio(c.empresa),
        (info && info !== "carregando") ? info.whatsappLink.replace("https://wa.me/", "") : "",
        c.empresa,
        c.dataPrimeiraCompra,
        c.dataAgendada,
        String(c.diasUteisDecorridos),
        estagioLabel[c.estagio] ?? c.estagio,
        `Ticket 1ª compra: ${fmtBrl(Number(c.valorPrimeiraCompra ?? 0))}`,
        c.valorPrimeiraCompra ?? "0",
      ];
    });
    baixarCsv(`retencao-clientes-novos-${clientes[0]?.dataAgendada ?? "grupo"}.csv`, [header, ...linhas]);
  }

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
            cada cliente novo por 1 ano, em 7 marcos, para reduzir essa taxa de compra única.
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
              {s === "pendente" ? "Pendentes" : s === "disparado" ? "Disparados" : "Descartados"}
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
        <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </button>
      </div>

      {isLoading && <div className="bg-white rounded-xl border border-slate-200 h-40 animate-pulse" />}
      {!isLoading && (!grupos || grupos.length === 0) && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10">
          <Empty><EmptyHeader><EmptyMedia variant="icon"><Users2 /></EmptyMedia><EmptyTitle>Nenhum cliente nesta situação</EmptyTitle><EmptyDescription>Ajuste os filtros acima para ver outros grupos da jornada.</EmptyDescription></EmptyHeader></Empty>
        </div>
      )}

      <div className="space-y-4">
        {(grupos ?? []).map(grupo => (
          <div key={grupo.dataAgendada} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-700">{fmtDate(grupo.dataAgendada)}</span>
                <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300">{grupo.clientes.length} cliente{grupo.clientes.length > 1 ? "s" : ""}</Badge>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => carregarContatosDoGrupo(grupo.clientes as LinhaGrupo[])}
                  disabled={carregandoGrupo === grupo.dataAgendada}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600 disabled:opacity-50"
                >
                  {carregandoGrupo === grupo.dataAgendada ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                  Carregar contatos
                </button>
                <button
                  onClick={() => exportarCsv(grupo.clientes as LinhaGrupo[])}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[11px] font-bold text-slate-600 hover:border-emerald-400 hover:text-emerald-600"
                >
                  <Download className="w-3.5 h-3.5" /> Exportar CSV
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {(grupo.clientes as LinhaGrupo[]).map(c => {
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
                        <>
                          <button
                            onClick={() => marcarDisparadoMut.mutate({ empresaKey: c.empresaKey, estagio: c.estagio })}
                            className="flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold hover:bg-blue-100"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Disparado
                          </button>
                          <button
                            onClick={() => marcarDescartadoMut.mutate({ empresaKey: c.empresaKey, estagio: c.estagio })}
                            className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-[11px] font-bold hover:bg-slate-100"
                          >
                            <XCircle className="w-3 h-3" /> Descartar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
