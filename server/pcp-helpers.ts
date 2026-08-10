import { and, eq, gte, lte, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { getPool } from "./db-connection";
import {
  producaoOrdens,
  producaoSetores,
  producaoAlertas,
  producaoHistoricoAltracoes,
  feriados,
  motivosAtraso,
  InsertProducaoOrdem,
  InsertProducaoSetor,
  InsertProducaoAlerta,
  InsertProducaoHistoricoAlteracao,
  ProducaoOrdem,
  ProducaoSetor,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (_db) return _db;
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL not set");
  _db = drizzle(getPool());
  return _db;
}

// ─── Feriados (Cálculo de Dias Úteis) ────────────────────────────────────────

export async function seedFeriados() {
  const db = await getDb();
  const feriadosFixos = [
    { data: "2026-01-01", descricao: "Ano Novo" },
    { data: "2026-02-10", descricao: "Carnaval" },
    { data: "2026-04-21", descricao: "Tiradentes" },
    { data: "2026-05-01", descricao: "Dia do Trabalho" },
    { data: "2026-06-04", descricao: "Corpus Christi" },
    { data: "2026-09-07", descricao: "Independência" },
    { data: "2026-10-12", descricao: "Nossa Senhora Aparecida" },
    { data: "2026-11-02", descricao: "Finados" },
    { data: "2026-11-15", descricao: "Proclamação da República" },
    { data: "2026-11-20", descricao: "Consciência Negra" },
    { data: "2026-12-25", descricao: "Natal" },
  ];

  for (const feriado of feriadosFixos) {
    try {
      await db.insert(feriados).values({
        data: new Date(feriado.data),
        descricao: feriado.descricao,
      });
    } catch {
      // Feriado já existe
    }
  }
}

export async function calcularDiasUteis(dataInicio: Date, dataFim: Date): Promise<number> {
  const db = await getDb();
  let diasUteis = 0;
  const data = new Date(dataInicio);

  // Buscar todos os feriados entre as datas
  const feriadosRange = await db
    .select()
    .from(feriados)
    .where(and(gte(feriados.data, dataInicio), lte(feriados.data, dataFim)));

  const feriadosSet = new Set(feriadosRange.map(f => f.data.toISOString().split("T")[0]));

  while (data <= dataFim) {
    const diaSemana = data.getDay();
    const dataStr = data.toISOString().split("T")[0];

    // Contar apenas seg-sex (1-5) e que não seja feriado
    if (diaSemana >= 1 && diaSemana <= 5 && !feriadosSet.has(dataStr)) {
      diasUteis++;
    }

    data.setDate(data.getDate() + 1);
  }

  return diasUteis;
}

export async function adicionarDiasUteis(dataInicio: Date, diasUteis: number): Promise<Date> {
  const db = await getDb();
  const data = new Date(dataInicio);
  let diasAdicionados = 0;

  // Buscar feriados para o próximo ano
  const feriadosRange = await db.select().from(feriados);
  const feriadosSet = new Set(feriadosRange.map(f => f.data.toISOString().split("T")[0]));

  while (diasAdicionados < diasUteis) {
    data.setDate(data.getDate() + 1);
    const diaSemana = data.getDay();
    const dataStr = data.toISOString().split("T")[0];

    if (diaSemana >= 1 && diaSemana <= 5 && !feriadosSet.has(dataStr)) {
      diasAdicionados++;
    }
  }

  return data;
}

// ─── Integração MubiSys ──────────────────────────────────────────────────────

interface MubiSysOS {
  id: string;
  numero: string;
  cliente: {
    nome: string;
    id: string;
  };
  descricao?: string;
  dataCriacao: string;
  itens?: Array<{
    descricao: string;
    material?: string;
  }>;
}

export async function buscarOSMubiSys(osNumero: string): Promise<MubiSysOS | null> {
  try {
    const os = await buscarOSPorNumero(osNumero);
    if (!os) {
      console.warn(`[PCP] OS ${osNumero} não encontrada no MubiSys`);
      return null;
    }
    return {
      id: String(os.id),
      numero: String(os.sequencial_ordem),
      cliente: { nome: os.cliente, id: String(os.cliente_id) },
      descricao: os.nome_trabalho || os.observacao_geral || "",
      dataCriacao: os.data_cadastro,
      itens: (os.itens || []).map((item) => ({
        descricao: item.descricao || item.item,
        material: item.item,
      })),
    };
  } catch (error) {
    console.error("[PCP] Erro ao buscar OS no MubiSys:", error);
    return null;
  }
}

// ─── Identificação de Setores ────────────────────────────────────────────────

interface SetoresConfig {
  temProjeto: boolean;
  temCorteLaser: boolean;
  temCorteRouter: boolean;
  temImpressaoAdesivo: boolean;
  temImpressaoGabarito: boolean;
  temDobra: boolean;
  temSolda: boolean;
  temPintura: boolean;
  temMontagem: boolean;
  temExpedicao: boolean;
  temCorteLaserCO2: boolean;
  temPvcExpandido?: boolean;
  temAcrilico?: boolean;
  temGalvanizado?: boolean;
  temInox?: boolean;
  temPerfil?: boolean;
  temLed?: boolean;
  temAdesivo?: boolean;
  temGabarito?: boolean;
}

export function identificarSetores(os: MubiSysOS): SetoresConfig {
  const descricao = (os.descricao || "").toLowerCase();
  const itensDesc = (os.itens || []).map(i => (i.descricao || "").toLowerCase()).join(" ");
  const texto = `${descricao} ${itensDesc}`.toLowerCase();

  return {
    temProjeto: true, // Todos têm projeto
    temCorteLaser: /galvanizado|inox|metal/.test(texto),
    temCorteRouter: /pvc expandido|router/.test(texto),
    temImpressaoAdesivo: /adesivo/.test(texto),
    temImpressaoGabarito: /gabarito/.test(texto),
    temDobra: /perfil|dobra|galvanizado|inox/.test(texto),
    temSolda: /galvanizado|inox|solda/.test(texto),
    temPintura: /pintura|pintado|pintar/.test(texto),
    temMontagem: /led|montagem|montar/.test(texto),
    temExpedicao: true, // Todos têm expedição
    temCorteLaserCO2: /galvanizado|inox|metal/.test(texto),
    temPvcExpandido: /pvc expandido/.test(texto),
    temAcrilico: /acrilico|acr/.test(texto),
    temGalvanizado: /galvanizado/.test(texto),
    temInox: /inox/.test(texto),
    temPerfil: /perfil/.test(texto),
    temLed: /led/.test(texto),
    temAdesivo: /adesivo/.test(texto),
    temGabarito: /gabarito/.test(texto),
  };
}

// ─── Cálculo de Prazos ───────────────────────────────────────────────────────

export async function calcularPrazoEntrega(
  dataEntrada: Date,
  temPintura: boolean,
  temPvcExpandido: boolean,
  temAcrilico: boolean
): Promise<{ dataPrazo: Date; diasUteisTotais: number }> {
  let diasUteisTotais = 0;

  if (temPvcExpandido || temAcrilico) {
    diasUteisTotais = 3;
  } else if (temPintura) {
    diasUteisTotais = 10;
  } else {
    diasUteisTotais = 7;
  }

  // Começar contando um dia útil após entrada
  const dataInicio = new Date(dataEntrada);
  dataInicio.setDate(dataInicio.getDate() + 1);

  const dataPrazo = await adicionarDiasUteis(dataInicio, diasUteisTotais);

  return { dataPrazo, diasUteisTotais };
}

// ─── Configuração de Setores por Tipo ────────────────────────────────────────

const SETORES_CONFIG: Record<string, { dias: number; dependeDe: string[] }> = {
  projeto: { dias: 1, dependeDe: [] },
  corte_laser: { dias: 1, dependeDe: ["projeto"] },
  corte_router: { dias: 1, dependeDe: ["projeto"] },
  corte_laser_co2: { dias: 1, dependeDe: ["projeto"] },
  impressao_adesivo: { dias: 1, dependeDe: ["projeto"] },
  impressao_gabarito: { dias: 1, dependeDe: ["projeto"] },
  dobra_perfil: { dias: 1, dependeDe: ["projeto"] },
  solda: { dias: 1, dependeDe: ["dobra_perfil", "corte_laser"] },
  pintura: { dias: 2, dependeDe: ["solda", "dobra_perfil"] },
  montagem: { dias: 2, dependeDe: ["projeto", "corte_laser", "corte_router", "impressao_adesivo", "impressao_gabarito", "dobra_perfil", "solda", "pintura"] },
  expedicao: { dias: 2, dependeDe: ["montagem"] },
};

export async function criarSetoresOrdem(
  ordemId: number,
  setoresConfig: SetoresConfig,
  dataPrazoFinal: Date,
  diasUteisTotais: number,
  dataEntrada: Date
): Promise<ProducaoSetor[]> {
  const db = await getDb();
  const setoresCriados: ProducaoSetor[] = [];
  const setoresAtivos: string[] = [];

  // Determinar quais setores serão criados
  if (setoresConfig.temProjeto) setoresAtivos.push("projeto");
  if (setoresConfig.temCorteLaser) setoresAtivos.push("corte_laser");
  if (setoresConfig.temCorteRouter) setoresAtivos.push("corte_router");
  if (setoresConfig.temCorteLaserCO2) setoresAtivos.push("corte_laser_co2");
  if (setoresConfig.temImpressaoAdesivo) setoresAtivos.push("impressao_adesivo");
  if (setoresConfig.temImpressaoGabarito) setoresAtivos.push("impressao_gabarito");
  if (setoresConfig.temDobra) setoresAtivos.push("dobra_perfil");
  if (setoresConfig.temSolda) setoresAtivos.push("solda");
  if (setoresConfig.temPintura) setoresAtivos.push("pintura");
  if (setoresConfig.temMontagem) setoresAtivos.push("montagem");
  if (setoresConfig.temExpedicao) setoresAtivos.push("expedicao");

  // Distribuir dias úteis entre setores
  // Começar um dia após entrada
  let dataAtual = new Date(dataEntrada);
  dataAtual.setDate(dataAtual.getDate() + 1);
  
  let sequencia = 1;
  const setoresMap: Record<string, { dataInicio: Date; dataFim: Date; dias: number }> = {};

  // Primeira passada: calcular datas respeitando dependências
  for (const setor of setoresAtivos) {
    const config = SETORES_CONFIG[setor];
    if (!config) continue;

    let dataInicio = new Date(dataAtual);

    // Se tem dependências, começar após a maior data de fim das dependências
    if (config.dependeDe.length > 0) {
      let maiorDataFim = new Date(dataAtual);
      for (const dep of config.dependeDe) {
        if (setoresMap[dep] && setoresMap[dep].dataFim > maiorDataFim) {
          maiorDataFim = new Date(setoresMap[dep].dataFim);
        }
      }
      dataInicio = new Date(maiorDataFim);
    }

    const dataFim = await adicionarDiasUteis(dataInicio, config.dias);
    setoresMap[setor] = { dataInicio, dataFim, dias: config.dias };
  }

  // Segunda passada: inserir no banco de dados
  for (const setor of setoresAtivos) {
    const config = SETORES_CONFIG[setor];
    if (!config || !setoresMap[setor]) continue;

    const { dataInicio, dataFim, dias } = setoresMap[setor];

    const [resultado] = await db.insert(producaoSetores).values({
      ordemId,
      setorNome: setor,
      sequencia,
      status: "nao_iniciado",
      diasAlocados: dias,
      dataFimPrevista: dataFim,
      dependeDe: config.dependeDe.length > 0 ? JSON.stringify(config.dependeDe) : null,
    }).returning();

    if (resultado) {
      setoresCriados.push(resultado);
    }

    sequencia++;
  }

  return setoresCriados;
}

// ─── CRUD de Ordens ─────────────────────────────────────────────────────────

export async function criarOrdemProducao(input: InsertProducaoOrdem): Promise<ProducaoOrdem | null> {
  const db = await getDb();
  try {
    const [resultado] = await db.insert(producaoOrdens).values(input).returning({ id: producaoOrdens.id });
    return getOrdemProducaoById(resultado.id);
  } catch (error) {
    console.error("[PCP] Erro ao criar ordem:", error);
    return null;
  }
}

export async function getOrdemProducaoById(id: number): Promise<ProducaoOrdem | null> {
  const db = await getDb();
  try {
    const resultado = await db.select().from(producaoOrdens).where(eq(producaoOrdens.id, id)).limit(1);
    return resultado[0] || null;
  } catch (error) {
    console.error("[PCP] Erro ao buscar ordem:", error);
    return null;
  }
}

export async function getOrdemProducaoPorOS(osNumero: string): Promise<ProducaoOrdem | null> {
  const db = await getDb();
  try {
    const resultado = await db.select().from(producaoOrdens).where(eq(producaoOrdens.osNumero, osNumero)).limit(1);
    return resultado[0] || null;
  } catch (error) {
    console.error("[PCP] Erro ao buscar ordem por OS:", error);
    return null;
  }
}

export async function listarOrdensProducao(filtro?: { status?: string; cliente?: string }): Promise<ProducaoOrdem[]> {
  const db = await getDb();
  try {
    const conditions: any[] = [];
    if (filtro?.status) conditions.push(eq(producaoOrdens.statusGeral, filtro.status as any));
    if (filtro?.cliente) conditions.push(eq(producaoOrdens.clienteNome, filtro.cliente));
    const baseQuery = db.select().from(producaoOrdens);
    const finalQuery = conditions.length > 0 ? (baseQuery as any).where(and(...conditions)) : baseQuery;
    return await finalQuery.orderBy(desc(producaoOrdens.criadoEm));
  } catch (error) {
    console.error("[PCP] Erro ao listar ordens:", error);
    return [];
  }
}

// ─── Alertas ────────────────────────────────────────────────────────────────

export async function criarAlerta(input: InsertProducaoAlerta): Promise<void> {
  const db = await getDb();
  try {
    await db.insert(producaoAlertas).values(input);
  } catch (error) {
    console.error("[PCP] Erro ao criar alerta:", error);
  }
}

export async function verificarAtrasos(ordemId: number): Promise<void> {
  const db = await getDb();
  const hoje = new Date();

  try {
    const setores = await db.select().from(producaoSetores).where(eq(producaoSetores.ordemId, ordemId));

    for (const setor of setores) {
      if (setor.status === "concluido") continue;

      const diasRestantes = Math.floor((setor.dataFimPrevista.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));

      if (diasRestantes < 0) {
        // Atrasado
        await criarAlerta({
          ordemId,
          setorId: setor.id,
          tipoAlerta: "atrasado",
          descricao: `Setor ${setor.setorNome} está ${Math.abs(diasRestantes)} dias atrasado`,
        });
      } else if (diasRestantes <= 1) {
        // Em risco
        await criarAlerta({
          ordemId,
          setorId: setor.id,
          tipoAlerta: "em_risco",
          descricao: `Setor ${setor.setorNome} está em risco de atraso (${diasRestantes} dias restantes)`,
        });

        // Atualizar flag de risco
        await db.update(producaoSetores).set({ emRisco: true }).where(eq(producaoSetores.id, setor.id));
      }
    }
  } catch (error) {
    console.error("[PCP] Erro ao verificar atrasos:", error);
  }
}

// ─── Motivos de Atraso ──────────────────────────────────────────────────────

export async function seedMotivosAtraso(): Promise<void> {
  const db = await getDb();
  const motivosPadrao = [
    "Falta de material",
    "Máquina quebrada/manutenção",
    "Falta de mão de obra",
    "Retrabalho necessário",
    "Espera por setor anterior",
    "Problema com cliente",
    "Outro",
  ];

  for (const motivo of motivosPadrao) {
    try {
      await db.insert(motivosAtraso).values({ motivo, ativo: true });
    } catch {
      // Motivo já existe
    }
  }
}

export async function listarMotivosAtraso(): Promise<any[]> {
  const db = await getDb();
  try {
    return await db.select().from(motivosAtraso).where(eq(motivosAtraso.ativo, true));
  } catch (error) {
    console.error("[PCP] Erro ao listar motivos:", error);
    return [];
  }
}

// ─── Deletar Ordem ──────────────────────────────────────────────────────────

export async function deletarOrdemProducao(ordemId: number): Promise<boolean> {
  const db = await getDb();
  try {
    // Deletar alertas associados
    await db.delete(producaoAlertas).where(eq(producaoAlertas.ordemId, ordemId));
    
    // Deletar histórico de alterações
    await db.delete(producaoHistoricoAltracoes).where(eq(producaoHistoricoAltracoes.ordemId, ordemId));
    
    // Deletar setores
    await db.delete(producaoSetores).where(eq(producaoSetores.ordemId, ordemId));
    
    // Deletar ordem
    await db.delete(producaoOrdens).where(eq(producaoOrdens.id, ordemId));
    
    console.log(`[PCP] Ordem ${ordemId} deletada com sucesso`);
    return true;
  } catch (error) {
    console.error("[PCP] Erro ao deletar ordem:", error);
    return false;
  }
}
import { buscarOSPorNumero, listarOSMubiSys, type MubiSysOS as MubiSysOSReal } from "./mubisys-client";
