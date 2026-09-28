import { useState } from "react";
import { AlertTriangle, Database, Download, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { exportRowsToXlsx } from "@/lib/exportXlsx";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatarTelefone, hojeCampoGrande } from "@shared/campanhas-whatsapp";
import { slugArquivo, type CampanhaLinha } from "./comuns";

interface Props {
  /** `null` = fechado. */
  campanha: CampanhaLinha | null;
  onClose: () => void;
}

const MAX_LISTA_TELA = 200;

/**
 * "Ver contatos" — pedido do usuário 28/09/2026: consultar e baixar a audiência de uma campanha (fontes ERP +
 * externas vinculadas) sem precisar passar pelo fluxo de "Registrar disparo" (que já processa/grava o disparo).
 * Reaproveita a mesma query só-leitura `gerarListaDaCampanha` do disparo — nada aqui grava quarentena, cadência
 * nem qualquer outro registro; é puramente consulta + exportação.
 */
export default function ContatosCampanhaDialog({ campanha, onClose }: Props) {
  const [aba, setAba] = useState<"aprovados" | "ignorados" | "invalidos">("aprovados");
  const hoje = hojeCampoGrande();

  const { data, isFetching, isError, error } = trpc.campanhasWhatsapp.gerarListaDaCampanha.useQuery(
    { campanhaId: campanha?.id ?? 0 }, { enabled: !!campanha, retry: false },
  );

  const linhas = !data ? []
    : aba === "aprovados" ? data.aprovados
    : aba === "ignorados" ? [...data.ignoradosQuarentenaGlobal, ...data.ignoradosCadenciaCampanha]
    : data.invalidosOuDuplicados;

  const baixar = () => {
    if (!campanha) return;
    const base = `${slugArquivo(campanha.nome)}-contatos-${hoje}`;
    if (aba === "aprovados" && data) {
      exportRowsToXlsx(data.aprovados, [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], base, "Contatos");
    } else if (aba === "ignorados" && data) {
      exportRowsToXlsx([...data.ignoradosQuarentenaGlobal, ...data.ignoradosCadenciaCampanha], [
        { header: "telefone", valor: r => r.telefone, largura: 18 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
      ], `${base}-ignorados`, "Ignorados");
    } else if (data) {
      exportRowsToXlsx(data.invalidosOuDuplicados, [
        { header: "telefone", valor: r => r.telefoneOriginal, largura: 22 },
        { header: "nome_cliente", valor: r => r.nome, largura: 32 },
        { header: "motivo", valor: r => (r.motivo === "duplicado" ? "Repetido na lista" : "Telefone inválido"), largura: 20 },
      ], `${base}-invalidos`, "Invalidos");
    }
  };

  return (
    <Dialog open={!!campanha} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Users size={18} className="text-blue-600" /> Contatos da campanha</DialogTitle>
          <DialogDescription>{campanha?.nome} — audiência resolvida agora pelas fontes de dados vinculadas</DialogDescription>
        </DialogHeader>

        {isFetching ? (
          <div className="flex justify-center py-10"><Spinner className="size-6 text-muted-foreground" /></div>
        ) : isError ? (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>
              {error.message}
              {error.message.includes("fonte") && " Vá em \"Editar campanha\" → \"Fontes de dados\" para vincular ao menos uma."}
            </span>
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="rounded-lg border p-3 text-sm space-y-1.5">
              <p className="flex items-center gap-1.5"><Database size={13} className="text-slate-500" />
                <strong>{fmtNum(data.aprovados.length)}</strong> de {fmtNum(data.totalResolvido)} contatos resolvidos estão prontos para envio agora.
              </p>
              <ul className="text-[11px] text-muted-foreground list-disc list-inside">
                {data.porFonte.map((f, i) => (
                  <li key={i}>{f.fonte}: {fmtNum(f.total)} contato(s){f.semTelefone > 0 && `, ${fmtNum(f.semTelefone)} sem telefone`}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant={aba === "aprovados" ? "default" : "outline"} onClick={() => setAba("aprovados")}>
                Prontos para envio ({fmtNum(data.aprovados.length)})
              </Button>
              <Button size="sm" variant={aba === "ignorados" ? "default" : "outline"} onClick={() => setAba("ignorados")}>
                Em quarentena ({fmtNum(data.ignoradosQuarentenaGlobal.length + data.ignoradosCadenciaCampanha.length)})
              </Button>
              <Button size="sm" variant={aba === "invalidos" ? "default" : "outline"} onClick={() => setAba("invalidos")}>
                Inválidos/repetidos ({fmtNum(data.invalidosOuDuplicados.length)})
              </Button>
            </div>

            <div className="rounded-md border max-h-80 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    {aba === "invalidos" && <TableHead>Motivo</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.length === 0 ? (
                    <TableRow><TableCell colSpan={aba === "invalidos" ? 3 : 2} className="text-center text-muted-foreground py-6">Nenhum contato nesta lista.</TableCell></TableRow>
                  ) : linhas.slice(0, MAX_LISTA_TELA).map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-nowrap">{formatarTelefone(c.telefone ?? c.telefoneOriginal ?? "")}</TableCell>
                      <TableCell>{c.nome}</TableCell>
                      {aba === "invalidos" && <TableCell className="text-[11px] text-muted-foreground">{c.motivo === "duplicado" ? "Repetido" : "Telefone inválido"}</TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {linhas.length > MAX_LISTA_TELA && (
              <p className="text-[11px] text-muted-foreground">Mostrando as {MAX_LISTA_TELA} primeiras — baixe a lista para ver todos os {fmtNum(linhas.length)}.</p>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-row justify-between sm:justify-between">
          <Button variant="outline" className="gap-1.5" onClick={baixar} disabled={!data || linhas.length === 0}>
            <Download size={14} /> Baixar esta lista (.xlsx)
          </Button>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
