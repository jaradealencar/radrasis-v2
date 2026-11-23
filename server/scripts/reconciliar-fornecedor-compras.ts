import "dotenv/config";
import { getDb } from "../db/db";
import { getPool, safeErrorType } from "../db/db-connection";
import { nfCompraImportacoes, suppliers } from "../../drizzle/schema";
import { integrarFornecedorDocumento } from "../services/fornecedorDocumentos";
import { assertMigrationTarget } from "./migration-safety";

async function main() {
  assertMigrationTarget();
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível");
  const notas = await db.select().from(nfCompraImportacoes);
  let registradas = 0;
  let pendentes = 0;
  for (const nota of notas) {
    const resultado = await integrarFornecedorDocumento({ cnpj: nota.cnpjFornecedor, nome: nota.nomeFornecedor,
      nf: { chave: nota.chaveAcesso, numero: nota.numero, serie: nota.serie,
        dataEmissao: nota.dataEmissao, valorProdutos: Number(nota.valorProdutos), origem: "historico_auditoria" },
    });
    if (resultado?.compraRegistrada) registradas++;
    if (resultado?.nfSemIdentificacao) pendentes++;
  }
  const cadastros = await db.select().from(suppliers);
  for (const cadastro of cadastros) {
    if (!cadastro.nfeNumero && !cadastro.nfeChaveAcesso) continue;
    const resultado = await integrarFornecedorDocumento({ fornecedorId: cadastro.id,
      cnpj: cadastro.nfeCnpj, nome: cadastro.nfeRazaoSocial || cadastro.company || cadastro.name,
      nf: { chave: cadastro.nfeChaveAcesso, numero: cadastro.nfeNumero, serie: cadastro.nfeSerie, origem: "historico_painel" },
    });
    if (resultado?.compraRegistrada) registradas++;
    if (resultado?.nfSemIdentificacao) pendentes++;
  }
  console.info(JSON.stringify({ comprasRegistradas: registradas, documentosSemIdentificacao: pendentes }));
}
main().catch(error => { console.error("Falha na reconciliação:", safeErrorType(error)); process.exitCode = 1; })
  .finally(() => getPool().end());
