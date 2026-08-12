import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import CompletudeTransportadoras from "./CompletudeTransportadoras";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";
import {
  Truck, Globe, Clock, MapPin, Package, User, Phone, MessageCircle,
  Building2, Star, Plus, Trash2, Edit, ArrowLeft, Eye, EyeOff,
  Calendar, Search, Plane, Bus, AlertTriangle, CheckCircle2, Lock, Home
} from "lucide-react";

type TransportadoraItem = {
  id: number; nome: string; site?: string | null; endereco?: string | null;
  modais?: string | null; realizaColeta?: string | null; ativa?: string | null;
  nomeContato?: string | null; whatsappContato?: string | null; telefoneContato?: string | null;
  nomeContatoNegocial?: string | null; whatsappContatoNegocial?: string | null;
  telefoneContatoNegocial?: string | null; distanciaSedMin?: number | null;
  ultAtualizTabela?: string | null; ultAtualizCidades?: string | null;
  horarioLimiteColeta?: string | null; formaCotacao?: string | null;
  totalCidades: number;
  coberturaTotal?: number | null;
};

type TransportadoraDetalhe = TransportadoraItem & {
  referencia?: string | null; emailContatoNegocial?: string | null;
  linkSiteCotacao?: string | null; pesoMaxKg?: string | null;
  alturaMaxCm?: string | null; larguraMaxCm?: string | null;
  comprimentoMaxCm?: string | null; somaMaxCm?: string | null;
  horarioLimiteMercadoria?: string | null; semTabelaNegociavel?: string | null;
  portalUrl?: string | null; portalUsuario?: string | null;
  portalEmail?: string | null; portalSenha?: string | null;
  portalObservacao?: string | null; contatoRastreio?: string | null;
  observacoes?: string | null; updatedAt?: string | null;
  cidades: { id: number; cidade: string; estado: string; telefone?: string | null; observacao?: string | null; endereco?: string | null; responsavel?: string | null; sede?: string | null }[];
  avaliacoes: { id: number; estrelas: number; comentario?: string | null; autor?: string | null; createdAt: string }[];
  filiais: { id: number; nome: string; endereco?: string | null; cidade?: string | null; estado?: string | null; telefone?: string | null }[];
};

function getInitials(nome: string) {
  const words = nome.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700", "bg-green-100 text-green-700",
  "bg-purple-100 text-purple-700", "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700", "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700", "bg-yellow-100 text-yellow-700",
];

function getAvatarColor(nome: string) {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function parseModais(modais?: string | null): string[] {
  if (!modais) return [];
  try { return JSON.parse(modais); } catch { return []; }
}

function calcCompletude(t: TransportadoraItem) {
  const campos = [
    { label: "Endereco", val: t.endereco },
    { label: "Site", val: t.site },
    { label: "WhatsApp", val: t.whatsappContato },
    { label: "Telefone", val: t.telefoneContato },
    { label: "Contato operacional", val: t.nomeContato },
    { label: "Contato negocial", val: t.nomeContatoNegocial },
    { label: "Horario limite coleta", val: t.horarioLimiteColeta },
    { label: "Distancia da sede", val: t.distanciaSedMin != null ? String(t.distanciaSedMin) : null },
    { label: "Atualizacao de cidades", val: t.ultAtualizCidades },
    { label: "Tabela de precos", val: t.ultAtualizTabela },
  ];
  const preenchidos = campos.filter(c => c.val && String(c.val).trim() !== "").length;
  const pct = Math.round((preenchidos / campos.length) * 100);
  const faltando = campos.filter(c => !c.val || String(c.val).trim() === "").map(c => c.label);
  return { pct, faltando };
}

function formatDate(val?: string | null) {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("pt-BR");
  } catch { return val ?? "—"; }
}

const HORAS = ["Sem limite","07:00","08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00","18:00","19:00","20:00"];

function CompletudeBarra({ t }: { t: TransportadoraItem }) {
  const { pct, faltando } = calcCompletude(t);
  const cor = pct >= 70 ? "bg-blue-500" : pct >= 50 ? "bg-orange-400" : "bg-red-500";
  const textCor = pct >= 70 ? "text-blue-600" : pct >= 50 ? "text-orange-500" : "text-red-500";
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">Completude do cadastro</span>
        <span className={`text-sm font-bold ${textCor}`}>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${pct}%` }} />
      </div>
      {faltando.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {faltando.map(f => <span key={f} className="text-xs text-gray-400">{f}</span>)}
        </div>
      )}
    </div>
  );
}

function ModalBadges({ modais, realizaColeta }: { modais?: string | null; realizaColeta?: string | null }) {
  const lista = parseModais(modais);
  return (
    <div className="flex flex-wrap gap-2">
      {lista.includes("rodoviario") && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
          <Truck className="w-3.5 h-3.5" /> Rodoviário
        </span>
      )}
      {lista.includes("aereo") && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-sky-100 text-sky-700 border border-sky-200">
          <Plane className="w-3.5 h-3.5" /> Aéreo
        </span>
      )}
      {lista.includes("onibus") && (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-700 border border-violet-200">
          <Bus className="w-3.5 h-3.5" /> Ônibus
        </span>
      )}
      {realizaColeta === "sim" ? (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
          <CheckCircle2 className="w-3.5 h-3.5" /> Faz Coleta
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600 border border-red-200">
          <AlertTriangle className="w-3.5 h-3.5" /> Sem Coleta
        </span>
      )}
    </div>
  );
}

function TransportadoraCard({ t, onClick }: { t: TransportadoraItem; onClick: () => void }) {
  const { pct } = calcCompletude(t);
  const barCor = pct >= 70 ? "bg-blue-500" : pct >= 50 ? "bg-orange-400" : "bg-red-500";
  const textCor = pct >= 70 ? "text-blue-600" : pct >= 50 ? "text-orange-500" : "text-red-500";
  const modaisList = parseModais(t.modais);
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow border border-gray-200 bg-white" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${getAvatarColor(t.nome)}`}>
            {getInitials(t.nome)}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{t.nome}</h3>
            <p className="text-xs text-gray-500">{t.coberturaTotal ? <span className="inline-flex items-center gap-1 text-green-700 font-medium"><Globe className="w-3 h-3" /> Cobertura nacional</span> : `${t.totalCidades} cidades`} &middot; {t.ativa === "nao" ? "Inativa" : "Ativa"}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {modaisList.includes("rodoviario") && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700"><Truck className="w-3 h-3" /> Rodoviário</span>}
          {modaisList.includes("aereo") && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-100 text-sky-700"><Plane className="w-3 h-3" /> Aéreo</span>}
          {modaisList.includes("onibus") && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-700"><Bus className="w-3 h-3" /> Ônibus</span>}
        </div>
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-gray-400">Completude</span>
            <span className={`text-xs font-semibold ${textCor}`}>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${barCor}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type FormData = {
  nome: string; site: string; endereco: string; referencia: string;
  nomeContato: string; whatsappContato: string; telefoneContato: string;
  formaCotacao: string; horarioLimiteColeta: string; horarioLimiteMercadoria: string;
  distanciaSedMin: string; realizaColeta: boolean; ultAtualizTabela: string;
  semTabelaNegociavel: boolean; ativa: boolean; observacoes: string;
  nomeContatoNegocial: string; whatsappContatoNegocial: string; telefoneContatoNegocial: string;
  emailContatoNegocial: string; modais: string[];
  larguraMaxCm: string; alturaMaxCm: string; comprimentoMaxCm: string; somaMaxCm: string; pesoMaxKg: string;
  portalUrl: string; portalUsuario: string; portalEmail: string; portalSenha: string;
  portalObservacao: string; contatoRastreio: string; ultAtualizCidades: string;
  coberturaTotal: boolean;
};

function defaultForm(t?: TransportadoraDetalhe | null): FormData {
  return {
    nome: t?.nome ?? "", site: t?.site ?? "", endereco: t?.endereco ?? "", referencia: t?.referencia ?? "",
    nomeContato: t?.nomeContato ?? "", whatsappContato: t?.whatsappContato ?? "", telefoneContato: t?.telefoneContato ?? "",
    formaCotacao: t?.formaCotacao ?? "whatsapp", horarioLimiteColeta: t?.horarioLimiteColeta ?? "",
    horarioLimiteMercadoria: t?.horarioLimiteMercadoria ?? "",
    distanciaSedMin: t?.distanciaSedMin != null ? String(t.distanciaSedMin) : "",
    realizaColeta: t?.realizaColeta === "sim", ultAtualizTabela: t?.ultAtualizTabela ?? "",
    semTabelaNegociavel: t?.semTabelaNegociavel === "sim", ativa: t?.ativa !== "nao", observacoes: t?.observacoes ?? "",
    nomeContatoNegocial: t?.nomeContatoNegocial ?? "", whatsappContatoNegocial: t?.whatsappContatoNegocial ?? "",
    telefoneContatoNegocial: t?.telefoneContatoNegocial ?? "", emailContatoNegocial: t?.emailContatoNegocial ?? "",
    modais: parseModais(t?.modais), larguraMaxCm: t?.larguraMaxCm ?? "", alturaMaxCm: t?.alturaMaxCm ?? "",
    comprimentoMaxCm: t?.comprimentoMaxCm ?? "", somaMaxCm: t?.somaMaxCm ?? "", pesoMaxKg: t?.pesoMaxKg ?? "",
    portalUrl: t?.portalUrl ?? "", portalUsuario: t?.portalUsuario ?? "", portalEmail: t?.portalEmail ?? "",
    portalSenha: t?.portalSenha ?? "", portalObservacao: t?.portalObservacao ?? "",
    contatoRastreio: t?.contatoRastreio ?? "", ultAtualizCidades: t?.ultAtualizCidades ?? "",
    coberturaTotal: Number((t as any)?.coberturaTotal ?? 0) === 1,
  };
}

type EditTab = "principal" | "negocial" | "modais" | "portais";

function TransportadoraForm({ detalhe, onSave, onCancel }: {
  detalhe?: TransportadoraDetalhe | null; onSave: (data: FormData) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState<FormData>(() => defaultForm(detalhe));
  const [tab, setTab] = useState<EditTab>("principal");
  const [showSenha, setShowSenha] = useState(false);
  const set = (k: keyof FormData, v: unknown) => setForm(f => ({ ...f, [k]: v }));
  const toggleModal = (m: string) => setForm(f => ({ ...f, modais: f.modais.includes(m) ? f.modais.filter(x => x !== m) : [...f.modais, m] }));
  const tabs: { id: EditTab; label: string }[] = [
    { id: "principal", label: "Principal" }, { id: "negocial", label: "Contato Negocial" },
    { id: "modais", label: "Modais & Dimensões" }, { id: "portais", label: "Portais De Cotação" },
  ];
  return (
    <div className="flex flex-col gap-6">
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === t.id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {tab === "principal" && (
        <div className="flex flex-col gap-4">
          <div><Label>Nome *</Label><Input className="mt-1" value={form.nome} onChange={e => set("nome", e.target.value)} placeholder="Nome da transportadora" /></div>
          <div><Label>Endereço</Label><Input className="mt-1" value={form.endereco} onChange={e => set("endereco", e.target.value)} /></div>
          <div><Label>Referência</Label><Input className="mt-1" value={form.referencia} onChange={e => set("referencia", e.target.value)} placeholder="Ex: próximo à rodoviária" /></div>
          <div><Label>Site</Label><Input className="mt-1" value={form.site} onChange={e => set("site", e.target.value)} placeholder="https://..." /></div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Contato para Cotações (Operacional)</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Nome</Label><Input className="mt-1" value={form.nomeContato} onChange={e => set("nomeContato", e.target.value)} /></div>
              <div><Label>WhatsApp</Label><Input className="mt-1" value={form.whatsappContato} onChange={e => set("whatsappContato", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input className="mt-1" value={form.telefoneContato} onChange={e => set("telefoneContato", e.target.value)} /></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <Label>Forma de Cotação</Label>
              <Select value={form.formaCotacao} onValueChange={v => set("formaCotacao", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="telefone">Telefone</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Horário Limite de Pedido de Coleta</Label>
              <Select value={form.horarioLimiteColeta || "Sem limite"} onValueChange={v => set("horarioLimiteColeta", v === "Sem limite" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sem limite" /></SelectTrigger>
                <SelectContent>{HORAS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">Até quando a transportadora aceita pedido de coleta.</p>
            </div>
            <div>
              <Label>Horário Limite para Deixar a Mercadoria</Label>
              <Select value={form.horarioLimiteMercadoria || "Sem limite"} onValueChange={v => set("horarioLimiteMercadoria", v === "Sem limite" ? "" : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Sem limite" /></SelectTrigger>
                <SelectContent>{HORAS.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-gray-400 mt-1">Até quando podemos deixar a mercadoria na transportadora.</p>
            </div>
            <div><Label>Distância Sede (min)</Label><Input className="mt-1" type="number" value={form.distanciaSedMin} onChange={e => set("distanciaSedMin", e.target.value)} placeholder="Ex: 15" /></div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2"><Switch checked={form.realizaColeta} onCheckedChange={v => set("realizaColeta", v)} /><Label>Faz Coleta</Label></div>
            <div className="flex items-center gap-2"><Switch checked={form.ativa} onCheckedChange={v => set("ativa", v)} /><Label>Transportadora Ativa</Label></div>
          </div>
          {/* ── Alcance Nacional ─────────────────────────────────────────── */}
          <div className={`rounded-lg border p-3 transition-colors ${form.coberturaTotal ? "border-green-300 bg-green-50" : "border-gray-200 bg-gray-50/50"}`}>
            <div className="flex items-center gap-2">
              <Switch checked={form.coberturaTotal} onCheckedChange={v => set("coberturaTotal", v)} />
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <Globe className={`w-4 h-4 ${form.coberturaTotal ? "text-green-600" : "text-gray-400"}`} />
                Alcance Nacional
              </Label>
            </div>
            <p className="text-xs text-gray-500 mt-1.5">
              {form.coberturaTotal
                ? "Atende todas as cidades e CEPs do Brasil — aparecerá em qualquer cotação, sem precisar cadastrar cidades."
                : "Atende apenas as cidades cadastradas na aba de cobertura."}
            </p>
          </div>
          <div>
            <Label>Últ. Atualização Tabela de Preços</Label>
            <div className="flex items-center gap-3 mt-1">
              <Input type="date" className="w-48" value={form.ultAtualizTabela} onChange={e => set("ultAtualizTabela", e.target.value)} />
              <div className="flex items-center gap-2">
                <Checkbox checked={form.semTabelaNegociavel} onCheckedChange={v => set("semTabelaNegociavel", !!v)} />
                <Label className="font-normal text-sm">Não se aplica (sem tabela negociável)</Label>
              </div>
            </div>
          </div>
          <div><Label>Observações</Label><Textarea className="mt-1" rows={3} value={form.observacoes} onChange={e => set("observacoes", e.target.value)} placeholder="Observações do setor logístico..." /></div>
        </div>
      )}

      {tab === "negocial" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">Contato para negociação de tabelas de preço e contratos.</p>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Nome</Label><Input className="mt-1" value={form.nomeContatoNegocial} onChange={e => set("nomeContatoNegocial", e.target.value)} /></div>
            <div><Label>WhatsApp</Label><Input className="mt-1" value={form.whatsappContatoNegocial} onChange={e => set("whatsappContatoNegocial", e.target.value)} /></div>
            <div><Label>Telefone</Label><Input className="mt-1" value={form.telefoneContatoNegocial} onChange={e => set("telefoneContatoNegocial", e.target.value)} /></div>
          </div>
          <div><Label>E-mail</Label><Input className="mt-1" type="email" value={form.emailContatoNegocial} onChange={e => set("emailContatoNegocial", e.target.value)} /></div>
        </div>
      )}

      {tab === "modais" && (
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Modais Disponíveis</p>
            <div className="grid grid-cols-3 gap-3">
              {([{ id: "aereo", label: "Avião", Icon: Plane }, { id: "rodoviario", label: "Caminhão", Icon: Truck }, { id: "onibus", label: "Ônibus", Icon: Bus }] as const).map(({ id, label, Icon }) => {
                const selected = form.modais.includes(id);
                return (
                  <button key={id} type="button" onClick={() => toggleModal(id)} className={`flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 transition-all ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-white text-gray-500 hover:border-gray-300"}`}>
                    <Icon className="w-6 h-6" />
                    <span className="text-sm font-medium">{label}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 text-blue-500" />}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">Dimensões Máximas (CM)</p>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Largura máx. (cm)</Label><Input className="mt-1" type="number" value={form.larguraMaxCm} onChange={e => set("larguraMaxCm", e.target.value)} /></div>
              <div><Label>Altura máx. (cm)</Label><Input className="mt-1" type="number" value={form.alturaMaxCm} onChange={e => set("alturaMaxCm", e.target.value)} /></div>
              <div><Label>Comprimento máx. (cm)</Label><Input className="mt-1" type="number" value={form.comprimentoMaxCm} onChange={e => set("comprimentoMaxCm", e.target.value)} /></div>
              <div><Label>Soma máx. C+L+A (cm)</Label><Input className="mt-1" type="number" value={form.somaMaxCm} onChange={e => set("somaMaxCm", e.target.value)} /></div>
              <div><Label>Peso máx. (kg)</Label><Input className="mt-1" type="number" value={form.pesoMaxKg} onChange={e => set("pesoMaxKg", e.target.value)} /></div>
            </div>
          </div>
        </div>
      )}

      {tab === "portais" && (
        <div className="flex flex-col gap-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">Informações <strong>confidenciais</strong> — visíveis apenas para Logística e Administradores.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>URL do Portal de Cotação</Label><Input className="mt-1" value={form.portalUrl} onChange={e => set("portalUrl", e.target.value)} placeholder="https://..." /></div>
            <div><Label>Usuário / Login</Label><Input className="mt-1" value={form.portalUsuario} onChange={e => set("portalUsuario", e.target.value)} /></div>
            <div><Label>E-mail de Acesso</Label><Input className="mt-1" type="email" value={form.portalEmail} onChange={e => set("portalEmail", e.target.value)} /></div>
            <div>
              <Label>Senha</Label>
              <div className="relative mt-1">
                <Input type={showSenha ? "text" : "password"} value={form.portalSenha} onChange={e => set("portalSenha", e.target.value)} className="pr-10" />
                <button type="button" onClick={() => setShowSenha(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
          <div><Label>Observações do Portal</Label><Textarea className="mt-1" rows={2} value={form.portalObservacao} onChange={e => set("portalObservacao", e.target.value)} /></div>
          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3 flex items-center gap-1"><Search className="w-3.5 h-3.5" /> Contato para Rastreio</p>
            <Textarea rows={2} value={form.contatoRastreio} onChange={e => set("contatoRastreio", e.target.value)} placeholder="Canal de contato para rastrear encomendas já despachadas." />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(form)} className="bg-blue-600 hover:bg-blue-700">Salvar</Button>
      </div>
    </div>
  );
}

function TransportadoraView({ detalhe, onEdit, onDelete, onBack }: {
  detalhe: TransportadoraDetalhe; onEdit: () => void; onDelete: () => void; onBack: () => void;
}) {
  const utils = trpc.useUtils();
  
  const [cidadeBusca, setCidadeBusca] = useState("");
  const [novaEstrela, setNovaEstrela] = useState(0);
  const [novoComentario, setNovoComentario] = useState("");
  const [novaFilialNome, setNovaFilialNome] = useState("");
  const [novaFilialEnd, setNovaFilialEnd] = useState("");
  const [novaCidade, setNovaCidade] = useState("");
  const [novoEstado, setNovoEstado] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [viewTab, setViewTab] = useState<"cidades" | "filiais" | "avaliacoes">("cidades");

  const addAvaliacao = trpc.transportadoras.addAvaliacao.useMutation({ onSuccess: () => { utils.transportadoras.get.invalidate({ id: detalhe.id }); setNovaEstrela(0); setNovoComentario(""); toast("Avaliação salva!"); } });
  const deleteAvaliacao = trpc.transportadoras.deleteAvaliacao.useMutation({ onSuccess: () => utils.transportadoras.get.invalidate({ id: detalhe.id }) });
  const addFilial = trpc.transportadoras.addFilial.useMutation({ onSuccess: () => { utils.transportadoras.get.invalidate({ id: detalhe.id }); setNovaFilialNome(""); setNovaFilialEnd(""); toast("Filial adicionada!"); } });
  const deleteFilial = trpc.transportadoras.deleteFilial.useMutation({ onSuccess: () => utils.transportadoras.get.invalidate({ id: detalhe.id }) });
  const [showAutocompleteCidade, setShowAutocompleteCidade] = useState(false);
  const addCidade = trpc.transportadoras.addCidade.useMutation({
    onSuccess: () => { utils.transportadoras.get.invalidate({ id: detalhe.id }); utils.transportadoras.list.invalidate(); setNovaCidade(""); setNovoEstado(""); setShowAutocompleteCidade(false); toast("Cidade adicionada!"); },
    onError: (e) => toast.error(e.message || "Erro ao adicionar cidade")
  });
  const removeCidade = trpc.transportadoras.removeCidade.useMutation({ onSuccess: () => utils.transportadoras.get.invalidate({ id: detalhe.id }) });
  const { data: sugestoesCidade } = trpc.transportadoras.buscarMunicipios.useQuery(
    { q: novaCidade },
    { enabled: novaCidade.length >= 2 }
  );

  const cidadesFiltradas = useMemo(() => {
    if (!cidadeBusca) return detalhe.cidades;
    const s = cidadeBusca.toLowerCase();
    return detalhe.cidades.filter(c => c.cidade.toLowerCase().includes(s) || c.estado.toLowerCase().includes(s));
  }, [detalhe.cidades, cidadeBusca]);

  const mediaAvaliacoes = detalhe.avaliacoes.length > 0 ? detalhe.avaliacoes.reduce((acc, a) => acc + a.estrelas, 0) / detalhe.avaliacoes.length : 0;
  const temDimensoes = detalhe.larguraMaxCm || detalhe.alturaMaxCm || detalhe.comprimentoMaxCm;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><ArrowLeft className="w-4 h-4" /> Voltar</button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{detalhe.nome}</h2>
            <p className="text-sm text-gray-500">{(detalhe as TransportadoraItem).coberturaTotal ? <span className="inline-flex items-center gap-1 text-green-700 font-semibold"><Globe className="w-4 h-4" /> Cobertura nacional — todos os municípios do Brasil</span> : `${detalhe.totalCidades} cidades atendidas`} &middot; {detalhe.filiais.length} filiais</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5"><Edit className="w-4 h-4" /> Editar</Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(true)} className="gap-1.5 text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"><Trash2 className="w-4 h-4" /> Excluir</Button>
        </div>
      </div>

      <Card className="border border-gray-200">
        <CardContent className="p-6 flex flex-col gap-5">
          <div className="flex items-start gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${getAvatarColor(detalhe.nome)}`}>{getInitials(detalhe.nome)}</div>
            <div className="flex-1"><CompletudeBarra t={detalhe} /></div>
          </div>

          <ModalBadges modais={detalhe.modais} realizaColeta={detalhe.realizaColeta} />

          <div className="grid grid-cols-3 gap-4">
            {detalhe.endereco && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><Building2 className="w-3.5 h-3.5" /> Endereço</p>
                <p className="text-sm text-gray-700">{detalhe.endereco}{detalhe.referencia ? ` — ${detalhe.referencia}` : ""}</p>
              </div>
            )}
            {detalhe.site && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><Globe className="w-3.5 h-3.5" /> Site</p>
                <a href={detalhe.site.startsWith("http") ? detalhe.site : `https://${detalhe.site}`} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline break-all">{detalhe.site}</a>
              </div>
            )}
            {detalhe.horarioLimiteColeta && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5" /> Horário Limite de Pedido de Coleta</p>
                <p className="text-sm text-gray-700">{detalhe.horarioLimiteColeta}</p>
              </div>
            )}
            {detalhe.horarioLimiteMercadoria && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><Clock className="w-3.5 h-3.5" /> Horário Limite para Deixar a Mercadoria</p>
                <p className="text-sm text-gray-700">{detalhe.horarioLimiteMercadoria}</p>
              </div>
            )}
            {detalhe.formaCotacao && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><Package className="w-3.5 h-3.5" /> Forma de Cotação</p>
                <p className="text-sm text-gray-700 capitalize">{detalhe.formaCotacao}</p>
              </div>
            )}
            {detalhe.distanciaSedMin != null && (
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1"><MapPin className="w-3.5 h-3.5" /> Distância da Sede</p>
                <p className="text-sm text-gray-700">{detalhe.distanciaSedMin} min</p>
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 text-sm text-gray-500 border-t pt-4">
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Cidades atualizada em: {detalhe.ultAtualizCidades ? <strong className="text-gray-700">{formatDate(detalhe.ultAtualizCidades)}</strong> : "—"}</span>
            <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" /> Tabela atualizada em: {detalhe.ultAtualizTabela ? <strong className="text-gray-700">{formatDate(detalhe.ultAtualizTabela)}</strong> : "—"}</span>
          </div>

          {temDimensoes && (
            <div className="bg-gray-50 rounded-lg px-4 py-2 flex items-center gap-2 text-sm text-gray-600">
              <Package className="w-4 h-4 text-gray-400" />
              Dimensões máximas: {detalhe.larguraMaxCm && `${detalhe.larguraMaxCm}cm (L)`}{detalhe.alturaMaxCm && ` × ${detalhe.alturaMaxCm}cm (A)`}{detalhe.comprimentoMaxCm && ` × ${detalhe.comprimentoMaxCm}cm (C)`}
              {detalhe.pesoMaxKg && ` · Peso máx. ${detalhe.pesoMaxKg}kg`}
            </div>
          )}

          {(detalhe.nomeContato || detalhe.whatsappContato || detalhe.telefoneContato) && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-3"><User className="w-3.5 h-3.5" /> Contato para Cotações</p>
              <div className="grid grid-cols-3 gap-4">
                {detalhe.nomeContato && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Nome</p><p className="text-sm text-gray-700 flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{detalhe.nomeContato}</p></div>}
                {detalhe.whatsappContato && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">WhatsApp</p><p className="text-sm text-gray-700 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-green-500" />{detalhe.whatsappContato}</p></div>}
                {detalhe.telefoneContato && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Telefone</p><p className="text-sm text-gray-700 flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{detalhe.telefoneContato}</p></div>}
              </div>
            </div>
          )}

          {(detalhe.nomeContatoNegocial || detalhe.whatsappContatoNegocial || detalhe.telefoneContatoNegocial) && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1 mb-3"><Building2 className="w-3.5 h-3.5" /> Contato Negocial</p>
              <div className="grid grid-cols-3 gap-4">
                {detalhe.nomeContatoNegocial && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Nome</p><p className="text-sm text-gray-700 flex items-center gap-1"><User className="w-3.5 h-3.5 text-gray-400" />{detalhe.nomeContatoNegocial}</p></div>}
                {detalhe.whatsappContatoNegocial && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">WhatsApp</p><p className="text-sm text-gray-700 flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5 text-green-500" />{detalhe.whatsappContatoNegocial}</p></div>}
                {detalhe.telefoneContatoNegocial && <div><p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Telefone</p><p className="text-sm text-gray-700 flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-gray-400" />{detalhe.telefoneContatoNegocial}</p></div>}
              </div>
            </div>
          )}

          {detalhe.observacoes && (
            <div className="border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Observações do Setor Logístico</p>
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm text-gray-700">{detalhe.observacoes}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex border-b gap-6">
        {[{ id: "cidades" as const, label: `Cidades (${detalhe.cidades.length})` }, { id: "filiais" as const, label: `Filiais (${detalhe.filiais.length})` }, { id: "avaliacoes" as const, label: `Avaliações (${detalhe.avaliacoes.length})` }].map(t => (
          <button key={t.id} onClick={() => setViewTab(t.id)} className={`pb-2 text-sm font-medium border-b-2 transition-colors ${viewTab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>{t.label}</button>
        ))}
      </div>

      {viewTab === "cidades" && (
        <div className="flex flex-col gap-3">
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-9" placeholder="Buscar cidade..." value={cidadeBusca} onChange={e => setCidadeBusca(e.target.value)} /></div>
          <div className="flex flex-wrap gap-2 relative">
            <div className="flex-1 relative" style={{minWidth: '120px'}}>
              <Input placeholder="Cidade" value={novaCidade} onChange={e => { setNovaCidade(e.target.value); setShowAutocompleteCidade(true); }} onFocus={() => setShowAutocompleteCidade(true)} onBlur={() => setTimeout(() => setShowAutocompleteCidade(false), 150)} className="w-full text-xs" />
              {showAutocompleteCidade && sugestoesCidade && sugestoesCidade.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {sugestoesCidade.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0" onMouseDown={() => { setNovaCidade(s.cidade); setNovoEstado(s.estado); setShowAutocompleteCidade(false); }}>
                      {s.cidade} — {s.estado}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input placeholder="UF" value={novoEstado} onChange={e => setNovoEstado(e.target.value.toUpperCase().slice(0, 2))} className="w-14 flex-shrink-0 text-xs" />
            <Button size="sm" onClick={() => { if (novaCidade && novoEstado.length === 2) addCidade.mutate({ transportadoraId: detalhe.id, cidade: novaCidade, estado: novoEstado }); }} className="gap-1 text-xs flex-shrink-0"><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
          </div>
          <div className="flex flex-col gap-px max-h-80 overflow-y-auto">
            {cidadesFiltradas.map(c => (
              <div key={c.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1 gap-1">
                <div className="flex-1 min-w-0 overflow-hidden">
                  <div className="flex items-baseline gap-1 flex-wrap">
                    <span className="text-[11px] font-medium text-gray-800 leading-snug">{c.cidade}</span>
                    <span className="text-[10px] text-gray-500 flex-shrink-0">— {c.estado}</span>
                    {c.sede && <span className="text-[10px] text-blue-600 bg-blue-50 px-1 rounded flex-shrink-0">{c.sede}</span>}
                  </div>
                  {c.responsavel && <p className="text-[10px] text-gray-400 leading-tight truncate">Resp: {c.responsavel}{c.telefone ? ` · ${c.telefone}` : ''}</p>}
                  {c.endereco && !c.responsavel && <p className="text-[10px] text-gray-400 leading-tight truncate">{c.endereco}</p>}
                </div>
                <button onClick={() => removeCidade.mutate({ id: c.id })} className="text-gray-300 hover:text-red-500 flex-shrink-0 p-0.5"><Trash2 className="w-3 h-3" /></button>
              </div>
            ))}
            {cidadesFiltradas.length === 0 && <p className="text-xs text-gray-400 text-center py-4">Nenhuma cidade encontrada.</p>}
          </div>
        </div>
      )}

      {viewTab === "filiais" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input placeholder="Nome da filial" value={novaFilialNome} onChange={e => setNovaFilialNome(e.target.value)} className="flex-1" />
            <Input placeholder="Endereço (opcional)" value={novaFilialEnd} onChange={e => setNovaFilialEnd(e.target.value)} className="flex-1" />
            <Button size="sm" onClick={() => { if (novaFilialNome) addFilial.mutate({ transportadoraId: detalhe.id, nome: novaFilialNome, endereco: novaFilialEnd || undefined }); }} className="gap-1"><Plus className="w-4 h-4" /> Adicionar</Button>
          </div>
          {detalhe.filiais.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Nenhuma filial cadastrada.</p> : (
            <div className="flex flex-col gap-2">
              {detalhe.filiais.map(f => (
                <div key={f.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div><p className="text-sm font-medium text-gray-800">{f.nome}</p>{f.endereco && <p className="text-xs text-gray-500">{f.endereco}</p>}{f.cidade && <p className="text-xs text-gray-500">{f.cidade}{f.estado ? ` — ${f.estado}` : ""}</p>}</div>
                  <button onClick={() => deleteFilial.mutate({ id: f.id })} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {viewTab === "avaliacoes" && (
        <div className="flex flex-col gap-4">
          {detalhe.avaliacoes.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">{[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= Math.round(mediaAvaliacoes) ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
              <span className="text-sm text-gray-500">{mediaAvaliacoes.toFixed(1)} ({detalhe.avaliacoes.length} avaliações)</span>
            </div>
          )}
          <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
            <p className="text-sm font-medium text-gray-700">Nova Avaliação</p>
            <div className="flex gap-1">{[1,2,3,4,5].map(s => <button key={s} onClick={() => setNovaEstrela(s)}><Star className={`w-6 h-6 transition-colors ${s <= novaEstrela ? "fill-amber-400 text-amber-400" : "text-gray-300 hover:text-amber-300"}`} /></button>)}</div>
            <Textarea placeholder="Comentário (opcional)..." rows={2} value={novoComentario} onChange={e => setNovoComentario(e.target.value)} />
            <Button size="sm" disabled={novaEstrela === 0} onClick={() => addAvaliacao.mutate({ transportadoraId: detalhe.id, estrelas: novaEstrela, comentario: novoComentario || undefined })}>Salvar Avaliação</Button>
          </div>
          {detalhe.avaliacoes.map(a => (
            <div key={a.id} className="flex items-start justify-between bg-white border rounded-lg p-4">
              <div className="flex flex-col gap-1">
                <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`w-4 h-4 ${s <= a.estrelas ? "fill-amber-400 text-amber-400" : "text-gray-200"}`} />)}</div>
                {a.comentario && <p className="text-sm text-gray-700">{a.comentario}</p>}
                <p className="text-xs text-gray-400">{a.autor ?? "Anônimo"} &middot; {new Date(a.createdAt).toLocaleDateString("pt-BR")}</p>
              </div>
              <button onClick={() => deleteAvaliacao.mutate({ id: a.id })} className="text-gray-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transportadora?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação removerá permanentemente "{detalhe.nome}" e todos os seus dados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete} className="bg-red-600 hover:bg-red-700">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Transportadoras() {
  
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [modalFiltro, setModalFiltro] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<"list" | "view" | "edit" | "new">("list");
  const [showNew, setShowNew] = useState(false);
  const [abaPrincipal, setAbaPrincipal] = useState<"cadastro" | "completude">(() => {
    // Permite abrir direto na subaba via ?aba=completude
    if (typeof window !== "undefined") {
      const aba = new URLSearchParams(window.location.search).get("aba");
      if (aba === "completude") return "completude";
    }
    return "cadastro";
  });

  const { data: lista = [], isLoading } = trpc.transportadoras.list.useQuery({ search, modal: modalFiltro });
  const { data: detalhe, isLoading: loadingDetalhe } = trpc.transportadoras.get.useQuery({ id: selectedId! }, { enabled: selectedId != null });

  const createMut = trpc.transportadoras.create.useMutation({ onSuccess: () => { utils.transportadoras.list.invalidate(); setShowNew(false); toast("Transportadora criada!"); } });
  const updateMut = trpc.transportadoras.update.useMutation({ onSuccess: () => { utils.transportadoras.list.invalidate(); utils.transportadoras.get.invalidate({ id: selectedId! }); setMode("view"); toast("Salvo com sucesso!"); } });
  const deleteMut = trpc.transportadoras.delete.useMutation({ onSuccess: () => { utils.transportadoras.list.invalidate(); setMode("list"); setSelectedId(null); toast("Transportadora excluída."); } });

  function handleSave(form: FormData) {
    const payload = {
      nome: form.nome, site: form.site || undefined, endereco: form.endereco || undefined,
      referencia: form.referencia || undefined, nomeContato: form.nomeContato || undefined,
      whatsappContato: form.whatsappContato || undefined, telefoneContato: form.telefoneContato || undefined,
      nomeContatoNegocial: form.nomeContatoNegocial || undefined, whatsappContatoNegocial: form.whatsappContatoNegocial || undefined,
      telefoneContatoNegocial: form.telefoneContatoNegocial || undefined, emailContatoNegocial: form.emailContatoNegocial || undefined,
      formaCotacao: form.formaCotacao as "site" | "whatsapp" | "telefone" | "email",
      horarioLimiteColeta: form.horarioLimiteColeta || undefined, horarioLimiteMercadoria: form.horarioLimiteMercadoria || undefined,
      distanciaSedMin: form.distanciaSedMin ? parseInt(form.distanciaSedMin) : undefined,
      realizaColeta: form.realizaColeta ? "sim" as const : "nao" as const,
      ultAtualizTabela: form.ultAtualizTabela || undefined,
      semTabelaNegociavel: form.semTabelaNegociavel ? "sim" as const : "nao" as const,
      ativa: form.ativa ? "sim" as const : "nao" as const,
      observacoes: form.observacoes || undefined, modais: JSON.stringify(form.modais),
      larguraMaxCm: form.larguraMaxCm || undefined, alturaMaxCm: form.alturaMaxCm || undefined,
      comprimentoMaxCm: form.comprimentoMaxCm || undefined, somaMaxCm: form.somaMaxCm || undefined,
      pesoMaxKg: form.pesoMaxKg || undefined, portalUrl: form.portalUrl || undefined,
      portalUsuario: form.portalUsuario || undefined, portalEmail: form.portalEmail || undefined,
      portalSenha: form.portalSenha || undefined, portalObservacao: form.portalObservacao || undefined,
      contatoRastreio: form.contatoRastreio || undefined, ultAtualizCidades: form.ultAtualizCidades || undefined,
      coberturaTotal: form.coberturaTotal ? 1 : 0,
    };
    if (showNew) createMut.mutate(payload);
    else updateMut.mutate({ id: selectedId!, ...payload });
  }

  const MODAIS_FILTRO = [
    { id: undefined, label: "Todos" }, { id: "rodoviario", label: "Rodoviário" },
    { id: "aereo", label: "Aéreo" }, { id: "onibus", label: "Ônibus" },
  ];

  if (mode === "view" || mode === "edit") {
    if (loadingDetalhe || !detalhe) return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>;
    if (mode === "edit") return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => setMode("view")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1"><ArrowLeft className="w-4 h-4" /> Voltar</button>
            <h2 className="text-xl font-bold text-gray-900">{detalhe.nome}</h2>
            <p className="text-sm text-gray-500">{(detalhe as unknown as TransportadoraDetalhe).totalCidades} cidades atendidas &middot; {(detalhe as unknown as TransportadoraDetalhe).filiais.length} filiais</p>
          </div>
        </div>
        <Card className="border border-gray-200"><CardContent className="p-6"><TransportadoraForm detalhe={detalhe as unknown as TransportadoraDetalhe} onSave={handleSave} onCancel={() => setMode("view")} /></CardContent></Card>
      </div>
    );
    return (
      <div className="max-w-3xl mx-auto">
        <TransportadoraView detalhe={detalhe as unknown as TransportadoraDetalhe} onEdit={() => setMode("edit")} onDelete={() => deleteMut.mutate({ id: detalhe.id })} onBack={() => { setMode("list"); setSelectedId(null); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Barra de navegação */}
      <div className="flex items-center -mx-6 -mt-6 mb-2 px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      <PageHeader
        title="Transportadoras"
        description={`${lista.length} transportadoras cadastradas`}
        actions={
          abaPrincipal === "cadastro" && (
            <Button onClick={() => setShowNew(true)} className="gap-2 bg-blue-600 hover:bg-blue-700"><Plus className="w-4 h-4" /> Nova Transportadora</Button>
          )
        }
      />

      {/* Subabas: Cadastro e Completude de Dados */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {([
          { id: "cadastro" as const, texto: "Cadastro" },
          { id: "completude" as const, texto: "Completude de Dados" },
        ]).map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaPrincipal(aba.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              abaPrincipal === aba.id
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {aba.texto}
          </button>
        ))}
      </div>

      {abaPrincipal === "completude" ? (
        <CompletudeTransportadoras />
      ) : (
      <>
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" /><Input className="pl-9" placeholder="Buscar transportadora..." value={search} onChange={e => setSearch(e.target.value)} /></div>
        <div className="flex gap-1">
          {MODAIS_FILTRO.map(f => (
            <button key={String(f.id)} onClick={() => setModalFiltro(f.id)} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${modalFiltro === f.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{f.label}</button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-20 text-gray-400"><Truck className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Nenhuma transportadora encontrada.</p></div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {lista.map(t => <TransportadoraCard key={t.id} t={t} onClick={() => { setSelectedId(t.id); setMode("view"); }} />)}
        </div>
      )}
      </>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova Transportadora</DialogTitle></DialogHeader>
          <TransportadoraForm onSave={handleSave} onCancel={() => setShowNew(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
