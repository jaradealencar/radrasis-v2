import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { AlertTriangle, TrendingDown, Clock, AlertCircle } from "lucide-react";
import PageHeader from "@/components/PageHeader";

const SETORES = [
  "Comercial",
  "Projeto e Criação",
  "Compras e Suprimentos",
  "Corte Laser Fibra",
  "Corte Laser CO2",
  "Corte CNC Router",
  "Dobra e Perfilamento",
  "Solda e Serralheria",
  "Pintura",
  "Instalação de LED",
  "Expedição e Acabamento",
];

const MOTIVOS = [
  "Falta de Insumo / Gestão de Estoque",
  "Falha/Quebra em Recurso de Produção",
  "Erro de Projeto / Arquivo Incorreto",
  "Erro de Processo Anterior",
  "Erro Comercial ou Demora na Aprovação",
  "Capacidade Operacional / Sobrecarga",
];

const CORES_SETORES: Record<string, string> = {
  "Comercial": "#3b82f6",
  "Projeto e Criação": "#8b5cf6",
  "Compras e Suprimentos": "#ec4899",
  "Corte Laser Fibra": "#f59e0b",
  "Corte Laser CO2": "#f97316",
  "Corte CNC Router": "#ef4444",
  "Dobra e Perfilamento": "#06b6d4",
  "Solda e Serralheria": "#14b8a6",
  "Pintura": "#10b981",
  "Instalação de LED": "#84cc16",
  "Expedição e Acabamento": "#6366f1",
};

interface RegistroAtraso {
  osNumero: string;
  setor: string;
  motivo: string;
  horasAtraso: number;
  temRetrabalho: boolean;
  data: string;
}

interface AnalisePorSetor {
  setor: string;
  totalHoras: number;
  quantidadeOSs: number;
  percentualRetrabalho: number;
  motivoPrincipal: string;
}

export default function AnaliseAtrasosPage() {
  const [registros, setRegistros] = useState<RegistroAtraso[]>([]);
  const [novoRegistro, setNovoRegistro] = useState<Partial<RegistroAtraso>>({
    temRetrabalho: false,
  });
  const [filtroSetor, setFiltroSetor] = useState<string>("");
  const [filtroMotivo, setFiltroMotivo] = useState<string>("");
  const [dataPeriodo, setDataPeriodo] = useState<string>("");

  // Calcular análise por setor
  const analisePorSetor: AnalisePorSetor[] = SETORES.map((setor) => {
    const registrosSetor = registros.filter((r) => r.setor === setor);
    const totalHoras = registrosSetor.reduce((acc, r) => acc + r.horasAtraso, 0);
    const retrabalhos = registrosSetor.filter((r) => r.temRetrabalho).length;
    const percentualRetrabalho =
      registrosSetor.length > 0
        ? Math.round((retrabalhos / registrosSetor.length) * 100)
        : 0;

    // Motivo mais frequente
    const motivos = registrosSetor.map((r) => r.motivo);
    const motivoPrincipal =
      motivos.length > 0
        ? motivos.sort(
            (a, b) =>
              motivos.filter((m) => m === b).length -
              motivos.filter((m) => m === a).length
          )[0]
        : "N/A";

    return {
      setor,
      totalHoras,
      quantidadeOSs: registrosSetor.length,
      percentualRetrabalho,
      motivoPrincipal,
    };
  }).filter((a) => a.quantidadeOSs > 0);

  // Calcular análise por motivo
  const analisePorMotivo = MOTIVOS.map((motivo) => {
    const registrosMotivo = registros.filter((r) => r.motivo === motivo);
    return {
      motivo,
      quantidade: registrosMotivo.length,
      horasTotal: registrosMotivo.reduce((acc, r) => acc + r.horasAtraso, 0),
    };
  }).filter((a) => a.quantidade > 0);

  // Gargalos principais (setores com mais atraso)
  const gargalosPrincipais = analisePorSetor
    .sort((a, b) => b.totalHoras - a.totalHoras)
    .slice(0, 5);

  // Retrabalhos por setor
  const retrabalhosPorSetor = analisePorSetor
    .filter((a) => a.percentualRetrabalho > 0)
    .sort((a, b) => b.percentualRetrabalho - a.percentualRetrabalho)
    .slice(0, 5);

  // Adicionar novo registro
  const handleAdicionarRegistro = () => {
    if (
      novoRegistro.osNumero &&
      novoRegistro.setor &&
      novoRegistro.motivo &&
      novoRegistro.horasAtraso
    ) {
      setRegistros([
        ...registros,
        {
          osNumero: novoRegistro.osNumero,
          setor: novoRegistro.setor,
          motivo: novoRegistro.motivo,
          horasAtraso: novoRegistro.horasAtraso,
          temRetrabalho: novoRegistro.temRetrabalho || false,
          data: new Date().toISOString().split("T")[0],
        },
      ]);
      setNovoRegistro({ temRetrabalho: false });
    }
  };

  const totalHorasAtraso = registros.reduce((acc, r) => acc + r.horasAtraso, 0);
  const totalOSsAtrasadas = new Set(registros.map((r) => r.osNumero)).size;
  const percentualRetrabalhoGeral = registros.filter(
    (r) => r.temRetrabalho
  ).length;

  return (
    <div className="w-full max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Análise de Atrasos"
        description="Inteligência de gargalos, causa-raiz e recomendações de ação"
      />

      {/* KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Horas de Atraso</p>
              <p className="text-2xl font-bold text-red-600">
                {totalHorasAtraso}h
              </p>
            </div>
            <Clock className="w-8 h-8 text-red-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">OSs Atrasadas</p>
              <p className="text-2xl font-bold text-orange-600">
                {totalOSsAtrasadas}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Registros com Retrabalho</p>
              <p className="text-2xl font-bold text-purple-600">
                {percentualRetrabalhoGeral}
              </p>
            </div>
            <TrendingDown className="w-8 h-8 text-purple-600 opacity-20" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Setores Impactados</p>
              <p className="text-2xl font-bold text-blue-600">
                {analisePorSetor.length}
              </p>
            </div>
            <AlertCircle className="w-8 h-8 text-blue-600 opacity-20" />
          </div>
        </Card>
      </div>

      {/* Formulário de Entrada */}
      <Card className="p-6">
        <h2 className="text-lg font-bold mb-4">Registrar Atraso</h2>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <Input
            placeholder="OS"
            value={novoRegistro.osNumero || ""}
            onChange={(e) =>
              setNovoRegistro({ ...novoRegistro, osNumero: e.target.value })
            }
          />
          <Select
            value={novoRegistro.setor || ""}
            onValueChange={(value) =>
              setNovoRegistro({ ...novoRegistro, setor: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              {SETORES.map((setor) => (
                <SelectItem key={setor} value={setor}>
                  {setor}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={novoRegistro.motivo || ""}
            onValueChange={(value) =>
              setNovoRegistro({ ...novoRegistro, motivo: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((motivo) => (
                <SelectItem key={motivo} value={motivo}>
                  {motivo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            type="number"
            placeholder="Horas de Atraso"
            value={novoRegistro.horasAtraso || ""}
            onChange={(e) =>
              setNovoRegistro({
                ...novoRegistro,
                horasAtraso: parseFloat(e.target.value),
              })
            }
          />

          <label className="flex items-center gap-2 px-3 py-2 border rounded-md bg-white cursor-pointer">
            <input
              type="checkbox"
              checked={novoRegistro.temRetrabalho || false}
              onChange={(e) =>
                setNovoRegistro({
                  ...novoRegistro,
                  temRetrabalho: e.target.checked,
                })
              }
            />
            <span className="text-sm">Retrabalho</span>
          </label>

          <Button onClick={handleAdicionarRegistro} className="bg-blue-600">
            Adicionar
          </Button>
        </div>
      </Card>

      {/* Gráficos */}
      {registros.length > 0 && (
        <>
          {/* Gargalos por Setor */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">
              🔴 Gargalos Principais - Horas de Atraso por Setor
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={gargalosPrincipais}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="setor" angle={-45} textAnchor="end" height={80} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="totalHoras" fill="#ef4444" name="Horas de Atraso" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Análise Detalhada por Setor */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">
              📊 Análise Detalhada por Setor
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">Setor</th>
                    <th className="px-4 py-2 text-center">OSs Atrasadas</th>
                    <th className="px-4 py-2 text-center">Total de Horas</th>
                    <th className="px-4 py-2 text-center">% Retrabalho</th>
                    <th className="px-4 py-2 text-left">Motivo Principal</th>
                  </tr>
                </thead>
                <tbody>
                  {analisePorSetor
                    .sort((a, b) => b.totalHoras - a.totalHoras)
                    .map((analise) => (
                      <tr key={analise.setor} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{analise.setor}</td>
                        <td className="px-4 py-2 text-center">
                          {analise.quantidadeOSs}
                        </td>
                        <td className="px-4 py-2 text-center font-bold text-red-600">
                          {analise.totalHoras}h
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span
                            className={`px-2 py-1 rounded text-white text-xs font-bold ${
                              analise.percentualRetrabalho > 50
                                ? "bg-red-600"
                                : analise.percentualRetrabalho > 25
                                ? "bg-orange-600"
                                : "bg-green-600"
                            }`}
                          >
                            {analise.percentualRetrabalho}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {analise.motivoPrincipal}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Motivos de Atraso */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">
              🎯 Distribuição de Motivos de Atraso
            </h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analisePorMotivo}
                  dataKey="quantidade"
                  nameKey="motivo"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {analisePorMotivo.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        [
                          "#ef4444",
                          "#f97316",
                          "#f59e0b",
                          "#eab308",
                          "#84cc16",
                          "#22c55e",
                        ][index % 6]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>

          {/* Retrabalhos por Setor */}
          {retrabalhosPorSetor.length > 0 && (
            <Card className="p-6">
              <h2 className="text-lg font-bold mb-4">
                ⚠️ Setores com Maior Taxa de Retrabalho
              </h2>
              <div className="space-y-3">
                {retrabalhosPorSetor.map((setor) => (
                  <div
                    key={setor.setor}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200"
                  >
                    <div>
                      <p className="font-medium">{setor.setor}</p>
                      <p className="text-sm text-gray-600">
                        {setor.quantidadeOSs} OSs com{" "}
                        {setor.percentualRetrabalho}% de retrabalho
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-red-600">
                        {setor.percentualRetrabalho}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Registros Detalhados */}
          <Card className="p-6">
            <h2 className="text-lg font-bold mb-4">📋 Registros Detalhados</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left">OS</th>
                    <th className="px-4 py-2 text-left">Setor</th>
                    <th className="px-4 py-2 text-left">Motivo</th>
                    <th className="px-4 py-2 text-center">Horas</th>
                    <th className="px-4 py-2 text-center">Retrabalho</th>
                    <th className="px-4 py-2 text-left">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {registros.map((registro, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">
                        {registro.osNumero}
                      </td>
                      <td className="px-4 py-2">{registro.setor}</td>
                      <td className="px-4 py-2 text-xs">{registro.motivo}</td>
                      <td className="px-4 py-2 text-center font-bold">
                        {registro.horasAtraso}h
                      </td>
                      <td className="px-4 py-2 text-center">
                        {registro.temRetrabalho ? (
                          <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                            Sim
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-bold">
                            Não
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">{registro.data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {registros.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-gray-600">
            Nenhum registro de atraso ainda. Comece a adicionar dados acima!
          </p>
        </Card>
      )}
    </div>
  );
}
