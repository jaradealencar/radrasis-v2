/**
 * Sincronização agendada do Perfil de Clientes por CNPJ (aba Inteligência de
 * Clientes → Perfil CNPJ). Mantém `clientes_perfil_cnpj` em dia sozinha
 * conforme novos clientes aparecem em `historico_os` — sem isso, a cobertura
 * só avançava quando alguém clicava manualmente em "Preencher automaticamente
 * via MubiSys" na tela (ver server/routers/perfilClientesCnpj.ts,
 * enriquecerViaMubisys).
 *
 * Mesma lógica de candidatos/documento do router e do script de backfill
 * (server/scripts/backfill-cnpj-todos-clientes.ts) — duplicada aqui de
 * propósito, mesma razão registrada lá: rodar como job solto, sem depender do
 * contexto tRPC (ctx.user) nem acoplar o cron ao router.
 *
 * Ao contrário do backfill (rodado localmente, sem limite de tempo), este job
 * roda na Vercel (`maxDuration` 60s — ver docs/integracao-mubisys.md) e o
 * MubiSys é lento/instável sob chamadas sequenciais (~47% de falha na
 * primeira tentativa, medido em 13/09/2026). Por isso processa em lote
 * pequeno com orçamento de tempo (LIMITE_TEMPO_MS) além do limite de
 * quantidade (LIMITE_CANDIDATOS) — o que sobrar fica para a próxima execução
 * do cron, exatamente como "restantes" já funciona na tela manual.
 */

import { getDb } from "../db/db";
import { clientesPerfilCnpj, historicoOs } from "../../drizzle/schema";
import { consultarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";
import { buscarOSPorNumero } from "../integrations/mubisys-client";
import { isOsNormalDb, normalizeEmpresaKey } from "../routers/performanceComercial";

const LIMITE_CANDIDATOS = 40;
const LIMITE_TEMPO_MS = 45_000;
const MAX_TENTATIVAS_OS = 2;
const RETRY_BACKOFF_MS = [800];

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function parseDataOsFlexivel(s: string | null): Date | null {
  if (!s) return null;
  const texto = s.trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}

function classificarDocumento(doc: string): { tipo: "cnpj" | "cpf" | "invalido"; limpo: string } {
  const limpo = doc.replace(/\D/g, "");
  if (limpo.length === 14) return { tipo: "cnpj", limpo };
  if (limpo.length === 11) return { tipo: "cpf", limpo };
  return { tipo: "invalido", limpo };
}

function extrairCamposPerfil(dados: Awaited<ReturnType<typeof consultarCnpj>>) {
  const idadeAnos = (() => {
    const d = new Date(dados.data_inicio_atividade);
    if (isNaN(d.getTime())) return null;
    return Number((((Date.now() - d.getTime()) / (365.25 * 86400000))).toFixed(1));
  })();
  return {
    razaoSocial: dados.razao_social,
    situacaoCadastral: dados.situacao_cadastral || null,
    dataInicioAtividade: dados.data_inicio_atividade || null,
    idadeAnos: idadeAnos !== null ? String(idadeAnos) : null,
    porte: dados.porte_empresa || null,
    naturezaJuridica: dados.natureza_juridica || null,
    qtdSocios: Array.isArray(dados.QSA) ? dados.QSA.length : null,
    capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
    uf: dados.uf || null,
    municipio: dados.municipio || null,
    cnaePrincipal: dados.cnae_principal || null,
    dadosJson: JSON.stringify(dados),
  };
}

async function buscarOSPorNumeroComRetry(numero: string): ReturnType<typeof buscarOSPorNumero> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_OS; tentativa++) {
    try {
      return await buscarOSPorNumero(numero);
    } catch (e) {
      ultimoErro = e;
      if (tentativa < MAX_TENTATIVAS_OS - 1) await sleep(RETRY_BACKOFF_MS[tentativa]);
    }
  }
  throw ultimoErro;
}

export interface SincronizarPerfilCnpjResultado {
  ok: boolean;
  totalCandidatos: number;
  processados: number;
  sucessoCnpj: number;
  pessoaFisica: number;
  semDocumento: number;
  falhaErp: number;
  falhaOpenCnpj: number;
  restantes: number;
  tempoExecucaoMs: number;
  erro?: string;
}

export async function sincronizarPerfilCnpj(): Promise<SincronizarPerfilCnpjResultado> {
  const inicio = Date.now();
  const vazio = {
    totalCandidatos: 0, processados: 0, sucessoCnpj: 0, pessoaFisica: 0,
    semDocumento: 0, falhaErp: 0, falhaOpenCnpj: 0, restantes: 0,
  };
  try {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");

    const [osRows, mapeados] = await Promise.all([
      db.select({
        empresa: historicoOs.empresa, tipoOs: historicoOs.tipoOs, status: historicoOs.status,
        valorTotal: historicoOs.valorTotal, valorOs: historicoOs.valorOs,
        osNumero: historicoOs.osNumero, dataAprovacao: historicoOs.dataAprovacao,
      }).from(historicoOs),
      db.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj),
    ]);
    const jaMapeados = new Set(mapeados.map(m => m.empresaKey));

    const porCliente = new Map<string, { empresa: string; valor: number; osMaisRecente: string | null; dataMaisRecente: Date | null }>();
    for (const r of osRows as any[]) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (!nome) continue;
      const key = normalizeEmpresaKey(nome);
      if (jaMapeados.has(key)) continue;
      const dataOs = parseDataOsFlexivel(r.dataAprovacao);
      const valor = parseFloat(String(r.valorOs ?? r.valorTotal ?? "0")) || 0;
      const atual = porCliente.get(key) ?? { empresa: nome, valor: 0, osMaisRecente: null, dataMaisRecente: null };
      atual.valor += valor;
      if (r.osNumero && dataOs && (!atual.dataMaisRecente || dataOs > atual.dataMaisRecente)) {
        atual.osMaisRecente = r.osNumero;
        atual.dataMaisRecente = dataOs;
      }
      porCliente.set(key, atual);
    }

    const todosCandidatos = [...porCliente.entries()]
      .map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, osReferencia: v.osMaisRecente }))
      .filter(c => !!c.osReferencia)
      .sort((a, b) => (porCliente.get(b.empresaKey)!.valor) - (porCliente.get(a.empresaKey)!.valor));

    const candidatos = todosCandidatos.slice(0, LIMITE_CANDIDATOS);
    let sucessoCnpj = 0, pessoaFisica = 0, semDocumento = 0, falhaErp = 0, falhaOpenCnpj = 0, processados = 0;

    for (const c of candidatos) {
      if (Date.now() - inicio > LIMITE_TEMPO_MS) break;
      processados++;

      let osErp;
      try {
        osErp = await buscarOSPorNumeroComRetry(c.osReferencia!);
      } catch {
        falhaErp++;
        continue;
      }
      const doc = osErp?.cliente_cnpj_cpf;
      if (!doc) { semDocumento++; continue; }
      const { tipo, limpo } = classificarDocumento(doc);
      if (tipo === "cpf") { pessoaFisica++; continue; }
      if (tipo === "invalido") { semDocumento++; continue; }

      try {
        const dados = await consultarCnpj(limpo);
        const campos = extrairCamposPerfil(dados);
        const agora = new Date();
        await db.insert(clientesPerfilCnpj).values({
          empresaKey: c.empresaKey, empresaExibicao: c.empresa, cnpj: limpo, ...campos,
          origem: "mubisys", vinculadoPor: "cron-sincronizarPerfilCnpj",
          vinculadoEm: agora, updatedAt: agora,
        });
        sucessoCnpj++;
      } catch (e) {
        falhaOpenCnpj++;
        if (!(e instanceof CnpjNaoEncontradoError)) {
          console.error(`  [SYNC-PERFIL-CNPJ] falha inesperada em ${c.empresa}:`, (e as Error)?.message ?? e);
        }
      }
    }

    const restantes = Math.max(0, todosCandidatos.length - processados);
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`✅ [SYNC-PERFIL-CNPJ] processados=${processados} sucesso=${sucessoCnpj} pessoaFisica=${pessoaFisica} semDocumento=${semDocumento} falhaErp=${falhaErp} falhaOpenCnpj=${falhaOpenCnpj} restantes=${restantes} em ${tempoExecucaoMs}ms`);
    return { ok: true, totalCandidatos: todosCandidatos.length, processados, sucessoCnpj, pessoaFisica, semDocumento, falhaErp, falhaOpenCnpj, restantes, tempoExecucaoMs };
  } catch (erro: any) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error("❌ [SYNC-PERFIL-CNPJ] Erro:", erro);
    return { ok: false, ...vazio, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
