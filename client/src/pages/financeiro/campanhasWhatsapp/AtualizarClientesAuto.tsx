import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Spinner } from "@/components/ui/spinner";

/**
 * Mantém o espelho do cadastro de clientes do MubiSys em dia sem ninguém apertar nada: ao abrir o painel, se estiver
 * vazio ou com mais de 24h, lê o cadastro em lotes e, ao terminar, recarrega as listas (os telefones faltantes das
 * campanhas vêm dali). Em caso de erro, avisa e tenta de novo na próxima abertura.
 */
export default function AtualizarClientesAuto() {
  const utils = trpc.useUtils();
  const status = trpc.campanhasWhatsapp.clientesCacheStatus.useQuery(undefined, { staleTime: 10 * 60_000, refetchOnWindowFocus: false });
  const lote = trpc.campanhasWhatsapp.clientesCacheLote.useMutation();
  const [progresso, setProgresso] = useState<{ pagina: number; total: number } | null>(null);
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current || !status.data || !status.data.obsoleto) return;
    iniciou.current = true;
    (async () => {
      let pagina = 1;
      try {
        while (true) {
          // Falha transitória (limite de requisições do MubiSys, timeout) retoma da mesma página em vez de abandonar.
          let r;
          for (let tentativa = 0; ; tentativa++) {
            try { r = await lote.mutateAsync({ pagina }); break; }
            catch (e) {
              if (tentativa >= 3) throw e;
              await new Promise(res => setTimeout(res, 3000 * (tentativa + 1)));
            }
          }
          setProgresso({ pagina: (r.proximaPagina ?? r.ultimaPagina), total: r.ultimaPagina });
          if (r.proximaPagina == null) break;
          pagina = r.proximaPagina;
        }
        await Promise.all([
          utils.campanhasWhatsapp.clientesCacheStatus.invalidate(),
          utils.campanhasWhatsapp.gerarListaDaCampanha.invalidate(),
          utils.campanhasWhatsapp.contagemAudiencias.invalidate(),
          utils.campanhasWhatsapp.listar.invalidate(),
        ]);
      } catch (e) {
        iniciou.current = false;
        toast.error(`Não consegui atualizar o cadastro de clientes: ${e instanceof Error ? e.message : "erro"}. Os telefones faltantes das listas podem estar incompletos.`);
      } finally {
        setProgresso(null);
      }
    })();
  }, [status.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!progresso) return null;
  return (
    <div className="flex items-center gap-2 rounded-md border bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <Spinner className="size-3.5" />
      Atualizando o cadastro de clientes do MubiSys para completar telefones (página {progresso.pagina} de {progresso.total})…
    </div>
  );
}
