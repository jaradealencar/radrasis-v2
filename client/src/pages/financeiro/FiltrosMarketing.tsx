import { Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface MesComDados { mes: number; abrev: string }

export interface FiltrosMarketingState {
  mesFiltro: number | null;
  vendedor: string | null;
  cidade: string | null;
  classificacao: "novo" | "recorrenteAtivo" | "reativado" | null;
}

interface Props {
  state: FiltrosMarketingState;
  onChange: (novo: FiltrosMarketingState) => void;
  mesesComDados: MesComDados[];
  vendedoresDisponiveis: string[];
  cidadesDisponiveis: string[];
  /** Esconde o seletor de classificação (não faz sentido nas abas Aquisição/Reativação, onde já é implícito). */
  ocultarClassificacao?: boolean;
}

/** Filtro de mês em "pills" + vendedor/cidade/classificação — extraído de
 * MarketingFinanceiro.tsx/DetalhamentoMarketing.tsx (que tinham o mesmo bloco
 * de pills de mês duplicado) para reaproveitar entre as abas do painel de
 * Marketing, Clientes e Receita. */
export default function FiltrosMarketing({ state, onChange, mesesComDados, vendedoresDisponiveis, cidadesDisponiveis, ocultarClassificacao }: Props) {
  const algumFiltroAtivo = state.vendedor != null || state.cidade != null || state.classificacao != null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Filter size={13} />
        Filtrar por mês:
      </div>
      <button
        onClick={() => onChange({ ...state, mesFiltro: null })}
        className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
          state.mesFiltro === null
            ? "bg-purple-600 text-white border-purple-600"
            : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
        }`}
      >
        Todos
      </button>
      {mesesComDados.map(d => (
        <button
          key={d.mes}
          onClick={() => onChange({ ...state, mesFiltro: state.mesFiltro === d.mes ? null : d.mes })}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            state.mesFiltro === d.mes
              ? "bg-purple-600 text-white border-purple-600"
              : "bg-white text-slate-600 border-slate-200 hover:border-purple-300"
          }`}
        >
          {d.abrev}
        </button>
      ))}

      <div className="w-px h-5 bg-slate-200 mx-1" />

      <Select value={state.vendedor ?? "__todos"} onValueChange={v => onChange({ ...state, vendedor: v === "__todos" ? null : v })}>
        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Vendedor" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__todos">Todos os vendedores</SelectItem>
          {vendedoresDisponiveis.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={state.cidade ?? "__todas"} onValueChange={v => onChange({ ...state, cidade: v === "__todas" ? null : v })}>
        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Cidade" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__todas">Todas as cidades</SelectItem>
          {cidadesDisponiveis.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>

      {!ocultarClassificacao && (
        <Select value={state.classificacao ?? "__todas"} onValueChange={v => onChange({ ...state, classificacao: v === "__todas" ? null : v as FiltrosMarketingState["classificacao"] })}>
          <SelectTrigger className="h-7 w-44 text-xs"><SelectValue placeholder="Classificação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__todas">Novo + Recorrente + Reativado</SelectItem>
            <SelectItem value="novo">Só clientes novos</SelectItem>
            <SelectItem value="recorrenteAtivo">Só recorrentes ativos</SelectItem>
            <SelectItem value="reativado">Só reativados</SelectItem>
          </SelectContent>
        </Select>
      )}

      {algumFiltroAtivo && (
        <Button
          size="sm" variant="ghost"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => onChange({ ...state, vendedor: null, cidade: null, classificacao: null })}
        >
          <X size={12} /> Limpar filtros
        </Button>
      )}
    </div>
  );
}
