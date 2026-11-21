import { useEffect, useState } from "react";
import {
  Info,
  Loader2,
  MessageSquareText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "@/components/PageHeader";
import { trpc, type RouterOutputs } from "@/lib/trpc";

type FaixaScript = 0 | 1 | 2 | 3 | 11 | 12 | 13 | 20;
type ScriptRow = RouterOutputs["crm"]["listScripts"][number];

const GRUPOS_FIXOS: Array<{ faixa: FaixaScript; label: string }> = [
  { faixa: 0, label: "Pós-orçamento" },
  { faixa: 11, label: "Não retornou" },
  { faixa: 12, label: "Esperando cliente" },
  { faixa: 13, label: "Garantiu fechamento" },
  { faixa: 20, label: "Objeções de preço" },
];

function ScriptCard({ script, grupoLabel }: { script: ScriptRow; grupoLabel: string }) {
  const utils = trpc.useUtils();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(script.titulo ?? "");
  const [conteudo, setConteudo] = useState(script.conteudo);

  useEffect(() => {
    if (!editando) {
      setTitulo(script.titulo ?? "");
      setConteudo(script.conteudo);
    }
  }, [script.titulo, script.conteudo, editando]);

  const salvar = trpc.crm.updateScript.useMutation({
    onSuccess: async () => {
      toast.success("Script salvo.");
      setEditando(false);
      await utils.crm.listScripts.invalidate({ faixa: script.faixa });
    },
    onError: erro => toast.error(`Não foi possível salvar o script: ${erro.message}`),
  });

  const remover = trpc.crm.deleteScript.useMutation({
    onSuccess: async () => {
      toast.success("Script removido dos atalhos do CRM.");
      await utils.crm.listScripts.invalidate({ faixa: script.faixa });
    },
    onError: erro => toast.error(`Não foi possível remover o script: ${erro.message}`),
  });

  function cancelarEdicao() {
    setTitulo(script.titulo ?? "");
    setConteudo(script.conteudo);
    setEditando(false);
  }

  function salvarEdicao() {
    if (!titulo.trim() || !conteudo.trim()) return;
    salvar.mutate({
      id: script.id,
      titulo: titulo.trim(),
      conteudo: conteudo.trim(),
      // Preserva o texto de voz editado nos atalhos atuais do CRM.
      conteudo_voz: script.conteudo_voz ?? "",
    });
  }

  function confirmarRemocao() {
    const nome = script.titulo?.trim() || "este script";
    if (!window.confirm(`Remover “${nome}” dos atalhos do CRM?`)) return;
    remover.mutate({ id: script.id });
  }

  return (
    <Card className="gap-0 overflow-hidden">
      <CardHeader className="flex grid-cols-1 flex-row items-start justify-between gap-3 border-b px-4 py-3">
        <div className="min-w-0">
          {editando ? (
            <div className="space-y-1">
              <Label htmlFor={`titulo-script-${script.id}`} className="text-xs">Título do script</Label>
              <Input
                id={`titulo-script-${script.id}`}
                value={titulo}
                onChange={evento => setTitulo(evento.target.value)}
                maxLength={128}
                placeholder="Ex.: Primeiro contato após o orçamento"
                autoFocus
              />
            </div>
          ) : (
            <>
              <CardTitle className="truncate text-base">{script.titulo || "Script sem título"}</CardTitle>
              <CardDescription className="mt-1">{grupoLabel}</CardDescription>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {editando ? (
            <>
              <Button
                type="button"
                size="sm"
                onClick={salvarEdicao}
                disabled={!titulo.trim() || !conteudo.trim() || salvar.isPending}
                className="gap-1.5"
              >
                {salvar.isPending ? <Spinner className="size-3.5" /> : <Save className="size-3.5" />}
                Salvar
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={cancelarEdicao} aria-label="Cancelar edição">
                <X className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="icon" variant="ghost" onClick={() => setEditando(true)} aria-label="Editar script">
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={confirmarRemocao}
                disabled={remover.isPending}
                aria-label="Remover script"
                className="text-red-600 hover:text-red-700"
              >
                {remover.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 py-4">
        {editando ? (
          <div className="space-y-2">
            <Label htmlFor={`conteudo-script-${script.id}`}>Texto da mensagem</Label>
            <Textarea
              id={`conteudo-script-${script.id}`}
              value={conteudo}
              onChange={evento => setConteudo(evento.target.value)}
              className="min-h-40 resize-y leading-relaxed"
              placeholder="Escreva aqui o texto que será usado na abordagem comercial."
            />
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{script.conteudo}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function CrmScripts() {
  const [faixa, setFaixa] = useState<FaixaScript>(0);
  const [novoAberto, setNovoAberto] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState("");
  const [novoConteudo, setNovoConteudo] = useState("");
  const utils = trpc.useUtils();

  const { data: faixasConfig } = trpc.crm.getFaixaEtiquetas.useQuery();
  const { data: scripts, isLoading, isError, error } = trpc.crm.listScripts.useQuery({ faixa });

  const grupos: Array<{ faixa: FaixaScript; label: string }> = [
    GRUPOS_FIXOS[0],
    { faixa: 1, label: faixasConfig?.[1]?.label ?? "Faixa 1" },
    { faixa: 2, label: faixasConfig?.[2]?.label ?? "Faixa 2" },
    { faixa: 3, label: faixasConfig?.[3]?.label ?? "Faixa 3" },
    ...GRUPOS_FIXOS.slice(1),
  ];
  const grupoAtual = grupos.find(grupo => grupo.faixa === faixa)?.label ?? "Scripts de vendas";

  const adicionar = trpc.crm.addScript.useMutation({
    onSuccess: async (_resultado, variaveis) => {
      toast.success("Script adicionado e salvo.");
      setNovoTitulo("");
      setNovoConteudo("");
      setNovoAberto(false);
      await utils.crm.listScripts.invalidate({ faixa: variaveis.faixa });
    },
    onError: erro => toast.error(`Não foi possível salvar o script: ${erro.message}`),
  });

  function adicionarScript() {
    if (!novoTitulo.trim() || !novoConteudo.trim()) return;
    adicionar.mutate({
      faixa,
      titulo: novoTitulo.trim(),
      conteudo: novoConteudo.trim(),
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
      <PageHeader
        title="Scripts de vendas"
        description="Grave e organize os textos usados nos contatos do CRM. As alterações aparecem também nos atalhos das propostas."
        icon={MessageSquareText}
        actions={(
          <Button
            type="button"
            onClick={() => setNovoAberto(aberto => !aberto)}
            className="gap-2"
          >
            {novoAberto ? <X className="size-4" /> : <Plus className="size-4" />}
            {novoAberto ? "Fechar formulário" : "Novo script"}
          </Button>
        )}
      />

      <Card className="gap-0 overflow-hidden">
        <div className="border-b px-4 py-4 md:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold text-slate-800">Organizar por etapa</h2>
              <p className="text-sm text-muted-foreground">Escolha a etapa do CRM para ver e editar seus textos.</p>
            </div>
            <Badge variant="secondary">{scripts?.length ?? 0} {scripts?.length === 1 ? "script" : "scripts"}</Badge>
          </div>
          <Tabs
            value={String(faixa)}
            onValueChange={valor => {
              setFaixa(Number(valor) as FaixaScript);
              setNovoAberto(false);
            }}
          >
            <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-slate-100">
              {grupos.map(grupo => (
                <TabsTrigger key={grupo.faixa} value={String(grupo.faixa)} className="h-8 flex-none px-3 text-xs">
                  {grupo.label}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={String(faixa)} className="mt-0 focus-visible:outline-none">
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                <Info className="mt-0.5 size-4 shrink-0" />
                <p>
                  Você pode usar <code className="rounded bg-white/80 px-1">{"{nome_cliente}"}</code>,
                  <code className="ml-1 rounded bg-white/80 px-1">{"{produto}"}</code>,
                  <code className="ml-1 rounded bg-white/80 px-1">{"{valor}"}</code> e
                  <code className="ml-1 rounded bg-white/80 px-1">{"{vendedor}"}</code>. Essas variáveis são preenchidas nos atalhos do CRM.
                </p>
              </div>

              {novoAberto && (
                <Card className="mt-4 gap-0 border-blue-200 shadow-sm">
                  <CardHeader className="border-b bg-blue-50/60 px-4 py-3">
                    <CardTitle className="text-base">Novo script — {grupoAtual}</CardTitle>
                    <CardDescription>Depois de salvar, ele ficará disponível nos atalhos desta etapa.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="novo-script-titulo">Título</Label>
                      <Input
                        id="novo-script-titulo"
                        value={novoTitulo}
                        onChange={evento => setNovoTitulo(evento.target.value)}
                        maxLength={128}
                        placeholder="Ex.: Apresentação da proposta"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="novo-script-conteudo">Texto do script</Label>
                      <Textarea
                        id="novo-script-conteudo"
                        value={novoConteudo}
                        onChange={evento => setNovoConteudo(evento.target.value)}
                        className="min-h-40 resize-y leading-relaxed"
                        placeholder="Digite a mensagem de vendas que deseja salvar..."
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setNovoAberto(false)}>
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        onClick={adicionarScript}
                        disabled={!novoTitulo.trim() || !novoConteudo.trim() || adicionar.isPending}
                        className="gap-2"
                      >
                        {adicionar.isPending ? <Spinner className="size-4" /> : <Save className="size-4" />}
                        Salvar script
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="mt-4 space-y-3">
                {isLoading ? (
                  <div className="flex justify-center py-12"><Spinner /></div>
                ) : isError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                    Não foi possível carregar os scripts: {error?.message ?? "Tente novamente."}
                  </div>
                ) : scripts?.length ? (
                  scripts.map(script => <ScriptCard key={script.id} script={script} grupoLabel={grupoAtual} />)
                ) : !novoAberto ? (
                  <Empty className="border">
                    <EmptyHeader>
                      <EmptyMedia variant="icon"><MessageSquareText className="text-slate-500" /></EmptyMedia>
                      <EmptyTitle>Nenhum script nesta etapa</EmptyTitle>
                      <EmptyDescription>Crie um texto para ele aparecer nos atalhos das propostas.</EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}
