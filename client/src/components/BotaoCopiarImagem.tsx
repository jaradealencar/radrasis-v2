import { useState } from "react";
import { Check, ImageDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { copiarImagem, desenharImagem, type EspecImagem } from "@/lib/imagemCopia";

/** Copia (ou baixa, sem permissão de área de transferência) uma imagem PNG do resultado, para o vendedor colar na conversa. */
export function BotaoCopiarImagem({
  montar,
  nomeArquivo,
  className,
}: {
  /** Monta o conteúdo da imagem no momento do clique, com os valores atuais da simulação. */
  montar: () => EspecImagem;
  nomeArquivo: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function copiar() {
    setOcupado(true);
    try {
      const resultado = await copiarImagem(desenharImagem(montar()), nomeArquivo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 3000);
      if (resultado === "copiada") toast.success("Imagem copiada! Na conversa, aperte Ctrl+V.");
      else toast.info("Seu navegador não permitiu copiar; a imagem foi baixada.");
    } catch (erro) {
      toast.error(`Não consegui gerar a imagem (${erro instanceof Error ? erro.message : String(erro)}).`);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" className={`gap-2 ${className ?? ""}`} onClick={copiar} disabled={ocupado}>
      {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <ImageDown className="h-4 w-4" />}
      {copiado ? "Copiada!" : "Copiar imagem"}
    </Button>
  );
}
