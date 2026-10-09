import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { RefreshCw, ShoppingCart, CheckCircle2, DollarSign, UserPlus, Repeat, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import KpiCard from "@/components/KpiCard";
import { fmtBrl, fmtNum } from "@/lib/format";

// Atualização automática só quando a tela mostra o dia de hoje. A API do MubiSys leva de
// 5 a 20 s por consulta de 1 dia e é instável, então não vale consultar com mais frequência.
const INTERVALO_AUTO_MS = 3 * 60 * 1000;

function hojeBrasiliaStr(): string {
  // Mesma lógica do backend (dataHojeBrasilia em performanceComercial.ts) —
  // usar o horário de Brasília, não o fuso do navegador do usuário.
  const brasilia = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${brasilia.getUTCFullYear()}-${pad(brasilia.getUTCMonth() + 1)}-${pad(brasilia.getUTCDate())}`;
}

function fmtTempoRelativo(ms: number): string {
  const min = Math.floor(ms / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  return `há ${Math.floor(min / 60)}h`;
}

type Grupo = { cotacoes: number; valorOrcado: number; vendas: number; faturamento: number };

function LinhaGrupo({ titulo, descricao, icon: Icon, cor, g, loading }: {
  titulo: string;
  descricao: string;
  icon: React.ElementType;
  cor: string;
  g: Grupo | undefined;
  loading: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="p-1.5 rounded-lg" style={{ background: `${cor}15` }}>
          <Icon className="w-4 h-4" style={{ color: cor }} />
        </span>
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">{titulo}</h2>
        <span className="text-xs text-slate-400 hidden sm:inline">{descricao}</span>
      </div>
      {loading || !g ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <div key={i} className="bg-white rounded-xl border border-slate-200 h-28 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard
            label="Cotações"
            value={fmtNum(g.cotacoes)}
            sub={`${fmtBrl(g.valorOrcado)} orçados`}
            icon={ShoppingCart}
            color="#3b82f6"
          />
          <KpiCard
            label="Vendas"
            value={fmtNum(g.vendas)}
            sub="OS aprovadas no dia"
            icon={CheckCircle2}
            color="#8b5cf6"
          />
          <KpiCard
            label="Faturamento"
            value={fmtBrl(g.faturamento)}
            sub="Valor das OS, já com desconto"
            icon={DollarSign}
            color="#16a34a"
          />
        </div>
      )}
    </section>
  );
}

export default function DesempenhoDiario() {
  const [data, setData] = useState(hojeBrasiliaStr());
  const [, forceTick] = useState(0);
  const isHoje = data === hojeBrasiliaStr();

  const { data: d, isLoading, isError, isFetching, refetch, dataUpdatedAt } = trpc.performanceComercial.getDesempenhoDiario.useQuery(
    { data },
    // retry: 1 — se a API já demorou até o timeout, repetir só multiplica a espera.
    { refetchOnWindowFocus: false, retry: 1, refetchInterval: isHoje ? INTERVALO_AUTO_MS : false },
  );

  // Reforça o "atualizado há X" a cada minuto, sem precisar de nova busca.
  useEffect(() => {
    const id = setInterval(() => forceTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const [ano, mes, dia] = data.split("-");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
            {isHoje ? "Hoje" : "Dia"} · {dia}/{mes}/{ano}
          </h2>
          <input
            type="date"
            value={data}
            max={hojeBrasiliaStr()}
            onChange={e => e.target.value && setData(e.target.value)}
            className="h-8 px-2 text-xs border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {isHoje && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-200">
              ⚡ AO VIVO
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-slate-400">atualizado {fmtTempoRelativo(Date.now() - dataUpdatedAt)}</span>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 gap-1.5 text-xs px-2">
            <RefreshCw className={`w-3 h-3 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {isError && (
        <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>Não foi possível carregar o desempenho do dia. A API do MubiSys pode estar instável — tente atualizar.</span>
        </div>
      )}
      {d && !d.completo && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>A API do MubiSys devolveu só parte dos registros deste dia — os números podem estar abaixo do real. Clique em Atualizar.</span>
        </div>
      )}

      {!isError && (
        <>
          <LinhaGrupo
            titulo="Clientes novos"
            descricao="nunca compraram antes"
            icon={UserPlus}
            cor="#0d9488"
            g={d?.novos}
            loading={isLoading}
          />
          <LinhaGrupo
            titulo="Clientes reativados"
            descricao="já compraram, mas estavam 6+ meses sem pedir"
            icon={Repeat}
            cor="#f97316"
            g={d?.reativados}
            loading={isLoading}
          />
          <LinhaGrupo
            titulo="Geral"
            descricao="todos os clientes do dia"
            icon={Users}
            cor="#3b82f6"
            g={d?.geral}
            loading={isLoading}
          />
          {d && (
            <p className="text-xs text-slate-400">
              O Geral inclui também os clientes recorrentes (compraram nos últimos 6 meses): {fmtNum(d.recorrentes.cotacoes)} cotações,{" "}
              {fmtNum(d.recorrentes.vendas)} vendas e {fmtBrl(d.recorrentes.faturamento)} de faturamento.
              Cada cliente é classificado como no card mensal: quem comprou no começo do mês continua novo até o fim dele.
            </p>
          )}
        </>
      )}
    </div>
  );
}
