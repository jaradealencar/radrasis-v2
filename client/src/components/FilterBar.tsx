import { trpc } from "@/lib/trpc";
import { Filter, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export interface FilterState {
  mes?: string;
  setor?: string;
  tipo?: string;
  responsavel?: string;
  classe?: string;
  search?: string;
}

interface FilterBarProps {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (v: string) => void;
}

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

const triggerStyle = { background: "#ffffff", borderColor: "#c7d9f8", color: "#1a2340" };
const contentStyle = { background: "#ffffff", borderColor: "#c7d9f8" };

export default function FilterBar({ filter, onChange, showSearch, searchValue, onSearchChange }: FilterBarProps) {
  const { data: distinct } = trpc.dashboard.distinctValues.useQuery();

  const hasFilters = Object.values(filter).some(v => v && v !== "all");

  const clearFilters = () => onChange({});

  const set = (key: keyof FilterState, value: string) => {
    onChange({ ...filter, [key]: value === "all" ? undefined : value });
  };

  return (
    <div className="p-3 rounded-md mb-4"
      style={{ background: "#f0f4ff", border: "1px solid #c7d9f8" }}>
      {/* Cabeçalho dos filtros */}
      <div className="flex items-center gap-1.5 mb-2">
        <Filter className="w-3.5 h-3.5" style={{ color: "#1e6fd9" }} />
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1e6fd9" }}>Filtros</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs gap-1 ml-auto"
            style={{ color: "#1e6fd9" }}>
            <X className="w-3 h-3" />
            Limpar
          </Button>
        )}
      </div>

      {/* Grid de selects — 2 colunas no mobile, 3 no sm, todos em linha no md+ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap gap-2">
        <Select value={filter.mes ?? "all"} onValueChange={v => set("mes", v)}>
          <SelectTrigger className="h-8 text-xs w-full md:w-36" style={triggerStyle}>
            <SelectValue placeholder="Mês" />
          </SelectTrigger>
          <SelectContent style={contentStyle}>
            <SelectItem value="all">Todos os meses</SelectItem>
            {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filter.setor ?? "all"} onValueChange={v => set("setor", v)}>
          <SelectTrigger className="h-8 text-xs w-full md:w-36" style={triggerStyle}>
            <SelectValue placeholder="Setor" />
          </SelectTrigger>
          <SelectContent style={contentStyle}>
            <SelectItem value="all">Todos os setores</SelectItem>
            {distinct?.setores?.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={filter.tipo ?? "all"} onValueChange={v => set("tipo", v)}>
          <SelectTrigger className="h-8 text-xs w-full md:w-32" style={triggerStyle}>
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent style={contentStyle}>
            <SelectItem value="all">Interno/Externo</SelectItem>
            <SelectItem value="INTERNO">Interno</SelectItem>
            <SelectItem value="EXTERNO">Externo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.classe ?? "all"} onValueChange={v => set("classe", v)}>
          <SelectTrigger className="h-8 text-xs w-full md:w-36" style={triggerStyle}>
            <SelectValue placeholder="Classe" />
          </SelectTrigger>
          <SelectContent style={contentStyle}>
            <SelectItem value="all">Evitável/Inevitável</SelectItem>
            <SelectItem value="EVITÁVEL">Evitável</SelectItem>
            <SelectItem value="INEVITÁVEL">Inevitável</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filter.responsavel ?? "all"} onValueChange={v => set("responsavel", v)}>
          <SelectTrigger className="h-8 text-xs w-full md:w-36" style={triggerStyle}>
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent style={contentStyle}>
            <SelectItem value="all">Todos</SelectItem>
            {distinct?.responsaveis?.map(r => r && <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>

        {showSearch && onSearchChange && (
          <input
            type="text"
            placeholder="Buscar OS, descrição..."
            value={searchValue ?? ""}
            onChange={e => onSearchChange(e.target.value)}
            className="h-8 px-3 text-xs rounded-md w-full md:w-48 col-span-2 sm:col-span-1"
            style={{ background: "#ffffff", border: "1px solid #c7d9f8", color: "#1a2340" }}
          />
        )}
      </div>
    </div>
  );
}
