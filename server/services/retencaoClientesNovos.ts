/**
 * Retenção de Clientes Novos — 4 mensagens em 6 meses (motor de cálculo puro).
 *
 * 70% dos clientes que fazem a 1ª compra não voltam a comprar (meta: cair
 * para 50%). Este módulo identifica, a partir de `historico_os` (mesma base
 * local usada por toda a Inteligência de Clientes — ver
 * docs/inteligencia-clientes.md), os clientes com exatamente 1 compra válida
 * em todo o histórico e agenda os 4 marcos de acompanhamento.
 *
 * Desenho original (PRD) previa 7 marcos ao longo de 1 ano; simplificado para
 * 4 marcos em 6 meses a pedido do usuário (24/09/2026) — mais fácil de
 * organizar em campanhas de disparo em massa (ver retencao_campanhas).
 *
 * Reaproveita `ClienteBase`/`construirBaseClientes` de `inteligenciaClientes.ts`
 * — a mesma definição de "pedido válido" (isOsNormalDb) e o mesmo parser de
 * data flexível já usados no resto do módulo.
 */

import type { ClienteBase } from "./inteligenciaClientes";
import { adicionarDiasUteisComFeriados, diasUteisComFeriadosEntre } from "../../shared/feriados-nacionais";

/** O enum do banco (retencao_jornada_estagio) ainda tem d60/d270/d365 (do
 * desenho anterior, de 7 marcos) — Postgres não permite encolher um enum sem
 * recriar o tipo. A aplicação só gera/aceita os 4 abaixo. */
export type EstagioJornada = "d16u" | "d30" | "d90" | "d180";

export interface EstagioConfig {
  id: EstagioJornada;
  label: string;
  descricao: string;
  unidade: "uteis" | "corridos";
  quantidade: number;
}

/** Os 4 marcos da jornada de 6 meses, conforme decisão de negócio. */
export const ESTAGIOS_JORNADA: EstagioConfig[] = [
  { id: "d16u", label: "1º pós-venda (16 dias úteis)", descricao: "Checagem de entrega/qualidade + oferta de cotação para novos projetos.", unidade: "uteis", quantidade: 16 },
  { id: "d30", label: "30 dias", descricao: "Lembrete de catálogo de materiais / tabela para revendedores.", unidade: "corridos", quantidade: 30 },
  { id: "d90", label: "90 dias", descricao: "Oferta condicional de volume / condição de fábrica.", unidade: "corridos", quantidade: 90 },
  { id: "d180", label: "6 meses", descricao: "Pesquisa rápida de satisfação + cupom de reativação — última mensagem da campanha.", unidade: "corridos", quantidade: 180 },
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
