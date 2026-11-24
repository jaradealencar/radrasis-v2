import { useState } from "react";
import { trpc, type RouterOutputs } from "@/lib/trpc";
import { fmtBrl, fmtDate, fmtNum } from "@/lib/format";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { calcularFreteCompra, resumoFreteCompra } from "@shared/compras-frete";

export type ModoFreteCompra = "valor_total" | "por_kg" | "gratis";
export function FreteCompraCampos({
  modo,
  valor,
  peso,
  mudarModo,
  mudarValor,
  mudarPeso,
  mostrarPeso = true,
}: {
  modo: ModoFreteCompra;
  valor: string;
  peso: string;
  mudarModo: (modo: ModoFreteCompra) => void;
  mudarValor: (valor: string) => void;
  mudarPeso: (peso: string) => void;
  mostrarPeso?: boolean;
}) {
  const calculo = calcularFreteCompra(
    modo,
    valor.trim() ? Number(valor.replace(",", ".")) : null,
    peso.trim() ? Number(peso.replace(",", ".")) : null
  );
  const pesoValido =
    Number.isFinite(Number(peso.replace(",", "."))) &&
    Number(peso.replace(",", ".")) > 0;
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <Campo nome="Tipo de frete">
        <select
          aria-label="Tipo de frete"
          className={classeSelect}
          value={modo}
          onChange={e => mudarModo(e.target.value as ModoFreteCompra)}
        >
          <option value="valor_total">Valor total / fixo (R$)</option>
          <option value="por_kg">Por kg (R$/kg)</option>
          <option value="gratis">Grátis</option>
        </select>
      </Campo>
      <Campo
        nome={
          modo === "por_kg"
            ? "Tarifa de frete (R$/kg)"
            : "Valor total do frete (R$)"
        }
      >
        <Input
          inputMode="decimal"
          disabled={modo === "gratis"}
          value={modo === "gratis" ? "0" : valor}
          onChange={e => mudarValor(e.target.value)}
        />
      </Campo>
      {modo === "por_kg" && mostrarPeso ? (
        <Campo nome="Peso total previsto da carga (kg)">
          <Input
            inputMode="decimal"
            value={peso}
            onChange={e => mudarPeso(e.target.value)}
            placeholder="Extraído do PDF ou informe manualmente"
          />
        </Campo>
      ) : modo !== "por_kg" ? (
        <p className="self-end text-xs pb-2">
          Total de frete:{" "}
          <strong>
            {calculo.total == null ? "não informado" : fmtBrl(calculo.total)}
          </strong>
        </p>
      ) : null}
      {modo === "por_kg" && (
        <p className="sm:col-span-3 text-xs text-slate-500">
          {calculo.total == null
            ? pesoValido
              ? "Informe a tarifa R$/kg para calcular o frete estimado. O peso real da NF definirá o frete definitivo."
              : "Sem peso total em kg não há base para multiplicar a tarifa. Extraia o peso do PDF ou informe-o manualmente para estimar o frete."
            : `${valor} R$/kg × ${peso} kg = ${fmtBrl(calculo.total)} de frete estimado.`}
        </p>
      )}
    </div>
  );
}

export type OrdemFrete = RouterOutputs["compras"]["obterOrdemFrete"];
const classeSelect = "min-w-0 w-full rounded border bg-white p-2 text-xs";
const decimal = (s: string) =>
  s.trim() === "" ? NaN : Number(s.replace(",", "."));
function Campo({
  nome,
  children,
}: {
  nome: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0 space-y-1 text-xs">
      <span className="text-slate-500">{nome}</span>
      {children}
    </label>
  );
}

export function LogisticaOrdemModal({
  id,
  fechar,
}: {
  id: number | null;
  fechar: () => void;
}) {
  const q = trpc.compras.obterOrdemFrete.useQuery(
    { id: id ?? 0 },
    { enabled: id != null, staleTime: 0 }
  );
  return (
    <Dialog
      open={id != null}
      onOpenChange={open => {
        if (!open) fechar();
      }}
    >
      <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Frete e coleta da OC-{id}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <Spinner />
        ) : q.error ? (
          <p>{q.error.message}</p>
        ) : (
          q.data && (
            <EditorLogistica
              key={`${q.data.ordem.id}-${q.data.ordem.logisticaRevisao}`}
              dados={q.data}
              fechar={fechar}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
function EditorLogistica({
  dados,
  fechar,
}: {
  dados: OrdemFrete;
  fechar: () => void;
}) {
  const utils = trpc.useUtils();
  const o = dados.ordem;
  const [frete, setFrete] = useState(String(o.freteValorInformado ?? o.frete));
  const [peso, setPeso] = useState(
    o.pesoPrevistoKg == null ? "" : String(o.pesoPrevistoKg)
  );
  const [volume, setVolume] = useState(
    o.volumePrevistoM3 == null ? "" : String(o.volumePrevistoM3)
  );
  const [modo, setModo] = useState<ModoFreteCompra>(
    o.freteModo as ModoFreteCompra
  );
  const [transportadora, setTransportadora] = useState(o.transportadora);
  const [coleta, setColeta] = useState(o.numeroColeta);
  const [confirmado, setConfirmado] = useState(o.freteConfirmado);
  const salvar = trpc.compras.atualizarLogistica.useMutation();
  const valor = decimal(frete);
  const pesoKg = decimal(peso);
  const volumeM3 = decimal(volume);
  const calculo = calcularFreteCompra(
    modo,
    valor,
    Number.isFinite(pesoKg) ? pesoKg : null
  );
  const resumo =
    calculo.total != null
      ? resumoFreteCompra(
          calculo.total,
          dados.utilizado,
          Number.isFinite(pesoKg) ? pesoKg : null
        )
      : null;
  return (
    <div className="space-y-4">
      <p className="text-sm">
        <strong>{dados.fornecedor}</strong> · Cotação #{o.cotacaoId}
      </p>
      <FreteCompraCampos
        modo={modo}
        valor={frete}
        peso={peso}
        mudarModo={v => {
          setModo(v);
          setConfirmado(false);
        }}
        mudarValor={v => {
          setFrete(v);
          setConfirmado(false);
        }}
        mudarPeso={setPeso}
        mostrarPeso={false}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo nome="Peso total da carga (kg)">
          <Input
            inputMode="decimal"
            value={peso}
            onChange={e => setPeso(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
        <Campo nome="Volume total da carga (m³)">
          <Input
            inputMode="decimal"
            value={volume}
            onChange={e => setVolume(e.target.value)}
            placeholder="Opcional"
          />
        </Campo>
        <Campo nome="Transportadora">
          <Input
            value={transportadora}
            onChange={e => setTransportadora(e.target.value)}
          />
        </Campo>
        <Campo nome="Número da coleta">
          <Input value={coleta} onChange={e => setColeta(e.target.value)} />
        </Campo>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={confirmado}
          onChange={e => setConfirmado(e.target.checked)}
        />
        Frete confirmado (marque também quando for grátis)
      </label>
      <p className="rounded bg-slate-50 p-3 text-xs">
        Já aplicado às NFs: <strong>{fmtBrl(dados.utilizado)}</strong> ·{" "}
        {modo === "por_kg" ? (
          "O total definitivo depende do peso de cada NF."
        ) : (
          <>
            Saldo: <strong>{fmtBrl(resumo?.saldo)}</strong>
          </>
        )}
        <br />
        Custo estimado:{" "}
        {resumo?.valorPorKg == null
          ? "informe o peso para calcular R$/kg"
          : `${fmtBrl(resumo.valorPorKg)}/kg`}
        . O custo definitivo usa o frete destinado à NF e o peso da nota.
      </p>
      <Button
        disabled={salvar.isPending}
        onClick={async () => {
          try {
            if (
              (modo !== "gratis" && (!Number.isFinite(valor) || valor < 0)) ||
              (peso.trim() && !(pesoKg > 0)) ||
              (volume.trim() && !(volumeM3 > 0))
            ) {
              toast.error("Confira o valor do frete, peso e volume.");
              return;
            }
            await salvar.mutateAsync({
              ordemId: o.id,
              revisao: o.logisticaRevisao,
              frete: calculo.total ?? 0,
              freteModo: modo,
              freteValorInformado: modo === "gratis" ? 0 : valor,
              freteConfirmado: confirmado,
              pesoPrevistoKg: peso.trim() ? pesoKg : null,
              volumePrevistoM3: volume.trim() ? volumeM3 : null,
              transportadora,
              numeroColeta: coleta,
            });
            await utils.compras.listarOrdens.invalidate();
            await utils.compras.obterOrdemFrete.invalidate();
            await utils.compras.auditarOrdem.invalidate();
            toast.success("Frete e coleta salvos na ordem.");
            fechar();
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Não foi possível salvar."
            );
          }
        }}
      >
        Salvar frete e coleta
      </Button>
      {dados.vinculadas.length > 0 && (
        <div className="space-y-1 text-xs">
          <strong>Frete registrado por nota fiscal</strong>
          {dados.vinculadas.map(v => (
            <p key={v.nf.id}>
              NF {v.nf.numero ?? v.nf.id}:{" "}
              {fmtBrl(v.snapshot?.freteAplicado ?? Number(v.nf.valorFreteNf))} ·{" "}
              {v.snapshot?.valorPorKg == null
                ? "R$/kg não disponível"
                : `R$ ${fmtNum(v.snapshot.valorPorKg, 4)}/kg`}{" "}
              · {v.snapshot?.transportadora ?? "sem snapshot anterior"} · coleta{" "}
              {v.snapshot?.numeroColeta || "não informada"}
            </p>
          ))}
        </div>
      )}
      {dados.historico.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-blue-600">
            Histórico de alterações
          </summary>
          {dados.historico.map(h => (
            <p className="mt-2" key={h.id}>
              Revisão {h.revisao} · {fmtDate(h.createdAt)} ·{" "}
              {fmtBrl(h.dados.frete)} ·{" "}
              {h.dados.transportadora || "transportadora pendente"} · coleta{" "}
              {h.dados.numeroColeta || "pendente"}
            </p>
          ))}
        </details>
      )}
    </div>
  );
}

export function SelecionarOrdemNf({
  selecionada,
  selecionar,
  pesoKg,
  alterarPeso,
  freteAplicado,
}: {
  selecionada: OrdemFrete | null;
  selecionar: (dados: OrdemFrete | null) => void;
  pesoKg: number | null;
  alterarPeso: (valor: number | null) => void;
  freteAplicado: number;
}) {
  const utils = trpc.useUtils();
  const [busca, setBusca] = useState("");
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [editarId, setEditarId] = useState<number | null>(null);
  const q = trpc.compras.listarOrdens.useQuery({
    busca: busca || undefined,
    inicio: inicio || undefined,
    fim: fim || undefined,
  });
  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
      <strong className="text-sm">
        Vincular NF à ordem de compra e à cotação
      </strong>
      <div className="grid gap-2 sm:grid-cols-3">
        <Campo nome="Fornecedor ou número da ordem">
          <Input value={busca} onChange={e => setBusca(e.target.value)} />
        </Campo>
        <Campo nome="Ordens a partir de">
          <Input
            type="date"
            value={inicio}
            onChange={e => setInicio(e.target.value)}
          />
        </Campo>
        <Campo nome="Ordens até">
          <Input
            type="date"
            value={fim}
            onChange={e => setFim(e.target.value)}
          />
        </Campo>
      </div>
      <select
        aria-label="Ordem de compra da nota fiscal"
        disabled={carregando || q.isLoading}
        className={classeSelect}
        value={selecionada?.ordem.id ?? ""}
        onChange={async e => {
          const id = Number(e.target.value);
          if (!id) {
            selecionar(null);
            return;
          }
          setCarregando(true);
          try {
            selecionar(
              await utils.compras.obterOrdemFrete.fetch(
                { id },
                { staleTime: 0 }
              )
            );
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : "Falha ao buscar ordem."
            );
          } finally {
            setCarregando(false);
          }
        }}
      >
        <option value="">
          Selecione a ordem obrigatória para concluir a NF
        </option>
        {selecionada &&
          !q.data?.some(r => r.ordem.id === selecionada.ordem.id) && (
            <option value={selecionada.ordem.id}>
              OC-{selecionada.ordem.id} · {selecionada.fornecedor}
            </option>
          )}
        {q.data?.map(r => (
          <option key={r.ordem.id} value={r.ordem.id}>
            OC-{r.ordem.id} · {r.fornecedor} · {fmtDate(r.ordem.createdAt)} ·
            Cotação #{r.ordem.cotacaoId}
          </option>
        ))}
      </select>
      {q.error && <p className="text-xs text-red-600">{q.error.message}</p>}
      {selecionada ? (
        <>
          <div className="grid gap-2 text-xs sm:grid-cols-3">
            <p>
              Cotação <strong>#{selecionada.ordem.cotacaoId}</strong> →{" "}
              <strong>OC-{selecionada.ordem.id}</strong>
              <br />
              {selecionada.fornecedor}
            </p>
            <p>
              Frete da ordem:{" "}
              <strong>
                {selecionada.ordem.freteModo === "por_kg"
                  ? `${fmtBrl(Number(selecionada.ordem.freteValorInformado))}/kg`
                  : selecionada.ordem.freteModo === "gratis"
                    ? "Grátis"
                    : fmtBrl(Number(selecionada.ordem.frete))}
              </strong>
              <br />
              Utilizado: {fmtBrl(selecionada.utilizado)}{" "}
              {selecionada.ordem.freteModo !== "por_kg" && (
                <> · Saldo: {fmtBrl(selecionada.saldo)}</>
              )}
            </p>
            <p>
              Transportadora:{" "}
              {selecionada.ordem.transportadora || "não informada"}
              <br />
              Coleta: {selecionada.ordem.numeroColeta || "não informada"}
            </p>
          </div>
          {!selecionada.ordem.freteConfirmado && (
            <p className="text-xs text-amber-700">
              Confirme o frete na ordem antes de concluir a auditoria.
            </p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Campo nome="Peso definitivo da NF (kg)">
              <Input
                type="number"
                min="0.001"
                step="0.001"
                value={pesoKg ?? ""}
                onChange={e =>
                  alterarPeso(e.target.value ? Number(e.target.value) : null)
                }
              />
            </Campo>
            <p className="text-sm">
              {fmtBrl(freteAplicado)} ÷{" "}
              {pesoKg ? `${fmtNum(pesoKg, 3)} kg` : "peso pendente"} ={" "}
              <strong>
                {pesoKg && pesoKg > 0
                  ? `R$ ${fmtNum(freteAplicado / pesoKg, 4)}/kg`
                  : "R$/kg pendente"}
              </strong>
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditarId(selecionada.ordem.id)}
            >
              Editar frete e coleta na ordem
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  selecionar(
                    await utils.compras.obterOrdemFrete.fetch(
                      { id: selecionada.ordem.id },
                      { staleTime: 0 }
                    )
                  );
                } catch (e) {
                  toast.error("Não foi possível atualizar a ordem.");
                }
              }}
            >
              Recarregar dados da ordem
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">
            {selecionada.ordem.freteModo === "por_kg"
              ? "O frete desta NF é a tarifa da ordem multiplicada pelo peso definitivo acima."
              : "O campo Frete Total abaixo é a parcela destinada a esta NF. Em entrega parcial, ajuste sem exceder o saldo da ordem."}{" "}
            O frete do XML é informativo e não é somado novamente.
          </p>
        </>
      ) : (
        <p className="text-xs text-slate-500">
          A compra deve partir de uma cotação salva e de uma ordem emitida.
          Selecione-a para trazer o frete acordado.
        </p>
      )}
      <LogisticaOrdemModal
        id={editarId}
        fechar={() => {
          setEditarId(null);
          if (selecionada)
            void utils.compras.obterOrdemFrete
              .fetch({ id: selecionada.ordem.id }, { staleTime: 0 })
              .then(selecionar)
              .catch(() =>
                toast.error(
                  "Recarregue os dados da ordem para atualizar o frete."
                )
              );
        }}
      />
    </div>
  );
}
