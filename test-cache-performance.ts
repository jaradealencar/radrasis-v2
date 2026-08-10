/**
 * Script de teste para validar performance do cache local
 * Testa se a busca de OS 6809 retorna em <1ms do cache
 */

import { getDb } from "./server/db";
import { erpOsCache } from "./drizzle/schema";
import { eq, sql } from "drizzle-orm";

async function testarCachePerformance() {
  console.log("🧪 [TESTE] Iniciando teste de performance do cache...\n");

  const db = await getDb();
  const osNumero = "6809";

  // ✅ TESTE 1: Contar total de registros no cache
  console.log("📊 TESTE 1: Contando registros no cache...");
  const countResult = await db.select({ count: sql`COUNT(*) as total` }).from(erpOsCache).then(r => r[0]);
  const totalRegistros = (countResult as any)?.count || 0;
  console.log(`✅ Total de registros em cache: ${totalRegistros}\n`);

  // ✅ TESTE 2: Buscar OS 6809 com medição de tempo
  console.log(`⏱️  TESTE 2: Buscando OS ${osNumero} no cache...`);
  const inicioCache = performance.now();
  
  const osCache = await db.select().from(erpOsCache).where(eq(erpOsCache.numeroOs, osNumero)).then(r => r[0]);
  
  const tempoCache = performance.now() - inicioCache;
  
  if (osCache) {
    console.log(`✅ OS ${osNumero} encontrada no cache!`);
    console.log(`⏱️  Tempo de resposta: ${tempoCache.toFixed(2)}ms`);
    console.log(`📍 Dados retornados:`);
    console.log(`   - Número OS: ${osCache.numeroOs}`);
    console.log(`   - CNPJ: ${osCache.cnpj}`);
    console.log(`   - Razão Social: ${osCache.razaoSocial}`);
    console.log(`   - Município: ${osCache.municipio}`);
    console.log(`   - Estado: ${osCache.estado}`);
    console.log(`   - CEP: ${osCache.cep}`);
    console.log(`   - Endereço: ${osCache.endereco}`);
    console.log(`   - Sincronizado em: ${osCache.sincronizadoEm}\n`);

    // ✅ Validação
    if (tempoCache < 1) {
      console.log(`✅ SUCESSO: Tempo < 1ms (${tempoCache.toFixed(2)}ms) ✓`);
    } else if (tempoCache < 10) {
      console.log(`⚠️  AVISO: Tempo entre 1-10ms (${tempoCache.toFixed(2)}ms) - Aceitável`);
    } else {
      console.log(`❌ FALHA: Tempo > 10ms (${tempoCache.toFixed(2)}ms) - Lento demais`);
    }
  } else {
    console.log(`❌ OS ${osNumero} NÃO encontrada no cache`);
    console.log(`⏱️  Tempo de resposta: ${tempoCache.toFixed(2)}ms`);
    console.log(`💡 Sugestão: Executar sincronização manual para popular cache\n`);
  }

  // ✅ TESTE 3: Listar últimas 5 OSs no cache
  console.log(`\n📋 TESTE 3: Últimas 5 OSs no cache...`);
  const ultimasOs = await db.select().from(erpOsCache).orderBy(sql`${erpOsCache.sincronizadoEm} DESC`).limit(5);
  
  if (ultimasOs.length > 0) {
    ultimasOs.forEach((os: any, idx: number) => {
      console.log(`${idx + 1}. OS ${os.numeroOs} - ${os.razaoSocial} (${os.municipio}, ${os.estado})`);
    });
  } else {
    console.log(`❌ Nenhuma OS encontrada no cache`);
  }

  console.log("\n✅ Teste concluído!");
}

// Executar teste
testarCachePerformance()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Erro ao executar teste:", error);
    process.exit(1);
  });
