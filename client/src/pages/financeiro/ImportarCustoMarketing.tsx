import { useState } from "react";
import * as XLSX from "xlsx";
import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type Categoria = "aquisicao" | "reativacao";

interface LinhaParseada {
  linha: number;
  mes: number | null;
  ano: number | null;
  categoria: Categoria | null;
  categoriaOriginal: string;
  valor: number | null;
  descricao: string;
  valido: boolean;
}

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function encontrarColuna(headers: string[], candidatos: string[]): string | null {
  for (const h of headers) {
    const hn = normalizar(h);
    if (candidatos.some(c => hn.includes(c))) return h;
  }
  return null;
}

function parseMesAno(valor: unknown, anoFallback: number): { mes: number | null; ano: number | null } {
  if (valor instanceof Date) {
    return { mes: valor.getMonth() + 1, ano: valor.getFullYear() };
  }
  if (typeof valor === "number") {
    // Serial date do Excel (dias desde 1899-12-30)
    const data = new Date(Math.round((valor - 25569) * 86400 * 1000));
    if (!isNaN(data.getTime())) return { mes: data.getUTCMonth() + 1, ano: data.getUTCFullYear() };
    return { mes: null, ano: null };
  }
  const s = normalizar(String(valor ?? ""));
  if (!s) return { mes: null, ano: null };

  // Nome do mês, com ou sem ano (ex: "agosto", "agosto/2026", "ago/26")
  for (let i = 0; i < MESES.length; i++) {
    const nomeCompleto = normalizar(MESES[i]);
    const abrev = nomeCompleto.slice(0, 3);
    if (s.startsWith(nomeCompleto) || s.startsWith(abrev)) {
      const anoMatch = s.match(/(\d{4}|\d{2})\s*$/);
      let ano = anoFallback;
      if (anoMatch) {
        ano = anoMatch[1].length === 2 ? 2000 + parseInt(anoMatch[1], 10) : parseInt(anoMatch[1], 10);
      }
      return { mes: i + 1, ano };
    }
  }

  // dd/mm/yyyy ou mm/yyyy
  const dataMatch = s.match(/^(?:(\d{1,2})[\/\-])?(\d{1,2})[\/\-](\d{2,4})$/);
  if (dataMatch) {
    const mes = parseInt(dataMatch[2], 10);
    let ano = parseInt(dataMatch[3], 10);
    if (dataMatch[3].length === 2) ano += 2000;
    if (mes >= 1 && mes <= 12) return { mes, ano };
  }

  // yyyy-mm-dd
  const isoMatch = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}$/);
  if (isoMatch) {
    return { mes: parseInt(isoMatch[2], 10), ano: parseInt(isoMatch[1], 10) };
  }

  // só o número do mês
  const numMatch = s.match(/^(\d{1,2})$/);
  if (numMatch) {
    const mes = parseInt(numMatch[1], 10);
    if (mes >= 1 && mes <= 12) return { mes, ano: anoFallback };
  }

  return { mes: null, ano: null };
}

function parseCategoria(valor: unknown): Categoria | null {
  const s = normalizar(String(valor ?? ""));
  if (s.includes("reativ")) return "reativacao";
  if (s.includes("aquisi")) return "aquisicao";
  return null;
}

function parseValor(valor: unknown): number | null {
  if (typeof valor === "number") return valor;
  let s = String(valor ?? "").trim().replace(/r\$\s?/i, "");
  if (!s) return null;
  // Formato pt-BR "1.234,56" -> remove separador de milhar, vírgula vira ponto
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anoSel: number;
  onImported: () => void;
}

export default function ImportarCustoMarketing({ open, onOpenChange, anoSel, onImported }: Props) {
  const [nomeArquivo, setNomeArquivo] = useState<string | null>(null);
  const [linhas, setLinhas] = useState<LinhaParseada[]>([]);
  const [parsing, setParsing] = useState(false);

  const importar = trpc.financeiro.importCustoMarketingLote.useMutation({
    onSuccess: (resultado) => {
      toast.success(`Importação concluída: ${resultado.length} mês(es) atualizado(s).`);
      onImported();
      fechar();
    },
    onError: (e) => toast.error("Erro ao importar: " + e.message),
  });

  function fechar() {
    onOpenChange(false);
    setNomeArquivo(null);
    setLinhas([]);
  }

  async function handleFile(file: File) {
    setParsing(true);
    setNomeArquivo(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const linhasObj = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

      if (linhasObj.length === 0) {
        toast.error("Não encontrei linhas de dados na planilha.");
        setLinhas([]);
        return;
      }

      const headers = Object.keys(linhasObj[0]);
      const colMes = encontrarColuna(headers, ["mes", "data", "periodo"]);
      const colCategoria = encontrarColuna(headers, ["categoria", "tipo"]);
      const colValor = encontrarColuna(headers, ["valor", "investimento", "custo"]);
      const colDescricao = encontrarColuna(headers, ["descri", "observa", "obs"]);

      if (!colMes || !colCategoria || !colValor) {
        toast.error("Não encontrei as colunas de Mês, Categoria e Valor na planilha. Verifique o cabeçalho.");
        setLinhas([]);
        return;
      }

      const parsed: LinhaParseada[] = linhasObj.map((row, idx) => {
        const { mes, ano } = parseMesAno(row[colMes], anoSel);
        const categoria = parseCategoria(row[colCategoria]);
        const valor = parseValor(row[colValor]);
        const descricao = colDescricao ? String(row[colDescricao] ?? "") : "";
        return {
          linha: idx + 2,
          mes, ano, categoria,
          categoriaOriginal: String(row[colCategoria] ?? ""),
          valor, descricao,
          valido: mes != null && ano != null && categoria != null && valor != null && valor >= 0,
        };
      });

      setLinhas(parsed);
    } catch {
      toast.error("Não consegui ler esse arquivo. Confira se é um .csv ou .xlsx válido.");
      setLinhas([]);
    } finally {
      setParsing(false);
    }
  }

  const validas = linhas.filter(l => l.valido);
  const invalidas = linhas.filter(l => !l.valido);

  const totaisPorMes = new Map<string, { mes: number; ano: number; aquisicao: number; reativacao: number }>();
  for (const l of validas) {
    const chave = `${l.ano}-${l.mes}`;
    const atual = totaisPorMes.get(chave) ?? { mes: l.mes!, ano: l.ano!, aquisicao: 0, reativacao: 0 };
    if (l.categoria === "aquisicao") atual.aquisicao += l.valor!;
    else atual.reativacao += l.valor!;
    totaisPorMes.set(chave, atual);
  }
  const resumoMeses = Array.from(totaisPorMes.values()).sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);

  function fmtBRL(v: number): string {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function confirmarImportacao() {
    if (validas.length === 0) return;
    importar.mutate(validas.map(l => ({
      mes: l.mes!, ano: l.ano!, categoria: l.categoria!, valor: l.valor!,
    })));
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) fechar(); else onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet size={18} className="text-purple-600" />
            Importar planilha de custos de Marketing
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-xs text-muted-foreground bg-slate-50 border rounded-lg p-3">
            O arquivo deve ter colunas de <strong>Mês/Data</strong>, <strong>Categoria</strong> (Aquisição ou Reativação), <strong>Valor</strong> e opcionalmente Descrição.
            Aceita .csv ou .xlsx. Meses sem ano na coluna assumem o ano selecionado no painel ({anoSel}).
          </div>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-lg p-6 cursor-pointer hover:border-purple-400 transition-colors">
            <Upload size={22} className="text-slate-400" />
            <span className="text-sm text-slate-600">
              {nomeArquivo ? nomeArquivo : "Clique para selecionar o arquivo (.csv, .xlsx)"}
            </span>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </label>

          {parsing && <div className="text-sm text-muted-foreground">Lendo arquivo…</div>}

          {linhas.length > 0 && !parsing && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                  <CheckCircle2 size={12} className="mr-1" /> {validas.length} linha(s) válida(s)
                </Badge>
                {invalidas.length > 0 && (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    <AlertCircle size={12} className="mr-1" /> {invalidas.length} linha(s) com problema
                  </Badge>
                )}
              </div>

              {invalidas.length > 0 && (
                <div className="border border-red-200 bg-red-50 rounded-lg p-3 text-xs text-red-800 max-h-32 overflow-y-auto">
                  <div className="font-semibold mb-1">Linhas que não serão importadas (corrija o arquivo e reenvie se necessário):</div>
                  {invalidas.map(l => (
                    <div key={l.linha}>
                      Linha {l.linha}: {l.mes == null || l.ano == null ? "mês/data não reconhecido" : l.categoria == null ? `categoria "${l.categoriaOriginal}" não reconhecida (use "Aquisição" ou "Reativação")` : "valor inválido"}
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                  Resumo por mês (o que será salvo)
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-slate-50">
                      <TableHead>Mês</TableHead>
                      <TableHead className="text-right">Aquisição</TableHead>
                      <TableHead className="text-right">Reativação</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoMeses.map(r => (
                      <TableRow key={`${r.ano}-${r.mes}`}>
                        <TableCell className="font-medium">{MESES[r.mes - 1]}/{r.ano}</TableCell>
                        <TableCell className="text-right text-purple-700">{fmtBRL(r.aquisicao)}</TableCell>
                        <TableCell className="text-right text-cyan-700">{fmtBRL(r.reativacao)}</TableCell>
                        <TableCell className="text-right font-semibold">{fmtBRL(r.aquisicao + r.reativacao)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-3">
                Se já existir um valor lançado para algum desses meses, a importação <strong>soma</strong> ao que já está salvo (não substitui).
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button
            onClick={confirmarImportacao}
            disabled={validas.length === 0 || importar.isPending}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {importar.isPending ? "Importando…" : `Importar ${validas.length} lançamento(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
