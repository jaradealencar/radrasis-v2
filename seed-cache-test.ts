/**
 * Script para popular cache com dados de teste
 * Insere OS 6809 e outras OSs para teste de performance
 */

import { getDb } from "./server/db";
import { erpOsCache } from "./drizzle/schema";

async function seedCacheTest() {
  console.log("🌱 [SEED] Populando cache com dados de teste...\n");

  const db = await getDb();

  // Dados de teste para OS 6809
  const testData = [
    {
      numeroOs: "6809",
      cnpj: "43.001.533/0001-09",
      razaoSocial: "DENIS RODRIGUES DE OLIVEIRA",
      municipio: "ANDRADINA",
      estado: "SP",
      cep: "16901-125",
      endereco: "Rua das Flores, 123, Centro",
      valorTotal: "1500.00",
      sincronizadoEm: new Date(),
    },
    {
      numeroOs: "6810",
      cnpj: "12.345.678/0001-90",
      razaoSocial: "EMPRESA TESTE LTDA",
      municipio: "SÃO PAULO",
      estado: "SP",
      cep: "01310-100",
      endereco: "Avenida Paulista, 1000",
      valorTotal: "2500.00",
      sincronizadoEm: new Date(),
    },
    {
      numeroOs: "6811",
      cnpj: "98.765.432/0001-21",
      razaoSocial: "COMERCIAL BRASIL S.A.",
      municipio: "CAMPINAS",
      estado: "SP",
      cep: "13010-902",
      endereco: "Rua 13 de Maio, 500",
      valorTotal: "3200.00",
      sincronizadoEm: new Date(),
    },
  ];

  try {
    // Limpar cache anterior
    console.log("🗑️  Limpando cache anterior...");
    await db.delete(erpOsCache);
    console.log("✅ Cache limpo\n");

    // Inserir dados de teste
    console.log("📝 Inserindo dados de teste...");
    for (const data of testData) {
      await db.insert(erpOsCache).values(data as any);
      console.log(`✅ OS ${data.numeroOs} inserida`);
    }

    console.log("\n✅ Cache populado com sucesso!");
    console.log(`📊 Total de registros: ${testData.length}`);
    console.log("\n💡 Agora você pode testar a busca com OS 6809 no navegador!");

    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao popular cache:", error);
    process.exit(1);
  }
}

seedCacheTest();
