/**
 * Integração de Frete com MubiSys
 * Busca dados de OS: PRIMEIRO no cache local, DEPOIS na API (fallback)
 */
import { buscarOSPorNumero } from "./mubisys-client";
import { selectQuery } from "../db/db-connection";
import { erpOsCache } from "../../drizzle/schema";

export interface FreteOpcao {
  transportadora: string;
  preco: number;
  prazo_dias: number;
  tipo_prazo: string;
}

export interface DadosFreteAutomatico {
  osNumero: string;
  clienteNome: string;
  clienteCnpj: string;
  municipio: string;
  estado: string;
  cep: string;
  endereco: string;
  peso_kg?: number;
  valor_nf?: number;
  /** Data/hora de aprovação da OS (própria de cada OS) */
  aprovacao?: string;
  /** Data/hora de entrega prevista da OS (própria de cada OS) */
  entrega?: string;
  /** Vendedor responsável pela OS (próprio de cada OS) */
  vendedor?: string;
}

/** Formata datas do ERP para exibição (dd/mm/aaaa ou dd/mm/aaaa às HH:MM). */
function formatarDataOS(valor: unknown): string {
  if (!valor) return "";
  const texto = String(valor).trim();
  if (!texto) return "";
  // Já vem formatado (ex.: "07/08/2026 às 15:45" ou "07/08/2026 15:45")
  if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) return texto.replace(/\s+(\d{2}:\d{2})/, " às $1");
  // ISO ou "YYYY-MM-DD HH:MM:SS"
  const iso = texto.replace(" ", "T");
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return texto;
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const ano = data.getFullYear();
  const temHora = /\d{2}:\d{2}/.test(texto);
  if (!temHora) return `${dia}/${mes}/${ano}`;
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
}

/**
 * ✅ REFACTOR CRÍTICO: Busca dados da OS com cache local como prioridade
 * 1. PRIMEIRO: Busca no cache local (rápido, <1ms)
 * 2. DEPOIS: Se não encontrar, busca na API MubiSys (fallback)
 */
export async function buscarDadosOSParaFrete(osNumero: string): Promise<DadosFreteAutomatico | null> {
  try {
    // ✅ PASSO 1: Buscar NO CACHE LOCAL (rápido, <1ms)
    console.log("🔍 [Frete-Cache] Buscando OS", osNumero, "no cache local...");
    
    const sql = 'SELECT * FROM erp_os_cache WHERE "numeroOs" = ?';
    const result = await selectQuery(sql, [osNumero]);
    const osCache = result[0];
    
    // Um registro só é aproveitado se tiver os dados próprios da OS. Registros
    // gravados por versões antigas ficaram sem aprovação/vendedor: nesse caso
    // vale re-buscar na API e regravar, em vez de exibir card vazio.
    const cacheCompleto = !!(osCache && osCache.numeroOs
      && String(osCache.dataAprovacao ?? "").trim()
      && String(osCache.vendedor ?? "").trim());

    if (osCache && osCache.numeroOs && cacheCompleto) {
      console.log("✅ [Frete-Cache] OS", osNumero, "encontrada no cache local!");
      console.log("📊 [Frete-Cache] Dados do cache:", osCache);
      return {
        osNumero: osCache.numeroOs,
        clienteNome: osCache.razaoSocial || osCache.municipio || "",
        clienteCnpj: osCache.cnpj || "",
        municipio: osCache.municipio || "",
        estado: osCache.estado || "",
        cep: osCache.cep || "",
        endereco: osCache.endereco || "",
        peso_kg: undefined,
        valor_nf: osCache.valorTotal ? Number(osCache.valorTotal) : 0,
        aprovacao: formatarDataOS(osCache.dataAprovacao),
        entrega: formatarDataOS(osCache.dataEntregaPrevista),
        // ⚠️ A coluna real é `vendedor` (validado com DESCRIBE erp_os_cache)
        vendedor: osCache.vendedor || "",
      };
    }
    
    // ✅ PASSO 2: Se não encontrou no cache, buscar NA API (fallback)
    console.log(
      osCache
        ? `⚠️ [Frete-Cache] OS ${osNumero} está no cache mas sem aprovação/vendedor. Rebuscando na API...`
        : `⚠️ [Frete-Cache] OS ${osNumero} não encontrada no cache. Buscando na API MubiSys...`,
    );
    const os = await buscarOSPorNumero(osNumero);
    
    if (!os) {
      console.warn("[Frete-Cache] API MubiSys retornou null para OS", osNumero);
      return null;
    }

    // ✅ SOLUÇÃO 3: Normalizar resposta com fallbacks completos
    console.log("🔍 [Frete-API] Resposta bruta do MubiSys:", JSON.stringify(os, null, 2));
    console.log("✅ [Frete-API] OS", osNumero, "encontrada na API (não estava no cache)");

    // Extrair primeiro endereço do cliente
    const endereco = os.cliente_endereco?.[0] as any;
    if (!endereco) {
      console.warn("[Frete-API] Endereço não encontrado para OS", osNumero);
      return null;
    }

    // ✅ Mapeamento com fallbacks para variações de campo
    const resultado = {
      osNumero: String(os.sequencial_ordem || (os as any).numero || os.id || osNumero),
      clienteNome: os.cliente || (os as any).nomeCliente || (os as any).razaoSocial || (os as any).nomeEmpresa || "",
      clienteCnpj: os.cliente_cnpj_cpf || (os as any).cnpj || (os as any).cnpjCliente || "",
      municipio: endereco.cidade || endereco.municipio || endereco.localidade || "",
      estado: endereco.estado || endereco.uf || "",
      cep: endereco.cep || "",
      endereco: `${endereco.logradouro || ""}, ${endereco.numero || ""}, ${endereco.bairro || ""}`,
      peso_kg: undefined, // Será preenchido pelo usuário
      valor_nf: (os as any).valor_total || 0,
      // Dados próprios de cada OS
      aprovacao: formatarDataOS(os.data_aprovacao ?? (os as any).dataAprovacao),
      entrega: formatarDataOS(os.data_entrega ?? (os as any).prazo ?? (os as any).dataEntrega),
      vendedor: os.vendedor || (os as any).atendente || "",
    };
    
    console.log("✅ [Frete-API] Retornando dados da OS:", resultado);
    // Persistir no cache para que a próxima consulta seja instantânea e o card
    // nunca fique sem Aprovação/Entrega/Vendedor.
    await gravarNoCache(resultado);
    return resultado;
  } catch (error) {
    console.error("[Frete-Cache] Erro ao buscar OS:", error);
    console.error("[Frete-Cache] Retornando null - OS não encontrada em cache nem na API");
    return null;
  }
}

/** Grava/atualiza a OS no cache local usando os nomes reais das colunas. */
async function gravarNoCache(dados: DadosFreteAutomatico): Promise<void> {
  try {
    const { mutationQuery } = await import("../db/db-connection");
    const existente = await selectQuery(`SELECT id FROM erp_os_cache WHERE "numeroOs" = ?`, [dados.osNumero]);
    if (existente && existente.length > 0) {
      await mutationQuery(
        `UPDATE erp_os_cache SET
           "razaoSocial" = ?, cnpj = ?, cep = ?, municipio = ?, estado = ?, endereco = ?,
           "dataAprovacao" = ?, vendedor = ?, "dataUltimaAtualizacao" = NOW(), "sincronizadoEm" = NOW()
         WHERE "numeroOs" = ?`,
        [
          dados.clienteNome, dados.clienteCnpj, dados.cep, dados.municipio, dados.estado,
          dados.endereco, dados.aprovacao || null, dados.vendedor || "", dados.osNumero,
        ],
      );
    } else {
      await mutationQuery(
        `INSERT INTO erp_os_cache
           ("numeroOs", "razaoSocial", cnpj, cep, municipio, estado, endereco,
            "dataAprovacao", vendedor, status, "dataUltimaAtualizacao", "sincronizadoEm", "criadoEm")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', NOW(), NOW(), NOW())`,
        [
          dados.osNumero, dados.clienteNome, dados.clienteCnpj, dados.cep, dados.municipio,
          dados.estado, dados.endereco, dados.aprovacao || null, dados.vendedor || "",
        ],
      );
    }
    console.log("💾 [Frete-Cache] OS", dados.osNumero, "gravada no cache local");
  } catch (erro: any) {
    console.error("[Frete-Cache] Falha ao gravar no cache:", erro?.message);
  }
}

/**
 * Simula cotações de frete baseadas em município, estado, peso e valor
 */
export async function obterCotacoesFreteSimuladas(
  municipio: string,
  estado: string,
  peso_kg: number,
  valor_nf: number
): Promise<FreteOpcao[]> {
  // Simulação: retornar transportadoras que atendem
  const transportadoras = ["Sedex", "PAC", "Loggi", "Transportadora Local"];
  
  return transportadoras.map((t) => ({
    transportadora: t,
    preco: Math.round((peso_kg * 2.5 + valor_nf * 0.01) * 100) / 100,
    prazo_dias: t === "Sedex" ? 2 : t === "PAC" ? 5 : 3,
    tipo_prazo: "corridos",
  }));
}
