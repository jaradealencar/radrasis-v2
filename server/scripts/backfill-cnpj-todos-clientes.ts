import "dotenv/config";
import { getDb } from "../db/db";
import { clientesPerfilCnpj, historicoOs } from "../../drizzle/schema";
import { consultarCnpj, normalizarCnpj, CnpjNaoEncontradoError } from "../integrations/opencnpj-client";
import { buscarOSPorNumero } from "../integrations/mubisys-client";
import { isOsNormalDb, normalizeEmpresaKey } from "../routers/performanceComercial";

/**
 * Backfill completo de CNPJ para TODOS os clientes da carteira (historico_os),
 * sem o limite de 30/clique da tela "Perfil (CNPJ)" (perfilClientesCnpj.enriquecerViaMubisys
 * — capado por causa do timeout de 60s da Vercel em produção). Rodado localmente via
 * `npx tsx server/scripts/backfill-cnpj-todos-clientes.ts`, sem esse limite de tempo.
 *
 * Mesma lógica de candidatos/documento do router (ver server/routers/perfilClientesCnpj.ts,
 * enriquecerViaMubisys) — duplicada aqui de propósito para rodar como script solto, sem
 * depender do contexto tRPC (ctx.user). Idempotente: reconsulta `clientesPerfilCnpj` a
 * cada execução, então pode ser interrompido (Ctrl+C) e retomado depois sem duplicar nada.
 *
 * Pequeno delay entre clientes para não sobrecarregar a OpenCNPJ (API pública gratuita,
 * sem limite documentado, mas sem motivo pra martelar sem necessidade).
 *
 * Retry com backoff em buscarOSPorNumero: na primeira rodada completa (13/09/2026,
 * 1335 candidatos), 623 (~47%) falharam nessa chamada por erro de rede/timeout —
 * bem acima do "~0,2s, rápido" documentado em mubisys-client.ts — enquanto a OpenCNPJ
 * teve 0 falhas nas mesmas condições. Isso aponta para instabilidade do MubiSys sob
 * carga sustentada (chamadas sequenciais por ~23min), não erro sistemático — por isso
 * vale re-tentar antes de desistir do cliente.
 */

const DELAY_MS = 400;
const MAX_TENTATIVAS_OS = 3;
const RETRY_BACKOFF_MS = [800, 2000];

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const db = await getDb();
  if (!db) throw new Error("Não foi possível conectar ao banco (DATABASE_URL ausente ou inválida).");

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

  const candidatos = [...porCliente.entries()]
    .map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, osReferencia: v.osMaisRecente }))
    .filter(c => !!c.osReferencia)
    .sort((a, b) => (porCliente.get(b.empresaKey)!.valor) - (porCliente.get(a.empresaKey)!.valor));

  console.log(`Total de clientes na carteira: ${porCliente.size + jaMapeados.size}`);
  console.log(`Já mapeados: ${jaMapeados.size}`);
  console.log(`Candidatos a processar agora (com OS de referência): ${candidatos.length}`);
  console.log("");

  let sucessoCnpj = 0, pessoaFisica = 0, semDocumento = 0, falhaErp = 0, falhaOpenCnpj = 0;
  const agora0 = Date.now();

  for (let i = 0; i < candidatos.length; i++) {
    const c = candidatos[i];
    let osErp;
    try {
      osErp = await buscarOSPorNumeroComRetry(c.osReferencia!);
    } catch {
      falhaErp++;
      await sleep(DELAY_MS);
      continue;
    }
    const doc = osErp?.cliente_cnpj_cpf;
    if (!doc) { semDocumento++; await sleep(DELAY_MS); continue; }
    const { tipo, limpo } = classificarDocumento(doc);
    if (tipo === "cpf") { pessoaFisica++; await sleep(DELAY_MS); continue; }
    if (tipo === "invalido") { semDocumento++; await sleep(DELAY_MS); continue; }

    try {
      const dados = await consultarCnpj(limpo);
      const campos = extrairCamposPerfil(dados);
      const agora = new Date();
      await db.insert(clientesPerfilCnpj).values({
        empresaKey: c.empresaKey, empresaExibicao: c.empresa, cnpj: limpo, ...campos,
        origem: "mubisys", vinculadoPor: "script-backfill-completo",
        vinculadoEm: agora, updatedAt: agora,
      });
      sucessoCnpj++;
    } catch (e) {
      falhaOpenCnpj++;
      if (!(e instanceof CnpjNaoEncontradoError)) {
        console.log(`  [aviso] falha inesperada em ${c.empresa}: ${(e as Error)?.message ?? e}`);
      }
    }

    if ((i + 1) % 25 === 0 || i === candidatos.length - 1) {
      const decorridoS = ((Date.now() - agora0) / 1000).toFixed(0);
      console.log(`[${i + 1}/${candidatos.length}] (${decorridoS}s) sucesso=${sucessoCnpj} pessoaFisica=${pessoaFisica} semDocumento=${semDocumento} falhaErp=${falhaErp} falhaOpenCnpj=${falhaOpenCnpj}`);
    }

    await sleep(DELAY_MS);
  }

  console.log("");
  console.log("=== Resumo final ===");
  console.log(`Processados: ${candidatos.length}`);
  console.log(`CNPJ vinculado com sucesso: ${sucessoCnpj}`);
  console.log(`Pessoa física (pulados): ${pessoaFisica}`);
  console.log(`Sem documento no ERP: ${semDocumento}`);
  console.log(`Falha ao consultar OS no MubiSys: ${falhaErp}`);
  console.log(`Falha ao consultar CNPJ na OpenCNPJ: ${falhaOpenCnpj}`);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("Falha no backfill:", error);
    process.exit(1);
  });
