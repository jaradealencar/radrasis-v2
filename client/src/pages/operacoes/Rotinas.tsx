import { trpc } from "@/lib/trpc";
import {
  AlertCircle, Bell, CalendarCheck, CalendarDays, CheckCircle2, ChevronLeft,
  ChevronRight, Clock, Edit2, Plus, Save, Trash2, X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import DashboardLayout from "../../components/DashboardLayout";
import RichTextEditor from "../../components/RichTextEditor";
import UserSelect from "../../components/UserSelect";

const FREQUENCIES: { value: string; label: string; cor: string; dias: number | null }[] = [
  { value: "diaria",     label: "Diária",     cor: "#ef4444", dias: 1  },
  { value: "semanal",    label: "Semanal",    cor: "#f97316", dias: 7  },
  { value: "quinzenal",  label: "Quinzenal",  cor: "#eab308", dias: 15 },
  { value: "mensal",     label: "Mensal",     cor: "#3b82f6", dias: 30 },
  { value: "esporadico", label: "Esporádico", cor: "#8b5cf6", dias: null },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pendente:  { bg: "bg-yellow-50",  text: "text-yellow-700", label: "Pendente" },
  em_dia:    { bg: "bg-green-50",   text: "text-green-700",  label: "Em Dia"   },
  atrasada:  { bg: "bg-red-50",     text: "text-red-600",    label: "Atrasada" },
};

const MESES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

const EMPTY_FORM = {
  title: "", description: "", frequency: "mensal" as string,
  assignedTo: "", startDate: "", calendarDates: [] as string[],
};

function calcDatesInMonth(
  frequency: string,
  startDate: Date | null,
  calendarDates: string[],
  year: number,
  month: number
): Set<number> {
  const result = new Set<number>();
  if (frequency === "esporadico") {
    for (const d of calendarDates) {
      const dt = new Date(d + "T12:00:00");
      if (dt.getFullYear() === year && dt.getMonth() === month) result.add(dt.getDate());
    }
    return result;
  }
  const freqInfo = FREQUENCIES.find(f => f.value === frequency);
  const dias = freqInfo?.dias ?? null;
  if (!dias) return result;
  const base = startDate ?? new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  let cur = new Date(base);
  while (cur > firstDay) cur = new Date(cur.getTime() - dias * 86400000);
  while (cur <= lastDay) {
    if (cur >= firstDay) result.add(cur.getDate());
    cur = new Date(cur.getTime() + dias * 86400000);
  }
  return result;
}

function MiniCalendar({ routine }: {
  routine: { frequency: string; startDate: Date | null; calendarDates: string | null; };
}) {
  const today = new Date();
  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const calDates: string[] = useMemo(() => {
    try { return routine.calendarDates ? JSON.parse(routine.calendarDates) : []; }
    catch { return []; }
  }, [routine.calendarDates]);

  const execDays = useMemo(
    () => calcDatesInMonth(routine.frequency, routine.startDate, calDates, viewYear, viewMonth),
    [routine.frequency, routine.startDate, calDates, viewYear, viewMonth]
  );

  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isToday = (d: number) =>
    d === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3 mt-2 select-none max-w-xs">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); }}
          className="p-1 rounded hover:bg-gray-100"
        ><ChevronLeft size={13} /></button>
        <span className="text-xs font-semibold text-gray-700">{MESES_ABREV[viewMonth]} {viewYear}</span>
        <button
          onClick={() => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); }}
          className="p-1 rounded hover:bg-gray-100"
        ><ChevronRight size={13} /></button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {DIAS_SEMANA.map(d => (
          <div key={d} className="text-center text-[9px] font-bold text-gray-400">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isExec = execDays.has(day);
          const isTd   = isToday(day);
          return (
            <div key={i} className={`flex items-center justify-center rounded text-[10px] h-5 w-full font-medium ${isTd ? "ring-1 ring-blue-400" : ""} ${isExec ? "bg-blue-500 text-white" : "text-gray-500"}`}>
              {day}
            </div>
          );
        })}
      </div>
      {execDays.size === 0 && (
        <p className="text-[10px] text-gray-400 text-center mt-1">
          {routine.frequency === "esporadico" ? "Nenhuma data neste mês" : "Sem execuções neste mês"}
        </p>
      )}
    </div>
  );
}

export default function Rotinas() {
  const [showForm, setShowForm]               = useState(false);
  const [form, setForm]                       = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId]             = useState<number | null>(null);
  const [editData, setEditData]               = useState({
    title: "", description: "", assignedTo: "",
    frequency: "mensal", startDate: "", calendarDates: [] as string[],
  });
  const [expandedId, setExpandedId]           = useState<number | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const { data, isLoading, refetch } = trpc.routines.list.useQuery();
  const { data: pendingData }        = trpc.routines.pending.useQuery();

  const createMut   = trpc.routines.create.useMutation({ onSuccess: () => { refetch(); setShowForm(false); setForm({ ...EMPTY_FORM }); toast.success("Rotina criada!"); } });
  const updateMut   = trpc.routines.update.useMutation({ onSuccess: () => { refetch(); setEditingId(null); toast.success("Rotina atualizada!"); } });
  const deleteMut   = trpc.routines.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Rotina removida."); } });
  const markDoneMut = trpc.routines.markDone.useMutation({ onSuccess: () => { refetch(); toast.success("Rotina concluída!"); } });

  const items   = data ?? [];
  const pending = pendingData ?? [];

  const byFreq = FREQUENCIES.map(f => ({ ...f, items: items.filter(i => i.frequency === f.value) })).filter(g => g.items.length > 0);

  function startEdit(item: typeof items[0]) {
    let calDates: string[] = [];
    try { calDates = item.calendarDates ? JSON.parse(item.calendarDates) : []; } catch {}
    setEditingId(item.id);
    setEditData({
      title: item.title, description: item.description ?? "", assignedTo: item.assignedTo ?? "",
      frequency: item.frequency,
      startDate: item.startDate ? new Date(item.startDate).toISOString().split("T")[0] : "",
      calendarDates: calDates,
    });
  }

  function toggleDate(dateStr: string, arr: string[], setArr: (v: string[]) => void) {
    if (arr.includes(dateStr)) setArr(arr.filter(d => d !== dateStr));
    else setArr([...arr, dateStr].sort());
  }

  const fi = (freq: string) => FREQUENCIES.find(f => f.value === freq)!;

  return (
    <DashboardLayout>
      {/* Banner de pendências */}
      {!bannerDismissed && pending.length > 0 && (
        <div className="mb-4 flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <Bell size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-800">
              {pending.length} rotina{pending.length > 1 ? "s" : ""} pendente{pending.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              {pending.slice(0, 3).map(r => r.title).join(", ")}
              {pending.length > 3 ? ` e mais ${pending.length - 3}...` : ""}
            </p>
          </div>
          <button onClick={() => setBannerDismissed(true)} className="text-amber-400 hover:text-amber-600"><X size={14} /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "oklch(0.52 0.18 240 / 0.1)" }}>
            <CalendarCheck size={18} style={{ color: "oklch(0.52 0.18 240)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "#0f172a" }}>Rotinas</h1>
            <p className="text-sm text-gray-500">Tarefas periódicas e checklist operacional</p>
          </div>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "oklch(0.52 0.18 240)" }}>
          <Plus size={15} /> Nova Rotina
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        {[
          { label: "Total",               value: items.length,                                    color: "oklch(0.52 0.18 240)" },
          { label: "Em Dia",              value: items.filter(i => i.status === "em_dia").length,  color: "#16a34a" },
          { label: "Pendentes/Atrasadas", value: pending.length, color: pending.length > 0 ? "#dc2626" : "#6b7280" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">Nova Rotina</h3>
            <button onClick={() => setShowForm(false)}><X size={16} className="text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Título *</label>
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Frequência</label>
              <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none" value={form.frequency} onChange={e => setForm(p => ({ ...p, frequency: e.target.value, calendarDates: [] }))}>
                {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Responsável</label>
              <UserSelect value={form.assignedTo} onChange={name => setForm(p => ({ ...p, assignedTo: name }))} placeholder="— Sem responsável —" />
            </div>
            {form.frequency !== "esporadico" && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Data de Início <span className="text-gray-400 font-normal">(para o calendário)</span></label>
                <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
            )}
          </div>
          {form.frequency === "esporadico" && (
            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Datas Específicas</label>
              <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
                onChange={e => { if (e.target.value) { toggleDate(e.target.value, form.calendarDates, v => setForm(p => ({ ...p, calendarDates: v }))); e.target.value = ""; } }} />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {form.calendarDates.map(d => (
                  <span key={d} className="flex items-center gap-1 bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                    {new Date(d + "T12:00:00").toLocaleDateString("pt-BR")}
                    <button onClick={() => setForm(p => ({ ...p, calendarDates: p.calendarDates.filter(x => x !== d) }))}><X size={10} /></button>
                  </span>
                ))}
                {form.calendarDates.length === 0 && <span className="text-xs text-gray-400">Nenhuma data adicionada</span>}
              </div>
            </div>
          )}
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-500 mb-1">Descrição / Instruções</label>
            <RichTextEditor value={form.description} onChange={html => setForm(p => ({ ...p, description: html }))} placeholder="Descreva os passos..." minHeight="120px" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button
              onClick={() => createMut.mutate({ title: form.title, description: form.description || null, frequency: form.frequency as any, assignedTo: form.assignedTo || null, startDate: form.startDate || null, calendarDates: form.calendarDates.length > 0 ? JSON.stringify(form.calendarDates) : null })}
              disabled={!form.title.trim() || createMut.isPending}
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: "oklch(0.52 0.18 240)" }}
            >
              {createMut.isPending ? "Salvando..." : "Criar Rotina"}
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Carregando...</div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl py-12 text-center text-gray-400">
          <CalendarCheck size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhuma rotina cadastrada.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {byFreq.map(group => {
            const info = fi(group.value);
            return (
              <div key={group.value}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: info.cor }} />
                  <h2 className="text-sm font-bold uppercase tracking-wide text-gray-500">{info.label} ({group.items.length})</h2>
                </div>
                <div className="space-y-2">
                  {group.items.map(item => {
                    const sc         = STATUS_COLORS[item.status] ?? STATUS_COLORS.pendente;
                    const isEditing  = editingId === item.id;
                    const isExpanded = expandedId === item.id;

                    return (
                      <div key={item.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="flex items-start gap-3 p-4">
                          <button onClick={() => markDoneMut.mutate({ id: item.id })} title="Marcar como concluída" className="flex-shrink-0 mt-0.5">
                            {item.status === "em_dia"
                              ? <CheckCircle2 size={18} className="text-green-500" />
                              : item.status === "atrasada"
                                ? <AlertCircle size={18} className="text-red-400" />
                                : <div className="w-[18px] h-[18px] rounded-full border-2 border-gray-300 hover:border-blue-400 transition-colors" />
                            }
                          </button>

                          <div className="flex-1 min-w-0">
                            {isEditing ? (
                              <div className="space-y-2">
                                <input className="w-full border border-gray-200 rounded px-2 py-1 text-sm" value={editData.title} onChange={e => setEditData(p => ({ ...p, title: e.target.value }))} />
                                <div className="grid grid-cols-2 gap-2">
                                  <select className="border border-gray-200 rounded px-2 py-1 text-sm" value={editData.frequency} onChange={e => setEditData(p => ({ ...p, frequency: e.target.value, calendarDates: [] }))}>
                                    {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                  </select>
                                  {editData.frequency !== "esporadico" && (
                                    <input type="date" className="border border-gray-200 rounded px-2 py-1 text-sm" value={editData.startDate} onChange={e => setEditData(p => ({ ...p, startDate: e.target.value }))} />
                                  )}
                                </div>
                                {editData.frequency === "esporadico" && (
                                  <div>
                                    <input type="date" className="border border-gray-200 rounded px-2 py-1 text-sm"
                                      onChange={e => { if (e.target.value) { toggleDate(e.target.value, editData.calendarDates, v => setEditData(p => ({ ...p, calendarDates: v }))); e.target.value = ""; } }} />
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {editData.calendarDates.map(d => (
                                        <span key={d} className="flex items-center gap-0.5 bg-purple-100 text-purple-700 text-xs px-1.5 py-0.5 rounded-full">
                                          {new Date(d + "T12:00:00").toLocaleDateString("pt-BR")}
                                          <button onClick={() => setEditData(p => ({ ...p, calendarDates: p.calendarDates.filter(x => x !== d) }))}><X size={9} /></button>
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                <UserSelect value={editData.assignedTo} onChange={name => setEditData(p => ({ ...p, assignedTo: name }))} placeholder="— Sem responsável —" className="rounded px-2 py-1 text-sm" />
                                <RichTextEditor value={editData.description} onChange={html => setEditData(p => ({ ...p, description: html }))} placeholder="Descrição..." minHeight="100px" />
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`font-semibold text-sm ${item.status === "em_dia" ? "line-through text-gray-400" : ""}`} style={item.status !== "em_dia" ? { color: "#0f172a" } : {}}>
                                    {item.title}
                                  </span>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text}`}>{sc.label}</span>
                                  <span className="text-xs px-1.5 py-0.5 rounded-full font-medium text-white" style={{ background: info.cor }}>{info.label}</span>
                                </div>
                                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                                  {item.description && <div className="text-xs text-gray-500 prose prose-xs max-w-none" dangerouslySetInnerHTML={{ __html: item.description }} />}
                                  {item.assignedTo && <span className="flex items-center gap-1 text-xs text-gray-500"><Clock size={11} />{item.assignedTo}</span>}
                                  {item.nextDue && <span className="flex items-center gap-1 text-xs text-gray-400"><CalendarDays size={11} />Próxima: {new Date(item.nextDue).toLocaleDateString("pt-BR")}</span>}
                                  {item.lastDone && <span className="text-xs text-gray-400">Última: {new Date(item.lastDone).toLocaleDateString("pt-BR")}</span>}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => updateMut.mutate({ id: item.id, data: { title: editData.title, description: editData.description || null, assignedTo: editData.assignedTo || null, frequency: editData.frequency as any, startDate: editData.startDate || null, calendarDates: editData.calendarDates.length > 0 ? JSON.stringify(editData.calendarDates) : null } })}
                                  disabled={updateMut.isPending}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
                                  style={{ background: "#16a34a" }}
                                >
                                  <Save size={12} /> Salvar
                                </button>
                                <button onClick={() => setEditingId(null)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400"><X size={13} /></button>
                              </>
                            ) : (
                              <>
                                <select className="text-xs border border-gray-200 rounded px-2 py-1 outline-none" value={item.status} onChange={e => updateMut.mutate({ id: item.id, data: { status: e.target.value as any } })}>
                                  <option value="pendente">Pendente</option>
                                  <option value="em_dia">Em Dia</option>
                                  <option value="atrasada">Atrasada</option>
                                </select>
                                <button onClick={() => setExpandedId(isExpanded ? null : item.id)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Ver calendário">
                                  <CalendarDays size={13} />
                                </button>
                                <button onClick={() => startEdit(item)} className="p-1.5 rounded hover:bg-blue-50 text-gray-400 hover:text-blue-500 transition-colors" title="Editar"><Edit2 size={13} /></button>
                                <button onClick={() => { if (confirm("Remover rotina?")) deleteMut.mutate({ id: item.id }); }} className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
                              </>
                            )}
                          </div>
                        </div>

                        {isExpanded && !isEditing && (
                          <div className="border-t border-gray-100 px-4 pb-4 bg-gray-50/50">
                            <p className="text-xs font-semibold text-gray-500 mt-3 mb-1 uppercase tracking-wide">Calendário de Execuções</p>
                            <MiniCalendar routine={{ frequency: item.frequency, startDate: item.startDate ? new Date(item.startDate) : null, calendarDates: item.calendarDates ?? null }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
