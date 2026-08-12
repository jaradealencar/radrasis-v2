import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Truck, Calendar, DollarSign, Search, TrendingUp, Package , Home } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

type CteRow = {
  id: number;
  numeroCte: string;
  transportadoraId: number | null;
  transportadoraNome: string | null;
  valor: string | null;
  dataEmissao: Date | null;
  remetente: string | null;
  destinatario: string | null;
  municipioDestino: string | null;
  estadoDestino: string | null;
  rawData: string | null;
  createdAt: Date;
};

function NovoCteDialog({ onSuccess, transportadoras }: { onSuccess: () => void; transportadoras: any[] }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    numeroCte: "",
    transportadoraId: "",
    valor: "",
    dataEmissao: "",
    remetente: "Letreiros Express",
    destinatario: "",
    municipioDestino: "",
    estadoDestino: "",
  });

  const create = trpc.cte.create.useMutation({
    onSuccess: () => {
      onSuccess();
      setOpen(false);
      toast.success("CT-e registrado com sucesso!");
      setForm({ numeroCte: "", transportadoraId: "", valor: "", dataEmissao: "", remetente: "Letreiros Express", destinatario: "", municipioDestino: "", estadoDestino: "" });
    },
    onError: (e: { message?: string }) => toast.error(e.message ?? "Erro ao registrar CT-e"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" />Registrar CT-e</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Registrar Conhecimento de Transporte</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Número do CT-e *</Label>
              <Input value={form.numeroCte} onChange={e => setForm(p => ({ ...p, numeroCte: e.target.value }))} placeholder="Ex: CTE-2026-001234" />
            </div>
            <div className="col-span-2">
              <Label>Transportadora</Label>
              <Select value={form.transportadoraId} onValueChange={v => setForm(p => ({ ...p, transportadoraId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar transportadora" /></SelectTrigger>
                <SelectContent>
                  {transportadoras.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor do Frete (R$)</Label>
              <Input value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} placeholder="Ex: 350,00" />
            </div>
            <div>
              <Label>Data de Emissão</Label>
              <Input type="date" value={form.dataEmissao} onChange={e => setForm(p => ({ ...p, dataEmissao: e.target.value }))} />
            </div>
            <div>
              <Label>Destinatário</Label>
              <Input value={form.destinatario} onChange={e => setForm(p => ({ ...p, destinatario: e.target.value }))} placeholder="Nome do cliente" />
            </div>
            <div>
              <Label>Município Destino</Label>
              <Input value={form.municipioDestino} onChange={e => setForm(p => ({ ...p, municipioDestino: e.target.value }))} placeholder="Cidade" />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.estadoDestino} onChange={e => setForm(p => ({ ...p, estadoDestino: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="UF" maxLength={2} />
            </div>

          </div>
          <Button
            className="w-full"
            disabled={!form.numeroCte || create.isPending}
            onClick={() => create.mutate({
              numeroCte: form.numeroCte,
              transportadoraId: form.transportadoraId ? parseInt(form.transportadoraId) : undefined,
              valor: form.valor || undefined,
              dataEmissao: form.dataEmissao || undefined,
              remetente: form.remetente || undefined,
              destinatario: form.destinatario || undefined,
              municipioDestino: form.municipioDestino || undefined,
              estadoDestino: form.estadoDestino || undefined,
            })}
          >
            {create.isPending ? "Registrando..." : "Registrar CT-e"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ImportarCte() {
  const [search, setSearch] = useState("");
  const [mesFilter, setMesFilter] = useState("todos");

  const { data: ctes = [], isLoading, refetch } = trpc.cte.list.useQuery({});
  const { data: transportadoras = [] } = trpc.transportadoras.list.useQuery({ apenasAtivas: false });
  const { data: stats } = trpc.cte.stats.useQuery();

  const meses = ["todos", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  const mesLabels: Record<string, string> = {
    todos: "Todos os meses", "01": "Janeiro", "02": "Fevereiro", "03": "Março",
    "04": "Abril", "05": "Maio", "06": "Junho", "07": "Julho", "08": "Agosto",
    "09": "Setembro", "10": "Outubro", "11": "Novembro", "12": "Dezembro",
  };

  const filtered = (ctes as CteRow[]).filter(c => {
    const matchSearch = !search || [c.numeroCte, c.transportadoraNome, c.destinatario, c.municipioDestino].some(
      f => f?.toLowerCase().includes(search.toLowerCase())
    );
    const matchMes = mesFilter === "todos" || (c.dataEmissao && new Date(c.dataEmissao).toISOString().slice(5, 7) === mesFilter);
    return matchSearch && matchMes;
  });

  const totalValor = filtered.reduce((acc, c) => acc + parseFloat((c.valor ?? "0").replace(",", ".")), 0);

  if (isLoading) {
    return <div className="p-6"><div className="h-8 bg-muted animate-pulse rounded w-48" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Barra de navegação */}
      <div className="flex items-center px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      {/* Header */}
      <PageHeader
        title="Conhecimentos de Transporte (CT-e)"
        description="Registro e acompanhamento de CT-es emitidos"
        icon={FileText}
        actions={<NovoCteDialog onSuccess={refetch} transportadoras={transportadoras} />}
      />

      {/* Cards de resumo */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><FileText className="w-4 h-4" />Total CT-es</div>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="w-4 h-4" />Valor Total</div>
              <p className="text-2xl font-bold">R$ {(stats.totalValor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="w-4 h-4" />Ticket Médio</div>
              <p className="text-2xl font-bold">R$ {stats.total > 0 ? ((stats.totalValor ?? 0) / stats.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0,00"}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Truck className="w-4 h-4" />Transportadoras</div>
              <p className="text-2xl font-bold">{stats.porTransportadora?.length ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por número, transportadora, destinatário..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={mesFilter} onValueChange={setMesFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {meses.map(m => <SelectItem key={m} value={m}>{mesLabels[m]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Resumo filtrado */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{filtered.length} CT-e(s) encontrado(s)</span>
          <span>Valor total: <strong className="text-foreground">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
        </div>
      )}

      {/* Lista de CT-es */}
      {filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><FileText /></EmptyMedia>
            <EmptyTitle>Nenhum CT-e encontrado</EmptyTitle>
            <EmptyDescription>Registre o primeiro CT-e clicando em "Registrar CT-e"</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {filtered.map((cte) => (
            <Card key={cte.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-50 rounded-lg shrink-0">
                      <FileText className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{cte.numeroCte}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        {cte.transportadoraNome && (
                          <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{cte.transportadoraNome}</span>
                        )}
                        {cte.destinatario && (
                          <span className="flex items-center gap-1"><Package className="w-3 h-3" />{cte.destinatario}</span>
                        )}
                        {cte.municipioDestino && (
                          <span>{cte.municipioDestino}/{cte.estadoDestino}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-right">
            {cte.valor && (
              <div>
                <p className="font-bold text-sm">R$ {cte.valor}</p>
              </div>
            )}
                    {cte.dataEmissao && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {new Date(cte.dataEmissao).toLocaleDateString("pt-BR")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Ranking por transportadora */}
      {stats?.porTransportadora && stats.porTransportadora.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4" />Ranking por Transportadora</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.porTransportadora.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="w-6 h-6 flex items-center justify-center text-xs p-0">{i + 1}</Badge>
                    <span>{item.transportadoraNome || "Não identificada"}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{item.total} CT-e(s)</span>
                    <span className="font-medium text-foreground">R$ {(item.totalValor ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
