/**
 * Campanhas WhatsApp — regra de negócio pura (sem I/O): higienização de lista com quarentena anti-spam,
 * lista de pós-venda por venda, status/semáforo de cada campanha e projeção de datas para o calendário.
 * Os routers (server/routers/campanhasWhatsapp.ts) só buscam os dados e chamam estas funções.
 * Ver docs/campanhas-whatsapp.md.
 */

import {
  calcularProximoEnvio, classificarSemaforo, dataIsoValida, diasEntre, normalizarTelefone, somarDias,
  JANELA_SEMANA_DIAS, type SemaforoCampanha, type StatusCampanha, type TipoCampanha,
} from "../../shared/campanhas-whatsapp";
import { parseDataFlexivel } from "./inteligenciaClientes";

// ─── Higienização de lista (quarentena) ─────────────────────────────────────

export interface ContatoEntrada {
  telefone: unknown;
  nome?: string | null;
  /** Só no pós-venda: OS que originou o contato (marcada como contatada quando ele é enviado). */
  osNumero?: string | null;
}

export interface ContatoLimpo {
  /** Só dígitos, com DDI 55. */
  telefone: string;
  nome: string;
  /** OS cobertas por este contato (mais de uma quando o mesmo telefone aparece em vendas diferentes). */
  osNumeros: string[];
}

export interface ContatoIgnorado {
  telefone: string;
  nome: string;
  ultimoContatoEm: string;
  /** Primeiro dia em que o telefone volta a poder receber esta campanha. */
  disponivelEm: string;
}

export interface ContatoInvalido {
  telefoneOriginal: string;
  nome: string;
  motivo: "telefone_invalido" | "duplicado";
}

export interface ResultadoHigienizacao {
  enviar: ContatoLimpo[];
  ignoradosQuarentena: ContatoIgnorado[];
  invalidos: ContatoInvalido[];
}

/**
 * Normaliza, remove repetidos e aplica a quarentena.
 *
 * Quarentena: um telefone é ignorado quando o último contato (de QUALQUER campanha) está a menos de
 * `quarentenaDias` dias da data do envio — em qualquer sentido, para que um registro retroativo também respeite a
 * trava. Com 30 dias, quem recebeu há exatamente 30 já pode receber. `quarentenaDias = 0` desliga a trava.
 *
 * Telefone repetido na lista conta como "duplicado" (um só envio), mas as OS do repetido são somadas ao contato que
 * foi mantido — senão a venda extra ficaria pendente para sempre no pós-venda.
 */
export function higienizarLista(
  contatos: ContatoEntrada[],
  quarentena: ReadonlyMap<string, string>,
  dataEnvio: string,
  quarentenaDias: number,
): ResultadoHigienizacao {
  const enviar: ContatoLimpo[] = [];
  const ignoradosQuarentena: ContatoIgnorado[] = [];
  const invalidos: ContatoInvalido[] = [];
  const vistos = new Map<string, ContatoLimpo | null>(); // null = telefone ignorado por quarentena

  for (const c of contatos) {
    const nome = String(c.nome ?? "").trim();
    const os = String(c.osNumero ?? "").trim();
    const telefone = normalizarTelefone(c.telefone);
    if (!telefone) {
      invalidos.push({ telefoneOriginal: String(c.telefone ?? "").trim(), nome, motivo: "telefone_invalido" });
      continue;
    }

    if (vistos.has(telefone)) {
      const mantido = vistos.get(telefone);
      if (mantido && os && !mantido.osNumeros.includes(os)) mantido.osNumeros.push(os);
      invalidos.push({ telefoneOriginal: String(c.telefone ?? "").trim(), nome, motivo: "duplicado" });
      continue;
    }

    const ultimo = quarentena.get(telefone);
    if (quarentenaDias > 0 && ultimo && Math.abs(diasEntre(ultimo, dataEnvio)) < quarentenaDias) {
      vistos.set(telefone, null);
      ignoradosQuarentena.push({ telefone, nome, ultimoContatoEm: ultimo, disponivelEm: somarDias(ultimo, quarentenaDias) });
      continue;
    }

    const limpo: ContatoLimpo = { telefone, nome, osNumeros: os ? [os] : [] };
    vistos.set(telefone, limpo);
    enviar.push(limpo);
  }

  return { enviar, ignoradosQuarentena, invalidos };
}

// ─── Cadência da campanha (Fontes de Dados) ─────────────────────────────────
// Diferente da quarentena (qualquer campanha), esta é "este telefone já recebeu ESTA campanha há menos de
// `frequenciaDias`?" — só é aplicada no fluxo de geração de lista a partir de Fontes (gerarListaDaCampanha);
// o upload manual/webhook não muda (ver server/routers/campanhasWhatsapp.ts). A dedup entre múltiplas fontes
// combinadas numa campanha não precisa de função própria: `higienizarLista` já desduplica por telefone
// normalizado dentro da lista recebida, então basta concatenar os contatos resolvidos de cada fonte antes
// de passar para ela.

export interface ContatoDescartadoCadencia {
  telefone: string;
  nome: string;
  ultimoEnvioNaCampanha: string;
  disponivelEm: string;
}

export function filtrarPorCadenciaCampanha(
  contatos: ContatoLimpo[],
  historicoCampanha: ReadonlyMap<string, string>,
  dataEnvio: string,
  frequenciaDias: number,
): { aprovados: ContatoLimpo[]; descartadosCadencia: ContatoDescartadoCadencia[] } {
  if (frequenciaDias <= 0) return { aprovados: contatos, descartadosCadencia: [] };
  const aprovados: ContatoLimpo[] = [];
  const descartadosCadencia: ContatoDescartadoCadencia[] = [];
  for (const c of contatos) {
    const ultimo = historicoCampanha.get(c.telefone);
    if (ultimo && Math.abs(diasEntre(ultimo, dataEnvio)) < frequenciaDias) {
      descartadosCadencia.push({ telefone: c.telefone, nome: c.nome, ultimoEnvioNaCampanha: ultimo, disponivelEm: somarDias(ultimo, frequenciaDias) });
    } else {
      aprovados.push(c);
    }
  }
  return { aprovados, descartadosCadencia };
}

// ─── Pós-venda (gatilho por venda) ──────────────────────────────────────────

export interface LinhaVenda {
  osNumero: string | null;
  empresa: string | null;
  telefone: string | null;
  dataFaturamento: string | null;
  vendedor: string | null;
  valorOs: string | null;
}

export interface VendaPosVenda {
  osNumero: string;
  empresa: string;
  /** Normalizado; `null` quando a venda não tem telefone utilizável (não entra no envio). */
  telefone: string | null;
  vendedor: string | null;
  valor: number | null;
  dataFaturamento: string;
  /** Data de faturamento + frequência da campanha. */
  prazo: string;
  /** Dias de atraso em relação a hoje (negativo = faltam dias). */
  diasAtraso: number;
}

/** Data local de um `Date` (o parser do histórico monta datas com componentes locais) como `YYYY-MM-DD`.
 * Exportada para server/services/fontesErpCampanhas.ts (mesma necessidade: converter o retorno de
 * `parseDataFlexivel` para o formato ISO usado em todo o módulo). */
export function dataLocalParaIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Vendas de uma campanha de pós-venda: prazo = faturamento + `frequenciaDias`. `pendentes` são as de prazo vencido
 * (≤ hoje) ainda não contatadas — sem limite de atraso, a menos que a campanha tenha `gatilhoAPartirDe`;
 * `proximas` são as que ainda vão vencer. Ambas ordenadas do prazo mais antigo para o mais novo.
 * O chamador já filtrou OS que não são venda normal (retrabalho, amostra, cortesia, cancelada).
 */
export function listarVendasPosVenda(
  linhas: LinhaVenda[],
  campanha: { frequenciaDias: number; gatilhoAPartirDe: string | null },
  hoje: string,
  osJaContatadas: ReadonlySet<string>,
): { pendentes: VendaPosVenda[]; proximas: VendaPosVenda[] } {
  const pendentes: VendaPosVenda[] = [];
  const proximas: VendaPosVenda[] = [];

  for (const l of linhas) {
    const osNumero = String(l.osNumero ?? "").trim();
    if (!osNumero || osJaContatadas.has(osNumero)) continue;

    const dt = parseDataFlexivel(l.dataFaturamento);
    if (!dt) continue;
    const dataFaturamento = dataLocalParaIso(dt);
    if (!dataIsoValida(dataFaturamento)) continue;
    if (dataFaturamento > hoje) continue; // data no futuro = erro de cadastro, não é venda faturada
    if (campanha.gatilhoAPartirDe && dataFaturamento < campanha.gatilhoAPartirDe) continue;

    const prazo = somarDias(dataFaturamento, campanha.frequenciaDias);
    const valor = l.valorOs === null || l.valorOs === undefined || l.valorOs === "" ? null : Number(l.valorOs);
    const venda: VendaPosVenda = {
      osNumero,
      empresa: String(l.empresa ?? "").trim(),
      telefone: normalizarTelefone(l.telefone),
      vendedor: l.vendedor ?? null,
      valor: valor !== null && Number.isFinite(valor) ? valor : null,
      dataFaturamento,
      prazo,
      diasAtraso: diasEntre(prazo, hoje),
    };
    (prazo <= hoje ? pendentes : proximas).push(venda);
  }

  const porPrazo = (a: VendaPosVenda, b: VendaPosVenda) => a.prazo.localeCompare(b.prazo) || a.osNumero.localeCompare(b.osNumero);
  pendentes.sort(porPrazo);
  proximas.sort(porPrazo);
  return { pendentes, proximas };
}

export function resumirVendas(listas: { pendentes: VendaPosVenda[]; proximas: VendaPosVenda[] }): ResumoVendasCampanha {
  return { pendentes: listas.pendentes.length, prazoMaisProximo: listas.pendentes[0]?.prazo ?? listas.proximas[0]?.prazo ?? null };
}

// ─── Status / semáforo de cada campanha ─────────────────────────────────────

export interface CampanhaParaStatus {
  tipo: TipoCampanha;
  status: StatusCampanha;
  frequenciaDias: number;
  /** Data de criação (`YYYY-MM-DD`): vira o 1º prazo de uma recorrente que nunca foi disparada. */
  criadaEm: string;
}

export interface ResumoVendasCampanha {
  pendentes: number;
  /** Menor prazo entre as pendentes (a mais atrasada) ou, se não há pendentes, o menor prazo futuro. */
  prazoMaisProximo: string | null;
}

export interface StatusDaCampanha {
  /** `null` quando a campanha não está ativa (sem semáforo, fora dos contadores). */
  semaforo: SemaforoCampanha | null;
  ultimoEnvio: string | null;
  proximoEnvio: string | null;
  primeiroDisparoPendente: boolean;
}

/**
 * Recorrente: próximo = último envio + frequência ATUAL da campanha (editar a frequência reflete na hora); sem
 * nenhum envio, o prazo é a data de criação (nasce vermelha — foi criada para ser disparada).
 * Gatilho: vermelho se há venda com prazo vencido; senão, o menor prazo futuro; sem vendas a vencer, verde e sem data.
 */
export function montarStatusCampanha(
  campanha: CampanhaParaStatus,
  ultimoEnvio: string | null,
  hoje: string,
  vendas?: ResumoVendasCampanha,
): StatusDaCampanha {
  if (campanha.status !== "ativa") {
    return { semaforo: null, ultimoEnvio, proximoEnvio: null, primeiroDisparoPendente: false };
  }

  if (campanha.tipo === "gatilho_venda") {
    if (vendas && vendas.pendentes > 0) {
      return { semaforo: "vermelho", ultimoEnvio, proximoEnvio: vendas.prazoMaisProximo, primeiroDisparoPendente: false };
    }
    const proximo = vendas?.prazoMaisProximo ?? null;
    return { semaforo: proximo ? classificarSemaforo(proximo, hoje) : "verde", ultimoEnvio, proximoEnvio: proximo, primeiroDisparoPendente: false };
  }

  const proximoEnvio = ultimoEnvio ? calcularProximoEnvio(ultimoEnvio, campanha.frequenciaDias) : campanha.criadaEm;
  return { semaforo: classificarSemaforo(proximoEnvio, hoje), ultimoEnvio, proximoEnvio, primeiroDisparoPendente: !ultimoEnvio };
}

export interface ResumoCampanhas {
  ativas: number;
  /** Vermelhas: para disparar hoje ou atrasadas. */
  pendentesHoje: number;
  /** Prazo entre amanhã e +7 dias. */
  daSemana: number;
}

export function resumirCampanhas(
  campanhas: Array<{ status: StatusCampanha; proximoEnvio: string | null; semaforo: SemaforoCampanha | null }>,
  hoje: string,
): ResumoCampanhas {
  const ativas = campanhas.filter(c => c.status === "ativa");
  return {
    ativas: ativas.length,
    pendentesHoje: ativas.filter(c => c.semaforo === "vermelho").length,
    daSemana: ativas.filter(c => {
      if (!c.proximoEnvio) return false;
      const faltam = diasEntre(hoje, c.proximoEnvio);
      return faltam > 0 && faltam <= JANELA_SEMANA_DIAS;
    }).length,
  };
}

// ─── Calendário ─────────────────────────────────────────────────────────────

/**
 * Datas previstas de uma campanha recorrente dentro de [inicio, fim]: o próximo envio (mesmo atrasado) e a cadeia
 * seguinte. Se o próximo envio já passou, a cadeia recomeça de hoje (assume-se que o disparo atrasado sai hoje —
 * prever a partir da data vencida colocaria no calendário datas que já são impossíveis).
 */
export function expandirPrevistos(
  proximoEnvio: string, frequenciaDias: number, hoje: string, inicio: string, fim: string, limite = 120,
): string[] {
  if (frequenciaDias < 1) return [];
  const datas: string[] = [];
  const empurrar = (d: string) => { if (d >= inicio && d <= fim) datas.push(d); };

  empurrar(proximoEnvio);
  let cursor = proximoEnvio < hoje ? hoje : proximoEnvio;
  for (let i = 0; i < limite; i++) {
    cursor = somarDias(cursor, frequenciaDias);
    if (cursor > fim) break;
    empurrar(cursor);
  }
  return datas;
}
