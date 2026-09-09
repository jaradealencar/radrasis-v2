import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, PlusCircle } from "lucide-react";
import { toast } from "sonner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

async function arquivoParaBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binario = "";
  const tamanhoChunk = 0x8000;
  for (let i = 0; i < bytes.length; i += tamanhoChunk) {
    binario += String.fromCharCode(...bytes.subarray(i, i + tamanhoChunk));
  }
  return btoa(binario);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export default function ImportarFechamentoMensal({ open, onOpenChange, onImported }: Props) {
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState<{
    mesesProcessados: Array<{
      mes: number; ano: number; status: "criado" | "atualizado"; camposVazios: string[];
      faturamentoOrigem: "manual" | "aproximado_caixa" | "sem_dado";
    }>;
    camposNaoEncontradosNaPlanilha: string[];
  } | null>(null);

  const upload = trpc.financeiro.uploadFechamentoMensal.useMutation({
    onSuccess: (r) => {
      setResultado(r);
      toast.success(`${r.mesesProcessados.length} mês(es) processado(s) a partir de "${r.nomeArquivo ?? "arquivo"}".`);
      onImported();
    },
    onError: (e) => toast.error("Erro ao processar a planilha: " + e.message),
  });

  function fechar() {
    onOpenChange(false);
    setNomeArquivo(null);
    setResultado(null);
  }

  async function handleFile(file: File) {
    setLendo(true);
    setNomeArquivo(file.name);
    setResultado(null);
    try {
      const arquivoBase64 = await arquivoParaBase64(file);
      upload.mutate({ arquivoBase64, nomeArquivo: file.name });
    } catch {
      toast.error("Não consegui ler esse arquivo.");
    } finally {
      setLendo(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); else onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-blue-600" />
            Importar Fechamento Financeiro Mensal
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-slate-50 border rounded-lg p-3">
            Envie o export <strong>"Fechamento -AAAA.MM.xlsx"</strong> (Google Sheets). O servidor lê a aba{" "}
            <strong>"Fluxo de Caixa"</strong> e grava/atualiza todos os meses presentes no cabeçalho em
            financeiro_mensal — despesas fixas/variáveis, TL1/TL2/TL3, impostos, comissões e afins.
            Se o <strong>Faturamento Oficial</strong> de um mês já foi confirmado com a contabilidade, ele{" "}
            <strong>nunca é sobrescrito</strong>. Se ainda estiver vazio, é preenchido com a linha "1 - Receitas"
            (caixa) como aproximação — que sabidamente não bate exato com o valor oficial — e fica marcado como
            "aproximado" no resumo abaixo para você revisar.
          </div>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 transition-colors">
            <Upload size={22} className="text-slate-400" />
            <span className="text-sm text-slate-600">
              {nomeArquivo ? nomeArquivo : "Clique para selecionar o arquivo (.xlsx)"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </label>

          {(lendo || upload.isPending) && (
            <div className="text-sm text-muted-foreground">Processando planilha…</div>
          )}

          {resultado && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 size={12} className="mr-1" /> {resultado.mesesProcessados.length} mês(es) processado(s)
                </Badge>
              </div>

              <div className="space-y-1.5">
                {resultado.mesesProcessados.map(m => {
                  // Campos cuja linha inteira não existe na planilha já aparecem no aviso
                  // geral abaixo — aqui mostra só os que vieram vazios para este mês específico.
                  const vaziosDoMes = m.camposVazios.filter(c => !resultado.camposNaoEncontradosNaPlanilha.includes(c));
                  return (
                    <div key={`${m.ano}-${m.mes}`} className="border rounded-lg p-2.5 text-xs">
                      <div className="flex items-center gap-2 font-semibold text-slate-700">
                        {m.status === "criado"
                          ? <PlusCircle size={13} className="text-blue-500" />
                          : <CheckCircle2 size={13} className="text-emerald-500" />}
                        {MESES[m.mes - 1]}/{m.ano}
                        <span className="font-normal text-muted-foreground">
                          ({m.status === "criado" ? "novo registro" : "atualizado"})
                        </span>
                      </div>
                      {m.faturamentoOrigem === "aproximado_caixa" && (
                        <div className="mt-1 text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>
                            Faturamento Oficial preenchido <strong>por aproximação</strong> (Receitas de caixa da
                            planilha) — confira com a contabilidade e ajuste no formulário se necessário.
                          </span>
                        </div>
                      )}
                      {m.faturamentoOrigem === "sem_dado" && (
                        <div className="mt-1 text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>Faturamento Oficial continua vazio — a planilha não trouxe a linha "1 - Receitas" para este mês.</span>
                        </div>
                      )}
                      {vaziosDoMes.length > 0 && (
                        <div className="mt-1 text-amber-700 flex items-start gap-1.5">
                          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                          <span>Sem valor na planilha para este mês: {vaziosDoMes.join(", ")}.</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {resultado.camposNaoEncontradosNaPlanilha.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs text-red-800">
                  <div className="font-semibold mb-1">
                    Linhas não encontradas na planilha (nenhum mês foi alterado nesses campos):
                  </div>
                  {resultado.camposNaoEncontradosNaPlanilha.join(", ")}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={fechar}>
            {resultado ? "Fechar" : "Cancelar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
