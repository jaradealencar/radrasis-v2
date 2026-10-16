import { useMemo, useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Painel = RouterOutputs["perfilEstoque"]["painel"];
type Perfil = Painel["itens"][number];
type Metodo = "diametros" | "peso" | "metros";

const parseNumero = (valor: string) => {
  const texto = valor.trim().replace(/\s/g, "");
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
};

function espessuraPeloNome(nome: string) {
  const explicita = nome.match(/\((\d+[.,]\d+)\)/)?.[1];
  if (explicita) return explicita.replace(".", ",");
  if (/24\s*["”]/.test(nome)) return "0,65";
  if (/26\s*["”]/.test(nome)) return "0,50";
  return "";
}

export default function BobinasPerfilDialog({
  perfil,
  aberto,
  onOpenChange,
  onSaldoAtualizado,
}: {
  perfil: Perfil;
  aberto: boolean;
  onOpenChange: (aberto: boolean) => void;
  onSaldoAtualizado: () => Promise<void> | void;
}) {
  const utils = trpc.useUtils();
  const bobinas = trpc.perfilEstoque.bobinas.useQuery(
    { perfilItemId: perfil.id },
    { enabled: aberto }
  );
  const [metodo, setMetodo] = useState<Metodo>("diametros");
  const [quantidadeBobinas, setQuantidadeBobinas] = useState("1");
  const [externo, setExterno] = useState("");
  const [interno, setInterno] = useState("");
  const [espessura, setEspessura] = useState(() =>
    espessuraPeloNome(perfil.nome)
  );
  const [peso, setPeso] = useState("");
  const [metros, setMetros] = useState("");
  const [observacao, setObservacao] = useState("");

  const totalBobinas = (bobinas.data ?? []).reduce(
    (total, bobina) => total + bobina.comprimentoMetros,
    0
  );
  const quantidade = Number(quantidadeBobinas);
  const quantidadeValida =
    Number.isInteger(quantidade) && quantidade >= 1 && quantidade <= 100;
  const estimativa = useMemo(() => {
    if (metodo === "metros") return parseNumero(metros);
    if (metodo === "peso") {
      const kg = parseNumero(peso);
      return kg && perfil.kgPorMetro ? kg / perfil.kgPorMetro : null;
    }
    const dExterno = parseNumero(externo);
    const dInterno = parseNumero(interno);
    const t = parseNumero(espessura);
    if (!dExterno || !dInterno || !t || dExterno <= dInterno) return null;
    return (Math.PI * (dExterno ** 2 - dInterno ** 2)) / (4 * t * 1000);
  }, [metodo, metros, peso, perfil.kgPorMetro, externo, interno, espessura]);
  const comprimentoTotal =
    estimativa != null && quantidadeValida ? estimativa * quantidade : null;
  const pesoPorBobina =
    estimativa != null && perfil.kgPorMetro != null
      ? estimativa * perfil.kgPorMetro
      : metodo === "peso"
        ? parseNumero(peso)
        : null;
  const pesoTotal =
    pesoPorBobina != null && quantidadeValida
      ? pesoPorBobina * quantidade
      : null;

  const limparMedida = () => {
    setQuantidadeBobinas("1");
    setExterno("");
    setInterno("");
    setPeso("");
    setMetros("");
    setObservacao("");
  };
  const registrar = trpc.perfilEstoque.registrarBobina.useMutation({
    onSuccess: async resultado => {
      toast.success(
        `${resultado.quantidadeBobinas} bobina(s) registrada(s): ${fmtNum(resultado.totalMetros, 2)} m no total (${fmtNum(resultado.comprimentoMetros, 2)} m cada).`
      );
      limparMedida();
      await utils.perfilEstoque.bobinas.invalidate({ perfilItemId: perfil.id });
    },
    onError: error => toast.error(error.message),
  });
  const remover = trpc.perfilEstoque.removerBobina.useMutation({
    onSuccess: async () => {
      toast.success("Bobina removida da contagem.");
      await utils.perfilEstoque.bobinas.invalidate({ perfilItemId: perfil.id });
    },
    onError: error => toast.error(error.message),
  });
  const aplicar = trpc.perfilEstoque.aplicarContagemBobinas.useMutation({
    onSuccess: async resultado => {
      toast.success(
        `${resultado.bobinas} bobina(s) aplicadas: ${fmtNum(resultado.totalMetros, 2)} m em estoque.`
      );
      await onSaldoAtualizado();
      onOpenChange(false);
    },
    onError: error => toast.error(error.message),
  });

  const salvar = () => {
    registrar.mutate({
      perfilItemId: perfil.id,
      quantidadeBobinas: quantidade,
      metodo,
      diametroExternoMm: metodo === "diametros" ? parseNumero(externo) : null,
      diametroInternoMm: metodo === "diametros" ? parseNumero(interno) : null,
      espessuraMm: metodo === "diametros" ? parseNumero(espessura) : null,
      pesoKg: metodo === "peso" ? parseNumero(peso) : null,
      comprimentoMetros: metodo === "metros" ? parseNumero(metros) : null,
      observacao: observacao || null,
    });
  };

  return (
    <Dialog open={aberto} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Contar bobinas do perfil</DialogTitle>
          <DialogDescription>
            {perfil.nome.split("|")[0].trim()}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_.95fr]">
          <div className="space-y-4 rounded-lg border p-4">
            <div>
              <Label>Método de contagem</Label>
              <Select
                value={metodo}
                onValueChange={valor => setMetodo(valor as Metodo)}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diametros">Diâmetros medidos</SelectItem>
                  <SelectItem value="peso">Peso da bobina</SelectItem>
                  <SelectItem value="metros">Metros conhecidos</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                O sistema numera cada bobina automaticamente neste perfil.
              </p>
            </div>
            <div className="max-w-52">
              <Label>Quantidade de bobinas iguais</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={100}
                step={1}
                value={quantidadeBobinas}
                onChange={event => setQuantidadeBobinas(event.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Todas usarão as medidas informadas abaixo.
              </p>
            </div>

            {metodo === "diametros" && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Diâmetro externo (mm)</Label>
                  <Input
                    inputMode="decimal"
                    value={externo}
                    onChange={event => setExterno(event.target.value)}
                    placeholder="Ex.: 720"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Diâmetro interno (mm)</Label>
                  <Input
                    inputMode="decimal"
                    value={interno}
                    onChange={event => setInterno(event.target.value)}
                    placeholder="Ex.: 300"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label>Espessura (mm)</Label>
                  <Input
                    inputMode="decimal"
                    value={espessura}
                    onChange={event => setEspessura(event.target.value)}
                    placeholder="Ex.: 0,50"
                    className="mt-1.5"
                  />
                </div>
              </div>
            )}
            {metodo === "peso" && (
              <div>
                <Label>Peso líquido do perfil (kg)</Label>
                <Input
                  inputMode="decimal"
                  value={peso}
                  onChange={event => setPeso(event.target.value)}
                  placeholder="Desconte o tubete/eixo, se houver"
                  className="mt-1.5"
                />
                {perfil.kgPorMetro ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Conversão cadastrada: {fmtNum(perfil.kgPorMetro, 4)} kg/m.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-destructive">
                    Cadastre o peso por metro na ação “Alvo” antes de usar este
                    método.
                  </p>
                )}
              </div>
            )}
            {metodo === "metros" && (
              <div>
                <Label>Comprimento da bobina (m)</Label>
                <Input
                  inputMode="decimal"
                  value={metros}
                  onChange={event => setMetros(event.target.value)}
                  placeholder="Ex.: 83,5"
                  className="mt-1.5"
                />
              </div>
            )}
            <div>
              <Label>Observação</Label>
              <Input
                value={observacao}
                onChange={event => setObservacao(event.target.value)}
                placeholder="Local, lote, condição da bobina..."
                className="mt-1.5"
              />
            </div>
            <div className="grid gap-3 rounded-lg bg-blue-50 p-3 text-sm sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_auto] xl:items-center">
              <div className="min-w-0">
                <span className="block text-xs text-blue-700">
                  Comprimento por bobina
                </span>
                <b className="text-lg text-blue-950">
                  {estimativa && estimativa > 0
                    ? `${fmtNum(estimativa, 2)} m`
                    : "Aguardando medidas"}
                </b>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-blue-700">
                  Peso estimado por bobina
                </span>
                <b className="text-lg text-blue-950">
                  {pesoPorBobina != null && pesoPorBobina > 0
                    ? `${fmtNum(pesoPorBobina, 2)} kg`
                    : perfil.kgPorMetro == null
                      ? "Cadastre kg/m"
                      : "—"}
                </b>
              </div>
              <div className="min-w-0">
                <span className="block text-xs text-blue-700">
                  Total ({quantidadeValida ? quantidade : 0} bobinas)
                </span>
                <b className="text-lg text-blue-950">
                  {comprimentoTotal != null && comprimentoTotal > 0
                    ? `${fmtNum(comprimentoTotal, 2)} m`
                    : "—"}
                  {pesoTotal != null && pesoTotal > 0
                    ? ` · ${fmtNum(pesoTotal, 2)} kg`
                    : ""}
                </b>
              </div>
              <Button
                onClick={salvar}
                disabled={
                  !estimativa ||
                  estimativa <= 0 ||
                  !quantidadeValida ||
                  registrar.isPending
                }
                className="w-full gap-2 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                Adicionar {quantidade > 1 ? "bobinas" : "bobina"}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground">
                Bobinas nesta contagem
              </div>
              <div className="mt-1 text-2xl font-bold">
                {fmtNum(totalBobinas, 2)} m
              </div>
              <div className="text-xs text-muted-foreground">
                {bobinas.data?.length ?? 0} bobina(s) · saldo sistêmico atual{" "}
                {fmtNum(perfil.saldoAtual, 2)} m
              </div>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {bobinas.data?.map(bobina => (
                <div key={bobina.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <b>{bobina.identificacao}</b>
                      <div className="mt-1">
                        <Badge variant="secondary">
                          {bobina.metodo === "foto"
                            ? "Foto"
                            : bobina.metodo === "diametros"
                              ? "Diâmetros"
                              : bobina.metodo === "peso"
                                ? "Peso"
                                : "Metros"}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover bobina"
                      onClick={() => remover.mutate({ id: bobina.id })}
                      disabled={remover.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="mt-2 text-lg font-semibold">
                    {fmtNum(bobina.comprimentoMetros, 2)} m
                  </div>
                  {bobina.pesoKg != null && (
                    <div className="text-xs text-muted-foreground">
                      {fmtNum(bobina.pesoKg, 2)} kg
                    </div>
                  )}
                  {bobina.diametroExternoMm != null && (
                    <div className="text-xs text-muted-foreground">
                      Ø ext. {fmtNum(bobina.diametroExternoMm, 1)} mm · Ø int.{" "}
                      {fmtNum(bobina.diametroInternoMm ?? 0, 1)} mm · esp.{" "}
                      {fmtNum(bobina.espessuraMm ?? 0, 2)} mm
                    </div>
                  )}
                  <div className="mt-1 text-xs text-muted-foreground">
                    {bobina.contadoPor} · {fmtDateTime(bobina.contadoEm)}
                  </div>
                </div>
              ))}
              {!bobinas.isLoading && !bobinas.data?.length && (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma bobina adicionada para este perfil.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          O peso é calculado com o kg/m cadastrado para o perfil. Se essa
          conversão não estiver disponível, cadastre-a em “Alvo” para ver o peso
          estimado e a necessidade de compra em kg.
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar sem aplicar
          </Button>
          <Button
            className="gap-2"
            onClick={() => aplicar.mutate({ perfilItemId: perfil.id })}
            disabled={!bobinas.data?.length || aplicar.isPending}
          >
            <CheckCircle2 className="h-4 w-4" /> Concluir e atualizar saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
