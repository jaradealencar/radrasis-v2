/**
 * Copia as tabelas de pintura da página 13 (Novo Cliente, referência) para a
 * página 3 (Clientes Antigos), preservando os IDs próprios da tabela destino quando as
 * linhas e faixas correspondem. A gravação também registra histórico e métrica
 * pelo fluxo normal da Tabela de Preços.
 * `--restaurar-referencia` recupera a página 13 a partir do histórico se uma
 * execução anterior deste script a tiver substituído pela página 3.
 *
 * Por padrão, apenas simula. Para gravar, informe --gravar e confirme o alvo:
 *   yarn tsx server/scripts/sincronizar-pintura-novo-cliente.ts
 *   yarn tsx server/scripts/sincronizar-pintura-novo-cliente.ts --gravar --confirmo-alvo=host/banco
 *   yarn tsx server/scripts/sincronizar-pintura-novo-cliente.ts --prod
 *   yarn tsx server/scripts/sincronizar-pintura-novo-cliente.ts --prod --gravar --confirmo-alvo=host/banco
 *   yarn tsx server/scripts/sincronizar-pintura-novo-cliente.ts --prod --restaurar-referencia --gravar --confirmo-alvo=host/banco
 */
import "dotenv/config";

import { and, desc, eq } from "drizzle-orm";
import type { ContentJson, MarginRow } from "../../shared/price-table";
import { priceTableHistory, priceTableSections } from "../../drizzle/schema";
import {
  confirmarAlvo,
  identificarAlvo,
} from "../sync/backfill-historico-orcamentos";

const AUTOR_SINCRONIZACAO = "sincronização das tabelas de pintura";

type Secao = {
  id: number;
  page: number;
  sectionTitle: string;
  contentJson: string;
  notes: string | null;
};

type TabelaMargem = ContentJson & {
  columns: string[];
  rows: MarginRow[];
  faixaIds?: number[];
};

function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function buscarSecao(secoes: Secao[], page: number, termo: string): Secao {
  const termoNormalizado = normalizarTexto(termo);
  const encontradas = secoes.filter(
    secao =>
      secao.page === page &&
      normalizarTexto(secao.sectionTitle).includes(termoNormalizado)
  );
  if (encontradas.length !== 1) {
    throw new Error(
      `Esperava uma seção de pintura "${termo}" na página ${page}; encontrei ${encontradas.length}.`
    );
  }
  return encontradas[0];
}

function lerTabela(secao: Secao): TabelaMargem {
  const content = JSON.parse(secao.contentJson) as TabelaMargem;
  if (
    (content.type !== "margin_table" &&
      content.type !== "margin_table_multi") ||
    !Array.isArray(content.columns) ||
    !Array.isArray(content.rows)
  ) {
    throw new Error(`A seção "${secao.sectionTitle}" não é uma tabela de margem válida.`);
  }
  return content;
}

function copiarTabelaPreservandoIds(
  origem: TabelaMargem,
  destino: TabelaMargem
): TabelaMargem {
  const idsUsados = new Set<number>();
  const rows = origem.rows.map((row, index) => {
    const correspondentePorRotulo = destino.rows.find(
      item => item.label === row.label && item.id > 0 && !idsUsados.has(item.id)
    );
    const correspondentePorPosicao = destino.rows[index];
    const id =
      correspondentePorRotulo?.id ??
      (correspondentePorPosicao?.id > 0 &&
      !idsUsados.has(correspondentePorPosicao.id)
        ? correspondentePorPosicao.id
        : 0);
    if (id > 0) idsUsados.add(id);
    return { ...row, id };
  });

  const offsetOrigem = origem.type === "margin_table_multi" ? 1 : 0;
  const offsetDestino = destino.type === "margin_table_multi" ? 1 : 0;
  const faixaIds = origem.columns.slice(offsetOrigem).map(coluna => {
    const indiceColunaDestino = destino.columns.findIndex(
      item => normalizarTexto(item.trim()) === normalizarTexto(coluna.trim())
    );
    if (indiceColunaDestino < offsetDestino) return 0;
    return destino.faixaIds?.[indiceColunaDestino - offsetDestino] ?? 0;
  });

  return {
    ...origem,
    rows,
    faixaIds,
  };
}

function tabelasVisualmenteIguais(a: TabelaMargem, b: TabelaMargem): boolean {
  return (
    a.type === b.type &&
    JSON.stringify(a.columns) === JSON.stringify(b.columns) &&
    JSON.stringify(a.rows.map(({ label, values }) => ({ label, values }))) ===
      JSON.stringify(b.rows.map(({ label, values }) => ({ label, values })))
  );
}

async function main() {
  const usarProducao = process.argv.includes("--prod");
  const gravar = process.argv.includes("--gravar");
  const restaurarReferencia = process.argv.includes("--restaurar-referencia");
  if (usarProducao) {
    if (!process.env.PRODUCTION_DATABASE_URL) {
      throw new Error("PRODUCTION_DATABASE_URL não está definida no .env.");
    }
    process.env.DATABASE_URL = process.env.PRODUCTION_DATABASE_URL;
  }

  const alvo = gravar
    ? confirmarAlvo(
        process.env.DATABASE_URL,
        process.argv
          .slice(2)
          .find(argument => argument.startsWith("--confirmo-alvo="))
          ?.slice("--confirmo-alvo=".length)
      )
    : identificarAlvo(process.env.DATABASE_URL);
  console.log(
    `${gravar ? "GRAVANDO" : "SIMULAÇÃO (nada será gravado)"} em ${alvo}.`
  );

  const { getDb, getPriceTableMeta, listPriceTableSections, updatePriceTableSection } =
    await import("../db/db");
  const db = await getDb();
  if (!db) throw new Error("Banco indisponível.");

  const secoes = (await db.select().from(priceTableSections)) as Secao[];
  const alteracoes: Array<{ origem: Secao; destino: Secao; contentJson: string }> = [];
  const restauracoes: Array<{ secao: Secao; contentJson: string }> = [];
  for (const termo of ["Serviço de Pintura Galvanizado", "Serviço de Pintura PVC"]) {
    const origem = buscarSecao(secoes, 13, termo);
    const destino = buscarSecao(secoes, 3, termo);
    let contentOrigem = origem.contentJson;
    if (restaurarReferencia) {
      const [historico] = await db
        .select()
        .from(priceTableHistory)
        .where(
          and(
            eq(priceTableHistory.sectionId, origem.id),
            eq(priceTableHistory.autor, AUTOR_SINCRONIZACAO),
            eq(priceTableHistory.campoAlterado, "contentJson")
          )
        )
        .orderBy(desc(priceTableHistory.createdAt), desc(priceTableHistory.id))
        .limit(1);
      if (!historico?.valorAnterior || !historico.valorNovo) {
        throw new Error(`Não encontrei no histórico a pintura original de Novo Cliente: ${termo}.`);
      }
      if (
        !tabelasVisualmenteIguais(
          lerTabela(origem),
          lerTabela({ ...origem, contentJson: historico.valorNovo })
        )
      ) {
        throw new Error(`A seção de Novo Cliente mudou desde a cópia anterior: ${termo}.`);
      }
      contentOrigem = historico.valorAnterior;
      restauracoes.push({ secao: origem, contentJson: contentOrigem });
      console.log(`Referência original de Novo Cliente recuperável pelo histórico: ${termo}.`);
    }

    const tabelaOrigem = lerTabela({ ...origem, contentJson: contentOrigem });
    const tabelaDestino = lerTabela(destino);
    if (tabelasVisualmenteIguais(tabelaOrigem, tabelaDestino)) {
      console.log(`Sem diferença: ${termo}.`);
      continue;
    }
    const conteudo = copiarTabelaPreservandoIds(tabelaOrigem, tabelaDestino);
    alteracoes.push({ origem, destino, contentJson: JSON.stringify(conteudo) });
    console.log(
      `${termo}: página 13 (${tabelaOrigem.rows.length} linhas) → página 3 (${tabelaDestino.rows.length} linhas atuais).`
    );
  }

  if (!gravar || (alteracoes.length === 0 && restauracoes.length === 0)) return;

  for (const restauracao of restauracoes) {
    await updatePriceTableSection(
      restauracao.secao.id,
      { contentJson: restauracao.contentJson },
      "restauração da referência Novo Cliente"
    );
  }
  for (const alteracao of alteracoes) {
    await updatePriceTableSection(
      alteracao.destino.id,
      { contentJson: alteracao.contentJson },
      AUTOR_SINCRONIZACAO
    );
  }

  const [paginaNovoCliente, paginaClientesAntigos] = await Promise.all([
    listPriceTableSections(13),
    listPriceTableSections(3),
  ]);
  for (const termo of ["Serviço de Pintura Galvanizado", "Serviço de Pintura PVC"]) {
    const referencia = lerTabela(buscarSecao(paginaNovoCliente, 13, termo));
    const antiga = lerTabela(buscarSecao(paginaClientesAntigos, 3, termo));
    if (!tabelasVisualmenteIguais(referencia, antiga)) {
      throw new Error(`A verificação pós-gravação falhou para ${termo}.`);
    }
  }
  console.log("Verificação concluída: as duas tabelas exibidas estão iguais.");
  const meta = await getPriceTableMeta();
  console.log(`Versão atual da Tabela de Preços: ${meta?.versao ?? "desconhecida"}.`);
}

main()
  .catch(error => {
    console.error("Falha ao sincronizar as tabelas de pintura:", error?.message ?? error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!process.env.DATABASE_URL) return;
    const { getPool } = await import("../db/db-connection");
    await getPool().end();
  });
