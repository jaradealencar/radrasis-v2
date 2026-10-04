import { useRef, useState } from "react";
import { toast } from "sonner";
import { Phone, Square } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { fmtNum } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type TipoBackfill = "os" | "orcamentos";

/** Backfill retomável: uma janela/listagem por chamada e lotes pequenos de consultas pontuais. */
export default function CompletarTelefones({ onProgresso }: { onProgresso?: () => void }) {
  const utils = trpc.useUtils();
  const completarOs = trpc.campanhasWhatsapp.completarTelefonesHistorico.useMutation();
  const completarClienteId = trpc.campanhasWhatsapp.orcamentosClienteIdJanela.useMutation();
  const completarLoteOrcamentos = trpc.campanhasWhatsapp.orcamentosTelefoneLote.useMutation();
  const [tipo, setTipo] = useState<TipoBackfill>("os");
  const [rodando, setRodando] = useState(false);
  const [etapa, setEtapa] = useState("");
  const [rotulo, setRotulo] = useState<string | null>(null);
  const [blocosFeitos, setBlocosFeitos] = useState(0);
  const [preenchidos, setPreenchidos] = useState(0);
  const [restantes, setRestantes] = useState<number | null>(null);
  const parar = useRef(false);

  async function iniciar() {
    parar.current = false;
    setRodando(true);
    setEtapa(tipo === "os" ? "O.S." : "Vinculando orçamentos aos clientes");
    setBlocosFeitos(0);
    setPreenchidos(0);
    setRestantes(null);
    setRotulo(null);

    let totalPreenchido = 0;
    let semVinculo = 0;
    let blocos = 0;
    const falhas: string[] = [];

    try {
      if (tipo === "os") {
        const ignorar: string[] = [];
        while (!parar.current) {
          const r = await completarOs.mutateAsync({ ignorar });
          const p = r.processado;
          if (!p) {
            setRestantes(0);
            break;
          }

          ignorar.push(p.chave);
          blocos++;
          totalPreenchido += p.atualizadas;
          if (p.erro) falhas.push(`${p.di} a ${p.df}: ${p.erro}`);
          setRotulo(`${p.di} a ${p.df}`);
          setBlocosFeitos(blocos);
          setPreenchidos(totalPreenchido);
          setRestantes(r.janelasRestantes);
          onProgresso?.();
        }
      } else {
        const plano = await utils.campanhasWhatsapp.orcamentosClienteIdPlano.fetch();
        const janelas = plano.flatMap(m => m.janelas);
        setRestantes(janelas.length);

        for (const janela of janelas) {
          if (parar.current) break;
          try {
            await completarClienteId.mutateAsync(janela);
          } catch (erro) {
            console.error(`[TELEFONE-ORC] Falha na janela ${janela.di}..${janela.df}:`, erro);
            falhas.push(`${janela.di} a ${janela.df}: ${erro instanceof Error ? erro.message : "erro do MubiSys"}`);
          }
          blocos++;
          setRotulo(`${janela.di} a ${janela.df}`);
          setBlocosFeitos(blocos);
          setRestantes(janelas.length - blocos);
          onProgresso?.();
        }

        if (!parar.current) {
          setEtapa("Consultando telefones dos clientes");
          let pagina = 1;
          semVinculo = 0;
          while (!parar.current) {
            const r = await completarLoteOrcamentos.mutateAsync({ pagina, limitePorLote: 12 });
            blocos++;
            totalPreenchido += r.atualizadas;
            falhas.push(...r.falhasIds.map(id => `cliente ${id}`));
            semVinculo = r.semClienteVinculado;
            setRotulo(`${fmtNum(r.consultados)} clientes consultados`);
            setBlocosFeitos(blocos);
            setPreenchidos(totalPreenchido);
            setRestantes(r.restantes);
            onProgresso?.();
            if (r.fimAlcancado || r.proximaPagina == null) break;
            pagina = r.proximaPagina;
          }
        }
      }

      const status = parar.current ? "Interrompido" : "Concluído";
      const detalhesFalhas = falhas.length
        ? ` ${fmtNum(falhas.length)} falha(s) foram registradas; exemplo: ${falhas[0]}. Execute novamente para tentar de novo.`
        : "";
      const detalheSemVinculo = semVinculo > 0
        ? ` ${fmtNum(semVinculo)} orçamento(s) seguem sem cliente vinculado (a etapa de vinculação por janela não os alcançou).`
        : "";
      toast.success(`${status}: ${fmtNum(totalPreenchido)} telefones preenchidos em ${fmtNum(blocos)} lote(s).${detalhesFalhas}${detalheSemVinculo}`);
    } catch (e) {
      toast.error(`Parei no meio: ${e instanceof Error ? e.message : "erro ao consultar o MubiSys"}. O que já foi preenchido ficou salvo.`);
    } finally {
      setRodando(false);
      setEtapa("");
      setRotulo(null);
      await Promise.all([
        utils.campanhasWhatsapp.gerarListaDaCampanha.invalidate(),
        utils.campanhasWhatsapp.contagemAudiencias.invalidate(),
        utils.campanhasWhatsapp.orcamentosClienteIdPlano.invalidate(),
      ]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
      {rodando ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { parar.current = true; }}>
          <Square size={12} /> Parar após a chamada atual
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
          {etapa}{rotulo ? ` (${rotulo})` : ""} · {fmtNum(blocosFeitos)} lote(s), {fmtNum(preenchidos)} telefones preenchidos
          {restantes != null ? ` · ${fmtNum(restantes)} pendentes` : ""}. Mantenha esta janela aberta.
        </span>
      ) : (
        <span>
          {tipo === "os"
            ? "Preenche O.S. antigas em janelas curtas, uma chamada por vez."
            : "Localiza o cliente de cada orçamento em janelas curtas e consulta telefones em lotes limitados."}
        </span>
      )}
    </div>
  );
}
