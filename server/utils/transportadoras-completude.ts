import { selectQuery, mutationQuery } from '../db/db-connection';

/**
 * Campos monitorados na subaba de completude do cadastro de transportadoras.
 * `prioridade` define a criticidade: 1 = crítico, 2 = importante, 3 = complementar.
 * `tipo` orienta o editor exibido no frontend.
 */
export const CAMPOS_COMPLETUDE = [
  { campo: 'nomeContato', titulo: 'Nome do contato de cotação', prioridade: 1, tipo: 'texto' },
  { campo: 'whatsappContato', titulo: 'WhatsApp de cotação', prioridade: 1, tipo: 'telefone' },
  { campo: 'telefoneContato', titulo: 'Telefone de cotação', prioridade: 1, tipo: 'telefone' },
  { campo: 'formaCotacao', titulo: 'Forma de cotação', prioridade: 1, tipo: 'enum-forma' },
  { campo: 'site', titulo: 'Site', prioridade: 2, tipo: 'url' },
  { campo: 'endereco', titulo: 'Endereço', prioridade: 2, tipo: 'texto-longo' },
  { campo: 'bairro', titulo: 'Bairro', prioridade: 2, tipo: 'texto' },
  { campo: 'cep', titulo: 'CEP', prioridade: 2, tipo: 'texto' },
  { campo: 'cidade', titulo: 'Cidade da sede', prioridade: 2, tipo: 'texto' },
  { campo: 'uf', titulo: 'UF da sede', prioridade: 2, tipo: 'texto' },
  { campo: 'cnpj', titulo: 'CNPJ', prioridade: 2, tipo: 'texto' },
  { campo: 'modais', titulo: 'Modais atendidos', prioridade: 2, tipo: 'texto' },
  { campo: 'pesoMaxKg', titulo: 'Peso máximo (kg)', prioridade: 2, tipo: 'numero' },
  { campo: 'emailContatoNegocial', titulo: 'E-mail comercial', prioridade: 3, tipo: 'email' },
  { campo: 'nomeContatoNegocial', titulo: 'Contato comercial', prioridade: 3, tipo: 'texto' },
  { campo: 'referencia', titulo: 'Ponto de referência', prioridade: 3, tipo: 'texto' },
  { campo: 'horarioLimiteColeta', titulo: 'Horário limite de coleta', prioridade: 3, tipo: 'texto' },
] as const;

export type CampoCompletude = (typeof CAMPOS_COMPLETUDE)[number]['campo'];

const NOMES_CAMPOS = CAMPOS_COMPLETUDE.map(c => c.campo) as readonly string[];

/** Filtro de status usado em todas as consultas da subaba. */
export type FiltroStatus = 'ativas' | 'inativas' | 'todas';

/** Filtro de origem do cadastro. */
export type FiltroOrigem = 'Frenet' | 'Manual' | 'todas';

/** Expressão SQL que identifica um campo vazio (NULL ou string em branco). */
function expressaoVazio(campo: string) {
  return `("${campo}" IS NULL OR TRIM(CAST("${campo}" AS TEXT)) = '')`;
}

/** Monta o WHERE base (status + origem + busca) compartilhado pelas consultas. */
function whereBase(opts: { status?: FiltroStatus; origem?: FiltroOrigem; busca?: string }) {
  const filtros: string[] = [];
  const params: any[] = [];

  const status = opts.status ?? 'todas';
  if (status === 'ativas') filtros.push(`ativa = 'sim'`);
  else if (status === 'inativas') filtros.push(`(ativa = 'nao' OR ativa IS NULL)`);

  const origem = opts.origem ?? 'todas';
  if (origem !== 'todas') {
    filtros.push('origem = ?');
    params.push(origem);
  }

  if (opts.busca && opts.busca.trim()) {
    filtros.push('nome LIKE ?');
    params.push(`%${opts.busca.trim()}%`);
  }

  return { clausula: filtros.length ? `WHERE ${filtros.join(' AND ')}` : '', filtros, params };
}

/** Contagens de status e origem para os cartões de visão geral da subaba. */
export async function panoramaCadastro() {
  const rows = await selectQuery(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN ativa = 'sim' THEN 1 ELSE 0 END) AS ativas,
       SUM(CASE WHEN ativa = 'sim' THEN 0 ELSE 1 END) AS inativas,
       SUM(CASE WHEN origem = 'Frenet' THEN 1 ELSE 0 END) AS frenet,
       SUM(CASE WHEN origem <> 'Frenet' OR origem IS NULL THEN 1 ELSE 0 END) AS manual,
       SUM(CASE WHEN "coberturaTotal" = 1 THEN 1 ELSE 0 END) AS nacionais
     FROM transportadoras`,
    [],
  );
  const l: any = rows?.[0] ?? {};
  return {
    total: Number(l.total ?? 0),
    ativas: Number(l.ativas ?? 0),
    inativas: Number(l.inativas ?? 0),
    frenet: Number(l.frenet ?? 0),
    manual: Number(l.manual ?? 0),
    nacionais: Number(l.nacionais ?? 0),
  };
}

/**
 * Resumo agrupado por campo ausente, ex.: "803 transportadoras sem endereço".
 * Inclui o percentual de preenchimento geral do cadastro para a barra de progresso.
 */
export async function resumoCompletude(opts: { status?: FiltroStatus; origem?: FiltroOrigem } = {}) {
  const base = whereBase(opts);
  const selects = CAMPOS_COMPLETUDE
    .map(c => `SUM(CASE WHEN ${expressaoVazio(c.campo)} THEN 1 ELSE 0 END) AS "${c.campo}"`)
    .join(', ');
  const rows = await selectQuery(
    `SELECT COUNT(*) AS total, ${selects} FROM transportadoras ${base.clausula}`,
    base.params,
  );
  const linha: any = rows?.[0] ?? {};
  const total = Number(linha.total ?? 0);

  const grupos = CAMPOS_COMPLETUDE.map(c => {
    const faltando = Number(linha[c.campo] ?? 0);
    return {
      campo: c.campo,
      titulo: c.titulo,
      prioridade: c.prioridade,
      tipo: c.tipo,
      faltando,
      preenchidos: total - faltando,
      percentualPreenchido: total === 0 ? 100 : Math.round(((total - faltando) / total) * 100),
    };
  })
    // Críticos primeiro; dentro da mesma prioridade, quem tem mais pendências aparece antes
    .sort((a, b) => a.prioridade - b.prioridade || b.faltando - a.faltando);

  const celulasTotais = total * CAMPOS_COMPLETUDE.length;
  const celulasFaltando = grupos.reduce((soma, g) => soma + g.faltando, 0);
  const percentualGeral = celulasTotais === 0
    ? 100
    : Math.round(((celulasTotais - celulasFaltando) / celulasTotais) * 100);

  // Cadastros 100% completos e cadastros com pelo menos um campo crítico vazio
  const criticos = CAMPOS_COMPLETUDE.filter(c => c.prioridade === 1).map(c => expressaoVazio(c.campo));
  const todos = CAMPOS_COMPLETUDE.map(c => expressaoVazio(c.campo));
  const contagens = await selectQuery(
    `SELECT
       SUM(CASE WHEN ${todos.join(' OR ')} THEN 0 ELSE 1 END) AS completos,
       SUM(CASE WHEN ${criticos.join(' OR ')} THEN 1 ELSE 0 END) AS "comCriticoVazio"
     FROM transportadoras ${base.clausula}`,
    base.params,
  );

  return {
    total,
    percentualGeral,
    completos: Number(contagens?.[0]?.completos ?? 0),
    comCriticoVazio: Number(contagens?.[0]?.comCriticoVazio ?? 0),
    grupos,
  };
}

/**
 * Lista transportadoras filtrando pelo estado de um campo:
 * `vazios` (padrão) → só quem NÃO tem o dado; `preenchidos` → só quem tem;
 * `todos` → ignora o campo e usa apenas status/origem/busca.
 * Se `campo` for vazio/nulo, retorna todos os registros do recorte (sem filtro de campo).
 */
export async function listarPendentesPorCampo(
  campo?: string,
  busca?: string,
  page = 1,
  pageSize = 20,
  opts: { status?: FiltroStatus; origem?: FiltroOrigem; modo?: 'vazios' | 'preenchidos' | 'todos' } = {},
) {
  const modo = opts.modo ?? 'vazios';
  // Se campo não foi passado ou é vazio, retorna todos os registros (modo = 'todos')
  const campoReal = campo && campo.trim() ? campo : null;
  if (campoReal && modo !== 'todos' && !NOMES_CAMPOS.includes(campoReal)) {
    throw new Error(`Campo não monitorado: ${campoReal}`);
  }
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safePageSize;

  const base = whereBase({ status: opts.status, origem: opts.origem, busca });
  const filtros = [...base.filtros];
  const params = [...base.params];
  // Só aplica filtro de campo se campoReal foi definido
  if (campoReal) {
    if (modo === 'vazios') filtros.push(expressaoVazio(campoReal));
    else if (modo === 'preenchidos') filtros.push(`NOT ${expressaoVazio(campoReal)}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';

  const rows = await selectQuery(
    `SELECT id, nome, site, endereco, "nomeContato", "telefoneContato", "whatsappContato",
            "nomeContatoNegocial", "emailContatoNegocial", "formaCotacao", modais, "pesoMaxKg",
            referencia, "horarioLimiteColeta", "coberturaTotal",
            bairro, cep, cidade, uf, cnpj, ativa, origem
     FROM transportadoras ${where}
     ORDER BY nome
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params,
  );
  const countRows = await selectQuery(
    `SELECT COUNT(*) AS total FROM transportadoras ${where}`,
    params,
  );
  const total = Number(countRows?.[0]?.total ?? 0);

  // Completude individual: percentual e lista de campos ainda em branco
  const enriquecidos = rows.map((t: any) => {
    const faltantes = CAMPOS_COMPLETUDE.filter(c => {
      const v = t[c.campo];
      return v === null || v === undefined || String(v).trim() === '';
    });
    const preenchidos = CAMPOS_COMPLETUDE.length - faltantes.length;
    return {
      ...t,
      completudePercentual: Math.round((preenchidos / CAMPOS_COMPLETUDE.length) * 100),
      camposFaltantes: faltantes.map(c => ({ campo: c.campo, titulo: c.titulo, prioridade: c.prioridade })),
    };
  });

  return {
    data: enriquecidos,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  };
}

/** Atualiza um único campo de uma transportadora (edição inline da subaba). */
export async function atualizarCampoTransportadora(id: number, campo: string, valor: string | null) {
  if (!NOMES_CAMPOS.includes(campo)) {
    throw new Error(`Campo não editável nesta tela: ${campo}`);
  }
  const valorFinal = valor === null || valor.trim() === '' ? null : valor.trim();
  const res: any = await mutationQuery(
    `UPDATE transportadoras SET "${campo}" = ?, "updatedAt" = NOW() WHERE id = ?`,
    [valorFinal, id],
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}

/** Liga/desliga o status ativo da transportadora direto na listagem. */
export async function definirStatusTransportadora(id: number, ativa: boolean) {
  const res: any = await mutationQuery(
    `UPDATE transportadoras SET ativa = ?, "updatedAt" = NOW() WHERE id = ?`,
    [ativa ? 'sim' : 'nao', id],
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}

/** Aplica o mesmo valor de um campo a várias transportadoras (preenchimento em lote). */
export async function atualizarCampoEmLote(ids: number[], campo: string, valor: string | null) {
  if (!NOMES_CAMPOS.includes(campo)) {
    throw new Error(`Campo não editável nesta tela: ${campo}`);
  }
  const alvos = ids.map(Number).filter(n => Number.isInteger(n) && n > 0);
  if (alvos.length === 0) return { ok: true, afetados: 0 };
  const valorFinal = valor === null || valor.trim() === '' ? null : valor.trim();
  const placeholders = alvos.map(() => '?').join(', ');
  const res: any = await mutationQuery(
    `UPDATE transportadoras SET "${campo}" = ?, "updatedAt" = NOW() WHERE id IN (${placeholders})`,
    [valorFinal, ...alvos],
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}
