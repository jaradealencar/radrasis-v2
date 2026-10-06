import * as XLSX from "xlsx";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { BASES_COBRANCA_PRODUTO } from "../../shared/base-cobranca-produto";
import { traduzirPerfilConsumoMubiSys } from "../../shared/perfil-consumo-mubisys";
import {
  acabamentos, composicaoItemAcabamentos, composicaoItemEquipamentos, composicoesVariacoes,
  equipamentos, materiasPrimas, mubisysEspelhoSyncStatus, mubisysVariacoes,
  type InsertAcabamentoMubiSys, type InsertComposicaoVariacaoEspelho,
  type InsertEquipamentoMubiSys, type InsertMateriaPrimaEspelho, type InsertMubiSysVariacaoEspelho,
} from "../../drizzle/schema";
import { getDb } from "../db/db";
import { listarMateriasPrimas, listarProdutos, type MubiSysMateriaPrima, type MubiSysProduto } from "../integrations/mubisys-client";

export const CHAVE_SYNC_CATALOGO = "catalogo";
export const TTL_SYNC_CATALOGO_MS = 6 * 60 * 60 * 1000;
const TAMANHO_LOTE = 250;
const LIMITE_LINHAS_COMPOSICAO = 20_000;
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

function normalizarChave(valor: string): string {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function texto(valor: unknown): string { return valor == null ? "" : String(valor).trim(); }
function numero(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().replace(/\s/g, "");
  if (!limpo) return null;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : null;
}
function valorPorChave(objeto: Record<string, unknown>, aliases: string[]): unknown {
  const chaves = new Map(Object.entries(objeto).map(([chave, valor]) => [normalizarChave(chave), valor]));
  for (const alias of aliases) { const valor = chaves.get(normalizarChave(alias)); if (valor != null && texto(valor) !== "") return valor; }
  return undefined;
}
function numeroOpcional(objeto: Record<string, unknown>, aliases: string[]): number | null { return numero(valorPorChave(objeto, aliases)); }
function codigoOrigem(objeto: Record<string, unknown>, prefixo: string, id: number): string {
  const valor = texto(valorPorChave(objeto, ["sku", "sku_erp", "codigo", "codigo_sku", "referencia", "referencia_sku"]));
  return (valor || `${prefixo}-${id}`).slice(0, 120);
}
function registroAtivo(status: unknown): boolean {
  return !["inativo", "inativa", "nao", "0", "false", "cancelado", "cancelada"].includes(normalizarChave(texto(status)));
}
function emLotes<T>(linhas: T[], tamanho = TAMANHO_LOTE): T[][] {
  const lotes: T[][] = [];
  for (let i = 0; i < linhas.length; i += tamanho) lotes.push(linhas.slice(i, i + tamanho));
  return lotes;
}
function decimal(valor: number | null | undefined): string | null { return valor == null ? null : String(valor); }

function mapearMateria(materia: MubiSysMateriaPrima, existente?: typeof materiasPrimas.$inferSelect, agora = new Date()): InsertMateriaPrimaEspelho {
  const bruto = materia as unknown as Record<string, unknown>;
  const id = Number(materia.id);
  const unidade = texto(materia.unidade_movimentacao || materia.unidade_custo);
  const custo = numero(materia.valor_custo);
  const espessura = numeroOpcional(bruto, ["espessura_mm", "espessura"]);
  const densidade = numeroOpcional(bruto, ["densidade_kg_m3", "densidade"]);
  const largura = numeroOpcional(bruto, ["largura_util_mm", "largura_util", "largura"]);
  const altura = numeroOpcional(bruto, ["altura_util_mm", "altura_util", "altura"]);
  return {
    skuErp: codigoOrigem(bruto, `MUBISYS-MP-${id}`, id), mubisysMateriaPrimaId: id,
    nome: texto(materia.nome).slice(0, 256), unidadeMedida: unidade.slice(0, 80), custoUnitario: decimal(custo),
    larguraUtilMm: decimal(largura ?? (existente?.larguraUtilMm == null ? null : Number(existente.larguraUtilMm))),
    alturaUtilMm: decimal(altura ?? (existente?.alturaUtilMm == null ? null : Number(existente.alturaUtilMm))),
    espessuraMm: decimal(espessura ?? (existente?.espessuraMm == null ? null : Number(existente.espessuraMm))),
    densidadeKgM3: decimal(densidade ?? (existente?.densidadeKgM3 == null ? null : Number(existente.densidadeKgM3))),
    categoriaErp: texto(materia.categoria).slice(0, 128), tipoErp: texto(materia.tipo).slice(0, 128),
    statusErp: texto(materia.status).slice(0, 64), ativa: registroAtivo(materia.status),
    referenciaCusto: texto(materia.data_referencia).slice(0, 80) || null, sincronizadoEm: agora, updatedAt: agora,
  };
}

function mapearVariacoes(produtos: MubiSysProduto[], agora = new Date()): InsertMubiSysVariacaoEspelho[] {
  const resultado: InsertMubiSysVariacaoEspelho[] = [];
  for (const produto of produtos) {
    const produtoId = Number(produto.id), produtoBruto = produto as unknown as Record<string, unknown>;
    const skuProduto = codigoOrigem(produtoBruto, `MUBISYS-PROD-${produtoId}`, produtoId);
    for (const modelo of produto.modelos ?? []) {
      const modeloId = Number(modelo.id), modeloBruto = modelo as unknown as Record<string, unknown>;
      const skuModelo = codigoOrigem(modeloBruto, `MUBISYS-MOD-${modeloId}`, modeloId);
      const produtoAtivo = registroAtivo(produto.status), modeloAtivo = produtoAtivo && registroAtivo(modelo.status);
      resultado.push({
        skuErp: skuModelo, tipo: "modelo", skuProdutoErp: skuProduto, skuModeloErp: skuModelo,
        mubisysProdutoId: produtoId, mubisysModeloId: modeloId, mubisysVariacaoId: null,
        produtoNome: texto(produto.nome).slice(0, 256), categoriaProduto: texto(produto.categoria).slice(0, 128), produtoStatus: texto(produto.status).slice(0, 64),
        modeloNome: texto(modelo.nome).slice(0, 256), unidadeCobranca: texto(modelo.unidade_cobranca).slice(0, 80), modeloStatus: texto(modelo.status).slice(0, 64),
        modeloValorFinal: decimal(numero(modelo.valor_final)), variacaoNome: null, variacaoDescricao: null, variacaoStatus: null, variacaoValorFinal: null,
        variacaoPadrao: false, ativa: modeloAtivo, sincronizadoEm: agora, updatedAt: agora,
      });
      for (const variacao of modelo.variacoes ?? []) {
        const variacaoId = Number(variacao.id), bruto = variacao as unknown as Record<string, unknown>;
        const skuVariacao = codigoOrigem(bruto, `MUBISYS-VAR-${variacaoId}`, variacaoId);
        resultado.push({
          skuErp: skuVariacao, tipo: "variacao", skuProdutoErp: skuProduto, skuModeloErp: skuModelo,
          mubisysProdutoId: produtoId, mubisysModeloId: modeloId, mubisysVariacaoId: variacaoId,
          produtoNome: texto(produto.nome).slice(0, 256), categoriaProduto: texto(produto.categoria).slice(0, 128), produtoStatus: texto(produto.status).slice(0, 64),
          modeloNome: texto(modelo.nome).slice(0, 256), unidadeCobranca: texto(modelo.unidade_cobranca).slice(0, 80), modeloStatus: texto(modelo.status).slice(0, 64),
          modeloValorFinal: decimal(numero(modelo.valor_final)), variacaoNome: texto(variacao.nome).slice(0, 256),
          variacaoDescricao: texto(variacao.descricao).slice(0, 5000) || null, variacaoStatus: texto(variacao.status).slice(0, 64),
          variacaoValorFinal: decimal(numero(variacao.valor_final)),
          variacaoPadrao: variacao.padrao === true || ["sim", "1", "true"].includes(texto(variacao.padrao).toLowerCase()),
          ativa: modeloAtivo && registroAtivo(variacao.status), sincronizadoEm: agora, updatedAt: agora,
        });
      }
    }
  }
  return resultado;
}

let sincronizacaoEmCurso: Promise<{ produtos: number; variacoes: number; materiasPrimas: number }> | null = null;
/** Sincroniza os endpoints oficiais de produto/matéria-prima com upsert local e transacional. */
export async function sincronizarCatalogoMubiSys(): Promise<{ produtos: number; variacoes: number; materiasPrimas: number }> {
  if (sincronizacaoEmCurso) return sincronizacaoEmCurso;
  sincronizacaoEmCurso = executarSincronizacaoCatalogo();
  try { return await sincronizacaoEmCurso; } finally { sincronizacaoEmCurso = null; }
}

async function executarSincronizacaoCatalogo(): Promise<{ produtos: number; variacoes: number; materiasPrimas: number }> {
  const db = await getDb();
  if (!db) throw new Error("Banco de dados indisponível para atualizar o espelho local.");
  const agora = new Date();
  await db.insert(mubisysEspelhoSyncStatus).values({ chave: CHAVE_SYNC_CATALOGO, status: "executando", ultimaTentativaEm: agora, ultimoErro: null, updatedAt: agora })
    .onConflictDoUpdate({ target: mubisysEspelhoSyncStatus.chave, set: { status: "executando", ultimaTentativaEm: agora, ultimoErro: null, updatedAt: agora } });
  try {
    const [produtos, materiaisApi] = await Promise.all([listarProdutos(), listarMateriasPrimas()]);
    if (!produtos.length || !materiaisApi.length) {
      throw new Error("A API do MubiSys retornou um catálogo vazio; o espelho existente foi preservado.");
    }
    const existentes = await db.select().from(materiasPrimas);
    const existentePorId = new Map(existentes.map(item => [item.mubisysMateriaPrimaId, item]));
    const materiais = materiaisApi.map(item => mapearMateria(item, existentePorId.get(Number(item.id)), agora));
    const variacoes = mapearVariacoes(produtos, agora);
    await db.transaction(async tx => {
      await tx.update(materiasPrimas).set({ ativa: false, updatedAt: agora });
      await tx.update(mubisysVariacoes).set({ ativa: false, updatedAt: agora });
      for (const lote of emLotes(materiais)) await tx.insert(materiasPrimas).values(lote).onConflictDoUpdate({
        target: materiasPrimas.mubisysMateriaPrimaId,
        set: {
          skuErp: sql`excluded.sku_erp`, nome: sql`excluded.nome`, unidadeMedida: sql`excluded.unidade_medida`, custoUnitario: sql`excluded.custo_unitario`,
          larguraUtilMm: sql`excluded.largura_util_mm`, alturaUtilMm: sql`excluded.altura_util_mm`, espessuraMm: sql`excluded.espessura_mm`, densidadeKgM3: sql`excluded.densidade_kg_m3`,
          categoriaErp: sql`excluded.categoria_erp`, tipoErp: sql`excluded.tipo_erp`, statusErp: sql`excluded.status_erp`, ativa: sql`excluded.ativa`,
          referenciaCusto: sql`excluded.referencia_custo`, sincronizadoEm: agora, updatedAt: agora,
        },
      });
      for (const lote of emLotes(variacoes)) await tx.insert(mubisysVariacoes).values(lote).onConflictDoUpdate({
        target: mubisysVariacoes.skuErp,
        set: {
          tipo: sql`excluded.tipo`, skuProdutoErp: sql`excluded.sku_produto_erp`, skuModeloErp: sql`excluded.sku_modelo_erp`,
          mubisysProdutoId: sql`excluded.mubisys_produto_id`, mubisysModeloId: sql`excluded.mubisys_modelo_id`, mubisysVariacaoId: sql`excluded.mubisys_variacao_id`,
          produtoNome: sql`excluded.produto_nome`, categoriaProduto: sql`excluded.categoria_produto`, produtoStatus: sql`excluded.produto_status`,
          modeloNome: sql`excluded.modelo_nome`, unidadeCobranca: sql`excluded.unidade_cobranca`, modeloStatus: sql`excluded.modelo_status`, modeloValorFinal: sql`excluded.modelo_valor_final`,
          variacaoNome: sql`excluded.variacao_nome`, variacaoDescricao: sql`excluded.variacao_descricao`, variacaoStatus: sql`excluded.variacao_status`,
          variacaoValorFinal: sql`excluded.variacao_valor_final`, variacaoPadrao: sql`excluded.variacao_padrao`, ativa: sql`excluded.ativa`, sincronizadoEm: agora, updatedAt: agora,
        },
      });
      await tx.insert(mubisysEspelhoSyncStatus).values({ chave: CHAVE_SYNC_CATALOGO, status: "sucesso", ultimaTentativaEm: agora, ultimaSincronizacaoEm: agora,
        produtosSincronizados: produtos.length, variacoesSincronizadas: variacoes.length, materiasPrimasSincronizadas: materiais.length, updatedAt: agora,
      }).onConflictDoUpdate({ target: mubisysEspelhoSyncStatus.chave, set: { status: "sucesso", ultimaTentativaEm: agora, ultimaSincronizacaoEm: agora,
        produtosSincronizados: produtos.length, variacoesSincronizadas: variacoes.length, materiasPrimasSincronizadas: materiais.length, ultimoErro: null, updatedAt: agora,
      } });
    });
    return { produtos: produtos.length, variacoes: variacoes.length, materiasPrimas: materiais.length };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : "Falha desconhecida na API do MubiSys.";
    await db.insert(mubisysEspelhoSyncStatus).values({ chave: CHAVE_SYNC_CATALOGO, status: "erro", ultimaTentativaEm: agora, ultimoErro: mensagem, updatedAt: agora })
      .onConflictDoUpdate({ target: mubisysEspelhoSyncStatus.chave, set: { status: "erro", ultimaTentativaEm: agora, ultimoErro: mensagem, updatedAt: agora } });
    throw error;
  }
}

export async function catalogoPrecisaSincronizar(db?: Db): Promise<boolean> {
  const conexao = db ?? await getDb();
  if (!conexao) return false;
  const [status] = await conexao.select().from(mubisysEspelhoSyncStatus).where(eq(mubisysEspelhoSyncStatus.chave, CHAVE_SYNC_CATALOGO)).limit(1);
  return !status?.ultimaSincronizacaoEm || Date.now() - status.ultimaSincronizacaoEm.getTime() >= TTL_SYNC_CATALOGO_MS;
}

/** Garante bootstrap e atualiza snapshots vencidos sem bloquear leituras existentes. */
export async function prepararCatalogoEspelhado(): Promise<void> {
  const status = await obterStatusEspelho();
  if (!status?.ultimaSincronizacaoEm) {
    await sincronizarCatalogoMubiSys();
    return;
  }
  if (Date.now() - status.ultimaSincronizacaoEm.getTime() >= TTL_SYNC_CATALOGO_MS)
    void sincronizarCatalogoMubiSys().catch(error => console.error("[MubiSysEspelho] Atualização em segundo plano falhou:", error));
}

export async function obterStatusEspelho(db?: Db) {
  const conexao = db ?? await getDb();
  if (!conexao) return null;
  const [status] = await conexao.select().from(mubisysEspelhoSyncStatus).where(eq(mubisysEspelhoSyncStatus.chave, CHAVE_SYNC_CATALOGO)).limit(1);
  return status ?? null;
}

/** Forma compatível com as rotas atuais de nesting/CPQ, alimentada exclusivamente pelo Postgres local. */
export async function listarMateriasPrimasEspelhadas(db?: Db): Promise<MubiSysMateriaPrima[]> {
  const conexao = db ?? await getDb();
  if (!conexao) return [];
  const rows = await conexao.select().from(materiasPrimas).where(eq(materiasPrimas.ativa, true)).orderBy(asc(materiasPrimas.nome));
  return rows.map(item => ({
    id: item.mubisysMateriaPrimaId, sku: item.skuErp, nome: item.nome,
    categoria: item.categoriaErp, tipo: item.tipoErp, unidade: item.unidadeMedida,
    valor: item.custoUnitario == null ? 0 : Number(item.custoUnitario),
    atualizado: item.referenciaCusto ?? "", data_referencia: item.referenciaCusto ?? "", status: item.statusErp,
    unidade_custo: item.unidadeMedida, unidade_movimentacao: item.unidadeMedida,
    valor_custo: item.custoUnitario == null ? 0 : Number(item.custoUnitario),
  })) as MubiSysMateriaPrima[];
}

function mapearCatalogoProdutos(rows: typeof mubisysVariacoes.$inferSelect[]) {
  const produtos = new Map<number, {
    id: number; nome: string; categoria: string; status: string;
    modelos: Map<number, { id: number; nome: string; unidade: string; status: string; valorFinal: number; variacoes: Array<Record<string, unknown>> }>;
  }>();
  for (const row of rows) {
    let produto = produtos.get(row.mubisysProdutoId);
    if (!produto) {
      produto = { id: row.mubisysProdutoId, nome: row.produtoNome, categoria: row.categoriaProduto, status: row.produtoStatus, modelos: new Map() };
      produtos.set(row.mubisysProdutoId, produto);
    }
    let modelo = produto.modelos.get(row.mubisysModeloId);
    if (!modelo) {
      modelo = { id: row.mubisysModeloId, nome: row.modeloNome, unidade: row.unidadeCobranca, status: row.modeloStatus,
        valorFinal: Number(row.modeloValorFinal) || 0, variacoes: [] };
      produto.modelos.set(row.mubisysModeloId, modelo);
    }
    if (row.tipo === "variacao" && row.mubisysVariacaoId != null) modelo.variacoes.push({
      id: row.mubisysVariacaoId, nome: row.variacaoNome ?? "", descricao: row.variacaoDescricao ?? "",
      status: row.variacaoStatus ?? "", valorFinal: Number(row.variacaoValorFinal) || 0, padrao: row.variacaoPadrao,
    });
  }
  return [...produtos.values()].map(produto => ({ ...produto, modelos: [...produto.modelos.values()] }));
}

export async function listarProdutosEspelhados(db?: Db) {
  const conexao = db ?? await getDb();
  if (!conexao) return [];
  const rows = await conexao.select().from(mubisysVariacoes).where(eq(mubisysVariacoes.ativa, true))
    .orderBy(asc(mubisysVariacoes.produtoNome), asc(mubisysVariacoes.modeloNome), asc(mubisysVariacoes.variacaoNome));
  return mapearCatalogoProdutos(rows);
}

/** Leitura local: esta função nunca chama o MubiSys. */
export async function carregarCatalogoEspelhado(db?: Db) {
  const conexao = db ?? await getDb();
  if (!conexao) throw new Error("Banco de dados indisponível para ler o catálogo local.");
  const [variacoes, materiais, composicoes, status, acabamentoRows, equipamentoRows] = await Promise.all([
    conexao.select().from(mubisysVariacoes).orderBy(asc(mubisysVariacoes.produtoNome), asc(mubisysVariacoes.modeloNome), asc(mubisysVariacoes.variacaoNome)),
    listarMateriasPrimasEspelhadas(conexao),
    conexao.select({
      itemId: composicoesVariacoes.id,
      produtoId: mubisysVariacoes.mubisysProdutoId,
      modeloId: composicoesVariacoes.mubisysModeloId,
      variacaoId: composicoesVariacoes.mubisysVariacaoId,
      materiaPrimaId: materiasPrimas.mubisysMateriaPrimaId,
      materiaPrimaNome: materiasPrimas.nome,
      materiaPrimaCusto: materiasPrimas.custoUnitario,
      materiaPrimaUnidade: materiasPrimas.unidadeMedida,
      quantidade: composicoesVariacoes.consumoQuantidade,
      unidade: composicoesVariacoes.unidadeConsumo,
      larguraMm: composicoesVariacoes.larguraMm,
      alturaMm: composicoesVariacoes.alturaMm,
      espessuraMm: composicoesVariacoes.espessuraMm,
      descritivoComposicao: composicoesVariacoes.descritivoComposicao,
      ordem: composicoesVariacoes.ordem,
      perfilConsumo: composicoesVariacoes.perfilConsumoMubiSys,
      formulaConsumo: composicoesVariacoes.formulaConsumo,
    }).from(composicoesVariacoes)
      .innerJoin(materiasPrimas, eq(materiasPrimas.skuErp, composicoesVariacoes.materiaPrimaSkuErp))
      .innerJoin(mubisysVariacoes, eq(mubisysVariacoes.skuErp, composicoesVariacoes.variacaoSkuErp))
      .where(eq(materiasPrimas.ativa, true)),
    obterStatusEspelho(conexao),
    conexao.select({
      itemId: composicaoItemAcabamentos.composicaoItemId,
      id: acabamentos.mubisysAcabamentoId, nome: acabamentos.nome, tipo: acabamentos.tipo,
      unidade: composicaoItemAcabamentos.unidade, tipoCalculo: acabamentos.tipoCalculo,
      formulaConsumo: composicaoItemAcabamentos.formulaConsumo,
      quantidade: composicaoItemAcabamentos.quantidade, ordem: composicaoItemAcabamentos.ordem,
      custoMateriaPrima: acabamentos.custoMateriaPrima, custoMaoDeObra: acabamentos.custoMaoDeObra,
      custoAdicional: acabamentos.custoAdicional, produtividadeHora: acabamentos.produtividadeHora,
      horasEquipamento: composicaoItemAcabamentos.horasEquipamento,
    }).from(composicaoItemAcabamentos)
      .innerJoin(acabamentos, eq(acabamentos.id, composicaoItemAcabamentos.acabamentoId)),
    conexao.select({
      itemId: composicaoItemEquipamentos.composicaoItemId,
      id: equipamentos.mubisysEquipamentoId, nome: equipamentos.nome,
      horas: composicaoItemEquipamentos.horas, quantidade: composicaoItemEquipamentos.quantidade,
      ordem: composicaoItemEquipamentos.ordem, custoHora: equipamentos.custoHora,
    }).from(composicaoItemEquipamentos)
      .innerJoin(equipamentos, eq(equipamentos.id, composicaoItemEquipamentos.equipamentoId)),
  ]);
  const acabamentosPorItem = new Map<number, typeof acabamentoRows>();
  for (const row of acabamentoRows) {
    const atuais = acabamentosPorItem.get(row.itemId) ?? [];
    atuais.push(row);
    acabamentosPorItem.set(row.itemId, atuais);
  }
  const equipamentosPorItem = new Map<number, typeof equipamentoRows>();
  for (const row of equipamentoRows) {
    const atuais = equipamentosPorItem.get(row.itemId) ?? [];
    atuais.push(row);
    equipamentosPorItem.set(row.itemId, atuais);
  }
  return {
    produtos: mapearCatalogoProdutos(variacoes),
    materias: materiais,
    composicoesMubiSys: composicoes.map(linha => ({
      ...linha, quantidade: Number(linha.quantidade),
      custoUnitario: linha.materiaPrimaCusto == null ? null : Number(linha.materiaPrimaCusto),
      formulaConsumo: linha.formulaConsumo as (typeof BASES_COBRANCA_PRODUTO)[number],
      acabamentos: (acabamentosPorItem.get(linha.itemId) ?? []).map(item => ({
        ...item, quantidade: Number(item.quantidade),
        custoMateriaPrima: item.custoMateriaPrima == null ? null : Number(item.custoMateriaPrima),
        custoMaoDeObra: item.custoMaoDeObra == null ? null : Number(item.custoMaoDeObra),
        custoAdicional: item.custoAdicional == null ? null : Number(item.custoAdicional),
        produtividadeHora: item.produtividadeHora == null ? null : Number(item.produtividadeHora),
        horasEquipamento: item.horasEquipamento == null ? null : Number(item.horasEquipamento),
      })),
      equipamentos: (equipamentosPorItem.get(linha.itemId) ?? []).map(item => ({
        ...item, horas: Number(item.horas), quantidade: Number(item.quantidade),
        custoHora: item.custoHora == null ? null : Number(item.custoHora),
      })),
    })),
    espelhoStatus: status,
    carregadoEm: new Date().toISOString(),
  };
}

function csvCelula(valor: unknown): string { return `"${(valor == null ? "" : String(valor)).replace(/"/g, '""')}"`; }

export async function gerarTemplateComposicaoCsv(db?: Db): Promise<string> {
  const conexao = db ?? await getDb();
  if (!conexao) throw new Error("Banco de dados indisponível.");
  const linhas = await conexao.select().from(mubisysVariacoes).where(eq(mubisysVariacoes.ativa, true))
    .orderBy(asc(mubisysVariacoes.produtoNome), asc(mubisysVariacoes.modeloNome), asc(mubisysVariacoes.variacaoNome));
  const cabecalho = ["variacao_sku_erp", "mubisys_modelo_id", "mubisys_variacao_id", "produto_nome", "modelo_nome", "variacao_nome", "materia_prima_sku_erp", "mubisys_materia_prima_id", "materia_prima_nome", "unidade_consumo", "consumo_quantidade", "perfil_consumo_mubisys", "largura_mm", "altura_mm", "espessura_mm", "descritivo_composicao", "acabamentos_json", "equipamentos_json", "ordem"];
  const dados = linhas.map(item => [item.skuErp, item.mubisysModeloId, item.mubisysVariacaoId ?? "", item.produtoNome, item.modeloNome,
    item.variacaoNome ?? "(comum do modelo)", "", "", "", "", "", "", "", "", "", "", "[]", "[]", ""]);
  return [cabecalho, ...dados].map(linha => linha.map(csvCelula).join(";")).join("\r\n") + "\r\n";
}

type ItemAcabamentoImportado = {
  id: number; nome: string; tipo: string; unidade: string;
  custoMateriaPrima: number | null; custoMaoDeObra: number | null; custoAdicional: number | null;
  produtividadeHora: number | null; tipoCalculo: string | null; quantidade: number;
  formulaConsumo: (typeof BASES_COBRANCA_PRODUTO)[number] | null; horasEquipamento: number | null; ordem: number;
};
type ItemEquipamentoImportado = {
  id: number; nome: string; tipo: string; custoHora: number | null;
  horas: number; quantidade: number; ordem: number;
};
type LinhaImportada = {
  linha: number;
  variacaoSku: string;
  materiaPrimaSku: string;
  modeloId: number;
  variacaoId: number | null;
  quantidade: number;
  unidade: string;
  perfil: string;
  formula: (typeof BASES_COBRANCA_PRODUTO)[number];
  larguraMm: number | null; alturaMm: number | null; espessuraMm: number | null; descritivo: string;
  acabamentos: ItemAcabamentoImportado[]; equipamentos: ItemEquipamentoImportado[];
  ordem: number;
};

function chaveNormalizada(valor: unknown): string { return normalizarChave(texto(valor)); }
function listaJson(registro: Record<string, unknown>, aliases: string[], numeroLinha: number): Record<string, unknown>[] {
  const valor = valorPorChave(registro, aliases);
  if (valor == null || texto(valor) === "") return [];
  let lista: unknown = valor;
  if (typeof valor === "string") {
    try { lista = JSON.parse(valor); }
    catch { throw new Error("Linha " + numeroLinha + ": JSON de acabamentos/equipamentos inválido."); }
  }
  if (!Array.isArray(lista)) throw new Error("Linha " + numeroLinha + ": acabamentos_json e equipamentos_json devem ser listas JSON.");
  if (lista.length > 200) throw new Error("Linha " + numeroLinha + ": limite de 200 vínculos por item.");
  return lista.map((item, indice) => {
    if (!item || typeof item !== "object" || Array.isArray(item))
      throw new Error("Linha " + numeroLinha + ": vínculo " + (indice + 1) + " não é um objeto JSON.");
    return item as Record<string, unknown>;
  });
}
function mapearAcabamentosImportados(registros: Record<string, unknown>[], numeroLinha: number): ItemAcabamentoImportado[] {
  return registros.map((item, indice) => {
    const id = numeroOpcional(item, ["mubisys_acabamento_id", "acabamento_id", "id"]);
    const nome = texto(valorPorChave(item, ["nome", "acabamento_nome", "titulo"]));
    if (!id || id <= 0 || !nome) throw new Error("Linha " + numeroLinha + ": acabamento " + (indice + 1) + " exige ID MubiSys e nome.");
    const tipoCalculo = texto(valorPorChave(item, ["tipo_calculo", "tipo_calculo_nome", "unidade_calculo"])) || null;
    const formulaTexto = texto(valorPorChave(item, ["formula_consumo", "formula_cpq"]));
    const formula = BASES_COBRANCA_PRODUTO.find(base => base === formulaTexto) ?? traduzirPerfilConsumoMubiSys(tipoCalculo);
    const quantidade = numeroOpcional(item, ["quantidade", "multiplicador", "consumo"]) ?? 1;
    if (quantidade <= 0) throw new Error("Linha " + numeroLinha + ": quantidade do acabamento deve ser maior que zero.");
    return {
      id: Math.trunc(id), nome: nome.slice(0, 256),
      tipo: texto(valorPorChave(item, ["tipo", "categoria"])).slice(0, 120),
      unidade: texto(valorPorChave(item, ["unidade", "unidade_medida"])).slice(0, 40),
      custoMateriaPrima: numeroOpcional(item, ["custo_materia_prima", "custo_mp"]),
      custoMaoDeObra: numeroOpcional(item, ["custo_mao_de_obra", "custo_mo"]),
      custoAdicional: numeroOpcional(item, ["custo_adicional", "custo_total", "valor_total", "valor"]),
      produtividadeHora: numeroOpcional(item, ["produtividade_hora", "unidades_por_hora"]),
      tipoCalculo: tipoCalculo?.slice(0, 24) ?? null, quantidade, formulaConsumo: formula,
      horasEquipamento: numeroOpcional(item, ["horas_equipamento", "horas_maquina"]),
      ordem: Math.trunc(numeroOpcional(item, ["ordem", "sequencia"]) ?? indice),
    };
  });
}
function mapearEquipamentosImportados(registros: Record<string, unknown>[], numeroLinha: number): ItemEquipamentoImportado[] {
  return registros.map((item, indice) => {
    const id = numeroOpcional(item, ["mubisys_equipamento_id", "equipamento_id", "id"]);
    const nome = texto(valorPorChave(item, ["nome", "equipamento_nome", "titulo"]));
    if (!id || id <= 0 || !nome) throw new Error("Linha " + numeroLinha + ": equipamento " + (indice + 1) + " exige ID MubiSys e nome.");
    const horas = numeroOpcional(item, ["horas", "horas_equipamento", "tempo_horas"]) ?? 0;
    const quantidade = numeroOpcional(item, ["quantidade", "multiplicador"]) ?? 1;
    if (horas < 0 || quantidade <= 0) throw new Error("Linha " + numeroLinha + ": horas e quantidade do equipamento são inválidas.");
    return {
      id: Math.trunc(id), nome: nome.slice(0, 256), tipo: texto(valorPorChave(item, ["tipo", "categoria"])).slice(0, 120),
      custoHora: numeroOpcional(item, ["custo_hora", "valor_hora"]), horas, quantidade,
      ordem: Math.trunc(numeroOpcional(item, ["ordem", "sequencia"]) ?? indice),
    };
  });
}
function linhaComoObjeto(cabecalhos: string[], valores: unknown[]): Record<string, unknown> {
  return Object.fromEntries(cabecalhos.map((chave, indice) => [chave, valores[indice]]));
}
function resolverUnico<T>(candidatos: T[], descricao: string, numeroLinha: number): T {
  if (candidatos.length === 1) return candidatos[0];
  throw new Error(candidatos.length ? `Linha ${numeroLinha}: ${descricao} corresponde a mais de um cadastro; informe o SKU/ID.` : `Linha ${numeroLinha}: ${descricao} não foi encontrado no espelho local.`);
}

/** Importa CSV/XLSX com validação integral; nenhum dado é gravado se uma linha falhar. */
export async function importarComposicaoArquivo(
  conteudo: Buffer,
  nomeArquivo: string,
  db?: Db,
): Promise<{ linhas: number; variacoes: number; materiasPrimas: number }> {
  const conexao = db ?? await getDb();
  if (!conexao) throw new Error("Banco de dados indisponível para importar composições.");
  const extensao = nomeArquivo.toLowerCase().split(".").pop();
  if (!conteudo.length || conteudo.length > 4 * 1024 * 1024) throw new Error("O arquivo deve ter conteúdo e no máximo 4 MB.");
  if (extensao !== "csv" && extensao !== "xlsx" && extensao !== "xls") throw new Error("Formato inválido. Envie CSV, XLSX ou XLS.");

  let workbook: XLSX.WorkBook;
  try { workbook = XLSX.read(conteudo, { type: "buffer", raw: true, cellDates: false }); }
  catch { throw new Error("Não foi possível ler a planilha. Confira o arquivo e tente novamente."); }
  const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
  if (!primeiraAba) throw new Error("A planilha não tem nenhuma aba com dados.");
  const matriz = XLSX.utils.sheet_to_json<unknown[]>(primeiraAba, { header: 1, defval: "", raw: true });
  if (matriz.length < 2) throw new Error("Inclua o cabeçalho e pelo menos uma linha de composição.");
  if (matriz.length - 1 > LIMITE_LINHAS_COMPOSICAO) throw new Error(`O limite é ${LIMITE_LINHAS_COMPOSICAO} linhas por arquivo.`);
  const cabecalhos = matriz[0].map(texto);
  const linhasPlanilha = matriz.slice(1).filter(linha => linha.some(celula => texto(celula) !== ""));
  const obrigatorios = ["consumo_quantidade", "unidade_consumo"];
  const chavesCabecalho = new Set(cabecalhos.map(chaveNormalizada));
  const aliasesObrigatorios: Record<string, string[]> = {
    consumo_quantidade: ["consumo_quantidade", "quantidade", "consumo", "qtd"],
    unidade_consumo: ["unidade_consumo", "unidade"],
  };
  for (const campo of obrigatorios) {
    if (!aliasesObrigatorios[campo].some(alias => chavesCabecalho.has(chaveNormalizada(alias)))) throw new Error(`Cabeçalho obrigatório ausente: ${campo}.`);
  }

  const [cadastroVariacoes, cadastroMateriais] = await Promise.all([
    conexao.select().from(mubisysVariacoes), conexao.select().from(materiasPrimas),
  ]);
  const variacaoPorSku = new Map(cadastroVariacoes.map(item => [chaveNormalizada(item.skuErp), item]));
  const materiaPorSku = new Map(cadastroMateriais.map(item => [chaveNormalizada(item.skuErp), item]));
  const preparadas: LinhaImportada[] = [];
  const erros: string[] = [];

  for (let indice = 0; indice < linhasPlanilha.length; indice++) {
    const numeroLinha = indice + 2;
    const registro = linhaComoObjeto(cabecalhos, linhasPlanilha[indice]);
    try {
      const skuVariacao = texto(valorPorChave(registro, ["variacao_sku_erp", "sku_variacao_erp", "sku_modelo_erp"]));
      const modeloIdInformado = numeroOpcional(registro, ["mubisys_modelo_id", "modelo_id"]);
      const variacaoIdInformado = numeroOpcional(registro, ["mubisys_variacao_id", "variacao_id"]);
      let variacao = skuVariacao ? variacaoPorSku.get(chaveNormalizada(skuVariacao)) : undefined;
      if (!variacao && modeloIdInformado != null) {
        const candidatos = cadastroVariacoes.filter(item => item.mubisysModeloId === modeloIdInformado &&
          (variacaoIdInformado == null ? item.tipo === "modelo" : item.mubisysVariacaoId === variacaoIdInformado));
        variacao = resolverUnico(candidatos, `modelo/variação ${modeloIdInformado}/${variacaoIdInformado ?? "comum"}`, numeroLinha);
      }
      if (!variacao && !skuVariacao && modeloIdInformado == null) {
        const modeloNome = chaveNormalizada(valorPorChave(registro, ["modelo_nome", "modelo"]));
        const variacaoNome = chaveNormalizada(valorPorChave(registro, ["variacao_nome", "variação", "variacao"]));
        const produtoNome = chaveNormalizada(valorPorChave(registro, ["produto_nome", "produto"]));
        const candidatos = cadastroVariacoes.filter(item => item.tipo === (variacaoNome ? "variacao" : "modelo") &&
          chaveNormalizada(item.modeloNome) === modeloNome && (!produtoNome || chaveNormalizada(item.produtoNome) === produtoNome) &&
          (!variacaoNome || chaveNormalizada(item.variacaoNome) === variacaoNome));
        variacao = resolverUnico(candidatos, `produto/modelo/variação ${produtoNome}/${modeloNome}/${variacaoNome}`, numeroLinha);
      }
      if (!variacao) throw new Error(`Linha ${numeroLinha}: variação/modelo não identificado; use variacao_sku_erp ou IDs do MubiSys.`);

      const skuMateria = texto(valorPorChave(registro, ["materia_prima_sku_erp", "sku_materia_prima_erp", "sku_material"]));
      const idMateria = numeroOpcional(registro, ["mubisys_materia_prima_id", "materia_prima_id", "material_id"]);
      const nomeMateria = chaveNormalizada(valorPorChave(registro, ["materia_prima_nome", "nome_materia_prima", "material"]));
      let materia = skuMateria ? materiaPorSku.get(chaveNormalizada(skuMateria)) : undefined;
      if (!materia && idMateria != null) materia = cadastroMateriais.find(item => item.mubisysMateriaPrimaId === idMateria);
      if (!materia && nomeMateria) materia = resolverUnico(cadastroMateriais.filter(item => chaveNormalizada(item.nome) === nomeMateria), `matéria-prima "${texto(valorPorChave(registro, ["materia_prima_nome", "nome_materia_prima", "material"]))}"`, numeroLinha);
      if (!materia) throw new Error(`Linha ${numeroLinha}: matéria-prima não identificada; use materia_prima_sku_erp ou ID MubiSys.`);

      const quantidade = numero(valorPorChave(registro, ["consumo_quantidade", "quantidade", "consumo", "qtd"]));
      if (quantidade == null || quantidade <= 0) throw new Error(`Linha ${numeroLinha}: consumo_quantidade deve ser um número maior que zero.`);
      const unidade = texto(valorPorChave(registro, ["unidade_consumo", "unidade"]));
      if (!unidade || unidade.length > 80) throw new Error(`Linha ${numeroLinha}: unidade_consumo é obrigatória (até 80 caracteres).`);
      const perfilInformado = texto(valorPorChave(registro, ["perfil_consumo_mubisys", "perfil_consumo", "perfil"]));
      const formulaInformada = texto(valorPorChave(registro, ["formula_consumo", "formula_cpq"]));
      const formulaExplicita = BASES_COBRANCA_PRODUTO.find(item => item === formulaInformada);
      const formula = formulaExplicita ?? traduzirPerfilConsumoMubiSys(perfilInformado);
      if (!formula) throw new Error(`Linha ${numeroLinha}: perfil de consumo "${perfilInformado || formulaInformada || "vazio"}" não tem equivalência segura no CPQ.`);
      const perfil = perfilInformado || formulaInformada;
      if (!perfil) throw new Error(`Linha ${numeroLinha}: informe o perfil original de consumo do MubiSys.`);
      const ordemInformada = numeroOpcional(registro, ["ordem", "sequencia", "sequência"]);
      const acabamentos = mapearAcabamentosImportados(listaJson(registro, ["acabamentos_json", "acabamentos", "finishings"], numeroLinha), numeroLinha);
      const equipamentos = mapearEquipamentosImportados(listaJson(registro, ["equipamentos_json", "equipamentos", "maquinas_json"], numeroLinha), numeroLinha);
      preparadas.push({ linha: numeroLinha, variacaoSku: variacao.skuErp, materiaPrimaSku: materia.skuErp,
        modeloId: variacao.mubisysModeloId, variacaoId: variacao.mubisysVariacaoId, quantidade, unidade,
        perfil: perfil.slice(0, 160), formula, larguraMm: numeroOpcional(registro, ["largura_mm", "largura"]),
        alturaMm: numeroOpcional(registro, ["altura_mm", "altura"]), espessuraMm: numeroOpcional(registro, ["espessura_mm", "espessura"]),
        descritivo: texto(valorPorChave(registro, ["descritivo_composicao", "descricao", "descritivo"])).slice(0, 10_000),
        acabamentos, equipamentos, ordem: ordemInformada == null ? indice : Math.trunc(ordemInformada) });
    } catch (error) {
      erros.push(error instanceof Error ? error.message : `Linha ${numeroLinha}: dados inválidos.`);
      if (erros.length >= 30) break;
    }
  }
  if (erros.length) throw new Error(`Importação cancelada sem gravar alterações:\n${erros.join("\n")}`);
  if (!preparadas.length) throw new Error("Nenhuma linha válida para importar.");
  const chaves = new Set<string>();
  for (const linha of preparadas) {
    const chave = `${linha.variacaoSku}\0${linha.materiaPrimaSku}\0${linha.ordem}`;
    if (chaves.has(chave)) throw new Error(`Importação cancelada: linhas repetidas para a mesma variação, matéria-prima e ordem (linha ${linha.linha}).`);
    chaves.add(chave);
  }

  const agora = new Date();
  const variacaoSkus = [...new Set(preparadas.map(linha => linha.variacaoSku))];
  const linhasDb: InsertComposicaoVariacaoEspelho[] = preparadas.map(linha => ({
    variacaoSkuErp: linha.variacaoSku, materiaPrimaSkuErp: linha.materiaPrimaSku,
    mubisysModeloId: linha.modeloId, mubisysVariacaoId: linha.variacaoId,
    consumoQuantidade: String(linha.quantidade), unidadeConsumo: linha.unidade,
    larguraMm: decimal(linha.larguraMm), alturaMm: decimal(linha.alturaMm), espessuraMm: decimal(linha.espessuraMm),
    descritivoComposicao: linha.descritivo || null,
    perfilConsumoMubiSys: linha.perfil, formulaConsumo: linha.formula, ordem: linha.ordem,
    origem: "arquivo", importadoEm: agora, updatedAt: agora,
  }));
  await conexao.transaction(async tx => {
    const acabamentosPorId = new Map<number, ItemAcabamentoImportado>();
    const equipamentosPorId = new Map<number, ItemEquipamentoImportado>();
    for (const linha of preparadas) {
      for (const item of linha.acabamentos) acabamentosPorId.set(item.id, item);
      for (const item of linha.equipamentos) equipamentosPorId.set(item.id, item);
    }
    for (const item of acabamentosPorId.values()) {
      const values: InsertAcabamentoMubiSys = {
        mubisysAcabamentoId: item.id, nome: item.nome, tipo: item.tipo, unidade: item.unidade,
        custoMateriaPrima: decimal(item.custoMateriaPrima), custoMaoDeObra: decimal(item.custoMaoDeObra),
        custoAdicional: decimal(item.custoAdicional), produtividadeHora: decimal(item.produtividadeHora),
        tipoCalculo: item.tipoCalculo, ativo: true, atualizadoEm: agora,
      };
      await tx.insert(acabamentos).values(values).onConflictDoUpdate({
        target: acabamentos.mubisysAcabamentoId,
        set: { nome: values.nome, tipo: values.tipo, unidade: values.unidade,
          custoMateriaPrima: values.custoMateriaPrima, custoMaoDeObra: values.custoMaoDeObra,
          custoAdicional: values.custoAdicional, produtividadeHora: values.produtividadeHora,
          tipoCalculo: values.tipoCalculo, ativo: true, atualizadoEm: agora },
      });
    }
    for (const item of equipamentosPorId.values()) {
      const values = { mubisysEquipamentoId: item.id, nome: item.nome, tipo: item.tipo,
        custoHora: decimal(item.custoHora), ativo: true, atualizadoEm: agora };
      await tx.insert(equipamentos).values(values).onConflictDoUpdate({
        target: equipamentos.mubisysEquipamentoId,
        set: { nome: values.nome, tipo: values.tipo, custoHora: values.custoHora, ativo: true, atualizadoEm: agora },
      });
    }
    const acabamentoIds = [...acabamentosPorId.keys()];
    const equipamentoIds = [...equipamentosPorId.keys()];
    const acabamentosLocais = acabamentoIds.length
      ? await tx.select({ id: acabamentos.id, externo: acabamentos.mubisysAcabamentoId }).from(acabamentos).where(inArray(acabamentos.mubisysAcabamentoId, acabamentoIds))
      : [];
    const equipamentosLocais = equipamentoIds.length
      ? await tx.select({ id: equipamentos.id, externo: equipamentos.mubisysEquipamentoId }).from(equipamentos).where(inArray(equipamentos.mubisysEquipamentoId, equipamentoIds))
      : [];
    const acabamentoLocalPorId = new Map(acabamentosLocais.map(item => [item.externo, item.id]));
    const equipamentoLocalPorId = new Map(equipamentosLocais.map(item => [item.externo, item.id]));

    await tx.delete(composicoesVariacoes).where(inArray(composicoesVariacoes.variacaoSkuErp, variacaoSkus));
    const composicaoIdPorChave = new Map<string, number>();
    for (const lote of emLotes(linhasDb)) {
      const inseridas = await tx.insert(composicoesVariacoes).values(lote).returning({
        id: composicoesVariacoes.id, variacaoSkuErp: composicoesVariacoes.variacaoSkuErp,
        materiaPrimaSkuErp: composicoesVariacoes.materiaPrimaSkuErp, ordem: composicoesVariacoes.ordem,
      });
      for (const item of inseridas)
        composicaoIdPorChave.set(item.variacaoSkuErp + "|" + item.materiaPrimaSkuErp + "|" + item.ordem, item.id);
    }
    const vinculosAcabamento: Array<typeof composicaoItemAcabamentos.$inferInsert> = [];
    const vinculosEquipamento: Array<typeof composicaoItemEquipamentos.$inferInsert> = [];
    for (const linha of preparadas) {
      const composicaoItemId = composicaoIdPorChave.get(linha.variacaoSku + "|" + linha.materiaPrimaSku + "|" + linha.ordem);
      if (!composicaoItemId) throw new Error("Não foi possível localizar a linha de composição gravada.");
      for (const item of linha.acabamentos) {
        const acabamentoId = acabamentoLocalPorId.get(item.id);
        if (!acabamentoId) throw new Error("Acabamento sem cadastro local após importação.");
        vinculosAcabamento.push({
          composicaoItemId, acabamentoId, quantidade: String(item.quantidade), unidade: item.tipoCalculo || "",
          formulaConsumo: item.formulaConsumo, ordem: item.ordem,
          horasEquipamento: decimal(item.horasEquipamento),
        });
      }
      for (const item of linha.equipamentos) {
        const equipamentoId = equipamentoLocalPorId.get(item.id);
        if (!equipamentoId) throw new Error("Equipamento sem cadastro local após importação.");
        vinculosEquipamento.push({
          composicaoItemId, equipamentoId, horas: String(item.horas), quantidade: String(item.quantidade), ordem: item.ordem,
        });
      }
    }
    for (const lote of emLotes(vinculosAcabamento)) await tx.insert(composicaoItemAcabamentos).values(lote);
    for (const lote of emLotes(vinculosEquipamento)) await tx.insert(composicaoItemEquipamentos).values(lote);
    const [contagem] = await tx.select({ total: sql<number>`count(*)::int` }).from(composicoesVariacoes);
    await tx.insert(mubisysEspelhoSyncStatus).values({ chave: CHAVE_SYNC_CATALOGO, status: "sucesso",
      ultimaImportacaoComposicaoEm: agora, linhasComposicao: contagem?.total ?? linhasDb.length,
      ultimoArquivo: nomeArquivo.slice(0, 255), ultimoErro: null, updatedAt: agora,
    }).onConflictDoUpdate({ target: mubisysEspelhoSyncStatus.chave, set: {
      ultimaImportacaoComposicaoEm: agora, linhasComposicao: contagem?.total ?? linhasDb.length,
      ultimoArquivo: nomeArquivo.slice(0, 255), ultimoErro: null, updatedAt: agora,
    } });
  });
  return { linhas: preparadas.length, variacoes: variacaoSkus.length, materiasPrimas: new Set(preparadas.map(linha => linha.materiaPrimaSku)).size };
}

// Importa uma BOM JSON em formato de lista plana (array, {items:[]} ou {composicoes:[]}).
// Acabamentos e equipamentos podem vir como arrays aninhados em cada linha.
export async function importarComposicaoJson(conteudo: unknown, nomeArquivo = "bom.json", db?: Db) {
  const linhas = Array.isArray(conteudo)
    ? conteudo
    : conteudo && typeof conteudo === "object"
      ? ((conteudo as Record<string, unknown>).items ?? (conteudo as Record<string, unknown>).composicoes)
      : null;
  if (!Array.isArray(linhas) || linhas.length === 0)
    throw new Error("JSON da BOM deve ser uma lista ou conter items/composicoes.");
  if (linhas.length > LIMITE_LINHAS_COMPOSICAO)
    throw new Error("O limite é " + LIMITE_LINHAS_COMPOSICAO + " linhas por importação.");

  const cabecalhos = [
    "variacao_sku_erp", "mubisys_modelo_id", "mubisys_variacao_id", "produto_nome", "modelo_nome",
    "variacao_nome", "materia_prima_sku_erp", "mubisys_materia_prima_id", "materia_prima_nome",
    "unidade_consumo", "consumo_quantidade", "perfil_consumo_mubisys", "formula_consumo",
    "largura_mm", "altura_mm", "espessura_mm", "descritivo_composicao", "acabamentos_json",
    "equipamentos_json", "ordem",
  ];
  const celulas = (linha: unknown, indice: number): unknown[] => {
    if (!linha || typeof linha !== "object" || Array.isArray(linha))
      throw new Error("Linha JSON " + (indice + 1) + " deve ser um objeto.");
    const registro = linha as Record<string, unknown>;
    const acabs = valorPorChave(registro, ["acabamentos", "finishings"]) ?? [];
    const equips = valorPorChave(registro, ["equipamentos", "maquinas", "machines"]) ?? [];
    return [
      valorPorChave(registro, ["variacao_sku_erp", "sku_variacao_erp", "sku_modelo_erp"]) ?? "",
      valorPorChave(registro, ["mubisys_modelo_id", "modelo_id"]) ?? "",
      valorPorChave(registro, ["mubisys_variacao_id", "variacao_id"]) ?? "",
      valorPorChave(registro, ["produto_nome", "produto"]) ?? "",
      valorPorChave(registro, ["modelo_nome", "modelo"]) ?? "",
      valorPorChave(registro, ["variacao_nome", "variacao"]) ?? "",
      valorPorChave(registro, ["materia_prima_sku_erp", "sku_materia_prima_erp", "sku_material"]) ?? "",
      valorPorChave(registro, ["mubisys_materia_prima_id", "materia_prima_id", "material_id"]) ?? "",
      valorPorChave(registro, ["materia_prima_nome", "nome_materia_prima", "material"]) ?? "",
      valorPorChave(registro, ["unidade_consumo", "unidade"]) ?? "",
      valorPorChave(registro, ["consumo_quantidade", "quantidade", "consumo", "qtd"]) ?? "",
      valorPorChave(registro, ["perfil_consumo_mubisys", "perfil_consumo", "perfil"]) ?? "",
      valorPorChave(registro, ["formula_consumo", "formula_cpq"]) ?? "",
      valorPorChave(registro, ["largura_mm", "largura"]) ?? "",
      valorPorChave(registro, ["altura_mm", "altura"]) ?? "",
      valorPorChave(registro, ["espessura_mm", "espessura"]) ?? "",
      valorPorChave(registro, ["descritivo_composicao", "descricao", "descritivo"]) ?? "",
      JSON.stringify(acabs), JSON.stringify(equips),
      valorPorChave(registro, ["ordem", "sequencia"]) ?? indice,
    ];
  };
  const csv = [cabecalhos, ...linhas.map(celulas)]
    .map(linha => linha.map(csvCelula).join(";"))
    .join("\r\n");
  const resultado = await importarComposicaoArquivo(Buffer.from(csv, "utf8"), "bom.csv", db);
  return { ...resultado, arquivoOrigem: nomeArquivo.slice(0, 255) };
}
