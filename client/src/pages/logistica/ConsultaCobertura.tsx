import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle, XCircle, Search, MapPin, Truck , Home } from "lucide-react";
import { Link } from "wouter";
import PageHeader from "@/components/PageHeader";

const ESTADOS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

export default function ConsultaCobertura() {
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("SP");
  const [buscou, setBuscou] = useState(false);
  const [showAC, setShowAC] = useState(false);

  const { data, isLoading, refetch } = trpc.transportadoras.consultarCobertura.useQuery(
    { cidade, estado },
    { enabled: false }
  );
  const { data: sugestoes } = trpc.transportadoras.buscarMunicipios.useQuery(
    { q: cidade },
    { enabled: cidade.length >= 2 }
  );

  const buscar = () => {
    if (!cidade || !estado) return;
    setBuscou(true);
    refetch();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Barra de navegação */}
      <div className="flex items-center px-4 py-1.5" style={{ background: "oklch(0.16 0.015 245)", borderBottom: "1px solid oklch(0.22 0.02 245)" }}>
        <Link
          href="/"
          className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-semibold no-underline transition-all duration-150 hover:opacity-80"
          style={{ background: "oklch(0.28 0.02 245)", color: "oklch(0.90 0.005 240)", border: "1px solid oklch(0.35 0.02 245)", letterSpacing: "0.04em" }}
        >
          <Home size={12} style={{ color: "oklch(0.62 0.18 240)" }} />
          VOLTAR PARA HOME
        </Link>
      </div>
      <PageHeader
        title="Consulta de Cobertura"
        description="Verifique quais transportadoras atendem uma cidade"
        icon={MapPin}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Label>Cidade</Label>
              <Input
                value={cidade}
                onChange={e => { setCidade(e.target.value); setShowAC(true); }}
                onFocus={() => setShowAC(true)}
                onBlur={() => setTimeout(() => setShowAC(false), 150)}
                placeholder="Ex: São Paulo"
                onKeyDown={e => e.key === "Enter" && buscar()}
              />
              {showAC && sugestoes && sugestoes.length > 0 && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                  {sugestoes.map((s, i) => (
                    <button key={i} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 hover:text-blue-700 border-b border-gray-50 last:border-0" onMouseDown={() => { setCidade(s.cidade); setEstado(s.estado); setShowAC(false); }}>
                      {s.cidade} — {s.estado}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-24">
              <Label>Estado</Label>
              <select
                value={estado}
                onChange={e => setEstado(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                {ESTADOS.map(uf => <option key={uf} value={uf}>{uf}</option>)}
              </select>
            </div>
            <Button onClick={buscar} disabled={!cidade || isLoading}>
              <Search className="w-4 h-4 mr-2" />
              {isLoading ? "Buscando..." : "Consultar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {buscou && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                Atendem {cidade}/{estado}
                <Badge className="ml-auto bg-green-100 text-green-700">{data.atende.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.atende.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma transportadora cadastrada atende esta cidade.</p>
              ) : (
                <div className="space-y-2">
                  {data.atende.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-100">
                      <Truck className="w-4 h-4 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{t.nome}</p>
                        {t.formaCotacao && <p className="text-xs text-muted-foreground capitalize">Cotação via {t.formaCotacao}</p>}
                      </div>
                      {t.whatsappContato && (
                        <a href={`https://wa.me/55${t.whatsappContato.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                          className="ml-auto text-xs text-green-600 hover:underline shrink-0">
                          WhatsApp
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-red-500">
                <XCircle className="w-5 h-5" />
                Não atendem
                <Badge className="ml-auto bg-red-50 text-red-600">{data.naoAtende.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.naoAtende.length === 0 ? (
                <p className="text-sm text-muted-foreground">Todas as transportadoras atendem esta cidade.</p>
              ) : (
                <div className="space-y-2">
                  {data.naoAtende.map((t: any) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-50/50 border border-red-100">
                      <Truck className="w-4 h-4 text-red-400 shrink-0" />
                      <p className="font-medium text-sm text-muted-foreground">{t.nome}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {!buscou && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>Digite uma cidade e estado para consultar a cobertura das transportadoras.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
