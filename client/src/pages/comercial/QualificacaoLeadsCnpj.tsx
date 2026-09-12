import { useState } from "react";
import { trpc } from "@/lib/trpc";
import PageHeader from "@/components/PageHeader";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { fmtBrl, fmtDate } from "@/lib/format";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { Search, Building2, AlertTriangle, CheckCircle2, XCircle, Users2 } from "lucide-react";

const SCORE_COR: Record<string, string> = {
  A: "bg-green-50 text-green-700 border-green-200",
  B: "bg-blue-50 text-blue-700 border-blue-200",
  C: "bg-amber-50 text-amber-700 border-amber-200",
  D: "bg-red-50 text-red-700 border-red-200",
};

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export default function QualificacaoLeadsCnpj() {
  const [cnpjInput, setCnpjInput] = useState("");
  const utils = trpc.useUtils();
  const { data: historico, isLoading: loadingHistorico } = trpc.leadsCnpj.listar.useQuery({});
  const consultarMut = trpc.leadsCnpj.consultar.useMutation({
    onSuccess: () => utils.leadsCnpj.listar.invalidate(),
  });

  function handleConsultar() {
    if (!cnpjInput.trim()) return;
    consultarMut.mutate({ cnpj: cnpjInput.trim() });
  }

  const resultado = consultarMut.data;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <PageHeader
        title="Qualificação de Leads por CNPJ"
        description="Consulte um CNPJ e veja se a empresa se encaixa no perfil de gráficas, agências de comunicação visual, birôs de impressão ou sinalização — nosso público-alvo para terceirização."
        icon={Building2}
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[240px]">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">CNPJ (com ou sem pontuação)</label>
            <input
              value={cnpjInput}
              onChange={e => setCnpjInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleConsultar(); }}
              placeholder="00.000.000/0001-00"
              className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </div>
          <Button onClick={handleConsultar} disabled={consultarMut.isPending} className="gap-1.5">
            <Search className="w-4 h-4" />
            {consultarMut.isPending ? "Consultando..." : "Consultar"}
          </Button>
        </div>
        {consultarMut.isError && (
          <p className="text-xs text-red-600 mt-2">{(consultarMut.error as any)?.message ?? "Erro ao consultar o CNPJ."}</p>
        )}
      </div>

      {resultado && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-bold text-slate-800">{resultado.dados.razao_social}</h3>
              {resultado.dados.nome_fantasia && <p className="text-xs text-slate-400">{resultado.dados.nome_fantasia}</p>}
              <p className="text-xs text-slate-500 mt-1">{resultado.dados.municipio}/{resultado.dados.uf} — {resultado.dados.porte_empresa}</p>
            </div>
            {resultado.resultado.aprovado ? (
              <Badge className={SCORE_COR[resultado.resultado.score ?? "D"]}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Score {resultado.resultado.score}
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-500 border-slate-200">
                <XCircle className="w-3.5 h-3.5" /> Rejeitado automaticamente
              </Badge>
            )}
          </div>

          {!resultado.resultado.aprovado && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
              {resultado.resultado.motivoRejeicao}
            </div>
          )}

          {resultado.resultado.aprovado && resultado.resultado.fatoresScore && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Porte</p>
                <p className="text-sm font-bold text-slate-800">{resultado.resultado.fatoresScore.porte.valor} ({resultado.resultado.fatoresScore.porte.pontos} pts)</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Capital social</p>
                <p className="text-sm font-bold text-slate-800">{fmtBrl(resultado.resultado.fatoresScore.capitalSocial.valorNumerico)} ({resultado.resultado.fatoresScore.capitalSocial.pontos} pts)</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase font-bold">Idade</p>
                <p className="text-sm font-bold text-slate-800">{resultado.resultado.fatoresScore.idadeAnos.valor} anos ({resultado.resultado.fatoresScore.idadeAnos.pontos} pts)</p>
              </div>
              {resultado.resultado.fatoresScore.ajusteConfiancaMedia && (
                <p className="col-span-3 text-[11px] text-amber-600">Score reduzido em uma letra — o(s) CNAE(s) encontrados são de confiança média (adjacente), não confiança alta.</p>
              )}
            </div>
          )}

          {resultado.resultado.cnaesRelevantes.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">CNAEs que bateram na lista-alvo</p>
              <div className="flex flex-wrap gap-1.5">
                {resultado.resultado.cnaesRelevantes.map((c: any, i: number) => (
                  <Badge key={i} className={c.confianca === "alta" ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-100 text-slate-600 border-slate-200"}>
                    {c.codigo}{c.isPrincipal ? " (principal)" : ""} — {c.descricao}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {resultado.dados.QSA?.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Users2 className="w-3 h-3" /> Quadro de sócios</p>
              <Table className="text-xs">
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Qualificação</TableHead><TableHead>Desde</TableHead></TableRow></TableHeader>
                <TableBody>
                  {resultado.dados.QSA.map((s: any, i: number) => (
                    <TableRow key={i}><TableCell>{s.nome_socio}</TableCell><TableCell>{s.qualificacao_socio}</TableCell><TableCell>{s.data_entrada_sociedade}</TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-700">Histórico de consultas</h3>
        </div>
        {loadingHistorico && <div className="p-6 text-xs text-slate-400">Carregando...</div>}
        {!loadingHistorico && (!historico || historico.length === 0) && (
          <div className="p-8">
            <Empty><EmptyHeader><EmptyMedia variant="icon"><Building2 /></EmptyMedia><EmptyTitle>Nenhuma consulta ainda</EmptyTitle><EmptyDescription>Consulte um CNPJ acima para começar.</EmptyDescription></EmptyHeader></Empty>
          </div>
        )}
        {!loadingHistorico && historico && historico.length > 0 && (
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Consultado em</TableHead>
                <TableHead>Por</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-semibold">{l.razaoSocial}</TableCell>
                  <TableCell>{l.uf}</TableCell>
                  <TableCell>
                    {l.aprovado
                      ? <Badge className={SCORE_COR[l.score ?? "D"]}>{l.score}</Badge>
                      : <Badge className="bg-slate-100 text-slate-500 border-slate-200">Rejeitado</Badge>}
                  </TableCell>
                  <TableCell>{fmtDate(l.consultadoEm)}</TableCell>
                  <TableCell>{l.consultadoPor}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
