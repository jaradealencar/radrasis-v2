import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Streamdown } from "streamdown";
import { ChevronDown, ChevronUp, Users } from "lucide-react";

export default function Cargos() {
  const [expandedCargoId, setExpandedCargoId] = useState<number | null>(null);
  const { data: cargos = [] } = trpc.cargos.list.useQuery();

  const toggleExpand = (id: number) => {
    setExpandedCargoId(expandedCargoId === id ? null : id);
  };

  return (
      <div className="space-y-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">Gestão Organizacional</p>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users size={28} className="text-blue-600" />
            Desenho de Cargos e Funções
          </h1>
          <p className="text-sm mt-0.5 text-slate-500">
            Estrutura organizacional com responsabilidades, KPIs e requisitos de cada cargo
          </p>
        </div>

        {cargos.length === 0 ? (
          <Card>
            <CardContent className="p-8">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum cargo cadastrado ainda.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {cargos.map((cargo) => (
              <Card key={cargo.id} className="overflow-hidden">
                <button
                  onClick={() => toggleExpand(cargo.id)}
                  className="w-full text-left p-4 hover:bg-slate-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-800">{cargo.titulo}</h3>
                    {cargo.missao && (
                      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{cargo.missao}</p>
                    )}
                  </div>
                  {expandedCargoId === cargo.id ? (
                    <ChevronUp className="text-slate-400" />
                  ) : (
                    <ChevronDown className="text-slate-400" />
                  )}
                </button>

                {expandedCargoId === cargo.id && (
                  <CardContent className="p-4 border-t bg-slate-50 space-y-6">
                    {/* Missão */}
                    {cargo.missao && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Missão Estratégica</h4>
                        <p className="text-sm text-slate-600 leading-relaxed">{cargo.missao}</p>
                      </div>
                    )}

                    {/* Responsabilidades */}
                    {cargo.responsabilidades && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Responsabilidades e Funções</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.responsabilidades}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* KPIs */}
                    {cargo.kpis && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Indicadores de Desempenho (KPIs)</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.kpis}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* Ferramentas */}
                    {cargo.ferramentas && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Ferramentas e Recursos</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.ferramentas}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* Integração */}
                    {cargo.integracao && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Integração e Fluxo de Trabalho</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.integracao}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* Riscos */}
                    {cargo.riscos && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Gestão de Riscos</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.riscos}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* Requisitos */}
                    {cargo.requisitos && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Requisitos Técnicos e Perfil</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.requisitos}</Streamdown>
                        </div>
                      </div>
                    )}

                    {/* Condições */}
                    {cargo.condicoes && (
                      <div>
                        <h4 className="font-semibold text-slate-700 mb-2">Condições de Trabalho</h4>
                        <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                          <Streamdown>{cargo.condicoes}</Streamdown>
                        </div>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
  );
}
