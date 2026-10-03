import { useState } from "react";
import { toast } from "sonner";
import { BanIcon, Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatarDataBr, formatarTelefone, hojeCampoGrande } from "@shared/campanhas-whatsapp";

/**
 * Aba "Não quer receber": números que pediram para sair. Vale para TODAS as campanhas — o servidor tira esses
 * telefones de qualquer lista (ver `higienizarLista`), diferente da quarentena, que só dá um descanso de N dias.
 * Aceita um número ou vários de uma vez (colados de uma planilha, um por linha ou separados por vírgula/;).
 */
export default function NaoReceberMensagens() {
  const utils = trpc.useUtils();
  const [numeros, setNumeros] = useState("");
  const [nome, setNome] = useState("");
  const [motivo, setMotivo] = useState("");

  const { data, isLoading } = trpc.campanhasWhatsapp.listarOptOut.useQuery();
  const adicionar = trpc.campanhasWhatsapp.adicionarOptOut.useMutation({
    onSuccess: r => {
      utils.campanhasWhatsapp.listarOptOut.invalidate();
      const partes = [`${fmtNum(r.adicionados)} número(s) adicionado(s)`];
      if (r.jaExistiam > 0) partes.push(`${fmtNum(r.jaExistiam)} já estavam na lista`);
      if (r.invalidos.length > 0) {
        partes.push(`${fmtNum(r.invalidos.length)} inválido(s): ${r.invalidos.slice(0, 3).join(", ")}${r.invalidos.length > 3 ? "…" : ""}`);
      }
      if (r.invalidos.length > 0 && r.adicionados === 0) toast.error(partes.join(" · "));
      else toast.success(partes.join(" · "));
      if (r.invalidos.length === 0) { setNumeros(""); setNome(""); setMotivo(""); }
    },
    onError: e => toast.error(e.message),
  });
  const remover = trpc.campanhasWhatsapp.removerOptOut.useMutation({
    onSuccess: () => utils.campanhasWhatsapp.listarOptOut.invalidate(),
    onError: e => toast.error(e.message),
  });

  const lista = numeros.split(/[\n,;]+/).map(t => t.trim()).filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Registrar números que não querem mais receber mensagem</h3>
          <p className="text-xs text-muted-foreground">
            Esses números ficam de fora de todas as campanhas, até você removê-los daqui. Cole um ou vários, um por linha.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="optout-numeros">Números (com DDD)</Label>
            <Textarea id="optout-numeros" rows={4} value={numeros} onChange={e => setNumeros(e.target.value)}
              placeholder={"(67) 99999-0000\n67 98888-1111"} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="optout-nome">Nome (opcional, quando for um número só)</Label>
            <Input id="optout-nome" value={nome} onChange={e => setNome(e.target.value)} maxLength={200} disabled={lista.length > 1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="optout-motivo">Motivo (opcional)</Label>
            <Input id="optout-motivo" value={motivo} onChange={e => setMotivo(e.target.value)} maxLength={300}
              placeholder="Ex.: pediu para sair pelo WhatsApp" />
          </div>
        </div>
        <Button className="gap-1.5" disabled={lista.length === 0 || adicionar.isPending}
          onClick={() => adicionar.mutate({ telefones: lista, nome: nome || null, motivo: motivo || null })}>
          {adicionar.isPending ? <Spinner className="size-4" /> : <Plus size={14} />}
          Adicionar{lista.length > 1 ? ` ${fmtNum(lista.length)} números` : ""}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10"><Spinner className="size-6 text-muted-foreground" /></div>
      ) : !data || data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><BanIcon /></EmptyMedia>
            <EmptyTitle>Nenhum número bloqueado</EmptyTitle>
            <EmptyDescription>Quando alguém pedir para não receber mais mensagem, registre aqui.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <div className="border-b px-3 py-2 text-xs text-muted-foreground">{fmtNum(data.length)} número(s) bloqueado(s)</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Telefone</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Registrado</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap">{formatarTelefone(r.telefone)}</TableCell>
                  <TableCell>{r.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.motivo || "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatarDataBr(hojeCampoGrande(new Date(r.createdAt)))}{r.registradoPor ? ` · ${r.registradoPor}` : ""}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="text-red-500 hover:text-red-600" title="Remover da lista"
                      disabled={remover.isPending} onClick={() => remover.mutate({ id: r.id })}>
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
