import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Lightbulb,
  MessageCircle,
  Star,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
  Target,
  Zap,
  Gift,
  Clock,
  TrendingUp,
  ExternalLink,
  CalendarCheck,
  RefreshCw,
  Plus,
  Trash2,
  BookOpen,
  Camera,
  Sparkles,
  BarChart2,
  UserPlus,
  ShoppingBag,
} from "lucide-react";

// ─── Tipos ────────────────────────────────────────────────────────────────────
type TipoPlano = "conclusao" | "permanente";
type StatusPlano = "pendente" | "em_andamento" | "concluido";

interface PlanoAcao {
  id: number;
  titulo: string;
  descricao: string;
  tipo: TipoPlano;
  status: StatusPlano;
  dataConclusao?: string; // ISO date string, só para tipo="conclusao"
  icone: string;
  cor: string;
}

interface PerfilVendedor {
  nome: string;
  iniciais: string;
  cor: string;
  cargo: string;
  bio: string;
  whatsapp: string;
  linkWhatsapp: string;
  especialidade: string;
}

// ─── Dados iniciais dos planos de ação ──────────────────────────────────────
const PLANOS_INICIAIS: PlanoAcao[] = [
  {
    id: 1,
    titulo: "Atualizar Catálogo Comercial",
    descricao: "Revisar e atualizar o catálogo de produtos e serviços com fotos atuais, preços e especificações técnicas. Garantir que todos os materiais de venda estejam alinhados com o portfólio atual.",
    tipo: "conclusao",
    status: "pendente",
    dataConclusao: "",
    icone: "BookOpen",
    cor: "#6366f1",
  },
  {
    id: 2,
    titulo: "Trocar Foto de Perfil Profissional",
    descricao: "Atualizar a foto de perfil do WhatsApp Business e redes sociais com foto profissional: boa iluminação, fundo neutro e roupa adequada. Padronizar identidade visual da equipe comercial.",
    tipo: "conclusao",
    status: "pendente",
    dataConclusao: "",
    icone: "Camera",
    cor: "#ec4899",
  },
  {
    id: 3,
    titulo: "Implementar Vectorize.ia",
    descricao: "Utilizar a ferramenta Vectorize.ia para vetorização automática de artes e logos dos clientes. Treinar a equipe no uso da ferramenta e integrar ao fluxo de atendimento de orçamentos.",
    tipo: "conclusao",
    status: "pendente",
    dataConclusao: "",
    icone: "Sparkles",
    cor: "#8b5cf6",
  },
  {
    id: 4,
    titulo: "Campanha Foco em Novo Cliente",
    descricao: "Estruturar e lançar campanha específica para captação de novos clientes: definir oferta especial de primeira compra, criar materiais de divulgação e estabelecer meta mensal de conversão de novos clientes.",
    tipo: "conclusao",
    status: "pendente",
    dataConclusao: "",
    icone: "UserPlus",
    cor: "#f59e0b",
  },
  {
    id: 5,
    titulo: "Usar CRM Diariamente com Scripts de Venda",
    descricao: "Registrar todos os contatos e interações no CRM diariamente. Utilizar os scripts de venda disponíveis na aba Campanha Primeira Compra para cada etapa do funil. Meta: zero contatos sem registro no CRM.",
    tipo: "permanente",
    status: "em_andamento",
    icone: "MessageCircle",
    cor: "#22c55e",
  },
  {
    id: 6,
    titulo: "Acompanhamento Diário de Metas e Métricas",
    descricao: "Consultar diariamente o painel de Performance Comercial: verificar cotações do dia, taxa de conversão, faturamento acumulado vs meta e ranking de vendedores. Identificar desvios e agir proativamente.",
    tipo: "permanente",
    status: "em_andamento",
    icone: "BarChart2",
    cor: "#3b82f6",
  },
  {
    id: 7,
    titulo: "Foco em Novo Cliente",
    descricao: "Priorizar diariamente a abordagem de clientes com estrela ⭐ no CRM (nunca compraram). Reservar ao menos 30 minutos por dia para follow-up de novos prospects. Registrar resultado de cada contato.",
    tipo: "permanente",
    status: "em_andamento",
    icone: "ShoppingBag",
    cor: "#f97316",
  },
];

const ICONE_MAP: Record<string, React.ElementType> = {
  BookOpen, Camera, Sparkles, UserPlus, MessageCircle, BarChart2, ShoppingBag,
  Target, Star, CheckCircle2, TrendingUp, Zap, Gift, Clock,
};

const STATUS_LABEL: Record<StatusPlano, string> = {
  pendente: "Pendente",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
};

const STATUS_COR: Record<StatusPlano, string> = {
  pendente: "bg-slate-100 text-slate-600",
  em_andamento: "bg-blue-100 text-blue-700",
  concluido: "bg-green-100 text-green-700",
};

// ─── Componente de Plano de Ação ─────────────────────────────────────────────
function PlanoCard({
  plano,
  onUpdate,
  onDelete,
}: {
  plano: PlanoAcao;
  onUpdate: (p: PlanoAcao) => void;
  onDelete: (id: number) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(plano);
  const Icone = ICONE_MAP[plano.icone] ?? Target;

  const handleSave = () => {
    onUpdate(form);
    setEditando(false);
    toast.success("Plano atualizado!");
  };

  const handleCancel = () => {
    setForm(plano);
    setEditando(false);
  };

  const diasRestantes = plano.tipo === "conclusao" && plano.dataConclusao
    ? Math.ceil((new Date(plano.dataConclusao).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      {/* Barra de cor */}
      <div className="h-1" style={{ background: plano.cor }} />
      <div className="p-4">
        {editando ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Título</label>
              <Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} className="text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Descrição</label>
              <Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="text-sm resize-none" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
                <select
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoPlano }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="conclusao">Data de Conclusão</option>
                  <option value="permanente">Uso Permanente</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as StatusPlano }))}
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="pendente">Pendente</option>
                  <option value="em_andamento">Em Andamento</option>
                  <option value="concluido">Concluído</option>
                </select>
              </div>
            </div>
            {form.tipo === "conclusao" && (
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1 block">Data de Conclusão</label>
                <Input
                  type="date"
                  value={form.dataConclusao ?? ""}
                  onChange={e => setForm(f => ({ ...f, dataConclusao: e.target.value }))}
                  className="text-sm"
                />
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="gap-1.5 flex-1" onClick={handleSave}>
                <Save size={13} /> Salvar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCancel}>
                <X size={13} /> Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${plano.cor}18` }}
              >
                <Icone size={18} style={{ color: plano.cor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COR[plano.status]}`}>
                    {STATUS_LABEL[plano.status]}
                  </span>
                  {plano.tipo === "permanente" ? (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                      <RefreshCw size={9} /> Uso Permanente
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center gap-1">
                      <CalendarCheck size={9} /> Conclusão
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-slate-800">{plano.titulo}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{plano.descricao}</p>
                {plano.tipo === "conclusao" && plano.dataConclusao && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <CalendarCheck size={12} className={diasRestantes !== null && diasRestantes < 0 ? "text-red-500" : "text-slate-400"} />
                    <span className={`text-xs font-medium ${
                      diasRestantes !== null && diasRestantes < 0
                        ? "text-red-600"
                        : diasRestantes !== null && diasRestantes <= 7
                        ? "text-amber-600"
                        : "text-slate-500"
                    }`}>
                      {new Date(plano.dataConclusao + "T00:00:00").toLocaleDateString("pt-BR")}
                      {diasRestantes !== null && (
                        diasRestantes < 0
                          ? ` — ${Math.abs(diasRestantes)}d em atraso`
                          : diasRestantes === 0
                          ? " — Vence hoje"
                          : ` — ${diasRestantes}d restantes`
                      )}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditando(true)}>
                  <Edit3 size={13} />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={() => onDelete(plano.id)}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Dados iniciais dos vendedores ────────────────────────────────────────────
const VENDEDORES_INICIAIS: PerfilVendedor[] = [
  {
    nome: "Letícia",
    iniciais: "LE",
    cor: "#8b5cf6",
    cargo: "Consultora Comercial",
    bio: "Especialista em comunicação visual e letreiros personalizados. Atendimento ágil e soluções criativas para o seu negócio.",
    whatsapp: "",
    linkWhatsapp: "",
    especialidade: "Letreiros e Fachadas",
  },
  {
    nome: "Carise",
    iniciais: "CA",
    cor: "#ec4899",
    cargo: "Consultora Comercial",
    bio: "Foco em resultados e satisfação do cliente. Transformo sua ideia em um projeto visual impactante.",
    whatsapp: "",
    linkWhatsapp: "",
    especialidade: "Comunicação Visual",
  },
  {
    nome: "Stephanie",
    iniciais: "ST",
    cor: "#0ea5e9",
    cargo: "Consultora Comercial",
    bio: "Comprometida com prazos e qualidade. Seu projeto em boas mãos do orçamento à entrega.",
    whatsapp: "",
    linkWhatsapp: "",
    especialidade: "Projetos Especiais",
  },
];

// ─── Ações da Campanha Primeira Compra ───────────────────────────────────────
const ACOES_CAMPANHA = [
  {
    id: 1,
    fase: "D+1",
    titulo: "Primeiro Contato — WhatsApp",
    descricao: "Enviar mensagem de boas-vindas apresentando a empresa e confirmando o recebimento da cotação.",
    script: `Olá, [NOME]! 😊 Sou [VENDEDORA] da Letreiros Express. Vi que você nos enviou uma solicitação de orçamento — muito obrigada pelo interesse! Preparei uma proposta especial para você. Posso te enviar os detalhes agora?`,
    icone: MessageCircle,
    cor: "#22c55e",
    badge: "Urgente",
    badgeCor: "bg-red-100 text-red-700",
  },
  {
    id: 2,
    fase: "D+3",
    titulo: "Follow-up — Dúvidas e Ajustes",
    descricao: "Verificar se o cliente revisou a proposta e se tem dúvidas. Oferecer ajuste de prazo ou material.",
    script: `Oi, [NOME]! Tudo bem? 😊 Passando para saber se você teve a oportunidade de ver a nossa proposta. Tem alguma dúvida ou algo que gostaria de ajustar? Estou à disposição para personalizar conforme sua necessidade!`,
    icone: Phone,
    cor: "#3b82f6",
    badge: "Importante",
    badgeCor: "bg-blue-100 text-blue-700",
  },
  {
    id: 3,
    fase: "D+5",
    titulo: "Oferta de Valor — Diferencial",
    descricao: "Destacar o diferencial da empresa: qualidade, prazo, garantia. Enviar foto de trabalho similar.",
    script: `[NOME], queria te mostrar um trabalho que fizemos recentemente para uma empresa parecida com a sua! [FOTO] Nossos clientes adoram o resultado. Posso agendar uma visita técnica sem compromisso para entender melhor o seu projeto? 🎯`,
    icone: Star,
    cor: "#f59e0b",
    badge: "Diferencial",
    badgeCor: "bg-amber-100 text-amber-700",
  },
  {
    id: 4,
    fase: "D+7",
    titulo: "Incentivo — Condição Especial",
    descricao: "Oferecer condição especial para primeiro pedido: desconto, prazo diferenciado ou brinde.",
    script: `Oi, [NOME]! Tenho uma novidade para você 🎁 Para clientes que fazem o primeiro pedido esse mês, estamos oferecendo [CONDIÇÃO ESPECIAL]. Essa é uma oportunidade única — posso reservar para você?`,
    icone: Gift,
    cor: "#ec4899",
    badge: "Oferta",
    badgeCor: "bg-pink-100 text-pink-700",
  },
  {
    id: 5,
    fase: "D+10",
    titulo: "Urgência — Prazo de Produção",
    descricao: "Informar sobre prazo de produção e criar senso de urgência para fechar o pedido.",
    script: `[NOME], queria te avisar que nossa agenda de produção está quase cheia para esse mês! 📅 Se você fechar o pedido até [DATA], consigo garantir a entrega no prazo que você precisa. Posso confirmar?`,
    icone: Clock,
    cor: "#ef4444",
    badge: "Prazo",
    badgeCor: "bg-red-100 text-red-700",
  },
  {
    id: 6,
    fase: "D+15",
    titulo: "Última Tentativa — Reativação",
    descricao: "Mensagem final de reativação. Se não responder, marcar como perdida e registrar motivo.",
    script: `Oi, [NOME]! Sei que você está ocupado(a). Queria fazer uma última tentativa antes de encerrar a proposta. Se o projeto ainda faz sentido para você, estou aqui! Caso tenha mudado de planos, tudo bem — fico à disposição para quando precisar. 😊`,
    icone: Zap,
    cor: "#64748b",
    badge: "Final",
    badgeCor: "bg-slate-100 text-slate-700",
  },
];

// ─── Componente de Ação ───────────────────────────────────────────────────────
function AcaoCard({ acao }: { acao: typeof ACOES_CAMPANHA[0] }) {
  const [expandido, setExpandido] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const Icone = acao.icone;

  const copiarScript = () => {
    navigator.clipboard.writeText(acao.script).then(() => {
      setCopiado(true);
      toast.success("Script copiado!");
      setTimeout(() => setCopiado(false), 2000);
    });
  };

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white hover:shadow-sm transition-shadow">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={() => setExpandido(!expandido)}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${acao.cor}18` }}
        >
          <Icone size={18} style={{ color: acao.cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{acao.fase}</span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${acao.badgeCor}`}>{acao.badge}</span>
          </div>
          <p className="text-sm font-semibold text-slate-800 truncate">{acao.titulo}</p>
        </div>
        <div className="flex-shrink-0 text-slate-400">
          {expandido ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>
      {expandido && (
        <div className="px-4 pb-4 border-t border-slate-100">
          <p className="text-sm text-slate-600 mt-3 mb-3">{acao.descricao}</p>
          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Script sugerido</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={copiarScript}
              >
                {copiado ? <CheckCircle2 size={12} className="text-green-600" /> : <MessageCircle size={12} />}
                {copiado ? "Copiado!" : "Copiar"}
              </Button>
            </div>
            <p className="text-sm text-slate-700 italic leading-relaxed">{acao.script}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente de Perfil do Vendedor ────────────────────────────────────────
function PerfilCard({ perfil, onSave }: { perfil: PerfilVendedor; onSave: (p: PerfilVendedor) => void }) {
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(perfil);

  const handleSave = () => {
    // Gerar link WhatsApp automaticamente se número preenchido
    const numero = form.whatsapp.replace(/\D/g, "");
    const link = numero ? `https://wa.me/55${numero}` : "";
    const updated = { ...form, linkWhatsapp: link };
    onSave(updated);
    setEditando(false);
    toast.success(`Perfil de ${perfil.nome} salvo!`);
  };

  const handleCancel = () => {
    setForm(perfil);
    setEditando(false);
  };

  return (
    <Card className="overflow-hidden border-slate-200">
      <div className="h-2" style={{ background: perfil.cor }} />
      <CardContent className="p-5">
        {/* Avatar e nome */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
            style={{ background: perfil.cor }}
          >
            {perfil.iniciais}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800 text-base">{perfil.nome}</h3>
            <p className="text-xs text-slate-500">{perfil.cargo}</p>
            <Badge variant="outline" className="mt-1 text-[10px] px-2 py-0">
              {perfil.especialidade}
            </Badge>
          </div>
          {!editando && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 flex-shrink-0"
              onClick={() => setEditando(true)}
            >
              <Edit3 size={14} />
            </Button>
          )}
        </div>

        {editando ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Bio / Apresentação</label>
              <Textarea
                value={form.bio}
                onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                className="text-sm resize-none"
                rows={3}
                placeholder="Escreva uma apresentação para o perfil do WhatsApp..."
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">WhatsApp (somente números)</label>
              <Input
                value={form.whatsapp}
                onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))}
                placeholder="11999999999"
                className="text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Especialidade</label>
              <Input
                value={form.especialidade}
                onChange={e => setForm(f => ({ ...f, especialidade: e.target.value }))}
                placeholder="Ex: Letreiros e Fachadas"
                className="text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="gap-1.5 flex-1" onClick={handleSave}>
                <Save size={13} /> Salvar
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleCancel}>
                <X size={13} /> Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 leading-relaxed">{perfil.bio}</p>
            <Separator />
            {perfil.whatsapp ? (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={14} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">WhatsApp</p>
                  <p className="text-sm font-medium text-slate-700">{perfil.whatsapp}</p>
                </div>
                {perfil.linkWhatsapp && (
                  <a
                    href={perfil.linkWhatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0"
                  >
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 text-green-700 border-green-200 hover:bg-green-50">
                      <ExternalLink size={11} /> Abrir
                    </Button>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-slate-400">
                <Phone size={14} />
                <span className="text-xs italic">WhatsApp não cadastrado — clique em editar</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────
export default function PlanosAcaoComercial() {
  const [perfis, setPerfis] = useState<PerfilVendedor[]>(VENDEDORES_INICIAIS);
  const [abaAtiva, setAbaAtiva] = useState<"planos" | "campanha" | "perfis">("planos");
  const [planos, setPlanos] = useState<PlanoAcao[]>(PLANOS_INICIAIS);
  const [adicionandoPlano, setAdicionandoPlano] = useState(false);
  const [novoPlano, setNovoPlano] = useState<Omit<PlanoAcao, "id">>({ titulo: "", descricao: "", tipo: "conclusao", status: "pendente", dataConclusao: "", icone: "Target", cor: "#6366f1" });

  const handleAdicionarPlano = () => {
    if (!novoPlano.titulo.trim()) { toast.error("Informe o título do plano."); return; }
    const id = Math.max(0, ...planos.map(p => p.id)) + 1;
    setPlanos(prev => [...prev, { ...novoPlano, id }]);
    setNovoPlano({ titulo: "", descricao: "", tipo: "conclusao", status: "pendente", dataConclusao: "", icone: "Target", cor: "#6366f1" });
    setAdicionandoPlano(false);
    toast.success("Plano adicionado!");
  };

  // Buscar clientes novos do mês atual para exibir contexto
  const now = new Date();
  const { data: clientesNovos } = trpc.performanceComercial.getClientesNovos.useQuery({
    mes: now.getMonth() + 1,
    ano: now.getFullYear(),
  });

  const handleAtualizarPlano = (planoAtualizado: PlanoAcao) => {
    setPlanos(prev => prev.map(p => p.id === planoAtualizado.id ? planoAtualizado : p));
  };

  const handleDeletarPlano = (id: number) => {
    setPlanos(prev => prev.filter(p => p.id !== id));
    toast.success("Plano removido.");
  };

  const handleSalvarPerfil = (nome: string, perfilAtualizado: PerfilVendedor) => {
    setPerfis(prev => prev.map(p => p.nome === nome ? perfilAtualizado : p));
  };

  return (
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Lightbulb size={24} className="text-amber-500" />
              Planos de Ação Comercial
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Estratégias de abordagem para clientes novos e perfis de contato por vendedora
            </p>
          </div>
          {/* Indicador de clientes novos */}
          {clientesNovos && clientesNovos.total > 0 && (
            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5">
              <TrendingUp size={16} className="text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Clientes Novos este mês</p>
                <p className="text-lg font-bold text-blue-700 leading-none">{clientesNovos.total}</p>
              </div>
            </div>
          )}
        </div>

        {/* Abas */}
        <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          {([
            { key: "planos", label: "Planos de Ação", icon: <CalendarCheck size={15} /> },
            { key: "campanha", label: "Campanha Primeira Compra", icon: <Target size={15} /> },
            { key: "perfis", label: "Perfis WhatsApp", icon: <User size={15} /> },
          ] as const).map(aba => (
            <button
              key={aba.key}
              onClick={() => setAbaAtiva(aba.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                abaAtiva === aba.key
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <span className="flex items-center gap-2">{aba.icon}{aba.label}</span>
            </button>
          ))}
        </div>

        {/* ─── ABA: Planos de Ação ────────────────────────────────────────────── */}
        {abaAtiva === "planos" && (
          <div className="space-y-4">
            {/* Resumo */}
            <div className="grid grid-cols-3 gap-3">
              {([
                { label: "Total", valor: planos.length, cor: "text-slate-700", bg: "bg-slate-50" },
                { label: "Em Andamento", valor: planos.filter(p => p.status === "em_andamento").length, cor: "text-blue-700", bg: "bg-blue-50" },
                { label: "Concluídos", valor: planos.filter(p => p.status === "concluido").length, cor: "text-green-700", bg: "bg-green-50" },
              ] as const).map(kpi => (
                <div key={kpi.label} className={`${kpi.bg} rounded-xl p-3 text-center border border-slate-100`}>
                  <p className={`text-2xl font-bold ${kpi.cor}`}>{kpi.valor}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Seção: Uso Permanente */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw size={15} className="text-purple-600" />
                <h3 className="text-sm font-semibold text-slate-700">Rotinas Permanentes</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {planos.filter(p => p.tipo === "permanente").length} itens
                </span>
              </div>
              <div className="space-y-2">
                {planos.filter(p => p.tipo === "permanente").map(plano => (
                  <PlanoCard key={plano.id} plano={plano} onUpdate={handleAtualizarPlano} onDelete={handleDeletarPlano} />
                ))}
                {planos.filter(p => p.tipo === "permanente").length === 0 && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Nenhuma rotina permanente cadastrada.</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>

            {/* Seção: Data de Conclusão */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CalendarCheck size={15} className="text-amber-600" />
                <h3 className="text-sm font-semibold text-slate-700">Ações com Data de Conclusão</h3>
                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {planos.filter(p => p.tipo === "conclusao").length} itens
                </span>
              </div>
              <div className="space-y-2">
                {planos.filter(p => p.tipo === "conclusao").map(plano => (
                  <PlanoCard key={plano.id} plano={plano} onUpdate={handleAtualizarPlano} onDelete={handleDeletarPlano} />
                ))}
                {planos.filter(p => p.tipo === "conclusao").length === 0 && (
                  <Empty>
                    <EmptyHeader>
                      <EmptyTitle>Nenhuma ação com prazo cadastrada.</EmptyTitle>
                    </EmptyHeader>
                  </Empty>
                )}
              </div>
            </div>

            {/* Adicionar novo plano */}
            {adicionandoPlano ? (
              <Card className="border-slate-200">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-700">Novo Plano de Ação</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Título *</label>
                    <Input value={novoPlano.titulo} onChange={e => setNovoPlano(f => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Criar proposta de parceria" className="text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Descrição</label>
                    <Textarea value={novoPlano.descricao} onChange={e => setNovoPlano(f => ({ ...f, descricao: e.target.value }))} className="text-sm resize-none" rows={2} placeholder="Descreva o objetivo e como executar..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Tipo</label>
                      <select value={novoPlano.tipo} onChange={e => setNovoPlano(f => ({ ...f, tipo: e.target.value as TipoPlano }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                        <option value="conclusao">Data de Conclusão</option>
                        <option value="permanente">Uso Permanente</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Status</label>
                      <select value={novoPlano.status} onChange={e => setNovoPlano(f => ({ ...f, status: e.target.value as StatusPlano }))} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white">
                        <option value="pendente">Pendente</option>
                        <option value="em_andamento">Em Andamento</option>
                        <option value="concluido">Concluído</option>
                      </select>
                    </div>
                  </div>
                  {novoPlano.tipo === "conclusao" && (
                    <div>
                      <label className="text-xs font-medium text-slate-600 mb-1 block">Data de Conclusão</label>
                      <Input type="date" value={novoPlano.dataConclusao ?? ""} onChange={e => setNovoPlano(f => ({ ...f, dataConclusao: e.target.value }))} className="text-sm" />
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" className="gap-1.5 flex-1" onClick={handleAdicionarPlano}>
                      <Save size={13} /> Adicionar
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAdicionandoPlano(false)}>
                      <X size={13} /> Cancelar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Button variant="outline" className="w-full gap-2 border-dashed" onClick={() => setAdicionandoPlano(true)}>
                <Plus size={15} /> Adicionar Plano de Ação
              </Button>
            )}
          </div>
        )}

        {/* ─── ABA: Campanha Primeira Compra ─────────────────────────────────── */}
        {abaAtiva === "campanha" && (
          <div className="space-y-4">
            {/* Contexto */}
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Star size={16} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-amber-800 mb-1">Sobre a Campanha</h3>
                    <p className="text-sm text-amber-700 leading-relaxed">
                      Clientes com a estrela <strong>⭐</strong> no CRM nunca realizaram uma compra. 
                      Eles representam a maior oportunidade de crescimento da carteira. 
                      Use os scripts abaixo como guia — adapte ao seu estilo e ao contexto de cada cliente.
                    </p>
                    <div className="flex flex-wrap gap-3 mt-3">
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1.5">
                        <CheckCircle2 size={12} />
                        <span>6 etapas de follow-up (D+1 a D+15)</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1.5">
                        <MessageCircle size={12} />
                        <span>Scripts prontos para copiar</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 rounded-lg px-2.5 py-1.5">
                        <Target size={12} />
                        <span>Alinhado com as faixas do CRM</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline visual */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 bg-white border border-slate-200 rounded-xl p-4">
              {ACOES_CAMPANHA.map((acao, i) => (
                <div key={acao.id} className="flex flex-col items-center gap-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                    style={{ background: acao.cor }}
                  >
                    {acao.fase}
                  </div>
                  <p className="text-[10px] text-slate-500 text-center leading-tight">{acao.titulo.split("—")[0].trim()}</p>
                  {i < ACOES_CAMPANHA.length - 1 && (
                    <div className="hidden sm:block absolute" />
                  )}
                </div>
              ))}
            </div>

            {/* Lista de ações */}
            <div className="space-y-2">
              {ACOES_CAMPANHA.map(acao => (
                <AcaoCard key={acao.id} acao={acao} />
              ))}
            </div>

            {/* Dicas gerais */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Lightbulb size={15} className="text-amber-500" />
                  Dicas Gerais para Clientes Novos
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { titulo: "Personalize sempre", desc: "Use o nome do cliente e mencione o produto específico que ele cotou." },
                    { titulo: "Envie fotos de trabalhos", desc: "Imagens de projetos similares aumentam a confiança e reduzem objeções." },
                    { titulo: "Seja breve no WhatsApp", desc: "Mensagens curtas têm maior taxa de resposta. Guarde detalhes para a ligação." },
                    { titulo: "Registre no CRM", desc: "Marque cada contato na faixa correta para manter o histórico organizado." },
                    { titulo: "Identifique o decisor", desc: "Pergunte se há mais alguém envolvido na decisão de compra." },
                    { titulo: "Ofereça visita técnica", desc: "Para projetos maiores, propor uma visita sem compromisso aumenta o fechamento." },
                  ].map((dica, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg">
                      <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{dica.titulo}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{dica.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── ABA: Perfis WhatsApp ───────────────────────────────────────────── */}
        {abaAtiva === "perfis" && (
          <div className="space-y-4">
            {/* Instrução */}
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MessageCircle size={16} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-blue-800 mb-1">Perfil Profissional no WhatsApp</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      Mantenha o perfil do WhatsApp Business atualizado com foto profissional, bio clara e horário de atendimento. 
                      Clique em <strong>Editar</strong> para personalizar a bio e cadastrar o número de cada vendedora.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cards dos vendedores */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {perfis.map(perfil => (
                <PerfilCard
                  key={perfil.nome}
                  perfil={perfil}
                  onSave={(p) => handleSalvarPerfil(perfil.nome, p)}
                />
              ))}
            </div>

            {/* Boas práticas */}
            <Card className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-green-500" />
                  Boas Práticas — WhatsApp Business
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { titulo: "Foto profissional", desc: "Use foto com boa iluminação, fundo neutro e roupa profissional." },
                    { titulo: "Nome completo + empresa", desc: "Ex: Letícia | Letreiros Express — facilita o cliente identificar quem é." },
                    { titulo: "Bio com proposta de valor", desc: "Mencione o que você faz e como pode ajudar o cliente em 2 linhas." },
                    { titulo: "Horário de atendimento", desc: "Configure no WhatsApp Business: seg-sex 8h-18h. Evita expectativas erradas." },
                    { titulo: "Mensagem automática", desc: "Configure resposta automática para fora do horário com previsão de retorno." },
                    { titulo: "Catálogo de produtos", desc: "Adicione fotos dos principais trabalhos no catálogo do WhatsApp Business." },
                  ].map((dica, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg">
                      <CheckCircle2 size={14} className="text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-slate-700">{dica.titulo}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{dica.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
  );
}
