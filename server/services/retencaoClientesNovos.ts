/**
 * Retenção de Clientes Novos — jornada de 1 ano (motor de cálculo puro).
 *
 * 70% dos clientes que fazem a 1ª compra não voltam a comprar (meta: cair
 * para 50%). Este módulo identifica, a partir de `historico_os` (mesma base
 * local usada por toda a Inteligência de Clientes — ver
 * docs/inteligencia-clientes.md), os clientes com exatamente 1 compra válida
 * em todo o histórico e agenda os 7 marcos de acompanhamento da régua anual.
 *
 * Reaproveita `ClienteBase`/`construirBaseClientes` de `inteligenciaClientes.ts`
 * — a mesma definição de "pedido válido" (isOsNormalDb) e o mesmo parser de
 * data flexível já usados no resto do módulo.
 */

import type { ClienteBase } from "./inteligenciaClientes";
import { adicionarDiasUteisComFeriados, diasUteisComFeriadosEntre } from "../../shared/feriados-nacionais";

export type EstagioJornada = "d16u" | "d30" | "d60" | "d90" | "d180" | "d270" | "d365";

export interface EstagioConfig {
  id: EstagioJornada;
  label: string;
  descricao: string;
  unidade: "uteis" | "corridos";
  quantidade: number;
}

/** Os 7 marcos da jornada de 1 ano, conforme especificação de negócio. */
export const ESTAGIOS_JORNADA: EstagioConfig[] = [
  { id: "d16u", label: "1º pós-venda (16 dias úteis)", descricao: "Checagem de entrega/qualidade + oferta de cotação para novos projetos.", unidade: "uteis", quantidade: 16 },
  { id: "d30", label: "30 dias", descricao: "Lembrete de catálogo de materiais / tabela para revendedores.", unidade: "corridos", quantidade: 30 },
  { id: "d60", label: "60 dias", descricao: "Reativação comercial — check-in de demanda de fachada.", unidade: "corridos", quantidade: 60 },
  { id: "d90", label: "90 dias", descricao: "Oferta condicional de volume / condição de fábrica.", unidade: "corridos", quantidade: 90 },
  { id: "d180", label: "6 meses", descricao: "Pesquisa rápida de satisfação + cupom de reativação.", unidade: "corridos", quantidade: 180 },
  { id: "d270", label: "9 meses", descricao: "Apresentação de novas tecnologias/produtos da fábrica.", unidade: "corridos", quantidade: 270 },
  { id: "d365", label: "1 ano", descricao: "Ação especial de aniversário de parceria.", unidade: "corridos", quantidade: 365 },
];

export interface ClienteElegivelRetencao {
  empresaKey: string;
  empresa: string;
  osNumero: string;
  vendedor: string | null;
  valorPrimeiraCompra: number;
  dataPrimeiraCompra: Date;
  materialOuTrabalho: string | null;
}

/** Clientes com exatamente 1 compra válida em todo o histórico local, cuja
 * primeira compra ainda está dentro da janela de 1 ano da jornada — depois
 * disso, o cliente deixa de gerar novos marcos (os já criados continuam
 * consultáveis via `retencaoDisparos`, mas não é mais "elegível" para novos). */
export function identificarClientesElegiveis(base: Map<string, ClienteBase>, hoje: Date): ClienteElegivelRetencao[] {
  const umAnoAtras = new Date(hoje);
  umAnoAtras.setFullYear(umAnoAtras.getFullYear() - 1);
  const elegiveis: ClienteElegivelRetencao[] = [];
  for (const cliente of base.values()) {
    if (cliente.compras.length !== 1) continue; // 2+ compras = já recomprou, sai da jornada
    const compra = cliente.compras[0];
    if (compra.data < umAnoAtras) continue;
    elegiveis.push({
      empresaKey: cliente.empresaKey,
      empresa: cliente.empresaExibicao,
      osNumero: compra.osNumero,
      vendedor: compra.vendedor,
      valorPrimeiraCompra: compra.valor,
      dataPrimeiraCompra: compra.data,
      materialOuTrabalho: compra.trabalho,
    });
  }
  return elegiveis;
}

function somarDiasCorridos(d: Date, dias: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + dias);
  return r;
}

export interface PendenciaRetencao extends ClienteElegivelRetencao {
  estagio: EstagioJornada;
  dataAgendada: Date;
  diasUteisDesdeCompra: number;
}

/** Um marco por (cliente elegível, estágio) — os 7 marcos da régua, agendados
 * a partir da data da 1ª compra. Quem consome (router) decide o que fazer com
 * cada um: persistir (idempotente), filtrar por vencido/futuro, etc. */
export function listarPendenciasRetencao(base: Map<string, ClienteBase>, hoje: Date): PendenciaRetencao[] {
  const elegiveis = identificarClientesElegiveis(base, hoje);
  const pendencias: PendenciaRetencao[] = [];
  for (const cliente of elegiveis) {
    const diasUteisDesdeCompra = diasUteisComFeriadosEntre(cliente.dataPrimeiraCompra, hoje);
    for (const cfg of ESTAGIOS_JORNADA) {
      const dataAgendada = cfg.unidade === "uteis"
        ? adicionarDiasUteisComFeriados(cliente.dataPrimeiraCompra, cfg.quantidade)
        : somarDiasCorridos(cliente.dataPrimeiraCompra, cfg.quantidade);
      pendencias.push({ ...cliente, estagio: cfg.id, dataAgendada, diasUteisDesdeCompra });
    }
  }
  return pendencias;
}
