import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw, ShoppingCart, CheckCircle2, MessageCircle, Sunrise, Sunset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fmtBrl } from "@/lib/format";

function fmtTempoRelativo(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  return `há ${h}h`;
}

function hojeBrasiliaStr(): string {
  // Mesma lógica do backend (dataHojeBrasilia em performanceComercial.ts) —
  // usar o horário de Brasília, não o fuso do navegador do usuário.
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${brasilia.getUTCFullYear()}-${pad(brasilia.getUTCMonth() + 1)}-${pad(brasilia.getUTCDate())}`;
}

type Turno = { propostas: number; valorPropostas: number; vendas: number; valorVendas: number; interacoes: number; primeiraAcao: string | null; ultimaAcao: string | null };

function TurnoCol({ label, icon: Icon, t }: { label: string; icon: React.ElementType; t: Turno }) {
  const semAtividade = t.propostas === 0 && t.vendas === 0 && t.interacoes === 0;
  return (
    <div className="flex-1 min-w-[140px] bg-slate-50 rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-2">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      {semAtividade ? (
        <p className="text-xs text-slate-400">Sem atividade</p>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500"><ShoppingCart className="w-3 h-3" /> Propostas</span>
            <span className="font-mono font-semibold text-blue-700">{t.propostas} <span className="text-slate-400 font-normal">({fmtBrl(t.valorPropostas)})</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500"><CheckCircle2 className="w-3 h-3" /> Vendas</span>
            <span className="font-mono font-semibold text-purple-700">{t.vendas} <span className="text-slate-400 font-normal">({fmtBrl(t.valorVendas)})</span></span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-500"><MessageCircle className="w-3 h-3" /> CRM</span>
            <span className="font-mono font-semibold text-emerald-700">{t.interacoes}</span>
          </div>
          {t.primeiraAcao && (
            <p className="text-[10px] text-slate-400 pt-1 border-t border-slate-200">
              {t.primeiraAcao} → {t.ultimaAcao}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function ResumoDiarioVendedores() {
  const [data, setData] = useState(hojeBrasiliaStr());
  const [, forceTick] = useState(0);

  const { data: resumo, isLoading, isError, refetch, isFetching, dataUpdatedAt } = trpc.performanceComercial.getResumoDiario.useQuery(
    { data },
    { refetchOnWindowFocus: false, retry: 1 }
  );

  // Reforça o "atualizado há X" a cada minuto, sem precisar de nova busca.
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const isHoje = data === hojeBrasiliaStr();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            {isHoje ? "Hoje" : "Resumo do dia"}
          </h2>
          <input
            type="date"
            value={data}
            max={hojeBrasiliaStr()}
            onChange={e => setData(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-slate-400">
              atualizado {fmtTempoRelativo(Date.now() - dataUpdatedAt)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="h-7 gap-1.5 text-xs px-2">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-slate-400">Carregando…</p>
      ) : isError ? (
        <p className="text-xs text-red-500">Não foi possível carregar o resumo do dia. A API do MubiSys pode estar instável — tente atualizar.</p>
      ) : !resumo || resumo.vendedores.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhuma atividade registrada neste dia.</p>
      ) : (
        <div className="space-y-3">
          {resumo.vendedores.map(v => (
            <div key={v.vendedor} className="flex flex-col sm:flex-row sm:items-stretch gap-2">
              <div className="sm:w-36 flex-shrink-0 flex items-center font-semibold text-sm text-slate-700">
                {v.vendedor}
              </div>
              <div className="flex-1 flex flex-col sm:flex-row gap-2">
                <TurnoCol label="Manhã" icon={Sunrise} t={v.manha} />
                <TurnoCol label="Tarde" icon={Sunset} t={v.tarde} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
