import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, Plus, BarChart3, TrendingDown, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { toast } from "sonner";

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

const MOTIVOS_ATRASO = [
  "Falta de Insumo / Gestão de Estoque",
  "Falha/Quebra em Recurso de Produção (Máquinas)",
  "Erro de Projeto / Arquivo Incorreto",
  "Erro de Processo Anterior (Setor Antecessor falhou)",
  "Erro Comercial ou Demora na Aprovação do Cliente",
  "Capacidade Operacional / Sobrecarga de Demanda",
];

interface RegistroAtraso {
  id: number;
  osNumero: string;
  setor: string;
  motivo: string;
  horasAtraso: number;
  temRetrabalho: boolean;
  dataCriacao: Date;
}

interface AnaliseGargalo {
  setor: string;
  totalHoras: number;
  quantidadeOS: number;
  percentualRetrabalho: number;
  motivosPrincipais: { motivo: string; count: number }[];
}

export default function GestaoAtrasosPage() {
  const [osNumero, setOsNumero] = useState("");
  const [setorSelecionado, setSetorSelecionado] = useState("");
  const [motivoSelecionado, setMotivoSelecionado] = useState("");
  const [horasAtraso, setHorasAtraso] = useState("");
  const [temRetrabalho, setTemRetrabalho] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const [registros, setRegistros] = useState<RegistroAtraso[]>([]);
  const [analiseGargalos, setAnaliseGargalos] = useState<AnaliseGargalo[]>([]);

  // Simular dados para demonstração
  const carregarDados = () => {
    // Dados simulados de atrasos
    const dadosSimulados: RegistroAtraso[] = [
      {
        id: 1,
        osNumero: "6610",
        setor: "Pintura",
        motivo: "Falha/Quebra em Recurso de Produção (Máquinas)",
        horasAtraso: 8,
        temRetrabalho: true,
        dataCriacao: new Date(),
      },
      {
        id: 2,
        osNumero: "6610",
        setor: "Corte Laser Fibra",
        motivo: "Erro de Projeto / Arquivo Incorreto",
        horasAtraso: 4,
        temRetrabalho: true,
        dataCriacao: new Date(),
      },
      {
        id: 3,
        osNumero: "6611",
        setor: "Solda e Serralheria",
        motivo: "Falta de Insumo / Gestão de Estoque",
        horasAtraso: 6,
        temRetrabalho: false,
        dataCriacao: new Date(),
      },
    ];
    setRegistros(dadosSimulados);

    // Calcular gargalos
    const gargalos: Record<string, AnaliseGargalo> = {};
    dadosSimulados.forEach((reg) => {
      if (!gargalos[reg.setor]) {
        gargalos[reg.setor] = {
          setor: reg.setor,
          totalHoras: 0,
          quantidadeOS: 0,
          percentualRetrabalho: 0,
          motivosPrincipais: [],
        };
      }
      gargalos[reg.setor].totalHoras += reg.horasAtraso;
      gargalos[reg.setor].quantidadeOS += 1;
      if (reg.temRetrabalho) {
        gargalos[reg.setor].percentualRetrabalho += 1;
      }
    });

    // Calcular percentual de retrabalho
    Object.keys(gargalos).forEach((setor) => {
      gargalos[setor].percentualRetrabalho = (
        (gargalos[setor].percentualRetrabalho / gargalos[setor].quantidadeOS) *
        100
      ).toFixed(1) as any;
    });

    setAnaliseGargalos(Object.values(gargalos).sort((a, b) => b.totalHoras - a.totalHoras));
  };

  const handleRegistrarAtraso = () => {
    if (!osNumero || !setorSelecionado || !motivoSelecionado || !horasAtraso) {
      toast.error("Preencha todos os campos");
      return;
    }

    const novoRegistro: RegistroAtraso = {
      id: registros.length + 1,
      osNumero,
      setor: setorSelecionado,
      motivo: motivoSelecionado,
      horasAtraso: parseFloat(horasAtraso),
      temRetrabalho,
      dataCriacao: new Date(),
    };

    setRegistros([...registros, novoRegistro]);
    toast.success("Atraso registrado com sucesso!");

    // Limpar formulário
    setOsNumero("");
    setSetorSelecionado("");
    setMotivoSelecionado("");
    setHorasAtraso("");
    setTemRetrabalho(false);
    setIsDialogOpen(false);

    // Recalcular gargalos
    carregarDados();
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader
        title="Gestão de Atrasos"
        description="Registre e analise atrasos de produção para identificar gargalos"
      />

      {/* Botão Registrar Atraso */}
      <div className="mb-6">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={carregarDados}>
              <Plus size={18} />
              Registrar Atraso
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registrar Atraso de Produção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Número da OS
                </label>
                <Input
                  placeholder="Ex: 6610"
                  value={osNumero}
                  onChange={(e) => setOsNumero(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Setor
                </label>
                <Select value={setorSelecionado} onValueChange={setSetorSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um setor" />
                  </SelectTrigger>
                  <SelectContent>
                    {SETORES.map((setor) => (
                      <SelectItem key={setor} value={setor}>
                        {setor}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Motivo do Atraso
                </label>
                <Select value={motivoSelecionado} onValueChange={setMotivoSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_ATRASO.map((motivo) => (
                      <SelectItem key={motivo} value={motivo}>
                        {motivo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Horas de Atraso
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 8"
                  value={horasAtraso}
                  onChange={(e) => setHorasAtraso(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="retrabalho"
                  checked={temRetrabalho}
                  onChange={(e) => setTemRetrabalho(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="retrabalho" className="text-sm font-medium text-gray-700">
                  Há retrabalho associado?
                </label>
              </div>

              <Button onClick={handleRegistrarAtraso} className="w-full">
                Registrar Atraso
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total de Horas Atrasadas</p>
              <p className="text-2xl font-bold text-gray-900">
                {registros.reduce((sum, r) => sum + r.horasAtraso, 0)}h
              </p>
            </div>
            <TrendingDown className="text-red-500" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">OSs com Atraso</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(registros.map((r) => r.osNumero)).size}
              </p>
            </div>
            <AlertTriangle className="text-orange-500" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Taxa de Retrabalho</p>
              <p className="text-2xl font-bold text-gray-900">
                {registros.length > 0
                  ? ((registros.filter((r) => r.temRetrabalho).length / registros.length) * 100).toFixed(1)
                  : 0}
                %
              </p>
            </div>
            <AlertCircle className="text-yellow-500" size={32} />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Setores Impactados</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(registros.map((r) => r.setor)).size}
              </p>
            </div>
            <BarChart3 className="text-blue-500" size={32} />
          </div>
        </Card>
      </div>

      {/* Análise de Gargalos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Gargalos Principais */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Gargalos Principais</h2>
          <div className="space-y-3">
            {analiseGargalos.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Nenhum atraso registrado ainda</EmptyTitle>
                </EmptyHeader>
              </Empty>
            ) : (
              analiseGargalos.map((gargalo, idx) => (
                <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold text-gray-900">{gargalo.setor}</p>
                      <p className="text-xs text-gray-600">
                        {gargalo.quantidadeOS} OS(s) | {gargalo.totalHoras}h atrasadas
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-semibold rounded">
                      {gargalo.percentualRetrabalho}% retrabalho
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-red-500 h-2 rounded-full"
                      style={{
                        width: `${Math.min((gargalo.totalHoras / 24) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Distribuição de Motivos */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Distribuição de Motivos</h2>
          <div className="space-y-3">
            {MOTIVOS_ATRASO.map((motivo) => {
              const count = registros.filter((r) => r.motivo === motivo).length;
              const percentual = registros.length > 0 ? (count / registros.length) * 100 : 0;
              return (
                <div key={motivo} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <p className="text-sm font-medium text-gray-900">{motivo}</p>
                    <span className="text-xs font-semibold text-gray-600">{count} registros</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${percentual}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Tabela de Registros */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Registros Detalhados</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold text-gray-900">OS</TableHead>
              <TableHead className="font-semibold text-gray-900">Setor</TableHead>
              <TableHead className="font-semibold text-gray-900">Motivo</TableHead>
              <TableHead className="font-semibold text-gray-900">Horas</TableHead>
              <TableHead className="font-semibold text-gray-900">Retrabalho</TableHead>
              <TableHead className="font-semibold text-gray-900">Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {registros.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  Nenhum atraso registrado
                </TableCell>
              </TableRow>
            ) : (
              registros.map((reg) => (
                <TableRow key={reg.id}>
                  <TableCell className="font-medium text-gray-900">{reg.osNumero}</TableCell>
                  <TableCell className="text-gray-700">{reg.setor}</TableCell>
                  <TableCell className="whitespace-normal text-gray-700 text-xs">{reg.motivo}</TableCell>
                  <TableCell className="font-semibold text-red-600">{reg.horasAtraso}h</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded text-xs font-semibold ${
                        reg.temRetrabalho
                          ? "bg-red-100 text-red-800"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {reg.temRetrabalho ? "Sim" : "Não"}
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {new Date(reg.dataCriacao).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
