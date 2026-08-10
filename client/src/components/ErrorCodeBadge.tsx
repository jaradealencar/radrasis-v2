import { trpc } from "@/lib/trpc";
import { useMemo } from "react";

/**
 * Exibe um badge com o código de erro.
 * Ao passar o cursor, mostra um tooltip com categoria, descrição e ação corretiva.
 * Usa os dados já carregados da biblioteca de erros (sem nova requisição).
 */
export function ErrorCodeBadge({ code, errorMap }: {
  code: string | null | undefined;
  errorMap?: Map<string, { category: string; description: string; correction: string }>;
}) {
  if (!code) return <span className="text-slate-400 text-xs">—</span>;

  const info = errorMap?.get(code);

  return (
    <div className="relative group/errcode inline-block">
      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 cursor-default whitespace-nowrap">
        {code}
      </span>
      {info && (
        <div className="absolute left-0 top-full mt-1.5 z-50 hidden group-hover/errcode:block w-72 p-3 rounded-lg bg-slate-800 text-white text-xs shadow-2xl border border-slate-600 pointer-events-none">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="font-bold text-blue-300">{code}</span>
            <span className="text-slate-400">·</span>
            <span className="text-slate-300 font-medium">{info.category}</span>
          </div>
          <p className="text-slate-200 mb-2 leading-relaxed">{info.description}</p>
          <div className="border-t border-slate-600 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">Ação Corretiva</p>
            <p className="text-green-300 leading-relaxed">{info.correction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook para carregar o mapa de erros uma vez e reutilizar em múltiplos componentes.
 */
export function useErrorMap() {
  const { data: errorLib } = trpc.errorLibrary.list.useQuery();
  return useMemo(
    () => new Map((errorLib ?? []).map(e => [e.code, { category: e.category, description: e.description, correction: e.correction }])),
    [errorLib]
  );
}
