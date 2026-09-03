import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody,
  TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Target, Clock, AlertTriangle, DollarSign, TrendingUp,
  Wrench, Users, BarChart3, Package, Settings2, Save, CheckCircle2,
  Plus, Trash2, Search, Edit2, ShoppingBag, RefreshCw
} from "lucide-react";
import { Link } from "wouter";

// Converte string/null para número ou null
function toNum(v: string | null | undefined): string {
  if (!v || v === "") return "";
  return String(v);
}

// Seção de meta com ícone, título e descrição
function MetaSection({
  icon: Icon,
  title,
  description,
  color,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-l-4" style={{ borderLeftColor: color }}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: color + "20" }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

// Campo de input com label e hint
function Field({
  label,
  hint,
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1">
        {prefix && <span className="text-sm text-muted-foreground whitespace-nowrap">{prefix}</span>}
        <Input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder ?? "—"}
          className="h-8 text-sm"
        />
        {suffix && <span className="text-sm text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function MetasOperacionais() {
  const [saved, setSaved] = useState(false);
  const anoAtual = new Date().getFullYear();

  const utils = trpc.useUtils();
  const { data: metas, isLoading } = trpc.metasOperacionais.get.useQuery({ ano: anoAtual });
  const upsert = trpc.metasOperacionais.upsert.useMutation({
    onSuccess: () => {
      utils.metasOperacionais.get.invalidate({ ano: anoAtual });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      toast.success("Metas salvas com sucesso!", { description: "As configurações foram atualizadas." });
    },
    onError: (err) => {
      toast.error("Erro ao salvar", { description: err.message });
    },
  });

  // Estado do formulário
  const [form, setForm] = useState<Record<string, string>>({});
  const [formLoaded, setFormLoaded] = useState(false);

  // Inicializa o formulário quando os dados chegam
  if (metas && !formLoaded) {
    setForm({
      metaEntregaNoPrazoPct: toNum(metas.metaEntregaNoPrazoPct),
      metaMaxRetrabalhosMes: metas.metaMaxRetrabalhosMes != null ? String(metas.metaMaxRetrabalhosMes) : "",
      metaMaxRetrabalhoPct: toNum(metas.metaMaxRetrabalhoPct),
      metaFaturamentoMensal: toNum(metas.metaFaturamentoMensal),
      metaFaturamentoAnual: toNum(metas.metaFaturamentoAnual),
      metaLucratividadePct: toNum(metas.metaLucratividadePct),
      metaLucratividadeValor: toNum(metas.metaLucratividadeValor),
      metaLucratividadeAnual: toNum((metas as any).metaLucratividadeAnual),
      metaMetrosSoldadosMes: metas.metaMetrosSoldadosMes != null ? String(metas.metaMetrosSoldadosMes) : "",
      metaCapacidadeSoldaMin: metas.metaCapacidadeSoldaMin != null ? String(metas.metaCapacidadeSoldaMin) : "",
      metaCapacidadeSoldaMax: metas.metaCapacidadeSoldaMax != null ? String(metas.metaCapacidadeSoldaMax) : "",
      numSoldadores: (metas as any).numSoldadores != null ? String((metas as any).numSoldadores) : "",
      metaMediaSoldaPorSoldador: toNum((metas as any).metaMediaSoldaPorSoldador),
      metaMaxPrejuizoRetrabalhoMes: toNum(metas.metaMaxPrejuizoRetrabalhoMes),
      metaMaxPrejuizoRetrabalhoPct: toNum(metas.metaMaxPrejuizoRetrabalhoPct),
      metaOsPorColaboradorDia: toNum(metas.metaOsPorColaboradorDia),
      metaRetrabalhosPorColaboradorMes: metas.metaRetrabalhosPorColaboradorMes != null ? String(metas.metaRetrabalhosPorColaboradorMes) : "",
      metaTicketMedio: toNum(metas.metaTicketMedio),
      metaOsGeradasMes: (metas as any).metaOsGeradasMes != null ? String((metas as any).metaOsGeradasMes) : "",
      metaMaxMetrosTerceirizadosMes: metas.metaMaxMetrosTerceirizadosMes != null ? String(metas.metaMaxMetrosTerceirizadosMes) : "",
      metaMaxPercTerceirizacao: toNum(metas.metaMaxPercTerceirizacao),
      observacoes: metas.observacoes ?? "",
    });
    setFormLoaded(true);
  }

  const set = (key: string) => (v: string) => setForm(f => ({ ...f, [key]: v }));

  const handleSave = () => {
    const toDecimal = (v: string) => v.trim() !== "" ? v.replace(",", ".") : null;
    const toInt = (v: string) => v.trim() !== "" ? parseInt(v.replace(/\D/g, ""), 10) || null : null;

    upsert.mutate({
      id: metas?.id,
      anoVigencia: anoAtual,
      metaEntregaNoPrazoPct: toDecimal(form.metaEntregaNoPrazoPct ?? ""),
      metaMaxRetrabalhosMes: toInt(form.metaMaxRetrabalhosMes ?? ""),
      metaMaxRetrabalhoPct: toDecimal(form.metaMaxRetrabalhoPct ?? ""),
      metaFaturamentoMensal: toDecimal(form.metaFaturamentoMensal ?? ""),
      metaFaturamentoAnual: toDecimal(form.metaFaturamentoAnual ?? ""),
      metaLucratividadePct: toDecimal(form.metaLucratividadePct ?? ""),
      metaLucratividadeValor: toDecimal(form.metaLucratividadeValor ?? ""),
      metaLucratividadeAnual: toDecimal(form.metaLucratividadeAnual ?? ""),
      metaMetrosSoldadosMes: toInt(form.metaMetrosSoldadosMes ?? ""),
      metaCapacidadeSoldaMin: toInt(form.metaCapacidadeSoldaMin ?? ""),
      metaCapacidadeSoldaMax: toInt(form.metaCapacidadeSoldaMax ?? ""),
      numSoldadores: toInt(form.numSoldadores ?? ""),
      metaMediaSoldaPorSoldador: toDecimal(form.metaMediaSoldaPorSoldador ?? ""),
      metaMaxPrejuizoRetrabalhoMes: toDecimal(form.metaMaxPrejuizoRetrabalhoMes ?? ""),
      metaMaxPrejuizoRetrabalhoPct: toDecimal(form.metaMaxPrejuizoRetrabalhoPct ?? ""),
      metaOsPorColaboradorDia: toDecimal(form.metaOsPorColaboradorDia ?? ""),
      metaRetrabalhosPorColaboradorMes: toInt(form.metaRetrabalhosPorColaboradorMes ?? ""),
      metaTicketMedio: toDecimal(form.metaTicketMedio ?? ""),
      metaOsGeradasMes: toInt(form.metaOsGeradasMes ?? ""),
      metaMaxMetrosTerceirizadosMes: toInt(form.metaMaxMetrosTerceirizadosMes ?? ""),
      metaMaxPercTerceirizacao: toDecimal(form.metaMaxPercTerceirizacao ?? ""),
      observacoes: form.observacoes || null,
      ativo: true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Settings2 className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold">Configurações de Metas</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Defina as metas operacionais para <Badge variant="outline">{anoAtual}</Badge>. Elas serão usadas como referência em todos os painéis de performance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/operacoes/performance">
            <Button variant="outline" size="sm">
              ← Voltar ao Painel
            </Button>
          </Link>
          <Button onClick={handleSave} disabled={upsert.isPending} className="gap-2">
            {saved ? (
              <><CheckCircle2 className="w-4 h-4" /> Salvo!</>
            ) : upsert.isPending ? (
              <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Salvando...</>
            ) : (
              <><Save className="w-4 h-4" /> Salvar Metas</>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="operacionais">
        <TabsList className="mb-4">
          <TabsTrigger value="operacionais">
            <Target className="w-3.5 h-3.5 mr-1" />
            Metas Operacionais
          </TabsTrigger>
          <TabsTrigger value="produtos">
            <ShoppingBag className="w-3.5 h-3.5 mr-1" />
            Metas de Produtos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operacionais" className="space-y-6">

      <Separator />

      {/* 1. Entrega no Prazo */}
      <MetaSection
        icon={Clock}
        title="1. Pedidos Entregues no Prazo"
        description="Percentual mínimo de pedidos entregues dentro do prazo acordado com o cliente."
        color="#3b82f6"
      >
        <Field
          label="Meta mínima de entrega no prazo"
          hint="Percentual de pedidos entregues dentro do prazo. Ex: 90"
          value={form.metaEntregaNoPrazoPct ?? ""}
          onChange={set("metaEntregaNoPrazoPct")}
          suffix="%"
          placeholder="90"
        />
      </MetaSection>

      {/* 2. Retrabalhos */}
      <MetaSection
        icon={AlertTriangle}
        title="2. Número de Retrabalhos"
        description="Limite máximo de retrabalhos por mês, em quantidade absoluta e percentual sobre o número de pedidos."
        color="#f97316"
      >
        <Field
          label="Máximo de retrabalhos por mês"
          hint="Quantidade absoluta máxima permitida. Ex: 20"
          value={form.metaMaxRetrabalhosMes ?? ""}
          onChange={set("metaMaxRetrabalhosMes")}
          placeholder="20"
        />
        <Field
          label="Taxa máxima de retrabalho (% sobre pedidos)"
          hint="% máximo de retrabalhos em relação ao número total de pedidos. Ex: 5"
          value={form.metaMaxRetrabalhoPct ?? ""}
          onChange={set("metaMaxRetrabalhoPct")}
          suffix="% dos pedidos"
          placeholder="5"
        />
      </MetaSection>

      {/* 3. Faturamento */}
      <MetaSection
        icon={DollarSign}
        title="3. Faturamento"
        description="Metas de faturamento mensal e anual da empresa."
        color="#22c55e"
      >
        <Field
          label="Meta de faturamento mensal"
          hint="Valor em R$ sem formatação. Ex: 425000"
          value={form.metaFaturamentoMensal ?? ""}
          onChange={set("metaFaturamentoMensal")}
          prefix="R$"
          placeholder="425000"
        />
        <Field
          label="Meta de faturamento anual"
          hint="Valor em R$ sem formatação. Ex: 5100000"
          value={form.metaFaturamentoAnual ?? ""}
          onChange={set("metaFaturamentoAnual")}
          prefix="R$"
          placeholder="5100000"
        />
      </MetaSection>

      {/* 4. Lucratividade */}
      <MetaSection
        icon={TrendingUp}
        title="4. Lucratividade"
        description="Margem líquida mínima calculada em % sobre o faturamento, valor absoluto de lucro esperado por mês e meta anual."
        color="#8b5cf6"
      >
        <Field
          label="Margem de lucratividade mínima (% do faturamento)"
          hint="Percentual mínimo de lucro sobre o faturamento. Ex: 15 significa 15% do faturamento"
          value={form.metaLucratividadePct ?? ""}
          onChange={set("metaLucratividadePct")}
          suffix="% do fat."
          placeholder="15"
        />
        <Field
          label="Lucro mínimo mensal"
          hint="Valor mínimo de lucro em R$ por mês. Ex: 63750"
          value={form.metaLucratividadeValor ?? ""}
          onChange={set("metaLucratividadeValor")}
          prefix="R$"
          placeholder="63750"
        />
        <Field
          label="Meta de lucratividade anual"
          hint="Valor total de lucro esperado no ano em R$. Ex: 765000"
          value={form.metaLucratividadeAnual ?? ""}
          onChange={set("metaLucratividadeAnual")}
          prefix="R$"
          placeholder="765000"
        />
      </MetaSection>

      {/* 5. Metros Soldados */}
      <MetaSection
        icon={Wrench}
        title="5. Metros Soldados"
        description="Capacidade de produção interna de solda: média por soldador, número de soldadores, média mensal e meta."
        color="#ef4444"
      >
        <Field
          label="Média de solda por soldador (m)"
          hint="Produção média esperada por soldador em metros/mês. Ex: 500"
          value={form.metaMediaSoldaPorSoldador ?? ""}
          onChange={set("metaMediaSoldaPorSoldador")}
          suffix="m/soldador"
          placeholder="500"
        />
        <Field
          label="Número de soldadores"
          hint="Quantidade atual de soldadores na equipe. Ex: 4"
          value={form.numSoldadores ?? ""}
          onChange={set("numSoldadores")}
          suffix="soldadores"
          placeholder="4"
        />
        <Field
          label="Meta de metros soldados por mês"
          hint="Produção interna total esperada em metros. Ex: 2000"
          value={form.metaMetrosSoldadosMes ?? ""}
          onChange={set("metaMetrosSoldadosMes")}
          suffix="m/mês"
          placeholder="2000"
        />
        <Field
          label="Capacidade mínima"
          hint="Mínimo operacional em metros/mês. Ex: 1500"
          value={form.metaCapacidadeSoldaMin ?? ""}
          onChange={set("metaCapacidadeSoldaMin")}
          suffix="m"
          placeholder="1500"
        />
        <Field
          label="Capacidade máxima"
          hint="Máximo com horas extras em metros/mês. Ex: 3000"
          value={form.metaCapacidadeSoldaMax ?? ""}
          onChange={set("metaCapacidadeSoldaMax")}
          suffix="m"
          placeholder="3000"
        />
      </MetaSection>

      {/* 6. Custo com Retrabalhos */}
      <MetaSection
        icon={BarChart3}
        title="6. Custo com Retrabalhos"
        description="Média de custo dos retrabalhos e limite máximo de custo gerado por retrabalhos em valor absoluto (R$)."
        color="#dc2626"
      >
        <Field
          label="Média de custo dos retrabalhos"
          hint="Custo médio esperado por retrabalho em R$. Ex: 350"
          value={form.metaMaxPrejuizoRetrabalhoPct ?? ""}
          onChange={set("metaMaxPrejuizoRetrabalhoPct")}
          prefix="R$"
          placeholder="350"
        />
        <Field
          label="Custo máximo total de retrabalhos por mês"
          hint="Valor máximo tolerado em R$ por mês. Ex: 10000"
          value={form.metaMaxPrejuizoRetrabalhoMes ?? ""}
          onChange={set("metaMaxPrejuizoRetrabalhoMes")}
          prefix="R$"
          placeholder="10000"
        />
      </MetaSection>

      {/* 7. Ticket Médio */}
      <MetaSection
        icon={Target}
        title="7. Ticket Médio"
        description="Valor médio esperado por pedido (faturamento ÷ número de pedidos)."
        color="#f59e0b"
      >
        <Field
          label="Meta de ticket médio por pedido"
          hint="Valor médio esperado por OS/pedido em R$. Ex: 3000"
          value={form.metaTicketMedio ?? ""}
          onChange={set("metaTicketMedio")}
          prefix="R$"
          placeholder="3000"
        />
      </MetaSection>

      {/* 10. OS Criadas por Mês */}
      <MetaSection
        icon={BarChart3}
        title="10. OS Criadas por Mês"
        description="Meta de número de Ordens de Serviço criadas por mês. Usada como referência no comparativo de indicadores e no painel de performance."
        color="#14b8a6"
      >
        <Field
          label="Meta de OS criadas por mês"
          hint="Número mínimo de OS esperadas por mês. Ex: 150"
          value={form.metaOsGeradasMes ?? ""}
          onChange={set("metaOsGeradasMes")}
          suffix="OS/mês"
          placeholder="150"
        />
      </MetaSection>

      {/* 8. Metros Terceirizados */}
      <MetaSection
        icon={Package}
        title="8. Metros Terceirizados"
        description="Limite de terceirização de solda por mês, em metros e percentual da demanda total."
        color="#6366f1"
      >
        <Field
          label="Máximo de metros terceirizados/mês"
          hint="Limite de terceirização em metros. Ex: 1000"
          value={form.metaMaxMetrosTerceirizadosMes ?? ""}
          onChange={set("metaMaxMetrosTerceirizadosMes")}
          suffix="m"
          placeholder="1000"
        />
        <Field
          label="Percentual máximo de terceirização"
          hint="% máximo da demanda total que pode ser terceirizado. Ex: 30"
          value={form.metaMaxPercTerceirizacao ?? ""}
          onChange={set("metaMaxPercTerceirizacao")}
          suffix="%"
          placeholder="30"
        />
      </MetaSection>

      {/* 9. Desempenho por Colaborador */}
      <MetaSection
        icon={Users}
        title="9. Desempenho por Colaborador"
        description="Produtividade esperada por colaborador e limite de retrabalhos individuais."
        color="#0ea5e9"
      >
        <Field
          label="OS por colaborador por dia"
          hint="Produtividade diária esperada. Ex: 3.5"
          value={form.metaOsPorColaboradorDia ?? ""}
          onChange={set("metaOsPorColaboradorDia")}
          suffix="OS/dia"
          placeholder="3.5"
        />
        <Field
          label="Máx. retrabalhos por colaborador/mês"
          hint="Limite de retrabalhos individuais antes de acionar plano de ação. Ex: 3"
          value={form.metaRetrabalhosPorColaboradorMes ?? ""}
          onChange={set("metaRetrabalhosPorColaboradorMes")}
          suffix="retrab."
          placeholder="3"
        />
      </MetaSection>

      {/* Observações */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Observações Gerais</CardTitle>
          <CardDescription className="text-xs">Notas adicionais sobre as metas deste período.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.observacoes ?? ""}
            onChange={e => set("observacoes")(e.target.value)}
            placeholder="Ex: Metas revisadas em reunião de diretoria de 01/01/2026. Considerar sazonalidade no 2º semestre..."
            rows={3}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {/* Botão de salvar inferior */}
      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={upsert.isPending} size="lg" className="gap-2">
          {saved ? (
            <><CheckCircle2 className="w-4 h-4" /> Metas Salvas!</>
          ) : upsert.isPending ? (
            <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Salvando...</>
          ) : (
            <><Save className="w-4 h-4" /> Salvar Todas as Metas</>
          )}
        </Button>
      </div>

        </TabsContent>

        <TabsContent value="produtos">
          <MetasProdutosTab />
        </TabsContent>

      </Tabs>
    </div>
  );
}

// ─── Aba de Metas de Produtos ─────────────────────────────────────────────────────────
function MetasProdutosTab() {
  const utils = trpc.useUtils();
  const { data: metasList, isLoading: loadingMetas } = trpc.metaProdutos.list.useQuery();
  const deleteMeta = trpc.metaProdutos.delete.useMutation({
    onSuccess: () => { utils.metaProdutos.list.invalidate(); toast.success("Produto removido"); },
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<{ id?: number; nomeProduto: string; codigoProduto: string; metaParticipacaoPct: string; observacao: string } | null>(null);

  // Busca de produtos do ERP
  const [buscaERP, setBuscaERP] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState("");
  const { data: erpData, isLoading: loadingERP, refetch: buscarERP } = trpc.performanceAbc.getProdutosERP.useQuery(
    { busca: buscaAtiva },
    { enabled: false }
  );

  const upsert = trpc.metaProdutos.upsert.useMutation({
    onSuccess: () => {
      utils.metaProdutos.list.invalidate();
      setModalOpen(false);
      setEditItem(null);
      toast.success(editItem?.id ? "Produto atualizado" : "Produto adicionado");
    },
    onError: (e) => toast.error("Erro", { description: e.message }),
  });

  const handleBuscar = () => {
    setBuscaAtiva(buscaERP);
    setTimeout(() => buscarERP(), 100);
  };

  const handleSelecionarERP = (prod: { id: string; nome: string; codigo: string }) => {
    setEditItem({ nomeProduto: prod.nome, codigoProduto: prod.codigo, metaParticipacaoPct: "", observacao: "" });
    setModalOpen(true);
  };

  const handleSalvar = () => {
    if (!editItem) return;
    const pct = parseFloat(editItem.metaParticipacaoPct);
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error("Meta deve ser entre 0 e 100%");
      return;
    }
    upsert.mutate({
      id: editItem.id,
      nomeProduto: editItem.nomeProduto,
      codigoProduto: editItem.codigoProduto || undefined,
      metaParticipacaoPct: pct,
      observacao: editItem.observacao || undefined,
    });
  };

  const totalMeta = (metasList ?? []).reduce((s, m) => s + parseFloat(String(m.metaParticipacaoPct ?? 0)), 0);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da aba */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-indigo-600" />
            Metas de Participação de Produtos
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina quais produtos devem aumentar sua participação no faturamento e qual a meta percentual para cada um.
          </p>
        </div>
        <Button onClick={() => { setEditItem({ nomeProduto: "", codigoProduto: "", metaParticipacaoPct: "", observacao: "" }); setModalOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" /> Adicionar Produto
        </Button>
      </div>

      {/* Busca no ERP */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Search className="w-4 h-4" /> Buscar Produto no ERP (Mubisys)
          </CardTitle>
          <CardDescription className="text-xs">Pesquise na base de produtos cadastrados no ERP para adicionar à lista de monitoramento.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-3">
            <Input
              placeholder="Ex: Letreiro Frontlight..."
              value={buscaERP}
              onChange={e => setBuscaERP(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleBuscar()}
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={handleBuscar} disabled={loadingERP} className="gap-1">
              {loadingERP ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              Buscar
            </Button>
          </div>
          {erpData && erpData.produtos.length === 0 && (
            <p className="text-xs text-muted-foreground">Nenhum produto encontrado. Tente outro termo.</p>
          )}
          {erpData && erpData.produtos.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table className="text-xs">
                <TableHeader><TableRow className="bg-muted/50">
                  <TableHead>Produto</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead></TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {erpData.produtos.slice(0, 20).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="py-1.5 font-medium">{p.nome}</TableCell>
                      <TableCell className="py-1.5 text-muted-foreground">{p.codigo}</TableCell>
                      <TableCell className="py-1.5 text-muted-foreground">{p.categoria || "—"}</TableCell>
                      <TableCell className="py-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs px-2"
                          onClick={() => handleSelecionarERP(p)}
                        >
                          + Adicionar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de produtos monitorados */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600" />
              Produtos Monitorados
            </CardTitle>
            {metasList && metasList.length > 0 && (
              <Badge variant={totalMeta > 100 ? "destructive" : totalMeta === 100 ? "default" : "outline"}>
                Total: {totalMeta.toFixed(1)}%
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">Produtos com metas de participação definidas. Acompanhe a evolução na Curva ABC → Evolução Mensal.</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingMetas ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : !metasList || metasList.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon"><ShoppingBag /></EmptyMedia>
                <EmptyTitle>Nenhum produto monitorado ainda.</EmptyTitle>
                <EmptyDescription>Busque um produto no ERP acima ou clique em "Adicionar Produto".</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Código</TableHead>
                <TableHead className="text-right">Meta %</TableHead>
                <TableHead className="pl-4">Observação</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {metasList.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.nomeProduto}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{m.codigoProduto || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className="font-mono">{parseFloat(String(m.metaParticipacaoPct)).toFixed(1)}%</Badge>
                    </TableCell>
                    <TableCell className="pl-4 text-xs text-muted-foreground max-w-[200px] truncate">{m.observacao || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0"
                          onClick={() => {
                            setEditItem({
                              id: m.id,
                              nomeProduto: m.nomeProduto,
                              codigoProduto: m.codigoProduto ?? "",
                              metaParticipacaoPct: String(parseFloat(String(m.metaParticipacaoPct))),
                              observacao: m.observacao ?? "",
                            });
                            setModalOpen(true);
                          }}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMeta.mutate({ id: m.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal de edição */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem?.id ? "Editar Produto Monitorado" : "Adicionar Produto Monitorado"}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Nome do Produto</Label>
                <Input
                  value={editItem.nomeProduto}
                  onChange={e => setEditItem(prev => prev ? { ...prev, nomeProduto: e.target.value } : null)}
                  placeholder="Ex: Letreiro Frontlight Galvanizado"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Código ERP (opcional)</Label>
                <Input
                  value={editItem.codigoProduto}
                  onChange={e => setEditItem(prev => prev ? { ...prev, codigoProduto: e.target.value } : null)}
                  placeholder="Código do produto no ERP"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Meta de Participação no Faturamento (%)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={editItem.metaParticipacaoPct}
                    onChange={e => setEditItem(prev => prev ? { ...prev, metaParticipacaoPct: e.target.value } : null)}
                    placeholder="Ex: 35"
                    className="h-8 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
                <p className="text-xs text-muted-foreground">Percentual mínimo que este produto deve representar no faturamento mensal.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observação (opcional)</Label>
                <Textarea
                  value={editItem.observacao}
                  onChange={e => setEditItem(prev => prev ? { ...prev, observacao: e.target.value } : null)}
                  placeholder="Ex: Produto principal — foco em crescimento no Q2"
                  rows={2}
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button onClick={handleSalvar} disabled={upsert.isPending} className="gap-2">
                  {upsert.isPending ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
