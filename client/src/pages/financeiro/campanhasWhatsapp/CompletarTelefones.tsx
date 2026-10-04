import { useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, Square } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * "Completar telefones do histórico": copia do cadastro de contatos do MubiSys o telefone das vendas (O.S.)
 * e dos orçamentos que ainda não o têm, um mês por vez (do mais recente ao mais antigo). Deixe a janela aberta
 * até terminar; pode parar e continuar depois, pois só preenche o que está vazio.
 */
export default function CompletarTelefones({ onProgresso }: { onProgresso?: () => void }) {
  const utils = trpc.useUtils();
  const completarOs = trpc.campanhasWhatsapp.completarTelefonesHistorico.useMutation();
  const completarOrc = (trpc.campanhasWhatsapp as any).completarTelefonesOrcamentos?.useMutation?.();
  const [rodando, setRodando] = useState(false);
  const [tipo, setTipo] = useState<"os" | "orcamentos">("os");
  const [mesAtual, setMesAtual] = useState<string | null>(null);
  const [mesesFeitos, setMesesFeitos] = useState(0);
  const [preenchidos, setPreenchidos] = useState(0);
  const [restantes, setRestantes] = useState<number | null>(null);
  const parar = useRef(false);

  async function iniciar() {
    parar.current = false;
    setRodando(true);
    setMesesFeitos(0); setPreenchidos(0); setRestantes(null);
    const ignorar: string[] = [];
    let total = 0, meses = 0, comErro = 0;
    const completar = tipo === "os" ? completarOs : completarOrc;
    try {
      while (!parar.current) {
        const r = await completar.mutateAsync({ ignorar });
        if (!r.processado) break;
        const p = r.processado;
        ignorar.push(p.chave);
        meses++; total += p.atualizadas; comErro += p.janelasComErro;
        setMesAtual(`${MESES[p.mes - 1]}/${p.ano}`);
        setMesesFeitos(meses); setPreenchidos(total); setRestantes(r.mesesRestantes);
        onProgresso?.();
      }
      const tipoLabel = tipo === "os" ? "de vendas" : "de orçamentos";
      toast.success(
        parar.current
          ? `Interrompido: ${fmtNum(total)} telefones ${tipoLabel} preenchidos em ${fmtNum(meses)} mês(es).`
          : `Concluído: ${fmtNum(total)} telefones ${tipoLabel} preenchidos em ${fmtNum(meses)} mês(es).${comErro > 0 ? ` ${comErro} trecho(s) não responderam; rode de novo para completar.` : ""}`,
      );
    } catch (e) {
      toast.error(`Parei no meio: ${e instanceof Error ? e.message : "erro ao consultar o MubiSys"}. O que já foi preenchido ficou salvo.`);
    } finally {
      setRodando(false);
      setMesAtual(null);
      await Promise.all([utils.campanhasWhatsapp.gerarListaDaCampanha.invalidate(), utils.campanhasWhatsapp.contagemAudiencias.invalidate()]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {rodando ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { parar.current = true; }}>
          <Square size={12} /> Parar
        </Button>
      ) : (
        <>
          <Button size="sm" variant={tipo === "os" ? "default" : "outline"} className="gap-1.5" onClick={() => setTipo("os")}>
            <Phone size={13} /> Vendas (O.S.)
          </Button>
          <Button size="sm" variant={tipo === "orcamentos" ? "default" : "outline"} className="gap-1.5" onClick={() => setTipo("orcamentos")}>
            <Phone size={13} /> Orçamentos
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={iniciar}>
            Completar telefones
          </Button>
        </>
      )}
      {rodando ? (
        <span className="flex items-center gap-1.5">
          <Spinner className="size-3.5" />
          Buscando no MubiSys{mesAtual ? ` (${tipo === "os" ? "O.S." : "orçamento"}: ${mesAtual})` : ""} · {fmtNum(mesesFeitos)} mês(es), {fmtNum(preenchidos)} telefones
          {restantes != null ? ` · faltam ${fmtNum(restantes)} mês(es)` : ""}. Mantenha esta janela aberta.
        </span>
      ) : (
        <span>Copia o telefone do cadastro do MubiSys para as {tipo === "os" ? "vendas" : "orçamentos"} antigas que estão sem número (um mês por vez).</span>
      )}
    </div>
  );
}
