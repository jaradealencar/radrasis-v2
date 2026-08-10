import { trpc } from "@/lib/trpc";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import UserSelect from "./UserSelect";

const MESES = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];

export interface FormData {
  titulo: string;
  osRetrabalhada: string;
  osOriginal: string;
  data: string;
  setor: string;
  tipo: "INTERNO" | "EXTERNO";
  custo: string;
  frete: string;
  horasImpacto: string;
  codigoErro: string;
  responsavel: string;
  tipoResponsavel: "operador" | "gestor";
  descricao: string;
  classe: "EVITÁVEL" | "INEVITÁVEL";
  mes: string;
  tipoRegistro: "retrabalho" | "cnq";
}

const emptyForm: FormData = {
  titulo: "",
  osRetrabalhada: "", osOriginal: "", data: new Date().toISOString().split("T")[0],
  setor: "", tipo: "INTERNO", custo: "0", frete: "0", horasImpacto: "", codigoErro: "",
  responsavel: "", tipoResponsavel: "operador", descricao: "", classe: "EVITÁVEL", mes: MESES[new Date().getMonth()],
  tipoRegistro: "retrabalho",
};

interface Props {
  initial?: Partial<FormData>;
  onSubmit: (data: FormData) => void;
  loading?: boolean;
  submitLabel?: string;
}

export default function RetrabalhForm({ initial, onSubmit, loading, submitLabel = "Salvar" }: Props) {
  const [form, setForm] = useState<FormData>({ ...emptyForm, ...initial });
  const { data: errorLib } = trpc.errorLibrary.list.useQuery();
  
  // Extrair setores únicos da biblioteca de erros (usando o campo 'category')
  const setores = Array.from(new Set((errorLib ?? []).map(e => e.category).filter(Boolean))).sort();
  
  const { data: selectedError } = trpc.errorLibrary.byCode.useQuery(
    { code: form.codigoErro },
    { enabled: !!form.codigoErro }
  );

  useEffect(() => {
    if (initial) setForm(f => ({ ...f, ...initial }));
  }, []);

  const set = (key: keyof FormData, value: string) => setForm(f => ({ ...f, [key]: value }));

  const total = (parseFloat(form.custo || "0") + parseFloat(form.frete || "0")).toFixed(2);

  const grouped = errorLib?.reduce((acc, e) => {
    if (!acc[e.category]) acc[e.category] = [];
    acc[e.category].push(e);
    return acc;
  }, {} as Record<string, typeof errorLib>) ?? {};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.responsavel) {
      alert("Responsável é obrigatório. Se não há funcionário direto, atribua a um Gestor.");
      return;
    }
    onSubmit(form);
  };

  const inputCls = "w-full px-3 py-2 text-sm rounded-md";
  const inputStyle = { background: "#ffffff", border: "1px solid #e2e8f0", color: "#1e293b" };
  const labelCls = "block text-xs font-semibold uppercase tracking-widest mb-1.5";
  const labelStyle = { color: "#475569" };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Classificação: Retrabalho ou CNQ */}
      <div>
        <label className={labelCls} style={labelStyle}>Classificação *</label>
        <div className="flex gap-2 mt-1">
          {(["retrabalho", "cnq"] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set("tipoRegistro", t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
                form.tipoRegistro === t
                  ? t === "cnq"
                    ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                    : "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {t === "retrabalho" ? "Retrabalho (Falha de Execução)" : "CNQ (Falha de Processo)"}
            </button>
          ))}
        </div>
      </div>

      {/* Título */}
      <div>
        <label className={labelCls} style={labelStyle}>Título do {form.tipoRegistro === "cnq" ? "CNQ" : "Retrabalho"}</label>
        <input
          className={inputCls}
          style={inputStyle}
          value={form.titulo}
          onChange={e => set("titulo", e.target.value)}
          placeholder="Ex: Erro na quantidade de catalisador"
        />
      </div>

      {/* OS Fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls} style={labelStyle}>OS Retrabalhada *</label>
          <input required className={inputCls} style={inputStyle} value={form.osRetrabalhada}
            onChange={e => set("osRetrabalhada", e.target.value)} placeholder="Ex: 5679" />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>OS Original *</label>
          <input required className={inputCls} style={inputStyle} value={form.osOriginal}
            onChange={e => set("osOriginal", e.target.value)} placeholder="Ex: 5472" />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Data *</label>
          <input required type="date" className={inputCls} style={inputStyle} value={form.data}
            onChange={e => set("data", e.target.value)} />
        </div>
      </div>

      {/* Setor, Tipo, Mês */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className={labelCls} style={labelStyle}>Setor *</label>
          <Select value={form.setor} onValueChange={v => set("setor", v)}>
            <SelectTrigger className="h-9 text-sm" style={{ ...inputStyle }}>
              <SelectValue placeholder="Selecionar setor" />
            </SelectTrigger>
            <SelectContent>
              {setores.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Tipo *</label>
          <Select value={form.tipo} onValueChange={v => set("tipo", v as "INTERNO" | "EXTERNO")}>
            <SelectTrigger className="h-9 text-sm" style={{ ...inputStyle }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="INTERNO">Interno</SelectItem>
              <SelectItem value="EXTERNO">Externo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Mês</label>
          <Select value={form.mes} onValueChange={v => set("mes", v)}>
            <SelectTrigger className="h-9 text-sm" style={{ ...inputStyle }}>
              <SelectValue placeholder="Mês" />
            </SelectTrigger>
            <SelectContent>
              {MESES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Código de Erro */}
      <div>
        <label className={labelCls} style={labelStyle}>Código de Erro</label>
        <Select value={form.codigoErro || "none"} onValueChange={v => set("codigoErro", v === "none" ? "" : v)}>
          <SelectTrigger className="h-9 text-sm" style={{ ...inputStyle }}>
            <SelectValue placeholder="Selecionar código de erro" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            <SelectItem value="none">— Sem código —</SelectItem>
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-2 py-1 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--bp-cyan)" }}>{cat}</div>
                {items.map(e => (
                  <SelectItem key={e.code} value={e.code}>
                    <span className="font-mono text-xs mr-2" style={{ color: "var(--bp-cyan)" }}>{e.code}</span>
                    <span className="text-xs">{e.description.substring(0, 45)}{e.description.length > 45 ? "..." : ""}</span>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>

        {/* Auto-linked solution */}
        {selectedError && (
          <div className="mt-2 p-3 rounded-md" style={{ background: "rgba(0,212,255,0.07)", border: "1px solid rgba(0,212,255,0.2)" }}>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "var(--bp-cyan)" }} />
              <div>
                <p className="text-xs font-semibold mb-0.5" style={{ color: "var(--bp-cyan)" }}>Solução Vinculada — {selectedError.code}</p>
                <p className="text-xs" style={{ color: "var(--bp-text-dim)" }}>{selectedError.description}</p>
                <p className="text-xs mt-1 font-medium" style={{ color: "#00e676" }}>✓ {selectedError.correction}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custos */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className={labelCls} style={labelStyle}>Custo (R$)</label>
          <input type="number" step="0.01" min="0" className={inputCls} style={inputStyle}
            value={form.custo} onChange={e => set("custo", e.target.value)} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Frete (R$)</label>
          <input type="number" step="0.01" min="0" className={inputCls} style={inputStyle}
            value={form.frete} onChange={e => set("frete", e.target.value)} />
        </div>
        <div>
          <label className={labelCls} style={labelStyle} title="Horas que o retrabalho impactou na produção">Horas de Impacto</label>
          <input type="number" step="0.25" min="0" className={inputCls} style={inputStyle}
            value={form.horasImpacto} onChange={e => set("horasImpacto", e.target.value)}
            placeholder="Ex: 2.5" />
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Total Calculado</label>
          <div className="px-3 py-2 rounded-md text-sm font-mono font-bold"
            style={{ background: "rgba(255,152,0,0.1)", border: "1px solid rgba(255,152,0,0.3)", color: "#ff9800" }}>
            R$ {total}
          </div>
        </div>
      </div>

      {/* Responsável e Classe */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={labelCls} style={labelStyle}>Responsável *</label>
          <UserSelect
            value={form.responsavel}
            onChange={name => set("responsavel", name)}
            placeholder="— Selecione um responsável —"
            style={form.responsavel ? inputStyle : { ...inputStyle, border: "1px solid #f87171" }}
          />
          {!form.responsavel && (
            <p className="text-xs mt-1" style={{ color: "#f87171" }}>Obrigatório. Atribua a um Gestor se não houver funcionário direto.</p>
          )}
          {/* Tipo de Responsável */}
          <div className="flex gap-2 mt-2">
            {(["operador", "gestor"] as const).map(t => (
              <button key={t} type="button" onClick={() => set("tipoResponsavel", t)}
                className="flex-1 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all"
                style={form.tipoResponsavel === t ? {
                  background: t === "gestor" ? "rgba(99,102,241,0.2)" : "rgba(16,185,129,0.2)",
                  border: `2px solid ${t === "gestor" ? "#6366f1" : "#10b981"}`,
                  color: t === "gestor" ? "#818cf8" : "#34d399"
                } : { background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }}>
                {t === "operador" ? "🔧 Operador" : "🌟 Gestor"}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls} style={labelStyle}>Classe *</label>
          <div className="flex gap-3 mt-1">
            {(["EVITÁVEL", "INEVITÁVEL"] as const).map(c => (
              <button key={c} type="button" onClick={() => set("classe", c)}
                className="flex-1 py-2 rounded-md text-xs font-bold uppercase tracking-wider transition-all"
                style={form.classe === c ? (c === "EVITÁVEL" ? {
                  background: "rgba(255,68,68,0.2)", border: "2px solid #ff4444", color: "#ff6b6b"
                } : {
                  background: "rgba(255,152,0,0.2)", border: "2px solid #ff9800", color: "#ffb74d"
                }) : {
                  background: "rgba(30,111,217,0.1)", border: "1px solid rgba(30,111,217,0.2)", color: "var(--bp-text-dim)"
                }}>
                {c === "EVITÁVEL" ? <AlertCircle className="w-3.5 h-3.5 inline mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />}
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Descrição */}
      <div>
        <label className={labelCls} style={labelStyle}>Descrição do Ocorrido</label>
        <textarea rows={3} className={`${inputCls} resize-none`} style={inputStyle}
          value={form.descricao} onChange={e => set("descricao", e.target.value)}
          placeholder="Descreva o que ocorreu, materiais envolvidos, impacto..." />
      </div>

      <Button type="submit" disabled={loading || !form.osRetrabalhada || !form.setor || !form.responsavel} className="w-full h-10 font-semibold"
        style={{ background: "var(--bp-blue)", color: "white" }}>
        {loading ? "Salvando..." : submitLabel}
      </Button>
    </form>
  );
}
