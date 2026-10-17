import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { MubiSysOS } from "../integrations/mubisys-client";
import { getDb } from "../db/db";
import {
  composicoesVariacoes,
  materiaPrimaCadastros,
  materiasPrimas,
  mubisysVariacoes,
  perfilEstoqueBobinas,
  perfilEstoqueItens,
  perfilEstoqueMovimentos,
  perfilEstoqueOs,
} from "../../drizzle/schema";

const normalizar = (valor: unknown) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bliga\b/g, "lig")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const numero = (valor: unknown): number | null => {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const texto = String(valor ?? "")
    .trim()
    .replace(/\s/g, "");
  if (!texto) return null;
  const normalizado = texto.includes(",")
    ? texto.replace(/\./g, "").replace(",", ".")
    : texto;
  const resultado = Number(normalizado);
  return Number.isFinite(resultado) ? resultado : null;
};

const numeroOs = (os: MubiSysOS) =>
  String(os.sequencial_ordem || os.numero_pedido_compra || os.id);
const cancelada = (status: string) => normalizar(status).includes("cancel");

export async function listarEstoquePerfis() {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [itens, totais] = await Promise.all([
    db
      .select()
      .from(perfilEstoqueItens)
      .where(eq(perfilEstoqueItens.ativo, true))
      .orderBy(asc(perfilEstoqueItens.familia), asc(perfilEstoqueItens.nome)),
    db
      .select({
        perfilItemId: perfilEstoqueMovimentos.perfilItemId,
        total: sql<string>`coalesce(sum(${perfilEstoqueMovimentos.quantidade}), 0)`,
      })
      .from(perfilEstoqueMovimentos)
      .groupBy(perfilEstoqueMovimentos.perfilItemId),
  ]);
  const totalPorItem = new Map(
    totais.map(item => [item.perfilItemId, Number(item.total)])
  );
  return itens.map(item => {
    const saldo =
      Number(item.estoqueInicial) + (totalPorItem.get(item.id) ?? 0);
    const consumoHistorico =
      item.consumoMensalHistorico == null
        ? null
        : Number(item.consumoMensalHistorico);
    const alvoManual =
      item.alvoDoisMeses == null ? null : Number(item.alvoDoisMeses);
    const alvoBase =
      alvoManual ?? (consumoHistorico == null ? null : consumoHistorico * 2);
    const horizonteMeses = item.horizonteMeses ?? 2;
    const alvo = alvoBase == null ? null : (alvoBase / 2) * horizonteMeses;
    const consumoMensal =
      alvoManual == null ? consumoHistorico : alvoManual / 2;
    const estoqueMinimoConfigurado =
      item.estoqueMinimo == null ? null : Number(item.estoqueMinimo);
    const estoqueMinimo = estoqueMinimoConfigurado ?? consumoMensal;
    const estoqueMedioCalculado =
      estoqueMinimo == null || consumoMensal == null
        ? null
        : estoqueMinimo + consumoMensal;
    const estoqueMedioConfigurado =
      item.estoqueMedio == null ? null : Number(item.estoqueMedio);
    const estoqueMedio = estoqueMedioConfigurado ?? estoqueMedioCalculado;
    const kgPorMetro = item.kgPorMetro == null ? null : Number(item.kgPorMetro);
    const sugestaoCompra = alvo == null ? null : Math.max(0, alvo - saldo);
    const statusCompra =
      alvo == null
        ? "configurar"
        : estoqueMinimo != null && saldo <= estoqueMinimo
          ? "critico"
          : estoqueMedio != null && saldo <= estoqueMedio
            ? "comprar"
            : saldo < alvo
              ? "abaixo_ideal"
              : "ideal";
    return {
      ...item,
      estoqueInicial: Number(item.estoqueInicial),
      consumoMensalHistorico: consumoHistorico,
      consumoFonte:
        alvoManual != null
          ? "manual"
          : consumoHistorico != null
            ? "historico_2026"
            : "sem_base",
      alvoDoisMeses: alvo,
      alvoBaseDoisMeses: alvoBase,
      horizonteMeses,
      alvoAtual: alvo,
      consumoMensal,
      estoqueMinimoConfigurado,
      estoqueMinimo,
      estoqueMedioConfigurado,
      estoqueMedio,
      statusCompra,
      kgPorMetro,
      saldoAtual: saldo,
      saldoKg:
        item.unidade === "m" && kgPorMetro != null ? saldo * kgPorMetro : null,
      sugestaoCompra,
      sugestaoCompraKg:
        item.unidade === "m" && kgPorMetro != null && sugestaoCompra != null
          ? sugestaoCompra * kgPorMetro
          : null,
      coberturaPct: alvo && alvo > 0 ? Math.max(0, (saldo / alvo) * 100) : null,
    };
  });
}

export async function listarMovimentosPerfis(limite = 100) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db
    .select({
      id: perfilEstoqueMovimentos.id,
      perfilItemId: perfilEstoqueMovimentos.perfilItemId,
      perfilNome: perfilEstoqueItens.nome,
      tipo: perfilEstoqueMovimentos.tipo,
      quantidade: perfilEstoqueMovimentos.quantidade,
      unidade: perfilEstoqueMovimentos.unidade,
      osMubisysId: perfilEstoqueMovimentos.osMubisysId,
      osNumero: perfilEstoqueMovimentos.osNumero,
      descricao: perfilEstoqueMovimentos.descricao,
      criadoPor: perfilEstoqueMovimentos.criadoPor,
      createdAt: perfilEstoqueMovimentos.createdAt,
      updatedAt: perfilEstoqueMovimentos.updatedAt,
    })
    .from(perfilEstoqueMovimentos)
    .innerJoin(
      perfilEstoqueItens,
      eq(perfilEstoqueItens.id, perfilEstoqueMovimentos.perfilItemId)
    )
    .orderBy(
      desc(perfilEstoqueMovimentos.updatedAt),
      desc(perfilEstoqueMovimentos.id)
    )
    .limit(Math.min(500, Math.max(1, limite)));
  return rows.map(row => ({ ...row, quantidade: Number(row.quantidade) }));
}

export async function listarPendenciasEstoquePerfis(limite = 50) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db
    .select()
    .from(perfilEstoqueOs)
    .where(sql`jsonb_array_length(${perfilEstoqueOs.pendenciasJson}) > 0`)
    .orderBy(desc(perfilEstoqueOs.updatedAt))
    .limit(Math.min(200, Math.max(1, limite)));
}

export async function definirSaldoFisicoPerfil(input: {
  perfilItemId: number;
  saldo: number;
  observacao?: string | null;
  usuario: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.transaction(async tx => {
    const [item] = await tx
      .select()
      .from(perfilEstoqueItens)
      .where(eq(perfilEstoqueItens.id, input.perfilItemId))
      .limit(1);
    if (!item) throw new Error("Perfil não encontrado.");
    const [soma] = await tx
      .select({
        total: sql<string>`coalesce(sum(${perfilEstoqueMovimentos.quantidade}), 0)`,
      })
      .from(perfilEstoqueMovimentos)
      .where(eq(perfilEstoqueMovimentos.perfilItemId, input.perfilItemId));
    const saldoAnterior =
      Number(item.estoqueInicial) + Number(soma?.total ?? 0);
    const diferenca = Number((input.saldo - saldoAnterior).toFixed(4));
    if (Math.abs(diferenca) < 0.0001)
      return { saldoAnterior, saldoAtual: input.saldo, alterado: false };
    await tx.insert(perfilEstoqueMovimentos).values({
      perfilItemId: item.id,
      tipo: "ajuste_inventario",
      quantidade: String(diferenca),
      unidade: item.unidade,
      origemChave: `ajuste:${randomUUID()}`,
      descricao:
        input.observacao?.trim() ||
        `Inventário físico: ${saldoAnterior.toFixed(2)} → ${input.saldo.toFixed(2)} ${item.unidade}`,
      criadoPor: input.usuario,
    });
    return { saldoAnterior, saldoAtual: input.saldo, alterado: true };
  });
}

export async function atualizarAlvoPerfil(input: {
  perfilItemId: number;
  alvoDoisMeses: number | null;
  horizonteMeses: number;
  estoqueMinimo?: number | null;
  estoqueMedio?: number | null;
  kgPorMetro?: number | null;
  usuario: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .update(perfilEstoqueItens)
    .set({
      alvoDoisMeses:
        input.alvoDoisMeses == null ? null : String(input.alvoDoisMeses),
      horizonteMeses: input.horizonteMeses,
      ...(input.estoqueMinimo === undefined
        ? {}
        : {
            estoqueMinimo:
              input.estoqueMinimo == null ? null : String(input.estoqueMinimo),
          }),
      ...(input.estoqueMedio === undefined
        ? {}
        : {
            estoqueMedio:
              input.estoqueMedio == null ? null : String(input.estoqueMedio),
          }),
      ...(input.kgPorMetro === undefined
        ? {}
        : {
            kgPorMetro:
              input.kgPorMetro == null ? null : String(input.kgPorMetro),
          }),
      observacao: sql`coalesce(${perfilEstoqueItens.observacao}, '') || ${` | Alvo revisado por ${input.usuario}`}`,
      updatedAt: new Date(),
    })
    .where(eq(perfilEstoqueItens.id, input.perfilItemId));
  return { success: true };
}

export type MetodoContagemBobina = "diametros" | "foto" | "peso" | "metros";

export async function listarBobinasPerfil(perfilItemId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db
    .select()
    .from(perfilEstoqueBobinas)
    .where(
      and(
        eq(perfilEstoqueBobinas.perfilItemId, perfilItemId),
        eq(perfilEstoqueBobinas.ativo, true)
      )
    )
    .orderBy(
      asc(perfilEstoqueBobinas.identificacao),
      asc(perfilEstoqueBobinas.id)
    );
  return rows.map(row => ({
    ...row,
    diametroExternoMm:
      row.diametroExternoMm == null ? null : Number(row.diametroExternoMm),
    diametroInternoMm:
      row.diametroInternoMm == null ? null : Number(row.diametroInternoMm),
    espessuraMm: row.espessuraMm == null ? null : Number(row.espessuraMm),
    pesoKg: row.pesoKg == null ? null : Number(row.pesoKg),
    comprimentoMetros: Number(row.comprimentoMetros),
  }));
}

function calcularComprimentoBobina(input: {
  metodo: MetodoContagemBobina;
  diametroExternoMm?: number | null;
  diametroInternoMm?: number | null;
  espessuraMm?: number | null;
  pesoKg?: number | null;
  comprimentoMetros?: number | null;
  kgPorMetro?: number | null;
}) {
  if (input.metodo === "metros") return input.comprimentoMetros ?? null;
  if (input.metodo === "peso") {
    if (!input.pesoKg || !input.kgPorMetro) return null;
    return input.pesoKg / input.kgPorMetro;
  }
  const externo = input.diametroExternoMm;
  const interno = input.diametroInternoMm;
  const espessura = input.espessuraMm;
  if (!externo || !interno || !espessura || externo <= interno) return null;
  // A área lateral do anel enrolado é igual à espessura da tira × comprimento.
  // Com todas as medidas em mm, divide-se por 1000 para devolver metros.
  return (Math.PI * (externo ** 2 - interno ** 2)) / (4 * espessura * 1000);
}

export async function registrarBobinaPerfil(input: {
  perfilItemId: number;
  quantidadeBobinas?: number;
  identificacao?: string | null;
  metodo: MetodoContagemBobina;
  diametroExternoMm?: number | null;
  diametroInternoMm?: number | null;
  espessuraMm?: number | null;
  pesoKg?: number | null;
  comprimentoMetros?: number | null;
  observacao?: string | null;
  usuario: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [item] = await db
    .select()
    .from(perfilEstoqueItens)
    .where(eq(perfilEstoqueItens.id, input.perfilItemId))
    .limit(1);
  if (!item) throw new Error("Perfil não encontrado.");
  if (item.unidade !== "m")
    throw new Error(
      "A contagem de bobinas exige um perfil controlado em metros."
    );
  const comprimento = calcularComprimentoBobina({
    ...input,
    kgPorMetro: item.kgPorMetro == null ? null : Number(item.kgPorMetro),
  });
  if (
    comprimento == null ||
    !Number.isFinite(comprimento) ||
    comprimento <= 0
  ) {
    if (input.metodo === "peso" && item.kgPorMetro == null) {
      throw new Error(
        "Cadastre o peso por metro deste perfil antes de converter kg em metros."
      );
    }
    throw new Error(
      "As medidas informadas não permitem calcular o comprimento da bobina."
    );
  }
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(perfilEstoqueBobinas)
    .where(
      and(
        eq(perfilEstoqueBobinas.perfilItemId, input.perfilItemId),
        eq(perfilEstoqueBobinas.ativo, true)
      )
    );
  const quantidadeBobinas = input.quantidadeBobinas ?? 1;
  const comprimentoPorBobina = Number(comprimento.toFixed(4));
  const bobinas = await db
    .insert(perfilEstoqueBobinas)
    .values(
      Array.from({ length: quantidadeBobinas }, (_, indice) => ({
        perfilItemId: input.perfilItemId,
        identificacao:
          input.identificacao?.trim() || `Bobina ${(total ?? 0) + indice + 1}`,
        metodo: input.metodo,
        diametroExternoMm:
          input.diametroExternoMm == null
            ? null
            : String(input.diametroExternoMm),
        diametroInternoMm:
          input.diametroInternoMm == null
            ? null
            : String(input.diametroInternoMm),
        espessuraMm:
          input.espessuraMm == null ? null : String(input.espessuraMm),
        pesoKg:
          input.pesoKg != null
            ? String(input.pesoKg)
            : item.kgPorMetro != null
              ? String(comprimentoPorBobina * Number(item.kgPorMetro))
              : null,
        comprimentoMetros: String(comprimentoPorBobina),
        observacao: input.observacao?.trim() || null,
        contadoPor: input.usuario,
      }))
    )
    .returning();
  const [bobina] = bobinas;
  return {
    ...bobina,
    comprimentoMetros: Number(bobina.comprimentoMetros),
    quantidadeBobinas: bobinas.length,
    totalMetros: Number((comprimentoPorBobina * bobinas.length).toFixed(4)),
  };
}

export async function removerBobinaPerfil(id: number, usuario: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [bobina] = await db
    .update(perfilEstoqueBobinas)
    .set({
      ativo: false,
      observacao: sql`coalesce(nullif(${perfilEstoqueBobinas.observacao}, '') || ' | ', '') || ${`Removida por ${usuario}`}`,
      updatedAt: new Date(),
    })
    .where(eq(perfilEstoqueBobinas.id, id))
    .returning();
  if (!bobina) throw new Error("Bobina não encontrada.");
  return { success: true };
}

export async function aplicarContagemBobinas(
  perfilItemId: number,
  usuario: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [soma] = await db
    .select({
      total: sql<string>`coalesce(sum(${perfilEstoqueBobinas.comprimentoMetros}), 0)`,
      bobinas: sql<number>`count(*)::int`,
    })
    .from(perfilEstoqueBobinas)
    .where(
      and(
        eq(perfilEstoqueBobinas.perfilItemId, perfilItemId),
        eq(perfilEstoqueBobinas.ativo, true)
      )
    );
  if (!soma?.bobinas)
    throw new Error(
      "Cadastre pelo menos uma bobina antes de aplicar a contagem."
    );
  const total = Number(soma.total);
  const resultado = await definirSaldoFisicoPerfil({
    perfilItemId,
    saldo: total,
    observacao: `Inventário de ${soma.bobinas} bobina(s), total calculado ${total.toFixed(2)} m`,
    usuario,
  });
  return { ...resultado, totalMetros: total, bobinas: soma.bobinas };
}

type BomLinha = {
  produtoNome: string;
  modeloNome: string;
  variacaoNome: string | null;
  variacaoPadrao: boolean;
  mubisysVariacaoId: number | null;
  materiaPrimaId: number;
  materiaPrimaNome: string;
  formula: string;
  multiplicador: number;
  unidadeConsumo: string;
  comprimentoPerfilMm: number | null;
};

function encontrarItemEstoque(
  linha: BomLinha,
  itens: Awaited<ReturnType<typeof listarEstoquePerfis>>
) {
  const porId = itens.find(
    item => item.mubisysMateriaPrimaId === linha.materiaPrimaId
  );
  if (porId) return porId;
  const material = normalizar(linha.materiaPrimaNome);
  return (
    itens.find(item => {
      const base = normalizar(item.nome.split("|")[0]);
      return base === material || normalizar(item.nome) === material;
    }) ?? null
  );
}

function medidaDaFormula(
  formula: string,
  largura: number | null,
  altura: number | null
): number | null {
  if (formula === "fixo") return 1;
  if (largura == null || altura == null || largura <= 0 || altura <= 0)
    return null;
  if (["area", "areaTotal", "areaGeral"].includes(formula))
    return largura * altura;
  if (["perimExt", "perimTotal"].includes(formula))
    return 2 * (largura + altura);
  return null;
}

function converterParaUnidadeEstoque(
  quantidade: number,
  unidadeBOM: string,
  unidadeEstoque: string,
  comprimentoPerfilMm: number | null
): number | null {
  const unidade = normalizar(unidadeBOM).replace(/\s/g, "");
  const linear = [
    "m",
    "ml",
    "metro",
    "metros",
    "metrolinear",
    "perimetro",
  ].includes(unidade);
  const pecas = ["un", "unidade", "unidades", "peca", "pecas"].includes(
    unidade
  );
  const comprimentoM =
    comprimentoPerfilMm && comprimentoPerfilMm > 0
      ? comprimentoPerfilMm / 1000
      : null;
  if (unidadeEstoque === "m" && linear) return quantidade;
  if (unidadeEstoque === "m" && pecas)
    return comprimentoM == null ? null : quantidade * comprimentoM;
  if (unidadeEstoque === "un" && pecas) return quantidade;
  if (unidadeEstoque === "un" && linear)
    return comprimentoM == null ? null : quantidade / comprimentoM;
  return null;
}

export function familiaDoPerfil(nome: string): string {
  const material = normalizar(nome);
  if (material.includes("inox") && material.includes("304")) return "Inox 304";
  if (material.includes("inox") && material.includes("430")) return "Inox 430";
  if (material.includes("galvan")) return "Galvanizado";
  if (material.includes("alumin")) return "Alumínio";
  return "Outros";
}

export function pesoTeoricoKgPorMetro(nome: string): number | null {
  const material = normalizar(nome);
  const largura = nome.match(/(\d+(?:[.,]\d+)?)\s*mm/i);
  const espessuraExplicita = nome.match(/\((\d+[.,]\d+)\)/);
  const larguraMm = largura ? numero(largura[1]) : null;
  const espessuraMm = espessuraExplicita
    ? numero(espessuraExplicita[1])
    : /24\s*["”]/.test(nome)
      ? 0.65
      : /26\s*["”]/.test(nome)
        ? 0.5
        : null;
  const densidade = material.includes("alumin")
    ? 2700
    : material.includes("inox") && material.includes("304")
      ? 7900
      : material.includes("inox")
        ? 7700
        : material.includes("galvan")
          ? 7850
          : null;
  if (larguraMm == null || espessuraMm == null || densidade == null)
    return null;
  return Number(((larguraMm * espessuraMm * densidade) / 1_000_000).toFixed(6));
}

async function garantirPerfisEstoqueDaBom(bom: BomLinha[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const perfisBom = [
    ...new Map(
      bom
        .filter(linha => normalizar(linha.materiaPrimaNome).includes("perfil"))
        .map(linha => [linha.materiaPrimaId, linha])
    ).values(),
  ];
  if (!perfisBom.length) return;
  const existentes = await db.select().from(perfilEstoqueItens);
  for (const linha of perfisBom) {
    const porId = existentes.find(
      item => item.mubisysMateriaPrimaId === linha.materiaPrimaId
    );
    if (porId) continue;
    const nomeNormalizado = normalizar(linha.materiaPrimaNome);
    const porNome = existentes.find(
      item =>
        normalizar(item.nome.split("|")[0]) === nomeNormalizado ||
        normalizar(item.nome) === nomeNormalizado
    );
    const kgPorMetro = pesoTeoricoKgPorMetro(linha.materiaPrimaNome);
    if (porNome) {
      await db
        .update(perfilEstoqueItens)
        .set({
          mubisysMateriaPrimaId: linha.materiaPrimaId,
          ...(porNome.kgPorMetro == null && kgPorMetro != null
            ? { kgPorMetro: String(kgPorMetro) }
            : {}),
          updatedAt: new Date(),
        })
        .where(eq(perfilEstoqueItens.id, porNome.id));
      porNome.mubisysMateriaPrimaId = linha.materiaPrimaId;
      continue;
    }
    const unidadeNormalizada = normalizar(linha.unidadeConsumo).replace(
      /\s/g,
      ""
    );
    const unidade =
      ["m", "ml", "metro", "metros", "metrolinear", "perimetro"].includes(
        unidadeNormalizada
      ) || linha.comprimentoPerfilMm != null
        ? "m"
        : "un";
    await db
      .insert(perfilEstoqueItens)
      .values({
        chave: `mubisys-${linha.materiaPrimaId}`,
        mubisysMateriaPrimaId: linha.materiaPrimaId,
        nome: linha.materiaPrimaNome,
        familia: familiaDoPerfil(linha.materiaPrimaNome),
        unidade,
        kgPorMetro:
          unidade === "m" && kgPorMetro != null ? String(kgPorMetro) : null,
        observacao:
          "Criado automaticamente a partir da BOM espelhada; cadastre o saldo físico e revise o alvo.",
      })
      .onConflictDoNothing({ target: perfilEstoqueItens.chave });
  }
}

async function carregarBom(): Promise<BomLinha[]> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const linhas = await db
    .select({
      produtoNome: mubisysVariacoes.produtoNome,
      modeloNome: mubisysVariacoes.modeloNome,
      variacaoNome: mubisysVariacoes.variacaoNome,
      variacaoPadrao: mubisysVariacoes.variacaoPadrao,
      mubisysVariacaoId: composicoesVariacoes.mubisysVariacaoId,
      materiaPrimaId: materiasPrimas.mubisysMateriaPrimaId,
      materiaPrimaNome: materiasPrimas.nome,
      formula: composicoesVariacoes.formulaConsumo,
      multiplicador: composicoesVariacoes.consumoQuantidade,
      unidadeConsumo: composicoesVariacoes.unidadeConsumo,
      comprimentoPerfilMm: materiaPrimaCadastros.perfilComprimentoMm,
    })
    .from(composicoesVariacoes)
    .innerJoin(
      mubisysVariacoes,
      eq(mubisysVariacoes.skuErp, composicoesVariacoes.variacaoSkuErp)
    )
    .innerJoin(
      materiasPrimas,
      eq(materiasPrimas.skuErp, composicoesVariacoes.materiaPrimaSkuErp)
    )
    .leftJoin(
      materiaPrimaCadastros,
      eq(
        materiaPrimaCadastros.mubisysMateriaPrimaId,
        materiasPrimas.mubisysMateriaPrimaId
      )
    );
  return linhas.map(linha => ({
    ...linha,
    multiplicador: Number(linha.multiplicador),
    comprimentoPerfilMm:
      linha.comprimentoPerfilMm == null
        ? null
        : Number(linha.comprimentoPerfilMm),
  }));
}

export async function sincronizarConsumoPerfisDasOs(ordens: MubiSysOS[]) {
  const db = await getDb();
  if (!db || ordens.length === 0)
    return { ordens: 0, movimentos: 0, pendencias: 0 };
  const bom = await carregarBom();
  await garantirPerfisEstoqueDaBom(bom);
  const estoque = await listarEstoquePerfis();
  const desejados = new Map<
    string,
    {
      perfilItemId: number;
      quantidade: number;
      unidade: string;
      osMubisysId: number;
      osNumero: string;
      osItemId: number;
      descricao: string;
    }
  >();
  const resumoOs: Array<{
    os: MubiSysOS;
    itensMapeados: number;
    linhasConsumo: number;
    pendencias: string[];
  }> = [];

  for (const os of ordens) {
    const pendencias: string[] = [];
    let itensMapeados = 0;
    let linhasConsumo = 0;
    if (!cancelada(os.status)) {
      for (const itemOs of os.itens ?? []) {
        const produto = normalizar(itemOs.item);
        const modelo = normalizar(itemOs.modelo);
        const variacao = normalizar(itemOs.variacao);
        let linhas = bom.filter(
          linha =>
            normalizar(linha.produtoNome) === produto &&
            normalizar(linha.modeloNome) === modelo
        );
        if (!linhas.length) {
          const porModelo = bom.filter(
            linha => normalizar(linha.modeloNome) === modelo
          );
          const produtos = new Set(
            porModelo.map(linha => normalizar(linha.produtoNome))
          );
          if (produtos.size === 1) linhas = porModelo;
        }
        if (!linhas.length) {
          pendencias.push(
            `Item ${itemOs.posicao}: ${itemOs.item} / ${itemOs.modelo} sem BOM espelhada.`
          );
          continue;
        }
        itensMapeados++;
        const aplicaveis = linhas.filter(
          linha =>
            linha.mubisysVariacaoId == null ||
            (variacao
              ? normalizar(linha.variacaoNome) === variacao
              : linha.variacaoPadrao)
        );
        const largura = numero(itemOs.largura);
        const altura = numero(itemOs.altura);
        const quantidadeItem = Math.max(0, numero(itemOs.quantidade) ?? 0);
        for (const linha of aplicaveis) {
          if (!normalizar(linha.materiaPrimaNome).includes("perfil")) continue;
          const perfil = encontrarItemEstoque(linha, estoque);
          if (!perfil) {
            pendencias.push(
              `Item ${itemOs.posicao}: perfil ${linha.materiaPrimaNome} sem vínculo no estoque.`
            );
            continue;
          }
          const medida = medidaDaFormula(linha.formula, largura, altura);
          if (medida == null) {
            pendencias.push(
              `Item ${itemOs.posicao}: faltam medidas para calcular ${linha.materiaPrimaNome}.`
            );
            continue;
          }
          const consumoBOM = medida * linha.multiplicador * quantidadeItem;
          const consumo = converterParaUnidadeEstoque(
            consumoBOM,
            linha.unidadeConsumo,
            perfil.unidade,
            linha.comprimentoPerfilMm
          );
          if (consumo == null || consumo <= 0) {
            pendencias.push(
              `Item ${itemOs.posicao}: unidade ${linha.unidadeConsumo || "não informada"} incompatível com ${perfil.unidade}.`
            );
            continue;
          }
          const chave = `os:${os.id}:item:${itemOs.id}:perfil:${perfil.id}`;
          const anterior = desejados.get(chave);
          desejados.set(chave, {
            perfilItemId: perfil.id,
            quantidade: (anterior?.quantidade ?? 0) - consumo,
            unidade: perfil.unidade,
            osMubisysId: os.id,
            osNumero: numeroOs(os),
            osItemId: itemOs.id,
            descricao: `Baixa estimada pela BOM: ${itemOs.item} / ${itemOs.modelo}${itemOs.variacao ? ` / ${itemOs.variacao}` : ""}`,
          });
          linhasConsumo++;
        }
      }
    }
    resumoOs.push({
      os,
      itensMapeados,
      linhasConsumo,
      pendencias: [...new Set(pendencias)],
    });
  }

  const idsOs = ordens.map(os => os.id);
  const existentes = idsOs.length
    ? await db
        .select({
          id: perfilEstoqueMovimentos.id,
          origemChave: perfilEstoqueMovimentos.origemChave,
        })
        .from(perfilEstoqueMovimentos)
        .where(
          and(
            eq(perfilEstoqueMovimentos.tipo, "saida_os"),
            inArray(perfilEstoqueMovimentos.osMubisysId, idsOs)
          )
        )
    : [];
  const chavesDesejadas = new Set(desejados.keys());
  const obsoletos = existentes
    .filter(item => !chavesDesejadas.has(item.origemChave))
    .map(item => item.id);
  if (obsoletos.length) {
    await db
      .update(perfilEstoqueMovimentos)
      .set({
        quantidade: "0",
        descricao: "Baixa anulada após atualização ou cancelamento da O.S.",
        updatedAt: new Date(),
      })
      .where(inArray(perfilEstoqueMovimentos.id, obsoletos));
  }
  if (desejados.size) {
    await db
      .insert(perfilEstoqueMovimentos)
      .values(
        [...desejados.entries()].map(([origemChave, item]) => ({
          ...item,
          quantidade: String(item.quantidade),
          tipo: "saida_os",
          origemChave,
          criadoPor: "Sincronização MubiSys",
        }))
      )
      .onConflictDoUpdate({
        target: perfilEstoqueMovimentos.origemChave,
        set: {
          quantidade: sql`excluded.quantidade`,
          unidade: sql`excluded.unidade`,
          descricao: sql`excluded.descricao`,
          updatedAt: new Date(),
        },
      });
  }
  for (const resumo of resumoOs) {
    await db
      .insert(perfilEstoqueOs)
      .values({
        osMubisysId: resumo.os.id,
        osNumero: numeroOs(resumo.os),
        status: resumo.os.status || "",
        itensTotal: resumo.os.itens?.length ?? 0,
        itensMapeados: resumo.itensMapeados,
        linhasConsumo: resumo.linhasConsumo,
        pendenciasJson: resumo.pendencias,
        processadoEm: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: perfilEstoqueOs.osMubisysId,
        set: {
          osNumero: numeroOs(resumo.os),
          status: resumo.os.status || "",
          itensTotal: resumo.os.itens?.length ?? 0,
          itensMapeados: resumo.itensMapeados,
          linhasConsumo: resumo.linhasConsumo,
          pendenciasJson: resumo.pendencias,
          processadoEm: new Date(),
          updatedAt: new Date(),
        },
      });
  }
  return {
    ordens: ordens.length,
    movimentos: desejados.size,
    pendencias: resumoOs.filter(item => item.pendencias.length > 0).length,
  };
}
