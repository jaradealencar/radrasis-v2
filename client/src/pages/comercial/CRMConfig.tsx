import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Target, TrendingUp, Save, Tag } from "lucide-react";

const VENDEDORES = [
  "Letícia Carozzo",
  "STHEFANIE LOUIS",
  "Daniel Alencar",
  "Natalia",
  "Isabella",
  "Sarah de Moraes",
  "Karize Boaventura",
  "Joice",
  "Rogério de Almeida",
];

function FaixaEtiquetaForm({ faixa, defaultLabel }: { faixa: 1 | 2 | 3; defaultLabel: string }) {
  const utils = trpc.useUtils();
  const [label, setLabel] = useState(defaultLabel);
  const [saved, setSaved] = useState(false);

  const save = trpc.crm.saveFaixaEtiqueta.useMutation({
    onSuccess: () => {
      toast.success(`Etiqueta da Faixa ${faixa} salva!`);
      setSaved(true);
      utils.crm.getFaixaEtiquetas.invalidate();
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const faixaColors = [
    "",
    "border-yellow-300 bg-yellow-50 text-yellow-800",
    "border-pink-300 bg-pink-50 text-pink-800",
    "border-orange-300 bg-orange-50 text-orange-800",
  ];

  return (
    <div className="flex items-center gap-3 flex-wrap py-3 border-b last:border-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 flex-shrink-0 ${faixaColors[faixa]}`}>
        {faixa}
      </div>
      <Input
        value={label}
        onChange={e => { setLabel(e.target.value); setSaved(false); }}
        placeholder={`Nome da Faixa ${faixa}`}
        className="h-8 text-sm flex-1 min-w-[180px]"
      />
      <Button
        size="sm"
        className="h-8 text-xs gap-1"
        disabled={save.isPending || !label.trim()}
        onClick={() => save.mutate({ faixa, label: label.trim() })}
      >
        <Save className="w-3 h-3" />
        {save.isPending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
      </Button>
    </div>
  );
}

function MetaForm({ vendedor, mes, ano }: { vendedor: string; mes: number; ano: number }) {
  const utils = trpc.useUtils();
  const { data } = trpc.crm.getMeta.useQuery({ vendedor, mes, ano });
  const [valor, setValor] = useState("");
  const [qtd, setQtd] = useState("");
  const [saved, setSaved] = useState(false);

  const save = trpc.crm.saveMeta.useMutation({
    onSuccess: () => {
      toast.success(`Meta de ${vendedor} salva!`);
      setSaved(true);
      utils.crm.getMeta.invalidate({ vendedor, mes, ano });
    },
    onError: (e) => toast.error(`Erro: ${e.message}`),
  });

  const metaValor = data ? parseFloat(String(data.metaValor)) : 0;
  const metaQtd = data?.metaQtdOs ?? 0;

  return (
    <div className="flex items-center gap-3 flex-wrap py-3 border-b last:border-0">
      <div className="w-44 text-sm font-medium truncate flex-shrink-0">{vendedor}</div>
      <div className="flex items-center gap-2 flex-1 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">R$</span>
          <Input
            type="number"
            placeholder={metaValor > 0 ? String(metaValor) : "Valor meta"}
            value={valor}
            onChange={e => { setValor(e.target.value); setSaved(false); }}
            className="h-8 w-36 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">OS</span>
          <Input
            type="number"
            placeholder={metaQtd > 0 ? String(metaQtd) : "Qtd OS"}
            value={qtd}
            onChange={e => { setQtd(e.target.value); setSaved(false); }}
            className="h-8 w-24 text-xs"
          />
        </div>
        <Button
          size="sm"
          className="h-8 text-xs gap-1"
          disabled={save.isPending || (!valor && !qtd)}
          onClick={() => save.mutate({
            vendedor,
            mes,
            ano,
            metaValor: parseFloat(valor) || metaValor,
            metaQtdOs: parseInt(qtd) || metaQtd,
          })}
        >
          <Save className="w-3 h-3" />
          {save.isPending ? "Salvando..." : saved ? "Salvo ✓" : "Salvar"}
        </Button>
      </div>
      {data && (
        <div className="text-xs text-muted-foreground flex-shrink-0">
          Atual: R$ {metaValor.toLocaleString("pt-BR")} / {metaQtd} OS
        </div>
      )}
    </div>
  );
}

export default function CRMConfig() {
  const now = new Date();
  const [mes, setMes] = useState(now.getMonth() + 1);
  const [ano, setAno] = useState(now.getFullYear());
  const { data: etiquetas } = trpc.crm.getFaixaEtiquetas.useQuery();

  const meses = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-500" /> Configuração de Metas — CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Defina as metas mensais de valor e quantidade de OS por vendedor.
        </p>
      </div>

      {/* Seletor de mês/ano */}
      <Card className="border shadow-sm">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Mês:</span>
            <select
              value={mes}
              onChange={e => setMes(Number(e.target.value))}
              className="h-8 text-sm border rounded px-2 bg-background"
            >
              {meses.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Ano:</span>
            <Input
              type="number"
              value={ano}
              onChange={e => setAno(Number(e.target.value))}
              className="h-8 w-24 text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* Etiquetas das Faixas */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Tag className="w-4 h-4 text-violet-500" />
            Etiquetas das Faixas do CRM
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-xs text-muted-foreground mb-3">
            Personalize os nomes das faixas exibidos no CRM para todos os vendedores.
          </div>
          {([1, 2, 3] as const).map(f => (
            <FaixaEtiquetaForm
              key={f}
              faixa={f}
              defaultLabel={etiquetas?.[f] ?? `Faixa ${f}`}
            />
          ))}
        </CardContent>
      </Card>

      {/* Metas por vendedor */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            Metas de {meses[mes - 1]}/{ano}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="text-xs text-muted-foreground mb-3">
            Preencha o valor (R$) e/ou a quantidade de OS para cada vendedor e clique em Salvar.
          </div>
          {VENDEDORES.map(v => (
            <MetaForm key={v} vendedor={v} mes={mes} ano={ano} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
