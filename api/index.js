var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/db/db-connection.ts
var db_connection_exports = {};
__export(db_connection_exports, {
  default: () => db_connection_default,
  executeQuery: () => executeQuery,
  getPool: () => getPool,
  mutationQuery: () => mutationQuery,
  selectQuery: () => selectQuery
});
import { Pool, neonConfig } from "@neondatabase/serverless";
function getPool() {
  if (pool) {
    return pool;
  }
  try {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL
    });
    console.log("\u2705 [DB-CONNECTION] Pool (Neon serverless) criado com sucesso");
    return pool;
  } catch (error) {
    console.error("\u274C [DB-CONNECTION] Erro ao criar pool:", error);
    throw error;
  }
}
function toPgPlaceholders(sql10) {
  let i = 0;
  return sql10.replace(/\?/g, () => `$${++i}`);
}
async function executeQuery(sql10, values = []) {
  const pool2 = getPool();
  try {
    console.log("\u{1F4DD} [QUERY] SQL:", sql10);
    console.log("\u{1F4DD} [QUERY] Values:", values);
    const result = await pool2.query(toPgPlaceholders(sql10), values);
    console.log("\u2705 [QUERY] Sucesso");
    return result;
  } catch (error) {
    console.error("\u274C [QUERY] Erro:", error);
    throw error;
  }
}
async function selectQuery(sql10, values = []) {
  const result = await executeQuery(sql10, values);
  return result.rows;
}
async function mutationQuery(sql10, values = []) {
  const result = await executeQuery(sql10, values);
  return {
    rows: result.rows,
    rowCount: result.rowCount ?? 0,
    insertId: result.rows[0]?.id,
    affectedRows: result.rowCount ?? 0
  };
}
var pool, db_connection_default;
var init_db_connection = __esm({
  "server/db/db-connection.ts"() {
    "use strict";
    neonConfig.poolQueryViaFetch = true;
    pool = null;
    db_connection_default = { getPool, executeQuery, selectQuery, mutationQuery };
  }
});

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  APP_ROLES: () => APP_ROLES,
  PAGE_KEYS: () => PAGE_KEYS,
  abcCache: () => abcCache,
  abcClassificacaoEnum: () => abcClassificacaoEnum,
  abcTipoEnum: () => abcTipoEnum,
  acao5w2hStatusEnum: () => acao5w2hStatusEnum,
  acaoCorretivaStatusEnum: () => acaoCorretivaStatusEnum,
  account: () => account,
  acoes5w2h: () => acoes5w2h,
  acoesCorretivas: () => acoesCorretivas,
  alertaSeveridadeEnum: () => alertaSeveridadeEnum,
  alertaStatusEnum: () => alertaStatusEnum,
  alertaTipoEnum: () => alertaTipoEnum,
  alertasSistema: () => alertasSistema,
  analiseCurriculoStatusEnum: () => analiseCurriculoStatusEnum,
  analiseCurriculos: () => analiseCurriculos,
  appRoleEnum: () => appRoleEnum,
  auditoriaAcaoEnum: () => auditoriaAcaoEnum,
  auditoriaRetrabalhos: () => auditoriaRetrabalhos,
  bibliotecaArquivos: () => bibliotecaArquivos,
  cargos: () => cargos,
  cargosFuncoes: () => cargosFuncoes,
  clienteCadastroStatusEnum: () => clienteCadastroStatusEnum,
  clienteNovosContato: () => clienteNovosContato,
  clienteOverrideStatusEnum: () => clienteOverrideStatusEnum,
  clienteOverrides: () => clienteOverrides,
  clientes: () => clientes,
  cnqRegistros: () => cnqRegistros,
  cnqTipoEnum: () => cnqTipoEnum,
  cotacaoComentarios: () => cotacaoComentarios,
  cotacaoOpcoes: () => cotacaoOpcoes,
  cotacaoStatusEnum: () => cotacaoStatusEnum,
  cotacoesFrete: () => cotacoesFrete,
  cotacoesItens: () => cotacoesItens,
  crmAtividadeLog: () => crmAtividadeLog,
  crmCanalEnum: () => crmCanalEnum,
  crmContatos: () => crmContatos,
  crmFaixaEtiquetas: () => crmFaixaEtiquetas,
  crmMetas: () => crmMetas,
  crmPropostaStatusEnum: () => crmPropostaStatusEnum,
  crmPropostas: () => crmPropostas,
  crmScripts: () => crmScripts,
  cteImportacoes: () => cteImportacoes,
  custoLed: () => custoLed,
  custoLedLancamentos: () => custoLedLancamentos,
  custoMarketing: () => custoMarketing,
  custosFixos: () => custosFixos,
  desempenhoColaboradorMensal: () => desempenhoColaboradorMensal,
  dividasParcelamentos: () => dividasParcelamentos,
  dreMensal: () => dreMensal,
  empacotamentoChecklistItens: () => empacotamentoChecklistItens,
  empacotamentoChecklistLetreitoItens: () => empacotamentoChecklistLetreitoItens,
  empacotamentoConfigProdutividade: () => empacotamentoConfigProdutividade,
  empacotamentoConsumoCaixa: () => empacotamentoConsumoCaixa,
  empacotamentoCronometroPausas: () => empacotamentoCronometroPausas,
  empacotamentoCustoFuncionario: () => empacotamentoCustoFuncionario,
  empacotamentoInsumos: () => empacotamentoInsumos,
  empacotamentoInsumosLetreiro: () => empacotamentoInsumosLetreiro,
  empacotamentoModelos: () => empacotamentoModelos,
  empacotamentoModelosCaixa: () => empacotamentoModelosCaixa,
  empacotamentoPedidoChecklist: () => empacotamentoPedidoChecklist,
  empacotamentoPedidoChecklistLetreiro: () => empacotamentoPedidoChecklistLetreiro,
  empacotamentoPedidoFotos: () => empacotamentoPedidoFotos,
  empacotamentoPedidoUsuarios: () => empacotamentoPedidoUsuarios,
  empacotamentoPedidos: () => empacotamentoPedidos,
  empacotamentoSessoes: () => empacotamentoSessoes,
  empacotamentoSessoesPausas: () => empacotamentoSessoesPausas,
  empacotamentoTabelaPrecos: () => empacotamentoTabelaPrecos,
  erpOsCache: () => erpOsCache,
  errorLibrary: () => errorLibrary,
  errosPadrao: () => errosPadrao,
  faturamento: () => faturamento,
  financeiroMensal: () => financeiroMensal,
  financeirosMensais: () => financeirosMensais,
  formaCotacaoEnum: () => formaCotacaoEnum,
  historicoOrcamentos: () => historicoOrcamentos,
  historicoOs: () => historicoOs,
  inteligenciaClientesCache: () => inteligenciaClientesCache,
  ishikawaCategoriaEnum: () => ishikawaCategoriaEnum,
  ishikawaCausas: () => ishikawaCausas,
  ishikawaPlanos: () => ishikawaPlanos,
  kanbanStatusEnum: () => kanbanStatusEnum,
  knowledgeBase: () => knowledgeBase,
  knowledgeComments: () => knowledgeComments,
  knowledgeSuggestions: () => knowledgeSuggestions,
  kpisCargo: () => kpisCargo,
  ledTipos: () => ledTipos,
  metaProdutos: () => metaProdutos,
  metasComerciais: () => metasComerciais,
  metasOperacionais: () => metasOperacionais,
  metasRetrabalho: () => metasRetrabalho,
  metricas: () => metricas,
  modalidadeFreteEnum: () => modalidadeFreteEnum,
  mubisysApiCache: () => mubisysApiCache,
  observacoesFinanceirasMensais: () => observacoesFinanceirasMensais,
  performanceAbc: () => performanceAbc,
  performanceAuditada: () => performanceAuditada,
  performanceComercial: () => performanceComercial,
  performanceMensal: () => performanceMensal,
  planoAcaoComercialStatusEnum: () => planoAcaoComercialStatusEnum,
  planoAcaoStatusEnum: () => planoAcaoStatusEnum,
  planosAcao: () => planosAcao,
  planosAcaoComercial: () => planosAcaoComercial,
  planosAcaoQualidade: () => planosAcaoQualidade,
  popAcessoTipoEnum: () => popAcessoTipoEnum,
  popAcessos: () => popAcessos,
  pops: () => pops,
  priceTableHistory: () => priceTableHistory,
  priceTableMeta: () => priceTableMeta,
  priceTableSections: () => priceTableSections,
  prioridadeComCriticaEnum: () => prioridadeComCriticaEnum,
  prioridadeEnum: () => prioridadeEnum,
  regulamentos: () => regulamentos,
  regulationTypeEnum: () => regulationTypeEnum,
  regulations: () => regulations,
  responsabilidadesCargo: () => responsabilidadesCargo,
  retrabalhoClasseEnum: () => retrabalhoClasseEnum,
  retrabalhoTipoEnum: () => retrabalhoTipoEnum,
  retrabalhos: () => retrabalhos,
  rolePermissions: () => rolePermissions,
  routineFrequencyEnum: () => routineFrequencyEnum,
  routineStatusEnum: () => routineStatusEnum,
  routines: () => routines,
  session: () => session,
  simNaoEnum: () => simNaoEnum,
  statusValidacaoEnum: () => statusValidacaoEnum,
  suppliers: () => suppliers,
  syncLogs: () => syncLogs,
  syncStatusEnum: () => syncStatusEnum,
  tipoPrazoEnum: () => tipoPrazoEnum,
  tipoRegistroEnum: () => tipoRegistroEnum,
  tipoResponsavelEnum: () => tipoResponsavelEnum,
  transportadoraAvaliacoes: () => transportadoraAvaliacoes,
  transportadoraCidades: () => transportadoraCidades,
  transportadoraFiliais: () => transportadoraFiliais,
  transportadoras: () => transportadoras,
  turnoEnum: () => turnoEnum,
  user: () => user,
  verification: () => verification
});
import {
  boolean,
  date,
  decimal,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from "drizzle-orm/pg-core";
var tipoRegistroEnum, retrabalhoTipoEnum, tipoResponsavelEnum, retrabalhoClasseEnum, simNaoEnum, routineFrequencyEnum, routineStatusEnum, regulationTypeEnum, popAcessoTipoEnum, formaCotacaoEnum, cotacaoStatusEnum, tipoPrazoEnum, modalidadeFreteEnum, auditoriaAcaoEnum, kanbanStatusEnum, acaoCorretivaStatusEnum, planoAcaoStatusEnum, ishikawaCategoriaEnum, prioridadeEnum, acao5w2hStatusEnum, alertaTipoEnum, alertaSeveridadeEnum, alertaStatusEnum, abcTipoEnum, crmCanalEnum, clienteOverrideStatusEnum, statusValidacaoEnum, turnoEnum, analiseCurriculoStatusEnum, syncStatusEnum, clienteCadastroStatusEnum, crmPropostaStatusEnum, cnqTipoEnum, abcClassificacaoEnum, planoAcaoComercialStatusEnum, prioridadeComCriticaEnum, errorLibrary, retrabalhos, faturamento, knowledgeBase, suppliers, routines, regulations, pops, popAcessos, knowledgeComments, priceTableSections, priceTableMeta, priceTableHistory, APP_ROLES, appRoleEnum, PAGE_KEYS, user, session, account, verification, rolePermissions, transportadoras, transportadoraAvaliacoes, transportadoraFiliais, transportadoraCidades, cotacoesFrete, cotacaoOpcoes, cotacaoComentarios, cteImportacoes, performanceMensal, auditoriaRetrabalhos, cargosFuncoes, empacotamentoModelos, empacotamentoTabelaPrecos, empacotamentoModelosCaixa, empacotamentoChecklistItens, empacotamentoPedidos, empacotamentoPedidoUsuarios, empacotamentoPedidoFotos, empacotamentoPedidoChecklist, empacotamentoInsumos, empacotamentoConsumoCaixa, empacotamentoCustoFuncionario, empacotamentoInsumosLetreiro, empacotamentoCronometroPausas, empacotamentoConfigProdutividade, empacotamentoChecklistLetreitoItens, empacotamentoPedidoChecklistLetreiro, empacotamentoSessoes, empacotamentoSessoesPausas, knowledgeSuggestions, acoesCorretivas, planosAcao, ishikawaCausas, acoes5w2h, metasRetrabalho, alertasSistema, bibliotecaArquivos, abcCache, metasOperacionais, financeiroMensal, observacoesFinanceirasMensais, desempenhoColaboradorMensal, metaProdutos, metasComerciais, historicoOs, historicoOrcamentos, crmMetas, crmContatos, clienteOverrides, custoMarketing, custosFixos, dividasParcelamentos, dreMensal, crmScripts, inteligenciaClientesCache, ledTipos, custoLedLancamentos, crmFaixaEtiquetas, performanceAuditada, clienteNovosContato, mubisysApiCache, crmAtividadeLog, financeirosMensais, cargos, responsabilidadesCargo, kpisCargo, analiseCurriculos, syncLogs, erpOsCache, clientes, crmPropostas, performanceComercial, custoLed, cotacoesItens, cnqRegistros, errosPadrao, ishikawaPlanos, performanceAbc, planosAcaoComercial, planosAcaoQualidade, regulamentos, metricas;
var init_schema = __esm({
  "drizzle/schema.ts"() {
    "use strict";
    tipoRegistroEnum = pgEnum("tipo_registro", ["retrabalho", "cnq"]);
    retrabalhoTipoEnum = pgEnum("retrabalho_tipo", ["INTERNO", "EXTERNO"]);
    tipoResponsavelEnum = pgEnum("tipo_responsavel", ["operador", "gestor"]);
    retrabalhoClasseEnum = pgEnum("retrabalho_classe", ["EVIT\xC1VEL", "INEVIT\xC1VEL"]);
    simNaoEnum = pgEnum("sim_nao", ["sim", "nao"]);
    routineFrequencyEnum = pgEnum("routine_frequency", ["diaria", "semanal", "quinzenal", "mensal", "esporadico", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"]);
    routineStatusEnum = pgEnum("routine_status", ["pendente", "em_dia", "atrasada"]);
    regulationTypeEnum = pgEnum("regulation_type", ["regulamento", "memorando", "politica", "procedimento"]);
    popAcessoTipoEnum = pgEnum("pop_acesso_tipo", ["visualizacao", "download"]);
    formaCotacaoEnum = pgEnum("forma_cotacao", ["site", "whatsapp", "telefone", "email"]);
    cotacaoStatusEnum = pgEnum("cotacao_status", ["aberta", "cotando", "selecao", "cotada", "enviada", "cancelada"]);
    tipoPrazoEnum = pgEnum("tipo_prazo", ["uteis", "corridos"]);
    modalidadeFreteEnum = pgEnum("modalidade_frete", ["cif", "fob"]);
    auditoriaAcaoEnum = pgEnum("auditoria_acao", ["CRIACAO", "EDICAO", "EXCLUSAO"]);
    kanbanStatusEnum = pgEnum("kanban_status", ["aguardando", "embalando", "patio", "abandonado"]);
    acaoCorretivaStatusEnum = pgEnum("acao_corretiva_status", ["aberto", "em_tratamento", "resolvido"]);
    planoAcaoStatusEnum = pgEnum("plano_acao_status", ["pendente", "em_andamento", "concluido", "monitorando"]);
    ishikawaCategoriaEnum = pgEnum("ishikawa_categoria", ["maquina", "mao_de_obra", "material", "metodo", "medida", "meio_ambiente"]);
    prioridadeEnum = pgEnum("prioridade", ["alta", "media", "baixa"]);
    acao5w2hStatusEnum = pgEnum("acao_5w2h_status", ["pendente", "em_andamento", "concluido"]);
    alertaTipoEnum = pgEnum("alerta_tipo", ["reincidencia", "meta_excedida", "sem_acao", "prazo_vencido", "novo_retrabalho", "atraso_expedicao", "manual"]);
    alertaSeveridadeEnum = pgEnum("alerta_severidade", ["info", "aviso", "critico"]);
    alertaStatusEnum = pgEnum("alerta_status", ["ativo", "lido", "arquivado"]);
    abcTipoEnum = pgEnum("abc_tipo", ["clientes", "produtos"]);
    crmCanalEnum = pgEnum("crm_canal", ["whatsapp", "telefone", "email", "visita", "outro", "perdida", "nao_retornou", "esperando_cliente", "garantiu_fechamento"]);
    clienteOverrideStatusEnum = pgEnum("cliente_override_status", ["recorrente", "novo"]);
    statusValidacaoEnum = pgEnum("status_validacao", ["pendente", "validado", "corrigido_excel"]);
    turnoEnum = pgEnum("turno", ["manha", "tarde", "noite"]);
    analiseCurriculoStatusEnum = pgEnum("analise_curriculo_status", ["pendente", "analisando", "concluido", "erro"]);
    syncStatusEnum = pgEnum("sync_status", ["SUCESSO", "ERRO", "PENDENTE"]);
    clienteCadastroStatusEnum = pgEnum("cliente_cadastro_status", ["ativo", "inativo", "prospect"]);
    crmPropostaStatusEnum = pgEnum("crm_proposta_status", ["prospeccao", "proposta_enviada", "negociacao", "ganho", "perdido", "cancelado"]);
    cnqTipoEnum = pgEnum("cnq_tipo", ["interno", "externo"]);
    abcClassificacaoEnum = pgEnum("abc_classificacao", ["A", "B", "C"]);
    planoAcaoComercialStatusEnum = pgEnum("plano_acao_comercial_status", ["pendente", "em_andamento", "concluido", "cancelado"]);
    prioridadeComCriticaEnum = pgEnum("prioridade_com_critica", ["baixa", "media", "alta", "critica"]);
    errorLibrary = pgTable("error_library", {
      id: serial("id").primaryKey(),
      code: varchar("code", { length: 20 }).notNull().unique(),
      category: varchar("category", { length: 64 }).notNull(),
      description: text("description").notNull(),
      correction: text("correction").notNull(),
      imageUrl: text("imageUrl"),
      // URL da imagem de referência (S3)
      imageKey: text("imageKey"),
      // chave S3
      tipoRegistro: tipoRegistroEnum("tipoRegistro").default("retrabalho").notNull(),
      // Retrabalho ou Custo da Não-Qualidade
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    retrabalhos = pgTable("retrabalhos", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 256 }),
      osRetrabalhada: varchar("osRetrabalhada", { length: 32 }),
      // Opcional para CNQ
      osOriginal: varchar("osOriginal", { length: 64 }),
      // Opcional para CNQ
      data: timestamp("data").notNull(),
      setor: varchar("setor", { length: 64 }).notNull(),
      tipo: retrabalhoTipoEnum("tipo").notNull(),
      custo: decimal("custo", { precision: 10, scale: 2 }).default("0").notNull(),
      frete: decimal("frete", { precision: 10, scale: 2 }).default("0").notNull(),
      total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
      codigoErro: varchar("codigoErro", { length: 20 }),
      responsavel: varchar("responsavel", { length: 128 }),
      tipoResponsavel: tipoResponsavelEnum("tipoResponsavel").default("operador"),
      descricao: text("descricao"),
      classe: retrabalhoClasseEnum("classe").notNull(),
      horasImpacto: decimal("horasImpacto", { precision: 6, scale: 2 }),
      mes: varchar("mes", { length: 20 }),
      tipoRegistro: tipoRegistroEnum("tipoRegistro").default("retrabalho").notNull(),
      // Retrabalho ou Custo da Não-Qualidade
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    faturamento = pgTable("faturamento", {
      id: serial("id").primaryKey(),
      mes: varchar("mes", { length: 20 }).notNull(),
      ano: integer("ano").notNull(),
      valorFaturado: decimal("valorFaturado", { precision: 14, scale: 2 }).notNull(),
      totalPedidos: integer("totalPedidos").notNull().default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      mesAnoUnique: uniqueIndex("faturamento_mes_ano_unique").on(t2.mes, t2.ano)
    }));
    knowledgeBase = pgTable("knowledge_base", {
      id: serial("id").primaryKey(),
      title: varchar("title", { length: 256 }).notNull(),
      content: text("content").notNull(),
      category: varchar("category", { length: 64 }).notNull(),
      // Comercial, Administrativo, Financeiro, Produção
      subcategory: varchar("subcategory", { length: 64 }),
      keywords: text("keywords"),
      // comma-separated
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    suppliers = pgTable("suppliers", {
      id: serial("id").primaryKey(),
      name: varchar("name", { length: 128 }).notNull(),
      company: varchar("company", { length: 128 }),
      category: varchar("category", { length: 64 }).notNull(),
      supplies: text("supplies"),
      // insumos oferecidos
      contact: varchar("contact", { length: 128 }),
      phone: varchar("phone", { length: 32 }),
      email: varchar("email", { length: 128 }),
      paymentTerms: text("paymentTerms"),
      notes: text("notes"),
      active: simNaoEnum("active").default("sim").notNull(),
      createdByNome: varchar("createdByNome", { length: 128 }),
      // nome do usuário que cadastrou
      updatedByNome: varchar("updatedByNome", { length: 128 }),
      // nome do último editor
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    routines = pgTable("routines", {
      id: serial("id").primaryKey(),
      title: varchar("title", { length: 256 }).notNull(),
      description: text("description"),
      frequency: routineFrequencyEnum("frequency").notNull().default("semanal"),
      assignedTo: varchar("assignedTo", { length: 128 }),
      startDate: timestamp("startDate"),
      nextDue: timestamp("nextDue"),
      lastDone: timestamp("lastDone"),
      calendarDates: text("calendarDates"),
      // JSON array de datas ISO para esporádico
      status: routineStatusEnum("status").default("pendente").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    regulations = pgTable("regulations", {
      id: serial("id").primaryKey(),
      title: varchar("title", { length: 256 }).notNull(),
      type: regulationTypeEnum("type").notNull(),
      content: text("content").notNull(),
      version: varchar("version", { length: 16 }).default("1.0"),
      active: simNaoEnum("active").default("sim").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    pops = pgTable("pops", {
      id: serial("id").primaryKey(),
      code: varchar("code", { length: 32 }).notNull().unique(),
      // ex: POP-001
      title: varchar("title", { length: 256 }).notNull(),
      sector: varchar("sector", { length: 64 }).notNull(),
      objective: text("objective"),
      steps: text("steps").notNull(),
      // JSON array of steps
      responsible: varchar("responsible", { length: 128 }),
      version: varchar("version", { length: 16 }).default("1.0"),
      active: simNaoEnum("active").default("sim").notNull(),
      attachments: text("attachments"),
      // JSON array de URLs de imagens
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    popAcessos = pgTable("pop_acessos", {
      id: serial("id").primaryKey(),
      popId: integer("popId").notNull(),
      popCode: varchar("popCode", { length: 32 }).notNull(),
      popTitle: varchar("popTitle", { length: 256 }).notNull(),
      usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
      usuarioEmail: varchar("usuarioEmail", { length: 256 }),
      tipo: popAcessoTipoEnum("tipo").notNull().default("visualizacao"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    knowledgeComments = pgTable("knowledge_comments", {
      id: serial("id").primaryKey(),
      knowledgeId: integer("knowledgeId").notNull(),
      author: varchar("author", { length: 128 }).notNull().default("Equipe"),
      content: text("content").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    priceTableSections = pgTable("price_table_sections", {
      id: serial("id").primaryKey(),
      page: integer("page").notNull(),
      // 1, 2 ou 3 (editável) | 4, 5 (consulta)
      sectionOrder: integer("sectionOrder").notNull().default(0),
      sectionTitle: varchar("sectionTitle", { length: 256 }).notNull(),
      contentJson: text("contentJson").notNull(),
      // JSON com linhas da tabela
      notes: text("notes"),
      // observações em texto livre
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    priceTableMeta = pgTable("price_table_meta", {
      id: serial("id").primaryKey(),
      versao: varchar("versao", { length: 16 }).notNull().default("001"),
      dataModificacao: timestamp("dataModificacao").defaultNow().notNull(),
      descricao: text("descricao")
    });
    priceTableHistory = pgTable("price_table_history", {
      id: serial("id").primaryKey(),
      versao: varchar("versao", { length: 16 }).notNull(),
      sectionId: integer("sectionId").notNull(),
      sectionTitle: varchar("sectionTitle", { length: 256 }),
      autor: varchar("autor", { length: 128 }).default("sistema"),
      campoAlterado: varchar("campoAlterado", { length: 64 }),
      valorAnterior: text("valorAnterior"),
      valorNovo: text("valorNovo"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    APP_ROLES = ["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"];
    appRoleEnum = pgEnum("app_role", APP_ROLES);
    PAGE_KEYS = [
      "painel",
      "retrabalhos",
      "inserir",
      "biblioteca",
      "reincidencia",
      "relatorio",
      "insights",
      "conhecimento",
      "fornecedores",
      "rotinas",
      "regulamentos",
      "pops",
      "tabela-preco",
      "logistica-dashboard",
      "logistica-solicitacoes",
      "logistica-minhas-cotacoes",
      "logistica-transportadoras",
      "logistica-consulta",
      "logistica-importar-cte",
      "logistica-assertividade",
      "logistica-empacotamento",
      "operacoes-performance",
      "operacoes-custo-solda",
      "operacoes-custo-led",
      "biblioteca-arquivos",
      "sugestoes-conhecimento",
      "auditoria",
      "cargos-funcoes",
      "financeiro",
      "admin",
      "admin-usuarios",
      "admin-permissoes",
      "comercial-performance",
      "comercial-metas",
      "comercial-crm",
      "comercial-crm-config",
      "comercial-tabela-preco",
      "comercial-planos-acao",
      "comercial-geografia",
      "comercial-insights-ia",
      "qualidade-planos",
      "qualidade-desempenho",
      "logistica-cte",
      "logistica-insights-ia",
      "metricas"
    ];
    user = pgTable("user", {
      id: text("id").primaryKey(),
      name: text("name").notNull(),
      email: text("email").notNull().unique(),
      emailVerified: boolean("emailVerified").default(false).notNull(),
      image: text("image"),
      role: appRoleEnum("role").notNull().default("vendas"),
      banned: boolean("banned"),
      banReason: text("banReason"),
      banExpires: timestamp("banExpires"),
      username: text("username").unique(),
      displayUsername: text("displayUsername"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    session = pgTable("session", {
      id: text("id").primaryKey(),
      expiresAt: timestamp("expiresAt").notNull(),
      token: text("token").notNull().unique(),
      ipAddress: text("ipAddress"),
      userAgent: text("userAgent"),
      userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
      impersonatedBy: text("impersonatedBy"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    account = pgTable("account", {
      id: text("id").primaryKey(),
      accountId: text("accountId").notNull(),
      providerId: text("providerId").notNull(),
      userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
      accessToken: text("accessToken"),
      refreshToken: text("refreshToken"),
      idToken: text("idToken"),
      accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
      refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
      scope: text("scope"),
      password: text("password"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    verification = pgTable("verification", {
      id: text("id").primaryKey(),
      identifier: text("identifier").notNull(),
      value: text("value").notNull(),
      expiresAt: timestamp("expiresAt").notNull(),
      createdAt: timestamp("createdAt").defaultNow(),
      updatedAt: timestamp("updatedAt").defaultNow()
    });
    rolePermissions = pgTable("role_permissions", {
      id: serial("id").primaryKey(),
      role: appRoleEnum("role").notNull(),
      pageKey: varchar("pageKey", { length: 64 }).notNull(),
      canAccess: simNaoEnum("canAccess").default("nao").notNull()
    });
    transportadoras = pgTable("transportadoras", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull(),
      site: varchar("site", { length: 256 }),
      endereco: text("endereco"),
      referencia: text("referencia"),
      nomeContato: varchar("nomeContato", { length: 128 }),
      telefoneContato: varchar("telefoneContato", { length: 32 }),
      whatsappContato: varchar("whatsappContato", { length: 32 }),
      nomeContatoNegocial: varchar("nomeContatoNegocial", { length: 128 }),
      telefoneContatoNegocial: varchar("telefoneContatoNegocial", { length: 32 }),
      emailContatoNegocial: varchar("emailContatoNegocial", { length: 128 }),
      formaCotacao: formaCotacaoEnum("formaCotacao").default("site"),
      linkSiteCotacao: varchar("linkSiteCotacao", { length: 256 }),
      modais: text("modais"),
      // JSON array: ["rodoviario", "aereo"]
      pesoMaxKg: decimal("pesoMaxKg", { precision: 10, scale: 2 }),
      alturaMaxCm: decimal("alturaMaxCm", { precision: 8, scale: 2 }),
      larguraMaxCm: decimal("larguraMaxCm", { precision: 8, scale: 2 }),
      comprimentoMaxCm: decimal("comprimentoMaxCm", { precision: 8, scale: 2 }),
      somaMaxCm: decimal("somaMaxCm", { precision: 8, scale: 2 }),
      horarioLimiteColeta: varchar("horarioLimiteColeta", { length: 8 }),
      horarioLimiteMercadoria: varchar("horarioLimiteMercadoria", { length: 8 }),
      distanciaSedMin: integer("distanciaSedMin"),
      observacoes: text("observacoes"),
      ativa: simNaoEnum("ativa").default("sim").notNull(),
      logoUrl: varchar("logoUrl", { length: 512 }),
      // Novos campos
      realizaColeta: simNaoEnum("realizaColeta").default("nao"),
      ultAtualizTabela: varchar("ultAtualizTabela", { length: 16 }),
      // YYYY-MM-DD
      semTabelaNegociavel: simNaoEnum("semTabelaNegociavel").default("nao"),
      whatsappContatoNegocial: varchar("whatsappContatoNegocial", { length: 32 }),
      portalUrl: varchar("portalUrl", { length: 256 }),
      portalUsuario: varchar("portalUsuario", { length: 128 }),
      portalEmail: varchar("portalEmail", { length: 128 }),
      portalObservacao: text("portalObservacao"),
      portalSenha: varchar("portalSenha", { length: 256 }),
      ultAtualizCidades: varchar("ultAtualizCidades", { length: 16 }),
      // YYYY-MM-DD
      coberturaTotal: integer("coberturaTotal").default(0),
      // 1 = atende todos os municípios do Brasil
      contatoRastreio: text("contatoRastreio"),
      origem: varchar("origem", { length: 40 }).default("Manual").notNull(),
      // 'Frenet' | 'Manual'
      bairro: varchar("bairro", { length: 160 }),
      cep: varchar("cep", { length: 20 }),
      cidade: varchar("cidade", { length: 160 }),
      uf: varchar("uf", { length: 2 }),
      cnpj: varchar("cnpj", { length: 24 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    transportadoraAvaliacoes = pgTable("transportadora_avaliacoes", {
      id: serial("id").primaryKey(),
      transportadoraId: integer("transportadoraId").notNull(),
      estrelas: integer("estrelas").notNull(),
      // 1-5
      comentario: text("comentario"),
      autor: varchar("autor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    transportadoraFiliais = pgTable("transportadora_filiais", {
      id: serial("id").primaryKey(),
      transportadoraId: integer("transportadoraId").notNull(),
      nome: varchar("nome", { length: 128 }).notNull(),
      endereco: text("endereco"),
      cidade: varchar("cidade", { length: 128 }),
      estado: varchar("estado", { length: 2 }),
      telefone: varchar("telefone", { length: 256 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    transportadoraCidades = pgTable("transportadora_cidades", {
      id: serial("id").primaryKey(),
      transportadoraId: integer("transportadoraId").notNull(),
      cidade: varchar("cidade", { length: 128 }).notNull(),
      estado: varchar("estado", { length: 2 }).notNull(),
      telefone: varchar("telefone", { length: 256 }),
      // telefone(s) do adicional nessa cidade
      observacao: varchar("observacao", { length: 512 }),
      // obs adicionais (ex: cidades cobertas)
      endereco: varchar("endereco", { length: 512 }),
      // endereço do ponto de coleta/entrega nessa cidade
      responsavel: varchar("responsavel", { length: 128 }),
      // nome do responsável nessa cidade
      sede: varchar("sede", { length: 128 }),
      // nome da sede/filial responsável por essa cidade
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    cotacoesFrete = pgTable("cotacoes_frete", {
      id: serial("id").primaryKey(),
      osNumero: varchar("osNumero", { length: 32 }),
      solicitanteId: text("solicitanteId"),
      // user.id (Better Auth)
      solicitanteNome: varchar("solicitanteNome", { length: 128 }),
      destinatarioNome: varchar("destinatarioNome", { length: 256 }),
      destinatarioCnpj: varchar("destinatarioCnpj", { length: 32 }),
      cepDestino: varchar("cepDestino", { length: 10 }),
      municipio: varchar("municipio", { length: 128 }),
      estado: varchar("estado", { length: 2 }),
      modalidadeFrete: modalidadeFreteEnum("modalidadeFrete"),
      dimensoesLargura: decimal("dimensoesLargura", { precision: 8, scale: 2 }),
      dimensoesAltura: decimal("dimensoesAltura", { precision: 8, scale: 2 }),
      dimensoesComprimento: decimal("dimensoesComprimento", { precision: 8, scale: 2 }),
      pesoKg: decimal("pesoKg", { precision: 8, scale: 2 }),
      valorNf: decimal("valorNf", { precision: 12, scale: 2 }),
      observacoes: text("observacoes"),
      observacaoGol: text("observacaoGol"),
      fotoUrl: text("fotoUrl"),
      empacotamentoPedidoId: integer("empacotamentoPedidoId"),
      empacotamentoPedidoNumero: varchar("empacotamentoPedidoNumero", { length: 64 }),
      status: cotacaoStatusEnum("status").default("aberta").notNull(),
      quantidadeVolumes: integer("quantidadeVolumes").default(1),
      volumesJson: text("volumesJson"),
      fotosJson: text("fotosJson"),
      empacotadores: varchar("empacotadores", { length: 512 }),
      osAprovacao: varchar("osAprovacao", { length: 64 }),
      // texto livre vindo do cache MubiSys, ex: "17/07/2026 às 10:36"
      osEntrega: varchar("osEntrega", { length: 64 }),
      osVendedor: varchar("osVendedor", { length: 128 }),
      transportadoraSelecionadaId: integer("transportadoraSelecionadaId"),
      horarioDecisaoMs: varchar("horarioDecisaoMs", { length: 8 }),
      // ex: "14:30" — horário limite de decisão no fuso MS
      dataSource: varchar("dataSource", { length: 32 }),
      // 'mub' | 'brasilapi' | null
      tipoMaterial: varchar("tipoMaterial", { length: 256 }),
      dataEntregaPrevista: date("dataEntregaPrevista"),
      dataDespacho: timestamp("dataDespacho"),
      temRetrabalho: boolean("temRetrabalho").default(false),
      tipoRetrabalho: varchar("tipoRetrabalho", { length: 64 }),
      motivoRetrabalho: text("motivoRetrabalho"),
      retrabalhoVinculadoId: integer("retrabalhoVinculadoId"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    cotacaoOpcoes = pgTable("cotacao_opcoes", {
      id: serial("id").primaryKey(),
      cotacaoId: integer("cotacaoId").notNull(),
      transportadoraId: integer("transportadoraId"),
      transportadoraNome: varchar("transportadoraNome", { length: 128 }),
      valorFrete: decimal("valorFrete", { precision: 10, scale: 2 }).notNull(),
      prazoDias: integer("prazoDias"),
      modal: varchar("modal", { length: 32 }),
      observacoes: text("observacoes"),
      tipoPrazo: tipoPrazoEnum("tipoPrazo").default("uteis"),
      selecionada: simNaoEnum("selecionada").default("nao").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    cotacaoComentarios = pgTable("cotacao_comentarios", {
      id: serial("id").primaryKey(),
      cotacaoId: integer("cotacaoId").notNull(),
      autorId: text("autorId"),
      // user.id (Better Auth)
      autorNome: varchar("autorNome", { length: 128 }).notNull().default("Sistema"),
      texto: text("texto"),
      audioUrl: varchar("audioUrl", { length: 512 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    cteImportacoes = pgTable("cte_importacoes", {
      id: serial("id").primaryKey(),
      numeroCte: varchar("numeroCte", { length: 64 }).notNull(),
      transportadoraId: integer("transportadoraId"),
      transportadoraNome: varchar("transportadoraNome", { length: 128 }),
      valor: decimal("valor", { precision: 12, scale: 2 }),
      dataEmissao: timestamp("dataEmissao"),
      remetente: varchar("remetente", { length: 256 }),
      destinatario: varchar("destinatario", { length: 256 }),
      municipioDestino: varchar("municipioDestino", { length: 128 }),
      estadoDestino: varchar("estadoDestino", { length: 2 }),
      rawData: text("rawData"),
      // JSON com dados brutos do CT-e
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    performanceMensal = pgTable("performance_mensal", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      osGeradas: integer("osGeradas"),
      osExpedicao: integer("osExpedicao"),
      percExpedicao: decimal("percExpedicao", { precision: 5, scale: 2 }),
      metaOsDia: decimal("metaOsDia", { precision: 6, scale: 2 }),
      capacidadeOsDiaMin: decimal("capacidadeOsDiaMin", { precision: 6, scale: 2 }),
      capacidadeOsDiaMax: decimal("capacidadeOsDiaMax", { precision: 6, scale: 2 }),
      deficitFinalizacao: decimal("deficitFinalizacao", { precision: 5, scale: 2 }),
      metaEmbalagemDia: decimal("metaEmbalagemDia", { precision: 6, scale: 2 }),
      producaoEmbalagemDia: decimal("producaoEmbalagemDia", { precision: 6, scale: 2 }),
      metaAcabamentoDia: decimal("metaAcabamentoDia", { precision: 6, scale: 2 }),
      capacidadeAcabamentoDia: decimal("capacidadeAcabamentoDia", { precision: 6, scale: 2 }),
      capacidadeNominalSolda: integer("capacidadeNominalSolda"),
      producaoInternaSolda: integer("producaoInternaSolda"),
      demandaTotalSolda: integer("demandaTotalSolda"),
      osTerceirizadas: integer("osTerceirizadas"),
      metrosTerceirizados: integer("metrosTerceirizados"),
      metaOsGeradas: integer("metaOsGeradas"),
      metaOsExpedicao: integer("metaOsExpedicao"),
      metaProducaoSolda: integer("metaProducaoSolda"),
      metaPercTerceirizacao: decimal("metaPercTerceirizacao", { precision: 5, scale: 2 }),
      numSoldadores: integer("numSoldadores"),
      soldadorSalarioBase: decimal("soldadorSalarioBase", { precision: 10, scale: 2 }),
      soldadorHorasExtras: decimal("soldadorHorasExtras", { precision: 8, scale: 2 }),
      soldadorValorHoraExtra: decimal("soldadorValorHoraExtra", { precision: 8, scale: 2 }),
      soldadorOutrosCustos: decimal("soldadorOutrosCustos", { precision: 10, scale: 2 }),
      custoProdutividadeSolda: decimal("custoProdutividadeSolda", { precision: 12, scale: 2 }),
      gestorSalarioBase: decimal("gestorSalarioBase", { precision: 10, scale: 2 }),
      gestorHorasExtras: decimal("gestorHorasExtras", { precision: 8, scale: 2 }),
      gestorValorHoraExtra: decimal("gestorValorHoraExtra", { precision: 8, scale: 2 }),
      gestorOutrosCustos: decimal("gestorOutrosCustos", { precision: 10, scale: 2 }),
      custoMetroTerceirizado: decimal("custoMetroTerceirizado", { precision: 8, scale: 2 }),
      precoVendaMetro: decimal("precoVendaMetro", { precision: 8, scale: 2 }),
      faturamentoRealizado: decimal("faturamentoRealizado", { precision: 14, scale: 2 }),
      metaFaturamento: decimal("metaFaturamento", { precision: 14, scale: 2 }),
      projetosEntregues: integer("projetosEntregues"),
      projetosNoPrazo: integer("projetosNoPrazo"),
      projetosForaPrazo: integer("projetosForaPrazo"),
      metaEntregaNoPrazoPct: decimal("metaEntregaNoPrazoPct", { precision: 5, scale: 2 }),
      metaRetrabalhoPct: decimal("metaRetrabalhoPct", { precision: 5, scale: 2 }),
      totalPedidos: integer("totalPedidos"),
      observacoes: text("observacoes"),
      destaques: text("destaques"),
      gargalos: text("gargalos"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    auditoriaRetrabalhos = pgTable("auditoria_retrabalhos", {
      id: serial("id").primaryKey(),
      retrabalhoId: integer("retrabalhoId"),
      osRetrabalhada: varchar("osRetrabalhada", { length: 32 }),
      osOriginal: varchar("osOriginal", { length: 64 }),
      acao: auditoriaAcaoEnum("acao").notNull(),
      usuarioId: text("usuarioId"),
      // user.id (Better Auth)
      usuarioNome: varchar("usuarioNome", { length: 128 }),
      usuarioRole: varchar("usuarioRole", { length: 32 }),
      detalhes: text("detalhes"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    cargosFuncoes = pgTable("cargos_funcoes", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 128 }).notNull(),
      missao: text("missao"),
      responsabilidades: text("responsabilidades"),
      kpis: text("kpis"),
      ferramentas: text("ferramentas"),
      integracao: text("integracao"),
      riscos: text("riscos"),
      requisitos: text("requisitos"),
      condicoes: text("condicoes"),
      imagemDivulgacaoUrl: text("imagemDivulgacaoUrl"),
      imagemDivulgacaoKey: text("imagemDivulgacaoKey"),
      roteiroEntrevista: text("roteiroEntrevista"),
      promptAnaliseIA: text("promptAnaliseIA"),
      createdBy: varchar("createdBy", { length: 128 }),
      updatedBy: varchar("updatedBy", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoModelos = pgTable("empacotamento_modelos", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull(),
      descricao: text("descricao"),
      modeloCaixaIdPadrao: integer("modeloCaixaIdPadrao"),
      tempoPorM2Min: decimal("tempoPorM2Min", { precision: 8, scale: 2 }),
      valorProdutividadePorMinLetreiro: decimal("valorProdutividadePorMinLetreiro", { precision: 10, scale: 4 }),
      ativo: integer("ativo").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoTabelaPrecos = pgTable("empacotamento_tabela_precos", {
      id: serial("id").primaryKey(),
      modeloId: integer("modeloId").notNull(),
      tipoCaixa: varchar("tipoCaixa", { length: 64 }).notNull(),
      valorComissao: decimal("valorComissao", { precision: 8, scale: 2 }).notNull().default("0"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoModelosCaixa = pgTable("empacotamento_modelos_caixa", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull(),
      descricao: text("descricao"),
      tipoCaixa: varchar("tipoCaixa", { length: 32 }).notNull().default("padronizada"),
      larguraCm: decimal("larguraCm", { precision: 8, scale: 2 }),
      alturaCm: decimal("alturaCm", { precision: 8, scale: 2 }),
      profundidadeCm: decimal("profundidadeCm", { precision: 8, scale: 2 }),
      custoAquisicao: decimal("custoAquisicao", { precision: 10, scale: 2 }).notNull().default("0"),
      custoAquisicaoAtualizadoEm: timestamp("custoAquisicaoAtualizadoEm"),
      tempoPorM2Min: decimal("tempoPorM2Min", { precision: 8, scale: 2 }),
      tempoPorM3Min: decimal("tempoPorM3Min", { precision: 8, scale: 2 }),
      tempoPorMetroArestaMin: decimal("tempoPorMetroArestaMin", { precision: 8, scale: 2 }),
      valorProdutividadePorCm2: decimal("valorProdutividadePorCm2", { precision: 10, scale: 6 }),
      ativo: integer("ativo").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoChecklistItens = pgTable("empacotamento_checklist_itens", {
      id: serial("id").primaryKey(),
      modeloCaixaId: integer("modeloCaixaId").notNull(),
      ordem: integer("ordem").notNull().default(0),
      descricao: varchar("descricao", { length: 256 }).notNull(),
      obrigatorio: integer("obrigatorio").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    empacotamentoPedidos = pgTable("empacotamento_pedidos", {
      id: serial("id").primaryKey(),
      numeroPedido: varchar("numeroPedido", { length: 64 }).notNull(),
      cliente: varchar("cliente", { length: 256 }).notNull(),
      modeloId: integer("modeloId"),
      modeloNome: varchar("modeloNome", { length: 128 }),
      modeloCaixaId: integer("modeloCaixaId"),
      modeloCaixaNome: varchar("modeloCaixaNome", { length: 128 }),
      tipoCaixa: varchar("tipoCaixa", { length: 64 }).notNull().default(""),
      arquivoUrl: text("arquivoUrl"),
      arquivoKey: text("arquivoKey"),
      arquivoTipo: varchar("arquivoTipo", { length: 16 }),
      kanbanStatus: kanbanStatusEnum("kanbanStatus").notNull().default("aguardando"),
      prazoEntrega: timestamp("prazoEntrega"),
      horarioMaximo: varchar("horarioMaximo", { length: 8 }),
      finalizadoEm: timestamp("finalizadoEm"),
      valorComissao: decimal("valorComissao", { precision: 8, scale: 2 }),
      larguraCm: decimal("larguraCm", { precision: 8, scale: 2 }),
      alturaCm: decimal("alturaCm", { precision: 8, scale: 2 }),
      profundidadeCm: decimal("profundidadeCm", { precision: 8, scale: 2 }),
      pesoKg: decimal("pesoKg", { precision: 8, scale: 2 }),
      metrosQuadrados: decimal("metrosQuadrados", { precision: 10, scale: 4 }),
      cnpjCliente: varchar("cnpjCliente", { length: 32 }),
      cepCliente: varchar("cepCliente", { length: 16 }),
      enderecoCliente: varchar("enderecoCliente", { length: 512 }),
      fotografiaUrl: text("fotografiaUrl"),
      fotografiaKey: text("fotografiaKey"),
      observacoes: text("observacoes"),
      createdBy: integer("createdBy"),
      createdByNome: varchar("createdByNome", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoPedidoUsuarios = pgTable("empacotamento_pedido_usuarios", {
      id: serial("id").primaryKey(),
      pedidoId: integer("pedidoId").notNull(),
      usuarioId: text("usuarioId"),
      // user.id (Better Auth)
      usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
      iniciadoEm: timestamp("iniciadoEm"),
      finalizadoEm: timestamp("finalizadoEm"),
      tempoSegundos: integer("tempoSegundos").default(0),
      ativo: integer("ativo").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    empacotamentoPedidoFotos = pgTable("empacotamento_pedido_fotos", {
      id: serial("id").primaryKey(),
      pedidoId: integer("pedidoId").notNull(),
      storageKey: text("storageKey").notNull(),
      url: text("url").notNull(),
      usuarioNome: varchar("usuarioNome", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    empacotamentoPedidoChecklist = pgTable("empacotamento_pedido_checklist", {
      id: serial("id").primaryKey(),
      pedidoId: integer("pedidoId").notNull(),
      itemId: integer("itemId").notNull(),
      marcado: integer("marcado").notNull().default(0),
      marcadoPor: varchar("marcadoPor", { length: 128 }),
      marcadoEm: timestamp("marcadoEm")
    });
    empacotamentoInsumos = pgTable("empacotamento_insumos", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull(),
      unidadeMedida: varchar("unidadeMedida", { length: 32 }).notNull(),
      custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull().default("0"),
      precoAtualizadoEm: timestamp("precoAtualizadoEm"),
      categoria: varchar("categoria", { length: 64 }),
      ativo: integer("ativo").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoConsumoCaixa = pgTable("empacotamento_consumo_caixa", {
      id: serial("id").primaryKey(),
      modeloCaixaId: integer("modeloCaixaId").notNull(),
      insumoId: integer("insumoId").notNull(),
      quantidadePorCaixa: decimal("quantidadePorCaixa", { precision: 10, scale: 4 }).notNull().default("0"),
      formulaConsumo: varchar("formulaConsumo", { length: 32 }).notNull().default("fixo"),
      fator: decimal("fator", { precision: 8, scale: 4 }).notNull().default("1"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoCustoFuncionario = pgTable("empacotamento_custo_funcionario", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull().default("Padr\xE3o"),
      salarioMensal: decimal("salarioMensal", { precision: 10, scale: 2 }).notNull().default("0"),
      horasMes: decimal("horasMes", { precision: 6, scale: 2 }).notNull().default("220"),
      custoHora: decimal("custoHora", { precision: 10, scale: 4 }),
      ativo: integer("ativo").notNull().default(1),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoInsumosLetreiro = pgTable("empacotamento_insumos_letreiro", {
      id: serial("id").primaryKey(),
      modeloLetreiId: integer("modeloLetreiId").notNull(),
      insumoId: integer("insumoId").notNull(),
      quantidade: decimal("quantidade", { precision: 10, scale: 4 }).notNull().default("1"),
      fatorM2: decimal("fatorM2", { precision: 10, scale: 4 }),
      observacao: varchar("observacao", { length: 255 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoCronometroPausas = pgTable("empacotamento_cronometro_pausas", {
      id: serial("id").primaryKey(),
      pedidoUsuarioId: integer("pedidoUsuarioId").notNull(),
      pausadoEm: timestamp("pausadoEm").notNull(),
      retomadoEm: timestamp("retomadoEm"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    empacotamentoConfigProdutividade = pgTable("empacotamento_config_produtividade", {
      id: serial("id").primaryKey(),
      valorPorMinuto: decimal("valorPorMinuto", { precision: 10, scale: 4 }).notNull().default("0.15"),
      bonusPorcentagem: decimal("bonusPorcentagem", { precision: 5, scale: 2 }).notNull().default("20.00"),
      penalidadePorcentagem: decimal("penalidadePorcentagem", { precision: 5, scale: 2 }).notNull().default("30.00"),
      descricao: varchar("descricao", { length: 255 }),
      ativo: integer("ativo").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoChecklistLetreitoItens = pgTable("empacotamento_checklist_letreiro_itens", {
      id: serial("id").primaryKey(),
      modeloLetreitoId: integer("modeloLetreitoId").notNull(),
      ordem: integer("ordem").notNull().default(0),
      descricao: varchar("descricao", { length: 512 }).notNull(),
      obrigatorio: integer("obrigatorio").notNull().default(1),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    empacotamentoPedidoChecklistLetreiro = pgTable("empacotamento_pedido_checklist_letreiro", {
      id: serial("id").primaryKey(),
      pedidoId: integer("pedidoId").notNull(),
      itemId: integer("itemId").notNull(),
      marcado: integer("marcado").notNull().default(0),
      marcadoPor: varchar("marcadoPor", { length: 128 }),
      marcadoEm: timestamp("marcadoEm")
    });
    empacotamentoSessoes = pgTable("empacotamento_sessoes", {
      id: serial("id").primaryKey(),
      pedidoId: integer("pedidoId").notNull(),
      operadorId: text("operadorId").notNull(),
      // user.id (Better Auth)
      operadorNome: varchar("operadorNome", { length: 128 }).notNull(),
      iniciadoEm: integer("iniciadoEm").notNull(),
      finalizadoEm: integer("finalizadoEm"),
      totalSegundos: integer("totalSegundos").notNull().default(0),
      status: varchar("status", { length: 32 }).notNull().default("ativo"),
      registradoEm: integer("registradoEm"),
      tempoRegistradoSegundos: integer("tempoRegistradoSegundos"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    empacotamentoSessoesPausas = pgTable("empacotamento_sessoes_pausas", {
      id: serial("id").primaryKey(),
      sessaoId: integer("sessaoId").notNull(),
      pausadoEm: integer("pausadoEm").notNull(),
      retomadoEm: integer("retomadoEm")
    });
    knowledgeSuggestions = pgTable("knowledge_suggestions", {
      id: serial("id").primaryKey(),
      pergunta: text("pergunta").notNull(),
      conteudoSugerido: text("conteudoSugerido").notNull(),
      fonte: varchar("fonte", { length: 32 }).notNull().default("manual"),
      autorId: text("autorId"),
      // user.id (Better Auth)
      autorNome: varchar("autorNome", { length: 128 }),
      status: varchar("status", { length: 32 }).notNull().default("pendente"),
      tituloSugerido: varchar("tituloSugerido", { length: 256 }),
      categoriaSugerida: varchar("categoriaSugerida", { length: 64 }),
      observacaoMaster: text("observacaoMaster"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    acoesCorretivas = pgTable("acoes_corretivas", {
      id: serial("id").primaryKey(),
      retrabalhoid: integer("retrabalhoid").notNull(),
      status: acaoCorretivaStatusEnum("status").notNull().default("aberto"),
      acaoTomada: text("acaoTomada"),
      responsavel: varchar("responsavel", { length: 128 }),
      prazoResolucao: timestamp("prazoResolucao"),
      dataResolucao: timestamp("dataResolucao"),
      custoAdicional: decimal("custoAdicional", { precision: 10, scale: 2 }).default("0"),
      observacoes: text("observacoes"),
      registradoPor: varchar("registradoPor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    planosAcao = pgTable("planos_acao", {
      id: serial("id").primaryKey(),
      codigoErro: varchar("codigoErro", { length: 20 }).notNull(),
      setor: varchar("setor", { length: 64 }),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      problemaRaiz: text("problemaRaiz"),
      acoesPreventivas: text("acoesPreventivas"),
      responsavel: varchar("responsavel", { length: 128 }),
      prazo: timestamp("prazo"),
      status: planoAcaoStatusEnum("status").notNull().default("pendente"),
      reincidenciasNaAbertura: integer("reincidenciasNaAbertura").default(0),
      reincidenciasAposPlano: integer("reincidenciasAposPlano").default(0),
      errosPrevenidos: text("errosPrevenidos"),
      errosResolvidos: text("errosResolvidos"),
      metodologia: varchar("metodologia", { length: 32 }).default("ambos"),
      codigosErro: text("codigosErro"),
      criadoPor: varchar("criadoPor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    ishikawaCausas = pgTable("ishikawa_causas", {
      id: serial("id").primaryKey(),
      planoId: integer("planoId").notNull(),
      categoria: ishikawaCategoriaEnum("categoria").notNull(),
      causa: text("causa").notNull(),
      prioridade: prioridadeEnum("prioridade").default("media"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    acoes5w2h = pgTable("acoes_5w2h", {
      id: serial("id").primaryKey(),
      planoId: integer("planoId").notNull(),
      what: text("what").notNull(),
      why: text("why"),
      where: varchar("where", { length: 128 }),
      who: varchar("who", { length: 128 }),
      when: varchar("when", { length: 64 }),
      how: text("how"),
      howMuch: varchar("howMuch", { length: 64 }),
      status: acao5w2hStatusEnum("status").default("pendente"),
      causaId: integer("causaId"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    metasRetrabalho = pgTable("metas_retrabalho", {
      id: serial("id").primaryKey(),
      ano: integer("ano").notNull(),
      mes: integer("mes"),
      metaMaxRetrabalhosMes: integer("metaMaxRetrabalhosMes"),
      metaMaxCustoMes: decimal("metaMaxCustoMes", { precision: 12, scale: 2 }),
      metaMaxPercFaturamento: decimal("metaMaxPercFaturamento", { precision: 5, scale: 2 }),
      metaMaxPercEvitaveis: decimal("metaMaxPercEvitaveis", { precision: 5, scale: 2 }),
      metaMinResolucaoDias: integer("metaMinResolucaoDias"),
      metaMaxReincidencias: integer("metaMaxReincidencias"),
      metasPorSetor: text("metasPorSetor"),
      observacoes: text("observacoes"),
      criadoPor: varchar("criadoPor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    alertasSistema = pgTable("alertas_sistema", {
      id: serial("id").primaryKey(),
      tipo: alertaTipoEnum("tipo").notNull(),
      severidade: alertaSeveridadeEnum("severidade").notNull().default("aviso"),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao"),
      referenciaId: integer("referenciaId"),
      referenciaTipo: varchar("referenciaTipo", { length: 64 }),
      referenciaExtra: varchar("referenciaExtra", { length: 256 }),
      status: alertaStatusEnum("status").notNull().default("ativo"),
      destinatario: varchar("destinatario", { length: 128 }),
      lidoPor: varchar("lidoPor", { length: 128 }),
      lidoEm: timestamp("lidoEm"),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    bibliotecaArquivos = pgTable("biblioteca_arquivos", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 256 }).notNull(),
      descricao: text("descricao"),
      categoria: varchar("categoria", { length: 64 }).notNull().default("Geral"),
      subcategoria: varchar("subcategoria", { length: 64 }),
      tags: text("tags"),
      fileKey: varchar("fileKey", { length: 512 }).notNull(),
      fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
      fileName: varchar("fileName", { length: 256 }).notNull(),
      mimeType: varchar("mimeType", { length: 128 }).notNull(),
      fileSize: integer("fileSize").notNull().default(0),
      uploadedBy: varchar("uploadedBy", { length: 128 }),
      visualizacoes: integer("visualizacoes").notNull().default(0),
      conteudoExtraido: text("conteudoExtraido"),
      // mediumtext (MySQL) → text (Postgres)
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    abcCache = pgTable("abc_cache", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      tipo: abcTipoEnum("tipo").notNull(),
      dados: text("dados").notNull(),
      // JSON: [{nome, total, count, pct, pctAcum, classe}]
      totalOs: integer("totalOs").default(0),
      faturamentoTotal: decimal("faturamentoTotal", { precision: 14, scale: 2 }),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    metasOperacionais = pgTable("metas_operacionais", {
      id: serial("id").primaryKey(),
      anoVigencia: integer("anoVigencia"),
      metaEntregaNoPrazoPct: decimal("metaEntregaNoPrazoPct", { precision: 5, scale: 2 }).default("90.00"),
      metaMaxRetrabalhosMes: integer("metaMaxRetrabalhosMes"),
      metaMaxRetrabalhoPct: decimal("metaMaxRetrabalhoPct", { precision: 5, scale: 2 }).default("5.00"),
      metaFaturamentoMensal: decimal("metaFaturamentoMensal", { precision: 14, scale: 2 }).default("425000.00"),
      metaFaturamentoAnual: decimal("metaFaturamentoAnual", { precision: 16, scale: 2 }),
      metaLucratividadePct: decimal("metaLucratividadePct", { precision: 5, scale: 2 }),
      metaLucratividadeValor: decimal("metaLucratividadeValor", { precision: 14, scale: 2 }),
      metaLucratividadeAnual: decimal("metaLucratividadeAnual", { precision: 16, scale: 2 }),
      metaMetrosSoldadosMes: integer("metaMetrosSoldadosMes"),
      metaCapacidadeSoldaMin: integer("metaCapacidadeSoldaMin"),
      metaCapacidadeSoldaMax: integer("metaCapacidadeSoldaMax"),
      numSoldadores: integer("numSoldadores"),
      metaMediaSoldaPorSoldador: decimal("metaMediaSoldaPorSoldador", { precision: 10, scale: 2 }),
      metaMaxPrejuizoRetrabalhoMes: decimal("metaMaxPrejuizoRetrabalhoMes", { precision: 12, scale: 2 }),
      metaMaxPrejuizoRetrabalhoPct: decimal("metaMaxPrejuizoRetrabalhoPct", { precision: 5, scale: 2 }),
      metaOsPorColaboradorDia: decimal("metaOsPorColaboradorDia", { precision: 6, scale: 2 }),
      metaRetrabalhosPorColaboradorMes: integer("metaRetrabalhosPorColaboradorMes"),
      metaTicketMedio: decimal("metaTicketMedio", { precision: 10, scale: 2 }).default("3000.00"),
      metaOsGeradasMes: integer("metaOsGeradasMes"),
      metaMaxMetrosTerceirizadosMes: integer("metaMaxMetrosTerceirizadosMes"),
      metaMaxPercTerceirizacao: decimal("metaMaxPercTerceirizacao", { precision: 5, scale: 2 }),
      observacoes: text("observacoes"),
      ativo: boolean("ativo").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    financeiroMensal = pgTable("financeiro_mensal", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      faturamentoOficial: decimal("faturamentoOficial", { precision: 14, scale: 2 }),
      despesasFixas: decimal("despesasFixas", { precision: 14, scale: 2 }),
      despesasVariaveis: decimal("despesasVariaveis", { precision: 14, scale: 2 }),
      numColaboradores: integer("numColaboradores"),
      lucroBruto: decimal("lucroBruto", { precision: 14, scale: 2 }),
      lucroLiquido: decimal("lucroLiquido", { precision: 14, scale: 2 }),
      impostoDas: decimal("impostoDas", { precision: 14, scale: 2 }),
      impostoIcmsDifal: decimal("impostoIcmsDifal", { precision: 14, scale: 2 }),
      impostoDaems: decimal("impostoDaems", { precision: 14, scale: 2 }),
      comissoesBv: decimal("comissoesBv", { precision: 14, scale: 2 }),
      produtividadeSolda: decimal("produtividadeSolda", { precision: 14, scale: 2 }),
      freteRetrabalho: decimal("freteRetrabalho", { precision: 14, scale: 2 }),
      devSoftware: decimal("devSoftware", { precision: 14, scale: 2 }),
      receitaOperacionalOs: decimal("receitaOperacionalOs", { precision: 14, scale: 2 }),
      resultadoEfetivo: decimal("resultadoEfetivo", { precision: 14, scale: 2 }),
      saldoMes: decimal("saldoMes", { precision: 14, scale: 2 }),
      tl1: decimal("tl1", { precision: 14, scale: 2 }),
      tl2: decimal("tl2", { precision: 14, scale: 2 }),
      tl3: decimal("tl3", { precision: 14, scale: 2 }),
      notas: text("notas"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    observacoesFinanceirasMensais = pgTable("observacoes_financeiras_mensais", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      observacoesManuais: text("observacoes_manuais"),
      analiseIa: text("analise_ia"),
      contextosEspecificos: text("contextos_especificos"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    desempenhoColaboradorMensal = pgTable("desempenho_colaborador_mensal", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 120 }).notNull(),
      categoria: varchar("categoria", { length: 40 }).notNull(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      numFaltas: integer("numFaltas").default(0),
      metrosSoldados: decimal("metrosSoldados", { precision: 10, scale: 2 }),
      numRetrabalhos: integer("numRetrabalhos").default(0),
      numPropostas: integer("numPropostas").default(0),
      numVendas: integer("numVendas").default(0),
      faturamentoVendedor: decimal("faturamentoVendedor", { precision: 14, scale: 2 }),
      ticketMedioVendedor: decimal("ticketMedioVendedor", { precision: 12, scale: 2 }),
      numTrabalhos: integer("numTrabalhos").default(0),
      notas: text("notas"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    metaProdutos = pgTable("meta_produtos", {
      id: serial("id").primaryKey(),
      nomeProduto: varchar("nomeProduto", { length: 256 }).notNull(),
      codigoProduto: varchar("codigoProduto", { length: 64 }),
      metaParticipacaoPct: decimal("metaParticipacaoPct", { precision: 5, scale: 2 }).notNull().default("0"),
      ativo: boolean("ativo").default(true).notNull(),
      observacao: text("observacao"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    metasComerciais = pgTable("metas_comerciais", {
      id: serial("id").primaryKey(),
      vendedor: varchar("vendedor", { length: 256 }).notNull(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      metaCotacoes: integer("metaCotacoes"),
      metaVendas: integer("metaVendas"),
      metaFaturamento: decimal("metaFaturamento", { precision: 14, scale: 2 }),
      metaConversao: decimal("metaConversao", { precision: 5, scale: 2 }),
      metaTicketMedio: decimal("metaTicketMedio", { precision: 12, scale: 2 }),
      metaOsGeradas: integer("metaOsGeradas"),
      metaClientesNovos: integer("metaClientesNovos"),
      metaOsNovos: integer("metaOsNovos"),
      metaCotacoesNovos: integer("metaCotacoesNovos"),
      metaFaturamentoNovos: decimal("metaFaturamentoNovos", { precision: 14, scale: 2 }),
      metaTaxaFaturamento: decimal("metaTaxaFaturamento", { precision: 5, scale: 2 }),
      metaTaxaFaturamentoNovos: decimal("metaTaxaFaturamentoNovos", { precision: 5, scale: 2 }),
      metaConversaoNovos: decimal("metaConversaoNovos", { precision: 5, scale: 2 }),
      metaTicketMedioNovos: decimal("metaTicketMedioNovos", { precision: 12, scale: 2 }),
      metaValorOrcado: decimal("metaValorOrcado", { precision: 14, scale: 2 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    historicoOs = pgTable("historico_os", {
      id: serial("id").primaryKey(),
      osNumero: varchar("osNumero", { length: 32 }),
      tipoOs: varchar("tipoOs", { length: 64 }),
      empresa: varchar("empresa", { length: 256 }),
      trabalho: text("trabalho"),
      logistica: varchar("logistica", { length: 128 }),
      dataAprovacao: varchar("dataAprovacao", { length: 32 }),
      dataEntrega: varchar("dataEntrega", { length: 32 }),
      dataFaturamento: varchar("dataFaturamento", { length: 32 }),
      status: varchar("status", { length: 64 }),
      vendedor: varchar("vendedor", { length: 256 }),
      valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }),
      descontos: decimal("descontos", { precision: 14, scale: 2 }),
      valorOs: decimal("valorOs", { precision: 14, scale: 2 }),
      materiaPrima: decimal("materiaPrima", { precision: 14, scale: 2 }),
      custoFixo: decimal("custoFixo", { precision: 14, scale: 2 }),
      maoDeObra: decimal("maoDeObra", { precision: 14, scale: 2 }),
      tarifasFinanceiras: decimal("tarifasFinanceiras", { precision: 14, scale: 2 }),
      comissoesInternas: decimal("comissoesInternas", { precision: 14, scale: 2 }),
      comissoesExternas: decimal("comissoesExternas", { precision: 14, scale: 2 }),
      terceirizados: decimal("terceirizados", { precision: 14, scale: 2 }),
      tributos: decimal("tributos", { precision: 14, scale: 2 }),
      custosTotal: decimal("custosTotal", { precision: 14, scale: 2 }),
      resultadoReais: decimal("resultadoReais", { precision: 14, scale: 2 }),
      resultadoPct: decimal("resultadoPct", { precision: 7, scale: 2 }),
      contribuicaoReais: decimal("contribuicaoReais", { precision: 14, scale: 2 }),
      contribuicaoPct: decimal("contribuicaoPct", { precision: 7, scale: 2 }),
      // Cidade/Estado do cliente, resolvidos por cruzamento com o cadastro de
      // clientes na importação (o relatório de vendas do ERP não traz endereço)
      // — usados pela Análise Geográfica em comercial/geografia.
      cidade: varchar("cidade", { length: 128 }),
      estado: varchar("estado", { length: 2 }),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      mesAnoIdx: index("historico_os_mes_ano_idx").on(t2.mes, t2.ano),
      estadoIdx: index("historico_os_estado_idx").on(t2.estado)
    }));
    historicoOrcamentos = pgTable("historico_orcamentos", {
      id: serial("id").primaryKey(),
      orcNumero: varchar("orcNumero", { length: 32 }),
      empresa: varchar("empresa", { length: 256 }),
      trabalho: text("trabalho"),
      dataCadastro: varchar("dataCadastro", { length: 32 }),
      validade: varchar("validade", { length: 32 }),
      vendedor: varchar("vendedor", { length: 256 }),
      status: varchar("status", { length: 64 }),
      motivoCancelamento: text("motivoCancelamento"),
      total: decimal("total", { precision: 14, scale: 2 }),
      custosTotal: decimal("custosTotal", { precision: 14, scale: 2 }),
      margemLiquida: decimal("margemLiquida", { precision: 14, scale: 2 }),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    }, (t2) => ({
      mesAnoIdx: index("historico_orcamentos_mes_ano_idx").on(t2.mes, t2.ano)
    }));
    crmMetas = pgTable("crm_metas", {
      id: serial("id").primaryKey(),
      vendedor: varchar("vendedor", { length: 128 }).notNull(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      metaValor: decimal("metaValor", { precision: 14, scale: 2 }).default("0").notNull(),
      metaQtdOs: integer("metaQtdOs").default(0).notNull(),
      usuarioVinculadoId: text("usuarioVinculadoId"),
      // user.id (Better Auth)
      usuarioVinculadoNome: varchar("usuarioVinculadoNome", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    crmContatos = pgTable("crm_contatos", {
      id: serial("id").primaryKey(),
      orcamentoId: varchar("orcamentoId", { length: 32 }).notNull(),
      vendedor: varchar("vendedor", { length: 128 }).notNull(),
      empresa: varchar("empresa", { length: 256 }).notNull(),
      numeroContato: integer("numeroContato").notNull(),
      canal: crmCanalEnum("canal").default("whatsapp").notNull(),
      observacao: text("observacao"),
      contatadoEm: timestamp("contatadoEm").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    clienteOverrides = pgTable("cliente_overrides", {
      id: serial("id").primaryKey(),
      empresa: varchar("empresa", { length: 256 }).notNull().unique(),
      empresaOriginal: varchar("empresaOriginal", { length: 256 }).notNull(),
      status: clienteOverrideStatusEnum("status").notNull().default("recorrente"),
      motivo: text("motivo"),
      criadoPor: varchar("criadoPor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    custoMarketing = pgTable("custo_marketing", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      investimento: decimal("investimento", { precision: 14, scale: 2 }).notNull().default("0"),
      observacao: text("observacao"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    custosFixos = pgTable("custos_fixos", {
      id: serial("id").primaryKey(),
      plano: varchar("plano", { length: 256 }).notNull(),
      categoria: varchar("categoria", { length: 128 }).notNull(),
      grupoCategoria: varchar("grupoCategoria", { length: 64 }).notNull(),
      fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
      tipo: varchar("tipo", { length: 64 }).notNull(),
      valor: decimal("valor", { precision: 14, scale: 2 }).notNull().default("0"),
      vencimento: integer("vencimento"),
      observacao: text("observacao"),
      ativo: boolean("ativo").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    dividasParcelamentos = pgTable("dividas_parcelamentos", {
      id: serial("id").primaryKey(),
      plano: varchar("plano", { length: 256 }).notNull(),
      categoria: varchar("categoria", { length: 128 }).notNull(),
      fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
      janValor: decimal("jan_valor", { precision: 14, scale: 2 }),
      fevValor: decimal("fev_valor", { precision: 14, scale: 2 }),
      marValor: decimal("mar_valor", { precision: 14, scale: 2 }),
      abrValor: decimal("abr_valor", { precision: 14, scale: 2 }),
      maiValor: decimal("mai_valor", { precision: 14, scale: 2 }),
      junValor: decimal("jun_valor", { precision: 14, scale: 2 }),
      julValor: decimal("jul_valor", { precision: 14, scale: 2 }),
      agoValor: decimal("ago_valor", { precision: 14, scale: 2 }),
      setValor: decimal("set_valor", { precision: 14, scale: 2 }),
      outValor: decimal("out_valor", { precision: 14, scale: 2 }),
      novValor: decimal("nov_valor", { precision: 14, scale: 2 }),
      dezValor: decimal("dez_valor", { precision: 14, scale: 2 }),
      media: decimal("media", { precision: 14, scale: 2 }),
      observacao: text("observacao"),
      ativo: boolean("ativo").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    dreMensal = pgTable("dre_mensal", {
      id: serial("id").primaryKey(),
      ano: integer("ano").notNull(),
      mes: integer("mes").notNull(),
      receitaOperacionalBruta: decimal("receita_operacional_bruta", { precision: 14, scale: 2 }),
      receitaFinanceira: decimal("receita_financeira", { precision: 14, scale: 2 }),
      receitaNaoOperacional: decimal("receita_nao_operacional", { precision: 14, scale: 2 }),
      totalEntradas: decimal("total_entradas", { precision: 14, scale: 2 }),
      impostosVendas: decimal("impostos_vendas", { precision: 14, scale: 2 }),
      despesaVariavel: decimal("despesa_variavel", { precision: 14, scale: 2 }),
      despesaOperacional: decimal("despesa_operacional", { precision: 14, scale: 2 }),
      materiaPrima: decimal("materia_prima", { precision: 14, scale: 2 }),
      gastosGeraisFabricacao: decimal("gastos_gerais_fabricacao", { precision: 14, scale: 2 }),
      despesasPessoal: decimal("despesas_pessoal", { precision: 14, scale: 2 }),
      despesasFixas: decimal("despesas_fixas", { precision: 14, scale: 2 }),
      despesasFinanceiras: decimal("despesas_financeiras", { precision: 14, scale: 2 }),
      despesasNaoOperacionais: decimal("despesas_nao_operacionais", { precision: 14, scale: 2 }),
      totalSaidas: decimal("total_saidas", { precision: 14, scale: 2 }),
      receitaBrutaOperacional: decimal("receita_bruta_operacional", { precision: 14, scale: 2 }),
      lucroBruto: decimal("lucro_bruto", { precision: 14, scale: 2 }),
      lucroOperacional: decimal("lucro_operacional", { precision: 14, scale: 2 }),
      lucroLiquido: decimal("lucro_liquido", { precision: 14, scale: 2 }),
      valorPedidos: decimal("valor_pedidos", { precision: 14, scale: 2 }),
      resultadoEfetivo: decimal("resultado_efetivo", { precision: 14, scale: 2 }),
      margemResultadoEfetivo: decimal("margem_resultado_efetivo", { precision: 8, scale: 4 }),
      percMateriaPrima: decimal("perc_materia_prima", { precision: 8, scale: 4 }),
      percFixoRateado: decimal("perc_fixo_rateado", { precision: 8, scale: 4 }),
      percTributos: decimal("perc_tributos", { precision: 8, scale: 4 }),
      percComissaoInterna: decimal("perc_comissao_interna", { precision: 8, scale: 4 }),
      percDescontos: decimal("perc_descontos", { precision: 8, scale: 4 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    crmScripts = pgTable("crm_scripts", {
      id: serial("id").primaryKey(),
      faixa: integer("faixa").notNull(),
      ordem: integer("ordem").notNull().default(0),
      titulo: varchar("titulo", { length: 128 }),
      conteudo: text("conteudo").notNull(),
      // mediumtext → text
      conteudo_voz: text("conteudo_voz"),
      // mediumtext → text
      ativo: boolean("ativo").notNull().default(true),
      copia_count: integer("copia_count").notNull().default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    inteligenciaClientesCache = pgTable("inteligencia_clientes_cache", {
      id: serial("id").primaryKey(),
      periodoKey: varchar("periodo_key", { length: 32 }).notNull(),
      dadosJson: text("dados_json").notNull(),
      // mediumtext → text
      calculadoEm: timestamp("calculado_em").defaultNow().notNull(),
      congelado: boolean("congelado").default(false).notNull(),
      congeladoEm: timestamp("congelado_em")
    });
    ledTipos = pgTable("led_tipos", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 128 }).notNull(),
      descricao: text("descricao"),
      custoUnitario: decimal("custo_unitario", { precision: 10, scale: 4 }).notNull().default("0"),
      unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
      ativo: varchar("ativo", { length: 4 }).notNull().default("sim"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    custoLedLancamentos = pgTable("custo_led_lancamentos", {
      id: serial("id").primaryKey(),
      os: varchar("os", { length: 64 }).notNull(),
      ledTipoId: integer("led_tipo_id").notNull(),
      ledTipoEfetivoId: integer("led_tipo_efetivo_id"),
      qtdPrevista: decimal("qtd_prevista", { precision: 10, scale: 4 }).notNull().default("0"),
      qtdEfetiva: decimal("qtd_efetiva", { precision: 10, scale: 4 }),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      observacao: text("observacao"),
      vendedor: varchar("vendedor", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    crmFaixaEtiquetas = pgTable("crm_faixa_etiquetas", {
      id: serial("id").primaryKey(),
      faixa: integer("faixa").notNull(),
      label: varchar("label", { length: 128 }).notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    performanceAuditada = pgTable("performance_auditada", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      cotacoes: integer("cotacoes").notNull().default(0),
      osNormais: integer("os_normais").notNull().default(0),
      taxaConversao: decimal("taxa_conversao", { precision: 5, scale: 2 }).notNull().default("0"),
      faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
      valorOrcado: decimal("valor_orcado", { precision: 14, scale: 2 }).notNull().default("0"),
      clientesNovos: integer("clientes_novos").notNull().default(0),
      cotacoesNovos: integer("cotacoes_novos").notNull().default(0),
      taxaConvNovos: decimal("taxa_conv_novos", { precision: 5, scale: 2 }).notNull().default("0"),
      faturamentoNovos: decimal("faturamento_novos", { precision: 14, scale: 2 }).notNull().default("0"),
      statusValidacao: statusValidacaoEnum("status_validacao").notNull().default("pendente"),
      congelado: boolean("congelado").notNull().default(false),
      fonteExcel: varchar("fonte_excel", { length: 512 }),
      observacoes: text("observacoes"),
      auditadoPor: varchar("auditado_por", { length: 128 }).notNull().default("sistema"),
      dataAuditoria: timestamp("data_auditoria").defaultNow().notNull(),
      dataCongelamento: timestamp("data_congelamento"),
      listaClientesNovos: text("lista_clientes_novos"),
      // mediumtext → text
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      mesAnoIdx: index("performance_auditada_mes_ano_idx").on(t2.mes, t2.ano)
    }));
    clienteNovosContato = pgTable("cliente_novos_contato", {
      id: serial("id").primaryKey(),
      empresa: varchar("empresa", { length: 256 }).notNull(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      contatado: boolean("contatado").notNull().default(false),
      dataContato: timestamp("data_contato"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    mubisysApiCache = pgTable("mubisys_api_cache", {
      id: serial("id").primaryKey(),
      cacheKey: varchar("cache_key", { length: 64 }).notNull().unique(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      osData: text("os_data"),
      // mediumtext → text
      orcData: text("orc_data"),
      // mediumtext → text
      fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
      expiresAt: timestamp("expires_at").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    crmAtividadeLog = pgTable("crm_atividade_log", {
      id: serial("id").primaryKey(),
      vendedor: varchar("vendedor", { length: 128 }).notNull(),
      localUserId: text("local_user_id"),
      // user.id (Better Auth)
      acao: varchar("acao", { length: 64 }).notNull(),
      orcamentoId: varchar("orcamento_id", { length: 32 }),
      empresa: varchar("empresa", { length: 256 }),
      detalhe: varchar("detalhe", { length: 512 }),
      realizadaEm: timestamp("realizada_em").defaultNow().notNull(),
      turno: turnoEnum("turno").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    financeirosMensais = pgTable("financeiros_mensais", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      receitaBruta: decimal("receita_bruta", { precision: 14, scale: 2 }).notNull().default("0"),
      receitaOperacional: decimal("receita_operacional", { precision: 14, scale: 2 }).notNull().default("0"),
      receitaFinanceira: decimal("receita_financeira", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasTotal: decimal("despesas_total", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasFixas: decimal("despesas_fixas", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasVariaveis: decimal("despesas_variaveis", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasPessoal: decimal("despesas_pessoal", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasFinanceiras: decimal("despesas_financeiras", { precision: 14, scale: 2 }).notNull().default("0"),
      despesasImpostos: decimal("despesas_impostos", { precision: 14, scale: 2 }).notNull().default("0"),
      lucroGruto: decimal("lucro_gruto", { precision: 14, scale: 2 }).notNull().default("0"),
      lucroOperacional: decimal("lucro_operacional", { precision: 14, scale: 2 }).notNull().default("0"),
      lucroLiquido: decimal("lucro_liquido", { precision: 14, scale: 2 }).notNull().default("0"),
      entradas: decimal("entradas", { precision: 14, scale: 2 }).notNull().default("0"),
      saidas: decimal("saidas", { precision: 14, scale: 2 }).notNull().default("0"),
      saldoMes: decimal("saldo_mes", { precision: 14, scale: 2 }).notNull().default("0"),
      fonte: varchar("fonte", { length: 64 }).default("manual"),
      fonteArquivo: varchar("fonte_arquivo", { length: 256 }),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    cargos = pgTable("cargos", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 256 }).notNull().unique(),
      missao: text("missao").notNull(),
      subordinacao: varchar("subordinacao", { length: 256 }),
      setor: varchar("setor", { length: 128 }).notNull(),
      regimeTrabalho: varchar("regime_trabalho", { length: 128 }),
      jornada: varchar("jornada", { length: 256 }),
      limites: text("limites"),
      condicoesTrabalho: text("condicoes_trabalho"),
      requisitos: text("requisitos"),
      gestaoRiscos: text("gestao_riscos"),
      ferramentasRecursos: text("ferramentas_recursos"),
      integracaoFluxo: text("integracao_fluxo"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    responsabilidadesCargo = pgTable("responsabilidades_cargo", {
      id: serial("id").primaryKey(),
      cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao").notNull(),
      ordem: integer("ordem").notNull().default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    kpisCargo = pgTable("kpis_cargo", {
      id: serial("id").primaryKey(),
      cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao").notNull(),
      meta: varchar("meta", { length: 256 }),
      ordem: integer("ordem").notNull().default(0),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    analiseCurriculos = pgTable("analise_curriculos", {
      id: serial("id").primaryKey(),
      cargoId: integer("cargoId").notNull().references(() => cargosFuncoes.id, { onDelete: "cascade" }),
      curriculoFileName: varchar("curriculoFileName", { length: 256 }).notNull(),
      curriculoUrl: text("curriculoUrl").notNull(),
      curriculoKey: text("curriculoKey").notNull(),
      resultado: text("resultado"),
      status: analiseCurriculoStatusEnum("status").default("pendente").notNull(),
      erroMensagem: text("erroMensagem"),
      uploadedBy: varchar("uploadedBy", { length: 128 }),
      uploadedByName: varchar("uploadedByName", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    syncLogs = pgTable("sync_logs", {
      id: serial("id").primaryKey(),
      dataExecucao: timestamp("dataExecucao").defaultNow().notNull(),
      quantidadeOsImportadas: integer("quantidadeOsImportadas").default(0).notNull(),
      status: syncStatusEnum("status").default("PENDENTE").notNull(),
      mensagemErro: text("mensagemErro"),
      tempoExecucaoMs: integer("tempoExecucaoMs"),
      proximaExecucao: timestamp("proximaExecucao"),
      criadoEm: timestamp("criadoEm").defaultNow().notNull()
    });
    erpOsCache = pgTable("erp_os_cache", {
      id: serial("id").primaryKey(),
      numeroOs: varchar("numeroOs", { length: 32 }).notNull().unique(),
      razaoSocial: varchar("razaoSocial", { length: 256 }),
      cnpj: varchar("cnpj", { length: 20 }),
      email: varchar("email", { length: 320 }),
      cep: varchar("cep", { length: 10 }),
      municipio: varchar("municipio", { length: 128 }),
      estado: varchar("estado", { length: 2 }),
      endereco: text("endereco"),
      telefone: varchar("telefone", { length: 20 }),
      dataEmissao: date("dataEmissao"),
      dataAprovacao: varchar("dataAprovacao", { length: 64 }),
      dataEntregaPrevista: date("dataEntregaPrevista"),
      vendedor: varchar("vendedor", { length: 128 }),
      status: varchar("status", { length: 32 }),
      valorTotal: decimal("valorTotal", { precision: 12, scale: 2 }),
      descricao: text("descricao"),
      dataUltimaAtualizacao: timestamp("dataUltimaAtualizacao").defaultNow().notNull(),
      sincronizadoEm: timestamp("sincronizadoEm").defaultNow().notNull(),
      criadoEm: timestamp("criadoEm").defaultNow().notNull()
    }, (t2) => ({
      numeroOsIndex: uniqueIndex("erp_os_cache_numero_os_idx").on(t2.numeroOs)
    }));
    clientes = pgTable("clientes", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 256 }).notNull(),
      cnpj: varchar("cnpj", { length: 32 }),
      email: varchar("email", { length: 256 }),
      telefone: varchar("telefone", { length: 64 }),
      cidade: varchar("cidade", { length: 128 }),
      estado: varchar("estado", { length: 2 }),
      segmento: varchar("segmento", { length: 64 }),
      origem: varchar("origem", { length: 64 }),
      status: clienteCadastroStatusEnum("status").default("prospect"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    crmPropostas = pgTable("crm_propostas", {
      id: serial("id").primaryKey(),
      clienteId: integer("clienteId"),
      clienteNome: varchar("clienteNome", { length: 256 }),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao"),
      valor: decimal("valor", { precision: 12, scale: 2 }),
      status: crmPropostaStatusEnum("status").notNull().default("prospeccao"),
      responsavel: varchar("responsavel", { length: 128 }),
      dataFechamento: date("dataFechamento"),
      motivoPerda: text("motivoPerda"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    performanceComercial = pgTable("performance_comercial", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      vendedor: varchar("vendedor", { length: 128 }).notNull(),
      faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
      quantidadeOs: integer("quantidadeOs").notNull().default(0),
      novosClientes: integer("novosClientes").notNull().default(0),
      ticketMedio: decimal("ticketMedio", { precision: 10, scale: 2 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    custoLed = pgTable("custo_led", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      produto: varchar("produto", { length: 128 }).notNull(),
      quantidade: integer("quantidade").notNull().default(0),
      custoUnitario: decimal("custoUnitario", { precision: 10, scale: 2 }).notNull().default("0"),
      custoTotal: decimal("custoTotal", { precision: 12, scale: 2 }).notNull().default("0"),
      fornecedor: varchar("fornecedor", { length: 128 }),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    cotacoesItens = pgTable("cotacoes_itens", {
      id: serial("id").primaryKey(),
      cotacaoId: integer("cotacaoId").notNull(),
      transportadoraId: integer("transportadoraId"),
      transportadoraNome: varchar("transportadoraNome", { length: 128 }),
      prazoEntrega: varchar("prazoEntrega", { length: 64 }),
      valorFrete: decimal("valorFrete", { precision: 10, scale: 2 }),
      valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
      observacoes: text("observacoes"),
      selecionada: boolean("selecionada").default(false),
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    cnqRegistros = pgTable("cnq_registros", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      categoria: varchar("categoria", { length: 64 }).notNull(),
      descricao: text("descricao"),
      valor: decimal("valor", { precision: 12, scale: 2 }).notNull().default("0"),
      tipo: cnqTipoEnum("tipo").notNull().default("interno"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    errosPadrao = pgTable("erros_padrao", {
      id: serial("id").primaryKey(),
      codigo: varchar("codigo", { length: 16 }).notNull().unique(),
      descricao: text("descricao").notNull(),
      categoria: varchar("categoria", { length: 64 }),
      setor: varchar("setor", { length: 64 }),
      tipo: cnqTipoEnum("tipo").default("interno"),
      ativo: boolean("ativo").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    ishikawaPlanos = pgTable("ishikawa_planos", {
      id: serial("id").primaryKey(),
      retrabalhoid: integer("retrabalhoid").notNull(),
      problema: text("problema").notNull(),
      efeito: text("efeito"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    performanceAbc = pgTable("performance_abc", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      tipo: abcTipoEnum("tipo").notNull(),
      entidade: varchar("entidade", { length: 256 }).notNull(),
      faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
      quantidade: integer("quantidade").notNull().default(0),
      classificacao: abcClassificacaoEnum("classificacao").notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    planosAcaoComercial = pgTable("planos_acao_comercial", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao"),
      responsavel: varchar("responsavel", { length: 128 }),
      prazo: date("prazo"),
      status: planoAcaoComercialStatusEnum("status").notNull().default("pendente"),
      prioridade: prioridadeComCriticaEnum("prioridade").default("media"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    planosAcaoQualidade = pgTable("planos_acao_qualidade", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao"),
      responsavel: varchar("responsavel", { length: 128 }),
      prazo: date("prazo"),
      status: planoAcaoComercialStatusEnum("status").notNull().default("pendente"),
      prioridade: prioridadeComCriticaEnum("prioridade").default("media"),
      retrabalhoid: integer("retrabalhoid"),
      observacoes: text("observacoes"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    regulamentos = pgTable("regulamentos", {
      id: serial("id").primaryKey(),
      titulo: varchar("titulo", { length: 256 }).notNull(),
      descricao: text("descricao"),
      categoria: varchar("categoria", { length: 64 }),
      conteudo: text("conteudo"),
      versao: varchar("versao", { length: 16 }).default("1.0"),
      ativo: boolean("ativo").notNull().default(true),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    metricas = pgTable("metricas", {
      id: serial("id").primaryKey(),
      nome: varchar("nome", { length: 256 }).notNull(),
      valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
      unidade: varchar("unidade", { length: 16 }).default("%"),
      dataApuracao: date("dataApuracao").notNull(),
      observacao: text("observacao"),
      criadoPorNome: varchar("criadoPorNome", { length: 128 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
  }
});

// server/_core/auth.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, username } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { drizzle } from "drizzle-orm/neon-serverless";
import bcrypt from "bcryptjs";
function resolveBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return void 0;
}
var db, auth;
var init_auth = __esm({
  "server/_core/auth.ts"() {
    "use strict";
    init_db_connection();
    init_schema();
    init_schema();
    db = drizzle(getPool());
    auth = betterAuth({
      database: drizzleAdapter(db, { provider: "pg", schema: schema_exports }),
      secret: process.env.BETTER_AUTH_SECRET,
      baseURL: resolveBaseURL(),
      // Deploys de preview: cada um tem host próprio, e o Better Auth barra
      // origem que não conhece. `baseURL` já entra na lista automaticamente;
      // isto cobre o caso de a requisição chegar pelo domínio de produção
      // enquanto a função roda num deploy de preview.
      trustedOrigins: [
        ...process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
        ...process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []
      ],
      emailAndPassword: {
        enabled: true,
        autoSignIn: true,
        // Mesma lib (bcryptjs) e custo (10) já usados em todo o resto do app
        // pra senha admin-provisionada — evita ter dois esquemas de hash
        // convivendo (o scrypt padrão do Better Auth vs. bcrypt do resto).
        password: {
          hash: (password) => bcrypt.hash(password, 10),
          verify: ({ hash, password }) => bcrypt.compare(password, hash)
        }
      },
      plugins: [
        // `roles` precisa cobrir as 8 roles de negócio inteiras — o plugin
        // rejeita em runtime (`YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE`)
        // qualquer valor de `role` passado pra createUser/setRole que não seja
        // uma chave deste mapa, mesmo já validado como AppRole no schema. Só
        // admin/master ganham permissão de gerenciar outros usuários no nível
        // do plugin (adminAc); as demais são "userAc" (sem essa permissão) —
        // a autorização real do app continua sendo requireRole() em
        // server/_core/trpc.ts, isto aqui é só pro plugin aceitar o valor.
        admin({
          defaultRole: "vendas",
          adminRoles: ["admin", "master"],
          roles: Object.fromEntries(
            APP_ROLES.map((role) => [role, role === "admin" || role === "master" ? adminAc : userAc])
          )
        }),
        // Login por nome (roles sem e-mail real, ex. producao/empacotamento)
        // além de e-mail — ver decisão na Tarefa 3.1 do plano de migração.
        // `username` pode ser um e-mail normalizado (users com e-mail real) ou
        // um slug do nome (users sem e-mail, ex. "joao.silva") — o validador
        // padrão só aceita alfanumérico+underscore, por isso libera "." também.
        username({
          usernameValidator: (value) => /^[a-zA-Z0-9_.@-]+$/.test(value)
        })
      ],
      advanced: {
        cookiePrefix: "radrasys"
      }
    });
  }
});

// server/_core/env.ts
var ENV;
var init_env = __esm({
  "server/_core/env.ts"() {
    "use strict";
    ENV = {
      cookieSecret: process.env.JWT_SECRET ?? "",
      databaseUrl: process.env.DATABASE_URL ?? "",
      isProduction: process.env.NODE_ENV === "production",
      openaiApiKey: process.env.OPENAI_API_KEY ?? "",
      MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
      MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? ""
    };
  }
});

// server/db/db-helpers-select.ts
var db_helpers_select_exports = {};
__export(db_helpers_select_exports, {
  adicionarOpcaoFrete: () => adicionarOpcaoFrete,
  atualizarOpcaoFrete: () => atualizarOpcaoFrete,
  excluirCotacaoFrete: () => excluirCotacaoFrete,
  excluirCotacoesPorStatus: () => excluirCotacoesPorStatus,
  listarCotacoesFrete: () => listarCotacoesFrete,
  listarOpcoesFrete: () => listarOpcoesFrete,
  listarOpcoesPorCotacoes: () => listarOpcoesPorCotacoes,
  normalizarOpcao: () => normalizarOpcao,
  obterCotacaoDetalhes: () => obterCotacaoDetalhes,
  removerOpcaoFrete: () => removerOpcaoFrete,
  selecionarOpcaoFrete: () => selecionarOpcaoFrete
});
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { drizzle as drizzle2 } from "drizzle-orm/neon-serverless";
async function getDb() {
  if (_db) return _db;
  if (!ENV.databaseUrl) throw new Error("DATABASE_URL not set");
  _db = drizzle2(getPool());
  return _db;
}
async function listarCotacoesFrete(page = 1, pageSize = 15, status) {
  const db5 = await getDb();
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 15, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safePageSize;
  const where = status ? eq(cotacoesFrete.status, status) : void 0;
  const rows = await db5.select().from(cotacoesFrete).where(where).orderBy(desc(cotacoesFrete.createdAt)).limit(safePageSize).offset(offset);
  const [{ total }] = await db5.select({ total: count() }).from(cotacoesFrete).where(where);
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  console.log(
    `\u2705 [SELECT Kanban] ${rows.length} registros (p\xE1gina ${safePage}/${totalPages}, status=${status ?? "todos"})`
  );
  const ids = rows.map((r) => r.id);
  const opcoes = await listarOpcoesPorCotacoes(ids);
  const porCotacao = /* @__PURE__ */ new Map();
  for (const op of opcoes) {
    const chave = op.cotacaoId;
    if (!porCotacao.has(chave)) porCotacao.set(chave, []);
    porCotacao.get(chave).push(normalizarOpcao(op));
  }
  console.log(`\u2705 [SELECT Kanban] ${opcoes.length} op\xE7\xE3o(\xF5es) de frete carregada(s) para ${ids.length} cota\xE7\xE3o(\xF5es)`);
  return {
    data: rows.map((row) => ({ ...row, opcoes: porCotacao.get(row.id) ?? [] })),
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages
    }
  };
}
function normalizarOpcao(op) {
  const prazoDias = op.prazoDias ?? null;
  const tipoPrazo = op.tipoPrazo ?? "uteis";
  const selecionada = op.selecionada === "sim" ? "sim" : "nao";
  return {
    id: Number(op.id),
    cotacaoId: Number(op.cotacaoId),
    transportadoraId: op.transportadoraId ?? null,
    transportadoraNome: op.transportadoraNome ?? null,
    valorFrete: op.valorFrete == null ? "0" : String(op.valorFrete),
    prazoDias,
    tipoPrazo,
    modal: op.modal ?? null,
    prazoEntrega: prazoDias != null ? `${prazoDias} dias ${tipoPrazo === "corridos" ? "corridos" : "\xFAteis"}` : null,
    observacoes: op.observacoes ?? null,
    selecionada,
    createdAt: op.createdAt ?? null
  };
}
async function obterCotacaoDetalhes(id) {
  const db5 = await getDb();
  const [cotacao] = await db5.select().from(cotacoesFrete).where(eq(cotacoesFrete.id, id));
  if (!cotacao) {
    throw new Error(`Cota\xE7\xE3o #${id} n\xE3o encontrada`);
  }
  return cotacao;
}
async function excluirCotacaoFrete(id) {
  const db5 = await getDb();
  await db5.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, id));
  await db5.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, id));
  const result = await db5.delete(cotacoesFrete).where(eq(cotacoesFrete.id, id)).returning({ id: cotacoesFrete.id });
  const afetados = result.length;
  console.log(`\u{1F5D1}\uFE0F [DELETE] Cota\xE7\xE3o #${id} removida (${afetados} registro(s))`);
  return { id, afetados };
}
async function excluirCotacoesPorStatus(status = "aberta") {
  const db5 = await getDb();
  const ids = await db5.select({ id: cotacoesFrete.id }).from(cotacoesFrete).where(eq(cotacoesFrete.status, status));
  for (const row of ids) {
    await db5.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, row.id));
    await db5.delete(cotacaoComentarios).where(eq(cotacaoComentarios.cotacaoId, row.id));
  }
  const result = await db5.delete(cotacoesFrete).where(eq(cotacoesFrete.status, status)).returning({ id: cotacoesFrete.id });
  const afetados = result.length;
  console.log(`\u{1F5D1}\uFE0F [DELETE EM MASSA] ${afetados} cota\xE7\xE3o(\xF5es) com status='${status}' removidas`);
  return { afetados };
}
async function adicionarOpcaoFrete(input) {
  const db5 = await getDb();
  const valor = input.valorFrete == null || input.valorFrete === "" ? null : String(input.valorFrete).replace(",", ".");
  const [existente] = await db5.select({ id: cotacaoOpcoes.id }).from(cotacaoOpcoes).where(and(eq(cotacaoOpcoes.cotacaoId, input.cotacaoId), eq(cotacaoOpcoes.transportadoraNome, input.transportadoraNome))).limit(1);
  if (existente) {
    console.log(`\u2139\uFE0F [OPCAO] ${input.transportadoraNome} j\xE1 existe na cota\xE7\xE3o #${input.cotacaoId}`);
    return { id: existente.id, duplicada: true };
  }
  const insertData = {
    cotacaoId: input.cotacaoId,
    transportadoraId: input.transportadoraId ?? null,
    transportadoraNome: input.transportadoraNome,
    valorFrete: valor ?? "0",
    prazoDias: input.prazoDias ?? null,
    tipoPrazo: input.tipoPrazo ?? "uteis",
    modal: input.modal ?? null,
    observacoes: input.observacoes ?? null
  };
  const [result] = await db5.insert(cotacaoOpcoes).values(insertData).returning({ id: cotacaoOpcoes.id });
  console.log(`\u2705 [OPCAO] ${input.transportadoraNome} adicionada \xE0 cota\xE7\xE3o #${input.cotacaoId} (id ${result.id})`);
  return { id: result.id, duplicada: false };
}
async function listarOpcoesFrete(cotacaoId) {
  const db5 = await getDb();
  return db5.select().from(cotacaoOpcoes).where(eq(cotacaoOpcoes.cotacaoId, cotacaoId)).orderBy(cotacaoOpcoes.id);
}
async function listarOpcoesPorCotacoes(ids) {
  if (ids.length === 0) return [];
  const db5 = await getDb();
  return db5.select().from(cotacaoOpcoes).where(inArray(cotacaoOpcoes.cotacaoId, ids)).orderBy(cotacaoOpcoes.id);
}
async function atualizarOpcaoFrete(opcaoId, dados) {
  const db5 = await getDb();
  const sets = {};
  if (dados.valorFrete !== void 0) {
    sets.valorFrete = dados.valorFrete == null || dados.valorFrete === "" ? "0" : String(dados.valorFrete).replace(",", ".");
  }
  if (dados.prazoDias !== void 0) {
    sets.prazoDias = dados.prazoDias;
  }
  if (dados.tipoPrazo !== void 0) {
    sets.tipoPrazo = dados.tipoPrazo;
  }
  if (dados.modal !== void 0) {
    sets.modal = dados.modal;
  }
  if (dados.observacoes !== void 0) {
    sets.observacoes = dados.observacoes ?? null;
  }
  if (Object.keys(sets).length === 0) return { afetados: 0 };
  const result = await db5.update(cotacaoOpcoes).set(sets).where(eq(cotacaoOpcoes.id, opcaoId)).returning({ id: cotacaoOpcoes.id });
  return { afetados: result.length };
}
async function removerOpcaoFrete(opcaoId) {
  const db5 = await getDb();
  const result = await db5.delete(cotacaoOpcoes).where(eq(cotacaoOpcoes.id, opcaoId)).returning({ id: cotacaoOpcoes.id });
  return { afetados: result.length };
}
async function selecionarOpcaoFrete(cotacaoId, opcaoId) {
  const db5 = await getDb();
  await db5.update(cotacaoOpcoes).set({ selecionada: "nao" }).where(eq(cotacaoOpcoes.cotacaoId, cotacaoId));
  await db5.update(cotacaoOpcoes).set({ selecionada: "sim" }).where(eq(cotacaoOpcoes.id, opcaoId));
  const [opcao] = await db5.select({ transportadoraId: cotacaoOpcoes.transportadoraId }).from(cotacaoOpcoes).where(eq(cotacaoOpcoes.id, opcaoId));
  const transportadoraId = opcao?.transportadoraId ?? null;
  await db5.update(cotacoesFrete).set({ status: "enviada", transportadoraSelecionadaId: transportadoraId, updatedAt: /* @__PURE__ */ new Date() }).where(eq(cotacoesFrete.id, cotacaoId));
  console.log(`\u2705 [OPCAO] Op\xE7\xE3o #${opcaoId} selecionada para cota\xE7\xE3o #${cotacaoId}`);
  return { ok: true, transportadoraId };
}
var _db;
var init_db_helpers_select = __esm({
  "server/db/db-helpers-select.ts"() {
    "use strict";
    init_db_connection();
    init_schema();
    init_env();
    _db = null;
  }
});

// server/integrations/mubisys-client.ts
async function mubisysGetOrNull(path, params, opts) {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  const publicKey = ENV.MUBISYS_PUBLIC_KEY;
  if (!token || !publicKey) {
    throw new MubiSysError(
      "Credenciais MubiSys n\xE3o configuradas (MUBISYS_ACCESS_TOKEN e MUBISYS_PUBLIC_KEY)",
      0
    );
  }
  const url = new URL(`${BASE_URL}/${publicKey}/${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  let response;
  try {
    response = await fetch(url.toString(), {
      headers: { "Access-Token": token, Accept: "application/json" },
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUT_PADRAO_MS)
    });
  } catch (erro) {
    throw new MubiSysError(`MubiSys inacess\xEDvel (${erro?.name ?? "erro"}): ${path}`, 0);
  }
  if (response.status === 404) return null;
  if (response.status < 200 || response.status >= 300) {
    const body = await response.text().catch(() => "");
    throw new MubiSysError(
      `MubiSys API error ${response.status}: ${body.slice(0, 200)}`,
      response.status
    );
  }
  return await response.json();
}
async function listarTudo(path, params, opts) {
  const maxPaginas = opts?.maxPaginas ?? 50;
  const perPage = opts?.perPage ?? 500;
  const itens = [];
  let pagina = 1;
  while (pagina <= maxPaginas) {
    const resp = await mubisysGetOrNull(
      path,
      { ...params, page: String(pagina), per_page: String(perPage) },
      opts
    );
    if (!resp) return { itens, completo: true };
    itens.push(...resp.data);
    const ultima = resp.pagination?.last_page ?? 1;
    if (pagina >= ultima || resp.data.length === 0) return { itens, completo: true };
    pagina++;
  }
  return { itens, completo: false };
}
async function listarOSMubiSys(opts) {
  return listarTudo(
    "ordem-servico",
    {
      status: opts.status ?? "TODOS",
      filtrodata: opts.filtrodata ?? "CADASTRO",
      datainicial: opts.datainicial,
      datafinal: opts.datafinal
    },
    { timeoutMs: TIMEOUT_LISTA_MS }
  );
}
async function buscarOSPorNumero(numero) {
  return mubisysGetOrNull(
    `ordem-servico/numero/${encodeURIComponent(numero)}`,
    void 0,
    { timeoutMs: TIMEOUT_PONTUAL_MS }
  );
}
async function listarOrcamentosMubiSys(opts) {
  return listarTudo(
    "orcamento",
    {
      status: opts.status ?? "TODOS",
      filtrodata: "CADASTRO",
      datainicial: opts.datainicial,
      datafinal: opts.datafinal
    },
    // per_page=500 (padrão de listarTudo) estoura TIMEOUT_LISTA_MS em janelas de
    // mês cheio (~800 orçamentos) — medido em 17/08/2026. 200 reduz o payload por
    // página o bastante para caber no orçamento de tempo sem precisar de retry.
    { timeoutMs: TIMEOUT_LISTA_MS, perPage: 200 }
  );
}
async function buscarClientePorId(clienteId) {
  return mubisysGetOrNull(`cliente/${clienteId}`, void 0, {
    timeoutMs: TIMEOUT_PONTUAL_MS
  });
}
async function listarProdutos() {
  const { itens } = await listarTudo("produto", {}, { timeoutMs: TIMEOUT_PONTUAL_MS });
  return itens;
}
function decodificarExpToken() {
  const token = ENV.MUBISYS_ACCESS_TOKEN;
  if (!token) return void 0;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
    return typeof payload?.exp === "number" ? payload.exp : void 0;
  } catch {
    return void 0;
  }
}
function expDoToken() {
  const exp = decodificarExpToken();
  return exp ? new Date(exp * 1e3).toISOString() : void 0;
}
function avisarSeTokenVencido() {
  const exp = decodificarExpToken();
  if (exp && exp * 1e3 < Date.now()) {
    console.warn(
      `\u26A0\uFE0F [MubiSys] Token com exp vencido em ${new Date(exp * 1e3).toISOString()}. A API ainda aceita, mas isso pode mudar sem aviso \u2014 renove no painel do ERP.`
    );
  }
}
async function verificarConexaoMubiSys() {
  const inicio = Date.now();
  try {
    await buscarClientePorId(1);
    return { ok: true, latenciaMs: Date.now() - inicio, tokenExpiradoEm: expDoToken() };
  } catch (erro) {
    return { ok: false, latenciaMs: Date.now() - inicio, erro: erro?.message, tokenExpiradoEm: expDoToken() };
  }
}
var BASE_URL, MubiSysError, TIMEOUT_PADRAO_MS, TIMEOUT_PONTUAL_MS, TIMEOUT_LISTA_MS;
var init_mubisys_client = __esm({
  "server/integrations/mubisys-client.ts"() {
    "use strict";
    init_env();
    BASE_URL = "https://api.mubisys.com/api";
    MubiSysError = class extends Error {
      constructor(message, status) {
        super(message);
        this.status = status;
        this.name = "MubiSysError";
      }
    };
    TIMEOUT_PADRAO_MS = 3e4;
    TIMEOUT_PONTUAL_MS = 1e4;
    TIMEOUT_LISTA_MS = 45e3;
    avisarSeTokenVencido();
  }
});

// server/utils/date-utils.ts
function normalizarData(valor) {
  if (!valor) return null;
  const texto = String(valor).trim();
  if (!texto) return null;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  return null;
}
var init_date_utils = __esm({
  "server/utils/date-utils.ts"() {
    "use strict";
  }
});

// server/integrations/mubisys-frete.ts
var mubisys_frete_exports = {};
__export(mubisys_frete_exports, {
  buscarDadosOSParaFrete: () => buscarDadosOSParaFrete,
  obterCotacoesFreteSimuladas: () => obterCotacoesFreteSimuladas
});
function formatarDataOS(valor) {
  if (!valor) return "";
  if (valor instanceof Date) {
    const dia2 = String(valor.getUTCDate()).padStart(2, "0");
    const mes2 = String(valor.getUTCMonth() + 1).padStart(2, "0");
    const ano2 = valor.getUTCFullYear();
    return `${dia2}/${mes2}/${ano2}`;
  }
  const texto = String(valor).trim();
  if (!texto) return "";
  if (/^\d{2}\/\d{2}\/\d{4}/.test(texto)) return texto.replace(/\s+(\d{2}:\d{2})/, " \xE0s $1");
  const temHora = /\d{2}:\d{2}/.test(texto);
  const iso = texto.replace(" ", "T");
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return texto;
  const dia = String(temHora ? data.getDate() : data.getUTCDate()).padStart(2, "0");
  const mes = String((temHora ? data.getMonth() : data.getUTCMonth()) + 1).padStart(2, "0");
  const ano = temHora ? data.getFullYear() : data.getUTCFullYear();
  if (!temHora) return `${dia}/${mes}/${ano}`;
  const hora = String(data.getHours()).padStart(2, "0");
  const minuto = String(data.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} \xE0s ${hora}:${minuto}`;
}
async function buscarDadosOSParaFrete(osNumero) {
  try {
    console.log("\u{1F50D} [Frete-Cache] Buscando OS", osNumero, "no cache local...");
    const sql10 = 'SELECT * FROM erp_os_cache WHERE "numeroOs" = ?';
    const result = await selectQuery(sql10, [osNumero]);
    const osCache = result[0];
    const cacheCompleto = !!(osCache && osCache.numeroOs && String(osCache.dataAprovacao ?? "").trim() && String(osCache.vendedor ?? "").trim());
    if (osCache && osCache.numeroOs && cacheCompleto) {
      console.log("\u2705 [Frete-Cache] OS", osNumero, "encontrada no cache local!");
      console.log("\u{1F4CA} [Frete-Cache] Dados do cache:", osCache);
      return {
        osNumero: osCache.numeroOs,
        clienteNome: osCache.razaoSocial || osCache.municipio || "",
        clienteCnpj: osCache.cnpj || "",
        municipio: osCache.municipio || "",
        estado: osCache.estado || "",
        cep: osCache.cep || "",
        endereco: osCache.endereco || "",
        peso_kg: void 0,
        valor_nf: osCache.valorTotal ? Number(osCache.valorTotal) : 0,
        aprovacao: formatarDataOS(osCache.dataAprovacao),
        entrega: formatarDataOS(osCache.dataEntregaPrevista),
        // ⚠️ A coluna real é `vendedor` (validado com DESCRIBE erp_os_cache)
        vendedor: osCache.vendedor || ""
      };
    }
    console.log(
      osCache ? `\u26A0\uFE0F [Frete-Cache] OS ${osNumero} est\xE1 no cache mas sem aprova\xE7\xE3o/vendedor. Rebuscando na API...` : `\u26A0\uFE0F [Frete-Cache] OS ${osNumero} n\xE3o encontrada no cache. Buscando na API MubiSys...`
    );
    const os = await buscarOSPorNumero(osNumero);
    if (!os) {
      console.warn("[Frete-Cache] API MubiSys retornou null para OS", osNumero);
      return null;
    }
    console.log("\u{1F50D} [Frete-API] Resposta bruta do MubiSys:", JSON.stringify(os, null, 2));
    console.log("\u2705 [Frete-API] OS", osNumero, "encontrada na API (n\xE3o estava no cache)");
    const endereco = os.cliente_endereco?.[0];
    if (!endereco) {
      console.warn("[Frete-API] Endere\xE7o n\xE3o encontrado para OS", osNumero);
      return null;
    }
    const dataAprovacaoRaw = os.data_aprovacao ?? "";
    const dataEntregaRaw = os.data_entrega ?? "";
    const resultado = {
      osNumero: String(os.sequencial_ordem || os.numero || os.id || osNumero),
      clienteNome: os.cliente || os.nomeCliente || os.razaoSocial || os.nomeEmpresa || "",
      clienteCnpj: os.cliente_cnpj_cpf || "",
      municipio: endereco.cidade || endereco.municipio || endereco.localidade || "",
      estado: endereco.estado || endereco.uf || "",
      cep: endereco.cep || "",
      endereco: `${endereco.logradouro || ""}, ${endereco.numero || ""}, ${endereco.bairro || ""}`,
      peso_kg: void 0,
      // Será preenchido pelo usuário
      valor_nf: os.valor_total || 0,
      // Dados próprios de cada OS
      aprovacao: formatarDataOS(dataAprovacaoRaw),
      entrega: formatarDataOS(dataEntregaRaw),
      vendedor: os.vendedor || os.atendente || "",
      email: os.cliente_contato?.[0]?.email ?? ""
    };
    console.log("\u2705 [Frete-API] Retornando dados da OS:", resultado);
    await gravarNoCache(resultado, { aprovacaoRaw: dataAprovacaoRaw, entregaRaw: dataEntregaRaw });
    return resultado;
  } catch (error) {
    console.error("[Frete-Cache] Erro ao buscar OS:", error);
    console.error("[Frete-Cache] Retornando null - OS n\xE3o encontrada em cache nem na API");
    return null;
  }
}
async function gravarNoCache(dados, raw) {
  try {
    const { mutationQuery: mutationQuery2 } = await Promise.resolve().then(() => (init_db_connection(), db_connection_exports));
    const dataEntregaPrevista = normalizarData(raw.entregaRaw);
    const existente = await selectQuery(`SELECT id FROM erp_os_cache WHERE "numeroOs" = ?`, [dados.osNumero]);
    if (existente && existente.length > 0) {
      await mutationQuery2(
        `UPDATE erp_os_cache SET
           "razaoSocial" = ?, cnpj = ?, email = ?, cep = ?, municipio = ?, estado = ?, endereco = ?,
           "dataAprovacao" = ?, "dataEntregaPrevista" = ?, "valorTotal" = ?, vendedor = ?,
           "dataUltimaAtualizacao" = NOW(), "sincronizadoEm" = NOW()
         WHERE "numeroOs" = ?`,
        [
          dados.clienteNome,
          dados.clienteCnpj,
          dados.email || null,
          dados.cep,
          dados.municipio,
          dados.estado,
          dados.endereco,
          raw.aprovacaoRaw || null,
          dataEntregaPrevista,
          dados.valor_nf ?? null,
          dados.vendedor || "",
          dados.osNumero
        ]
      );
    } else {
      await mutationQuery2(
        `INSERT INTO erp_os_cache
           ("numeroOs", "razaoSocial", cnpj, email, cep, municipio, estado, endereco,
            "dataAprovacao", "dataEntregaPrevista", "valorTotal", vendedor, status,
            "dataUltimaAtualizacao", "sincronizadoEm", "criadoEm")
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', NOW(), NOW(), NOW())`,
        [
          dados.osNumero,
          dados.clienteNome,
          dados.clienteCnpj,
          dados.email || null,
          dados.cep,
          dados.municipio,
          dados.estado,
          dados.endereco,
          raw.aprovacaoRaw || null,
          dataEntregaPrevista,
          dados.valor_nf ?? null,
          dados.vendedor || ""
        ]
      );
    }
    console.log("\u{1F4BE} [Frete-Cache] OS", dados.osNumero, "gravada no cache local");
  } catch (erro) {
    console.error("[Frete-Cache] Falha ao gravar no cache:", erro?.message);
  }
}
async function obterCotacoesFreteSimuladas(municipio, estado, peso_kg, valor_nf) {
  const transportadoras2 = ["Sedex", "PAC", "Loggi", "Transportadora Local"];
  return transportadoras2.map((t2) => ({
    transportadora: t2,
    preco: Math.round((peso_kg * 2.5 + valor_nf * 0.01) * 100) / 100,
    prazo_dias: t2 === "Sedex" ? 2 : t2 === "PAC" ? 5 : 3,
    tipo_prazo: "corridos"
  }));
}
var init_mubisys_frete = __esm({
  "server/integrations/mubisys-frete.ts"() {
    "use strict";
    init_mubisys_client();
    init_db_connection();
    init_date_utils();
  }
});

// server/utils/transportadoras-completude.ts
var transportadoras_completude_exports = {};
__export(transportadoras_completude_exports, {
  CAMPOS_COMPLETUDE: () => CAMPOS_COMPLETUDE,
  atualizarCampoEmLote: () => atualizarCampoEmLote,
  atualizarCampoTransportadora: () => atualizarCampoTransportadora,
  definirStatusTransportadora: () => definirStatusTransportadora,
  listarPendentesPorCampo: () => listarPendentesPorCampo,
  panoramaCadastro: () => panoramaCadastro,
  resumoCompletude: () => resumoCompletude
});
function expressaoVazio(campo) {
  return `("${campo}" IS NULL OR TRIM(CAST("${campo}" AS TEXT)) = '')`;
}
function whereBase(opts) {
  const filtros = [];
  const params = [];
  const status = opts.status ?? "todas";
  if (status === "ativas") filtros.push(`ativa = 'sim'`);
  else if (status === "inativas") filtros.push(`(ativa = 'nao' OR ativa IS NULL)`);
  const origem = opts.origem ?? "todas";
  if (origem !== "todas") {
    filtros.push("origem = ?");
    params.push(origem);
  }
  if (opts.busca && opts.busca.trim()) {
    filtros.push("nome LIKE ?");
    params.push(`%${opts.busca.trim()}%`);
  }
  return { clausula: filtros.length ? `WHERE ${filtros.join(" AND ")}` : "", filtros, params };
}
async function panoramaCadastro() {
  const rows = await selectQuery(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN ativa = 'sim' THEN 1 ELSE 0 END) AS ativas,
       SUM(CASE WHEN ativa = 'sim' THEN 0 ELSE 1 END) AS inativas,
       SUM(CASE WHEN origem = 'Frenet' THEN 1 ELSE 0 END) AS frenet,
       SUM(CASE WHEN origem <> 'Frenet' OR origem IS NULL THEN 1 ELSE 0 END) AS manual,
       SUM(CASE WHEN "coberturaTotal" = 1 THEN 1 ELSE 0 END) AS nacionais
     FROM transportadoras`,
    []
  );
  const l = rows?.[0] ?? {};
  return {
    total: Number(l.total ?? 0),
    ativas: Number(l.ativas ?? 0),
    inativas: Number(l.inativas ?? 0),
    frenet: Number(l.frenet ?? 0),
    manual: Number(l.manual ?? 0),
    nacionais: Number(l.nacionais ?? 0)
  };
}
async function resumoCompletude(opts = {}) {
  const base = whereBase(opts);
  const selects = CAMPOS_COMPLETUDE.map((c) => `SUM(CASE WHEN ${expressaoVazio(c.campo)} THEN 1 ELSE 0 END) AS "${c.campo}"`).join(", ");
  const rows = await selectQuery(
    `SELECT COUNT(*) AS total, ${selects} FROM transportadoras ${base.clausula}`,
    base.params
  );
  const linha = rows?.[0] ?? {};
  const total = Number(linha.total ?? 0);
  const grupos = CAMPOS_COMPLETUDE.map((c) => {
    const faltando = Number(linha[c.campo] ?? 0);
    return {
      campo: c.campo,
      titulo: c.titulo,
      prioridade: c.prioridade,
      tipo: c.tipo,
      faltando,
      preenchidos: total - faltando,
      percentualPreenchido: total === 0 ? 100 : Math.round((total - faltando) / total * 100)
    };
  }).sort((a, b) => a.prioridade - b.prioridade || b.faltando - a.faltando);
  const celulasTotais = total * CAMPOS_COMPLETUDE.length;
  const celulasFaltando = grupos.reduce((soma, g) => soma + g.faltando, 0);
  const percentualGeral = celulasTotais === 0 ? 100 : Math.round((celulasTotais - celulasFaltando) / celulasTotais * 100);
  const criticos = CAMPOS_COMPLETUDE.filter((c) => c.prioridade === 1).map((c) => expressaoVazio(c.campo));
  const todos = CAMPOS_COMPLETUDE.map((c) => expressaoVazio(c.campo));
  const contagens = await selectQuery(
    `SELECT
       SUM(CASE WHEN ${todos.join(" OR ")} THEN 0 ELSE 1 END) AS completos,
       SUM(CASE WHEN ${criticos.join(" OR ")} THEN 1 ELSE 0 END) AS "comCriticoVazio"
     FROM transportadoras ${base.clausula}`,
    base.params
  );
  return {
    total,
    percentualGeral,
    completos: Number(contagens?.[0]?.completos ?? 0),
    comCriticoVazio: Number(contagens?.[0]?.comCriticoVazio ?? 0),
    grupos
  };
}
async function listarPendentesPorCampo(campo, busca, page = 1, pageSize = 20, opts = {}) {
  const modo = opts.modo ?? "vazios";
  const campoReal = campo && campo.trim() ? campo : null;
  if (campoReal && modo !== "todos" && !NOMES_CAMPOS.includes(campoReal)) {
    throw new Error(`Campo n\xE3o monitorado: ${campoReal}`);
  }
  const safePageSize = Math.max(1, Math.min(Number(pageSize) || 20, 100));
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safePageSize;
  const base = whereBase({ status: opts.status, origem: opts.origem, busca });
  const filtros = [...base.filtros];
  const params = [...base.params];
  if (campoReal) {
    if (modo === "vazios") filtros.push(expressaoVazio(campoReal));
    else if (modo === "preenchidos") filtros.push(`NOT ${expressaoVazio(campoReal)}`);
  }
  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";
  const rows = await selectQuery(
    `SELECT id, nome, site, endereco, "nomeContato", "telefoneContato", "whatsappContato",
            "nomeContatoNegocial", "emailContatoNegocial", "formaCotacao", modais, "pesoMaxKg",
            referencia, "horarioLimiteColeta", "coberturaTotal",
            bairro, cep, cidade, uf, cnpj, ativa, origem
     FROM transportadoras ${where}
     ORDER BY nome
     LIMIT ${safePageSize} OFFSET ${offset}`,
    params
  );
  const countRows = await selectQuery(
    `SELECT COUNT(*) AS total FROM transportadoras ${where}`,
    params
  );
  const total = Number(countRows?.[0]?.total ?? 0);
  const enriquecidos = rows.map((t2) => {
    const faltantes = CAMPOS_COMPLETUDE.filter((c) => {
      const v = t2[c.campo];
      return v === null || v === void 0 || String(v).trim() === "";
    });
    const preenchidos = CAMPOS_COMPLETUDE.length - faltantes.length;
    return {
      ...t2,
      completudePercentual: Math.round(preenchidos / CAMPOS_COMPLETUDE.length * 100),
      camposFaltantes: faltantes.map((c) => ({ campo: c.campo, titulo: c.titulo, prioridade: c.prioridade }))
    };
  });
  return {
    data: enriquecidos,
    pagination: {
      page: safePage,
      pageSize: safePageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePageSize))
    }
  };
}
async function atualizarCampoTransportadora(id, campo, valor) {
  if (!NOMES_CAMPOS.includes(campo)) {
    throw new Error(`Campo n\xE3o edit\xE1vel nesta tela: ${campo}`);
  }
  const valorFinal = valor === null || valor.trim() === "" ? null : valor.trim();
  const res = await mutationQuery(
    `UPDATE transportadoras SET "${campo}" = ?, "updatedAt" = NOW() WHERE id = ?`,
    [valorFinal, id]
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}
async function definirStatusTransportadora(id, ativa) {
  const res = await mutationQuery(
    `UPDATE transportadoras SET ativa = ?, "updatedAt" = NOW() WHERE id = ?`,
    [ativa ? "sim" : "nao", id]
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}
async function atualizarCampoEmLote(ids, campo, valor) {
  if (!NOMES_CAMPOS.includes(campo)) {
    throw new Error(`Campo n\xE3o edit\xE1vel nesta tela: ${campo}`);
  }
  const alvos = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (alvos.length === 0) return { ok: true, afetados: 0 };
  const valorFinal = valor === null || valor.trim() === "" ? null : valor.trim();
  const placeholders = alvos.map(() => "?").join(", ");
  const res = await mutationQuery(
    `UPDATE transportadoras SET "${campo}" = ?, "updatedAt" = NOW() WHERE id IN (${placeholders})`,
    [valorFinal, ...alvos]
  );
  return { ok: true, afetados: Number(res?.affectedRows ?? 0) };
}
var CAMPOS_COMPLETUDE, NOMES_CAMPOS;
var init_transportadoras_completude = __esm({
  "server/utils/transportadoras-completude.ts"() {
    "use strict";
    init_db_connection();
    CAMPOS_COMPLETUDE = [
      { campo: "nomeContato", titulo: "Nome do contato de cota\xE7\xE3o", prioridade: 1, tipo: "texto" },
      { campo: "whatsappContato", titulo: "WhatsApp de cota\xE7\xE3o", prioridade: 1, tipo: "telefone" },
      { campo: "telefoneContato", titulo: "Telefone de cota\xE7\xE3o", prioridade: 1, tipo: "telefone" },
      { campo: "formaCotacao", titulo: "Forma de cota\xE7\xE3o", prioridade: 1, tipo: "enum-forma" },
      { campo: "site", titulo: "Site", prioridade: 2, tipo: "url" },
      { campo: "endereco", titulo: "Endere\xE7o", prioridade: 2, tipo: "texto-longo" },
      { campo: "bairro", titulo: "Bairro", prioridade: 2, tipo: "texto" },
      { campo: "cep", titulo: "CEP", prioridade: 2, tipo: "texto" },
      { campo: "cidade", titulo: "Cidade da sede", prioridade: 2, tipo: "texto" },
      { campo: "uf", titulo: "UF da sede", prioridade: 2, tipo: "texto" },
      { campo: "cnpj", titulo: "CNPJ", prioridade: 2, tipo: "texto" },
      { campo: "modais", titulo: "Modais atendidos", prioridade: 2, tipo: "texto" },
      { campo: "pesoMaxKg", titulo: "Peso m\xE1ximo (kg)", prioridade: 2, tipo: "numero" },
      { campo: "emailContatoNegocial", titulo: "E-mail comercial", prioridade: 3, tipo: "email" },
      { campo: "nomeContatoNegocial", titulo: "Contato comercial", prioridade: 3, tipo: "texto" },
      { campo: "referencia", titulo: "Ponto de refer\xEAncia", prioridade: 3, tipo: "texto" },
      { campo: "horarioLimiteColeta", titulo: "Hor\xE1rio limite de coleta", prioridade: 3, tipo: "texto" }
    ];
    NOMES_CAMPOS = CAMPOS_COMPLETUDE.map((c) => c.campo);
  }
});

// server/_core/llm.ts
var llm_exports = {};
__export(llm_exports, {
  buildFileContent: () => buildFileContent,
  buildImageContent: () => buildImageContent,
  invokeLLM: () => invokeLLM
});
async function uploadFileToOpenAI(buffer, filename) {
  assertApiKey();
  const form = new FormData();
  form.append("purpose", "user_data");
  form.append("file", new Blob([new Uint8Array(buffer)]), filename);
  const response = await fetch(OPENAI_FILES_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${ENV.openaiApiKey}` },
    body: form
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI file upload failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  const data = await response.json();
  return data.id;
}
async function buildFileContent(base64, mimeType, filename) {
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength > MAX_INLINE_FILE_BYTES) {
    const file_id = await uploadFileToOpenAI(buffer, filename);
    return { type: "file", file: { file_id } };
  }
  return {
    type: "file",
    file: { filename, file_data: `data:${mimeType};base64,${base64}` }
  };
}
function buildImageContent(base64, mimeType) {
  return { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } };
}
async function invokeLLM(params) {
  assertApiKey();
  const {
    messages,
    tools,
    toolChoice,
    tool_choice,
    outputSchema,
    output_schema,
    responseFormat,
    response_format
  } = params;
  const payload = {
    model: params.model ?? "gpt-5-mini",
    messages: messages.map(normalizeMessage)
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
  }
  const normalizedToolChoice = normalizeToolChoice(
    toolChoice || tool_choice,
    tools
  );
  if (normalizedToolChoice) {
    payload.tool_choice = normalizedToolChoice;
  }
  const normalizedResponseFormat = normalizeResponseFormat({
    responseFormat,
    response_format,
    outputSchema,
    output_schema
  });
  if (normalizedResponseFormat) {
    payload.response_format = normalizedResponseFormat;
  }
  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${ENV.openaiApiKey}`
    },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `LLM invoke failed: ${response.status} ${response.statusText} \u2013 ${errorText}`
    );
  }
  return await response.json();
}
var ensureArray, normalizeContentPart, normalizeMessage, normalizeToolChoice, OPENAI_API_URL, OPENAI_FILES_URL, assertApiKey, MAX_INLINE_FILE_BYTES, normalizeResponseFormat;
var init_llm = __esm({
  "server/_core/llm.ts"() {
    "use strict";
    init_env();
    ensureArray = (value) => Array.isArray(value) ? value : [value];
    normalizeContentPart = (part) => {
      if (typeof part === "string") {
        return { type: "text", text: part };
      }
      if (part.type === "text") {
        return part;
      }
      if (part.type === "image_url") {
        return part;
      }
      if (part.type === "file") {
        return part;
      }
      throw new Error("Unsupported message content part");
    };
    normalizeMessage = (message) => {
      const { role, name, tool_call_id } = message;
      if (role === "tool" || role === "function") {
        const content = ensureArray(message.content).map((part) => typeof part === "string" ? part : JSON.stringify(part)).join("\n");
        return {
          role,
          name,
          tool_call_id,
          content
        };
      }
      const contentParts = ensureArray(message.content).map(normalizeContentPart);
      if (contentParts.length === 1 && contentParts[0].type === "text") {
        return {
          role,
          name,
          content: contentParts[0].text
        };
      }
      return {
        role,
        name,
        content: contentParts
      };
    };
    normalizeToolChoice = (toolChoice, tools) => {
      if (!toolChoice) return void 0;
      if (toolChoice === "none" || toolChoice === "auto") {
        return toolChoice;
      }
      if (toolChoice === "required") {
        if (!tools || tools.length === 0) {
          throw new Error(
            "tool_choice 'required' was provided but no tools were configured"
          );
        }
        if (tools.length > 1) {
          throw new Error(
            "tool_choice 'required' needs a single tool or specify the tool name explicitly"
          );
        }
        return {
          type: "function",
          function: { name: tools[0].function.name }
        };
      }
      if ("name" in toolChoice) {
        return {
          type: "function",
          function: { name: toolChoice.name }
        };
      }
      return toolChoice;
    };
    OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
    OPENAI_FILES_URL = "https://api.openai.com/v1/files";
    assertApiKey = () => {
      if (!ENV.openaiApiKey) {
        throw new Error("OPENAI_API_KEY is not configured");
      }
    };
    MAX_INLINE_FILE_BYTES = 20 * 1024 * 1024;
    normalizeResponseFormat = ({
      responseFormat,
      response_format,
      outputSchema,
      output_schema
    }) => {
      const explicitFormat = responseFormat || response_format;
      if (explicitFormat) {
        if (explicitFormat.type === "json_schema" && !explicitFormat.json_schema?.schema) {
          throw new Error(
            "responseFormat json_schema requires a defined schema object"
          );
        }
        return explicitFormat;
      }
      const schema = outputSchema || output_schema;
      if (!schema) return void 0;
      if (!schema.name || !schema.schema) {
        throw new Error("outputSchema requires both name and schema");
      }
      return {
        type: "json_schema",
        json_schema: {
          name: schema.name,
          schema: schema.schema,
          ...typeof schema.strict === "boolean" ? { strict: schema.strict } : {}
        }
      };
    };
  }
});

// server/integrations/priceTableDiff.ts
function resumirDiffTabelaPrecos(anteriorRaw, novoRaw) {
  let antes;
  let novo;
  try {
    antes = JSON.parse(anteriorRaw || "{}");
    novo = JSON.parse(novoRaw || "{}");
  } catch {
    return { resumo: "conte\xFAdo alterado", qtdAlteracoes: 1 };
  }
  const linhasAntes = Array.isArray(antes.rows) ? antes.rows : [];
  const linhasNovo = Array.isArray(novo.rows) ? novo.rows : [];
  const colunas = Array.isArray(novo.columns) ? novo.columns : [];
  const offsetColuna = novo.type === "margin_table_multi" ? 1 : 0;
  const diffs = [];
  const max = Math.max(linhasAntes.length, linhasNovo.length);
  for (let i = 0; i < max; i++) {
    const a = linhasAntes[i];
    const n = linhasNovo[i];
    if (!a || !n) continue;
    const label = n.label ?? a.label ?? `linha ${i + 1}`;
    const valoresAntes = Array.isArray(a.values) ? a.values : [a.value];
    const valoresNovo = Array.isArray(n.values) ? n.values : [n.value];
    const maxCol = Math.max(valoresAntes.length, valoresNovo.length);
    for (let j = 0; j < maxCol; j++) {
      const va = valoresAntes[j];
      const vn = valoresNovo[j];
      if (va === vn || vn === void 0) continue;
      const coluna = colunas[j + offsetColuna];
      const contexto = [label, coluna].filter(Boolean).join(" / ");
      diffs.push(`${contexto || `campo ${j + 1}`}: ${va ?? "\u2014"} \u2192 ${vn}`);
    }
  }
  if (diffs.length === 0) {
    return { resumo: "estrutura da tabela alterada (sem mudan\xE7a de valor detectada)", qtdAlteracoes: 1 };
  }
  const LIMITE = 6;
  const resumo = diffs.length > LIMITE ? `${diffs.slice(0, LIMITE).join("; ")}; +${diffs.length - LIMITE} outra(s) faixa(s)` : diffs.join("; ");
  return { resumo, qtdAlteracoes: diffs.length };
}
var init_priceTableDiff = __esm({
  "server/integrations/priceTableDiff.ts"() {
    "use strict";
  }
});

// server/db/db.ts
var db_exports = {};
__export(db_exports, {
  addPriceTableSection: () => addPriceTableSection,
  canRoleAccessPage: () => canRoleAccessPage,
  createAnaliseCurriculo: () => createAnaliseCurriculo,
  createBatchRetrabalhos: () => createBatchRetrabalhos,
  createCargo: () => createCargo,
  createErrorLibraryItem: () => createErrorLibraryItem,
  createKnowledge: () => createKnowledge,
  createKnowledgeComment: () => createKnowledgeComment,
  createKnowledgeSuggestion: () => createKnowledgeSuggestion,
  createPop: () => createPop,
  createRegulation: () => createRegulation,
  createRetrabalho: () => createRetrabalho,
  createRoutine: () => createRoutine,
  createSupplier: () => createSupplier,
  deleteCargo: () => deleteCargo,
  deleteErrorLibraryItem: () => deleteErrorLibraryItem,
  deleteKnowledge: () => deleteKnowledge,
  deleteKnowledgeComment: () => deleteKnowledgeComment,
  deleteKnowledgeSuggestion: () => deleteKnowledgeSuggestion,
  deletePop: () => deletePop,
  deletePriceTableSection: () => deletePriceTableSection,
  deleteRegulation: () => deleteRegulation,
  deleteRetrabalho: () => deleteRetrabalho,
  deleteRoutine: () => deleteRoutine,
  deleteSupplier: () => deleteSupplier,
  getAllRolePermissions: () => getAllRolePermissions,
  getAnaliseCurriculoById: () => getAnaliseCurriculoById,
  getAnaliseCurriculosByCargo: () => getAnaliseCurriculosByCargo,
  getByCategoria: () => getByCategoria,
  getByCodigoErro: () => getByCodigoErro,
  getByResponsavel: () => getByResponsavel,
  getBySetor: () => getBySetor,
  getCargoById: () => getCargoById,
  getDb: () => getDb3,
  getDistinctValues: () => getDistinctValues,
  getErrorByCode: () => getErrorByCode,
  getErrorLibrary: () => getErrorLibrary,
  getEvolucaoMensal: () => getEvolucaoMensal,
  getFaturamento: () => getFaturamento,
  getFinanceiroByMesAno: () => getFinanceiroByMesAno,
  getFinanceiros: () => getFinanceiros,
  getKnowledgeById: () => getKnowledgeById,
  getKpis: () => getKpis,
  getPermissionsForRole: () => getPermissionsForRole,
  getPopById: () => getPopById,
  getPriceTableMeta: () => getPriceTableMeta,
  getRegulationById: () => getRegulationById,
  getReincidencia: () => getReincidencia,
  getRetrabalhosAll: () => getRetrabalhosAll,
  getRetrabalhosById: () => getRetrabalhosById,
  getRolePermissions: () => getRolePermissions,
  getSupplierById: () => getSupplierById,
  incrementPriceTableVersion: () => incrementPriceTableVersion,
  insertAuditLog: () => insertAuditLog,
  listArquivosBibliotecaComConteudo: () => listArquivosBibliotecaComConteudo,
  listAuditLogs: () => listAuditLogs,
  listCargos: () => listCargos,
  listKnowledge: () => listKnowledge,
  listKnowledgeComments: () => listKnowledgeComments,
  listKnowledgeSuggestions: () => listKnowledgeSuggestions,
  listPendingRoutines: () => listPendingRoutines,
  listPops: () => listPops,
  listPriceTableHistory: () => listPriceTableHistory,
  listPriceTableSections: () => listPriceTableSections,
  listRegulations: () => listRegulations,
  listRetrabalhos: () => listRetrabalhos,
  listRoutines: () => listRoutines,
  listSuppliers: () => listSuppliers,
  markRoutineDone: () => markRoutineDone,
  setRolePermission: () => setRolePermission,
  updateAnaliseCurriculo: () => updateAnaliseCurriculo,
  updateCargo: () => updateCargo,
  updateErrorCorrection: () => updateErrorCorrection,
  updateErrorItem: () => updateErrorItem,
  updateKnowledge: () => updateKnowledge,
  updateKnowledgeSuggestion: () => updateKnowledgeSuggestion,
  updatePop: () => updatePop,
  updatePriceTableSection: () => updatePriceTableSection,
  updateRegulation: () => updateRegulation,
  updateRetrabalho: () => updateRetrabalho,
  updateRoutine: () => updateRoutine,
  updateSupplier: () => updateSupplier,
  upsertFaturamento: () => upsertFaturamento,
  upsertFinanceiro: () => upsertFinanceiro
});
import { and as and3, asc, count as count2, desc as desc3, eq as eq3, gte, like as like2, lte, or, sql as sql2 } from "drizzle-orm";
import { drizzle as drizzle4 } from "drizzle-orm/neon-serverless";
async function getDb3() {
  if (!_db3 && process.env.DATABASE_URL) {
    try {
      _db3 = drizzle4(getPool());
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db3 = null;
    }
  }
  return _db3;
}
async function getErrorLibrary() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(errorLibrary).orderBy(asc(errorLibrary.category), asc(errorLibrary.code));
}
async function getErrorByCode(code) {
  const db5 = await getDb3();
  if (!db5) return null;
  const result = await db5.select().from(errorLibrary).where(eq3(errorLibrary.code, code)).limit(1);
  return result[0] ?? null;
}
function buildWhereConditions(filter) {
  const conditions = [];
  if (filter.tipoRegistro) conditions.push(eq3(retrabalhos.tipoRegistro, filter.tipoRegistro));
  if (filter.mes) conditions.push(eq3(retrabalhos.mes, filter.mes));
  if (filter.setor) conditions.push(eq3(retrabalhos.setor, filter.setor));
  if (filter.tipo) conditions.push(eq3(retrabalhos.tipo, filter.tipo));
  if (filter.responsavel) conditions.push(like2(retrabalhos.responsavel, `%${filter.responsavel}%`));
  if (filter.classe) conditions.push(eq3(retrabalhos.classe, filter.classe));
  if (filter.dataInicio) conditions.push(gte(retrabalhos.data, filter.dataInicio));
  if (filter.dataFim) conditions.push(lte(retrabalhos.data, filter.dataFim));
  if (filter.search) {
    conditions.push(
      or(
        like2(retrabalhos.osRetrabalhada, `%${filter.search}%`),
        like2(retrabalhos.osOriginal, `%${filter.search}%`),
        like2(retrabalhos.descricao, `%${filter.search}%`),
        like2(retrabalhos.responsavel, `%${filter.search}%`)
      )
    );
  }
  return conditions;
}
async function listRetrabalhos(filter = {}, page = 1, pageSize = 50) {
  const db5 = await getDb3();
  if (!db5) return { data: [], total: 0 };
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  const [data, totalResult] = await Promise.all([
    db5.select().from(retrabalhos).where(whereClause).orderBy(desc3(retrabalhos.data)).limit(pageSize).offset((page - 1) * pageSize),
    db5.select({ count: count2() }).from(retrabalhos).where(whereClause)
  ]);
  return { data, total: totalResult[0]?.count ?? 0 };
}
async function getRetrabalhosAll(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select().from(retrabalhos).where(whereClause).orderBy(desc3(retrabalhos.data));
}
async function createRetrabalho(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const normalized = { ...data, horasImpacto: data.horasImpacto != null ? String(data.horasImpacto) : null };
  const result = await db5.insert(retrabalhos).values(normalized);
  return result;
}
async function createBatchRetrabalhos(baseData, errorIds) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const results = [];
  for (const errorId of errorIds) {
    const error = await db5.select().from(errorLibrary).where(eq3(errorLibrary.id, errorId)).limit(1);
    if (!error.length) continue;
    const normalized = {
      ...baseData,
      codigoErro: error[0].code,
      horasImpacto: baseData.horasImpacto != null ? String(baseData.horasImpacto) : null
    };
    const result = await db5.insert(retrabalhos).values(normalized);
    results.push(result);
  }
  return results;
}
async function updateRetrabalho(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const normalized = { ...data, horasImpacto: data.horasImpacto != null ? String(data.horasImpacto) : data.horasImpacto };
  return db5.update(retrabalhos).set(normalized).where(eq3(retrabalhos.id, id));
}
async function deleteRetrabalho(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(retrabalhos).where(eq3(retrabalhos.id, id));
}
async function getRetrabalhosById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const result = await db5.select().from(retrabalhos).where(eq3(retrabalhos.id, id)).limit(1);
  return result[0] ?? null;
}
async function getKpis(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return null;
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  const [totals, evitavelCount, inevitavelCount, retrabalhoCount, cnqCount] = await Promise.all([
    db5.select({
      total: count2(),
      custoTotal: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
      custoMedio: sql2`COALESCE(AVG(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
      freteTotal: sql2`COALESCE(SUM(CAST(${retrabalhos.frete} AS DECIMAL(10,2))), 0)`,
      horasTotal: sql2`COALESCE(SUM(CAST(${retrabalhos.horasImpacto} AS DECIMAL(6,2))), 0)`
    }).from(retrabalhos).where(whereClause),
    db5.select({ count: count2() }).from(retrabalhos).where(and3(whereClause, eq3(retrabalhos.classe, "EVIT\xC1VEL"))),
    db5.select({ count: count2() }).from(retrabalhos).where(and3(whereClause, eq3(retrabalhos.classe, "INEVIT\xC1VEL"))),
    db5.select({ count: count2() }).from(retrabalhos).where(and3(whereClause, eq3(retrabalhos.tipoRegistro, "retrabalho"))),
    db5.select({ count: count2() }).from(retrabalhos).where(and3(whereClause, eq3(retrabalhos.tipoRegistro, "cnq")))
  ]);
  const totalCount = totals[0]?.total ?? 0;
  const evCount = evitavelCount[0]?.count ?? 0;
  const inevCount = inevitavelCount[0]?.count ?? 0;
  const totalRetrabalhos = retrabalhoCount[0]?.count ?? 0;
  const totalCnq = cnqCount[0]?.count ?? 0;
  return {
    total: totalCount,
    totalRetrabalhos,
    totalCnq,
    custoTotal: Number(totals[0]?.custoTotal ?? 0),
    custoMedio: Number(totals[0]?.custoMedio ?? 0),
    freteTotal: Number(totals[0]?.freteTotal ?? 0),
    horasTotal: Number(totals[0]?.horasTotal ?? 0),
    evitavel: evCount,
    inevitavel: inevCount,
    pctEvitavel: totalCount > 0 ? Math.round(evCount / totalCount * 100) : 0,
    pctInevitavel: totalCount > 0 ? Math.round(inevCount / totalCount * 100) : 0
  };
}
async function getBySetor(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select({
    setor: retrabalhos.setor,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.setor).orderBy(desc3(count2()));
}
async function getByCategoria(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select({
    categoria: errorLibrary.category,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`
  }).from(retrabalhos).leftJoin(errorLibrary, eq3(retrabalhos.codigoErro, errorLibrary.code)).where(whereClause).groupBy(errorLibrary.category).orderBy(desc3(count2()));
}
async function getByCodigoErro(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select({
    codigoErro: retrabalhos.codigoErro,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.codigoErro).orderBy(desc3(count2())).limit(15);
}
async function getByResponsavel(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select({
    responsavel: retrabalhos.responsavel,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.responsavel).orderBy(desc3(count2())).limit(10);
}
async function getEvolucaoMensal(tipoRegistro) {
  const db5 = await getDb3();
  if (!db5) return [];
  const whereClause = tipoRegistro ? eq3(retrabalhos.tipoRegistro, tipoRegistro) : void 0;
  const rows = await db5.select({
    mes: retrabalhos.mes,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
    evitavel: sql2`SUM(CASE WHEN ${retrabalhos.classe} = 'EVITÁVEL' THEN 1 ELSE 0 END)`,
    inevitavel: sql2`SUM(CASE WHEN ${retrabalhos.classe} = 'INEVITÁVEL' THEN 1 ELSE 0 END)`
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.mes).orderBy(
    sql2`CASE ${retrabalhos.mes}
      WHEN 'JANEIRO' THEN 1 WHEN 'FEVEREIRO' THEN 2 WHEN 'MARÇO' THEN 3 WHEN 'ABRIL' THEN 4
      WHEN 'MAIO' THEN 5 WHEN 'JUNHO' THEN 6 WHEN 'JULHO' THEN 7 WHEN 'AGOSTO' THEN 8
      WHEN 'SETEMBRO' THEN 9 WHEN 'OUTUBRO' THEN 10 WHEN 'NOVEMBRO' THEN 11 WHEN 'DEZEMBRO' THEN 12
      ELSE 13 END`
  );
  const MESES_ORDEM = ["JANEIRO", "FEVEREIRO", "MAR\xC7O", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
  const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const rowMap = new Map(rows.map((r) => [(r.mes ?? "").toUpperCase(), r]));
  const mesAtual = (/* @__PURE__ */ new Date()).getMonth();
  return MESES_ORDEM.slice(0, mesAtual + 1).map((mesNome, i) => {
    const row = rowMap.get(mesNome);
    return {
      mes: MESES_ABREV[i],
      // abreviado para gráficos
      mesCompleto: mesNome,
      // nome completo em maiúsculas para cruzar com tabela faturamento
      count: row ? Number(row.count) : 0,
      custo: row ? Number(row.custo) : 0,
      evitavel: row ? Number(row.evitavel) : 0,
      inevitavel: row ? Number(row.inevitavel) : 0
    };
  });
}
async function getReincidencia(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = buildWhereConditions(filter);
  const whereClause = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select({
    codigoErro: retrabalhos.codigoErro,
    setor: retrabalhos.setor,
    count: count2(),
    custo: sql2`COALESCE(SUM(CAST(${retrabalhos.total} AS DECIMAL(10,2))), 0)`,
    responsaveis: sql2`STRING_AGG(DISTINCT ${retrabalhos.responsavel}, ', ')`
  }).from(retrabalhos).where(whereClause).groupBy(retrabalhos.codigoErro, retrabalhos.setor).having(sql2`COUNT(*) >= 2`).orderBy(desc3(count2()));
}
async function getDistinctValues() {
  const db5 = await getDb3();
  if (!db5) return { setores: [], responsaveis: [], meses: [] };
  const [setores, responsaveis, meses] = await Promise.all([
    db5.selectDistinct({ setor: retrabalhos.setor }).from(retrabalhos).orderBy(asc(retrabalhos.setor)),
    db5.selectDistinct({ responsavel: retrabalhos.responsavel }).from(retrabalhos).where(sql2`${retrabalhos.responsavel} IS NOT NULL`).orderBy(asc(retrabalhos.responsavel)),
    db5.selectDistinct({ mes: retrabalhos.mes }).from(retrabalhos).where(sql2`${retrabalhos.mes} IS NOT NULL`)
  ]);
  return {
    setores: setores.map((s) => s.setor),
    responsaveis: responsaveis.map((r) => r.responsavel).filter(Boolean),
    meses: meses.map((m) => m.mes).filter(Boolean)
  };
}
async function getFaturamento() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(faturamento).orderBy(asc(faturamento.ano), asc(faturamento.id));
}
async function upsertFaturamento(mes, ano, valorFaturado, totalPedidos) {
  const db5 = await getDb3();
  if (!db5) return;
  const existing = await db5.select({ id: faturamento.id }).from(faturamento).where(and3(eq3(faturamento.mes, mes), eq3(faturamento.ano, ano))).limit(1);
  if (existing.length > 0) {
    await db5.update(faturamento).set({ valorFaturado: String(valorFaturado), totalPedidos }).where(and3(eq3(faturamento.mes, mes), eq3(faturamento.ano, ano)));
  } else {
    await db5.insert(faturamento).values({ mes, ano, valorFaturado: String(valorFaturado), totalPedidos });
  }
}
async function updateErrorCorrection(code, correction) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.update(errorLibrary).set({ correction }).where(eq3(errorLibrary.code, code));
}
async function updateErrorItem(code, data) {
  const db5 = await getDb3();
  if (!db5) return;
  const updates = {};
  if (data.description !== void 0) updates.description = data.description;
  if (data.correction !== void 0) updates.correction = data.correction;
  if (data.imageUrl !== void 0) updates.imageUrl = data.imageUrl;
  if (data.imageKey !== void 0) updates.imageKey = data.imageKey;
  if (Object.keys(updates).length > 0) {
    await db5.update(errorLibrary).set(updates).where(eq3(errorLibrary.code, code));
  }
}
async function deleteErrorLibraryItem(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  await db5.delete(errorLibrary).where(eq3(errorLibrary.id, id));
}
async function createErrorLibraryItem(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.insert(errorLibrary).values(data);
}
async function listKnowledge(search, category) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = [];
  if (category) conditions.push(eq3(knowledgeBase.category, category));
  if (search) conditions.push(or(like2(knowledgeBase.title, `%${search}%`), like2(knowledgeBase.content, `%${search}%`), like2(knowledgeBase.keywords, `%${search}%`)));
  const where = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select().from(knowledgeBase).where(where).orderBy(asc(knowledgeBase.category), asc(knowledgeBase.title));
}
async function getKnowledgeById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const r = await db5.select().from(knowledgeBase).where(eq3(knowledgeBase.id, id)).limit(1);
  return r[0] ?? null;
}
async function createKnowledge(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.insert(knowledgeBase).values(data);
}
async function updateKnowledge(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.update(knowledgeBase).set(data).where(eq3(knowledgeBase.id, id));
}
async function deleteKnowledge(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(knowledgeBase).where(eq3(knowledgeBase.id, id));
}
async function listSuppliers(search, category) {
  const db5 = await getDb3();
  if (!db5) return [];
  const conditions = [];
  if (category) conditions.push(eq3(suppliers.category, category));
  if (search) conditions.push(or(like2(suppliers.name, `%${search}%`), like2(suppliers.company, `%${search}%`), like2(suppliers.supplies, `%${search}%`)));
  const where = conditions.length > 0 ? and3(...conditions) : void 0;
  return db5.select().from(suppliers).where(where).orderBy(asc(suppliers.category), asc(suppliers.name));
}
async function getSupplierById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const r = await db5.select().from(suppliers).where(eq3(suppliers.id, id)).limit(1);
  return r[0] ?? null;
}
async function createSupplier(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.insert(suppliers).values(data);
}
async function updateSupplier(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.update(suppliers).set(data).where(eq3(suppliers.id, id));
}
async function deleteSupplier(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(suppliers).where(eq3(suppliers.id, id));
}
async function listRoutines() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(routines).orderBy(asc(routines.frequency), asc(routines.title));
}
async function createRoutine(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.insert(routines).values(data);
}
async function updateRoutine(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.update(routines).set(data).where(eq3(routines.id, id));
}
async function deleteRoutine(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(routines).where(eq3(routines.id, id));
}
async function listPendingRoutines() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(routines).where(sql2`${routines.status} IN ('pendente', 'atrasada')`).orderBy(asc(routines.frequency), asc(routines.title));
}
async function markRoutineDone(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const [routine] = await db5.select().from(routines).where(eq3(routines.id, id));
  if (!routine) throw new Error("Rotina n\xE3o encontrada");
  const now = /* @__PURE__ */ new Date();
  let nextDue = null;
  switch (routine.frequency) {
    case "diaria":
      nextDue = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1e3);
      break;
    case "semanal":
      nextDue = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1e3);
      break;
    case "quinzenal":
      nextDue = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1e3);
      break;
    case "mensal":
      nextDue = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1e3);
      break;
    case "esporadico":
      nextDue = null;
      break;
  }
  return db5.update(routines).set({
    lastDone: now,
    nextDue: nextDue ?? void 0,
    status: "em_dia"
  }).where(eq3(routines.id, id));
}
async function listRegulations(type) {
  const db5 = await getDb3();
  if (!db5) return [];
  const where = type ? eq3(regulations.type, type) : void 0;
  return db5.select().from(regulations).where(where).orderBy(desc3(regulations.createdAt));
}
async function getRegulationById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const r = await db5.select().from(regulations).where(eq3(regulations.id, id)).limit(1);
  return r[0] ?? null;
}
async function createRegulation(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.insert(regulations).values(data);
}
async function updateRegulation(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.update(regulations).set(data).where(eq3(regulations.id, id));
}
async function deleteRegulation(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(regulations).where(eq3(regulations.id, id));
}
async function listPops(sector) {
  const db5 = await getDb3();
  if (!db5) return [];
  const where = sector ? eq3(pops.sector, sector) : void 0;
  return db5.select().from(pops).where(where).orderBy(asc(pops.sector), asc(pops.code));
}
async function getPopById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const r = await db5.select().from(pops).where(eq3(pops.id, id)).limit(1);
  return r[0] ?? null;
}
async function createPop(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const [result] = await db5.insert(pops).values(data).returning({ id: pops.id });
  return result;
}
async function updatePop(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.update(pops).set(data).where(eq3(pops.id, id));
}
async function deletePop(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  return db5.delete(pops).where(eq3(pops.id, id));
}
async function getRolePermissions(role) {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(rolePermissions).where(eq3(rolePermissions.role, role));
}
async function getAllRolePermissions() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(rolePermissions).orderBy(rolePermissions.role, rolePermissions.pageKey);
}
async function setRolePermission(role, pageKey, canAccess) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const existing = await db5.select().from(rolePermissions).where(eq3(rolePermissions.role, role)).limit(100);
  const found = existing.find((r) => r.pageKey === pageKey);
  if (found) {
    return db5.update(rolePermissions).set({ canAccess }).where(eq3(rolePermissions.id, found.id));
  }
  return db5.insert(rolePermissions).values({ role, pageKey, canAccess });
}
async function canRoleAccessPage(role, pageKey) {
  if (role === "master" || role === "admin") return true;
  const db5 = await getDb3();
  if (!db5) return false;
  const rows = await db5.select().from(rolePermissions).where(eq3(rolePermissions.role, role)).limit(100);
  const perm = rows.find((r) => r.pageKey === pageKey);
  return perm?.canAccess === "sim";
}
async function getPermissionsForRole(role) {
  if (role === "master" || role === "admin") return [...PAGE_KEYS];
  const db5 = await getDb3();
  if (!db5) return [];
  const rows = await db5.select().from(rolePermissions).where(eq3(rolePermissions.role, role)).limit(100);
  return rows.filter((r) => r.canAccess === "sim").map((r) => r.pageKey);
}
async function listPriceTableSections(page) {
  const db5 = await getDb3();
  if (!db5) return [];
  if (page !== void 0) {
    return db5.select().from(priceTableSections).where(eq3(priceTableSections.page, page)).orderBy(priceTableSections.page, priceTableSections.sectionOrder).limit(200);
  }
  return db5.select().from(priceTableSections).orderBy(priceTableSections.page, priceTableSections.sectionOrder).limit(200);
}
async function registrarMetricaTabelaPrecos(db5, params) {
  await db5.insert(metricas).values({
    nome: "Altera\xE7\xE3o na Tabela de Pre\xE7os",
    valor: String(params.qtd),
    unidade: "un",
    dataApuracao: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    observacao: `${params.secao}: ${params.observacao}`,
    criadoPorNome: params.autor ?? "sistema"
  });
}
async function updatePriceTableSection(id, data, autor) {
  const db5 = await getDb3();
  if (!db5) return;
  const [before] = await db5.select().from(priceTableSections).where(eq3(priceTableSections.id, id)).limit(1);
  await db5.update(priceTableSections).set({ ...data }).where(eq3(priceTableSections.id, id));
  const campos = [];
  if (data.contentJson !== void 0 && before?.contentJson !== data.contentJson) {
    campos.push({ campo: "contentJson", antes: before?.contentJson ?? "", depois: data.contentJson ?? "" });
  }
  if (data.sectionTitle !== void 0 && before?.sectionTitle !== data.sectionTitle) {
    campos.push({ campo: "sectionTitle", antes: before?.sectionTitle ?? "", depois: data.sectionTitle ?? "" });
  }
  if (data.notes !== void 0 && before?.notes !== data.notes) {
    campos.push({ campo: "notes", antes: before?.notes ?? "", depois: data.notes ?? "" });
  }
  if (campos.length === 0) return;
  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  for (const c of campos) {
    await db5.insert(priceTableHistory).values({
      versao: nextVersao,
      sectionId: id,
      sectionTitle: before?.sectionTitle ?? "",
      autor: autor ?? "sistema",
      campoAlterado: c.campo,
      valorAnterior: c.antes,
      valorNovo: c.depois
    });
  }
  const partes = [];
  let qtd = 0;
  for (const c of campos) {
    if (c.campo === "contentJson") {
      const { resumo, qtdAlteracoes } = resumirDiffTabelaPrecos(c.antes, c.depois);
      partes.push(resumo);
      qtd += qtdAlteracoes;
    } else if (c.campo === "sectionTitle") {
      partes.push(`t\xEDtulo: "${c.antes}" \u2192 "${c.depois}"`);
      qtd += 1;
    } else if (c.campo === "notes") {
      partes.push("observa\xE7\xE3o da se\xE7\xE3o atualizada");
      qtd += 1;
    }
  }
  await registrarMetricaTabelaPrecos(db5, {
    secao: before?.sectionTitle ?? `se\xE7\xE3o #${id}`,
    observacao: partes.join(" | "),
    qtd: qtd || campos.length,
    autor
  });
}
async function listPriceTableHistory(limit = 50) {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(priceTableHistory).orderBy(desc3(priceTableHistory.createdAt)).limit(limit);
}
async function incrementPriceTableVersion() {
  const db5 = await getDb3();
  if (!db5) return;
  const [meta] = await db5.select().from(priceTableMeta).limit(1);
  if (!meta) {
    await db5.insert(priceTableMeta).values({ versao: "001" });
    return;
  }
  const current = parseInt(meta.versao, 10) || 0;
  const next = String(current + 1).padStart(3, "0");
  await db5.update(priceTableMeta).set({ versao: next, dataModificacao: /* @__PURE__ */ new Date() });
}
async function addPriceTableSection(data, autor) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  const existing = await db5.select().from(priceTableSections).where(eq3(priceTableSections.page, data.page));
  const maxOrder = existing.reduce((max, r) => Math.max(max, r.sectionOrder), 0);
  const [result] = await db5.insert(priceTableSections).values({
    page: data.page,
    sectionTitle: data.sectionTitle,
    contentJson: data.contentJson,
    notes: data.notes ?? null,
    sectionOrder: data.sectionOrder ?? maxOrder + 1
  }).returning({ id: priceTableSections.id });
  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  await db5.insert(priceTableHistory).values({
    versao: nextVersao,
    sectionId: result.id,
    sectionTitle: data.sectionTitle,
    autor: autor ?? "sistema",
    campoAlterado: "secao_criada",
    valorAnterior: "",
    valorNovo: data.sectionTitle
  });
  await registrarMetricaTabelaPrecos(db5, {
    secao: data.sectionTitle,
    observacao: "se\xE7\xE3o adicionada \xE0 Tabela de Pre\xE7os",
    qtd: 1,
    autor
  });
  return result.id;
}
async function deletePriceTableSection(id, autor) {
  const db5 = await getDb3();
  if (!db5) return;
  const [before] = await db5.select().from(priceTableSections).where(eq3(priceTableSections.id, id)).limit(1);
  await db5.delete(priceTableSections).where(eq3(priceTableSections.id, id));
  if (!before) return;
  const meta = await getPriceTableMeta();
  const current = parseInt(meta?.versao ?? "0", 10) || 0;
  const nextVersao = String(current + 1).padStart(3, "0");
  await incrementPriceTableVersion();
  await db5.insert(priceTableHistory).values({
    versao: nextVersao,
    sectionId: id,
    sectionTitle: before.sectionTitle,
    autor: autor ?? "sistema",
    campoAlterado: "secao_removida",
    valorAnterior: before.sectionTitle,
    valorNovo: ""
  });
  await registrarMetricaTabelaPrecos(db5, {
    secao: before.sectionTitle,
    observacao: "se\xE7\xE3o removida da Tabela de Pre\xE7os",
    qtd: 1,
    autor
  });
}
async function getPriceTableMeta() {
  const db5 = await getDb3();
  if (!db5) return null;
  const [meta] = await db5.select().from(priceTableMeta).limit(1);
  return meta ?? null;
}
async function listKnowledgeComments(knowledgeId) {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(knowledgeComments).where(eq3(knowledgeComments.knowledgeId, knowledgeId)).orderBy(knowledgeComments.createdAt);
}
async function createKnowledgeComment(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB not available");
  await db5.insert(knowledgeComments).values(data);
}
async function deleteKnowledgeComment(id) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.delete(knowledgeComments).where(eq3(knowledgeComments.id, id));
}
async function insertAuditLog(data) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.insert(auditoriaRetrabalhos).values({
    retrabalhoId: data.retrabalhoId ?? null,
    osRetrabalhada: data.osRetrabalhada ?? null,
    osOriginal: data.osOriginal ?? null,
    acao: data.acao,
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    usuarioRole: data.usuarioRole ?? null,
    detalhes: data.detalhes ? JSON.stringify(data.detalhes) : null
  });
}
async function listAuditLogs(filter = {}) {
  const db5 = await getDb3();
  if (!db5) return { rows: [], total: 0 };
  const { page = 1, pageSize = 50 } = filter;
  const conditions = [];
  if (filter.acao) conditions.push(eq3(auditoriaRetrabalhos.acao, filter.acao));
  if (filter.usuarioId) conditions.push(eq3(auditoriaRetrabalhos.usuarioId, filter.usuarioId));
  if (filter.retrabalhoId) conditions.push(eq3(auditoriaRetrabalhos.retrabalhoId, filter.retrabalhoId));
  if (filter.osRetrabalhada) conditions.push(like2(auditoriaRetrabalhos.osRetrabalhada, `%${filter.osRetrabalhada}%`));
  if (filter.dataInicio) conditions.push(gte(auditoriaRetrabalhos.createdAt, filter.dataInicio));
  if (filter.dataFim) {
    const endOfDay = new Date(filter.dataFim);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(auditoriaRetrabalhos.createdAt, endOfDay));
  }
  const where = conditions.length > 0 ? and3(...conditions) : void 0;
  const [countResult] = await db5.select({ total: count2() }).from(auditoriaRetrabalhos).where(where);
  const rows = await db5.select().from(auditoriaRetrabalhos).where(where).orderBy(desc3(auditoriaRetrabalhos.createdAt)).limit(pageSize).offset((page - 1) * pageSize);
  return { rows, total: countResult?.total ?? 0 };
}
async function listCargos() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(cargosFuncoes).orderBy(asc(cargosFuncoes.titulo));
}
async function getCargoById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  const [row] = await db5.select().from(cargosFuncoes).where(eq3(cargosFuncoes.id, id));
  return row ?? null;
}
async function createCargo(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  const [result] = await db5.insert(cargosFuncoes).values(data).returning({ id: cargosFuncoes.id });
  return result.id;
}
async function updateCargo(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  await db5.update(cargosFuncoes).set(data).where(eq3(cargosFuncoes.id, id));
}
async function deleteCargo(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  await db5.delete(cargosFuncoes).where(eq3(cargosFuncoes.id, id));
}
async function listKnowledgeSuggestions(status) {
  const db5 = await getDb3();
  if (!db5) return [];
  const rows = await db5.select().from(knowledgeSuggestions).where(status ? eq3(knowledgeSuggestions.status, status) : void 0).orderBy(knowledgeSuggestions.createdAt);
  return rows;
}
async function createKnowledgeSuggestion(data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  const result = await db5.insert(knowledgeSuggestions).values(data);
  return result;
}
async function updateKnowledgeSuggestion(id, data) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  await db5.update(knowledgeSuggestions).set(data).where(eq3(knowledgeSuggestions.id, id));
}
async function deleteKnowledgeSuggestion(id) {
  const db5 = await getDb3();
  if (!db5) throw new Error("DB unavailable");
  await db5.delete(knowledgeSuggestions).where(eq3(knowledgeSuggestions.id, id));
}
async function listArquivosBibliotecaComConteudo() {
  const db5 = await getDb3();
  if (!db5) return [];
  const { bibliotecaArquivos: bibliotecaArquivos2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
  const rows = await db5.select({
    id: bibliotecaArquivos2.id,
    nome: bibliotecaArquivos2.nome,
    descricao: bibliotecaArquivos2.descricao,
    categoria: bibliotecaArquivos2.categoria,
    subcategoria: bibliotecaArquivos2.subcategoria,
    tags: bibliotecaArquivos2.tags,
    fileName: bibliotecaArquivos2.fileName,
    mimeType: bibliotecaArquivos2.mimeType,
    conteudoExtraido: bibliotecaArquivos2.conteudoExtraido,
    fileUrl: bibliotecaArquivos2.fileUrl
  }).from(bibliotecaArquivos2).orderBy(desc3(bibliotecaArquivos2.createdAt));
  return rows;
}
async function getFinanceiros() {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(financeirosMensais).orderBy(desc3(financeirosMensais.ano), desc3(financeirosMensais.mes));
}
async function getFinanceiroByMesAno(mes, ano) {
  const db5 = await getDb3();
  if (!db5) return null;
  const result = await db5.select().from(financeirosMensais).where(and3(eq3(financeirosMensais.mes, mes), eq3(financeirosMensais.ano, ano)));
  return result[0] ?? null;
}
async function upsertFinanceiro(input) {
  const db5 = await getDb3();
  if (!db5) return null;
  const existing = await getFinanceiroByMesAno(input.mes, input.ano);
  if (existing) {
    const toStr = (v) => v != null ? String(v) : void 0;
    await db5.update(financeirosMensais).set({
      receitaBruta: toStr(input.receitaBruta ?? existing.receitaBruta),
      receitaOperacional: toStr(input.receitaOperacional ?? existing.receitaOperacional),
      receitaFinanceira: toStr(input.receitaFinanceira ?? existing.receitaFinanceira),
      despesasTotal: toStr(input.despesasTotal ?? existing.despesasTotal),
      despesasFixas: toStr(input.despesasFixas ?? existing.despesasFixas),
      despesasVariaveis: toStr(input.despesasVariaveis ?? existing.despesasVariaveis),
      despesasPessoal: toStr(input.despesasPessoal ?? existing.despesasPessoal),
      despesasFinanceiras: toStr(input.despesasFinanceiras ?? existing.despesasFinanceiras),
      despesasImpostos: toStr(input.despesasImpostos ?? existing.despesasImpostos),
      lucroGruto: toStr(input.lucroGruto ?? existing.lucroGruto),
      lucroOperacional: toStr(input.lucroOperacional ?? existing.lucroOperacional),
      lucroLiquido: toStr(input.lucroLiquido ?? existing.lucroLiquido),
      entradas: toStr(input.entradas ?? existing.entradas),
      saidas: toStr(input.saidas ?? existing.saidas),
      saldoMes: toStr(input.saldoMes ?? existing.saldoMes),
      observacoes: input.observacoes ?? existing.observacoes,
      fonte: "manual"
    }).where(and3(eq3(financeirosMensais.mes, input.mes), eq3(financeirosMensais.ano, input.ano)));
    return getFinanceiroByMesAno(input.mes, input.ano);
  } else {
    const result = await db5.insert(financeirosMensais).values({
      mes: input.mes,
      ano: input.ano,
      receitaBruta: String(input.receitaBruta ?? 0),
      receitaOperacional: String(input.receitaOperacional ?? 0),
      receitaFinanceira: String(input.receitaFinanceira ?? 0),
      despesasTotal: String(input.despesasTotal ?? 0),
      despesasFixas: String(input.despesasFixas ?? 0),
      despesasVariaveis: String(input.despesasVariaveis ?? 0),
      despesasPessoal: String(input.despesasPessoal ?? 0),
      despesasFinanceiras: String(input.despesasFinanceiras ?? 0),
      despesasImpostos: String(input.despesasImpostos ?? 0),
      lucroGruto: String(input.lucroGruto ?? 0),
      lucroOperacional: String(input.lucroOperacional ?? 0),
      lucroLiquido: String(input.lucroLiquido ?? 0),
      entradas: String(input.entradas ?? 0),
      saidas: String(input.saidas ?? 0),
      saldoMes: String(input.saldoMes ?? 0),
      fonte: "manual",
      observacoes: input.observacoes
    });
    return getFinanceiroByMesAno(input.mes, input.ano);
  }
}
async function createAnaliseCurriculo(input) {
  const db5 = await getDb3();
  if (!db5) return null;
  try {
    const [result] = await db5.insert(analiseCurriculos).values(input).returning({ id: analiseCurriculos.id });
    return getAnaliseCurriculoById(result.id);
  } catch (error) {
    console.error("[DB] Error creating analise_curriculo:", error);
    return null;
  }
}
async function getAnaliseCurriculoById(id) {
  const db5 = await getDb3();
  if (!db5) return null;
  try {
    const result = await db5.select().from(analiseCurriculos).where(eq3(analiseCurriculos.id, id)).limit(1);
    return result[0] || null;
  } catch (error) {
    console.error("[DB] Error fetching analise_curriculo:", error);
    return null;
  }
}
async function getAnaliseCurriculosByCargo(cargoId) {
  const db5 = await getDb3();
  if (!db5) return [];
  try {
    return await db5.select().from(analiseCurriculos).where(eq3(analiseCurriculos.cargoId, cargoId)).orderBy(desc3(analiseCurriculos.createdAt));
  } catch (error) {
    console.error("[DB] Error fetching analise_curriculos by cargo:", error);
    return [];
  }
}
async function updateAnaliseCurriculo(id, updates) {
  const db5 = await getDb3();
  if (!db5) return null;
  try {
    await db5.update(analiseCurriculos).set(updates).where(eq3(analiseCurriculos.id, id));
    return getAnaliseCurriculoById(id);
  } catch (error) {
    console.error("[DB] Error updating analise_curriculo:", error);
    return null;
  }
}
var _db3;
var init_db = __esm({
  "server/db/db.ts"() {
    "use strict";
    init_db_connection();
    init_schema();
    init_priceTableDiff();
    _db3 = null;
  }
});

// server/sync/scheduled-sync-os.ts
var scheduled_sync_os_exports = {};
__export(scheduled_sync_os_exports, {
  obterStatusSincronizacao: () => obterStatusSincronizacao,
  registrarLogSincronizacao: () => registrarLogSincronizacao,
  sincronizarOSDoMubiSys: () => sincronizarOSDoMubiSys
});
async function sincronizarOSDoMubiSys(opts = {}) {
  const dias = opts.dias ?? 8;
  const offset = opts.offset ?? 0;
  const inicio = Date.now();
  const hoje = /* @__PURE__ */ new Date();
  const dataFim = new Date(hoje);
  dataFim.setDate(dataFim.getDate() - offset);
  const dataInicio = new Date(hoje);
  dataInicio.setDate(dataInicio.getDate() - offset - dias);
  console.log(`\u{1F504} [SYNC-OS] dias=${dias} offset=${offset} janela=${fmt(dataInicio)}..${fmt(dataFim)}`);
  const logId = await iniciarLogSincronizacao();
  try {
    console.log(`\u{1F4E1} [SYNC-OS] Buscando OS da API MubiSys...`);
    const { itens: osLista, completo } = await listarOSMubiSys({
      datainicial: fmt(dataInicio),
      datafinal: fmt(dataFim)
    });
    if (!completo) {
      console.warn(`\u26A0\uFE0F [SYNC-OS] Listagem incompleta \u2014 teto de p\xE1ginas atingido`);
    }
    console.log(`\u2705 [SYNC-OS] Recebidas ${osLista.length} OS da API`);
    let quantidadeProcessada = 0;
    for (const os of osLista) {
      try {
        const numeroOs = String(os.sequencial_ordem || os.numero_pedido_compra || os.id || "").trim();
        if (!numeroOs) {
          console.warn(`\u26A0\uFE0F [SYNC-OS] OS sem n\xFAmero identific\xE1vel, pulando...`);
          continue;
        }
        const endereco = os.cliente_endereco?.[0];
        const cep = endereco?.cep || "";
        const municipio = endereco?.cidade || "";
        const estado = endereco?.estado || "";
        const dataAprovacao = os.data_aprovacao || null;
        const dataEntrega = normalizarData(os.data_entrega);
        const vendedor = os.vendedor || os.atendente || "";
        await mutationQuery(
          `INSERT INTO erp_os_cache (
            "numeroOs", "razaoSocial", cnpj, email, cep, municipio, estado, endereco,
            "dataAprovacao", "dataEntregaPrevista", vendedor, "valorTotal", status,
            "dataUltimaAtualizacao", "sincronizadoEm", "criadoEm"
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ativa', NOW(), NOW(), NOW())
          ON CONFLICT ("numeroOs") DO UPDATE SET
            "razaoSocial" = EXCLUDED."razaoSocial",
            cnpj = EXCLUDED.cnpj,
            email = EXCLUDED.email,
            cep = EXCLUDED.cep,
            municipio = EXCLUDED.municipio,
            estado = EXCLUDED.estado,
            endereco = EXCLUDED.endereco,
            "dataAprovacao" = EXCLUDED."dataAprovacao",
            "dataEntregaPrevista" = EXCLUDED."dataEntregaPrevista",
            vendedor = EXCLUDED.vendedor,
            "valorTotal" = EXCLUDED."valorTotal",
            "dataUltimaAtualizacao" = NOW(),
            "sincronizadoEm" = NOW()`,
          [
            numeroOs,
            os.cliente,
            os.cliente_cnpj_cpf,
            os.cliente_contato?.[0]?.email || "",
            cep,
            municipio,
            estado,
            endereco?.logradouro || "",
            dataAprovacao,
            dataEntrega,
            vendedor,
            os.valor_total ?? null
          ]
        );
        quantidadeProcessada++;
      } catch (erro) {
        console.error(`\u274C [SYNC-OS] Erro ao processar OS:`, erro.message);
      }
    }
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`\u2705 [SYNC-OS] Sincroniza\xE7\xE3o conclu\xEDda: ${quantidadeProcessada} OS processadas em ${tempoExecucaoMs}ms`);
    await finalizarLogSincronizacao(logId, {
      status: "SUCESSO",
      quantidadeOsImportadas: quantidadeProcessada,
      tempoExecucaoMs
    });
    return {
      dataExecucao: /* @__PURE__ */ new Date(),
      quantidadeOsImportadas: quantidadeProcessada,
      status: "SUCESSO",
      tempoExecucaoMs
    };
  } catch (erro) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`\u274C [SYNC-OS] Erro na sincroniza\xE7\xE3o:`, erro);
    await finalizarLogSincronizacao(logId, {
      status: "ERRO",
      quantidadeOsImportadas: 0,
      tempoExecucaoMs,
      mensagemErro: erro?.message || "Erro desconhecido"
    });
    return {
      dataExecucao: /* @__PURE__ */ new Date(),
      quantidadeOsImportadas: 0,
      status: "ERRO",
      mensagemErro: erro?.message || "Erro desconhecido",
      tempoExecucaoMs
    };
  }
}
async function iniciarLogSincronizacao() {
  try {
    const resultado = await mutationQuery(
      `INSERT INTO sync_logs (status) VALUES ('PENDENTE') RETURNING id`,
      []
    );
    return resultado.insertId ?? null;
  } catch (erro) {
    console.error(`\u274C [SYNC-OS] Erro ao registrar in\xEDcio da execu\xE7\xE3o:`, erro.message);
    return null;
  }
}
async function finalizarLogSincronizacao(id, dados) {
  if (id == null) {
    await registrarLogSincronizacao({
      dataExecucao: /* @__PURE__ */ new Date(),
      quantidadeOsImportadas: dados.quantidadeOsImportadas,
      status: dados.status,
      mensagemErro: dados.mensagemErro
    });
    return;
  }
  try {
    await mutationQuery(
      `UPDATE sync_logs SET
        status = ?, "quantidadeOsImportadas" = ?, "tempoExecucaoMs" = ?, "mensagemErro" = ?
      WHERE id = ?`,
      [dados.status, dados.quantidadeOsImportadas, dados.tempoExecucaoMs, dados.mensagemErro || null, id]
    );
  } catch (erro) {
    console.error(`\u274C [SYNC-OS] Erro ao finalizar log:`, erro.message);
  }
}
async function registrarLogSincronizacao(log) {
  try {
    await mutationQuery(
      `INSERT INTO sync_logs
        ("dataExecucao", "quantidadeOsImportadas", status, "mensagemErro", "tempoExecucaoMs")
      VALUES (?, ?, ?, ?, ?)`,
      [
        log.dataExecucao,
        log.quantidadeOsImportadas,
        log.status,
        log.mensagemErro || null,
        log.tempoExecucaoMs ?? null
      ]
    );
  } catch (erro) {
    console.error(`\u274C [SYNC-OS] Erro ao registrar log:`, erro.message);
  }
}
async function obterStatusSincronizacao() {
  try {
    const logs = await selectQuery(
      `SELECT * FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT 1`,
      []
    );
    if (!logs || logs.length === 0) {
      return {
        ultimaExecucao: null,
        status: "NUNCA_EXECUTADO",
        totalOsEmCache: 0
      };
    }
    const ultimoLog = logs[0];
    const totalOsEmCache = await selectQuery(
      `SELECT COUNT(*) as total FROM erp_os_cache`,
      []
    );
    return {
      ultimaExecucao: ultimoLog.dataExecucao,
      status: ultimoLog.status,
      quantidadeOsImportadas: ultimoLog.quantidadeOsImportadas,
      mensagemErro: ultimoLog.mensagemErro,
      totalOsEmCache: totalOsEmCache[0]?.total || 0
    };
  } catch (erro) {
    console.error(`\u274C [SYNC-OS] Erro ao obter status:`, erro.message);
    return {
      ultimaExecucao: null,
      status: "ERRO",
      totalOsEmCache: 0
    };
  }
}
var fmt;
var init_scheduled_sync_os = __esm({
  "server/sync/scheduled-sync-os.ts"() {
    "use strict";
    init_db_connection();
    init_mubisys_client();
    init_date_utils();
    fmt = (d) => d.toISOString().split("T")[0];
  }
});

// server/_core/auth-web-handler.ts
var auth_web_handler_exports = {};
__export(auth_web_handler_exports, {
  authWebHandler: () => authWebHandler
});
async function authWebHandler(req, res) {
  const host = req.get("host") ?? "localhost";
  const url = new URL(req.originalUrl, `${req.protocol}://${host}`);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === void 0) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }
  headers.delete("content-length");
  let body;
  if (req.method !== "GET" && req.method !== "HEAD") {
    if (typeof req.body === "string") {
      body = req.body;
    } else if (req.body != null && Object.keys(req.body).length > 0) {
      body = JSON.stringify(req.body);
      headers.set("content-type", "application/json");
    }
  }
  const response = await auth.handler(
    new Request(url.toString(), { method: req.method, headers, body })
  );
  res.status(response.status);
  const setCookie = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") return;
    res.setHeader(key, value);
  });
  if (setCookie.length > 0) res.setHeader("set-cookie", setCookie);
  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
var init_auth_web_handler = __esm({
  "server/_core/auth-web-handler.ts"() {
    "use strict";
    init_auth();
  }
});

// server/_core/uploadthing.ts
var uploadthing_exports = {};
__export(uploadthing_exports, {
  uploadRouter: () => uploadRouter
});
import { createUploadthing } from "uploadthing/express";
import { UploadThingError } from "uploadthing/server";
import { fromNodeHeaders as fromNodeHeaders3 } from "better-auth/node";
async function requireUser2(req) {
  const session2 = await auth.api.getSession({
    headers: fromNodeHeaders3(req.headers)
  });
  if (!session2) throw new UploadThingError("N\xE3o autenticado");
  return { userId: session2.user.id };
}
var f, uploadRouter;
var init_uploadthing = __esm({
  "server/_core/uploadthing.ts"() {
    "use strict";
    init_auth();
    f = createUploadthing();
    uploadRouter = {
      /**
       * Imagens: fotos de cotação, imagens de POP, biblioteca de erros, cargos,
       * fotos e anotações de empacotamento.
       */
      imagem: f({
        image: { maxFileSize: "16MB", maxFileCount: 10 }
      }).middleware(({ req }) => requireUser2(req)).onUploadComplete(({ file, metadata }) => {
        return { uploadedBy: metadata.userId, name: file.name };
      }),
      /**
       * Documentos: currículos (PDF/DOCX/TXT) e biblioteca de arquivos.
       */
      documento: f({
        pdf: { maxFileSize: "32MB", maxFileCount: 1 },
        text: { maxFileSize: "8MB", maxFileCount: 1 },
        blob: { maxFileSize: "32MB", maxFileCount: 1 }
      }).middleware(({ req }) => requireUser2(req)).onUploadComplete(({ file, metadata }) => {
        return { uploadedBy: metadata.userId, name: file.name };
      })
    };
  }
});

// server/sync/scheduled-sync-os-handler.ts
var scheduled_sync_os_handler_exports = {};
__export(scheduled_sync_os_handler_exports, {
  handleSincronizarOS: () => handleSincronizarOS,
  handleStatusSincronizacao: () => handleStatusSincronizacao
});
function clampParam(valor, min, max, padrao) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}
async function handleSincronizarOS(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers["x-cron-secret"] !== cronSecret) {
      return res.status(403).json({ error: "cron-only", message: "Este endpoint \xE9 apenas para CRON jobs" });
    }
    const dias = clampParam(req.query.dias, 1, 31, 8);
    const offset = clampParam(req.query.offset, 0, 365, 0);
    console.log(`\u{1F504} [CRON] Sincroniza\xE7\xE3o de OS iniciada (dias=${dias}, offset=${offset})`);
    const resultado = await sincronizarOSDoMubiSys({ dias, offset });
    console.log(`\u2705 [CRON] Sincroniza\xE7\xE3o conclu\xEDda: ${resultado.quantidadeOsImportadas} OS processadas`);
    return res.json({
      ok: true,
      resultado,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (erro) {
    console.error(`\u274C [CRON] Erro na sincroniza\xE7\xE3o:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      stack: erro?.stack,
      context: {
        url: req.url,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    });
  }
}
async function handleStatusSincronizacao(req, res) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || req.headers["x-cron-secret"] !== cronSecret) {
      return res.status(403).json({ error: "cron-only", message: "Este endpoint \xE9 apenas para CRON jobs" });
    }
    const status = await obterStatusSincronizacao();
    return res.json({
      ok: true,
      status,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (erro) {
    console.error(`\u274C [STATUS] Erro ao obter status:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido"
    });
  }
}
var init_scheduled_sync_os_handler = __esm({
  "server/sync/scheduled-sync-os-handler.ts"() {
    "use strict";
    init_scheduled_sync_os();
  }
});

// server/_core/app.ts
init_auth();
import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { toNodeHandler } from "better-auth/node";

// server/routers.ts
import { z as z23 } from "zod";

// server/routers/logistica.ts
import { z } from "zod";

// shared/const.ts
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
function requireRole(...roles) {
  return t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || !roles.includes(ctx.user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  });
}
var adminProcedure = t.procedure.use(requireRole("admin", "master"));

// server/routers/logistica.ts
init_db_helpers_select();
init_db_connection();
init_mubisys_frete();
init_mubisys_client();
init_schema();
import { TRPCError as TRPCError2 } from "@trpc/server";
import { and as and2, desc as desc2, eq as eq2, like, inArray as inArray2 } from "drizzle-orm";
import { drizzle as drizzle3 } from "drizzle-orm/neon-serverless";
import * as https from "https";
var _db2 = null;
function getDb2() {
  if (!_db2) _db2 = drizzle3(getPool());
  return _db2;
}
var db2 = {
  select: () => getDb2().select(),
  insert: (t2) => getDb2().insert(t2),
  update: (t2) => getDb2().update(t2),
  delete: (t2) => getDb2().delete(t2)
};
var transportadorasRouter = router({
  list: publicProcedure.input(z.object({ search: z.string().optional(), apenasAtivas: z.boolean().optional(), modal: z.string().optional() })).query(async ({ input }) => {
    let rows = await db2.select().from(transportadoras).orderBy(transportadoras.nome);
    if (input.apenasAtivas) rows = rows.filter((r) => r.ativa === "sim");
    if (input.search) {
      const s = input.search.toLowerCase();
      rows = rows.filter(
        (r) => r.nome.toLowerCase().includes(s) || (r.nomeContato ?? "").toLowerCase().includes(s) || (r.whatsappContato ?? "").toLowerCase().includes(s)
      );
    }
    if (input.modal) {
      rows = rows.filter((r) => {
        if (!r.modais) return false;
        try {
          return JSON.parse(r.modais).includes(input.modal);
        } catch {
          return false;
        }
      });
    }
    const cidades = await db2.select().from(transportadoraCidades);
    return rows.map((t2) => ({
      ...t2,
      totalCidades: cidades.filter((c) => c.transportadoraId === t2.id).length
    }));
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const [t2] = await db2.select().from(transportadoras).where(eq2(transportadoras.id, input.id));
    if (!t2) throw new Error("Transportadora n\xE3o encontrada");
    const cidades = await db2.select().from(transportadoraCidades).where(eq2(transportadoraCidades.transportadoraId, input.id)).orderBy(transportadoraCidades.estado, transportadoraCidades.cidade);
    const avaliacoes = await db2.select().from(transportadoraAvaliacoes).where(eq2(transportadoraAvaliacoes.transportadoraId, input.id)).orderBy(desc2(transportadoraAvaliacoes.createdAt));
    const filiais = await db2.select().from(transportadoraFiliais).where(eq2(transportadoraFiliais.transportadoraId, input.id)).orderBy(transportadoraFiliais.nome);
    return { ...t2, cidades, avaliacoes, filiais, totalCidades: cidades.length };
  }),
  create: publicProcedure.input(z.object({
    nome: z.string().min(2),
    site: z.string().optional(),
    endereco: z.string().optional(),
    referencia: z.string().optional(),
    nomeContato: z.string().optional(),
    telefoneContato: z.string().optional(),
    whatsappContato: z.string().optional(),
    nomeContatoNegocial: z.string().optional(),
    telefoneContatoNegocial: z.string().optional(),
    emailContatoNegocial: z.string().optional(),
    whatsappContatoNegocial: z.string().optional(),
    formaCotacao: z.enum(["site", "whatsapp", "telefone", "email"]).optional(),
    linkSiteCotacao: z.string().optional(),
    modais: z.string().optional(),
    pesoMaxKg: z.string().optional(),
    alturaMaxCm: z.string().optional(),
    larguraMaxCm: z.string().optional(),
    comprimentoMaxCm: z.string().optional(),
    somaMaxCm: z.string().optional(),
    horarioLimiteColeta: z.string().optional(),
    horarioLimiteMercadoria: z.string().optional(),
    distanciaSedMin: z.number().optional(),
    realizaColeta: z.enum(["sim", "nao"]).optional(),
    ultAtualizTabela: z.string().optional(),
    semTabelaNegociavel: z.enum(["sim", "nao"]).optional(),
    portalUrl: z.string().optional(),
    portalUsuario: z.string().optional(),
    portalEmail: z.string().optional(),
    portalObservacao: z.string().optional(),
    portalSenha: z.string().optional(),
    ultAtualizCidades: z.string().optional(),
    contatoRastreio: z.string().optional(),
    observacoes: z.string().optional(),
    coberturaTotal: z.number().int().min(0).max(1).optional()
  })).mutation(async ({ input }) => {
    const [result] = await db2.insert(transportadoras).values(input).returning({ id: transportadoras.id });
    return { id: result.id };
  }),
  update: publicProcedure.input(z.object({
    id: z.number(),
    nome: z.string().optional(),
    site: z.string().optional(),
    endereco: z.string().optional(),
    referencia: z.string().optional(),
    nomeContato: z.string().optional(),
    telefoneContato: z.string().optional(),
    whatsappContato: z.string().optional(),
    nomeContatoNegocial: z.string().optional(),
    telefoneContatoNegocial: z.string().optional(),
    emailContatoNegocial: z.string().optional(),
    whatsappContatoNegocial: z.string().optional(),
    formaCotacao: z.enum(["site", "whatsapp", "telefone", "email"]).optional(),
    linkSiteCotacao: z.string().optional(),
    modais: z.string().optional(),
    pesoMaxKg: z.string().optional(),
    alturaMaxCm: z.string().optional(),
    larguraMaxCm: z.string().optional(),
    comprimentoMaxCm: z.string().optional(),
    somaMaxCm: z.string().optional(),
    horarioLimiteColeta: z.string().optional(),
    horarioLimiteMercadoria: z.string().optional(),
    distanciaSedMin: z.number().optional(),
    realizaColeta: z.enum(["sim", "nao"]).optional(),
    ultAtualizTabela: z.string().optional(),
    semTabelaNegociavel: z.enum(["sim", "nao"]).optional(),
    portalUrl: z.string().optional(),
    portalUsuario: z.string().optional(),
    portalEmail: z.string().optional(),
    portalObservacao: z.string().optional(),
    portalSenha: z.string().optional(),
    ultAtualizCidades: z.string().optional(),
    contatoRastreio: z.string().optional(),
    observacoes: z.string().optional(),
    ativa: z.enum(["sim", "nao"]).optional(),
    coberturaTotal: z.number().int().min(0).max(1).optional()
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    await db2.update(transportadoras).set(data).where(eq2(transportadoras.id, id));
    return { ok: true };
  }),
  delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db2.delete(transportadoraCidades).where(eq2(transportadoraCidades.transportadoraId, input.id));
    await db2.delete(transportadoraAvaliacoes).where(eq2(transportadoraAvaliacoes.transportadoraId, input.id));
    await db2.delete(transportadoraFiliais).where(eq2(transportadoraFiliais.transportadoraId, input.id));
    await db2.delete(transportadoras).where(eq2(transportadoras.id, input.id));
    return { ok: true };
  }),
  addAvaliacao: publicProcedure.input(z.object({
    transportadoraId: z.number(),
    estrelas: z.number().min(1).max(5),
    comentario: z.string().optional(),
    autor: z.string().optional()
  })).mutation(async ({ input }) => {
    await db2.insert(transportadoraAvaliacoes).values(input);
    return { ok: true };
  }),
  deleteAvaliacao: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db2.delete(transportadoraAvaliacoes).where(eq2(transportadoraAvaliacoes.id, input.id));
    return { ok: true };
  }),
  addFilial: publicProcedure.input(z.object({
    transportadoraId: z.number(),
    nome: z.string().min(2),
    endereco: z.string().optional(),
    cidade: z.string().optional(),
    estado: z.string().max(2).optional(),
    telefone: z.string().optional()
  })).mutation(async ({ input }) => {
    await db2.insert(transportadoraFiliais).values(input);
    return { ok: true };
  }),
  deleteFilial: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db2.delete(transportadoraFiliais).where(eq2(transportadoraFiliais.id, input.id));
    return { ok: true };
  }),
  addCidade: publicProcedure.input(z.object({
    transportadoraId: z.number(),
    cidade: z.string(),
    estado: z.string().length(2)
  })).mutation(async ({ input }) => {
    try {
      await db2.insert(transportadoraCidades).values(input);
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw new Error("Cidade j\xE1 cadastrada para esta transportadora.");
      throw e;
    }
    const hoje = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    await db2.update(transportadoras).set({ ultAtualizCidades: hoje }).where(eq2(transportadoras.id, input.transportadoraId));
    return { ok: true };
  }),
  buscarMunicipios: publicProcedure.input(z.object({ q: z.string().min(2) })).query(async ({ input }) => {
    const termo = input.q.trim();
    const rows = await getDb2().selectDistinct({ cidade: transportadoraCidades.cidade, estado: transportadoraCidades.estado }).from(transportadoraCidades).where(like(transportadoraCidades.cidade, `${termo}%`)).orderBy(transportadoraCidades.cidade).limit(10);
    return rows;
  }),
  removeCidade: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db2.delete(transportadoraCidades).where(eq2(transportadoraCidades.id, input.id));
    return { ok: true };
  }),
  consultarCobertura: publicProcedure.input(z.object({ cidade: z.string(), estado: z.string() })).query(async ({ input }) => {
    const cidades = await db2.select().from(transportadoraCidades).where(and2(
      like(transportadoraCidades.cidade, `%${input.cidade}%`),
      eq2(transportadoraCidades.estado, input.estado.toUpperCase())
    ));
    const idsSet = new Set(cidades.map((c) => c.transportadoraId));
    const ids = Array.from(idsSet);
    const todas = await db2.select().from(transportadoras).where(eq2(transportadoras.ativa, "sim"));
    const atende = todas.filter((t2) => ids.includes(t2.id) || t2.coberturaTotal === 1);
    const naoAtende = todas.filter((t2) => !ids.includes(t2.id) && !(t2.coberturaTotal === 1));
    return { atende, naoAtende };
  }),
  // ─── Subaba de completude de dados ──────────────────────────────────────
  /** Contagens gerais: total, ativas, inativas, origem e alcance nacional. */
  panoramaCadastro: publicProcedure.query(async () => {
    const { panoramaCadastro: panoramaCadastro2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    return panoramaCadastro2();
  }),
  /** Resumo agrupado por campo ausente + progresso geral do cadastro. */
  resumoCompletude: publicProcedure.input(z.object({
    status: z.enum(["ativas", "inativas", "todas"]).optional().default("todas"),
    origem: z.enum(["Frenet", "Manual", "todas"]).optional().default("todas")
  }).optional()).query(async ({ input }) => {
    const { resumoCompletude: resumoCompletude2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    return resumoCompletude2({ status: input?.status, origem: input?.origem });
  }),
  /** Lista transportadoras por estado de um campo (vazios/preenchidos/todos). */
  pendentesPorCampo: publicProcedure.input(z.object({
    campo: z.string().optional(),
    busca: z.string().optional(),
    page: z.number().optional().default(1),
    pageSize: z.number().optional().default(20),
    status: z.enum(["ativas", "inativas", "todas"]).optional().default("todas"),
    origem: z.enum(["Frenet", "Manual", "todas"]).optional().default("todas"),
    modo: z.enum(["vazios", "preenchidos", "todos"]).optional().default("vazios")
  })).query(async ({ input }) => {
    const { listarPendentesPorCampo: listarPendentesPorCampo2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    return listarPendentesPorCampo2(input.campo, input.busca, input.page, input.pageSize, {
      status: input.status,
      origem: input.origem,
      modo: input.modo
    });
  }),
  /** Salva um único campo direto da subaba de completude. */
  atualizarCampo: publicProcedure.input(z.object({
    id: z.number(),
    campo: z.string(),
    valor: z.string().nullable()
  })).mutation(async ({ input }) => {
    const { atualizarCampoTransportadora: atualizarCampoTransportadora2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    try {
      return await atualizarCampoTransportadora2(input.id, input.campo, input.valor);
    } catch (erro) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: erro?.message ?? "Falha ao salvar campo" });
    }
  }),
  /** Liga/desliga o status ativo direto na listagem da subaba. */
  definirStatus: publicProcedure.input(z.object({ id: z.number(), ativa: z.boolean() })).mutation(async ({ input }) => {
    const { definirStatusTransportadora: definirStatusTransportadora2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    return definirStatusTransportadora2(input.id, input.ativa);
  }),
  /** Aplica o mesmo valor de um campo a várias transportadoras de uma vez. */
  atualizarCampoEmLote: publicProcedure.input(z.object({
    ids: z.array(z.number()).min(1),
    campo: z.string(),
    valor: z.string().nullable()
  })).mutation(async ({ input }) => {
    const { atualizarCampoEmLote: atualizarCampoEmLote2 } = await Promise.resolve().then(() => (init_transportadoras_completude(), transportadoras_completude_exports));
    try {
      return await atualizarCampoEmLote2(input.ids, input.campo, input.valor);
    } catch (erro) {
      throw new TRPCError2({ code: "BAD_REQUEST", message: erro?.message ?? "Falha ao salvar em lote" });
    }
  })
});
function formatarDocumento(valor) {
  const nums = String(valor ?? "").replace(/\D/g, "");
  if (nums.length === 14) return nums.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  if (nums.length === 11) return nums.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return String(valor ?? "").trim();
}
async function fetchDadosOsMub(numeroOs) {
  const os = await buscarOSPorNumero(numeroOs);
  if (!os) return null;
  const end = os.cliente_endereco?.[0];
  let cnpj = formatarDocumento(os.cliente_cnpj_cpf);
  let nomeCliente = String(os.cliente ?? "").trim();
  if (!cnpj && os.cliente_id) {
    const cli = await buscarClientePorId(os.cliente_id);
    if (cli) {
      cnpj = formatarDocumento(cli.cnpj_cpf);
      if (!nomeCliente) nomeCliente = cli.razao_social ?? "";
    }
  }
  return {
    nomeCliente,
    cnpj,
    cep: (end?.cep ?? "").replace(/\D/g, ""),
    endereco: [end?.logradouro, end?.numero, end?.complemento, end?.bairro].filter(Boolean).join(", "),
    cidade: end?.cidade ?? "",
    estado: end?.estado ?? "",
    valorNf: os.valor_total ? String(Number(os.valor_total).toFixed(2)) : "",
    vendedor: os.vendedor ?? "",
    // `prazo` é texto livre ("02 dias úteis") — não serve como data. Só
    // data_entrega entra aqui.
    dataEntregaPrevista: os.data_entrega ?? "",
    dataAprovacao: os.data_aprovacao ?? ""
  };
}
var cotacoesFreteRouter = router({
  /**
   * Gera o romaneio de despacho em PDF real (jsPDF), para o motorista.
   * Regra do usuário: traz todas as informações da solicitação, EXCETO as fotografias.
   */
  romaneioPdf: publicProcedure.input(z.object({ ids: z.array(z.number()).min(1) })).mutation(async ({ input }) => {
    const { jsPDF } = await import("jspdf");
    const cotacoes = await db2.select().from(cotacoesFrete).where(inArray2(cotacoesFrete.id, input.ids));
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margem = 40;
    const limiteY = 800;
    let y = 48;
    const escreve = (texto, negrito = false, tamanho = 9) => {
      if (y > limiteY) {
        doc.addPage();
        y = 48;
      }
      doc.setFont("helvetica", negrito ? "bold" : "normal");
      doc.setFontSize(tamanho);
      doc.text(texto, margem, y);
      y += tamanho + 4;
    };
    const moeda = (v) => {
      const n = Number(v ?? 0);
      return n ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "\u2014";
    };
    escreve("Romaneio de Despacho \u2014 Letreiros Express", true, 14);
    escreve(`Pedidos prontos aguardando envio: ${cotacoes.length}`);
    escreve(`Emitido em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")}`);
    y += 8;
    for (const c of cotacoes) {
      const ops = await getDb2().select({
        transportadoraNome: cotacaoOpcoes.transportadoraNome,
        valorFrete: cotacaoOpcoes.valorFrete,
        prazoDias: cotacaoOpcoes.prazoDias,
        tipoPrazo: cotacaoOpcoes.tipoPrazo,
        selecionada: cotacaoOpcoes.selecionada
      }).from(cotacaoOpcoes).where(eq2(cotacaoOpcoes.cotacaoId, c.id));
      const escolhida = ops.find((o) => o.selecionada === "sim") ?? ops.filter((o) => Number(o.valorFrete) > 0).sort((a, b) => Number(a.valorFrete) - Number(b.valorFrete))[0] ?? null;
      let volumes = [];
      try {
        volumes = c.volumesJson ? JSON.parse(c.volumesJson) : [];
      } catch {
        volumes = [];
      }
      if (volumes.length === 0 && (c.dimensoesLargura || c.dimensoesAltura)) {
        volumes = [{
          largura: c.dimensoesLargura,
          comprimento: c.dimensoesComprimento,
          altura: c.dimensoesAltura,
          peso: c.pesoKg
        }];
      }
      const pesoTotal = volumes.reduce((s, v) => s + (Number(v.peso) || 0), 0) || Number(c.pesoKg ?? 0);
      y += 6;
      escreve(`OS ${c.osNumero ?? `#${c.id}`}  \xB7  ${(c.modalidadeFrete ?? "cif").toUpperCase()}`, true, 11);
      escreve(`Destinat\xE1rio: ${c.destinatarioNome ?? "\u2014"}   |   CNPJ: ${c.destinatarioCnpj ?? "\u2014"}`);
      escreve(`CEP: ${c.cepDestino ?? "\u2014"}   |   Cidade/UF: ${c.municipio ?? "\u2014"}/${c.estado ?? "\u2014"}`);
      escreve(`Aprova\xE7\xE3o da OS: ${c.osAprovacao ?? "\u2014"}   |   Entrega prevista: ${c.osEntrega ?? "\u2014"}`);
      escreve(`Vendedor: ${c.osVendedor ?? "\u2014"}   |   Solicitante: ${c.solicitanteNome ?? "\u2014"}`);
      escreve(`Empacotadores: ${c.empacotadores ?? "\u2014"}`);
      escreve(`Volumes: ${volumes.length || Number(c.quantidadeVolumes ?? 0)}   |   Peso total: ${pesoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kg`);
      volumes.forEach((v, i) => {
        escreve(`   Vol ${i + 1}: ${Number(v.largura ?? 0)}\xD7${Number(v.comprimento ?? 0)}\xD7${Number(v.altura ?? 0)} cm \xB7 ${Number(v.peso ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kg`);
      });
      const prazo = escolhida?.prazoDias != null ? `${escolhida.prazoDias} dias ${escolhida.tipoPrazo === "corridos" ? "corridos" : "\xFAteis"}` : "\u2014";
      escreve(`Transportadora: ${escolhida?.transportadoraNome ?? "\u2014"}   |   Frete: ${moeda(escolhida?.valorFrete)}   |   Prazo: ${prazo}`);
      if (c.observacoes) escreve(`Observa\xE7\xF5es: ${c.observacoes}`);
      escreve("Recebido por: ______________________________   Data: ____/____/______");
      y += 4;
    }
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    return {
      pdfBase64,
      fileName: `romaneio-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.pdf`,
      totalPedidos: cotacoes.length
    };
  }),
  list: publicProcedure.input(z.object({
    status: z.string().optional(),
    solicitanteId: z.string().optional(),
    page: z.number().optional().default(1),
    pageSize: z.number().optional().default(15)
  })).query(async ({ input }) => {
    const result = await listarCotacoesFrete(input.page, input.pageSize || 15, input.status);
    return {
      data: result.data,
      pagination: {
        page: result.pagination.page,
        pageSize: result.pagination.pageSize,
        totalRegistros: result.pagination.total,
        totalPages: result.pagination.totalPages,
        hasNextPage: input.page < result.pagination.totalPages,
        hasPrevPage: input.page > 1
      }
    };
  }),
  // ✅ NOVO: Buscar detalhes completos (sob demanda, após clicar)
  getDetalhes: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    console.log("\u{1F50D} [DETALHES] Buscando cota\xE7\xE3o completa ID:", input.id);
    const c = await obterCotacaoDetalhes(input.id);
    const opcoes = await listarOpcoesFrete(input.id);
    const comentarios = await db2.select().from(cotacaoComentarios).where(eq2(cotacaoComentarios.cotacaoId, input.id)).orderBy(desc2(cotacaoComentarios.createdAt));
    console.log("\u2705 [DETALHES] Retornando cota\xE7\xE3o completa com", opcoes.length, "op\xE7\xF5es");
    return { ...c, opcoes, comentarios };
  }),
  get: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const c = await obterCotacaoDetalhes(input.id);
    const opcoes = await listarOpcoesFrete(input.id);
    const comentarios = await db2.select().from(cotacaoComentarios).where(eq2(cotacaoComentarios.cotacaoId, input.id)).orderBy(cotacaoComentarios.createdAt);
    return { ...c, opcoes, comentarios };
  }),
  create: publicProcedure.input(z.object({
    solicitanteId: z.string().optional(),
    solicitanteNome: z.string().optional(),
    destinatarioNome: z.string(),
    destinatarioCnpj: z.string().optional(),
    cepDestino: z.string().optional(),
    municipio: z.string(),
    estado: z.string().length(2),
    dimensoesLargura: z.string().optional(),
    dimensoesAltura: z.string().optional(),
    dimensoesComprimento: z.string().optional(),
    pesoKg: z.string().optional(),
    valorNf: z.string().optional(),
    observacoes: z.string().optional(),
    observacaoGol: z.string().optional(),
    fotoUrl: z.string().optional(),
    empacotamentoPedidoId: z.number().optional(),
    empacotamentoPedidoNumero: z.string().optional(),
    tipoMaterial: z.string().optional(),
    dataEntregaPrevista: z.string().optional(),
    dimensoes: z.string().optional(),
    // legado — mantido para compatibilidade
    osNumero: z.string().optional(),
    volumesJson: z.string().optional(),
    quantidadeVolumes: z.number().optional(),
    pedidoCnpj: z.string().optional(),
    pedidoEndereco: z.string().optional(),
    pedidoCep: z.string().optional(),
    empacotadores: z.string().optional(),
    // Dados próprios da OS consultada (cache/API MubiSys)
    osAprovacao: z.string().optional(),
    osEntrega: z.string().optional(),
    osVendedor: z.string().optional()
  })).mutation(async ({ input }) => {
    let dimensoesLargura = null;
    let dimensoesAltura = null;
    let dimensoesComprimento = null;
    let pesoKg = null;
    if (input.dimensoes) {
      try {
        const volumes = JSON.parse(input.dimensoes);
        if (Array.isArray(volumes) && volumes.length > 0) {
          const v = volumes[0];
          dimensoesLargura = Number(v.largura) || null;
          dimensoesAltura = Number(v.altura) || null;
          dimensoesComprimento = Number(v.comprimento) || null;
          pesoKg = volumes.reduce((acc, vol) => acc + (Number(vol.peso) || 0), 0) || null;
        }
      } catch (e) {
        console.error("\u274C Erro ao parsear dimens\xF5es:", e);
      }
    }
    if (!pesoKg && input.pesoKg) {
      pesoKg = parseFloat(input.pesoKg);
    }
    const insertData = {};
    insertData.destinatarioNome = input.destinatarioNome;
    insertData.municipio = input.municipio;
    insertData.estado = input.estado;
    if (input.solicitanteId) insertData.solicitanteId = input.solicitanteId;
    if (input.solicitanteNome) insertData.solicitanteNome = input.solicitanteNome;
    if (input.destinatarioCnpj) insertData.destinatarioCnpj = input.destinatarioCnpj;
    if (input.cepDestino) insertData.cepDestino = input.cepDestino;
    if (dimensoesLargura !== null) insertData.dimensoesLargura = dimensoesLargura.toString();
    if (dimensoesAltura !== null) insertData.dimensoesAltura = dimensoesAltura.toString();
    if (dimensoesComprimento !== null) insertData.dimensoesComprimento = dimensoesComprimento.toString();
    if (pesoKg !== null && pesoKg > 0) insertData.pesoKg = pesoKg.toString();
    if (input.valorNf) insertData.valorNf = input.valorNf;
    if (input.observacoes) insertData.observacoes = input.observacoes;
    if (input.observacaoGol) insertData.observacaoGol = input.observacaoGol;
    if (input.fotoUrl) insertData.fotoUrl = input.fotoUrl;
    if (input.empacotamentoPedidoId) insertData.empacotamentoPedidoId = input.empacotamentoPedidoId;
    if (input.empacotamentoPedidoNumero) insertData.empacotamentoPedidoNumero = input.empacotamentoPedidoNumero;
    if (input.tipoMaterial) insertData.tipoMaterial = input.tipoMaterial;
    if (input.dataEntregaPrevista) insertData.dataEntregaPrevista = input.dataEntregaPrevista;
    if (input.osNumero) insertData.osNumero = input.osNumero;
    if (input.volumesJson || input.dimensoes) insertData.volumesJson = input.volumesJson || input.dimensoes;
    if (input.quantidadeVolumes) insertData.quantidadeVolumes = input.quantidadeVolumes;
    if (input.empacotadores) insertData.empacotadores = input.empacotadores;
    if (input.osAprovacao) insertData.osAprovacao = input.osAprovacao;
    if (input.osEntrega || input.dataEntregaPrevista) insertData.osEntrega = input.osEntrega || input.dataEntregaPrevista;
    if (input.osVendedor) insertData.osVendedor = input.osVendedor;
    try {
      const [resultado] = await db2.insert(cotacoesFrete).values(insertData).returning({ id: cotacoesFrete.id });
      console.log("\u2705 [CREATE] Cota\xE7\xE3o criada com sucesso! ID:", resultado.id);
      return { success: true, id: resultado.id };
    } catch (error) {
      console.error("\u274C [CREATE] ERRO:", error);
      throw new TRPCError2({
        code: "INTERNAL_SERVER_ERROR",
        message: `Erro ao criar cota\xE7\xE3o: ${error.message}`
      });
    }
  }),
  update: publicProcedure.input(z.object({
    id: z.number(),
    destinatarioNome: z.string().optional(),
    destinatarioCnpj: z.string().optional(),
    municipio: z.string().optional(),
    estado: z.string().optional(),
    cepDestino: z.string().optional(),
    pesoKg: z.string().optional(),
    valorNf: z.string().optional(),
    observacoes: z.string().optional(),
    observacaoGol: z.string().optional(),
    solicitanteNome: z.string().optional(),
    horarioDecisaoMs: z.string().optional(),
    dataEntregaPrevista: z.string().optional(),
    modalidadeFrete: z.enum(["cif", "fob"]).nullable().optional(),
    fotosJson: z.string().optional()
  })).mutation(async ({ input }) => {
    const { id, ...fields } = input;
    const sets = {};
    if (fields.destinatarioNome !== void 0) sets.destinatarioNome = fields.destinatarioNome;
    if (fields.destinatarioCnpj !== void 0) sets.destinatarioCnpj = fields.destinatarioCnpj;
    if (fields.municipio !== void 0) sets.municipio = fields.municipio;
    if (fields.estado !== void 0) sets.estado = fields.estado;
    if (fields.cepDestino !== void 0) sets.cepDestino = fields.cepDestino;
    if (fields.pesoKg !== void 0) sets.pesoKg = fields.pesoKg;
    if (fields.valorNf !== void 0) sets.valorNf = fields.valorNf;
    if (fields.observacoes !== void 0) sets.observacoes = fields.observacoes;
    if (fields.observacaoGol !== void 0) sets.observacaoGol = fields.observacaoGol;
    if (fields.solicitanteNome !== void 0) sets.solicitanteNome = fields.solicitanteNome;
    if (fields.horarioDecisaoMs !== void 0) sets.horarioDecisaoMs = fields.horarioDecisaoMs;
    if (fields.dataEntregaPrevista !== void 0) sets.dataEntregaPrevista = fields.dataEntregaPrevista;
    if (fields.modalidadeFrete !== void 0) sets.modalidadeFrete = fields.modalidadeFrete;
    if (fields.fotosJson !== void 0) sets.fotosJson = fields.fotosJson;
    if (Object.keys(sets).length === 0) return { ok: true };
    sets.updatedAt = /* @__PURE__ */ new Date();
    await db2.update(cotacoesFrete).set(sets).where(eq2(cotacoesFrete.id, id));
    return { ok: true };
  }),
  listMinhas: publicProcedure.input(z.object({ solicitanteId: z.string().optional(), solicitanteNome: z.string().optional() })).query(async ({ input }) => {
    let rows = await db2.select().from(cotacoesFrete).orderBy(desc2(cotacoesFrete.createdAt));
    if (input.solicitanteId) {
      rows = rows.filter((r) => r.solicitanteId === input.solicitanteId);
    } else if (input.solicitanteNome) {
      const nome = input.solicitanteNome.toLowerCase().trim();
      rows = rows.filter((r) => (r.solicitanteNome ?? "").toLowerCase().trim() === nome);
    }
    const ids = rows.map((r) => r.id);
    const opcoes = await listarOpcoesPorCotacoes(ids);
    return rows.map((c) => ({
      ...c,
      opcoes: opcoes.filter((o) => o.cotacaoId === c.id).map(normalizarOpcao)
    }));
  }),
  updateStatus: publicProcedure.input(z.object({
    id: z.number(),
    status: z.enum(["aberta", "cotando", "selecao", "cotada", "enviada", "cancelada"])
  })).mutation(async ({ input }) => {
    const result = await db2.update(cotacoesFrete).set({ status: input.status, updatedAt: /* @__PURE__ */ new Date() }).where(eq2(cotacoesFrete.id, input.id)).returning({ id: cotacoesFrete.id });
    console.log(`\u2705 [UPDATE-STATUS] Cota\xE7\xE3o #${input.id} \u2192 ${input.status} (${result.length} linha(s))`);
    if (result.length === 0) {
      throw new TRPCError2({ code: "NOT_FOUND", message: `Cota\xE7\xE3o #${input.id} n\xE3o encontrada` });
    }
    return { ok: true, id: input.id, status: input.status };
  }),
  /**
   * Anexa fotografias à cotação. As imagens já sobem direto para o
   * UploadThing pelo client; aqui só gravamos as URLs em `fotosJson`.
   */
  uploadFotos: publicProcedure.input(z.object({
    id: z.number(),
    fotos: z.array(z.object({
      nome: z.string(),
      url: z.string().url(),
      key: z.string().min(1),
      tipo: z.string().optional()
    })).min(1).max(10)
  })).mutation(async ({ input }) => {
    const [atual] = await getDb2().select({ fotosJson: cotacoesFrete.fotosJson }).from(cotacoesFrete).where(eq2(cotacoesFrete.id, input.id));
    if (!atual) {
      throw new TRPCError2({ code: "NOT_FOUND", message: `Cota\xE7\xE3o #${input.id} n\xE3o encontrada` });
    }
    let urls = [];
    try {
      urls = atual.fotosJson ? JSON.parse(atual.fotosJson) : [];
    } catch {
      urls = [];
    }
    for (const foto of input.fotos) {
      urls.push(foto.url);
    }
    await db2.update(cotacoesFrete).set({ fotosJson: JSON.stringify(urls), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(cotacoesFrete.id, input.id));
    console.log(`\u2705 [FOTOS] Cota\xE7\xE3o #${input.id} agora tem ${urls.length} foto(s)`);
    return { ok: true, fotos: urls };
  }),
  /** Remove uma fotografia da cotação pelo índice. */
  removerFoto: publicProcedure.input(z.object({ id: z.number(), indice: z.number().min(0) })).mutation(async ({ input }) => {
    const [row] = await getDb2().select({ fotosJson: cotacoesFrete.fotosJson }).from(cotacoesFrete).where(eq2(cotacoesFrete.id, input.id));
    if (!row) {
      throw new TRPCError2({ code: "NOT_FOUND", message: `Cota\xE7\xE3o #${input.id} n\xE3o encontrada` });
    }
    let urls = [];
    try {
      urls = row.fotosJson ? JSON.parse(row.fotosJson) : [];
    } catch {
      urls = [];
    }
    urls.splice(input.indice, 1);
    await db2.update(cotacoesFrete).set({ fotosJson: JSON.stringify(urls), updatedAt: /* @__PURE__ */ new Date() }).where(eq2(cotacoesFrete.id, input.id));
    return { ok: true, fotos: urls };
  }),
  addOpcao: publicProcedure.input(z.object({
    cotacaoId: z.number(),
    transportadoraId: z.number().optional(),
    transportadoraNome: z.string(),
    valorFrete: z.string(),
    prazoDias: z.number().optional(),
    tipoPrazo: z.enum(["uteis", "corridos"]).optional().default("uteis"),
    modal: z.string().optional(),
    observacoes: z.string().optional()
  })).mutation(async ({ input }) => {
    const res = await adicionarOpcaoFrete({
      cotacaoId: input.cotacaoId,
      transportadoraId: input.transportadoraId ?? null,
      transportadoraNome: input.transportadoraNome,
      valorFrete: input.valorFrete,
      prazoDias: input.prazoDias ?? null,
      tipoPrazo: input.tipoPrazo,
      observacoes: input.observacoes ?? null
    });
    return { ok: true, id: res.id, duplicada: res.duplicada };
  }),
  listOpcoes: publicProcedure.input(z.object({ cotacaoId: z.number() })).query(async ({ input }) => {
    return await listarOpcoesFrete(input.cotacaoId);
  }),
  updateOpcao: publicProcedure.input(z.object({
    opcaoId: z.number(),
    valorFrete: z.string().optional(),
    prazoDias: z.number().optional(),
    tipoPrazo: z.enum(["uteis", "corridos"]).optional().default("uteis"),
    observacoes: z.string().optional()
  })).mutation(async ({ input }) => {
    await atualizarOpcaoFrete(input.opcaoId, {
      valorFrete: input.valorFrete,
      prazoDias: input.prazoDias,
      tipoPrazo: input.tipoPrazo,
      observacoes: input.observacoes
    });
    return { ok: true };
  }),
  removeOpcao: publicProcedure.input(z.object({ opcaoId: z.number() })).mutation(async ({ input }) => {
    await removerOpcaoFrete(input.opcaoId);
    return { ok: true };
  }),
  selecionarOpcao: publicProcedure.input(z.object({ cotacaoId: z.number(), opcaoId: z.number() })).mutation(async ({ input }) => {
    return await selecionarOpcaoFrete(input.cotacaoId, input.opcaoId);
  }),
  addComentario: publicProcedure.input(z.object({
    cotacaoId: z.number(),
    autorNome: z.string().default("Equipe"),
    texto: z.string()
  })).mutation(async ({ input }) => {
    await db2.insert(cotacaoComentarios).values(input);
    return { ok: true };
  }),
  deleteComentario: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    await db2.delete(cotacaoComentarios).where(eq2(cotacaoComentarios.id, input.id));
    return { ok: true };
  }),
  delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const { excluirCotacaoFrete: excluirCotacaoFrete2 } = await Promise.resolve().then(() => (init_db_helpers_select(), db_helpers_select_exports));
    await excluirCotacaoFrete2(input.id);
    return { ok: true };
  }),
  deleteByEmpacotamentoPedidoId: publicProcedure.input(z.object({ empacotamentoPedidoId: z.number() })).mutation(async ({ input }) => {
    const rows = await db2.select().from(cotacoesFrete).where(eq2(cotacoesFrete.empacotamentoPedidoId, input.empacotamentoPedidoId));
    for (const row of rows) {
      await db2.delete(cotacaoOpcoes).where(eq2(cotacaoOpcoes.cotacaoId, row.id));
      await db2.delete(cotacaoComentarios).where(eq2(cotacaoComentarios.cotacaoId, row.id));
    }
    await db2.delete(cotacoesFrete).where(eq2(cotacoesFrete.empacotamentoPedidoId, input.empacotamentoPedidoId));
    return { ok: true, deletados: rows.length };
  }),
  dashboard: publicProcedure.query(async () => {
    const todas = await db2.select().from(cotacoesFrete).orderBy(desc2(cotacoesFrete.createdAt));
    const total = todas.length;
    const concluidas = todas.filter((c) => c.status === "enviada").length;
    const emAndamento = todas.filter((c) => ["cotando", "selecao", "cotada"].includes(c.status)).length;
    const fila = todas.filter((c) => c.status === "aberta").length;
    const limite = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3);
    const recentes = todas.filter((c) => new Date(c.createdAt) >= limite);
    const porMes = {};
    todas.forEach((c) => {
      const d = new Date(c.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      porMes[key] = (porMes[key] ?? 0) + 1;
    });
    return { total, concluidas, emAndamento, fila, recentes: recentes.length, porMes };
  }),
  // Busca dados do cliente pelo número da OS: tenta Mubisys primeiro, depois BrasilAPI pelo CNPJ
  buscarDadosOs: publicProcedure.input(z.object({
    numeroOs: z.string().optional(),
    cnpj: z.string().optional()
  })).query(async ({ input }) => {
    if (input.numeroOs) {
      const doCache = await buscarDadosOSParaFrete(input.numeroOs);
      if (doCache && (doCache.municipio || doCache.cep)) {
        return {
          fonte: "cache",
          nomeCliente: doCache.clienteNome,
          cnpj: doCache.clienteCnpj,
          cep: doCache.cep,
          endereco: doCache.endereco,
          cidade: doCache.municipio,
          estado: doCache.estado,
          valorNf: doCache.valor_nf ? String(doCache.valor_nf) : "",
          vendedor: doCache.vendedor ?? "",
          dataEntregaPrevista: doCache.entrega ?? "",
          dataAprovacao: doCache.aprovacao ?? ""
        };
      }
      const mub = await fetchDadosOsMub(input.numeroOs);
      if (mub && (mub.cidade || mub.cep)) {
        return { fonte: "mub", ...mub };
      }
    }
    const cnpjLimpo = (input.cnpj ?? "").replace(/\D/g, "");
    if (cnpjLimpo.length === 14) {
      try {
        const resp = await new Promise((resolve, reject) => {
          const req = https.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`, { headers: { "Accept": "application/json" } }, (res) => {
            let body = "";
            res.on("data", (c) => body += c);
            res.on("end", () => resolve(body));
          });
          req.on("error", reject);
          req.setTimeout(8e3, () => {
            req.destroy();
            reject(new Error("timeout"));
          });
        });
        const d = JSON.parse(resp);
        if (d && d.municipio) {
          const cepFmt = (d.cep ?? "").replace(/\D/g, "");
          return {
            fonte: "brasilapi",
            nomeCliente: d.razao_social ?? "",
            cnpj: cnpjLimpo.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
            cep: cepFmt,
            endereco: [d.logradouro, d.numero, d.complemento, d.bairro].filter(Boolean).join(", "),
            cidade: d.municipio ?? "",
            estado: d.uf ?? "",
            valorNf: "",
            vendedor: "",
            dataEntregaPrevista: "",
            dataAprovacao: ""
          };
        }
      } catch {
      }
    }
    return null;
  }),
  assertividade: publicProcedure.input(z.object({
    de: z.string().optional(),
    ate: z.string().optional()
  })).query(async ({ input }) => {
    const rows = await db2.select().from(cotacoesFrete).where(eq2(cotacoesFrete.status, "enviada")).orderBy(desc2(cotacoesFrete.dataDespacho));
    const comDatas = rows.filter((r) => r.dataDespacho && r.dataEntregaPrevista);
    let filtrados = comDatas;
    if (input.de) {
      const de = new Date(input.de);
      filtrados = filtrados.filter((r) => new Date(r.dataDespacho) >= de);
    }
    if (input.ate) {
      const ate = new Date(input.ate);
      ate.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter((r) => new Date(r.dataDespacho) <= ate);
    }
    const total = filtrados.length;
    const noPrazo = filtrados.filter((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      return despacho <= previsto;
    });
    const antecipados = filtrados.filter((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      const diffDias = (previsto.getTime() - despacho.getTime()) / (1e3 * 60 * 60 * 24);
      return diffDias > 1;
    });
    const atrasados = filtrados.filter((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      return despacho > previsto;
    });
    const pedidos = filtrados.map((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      const diffDias = Math.round((despacho.getTime() - previsto.getTime()) / (1e3 * 60 * 60 * 24));
      return {
        id: r.id,
        destinatarioNome: r.destinatarioNome,
        municipio: r.municipio,
        estado: r.estado,
        empacotamentoPedidoNumero: r.empacotamentoPedidoNumero,
        tipoMaterial: r.tipoMaterial,
        dataEntregaPrevista: r.dataEntregaPrevista,
        dataDespacho: r.dataDespacho,
        diffDias,
        situacao: diffDias > 1 ? "antecipado" : diffDias <= 0 ? "no_prazo" : "atrasado"
      };
    });
    return {
      total,
      noPrazo: noPrazo.length,
      antecipados: antecipados.length,
      atrasados: atrasados.length,
      pctNoPrazo: total > 0 ? Math.round(noPrazo.length / total * 100) : 0,
      pctAntecipados: total > 0 ? Math.round(antecipados.length / total * 100) : 0,
      pctAtrasados: total > 0 ? Math.round(atrasados.length / total * 100) : 0,
      pedidos
    };
  }),
  // ── Marcar/desmarcar retrabalho em uma cotação ──────────────────────────────
  marcarRetrabalho: publicProcedure.input(z.object({
    id: z.number(),
    temRetrabalho: z.boolean(),
    tipoRetrabalho: z.string().optional(),
    motivoRetrabalho: z.string().optional(),
    retrabalhoVinculadoId: z.number().optional()
  })).mutation(async ({ input }) => {
    await db2.update(cotacoesFrete).set({
      temRetrabalho: input.temRetrabalho,
      tipoRetrabalho: input.tipoRetrabalho ?? null,
      motivoRetrabalho: input.motivoRetrabalho ?? null,
      retrabalhoVinculadoId: input.retrabalhoVinculadoId ?? null
    }).where(eq2(cotacoesFrete.id, input.id));
    return { ok: true };
  }),
  // ── Métricas de retrabalho nos pedidos atrasados ────────────────────────────
  metricasRetrabalho: publicProcedure.input(z.object({
    de: z.string().optional(),
    ate: z.string().optional()
  })).query(async ({ input }) => {
    const todos = await db2.select().from(cotacoesFrete).where(eq2(cotacoesFrete.status, "enviada"));
    const comDatas = todos.filter((r) => r.dataDespacho && r.dataEntregaPrevista);
    let filtrados = comDatas;
    if (input.de) {
      const de = new Date(input.de);
      filtrados = filtrados.filter((r) => new Date(r.dataDespacho) >= de);
    }
    if (input.ate) {
      const ate = new Date(input.ate);
      ate.setHours(23, 59, 59, 999);
      filtrados = filtrados.filter((r) => new Date(r.dataDespacho) <= ate);
    }
    const atrasados = filtrados.filter((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      return despacho > previsto;
    });
    const totalAtrasados = atrasados.length;
    const atrasadosComRetrabalho = atrasados.filter((r) => r.temRetrabalho);
    const pctAtrasadosComRetrabalho = totalAtrasados > 0 ? Math.round(atrasadosComRetrabalho.length / totalAtrasados * 100) : 0;
    const tipoMap = {};
    atrasadosComRetrabalho.forEach((r) => {
      const tipo = r.tipoRetrabalho ?? "N\xE3o categorizado";
      tipoMap[tipo] = (tipoMap[tipo] ?? 0) + 1;
    });
    const distribuicaoPorTipo = Object.entries(tipoMap).map(([tipo, count3]) => ({ tipo, count: count3, pct: Math.round(count3 / (atrasadosComRetrabalho.length || 1) * 100) })).sort((a, b) => b.count - a.count);
    const agora = /* @__PURE__ */ new Date();
    const tendencia = [];
    for (let i = 5; i >= 0; i--) {
      const mes = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
      const fimMes = new Date(agora.getFullYear(), agora.getMonth() - i + 1, 0, 23, 59, 59);
      const atrasadosMes = filtrados.filter((r) => {
        const d = new Date(r.dataDespacho);
        const p = new Date(r.dataEntregaPrevista);
        return d > p && d >= mes && d <= fimMes;
      });
      const comRetMes = atrasadosMes.filter((r) => r.temRetrabalho).length;
      tendencia.push({
        mes: mes.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        totalAtrasados: atrasadosMes.length,
        comRetrabalho: comRetMes,
        pct: atrasadosMes.length > 0 ? Math.round(comRetMes / atrasadosMes.length * 100) : 0
      });
    }
    const lista = atrasados.map((r) => {
      const despacho = new Date(r.dataDespacho);
      const previsto = new Date(r.dataEntregaPrevista);
      const diffDias = Math.round((despacho.getTime() - previsto.getTime()) / (1e3 * 60 * 60 * 24));
      return {
        id: r.id,
        empacotamentoPedidoNumero: r.empacotamentoPedidoNumero,
        destinatarioNome: r.destinatarioNome,
        municipio: r.municipio,
        estado: r.estado,
        tipoMaterial: r.tipoMaterial,
        dataEntregaPrevista: r.dataEntregaPrevista,
        dataDespacho: r.dataDespacho,
        diffDias,
        temRetrabalho: r.temRetrabalho ?? false,
        tipoRetrabalho: r.tipoRetrabalho,
        motivoRetrabalho: r.motivoRetrabalho
      };
    });
    return {
      totalAtrasados,
      comRetrabalho: atrasadosComRetrabalho.length,
      semRetrabalho: totalAtrasados - atrasadosComRetrabalho.length,
      pctComRetrabalho: pctAtrasadosComRetrabalho,
      distribuicaoPorTipo,
      tendencia,
      lista
    };
  })
});
var cteRouter = router({
  list: publicProcedure.input(z.object({ transportadoraId: z.number().optional() })).query(async ({ input }) => {
    let rows = await db2.select().from(cteImportacoes).orderBy(desc2(cteImportacoes.createdAt));
    if (input.transportadoraId) rows = rows.filter((r) => r.transportadoraId === input.transportadoraId);
    return rows;
  }),
  importar: publicProcedure.input(z.array(z.object({
    numeroCte: z.string(),
    transportadoraId: z.number().optional(),
    transportadoraNome: z.string().optional(),
    valor: z.string().optional(),
    dataEmissao: z.string().optional(),
    remetente: z.string().optional(),
    destinatario: z.string().optional(),
    municipioDestino: z.string().optional(),
    estadoDestino: z.string().optional()
  }))).mutation(async ({ input }) => {
    let inserted = 0;
    for (const item of input) {
      try {
        await db2.insert(cteImportacoes).values({
          ...item,
          dataEmissao: item.dataEmissao ? new Date(item.dataEmissao) : void 0
        });
        inserted++;
      } catch {
      }
    }
    return { inserted };
  }),
  create: publicProcedure.input(z.object({
    numeroCte: z.string(),
    transportadoraId: z.number().optional(),
    transportadoraNome: z.string().optional(),
    valor: z.string().optional(),
    dataEmissao: z.string().optional(),
    remetente: z.string().optional(),
    destinatario: z.string().optional(),
    municipioDestino: z.string().optional(),
    estadoDestino: z.string().optional()
  })).mutation(async ({ input }) => {
    let transportadoraNome = input.transportadoraNome;
    if (input.transportadoraId && !transportadoraNome) {
      const [t2] = await db2.select().from(transportadoras).where(eq2(transportadoras.id, input.transportadoraId));
      transportadoraNome = t2?.nome;
    }
    const [result] = await db2.insert(cteImportacoes).values({
      ...input,
      transportadoraNome,
      dataEmissao: input.dataEmissao ? new Date(input.dataEmissao) : void 0
    }).returning({ id: cteImportacoes.id });
    return { id: result.id };
  }),
  stats: publicProcedure.query(async () => {
    const rows = await db2.select().from(cteImportacoes);
    const total = rows.length;
    const totalValor = rows.reduce((acc, r) => acc + parseFloat((r.valor ?? "0").replace(",", ".")), 0);
    const transportadoraMap = {};
    rows.forEach((r) => {
      const nome = r.transportadoraNome ?? "Desconhecida";
      if (!transportadoraMap[nome]) transportadoraMap[nome] = { total: 0, totalValor: 0 };
      transportadoraMap[nome].total += 1;
      transportadoraMap[nome].totalValor += parseFloat((r.valor ?? "0").replace(",", "."));
    });
    const porTransportadora = Object.entries(transportadoraMap).map(([transportadoraNome, v]) => ({ transportadoraNome, ...v })).sort((a, b) => b.total - a.total);
    return { total, totalValor, porTransportadora };
  }),
  // ───── FRETE AUTOMÁTICO ─────────────────────────────────────────────────────
  buscarDadosOS: publicProcedure.input(z.object({ osNumero: z.string() })).query(async ({ input }) => {
    try {
      const dados = await buscarDadosOSParaFrete(input.osNumero);
      return dados;
    } catch (error) {
      console.error("[Frete] Erro ao buscar OS:", error);
      return null;
    }
  }),
  obterCotacoes: publicProcedure.input(z.object({
    municipio: z.string(),
    estado: z.string(),
    peso_kg: z.number().positive(),
    valor_nf: z.number().positive()
  })).query(async ({ input }) => {
    try {
      const cotacoes = await obterCotacoesFreteSimuladas(
        input.municipio,
        input.estado,
        input.peso_kg,
        input.valor_nf
      );
      return cotacoes;
    } catch (error) {
      console.error("[Frete] Erro ao obter cota\xE7\xF5es:", error);
      return [];
    }
  })
});

// server/routers/qualidade.ts
import { z as z2 } from "zod";
init_llm();
init_db();

// server/db/alertas-helpers.ts
init_schema();
init_db();
async function criarAlerta(params) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.insert(alertasSistema).values({
    tipo: params.tipo,
    severidade: params.severidade,
    titulo: params.titulo,
    descricao: params.descricao ?? null,
    referenciaId: params.referenciaId ?? null,
    referenciaTipo: params.referenciaTipo ?? null,
    referenciaExtra: params.referenciaExtra ?? null,
    status: "ativo"
  });
}

// server/routers/qualidade.ts
init_schema();
import { eq as eq4, desc as desc4, and as and4, gte as gte2, lte as lte2, sql as sql3, isNull, lt } from "drizzle-orm";
var acoesCorretivasRouter = router({
  // Listar ações corretivas (com filtros)
  list: publicProcedure.input(z2.object({
    retrabalhoid: z2.number().optional(),
    status: z2.enum(["aberto", "em_tratamento", "resolvido"]).optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    let rows = await db5.select().from(acoesCorretivas).orderBy(desc4(acoesCorretivas.createdAt));
    if (input?.retrabalhoid) rows = rows.filter((r) => r.retrabalhoid === input.retrabalhoid);
    if (input?.status) rows = rows.filter((r) => r.status === input.status);
    return rows;
  }),
  // Buscar ação corretiva por retrabalho ID
  getByRetrabalho: publicProcedure.input(z2.object({ retrabalhoid: z2.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(acoesCorretivas).where(eq4(acoesCorretivas.retrabalhoid, input.retrabalhoid)).orderBy(desc4(acoesCorretivas.createdAt)).limit(1);
    return rows[0] ?? null;
  }),
  // Criar ou atualizar ação corretiva
  upsert: publicProcedure.input(z2.object({
    retrabalhoid: z2.number(),
    status: z2.enum(["aberto", "em_tratamento", "resolvido"]),
    acaoTomada: z2.string().optional(),
    responsavel: z2.string().optional(),
    prazoResolucao: z2.string().optional(),
    // ISO date string
    custoAdicional: z2.number().optional(),
    observacoes: z2.string().optional(),
    registradoPor: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const existing = await db5.select().from(acoesCorretivas).where(eq4(acoesCorretivas.retrabalhoid, input.retrabalhoid)).limit(1);
    const dataResolucao = input.status === "resolvido" ? /* @__PURE__ */ new Date() : null;
    const prazoResolucao = input.prazoResolucao ? new Date(input.prazoResolucao) : null;
    if (existing.length > 0) {
      await db5.update(acoesCorretivas).set({
        status: input.status,
        acaoTomada: input.acaoTomada ?? null,
        responsavel: input.responsavel ?? null,
        prazoResolucao,
        dataResolucao,
        custoAdicional: input.custoAdicional ? String(input.custoAdicional) : "0",
        observacoes: input.observacoes ?? null,
        registradoPor: input.registradoPor ?? null
      }).where(eq4(acoesCorretivas.retrabalhoid, input.retrabalhoid));
      return { id: existing[0].id, action: "updated" };
    } else {
      const [result] = await db5.insert(acoesCorretivas).values({
        retrabalhoid: input.retrabalhoid,
        status: input.status,
        acaoTomada: input.acaoTomada ?? null,
        responsavel: input.responsavel ?? null,
        prazoResolucao,
        dataResolucao,
        custoAdicional: input.custoAdicional ? String(input.custoAdicional) : "0",
        observacoes: input.observacoes ?? null,
        registradoPor: input.registradoPor ?? null
      }).returning({ id: acoesCorretivas.id });
      return { id: result.id, action: "created" };
    }
  }),
  // Estatísticas de ações corretivas
  stats: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return { abertos: 0, emTratamento: 0, resolvidos: 0, semAcao: 0, prazoVencido: 0 };
    const all = await db5.select().from(acoesCorretivas);
    const agora = /* @__PURE__ */ new Date();
    return {
      abertos: all.filter((a) => a.status === "aberto").length,
      emTratamento: all.filter((a) => a.status === "em_tratamento").length,
      resolvidos: all.filter((a) => a.status === "resolvido").length,
      prazoVencido: all.filter(
        (a) => a.status !== "resolvido" && a.prazoResolucao && new Date(a.prazoResolucao) < agora
      ).length
    };
  })
});
var metasRetrabalhoRouter = router({
  // Listar metas
  list: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(metasRetrabalho).orderBy(desc4(metasRetrabalho.ano), desc4(sql3`COALESCE(${metasRetrabalho.mes}, 0)`));
  }),
  // Meta vigente (ano atual, sem mês específico = meta anual)
  vigente: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return null;
    const anoAtual = (/* @__PURE__ */ new Date()).getFullYear();
    const mesAtual = (/* @__PURE__ */ new Date()).getMonth() + 1;
    const rows = await db5.select().from(metasRetrabalho).where(eq4(metasRetrabalho.ano, anoAtual)).orderBy(desc4(sql3`COALESCE(${metasRetrabalho.mes}, 0)`));
    const metaMes = rows.find((r) => r.mes === mesAtual);
    const metaAnual = rows.find((r) => r.mes === null);
    return metaMes ?? metaAnual ?? null;
  }),
  // Criar ou atualizar meta
  upsert: publicProcedure.input(z2.object({
    ano: z2.number(),
    mes: z2.number().optional(),
    metaMaxRetrabalhosMes: z2.number().optional(),
    metaMaxCustoMes: z2.number().optional(),
    metaMaxPercFaturamento: z2.number().optional(),
    metaMaxPercEvitaveis: z2.number().optional(),
    metaMinResolucaoDias: z2.number().optional(),
    metaMaxReincidencias: z2.number().optional(),
    metasPorSetor: z2.string().optional(),
    observacoes: z2.string().optional(),
    criadoPor: z2.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const existing = await db5.select().from(metasRetrabalho).where(and4(
      eq4(metasRetrabalho.ano, input.ano),
      input.mes ? eq4(metasRetrabalho.mes, input.mes) : isNull(metasRetrabalho.mes)
    )).limit(1);
    const values = {
      metaMaxRetrabalhosMes: input.metaMaxRetrabalhosMes ?? null,
      metaMaxCustoMes: input.metaMaxCustoMes ? String(input.metaMaxCustoMes) : null,
      metaMaxPercFaturamento: input.metaMaxPercFaturamento ? String(input.metaMaxPercFaturamento) : null,
      metaMaxPercEvitaveis: input.metaMaxPercEvitaveis ? String(input.metaMaxPercEvitaveis) : null,
      metaMinResolucaoDias: input.metaMinResolucaoDias ?? null,
      metaMaxReincidencias: input.metaMaxReincidencias ?? null,
      metasPorSetor: input.metasPorSetor ?? null,
      observacoes: input.observacoes ?? null,
      criadoPor: input.criadoPor ?? null
    };
    if (existing.length > 0) {
      await db5.update(metasRetrabalho).set(values).where(eq4(metasRetrabalho.id, existing[0].id));
      return { id: existing[0].id, action: "updated" };
    } else {
      const [result] = await db5.insert(metasRetrabalho).values({
        ano: input.ano,
        mes: input.mes ?? null,
        ...values
      }).returning({ id: metasRetrabalho.id });
      return { id: result.id, action: "created" };
    }
  }),
  // Comparativo meta vs realizado (mês atual)
  comparativo: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return null;
    const agora = /* @__PURE__ */ new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth() + 1;
    const inicioMes = new Date(anoAtual, mesAtual - 1, 1);
    const fimMes = new Date(anoAtual, mesAtual, 0, 23, 59, 59);
    const metas = await db5.select().from(metasRetrabalho).where(eq4(metasRetrabalho.ano, anoAtual)).orderBy(desc4(sql3`COALESCE(${metasRetrabalho.mes}, 0)`));
    const meta = metas.find((r) => r.mes === mesAtual) ?? metas.find((r) => r.mes === null) ?? null;
    const retrabsMes = await db5.select().from(retrabalhos).where(and4(gte2(retrabalhos.data, inicioMes), lte2(retrabalhos.data, fimMes)));
    const totalMes = retrabsMes.length;
    const custoMes = retrabsMes.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const evitaveisMes = retrabsMes.filter((r) => r.classe === "EVIT\xC1VEL").length;
    const percEvitaveis = totalMes > 0 ? evitaveisMes / totalMes * 100 : 0;
    const reincMap = {};
    retrabsMes.forEach((r) => {
      const key = `${r.codigoErro ?? "sem_codigo"}|${r.setor}`;
      reincMap[key] = (reincMap[key] ?? 0) + 1;
    });
    const maxReincidencias = Math.max(0, ...Object.values(reincMap));
    const acoes = await db5.select().from(acoesCorretivas).where(and4(
      eq4(acoesCorretivas.status, "aberto"),
      gte2(acoesCorretivas.createdAt, inicioMes)
    ));
    const { faturamento: faturamento2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const fatRows = await db5.select().from(faturamento2).where(and4(eq4(faturamento2.mes, String(mesAtual)), eq4(faturamento2.ano, anoAtual))).limit(1);
    const fatMes = fatRows[0] ? Number(fatRows[0].valorFaturado ?? 0) : 0;
    const percFaturamento = fatMes > 0 ? custoMes / fatMes * 100 : 0;
    return {
      meta,
      realizado: {
        totalRetrabalhos: totalMes,
        custoTotal: custoMes,
        percEvitaveis,
        percFaturamento,
        maxReincidencias,
        acoesAbertas: acoes.length
      },
      status: {
        retrabalhos: meta?.metaMaxRetrabalhosMes ? totalMes <= meta.metaMaxRetrabalhosMes ? "ok" : "excedido" : "sem_meta",
        custo: meta?.metaMaxCustoMes ? custoMes <= Number(meta.metaMaxCustoMes) ? "ok" : "excedido" : "sem_meta",
        percFaturamento: meta?.metaMaxPercFaturamento ? percFaturamento <= Number(meta.metaMaxPercFaturamento) ? "ok" : "excedido" : "sem_meta",
        percEvitaveis: meta?.metaMaxPercEvitaveis ? percEvitaveis <= Number(meta.metaMaxPercEvitaveis) ? "ok" : "excedido" : "sem_meta",
        reincidencias: meta?.metaMaxReincidencias ? maxReincidencias <= meta.metaMaxReincidencias ? "ok" : "excedido" : "sem_meta"
      }
    };
  })
});
var planosAcaoRouter = router({
  list: publicProcedure.input(z2.object({
    codigoErro: z2.string().optional(),
    setor: z2.string().optional(),
    status: z2.enum(["pendente", "em_andamento", "concluido", "monitorando"]).optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    let rows = await db5.select().from(planosAcao).orderBy(desc4(planosAcao.createdAt));
    if (input?.codigoErro) rows = rows.filter((r) => r.codigoErro === input.codigoErro);
    if (input?.setor) rows = rows.filter((r) => r.setor === input.setor);
    if (input?.status) rows = rows.filter((r) => r.status === input.status);
    const allAcoes = await db5.select().from(acoes5w2h);
    return rows.map((p) => {
      const acoes = allAcoes.filter((a) => a.planoId === p.id);
      const total = acoes.length;
      const concluidas = acoes.filter((a) => a.status === "concluido").length;
      const emAndamento = acoes.filter((a) => a.status === "em_andamento").length;
      return { ...p, _totalAcoes: total, _acoesConc: concluidas, _acoesAndamento: emAndamento };
    });
  }),
  create: publicProcedure.input(z2.object({
    codigoErro: z2.string(),
    setor: z2.string().optional(),
    titulo: z2.string(),
    problemaRaiz: z2.string().optional(),
    acoesPreventivas: z2.string().optional(),
    responsavel: z2.string().optional(),
    prazo: z2.string().optional(),
    reincidenciasNaAbertura: z2.number().optional(),
    criadoPor: z2.string().optional(),
    errosPrevenidos: z2.array(z2.string()).optional(),
    errosResolvidos: z2.array(z2.string()).optional(),
    metodologia: z2.string().optional(),
    codigosErro: z2.array(z2.string()).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [result] = await db5.insert(planosAcao).values({
      codigoErro: input.codigoErro,
      setor: input.setor ?? null,
      titulo: input.titulo,
      problemaRaiz: input.problemaRaiz ?? null,
      acoesPreventivas: input.acoesPreventivas ?? null,
      responsavel: input.responsavel ?? null,
      prazo: input.prazo ? new Date(input.prazo) : null,
      status: "pendente",
      reincidenciasNaAbertura: input.reincidenciasNaAbertura ?? 0,
      criadoPor: input.criadoPor ?? null,
      errosPrevenidos: input.errosPrevenidos ? JSON.stringify(input.errosPrevenidos) : null,
      errosResolvidos: input.errosResolvidos ? JSON.stringify(input.errosResolvidos) : null,
      metodologia: input.metodologia ?? "ambos",
      codigosErro: input.codigosErro ? JSON.stringify(input.codigosErro) : null
    }).returning({ id: planosAcao.id });
    return { id: result.id };
  }),
  update: publicProcedure.input(z2.object({
    id: z2.number(),
    titulo: z2.string().optional(),
    problemaRaiz: z2.string().optional(),
    acoesPreventivas: z2.string().optional(),
    responsavel: z2.string().optional(),
    prazo: z2.string().optional(),
    status: z2.enum(["pendente", "em_andamento", "concluido", "monitorando"]).optional(),
    reincidenciasAposPlano: z2.number().optional(),
    errosPrevenidos: z2.array(z2.string()).optional(),
    errosResolvidos: z2.array(z2.string()).optional(),
    metodologia: z2.string().optional(),
    setor: z2.string().optional(),
    codigosErro: z2.array(z2.string()).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, errosPrevenidos, errosResolvidos, codigosErro, ...rest } = input;
    await db5.update(planosAcao).set({
      ...rest,
      prazo: rest.prazo ? new Date(rest.prazo) : void 0,
      errosPrevenidos: errosPrevenidos !== void 0 ? JSON.stringify(errosPrevenidos) : void 0,
      errosResolvidos: errosResolvidos !== void 0 ? JSON.stringify(errosResolvidos) : void 0,
      codigosErro: codigosErro !== void 0 ? JSON.stringify(codigosErro) : void 0
    }).where(eq4(planosAcao.id, id));
    return { success: true };
  }),
  delete: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(planosAcao).where(eq4(planosAcao.id, input.id));
    return { success: true };
  }),
  // Ishikawa: listar causas de um plano
  listCausas: publicProcedure.input(z2.object({ planoId: z2.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(ishikawaCausas).where(eq4(ishikawaCausas.planoId, input.planoId)).orderBy(ishikawaCausas.categoria);
  }),
  // Ishikawa: criar causa
  createCausa: publicProcedure.input(z2.object({
    planoId: z2.number(),
    categoria: z2.enum(["maquina", "mao_de_obra", "material", "metodo", "medida", "meio_ambiente"]),
    causa: z2.string(),
    prioridade: z2.enum(["alta", "media", "baixa"]).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [result] = await db5.insert(ishikawaCausas).values({
      planoId: input.planoId,
      categoria: input.categoria,
      causa: input.causa,
      prioridade: input.prioridade ?? "media"
    }).returning({ id: ishikawaCausas.id });
    return { id: result.id };
  }),
  // Ishikawa: atualizar causa
  updateCausa: publicProcedure.input(z2.object({
    id: z2.number(),
    causa: z2.string().optional(),
    prioridade: z2.enum(["alta", "media", "baixa"]).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...rest } = input;
    await db5.update(ishikawaCausas).set(rest).where(eq4(ishikawaCausas.id, id));
    return { success: true };
  }),
  // Ishikawa: deletar causa
  deleteCausa: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(ishikawaCausas).where(eq4(ishikawaCausas.id, input.id));
    return { success: true };
  }),
  // 5W2H: listar ações de um plano
  listAcoes: publicProcedure.input(z2.object({ planoId: z2.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(acoes5w2h).where(eq4(acoes5w2h.planoId, input.planoId)).orderBy(acoes5w2h.createdAt);
  }),
  // 5W2H: criar ação
  createAcao: publicProcedure.input(z2.object({
    planoId: z2.number(),
    what: z2.string(),
    why: z2.string().optional(),
    where: z2.string().optional(),
    who: z2.string().optional(),
    when: z2.string().optional(),
    how: z2.string().optional(),
    howMuch: z2.string().optional(),
    causaId: z2.number().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [result] = await db5.insert(acoes5w2h).values({
      planoId: input.planoId,
      what: input.what,
      why: input.why ?? null,
      where: input.where ?? null,
      who: input.who ?? null,
      when: input.when ?? null,
      how: input.how ?? null,
      howMuch: input.howMuch ?? null,
      causaId: input.causaId ?? null,
      status: "pendente"
    }).returning({ id: acoes5w2h.id });
    return { id: result.id };
  }),
  // 5W2H: atualizar ação
  updateAcao: publicProcedure.input(z2.object({
    id: z2.number(),
    what: z2.string().optional(),
    why: z2.string().optional(),
    where: z2.string().optional(),
    who: z2.string().optional(),
    when: z2.string().optional(),
    how: z2.string().optional(),
    howMuch: z2.string().optional(),
    status: z2.enum(["pendente", "em_andamento", "concluido"]).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...rest } = input;
    await db5.update(acoes5w2h).set(rest).where(eq4(acoes5w2h.id, id));
    return { success: true };
  }),
  // 5W2H: deletar ação
  deleteAcao: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(acoes5w2h).where(eq4(acoes5w2h.id, input.id));
    return { success: true };
  }),
  // Exportar dados completos do plano para geração de PDF no frontend
  exportData: publicProcedure.input(z2.object({ id: z2.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [plano] = await db5.select().from(planosAcao).where(eq4(planosAcao.id, input.id));
    if (!plano) throw new Error("Plano n\xE3o encontrado");
    const causas = await db5.select().from(ishikawaCausas).where(eq4(ishikawaCausas.planoId, input.id)).orderBy(ishikawaCausas.categoria);
    const acoes = await db5.select().from(acoes5w2h).where(eq4(acoes5w2h.planoId, input.id)).orderBy(acoes5w2h.createdAt);
    return { plano, causas, acoes };
  }),
  // Gerar ações 5W2H via IA para um plano de ação
  gerarAcoesIA: publicProcedure.input(z2.object({
    planoId: z2.number(),
    titulo: z2.string(),
    problemaRaiz: z2.string().optional(),
    codigoErro: z2.string(),
    causas: z2.array(z2.object({ categoria: z2.string(), causa: z2.string() })).optional(),
    quantidade: z2.number().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const qtd = input.quantidade ?? 5;
    const causasTexto = input.causas && input.causas.length > 0 ? `

Causas identificadas (Ishikawa):
${input.causas.map((c) => `- ${c.categoria}: ${c.causa}`).join("\n")}` : "";
    const prompt = `Voc\xEA \xE9 um especialista em qualidade industrial. Gere exatamente ${qtd} a\xE7\xF5es preventivas no formato 5W2H para o seguinte plano de a\xE7\xE3o:

T\xEDtulo: ${input.titulo}
C\xF3digo do Erro: ${input.codigoErro}
Problema Raiz: ${input.problemaRaiz ?? "N\xE3o especificado"}${causasTexto}

Responda APENAS com um JSON array com exatamente ${qtd} objetos, cada um com os campos:
- what: O que fazer (a\xE7\xE3o espec\xEDfica e mensur\xE1vel)
- why: Por que fazer (justificativa)
- where: Onde executar (setor/local)
- who: Quem \xE9 respons\xE1vel (cargo/fun\xE7\xE3o)
- when: Quando (prazo em dias, ex: "30 dias")
- how: Como fazer (m\xE9todo/procedimento)
- howMuch: Quanto custa (estimativa ou "Sem custo adicional")

As a\xE7\xF5es devem ser pr\xE1ticas, espec\xEDficas e diretamente relacionadas ao problema.`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Voc\xEA \xE9 um especialista em qualidade industrial e metodologias 5W2H e Ishikawa. Responda sempre em JSON v\xE1lido." },
        { role: "user", content: prompt }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "acoes_5w2h",
          strict: true,
          schema: {
            type: "object",
            properties: {
              acoes: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    what: { type: "string" },
                    why: { type: "string" },
                    where: { type: "string" },
                    who: { type: "string" },
                    when: { type: "string" },
                    how: { type: "string" },
                    howMuch: { type: "string" }
                  },
                  required: ["what", "why", "where", "who", "when", "how", "howMuch"],
                  additionalProperties: false
                }
              }
            },
            required: ["acoes"],
            additionalProperties: false
          }
        }
      }
    });
    const rawContent = response.choices?.[0]?.message?.content ?? "{}";
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);
    let acoes = [];
    try {
      const parsed = JSON.parse(content);
      acoes = parsed.acoes ?? parsed ?? [];
      if (!Array.isArray(acoes)) acoes = [];
    } catch {
      throw new Error("Falha ao interpretar resposta da IA");
    }
    const insertedIds = [];
    for (const acao of acoes.slice(0, qtd)) {
      const [result] = await db5.insert(acoes5w2h).values({
        planoId: input.planoId,
        what: acao.what ?? "",
        why: acao.why ?? null,
        where: acao.where ?? null,
        who: acao.who ?? null,
        when: acao.when ?? null,
        how: acao.how ?? null,
        howMuch: acao.howMuch ?? null,
        status: "pendente"
      }).returning({ id: acoes5w2h.id });
      insertedIds.push(result.id);
    }
    return { success: true, count: insertedIds.length, ids: insertedIds };
  }),
  // Reincidências com plano de ação vinculado
  reincidenciasComPlano: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select({
      codigoErro: retrabalhos.codigoErro,
      setor: retrabalhos.setor,
      count: sql3`COUNT(*)`,
      custoTotal: sql3`SUM(${retrabalhos.total})`,
      ultimaOcorrencia: sql3`MAX(${retrabalhos.data})`
    }).from(retrabalhos).groupBy(retrabalhos.codigoErro, retrabalhos.setor).having(sql3`COUNT(*) >= 2`).orderBy(desc4(sql3`COUNT(*)`));
    const planos = await db5.select().from(planosAcao);
    return rows.map((r) => {
      const plano = planos.find(
        (p) => p.codigoErro === r.codigoErro && (!p.setor || p.setor === r.setor)
      ) ?? null;
      return { ...r, plano };
    });
  })
});
var alertasRouter = router({
  // Listar alertas ativos
  list: publicProcedure.input(z2.object({
    status: z2.enum(["ativo", "lido", "arquivado"]).optional(),
    tipo: z2.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    let rows = await db5.select().from(alertasSistema).orderBy(desc4(alertasSistema.createdAt));
    if (input?.status) rows = rows.filter((r) => r.status === input.status);
    if (input?.tipo) rows = rows.filter((r) => r.tipo === input.tipo);
    return rows;
  }),
  // Contar alertas ativos (para badge no menu)
  countAtivos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return { total: 0, criticos: 0, avisos: 0 };
    const rows = await db5.select().from(alertasSistema).where(eq4(alertasSistema.status, "ativo"));
    return {
      total: rows.length,
      criticos: rows.filter((r) => r.severidade === "critico").length,
      avisos: rows.filter((r) => r.severidade === "aviso").length
    };
  }),
  // Marcar como lido
  marcarLido: publicProcedure.input(z2.object({ id: z2.number(), lidoPor: z2.string().optional() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(alertasSistema).set({
      status: "lido",
      lidoPor: input.lidoPor ?? null,
      lidoEm: /* @__PURE__ */ new Date()
    }).where(eq4(alertasSistema.id, input.id));
    return { success: true };
  }),
  // Arquivar alerta
  arquivar: publicProcedure.input(z2.object({ id: z2.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(alertasSistema).set({ status: "arquivado" }).where(eq4(alertasSistema.id, input.id));
    return { success: true };
  }),
  // Marcar todos como lidos
  marcarTodosLidos: publicProcedure.input(z2.object({ lidoPor: z2.string().optional() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(alertasSistema).set({
      status: "lido",
      lidoPor: input.lidoPor ?? null,
      lidoEm: /* @__PURE__ */ new Date()
    }).where(eq4(alertasSistema.status, "ativo"));
    return { success: true };
  }),
  // Verificar e gerar alertas automáticos (chamado periodicamente ou após registros)
  verificarAlertas: publicProcedure.mutation(async () => {
    const db5 = await getDb3();
    if (!db5) return { gerados: 0 };
    let gerados = 0;
    const agora = /* @__PURE__ */ new Date();
    const tresdiasAtras = new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1e3);
    const retrabsSemAcao = await db5.select().from(retrabalhos).where(lt(retrabalhos.createdAt, tresdiasAtras));
    const acoesExistentes = await db5.select({ id: acoesCorretivas.retrabalhoid }).from(acoesCorretivas);
    const idsComAcao = new Set(acoesExistentes.map((a) => a.retrabalhoid));
    const semAcao = retrabsSemAcao.filter((r) => !idsComAcao.has(r.id));
    for (const r of semAcao.slice(0, 10)) {
      const alertaExistente = await db5.select().from(alertasSistema).where(and4(
        eq4(alertasSistema.tipo, "sem_acao"),
        eq4(alertasSistema.referenciaId, r.id),
        eq4(alertasSistema.status, "ativo")
      )).limit(1);
      if (alertaExistente.length === 0) {
        await criarAlerta({
          tipo: "sem_acao",
          severidade: "aviso",
          titulo: `OS ${r.osRetrabalhada} sem a\xE7\xE3o corretiva`,
          descricao: `Retrabalho registrado em ${new Date(r.data).toLocaleDateString("pt-BR")} ainda n\xE3o possui a\xE7\xE3o corretiva cadastrada.`,
          referenciaId: r.id,
          referenciaTipo: "retrabalho",
          referenciaExtra: r.osRetrabalhada ?? void 0
        });
        gerados++;
      }
    }
    const acoesVencidas = await db5.select().from(acoesCorretivas).where(and4(
      lt(acoesCorretivas.prazoResolucao, agora),
      eq4(acoesCorretivas.status, "aberto")
    ));
    for (const a of acoesVencidas.slice(0, 10)) {
      const alertaExistente = await db5.select().from(alertasSistema).where(and4(
        eq4(alertasSistema.tipo, "prazo_vencido"),
        eq4(alertasSistema.referenciaId, a.id),
        eq4(alertasSistema.status, "ativo")
      )).limit(1);
      if (alertaExistente.length === 0) {
        await criarAlerta({
          tipo: "prazo_vencido",
          severidade: "critico",
          titulo: `Prazo de a\xE7\xE3o corretiva vencido`,
          descricao: `A a\xE7\xE3o corretiva do retrabalho #${a.retrabalhoid} venceu em ${a.prazoResolucao ? new Date(a.prazoResolucao).toLocaleDateString("pt-BR") : "data desconhecida"}.`,
          referenciaId: a.id,
          referenciaTipo: "acao_corretiva",
          referenciaExtra: String(a.retrabalhoid)
        });
        gerados++;
      }
    }
    const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1);
    const retrabsMes = await db5.select().from(retrabalhos).where(gte2(retrabalhos.data, inicioMes));
    const reincMap = {};
    retrabsMes.forEach((r) => {
      if (!r.codigoErro) return;
      const key = `${r.codigoErro}|${r.setor}`;
      if (!reincMap[key]) reincMap[key] = { count: 0, setor: r.setor, codigoErro: r.codigoErro };
      reincMap[key].count++;
    });
    for (const [key, info] of Object.entries(reincMap)) {
      if (info.count >= 3) {
        const alertaExistente = await db5.select().from(alertasSistema).where(and4(
          eq4(alertasSistema.tipo, "reincidencia"),
          eq4(alertasSistema.referenciaExtra, key),
          eq4(alertasSistema.status, "ativo")
        )).limit(1);
        if (alertaExistente.length === 0) {
          await criarAlerta({
            tipo: "reincidencia",
            severidade: "critico",
            titulo: `Reincid\xEAncia cr\xEDtica: ${info.codigoErro} no setor ${info.setor}`,
            descricao: `O erro ${info.codigoErro} ocorreu ${info.count} vezes no setor ${info.setor} neste m\xEAs. Crie um plano de a\xE7\xE3o preventivo.`,
            referenciaTipo: "reincidencia",
            referenciaExtra: key
          });
          gerados++;
        }
      }
    }
    return { gerados };
  })
});
var desempenhoColaboradorRouter = router({
  // Ranking de colaboradores por retrabalhos
  ranking: publicProcedure.input(z2.object({
    mes: z2.string().optional(),
    setor: z2.string().optional(),
    dataInicio: z2.string().optional(),
    dataFim: z2.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [];
    if (input?.mes) {
      const [ano, mes] = input.mes.split("-").map(Number);
      if (ano && mes) {
        conditions.push(gte2(retrabalhos.data, new Date(ano, mes - 1, 1)));
        conditions.push(lte2(retrabalhos.data, new Date(ano, mes, 0, 23, 59, 59)));
      }
    }
    if (input?.dataInicio) conditions.push(gte2(retrabalhos.data, new Date(input.dataInicio)));
    if (input?.dataFim) conditions.push(lte2(retrabalhos.data, new Date(input.dataFim)));
    if (input?.setor) conditions.push(eq4(retrabalhos.setor, input.setor));
    const whereClause = conditions.length > 0 ? and4(...conditions) : void 0;
    const rows = await db5.select().from(retrabalhos).where(whereClause);
    const map = {};
    rows.forEach((r) => {
      const resp = r.responsavel?.trim() || "N\xE3o informado";
      if (!map[resp]) {
        map[resp] = {
          responsavel: resp,
          total: 0,
          custoTotal: 0,
          evitaveis: 0,
          inevitaveis: 0,
          setores: /* @__PURE__ */ new Set(),
          erros: {},
          ultimoRetrabalho: null
        };
      }
      map[resp].total++;
      map[resp].custoTotal += Number(r.total ?? 0);
      if (r.classe === "EVIT\xC1VEL") map[resp].evitaveis++;
      else map[resp].inevitaveis++;
      map[resp].setores.add(r.setor);
      if (r.codigoErro) {
        map[resp].erros[r.codigoErro] = (map[resp].erros[r.codigoErro] ?? 0) + 1;
      }
      const dataR = new Date(r.data);
      if (!map[resp].ultimoRetrabalho || dataR > map[resp].ultimoRetrabalho) {
        map[resp].ultimoRetrabalho = dataR;
      }
    });
    return Object.values(map).map((v) => ({
      responsavel: v.responsavel,
      total: v.total,
      custoTotal: v.custoTotal,
      evitaveis: v.evitaveis,
      inevitaveis: v.inevitaveis,
      percEvitaveis: v.total > 0 ? v.evitaveis / v.total * 100 : 0,
      setores: Array.from(v.setores),
      erroMaisFrequente: Object.entries(v.erros).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      ultimoRetrabalho: v.ultimoRetrabalho
    })).sort((a, b) => b.total - a.total);
  }),
  // Evolução mensal de um colaborador específico
  evolucao: publicProcedure.input(z2.object({ responsavel: z2.string() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select({
      mes: sql3`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`,
      total: sql3`COUNT(*)`,
      custoTotal: sql3`SUM(${retrabalhos.total})`,
      evitaveis: sql3`SUM(CASE WHEN ${retrabalhos.classe} = 'EVITÁVEL' THEN 1 ELSE 0 END)`
    }).from(retrabalhos).where(eq4(retrabalhos.responsavel, input.responsavel)).groupBy(sql3`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`).orderBy(sql3`TO_CHAR(${retrabalhos.data}, 'YYYY-MM')`);
    return rows;
  }),
  // Comparativo entre colaboradores (radar/spider chart data)
  comparativo: publicProcedure.input(z2.object({
    responsaveis: z2.array(z2.string()),
    mes: z2.string().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [];
    if (input.mes) {
      const [ano, mes] = input.mes.split("-").map(Number);
      if (ano && mes) {
        conditions.push(gte2(retrabalhos.data, new Date(ano, mes - 1, 1)));
        conditions.push(lte2(retrabalhos.data, new Date(ano, mes, 0, 23, 59, 59)));
      }
    }
    const whereClause = conditions.length > 0 ? and4(...conditions) : void 0;
    const rows = await db5.select().from(retrabalhos).where(whereClause);
    return input.responsaveis.map((resp) => {
      const mine = rows.filter((r) => r.responsavel === resp);
      return {
        responsavel: resp,
        total: mine.length,
        custoTotal: mine.reduce((s, r) => s + Number(r.total ?? 0), 0),
        percEvitaveis: mine.length > 0 ? mine.filter((r) => r.classe === "EVIT\xC1VEL").length / mine.length * 100 : 0
      };
    });
  })
});

// server/routers/metas.ts
import { z as z3 } from "zod";
init_db();
init_schema();
import { eq as eq5, desc as desc5 } from "drizzle-orm";
var metasUpsertSchema = z3.object({
  id: z3.number().optional(),
  anoVigencia: z3.number().min(2020).max(2100).nullable().optional(),
  // 1. Entrega no prazo
  metaEntregaNoPrazoPct: z3.string().nullable().optional(),
  // 2. Retrabalhos
  metaMaxRetrabalhosMes: z3.number().int().nullable().optional(),
  metaMaxRetrabalhoPct: z3.string().nullable().optional(),
  // 3. Faturamento
  metaFaturamentoMensal: z3.string().nullable().optional(),
  metaFaturamentoAnual: z3.string().nullable().optional(),
  // 4. Lucratividade
  metaLucratividadePct: z3.string().nullable().optional(),
  metaLucratividadeValor: z3.string().nullable().optional(),
  metaLucratividadeAnual: z3.string().nullable().optional(),
  // 5. Metros soldados
  metaMetrosSoldadosMes: z3.number().int().nullable().optional(),
  metaCapacidadeSoldaMin: z3.number().int().nullable().optional(),
  metaCapacidadeSoldaMax: z3.number().int().nullable().optional(),
  numSoldadores: z3.number().int().nullable().optional(),
  metaMediaSoldaPorSoldador: z3.string().nullable().optional(),
  // 6. Prejuízo retrabalhos
  metaMaxPrejuizoRetrabalhoMes: z3.string().nullable().optional(),
  metaMaxPrejuizoRetrabalhoPct: z3.string().nullable().optional(),
  // 7. Desempenho colaborador
  metaOsPorColaboradorDia: z3.string().nullable().optional(),
  metaRetrabalhosPorColaboradorMes: z3.number().int().nullable().optional(),
  // 8. Ticket médio
  metaTicketMedio: z3.string().nullable().optional(),
  // 10. OS Criadas por mês
  metaOsGeradasMes: z3.number().int().nullable().optional(),
  // 9. Metros terceirizados
  metaMaxMetrosTerceirizadosMes: z3.number().int().nullable().optional(),
  metaMaxPercTerceirizacao: z3.string().nullable().optional(),
  // Geral
  observacoes: z3.string().nullable().optional(),
  ativo: z3.boolean().optional()
});
var metasRouter = router({
  // Busca o registro de metas ativo (o mais recente para o ano vigente ou o padrão global)
  get: publicProcedure.input(z3.object({ ano: z3.number().optional() }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    const ano = input?.ano ?? (/* @__PURE__ */ new Date()).getFullYear();
    const rows = await db5.select().from(metasOperacionais).where(eq5(metasOperacionais.ativo, true)).orderBy(desc5(metasOperacionais.updatedAt)).limit(10);
    const metaAno = rows.find((r) => r.anoVigencia === ano);
    const metaGlobal = rows.find((r) => r.anoVigencia === null);
    return metaAno ?? metaGlobal ?? rows[0] ?? null;
  }),
  // Lista todos os registros de metas
  list: publicProcedure.query(async () => {
    const db5 = await getDb3();
    return db5.select().from(metasOperacionais).orderBy(desc5(metasOperacionais.updatedAt));
  }),
  // Cria ou atualiza metas
  upsert: publicProcedure.input(metasUpsertSchema).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const { id, ...data } = input;
    if (id) {
      await db5.update(metasOperacionais).set(data).where(eq5(metasOperacionais.id, id));
      const updated = await db5.select().from(metasOperacionais).where(eq5(metasOperacionais.id, id));
      return updated[0];
    } else {
      const [inserted] = await db5.insert(metasOperacionais).values(data).returning();
      return inserted;
    }
  })
});

// server/routers/financeiro.ts
import { z as z4 } from "zod";
init_db();
init_schema();
import { eq as eq6, and as and5 } from "drizzle-orm";
var financeiroRouter = router({
  // Buscar dados financeiros de um mês/ano específico
  get: publicProcedure.input(z4.object({ mes: z4.number(), ano: z4.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(financeiroMensal).where(and5(eq6(financeiroMensal.mes, input.mes), eq6(financeiroMensal.ano, input.ano))).limit(1);
    return rows[0] ?? null;
  }),
  // Listar todos os registros financeiros
  list: publicProcedure.input(z4.object({ ano: z4.number().optional() }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(financeiroMensal);
    if (input?.ano) return rows.filter((r) => r.ano === input.ano);
    return rows.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  }),
  // Criar ou atualizar registro financeiro mensal
  upsert: publicProcedure.input(z4.object({
    mes: z4.number().min(1).max(12),
    ano: z4.number().min(2020).max(2100),
    faturamentoOficial: z4.number().nullable().optional(),
    despesasFixas: z4.number().nullable().optional(),
    despesasVariaveis: z4.number().nullable().optional(),
    numColaboradores: z4.number().int().nullable().optional(),
    lucroBruto: z4.number().nullable().optional(),
    lucroLiquido: z4.number().nullable().optional(),
    notas: z4.string().nullable().optional(),
    // Novos campos a partir de Abr/2026
    impostoDas: z4.number().nullable().optional(),
    impostoIcmsDifal: z4.number().nullable().optional(),
    impostoDaems: z4.number().nullable().optional(),
    comissoesBv: z4.number().nullable().optional(),
    produtividadeSolda: z4.number().nullable().optional(),
    freteRetrabalho: z4.number().nullable().optional(),
    devSoftware: z4.number().nullable().optional(),
    receitaOperacionalOs: z4.number().nullable().optional(),
    resultadoEfetivo: z4.number().nullable().optional(),
    saldoMes: z4.number().nullable().optional(),
    tl1: z4.number().nullable().optional(),
    tl2: z4.number().nullable().optional(),
    tl3: z4.number().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const existing = await db5.select().from(financeiroMensal).where(and5(eq6(financeiroMensal.mes, input.mes), eq6(financeiroMensal.ano, input.ano))).limit(1);
    const toStr = (v) => v != null ? String(v) : null;
    const data = {
      faturamentoOficial: toStr(input.faturamentoOficial),
      despesasFixas: toStr(input.despesasFixas),
      despesasVariaveis: toStr(input.despesasVariaveis),
      numColaboradores: input.numColaboradores ?? null,
      lucroBruto: toStr(input.lucroBruto),
      lucroLiquido: toStr(input.lucroLiquido),
      notas: input.notas ?? null,
      // Novos campos a partir de Abr/2026
      impostoDas: toStr(input.impostoDas),
      impostoIcmsDifal: toStr(input.impostoIcmsDifal),
      impostoDaems: toStr(input.impostoDaems),
      comissoesBv: toStr(input.comissoesBv),
      produtividadeSolda: toStr(input.produtividadeSolda),
      freteRetrabalho: toStr(input.freteRetrabalho),
      devSoftware: toStr(input.devSoftware),
      receitaOperacionalOs: toStr(input.receitaOperacionalOs),
      resultadoEfetivo: toStr(input.resultadoEfetivo),
      saldoMes: toStr(input.saldoMes),
      tl1: toStr(input.tl1),
      tl2: toStr(input.tl2),
      tl3: toStr(input.tl3)
    };
    if (existing.length > 0) {
      await db5.update(financeiroMensal).set(data).where(eq6(financeiroMensal.id, existing[0].id));
      return { ...existing[0], ...data };
    } else {
      const [result] = await db5.insert(financeiroMensal).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: financeiroMensal.id });
      return { id: result.id, mes: input.mes, ano: input.ano, ...data };
    }
  }),
  // ─── Custo Marketing ─────────────────────────────────────────────────────────
  getCustoMarketing: publicProcedure.input(z4.object({ mes: z4.number(), ano: z4.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(custoMarketing).where(and5(eq6(custoMarketing.mes, input.mes), eq6(custoMarketing.ano, input.ano))).limit(1);
    return rows[0] ?? null;
  }),
  getCustoMarketingAno: publicProcedure.input(z4.object({ ano: z4.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custoMarketing).where(eq6(custoMarketing.ano, input.ano));
    return rows.sort((a, b) => a.mes - b.mes);
  }),
  upsertCustoMarketing: publicProcedure.input(z4.object({
    mes: z4.number().min(1).max(12),
    ano: z4.number().min(2020).max(2100),
    investimento: z4.number().min(0),
    observacao: z4.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const existing = await db5.select().from(custoMarketing).where(and5(eq6(custoMarketing.mes, input.mes), eq6(custoMarketing.ano, input.ano))).limit(1);
    const data = {
      investimento: String(input.investimento),
      observacao: input.observacao ?? null
    };
    if (existing.length > 0) {
      await db5.update(custoMarketing).set(data).where(eq6(custoMarketing.id, existing[0].id));
      return { ...existing[0], ...data };
    } else {
      const [result] = await db5.insert(custoMarketing).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: custoMarketing.id });
      return { id: result.id, mes: input.mes, ano: input.ano, ...data };
    }
  }),
  // ─── Custos Fixos ────────────────────────────────────────────────────────────
  getCustosFixos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custosFixos).where(eq6(custosFixos.ativo, true));
    return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
  }),
  upsertCustoFixo: publicProcedure.input(z4.object({
    id: z4.number().optional(),
    plano: z4.string(),
    categoria: z4.string(),
    grupoCategoria: z4.string(),
    fornecedor: z4.string(),
    tipo: z4.string(),
    valor: z4.number().min(0),
    vencimento: z4.number().nullable().optional(),
    observacao: z4.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const data = {
      plano: input.plano,
      categoria: input.categoria,
      grupoCategoria: input.grupoCategoria,
      fornecedor: input.fornecedor,
      tipo: input.tipo,
      valor: String(input.valor),
      vencimento: input.vencimento ?? null,
      observacao: input.observacao ?? null
    };
    if (input.id) {
      await db5.update(custosFixos).set(data).where(eq6(custosFixos.id, input.id));
      return { id: input.id, ...data };
    } else {
      const [result] = await db5.insert(custosFixos).values(data).returning({ id: custosFixos.id });
      return { id: result.id, ...data };
    }
  }),
  deleteCustoFixo: publicProcedure.input(z4.object({ id: z4.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.update(custosFixos).set({ ativo: false }).where(eq6(custosFixos.id, input.id));
    return { ok: true };
  }),
  // ─── Dívidas e Parcelamentos ─────────────────────────────────────────────────
  getDividas: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(dividasParcelamentos).where(eq6(dividasParcelamentos.ativo, true));
    return rows.map((r) => ({
      ...r,
      media: r.media ? Number(r.media) : null,
      janValor: r.janValor ? Number(r.janValor) : null,
      fevValor: r.fevValor ? Number(r.fevValor) : null,
      marValor: r.marValor ? Number(r.marValor) : null,
      abrValor: r.abrValor ? Number(r.abrValor) : null,
      maiValor: r.maiValor ? Number(r.maiValor) : null,
      junValor: r.junValor ? Number(r.junValor) : null,
      julValor: r.julValor ? Number(r.julValor) : null,
      agoValor: r.agoValor ? Number(r.agoValor) : null,
      setValor: r.setValor ? Number(r.setValor) : null,
      outValor: r.outValor ? Number(r.outValor) : null,
      novValor: r.novValor ? Number(r.novValor) : null,
      dezValor: r.dezValor ? Number(r.dezValor) : null
    }));
  }),
  // ─── DRE Mensal ──────────────────────────────────────────────────────────────
  getDreMensal: publicProcedure.input(z4.object({ ano: z4.number().optional() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(dreMensal);
    const filtered = input.ano ? rows.filter((r) => r.ano === input.ano) : rows;
    return filtered.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes).map((r) => ({
      ...r,
      receitaOperacionalBruta: r.receitaOperacionalBruta ? Number(r.receitaOperacionalBruta) : null,
      receitaFinanceira: r.receitaFinanceira ? Number(r.receitaFinanceira) : null,
      receitaNaoOperacional: r.receitaNaoOperacional ? Number(r.receitaNaoOperacional) : null,
      totalEntradas: r.totalEntradas ? Number(r.totalEntradas) : null,
      impostosVendas: r.impostosVendas ? Number(r.impostosVendas) : null,
      despesaVariavel: r.despesaVariavel ? Number(r.despesaVariavel) : null,
      despesaOperacional: r.despesaOperacional ? Number(r.despesaOperacional) : null,
      materiaPrima: r.materiaPrima ? Number(r.materiaPrima) : null,
      gastosGeraisFabricacao: r.gastosGeraisFabricacao ? Number(r.gastosGeraisFabricacao) : null,
      despesasPessoal: r.despesasPessoal ? Number(r.despesasPessoal) : null,
      despesasFixas: r.despesasFixas ? Number(r.despesasFixas) : null,
      despesasFinanceiras: r.despesasFinanceiras ? Number(r.despesasFinanceiras) : null,
      despesasNaoOperacionais: r.despesasNaoOperacionais ? Number(r.despesasNaoOperacionais) : null,
      totalSaidas: r.totalSaidas ? Number(r.totalSaidas) : null,
      receitaBrutaOperacional: r.receitaBrutaOperacional ? Number(r.receitaBrutaOperacional) : null,
      lucroBruto: r.lucroBruto ? Number(r.lucroBruto) : null,
      lucroOperacional: r.lucroOperacional ? Number(r.lucroOperacional) : null,
      lucroLiquido: r.lucroLiquido ? Number(r.lucroLiquido) : null,
      valorPedidos: r.valorPedidos ? Number(r.valorPedidos) : null,
      resultadoEfetivo: r.resultadoEfetivo ? Number(r.resultadoEfetivo) : null,
      margemResultadoEfetivo: r.margemResultadoEfetivo ? Number(r.margemResultadoEfetivo) : null,
      percMateriaPrima: r.percMateriaPrima ? Number(r.percMateriaPrima) : null,
      percFixoRateado: r.percFixoRateado ? Number(r.percFixoRateado) : null,
      percTributos: r.percTributos ? Number(r.percTributos) : null,
      percComissaoInterna: r.percComissaoInterna ? Number(r.percComissaoInterna) : null,
      percDescontos: r.percDescontos ? Number(r.percDescontos) : null
    }));
  })
});

// server/routers/observacoesFinanceiras.ts
import { z as z5 } from "zod";
init_db();
init_schema();
init_llm();
import { eq as eq7, and as and6, gte as gte3, lt as lt2 } from "drizzle-orm";
function mesRange(mes, ano) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  return { inicio, fim };
}
function fmtR(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
var observacoesFinanceirasRouter = router({
  // Carregar observações de um mês
  get: protectedProcedure.input(z5.object({ mes: z5.number(), ano: z5.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(observacoesFinanceirasMensais).where(and6(
      eq7(observacoesFinanceirasMensais.mes, input.mes),
      eq7(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    return rows[0] ?? null;
  }),
  // Salvar observações manuais
  salvar: protectedProcedure.input(z5.object({
    mes: z5.number(),
    ano: z5.number(),
    observacoesManuais: z5.string().optional(),
    contextosEspecificos: z5.string().optional()
    // JSON string
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const existing = await db5.select().from(observacoesFinanceirasMensais).where(and6(
      eq7(observacoesFinanceirasMensais.mes, input.mes),
      eq7(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    if (existing.length > 0) {
      await db5.update(observacoesFinanceirasMensais).set({
        observacoesManuais: input.observacoesManuais ?? null,
        contextosEspecificos: input.contextosEspecificos ?? null
      }).where(eq7(observacoesFinanceirasMensais.id, existing[0].id));
    } else {
      await db5.insert(observacoesFinanceirasMensais).values({
        mes: input.mes,
        ano: input.ano,
        observacoesManuais: input.observacoesManuais ?? null,
        contextosEspecificos: input.contextosEspecificos ?? null
      });
    }
    return { ok: true };
  }),
  // Buscar dados complementares do mês (custos fixos, transportadoras, embalagem)
  getDadosComplementares: protectedProcedure.input(z5.object({ mes: z5.number(), ano: z5.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const { inicio, fim } = mesRange(input.mes, input.ano);
    const cfAtivos = await db5.select().from(custosFixos).where(eq7(custosFixos.ativo, true));
    const totalCustosFixosPrevistos = cfAtivos.reduce((sum, cf) => sum + Number(cf.valor || 0), 0);
    const custosFixosPorCategoria = cfAtivos.reduce((acc, cf) => {
      const cat = cf.grupoCategoria || "Outros";
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Number(cf.valor || 0);
      return acc;
    }, {});
    const dreRows = await db5.select().from(dreMensal).where(and6(eq7(dreMensal.ano, input.ano), eq7(dreMensal.mes, input.mes))).limit(1);
    const dre = dreRows[0] ?? null;
    const custosFixosReais = dre ? Number(dre.despesasFixas || 0) : 0;
    const finRows = await db5.select().from(financeiroMensal).where(and6(eq7(financeiroMensal.mes, input.mes), eq7(financeiroMensal.ano, input.ano))).limit(1);
    const fin = finRows[0] ?? null;
    const cteRows = await db5.select().from(cteImportacoes).where(and6(
      gte3(cteImportacoes.dataEmissao, inicio),
      lt2(cteImportacoes.dataEmissao, fim)
    ));
    const totalTransportadoras = cteRows.reduce((sum, c) => sum + Number(c.valor || 0), 0);
    const transportadorasPorNome = cteRows.reduce((acc, c) => {
      const nome = c.transportadoraNome || "Desconhecida";
      if (!acc[nome]) acc[nome] = { total: 0, qtd: 0 };
      acc[nome].total += Number(c.valor || 0);
      acc[nome].qtd += 1;
      return acc;
    }, {});
    const pedidosFinalizados = await db5.select().from(empacotamentoPedidos).where(and6(
      gte3(empacotamentoPedidos.finalizadoEm, inicio),
      lt2(empacotamentoPedidos.finalizadoEm, fim)
    ));
    const consumos = await db5.select().from(empacotamentoConsumoCaixa);
    const insumos = await db5.select().from(empacotamentoInsumos);
    const insumosMap = new Map(insumos.map((i) => [i.id, i]));
    let custoEmbalagemTotal = 0;
    const custoEmbalagemPorInsumo = {};
    for (const ped of pedidosFinalizados) {
      if (!ped.modeloCaixaId) continue;
      const consumosCaixa = consumos.filter((c) => c.modeloCaixaId === ped.modeloCaixaId);
      for (const cons of consumosCaixa) {
        const insumo = insumosMap.get(cons.insumoId);
        if (!insumo) continue;
        let qtd = Number(cons.quantidadePorCaixa || 0);
        const fator = Number(cons.fator || 1);
        if (cons.formulaConsumo === "area_externa_m2" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
          const L = Number(ped.larguraCm) / 100;
          const A = Number(ped.alturaCm) / 100;
          const P = Number(ped.profundidadeCm) / 100;
          qtd = 2 * (L * A + L * P + A * P);
        } else if (cons.formulaConsumo === "volume_interno_m3" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
          const L = Number(ped.larguraCm) / 100;
          const A = Number(ped.alturaCm) / 100;
          const P = Number(ped.profundidadeCm) / 100;
          qtd = L * A * P;
        } else if (cons.formulaConsumo === "perimetro_m" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
          const L = Number(ped.larguraCm) / 100;
          const A = Number(ped.alturaCm) / 100;
          const P = Number(ped.profundidadeCm) / 100;
          qtd = 4 * (L + A + P) / 2;
        }
        const custoItem = qtd * fator * Number(insumo.custoUnitario || 0);
        custoEmbalagemTotal += custoItem;
        const nomeInsumo = insumo.nome || "Desconhecido";
        custoEmbalagemPorInsumo[nomeInsumo] = (custoEmbalagemPorInsumo[nomeInsumo] || 0) + custoItem;
      }
    }
    return {
      custosFixos: {
        previstos: totalCustosFixosPrevistos,
        reais: custosFixosReais,
        variacao: custosFixosReais - totalCustosFixosPrevistos,
        porCategoria: custosFixosPorCategoria
      },
      transportadoras: {
        total: totalTransportadoras,
        qtdCtes: cteRows.length,
        porNome: transportadorasPorNome
      },
      embalagem: {
        total: custoEmbalagemTotal,
        qtdPedidos: pedidosFinalizados.length,
        porInsumo: custoEmbalagemPorInsumo
      },
      dre: dre ? {
        receitaOperacionalBruta: Number(dre.receitaOperacionalBruta || 0),
        totalEntradas: Number(dre.totalEntradas || 0),
        totalSaidas: Number(dre.totalSaidas || 0),
        lucroLiquido: Number(dre.lucroLiquido || 0),
        materiaPrima: Number(dre.materiaPrima || 0),
        despesasPessoal: Number(dre.despesasPessoal || 0),
        despesasFixas: Number(dre.despesasFixas || 0),
        impostosVendas: Number(dre.impostosVendas || 0),
        despesaVariavel: Number(dre.despesaVariavel || 0)
      } : null,
      financeiro: fin ? {
        faturamentoOficial: Number(fin.faturamentoOficial || 0),
        despesasFixas: Number(fin.despesasFixas || 0),
        despesasVariaveis: Number(fin.despesasVariaveis || 0),
        lucroLiquido: Number(fin.lucroLiquido || 0),
        resultadoEfetivo: Number(fin.resultadoEfetivo || 0),
        saldoMes: Number(fin.saldoMes || 0),
        impostoDas: Number(fin.impostoDas || 0),
        impostoIcmsDifal: Number(fin.impostoIcmsDifal || 0),
        freteRetrabalho: Number(fin.freteRetrabalho || 0)
      } : null
    };
  }),
  // Gerar análise por IA
  gerarAnalise: protectedProcedure.input(z5.object({ mes: z5.number(), ano: z5.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const MESES_NOMES2 = ["", "Janeiro", "Fevereiro", "Mar\xE7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const obsRows = await db5.select().from(observacoesFinanceirasMensais).where(and6(
      eq7(observacoesFinanceirasMensais.mes, input.mes),
      eq7(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    const obs = obsRows[0];
    const observacoesManuais = obs?.observacoesManuais || "";
    const contextosEspecificos = obs?.contextosEspecificos || "[]";
    const { inicio, fim } = mesRange(input.mes, input.ano);
    const dreRows = await db5.select().from(dreMensal).where(and6(eq7(dreMensal.ano, input.ano), eq7(dreMensal.mes, input.mes))).limit(1);
    const dre = dreRows[0];
    const finRows = await db5.select().from(financeiroMensal).where(and6(eq7(financeiroMensal.mes, input.mes), eq7(financeiroMensal.ano, input.ano))).limit(1);
    const fin = finRows[0];
    const cfAtivos = await db5.select().from(custosFixos).where(eq7(custosFixos.ativo, true));
    const totalCFPrevistos = cfAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);
    const cteRows = await db5.select().from(cteImportacoes).where(and6(gte3(cteImportacoes.dataEmissao, inicio), lt2(cteImportacoes.dataEmissao, fim)));
    const totalTransp = cteRows.reduce((s, c) => s + Number(c.valor || 0), 0);
    const pedidos = await db5.select().from(empacotamentoPedidos).where(and6(gte3(empacotamentoPedidos.finalizadoEm, inicio), lt2(empacotamentoPedidos.finalizadoEm, fim)));
    const consumos = await db5.select().from(empacotamentoConsumoCaixa);
    const insumosAll = await db5.select().from(empacotamentoInsumos);
    const insumosMap = new Map(insumosAll.map((i) => [i.id, i]));
    let custoEmb = 0;
    for (const ped of pedidos) {
      if (!ped.modeloCaixaId) continue;
      const consumosCaixa = consumos.filter((c) => c.modeloCaixaId === ped.modeloCaixaId);
      for (const cons of consumosCaixa) {
        const insumo = insumosMap.get(cons.insumoId);
        if (!insumo) continue;
        let qtd = Number(cons.quantidadePorCaixa || 0);
        const fator = Number(cons.fator || 1);
        if (cons.formulaConsumo === "area_externa_m2" && ped.larguraCm && ped.alturaCm && ped.profundidadeCm) {
          const L = Number(ped.larguraCm) / 100, A = Number(ped.alturaCm) / 100, P = Number(ped.profundidadeCm) / 100;
          qtd = 2 * (L * A + L * P + A * P);
        }
        custoEmb += qtd * fator * Number(insumo.custoUnitario || 0);
      }
    }
    const prompt = `Voc\xEA \xE9 um analista financeiro s\xEAnior da empresa Letreiros Express, uma ind\xFAstria de comunica\xE7\xE3o visual (letreiros, placas, pain\xE9is de LED).

Analise detalhadamente o m\xEAs de ${MESES_NOMES2[input.mes]}/${input.ano} com base nos dados abaixo e nas observa\xE7\xF5es do gestor.

## DADOS FINANCEIROS DO M\xCAS

### DRE (Demonstrativo de Resultado)
${dre ? `- Receita Operacional Bruta: ${fmtR(Number(dre.receitaOperacionalBruta || 0))}
- Total de Entradas: ${fmtR(Number(dre.totalEntradas || 0))}
- Impostos sobre Vendas: ${fmtR(Number(dre.impostosVendas || 0))}
- Mat\xE9ria-Prima: ${fmtR(Number(dre.materiaPrima || 0))}
- Despesas com Pessoal: ${fmtR(Number(dre.despesasPessoal || 0))}
- Despesas Fixas: ${fmtR(Number(dre.despesasFixas || 0))}
- Despesas Financeiras: ${fmtR(Number(dre.despesasFinanceiras || 0))}
- Total de Sa\xEDdas: ${fmtR(Number(dre.totalSaidas || 0))}
- Lucro Bruto: ${fmtR(Number(dre.lucroBruto || 0))}
- Lucro Operacional: ${fmtR(Number(dre.lucroOperacional || 0))}
- Lucro L\xEDquido: ${fmtR(Number(dre.lucroLiquido || 0))}` : "Dados da DRE n\xE3o dispon\xEDveis para este m\xEAs."}

### Financeiro Mensal
${fin ? `- Faturamento Oficial: ${fmtR(Number(fin.faturamentoOficial || 0))}
- Despesas Fixas (lan\xE7adas): ${fmtR(Number(fin.despesasFixas || 0))}
- Despesas Vari\xE1veis: ${fmtR(Number(fin.despesasVariaveis || 0))}
- Lucro L\xEDquido: ${fmtR(Number(fin.lucroLiquido || 0))}
- Resultado Efetivo: ${fmtR(Number(fin.resultadoEfetivo || 0))}
- Saldo do M\xEAs (caixa): ${fmtR(Number(fin.saldoMes || 0))}
- DAS (Simples Nacional): ${fmtR(Number(fin.impostoDas || 0))}
- ICMS DIFAL: ${fmtR(Number(fin.impostoIcmsDifal || 0))}
- Frete de Retrabalho: ${fmtR(Number(fin.freteRetrabalho || 0))}` : "Dados financeiros n\xE3o dispon\xEDveis para este m\xEAs."}

### Custos Fixos: Previsto vs Real
- Total Previsto (cadastro ativo): ${fmtR(totalCFPrevistos)}
- Total Real (DRE): ${fmtR(Number(dre?.despesasFixas || 0))}
- Varia\xE7\xE3o: ${fmtR(Number(dre?.despesasFixas || 0) - totalCFPrevistos)} (${Number(dre?.despesasFixas || 0) > totalCFPrevistos ? "ACIMA do previsto" : "abaixo do previsto"})

### Gastos com Transportadoras
- Total gasto: ${fmtR(totalTransp)}
- Quantidade de CTe emitidos: ${cteRows.length}
${cteRows.length > 0 ? `- Observa\xE7\xE3o: Os fretes s\xE3o CIF (pagos pela empresa), mas o valor do frete \xE9 cobrado do cliente \xE0 vista. Quando o faturamento do m\xEAs anterior \xE9 alto, os fretes do m\xEAs seguinte tamb\xE9m ser\xE3o maiores.` : ""}

### Custo de Embalagem (Mat\xE9rias-Primas)
- Total estimado: ${fmtR(custoEmb)}
- Pedidos embalados no m\xEAs: ${pedidos.length}

## OBSERVA\xC7\xD5ES DO GESTOR
${observacoesManuais || "(Nenhuma observa\xE7\xE3o manual registrada)"}

## CONTEXTOS ESPEC\xCDFICOS INFORMADOS
${(() => {
      try {
        const ctxs = JSON.parse(contextosEspecificos);
        if (Array.isArray(ctxs) && ctxs.length > 0) return ctxs.map((c) => `- ${c}`).join("\n");
        return "(Nenhum contexto espec\xEDfico)";
      } catch {
        return "(Nenhum contexto espec\xEDfico)";
      }
    })()}

## INSTRU\xC7\xD5ES PARA A AN\xC1LISE

Produza uma an\xE1lise financeira detalhada e estruturada em t\xF3picos, cobrindo:

1. **Resumo Executivo**: Vis\xE3o geral do resultado do m\xEAs em 2-3 frases.
2. **An\xE1lise de Receitas**: Avalie o faturamento, se houve crescimento ou queda, e poss\xEDveis causas.
3. **Custos Fixos \u2014 Previsto vs Real**: Compare o previsto com o real, destaque desvios e poss\xEDveis causas (pagamentos em duplicidade, honor\xE1rios extras, etc.).
4. **Gastos com Transportadoras**: Destaque o total gasto, se est\xE1 compat\xEDvel com o faturamento, e o impacto do frete CIF no caixa.
5. **Custo de Embalagem**: Avalie o custo de mat\xE9rias-primas de embalagem em rela\xE7\xE3o ao volume de pedidos.
6. **Impostos e Tributa\xE7\xE3o**: Analise o impacto dos impostos (DAS, ICMS DIFAL) no resultado.
7. **Fluxo de Caixa**: Analise o saldo do m\xEAs, receb\xEDveis pendentes, e impacto de pagamentos atrasados.
8. **Pontos de Aten\xE7\xE3o**: Liste os 3-5 pontos mais cr\xEDticos que merecem a\xE7\xE3o imediata.
9. **Recomenda\xE7\xF5es**: Sugira 2-3 a\xE7\xF5es concretas para o pr\xF3ximo m\xEAs.

Use linguagem profissional mas acess\xEDvel. Formate com Markdown (negrito, listas, etc.). Seja espec\xEDfico com n\xFAmeros.`;
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Voc\xEA \xE9 um analista financeiro especializado em pequenas e m\xE9dias ind\xFAstrias brasileiras. Responda sempre em portugu\xEAs brasileiro." },
        { role: "user", content: prompt }
      ]
    });
    const rawContent = response.choices?.[0]?.message?.content;
    const analise = typeof rawContent === "string" ? rawContent : "N\xE3o foi poss\xEDvel gerar a an\xE1lise.";
    if (obs) {
      await db5.update(observacoesFinanceirasMensais).set({ analiseIa: analise }).where(eq7(observacoesFinanceirasMensais.id, obs.id));
    } else {
      await db5.insert(observacoesFinanceirasMensais).values({
        mes: input.mes,
        ano: input.ano,
        analiseIa: analise
      });
    }
    return { analise };
  })
});

// server/routers/bibliotecaArquivos.ts
init_db();
init_schema();
import { z as z6 } from "zod";
import { eq as eq8, desc as desc6, sql as sql5 } from "drizzle-orm";
var MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
var MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
var MIME_XLS = "application/vnd.ms-excel";
async function extrairTextoPdf(buffer) {
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
  const result = await pdfParse(buffer);
  const texto = result.text?.trim() ?? "";
  return texto.length >= 50 ? texto : null;
}
async function extrairTextoDocx(buffer) {
  const mammoth = await import("mammoth");
  const { value } = await mammoth.extractRawText({ buffer });
  return value?.trim() || null;
}
async function extrairTextoXlsx(buffer) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const partes = workbook.SheetNames.map((nomeAba) => {
    const sheet = workbook.Sheets[nomeAba];
    return `# ${nomeAba}
${XLSX.utils.sheet_to_csv(sheet)}`;
  });
  const texto = partes.join("\n\n").trim();
  return texto || null;
}
async function extrairTextoArquivo(fileBase64, mimeType, fileName, nome, descricao) {
  try {
    const isText = mimeType === "text/plain";
    if (isText) {
      return Buffer.from(fileBase64, "base64").toString("utf-8").slice(0, 5e4);
    }
    const buffer = Buffer.from(fileBase64, "base64");
    if (mimeType === MIME_DOCX) {
      return await extrairTextoDocx(buffer);
    }
    if (mimeType === MIME_XLSX || mimeType === MIME_XLS) {
      return await extrairTextoXlsx(buffer);
    }
    const { invokeLLM: invokeLLM2, buildFileContent: buildFileContent2, buildImageContent: buildImageContent2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
    const isPdf = mimeType === "application/pdf";
    const isImage = mimeType.startsWith("image/");
    if (isPdf) {
      const textoPdf = await extrairTextoPdf(buffer);
      if (textoPdf) return textoPdf;
    }
    if (isPdf || isImage) {
      const contentItem = isPdf ? await buildFileContent2(fileBase64, mimeType, fileName) : buildImageContent2(fileBase64, mimeType);
      const response2 = await invokeLLM2({
        messages: [{
          role: "user",
          content: [
            contentItem,
            {
              type: "text",
              text: `Extraia e transcreva TODO o conte\xFAdo textual deste arquivo "${nome}". Inclua t\xEDtulos, tabelas, listas e par\xE1grafos. Retorne apenas o texto extra\xEDdo, sem coment\xE1rios adicionais.`
            }
          ]
        }]
      });
      return response2?.choices?.[0]?.message?.content ?? null;
    }
    const response = await invokeLLM2({
      messages: [{
        role: "user",
        content: `Arquivo: "${nome}"
Tipo: ${mimeType}
Descri\xE7\xE3o: ${descricao ?? "sem descri\xE7\xE3o"}

Este arquivo foi adicionado \xE0 biblioteca de conhecimento da empresa Letreiros Express. Com base no nome e descri\xE7\xE3o, gere um resumo do que provavelmente cont\xE9m este documento para uso como refer\xEAncia em consultas internas.`
      }]
    });
    return response?.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("[bibliotecaArquivos] Erro ao extrair texto:", e);
    return null;
  }
}
var bibliotecaArquivosRouter = router({
  list: publicProcedure.input(z6.object({
    categoria: z6.string().optional(),
    busca: z6.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(bibliotecaArquivos).orderBy(desc6(bibliotecaArquivos.createdAt));
    return rows.filter((r) => {
      if (input?.categoria && input.categoria !== "Todos" && r.categoria !== input.categoria) return false;
      if (input?.busca) {
        const b = input.busca.toLowerCase();
        const match = r.nome.toLowerCase().includes(b) || (r.descricao ?? "").toLowerCase().includes(b) || (r.tags ?? "").toLowerCase().includes(b) || (r.subcategoria ?? "").toLowerCase().includes(b) || r.fileName.toLowerCase().includes(b) || (r.conteudoExtraido ?? "").toLowerCase().includes(b);
        if (!match) return false;
      }
      return true;
    });
  }),
  categorias: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select({ categoria: bibliotecaArquivos.categoria }).from(bibliotecaArquivos).groupBy(bibliotecaArquivos.categoria).orderBy(bibliotecaArquivos.categoria);
    return rows.map((r) => r.categoria);
  }),
  upload: protectedProcedure.input(z6.object({
    nome: z6.string().min(1),
    descricao: z6.string().optional(),
    categoria: z6.string().min(1),
    subcategoria: z6.string().optional(),
    tags: z6.string().optional(),
    fileName: z6.string().min(1),
    url: z6.string().url(),
    key: z6.string().min(1),
    mimeType: z6.string().min(1),
    fileSize: z6.number().int().nonnegative(),
    uploadedBy: z6.string().optional()
  })).mutation(async ({ input }) => {
    const fileResp = await fetch(input.url);
    const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");
    const conteudoExtraido = await extrairTextoArquivo(
      fileBase64,
      input.mimeType,
      input.fileName,
      input.nome,
      input.descricao
    );
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const [result] = await db5.insert(bibliotecaArquivos).values({
      nome: input.nome,
      descricao: input.descricao ?? null,
      categoria: input.categoria,
      subcategoria: input.subcategoria ?? null,
      tags: input.tags ?? null,
      fileKey: input.key,
      fileUrl: input.url,
      fileName: input.fileName,
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      uploadedBy: input.uploadedBy ?? null,
      visualizacoes: 0,
      conteudoExtraido: conteudoExtraido ?? null
    }).returning({ id: bibliotecaArquivos.id });
    return { success: true, id: result.id, conteudoExtraido: !!conteudoExtraido };
  }),
  // Re-extrair texto de um arquivo já existente (para arquivos enviados antes desta feature)
  reextrairTexto: protectedProcedure.input(z6.object({ id: z6.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const [arquivo] = await db5.select().from(bibliotecaArquivos).where(eq8(bibliotecaArquivos.id, input.id));
    if (!arquivo) throw new Error("Arquivo n\xE3o encontrado");
    const fileResp = await fetch(arquivo.fileUrl);
    if (!fileResp.ok) {
      throw new Error(`Falha ao baixar arquivo do storage (${fileResp.status})`);
    }
    const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");
    const conteudoExtraido = await extrairTextoArquivo(
      fileBase64,
      arquivo.mimeType,
      arquivo.fileName,
      arquivo.nome,
      arquivo.descricao ?? void 0
    );
    await db5.update(bibliotecaArquivos).set({ conteudoExtraido }).where(eq8(bibliotecaArquivos.id, input.id));
    return { success: true, conteudoExtraido: !!conteudoExtraido };
  }),
  update: protectedProcedure.input(z6.object({
    id: z6.number().int(),
    nome: z6.string().min(1).optional(),
    descricao: z6.string().optional(),
    categoria: z6.string().optional(),
    subcategoria: z6.string().optional(),
    tags: z6.string().optional()
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.update(bibliotecaArquivos).set(data).where(eq8(bibliotecaArquivos.id, id));
    return { success: true };
  }),
  delete: protectedProcedure.input(z6.object({ id: z6.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(bibliotecaArquivos).where(eq8(bibliotecaArquivos.id, input.id));
    return { success: true };
  }),
  incrementView: publicProcedure.input(z6.object({ id: z6.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { success: false };
    await db5.update(bibliotecaArquivos).set({ visualizacoes: sql5`${bibliotecaArquivos.visualizacoes} + 1` }).where(eq8(bibliotecaArquivos.id, input.id));
    return { success: true };
  }),
  stats: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return { totalArquivos: 0, totalVisualizacoes: 0, totalSize: 0, porCategoria: {} };
    const rows = await db5.select().from(bibliotecaArquivos);
    const totalArquivos = rows.length;
    const totalVisualizacoes = rows.reduce((acc, r) => acc + (r.visualizacoes ?? 0), 0);
    const totalSize = rows.reduce((acc, r) => acc + (r.fileSize ?? 0), 0);
    const porCategoria = rows.reduce((acc, r) => {
      acc[r.categoria] = (acc[r.categoria] ?? 0) + 1;
      return acc;
    }, {});
    return { totalArquivos, totalVisualizacoes, totalSize, porCategoria };
  })
});

// server/routers/performance.ts
import { z as z7 } from "zod";
init_db_connection();
init_schema();
import { drizzle as drizzle5 } from "drizzle-orm/neon-serverless";
import { eq as eq9, and as and7, asc as asc2, sql as sql6 } from "drizzle-orm";
var _db4 = null;
function getDb4() {
  if (!_db4) _db4 = drizzle5(getPool());
  return _db4;
}
var db3 = {
  select: () => getDb4().select(),
  insert: (t2) => getDb4().insert(t2),
  update: (t2) => getDb4().update(t2),
  delete: (t2) => getDb4().delete(t2)
};
var performanceRouter = router({
  // Listar todos os registros (ordenados por ano/mês)
  list: publicProcedure.query(async () => {
    return await db3.select().from(performanceMensal).orderBy(asc2(performanceMensal.ano), asc2(performanceMensal.mes));
  }),
  // Buscar um mês específico (inclui retrabalhos automáticos do mês)
  getByMesAno: publicProcedure.input(z7.object({ mes: z7.number().min(1).max(12), ano: z7.number().min(2020) })).query(async ({ input }) => {
    const rows = await db3.select().from(performanceMensal).where(
      and7(
        eq9(performanceMensal.mes, input.mes),
        eq9(performanceMensal.ano, input.ano)
      )
    );
    const row = rows[0] ?? null;
    const retrabCountRows = await getDb4().select({ total: sql6`COUNT(*)` }).from(retrabalhos).where(
      sql6`EXTRACT(MONTH FROM ${retrabalhos.data}) = ${input.mes} AND EXTRACT(YEAR FROM ${retrabalhos.data}) = ${input.ano}`
    );
    const retrabCount = [{ total: Number(retrabCountRows[0]?.total ?? 0) }];
    const fatRows = await db3.select().from(faturamento).where(eq9(faturamento.ano, input.ano));
    const MESES_NOMES2 = [
      "Janeiro",
      "Fevereiro",
      "Mar\xE7o",
      "Abril",
      "Maio",
      "Junho",
      "Julho",
      "Agosto",
      "Setembro",
      "Outubro",
      "Novembro",
      "Dezembro"
    ];
    const nomeMes = MESES_NOMES2[input.mes - 1];
    const fatMes = fatRows.find(
      (f2) => f2.mes.toUpperCase() === nomeMes.toUpperCase() || f2.mes === String(input.mes)
    );
    const pedidosMes = fatMes?.totalPedidos ?? 0;
    return {
      ...row,
      // Dados automáticos de retrabalho extraídos da tabela de retrabalhos
      retrabalhosAutoCount: retrabCount[0]?.total ?? 0,
      pedidosAutoCount: pedidosMes
    };
  }),
  // Inserir ou atualizar (upsert) dados de um mês
  upsert: publicProcedure.input(
    z7.object({
      mes: z7.number().min(1).max(12),
      ano: z7.number().min(2020),
      osGeradas: z7.number().nullish(),
      osExpedicao: z7.number().nullish(),
      percExpedicao: z7.number().nullish(),
      metaOsDia: z7.number().nullish(),
      capacidadeOsDiaMin: z7.number().nullish(),
      capacidadeOsDiaMax: z7.number().nullish(),
      deficitFinalizacao: z7.number().nullish(),
      metaEmbalagemDia: z7.number().nullish(),
      producaoEmbalagemDia: z7.number().nullish(),
      metaAcabamentoDia: z7.number().nullish(),
      capacidadeAcabamentoDia: z7.number().nullish(),
      capacidadeNominalSolda: z7.number().nullish(),
      producaoInternaSolda: z7.number().nullish(),
      demandaTotalSolda: z7.number().nullish(),
      osTerceirizadas: z7.number().nullish(),
      metrosTerceirizados: z7.number().nullish(),
      metaOsGeradas: z7.number().nullish(),
      metaOsExpedicao: z7.number().nullish(),
      metaProducaoSolda: z7.number().nullish(),
      metaPercTerceirizacao: z7.number().nullish(),
      observacoes: z7.string().nullish(),
      destaques: z7.string().nullish(),
      gargalos: z7.string().nullish(),
      // Custo de solda
      numSoldadores: z7.number().nullish(),
      soldadorSalarioBase: z7.number().nullish(),
      soldadorHorasExtras: z7.number().nullish(),
      soldadorValorHoraExtra: z7.number().nullish(),
      soldadorOutrosCustos: z7.number().nullish(),
      custoProdutividadeSolda: z7.number().nullish(),
      gestorSalarioBase: z7.number().nullish(),
      gestorHorasExtras: z7.number().nullish(),
      gestorValorHoraExtra: z7.number().nullish(),
      gestorOutrosCustos: z7.number().nullish(),
      custoMetroTerceirizado: z7.number().nullish(),
      precoVendaMetro: z7.number().nullish(),
      // ─── Novos campos de performance ─────────────────────────────────────
      faturamentoRealizado: z7.number().nullish(),
      metaFaturamento: z7.number().nullish(),
      projetosEntregues: z7.number().nullish(),
      projetosNoPrazo: z7.number().nullish(),
      projetosForaPrazo: z7.number().nullish(),
      metaEntregaNoPrazoPct: z7.number().nullish(),
      metaRetrabalhoPct: z7.number().nullish(),
      totalPedidos: z7.number().nullish()
    })
  ).mutation(async ({ input }) => {
    const { mes, ano, ...fields } = input;
    const existing = await db3.select().from(performanceMensal).where(
      and7(
        eq9(performanceMensal.mes, mes),
        eq9(performanceMensal.ano, ano)
      )
    );
    const toStr = (v) => v != null ? String(v) : void 0;
    const data = {
      osGeradas: fields.osGeradas ?? void 0,
      osExpedicao: fields.osExpedicao ?? void 0,
      percExpedicao: toStr(fields.percExpedicao),
      metaOsDia: toStr(fields.metaOsDia),
      capacidadeOsDiaMin: toStr(fields.capacidadeOsDiaMin),
      capacidadeOsDiaMax: toStr(fields.capacidadeOsDiaMax),
      deficitFinalizacao: toStr(fields.deficitFinalizacao),
      metaEmbalagemDia: toStr(fields.metaEmbalagemDia),
      producaoEmbalagemDia: toStr(fields.producaoEmbalagemDia),
      metaAcabamentoDia: toStr(fields.metaAcabamentoDia),
      capacidadeAcabamentoDia: toStr(fields.capacidadeAcabamentoDia),
      capacidadeNominalSolda: fields.capacidadeNominalSolda ?? void 0,
      producaoInternaSolda: fields.producaoInternaSolda ?? void 0,
      demandaTotalSolda: fields.demandaTotalSolda ?? void 0,
      osTerceirizadas: fields.osTerceirizadas ?? void 0,
      metrosTerceirizados: fields.metrosTerceirizados ?? void 0,
      metaOsGeradas: fields.metaOsGeradas ?? void 0,
      metaOsExpedicao: fields.metaOsExpedicao ?? void 0,
      metaProducaoSolda: fields.metaProducaoSolda ?? void 0,
      metaPercTerceirizacao: toStr(fields.metaPercTerceirizacao),
      observacoes: fields.observacoes ?? void 0,
      destaques: fields.destaques ?? void 0,
      gargalos: fields.gargalos ?? void 0,
      numSoldadores: fields.numSoldadores ?? void 0,
      soldadorSalarioBase: toStr(fields.soldadorSalarioBase),
      soldadorHorasExtras: toStr(fields.soldadorHorasExtras),
      soldadorValorHoraExtra: toStr(fields.soldadorValorHoraExtra),
      soldadorOutrosCustos: toStr(fields.soldadorOutrosCustos),
      custoProdutividadeSolda: toStr(fields.custoProdutividadeSolda),
      gestorSalarioBase: toStr(fields.gestorSalarioBase),
      gestorHorasExtras: toStr(fields.gestorHorasExtras),
      gestorValorHoraExtra: toStr(fields.gestorValorHoraExtra),
      gestorOutrosCustos: toStr(fields.gestorOutrosCustos),
      custoMetroTerceirizado: toStr(fields.custoMetroTerceirizado),
      precoVendaMetro: toStr(fields.precoVendaMetro),
      // Novos campos
      faturamentoRealizado: toStr(fields.faturamentoRealizado),
      metaFaturamento: toStr(fields.metaFaturamento),
      projetosEntregues: fields.projetosEntregues ?? void 0,
      projetosNoPrazo: fields.projetosNoPrazo ?? void 0,
      projetosForaPrazo: fields.projetosForaPrazo ?? void 0,
      metaEntregaNoPrazoPct: toStr(fields.metaEntregaNoPrazoPct),
      metaRetrabalhoPct: toStr(fields.metaRetrabalhoPct),
      totalPedidos: fields.totalPedidos ?? void 0
    };
    if (existing.length > 0) {
      await db3.update(performanceMensal).set(data).where(eq9(performanceMensal.id, existing[0].id));
      return { action: "updated", id: existing[0].id };
    } else {
      const [result] = await db3.insert(performanceMensal).values({ mes, ano, ...data }).returning({ id: performanceMensal.id });
      return { action: "created", id: result.id };
    }
  }),
  // Excluir um registro
  delete: publicProcedure.input(z7.object({ id: z7.number() })).mutation(async ({ input }) => {
    await db3.delete(performanceMensal).where(eq9(performanceMensal.id, input.id));
    return { success: true };
  })
});

// server/routers/performanceAbc.ts
import { z as z8 } from "zod";
init_db();
init_schema();
init_env();
init_mubisys_client();
import { and as and8, eq as eq10 } from "drizzle-orm";
async function fetchAllOsForMonth(ano, mes) {
  const datainicial = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(ano, mes, 0).getDate();
  const datafinal = `${ano}-${String(mes).padStart(2, "0")}-${lastDay}`;
  const { itens } = await listarOSMubiSys({ status: "TODOS", filtrodata: "CADASTRO", datainicial, datafinal });
  return itens;
}
function buildAbcClientes(osArray) {
  const clientMap = {};
  let totalOs = 0;
  for (const os of osArray) {
    if (os.tipo === "Retrabalho") continue;
    totalOs++;
    const client = os.cliente ?? "Desconhecido";
    const valor = parseFloat(String(os.valor_total ?? 0));
    if (!clientMap[client]) clientMap[client] = { total: 0, count: 0 };
    clientMap[client].total += valor;
    clientMap[client].count++;
  }
  const sorted = Object.entries(clientMap).map(([nome, d]) => ({ nome, total: d.total, count: d.count })).sort((a, b) => b.total - a.total);
  const faturamento2 = sorted.reduce((s, r) => s + r.total, 0);
  let acum = 0;
  const items = sorted.slice(0, 50).map((r) => {
    acum += r.total;
    const pct = faturamento2 > 0 ? r.total / faturamento2 * 100 : 0;
    const pctAcum = faturamento2 > 0 ? acum / faturamento2 * 100 : 0;
    const classe = pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
    return {
      nome: r.nome,
      total: r.total,
      count: r.count,
      pct: pct.toFixed(1),
      pctAcum: pctAcum.toFixed(1),
      classe
    };
  });
  return { items, totalOs, faturamento: faturamento2 };
}
function buildAbcProdutos(osArray) {
  const prodMap = {};
  let totalOs = 0;
  for (const os of osArray) {
    if (os.tipo === "Retrabalho") continue;
    totalOs++;
    for (const item of os.itens ?? []) {
      const prod = (item.item ?? item.descricao ?? item.produto ?? item.nome ?? "").toString().trim();
      if (!prod) continue;
      const valor = parseFloat(
        String(item.valor_final ?? item.sub_total ?? 0)
      );
      if (!prodMap[prod]) prodMap[prod] = { total: 0, count: 0 };
      prodMap[prod].total += valor;
      prodMap[prod].count += item.quantidade ?? 1;
    }
  }
  const sorted = Object.entries(prodMap).map(([nome, d]) => ({ nome, total: d.total, count: d.count })).sort((a, b) => b.total - a.total);
  const faturamento2 = sorted.reduce((s, r) => s + r.total, 0);
  let acum = 0;
  const items = sorted.slice(0, 50).map((r) => {
    acum += r.total;
    const pct = faturamento2 > 0 ? r.total / faturamento2 * 100 : 0;
    const pctAcum = faturamento2 > 0 ? acum / faturamento2 * 100 : 0;
    const classe = pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
    return {
      nome: r.nome,
      total: r.total,
      count: r.count,
      pct: pct.toFixed(1),
      pctAcum: pctAcum.toFixed(1),
      classe
    };
  });
  return { items, totalOs, faturamento: faturamento2 };
}
var performanceAbcRouter = router({
  // Retorna mapa de clientes com retrabalho e/ou atraso no mês
  getClienteTags: protectedProcedure.input(z8.object({ mes: z8.number().min(1).max(12), ano: z8.number().min(2020).max(2030) })).query(async ({ input }) => {
    const { mes, ano } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { retrabalhos: {}, atrasos: {} };
    const { cotacoesFrete: cotacoesFrete2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { sql: sqlFn, gte: gte6, lte: lte5 } = await import("drizzle-orm");
    const startDate = new Date(ano, mes - 1, 1);
    const endDate = new Date(ano, mes, 0, 23, 59, 59);
    const cotacoes = await dbClient.select({
      destinatarioNome: cotacoesFrete2.destinatarioNome,
      temRetrabalho: cotacoesFrete2.temRetrabalho,
      dataEntregaPrevista: cotacoesFrete2.dataEntregaPrevista,
      dataDespacho: cotacoesFrete2.dataDespacho,
      status: cotacoesFrete2.status
    }).from(cotacoesFrete2).where(
      sqlFn`${cotacoesFrete2.createdAt} >= ${startDate} AND ${cotacoesFrete2.createdAt} <= ${endDate}`
    );
    const retrabalhosMap = {};
    const atrasosMap = {};
    for (const c of cotacoes) {
      const nome = c.destinatarioNome ?? "Desconhecido";
      if (c.temRetrabalho) {
        retrabalhosMap[nome] = (retrabalhosMap[nome] ?? 0) + 1;
      }
      if (c.dataEntregaPrevista) {
        const prevista = new Date(c.dataEntregaPrevista);
        const despacho = c.dataDespacho ? new Date(c.dataDespacho) : null;
        const atrasado = despacho ? despacho > prevista : c.status === "enviada" && prevista < /* @__PURE__ */ new Date();
        if (atrasado) {
          atrasosMap[nome] = (atrasosMap[nome] ?? 0) + 1;
        }
      }
    }
    return { retrabalhos: retrabalhosMap, atrasos: atrasosMap };
  }),
  // Get ABC curve for a given month/year (from cache or fresh fetch)
  getAbc: protectedProcedure.input(
    z8.object({
      mes: z8.number().min(1).max(12),
      ano: z8.number().min(2020).max(2030),
      tipo: z8.enum(["clientes", "produtos"]),
      forceRefresh: z8.boolean().optional().default(false)
    })
  ).query(async ({ input }) => {
    const { mes, ano, tipo, forceRefresh } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { items: [], totalOs: 0, faturamento: 0, fromCache: false, updatedAt: /* @__PURE__ */ new Date() };
    if (!forceRefresh) {
      const cached = await dbClient.select().from(abcCache).where(
        and8(
          eq10(abcCache.mes, mes),
          eq10(abcCache.ano, ano),
          eq10(abcCache.tipo, tipo)
        )
      ).limit(1);
      if (cached.length > 0) {
        const row = cached[0];
        return {
          items: JSON.parse(row.dados),
          totalOs: row.totalOs ?? 0,
          faturamento: parseFloat(row.faturamentoTotal ?? "0"),
          fromCache: true,
          updatedAt: row.updatedAt
        };
      }
    }
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    if (!publicKey || !accessToken) {
      return { items: [], totalOs: 0, faturamento: 0, fromCache: false, updatedAt: /* @__PURE__ */ new Date() };
    }
    const osArray = await fetchAllOsForMonth(ano, mes);
    const result = tipo === "clientes" ? buildAbcClientes(osArray) : buildAbcProdutos(osArray);
    const existing = await dbClient.select().from(abcCache).where(
      and8(
        eq10(abcCache.mes, mes),
        eq10(abcCache.ano, ano),
        eq10(abcCache.tipo, tipo)
      )
    ).limit(1);
    if (existing.length > 0) {
      await dbClient.update(abcCache).set({
        dados: JSON.stringify(result.items),
        totalOs: result.totalOs,
        faturamentoTotal: String(result.faturamento.toFixed(2))
      }).where(eq10(abcCache.id, existing[0].id));
    } else {
      await dbClient.insert(abcCache).values({
        mes,
        ano,
        tipo,
        dados: JSON.stringify(result.items),
        totalOs: result.totalOs,
        faturamentoTotal: String(result.faturamento.toFixed(2))
      });
    }
    return {
      items: result.items,
      totalOs: result.totalOs,
      faturamento: result.faturamento,
      fromCache: false,
      updatedAt: /* @__PURE__ */ new Date()
    };
  }),
  // Retorna evolução mensal dos principais produtos (para gráfico de área empilhada)
  getEvolucaoProdutos: protectedProcedure.input(z8.object({
    meses: z8.array(z8.object({ mes: z8.number().min(1).max(12), ano: z8.number().min(2020).max(2030) })),
    topN: z8.number().min(3).max(15).optional().default(8)
  })).query(async ({ input }) => {
    const { meses, topN } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { chartData: [], tabela: [], topProdutos: [], mesesLabels: [] };
    const caches = await Promise.all(
      meses.map(async ({ mes, ano }) => {
        const rows = await dbClient.select().from(abcCache).where(and8(eq10(abcCache.mes, mes), eq10(abcCache.ano, ano), eq10(abcCache.tipo, "produtos"))).limit(1);
        if (rows.length === 0) return { mes, ano, items: [] };
        return { mes, ano, items: JSON.parse(rows[0].dados) };
      })
    );
    const prodTotals = {};
    for (const c of caches) {
      for (const item of c.items) {
        prodTotals[item.nome] = (prodTotals[item.nome] ?? 0) + item.total;
      }
    }
    const topProdutos = Object.entries(prodTotals).sort((a, b) => b[1] - a[1]).slice(0, topN).map(([nome]) => nome);
    const MESES_NOMES2 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesesLabels = meses.map(({ mes, ano }) => `${MESES_NOMES2[mes - 1]} ${ano}`);
    const chartData = caches.map(({ mes, ano, items }) => {
      const label = `${MESES_NOMES2[mes - 1]} ${ano}`;
      const faturamentoTotal = items.reduce((s, i) => s + i.total, 0);
      const row = { mes: label };
      for (const prod of topProdutos) {
        const item = items.find((i) => i.nome === prod);
        row[prod] = item && faturamentoTotal > 0 ? parseFloat((item.total / faturamentoTotal * 100).toFixed(1)) : 0;
      }
      return row;
    });
    const tabela = topProdutos.map((prod) => {
      const row = { produto: prod };
      for (const c of caches) {
        const label = `${MESES_NOMES2[c.mes - 1]} ${c.ano}`;
        const faturamentoTotal = c.items.reduce((s, i) => s + i.total, 0);
        const item = c.items.find((i) => i.nome === prod);
        row[label] = item && faturamentoTotal > 0 ? parseFloat((item.total / faturamentoTotal * 100).toFixed(1)) : 0;
        row[`${label}_valor`] = item?.total ?? 0;
      }
      return row;
    });
    return { chartData, tabela, topProdutos, mesesLabels };
  }),
  // Busca lista de produtos do ERP via CADASTRO/PRODUTOS
  getProdutosERP: protectedProcedure.input(z8.object({ busca: z8.string().optional().default("") })).query(async ({ input }) => {
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    if (!publicKey || !accessToken) return { produtos: [] };
    const termo = input.busca.trim().toLowerCase();
    const produtos = (await listarProdutos()).map((p) => ({
      id: String(p.id ?? p.codigo ?? ""),
      nome: String(p.nome ?? p.descricao ?? ""),
      codigo: String(p.codigo ?? p.id ?? ""),
      categoria: String(p.categoria ?? ""),
      ativo: p.ativo !== false
    })).filter((p) => p.nome && (!termo || p.nome.toLowerCase().includes(termo)));
    return { produtos };
  })
});

// server/routers/auditoria.ts
import { z as z9 } from "zod";
init_db();
var auditoriaRouter = router({
  /**
   * Lista logs de auditoria com filtros opcionais e paginação.
   * Disponível apenas para usuários autenticados.
   */
  list: protectedProcedure.input(
    z9.object({
      acao: z9.enum(["CRIACAO", "EDICAO", "EXCLUSAO"]).optional(),
      usuarioId: z9.string().optional(),
      retrabalhoId: z9.number().int().positive().optional(),
      osRetrabalhada: z9.string().max(32).optional(),
      dataInicio: z9.string().optional(),
      // ISO date string "YYYY-MM-DD"
      dataFim: z9.string().optional(),
      // ISO date string "YYYY-MM-DD"
      page: z9.number().int().min(1).default(1),
      pageSize: z9.number().int().min(1).max(100).default(50)
    })
  ).query(async ({ input }) => {
    const dataInicio = input.dataInicio ? new Date(input.dataInicio) : void 0;
    const dataFim = input.dataFim ? new Date(input.dataFim) : void 0;
    const { rows, total } = await listAuditLogs({
      acao: input.acao,
      usuarioId: input.usuarioId,
      retrabalhoId: input.retrabalhoId,
      osRetrabalhada: input.osRetrabalhada,
      dataInicio,
      dataFim,
      page: input.page,
      pageSize: input.pageSize
    });
    return {
      rows: rows.map((r) => ({
        ...r,
        detalhes: r.detalhes ? (() => {
          try {
            return JSON.parse(r.detalhes);
          } catch {
            return null;
          }
        })() : null
      })),
      total,
      page: input.page,
      pageSize: input.pageSize,
      totalPages: Math.ceil(total / input.pageSize)
    };
  })
});

// server/routers/cargos.ts
import { z as z10 } from "zod";
init_db();
var cargoSchema = z10.object({
  titulo: z10.string().min(1).max(128),
  missao: z10.string().optional().nullable(),
  responsabilidades: z10.string().optional().nullable(),
  kpis: z10.string().optional().nullable(),
  ferramentas: z10.string().optional().nullable(),
  integracao: z10.string().optional().nullable(),
  riscos: z10.string().optional().nullable(),
  requisitos: z10.string().optional().nullable(),
  condicoes: z10.string().optional().nullable()
});
var cargosRouter = router({
  list: protectedProcedure.query(async () => {
    return listCargos();
  }),
  getById: protectedProcedure.input(z10.object({ id: z10.number() })).query(async ({ input }) => {
    return getCargoById(input.id);
  }),
  create: protectedProcedure.input(cargoSchema).mutation(async ({ input, ctx }) => {
    const id = await createCargo({
      ...input,
      createdBy: ctx.user.name ?? ctx.user.email ?? "sistema",
      updatedBy: ctx.user.name ?? ctx.user.email ?? "sistema"
    });
    return { id };
  }),
  update: protectedProcedure.input(z10.object({ id: z10.number() }).merge(cargoSchema.partial())).mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    await updateCargo(id, {
      ...data,
      updatedBy: ctx.user.name ?? ctx.user.email ?? "sistema"
    });
    return { ok: true };
  }),
  delete: protectedProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
    await deleteCargo(input.id);
    return { ok: true };
  }),
  /**
   * O arquivo agora sobe direto do browser para o UploadThing (ver
   * client/src/lib/upload.ts); esta procedure só recebe o resultado.
   * Mantida para não quebrar o contrato do client e para o caso de passar a
   * registrar o upload no banco.
   */
  uploadImage: protectedProcedure.input(z10.object({
    url: z10.string().url(),
    key: z10.string().min(1),
    fileName: z10.string(),
    mimeType: z10.string()
  })).mutation(async ({ input }) => {
    return { url: input.url, key: input.key, success: true };
  })
});

// server/routers/curriculos.ts
import { z as z11 } from "zod";
init_llm();
init_db();
var curriculosRouter = router({
  // Upload currículo e iniciar análise
  uploadAndAnalyze: protectedProcedure.input(z11.object({
    cargoId: z11.number(),
    fileName: z11.string(),
    url: z11.string().url(),
    key: z11.string().min(1),
    fileType: z11.string()
    // application/pdf, text/plain, etc
  })).mutation(async ({ input, ctx }) => {
    try {
      const analise = await createAnaliseCurriculo({
        cargoId: input.cargoId,
        curriculoFileName: input.fileName,
        curriculoUrl: input.url,
        curriculoKey: input.key,
        status: "analisando",
        uploadedBy: ctx.user.id,
        uploadedByName: ctx.user.name ?? ctx.user.email ?? "Usu\xE1rio"
      });
      if (!analise) {
        throw new Error("Falha ao criar registro de an\xE1lise");
      }
      const cargo = await getCargoById(input.cargoId);
      if (!cargo || !cargo.promptAnaliseIA) {
        throw new Error("Cargo n\xE3o encontrado ou sem prompt configurado");
      }
      const fileResp = await fetch(input.url);
      const fileBase64 = Buffer.from(await fileResp.arrayBuffer()).toString("base64");
      const fileContent = await buildFileContent(
        fileBase64,
        input.fileType,
        input.fileName
      );
      const llmResponse = await invokeLLM({
        messages: [
          {
            role: "system",
            content: cargo.promptAnaliseIA
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Por favor, analise o curr\xEDculo anexado e forne\xE7a a triagem conforme as instru\xE7\xF5es.`
              },
              fileContent
            ]
          }
        ]
      });
      const messageContent = llmResponse.choices?.[0]?.message?.content;
      const resultado = typeof messageContent === "string" ? messageContent : Array.isArray(messageContent) ? messageContent.filter((c) => c.type === "text").map((c) => c.text).join("\n") : "";
      await updateAnaliseCurriculo(analise.id, {
        resultado,
        status: "concluido"
      });
      return {
        id: analise.id,
        resultado,
        status: "concluido"
      };
    } catch (error) {
      console.error("[Curr\xEDculos] Erro ao analisar:", error);
      const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";
      if (input.cargoId) {
        const analises = await getAnaliseCurriculosByCargo(input.cargoId);
        if (analises.length > 0) {
          const latest = analises[0];
          if (latest.status === "analisando") {
            await updateAnaliseCurriculo(latest.id, {
              status: "erro",
              erroMensagem: errorMsg
            });
          }
        }
      }
      throw new Error(`Falha ao analisar curr\xEDculo: ${errorMsg}`);
    }
  }),
  // Listar análises de um cargo
  listByCargo: protectedProcedure.input(z11.object({ cargoId: z11.number() })).query(async ({ input }) => {
    return getAnaliseCurriculosByCargo(input.cargoId);
  }),
  // Deletar análise
  delete: protectedProcedure.input(z11.object({ id: z11.number() })).mutation(async ({ input }) => {
    return { ok: true };
  })
});

// server/routers/desempenhoColabMensal.ts
import { z as z12 } from "zod";
init_db();
init_schema();
import { and as and9, eq as eq11, asc as asc3 } from "drizzle-orm";
var desempenhoColabMensalRouter = router({
  // Listar todos os registros de um ano (opcionalmente filtrar por categoria)
  list: publicProcedure.input(z12.object({
    ano: z12.number(),
    categoria: z12.string().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [eq11(desempenhoColaboradorMensal.ano, input.ano)];
    if (input.categoria) {
      conditions.push(eq11(desempenhoColaboradorMensal.categoria, input.categoria));
    }
    return db5.select().from(desempenhoColaboradorMensal).where(and9(...conditions)).orderBy(asc3(desempenhoColaboradorMensal.nome), asc3(desempenhoColaboradorMensal.mes));
  }),
  // Listar colaboradores distintos cadastrados (nome + categoria)
  listColaboradores: publicProcedure.input(z12.object({ ano: z12.number().optional() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select({
      nome: desempenhoColaboradorMensal.nome,
      categoria: desempenhoColaboradorMensal.categoria
    }).from(desempenhoColaboradorMensal);
    const seen = /* @__PURE__ */ new Set();
    const result = [];
    for (const r of rows) {
      const key = `${r.nome}|${r.categoria}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push({ nome: r.nome, categoria: r.categoria });
      }
    }
    return result.sort((a, b) => a.nome.localeCompare(b.nome));
  }),
  // Upsert (criar ou atualizar) registro mensal de um colaborador
  upsert: publicProcedure.input(z12.object({
    nome: z12.string().min(1),
    categoria: z12.enum(["soldador", "vendedor", "operador_maquinas"]),
    mes: z12.number().min(1).max(12),
    ano: z12.number(),
    numFaltas: z12.number().nullable().optional(),
    // Soldador
    metrosSoldados: z12.number().nullable().optional(),
    numRetrabalhos: z12.number().nullable().optional(),
    // Vendedor
    numPropostas: z12.number().nullable().optional(),
    numVendas: z12.number().nullable().optional(),
    faturamentoVendedor: z12.number().nullable().optional(),
    ticketMedioVendedor: z12.number().nullable().optional(),
    // Operador de Máquinas
    numTrabalhos: z12.number().nullable().optional(),
    notas: z12.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    let ticketMedio = input.ticketMedioVendedor ?? null;
    if (input.categoria === "vendedor" && input.faturamentoVendedor && input.numVendas && input.numVendas > 0) {
      if (ticketMedio == null) ticketMedio = input.faturamentoVendedor / input.numVendas;
    }
    const existing = await db5.select({ id: desempenhoColaboradorMensal.id }).from(desempenhoColaboradorMensal).where(and9(
      eq11(desempenhoColaboradorMensal.nome, input.nome),
      eq11(desempenhoColaboradorMensal.categoria, input.categoria),
      eq11(desempenhoColaboradorMensal.mes, input.mes),
      eq11(desempenhoColaboradorMensal.ano, input.ano)
    ));
    const payload = {
      nome: input.nome,
      categoria: input.categoria,
      mes: input.mes,
      ano: input.ano,
      numFaltas: input.numFaltas ?? 0,
      metrosSoldados: input.metrosSoldados != null ? String(input.metrosSoldados) : null,
      numRetrabalhos: input.numRetrabalhos ?? 0,
      numPropostas: input.numPropostas ?? 0,
      numVendas: input.numVendas ?? 0,
      faturamentoVendedor: input.faturamentoVendedor != null ? String(input.faturamentoVendedor) : null,
      ticketMedioVendedor: ticketMedio != null ? String(ticketMedio) : null,
      numTrabalhos: input.numTrabalhos ?? 0,
      notas: input.notas ?? null
    };
    if (existing.length > 0) {
      await db5.update(desempenhoColaboradorMensal).set(payload).where(eq11(desempenhoColaboradorMensal.id, existing[0].id));
      return { id: existing[0].id, action: "updated" };
    } else {
      const [result] = await db5.insert(desempenhoColaboradorMensal).values(payload).returning({ id: desempenhoColaboradorMensal.id });
      return { id: result.id, action: "created" };
    }
  }),
  // Deletar colaborador (todos os registros de um nome+categoria)
  deleteColaborador: publicProcedure.input(z12.object({ nome: z12.string(), categoria: z12.string() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(desempenhoColaboradorMensal).where(and9(
      eq11(desempenhoColaboradorMensal.nome, input.nome),
      eq11(desempenhoColaboradorMensal.categoria, input.categoria)
    ));
    return { ok: true };
  })
});

// server/routers/empacotamento.ts
import { z as z13 } from "zod";
init_schema();
init_mubisys_client();
init_db_connection();
init_schema();
import { drizzle as drizzle6 } from "drizzle-orm/neon-serverless";
import { eq as eq12, and as and10, desc as desc7, asc as asc4, gte as gte4, lte as lte3, sql as sql7 } from "drizzle-orm";
async function buscarOsMubisys(numeroOs) {
  const os = await buscarOSPorNumero(numeroOs);
  if (!os) return null;
  const end = os.cliente_endereco?.[0];
  const cep = (end?.cep ?? "").replace(/\D/g, "");
  const endereco = [end?.logradouro, end?.numero, end?.complemento, end?.bairro].filter(Boolean).join(", ");
  const itens = os.itens ?? [];
  let larguraM = null;
  let alturaM = null;
  let metrosQuadrados = null;
  let totalM2 = 0;
  let primeiroLetreiro = null;
  const todosItens = [];
  for (const item of itens) {
    todosItens.push(item);
    if (Array.isArray(item.itens_agrupados)) {
      for (const sub of item.itens_agrupados) todosItens.push(sub);
    }
  }
  for (const item of todosItens) {
    const nomeItem = (item.item ?? item.descricao ?? "").toLowerCase();
    if (!nomeItem.includes("letreiro")) continue;
    const l = parseFloat(String(item.largura ?? 0));
    const a = parseFloat(String(item.altura ?? 0));
    const qtd = parseFloat(String(item.quantidade ?? 1)) || 1;
    if (l > 0 && a > 0) {
      totalM2 += l * a * qtd;
      if (!primeiroLetreiro) primeiroLetreiro = { l, a };
    }
  }
  if (totalM2 > 0) {
    larguraM = primeiroLetreiro?.l ?? null;
    alturaM = primeiroLetreiro?.a ?? null;
    metrosQuadrados = parseFloat(totalM2.toFixed(4));
  }
  return {
    nomeCliente: String(os.cliente ?? "").trim(),
    cnpj: os.cliente_cnpj_cpf ?? "",
    cep,
    endereco,
    cidade: end?.cidade ?? "",
    estado: end?.estado ?? "",
    empresa: os.empresa ?? "",
    larguraM,
    alturaM,
    metrosQuadrados
  };
}
var _db5 = null;
function getDb5() {
  if (!_db5) _db5 = drizzle6(getPool());
  return _db5;
}
var db4 = {
  select: () => getDb5().select(),
  insert: (t2) => getDb5().insert(t2),
  update: (t2) => getDb5().update(t2),
  delete: (t2) => getDb5().delete(t2)
};
async function calcularTempoEstimadoMin(pedido) {
  if (!pedido) return 0;
  if (pedido.modeloId) {
    const modelos = await getDb5().select().from(empacotamentoModelos).where(eq12(empacotamentoModelos.id, pedido.modeloId)).limit(1);
    const modelo = modelos[0];
    const tempoPorM2 = parseFloat(String(modelo?.tempoPorM2Min ?? "0"));
    const area = parseFloat(String(pedido.metrosQuadrados ?? "0"));
    if (tempoPorM2 > 0 && area > 0) return tempoPorM2 * area;
  } else if (pedido.modeloCaixaId) {
    const mcs = await getDb5().select().from(empacotamentoModelosCaixa).where(eq12(empacotamentoModelosCaixa.id, pedido.modeloCaixaId)).limit(1);
    const mc = mcs[0];
    if (mc) {
      const tipoCaixa = mc.tipoCaixa;
      if (tipoCaixa === "personalizada") {
        const l = parseFloat(String(mc.larguraCm ?? "0")), a2 = parseFloat(String(mc.alturaCm ?? "0")), p2 = parseFloat(String(mc.profundidadeCm ?? "0"));
        const tM3 = parseFloat(String(mc.tempoPorM3Min ?? "0"));
        if (l > 0 && a2 > 0 && p2 > 0 && tM3 > 0) return l * a2 * p2 / 1e6 * tM3;
      } else {
        const l = parseFloat(String(mc.larguraCm ?? "0")), a2 = parseFloat(String(mc.alturaCm ?? "0"));
        const tM2 = parseFloat(String(mc.tempoPorM2Min ?? "0"));
        if (l > 0 && a2 > 0 && tM2 > 0) return l * a2 / 1e4 * tM2;
      }
    }
  }
  return 0;
}
async function calcularRanking(inicioTs, fimTs) {
  const sessoes = await getDb5().select().from(empacotamentoSessoes).where(and10(
    eq12(empacotamentoSessoes.status, "finalizado"),
    sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
    sql7`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
    sql7`${empacotamentoSessoes.registradoEm} <= ${fimTs}`
  ));
  const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1));
  const cfg = config[0] ?? { valorPorMinuto: "0.15" };
  const valorMin = parseFloat(String(cfg.valorPorMinuto));
  const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
  let pedidos = [];
  if (pedidoIds.length > 0) {
    pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql7`${empacotamentoPedidos.id} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
  }
  const porOperador = {};
  for (const sessao of sessoes) {
    const nome = sessao.operadorNome ?? "Desconhecido";
    const tempoSeg = sessao.tempoRegistradoSegundos ?? sessao.totalSegundos ?? 0;
    const tempoEfetivoMin = tempoSeg / 60;
    const pedido = pedidos.find((p) => p.id === sessao.pedidoId);
    const tempoEstimadoMin = await calcularTempoEstimadoMin(pedido);
    let fator = 1;
    if (tempoEstimadoMin > 0 && tempoEfetivoMin > 0) {
      const varPct = (tempoEfetivoMin - tempoEstimadoMin) / tempoEstimadoMin;
      const passos = Math.floor(Math.abs(varPct) / 0.05);
      const ajuste = passos * 0.05;
      fator = varPct > 0 ? Math.max(0.5, 1 - ajuste) : Math.min(1.5, 1 + ajuste);
    }
    if (!porOperador[nome]) porOperador[nome] = { nome, totalMinutos: 0, totalPedidos: 0, eficienciaMedia: 0, eficienciaCount: 0, valorTotal: 0 };
    porOperador[nome].totalMinutos += tempoEfetivoMin;
    porOperador[nome].totalPedidos += 1;
    porOperador[nome].valorTotal += tempoEfetivoMin * valorMin * fator;
    if (tempoEstimadoMin > 0 && tempoEfetivoMin > 0) {
      porOperador[nome].eficienciaMedia += Math.round(tempoEstimadoMin / tempoEfetivoMin * 100);
      porOperador[nome].eficienciaCount += 1;
    }
  }
  return Object.values(porOperador).map((o) => ({
    posicao: 0,
    nome: o.nome,
    totalMinutos: parseFloat(o.totalMinutos.toFixed(1)),
    totalPedidos: o.totalPedidos,
    eficienciaMedia: o.eficienciaCount > 0 ? Math.round(o.eficienciaMedia / o.eficienciaCount) : null,
    valorTotal: parseFloat(o.valorTotal.toFixed(2))
  })).sort((a, b) => (b.eficienciaMedia ?? 0) - (a.eficienciaMedia ?? 0) || b.totalMinutos - a.totalMinutos).map((o, idx) => ({ ...o, posicao: idx + 1 }));
}
var empacotamentoRouter = router({
  // ─── MODELOS DE LETREIRO ────────────────────────────────────────────────────
  modelos: router({
    list: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelos).orderBy(asc4(empacotamentoModelos.nome));
    }),
    listAtivos: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelos).where(eq12(empacotamentoModelos.ativo, 1)).orderBy(asc4(empacotamentoModelos.nome));
    }),
    create: publicProcedure.input(z13.object({
      nome: z13.string().min(1).max(128),
      descricao: z13.string().optional(),
      tempoPorM2Min: z13.number().min(0).optional(),
      valorProdutividadePorMinLetreiro: z13.number().min(0).optional()
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoModelos).values({
        nome: input.nome,
        descricao: input.descricao ?? null,
        tempoPorM2Min: input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null,
        valorProdutividadePorMinLetreiro: input.valorProdutividadePorMinLetreiro != null ? String(input.valorProdutividadePorMinLetreiro) : null,
        ativo: 1
      });
      return { success: true };
    }),
    update: publicProcedure.input(z13.object({
      id: z13.number(),
      nome: z13.string().min(1).max(128),
      descricao: z13.string().optional(),
      ativo: z13.number().optional(),
      modeloCaixaIdPadrao: z13.number().nullable().optional(),
      tempoPorM2Min: z13.number().min(0).nullable().optional(),
      valorProdutividadePorMinLetreiro: z13.number().min(0).nullable().optional()
    })).mutation(async ({ input }) => {
      const upd = { nome: input.nome, descricao: input.descricao ?? null, ativo: input.ativo ?? 1 };
      if (input.modeloCaixaIdPadrao !== void 0) upd.modeloCaixaIdPadrao = input.modeloCaixaIdPadrao;
      if (input.tempoPorM2Min !== void 0) upd.tempoPorM2Min = input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null;
      if (input.valorProdutividadePorMinLetreiro !== void 0) upd.valorProdutividadePorMinLetreiro = input.valorProdutividadePorMinLetreiro != null ? String(input.valorProdutividadePorMinLetreiro) : null;
      await db4.update(empacotamentoModelos).set(upd).where(eq12(empacotamentoModelos.id, input.id));
      return { success: true };
    }),
    // Atualiza tempo e produtividade de TODOS os letreiros de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure.input(z13.object({
      tempoPorM2Min: z13.number().min(0).nullable(),
      valorProdutividadePorMinLetreiro: z13.number().min(0).nullable()
    })).mutation(async ({ input }) => {
      const upd = {};
      if (input.tempoPorM2Min !== null) upd.tempoPorM2Min = String(input.tempoPorM2Min);
      if (input.valorProdutividadePorMinLetreiro !== null) upd.valorProdutividadePorMinLetreiro = String(input.valorProdutividadePorMinLetreiro);
      if (Object.keys(upd).length > 0) {
        await db4.update(empacotamentoModelos).set(upd);
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoModelos).where(eq12(empacotamentoModelos.id, input.id));
      return { success: true };
    })
  }),
  // ─── MODELOS DE CAIXA ───────────────────────────────────────────────────────
  modelosCaixa: router({
    list: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelosCaixa).orderBy(asc4(empacotamentoModelosCaixa.nome));
    }),
    listAtivos: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelosCaixa).where(eq12(empacotamentoModelosCaixa.ativo, 1)).orderBy(asc4(empacotamentoModelosCaixa.nome));
    }),
    create: publicProcedure.input(z13.object({
      nome: z13.string().min(1).max(128),
      descricao: z13.string().optional(),
      larguraCm: z13.number().optional(),
      alturaCm: z13.number().optional(),
      profundidadeCm: z13.number().optional(),
      tipoCaixa: z13.enum(["padronizada", "personalizada"]).default("padronizada"),
      custoAquisicao: z13.number().min(0).default(0),
      tempoPorM2Min: z13.number().min(0).optional(),
      tempoPorM3Min: z13.number().min(0).optional(),
      tempoPorMetroArestaMin: z13.number().min(0).optional(),
      valorProdutividadePorCm2: z13.number().min(0).optional()
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoModelosCaixa).values({
        nome: input.nome,
        descricao: input.descricao ?? null,
        larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
        alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
        profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
        tipoCaixa: input.tipoCaixa,
        custoAquisicao: String(input.custoAquisicao),
        custoAquisicaoAtualizadoEm: /* @__PURE__ */ new Date(),
        tempoPorM2Min: input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null,
        tempoPorM3Min: input.tempoPorM3Min != null ? String(input.tempoPorM3Min) : null,
        tempoPorMetroArestaMin: input.tempoPorMetroArestaMin != null ? String(input.tempoPorMetroArestaMin) : null,
        valorProdutividadePorCm2: input.valorProdutividadePorCm2 != null ? String(input.valorProdutividadePorCm2) : null,
        ativo: 1
      });
      return { success: true };
    }),
    update: publicProcedure.input(z13.object({
      id: z13.number(),
      nome: z13.string().min(1).max(128),
      descricao: z13.string().optional(),
      larguraCm: z13.number().optional(),
      alturaCm: z13.number().optional(),
      profundidadeCm: z13.number().optional(),
      tipoCaixa: z13.enum(["padronizada", "personalizada"]).optional(),
      custoAquisicao: z13.number().min(0).optional(),
      tempoPorM2Min: z13.number().min(0).optional(),
      tempoPorM3Min: z13.number().min(0).nullable().optional(),
      tempoPorMetroArestaMin: z13.number().min(0).nullable().optional(),
      valorProdutividadePorCm2: z13.number().min(0).nullable().optional(),
      ativo: z13.number().optional()
    })).mutation(async ({ input }) => {
      const setData = {
        nome: input.nome,
        descricao: input.descricao ?? null,
        larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
        alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
        profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
        tipoCaixa: input.tipoCaixa ?? "padronizada",
        ativo: input.ativo ?? 1
      };
      if (input.custoAquisicao != null) {
        setData.custoAquisicao = String(input.custoAquisicao);
        setData.custoAquisicaoAtualizadoEm = /* @__PURE__ */ new Date();
      }
      if (input.tempoPorM2Min != null) setData.tempoPorM2Min = String(input.tempoPorM2Min);
      if (input.tempoPorM3Min !== void 0) setData.tempoPorM3Min = input.tempoPorM3Min != null ? String(input.tempoPorM3Min) : null;
      if (input.tempoPorMetroArestaMin !== void 0) setData.tempoPorMetroArestaMin = input.tempoPorMetroArestaMin != null ? String(input.tempoPorMetroArestaMin) : null;
      if (input.valorProdutividadePorCm2 !== void 0) setData.valorProdutividadePorCm2 = input.valorProdutividadePorCm2 != null ? String(input.valorProdutividadePorCm2) : null;
      await db4.update(empacotamentoModelosCaixa).set(setData).where(eq12(empacotamentoModelosCaixa.id, input.id));
      return { success: true };
    }),
    // Atualiza tempo e produtividade de TODAS as caixas de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure.input(z13.object({
      tempoPorM2Min: z13.number().min(0).nullable(),
      tempoPorMetroArestaMin: z13.number().min(0).nullable(),
      valorProdutividadePorCm2: z13.number().min(0).nullable()
    })).mutation(async ({ input }) => {
      const upd = {};
      if (input.tempoPorM2Min !== null) upd.tempoPorM2Min = String(input.tempoPorM2Min);
      if (input.tempoPorMetroArestaMin !== null) upd.tempoPorMetroArestaMin = String(input.tempoPorMetroArestaMin);
      if (input.valorProdutividadePorCm2 !== null) upd.valorProdutividadePorCm2 = String(input.valorProdutividadePorCm2);
      if (Object.keys(upd).length > 0) {
        await db4.update(empacotamentoModelosCaixa).set(upd);
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoModelosCaixa).where(eq12(empacotamentoModelosCaixa.id, input.id));
      return { success: true };
    })
  }),
  // ─── CHECKLIST POR MODELO DE CAIXA ─────────────────────────────────────────
  checklist: router({
    listPorCaixa: publicProcedure.input(z13.object({ modeloCaixaId: z13.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoChecklistItens).where(eq12(empacotamentoChecklistItens.modeloCaixaId, input.modeloCaixaId)).orderBy(asc4(empacotamentoChecklistItens.ordem));
    }),
    addItem: publicProcedure.input(z13.object({
      modeloCaixaId: z13.number(),
      descricao: z13.string().min(1).max(256),
      obrigatorio: z13.number().default(1),
      ordem: z13.number().default(0)
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoChecklistItens).values({
        modeloCaixaId: input.modeloCaixaId,
        descricao: input.descricao,
        obrigatorio: input.obrigatorio,
        ordem: input.ordem
      });
      return { success: true };
    }),
    updateItem: publicProcedure.input(z13.object({
      id: z13.number(),
      descricao: z13.string().min(1).max(256),
      obrigatorio: z13.number().optional(),
      ordem: z13.number().optional()
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoChecklistItens).set({
        descricao: input.descricao,
        obrigatorio: input.obrigatorio ?? 1,
        ordem: input.ordem ?? 0
      }).where(eq12(empacotamentoChecklistItens.id, input.id));
      return { success: true };
    }),
    deleteItem: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoChecklistItens).where(eq12(empacotamentoChecklistItens.id, input.id));
      return { success: true };
    }),
    // Checklist preenchido por pedido
    getPorPedido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoPedidoChecklist).where(eq12(empacotamentoPedidoChecklist.pedidoId, input.pedidoId));
    }),
    marcarItem: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      itemId: z13.number(),
      marcado: z13.number(),
      // 0 ou 1
      marcadoPor: z13.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoChecklist).where(
        and10(
          eq12(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
          eq12(empacotamentoPedidoChecklist.itemId, input.itemId)
        )
      );
      if (existing.length > 0) {
        await db4.update(empacotamentoPedidoChecklist).set({
          marcado: input.marcado,
          marcadoPor: input.marcadoPor ?? null,
          marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null
        }).where(
          and10(
            eq12(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
            eq12(empacotamentoPedidoChecklist.itemId, input.itemId)
          )
        );
      } else {
        await db4.insert(empacotamentoPedidoChecklist).values({
          pedidoId: input.pedidoId,
          itemId: input.itemId,
          marcado: input.marcado,
          marcadoPor: input.marcadoPor ?? null,
          marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null
        });
      }
      return { success: true };
    })
  }),
  // ─── CHECKLIST POR MODELO DE LETREIRO ────────────────────────────────────
  checklistLetreiro: router({
    listPorModelo: publicProcedure.input(z13.object({ modeloId: z13.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoChecklistLetreitoItens).where(eq12(empacotamentoChecklistLetreitoItens.modeloLetreitoId, input.modeloId)).orderBy(asc4(empacotamentoChecklistLetreitoItens.ordem));
    }),
    addItem: publicProcedure.input(z13.object({
      modeloId: z13.number(),
      descricao: z13.string().min(1).max(512),
      obrigatorio: z13.number().default(1),
      ordem: z13.number().default(0)
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoChecklistLetreitoItens).values({
        modeloLetreitoId: input.modeloId,
        descricao: input.descricao,
        obrigatorio: input.obrigatorio,
        ordem: input.ordem
      });
      return { success: true };
    }),
    updateItem: publicProcedure.input(z13.object({
      id: z13.number(),
      descricao: z13.string().min(1).max(512),
      obrigatorio: z13.number().optional(),
      ordem: z13.number().optional()
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoChecklistLetreitoItens).set({ descricao: input.descricao, obrigatorio: input.obrigatorio ?? 1, ordem: input.ordem ?? 0 }).where(eq12(empacotamentoChecklistLetreitoItens.id, input.id));
      return { success: true };
    }),
    deleteItem: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoChecklistLetreitoItens).where(eq12(empacotamentoChecklistLetreitoItens.id, input.id));
      return { success: true };
    }),
    getPorPedido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoPedidoChecklistLetreiro).where(eq12(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId));
    }),
    marcarItem: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      itemId: z13.number(),
      marcado: z13.number(),
      marcadoPor: z13.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoChecklistLetreiro).where(and10(
        eq12(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
        eq12(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
      ));
      if (existing.length > 0) {
        await db4.update(empacotamentoPedidoChecklistLetreiro).set({ marcado: input.marcado, marcadoPor: input.marcadoPor ?? null, marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null }).where(and10(
          eq12(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
          eq12(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
        ));
      } else {
        await db4.insert(empacotamentoPedidoChecklistLetreiro).values({
          pedidoId: input.pedidoId,
          itemId: input.itemId,
          marcado: input.marcado,
          marcadoPor: input.marcadoPor ?? null,
          marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null
        });
      }
      return { success: true };
    })
  }),
  // ─── TABELA DE PREÇOS (letreiro × caixa) ────────────────────────────────────
  precos: router({
    list: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoTabelaPrecos).orderBy(asc4(empacotamentoTabelaPrecos.modeloId), asc4(empacotamentoTabelaPrecos.tipoCaixa));
    }),
    listByModelo: publicProcedure.input(z13.object({ modeloId: z13.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoTabelaPrecos).where(eq12(empacotamentoTabelaPrecos.modeloId, input.modeloId)).orderBy(asc4(empacotamentoTabelaPrecos.tipoCaixa));
    }),
    upsert: publicProcedure.input(z13.object({
      modeloId: z13.number(),
      tipoCaixa: z13.string().min(1).max(64),
      valorComissao: z13.number().min(0)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoTabelaPrecos).where(
        and10(
          eq12(empacotamentoTabelaPrecos.modeloId, input.modeloId),
          eq12(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
        )
      );
      if (existing.length > 0) {
        await db4.update(empacotamentoTabelaPrecos).set({ valorComissao: String(input.valorComissao) }).where(
          and10(
            eq12(empacotamentoTabelaPrecos.modeloId, input.modeloId),
            eq12(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
          )
        );
      } else {
        await db4.insert(empacotamentoTabelaPrecos).values({
          modeloId: input.modeloId,
          tipoCaixa: input.tipoCaixa,
          valorComissao: String(input.valorComissao)
        });
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoTabelaPrecos).where(eq12(empacotamentoTabelaPrecos.id, input.id));
      return { success: true };
    })
  }),
  // ─── PEDIDOS ────────────────────────────────────────────────────────────────
  pedidos: router({
    list: publicProcedure.input(z13.object({
      kanbanStatus: z13.enum(["aguardando", "embalando", "patio", "abandonado", "todos"]).optional()
    }).optional()).query(async ({ input }) => {
      if (input?.kanbanStatus && input.kanbanStatus !== "todos") {
        return await getDb5().select().from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.kanbanStatus, input.kanbanStatus)).orderBy(asc4(empacotamentoPedidos.prazoEntrega), desc7(empacotamentoPedidos.createdAt));
      }
      return await getDb5().select().from(empacotamentoPedidos).orderBy(asc4(empacotamentoPedidos.prazoEntrega), desc7(empacotamentoPedidos.createdAt));
    }),
    getById: publicProcedure.input(z13.object({ id: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.id, input.id));
      return rows[0] ?? null;
    }),
    // ─── Lista pedidos de um vendedor específico (para alertas de status) ──────
    listPorVendedor: publicProcedure.input(z13.object({ vendedorNome: z13.string() })).query(async ({ input }) => {
      const nome = input.vendedorNome.toLowerCase().trim();
      const todos = await getDb5().select({
        id: empacotamentoPedidos.id,
        numeroPedido: empacotamentoPedidos.numeroPedido,
        cliente: empacotamentoPedidos.cliente,
        kanbanStatus: empacotamentoPedidos.kanbanStatus,
        createdByNome: empacotamentoPedidos.createdByNome,
        updatedAt: empacotamentoPedidos.updatedAt
      }).from(empacotamentoPedidos).orderBy(desc7(empacotamentoPedidos.updatedAt));
      return todos.filter((p) => (p.createdByNome ?? "").toLowerCase().trim() === nome);
    }),
    // ─── INTEGRAÇÃO MUBISYS: Buscar dados da OS pelo número ───────────────────────────
    buscarOs: publicProcedure.input(z13.object({ numeroOs: z13.string().min(1) })).query(async ({ input }) => {
      const dados = await buscarOsMubisys(input.numeroOs);
      return dados;
    }),
    create: publicProcedure.input(z13.object({
      numeroPedido: z13.string().min(1).max(64),
      cliente: z13.string().min(1).max(256),
      modeloId: z13.number().optional(),
      modeloNome: z13.string().optional(),
      modeloCaixaId: z13.number().optional(),
      modeloCaixaNome: z13.string().optional(),
      tipoCaixa: z13.string().max(64).default(""),
      arquivoUrl: z13.string().optional(),
      arquivoKey: z13.string().optional(),
      arquivoTipo: z13.string().optional(),
      prazoEntrega: z13.string().optional(),
      // ISO datetime
      horarioMaximo: z13.string().optional(),
      // "HH:MM"
      observacoes: z13.string().optional(),
      createdBy: z13.number().optional(),
      createdByNome: z13.string().optional(),
      larguraCm: z13.number().optional(),
      alturaCm: z13.number().optional(),
      profundidadeCm: z13.number().optional(),
      pesoKg: z13.number().min(0).optional(),
      metrosQuadrados: z13.number().min(0).optional(),
      cnpjCliente: z13.string().optional(),
      cepCliente: z13.string().optional(),
      enderecoCliente: z13.string().optional()
    })).mutation(async ({ input }) => {
      const [result] = await db4.insert(empacotamentoPedidos).values({
        numeroPedido: input.numeroPedido,
        cliente: input.cliente,
        modeloId: input.modeloId ?? null,
        modeloNome: input.modeloNome ?? null,
        modeloCaixaId: input.modeloCaixaId ?? null,
        modeloCaixaNome: input.modeloCaixaNome ?? null,
        tipoCaixa: input.tipoCaixa,
        arquivoUrl: input.arquivoUrl ?? null,
        arquivoKey: input.arquivoKey ?? null,
        arquivoTipo: input.arquivoTipo ?? null,
        kanbanStatus: "aguardando",
        prazoEntrega: input.prazoEntrega ? new Date(input.prazoEntrega) : null,
        horarioMaximo: input.horarioMaximo ?? null,
        observacoes: input.observacoes ?? null,
        createdBy: input.createdBy ?? null,
        createdByNome: input.createdByNome ?? null,
        larguraCm: input.larguraCm != null ? String(input.larguraCm) : null,
        alturaCm: input.alturaCm != null ? String(input.alturaCm) : null,
        profundidadeCm: input.profundidadeCm != null ? String(input.profundidadeCm) : null,
        pesoKg: input.pesoKg != null ? String(input.pesoKg) : null,
        metrosQuadrados: input.metrosQuadrados != null ? String(input.metrosQuadrados) : null,
        cnpjCliente: input.cnpjCliente ?? null,
        cepCliente: input.cepCliente ?? null,
        enderecoCliente: input.enderecoCliente ?? null
      }).returning({ id: empacotamentoPedidos.id });
      return { success: true, id: result.id };
    }),
    update: publicProcedure.input(z13.object({
      id: z13.number(),
      numeroPedido: z13.string().optional(),
      cliente: z13.string().optional(),
      modeloId: z13.number().optional(),
      modeloNome: z13.string().optional(),
      modeloCaixaId: z13.number().optional(),
      modeloCaixaNome: z13.string().optional(),
      tipoCaixa: z13.string().optional(),
      prazoEntrega: z13.string().optional(),
      horarioMaximo: z13.string().optional(),
      observacoes: z13.string().optional()
    })).mutation(async ({ input }) => {
      const { id, prazoEntrega, ...rest } = input;
      await db4.update(empacotamentoPedidos).set({
        ...rest,
        prazoEntrega: prazoEntrega ? new Date(prazoEntrega) : void 0
      }).where(eq12(empacotamentoPedidos.id, id));
      return { success: true };
    }),
    atualizarDimensoes: publicProcedure.input(z13.object({
      id: z13.number(),
      larguraCm: z13.number().min(0).nullable().optional(),
      alturaCm: z13.number().min(0).nullable().optional(),
      profundidadeCm: z13.number().min(0).nullable().optional(),
      pesoKg: z13.number().min(0).nullable().optional()
    })).mutation(async ({ input }) => {
      const { id, ...dims } = input;
      const setData = {};
      if (dims.larguraCm !== void 0) setData.larguraCm = dims.larguraCm != null ? String(dims.larguraCm) : null;
      if (dims.alturaCm !== void 0) setData.alturaCm = dims.alturaCm != null ? String(dims.alturaCm) : null;
      if (dims.profundidadeCm !== void 0) setData.profundidadeCm = dims.profundidadeCm != null ? String(dims.profundidadeCm) : null;
      if (dims.pesoKg !== void 0) setData.pesoKg = dims.pesoKg != null ? String(dims.pesoKg) : null;
      await getDb5().update(empacotamentoPedidos).set(setData).where(eq12(empacotamentoPedidos.id, id));
      return { success: true };
    }),
    moverKanban: publicProcedure.input(z13.object({
      id: z13.number(),
      kanbanStatus: z13.enum(["aguardando", "embalando", "patio", "abandonado"])
    })).mutation(async ({ input }) => {
      const updates = { kanbanStatus: input.kanbanStatus };
      const { cotacoesFrete: cotacoesFrete2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      if (input.kanbanStatus === "patio") {
        updates.finalizadoEm = /* @__PURE__ */ new Date();
        const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.id, input.id));
        const pedido = pedidos[0];
        if (pedido) {
          const existing = await getDb5().select({ id: cotacoesFrete2.id }).from(cotacoesFrete2).where(eq12(cotacoesFrete2.empacotamentoPedidoId, input.id)).limit(1);
          if (existing.length === 0) {
            const fotos = await getDb5().select().from(empacotamentoPedidoFotos).where(eq12(empacotamentoPedidoFotos.pedidoId, input.id)).orderBy(desc7(empacotamentoPedidoFotos.id)).limit(1);
            const fotoUrl = fotos[0]?.url ?? pedido.arquivoUrl ?? null;
            let municipioAuto = "(a preencher)";
            let estadoAuto = "SP";
            const endStr = pedido.enderecoCliente ?? "";
            if (endStr) {
              const partes = endStr.split(",").map((s) => s.trim());
              const ultimaParte = partes[partes.length - 1] ?? "";
              const cidadeEstado = ultimaParte.split("-").map((s) => s.trim());
              if (cidadeEstado.length >= 2) {
                municipioAuto = cidadeEstado[0];
                estadoAuto = cidadeEstado[1];
              } else if (cidadeEstado.length === 1 && cidadeEstado[0]) {
                municipioAuto = cidadeEstado[0];
              }
            }
            await getDb5().insert(cotacoesFrete2).values({
              destinatarioNome: pedido.cliente ?? "(a preencher)",
              destinatarioCnpj: pedido.cnpjCliente ?? void 0,
              cepDestino: pedido.cepCliente ?? void 0,
              municipio: municipioAuto,
              estado: estadoAuto,
              observacoes: `Pedido de empacotamento #${pedido.numeroPedido ?? pedido.id} \u2014 ${pedido.modeloNome ?? ""}`.trim(),
              fotoUrl: fotoUrl ?? void 0,
              empacotamentoPedidoId: pedido.id,
              empacotamentoPedidoNumero: pedido.numeroPedido ?? String(pedido.id),
              dimensoesLargura: pedido.larguraCm ?? void 0,
              dimensoesAltura: pedido.alturaCm ?? void 0,
              dimensoesComprimento: pedido.profundidadeCm ?? void 0,
              pesoKg: pedido.pesoKg ?? void 0,
              tipoMaterial: pedido.modeloNome ?? void 0,
              status: "aberta"
            });
          } else {
            await getDb5().update(cotacoesFrete2).set({ status: "aberta" }).where(
              eq12(cotacoesFrete2.empacotamentoPedidoId, input.id)
            );
          }
        }
      }
      if (input.kanbanStatus === "embalando" || input.kanbanStatus === "aguardando") {
        await getDb5().update(cotacoesFrete2).set({ status: "cancelada" }).where(
          eq12(cotacoesFrete2.empacotamentoPedidoId, input.id)
        );
      }
      await getDb5().update(empacotamentoPedidos).set(updates).where(eq12(empacotamentoPedidos.id, input.id));
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoPedidos).where(eq12(empacotamentoPedidos.id, input.id));
      return { success: true };
    }),
    uploadArquivo: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      url: z13.string().url(),
      key: z13.string().min(1),
      mimeType: z13.string(),
      fileName: z13.string()
    })).mutation(async ({ input }) => {
      const tipo = input.mimeType.includes("pdf") ? "pdf" : "image";
      await db4.update(empacotamentoPedidos).set({ arquivoUrl: input.url, arquivoKey: input.key, arquivoTipo: tipo }).where(eq12(empacotamentoPedidos.id, input.pedidoId));
      return { url: input.url, key: input.key };
    }),
    uploadFoto: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      url: z13.string().url(),
      key: z13.string().min(1),
      mimeType: z13.string(),
      usuarioNome: z13.string().optional()
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoPedidoFotos).values({
        pedidoId: input.pedidoId,
        storageKey: input.key,
        url: input.url,
        usuarioNome: input.usuarioNome ?? null
      });
      return { url: input.url, key: input.key };
    }),
    listFotos: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoPedidoFotos).where(eq12(empacotamentoPedidoFotos.pedidoId, input.pedidoId)).orderBy(desc7(empacotamentoPedidoFotos.createdAt));
    }),
    atualizarFotoAnotada: publicProcedure.input(z13.object({
      fotoId: z13.number(),
      url: z13.string().url(),
      key: z13.string().min(1)
    })).mutation(async ({ input }) => {
      await getDb5().update(empacotamentoPedidoFotos).set({ url: input.url, storageKey: input.key }).where(eq12(empacotamentoPedidoFotos.id, input.fotoId));
      return { url: input.url };
    }),
    // Salva o arquivo do supervisor (imagem) com anotações canvas
    atualizarArquivoPedidoAnotado: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      url: z13.string().url(),
      key: z13.string().min(1)
    })).mutation(async ({ input }) => {
      await getDb5().update(empacotamentoPedidos).set({ arquivoUrl: input.url, arquivoKey: input.key, arquivoTipo: "image" }).where(eq12(empacotamentoPedidos.id, input.pedidoId));
      return { url: input.url };
    }),
    // Verifica se um pedido pode ir para o pátio (checklist + operador)
    checkPendencias: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.id, input.pedidoId));
      const pedido = pedidos[0];
      if (!pedido) return { podeIrPatio: false, semOperador: true, checklistPendentes: 0, motivos: ["Pedido n\xE3o encontrado"] };
      const motivos = [];
      const operadores = await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq12(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId));
      const temOperador = operadores.length > 0;
      if (!temOperador) motivos.push("Nenhum colaborador vinculado ao pedido");
      let checklistPendentes = 0;
      if (pedido.modeloCaixaId) {
        const itens = await getDb5().select().from(empacotamentoChecklistItens).where(and10(eq12(empacotamentoChecklistItens.modeloCaixaId, pedido.modeloCaixaId), eq12(empacotamentoChecklistItens.obrigatorio, 1)));
        const marcados = await getDb5().select().from(empacotamentoPedidoChecklist).where(and10(eq12(empacotamentoPedidoChecklist.pedidoId, input.pedidoId), eq12(empacotamentoPedidoChecklist.marcado, 1)));
        const marcadosIds = new Set(marcados.map((m) => m.itemId));
        checklistPendentes += itens.filter((i) => !marcadosIds.has(i.id)).length;
      }
      if (pedido.modeloId) {
        const itensLetreiro = await getDb5().select().from(empacotamentoChecklistLetreitoItens).where(and10(eq12(empacotamentoChecklistLetreitoItens.modeloLetreitoId, pedido.modeloId), eq12(empacotamentoChecklistLetreitoItens.obrigatorio, 1)));
        const marcadosLetreiro = await getDb5().select().from(empacotamentoPedidoChecklistLetreiro).where(and10(eq12(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId), eq12(empacotamentoPedidoChecklistLetreiro.marcado, 1)));
        const marcadosIdsLetreiro = new Set(marcadosLetreiro.map((m) => m.itemId));
        checklistPendentes += itensLetreiro.filter((i) => !marcadosIdsLetreiro.has(i.id)).length;
      }
      if (checklistPendentes > 0) motivos.push(`${checklistPendentes} item(ns) obrigat\xF3rio(s) do checklist pendente(s)`);
      const fotos = await getDb5().select({ id: empacotamentoPedidoFotos.id }).from(empacotamentoPedidoFotos).where(eq12(empacotamentoPedidoFotos.pedidoId, input.pedidoId)).limit(1);
      const temFoto = fotos.length > 0;
      if (!temFoto) motivos.push("Fotografia do pedido embalado \xE9 obrigat\xF3ria");
      const temPeso = pedido.pesoKg != null && parseFloat(String(pedido.pesoKg)) > 0;
      if (!temPeso) motivos.push("Peso (kg) \xE9 obrigat\xF3rio");
      const temMedidas = pedido.alturaCm != null && pedido.larguraCm != null && pedido.profundidadeCm != null && parseFloat(String(pedido.alturaCm)) > 0 && parseFloat(String(pedido.larguraCm)) > 0 && parseFloat(String(pedido.profundidadeCm)) > 0;
      if (!temMedidas) motivos.push("Medidas da caixa (A \xD7 L \xD7 P) s\xE3o obrigat\xF3rias");
      const sessoesAbertas = await getDb5().select().from(empacotamentoSessoes).where(and10(
        eq12(empacotamentoSessoes.pedidoId, input.pedidoId),
        sql7`${empacotamentoSessoes.status} IN ('ativo', 'pausado')`
      ));
      const temOperadorSemRegistro = sessoesAbertas.length > 0;
      if (temOperadorSemRegistro) motivos.push(`${sessoesAbertas.length} operador(es) com cron\xF4metro ativo sem registrar o tempo. Clique em 'Registrar' antes de mover para o P\xE1tio.`);
      const podeIrPatio = temOperador && checklistPendentes === 0 && temFoto && temPeso && temMedidas && !temOperadorSemRegistro;
      return { podeIrPatio, semOperador: !temOperador, checklistPendentes, temFoto, temPeso, temMedidas, temOperadorSemRegistro, motivos };
    })
  }),
  // ─── USUÁRIOS POR PEDIDO (cronômetro + atribuição) ──────────────────────────
  pedidoUsuarios: router({
    listPorPedido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq12(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId)).orderBy(asc4(empacotamentoPedidoUsuarios.createdAt));
    }),
    entrar: publicProcedure.input(z13.object({
      pedidoId: z13.number(),
      usuarioId: z13.string().optional(),
      usuarioNome: z13.string().min(1)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoUsuarios).where(
        and10(
          eq12(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
          eq12(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome),
          eq12(empacotamentoPedidoUsuarios.ativo, 1)
        )
      );
      if (existing.length > 0) return { success: true, id: existing[0].id };
      const [result] = await getDb5().insert(empacotamentoPedidoUsuarios).values({
        pedidoId: input.pedidoId,
        usuarioId: input.usuarioId ?? null,
        usuarioNome: input.usuarioNome,
        iniciadoEm: /* @__PURE__ */ new Date(),
        ativo: 1
      }).returning({ id: empacotamentoPedidoUsuarios.id });
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.id, input.pedidoId));
      if (pedidos[0]?.kanbanStatus === "aguardando") {
        await getDb5().update(empacotamentoPedidos).set({ kanbanStatus: "embalando" }).where(eq12(empacotamentoPedidos.id, input.pedidoId));
      }
      return { success: true, id: result.id };
    }),
    sair: publicProcedure.input(z13.object({
      id: z13.number(),
      tempoSegundos: z13.number().int().min(0)
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoPedidoUsuarios).set({
        finalizadoEm: /* @__PURE__ */ new Date(),
        tempoSegundos: input.tempoSegundos,
        ativo: 0
      }).where(eq12(empacotamentoPedidoUsuarios.id, input.id));
      return { success: true };
    }),
    atualizarTempo: publicProcedure.input(z13.object({
      id: z13.number(),
      tempoSegundos: z13.number().int().min(0)
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoPedidoUsuarios).set({ tempoSegundos: input.tempoSegundos }).where(eq12(empacotamentoPedidoUsuarios.id, input.id));
      return { success: true };
    }),
    // Retorna o registro ativo do operador (por usuarioId ou nome) e o pedido correspondente
    pedidoAtivoDoOperador: publicProcedure.input(z13.object({
      usuarioId: z13.string().optional(),
      usuarioNome: z13.string().optional()
    })).query(async ({ input }) => {
      if (!input.usuarioId && !input.usuarioNome) return null;
      const conditions = [eq12(empacotamentoPedidoUsuarios.ativo, 1)];
      if (input.usuarioId) {
        conditions.push(eq12(empacotamentoPedidoUsuarios.usuarioId, input.usuarioId));
      } else if (input.usuarioNome) {
        conditions.push(eq12(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome));
      }
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(and10(...conditions)).orderBy(desc7(empacotamentoPedidoUsuarios.createdAt)).limit(1);
      if (!registros.length) return null;
      const reg = registros[0];
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and10(
        eq12(empacotamentoPedidos.id, reg.pedidoId),
        eq12(empacotamentoPedidos.kanbanStatus, "embalando")
      )).limit(1);
      if (!pedidos.length) return null;
      return { pedido: pedidos[0], registro: reg };
    })
  }),
  // ─── RELATÓRIO DE FECHAMENTO ─────────────────────────────────────────────────
  relatorio: router({
    fechamento: publicProcedure.input(z13.object({
      dataInicio: z13.string(),
      dataFim: z13.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(
        and10(
          eq12(empacotamentoPedidos.kanbanStatus, "patio"),
          gte4(empacotamentoPedidos.finalizadoEm, inicio),
          lte3(empacotamentoPedidos.finalizadoEm, fim)
        )
      ).orderBy(asc4(empacotamentoPedidos.finalizadoEm));
      const pedidoIds = pedidos.map((p) => p.id);
      let usuariosTrabalho = [];
      if (pedidoIds.length > 0) {
        usuariosTrabalho = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql7`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const porOperador = {};
      for (const u of usuariosTrabalho) {
        const nome = u.usuarioNome;
        if (!porOperador[nome]) {
          porOperador[nome] = { operadorNome: nome, totalComissao: 0, quantidade: 0, tempoTotalSegundos: 0 };
        }
        porOperador[nome].tempoTotalSegundos += u.tempoSegundos ?? 0;
        porOperador[nome].quantidade += 1;
      }
      for (const p of pedidos) {
        const ops = usuariosTrabalho.filter((u) => u.pedidoId === p.id);
        const comissao = parseFloat(p.valorComissao ?? "0");
        if (ops.length > 0 && comissao > 0) {
          const share = comissao / ops.length;
          for (const u of ops) {
            if (porOperador[u.usuarioNome]) {
              porOperador[u.usuarioNome].totalComissao += share;
            }
          }
        }
      }
      const totalGeral = Object.values(porOperador).reduce((acc, o) => acc + o.totalComissao, 0);
      return {
        totalGeral,
        totalPedidos: pedidos.length,
        porOperador: Object.values(porOperador).sort((a, b) => b.totalComissao - a.totalComissao),
        pedidos
      };
    }),
    resumoDia: publicProcedure.query(async () => {
      const hoje = /* @__PURE__ */ new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje);
      amanha.setDate(amanha.getDate() + 1);
      const pedidosHoje = await getDb5().select().from(empacotamentoPedidos).where(
        and10(
          eq12(empacotamentoPedidos.kanbanStatus, "patio"),
          gte4(empacotamentoPedidos.finalizadoEm, hoje),
          lte3(empacotamentoPedidos.finalizadoEm, amanha)
        )
      );
      const totalHoje = pedidosHoje.reduce((acc, p) => acc + parseFloat(p.valorComissao ?? "0"), 0);
      const aguardando = await getDb5().select({ count: sql7`COUNT(*)` }).from(empacotamentoPedidos).where(eq12(empacotamentoPedidos.kanbanStatus, "aguardando"));
      return {
        finalizadosHoje: pedidosHoje.length,
        totalComissaoHoje: totalHoje,
        pendentes: Number(aguardando[0]?.count ?? 0)
      };
    }),
    produtividadePorUsuario: publicProcedure.input(z13.object({
      dataInicio: z13.string(),
      dataFim: z13.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(
        and10(
          gte4(empacotamentoPedidoUsuarios.createdAt, inicio),
          lte3(empacotamentoPedidoUsuarios.createdAt, fim)
        )
      );
      const porUsuario = {};
      for (const r of registros) {
        const nome = r.usuarioNome;
        if (!porUsuario[nome]) {
          porUsuario[nome] = { nome, totalSegundos: 0, totalPedidos: 0, mediaSegundosPorPedido: 0 };
        }
        porUsuario[nome].totalSegundos += r.tempoSegundos ?? 0;
        porUsuario[nome].totalPedidos += 1;
      }
      for (const u of Object.values(porUsuario)) {
        u.mediaSegundosPorPedido = u.totalPedidos > 0 ? Math.round(u.totalSegundos / u.totalPedidos) : 0;
      }
      return Object.values(porUsuario).sort((a, b) => b.totalPedidos - a.totalPedidos);
    }),
    // Relatório completo de expedidos com fotos e operadores
    expedidosCompleto: publicProcedure.input(z13.object({
      dataInicio: z13.string().optional(),
      dataFim: z13.string().optional()
    })).query(async ({ input }) => {
      const inicio = input.dataInicio ? new Date(input.dataInicio) : /* @__PURE__ */ new Date(0);
      const fim = input.dataFim ? new Date(input.dataFim) : /* @__PURE__ */ new Date();
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(
        and10(
          eq12(empacotamentoPedidos.kanbanStatus, "patio"),
          gte4(empacotamentoPedidos.finalizadoEm, inicio),
          lte3(empacotamentoPedidos.finalizadoEm, fim)
        )
      ).orderBy(desc7(empacotamentoPedidos.finalizadoEm));
      const pedidoIds = pedidos.map((p) => p.id);
      let fotos = [];
      let usuarios = [];
      if (pedidoIds.length > 0) {
        fotos = await getDb5().select().from(empacotamentoPedidoFotos).where(sql7`${empacotamentoPedidoFotos.pedidoId} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
        usuarios = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql7`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      return pedidos.map((p) => ({
        ...p,
        fotos: fotos.filter((f2) => f2.pedidoId === p.id),
        operadores: usuarios.filter((u) => u.pedidoId === p.id)
      }));
    })
  }),
  // fim relatorio router
  // ─── INSUMOS DE EMBALAGEM (ERP leve) ────────────────────────────────────────────────
  insumos: router({
    list: publicProcedure.query(async () => {
      return await getDb5().select().from(empacotamentoInsumos).orderBy(asc4(empacotamentoInsumos.categoria), asc4(empacotamentoInsumos.nome));
    }),
    create: publicProcedure.input(z13.object({
      nome: z13.string().min(1).max(128),
      unidadeMedida: z13.enum(["m\xB2", "metro", "kg", "unidades"]),
      custoUnitario: z13.number().min(0),
      categoria: z13.string().optional()
    })).mutation(async ({ input }) => {
      const [result] = await getDb5().insert(empacotamentoInsumos).values({
        nome: input.nome,
        unidadeMedida: input.unidadeMedida,
        custoUnitario: String(input.custoUnitario),
        categoria: input.categoria ?? null,
        precoAtualizadoEm: /* @__PURE__ */ new Date()
      }).returning({ id: empacotamentoInsumos.id });
      return { success: true, id: result.id };
    }),
    update: publicProcedure.input(z13.object({
      id: z13.number(),
      nome: z13.string().min(1).max(128).optional(),
      unidadeMedida: z13.enum(["m\xB2", "metro", "kg", "unidades"]).optional(),
      custoUnitario: z13.number().min(0).optional(),
      categoria: z13.string().optional(),
      ativo: z13.number().optional()
    })).mutation(async ({ input }) => {
      const { id, ...rest } = input;
      const upd = {};
      if (rest.nome !== void 0) upd.nome = rest.nome;
      if (rest.unidadeMedida !== void 0) upd.unidadeMedida = rest.unidadeMedida;
      if (rest.custoUnitario !== void 0) {
        upd.custoUnitario = String(rest.custoUnitario);
        upd.precoAtualizadoEm = /* @__PURE__ */ new Date();
      }
      if (rest.categoria !== void 0) upd.categoria = rest.categoria;
      if (rest.ativo !== void 0) upd.ativo = rest.ativo;
      await getDb5().update(empacotamentoInsumos).set(upd).where(eq12(empacotamentoInsumos.id, id));
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoInsumos).where(eq12(empacotamentoInsumos.id, input.id));
      return { success: true };
    })
  }),
  // ─── CONSUMO DE INSUMOS POR CAIXA ───────────────────────────────────────────────────
  consumoCaixa: router({
    listPorCaixa: publicProcedure.input(z13.object({ modeloCaixaId: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq12(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({
        ...r,
        insumo: insumos.find((i) => i.id === r.insumoId)
      }));
    }),
    upsert: publicProcedure.input(z13.object({
      modeloCaixaId: z13.number(),
      insumoId: z13.number(),
      quantidadePorCaixa: z13.number().min(0),
      formulaConsumo: z13.string().optional().default("fixo"),
      fator: z13.number().optional().default(1)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoConsumoCaixa).where(and10(
        eq12(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId),
        eq12(empacotamentoConsumoCaixa.insumoId, input.insumoId)
      ));
      const setData = {
        quantidadePorCaixa: String(input.quantidadePorCaixa),
        formulaConsumo: input.formulaConsumo,
        fator: String(input.fator)
      };
      if (existing.length > 0) {
        await getDb5().update(empacotamentoConsumoCaixa).set(setData).where(eq12(empacotamentoConsumoCaixa.id, existing[0].id));
      } else {
        await getDb5().insert(empacotamentoConsumoCaixa).values({
          modeloCaixaId: input.modeloCaixaId,
          insumoId: input.insumoId,
          ...setData
        });
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoConsumoCaixa).where(eq12(empacotamentoConsumoCaixa.id, input.id));
      return { success: true };
    })
  }),
  // ─── CUSTO DE FUNCIONÁRIO ───────────────────────────────────────────────────────────────────────
  custoFuncionario: router({
    list: publicProcedure.query(async () => {
      return await getDb5().select().from(empacotamentoCustoFuncionario).orderBy(asc4(empacotamentoCustoFuncionario.nome));
    }),
    upsert: publicProcedure.input(z13.object({
      id: z13.number().optional(),
      nome: z13.string().min(1).max(128),
      salarioMensal: z13.number().min(0),
      horasMes: z13.number().min(1)
    })).mutation(async ({ input }) => {
      const custoHora = input.salarioMensal / input.horasMes;
      if (input.id) {
        await getDb5().update(empacotamentoCustoFuncionario).set({
          nome: input.nome,
          salarioMensal: String(input.salarioMensal),
          horasMes: String(input.horasMes),
          custoHora: String(custoHora.toFixed(4))
        }).where(eq12(empacotamentoCustoFuncionario.id, input.id));
      } else {
        await getDb5().insert(empacotamentoCustoFuncionario).values({
          nome: input.nome,
          salarioMensal: String(input.salarioMensal),
          horasMes: String(input.horasMes),
          custoHora: String(custoHora.toFixed(4))
        });
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoCustoFuncionario).where(eq12(empacotamentoCustoFuncionario.id, input.id));
      return { success: true };
    })
  }),
  // ─── PRECIFICAÇÃO DE CAIXAS ──────────────────────────────────────────────────────────────────
  // Fórmulas geométricas:
  //   Área externa (m²) = 2*(L*A + L*P + A*P) / 10000  → papelão, plástico bolha
  //   Volume interno (m³) = L*A*P / 1000000            → espuma, enchimento volumétrico
  //   Perímetro (m) = 4*(L+A+P)/2 / 100               → fita de arquear, cantoneiras
  //   Fixo = quantidade fixa por caixa
  precificacao: router({
    calcular: publicProcedure.input(z13.object({
      modeloCaixaId: z13.number(),
      larguraCm: z13.number().min(0.1).optional(),
      alturaCm: z13.number().min(0.1).optional(),
      profundidadeCm: z13.number().min(0.1).optional(),
      tempoExecucaoMin: z13.number().min(0).optional(),
      margemPercent: z13.number().min(0).optional()
    })).query(async ({ input }) => {
      const caixas = await getDb5().select().from(empacotamentoModelosCaixa).where(eq12(empacotamentoModelosCaixa.id, input.modeloCaixaId));
      if (!caixas.length) throw new Error("Modelo de caixa n\xE3o encontrado");
      const caixa = caixas[0];
      const L = input.larguraCm ?? parseFloat(String(caixa.larguraCm ?? 0));
      const A = input.alturaCm ?? parseFloat(String(caixa.alturaCm ?? 0));
      const P = input.profundidadeCm ?? parseFloat(String(caixa.profundidadeCm ?? 0));
      const areaExternaM2 = L > 0 && A > 0 && P > 0 ? 2 * (L * A + L * P + A * P) / 1e4 : 0;
      const volumeInternoM3 = L > 0 && A > 0 && P > 0 ? L * A * P / 1e6 : 0;
      const perimetroM = L > 0 && A > 0 && P > 0 ? 4 * (L + A + P) / 2 / 100 : 0;
      const consumos = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq12(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      let custoInsumos = 0;
      const detalhesInsumos = [];
      for (const c of consumos) {
        const insumo = insumos.find((i) => i.id === c.insumoId);
        if (!insumo) continue;
        const fator = parseFloat(String(c.fator ?? 1));
        const custo = parseFloat(String(insumo.custoUnitario));
        const formula = c.formulaConsumo ?? "fixo";
        let quantidadeBase = 0;
        if (formula === "area_externa_m2") quantidadeBase = areaExternaM2;
        else if (formula === "volume_interno_m3") quantidadeBase = volumeInternoM3;
        else if (formula === "perimetro_m") quantidadeBase = perimetroM;
        else quantidadeBase = parseFloat(String(c.quantidadePorCaixa ?? 0));
        const quantidadeReal = quantidadeBase * fator;
        const total = quantidadeReal * custo;
        custoInsumos += total;
        detalhesInsumos.push({
          nome: insumo.nome,
          unidade: insumo.unidadeMedida,
          formula,
          quantidadeBase: parseFloat(quantidadeBase.toFixed(6)),
          fator,
          quantidadeReal: parseFloat(quantidadeReal.toFixed(6)),
          custoUnit: custo,
          custoTotal: parseFloat(total.toFixed(4))
        });
      }
      const funcionarios = await getDb5().select().from(empacotamentoCustoFuncionario).where(eq12(empacotamentoCustoFuncionario.ativo, 1));
      const custoHora = funcionarios.length > 0 ? parseFloat(String(funcionarios[0].custoHora ?? 0)) : 0;
      const tempoMin = input.tempoExecucaoMin ?? 0;
      const custoMaoDeObra = tempoMin / 60 * custoHora;
      const custoTotal = custoInsumos + custoMaoDeObra;
      const margem = input.margemPercent ?? 30;
      const precoSugerido = custoTotal > 0 ? custoTotal / (1 - margem / 100) : 0;
      return {
        caixa: { id: caixa.id, nome: caixa.nome, tipoCaixa: caixa.tipoCaixa, larguraCm: caixa.larguraCm, alturaCm: caixa.alturaCm, profundidadeCm: caixa.profundidadeCm },
        dimensoesUsadas: { larguraCm: L, alturaCm: A, profundidadeCm: P },
        geometria: {
          areaExternaM2: parseFloat(areaExternaM2.toFixed(4)),
          volumeInternoM3: parseFloat(volumeInternoM3.toFixed(6)),
          perimetroM: parseFloat(perimetroM.toFixed(4))
        },
        custoInsumos: parseFloat(custoInsumos.toFixed(4)),
        custoMaoDeObra: parseFloat(custoMaoDeObra.toFixed(4)),
        custoTotal: parseFloat(custoTotal.toFixed(4)),
        precoSugerido: parseFloat(precoSugerido.toFixed(2)),
        margemPercent: margem,
        tempoExecucaoMin: tempoMin,
        custoHora,
        detalhesInsumos
      };
    })
  }),
  // ─── OPERADORES (para seleção no novo pedido) ───────────────────────────────
  operadores: router({
    list: publicProcedure.query(async () => {
      return await getDb5().select({ id: user.id, name: user.name, role: user.role }).from(user).orderBy(asc4(user.name));
    }),
    listEmpacotadores: publicProcedure.query(async () => {
      const rows = await getDb5().select({ id: user.id, name: user.name, role: user.role }).from(user).where(eq12(user.role, "empacotamento")).orderBy(asc4(user.name));
      return rows;
    })
  }),
  // ─── PAUSAS DO CRONÔMETRO ─────────────────────────────────────────────────────
  cronometroPausas: router({
    listPorPedidoUsuario: publicProcedure.input(z13.object({ pedidoUsuarioId: z13.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoCronometroPausas).where(eq12(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId)).orderBy(asc4(empacotamentoCronometroPausas.pausadoEm));
    }),
    // Retorna true se há alguma pausa aberta para qualquer operador do pedido
    temPausaAbertaPorPedido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select({ id: empacotamentoCronometroPausas.id }).from(empacotamentoCronometroPausas).innerJoin(
        empacotamentoPedidoUsuarios,
        eq12(empacotamentoCronometroPausas.pedidoUsuarioId, empacotamentoPedidoUsuarios.id)
      ).where(
        and10(
          eq12(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
          sql7`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
        )
      ).limit(1);
      return { pausado: rows.length > 0 };
    }),
    pausar: publicProcedure.input(z13.object({ pedidoUsuarioId: z13.number(), tempoSegundosAtual: z13.number().int().min(0).optional() })).mutation(async ({ input }) => {
      const abertas = await getDb5().select().from(empacotamentoCronometroPausas).where(and10(
        eq12(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId),
        sql7`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
      ));
      if (abertas.length > 0) return { success: true, id: abertas[0].id };
      if (input.tempoSegundosAtual !== void 0) {
        await getDb5().update(empacotamentoPedidoUsuarios).set({ tempoSegundos: input.tempoSegundosAtual }).where(eq12(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
      }
      const [result] = await getDb5().insert(empacotamentoCronometroPausas).values({
        pedidoUsuarioId: input.pedidoUsuarioId,
        pausadoEm: /* @__PURE__ */ new Date()
      }).returning({ id: empacotamentoCronometroPausas.id });
      return { success: true, id: result.id };
    }),
    retomar: publicProcedure.input(z13.object({ pedidoUsuarioId: z13.number() })).mutation(async ({ input }) => {
      await getDb5().execute(
        sql7`UPDATE empacotamento_cronometro_pausas SET retomadoEm = NOW() WHERE pedidoUsuarioId = ${input.pedidoUsuarioId} AND retomadoEm IS NULL`
      );
      await getDb5().update(empacotamentoPedidoUsuarios).set({ iniciadoEm: /* @__PURE__ */ new Date() }).where(eq12(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
      return { success: true };
    }),
    // Pausa automática: pausa todos os operadores ativos de um pedido (ou todos os pedidos)
    pausarTodosAtivos: publicProcedure.input(z13.object({ motivo: z13.string().optional() })).mutation(async ({ input }) => {
      const ativos = await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq12(empacotamentoPedidoUsuarios.ativo, 1));
      let pausados = 0;
      for (const op of ativos) {
        const abertas = await getDb5().select().from(empacotamentoCronometroPausas).where(and10(
          eq12(empacotamentoCronometroPausas.pedidoUsuarioId, op.id),
          sql7`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
        ));
        if (abertas.length === 0) {
          await getDb5().insert(empacotamentoCronometroPausas).values({
            pedidoUsuarioId: op.id,
            pausadoEm: /* @__PURE__ */ new Date()
          });
          pausados++;
        }
      }
      return { success: true, pausados, motivo: input.motivo ?? "automatico" };
    }),
    tempoTotalPausadoSegundos: publicProcedure.input(z13.object({ pedidoUsuarioId: z13.number() })).query(async ({ input }) => {
      const pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(eq12(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId));
      let total = 0;
      const agora = Date.now();
      for (const p of pausas) {
        const inicio = p.pausadoEm ? new Date(p.pausadoEm).getTime() : agora;
        const fim = p.retomadoEm ? new Date(p.retomadoEm).getTime() : agora;
        total += Math.max(0, fim - inicio);
      }
      return { totalSegundos: Math.round(total / 1e3) };
    })
  }),
  // ─── CONFIGURAÇÃO DE PRODUTIVIDADE ────────────────────────────────────────────
  configProdutividade: router({
    get: publicProcedure.query(async () => {
      const rows = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1)).orderBy(desc7(empacotamentoConfigProdutividade.updatedAt));
      if (rows.length > 0) return rows[0];
      return {
        id: 0,
        valorPorMinuto: "0.1500",
        bonusPorcentagem: "20.00",
        penalidadePorcentagem: "30.00",
        descricao: null,
        ativo: 1,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
    }),
    upsert: publicProcedure.input(z13.object({
      valorPorMinuto: z13.number().min(0),
      bonusPorcentagem: z13.number().min(0).max(100),
      penalidadePorcentagem: z13.number().min(0).max(100),
      descricao: z13.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1));
      if (existing.length > 0) {
        await getDb5().update(empacotamentoConfigProdutividade).set({
          valorPorMinuto: String(input.valorPorMinuto),
          bonusPorcentagem: String(input.bonusPorcentagem),
          penalidadePorcentagem: String(input.penalidadePorcentagem),
          descricao: input.descricao ?? null
        }).where(eq12(empacotamentoConfigProdutividade.id, existing[0].id));
      } else {
        await getDb5().insert(empacotamentoConfigProdutividade).values({
          valorPorMinuto: String(input.valorPorMinuto),
          bonusPorcentagem: String(input.bonusPorcentagem),
          penalidadePorcentagem: String(input.penalidadePorcentagem),
          descricao: input.descricao ?? null,
          ativo: 1
        });
      }
      return { success: true };
    })
  }),
  // ─── CÁLCULO DE TEMPO ESTIMADO DO PEDIDO ─────────────────────────────────────
  tempoEstimado: router({
    calcular: publicProcedure.input(z13.object({
      modeloId: z13.number().optional(),
      modeloCaixaId: z13.number().optional(),
      metrosQuadrados: z13.number().min(0).optional()
    })).query(async ({ input }) => {
      let tempoCaixaMin = 0;
      let tempoLetreiMin = 0;
      if (input.modeloCaixaId) {
        const caixas = await getDb5().select().from(empacotamentoModelosCaixa).where(eq12(empacotamentoModelosCaixa.id, input.modeloCaixaId));
        if (caixas.length > 0) {
          const caixa = caixas[0];
          const L = parseFloat(String(caixa.larguraCm ?? 0));
          const A = parseFloat(String(caixa.alturaCm ?? 0));
          const P = parseFloat(String(caixa.profundidadeCm ?? 0));
          if (caixa.tipoCaixa === "personalizada") {
            const tempoPorM3 = parseFloat(String(caixa.tempoPorM3Min ?? 0));
            const volumeM3 = L > 0 && A > 0 && P > 0 ? L * A * P / 1e6 : 0;
            tempoCaixaMin = tempoPorM3 > 0 ? volumeM3 * tempoPorM3 : 0;
          } else {
            const tempoPorM2 = parseFloat(String(caixa.tempoPorM2Min ?? 0));
            const areaM2 = L > 0 && A > 0 && P > 0 ? 2 * (L * A + L * P + A * P) / 1e4 : 0;
            tempoCaixaMin = tempoPorM2 > 0 ? areaM2 * tempoPorM2 : 0;
          }
        }
      }
      if (input.modeloId && (input.metrosQuadrados ?? 0) > 0) {
        const modelos = await getDb5().select().from(empacotamentoModelos).where(eq12(empacotamentoModelos.id, input.modeloId));
        if (modelos.length > 0) {
          const tempoPorM2 = parseFloat(String(modelos[0].tempoPorM2Min ?? 0));
          tempoLetreiMin = tempoPorM2 > 0 ? tempoPorM2 * (input.metrosQuadrados ?? 0) : 0;
        }
      }
      const totalMin = tempoCaixaMin + tempoLetreiMin;
      return {
        tempoCaixaMin: parseFloat(tempoCaixaMin.toFixed(2)),
        tempoLetreiMin: parseFloat(tempoLetreiMin.toFixed(2)),
        totalMin: parseFloat(totalMin.toFixed(2)),
        totalHoras: parseFloat((totalMin / 60).toFixed(3))
      };
    })
  }),
  // ─── RELATÓRIO DE PRODUTIVIDADE DETALHADO ────────────────────────────────────
  relatorioProdutividade: router({
    porColaborador: publicProcedure.input(z13.object({
      dataInicio: z13.string(),
      dataFim: z13.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1));
      const cfg = config[0] ?? { valorPorMinuto: "0.15", bonusPorcentagem: "20", penalidadePorcentagem: "30" };
      const valorMin = parseFloat(String(cfg.valorPorMinuto));
      const bonusPct = parseFloat(String(cfg.bonusPorcentagem));
      const penalidadePct = parseFloat(String(cfg.penalidadePorcentagem));
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(and10(
        gte4(empacotamentoPedidoUsuarios.createdAt, inicio),
        lte3(empacotamentoPedidoUsuarios.createdAt, fim)
      ));
      const pedidoIds = Array.from(new Set(registros.map((r) => r.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql7`${empacotamentoPedidos.id} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const usuarioIds = registros.map((r) => r.id);
      let pausas = [];
      if (usuarioIds.length > 0) {
        pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(sql7`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql7.join(usuarioIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const porColaborador = {};
      for (const r of registros) {
        const nome = r.usuarioNome;
        if (!porColaborador[nome]) {
          porColaborador[nome] = { nome, totalMinutosEfetivos: 0, totalMinutosPausados: 0, totalPedidos: 0, valorBase: 0, valorComBonus: 0, pedidosNoPrazo: 0, pedidosForaDoPrazo: 0 };
        }
        const tempoTotal = (r.tempoSegundos ?? 0) / 60;
        const pausasDoReg = pausas.filter((p) => p.pedidoUsuarioId === r.id);
        let tempoPausado = 0;
        for (const p of pausasDoReg) {
          const ini = p.pausadoEm ? new Date(p.pausadoEm).getTime() : 0;
          const fim2 = p.retomadoEm ? new Date(p.retomadoEm).getTime() : Date.now();
          tempoPausado += Math.max(0, fim2 - ini) / 6e4;
        }
        const tempoEfetivo = Math.max(0, tempoTotal - tempoPausado);
        porColaborador[nome].totalMinutosEfetivos += tempoEfetivo;
        porColaborador[nome].totalMinutosPausados += tempoPausado;
        porColaborador[nome].totalPedidos += 1;
        const pedido = pedidos.find((p) => p.id === r.pedidoId);
        const noPrazo = pedido?.prazoEntrega && pedido?.finalizadoEm ? new Date(pedido.finalizadoEm) <= new Date(pedido.prazoEntrega) : null;
        const valorBruto = tempoEfetivo * valorMin;
        let valorFinal = valorBruto;
        const pedidoRef = pedidos.find((p) => p.id === r.pedidoId);
        if (pedidoRef) {
          if (noPrazo === true) {
            valorFinal = valorBruto * (1 + bonusPct / 100);
            porColaborador[nome].pedidosNoPrazo += 1;
          } else if (noPrazo === false) {
            valorFinal = valorBruto * (1 - penalidadePct / 100);
            porColaborador[nome].pedidosForaDoPrazo += 1;
          }
        } else {
          if (noPrazo === true) {
            valorFinal = valorBruto * (1 + bonusPct / 100);
            porColaborador[nome].pedidosNoPrazo += 1;
          } else if (noPrazo === false) {
            valorFinal = valorBruto * (1 - penalidadePct / 100);
            porColaborador[nome].pedidosForaDoPrazo += 1;
          }
        }
        porColaborador[nome].valorBase += valorBruto;
        porColaborador[nome].valorComBonus += valorFinal;
      }
      return {
        config: { valorPorMinuto: valorMin, bonusPorcentagem: bonusPct, penalidadePorcentagem: penalidadePct },
        colaboradores: Object.values(porColaborador).sort((a, b) => b.totalMinutosEfetivos - a.totalMinutosEfetivos)
      };
    })
  }),
  // ─── RELATÓRIO DETALHADO: TEMPO PREVISTO vs REAL POR PEDIDO ────────────────
  relatorioDetalhado: router({
    porPeriodo: publicProcedure.input(z13.object({
      dataInicio: z13.string(),
      dataFim: z13.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and10(
        gte4(empacotamentoPedidos.finalizadoEm, inicio),
        lte3(empacotamentoPedidos.finalizadoEm, fim)
      )).orderBy(desc7(empacotamentoPedidos.finalizadoEm));
      const modelos = await getDb5().select().from(empacotamentoModelos);
      const modelosCaixa = await getDb5().select().from(empacotamentoModelosCaixa);
      const pedidoIds = pedidos.map((p) => p.id);
      let registros = [];
      let pausas = [];
      if (pedidoIds.length > 0) {
        registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql7`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
        const usuarioIds = registros.map((r) => r.id);
        if (usuarioIds.length > 0) {
          pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(sql7`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql7.join(usuarioIds.map((id) => sql7`${id}`), sql7`, `)})`);
        }
      }
      const configs = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1));
      const cfg = configs[0] ?? { valorPorMinuto: "0.15", bonusPorcentagem: "20", penalidadePorcentagem: "30" };
      const valorMin = parseFloat(String(cfg.valorPorMinuto));
      const resultado = pedidos.map((pedido) => {
        let tempoCaixaMin = 0;
        let tempoLetreiMin = 0;
        if (pedido.modeloCaixaId) {
          const caixa = modelosCaixa.find((c) => c.id === pedido.modeloCaixaId);
          if (caixa) {
            const L = parseFloat(String(caixa.larguraCm ?? 0));
            const A = parseFloat(String(caixa.alturaCm ?? 0));
            const P = parseFloat(String(caixa.profundidadeCm ?? 0));
            if (caixa.tipoCaixa === "personalizada") {
              const tempoPorM3 = parseFloat(String(caixa.tempoPorM3Min ?? 0));
              const volumeM3 = L > 0 && A > 0 && P > 0 ? L * A * P / 1e6 : 0;
              tempoCaixaMin = tempoPorM3 > 0 ? volumeM3 * tempoPorM3 : 0;
            } else {
              const tempoPorM2 = parseFloat(String(caixa.tempoPorM2Min ?? 0));
              const areaM2 = L > 0 && A > 0 && P > 0 ? 2 * (L * A + L * P + A * P) / 1e4 : 0;
              tempoCaixaMin = tempoPorM2 > 0 ? areaM2 * tempoPorM2 : 0;
            }
          }
        }
        if (pedido.modeloId && parseFloat(String(pedido.metrosQuadrados ?? 0)) > 0) {
          const modelo = modelos.find((m) => m.id === pedido.modeloId);
          if (modelo) {
            const tempoPorM2 = parseFloat(String(modelo.tempoPorM2Min ?? 0));
            tempoLetreiMin = tempoPorM2 > 0 ? tempoPorM2 * parseFloat(String(pedido.metrosQuadrados ?? 0)) : 0;
          }
        }
        const tempoEstimadoMin = tempoCaixaMin + tempoLetreiMin;
        const regsP = registros.filter((r) => r.pedidoId === pedido.id);
        let tempoRealMin = 0;
        const operadores = [];
        for (const r of regsP) {
          const pausasReg = pausas.filter((p) => p.pedidoUsuarioId === r.id);
          let tempoPausado = 0;
          for (const p of pausasReg) {
            const ini = p.pausadoEm ? new Date(p.pausadoEm).getTime() : 0;
            const fim2 = p.retomadoEm ? new Date(p.retomadoEm).getTime() : Date.now();
            tempoPausado += Math.max(0, fim2 - ini) / 6e4;
          }
          const efetivo = Math.max(0, (r.tempoSegundos ?? 0) / 60 - tempoPausado);
          tempoRealMin += efetivo;
          if (r.usuarioNome && !operadores.includes(r.usuarioNome)) operadores.push(r.usuarioNome);
        }
        const eficiencia = tempoEstimadoMin > 0 && tempoRealMin > 0 ? Math.round(tempoEstimadoMin / tempoRealMin * 100) : null;
        let fatorProdutividade = 1;
        if (tempoEstimadoMin > 0 && tempoRealMin > 0) {
          const variacaoPct = (tempoRealMin - tempoEstimadoMin) / tempoEstimadoMin;
          const passos = Math.floor(Math.abs(variacaoPct) / 0.05);
          const ajuste = passos * 0.05;
          fatorProdutividade = variacaoPct > 0 ? Math.max(0.5, 1 - ajuste) : Math.min(1.5, 1 + ajuste);
        }
        const valorProdutividade = tempoRealMin * valorMin * fatorProdutividade;
        return {
          id: pedido.id,
          numeroPedido: pedido.numeroPedido,
          cliente: pedido.cliente,
          modeloNome: pedido.modeloNome ?? null,
          modeloCaixaNome: pedido.modeloCaixaNome ?? null,
          finalizadoEm: pedido.finalizadoEm,
          prazoEntrega: pedido.prazoEntrega,
          noPrazo: pedido.prazoEntrega && pedido.finalizadoEm ? new Date(pedido.finalizadoEm) <= new Date(pedido.prazoEntrega) : null,
          tempoEstimadoMin: parseFloat(tempoEstimadoMin.toFixed(1)),
          tempoRealMin: parseFloat(tempoRealMin.toFixed(1)),
          eficiencia,
          operadores,
          valorProdutividade: parseFloat(valorProdutividade.toFixed(2))
        };
      });
      const totalEstimadoMin = resultado.reduce((a, r) => a + r.tempoEstimadoMin, 0);
      const totalRealMin = resultado.reduce((a, r) => a + r.tempoRealMin, 0);
      const totalValor = resultado.reduce((a, r) => a + r.valorProdutividade, 0);
      const eficienciaGeral = totalEstimadoMin > 0 && totalRealMin > 0 ? Math.round(totalEstimadoMin / totalRealMin * 100) : null;
      return {
        pedidos: resultado,
        totais: {
          totalPedidos: resultado.length,
          totalEstimadoMin: parseFloat(totalEstimadoMin.toFixed(1)),
          totalRealMin: parseFloat(totalRealMin.toFixed(1)),
          totalValor: parseFloat(totalValor.toFixed(2)),
          eficienciaGeral
        },
        valorPorMinuto: valorMin
      };
    })
  }),
  // ─── EVOLUÇÃO DIÁRIA DE PRODUTIVIDADE ─────────────────────────────────────────
  evolucaoDiaria: router({
    porPeriodo: publicProcedure.input(z13.object({
      dataInicio: z13.string(),
      dataFim: z13.string(),
      tipoProduto: z13.enum(["todos", "letreiro", "caixa"]).default("todos")
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and10(gte4(empacotamentoPedidos.finalizadoEm, inicio), lte3(empacotamentoPedidos.finalizadoEm, fim)));
      const modelos = await getDb5().select().from(empacotamentoModelos);
      const modelosCaixa = await getDb5().select().from(empacotamentoModelosCaixa);
      const pedidoIds = pedidos.map((p) => p.id);
      let registros = [];
      if (pedidoIds.length > 0) {
        registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql7`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const porDia = {};
      for (const pedido of pedidos) {
        if (!pedido.finalizadoEm) continue;
        const tipoPedido = pedido.modeloId ? "letreiro" : "caixa";
        if (input.tipoProduto !== "todos" && tipoPedido !== input.tipoProduto) continue;
        const dia = new Date(pedido.finalizadoEm).toISOString().split("T")[0];
        const regsP = registros.filter((r) => r.pedidoId === pedido.id);
        const tempoRealMin = regsP.reduce((a, r) => a + (r.tempoSegundos ?? 0), 0) / 60;
        let tempoEstimadoMin = 0;
        if (pedido.modeloId) {
          const modelo = modelos.find((m) => m.id === pedido.modeloId);
          const tM2 = parseFloat(String(modelo?.tempoPorM2Min ?? "0"));
          const area = parseFloat(String(pedido.metrosQuadrados ?? "0"));
          if (tM2 > 0 && area > 0) tempoEstimadoMin = tM2 * area;
        } else if (pedido.modeloCaixaId) {
          const mc = modelosCaixa.find((m) => m.id === pedido.modeloCaixaId);
          if (mc) {
            const tipoCaixa = mc.tipoCaixa;
            if (tipoCaixa === "personalizada") {
              const l = parseFloat(String(mc.larguraCm ?? "0")), a2 = parseFloat(String(mc.alturaCm ?? "0")), p2 = parseFloat(String(mc.profundidadeCm ?? "0"));
              const tM3 = parseFloat(String(mc.tempoPorM3Min ?? "0"));
              if (l > 0 && a2 > 0 && p2 > 0 && tM3 > 0) tempoEstimadoMin = l * a2 * p2 / 1e6 * tM3;
            } else {
              const l = parseFloat(String(mc.larguraCm ?? "0")), a2 = parseFloat(String(mc.alturaCm ?? "0"));
              const tM2 = parseFloat(String(mc.tempoPorM2Min ?? "0"));
              if (l > 0 && a2 > 0 && tM2 > 0) tempoEstimadoMin = l * a2 / 1e4 * tM2;
            }
          }
        }
        if (!porDia[dia]) porDia[dia] = { data: dia, tempoMedioMin: 0, totalPedidos: 0, eficienciaTotal: 0, eficienciaCount: 0 };
        porDia[dia].totalPedidos += 1;
        porDia[dia].tempoMedioMin += tempoRealMin;
        if (tempoEstimadoMin > 0 && tempoRealMin > 0) {
          porDia[dia].eficienciaTotal += Math.round(tempoEstimadoMin / tempoRealMin * 100);
          porDia[dia].eficienciaCount += 1;
        }
      }
      return Object.values(porDia).map((d) => ({
        data: d.data,
        totalPedidos: d.totalPedidos,
        tempoMedioMin: d.totalPedidos > 0 ? parseFloat((d.tempoMedioMin / d.totalPedidos).toFixed(1)) : 0,
        eficienciaMedia: d.eficienciaCount > 0 ? Math.round(d.eficienciaTotal / d.eficienciaCount) : null
      })).sort((a, b) => a.data.localeCompare(b.data));
    })
  }),
  // ─── RANKING DE PRODUTIVIDADE ─────────────────────────────────────────────────
  rankingProdutividade: router({
    semanal: publicProcedure.input(z13.object({ semanas: z13.number().default(1) })).query(async ({ input }) => {
      const fimMs = /* @__PURE__ */ new Date();
      fimMs.setHours(23, 59, 59, 999);
      const inicioMs = /* @__PURE__ */ new Date();
      inicioMs.setDate(inicioMs.getDate() - input.semanas * 7);
      inicioMs.setHours(0, 0, 0, 0);
      return calcularRanking(Math.floor(inicioMs.getTime() / 1e3), Math.floor(fimMs.getTime() / 1e3));
    }),
    mensal: publicProcedure.input(z13.object({ meses: z13.number().default(1) })).query(async ({ input }) => {
      const fimMs = /* @__PURE__ */ new Date();
      fimMs.setHours(23, 59, 59, 999);
      const inicioMs = /* @__PURE__ */ new Date();
      inicioMs.setMonth(inicioMs.getMonth() - input.meses);
      inicioMs.setHours(0, 0, 0, 0);
      return calcularRanking(Math.floor(inicioMs.getTime() / 1e3), Math.floor(fimMs.getTime() / 1e3));
    })
  }),
  // ─── INSUMOS POR MODELO DE CAIXA (consumo configurado por modelo) ───────────
  insumosCaixa: router({
    listPorModelo: publicProcedure.input(z13.object({ modeloCaixaId: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq12(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId)).orderBy(asc4(empacotamentoConsumoCaixa.id));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({ ...r, insumo: insumos.find((i) => i.id === r.insumoId) ?? null }));
    })
  }),
  // ─── INSUMOS POR MODELO DE LETREIRO ─────────────────────────────────────────
  insumosLetreiro: router({
    listPorModelo: publicProcedure.input(z13.object({ modeloLetreiId: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoInsumosLetreiro).where(eq12(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId)).orderBy(asc4(empacotamentoInsumosLetreiro.id));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({ ...r, insumo: insumos.find((i) => i.id === r.insumoId) ?? null }));
    }),
    upsert: publicProcedure.input(z13.object({
      modeloLetreiId: z13.number(),
      insumoId: z13.number(),
      fatorM2: z13.number().min(0).default(1),
      observacao: z13.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoInsumosLetreiro).where(and10(
        eq12(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId),
        eq12(empacotamentoInsumosLetreiro.insumoId, input.insumoId)
      ));
      if (existing.length > 0) {
        await getDb5().update(empacotamentoInsumosLetreiro).set({ fatorM2: String(input.fatorM2), observacao: input.observacao ?? null }).where(eq12(empacotamentoInsumosLetreiro.id, existing[0].id));
      } else {
        await getDb5().insert(empacotamentoInsumosLetreiro).values({
          modeloLetreiId: input.modeloLetreiId,
          insumoId: input.insumoId,
          quantidade: String(input.fatorM2),
          // compatibilidade legado
          fatorM2: String(input.fatorM2),
          observacao: input.observacao ?? null
        });
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoInsumosLetreiro).where(eq12(empacotamentoInsumosLetreiro.id, input.id));
      return { success: true };
    })
  }),
  // ─── SESSÕES OPERACIONAIS (TEMPORIZADOR PERSISTENTE) ─────────────────────────
  // Fonte de verdade: banco de dados. Frontend apenas reflete o estado.
  // Timezone operacional: America/Campo_Grande
  sessoes: router({
    // Retorna a sessão ativa (ativo/pausado) de um operador em um pedido
    getAtiva: publicProcedure.input(z13.object({ pedidoId: z13.number(), operadorId: z13.string() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(and10(
        eq12(empacotamentoSessoes.pedidoId, input.pedidoId),
        eq12(empacotamentoSessoes.operadorId, input.operadorId),
        sql7`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
      )).orderBy(desc7(empacotamentoSessoes.id)).limit(1);
      if (rows.length === 0) return null;
      const sessao = rows[0];
      const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq12(empacotamentoSessoesPausas.sessaoId, sessao.id)).orderBy(asc4(empacotamentoSessoesPausas.id));
      const agoraSeg = Math.floor(Date.now() / 1e3);
      let tempoAtualSegundos = sessao.totalSegundos;
      if (sessao.status === "ativo") {
        const pausasFechadas = pausas.filter((p) => p.retomadoEm !== null && p.retomadoEm !== void 0);
        const ultimaRetomada = pausasFechadas.length > 0 ? Math.max(...pausasFechadas.map((p) => p.retomadoEm)) : sessao.iniciadoEm;
        const tempoDesdeRetomada = agoraSeg - ultimaRetomada;
        tempoAtualSegundos = sessao.totalSegundos + Math.max(0, tempoDesdeRetomada);
      }
      return {
        ...sessao,
        tempoAtualSegundos: Math.max(0, tempoAtualSegundos),
        pausas,
        agoraServidor: agoraSeg
      };
    }),
    // Retorna resumo de todas as sessões de um pedido (para o card do kanban)
    resumoPorPedido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(eq12(empacotamentoSessoes.pedidoId, input.pedidoId)).orderBy(desc7(empacotamentoSessoes.id));
      const agoraSeg = Math.floor(Date.now() / 1e3);
      let totalSegundos = 0;
      let temRegistroValido = false;
      let temSessaoAtiva = false;
      let temSessaoPausada = false;
      for (const s of sessoes) {
        if (s.status === "ativo") {
          temSessaoAtiva = true;
          const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq12(empacotamentoSessoesPausas.sessaoId, s.id));
          const totalPausado = pausas.reduce((acc, p) => {
            if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
            return acc;
          }, 0);
          totalSegundos += Math.max(0, agoraSeg - s.iniciadoEm - totalPausado);
        } else if (s.status === "pausado") {
          temSessaoPausada = true;
          totalSegundos += s.totalSegundos;
        } else {
          totalSegundos += s.totalSegundos;
        }
        if (s.registradoEm) temRegistroValido = true;
      }
      return {
        totalSegundos,
        temRegistroValido,
        temSessaoAtiva,
        temSessaoPausada,
        agoraServidor: agoraSeg,
        sessoes: sessoes.map((s) => ({ id: s.id, operadorNome: s.operadorNome, status: s.status, registradoEm: s.registradoEm }))
      };
    }),
    // Inicia uma nova sessão operacional
    iniciar: publicProcedure.input(z13.object({ pedidoId: z13.number(), operadorId: z13.string(), operadorNome: z13.string() })).mutation(async ({ input }) => {
      const existente = await getDb5().select().from(empacotamentoSessoes).where(and10(
        eq12(empacotamentoSessoes.pedidoId, input.pedidoId),
        eq12(empacotamentoSessoes.operadorId, input.operadorId),
        sql7`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
      )).limit(1);
      if (existente.length > 0) {
        if (existente[0].status === "pausado") {
          return await retomarSessao(existente[0].id);
        }
        return { success: true, sessaoId: existente[0].id, action: "already_active" };
      }
      const agoraUtcSeg = Math.floor(Date.now() / 1e3);
      const [result] = await getDb5().insert(empacotamentoSessoes).values({
        pedidoId: input.pedidoId,
        operadorId: input.operadorId,
        operadorNome: input.operadorNome,
        iniciadoEm: agoraUtcSeg,
        status: "ativo",
        totalSegundos: 0
      }).returning({ id: empacotamentoSessoes.id });
      return { success: true, sessaoId: result.id, action: "started" };
    }),
    // Pausa a sessão ativa
    pausar: publicProcedure.input(z13.object({ sessaoId: z13.number() })).mutation(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(and10(eq12(empacotamentoSessoes.id, input.sessaoId), eq12(empacotamentoSessoes.status, "ativo"))).limit(1);
      if (rows.length === 0) return { success: false, error: "sessao_nao_ativa" };
      const sessao = rows[0];
      const agoraUtcSeg = Math.floor(Date.now() / 1e3);
      const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq12(empacotamentoSessoesPausas.sessaoId, sessao.id));
      const totalPausado = pausas.reduce((acc, p) => {
        if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
        return acc;
      }, 0);
      const tempoAcumulado = Math.max(0, agoraUtcSeg - sessao.iniciadoEm - totalPausado);
      await getDb5().insert(empacotamentoSessoesPausas).values({
        sessaoId: sessao.id,
        pausadoEm: agoraUtcSeg
      });
      await getDb5().update(empacotamentoSessoes).set({
        status: "pausado",
        totalSegundos: tempoAcumulado
      }).where(eq12(empacotamentoSessoes.id, sessao.id));
      return { success: true, tempoAcumuladoSegundos: tempoAcumulado };
    }),
    // Retoma uma sessão pausada
    retomar: publicProcedure.input(z13.object({ sessaoId: z13.number() })).mutation(async ({ input }) => {
      return await retomarSessao(input.sessaoId);
    }),
    // Registra formalmente o tempo (não encerra a sessão)
    registrar: publicProcedure.input(z13.object({ sessaoId: z13.number() })).mutation(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(eq12(empacotamentoSessoes.id, input.sessaoId)).limit(1);
      if (rows.length === 0) return { success: false, error: "sessao_nao_encontrada" };
      const sessao = rows[0];
      const agoraUtcSeg = Math.floor(Date.now() / 1e3);
      let tempoAtual = sessao.totalSegundos;
      if (sessao.status === "ativo") {
        const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq12(empacotamentoSessoesPausas.sessaoId, sessao.id));
        const totalPausado = pausas.reduce((acc, p) => {
          if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
          return acc;
        }, 0);
        tempoAtual = Math.max(0, agoraUtcSeg - sessao.iniciadoEm - totalPausado);
      }
      if (sessao.status === "ativo") {
        await getDb5().insert(empacotamentoSessoesPausas).values({
          sessaoId: sessao.id,
          pausadoEm: agoraUtcSeg
        });
      }
      await getDb5().update(empacotamentoSessoes).set({
        registradoEm: agoraUtcSeg,
        tempoRegistradoSegundos: tempoAtual,
        totalSegundos: tempoAtual,
        status: "finalizado",
        finalizadoEm: agoraUtcSeg
      }).where(eq12(empacotamentoSessoes.id, sessao.id));
      return { success: true, tempoRegistradoSegundos: tempoAtual };
    }),
    // Pausa automática: pausa todas as sessões ativas (chamada pelo scheduler)
    pausarTodosAtivos: publicProcedure.input(z13.object({ motivo: z13.string().optional() })).mutation(async ({ input: _input }) => {
      const ativas = await getDb5().select().from(empacotamentoSessoes).where(eq12(empacotamentoSessoes.status, "ativo"));
      let pausados = 0;
      for (const sessao of ativas) {
        const agoraUtcSeg = Math.floor(Date.now() / 1e3);
        const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq12(empacotamentoSessoesPausas.sessaoId, sessao.id));
        const totalPausado = pausas.reduce((acc, p) => {
          if (p.retomadoEm) return acc + (p.retomadoEm - p.pausadoEm);
          return acc;
        }, 0);
        const tempoAcumulado = Math.max(0, agoraUtcSeg - sessao.iniciadoEm - totalPausado);
        await getDb5().insert(empacotamentoSessoesPausas).values({
          sessaoId: sessao.id,
          pausadoEm: agoraUtcSeg
        });
        await getDb5().update(empacotamentoSessoes).set({
          status: "pausado",
          totalSegundos: tempoAcumulado
        }).where(eq12(empacotamentoSessoes.id, sessao.id));
        pausados++;
      }
      return { success: true, pausados };
    }),
    // Apaga sessões com tempo zero (registros falsos no ranking)
    deletarSessoesZero: publicProcedure.mutation(async () => {
      const result = await getDb5().delete(empacotamentoSessoes).where(and10(
        eq12(empacotamentoSessoes.status, "finalizado"),
        sql7`(${empacotamentoSessoes.tempoRegistradoSegundos} IS NULL OR ${empacotamentoSessoes.tempoRegistradoSegundos} = 0)`,
        sql7`(${empacotamentoSessoes.totalSegundos} IS NULL OR ${empacotamentoSessoes.totalSegundos} = 0)`
      ));
      return { deletados: result.rowsAffected ?? 0 };
    }),
    // Verifica se o pedido tem pelo menos um registro válido (para liberar mover para pátio)
    temRegistroValido: publicProcedure.input(z13.object({ pedidoId: z13.number() })).query(async ({ input }) => {
      const rows = await getDb5().select({ id: empacotamentoSessoes.id }).from(empacotamentoSessoes).where(and10(
        eq12(empacotamentoSessoes.pedidoId, input.pedidoId),
        sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`
      )).limit(1);
      return { temRegistro: rows.length > 0 };
    })
  }),
  // ─── PAINEL DE REGISTROS DE TEMPO POR PEDIDO ─────────────────────────────────
  registrosTempo: router({
    list: publicProcedure.input(z13.object({
      periodo: z13.enum(["semana", "mes", "tudo"]).default("semana")
    })).query(async ({ input }) => {
      const agora = Math.floor(Date.now() / 1e3);
      let inicioTs = 0;
      if (input.periodo === "semana") {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 7);
        d.setHours(0, 0, 0, 0);
        inicioTs = Math.floor(d.getTime() / 1e3);
      } else if (input.periodo === "mes") {
        const d = /* @__PURE__ */ new Date();
        d.setMonth(d.getMonth() - 1);
        d.setHours(0, 0, 0, 0);
        inicioTs = Math.floor(d.getTime() / 1e3);
      }
      const where = input.periodo === "tudo" ? and10(eq12(empacotamentoSessoes.status, "finalizado"), sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`) : and10(
        eq12(empacotamentoSessoes.status, "finalizado"),
        sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
        sql7`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
        sql7`${empacotamentoSessoes.registradoEm} <= ${agora}`
      );
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(where).orderBy(sql7`${empacotamentoSessoes.registradoEm} DESC`);
      const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql7`${empacotamentoPedidos.id} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq12(empacotamentoConfigProdutividade.ativo, 1));
      const cfg = config[0] ?? { valorPorMinuto: "0.15" };
      const valorMin = parseFloat(String(cfg.valorPorMinuto));
      const porPedido = {};
      for (const s of sessoes) {
        const pedido = pedidos.find((p) => p.id === s.pedidoId);
        const tempoSeg = s.tempoRegistradoSegundos ?? s.totalSegundos ?? 0;
        const tempoMin = tempoSeg / 60;
        const tempoEstimadoMin = await calcularTempoEstimadoMin(pedido);
        let fator = 1;
        if (tempoEstimadoMin > 0 && tempoMin > 0) {
          const varPct = (tempoMin - tempoEstimadoMin) / tempoEstimadoMin;
          const passos = Math.floor(Math.abs(varPct) / 0.05);
          const ajuste = passos * 0.05;
          fator = varPct > 0 ? Math.max(0.5, 1 - ajuste) : Math.min(1.5, 1 + ajuste);
        }
        const valorProd = parseFloat((tempoMin * valorMin * fator).toFixed(2));
        if (!porPedido[s.pedidoId]) {
          porPedido[s.pedidoId] = {
            pedidoId: s.pedidoId,
            pedidoCodigo: pedido ? String(pedido.id) : String(s.pedidoId),
            colaboradores: [],
            tempoTotalSegundos: 0,
            registradoEm: s.registradoEm ?? 0
          };
        }
        porPedido[s.pedidoId].colaboradores.push({ nome: s.operadorNome, tempoSegundos: tempoSeg, valorProdutividade: valorProd });
        porPedido[s.pedidoId].tempoTotalSegundos += tempoSeg;
      }
      return Object.values(porPedido).sort((a, b) => b.registradoEm - a.registradoEm);
    })
  }),
  // ─── PAINEL PREVISTO VS REALIZADO ─────────────────────────────────────────────
  previstoVsRealizado: router({
    list: publicProcedure.input(z13.object({
      periodo: z13.enum(["semana", "mes", "tudo"]).default("semana")
    })).query(async ({ input }) => {
      const agora = Math.floor(Date.now() / 1e3);
      let inicioTs = 0;
      if (input.periodo === "semana") {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - 7);
        d.setHours(0, 0, 0, 0);
        inicioTs = Math.floor(d.getTime() / 1e3);
      } else if (input.periodo === "mes") {
        const d = /* @__PURE__ */ new Date();
        d.setMonth(d.getMonth() - 1);
        d.setHours(0, 0, 0, 0);
        inicioTs = Math.floor(d.getTime() / 1e3);
      }
      const where = input.periodo === "tudo" ? and10(eq12(empacotamentoSessoes.status, "finalizado"), sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`) : and10(
        eq12(empacotamentoSessoes.status, "finalizado"),
        sql7`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
        sql7`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
        sql7`${empacotamentoSessoes.registradoEm} <= ${agora}`
      );
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(where);
      const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql7`${empacotamentoPedidos.id} IN (${sql7.join(pedidoIds.map((id) => sql7`${id}`), sql7`, `)})`);
      }
      const porPedido = {};
      for (const s of sessoes) {
        const tempoSeg = s.tempoRegistradoSegundos ?? s.totalSegundos ?? 0;
        if (!porPedido[s.pedidoId]) {
          const pedido = pedidos.find((p) => p.id === s.pedidoId);
          const tempoEstMin = await calcularTempoEstimadoMin(pedido);
          porPedido[s.pedidoId] = {
            pedidoId: s.pedidoId,
            pedidoCodigo: pedido ? String(pedido.id) : String(s.pedidoId),
            tempoRealizadoSegundos: 0,
            tempoEstimadoSegundos: Math.round(tempoEstMin * 60),
            registradoEm: s.registradoEm ?? 0
          };
        }
        porPedido[s.pedidoId].tempoRealizadoSegundos += tempoSeg;
      }
      return Object.values(porPedido).sort((a, b) => b.registradoEm - a.registradoEm).map((p) => ({
        ...p,
        variacaoPct: p.tempoEstimadoSegundos > 0 ? parseFloat(((p.tempoRealizadoSegundos - p.tempoEstimadoSegundos) / p.tempoEstimadoSegundos * 100).toFixed(1)) : null
      }));
    })
  })
});
async function retomarSessao(sessaoId) {
  const rows = await getDb5().select().from(empacotamentoSessoes).where(and10(eq12(empacotamentoSessoes.id, sessaoId), eq12(empacotamentoSessoes.status, "pausado"))).limit(1);
  if (rows.length === 0) return { success: false, error: "sessao_nao_pausada" };
  const sessao = rows[0];
  const agoraUtcSeg = Math.floor(Date.now() / 1e3);
  await getDb5().execute(
    sql7`UPDATE empacotamento_sessoes_pausas SET retomadoEm = ${agoraUtcSeg} WHERE sessaoId = ${sessao.id} AND retomadoEm IS NULL`
  );
  await getDb5().update(empacotamentoSessoes).set({
    status: "ativo"
  }).where(eq12(empacotamentoSessoes.id, sessao.id));
  return { success: true, sessaoId, action: "resumed" };
}

// server/routers/metaProdutos.ts
import { z as z14 } from "zod";
init_db();
init_schema();
import { eq as eq13, asc as asc5 } from "drizzle-orm";
var metaProdutosRouter = router({
  // Listar todos os produtos monitorados
  list: protectedProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(metaProdutos).orderBy(asc5(metaProdutos.nomeProduto));
  }),
  // Criar ou atualizar um produto monitorado
  upsert: protectedProcedure.input(z14.object({
    id: z14.number().optional(),
    nomeProduto: z14.string().min(1),
    codigoProduto: z14.string().optional(),
    metaParticipacaoPct: z14.number().min(0).max(100),
    observacao: z14.string().optional(),
    ativo: z14.boolean().optional().default(true)
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const { id, ...data } = input;
    if (id) {
      await db5.update(metaProdutos).set({
        nomeProduto: data.nomeProduto,
        codigoProduto: data.codigoProduto ?? null,
        metaParticipacaoPct: String(data.metaParticipacaoPct),
        observacao: data.observacao ?? null,
        ativo: data.ativo
      }).where(eq13(metaProdutos.id, id));
      return { success: true, id };
    } else {
      const [result] = await db5.insert(metaProdutos).values({
        nomeProduto: data.nomeProduto,
        codigoProduto: data.codigoProduto ?? null,
        metaParticipacaoPct: String(data.metaParticipacaoPct),
        observacao: data.observacao ?? null,
        ativo: data.ativo
      }).returning({ id: metaProdutos.id });
      return { success: true, id: result.id };
    }
  }),
  // Remover um produto monitorado
  delete: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(metaProdutos).where(eq13(metaProdutos.id, input.id));
    return { success: true };
  })
});

// server/routers/performanceComercial.ts
init_env();
init_mubisys_client();
init_db();
init_schema();
import { z as z15 } from "zod";
import { eq as eq14, and as and11, sql as sql8 } from "drizzle-orm";
var apiCache = /* @__PURE__ */ new Map();
var CACHE_TTL_ATUAL_MS = 60 * 60 * 1e3;
var CACHE_TTL_HISTORICO_MS = 6 * 60 * 60 * 1e3;
var CACHE_TTL_HISTORICO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1e3;
async function getDbCache(cacheKey) {
  try {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(mubisysApiCache).where(eq14(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    if (/* @__PURE__ */ new Date() > new Date(row.expiresAt)) {
      await db5.delete(mubisysApiCache).where(eq14(mubisysApiCache.cacheKey, cacheKey));
      return null;
    }
    const allOs = row.osData ? JSON.parse(row.osData) : [];
    const allOrc = row.orcData ? JSON.parse(row.orcData) : [];
    return { allOs, allOrc };
  } catch {
    return null;
  }
}
async function setDbCache(cacheKey, mes, ano, allOs, allOrc) {
  try {
    const db5 = await getDb3();
    if (!db5) return;
    const now = /* @__PURE__ */ new Date();
    const ttlMs = isMesAtual(mes, ano) ? CACHE_TTL_ATUAL_MS : CACHE_TTL_HISTORICO_PERSISTENTE_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await db5.select({ id: mubisysApiCache.id }).from(mubisysApiCache).where(eq14(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db5.update(mubisysApiCache).set({ osData: JSON.stringify(allOs), orcData: JSON.stringify(allOrc), fetchedAt: now, expiresAt }).where(eq14(mubisysApiCache.cacheKey, cacheKey));
    } else {
      await db5.insert(mubisysApiCache).values({ cacheKey, mes, ano, osData: JSON.stringify(allOs), orcData: JSON.stringify(allOrc), fetchedAt: now, expiresAt });
    }
  } catch {
  }
}
async function deleteDbCache(cacheKey) {
  try {
    const db5 = await getDb3();
    if (!db5) return;
    await db5.delete(mubisysApiCache).where(eq14(mubisysApiCache.cacheKey, cacheKey));
  } catch {
  }
}
function normalizeEmpresaKey(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}
function isMesAtual(mes, ano) {
  const now = /* @__PURE__ */ new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}
function getCached(key) {
  const entry = apiCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_HISTORICO_MS) {
    apiCache.delete(key);
    return null;
  }
  return entry.data;
}
function setCacheWithTTL(key, data, mes, ano) {
  apiCache.set(key, { data, ts: Date.now() });
  if (isMesAtual(mes, ano)) {
    setTimeout(() => apiCache.delete(key), CACHE_TTL_ATUAL_MS);
  }
}
function deleteCache(key) {
  apiCache.delete(key);
}
function isOsNormalDb(os) {
  if (os.tipoOs === null || os.tipoOs === void 0) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  const status = (os.status ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho")) return false;
  if (tipo === "amostra") return false;
  if (tipo === "cortesia") return false;
  if (status === "cancelada") return false;
  return true;
}
var MESES_INATIVIDADE_PARA_NOVO = 6;
async function buscarTodasComprasValidas(db5) {
  const rows = await db5.select({
    empresa: historicoOs.empresa,
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status
  }).from(historicoOs);
  const compras = [];
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresa = (r.empresa ?? "").toLowerCase().trim();
    if (!empresa) continue;
    compras.push({ empresa, mes: r.mes, ano: r.ano });
  }
  return compras;
}
function ultimaCompraAntesDe(compras, mes, ano) {
  const map = /* @__PURE__ */ new Map();
  for (const c of compras) {
    if (c.ano > ano || c.ano === ano && c.mes >= mes) continue;
    const atual = map.get(c.empresa);
    if (!atual || c.ano > atual.ano || c.ano === atual.ano && c.mes > atual.mes) {
      map.set(c.empresa, { mes: c.mes, ano: c.ano });
    }
  }
  return map;
}
function isClienteNovoPorRecencia(ultima, mes, ano) {
  if (!ultima) return true;
  const gapMeses = (ano - ultima.ano) * 12 + (mes - ultima.mes);
  return gapMeses >= MESES_INATIVIDADE_PARA_NOVO;
}
async function getMesFromDb(mes, ano) {
  const db5 = await getDb3();
  if (!db5) return null;
  const osRows = await db5.select().from(historicoOs).where(and11(eq14(historicoOs.mes, mes), eq14(historicoOs.ano, ano)));
  const orcRows = await db5.select().from(historicoOrcamentos).where(and11(eq14(historicoOrcamentos.mes, mes), eq14(historicoOrcamentos.ano, ano)));
  const osNormais = osRows.filter((os) => {
    if (os.tipoOs === null || os.tipoOs === void 0) return false;
    const tipo = os.tipoOs;
    const status = (os.status ?? "").toLowerCase();
    if (tipo.toLowerCase().startsWith("retrabalho")) return false;
    if (tipo.toLowerCase() === "amostra") return false;
    if (tipo.toLowerCase() === "cortesia") return false;
    if (status === "cancelada") return false;
    return true;
  });
  const osPorVendedor = {};
  let totalValorOs = 0;
  let totalCustoOs = 0;
  let totalResultadoOs = 0;
  for (const os of osNormais) {
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
    const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
    totalValorOs += valor;
    totalCustoOs += custo;
    totalResultadoOs += resultado;
    if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
    osPorVendedor[vendedor].total++;
    osPorVendedor[vendedor].valor += valor;
    osPorVendedor[vendedor].custo += custo;
    osPorVendedor[vendedor].resultado += resultado;
  }
  const orcPorVendedor = {};
  let totalValorOrc = 0;
  for (const orc of orcRows) {
    const vendedor = orc.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(orc.total ?? "0")) || 0;
    totalValorOrc += valor;
    if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
    orcPorVendedor[vendedor].total++;
    orcPorVendedor[vendedor].valor += valor;
  }
  return {
    osNormais: {
      total: osNormais.length,
      valorTotal: totalValorOs,
      custo: totalCustoOs,
      resultado: totalResultadoOs,
      porVendedor: osPorVendedor
    },
    orcamentos: {
      total: orcRows.length,
      valorTotal: totalValorOrc,
      porVendedor: orcPorVendedor
    }
  };
}
var pendingApiCalls = /* @__PURE__ */ new Map();
async function getMesFromApi(mes, ano) {
  const cacheKey = `mes_${mes}_${ano}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const existing = pendingApiCalls.get(cacheKey);
  if (existing) return existing;
  const promise = _getMesFromApiImpl(mes, ano).then((result) => {
    setCacheWithTTL(cacheKey, result, mes, ano);
    pendingApiCalls.delete(cacheKey);
    return result;
  }).catch((err) => {
    pendingApiCalls.delete(cacheKey);
    throw err;
  });
  pendingApiCalls.set(cacheKey, promise);
  return promise;
}
async function _getMesFromApiImpl(mes, ano) {
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad(mes)}-01`;
  const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;
  const rawCacheKey = `raw_${mes}_${ano}`;
  const osCacheKey = `os_raw_${mes}_${ano}`;
  const orcCacheKey = `orc_raw_${mes}_${ano}`;
  const cachedOs = getCached(osCacheKey);
  const cachedOrc = getCached(orcCacheKey);
  let allOs;
  let allOrc;
  if (cachedOs && cachedOrc) {
    allOs = cachedOs;
    allOrc = cachedOrc;
  } else {
    const dbCached = await getDbCache(rawCacheKey);
    if (dbCached) {
      allOs = dbCached.allOs;
      allOrc = dbCached.allOrc;
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
    } else {
      const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });
      const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal });
      allOs = osResult.itens;
      allOrc = orcResult.itens;
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
      if (osResult.completo && orcResult.completo) {
        setDbCache(rawCacheKey, mes, ano, allOs, allOrc).catch(() => {
        });
        console.log(`[MubiSys] Cache persistente salvo para ${mes}/${ano}: ${allOs.length} OS, ${allOrc.length} or\xE7amentos`);
      } else {
        console.warn(`[MubiSys] Busca incompleta para ${mes}/${ano} \u2014 cache persistente N\xC3O salvo (OS: ${osResult.completo}, Orc: ${orcResult.completo})`);
      }
    }
  }
  const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
  const osNormais = allOs.filter(
    (os) => !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) && (os.status || "").toLowerCase() !== "cancelada"
  );
  const osPorVendedor = {};
  let totalValorOs = 0;
  let totalCustoOs = 0;
  let totalResultadoOs = 0;
  for (const os of osNormais) {
    const vendedor = os.vendedor || "Sem Vendedor";
    const valor = parseFloat(String(os.valor_total ?? "0")) || 0;
    const custo = parseFloat(String(os.valor_custo ?? "0")) || 0;
    const resultado = parseFloat(String(os.valor_margem ?? "0")) || 0;
    totalValorOs += valor;
    totalCustoOs += custo;
    totalResultadoOs += resultado;
    if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
    osPorVendedor[vendedor].total++;
    osPorVendedor[vendedor].valor += valor;
    osPorVendedor[vendedor].custo += custo;
    osPorVendedor[vendedor].resultado += resultado;
  }
  const STATUS_EXCLUIDOS_ORC = ["cancelada", "cancelado", "exclu\xEDda", "exclu\xEDdo", "excluida", "excluido"];
  const orcVersaoAtual = allOrc.filter(
    (orc) => !STATUS_EXCLUIDOS_ORC.includes((orc.status ?? "").toLowerCase())
  );
  const orcPorVendedor = {};
  let totalValorOrc = 0;
  for (const orc of orcVersaoAtual) {
    const vendedor = orc.vendedor || "Sem Vendedor";
    const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
    const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
    const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
    const valor = vt > 0 ? vt : vc + vm;
    totalValorOrc += valor;
    if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
    orcPorVendedor[vendedor].total++;
    orcPorVendedor[vendedor].valor += valor;
  }
  return {
    osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
    orcamentos: { total: orcVersaoAtual.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor }
  };
}
function calcMetrics(osNormais, orcamentos, mes, ano) {
  const MESES_NOMES2 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const taxaConversao = orcamentos.total > 0 ? parseFloat((osNormais.total / orcamentos.total * 100).toFixed(1)) : 0;
  const taxaFaturamento = orcamentos.valorTotal > 0 ? parseFloat((osNormais.valorTotal / orcamentos.valorTotal * 100).toFixed(1)) : 0;
  const ticketMedio = osNormais.total > 0 ? parseFloat((osNormais.valorTotal / osNormais.total).toFixed(2)) : 0;
  const margemPct = osNormais.valorTotal > 0 ? parseFloat((osNormais.resultado / osNormais.valorTotal * 100).toFixed(1)) : 0;
  const todosVendedores = /* @__PURE__ */ new Set([
    ...Object.keys(osNormais.porVendedor),
    ...Object.keys(orcamentos.porVendedor)
  ]);
  const porVendedor = Array.from(todosVendedores).map((vendedor) => {
    const os = osNormais.porVendedor[vendedor] ?? { total: 0, valor: 0, custo: 0, resultado: 0 };
    const orc = orcamentos.porVendedor[vendedor] ?? { total: 0, valor: 0 };
    const conv = orc.total > 0 ? parseFloat((os.total / orc.total * 100).toFixed(1)) : 0;
    const taxaFat = orc.valor > 0 ? parseFloat((os.valor / orc.valor * 100).toFixed(1)) : 0;
    const ticket = os.total > 0 ? parseFloat((os.valor / os.total).toFixed(2)) : 0;
    const margem = os.valor > 0 ? parseFloat((os.resultado / os.valor * 100).toFixed(1)) : 0;
    return {
      vendedor,
      cotacoes: orc.total,
      valorOrcado: parseFloat(orc.valor.toFixed(2)),
      osGeradas: os.total,
      faturamento: parseFloat(os.valor.toFixed(2)),
      custo: parseFloat(os.custo.toFixed(2)),
      resultado: parseFloat(os.resultado.toFixed(2)),
      taxaConversao: conv,
      taxaFaturamento: taxaFat,
      ticketMedio: ticket,
      margemPct: margem
    };
  }).sort((a, b) => b.cotacoes - a.cotacoes);
  return {
    label: `${MESES_NOMES2[mes - 1]}/${String(ano).slice(2)}`,
    mes,
    ano,
    cotacoes: orcamentos.total,
    osGeradas: osNormais.total,
    valorOrcado: parseFloat(orcamentos.valorTotal.toFixed(2)),
    faturamento: parseFloat(osNormais.valorTotal.toFixed(2)),
    custo: parseFloat(osNormais.custo.toFixed(2)),
    resultado: parseFloat(osNormais.resultado.toFixed(2)),
    taxaConversao,
    taxaFaturamento,
    ticketMedio,
    margemPct,
    porVendedor
  };
}
async function getClientesNovosMes(mes, ano) {
  const db5 = await getDb3();
  const EMPTY = { total: 0, cotacoesNovos: 0, osNovos: 0, faturamentoNovos: 0, ticketMedioNovos: 0, valorOrcadoNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0, porVendedor: {}, porVendedorNovos: {}, lista: [] };
  if (!db5) return EMPTY;
  const snapCongelado = await db5.select().from(performanceAuditada).where(and11(eq14(performanceAuditada.mes, mes), eq14(performanceAuditada.ano, ano), eq14(performanceAuditada.congelado, true))).limit(1);
  if (snapCongelado.length > 0 && snapCongelado[0].listaClientesNovos) {
    const s = snapCongelado[0];
    let listaSnap = [];
    try {
      listaSnap = JSON.parse(s.listaClientesNovos ?? "[]");
    } catch {
      listaSnap = [];
    }
    const porVendedorNovosSnap = {};
    for (const item of listaSnap) {
      const vendedor = item.vendedor || "Sem Vendedor";
      const valor = parseFloat(String(item.valorOs ?? "0")) || 0;
      if (!porVendedorNovosSnap[vendedor]) {
        porVendedorNovosSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      porVendedorNovosSnap[vendedor].clientesNovos++;
      porVendedorNovosSnap[vendedor].osNovos++;
      porVendedorNovosSnap[vendedor].faturamentoNovos = parseFloat((porVendedorNovosSnap[vendedor].faturamentoNovos + valor).toFixed(2));
    }
    const orcMesSnap = await db5.select().from(historicoOrcamentos).where(and11(eq14(historicoOrcamentos.mes, mes), eq14(historicoOrcamentos.ano, ano)));
    const comprasSnap = await buscarTodasComprasValidas(db5);
    const ultimaCompraSnap = ultimaCompraAntesDe(comprasSnap, mes, ano);
    for (const orc of orcMesSnap) {
      const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
      if (!clienteKey || !isClienteNovoPorRecencia(ultimaCompraSnap.get(clienteKey), mes, ano)) continue;
      const vendedor = orc.vendedor || "Sem Vendedor";
      if (!porVendedorNovosSnap[vendedor]) {
        porVendedorNovosSnap[vendedor] = { clientesNovos: 0, osNovos: 0, faturamentoNovos: 0, cotacoesNovos: 0, valorOrcadoNovos: 0, taxaConvNovos: 0, taxaFatNovos: 0 };
      }
      porVendedorNovosSnap[vendedor].cotacoesNovos++;
      porVendedorNovosSnap[vendedor].valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
    }
    for (const v of Object.keys(porVendedorNovosSnap)) {
      const entry = porVendedorNovosSnap[v];
      entry.taxaConvNovos = entry.cotacoesNovos > 0 ? parseFloat((entry.osNovos / entry.cotacoesNovos * 100).toFixed(1)) : 0;
      entry.taxaFatNovos = entry.valorOrcadoNovos > 0 ? parseFloat((entry.faturamentoNovos / entry.valorOrcadoNovos * 100).toFixed(1)) : 0;
      entry.valorOrcadoNovos = parseFloat(entry.valorOrcadoNovos.toFixed(2));
    }
    const cotacoesNovosSnap = (s.cotacoesNovos ?? 0) > 0 ? s.cotacoesNovos ?? 0 : Object.values(porVendedorNovosSnap).reduce((acc, v) => acc + v.cotacoesNovos, 0);
    const taxaConvNovosSnap = parseFloat(String(s.taxaConvNovos ?? 0)) > 0 ? parseFloat(String(s.taxaConvNovos ?? 0)) : cotacoesNovosSnap > 0 ? parseFloat(((s.clientesNovos ?? 0) / cotacoesNovosSnap * 100).toFixed(1)) : 0;
    return {
      total: s.clientesNovos ?? 0,
      cotacoesNovos: cotacoesNovosSnap,
      osNovos: s.clientesNovos ?? 0,
      faturamentoNovos: parseFloat(String(s.faturamentoNovos ?? 0)),
      ticketMedioNovos: s.clientesNovos ? parseFloat(String(s.faturamentoNovos ?? 0)) / s.clientesNovos : 0,
      valorOrcadoNovos: 0,
      taxaConversaoNovos: taxaConvNovosSnap,
      taxaFaturamentoNovos: 0,
      porVendedor: {},
      porVendedorNovos: porVendedorNovosSnap,
      lista: listaSnap
    };
  }
  const publicKey = ENV.MUBISYS_PUBLIC_KEY;
  const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
  if (!publicKey || !accessToken) return EMPTY;
  const overrides = await db5.select().from(clienteOverrides);
  const overrideMap = /* @__PURE__ */ new Map();
  for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);
  const todasComprasValidas = await buscarTodasComprasValidas(db5);
  const ultimaCompraPorCliente = ultimaCompraAntesDe(todasComprasValidas, mes, ano);
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad(mes)}-01`;
  const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;
  let allOsApi = [];
  let allOrcApiPrefetched = null;
  try {
    const mesData = await getMesFromApi(mes, ano);
    const rawCacheKeyNovos = `raw_${mes}_${ano}`;
    const osCacheKey = `os_raw_${mes}_${ano}`;
    const orcCacheKey = `orc_raw_${mes}_${ano}`;
    const cachedOs = getCached(osCacheKey);
    const cachedOrc = getCached(orcCacheKey);
    if (cachedOs && cachedOrc) {
      allOsApi = cachedOs;
      allOrcApiPrefetched = cachedOrc;
    } else {
      const dbCachedNovos = await getDbCache(rawCacheKeyNovos);
      if (dbCachedNovos) {
        allOsApi = dbCachedNovos.allOs;
        allOrcApiPrefetched = dbCachedNovos.allOrc;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, allOrcApiPrefetched, mes, ano);
      } else {
        const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df });
        allOsApi = osResult.itens;
        const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df });
        const orcList = orcResult.itens;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, orcList, mes, ano);
        setDbCache(rawCacheKeyNovos, mes, ano, allOsApi, orcList).catch(() => {
        });
        allOrcApiPrefetched = orcList;
      }
    }
  } catch {
    const osMesDb = await db5.select().from(historicoOs).where(and11(eq14(historicoOs.mes, mes), eq14(historicoOs.ano, ano)));
    allOsApi = osMesDb.map((os) => ({
      cliente: os.empresa,
      vendedor: os.vendedor,
      numero: os.osNumero,
      valor_total: os.valorOs ?? os.valorTotal,
      tipo: os.tipoOs ?? "",
      status: os.status ?? ""
    }));
  }
  const osNormaisApi = allOsApi.filter(
    (os) => (os.tipo || "").toLowerCase() !== "retrabalho" && (os.tipo || "").toLowerCase() !== "amostra" && (os.tipo || "").toLowerCase() !== "cortesia" && (os.status || "").toLowerCase() !== "cancelada"
  );
  const porVendedor = {};
  const porVendedorNovosOs = {};
  let total = 0;
  let osNovosCount = 0;
  let faturamentoNovos = 0;
  const clientesVistos = /* @__PURE__ */ new Set();
  const listaRaw = [];
  for (const os of osNormaisApi) {
    const clienteRaw = os.cliente;
    const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "") : String(clienteRaw ?? "");
    const clienteKey = nomeCliente.toLowerCase().trim();
    if (!clienteKey) continue;
    const overrideStatus = overrideMap.get(normalizeEmpresaKey(nomeCliente));
    const isNovoByHistory = isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
    const isNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isNovoByHistory;
    if (isNovo) {
      const vendedor = String(os.vendedor ?? "Sem Vendedor");
      const vendedorKey = vendedor.toLowerCase().trim();
      const valorOs = parseFloat(String(os.valor_total ?? "0")) || 0;
      faturamentoNovos += valorOs;
      osNovosCount++;
      if (!porVendedorNovosOs[vendedorKey]) porVendedorNovosOs[vendedorKey] = { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: vendedor };
      porVendedorNovosOs[vendedorKey].osNovos++;
      porVendedorNovosOs[vendedorKey].faturamentoNovos += valorOs;
      if (!clientesVistos.has(clienteKey)) {
        clientesVistos.add(clienteKey);
        total++;
        porVendedor[vendedor] = (porVendedor[vendedor] ?? 0) + 1;
        porVendedorNovosOs[vendedorKey].clientesNovos++;
        const contatosOs = Array.isArray(os.cliente_contato) ? os.cliente_contato : os.cliente_contato ? [os.cliente_contato] : [];
        const enderecosOs = Array.isArray(os.cliente_endereco) ? os.cliente_endereco : os.cliente_endereco ? [os.cliente_endereco] : [];
        const primeiroContato = contatosOs[0];
        const primeiroEndereco = enderecosOs[0];
        const telefoneOs = primeiroContato?.celular || primeiroContato?.telefone || primeiroContato?.fone || "";
        const contatoOs = primeiroContato?.nome_contato || primeiroContato?.nome || "";
        const cidadeOs = primeiroEndereco?.cidade || "";
        const estadoOs = primeiroEndereco?.estado || primeiroEndereco?.uf || "";
        listaRaw.push({ empresa: nomeCliente, vendedor, osNumero: String(os.numero ?? ""), valorOs: String(os.valor_total ?? ""), telefone: telefoneOs, contato: contatoOs, cidade: cidadeOs, estado: estadoOs });
      }
    }
  }
  function formatWhatsApp(tel) {
    if (!tel) return "";
    const digits = tel.replace(/\D/g, "");
    if (!digits) return "";
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}`;
  }
  const lista = [];
  for (const item of listaRaw) {
    lista.push({
      ...item,
      whatsappLink: formatWhatsApp(item.telefone)
    });
  }
  let cotacoesNovos = 0;
  let valorOrcadoNovos = 0;
  const porVendedorNovosOrc = {};
  {
    let allOrcApi = [];
    if (allOrcApiPrefetched !== null) {
      const STATUS_EXCL_ORC = ["cancelada", "cancelado", "exclu\xEDda", "exclu\xEDdo", "excluida", "excluido"];
      allOrcApi = allOrcApiPrefetched.filter(
        (orc) => !STATUS_EXCL_ORC.includes((orc.status ?? "").toLowerCase())
      );
    } else {
      const orcMes = await db5.select().from(historicoOrcamentos).where(and11(eq14(historicoOrcamentos.mes, mes), eq14(historicoOrcamentos.ano, ano)));
      allOrcApi = orcMes.map((orc) => ({
        cliente: orc.empresa,
        vendedor: orc.vendedor,
        valor_total: orc.total
      }));
    }
    for (const orc of allOrcApi) {
      const clienteRaw = orc.cliente;
      const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "") : String(clienteRaw ?? "");
      const clienteKey = nomeCliente.toLowerCase().trim();
      const orcOverride = overrideMap.get(normalizeEmpresaKey(nomeCliente));
      const isNovoOrc = orcOverride === "recorrente" ? false : orcOverride === "novo" ? true : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
      if (clienteKey && isNovoOrc) {
        cotacoesNovos++;
        const valor = parseFloat(String(orc.valor_total ?? orc.valor ?? orc.total ?? orc.valorTotal ?? "0")) || 0;
        valorOrcadoNovos += valor;
        const vendedorOrcRaw = String(orc.vendedor ?? orc.usuario ?? "Sem Vendedor");
        const vendedorOrcKey = vendedorOrcRaw.toLowerCase().trim();
        if (!porVendedorNovosOrc[vendedorOrcKey]) porVendedorNovosOrc[vendedorOrcKey] = { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: vendedorOrcRaw };
        porVendedorNovosOrc[vendedorOrcKey].cotacoesNovos++;
        porVendedorNovosOrc[vendedorOrcKey].valorOrcadoNovos += valor;
      }
    }
  }
  const osNovos = osNovosCount;
  const taxaConversaoNovos = cotacoesNovos > 0 ? parseFloat((osNovos / cotacoesNovos * 100).toFixed(1)) : 0;
  const taxaFaturamentoNovos = valorOrcadoNovos > 0 ? parseFloat((faturamentoNovos / valorOrcadoNovos * 100).toFixed(1)) : 0;
  const todosVendedoresNovos = Array.from(/* @__PURE__ */ new Set([
    ...Object.keys(porVendedorNovosOs),
    ...Object.keys(porVendedorNovosOrc)
  ]));
  const porVendedorNovos = {};
  for (const v of todosVendedoresNovos) {
    const os = porVendedorNovosOs[v] ?? { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: v };
    const orc = porVendedorNovosOrc[v] ?? { cotacoesNovos: 0, valorOrcadoNovos: 0, nomeOriginal: v };
    const nomeDisplay = orc.nomeOriginal !== v ? orc.nomeOriginal : os.nomeOriginal;
    const taxaConvNovos = orc.cotacoesNovos > 0 ? parseFloat((os.osNovos / orc.cotacoesNovos * 100).toFixed(1)) : 0;
    const taxaFatNovos = orc.valorOrcadoNovos > 0 ? parseFloat((os.faturamentoNovos / orc.valorOrcadoNovos * 100).toFixed(1)) : 0;
    porVendedorNovos[nomeDisplay] = {
      clientesNovos: os.clientesNovos,
      osNovos: os.osNovos,
      faturamentoNovos: parseFloat(os.faturamentoNovos.toFixed(2)),
      cotacoesNovos: orc.cotacoesNovos,
      valorOrcadoNovos: parseFloat(orc.valorOrcadoNovos.toFixed(2)),
      taxaConvNovos,
      taxaFatNovos
    };
  }
  const ticketMedioNovos = osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0;
  if (snapCongelado.length > 0 && !snapCongelado[0].listaClientesNovos && lista.length > 0) {
    db5.update(performanceAuditada).set({ listaClientesNovos: JSON.stringify(lista) }).where(and11(eq14(performanceAuditada.mes, mes), eq14(performanceAuditada.ano, ano))).execute().catch(() => {
    });
  }
  return {
    total,
    cotacoesNovos,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    ticketMedioNovos,
    valorOrcadoNovos: parseFloat(valorOrcadoNovos.toFixed(2)),
    taxaConversaoNovos,
    taxaFaturamentoNovos,
    porVendedor,
    porVendedorNovos,
    lista
  };
}
var performanceComercialRouter = router({
  // Dados de um mês específico
  getMes: publicProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020), forceRefresh: z15.boolean().optional().default(false) })).query(async ({ input }) => {
    const { mes, ano, forceRefresh } = input;
    if (!forceRefresh) {
      const dbSnap = await getDb3();
      if (dbSnap) {
        const snap = await dbSnap.select().from(performanceAuditada).where(and11(eq14(performanceAuditada.mes, mes), eq14(performanceAuditada.ano, ano), eq14(performanceAuditada.congelado, true))).limit(1);
        if (snap.length > 0) {
          const s = snap[0];
          return {
            cotacoes: s.cotacoes,
            osGeradas: s.osNormais,
            taxaConversao: parseFloat(String(s.taxaConversao)),
            taxaFaturamento: s.valorOrcado && parseFloat(String(s.valorOrcado)) > 0 ? parseFloat((parseFloat(String(s.faturamento)) / parseFloat(String(s.valorOrcado)) * 100).toFixed(2)) : 0,
            ticketMedio: s.osNormais > 0 ? parseFloat((parseFloat(String(s.faturamento)) / s.osNormais).toFixed(2)) : 0,
            margemPct: 0,
            custo: 0,
            resultado: 0,
            label: `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][s.mes - 1]}/${String(s.ano).slice(2)}`,
            mes: s.mes,
            ano: s.ano,
            faturamento: parseFloat(String(s.faturamento)),
            valorOrcado: parseFloat(String(s.valorOrcado)),
            clientesNovos: s.clientesNovos,
            taxaConvNovos: parseFloat(String(s.taxaConvNovos)),
            faturamentoNovos: parseFloat(String(s.faturamentoNovos)),
            totalPedidosBanco: null,
            _fonte: "congelado",
            _statusValidacao: s.statusValidacao,
            _dataAuditoria: s.dataAuditoria,
            _dataCongelamento: s.dataCongelamento,
            _auditadoPor: s.auditadoPor,
            // Campos extras para compatibilidade com o restante da UI
            porVendedor: {},
            top3Vendedores: [],
            metaAtingida: false,
            metaCotacoes: 0,
            metaOs: 0,
            metaFaturamento: 0,
            metaTaxaConversao: 0
          };
        }
      }
    }
    if (forceRefresh) {
      const osCacheKey = `os_raw_${mes}_${ano}`;
      const orcCacheKey = `orc_raw_${mes}_${ano}`;
      const mesCacheKey = `mes_${mes}_${ano}`;
      const rawCacheKey = `raw_${mes}_${ano}`;
      deleteCache(osCacheKey);
      deleteCache(orcCacheKey);
      deleteCache(mesCacheKey);
      deleteDbCache(rawCacheKey).catch(() => {
      });
    }
    let raw = null;
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    if (publicKey && accessToken) {
      try {
        const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 55e3));
        raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
      } catch {
        raw = null;
      }
    }
    const viaApi = raw !== null;
    if (!raw) {
      raw = await getMesFromDb(mes, ano);
    }
    if (!raw) return null;
    const metrics = calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
    const db22 = await getDb3();
    let totalPedidosBanco = null;
    if (db22) {
      const MESES_NOMES_UPPER = ["JANEIRO", "FEVEREIRO", "MAR\xC7O", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
      const mesNome = MESES_NOMES_UPPER[mes - 1];
      const fatRow = await db22.select({ totalPedidos: faturamento.totalPedidos }).from(faturamento).where(and11(sql8`UPPER(${faturamento.mes}) = ${mesNome}`, eq14(faturamento.ano, ano))).limit(1);
      if (fatRow.length > 0 && fatRow[0].totalPedidos > 0) totalPedidosBanco = fatRow[0].totalPedidos;
    }
    return { ...metrics, totalPedidosBanco, _origemDados: viaApi ? "api" : "local" };
  }),
  // Múltiplos meses para comparativo e gráfico de evolução
  getMultiMes: publicProcedure.input(z15.object({
    meses: z15.array(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) }))
  })).query(async ({ input }) => {
    const now = /* @__PURE__ */ new Date();
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    const db5 = await getDb3();
    const anoSet = Array.from(new Set(input.meses.map((m) => m.ano)));
    const dbDataByAno = /* @__PURE__ */ new Map();
    for (const ano of anoSet) {
      const osRows = db5 ? await db5.select().from(historicoOs).where(eq14(historicoOs.ano, ano)) : [];
      const orcRows = db5 ? await db5.select().from(historicoOrcamentos).where(eq14(historicoOrcamentos.ano, ano)) : [];
      dbDataByAno.set(ano, { os: osRows, orc: orcRows });
    }
    const novosMap = /* @__PURE__ */ new Map();
    if (db5) {
      const overrides = await db5.select().from(clienteOverrides);
      const overrideMap = /* @__PURE__ */ new Map();
      for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);
      const todasComprasValidas = await buscarTodasComprasValidas(db5);
      for (const ano of anoSet) {
        const todasOsAno = dbDataByAno.get(ano)?.os ?? [];
        const todasOrcAno = dbDataByAno.get(ano)?.orc ?? [];
        const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
        for (let mes = 1; mes <= mesAtual; mes++) {
          const ultimaCompraPorCliente = ultimaCompraAntesDe(todasComprasValidas, mes, ano);
          const osMes = todasOsAno.filter((o) => o.mes === mes);
          const orcMes = todasOrcAno.filter((o) => o.mes === mes);
          let osNovos = 0, faturamentoNovos = 0;
          for (const os of osMes) {
            if (!isOsNormalDb(os)) continue;
            const clienteKey = (os.empresa ?? "").toLowerCase().trim();
            if (!clienteKey) continue;
            const overrideStatus = overrideMap.get(normalizeEmpresaKey(os.empresa ?? ""));
            const isNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
            if (isNovo) {
              const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
              osNovos++;
              faturamentoNovos += valor;
            }
          }
          let cotacoesNovos = 0;
          let valorOrcadoNovos = 0;
          for (const orc of orcMes) {
            const clienteKey = (orc.empresa ?? "").toLowerCase().trim();
            if (!clienteKey) continue;
            const overrideStatus = overrideMap.get(normalizeEmpresaKey(orc.empresa ?? ""));
            const isNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
            if (isNovo) {
              cotacoesNovos++;
              valorOrcadoNovos += parseFloat(String(orc.total ?? "0")) || 0;
            }
          }
          const ticketMedioNovos = osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0;
          const taxaConversaoNovos = cotacoesNovos > 0 ? parseFloat((osNovos / cotacoesNovos * 100).toFixed(1)) : 0;
          const taxaFaturamentoNovos = valorOrcadoNovos > 0 ? parseFloat((faturamentoNovos / valorOrcadoNovos * 100).toFixed(1)) : 0;
          novosMap.set(`${mes}_${ano}`, { osNovos, faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)), ticketMedioNovos, cotacoesNovos, taxaConversaoNovos, taxaFaturamentoNovos });
        }
      }
    }
    const mesesSolicitados = input.meses;
    const snapsCongelados = db5 ? await db5.select().from(performanceAuditada).where(and11(
      eq14(performanceAuditada.congelado, true),
      sql8`(${performanceAuditada.mes}, ${performanceAuditada.ano}) IN (${sql8.join(
        mesesSolicitados.map((m) => sql8`(${m.mes}, ${m.ano})`),
        sql8`, `
      )})`
    )) : [];
    const snapMap = /* @__PURE__ */ new Map();
    for (const s of snapsCongelados) snapMap.set(`${s.mes}_${s.ano}`, s);
    const results = await Promise.all(
      input.meses.map(async ({ mes, ano }) => {
        const snap = snapMap.get(`${mes}_${ano}`);
        if (snap) {
          const novos2 = novosMap.get(`${mes}_${ano}`);
          const cotacoesNovosSnap = (snap.cotacoesNovos ?? 0) > 0 ? snap.cotacoesNovos ?? 0 : novos2?.cotacoesNovos ?? 0;
          const osNovosSnap = novos2?.osNovos ?? snap.clientesNovos ?? 0;
          const taxaConvNovosSnap = parseFloat(String(snap.taxaConvNovos ?? 0)) > 0 ? parseFloat(String(snap.taxaConvNovos ?? 0)) : cotacoesNovosSnap > 0 ? parseFloat((osNovosSnap / cotacoesNovosSnap * 100).toFixed(1)) : 0;
          return {
            mes,
            ano,
            label: `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][mes - 1]}/${String(ano).slice(2)}`,
            cotacoes: snap.cotacoes ?? 0,
            osGeradas: snap.osNormais ?? 0,
            taxaConversao: parseFloat(String(snap.taxaConversao ?? 0)),
            taxaFaturamento: snap.valorOrcado && parseFloat(String(snap.valorOrcado)) > 0 ? parseFloat((parseFloat(String(snap.faturamento ?? 0)) / parseFloat(String(snap.valorOrcado)) * 100).toFixed(2)) : 0,
            faturamento: parseFloat(String(snap.faturamento ?? 0)),
            valorOrcado: parseFloat(String(snap.valorOrcado ?? 0)),
            ticketMedio: snap.osNormais ? parseFloat(String(snap.faturamento ?? 0)) / snap.osNormais : 0,
            margemPct: 0,
            custo: 0,
            resultado: 0,
            clientesNovos: snap.clientesNovos ?? 0,
            // Expor como taxaConversaoNovos (nome usado pelo frontend) E taxaConvNovos (compat)
            taxaConvNovos: taxaConvNovosSnap,
            taxaConversaoNovos: taxaConvNovosSnap,
            faturamentoNovos: parseFloat(String(snap.faturamentoNovos ?? 0)),
            osNovos: osNovosSnap,
            ticketMedioNovos: novos2?.ticketMedioNovos ?? 0,
            cotacoesNovos: cotacoesNovosSnap,
            taxaFaturamentoNovos: novos2?.taxaFaturamentoNovos ?? 0,
            porVendedor: []
            // array vazio para compatibilidade com EvolucaoVendedor
          };
        }
        let raw = null;
        if (publicKey && accessToken) {
          try {
            const timeoutPromise = new Promise(
              (_, reject) => setTimeout(() => reject(new Error("timeout")), 4e4)
            );
            raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
          } catch {
            raw = null;
          }
        }
        const isMesAtualMulti = mes === now.getMonth() + 1 && ano === now.getFullYear();
        if (!raw) {
          const anoData = dbDataByAno.get(ano);
          if (!anoData && !isMesAtualMulti) return null;
          const osRows = (anoData?.os ?? []).filter((o) => o.mes === mes);
          const orcRows = (anoData?.orc ?? []).filter((o) => o.mes === mes);
          if (osRows.length === 0 && orcRows.length === 0 && !isMesAtualMulti) return null;
          const osNormais = osRows.filter((os) => {
            if (os.tipoOs === null || os.tipoOs === void 0) return false;
            const tipo = os.tipoOs;
            const status = (os.status ?? "").toLowerCase();
            if (tipo.toLowerCase().startsWith("retrabalho")) return false;
            if (tipo.toLowerCase() === "amostra" || tipo.toLowerCase() === "cortesia") return false;
            if (status === "cancelada") return false;
            return true;
          });
          const osPorVendedor = {};
          let totalValorOs = 0, totalCustoOs = 0, totalResultadoOs = 0;
          for (const os of osNormais) {
            const vendedor = os.vendedor || "Sem Vendedor";
            const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
            const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
            const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
            totalValorOs += valor;
            totalCustoOs += custo;
            totalResultadoOs += resultado;
            if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
            osPorVendedor[vendedor].total++;
            osPorVendedor[vendedor].valor += valor;
            osPorVendedor[vendedor].custo += custo;
            osPorVendedor[vendedor].resultado += resultado;
          }
          const orcPorVendedor = {};
          let totalValorOrc = 0;
          for (const orc of orcRows) {
            const vendedor = orc.vendedor || "Sem Vendedor";
            const valor = parseFloat(String(orc.total ?? "0")) || 0;
            totalValorOrc += valor;
            if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
            orcPorVendedor[vendedor].total++;
            orcPorVendedor[vendedor].valor += valor;
          }
          raw = {
            osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
            orcamentos: { total: orcRows.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor }
          };
        }
        if (!raw && isMesAtualMulti) {
          raw = {
            osNormais: { total: 0, valorTotal: 0, custo: 0, resultado: 0, porVendedor: {} },
            orcamentos: { total: 0, valorTotal: 0, porVendedor: {} }
          };
        }
        if (!raw) return null;
        const novos = novosMap.get(`${mes}_${ano}`) ?? { osNovos: 0, faturamentoNovos: 0, ticketMedioNovos: 0, cotacoesNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0 };
        return { ...calcMetrics(raw.osNormais, raw.orcamentos, mes, ano), ...novos };
      })
    );
    return results.filter(Boolean);
  }),
  // ─── Metas por vendedor ────────────────────────────────────────────────────
  getMetas: publicProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(metasComerciais).where(and11(eq14(metasComerciais.mes, input.mes), eq14(metasComerciais.ano, input.ano)));
  }),
  upsertMeta: protectedProcedure.input(z15.object({
    vendedor: z15.string().min(1),
    mes: z15.number().min(1).max(12),
    ano: z15.number().min(2020),
    metaCotacoes: z15.number().nullable().optional(),
    metaVendas: z15.number().nullable().optional(),
    metaFaturamento: z15.number().nullable().optional(),
    metaConversao: z15.number().nullable().optional(),
    metaTicketMedio: z15.number().nullable().optional(),
    // Novos campos
    metaOsGeradas: z15.number().nullable().optional(),
    metaClientesNovos: z15.number().nullable().optional(),
    metaOsNovos: z15.number().nullable().optional(),
    metaCotacoesNovos: z15.number().nullable().optional(),
    metaFaturamentoNovos: z15.number().nullable().optional(),
    metaTaxaFaturamento: z15.number().nullable().optional(),
    metaTaxaFaturamentoNovos: z15.number().nullable().optional(),
    metaConversaoNovos: z15.number().nullable().optional(),
    metaTicketMedioNovos: z15.number().nullable().optional(),
    metaValorOrcado: z15.number().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const toStr = (v) => v != null ? String(v) : null;
    const setData = {
      metaCotacoes: input.metaCotacoes ?? null,
      metaVendas: input.metaVendas ?? null,
      metaFaturamento: toStr(input.metaFaturamento),
      metaConversao: toStr(input.metaConversao),
      metaTicketMedio: toStr(input.metaTicketMedio),
      metaOsGeradas: input.metaOsGeradas ?? null,
      metaClientesNovos: input.metaClientesNovos ?? null,
      metaOsNovos: input.metaOsNovos ?? null,
      metaCotacoesNovos: input.metaCotacoesNovos ?? null,
      metaFaturamentoNovos: toStr(input.metaFaturamentoNovos),
      metaTaxaFaturamento: toStr(input.metaTaxaFaturamento),
      metaTaxaFaturamentoNovos: toStr(input.metaTaxaFaturamentoNovos),
      metaConversaoNovos: toStr(input.metaConversaoNovos),
      metaTicketMedioNovos: toStr(input.metaTicketMedioNovos),
      metaValorOrcado: toStr(input.metaValorOrcado),
      updatedAt: /* @__PURE__ */ new Date()
    };
    const existing = await db5.select().from(metasComerciais).where(and11(
      eq14(metasComerciais.vendedor, input.vendedor),
      eq14(metasComerciais.mes, input.mes),
      eq14(metasComerciais.ano, input.ano)
    ));
    if (existing.length > 0) {
      await db5.update(metasComerciais).set(setData).where(and11(
        eq14(metasComerciais.vendedor, input.vendedor),
        eq14(metasComerciais.mes, input.mes),
        eq14(metasComerciais.ano, input.ano)
      ));
    } else {
      await db5.insert(metasComerciais).values({
        vendedor: input.vendedor,
        mes: input.mes,
        ano: input.ano,
        ...setData
      });
    }
    return { ok: true };
  }),
  deleteMeta: protectedProcedure.input(z15.object({ id: z15.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    await db5.delete(metasComerciais).where(eq14(metasComerciais.id, input.id));
    return { ok: true };
  }),
  // Todos os meses de um ano para comparativo anual
  getAno: publicProcedure.input(z15.object({ ano: z15.number().min(2020) })).query(async ({ input }) => {
    const { ano } = input;
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    const db5 = await getDb3();
    const todasOsAno = db5 ? await db5.select().from(historicoOs).where(eq14(historicoOs.ano, ano)) : [];
    const todosOrcAno = db5 ? await db5.select().from(historicoOrcamentos).where(eq14(historicoOrcamentos.ano, ano)) : [];
    const snapsCongeladosAno = db5 ? await db5.select().from(performanceAuditada).where(and11(eq14(performanceAuditada.ano, ano), eq14(performanceAuditada.congelado, true))) : [];
    const snapMapAno = /* @__PURE__ */ new Map();
    for (const s of snapsCongeladosAno) snapMapAno.set(s.mes, s);
    const MESES_NOMES_ANO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const meses = Array.from({ length: 12 }, (_, i) => i + 1);
    const CONCURRENCY = 2;
    const results = new Array(meses.length).fill(null);
    for (let i = 0; i < meses.length; i += CONCURRENCY) {
      const batch = meses.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(async (mes) => {
        const snap = snapMapAno.get(mes);
        if (snap) {
          const valorOrcadoSnap = parseFloat(String(snap.valorOrcado ?? 0));
          const faturamentoSnap = parseFloat(String(snap.faturamento ?? 0));
          const osGeradasSnap = snap.osNormais ?? 0;
          return {
            label: `${MESES_NOMES_ANO[mes - 1]}/${String(ano).slice(2)}`,
            mes,
            ano,
            cotacoes: snap.cotacoes ?? 0,
            osGeradas: osGeradasSnap,
            valorOrcado: valorOrcadoSnap,
            faturamento: faturamentoSnap,
            custo: 0,
            resultado: 0,
            taxaConversao: parseFloat(String(snap.taxaConversao ?? 0)),
            taxaFaturamento: valorOrcadoSnap > 0 ? parseFloat((faturamentoSnap / valorOrcadoSnap * 100).toFixed(2)) : 0,
            ticketMedio: osGeradasSnap > 0 ? parseFloat((faturamentoSnap / osGeradasSnap).toFixed(2)) : 0,
            margemPct: 0,
            porVendedor: []
          };
        }
        let raw = null;
        if (publicKey && accessToken) {
          try {
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 55e3));
            raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
          } catch {
            raw = null;
          }
        }
        if (!raw) {
          const osRows = todasOsAno.filter((o) => o.mes === mes);
          const orcRows = todosOrcAno.filter((o) => o.mes === mes);
          if (osRows.length === 0 && orcRows.length === 0) return null;
          const osNormais = osRows.filter((os) => {
            if (os.tipoOs === null || os.tipoOs === void 0) return false;
            const tipo = os.tipoOs;
            const status = (os.status ?? "").toLowerCase();
            if (tipo.toLowerCase().startsWith("retrabalho")) return false;
            if (tipo.toLowerCase() === "amostra") return false;
            if (tipo.toLowerCase() === "cortesia") return false;
            if (status === "cancelada") return false;
            return true;
          });
          const osPorVendedor = {};
          let totalValorOs = 0, totalCustoOs = 0, totalResultadoOs = 0;
          for (const os of osNormais) {
            const vendedor = os.vendedor || "Sem Vendedor";
            const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
            const custo = parseFloat(String(os.custosTotal ?? "0")) || 0;
            const resultado = parseFloat(String(os.resultadoReais ?? "0")) || 0;
            totalValorOs += valor;
            totalCustoOs += custo;
            totalResultadoOs += resultado;
            if (!osPorVendedor[vendedor]) osPorVendedor[vendedor] = { total: 0, valor: 0, custo: 0, resultado: 0 };
            osPorVendedor[vendedor].total++;
            osPorVendedor[vendedor].valor += valor;
            osPorVendedor[vendedor].custo += custo;
            osPorVendedor[vendedor].resultado += resultado;
          }
          const orcPorVendedor = {};
          let totalValorOrc = 0;
          for (const orc of orcRows) {
            const vendedor = orc.vendedor || "Sem Vendedor";
            const valor = parseFloat(String(orc.total ?? "0")) || 0;
            totalValorOrc += valor;
            if (!orcPorVendedor[vendedor]) orcPorVendedor[vendedor] = { total: 0, valor: 0 };
            orcPorVendedor[vendedor].total++;
            orcPorVendedor[vendedor].valor += valor;
          }
          raw = {
            osNormais: { total: osNormais.length, valorTotal: totalValorOs, custo: totalCustoOs, resultado: totalResultadoOs, porVendedor: osPorVendedor },
            orcamentos: { total: orcRows.length, valorTotal: totalValorOrc, porVendedor: orcPorVendedor }
          };
        }
        if (!raw) return null;
        return calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
      }));
      batch.forEach((mes, j) => {
        results[mes - 1] = batchResults[j];
      });
    }
    return results;
  }),
  // Clientes novos do mês (primeira compra)
  getClientesNovos: protectedProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    return getClientesNovosMes(input.mes, input.ano);
  }),
  // Clientes novos de todos os meses do ano (para gráfico anual) — versão otimizada
  getClientesNovosAno: publicProcedure.input(z15.object({ ano: z15.number().min(2020) })).query(async ({ input }) => {
    const { ano } = input;
    const now = /* @__PURE__ */ new Date();
    const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
    const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
    const CONCURRENCY = 2;
    const results = [];
    for (let i = 0; i < meses.length; i += CONCURRENCY) {
      const batch = meses.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.allSettled(
        batch.map(async (mes) => {
          const dados = await getClientesNovosMes(mes, ano);
          return {
            mes,
            ticketMedioNovos: dados.ticketMedioNovos,
            osNovos: dados.osNovos,
            faturamentoNovos: dados.faturamentoNovos,
            clientesNovosUnicos: dados.total
          };
        })
      );
      for (let j = 0; j < batchResults.length; j++) {
        const r = batchResults[j];
        const mes = batch[j];
        if (r.status === "fulfilled") {
          results.push(r.value);
        } else {
          results.push({ mes, ticketMedioNovos: 0, osNovos: 0, faturamentoNovos: 0, clientesNovosUnicos: 0 });
        }
      }
    }
    results.sort((a, b) => a.mes - b.mes);
    return results;
  }),
  // Evolucao diaria do mes vigente por vendedor
  getEvolucaoDiariaMes: publicProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    const { mes, ano } = input;
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    if (!publicKey || !accessToken) return { dias: [], vendedores: [] };
    const osCacheKey = `os_raw_${mes}_${ano}`;
    const orcCacheKey = `orc_raw_${mes}_${ano}`;
    let allOs = getCached(osCacheKey);
    let allOrc = getCached(orcCacheKey);
    if (!allOs || !allOrc) {
      const pad2 = (n) => String(n).padStart(2, "0");
      const lastDay2 = new Date(ano, mes, 0).getDate();
      const datainicial = `${ano}-${pad2(mes)}-01`;
      const datafinal = `${ano}-${pad2(mes)}-${pad2(lastDay2)}`;
      const [osResult, orcResult] = await Promise.all([
        listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
        listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal })
      ]);
      allOs = osResult.itens;
      allOrc = orcResult.itens;
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
    }
    const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
    const osNormais = allOs.filter(
      (os) => !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) && (os.status || "").toLowerCase() !== "cancelada"
    );
    const STATUS_EXCLUIDOS_ORC_DIARIO = ["cancelada", "cancelado", "exclu\xEDda", "exclu\xEDdo", "excluida", "excluido"];
    const orcVersaoAtual = allOrc.filter(
      (orc) => !STATUS_EXCLUIDOS_ORC_DIARIO.includes((orc.status ?? "").toLowerCase())
    );
    const osPorDia = {};
    for (const os of osNormais) {
      const dataAprov = (os.data_aprovacao || os.data_cadastro || "").substring(0, 10);
      if (!dataAprov) continue;
      const vendedor = os.vendedor || "Sem Vendedor";
      const valor = parseFloat(String(os.valor_total ?? "0")) || 0;
      if (!osPorDia[dataAprov]) osPorDia[dataAprov] = {};
      if (!osPorDia[dataAprov][vendedor]) osPorDia[dataAprov][vendedor] = { os: 0, faturamento: 0 };
      osPorDia[dataAprov][vendedor].os++;
      osPorDia[dataAprov][vendedor].faturamento += valor;
    }
    const orcPorDia = {};
    for (const orc of orcVersaoAtual) {
      const dataCad = (orc.data_cadastro || "").substring(0, 10);
      if (!dataCad) continue;
      const vendedor = orc.vendedor || "Sem Vendedor";
      const vt = parseFloat(String(orc.valor_total ?? "0")) || 0;
      const vc = parseFloat(String(orc.valor_custo ?? "0")) || 0;
      const vm = parseFloat(String(orc.valor_margem ?? "0")) || 0;
      const valor = vt > 0 ? vt : vc + vm;
      if (!orcPorDia[dataCad]) orcPorDia[dataCad] = {};
      if (!orcPorDia[dataCad][vendedor]) orcPorDia[dataCad][vendedor] = { cotacoes: 0, valorOrcado: 0 };
      orcPorDia[dataCad][vendedor].cotacoes++;
      orcPorDia[dataCad][vendedor].valorOrcado += valor;
    }
    const pad = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(ano, mes, 0).getDate();
    const today = /* @__PURE__ */ new Date();
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const acumOs = {};
    const acumFat = {};
    const acumCot = {};
    const acumOrc = {};
    const dias = [];
    for (let d = 1; d <= lastDay; d++) {
      const dStr = `${ano}-${pad(mes)}-${pad(d)}`;
      if (dStr > todayStr) break;
      const label = `${pad(d)}/${pad(mes)}`;
      const osHoje = osPorDia[dStr] ?? {};
      const orcHoje = orcPorDia[dStr] ?? {};
      const todosVend = /* @__PURE__ */ new Set([...Object.keys(osHoje), ...Object.keys(orcHoje)]);
      for (const v of todosVend) {
        acumOs[v] = (acumOs[v] ?? 0) + (osHoje[v]?.os ?? 0);
        acumFat[v] = (acumFat[v] ?? 0) + (osHoje[v]?.faturamento ?? 0);
        acumCot[v] = (acumCot[v] ?? 0) + (orcHoje[v]?.cotacoes ?? 0);
        acumOrc[v] = (acumOrc[v] ?? 0) + (orcHoje[v]?.valorOrcado ?? 0);
      }
      const ponto = { dia: d, label, data: dStr };
      for (const v of todosVend) {
        ponto[`${v}__os`] = osHoje[v]?.os ?? 0;
        ponto[`${v}__fat`] = parseFloat((osHoje[v]?.faturamento ?? 0).toFixed(2));
        ponto[`${v}__cot`] = orcHoje[v]?.cotacoes ?? 0;
        ponto[`${v}__orc`] = parseFloat((orcHoje[v]?.valorOrcado ?? 0).toFixed(2));
      }
      for (const v of Object.keys(acumOs)) {
        ponto[`${v}__os_ac`] = acumOs[v];
        ponto[`${v}__fat_ac`] = parseFloat(acumFat[v].toFixed(2));
      }
      for (const v of Object.keys(acumCot)) {
        ponto[`${v}__cot_ac`] = acumCot[v];
        ponto[`${v}__orc_ac`] = parseFloat(acumOrc[v].toFixed(2));
      }
      dias.push(ponto);
    }
    const vendedores = Array.from(/* @__PURE__ */ new Set([
      ...Object.keys(acumOs),
      ...Object.keys(acumCot)
    ])).filter((v) => v !== "Sem Vendedor").sort();
    return { dias, vendedores };
  }),
  // ─── Overrides manuais de status de cliente ────────────────────────────────
  listClienteOverrides: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(clienteOverrides).orderBy(clienteOverrides.empresaOriginal);
  }),
  upsertClienteOverride: protectedProcedure.input(z15.object({
    empresaOriginal: z15.string().min(1),
    status: z15.enum(["recorrente", "novo"]),
    motivo: z15.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const empresaNorm = input.empresaOriginal.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    await db5.insert(clienteOverrides).values({
      empresa: empresaNorm,
      empresaOriginal: input.empresaOriginal,
      status: input.status,
      motivo: input.motivo ?? null,
      criadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido"
    }).onConflictDoUpdate({
      target: clienteOverrides.empresa,
      set: {
        status: input.status,
        motivo: input.motivo ?? null,
        criadoPor: ctx.user.name ?? ctx.user.email ?? "desconhecido"
      }
    });
    return { ok: true };
  }),
  deleteClienteOverride: protectedProcedure.input(z15.object({ id: z15.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    await db5.delete(clienteOverrides).where(eq14(clienteOverrides.id, input.id));
    return { ok: true };
  }),
  // ─── Inteligência de Clientes ─────────────────────────────────────────────
  getInteligenteClientes: publicProcedure.input(z15.object({
    dataInicial: z15.string().regex(/^\d{4}-\d{2}$/).default(`${(/* @__PURE__ */ new Date()).getFullYear()}-01`),
    dataFinal: z15.string().regex(/^\d{4}-\d{2}$/).default(`${(/* @__PURE__ */ new Date()).getFullYear()}-${String((/* @__PURE__ */ new Date()).getMonth() + 1).padStart(2, "0")}`),
    forcarAtualizacao: z15.boolean().optional().default(false)
  })).query(async ({ input }) => {
    const { dataInicial, dataFinal, forcarAtualizacao } = input;
    const [anoIni, mesIni] = dataInicial.split("-").map(Number);
    const [anoFim, mesFim] = dataFinal.split("-").map(Number);
    const di = `${dataInicial}-01`;
    const lastDayFim = new Date(anoFim, mesFim, 0).getDate();
    const df = `${dataFinal}-${String(lastDayFim).padStart(2, "0")}`;
    const ano = anoIni;
    const periodoKey = `${dataInicial}_${dataFinal}`;
    const publicKey = ENV.MUBISYS_PUBLIC_KEY;
    const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
    const EMPTY = {
      clientesUnicosAno: 0,
      taxaRecompra: 0,
      clientesNovosAno: 0,
      pctClientesNovos: 0,
      clientesNovosQueRecompraram: 0,
      taxaRecompraNovosPct: 0,
      mediaComprasPorCliente: 0,
      pctClientesSemCompra6Meses: 0,
      clientesSemCompra6Meses: 0,
      tempoMedioPropostaFechamento: null,
      tempoMedianaPropostaFechamento: null,
      tempoP25: null,
      tempoP75: null,
      pctCicloAte3Dias: 0,
      pctCiclo4a7Dias: 0,
      pctCicloMais7Dias: 0,
      frequenciaCompraDias: null,
      mrrAproximado: 0,
      arrAproximado: 0,
      clientesRecorrentesMRR: 0,
      pctFaturamentoRecorrente: 0,
      clientesNovosPuro: 0,
      clientesNovosPuroComRecompra: 0,
      taxaRecompraNovosPuroPct: 0,
      clientesReativados: 0,
      clientesReativadosComRecompra: 0,
      taxaRecompraReativadosPct: 0,
      pctReceitaTop20: 0,
      ticketMedioPorCliente: 0,
      topClientesPorFaturamento: [],
      porVendedor: [],
      distribuicaoTempo: []
    };
    if (!publicKey || !accessToken) return EMPTY;
    const db5 = await getDb3();
    if (db5) {
      const rows = await db5.select().from(inteligenciaClientesCache).where(eq14(inteligenciaClientesCache.periodoKey, periodoKey)).limit(1);
      if (rows.length > 0) {
        const row = rows[0];
        if (row.congelado || !forcarAtualizacao) {
          const cached = JSON.parse(row.dadosJson);
          cached._calculadoEm = row.calculadoEm;
          cached._fonte = row.congelado ? "congelado" : "cache";
          cached._congelado = row.congelado;
          cached._congeladoEm = row.congeladoEm;
          return cached;
        }
      }
    }
    const cacheKey = `inteligente_clientes_${periodoKey}`;
    const memCached = getCached(cacheKey);
    if (memCached) return memCached;
    let allOsAno = [];
    let allOrcAno = [];
    try {
      const osResult = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df });
      allOsAno = osResult.itens;
      const orcResult = await listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df });
      allOrcAno = orcResult.itens;
    } catch (e) {
      return { ...EMPTY, _erro: e?.message || "N\xE3o foi poss\xEDvel buscar os dados do ERP. Tente um per\xEDodo menor." };
    }
    const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
    const osNormais = allOsAno.filter(
      (os) => !TIPOS_EXCLUIDOS.includes((os.tipo || "").toLowerCase()) && (os.status || "").toLowerCase() !== "cancelada"
    );
    const normNome = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
    const clientesUnicosSet = /* @__PURE__ */ new Set();
    const clientesPorVendedor = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      const vendedor = os.vendedor || "Sem Vendedor";
      if (!cliente) continue;
      clientesUnicosSet.add(cliente);
      if (!clientesPorVendedor[vendedor]) clientesPorVendedor[vendedor] = /* @__PURE__ */ new Set();
      clientesPorVendedor[vendedor].add(cliente);
    }
    const dbForHistory = await getDb3();
    const clientesAnteriores = dbForHistory ? await dbForHistory.select({ empresa: historicoOs.empresa }).from(historicoOs).where(sql8`${historicoOs.ano} < ${ano}`) : [];
    const setAnteriores = new Set(clientesAnteriores.map((r) => normNome(r.empresa ?? "")));
    const clientesNovosSet = /* @__PURE__ */ new Set();
    const clientesNovosSetPorVendedor = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      const vendedor = os.vendedor || "Sem Vendedor";
      if (!cliente || setAnteriores.has(cliente)) continue;
      clientesNovosSet.add(cliente);
      if (!clientesNovosSetPorVendedor[vendedor]) clientesNovosSetPorVendedor[vendedor] = /* @__PURE__ */ new Set();
      clientesNovosSetPorVendedor[vendedor].add(cliente);
    }
    const comprasPorCliente = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      const mesStr = (os.data_aprovacao || os.data_cadastro || "").substring(0, 7);
      if (!comprasPorCliente[cliente]) comprasPorCliente[cliente] = /* @__PURE__ */ new Set();
      if (mesStr) comprasPorCliente[cliente].add(mesStr);
    }
    let clientesComRecompra = 0;
    for (const [, meses] of Object.entries(comprasPorCliente)) {
      if (meses.size >= 2) clientesComRecompra++;
    }
    const taxaRecompra = clientesUnicosSet.size > 0 ? parseFloat((clientesComRecompra / clientesUnicosSet.size * 100).toFixed(1)) : 0;
    const primeiraCompraNoPeriodo = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      const dataStr = os.data_aprovacao || os.data_cadastro;
      if (!dataStr) continue;
      const dt = new Date(dataStr);
      if (isNaN(dt.getTime())) continue;
      const mesOs = dt.getMonth() + 1;
      const anoOs = dt.getFullYear();
      const atual = primeiraCompraNoPeriodo[cliente];
      if (!atual || anoOs < atual.ano || anoOs === atual.ano && mesOs < atual.mes) {
        primeiraCompraNoPeriodo[cliente] = { mes: mesOs, ano: anoOs };
      }
    }
    const gruposPorMesAno = /* @__PURE__ */ new Map();
    for (const [cliente, ref] of Object.entries(primeiraCompraNoPeriodo)) {
      const key = `${ref.mes}-${ref.ano}`;
      if (!gruposPorMesAno.has(key)) gruposPorMesAno.set(key, []);
      gruposPorMesAno.get(key).push(cliente);
    }
    const comprasHistoricoCompleto = dbForHistory ? (await buscarTodasComprasValidas(dbForHistory)).map((c) => ({ ...c, empresa: normNome(c.empresa) })) : [];
    const clientesNovosPuroSet = /* @__PURE__ */ new Set();
    const clientesReativadosSet = /* @__PURE__ */ new Set();
    for (const [key, clientesGrupo] of gruposPorMesAno) {
      const [mesStr, anoStr] = key.split("-");
      const mesRef = Number(mesStr);
      const anoRef = Number(anoStr);
      const ultimaMap = ultimaCompraAntesDe(comprasHistoricoCompleto, mesRef, anoRef);
      for (const cliente of clientesGrupo) {
        const ultima = ultimaMap.get(cliente);
        if (!isClienteNovoPorRecencia(ultima, mesRef, anoRef)) continue;
        if (!ultima) clientesNovosPuroSet.add(cliente);
        else clientesReativadosSet.add(cliente);
      }
    }
    let clientesNovosPuroComRecompra = 0;
    for (const cliente of clientesNovosPuroSet) {
      if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) clientesNovosPuroComRecompra++;
    }
    let clientesReativadosComRecompra = 0;
    for (const cliente of clientesReativadosSet) {
      if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) clientesReativadosComRecompra++;
    }
    const taxaRecompraNovosPuroPct = clientesNovosPuroSet.size > 0 ? parseFloat((clientesNovosPuroComRecompra / clientesNovosPuroSet.size * 100).toFixed(1)) : 0;
    const taxaRecompraReativadosPct = clientesReativadosSet.size > 0 ? parseFloat((clientesReativadosComRecompra / clientesReativadosSet.size * 100).toFixed(1)) : 0;
    let clientesNovosQueRecompraram = 0;
    const clientesNovosQueRecompraramPorVendedor = {};
    for (const cliente of clientesNovosSet) {
      if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) clientesNovosQueRecompraram++;
    }
    for (const [vendedor, setNovos] of Object.entries(clientesNovosSetPorVendedor)) {
      let count3 = 0;
      for (const cliente of setNovos) {
        if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) count3++;
      }
      clientesNovosQueRecompraramPorVendedor[vendedor] = count3;
    }
    const osPorCliente = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      osPorCliente[cliente] = (osPorCliente[cliente] ?? 0) + 1;
    }
    const totalOsNormais = Object.values(osPorCliente).reduce((a, b) => a + b, 0);
    const mediaComprasPorCliente = clientesUnicosSet.size > 0 ? parseFloat((totalOsNormais / clientesUnicosSet.size).toFixed(1)) : 0;
    const hoje = /* @__PURE__ */ new Date();
    const seisAtras = new Date(hoje);
    seisAtras.setMonth(seisAtras.getMonth() - 6);
    const ultimaCompraCliente = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      const dataStr = os.data_aprovacao || os.data_cadastro;
      if (!dataStr) continue;
      const dt = new Date(dataStr);
      if (isNaN(dt.getTime())) continue;
      if (!ultimaCompraCliente[cliente] || dt > ultimaCompraCliente[cliente]) {
        ultimaCompraCliente[cliente] = dt;
      }
    }
    let clientesSemCompra6Meses = 0;
    const clientesSemCompra6MesesPorVendedor = {};
    for (const cliente of clientesUnicosSet) {
      const ultima = ultimaCompraCliente[cliente];
      if (!ultima || ultima < seisAtras) clientesSemCompra6Meses++;
    }
    for (const [vendedor, setClientes] of Object.entries(clientesPorVendedor)) {
      let count3 = 0;
      for (const cliente of setClientes) {
        const ultima = ultimaCompraCliente[cliente];
        if (!ultima || ultima < seisAtras) count3++;
      }
      clientesSemCompra6MesesPorVendedor[vendedor] = count3;
    }
    const pctClientesSemCompra6Meses = clientesUnicosSet.size > 0 ? parseFloat((clientesSemCompra6Meses / clientesUnicosSet.size * 100).toFixed(1)) : 0;
    const pctClientesNovos = clientesUnicosSet.size > 0 ? parseFloat((clientesNovosSet.size / clientesUnicosSet.size * 100).toFixed(1)) : 0;
    const taxaRecompraNovosPct = clientesNovosSet.size > 0 ? parseFloat((clientesNovosQueRecompraram / clientesNovosSet.size * 100).toFixed(1)) : 0;
    const orcPorNumero = {};
    const orcVersaoAtualIC = allOrcAno;
    for (const orc of orcVersaoAtualIC) {
      const num = String(orc.numero || orc.id || "");
      if (num) orcPorNumero[num] = orc;
    }
    const tempos = [];
    const temposPorVendedor = {};
    for (const os of osNormais) {
      const dataAprov = os.data_aprovacao || os.data_cadastro;
      const orcNum = String(os.orcamento_numero || os.orcamento || os.numero_orcamento || "");
      if (!dataAprov || !orcNum) continue;
      const orc = orcPorNumero[orcNum];
      if (!orc) continue;
      const dataCad = orc.data_cadastro;
      if (!dataCad) continue;
      const dtAprov = new Date(dataAprov);
      const dtCad = new Date(dataCad);
      const diffDias = (dtAprov.getTime() - dtCad.getTime()) / (1e3 * 60 * 60 * 24);
      if (diffDias < 0 || diffDias > 365) continue;
      tempos.push(diffDias);
      const vendedor = os.vendedor || "Sem Vendedor";
      if (!temposPorVendedor[vendedor]) temposPorVendedor[vendedor] = [];
      temposPorVendedor[vendedor].push(diffDias);
    }
    const calcStats = (arr) => {
      if (arr.length === 0) return { media: null, mediana: null, p25: null, p75: null };
      const sorted = [...arr].sort((a, b) => a - b);
      const media = parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
      const mid = Math.floor(sorted.length / 2);
      const mediana = parseFloat((sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]).toFixed(1));
      const p25 = parseFloat(sorted[Math.floor(sorted.length * 0.25)].toFixed(1));
      const p75 = parseFloat(sorted[Math.floor(sorted.length * 0.75)].toFixed(1));
      return { media, mediana, p25, p75 };
    };
    const stats = calcStats(tempos);
    const faixas = [
      { label: "Mesmo dia", min: 0, max: 0 },
      { label: "1-3 dias", min: 1, max: 3 },
      { label: "4-7 dias", min: 4, max: 7 },
      { label: "8-15 dias", min: 8, max: 15 },
      { label: "16-30 dias", min: 16, max: 30 },
      { label: ">30 dias", min: 31, max: 999 }
    ];
    const distribuicaoTempo = faixas.map((f2) => ({
      faixa: f2.label,
      quantidade: tempos.filter((t2) => t2 >= f2.min && t2 <= f2.max).length
    }));
    const pctCicloAte3Dias = tempos.length > 0 ? parseFloat((tempos.filter((t2) => t2 <= 3).length / tempos.length * 100).toFixed(1)) : 0;
    const pctCiclo4a7Dias = tempos.length > 0 ? parseFloat((tempos.filter((t2) => t2 >= 4 && t2 <= 7).length / tempos.length * 100).toFixed(1)) : 0;
    const pctCicloMais7Dias = tempos.length > 0 ? parseFloat((tempos.filter((t2) => t2 > 7).length / tempos.length * 100).toFixed(1)) : 0;
    const datasPorCliente = {};
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      const dataStr = os.data_aprovacao || os.data_cadastro;
      if (!dataStr) continue;
      const dt = new Date(dataStr);
      if (isNaN(dt.getTime())) continue;
      if (!datasPorCliente[cliente]) datasPorCliente[cliente] = [];
      datasPorCliente[cliente].push(dt);
    }
    const intervalosMediosPorCliente = [];
    for (const datas of Object.values(datasPorCliente)) {
      if (datas.length < 2) continue;
      const sorted = [...datas].sort((a, b) => a.getTime() - b.getTime());
      const diffs = [];
      for (let i = 1; i < sorted.length; i++) {
        diffs.push((sorted[i].getTime() - sorted[i - 1].getTime()) / (1e3 * 60 * 60 * 24));
      }
      intervalosMediosPorCliente.push(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }
    const frequenciaCompraDias = intervalosMediosPorCliente.length > 0 ? parseFloat((intervalosMediosPorCliente.reduce((a, b) => a + b, 0) / intervalosMediosPorCliente.length).toFixed(1)) : null;
    const totalMesesPeriodo = (anoFim - anoIni) * 12 + (mesFim - mesIni) + 1;
    const thresholdRecorrenteMRR = Math.max(2, Math.ceil(totalMesesPeriodo * 0.5));
    const clientesRecorrentesMRRSet = /* @__PURE__ */ new Set();
    for (const [cliente, meses] of Object.entries(comprasPorCliente)) {
      if (meses.size >= thresholdRecorrenteMRR) clientesRecorrentesMRRSet.add(cliente);
    }
    const faturamentoPorClienteIC = {};
    const nomeOriginalPorClienteIC = {};
    let faturamentoTotalPeriodoIC = 0;
    for (const os of osNormais) {
      const cliente = normNome(os.cliente || os.empresa || "");
      if (!cliente) continue;
      const valor = parseFloat(String(os.valor_total ?? "0")) || 0;
      faturamentoPorClienteIC[cliente] = (faturamentoPorClienteIC[cliente] ?? 0) + valor;
      faturamentoTotalPeriodoIC += valor;
      if (!nomeOriginalPorClienteIC[cliente]) nomeOriginalPorClienteIC[cliente] = String(os.cliente || os.empresa || "");
    }
    let faturamentoRecorrenteIC = 0;
    for (const cliente of clientesRecorrentesMRRSet) {
      faturamentoRecorrenteIC += faturamentoPorClienteIC[cliente] ?? 0;
    }
    const mrrAproximado = totalMesesPeriodo > 0 ? parseFloat((faturamentoRecorrenteIC / totalMesesPeriodo).toFixed(2)) : 0;
    const arrAproximado = parseFloat((mrrAproximado * 12).toFixed(2));
    const pctFaturamentoRecorrente = faturamentoTotalPeriodoIC > 0 ? parseFloat((faturamentoRecorrenteIC / faturamentoTotalPeriodoIC * 100).toFixed(1)) : 0;
    const clientesOrdenadosPorFaturamento = Object.entries(faturamentoPorClienteIC).sort((a, b) => b[1] - a[1]);
    const top20PctCount = Math.max(1, Math.ceil(clientesOrdenadosPorFaturamento.length * 0.2));
    const faturamentoTop20Pct = clientesOrdenadosPorFaturamento.slice(0, top20PctCount).reduce((acc, [, v]) => acc + v, 0);
    const pctReceitaTop20 = faturamentoTotalPeriodoIC > 0 ? parseFloat((faturamentoTop20Pct / faturamentoTotalPeriodoIC * 100).toFixed(1)) : 0;
    const ticketMedioPorCliente = clientesUnicosSet.size > 0 ? parseFloat((faturamentoTotalPeriodoIC / clientesUnicosSet.size).toFixed(2)) : 0;
    const topClientesPorFaturamento = clientesOrdenadosPorFaturamento.slice(0, 10).map(([clienteKey, faturamento2]) => {
      const qtdOs = osPorCliente[clienteKey] ?? 0;
      return {
        cliente: nomeOriginalPorClienteIC[clienteKey] ?? clienteKey,
        faturamento: parseFloat(faturamento2.toFixed(2)),
        qtdOs,
        ticketMedio: qtdOs > 0 ? parseFloat((faturamento2 / qtdOs).toFixed(2)) : 0
      };
    });
    const todosVendedoresIC = /* @__PURE__ */ new Set([
      ...Object.keys(clientesPorVendedor),
      ...Object.keys(clientesNovosSetPorVendedor)
    ]);
    const porVendedor = Array.from(todosVendedoresIC).filter((v) => v !== "Sem Vendedor").map((v) => {
      const unicos = clientesPorVendedor[v]?.size ?? 0;
      const novos = clientesNovosSetPorVendedor[v]?.size ?? 0;
      const novosRecompra = clientesNovosQueRecompraramPorVendedor[v] ?? 0;
      const temposV = temposPorVendedor[v] ?? [];
      const statsV = calcStats(temposV);
      let recompraV = 0;
      if (clientesPorVendedor[v]) {
        for (const cliente of clientesPorVendedor[v]) {
          if ((comprasPorCliente[cliente]?.size ?? 0) >= 2) recompraV++;
        }
      }
      const taxaRecompraV = unicos > 0 ? parseFloat((recompraV / unicos * 100).toFixed(1)) : 0;
      const taxaRecompraNovosPctV = novos > 0 ? parseFloat((novosRecompra / novos * 100).toFixed(1)) : 0;
      const pctNovosV = unicos > 0 ? parseFloat((novos / unicos * 100).toFixed(1)) : 0;
      let totalOsV = 0;
      if (clientesPorVendedor[v]) {
        for (const cliente of clientesPorVendedor[v]) {
          totalOsV += osPorCliente[cliente] ?? 0;
        }
      }
      const mediaComprasV = unicos > 0 ? parseFloat((totalOsV / unicos).toFixed(1)) : 0;
      return {
        vendedor: v,
        clientesUnicos: unicos,
        clientesNovos: novos,
        pctClientesNovos: pctNovosV,
        clientesNovosQueRecompraram: novosRecompra,
        taxaRecompra: taxaRecompraV,
        taxaRecompraNovosPct: taxaRecompraNovosPctV,
        mediaComprasPorCliente: mediaComprasV,
        tempoMedioFechamento: statsV.media
      };
    }).sort((a, b) => b.clientesUnicos - a.clientesUnicos);
    const result = {
      clientesUnicosAno: clientesUnicosSet.size,
      taxaRecompra,
      clientesNovosAno: clientesNovosSet.size,
      pctClientesNovos,
      clientesNovosQueRecompraram,
      taxaRecompraNovosPct,
      mediaComprasPorCliente,
      pctClientesSemCompra6Meses,
      clientesSemCompra6Meses,
      tempoMedioPropostaFechamento: stats.media,
      tempoMedianaPropostaFechamento: stats.mediana,
      tempoP25: stats.p25,
      tempoP75: stats.p75,
      pctCicloAte3Dias,
      pctCiclo4a7Dias,
      pctCicloMais7Dias,
      frequenciaCompraDias,
      mrrAproximado,
      arrAproximado,
      clientesRecorrentesMRR: clientesRecorrentesMRRSet.size,
      pctFaturamentoRecorrente,
      clientesNovosPuro: clientesNovosPuroSet.size,
      clientesNovosPuroComRecompra,
      taxaRecompraNovosPuroPct,
      clientesReativados: clientesReativadosSet.size,
      clientesReativadosComRecompra,
      taxaRecompraReativadosPct,
      pctReceitaTop20,
      ticketMedioPorCliente,
      topClientesPorFaturamento,
      porVendedor,
      distribuicaoTempo
    };
    setCacheWithTTL(cacheKey, result, (/* @__PURE__ */ new Date()).getMonth() + 1, ano);
    if (db5) {
      try {
        const existing = await db5.select({ id: inteligenciaClientesCache.id }).from(inteligenciaClientesCache).where(eq14(inteligenciaClientesCache.periodoKey, periodoKey)).limit(1);
        if (existing.length > 0) {
          await db5.update(inteligenciaClientesCache).set({ dadosJson: JSON.stringify(result), calculadoEm: /* @__PURE__ */ new Date() }).where(eq14(inteligenciaClientesCache.periodoKey, periodoKey));
        } else {
          await db5.insert(inteligenciaClientesCache).values({ periodoKey, dadosJson: JSON.stringify(result), calculadoEm: /* @__PURE__ */ new Date() });
        }
      } catch (e) {
        console.error("[IC cache] Erro ao salvar cache:", e);
      }
    }
    const resultWithTs = { ...result, _calculadoEm: /* @__PURE__ */ new Date() };
    return resultWithTs;
  }),
  // ─── SISTEMA DE AUDITORIA E CONGELAMENTO DE DADOS ────────────────────────────
  /** Busca os dados auditados de um mês (congelado ou pendente) */
  getAuditoria: publicProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(performanceAuditada).where(and11(eq14(performanceAuditada.mes, input.mes), eq14(performanceAuditada.ano, input.ano))).limit(1);
    return rows.length > 0 ? rows[0] : null;
  }),
  /** Salva um snapshot dos dados atuais do ERP como auditoria pendente */
  salvarAuditoria: protectedProcedure.input(z15.object({
    mes: z15.number().min(1).max(12),
    ano: z15.number().min(2020),
    cotacoes: z15.number(),
    osNormais: z15.number(),
    taxaConversao: z15.number(),
    faturamento: z15.number(),
    valorOrcado: z15.number(),
    clientesNovos: z15.number(),
    cotacoesNovos: z15.number().default(0),
    taxaConvNovos: z15.number(),
    faturamentoNovos: z15.number(),
    statusValidacao: z15.enum(["pendente", "validado", "corrigido_excel"]).default("validado"),
    fonteExcel: z15.string().optional(),
    observacoes: z15.string().optional()
  })).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const existing = await db5.select({ id: performanceAuditada.id }).from(performanceAuditada).where(and11(eq14(performanceAuditada.mes, input.mes), eq14(performanceAuditada.ano, input.ano))).limit(1);
    const values = {
      mes: input.mes,
      ano: input.ano,
      cotacoes: input.cotacoes,
      osNormais: input.osNormais,
      taxaConversao: String(input.taxaConversao),
      faturamento: String(input.faturamento),
      valorOrcado: String(input.valorOrcado),
      clientesNovos: input.clientesNovos,
      cotacoesNovos: input.cotacoesNovos ?? 0,
      taxaConvNovos: String(input.taxaConvNovos),
      faturamentoNovos: String(input.faturamentoNovos),
      statusValidacao: input.statusValidacao,
      fonteExcel: input.fonteExcel,
      observacoes: input.observacoes,
      auditadoPor: ctx.user?.name ?? "sistema",
      dataAuditoria: /* @__PURE__ */ new Date(),
      congelado: false
    };
    if (existing.length > 0) {
      await db5.update(performanceAuditada).set(values).where(eq14(performanceAuditada.id, existing[0].id));
    } else {
      await db5.insert(performanceAuditada).values(values);
    }
    return { ok: true };
  }),
  /** Congela os dados auditados de um mês — impede sobrescrita automática */
  congelarAuditoria: protectedProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(performanceAuditada).set({ congelado: true, dataCongelamento: /* @__PURE__ */ new Date() }).where(and11(eq14(performanceAuditada.mes, input.mes), eq14(performanceAuditada.ano, input.ano)));
    deleteCache(`mes_${input.mes}_${input.ano}`);
    deleteCache(`os_raw_${input.mes}_${input.ano}`);
    deleteCache(`orc_raw_${input.mes}_${input.ano}`);
    return { ok: true };
  }),
  /** Descongela (recalibragem) — permite que o sistema busque dados frescos da API */
  descongelarAuditoria: protectedProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(performanceAuditada).set({ congelado: false, dataCongelamento: null }).where(and11(eq14(performanceAuditada.mes, input.mes), eq14(performanceAuditada.ano, input.ano)));
    deleteCache(`mes_${input.mes}_${input.ano}`);
    deleteCache(`os_raw_${input.mes}_${input.ano}`);
    deleteCache(`orc_raw_${input.mes}_${input.ano}`);
    return { ok: true };
  }),
  /** Diagnóstico: retorna dados brutos da API MubiSys para auditoria cruzada com Excel */
  diagnosticoApi: protectedProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    const { mes, ano } = input;
    const pad = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(ano, mes, 0).getDate();
    const datainicial = `${ano}-${pad(mes)}-01`;
    const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;
    const [osResult, orcResult] = await Promise.all([
      listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
      listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal })
    ]);
    const allOs = osResult.itens;
    const allOrc = orcResult.itens;
    const osCampos = allOs.length > 0 ? Object.keys(allOs[0]) : [];
    const orcCampos = allOrc.length > 0 ? Object.keys(allOrc[0]) : [];
    const osPorStatus = {};
    for (const o of allOs) {
      const s = String(o.status ?? o.situacao ?? "N/A");
      osPorStatus[s] = (osPorStatus[s] ?? 0) + 1;
    }
    const osPorTipo = {};
    for (const o of allOs) {
      const t2 = String(o.tipo ?? o.tipo_os ?? "N/A");
      osPorTipo[t2] = (osPorTipo[t2] ?? 0) + 1;
    }
    const campoValorOs = osCampos.find((c) => ["valor_total", "total", "valor", "vl_total"].includes(c));
    const valorTotalOs = allOs.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOs ?? ""] ?? 0)) || 0), 0);
    const campoValorOrc = orcCampos.find((c) => ["valor_total", "total", "valor", "vl_total"].includes(c));
    const valorTotalOrc = allOrc.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOrc ?? ""] ?? 0)) || 0), 0);
    const TIPOS_EXCLUIDOS = ["retrabalho", "amostra", "cortesia"];
    const osNormais = allOs.filter(
      (o) => !TIPOS_EXCLUIDOS.includes((o.tipo || "").toLowerCase()) && (o.status || "").toLowerCase() !== "cancelada"
    );
    const valorFaturamento = osNormais.reduce((acc, o) => acc + (parseFloat(String(o[campoValorOs ?? ""] ?? 0)) || 0), 0);
    const osPorVendedor = {};
    for (const o of osNormais) {
      const v = String(o.vendedor ?? o.nome_vendedor ?? "Sem Vendedor");
      osPorVendedor[v] = (osPorVendedor[v] ?? 0) + 1;
    }
    return {
      periodo: { datainicial, datafinal },
      os: {
        totalBruto: allOs.length,
        totalNormais: osNormais.length,
        porStatus: osPorStatus,
        porTipo: osPorTipo,
        porVendedor: osPorVendedor,
        campos: osCampos,
        campoValor: campoValorOs,
        valorTotal: valorTotalOs,
        faturamento: valorFaturamento,
        exemplos: allOs.slice(0, 3)
      },
      orcamentos: {
        total: allOrc.length,
        campos: orcCampos,
        campoValor: campoValorOrc,
        valorTotal: valorTotalOrc,
        exemplos: allOrc.slice(0, 3)
      },
      taxaConversao: allOrc.length > 0 ? osNormais.length / allOrc.length * 100 : 0
    };
  }),
  // Auditoria de múltiplos meses — usa mesma lógica validada do getMes
  auditarMeses: protectedProcedure.input(z15.object({
    meses: z15.array(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) }))
  })).query(async ({ input }) => {
    const resultados = [];
    for (const { mes, ano } of input.meses) {
      try {
        const timeoutPromise = new Promise(
          (_, reject) => setTimeout(() => reject(new Error("timeout_50s")), 5e4)
        );
        const raw = await Promise.race([
          getMesFromApi(mes, ano),
          timeoutPromise
        ]);
        if (!raw) {
          resultados.push({ mes, ano, erro: "sem_dados" });
          continue;
        }
        const metrics = calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
        resultados.push({
          mes,
          ano,
          osGeradas: metrics.osGeradas,
          cotacoes: metrics.cotacoes,
          faturamento: metrics.faturamento,
          valorOrcado: metrics.valorOrcado,
          taxaConversao: metrics.taxaConversao,
          taxaFaturamento: metrics.taxaFaturamento,
          ticketMedio: metrics.ticketMedio
        });
      } catch (e) {
        resultados.push({ mes, ano, erro: e?.message ?? "erro_desconhecido" });
      }
    }
    return resultados;
  }),
  // ─── CONGELAMENTO DA INTELIGÊNCIA DE CLIENTES ────────────────────────────────
  /** Congela o cache de inteligência de clientes para um período específico */
  congelarInteligencia: protectedProcedure.input(z15.object({
    periodoKey: z15.string().regex(/^\d{4}-\d{2}_\d{4}-\d{2}$/)
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const rows = await db5.select().from(inteligenciaClientesCache).where(eq14(inteligenciaClientesCache.periodoKey, input.periodoKey)).limit(1);
    if (rows.length === 0) throw new Error('Nenhum dado calculado para este per\xEDodo. Clique em "Atualizar Dados" primeiro.');
    await db5.update(inteligenciaClientesCache).set({ congelado: true, congeladoEm: /* @__PURE__ */ new Date() }).where(eq14(inteligenciaClientesCache.periodoKey, input.periodoKey));
    return { ok: true };
  }),
  /** Descongela o cache de inteligência de clientes para um período específico */
  descongelarInteligencia: protectedProcedure.input(z15.object({
    periodoKey: z15.string().regex(/^\d{4}-\d{2}_\d{4}-\d{2}$/)
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.update(inteligenciaClientesCache).set({ congelado: false, congeladoEm: null }).where(eq14(inteligenciaClientesCache.periodoKey, input.periodoKey));
    return { ok: true };
  }),
  /** Retorna o mapa de clientes contatados para um mês/ano */
  getContatados: publicProcedure.input(z15.object({ mes: z15.number().min(1).max(12), ano: z15.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return {};
    const rows = await db5.select().from(clienteNovosContato).where(and11(eq14(clienteNovosContato.mes, input.mes), eq14(clienteNovosContato.ano, input.ano)));
    const mapa = {};
    for (const r of rows) {
      mapa[r.empresa.toLowerCase().trim()] = { contatado: r.contatado, dataContato: r.dataContato };
    }
    return mapa;
  }),
  /** Marca ou desmarca um cliente como contatado */
  setContatado: protectedProcedure.input(z15.object({
    empresa: z15.string().min(1),
    mes: z15.number().min(1).max(12),
    ano: z15.number().min(2020),
    contatado: z15.boolean()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const key = input.empresa.toLowerCase().trim();
    const existing = await db5.select().from(clienteNovosContato).where(and11(
      eq14(clienteNovosContato.empresa, key),
      eq14(clienteNovosContato.mes, input.mes),
      eq14(clienteNovosContato.ano, input.ano)
    )).limit(1);
    if (existing.length > 0) {
      await db5.update(clienteNovosContato).set({ contatado: input.contatado, dataContato: input.contatado ? /* @__PURE__ */ new Date() : null }).where(and11(
        eq14(clienteNovosContato.empresa, key),
        eq14(clienteNovosContato.mes, input.mes),
        eq14(clienteNovosContato.ano, input.ano)
      ));
    } else {
      await db5.insert(clienteNovosContato).values({
        empresa: key,
        mes: input.mes,
        ano: input.ano,
        contatado: input.contatado,
        dataContato: input.contatado ? /* @__PURE__ */ new Date() : null
      });
    }
    return { ok: true };
  })
});

// server/routers/insightsComerciais.ts
import { z as z16 } from "zod";
init_db();
init_schema();
init_llm();
import { eq as eq15, and as and12 } from "drizzle-orm";
var MESES_NOMES = ["", "Janeiro", "Fevereiro", "Mar\xE7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function fmtR2(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function mesAnterior(mes, ano) {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}
async function coletarDados(db5, mes, ano) {
  const osRows = await db5.select().from(historicoOs).where(and12(eq15(historicoOs.mes, mes), eq15(historicoOs.ano, ano)));
  const orcRows = await db5.select().from(historicoOrcamentos).where(and12(eq15(historicoOrcamentos.mes, mes), eq15(historicoOrcamentos.ano, ano)));
  const osNormais = osRows.filter(isOsNormalDb);
  let faturamento2 = 0, custo = 0, resultado = 0;
  const porVendedor = {};
  const faturamentoPorCliente = {};
  for (const os of osNormais) {
    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const c = parseFloat(String(os.custosTotal ?? "0")) || 0;
    const r = parseFloat(String(os.resultadoReais ?? "0")) || 0;
    faturamento2 += valor;
    custo += c;
    resultado += r;
    const vendedor = os.vendedor || "Sem Vendedor";
    if (!porVendedor[vendedor]) porVendedor[vendedor] = { total: 0, faturamento: 0 };
    porVendedor[vendedor].total++;
    porVendedor[vendedor].faturamento += valor;
    const empresa = (os.empresa ?? "").trim();
    if (empresa) faturamentoPorCliente[empresa] = (faturamentoPorCliente[empresa] ?? 0) + valor;
  }
  let valorOrcado = 0;
  for (const orc of orcRows) valorOrcado += parseFloat(String(orc.total ?? "0")) || 0;
  const margemPct = faturamento2 > 0 ? resultado / faturamento2 * 100 : 0;
  const ticketMedio = osNormais.length > 0 ? faturamento2 / osNormais.length : 0;
  const taxaConversao = orcRows.length > 0 ? osNormais.length / orcRows.length * 100 : 0;
  const taxaFaturamento = valorOrcado > 0 ? faturamento2 / valorOrcado * 100 : 0;
  const todasCompras = await buscarTodasComprasValidas(db5);
  const ultimaMap = ultimaCompraAntesDe(todasCompras, mes, ano);
  const clientesUnicos = /* @__PURE__ */ new Set();
  const clientesNovos = /* @__PURE__ */ new Set();
  for (const os of osNormais) {
    const empresa = (os.empresa ?? "").toLowerCase().trim();
    if (!empresa) continue;
    clientesUnicos.add(empresa);
    if (isClienteNovoPorRecencia(ultimaMap.get(empresa), mes, ano)) clientesNovos.add(empresa);
  }
  const topClientes = Object.entries(faturamentoPorCliente).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cliente, valor]) => ({ cliente, valor }));
  const topVendedores = Object.entries(porVendedor).sort((a, b) => b[1].faturamento - a[1].faturamento).map(([vendedor, v]) => ({ vendedor, ...v }));
  const dreRows = await db5.select().from(dreMensal).where(and12(eq15(dreMensal.ano, ano), eq15(dreMensal.mes, mes))).limit(1);
  const dre = dreRows[0] ?? null;
  const finRows = await db5.select().from(financeiroMensal).where(and12(eq15(financeiroMensal.mes, mes), eq15(financeiroMensal.ano, ano))).limit(1);
  const fin = finRows[0] ?? null;
  return {
    comercial: {
      totalOs: osNormais.length,
      faturamento: faturamento2,
      custo,
      resultado,
      margemPct,
      ticketMedio,
      totalOrcamentos: orcRows.length,
      valorOrcado,
      taxaConversao,
      taxaFaturamento,
      clientesUnicos: clientesUnicos.size,
      clientesNovos: clientesNovos.size,
      topClientes,
      topVendedores
    },
    dre,
    fin
  };
}
function montarPrompt(mes, ano, atual, anterior, perguntaExtra) {
  const c = atual.comercial;
  const cAnt = anterior.comercial;
  const varFat = cAnt.faturamento > 0 ? (c.faturamento - cAnt.faturamento) / cAnt.faturamento * 100 : null;
  const { mes: mesAnt, ano: anoAnt } = mesAnterior(mes, ano);
  return `Voc\xEA \xE9 um consultor comercial e financeiro s\xEAnior da Radrasis (Letreiros Express), uma ind\xFAstria de comunica\xE7\xE3o visual (letreiros, placas, pain\xE9is de LED) no Brasil.

Analise os dados reais de ${MESES_NOMES[mes]}/${ano}, comparados ao m\xEAs anterior, e gere um diagn\xF3stico pr\xE1tico focado em DUAS perguntas: como vender mais, e como lucrar mais.

## DESEMPENHO COMERCIAL \u2014 ${MESES_NOMES[mes]}/${ano}
- OS aprovadas (vendas): ${c.totalOs}
- Faturamento: ${fmtR2(c.faturamento)}${varFat !== null ? ` (${varFat >= 0 ? "+" : ""}${varFat.toFixed(1)}% vs. ${MESES_NOMES[mesAnt]}/${anoAnt})` : ""}
- Custo total: ${fmtR2(c.custo)}
- Resultado (lucro operacional das OS): ${fmtR2(c.resultado)} (margem de ${c.margemPct.toFixed(1)}%)
- Ticket m\xE9dio: ${fmtR2(c.ticketMedio)}
- Or\xE7amentos emitidos: ${c.totalOrcamentos}, somando ${fmtR2(c.valorOrcado)}
- Taxa de convers\xE3o (or\xE7amento \u2192 venda): ${c.taxaConversao.toFixed(1)}%
- Taxa de faturamento (venda / or\xE7ado): ${c.taxaFaturamento.toFixed(1)}%
- Clientes \xFAnicos atendidos: ${c.clientesUnicos} (${c.clientesNovos} novos ou reativados ap\xF3s 6+ meses de inatividade)

### Top 5 Clientes por Faturamento
${c.topClientes.length > 0 ? c.topClientes.map((t2, i) => `${i + 1}. ${t2.cliente} \u2014 ${fmtR2(t2.valor)}`).join("\n") : "(sem dados)"}

### Faturamento por Vendedor
${c.topVendedores.length > 0 ? c.topVendedores.map((v) => `- ${v.vendedor}: ${v.total} OS, ${fmtR2(v.faturamento)}`).join("\n") : "(sem dados)"}

## M\xCAS ANTERIOR (${MESES_NOMES[mesAnt]}/${anoAnt}) \u2014 PARA COMPARA\xC7\xC3O
- Faturamento: ${fmtR2(cAnt.faturamento)}
- Resultado: ${fmtR2(cAnt.resultado)} (margem de ${cAnt.margemPct.toFixed(1)}%)
- Taxa de convers\xE3o: ${cAnt.taxaConversao.toFixed(1)}%
- Clientes \xFAnicos: ${cAnt.clientesUnicos} (${cAnt.clientesNovos} novos/reativados)

## DADOS FINANCEIROS DO M\xCAS
${atual.dre ? `- Receita Operacional Bruta (DRE): ${fmtR2(Number(atual.dre.receitaOperacionalBruta || 0))}
- Despesas Fixas: ${fmtR2(Number(atual.dre.despesasFixas || 0))}
- Despesas com Pessoal: ${fmtR2(Number(atual.dre.despesasPessoal || 0))}
- Lucro L\xEDquido (DRE): ${fmtR2(Number(atual.dre.lucroLiquido || 0))}` : "- DRE n\xE3o dispon\xEDvel para este m\xEAs."}
${atual.fin ? `- Resultado Efetivo: ${fmtR2(Number(atual.fin.resultadoEfetivo || 0))}
- Saldo do M\xEAs (caixa): ${fmtR2(Number(atual.fin.saldoMes || 0))}` : "- Financeiro mensal n\xE3o dispon\xEDvel para este m\xEAs."}

## INSTRU\xC7\xD5ES

${perguntaExtra ? `O gestor fez a seguinte pergunta espec\xEDfica sobre este m\xEAs: "${perguntaExtra}"

Responda essa pergunta primeiro, com base nos dados acima, e depois complemente com o que achar relevante.` : `Produza uma an\xE1lise estruturada em t\xF3picos:

1. **Diagn\xF3stico R\xE1pido**: 2-3 frases sobre o resultado do m\xEAs (vendas e lucro), comparado ao anterior.
2. **Oportunidades de Aumentar Vendas**: com base na taxa de convers\xE3o, ticket m\xE9dio, clientes novos/reativados e concentra\xE7\xE3o nos top clientes/vendedores, aponte 2-4 oportunidades concretas (ex: vendedor com baixa convers\xE3o, cliente grande que sumiu, ticket m\xE9dio caindo).
3. **Oportunidades de Aumentar o Lucro**: com base na margem, custo e despesas fixas, aponte 2-4 oportunidades concretas (ex: margem menor que o m\xEAs anterior, custo fixo desproporcional ao faturamento).
4. **Riscos**: concentra\xE7\xE3o de receita em poucos clientes, queda de convers\xE3o, etc.
5. **Plano de A\xE7\xE3o \u2014 Pr\xF3ximos 30 dias**: 3-5 a\xE7\xF5es priorizadas e espec\xEDficas, cada uma ligada a um n\xFAmero dos dados acima.

Seja direto e espec\xEDfico com os n\xFAmeros fornecidos. N\xE3o invente dados que n\xE3o est\xE3o aqui.`}

Use linguagem profissional mas direta. Formate com Markdown (negrito, listas).`;
}
var insightsComerciaisRouter = router({
  // Diagnóstico completo do mês: vendas + lucro
  gerarDiagnostico: protectedProcedure.input(z16.object({ mes: z16.number().min(1).max(12), ano: z16.number().min(2020) })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const { mes: mesAnt, ano: anoAnt } = mesAnterior(input.mes, input.ano);
    const [atual, anterior] = await Promise.all([
      coletarDados(db5, input.mes, input.ano),
      coletarDados(db5, mesAnt, anoAnt)
    ]);
    const prompt = montarPrompt(input.mes, input.ano, atual, anterior);
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Voc\xEA \xE9 um consultor comercial e financeiro especializado em pequenas e m\xE9dias ind\xFAstrias brasileiras. Responda sempre em portugu\xEAs brasileiro, com foco em a\xE7\xF5es pr\xE1ticas para vender mais e lucrar mais." },
        { role: "user", content: prompt }
      ]
    });
    const rawContent = response.choices?.[0]?.message?.content;
    const analise = typeof rawContent === "string" ? rawContent : "N\xE3o foi poss\xEDvel gerar a an\xE1lise.";
    return { analise, resumo: atual.comercial };
  }),
  // Pergunta livre com o mesmo contexto de dados do mês
  perguntar: protectedProcedure.input(z16.object({ mes: z16.number().min(1).max(12), ano: z16.number().min(2020), pergunta: z16.string().min(3) })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const { mes: mesAnt, ano: anoAnt } = mesAnterior(input.mes, input.ano);
    const [atual, anterior] = await Promise.all([
      coletarDados(db5, input.mes, input.ano),
      coletarDados(db5, mesAnt, anoAnt)
    ]);
    const prompt = montarPrompt(input.mes, input.ano, atual, anterior, input.pergunta);
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Voc\xEA \xE9 um consultor comercial e financeiro especializado em pequenas e m\xE9dias ind\xFAstrias brasileiras. Responda sempre em portugu\xEAs brasileiro, com foco em a\xE7\xF5es pr\xE1ticas para vender mais e lucrar mais." },
        { role: "user", content: prompt }
      ]
    });
    const rawContent = response.choices?.[0]?.message?.content;
    const resposta = typeof rawContent === "string" ? rawContent : "N\xE3o foi poss\xEDvel gerar a resposta.";
    return { resposta };
  })
});

// server/routers/analiseGeografica.ts
init_env();
init_db();
init_mubisys_client();
init_schema();
import { z as z17 } from "zod";
import { eq as eq16, and as and13, ne } from "drizzle-orm";
function osValidaCondition() {
  return ne(historicoOs.status, "Cancelada");
}
function osValidaMubisys(os) {
  return String(os.status ?? "").toLowerCase() !== "cancelada";
}
function tituloCidade(s) {
  return s.toLowerCase().split(" ").map((w) => w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)).join(" ");
}
var UFS_VALIDAS = /* @__PURE__ */ new Set([
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO"
]);
function normalizarUf(uf) {
  if (!uf) return null;
  const s = String(uf).trim().toUpperCase();
  return UFS_VALIDAS.has(s) ? s : null;
}
function extrairClienteOs(os) {
  const raw = os.cliente;
  if (typeof raw === "object" && raw !== null) {
    return String(raw?.nome ?? raw?.razao_social ?? "").trim();
  }
  return String(raw ?? "").trim();
}
function extrairEnderecoOs(os) {
  const enderecos = Array.isArray(os.cliente_endereco) ? os.cliente_endereco : os.cliente_endereco ? [os.cliente_endereco] : [];
  const primeiro = enderecos[0];
  const cidade = primeiro?.cidade ? String(primeiro.cidade).trim() : null;
  const estado = primeiro?.estado || primeiro?.uf ? String(primeiro.estado || primeiro.uf).trim() : null;
  return { cidade, estado };
}
function normalizarOsMubisys(os) {
  const endereco = extrairEnderecoOs(os);
  return {
    estado: endereco.estado,
    cidade: endereco.cidade,
    empresa: extrairClienteOs(os),
    valorTotal: parseFloat(String(os.valor_total ?? "0")) || 0
  };
}
function isMesAtual2(mes, ano) {
  const now = /* @__PURE__ */ new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}
async function lerCacheOsBrutas(db5, cacheKey) {
  const rows = await db5.select().from(mubisysApiCache).where(eq16(mubisysApiCache.cacheKey, cacheKey)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (/* @__PURE__ */ new Date() > new Date(row.expiresAt) || !row.osData) return null;
  try {
    return JSON.parse(row.osData);
  } catch {
    return null;
  }
}
var TTL_MES_ATUAL_MS = 60 * 60 * 1e3;
var TTL_MES_FECHADO_MS = 30 * 24 * 60 * 60 * 1e3;
async function buscarOsBrutasDoMes(db5, mes, ano) {
  const compartilhado = await lerCacheOsBrutas(db5, `raw_${mes}_${ano}`);
  if (compartilhado) return { itens: compartilhado, completo: true, viaApi: false };
  const cacheKeyProprio = `geo_raw_${mes}_${ano}`;
  const proprio = await lerCacheOsBrutas(db5, cacheKeyProprio);
  if (proprio) return { itens: proprio, completo: true, viaApi: false };
  const pad = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad(mes)}-01`;
  const datafinal = `${ano}-${pad(mes)}-${pad(lastDay)}`;
  const resultado = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });
  if (resultado.completo) {
    const now = /* @__PURE__ */ new Date();
    const ttlMs = isMesAtual2(mes, ano) ? TTL_MES_ATUAL_MS : TTL_MES_FECHADO_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await db5.select({ id: mubisysApiCache.id }).from(mubisysApiCache).where(eq16(mubisysApiCache.cacheKey, cacheKeyProprio)).limit(1);
    const payload = { osData: JSON.stringify(resultado.itens), fetchedAt: now, expiresAt };
    if (existing.length > 0) {
      await db5.update(mubisysApiCache).set(payload).where(eq16(mubisysApiCache.cacheKey, cacheKeyProprio));
    } else {
      await db5.insert(mubisysApiCache).values({ cacheKey: cacheKeyProprio, mes, ano, ...payload });
    }
  }
  return { ...resultado, viaApi: true };
}
async function linhasDoMesLocal(db5, mes, ano) {
  const rows = await db5.select({
    estado: historicoOs.estado,
    cidade: historicoOs.cidade,
    empresa: historicoOs.empresa,
    valorTotal: historicoOs.valorTotal
  }).from(historicoOs).where(and13(eq16(historicoOs.mes, mes), eq16(historicoOs.ano, ano), osValidaCondition()));
  return rows.map((r) => ({ estado: r.estado, cidade: r.cidade, empresa: r.empresa ?? "", valorTotal: Number(r.valorTotal ?? 0) }));
}
async function linhasDoMes(db5, mes, ano) {
  if (ENV.MUBISYS_PUBLIC_KEY && ENV.MUBISYS_ACCESS_TOKEN) {
    try {
      const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 55e3));
      const resultado = await Promise.race([buscarOsBrutasDoMes(db5, mes, ano), timeoutPromise]);
      if (resultado) {
        return { linhas: resultado.itens.filter(osValidaMubisys).map(normalizarOsMubisys), viaApi: true };
      }
    } catch {
    }
  }
  return { linhas: await linhasDoMesLocal(db5, mes, ano), viaApi: false };
}
async function linhasDoAno(db5, ano) {
  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const CONCURRENCY = 2;
  let todas = [];
  const mesesFallback = [];
  for (let i = 0; i < meses.length; i += CONCURRENCY) {
    const batch = meses.slice(i, i + CONCURRENCY);
    const resultados = await Promise.all(batch.map((mes) => linhasDoMes(db5, mes, ano)));
    batch.forEach((mes, idx) => {
      todas = todas.concat(resultados[idx].linhas);
      if (!resultados[idx].viaApi) mesesFallback.push(mes);
    });
  }
  return { linhas: todas, mesesFallback };
}
function agregarPorEstado(linhas) {
  const porEstado = /* @__PURE__ */ new Map();
  let totalOs = 0;
  let totalFaturamento = 0;
  let semEstado = 0;
  let semEstadoFaturamento = 0;
  for (const r of linhas) {
    const valor = r.valorTotal;
    totalOs++;
    totalFaturamento += valor;
    const estado = normalizarUf(r.estado);
    if (!estado) {
      semEstado++;
      semEstadoFaturamento += valor;
      continue;
    }
    if (!porEstado.has(estado)) {
      porEstado.set(estado, { qtdOs: 0, faturamento: 0, clientes: /* @__PURE__ */ new Set(), cidades: /* @__PURE__ */ new Map() });
    }
    const e = porEstado.get(estado);
    e.qtdOs++;
    e.faturamento += valor;
    e.clientes.add((r.empresa ?? "").trim().toUpperCase());
    const cidadeNome = r.cidade ? tituloCidade(r.cidade.trim()) : "\u2014";
    if (!e.cidades.has(cidadeNome)) e.cidades.set(cidadeNome, { qtdOs: 0, faturamento: 0 });
    const c = e.cidades.get(cidadeNome);
    c.qtdOs++;
    c.faturamento += valor;
  }
  const estados = Array.from(porEstado.entries()).map(([estado, d]) => ({
    estado,
    qtdOs: d.qtdOs,
    pctOs: totalOs > 0 ? d.qtdOs / totalOs * 100 : 0,
    faturamento: d.faturamento,
    pctFaturamento: totalFaturamento > 0 ? d.faturamento / totalFaturamento * 100 : 0,
    qtdClientes: d.clientes.size,
    ticketMedio: d.qtdOs > 0 ? d.faturamento / d.qtdOs : 0,
    topCidades: Array.from(d.cidades.entries()).map(([cidade, cd]) => ({ cidade, qtdOs: cd.qtdOs, faturamento: cd.faturamento })).sort((a, b) => b.faturamento - a.faturamento).slice(0, 5)
  })).sort((a, b) => b.faturamento - a.faturamento);
  return { estados, totalOs, totalFaturamento, semEstado, semEstadoFaturamento };
}
var analiseGeograficaRouter = router({
  getAnosDisponiveis: publicProcedure.query(async () => {
    const anoAtual = (/* @__PURE__ */ new Date()).getFullYear();
    const db5 = await getDb3();
    if (!db5) return [anoAtual, anoAtual - 1, anoAtual - 2];
    const rows = await db5.selectDistinct({ ano: historicoOs.ano }).from(historicoOs);
    const anos = new Set(rows.map((r) => r.ano));
    anos.add(anoAtual);
    anos.add(anoAtual - 1);
    return Array.from(anos).sort((a, b) => b - a);
  }),
  getPorEstado: publicProcedure.input(z17.object({
    ano: z17.number(),
    // null/undefined = ano inteiro
    mes: z17.number().min(1).max(12).nullable().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { estados: [], totalOs: 0, totalFaturamento: 0, semEstado: 0, semEstadoFaturamento: 0, mesesFallback: [] };
    let linhas;
    let mesesFallback;
    if (input.mes) {
      const resultado = await linhasDoMes(db5, input.mes, input.ano);
      linhas = resultado.linhas;
      mesesFallback = resultado.viaApi ? [] : [input.mes];
    } else {
      const resultado = await linhasDoAno(db5, input.ano);
      linhas = resultado.linhas;
      mesesFallback = resultado.mesesFallback;
    }
    return { ...agregarPorEstado(linhas), mesesFallback };
  }),
  getEvolucaoMensal: publicProcedure.input(z17.object({ ano: z17.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { meses: [], topEstados: [] };
    const meses = Array.from({ length: 12 }, (_, i) => i + 1);
    const CONCURRENCY = 2;
    const porMesLinhas = new Array(12);
    for (let i = 0; i < meses.length; i += CONCURRENCY) {
      const batch = meses.slice(i, i + CONCURRENCY);
      const resultados = await Promise.all(batch.map((mes) => linhasDoMes(db5, mes, input.ano)));
      batch.forEach((mes, idx) => {
        porMesLinhas[mes - 1] = resultados[idx].linhas;
      });
    }
    const totalPorEstado = /* @__PURE__ */ new Map();
    for (const linhas of porMesLinhas) {
      for (const r of linhas) {
        const estado = normalizarUf(r.estado);
        if (!estado) continue;
        totalPorEstado.set(estado, (totalPorEstado.get(estado) ?? 0) + r.valorTotal);
      }
    }
    const topEstados = Array.from(totalPorEstado.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([uf]) => uf);
    const topSet = new Set(topEstados);
    const mesesResult = meses.map((mes) => {
      const valores = { outros: 0 };
      for (const r of porMesLinhas[mes - 1]) {
        const estado = normalizarUf(r.estado);
        const key = estado && topSet.has(estado) ? estado : "outros";
        valores[key] = (valores[key] ?? 0) + r.valorTotal;
      }
      return { mes, ...valores };
    });
    return { meses: mesesResult, topEstados };
  }),
  /** Lista de clientes por Estado, no período selecionado — usada para
   * exportação em Excel na Análise Geográfica. Se `estado` for informado,
   * retorna só os clientes daquele Estado (ex.: MS, SP, PR). */
  getListaClientes: publicProcedure.input(z17.object({
    ano: z17.number(),
    mes: z17.number().min(1).max(12).nullable().optional(),
    estado: z17.string().length(2).nullable().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const linhas = input.mes ? (await linhasDoMes(db5, input.mes, input.ano)).linhas : (await linhasDoAno(db5, input.ano)).linhas;
    const porCliente = /* @__PURE__ */ new Map();
    for (const r of linhas) {
      const estado = normalizarUf(r.estado);
      if (!estado) continue;
      if (input.estado && estado !== input.estado) continue;
      const empresaNorm = (r.empresa ?? "").trim().toUpperCase();
      if (!empresaNorm) continue;
      const key = `${estado}__${empresaNorm}`;
      if (!porCliente.has(key)) {
        porCliente.set(key, {
          estado,
          empresa: (r.empresa ?? "").trim(),
          cidade: r.cidade ? tituloCidade(r.cidade.trim()) : "\u2014",
          qtdOs: 0,
          faturamento: 0
        });
      }
      const c = porCliente.get(key);
      c.qtdOs++;
      c.faturamento += r.valorTotal;
    }
    return Array.from(porCliente.values()).sort((a, b) => {
      if (a.estado !== b.estado) return a.estado.localeCompare(b.estado);
      return b.faturamento - a.faturamento;
    });
  })
});

// server/routers/metricas.ts
init_db();
init_schema();
import { z as z18 } from "zod";
import { and as and14, desc as desc8, eq as eq17, gte as gte5, lte as lte4 } from "drizzle-orm";
var metricasRouter = router({
  list: publicProcedure.input(z18.object({
    nome: z18.string().optional(),
    dataInicio: z18.string().optional(),
    // AAAA-MM-DD
    dataFim: z18.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [];
    if (input?.nome) conditions.push(eq17(metricas.nome, input.nome));
    if (input?.dataInicio) conditions.push(gte5(metricas.dataApuracao, input.dataInicio));
    if (input?.dataFim) conditions.push(lte4(metricas.dataApuracao, input.dataFim));
    return db5.select().from(metricas).where(conditions.length ? and14(...conditions) : void 0).orderBy(desc8(metricas.dataApuracao), desc8(metricas.id));
  }),
  nomesDistintos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.selectDistinct({ nome: metricas.nome }).from(metricas);
    return rows.map((r) => r.nome).sort((a, b) => a.localeCompare(b));
  }),
  create: protectedProcedure.input(z18.object({
    nome: z18.string().min(1, "Informe o nome do indicador"),
    valor: z18.number(),
    unidade: z18.string().max(16).default("%"),
    dataApuracao: z18.string(),
    // AAAA-MM-DD
    observacao: z18.string().optional().nullable()
  })).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("Banco de dados indispon\xEDvel");
    const [row] = await db5.insert(metricas).values({
      nome: input.nome.trim(),
      valor: String(input.valor),
      unidade: input.unidade,
      dataApuracao: input.dataApuracao,
      observacao: input.observacao ?? null,
      criadoPorNome: ctx.user?.name ?? ctx.user?.email ?? "sistema"
    }).returning();
    return row;
  }),
  update: protectedProcedure.input(z18.object({
    id: z18.number(),
    nome: z18.string().min(1).optional(),
    valor: z18.number().optional(),
    unidade: z18.string().max(16).optional(),
    dataApuracao: z18.string().optional(),
    observacao: z18.string().optional().nullable()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("Banco de dados indispon\xEDvel");
    const { id, valor, ...rest } = input;
    const [row] = await db5.update(metricas).set({
      ...rest,
      ...valor !== void 0 ? { valor: String(valor) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq17(metricas.id, id)).returning();
    return row;
  }),
  delete: protectedProcedure.input(z18.object({ id: z18.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("Banco de dados indispon\xEDvel");
    await db5.delete(metricas).where(eq17(metricas.id, input.id));
    return { success: true };
  })
});

// server/routers/crm.ts
import { z as z19 } from "zod";
import { TRPCError as TRPCError3 } from "@trpc/server";
init_llm();
init_db();
init_schema();
init_mubisys_client();
import { eq as eq18, and as and15, desc as desc9, sql as sql9 } from "drizzle-orm";
function calcTurno(date2) {
  const h = date2.getHours();
  const hBrasilia = (h - 3 + 24) % 24;
  if (hBrasilia >= 6 && hBrasilia < 12) return "manha";
  if (hBrasilia >= 12 && hBrasilia < 18) return "tarde";
  return "noite";
}
async function logAtividade(ctx, opts) {
  try {
    const db5 = await getDb3();
    const agora = /* @__PURE__ */ new Date();
    await db5.insert(crmAtividadeLog).values({
      vendedor: opts.vendedor,
      localUserId: ctx.user?.id ?? null,
      acao: opts.acao,
      orcamentoId: opts.orcamentoId ?? null,
      empresa: opts.empresa ?? null,
      detalhe: opts.detalhe ?? null,
      realizadaEm: agora,
      turno: calcTurno(agora)
    });
  } catch {
  }
}
function parseDate(str) {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}
function diasDesde(str) {
  const d = parseDate(str);
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1e3 * 60 * 60 * 24));
}
function janelaSugerida(diasCriado) {
  if (diasCriado <= 3) return "urgente";
  if (diasCriado <= 7) return "atencao";
  if (diasCriado <= 15) return "risco";
  if (diasCriado <= 30) return "critico";
  return "perdido";
}
var MOTIVACIONAL_PROMPTS = [
  "Gere uma mensagem motivacional curta (m\xE1ximo 2 frases) para um vendedor de uma empresa de letreiros e comunica\xE7\xE3o visual. Mencione que ontem ele fez {propostas} propostas e que h\xE1 {pendentes} propostas esperando follow-up. Use tom animado, direto e encorajador. Foque em transformar o m\xEAs em resultado.",
  "Crie uma mensagem de incentivo curta (m\xE1ximo 2 frases) para um vendedor. Ele fez {propostas} propostas ontem. Tem {pendentes} oportunidades abertas esperando contato. Use met\xE1fora de conquista ou desafio. Tom: energ\xE9tico e positivo.",
  "Escreva uma mensagem motivacional r\xE1pida (m\xE1ximo 2 frases) para um vendedor de comunica\xE7\xE3o visual. Ontem: {propostas} propostas enviadas. Agora: {pendentes} clientes aguardando seu contato. Use linguagem de vendas, foco em resultado.",
  "Crie uma frase de motiva\xE7\xE3o para vendas (m\xE1ximo 2 frases). O vendedor tem {pendentes} propostas abertas e fez {propostas} ontem. Mencione que cada contato pode ser o fechamento que falta para bater a meta.",
  "Gere uma mensagem curta (m\xE1ximo 2 frases) de incentivo para um vendedor. Contexto: {propostas} propostas enviadas ontem, {pendentes} aguardando follow-up. Use tom de desafio e supera\xE7\xE3o."
];
var crmRouter = router({
  // Buscar propostas abertas do vendedor logado (ou de um vendedor específico para diretor)
  getPropostas: protectedProcedure.input(z19.object({
    vendedor: z19.string().optional(),
    // se omitido, usa o nome do usuário logado
    mes: z19.number().min(1).max(12).optional(),
    ano: z19.number().optional(),
    dataInicio: z19.string().optional(),
    // YYYY-MM-DD — filtro manual de datas
    dataFim: z19.string().optional(),
    preset: z19.enum(["hoje", "7dias", "15dias", "mes", "personalizado"]).optional()
  })).query(async ({ ctx, input }) => {
    const now = /* @__PURE__ */ new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    let di;
    let df;
    const preset = input.preset ?? "mes";
    if (preset === "hoje") {
      di = fmtDate(now);
      df = fmtDate(now);
    } else if (preset === "7dias") {
      const d7 = new Date(now);
      d7.setDate(now.getDate() - 7);
      di = fmtDate(d7);
      df = fmtDate(now);
    } else if (preset === "15dias") {
      const d15 = new Date(now);
      d15.setDate(now.getDate() - 15);
      di = fmtDate(d15);
      df = fmtDate(now);
    } else if (preset === "personalizado" && input.dataInicio && input.dataFim) {
      di = input.dataInicio;
      df = input.dataFim;
    } else {
      const mes = input.mes ?? now.getMonth() + 1;
      const ano = input.ano ?? now.getFullYear();
      const lastDay = new Date(ano, mes, 0).getDate();
      di = input.dataInicio ?? `${ano}-${pad(mes)}-01`;
      df = input.dataFim ?? `${ano}-${pad(mes)}-${pad(lastDay)}`;
    }
    const diAberto = fmtDate(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
    const dfAberto = fmtDate(now);
    const { itens: todosAbertos } = await listarOrcamentosMubiSys({ datainicial: diAberto, datafinal: dfAberto });
    const abertos = todosAbertos.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "em aberto" || s === "em andamento" || s === "pendente";
    });
    const { itens: todosPeriodo } = await listarOrcamentosMubiSys({ datainicial: di, datafinal: df });
    const fechados = todosPeriodo.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "aprovado" || s === "faturado" || s === "concluido" || s === "conclu\xEDdo";
    });
    const vendedorFiltro = input.vendedor ?? "";
    const filtrar = (list) => vendedorFiltro ? list.filter((o) => (o.vendedor || "").toLowerCase().includes(vendedorFiltro.toLowerCase())) : list;
    const propostasAbertas = filtrar(abertos);
    const propostasFechadas = filtrar(fechados);
    const idsAbertos = propostasAbertas.map((o) => String(o.id));
    const db5 = await getDb3();
    const contatosDb = idsAbertos.length > 0 ? await db5.select().from(crmContatos).orderBy(desc9(crmContatos.contatadoEm)) : [];
    const contatosPorOrc = {};
    for (const c of contatosDb) {
      if (!contatosPorOrc[c.orcamentoId]) contatosPorOrc[c.orcamentoId] = [];
      contatosPorOrc[c.orcamentoId].push(c);
    }
    const propostas = propostasAbertas.map((o) => {
      const orcId = String(o.id);
      const contatos = contatosPorOrc[orcId] ?? [];
      const diasCriado = diasDesde(o.data_cadastro) ?? 0;
      const primeiroContato = contatos.find((c) => c.numeroContato === 1);
      const segundoContato = contatos.find((c) => c.numeroContato === 2);
      const diasAteContato1 = primeiroContato ? Math.floor((new Date(primeiroContato.contatadoEm).getTime() - new Date(o.data_cadastro).getTime()) / (1e3 * 60 * 60 * 24)) : null;
      const contatosOrc = Array.isArray(o.cliente_contato) ? o.cliente_contato : [];
      const primeiroContatoOrc = contatosOrc[0];
      const nomeContato = primeiroContatoOrc?.nome_contato ?? primeiroContatoOrc?.nome ?? "";
      return {
        id: orcId,
        sequencial: o.sequencial_orcamento,
        nomeContato,
        empresa: o.empresa,
        vendedor: o.vendedor,
        valor: parseFloat(o.valor_total ?? "0"),
        dataCriacao: o.data_cadastro,
        diasAberto: diasCriado,
        janela: janelaSugerida(diasCriado),
        contato1: primeiroContato ? {
          data: primeiroContato.contatadoEm,
          canal: primeiroContato.canal,
          obs: primeiroContato.observacao
        } : null,
        contato2: segundoContato ? {
          data: segundoContato.contatadoEm,
          canal: segundoContato.canal,
          obs: segundoContato.observacao
        } : null,
        qtdContatos: contatos.length,
        contato1NoPrazo: diasAteContato1 !== null ? diasAteContato1 <= 3 : null,
        meta2Contatos: contatos.length >= 2
      };
    });
    const totalFechado = propostasFechadas.reduce((s, o) => s + parseFloat(o.valor_total ?? "0"), 0);
    const qtdFechadas = propostasFechadas.length;
    const ontem = /* @__PURE__ */ new Date();
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = `${ontem.getFullYear()}-${pad(ontem.getMonth() + 1)}-${pad(ontem.getDate())}`;
    const propostasOntem = propostasAbertas.filter(
      (o) => (o.data_cadastro ?? "").startsWith(ontemStr)
    ).length + propostasFechadas.filter(
      (o) => (o.data_aprovacao ?? "").startsWith(ontemStr)
    ).length;
    const pendentesFollowup = propostas.filter((p) => p.qtdContatos < 2).length;
    const telefonesMap = {};
    for (const o of propostasAbertas) {
      const contatos = Array.isArray(o.cliente_contato) ? o.cliente_contato : [];
      const tel = contatos.find((c) => c.celular || c.telefone);
      if (tel) telefonesMap[String(o.id)] = tel.celular || tel.telefone;
    }
    const hoje = /* @__PURE__ */ new Date();
    const hojeStr = `${hoje.getFullYear()}-${pad(hoje.getMonth() + 1)}-${pad(hoje.getDate())}`;
    const contatosHoje = contatosDb.filter((c) => {
      const d = new Date(c.contatadoEm);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === hojeStr;
    }).length;
    const perdidasDb = await db5.select({ orcamentoId: crmContatos.orcamentoId }).from(crmContatos).where(
      vendedorFiltro ? sql9`${crmContatos.vendedor} = ${vendedorFiltro} AND ${crmContatos.canal} = 'perdida'` : sql9`${crmContatos.canal} = 'perdida'`
    );
    const perdidasSet = new Set(perdidasDb.map((p) => p.orcamentoId));
    const propostasFiltradas = propostas.filter((p) => !perdidasSet.has(p.id));
    const clientesComCompra = /* @__PURE__ */ new Set();
    const overrideMap = /* @__PURE__ */ new Map();
    try {
      const osEntregues = await db5.select({ empresa: historicoOs.empresa }).from(historicoOs);
      for (const row of osEntregues) {
        const nome = (row.empresa ?? "").trim();
        if (nome) clientesComCompra.add(nome.toLowerCase());
      }
      const overrides = await db5.select().from(clienteOverrides);
      for (const ov of overrides) {
        overrideMap.set(ov.empresa, ov.status);
      }
    } catch {
    }
    const propostasComTelefone = propostasFiltradas.map((p) => {
      const telefone = telefonesMap[p.id] ?? null;
      const orc = propostasAbertas.find((o) => String(o.id) === p.id);
      const clienteRaw = orc?.cliente;
      const empresaRaw = orc?.empresa;
      const nomeCliente = typeof clienteRaw === "object" && clienteRaw !== null ? clienteRaw?.nome ?? clienteRaw?.razao_social ?? String(clienteRaw) : String(clienteRaw ?? empresaRaw ?? "");
      const clienteKey = (nomeCliente || "").toLowerCase().trim();
      const overrideStatus = overrideMap.get(clienteKey);
      const isNovoByHistory = clientesComCompra.size > 0 && !clientesComCompra.has(clienteKey);
      const clienteNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isNovoByHistory;
      return { ...p, telefone, nomeCliente, nomeContato: p.nomeContato ?? "", clienteNovo };
    });
    return {
      propostas: propostasComTelefone.sort((a, b) => a.qtdContatos - b.qtdContatos || b.diasAberto - a.diasAberto),
      stats: {
        totalAberto: propostasComTelefone.length,
        totalFechado: qtdFechadas,
        valorFechado: totalFechado,
        pendentesFollowup,
        propostasOntem,
        contatosHoje,
        semContato: propostasComTelefone.filter((p) => p.qtdContatos === 0).length,
        com1Contato: propostasComTelefone.filter((p) => p.qtdContatos === 1).length,
        com2Contatos: propostasComTelefone.filter((p) => p.qtdContatos >= 2).length,
        urgente: propostasComTelefone.filter((p) => p.janela === "urgente").length,
        atencao: propostasComTelefone.filter((p) => p.janela === "atencao").length,
        risco: propostasComTelefone.filter((p) => p.janela === "risco").length,
        critico: propostasComTelefone.filter((p) => p.janela === "critico").length
      }
    };
  }),
  // Desfazer contato registrado
  desfazarContato: protectedProcedure.input(z19.object({
    orcamentoId: z19.string(),
    data: z19.string()
    // ISO string da data do contato a remover
  })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const todos = await db5.select().from(crmContatos).where(eq18(crmContatos.orcamentoId, input.orcamentoId)).orderBy(desc9(crmContatos.contatadoEm));
    const dataAlvo = new Date(input.data);
    const alvo = todos.find((c) => {
      const d = new Date(c.contatadoEm);
      return d.getFullYear() === dataAlvo.getFullYear() && d.getMonth() === dataAlvo.getMonth() && d.getDate() === dataAlvo.getDate();
    });
    if (!alvo) throw new TRPCError3({ code: "NOT_FOUND", message: "Contato n\xE3o encontrado para essa data." });
    await db5.delete(crmContatos).where(eq18(crmContatos.id, alvo.id));
    const vendedor = ctx.user?.name ?? "desconhecido";
    await logAtividade(ctx, { vendedor, acao: "desfazarContato", orcamentoId: input.orcamentoId, detalhe: `contato de ${input.data} removido` });
    return { ok: true };
  }),
  // Marcar proposta como ganha
  marcarGanha: protectedProcedure.input(z19.object({ orcamentoId: z19.string(), vendedor: z19.string(), empresa: z19.string() })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmContatos).where(sql9`${crmContatos.orcamentoId} = ${input.orcamentoId} AND ${crmContatos.canal} = 'garantiu_fechamento'`).limit(1);
    if (existing.length === 0) {
      await db5.insert(crmContatos).values({
        orcamentoId: input.orcamentoId,
        vendedor: input.vendedor,
        empresa: input.empresa,
        numeroContato: 99,
        canal: "garantiu_fechamento",
        observacao: "Proposta marcada como ganha"
      });
    }
    await logAtividade(ctx, { vendedor: input.vendedor, acao: "marcarGanha", orcamentoId: input.orcamentoId, empresa: input.empresa });
    return { ok: true };
  }),
  // Marcar proposta como perdida
  marcarPerdida: protectedProcedure.input(z19.object({ orcamentoId: z19.string(), vendedor: z19.string(), empresa: z19.string() })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmContatos).where(sql9`${crmContatos.orcamentoId} = ${input.orcamentoId} AND ${crmContatos.canal} = 'perdida'`).limit(1);
    if (existing.length === 0) {
      await db5.insert(crmContatos).values({
        orcamentoId: input.orcamentoId,
        vendedor: input.vendedor,
        empresa: input.empresa,
        numeroContato: 99,
        canal: "perdida",
        observacao: "Proposta marcada como perdida"
      });
    }
    await logAtividade(ctx, { vendedor: input.vendedor, acao: "descartar", orcamentoId: input.orcamentoId, empresa: input.empresa, detalhe: "proposta marcada como perdida" });
    return { ok: true };
  }),
  // Mensagem motivacional via Gemini
  getMensagemMotivacional: protectedProcedure.input(z19.object({
    propostasOntem: z19.number(),
    pendentesFollowup: z19.number(),
    nomeVendedor: z19.string()
  })).query(async ({ input }) => {
    const promptTemplate = MOTIVACIONAL_PROMPTS[Math.floor(Math.random() * MOTIVACIONAL_PROMPTS.length)];
    const prompt = promptTemplate.replace("{propostas}", String(input.propostasOntem)).replace("{pendentes}", String(input.pendentesFollowup));
    try {
      const resp = await invokeLLM({
        messages: [
          { role: "system", content: `Voc\xEA \xE9 um coach de vendas motivacional. Responda APENAS com a mensagem, sem aspas, sem prefixo. Personalize para ${input.nomeVendedor}.` },
          { role: "user", content: prompt }
        ]
      });
      const msg = resp?.choices?.[0]?.message?.content ?? "";
      return { mensagem: msg.trim() };
    } catch {
      return { mensagem: `${input.nomeVendedor}, voc\xEA tem ${input.pendentesFollowup} propostas esperando seu contato. Cada liga\xE7\xE3o pode ser o fechamento que falta! \u{1F680}` };
    }
  }),
  // Registrar contato
  registrarContato: protectedProcedure.input(z19.object({
    orcamentoId: z19.string(),
    empresa: z19.string(),
    vendedor: z19.string(),
    canal: z19.enum(["nao_retornou", "esperando_cliente", "garantiu_fechamento"]),
    observacao: z19.string().nullable().optional(),
    dataContato: z19.string().optional()
    // ISO string da data clicada
  })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const existentes = await db5.select().from(crmContatos).where(and15(
      eq18(crmContatos.orcamentoId, input.orcamentoId),
      sql9`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`
    ));
    const numeroContato = existentes.length + 1;
    if (numeroContato > 2) {
      throw new TRPCError3({ code: "CONFLICT", message: "M\xE1ximo de 2 contatos j\xE1 registrados para esta proposta." });
    }
    const contatadoEm = input.dataContato ? new Date(input.dataContato) : /* @__PURE__ */ new Date();
    await db5.insert(crmContatos).values({
      orcamentoId: input.orcamentoId,
      vendedor: input.vendedor,
      empresa: input.empresa,
      numeroContato,
      canal: input.canal,
      observacao: input.observacao ?? null,
      contatadoEm
    });
    await logAtividade(ctx, {
      vendedor: input.vendedor,
      acao: "registrarContato",
      orcamentoId: input.orcamentoId,
      empresa: input.empresa,
      detalhe: `canal=${input.canal} contato#${numeroContato}`
    });
    return { ok: true };
  }),
  // Buscar/salvar meta do vendedor
  getMeta: protectedProcedure.input(z19.object({ vendedor: z19.string(), mes: z19.number(), ano: z19.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    const rows = await db5.select().from(crmMetas).where(and15(
      eq18(crmMetas.vendedor, input.vendedor),
      eq18(crmMetas.mes, input.mes),
      eq18(crmMetas.ano, input.ano)
    ));
    return rows[0] ?? null;
  }),
  saveMeta: protectedProcedure.input(z19.object({
    vendedor: z19.string(),
    mes: z19.number(),
    ano: z19.number(),
    metaValor: z19.number(),
    metaQtdOs: z19.number()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and15(
      eq18(crmMetas.vendedor, input.vendedor),
      eq18(crmMetas.mes, input.mes),
      eq18(crmMetas.ano, input.ano)
    ));
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ metaValor: String(input.metaValor), metaQtdOs: input.metaQtdOs }).where(eq18(crmMetas.id, existing[0].id));
    } else {
      await db5.insert(crmMetas).values({
        vendedor: input.vendedor,
        mes: input.mes,
        ano: input.ano,
        metaValor: String(input.metaValor),
        metaQtdOs: input.metaQtdOs
      });
    }
    return { ok: true };
  }),
  // Visão do diretor: todos os vendedores
  getVendedores: protectedProcedure.query(async () => {
    const now = /* @__PURE__ */ new Date();
    const mes = now.getMonth() + 1;
    const ano = now.getFullYear();
    const pad = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(ano, mes, 0).getDate();
    const di = `${ano}-${pad(mes)}-01`;
    const df = `${ano}-${pad(mes)}-${pad(lastDay)}`;
    const diAberto = `${ano - 1}-${pad(mes)}-${pad(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).getDate())}`;
    const dfAberto = df;
    const { itens: todosAbertos } = await listarOrcamentosMubiSys({ datainicial: diAberto, datafinal: dfAberto });
    const abertos = todosAbertos.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "em aberto" || s === "em andamento" || s === "pendente";
    });
    const { itens: todosPeriodo } = await listarOrcamentosMubiSys({ datainicial: di, datafinal: df });
    const fechados = todosPeriodo.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "aprovado" || s === "faturado" || s === "concluido" || s === "conclu\xEDdo";
    });
    const vendedores = {};
    for (const o of abertos) {
      const v = o.vendedor || "Sem Vendedor";
      if (!vendedores[v]) vendedores[v] = { abertos: 0, valorAberto: 0, fechados: 0, valorFechado: 0 };
      vendedores[v].abertos++;
      vendedores[v].valorAberto += parseFloat(o.valor_total ?? "0");
    }
    for (const o of fechados) {
      const v = o.vendedor || "Sem Vendedor";
      if (!vendedores[v]) vendedores[v] = { abertos: 0, valorAberto: 0, fechados: 0, valorFechado: 0 };
      vendedores[v].fechados++;
      vendedores[v].valorFechado += parseFloat(o.valor_total ?? "0");
    }
    const db5 = await getDb3();
    const metas = await db5.select().from(crmMetas).where(and15(eq18(crmMetas.mes, mes), eq18(crmMetas.ano, ano)));
    const metaMap = {};
    for (const m of metas) metaMap[m.vendedor] = m;
    return Object.entries(vendedores).map(([nome, dados]) => ({
      nome,
      ...dados,
      meta: metaMap[nome] ?? null,
      pctMeta: metaMap[nome] ? Math.round(dados.valorFechado / parseFloat(String(metaMap[nome].metaValor)) * 100) : null
    })).sort((a, b) => b.valorFechado - a.valorFechado);
  }),
  // Contatos já registrados de uma proposta
  getContatos: protectedProcedure.input(z19.object({ orcamentoId: z19.string() })).query(async ({ input }) => {
    const db5 = await getDb3();
    return db5.select().from(crmContatos).where(eq18(crmContatos.orcamentoId, input.orcamentoId)).orderBy(crmContatos.numeroContato);
  }),
  // Buscar metas do mês com usuário vinculado
  getMetas: protectedProcedure.input(z19.object({ mes: z19.number().optional(), ano: z19.number().optional() })).query(async ({ input }) => {
    const db5 = await getDb3();
    const now = /* @__PURE__ */ new Date();
    const mes = input.mes ?? now.getMonth() + 1;
    const ano = input.ano ?? now.getFullYear();
    return db5.select().from(crmMetas).where(and15(eq18(crmMetas.mes, mes), eq18(crmMetas.ano, ano))).orderBy(crmMetas.vendedor);
  }),
  // Salvar meta (cria ou atualiza)
  salvarMeta: protectedProcedure.input(z19.object({
    vendedor: z19.string(),
    mes: z19.number(),
    ano: z19.number(),
    metaValor: z19.number().optional(),
    metaQtdOs: z19.number().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and15(eq18(crmMetas.vendedor, input.vendedor), eq18(crmMetas.mes, input.mes), eq18(crmMetas.ano, input.ano))).limit(1);
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ metaValor: String(input.metaValor ?? 0), metaQtdOs: input.metaQtdOs ?? 0 }).where(and15(eq18(crmMetas.vendedor, input.vendedor), eq18(crmMetas.mes, input.mes), eq18(crmMetas.ano, input.ano)));
    } else {
      await db5.insert(crmMetas).values({
        vendedor: input.vendedor,
        mes: input.mes,
        ano: input.ano,
        metaValor: String(input.metaValor ?? 0),
        metaQtdOs: input.metaQtdOs ?? 0
      });
    }
    return { ok: true };
  }),
  // Vincular usuário do sistema a um vendedor
  vincularUsuarioMeta: protectedProcedure.input(z19.object({
    vendedor: z19.string(),
    mes: z19.number(),
    ano: z19.number(),
    usuarioId: z19.string().nullable(),
    usuarioNome: z19.string().nullable()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and15(eq18(crmMetas.vendedor, input.vendedor), eq18(crmMetas.mes, input.mes), eq18(crmMetas.ano, input.ano))).limit(1);
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ usuarioVinculadoId: input.usuarioId, usuarioVinculadoNome: input.usuarioNome }).where(and15(eq18(crmMetas.vendedor, input.vendedor), eq18(crmMetas.mes, input.mes), eq18(crmMetas.ano, input.ano)));
    } else {
      await db5.insert(crmMetas).values({
        vendedor: input.vendedor,
        mes: input.mes,
        ano: input.ano,
        metaValor: "0",
        metaQtdOs: 0,
        usuarioVinculadoId: input.usuarioId,
        usuarioVinculadoNome: input.usuarioNome
      });
    }
    return { ok: true };
  }),
  // Excluir vendedor das metas (remove todos os registros de metas do vendedor)
  excluirVendedorMeta: protectedProcedure.input(z19.object({ vendedor: z19.string(), mes: z19.number(), ano: z19.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.delete(crmMetas).where(and15(eq18(crmMetas.vendedor, input.vendedor), eq18(crmMetas.mes, input.mes), eq18(crmMetas.ano, input.ano)));
    return { ok: true };
  }),
  // ─── Scripts de vendas por faixa ─────────────────────────────────────────────
  listScripts: protectedProcedure.input(z19.object({ faixa: z19.number().min(1).max(20) })).query(async ({ input }) => {
    const db5 = await getDb3();
    return db5.select().from(crmScripts).where(and15(eq18(crmScripts.faixa, input.faixa), eq18(crmScripts.ativo, true))).orderBy(crmScripts.ordem);
  }),
  updateScript: protectedProcedure.input(z19.object({
    id: z19.number(),
    titulo: z19.string().max(128).optional(),
    conteudo: z19.string().min(1),
    conteudo_voz: z19.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.update(crmScripts).set({ titulo: input.titulo, conteudo: input.conteudo, conteudo_voz: input.conteudo_voz ?? null }).where(eq18(crmScripts.id, input.id));
    return { ok: true };
  }),
  addScript: protectedProcedure.input(z19.object({
    faixa: z19.number().min(1).max(20),
    titulo: z19.string().max(128).optional(),
    conteudo: z19.string().min(1),
    conteudo_voz: z19.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select({ ordem: crmScripts.ordem }).from(crmScripts).where(eq18(crmScripts.faixa, input.faixa)).orderBy(desc9(crmScripts.ordem)).limit(1);
    const nextOrdem = (existing[0]?.ordem ?? 0) + 1;
    const [inserted] = await db5.insert(crmScripts).values({
      faixa: input.faixa,
      ordem: nextOrdem,
      titulo: input.titulo,
      conteudo: input.conteudo,
      conteudo_voz: input.conteudo_voz ?? null
    }).returning({ id: crmScripts.id });
    return { ok: true, id: inserted.id };
  }),
  deleteScript: protectedProcedure.input(z19.object({ id: z19.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.update(crmScripts).set({ ativo: false }).where(eq18(crmScripts.id, input.id));
    return { ok: true };
  }),
  incrementCopiaCount: protectedProcedure.input(z19.object({ id: z19.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.execute(sql9`UPDATE crm_scripts SET copia_count = copia_count + 1 WHERE id = ${input.id}`);
    return { ok: true };
  }),
  reorderScripts: protectedProcedure.input(z19.object({
    faixa: z19.number().min(1).max(20),
    orderedIds: z19.array(z19.number())
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await Promise.all(
      input.orderedIds.map(
        (id, index2) => db5.update(crmScripts).set({ ordem: index2 }).where(eq18(crmScripts.id, id))
      )
    );
    return { ok: true };
  }),
  // ─── Etiquetas das Faixas ────────────────────────────────────────────────────
  getFaixaEtiquetas: protectedProcedure.query(async () => {
    const db5 = await getDb3();
    const rows = await db5.select().from(crmFaixaEtiquetas).orderBy(crmFaixaEtiquetas.faixa);
    const defaults = { 1: "Faixa 1 (1-3 du)", 2: "Faixa 2 (4-7 du)", 3: "Faixa 3 (8-15 du)" };
    const result = { ...defaults };
    for (const row of rows) result[row.faixa] = row.label;
    return result;
  }),
  saveFaixaEtiqueta: protectedProcedure.input(z19.object({
    faixa: z19.number().min(1).max(3),
    label: z19.string().min(1).max(128)
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmFaixaEtiquetas).where(eq18(crmFaixaEtiquetas.faixa, input.faixa));
    if (existing.length > 0) {
      await db5.update(crmFaixaEtiquetas).set({ label: input.label }).where(eq18(crmFaixaEtiquetas.faixa, input.faixa));
    } else {
      await db5.insert(crmFaixaEtiquetas).values({ faixa: input.faixa, label: input.label });
    }
    return { ok: true };
  }),
  // ─── AUDITORIA DO CRM ────────────────────────────────────────────────────────
  /**
   * Retorna o painel de auditoria completo para um período (data inicial e final).
   * Inclui os 7 blocos: rotina, volume por faixa, descartes, limbo, velocidade suspeita,
   * ranking e diagnóstico.
   */
  getAuditoria: protectedProcedure.input(z19.object({
    dataInicio: z19.string(),
    // ISO date "YYYY-MM-DD"
    dataFim: z19.string(),
    // ISO date "YYYY-MM-DD"
    vendedor: z19.string().optional()
    // undefined = todos
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    const inicio = /* @__PURE__ */ new Date(input.dataInicio + "T03:00:00.000Z");
    const fim = /* @__PURE__ */ new Date(input.dataFim + "T26:59:59.999Z");
    const logsWhere = input.vendedor ? and15(
      sql9`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
      sql9`${crmAtividadeLog.realizadaEm} <= ${fim}`,
      eq18(crmAtividadeLog.vendedor, input.vendedor)
    ) : and15(
      sql9`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
      sql9`${crmAtividadeLog.realizadaEm} <= ${fim}`
    );
    const logs = await db5.select().from(crmAtividadeLog).where(logsWhere).orderBy(crmAtividadeLog.realizadaEm);
    const contatos = await db5.select().from(crmContatos).where(sql9`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`);
    const dias = [];
    const d = new Date(inicio);
    while (d <= fim) {
      const yyyy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      dias.push(`${yyyy}-${mm}-${dd}`);
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const rotinaPorVendedorDiaTurno = {};
    for (const log of logs) {
      const dt = new Date(log.realizadaEm);
      const hBrasilia = (dt.getUTCHours() - 3 + 24) % 24;
      const dtBrasilia = new Date(dt.getTime() - 3 * 60 * 60 * 1e3);
      const diaStr = `${dtBrasilia.getUTCFullYear()}-${String(dtBrasilia.getUTCMonth() + 1).padStart(2, "0")}-${String(dtBrasilia.getUTCDate()).padStart(2, "0")}`;
      const turno = hBrasilia >= 6 && hBrasilia < 12 ? "manha" : hBrasilia >= 12 && hBrasilia < 18 ? "tarde" : "noite";
      const v = log.vendedor;
      if (!rotinaPorVendedorDiaTurno[v]) rotinaPorVendedorDiaTurno[v] = {};
      if (!rotinaPorVendedorDiaTurno[v][diaStr]) rotinaPorVendedorDiaTurno[v][diaStr] = { manha: false, tarde: false, acoes: 0 };
      if (turno === "manha") rotinaPorVendedorDiaTurno[v][diaStr].manha = true;
      if (turno === "tarde") rotinaPorVendedorDiaTurno[v][diaStr].tarde = true;
      rotinaPorVendedorDiaTurno[v][diaStr].acoes++;
    }
    const vendedores = Array.from(new Set(logs.map((l) => l.vendedor))).sort();
    const blocoA = vendedores.map((v) => {
      let manhasOk = 0, tardesOk = 0;
      const diasDetalhes = {};
      for (const dia of dias) {
        const r = rotinaPorVendedorDiaTurno[v]?.[dia] ?? { manha: false, tarde: false, acoes: 0 };
        diasDetalhes[dia] = r;
        if (r.manha) manhasOk++;
        if (r.tarde) tardesOk++;
      }
      const totalDias = dias.length;
      const aderencia = totalDias > 0 ? Math.round((manhasOk + tardesOk) / (totalDias * 2) * 100) : 0;
      return { vendedor: v, manhasOk, tardesOk, totalDias, aderencia, dias: diasDetalhes };
    });
    const contatosNoPeriodo = await db5.select().from(crmContatos).where(and15(
      sql9`${crmContatos.contatadoEm} >= ${inicio}`,
      sql9`${crmContatos.contatadoEm} <= ${fim}`,
      sql9`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`
    ));
    const blocoB = vendedores.map((v) => {
      const logsFaixa = logs.filter((l) => l.vendedor === v && l.acao === "registrarContato");
      let faixa1 = 0, faixa2 = 0, faixa3 = 0;
      for (const l of logsFaixa) {
        const match = (l.detalhe ?? "").match(/contato#(\d+)/);
        const numContato = match ? parseInt(match[1]) : 1;
        if (numContato === 1) faixa1++;
        else if (numContato === 2) faixa2++;
        else faixa3++;
      }
      return { vendedor: v, faixa1, faixa2, faixa3, total: faixa1 + faixa2 + faixa3 };
    });
    const blocoC = vendedores.map((v) => {
      const descartes = logs.filter((l) => l.vendedor === v && l.acao === "descartar").length;
      return { vendedor: v, descartes };
    });
    const agora = /* @__PURE__ */ new Date();
    const orcamentosComContato = /* @__PURE__ */ new Map();
    for (const c of contatos) {
      const prev = orcamentosComContato.get(c.orcamentoId);
      const dt = new Date(c.contatadoEm);
      if (!prev || dt > prev.ultimoContato) {
        orcamentosComContato.set(c.orcamentoId, { ultimoContato: dt, vendedor: c.vendedor, empresa: c.empresa });
      }
    }
    const orcamentosComContatoIds = new Set(contatos.map((c) => c.orcamentoId));
    const todosOrcamentos = await db5.select().from(crmContatos).where(sql9`${crmContatos.canal} = 'perdida' OR ${crmContatos.canal} = 'garantiu_fechamento'`).limit(0);
    void todosOrcamentos;
    const limbo = [];
    for (const [orcId, info] of orcamentosComContato.entries()) {
      const diasSemContato = Math.floor((agora.getTime() - info.ultimoContato.getTime()) / (1e3 * 60 * 60 * 24));
      if (diasSemContato > 3) {
        let risco = "baixo";
        if (diasSemContato >= 16) risco = "critico";
        else if (diasSemContato >= 7) risco = "alto";
        else if (diasSemContato >= 4) risco = "medio";
        limbo.push({ orcamentoId: orcId, empresa: info.empresa, vendedor: info.vendedor, diasSemContato, risco });
      }
    }
    limbo.sort((a, b) => b.diasSemContato - a.diasSemContato);
    const JANELA_MS = 10 * 60 * 1e3;
    const LIMITE_ACOES = 15;
    const alertasVelocidade = [];
    for (const v of vendedores) {
      const logsV = logs.filter((l) => l.vendedor === v).sort((a, b) => new Date(a.realizadaEm).getTime() - new Date(b.realizadaEm).getTime());
      for (let i = 0; i < logsV.length; i++) {
        const tInicio = new Date(logsV[i].realizadaEm).getTime();
        let count3 = 1;
        let j = i + 1;
        while (j < logsV.length && new Date(logsV[j].realizadaEm).getTime() - tInicio <= JANELA_MS) {
          count3++;
          j++;
        }
        if (count3 >= LIMITE_ACOES) {
          const intervaloMedioSeg = count3 > 1 ? Math.round((new Date(logsV[j - 1].realizadaEm).getTime() - tInicio) / ((count3 - 1) * 1e3)) : 0;
          alertasVelocidade.push({
            vendedor: v,
            dataHora: logsV[i].realizadaEm.toISOString(),
            qtdAcoes: count3,
            intervaloMedioSeg
          });
          i = j - 1;
        }
      }
    }
    const blocoF = vendedores.map((v) => {
      const totalContatos = logs.filter((l) => l.vendedor === v && l.acao === "registrarContato").length;
      const totalDescartes = logs.filter((l) => l.vendedor === v && l.acao === "descartar").length;
      const aderencia = blocoA.find((b) => b.vendedor === v)?.aderencia ?? 0;
      const score = totalContatos * 2 + totalDescartes + aderencia;
      return { vendedor: v, totalContatos, totalDescartes, aderencia, score };
    }).sort((a, b) => b.score - a.score);
    const menorAderencia = [...blocoA].sort((a, b) => a.aderencia - b.aderencia)[0];
    const maiorLimbo = limbo.length;
    const temAlertaVelocidade = alertasVelocidade.length > 0;
    let diagnostico = "";
    if (temAlertaVelocidade) {
      diagnostico = `\u26A0\uFE0F Alerta cr\xEDtico: ${alertasVelocidade[0].vendedor} registrou ${alertasVelocidade[0].qtdAcoes} a\xE7\xF5es em menos de 10 minutos \u2014 poss\xEDvel preenchimento aleat\xF3rio. Recomenda-se conversa imediata.`;
    } else if (menorAderencia && menorAderencia.aderencia < 60) {
      diagnostico = `\u{1F6A8} ${menorAderencia.vendedor} est\xE1 com ${menorAderencia.aderencia}% de ader\xEAncia \xE0 rotina de CRM (meta: 80%). Verificar se h\xE1 sobrecarga operacional ou resist\xEAncia ao m\xE9todo.`;
    } else if (maiorLimbo > 5) {
      diagnostico = `\u{1F4A4} H\xE1 ${maiorLimbo} propostas paradas no limbo sem contato h\xE1 mais de 3 dias. O principal gargalo \xE9 o follow-up de Faixa 2 e 3.`;
    } else {
      diagnostico = `\u2705 Rotina de CRM est\xE1 sendo cumprida pelo time. Nenhum alerta cr\xEDtico identificado no per\xEDodo.`;
    }
    const logsExclusao = logs.filter((l) => l.acao === "desfazer_contato");
    const orcIdsExcluidos = Array.from(new Set(logsExclusao.map((l) => l.orcamentoId).filter(Boolean)));
    const contatosExcluidos = orcIdsExcluidos.length > 0 ? await db5.select().from(crmContatos).where(sql9`${crmContatos.orcamentoId} IN (${sql9.join(orcIdsExcluidos.map((id) => sql9`${id}`), sql9`, `)})`) : [];
    const contatosPorOrcExcluido = {};
    for (const c of contatosExcluidos) {
      if (!contatosPorOrcExcluido[c.orcamentoId]) contatosPorOrcExcluido[c.orcamentoId] = [];
      contatosPorOrcExcluido[c.orcamentoId].push(c);
    }
    const blocoH = logsExclusao.map((l) => {
      const orcId = l.orcamentoId ?? "";
      const contatosDoOrc = contatosPorOrcExcluido[orcId] ?? [];
      const numContatos = contatosDoOrc.filter((c) => !["perdida", "garantiu_fechamento"].includes(c.canal)).length;
      const temFaixa1 = contatosDoOrc.some((c) => c.numeroContato === 1 && !["perdida", "garantiu_fechamento"].includes(c.canal));
      const temFaixa2 = contatosDoOrc.some((c) => c.numeroContato === 2 && !["perdida", "garantiu_fechamento"].includes(c.canal));
      const temFaixa3 = contatosDoOrc.some((c) => c.numeroContato >= 3 && !["perdida", "garantiu_fechamento"].includes(c.canal));
      const faixasCompletas = [temFaixa1, temFaixa2, temFaixa3].filter(Boolean).length;
      return {
        orcamentoId: orcId,
        empresa: l.empresa ?? "",
        vendedor: l.vendedor,
        dataExclusao: l.realizadaEm.toISOString(),
        detalhe: l.detalhe ?? "",
        numContatosAntes: numContatos + 1,
        // +1 porque o excluído já foi removido
        temFaixa1,
        temFaixa2,
        temFaixa3,
        faixasCompletas,
        todasFaixas: temFaixa1 && temFaixa2 && temFaixa3
      };
    }).sort((a, b) => new Date(b.dataExclusao).getTime() - new Date(a.dataExclusao).getTime());
    const totalExclusoes = blocoH.length;
    const exclusoesComTodasFaixas = blocoH.filter((e) => e.todasFaixas).length;
    const exclusoesSemNenhumaFaixa = blocoH.filter((e) => !e.temFaixa1 && !e.temFaixa2 && !e.temFaixa3).length;
    return {
      periodo: { inicio: input.dataInicio, fim: input.dataFim },
      vendedorFiltro: input.vendedor ?? null,
      dias,
      vendedores,
      blocoA,
      blocoB,
      blocoC,
      blocoD: limbo.slice(0, 20),
      // top 20 propostas no limbo
      blocoE: alertasVelocidade,
      blocoF,
      blocoG: diagnostico,
      blocoH,
      resumoExclusoes: { total: totalExclusoes, comTodasFaixas: exclusoesComTodasFaixas, semNenhumaFaixa: exclusoesSemNenhumaFaixa }
    };
  }),
  /**
   * Retorna o log bruto de atividade de um vendedor em um dia específico.
   * Usado para drill-down no calendário.
   */
  getLogDia: protectedProcedure.input(z19.object({
    vendedor: z19.string(),
    data: z19.string()
    // "YYYY-MM-DD"
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    const inicio = /* @__PURE__ */ new Date(input.data + "T03:00:00.000Z");
    const fim = /* @__PURE__ */ new Date(input.data + "T26:59:59.999Z");
    const logs = await db5.select().from(crmAtividadeLog).where(and15(
      eq18(crmAtividadeLog.vendedor, input.vendedor),
      sql9`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
      sql9`${crmAtividadeLog.realizadaEm} <= ${fim}`
    )).orderBy(crmAtividadeLog.realizadaEm);
    return logs.map((l) => ({
      ...l,
      realizadaEm: l.realizadaEm.toISOString(),
      horaBrasilia: (() => {
        const dt = new Date(l.realizadaEm);
        const hBr = (dt.getUTCHours() - 3 + 24) % 24;
        const mBr = dt.getUTCMinutes();
        return `${String(hBr).padStart(2, "0")}:${String(mBr).padStart(2, "0")}`;
      })()
    }));
  })
});

// server/routers/custoLed.ts
import { z as z20 } from "zod";
init_db();
init_schema();
import { eq as eq19, and as and16 } from "drizzle-orm";
var custoLedRouter = router({
  // Listar todos os tipos de LED ativos
  listTipos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(ledTipos).orderBy(ledTipos.nome);
  }),
  // Criar ou atualizar tipo de LED
  upsertTipo: protectedProcedure.input(z20.object({
    id: z20.number().optional(),
    nome: z20.string().min(1),
    descricao: z20.string().optional(),
    custoUnitario: z20.number().min(0),
    unidade: z20.string().default("un"),
    ativo: z20.enum(["sim", "nao"]).default("sim")
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...data } = input;
    const payload = {
      nome: data.nome,
      descricao: data.descricao ?? null,
      custoUnitario: String(data.custoUnitario),
      unidade: data.unidade,
      ativo: data.ativo
    };
    if (id) {
      await db5.update(ledTipos).set(payload).where(eq19(ledTipos.id, id));
      return { ok: true, id };
    } else {
      const [res] = await db5.insert(ledTipos).values(payload).returning({ id: ledTipos.id });
      return { ok: true, id: res.id };
    }
  }),
  // Excluir tipo de LED
  deleteTipo: protectedProcedure.input(z20.object({ id: z20.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(ledTipos).where(eq19(ledTipos.id, input.id));
    return { ok: true };
  }),
  // ─── Lançamentos de custo de LED por OS ──────────────────────────────────────
  // Listar lançamentos de um mês/ano
  listLancamentos: publicProcedure.input(z20.object({ mes: z20.number(), ano: z20.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custoLedLancamentos).where(and16(
      eq19(custoLedLancamentos.mes, input.mes),
      eq19(custoLedLancamentos.ano, input.ano)
    )).orderBy(custoLedLancamentos.os, custoLedLancamentos.createdAt);
    return rows;
  }),
  // Criar ou atualizar lançamento
  upsertLancamento: protectedProcedure.input(z20.object({
    id: z20.number().optional(),
    os: z20.string().min(1),
    ledTipoId: z20.number(),
    ledTipoEfetivoId: z20.number().nullable().optional(),
    qtdPrevista: z20.number().min(0),
    qtdEfetiva: z20.number().min(0).nullable().optional(),
    mes: z20.number().min(1).max(12),
    ano: z20.number(),
    observacao: z20.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...data } = input;
    const payload = {
      os: data.os,
      ledTipoId: data.ledTipoId,
      ledTipoEfetivoId: data.ledTipoEfetivoId ?? null,
      qtdPrevista: String(data.qtdPrevista),
      qtdEfetiva: data.qtdEfetiva != null ? String(data.qtdEfetiva) : null,
      mes: data.mes,
      ano: data.ano,
      observacao: data.observacao ?? null
    };
    if (id) {
      await db5.update(custoLedLancamentos).set(payload).where(eq19(custoLedLancamentos.id, id));
      return { ok: true, id };
    } else {
      const [res] = await db5.insert(custoLedLancamentos).values(payload).returning({ id: custoLedLancamentos.id });
      return { ok: true, id: res.id };
    }
  }),
  // Excluir lançamento
  deleteLancamento: protectedProcedure.input(z20.object({ id: z20.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(custoLedLancamentos).where(eq19(custoLedLancamentos.id, input.id));
    return { ok: true };
  }),
  // Resumo mensal: total previsto, efetivo, diferença (por tipo de LED)
  getResumoMensal: publicProcedure.input(z20.object({ mes: z20.number(), ano: z20.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { lancamentos: [], tipos: [], totalPrevisto: 0, totalEfetivo: 0, diferenca: 0 };
    const [lancamentos, tipos] = await Promise.all([
      db5.select().from(custoLedLancamentos).where(and16(
        eq19(custoLedLancamentos.mes, input.mes),
        eq19(custoLedLancamentos.ano, input.ano)
      )),
      db5.select().from(ledTipos)
    ]);
    const tiposMap = Object.fromEntries(tipos.map((t2) => [t2.id, t2]));
    const lancamentosComCalc = lancamentos.map((l) => {
      const tipoPrevisto = tiposMap[l.ledTipoId];
      const tipoEfetivo = l.ledTipoEfetivoId ? tiposMap[l.ledTipoEfetivoId] : null;
      const custoPrev = tipoPrevisto ? parseFloat(String(tipoPrevisto.custoUnitario)) : 0;
      const custoEfet = tipoEfetivo ? parseFloat(String(tipoEfetivo.custoUnitario)) : custoPrev;
      const previsto = parseFloat(String(l.qtdPrevista)) * custoPrev;
      const efetivo = l.qtdEfetiva != null ? parseFloat(String(l.qtdEfetiva)) * custoEfet : null;
      const diferenca2 = efetivo != null ? efetivo - previsto : null;
      return {
        ...l,
        tipoNome: tipoPrevisto?.nome ?? "Desconhecido",
        tipoEfetivoNome: tipoEfetivo?.nome ?? null,
        custoUnitario: custoPrev,
        custoUnitarioEfetivo: custoEfet,
        custoPrevisto: previsto,
        custoEfetivo: efetivo,
        diferenca: diferenca2,
        isMistura: !!l.ledTipoEfetivoId && l.ledTipoEfetivoId !== l.ledTipoId
      };
    });
    const totalPrevisto = lancamentosComCalc.reduce((s, l) => s + l.custoPrevisto, 0);
    const totalEfetivo = lancamentosComCalc.filter((l) => l.custoEfetivo != null).reduce((s, l) => s + (l.custoEfetivo ?? 0), 0);
    const diferenca = totalEfetivo - totalPrevisto;
    return {
      lancamentos: lancamentosComCalc,
      tipos,
      totalPrevisto,
      totalEfetivo,
      diferenca
    };
  })
});

// server/routers/admin.ts
init_mubisys_client();
import { z as z21 } from "zod";
function calcularProximaExecucao() {
  const agora = /* @__PURE__ */ new Date();
  const proxima = new Date(agora);
  proxima.setUTCHours(6, 0, 0, 0);
  if (proxima <= agora) proxima.setUTCDate(proxima.getUTCDate() + 1);
  return proxima.toISOString();
}
var adminRouter = router({
  // ✅ Obter status de sincronização — agrega as execuções das últimas 24h
  // porque o agendamento roda em 4 lotes/dia (Fase 3 da sprint MubiSys): ler
  // só a última linha mostraria apenas o lote mais recente e subestimaria o
  // total de OS importadas no dia.
  obterStatusSincronizacao: adminProcedure.query(async () => {
    try {
      const { selectQuery: selectQuery2 } = await Promise.resolve().then(() => (init_db_connection(), db_connection_exports));
      const logs = await selectQuery2(
        `SELECT "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro", "tempoExecucaoMs"
         FROM sync_logs
         WHERE "dataExecucao" >= NOW() - INTERVAL '24 hours'
         ORDER BY "dataExecucao" DESC`,
        []
      );
      const countRows = await selectQuery2("SELECT COUNT(*) AS total FROM erp_os_cache", []);
      const totalOs = Number(countRows?.[0]?.total ?? 0);
      if (!logs || logs.length === 0) {
        return {
          status: "NUNCA_EXECUTADO",
          ultimaSincronizacao: null,
          proximaExecucao: calcularProximaExecucao(),
          totalOs,
          mensagemErro: null,
          tempoExecucaoMs: null,
          quantidadeImportada: 0,
          execucoes24h: 0
        };
      }
      const algumErro = logs.find((l) => l.status === "ERRO");
      const algumPendente = logs.some((l) => l.status === "PENDENTE");
      const status = algumErro ? "ERRO" : algumPendente ? "PENDENTE" : "SUCESSO";
      const quantidadeImportada = logs.reduce(
        (soma, l) => soma + Number(l.quantidadeOsImportadas ?? 0),
        0
      );
      const ultimoLog = logs[0];
      return {
        status,
        ultimaSincronizacao: ultimoLog.dataExecucao,
        proximaExecucao: calcularProximaExecucao(),
        totalOs,
        mensagemErro: algumErro?.mensagemErro ?? null,
        tempoExecucaoMs: ultimoLog.tempoExecucaoMs ?? null,
        quantidadeImportada,
        execucoes24h: logs.length
      };
    } catch (error) {
      console.error("[Admin] Erro ao obter status:", error);
      return {
        status: "ERRO",
        ultimaSincronizacao: null,
        proximaExecucao: null,
        totalOs: 0,
        mensagemErro: error.message,
        tempoExecucaoMs: null,
        quantidadeImportada: 0,
        execucoes24h: 0
      };
    }
  }),
  // ✅ Forçar sincronização manual — mesma janela padrão (8/0) do lote 1 do
  // agendamento. Para os 30 dias completos, rodar os quatro lotes manualmente.
  forcarSincronizacaoManual: adminProcedure.input(
    z21.object({
      dias: z21.number().min(1).max(31).optional(),
      offset: z21.number().min(0).max(365).optional()
    }).optional()
  ).mutation(async ({ input }) => {
    try {
      console.log("\u{1F504} [Admin] Iniciando sincroniza\xE7\xE3o manual...", input);
      const { sincronizarOSDoMubiSys: sincronizarOSDoMubiSys2 } = await Promise.resolve().then(() => (init_scheduled_sync_os(), scheduled_sync_os_exports));
      const resultado = await sincronizarOSDoMubiSys2({ dias: input?.dias, offset: input?.offset });
      console.log("\u2705 [Admin] Sincroniza\xE7\xE3o manual conclu\xEDda:", resultado);
      return {
        success: true,
        mensagem: `Sincroniza\xE7\xE3o conclu\xEDda: ${resultado.quantidadeOsImportadas} OS processadas`,
        resultado
      };
    } catch (error) {
      console.error("[Admin] Erro ao for\xE7ar sincroniza\xE7\xE3o:", error);
      throw new Error(`Erro ao sincronizar: ${error.message}`);
    }
  }),
  // ✅ Obter histórico de sincronizações
  obterHistoricoSincronizacoes: adminProcedure.input(z21.object({ limite: z21.number().default(10) })).query(async ({ input }) => {
    try {
      const { selectQuery: selectQuery2 } = await Promise.resolve().then(() => (init_db_connection(), db_connection_exports));
      const limite = Math.max(1, Math.min(Number(input.limite) || 10, 100));
      const logs = await selectQuery2(
        `SELECT id, "dataExecucao", status, "quantidadeOsImportadas", "mensagemErro", "tempoExecucaoMs"
           FROM sync_logs ORDER BY "dataExecucao" DESC LIMIT ${limite}`,
        []
      );
      return logs.map((log) => ({
        id: log.id,
        dataExecucao: log.dataExecucao,
        status: log.status,
        quantidadeOsImportadas: Number(log.quantidadeOsImportadas ?? 0),
        mensagemErro: log.mensagemErro ?? null,
        tempoExecucaoMs: log.tempoExecucaoMs ?? null
      }));
    } catch (error) {
      console.error("[Admin] Erro ao obter hist\xF3rico:", error);
      return [];
    }
  }),
  // ✅ Limpar cache de OSs antigas (>30 dias)
  limparCacheAntigo: adminProcedure.mutation(async () => {
    try {
      console.log("\u{1F5D1}\uFE0F [Admin] Limpando cache de OSs antigas...");
      const dataLimite = /* @__PURE__ */ new Date();
      dataLimite.setDate(dataLimite.getDate() - 30);
      const { mutationQuery: mutationQuery2 } = await Promise.resolve().then(() => (init_db_connection(), db_connection_exports));
      const resultado = await mutationQuery2(
        `DELETE FROM erp_os_cache WHERE "sincronizadoEm" < ?`,
        [dataLimite]
      );
      const removidas = Number(resultado?.affectedRows ?? 0);
      console.log(`\u2705 [Admin] Cache limpo: ${removidas} OS removida(s)`);
      return {
        success: true,
        mensagem: `Cache limpo: ${removidas} OS com mais de 30 dias removida(s)`,
        removidas
      };
    } catch (error) {
      console.error("[Admin] Erro ao limpar cache:", error);
      throw new Error(`Erro ao limpar cache: ${error.message}`);
    }
  }),
  // ✅ Health check barato do ERP (Fase 5) — consulta pontual, não a listagem
  // de ~25s. Ver verificarConexaoMubiSys em mubisys-client.ts.
  verificarConexaoErp: adminProcedure.query(async () => {
    return verificarConexaoMubiSys();
  })
});

// server/_core/systemRouter.ts
import { z as z22 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError4 } from "@trpc/server";
var TITLE_MAX_LENGTH = 256;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError4({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`
    });
  }
  return { title, content };
};
async function notifyOwner(payload) {
  const { title, content } = validatePayload(payload);
  await criarAlerta({
    tipo: "manual",
    severidade: "aviso",
    titulo: title,
    descricao: content
  });
  return true;
}

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z22.object({
      timestamp: z22.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z22.object({
      title: z22.string().min(1, "title is required"),
      content: z22.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_auth();
init_llm();
init_schema();
init_db();
init_db();
init_db();
import { fromNodeHeaders } from "better-auth/node";
import { TRPCError as TRPCError5 } from "@trpc/server";
import { asc as asc6, eq as eq20, isNull as isNull2, or as or2, count as sqlCount } from "drizzle-orm";
async function countUsers() {
  const db5 = await getDb3();
  if (!db5) return 0;
  const [row] = await db5.select({ n: sqlCount() }).from(user);
  return row?.n ?? 0;
}
function assertAdminOrMaster(ctx) {
  if (!ctx.user || ctx.user.role !== "admin" && ctx.user.role !== "master") {
    throw new TRPCError5({ code: "FORBIDDEN", message: "Apenas Admin ou Master podem gerenciar usu\xE1rios." });
  }
}
function slugifyName(name) {
  const slug = name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return slug || "usuario";
}
var filterSchema = z23.object({
  mes: z23.string().optional(),
  setor: z23.string().optional(),
  tipo: z23.string().optional(),
  responsavel: z23.string().optional(),
  classe: z23.string().optional(),
  dataInicio: z23.date().optional(),
  dataFim: z23.date().optional(),
  search: z23.string().optional(),
  tipoRegistro: z23.enum(["retrabalho", "cnq"]).optional()
});
var appRouter = router({
  system: systemRouter,
  // Painel "Status de Sincronização ERP" (cache de OS dos últimos 30 dias + logs)
  admin: adminRouter,
  // ─── Error Library ──────────────────────────────────────────────────────
  errorLibrary: router({
    list: publicProcedure.query(() => getErrorLibrary()),
    byCode: publicProcedure.input(z23.object({ code: z23.string() })).query(({ input }) => getErrorByCode(input.code)),
    updateCorrection: protectedProcedure.input(z23.object({ code: z23.string(), correction: z23.string().min(1) })).mutation(({ input }) => updateErrorCorrection(input.code, input.correction)),
    create: protectedProcedure.input(z23.object({
      code: z23.string().min(1),
      category: z23.string().min(1),
      description: z23.string().min(1),
      correction: z23.string().min(1),
      tipoRegistro: z23.enum(["retrabalho", "cnq"]).default("retrabalho")
    })).mutation(({ input }) => createErrorLibraryItem(input)),
    updateItem: protectedProcedure.input(z23.object({
      code: z23.string(),
      description: z23.string().min(1).optional(),
      correction: z23.string().min(1).optional()
    })).mutation(({ input }) => updateErrorItem(input.code, { description: input.description, correction: input.correction })),
    uploadImage: protectedProcedure.input(z23.object({
      code: z23.string(),
      fileName: z23.string(),
      url: z23.string().url(),
      key: z23.string().min(1),
      mimeType: z23.string().default("image/jpeg")
    })).mutation(async ({ input }) => {
      await updateErrorItem(input.code, { imageUrl: input.url, imageKey: input.key });
      return { url: input.url, key: input.key };
    }),
    removeImage: protectedProcedure.input(z23.object({ code: z23.string() })).mutation(async ({ input }) => {
      await updateErrorItem(input.code, { imageUrl: null, imageKey: null });
      return { success: true };
    }),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteErrorLibraryItem(input.id))
  }),
  faturamento: router({
    list: publicProcedure.query(() => getFaturamento()),
    upsert: publicProcedure.input(z23.object({ mes: z23.string(), ano: z23.number(), valorFaturado: z23.number(), totalPedidos: z23.number() })).mutation(({ input }) => upsertFaturamento(input.mes, input.ano, input.valorFaturado, input.totalPedidos))
  }),
  financeiros: router({
    list: publicProcedure.query(() => getFinanceiros()),
    byMesAno: publicProcedure.input(z23.object({ mes: z23.number(), ano: z23.number() })).query(({ input }) => getFinanceiroByMesAno(input.mes, input.ano)),
    upsert: protectedProcedure.input(z23.object({
      mes: z23.number(),
      ano: z23.number(),
      receitaBruta: z23.number().optional(),
      receitaOperacional: z23.number().optional(),
      receitaFinanceira: z23.number().optional(),
      despesasTotal: z23.number().optional(),
      despesasFixas: z23.number().optional(),
      despesasVariaveis: z23.number().optional(),
      despesasPessoal: z23.number().optional(),
      despesasFinanceiras: z23.number().optional(),
      despesasImpostos: z23.number().optional(),
      lucroGruto: z23.number().optional(),
      lucroOperacional: z23.number().optional(),
      lucroLiquido: z23.number().optional(),
      entradas: z23.number().optional(),
      saidas: z23.number().optional(),
      saldoMes: z23.number().optional(),
      observacoes: z23.string().optional()
    })).mutation(({ input }) => upsertFinanceiro(input))
  }),
  // ─── Retrabalhos ────────────────────────────────────────────────────────
  retrabalhos: router({
    list: publicProcedure.input(z23.object({ filter: filterSchema.optional(), page: z23.number().default(1), pageSize: z23.number().default(50) })).query(({ input }) => listRetrabalhos(input.filter ?? {}, input.page, input.pageSize)),
    all: publicProcedure.input(filterSchema.optional()).query(({ input }) => getRetrabalhosAll(input ?? {})),
    byId: publicProcedure.input(z23.object({ id: z23.number() })).query(({ input }) => getRetrabalhosById(input.id)),
    create: protectedProcedure.input(z23.object({
      titulo: z23.string().optional().nullable(),
      osRetrabalhada: z23.string().optional().nullable(),
      // Opcional para CNQ
      osOriginal: z23.string().optional().nullable(),
      // Opcional para CNQ
      data: z23.date(),
      setor: z23.string(),
      tipo: z23.enum(["INTERNO", "EXTERNO"]),
      custo: z23.string().default("0"),
      frete: z23.string().default("0"),
      total: z23.string().default("0"),
      codigoErro: z23.string().optional().nullable(),
      responsavel: z23.string().min(1, "Respons\xE1vel \xE9 obrigat\xF3rio"),
      tipoResponsavel: z23.enum(["operador", "gestor"]).default("operador"),
      descricao: z23.string().optional().nullable(),
      classe: z23.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]),
      horasImpacto: z23.union([z23.number(), z23.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
      mes: z23.string().optional().nullable(),
      tipoRegistro: z23.enum(["retrabalho", "cnq"]).default("retrabalho")
    })).mutation(async ({ input, ctx }) => {
      const result = await createRetrabalho(input);
      const newId = result?.id ?? null;
      insertAuditLog({
        retrabalhoId: newId,
        osRetrabalhada: input.osRetrabalhada,
        osOriginal: input.osOriginal,
        acao: "CRIACAO",
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? null,
        usuarioRole: ctx.user?.role ?? null,
        detalhes: { input }
      }).catch(() => {
      });
      return result;
    }),
    createBatch: protectedProcedure.input(z23.object({
      titulo: z23.string().optional().nullable(),
      osRetrabalhada: z23.string().optional().nullable(),
      // Opcional para CNQ
      osOriginal: z23.string().optional().nullable(),
      // Opcional para CNQ
      data: z23.date(),
      setor: z23.string(),
      tipo: z23.enum(["INTERNO", "EXTERNO"]),
      custo: z23.string().default("0"),
      frete: z23.string().default("0"),
      total: z23.string().default("0"),
      responsavel: z23.string().min(1, "Respons\xE1vel \xE9 obrigat\xF3rio"),
      tipoResponsavel: z23.enum(["operador", "gestor"]).default("operador"),
      descricao: z23.string().optional().nullable(),
      classe: z23.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]),
      horasImpacto: z23.union([z23.number(), z23.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
      mes: z23.string().optional().nullable(),
      tipoRegistro: z23.enum(["retrabalho", "cnq"]).default("retrabalho"),
      errorIds: z23.array(z23.number()).min(1, "Selecione pelo menos um erro")
    })).mutation(async ({ input, ctx }) => {
      const { errorIds, ...baseData } = input;
      const results = await createBatchRetrabalhos(baseData, errorIds);
      results.forEach((result, idx) => {
        const newId = result?.id ?? null;
        insertAuditLog({
          retrabalhoId: newId,
          osRetrabalhada: input.osRetrabalhada,
          osOriginal: input.osOriginal,
          acao: "CRIACAO",
          usuarioId: ctx.user?.id ?? null,
          usuarioNome: ctx.user?.name ?? null,
          usuarioRole: ctx.user?.role ?? null,
          detalhes: { batchIndex: idx, totalBatch: errorIds.length }
        }).catch(() => {
        });
      });
      return { success: true, count: results.length, results };
    }),
    update: protectedProcedure.input(z23.object({
      id: z23.number(),
      data: z23.object({
        titulo: z23.string().optional().nullable(),
        osRetrabalhada: z23.string().optional(),
        osOriginal: z23.string().optional(),
        data: z23.date().optional(),
        setor: z23.string().optional(),
        tipo: z23.enum(["INTERNO", "EXTERNO"]).optional(),
        custo: z23.string().optional(),
        frete: z23.string().optional(),
        total: z23.string().optional(),
        codigoErro: z23.string().optional().nullable(),
        responsavel: z23.string().optional().nullable(),
        tipoResponsavel: z23.enum(["operador", "gestor"]).optional(),
        descricao: z23.string().optional().nullable(),
        classe: z23.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]).optional(),
        horasImpacto: z23.union([z23.number(), z23.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
        mes: z23.string().optional().nullable(),
        tipoRegistro: z23.enum(["retrabalho", "cnq"]).optional()
      })
    })).mutation(async ({ input, ctx }) => {
      const before = await getRetrabalhosById(input.id);
      const result = await updateRetrabalho(input.id, input.data);
      insertAuditLog({
        retrabalhoId: input.id,
        osRetrabalhada: before?.osRetrabalhada ?? null,
        osOriginal: before?.osOriginal ?? null,
        acao: "EDICAO",
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? null,
        usuarioRole: ctx.user?.role ?? null,
        detalhes: { antes: before, alteracoes: input.data }
      }).catch(() => {
      });
      return result;
    }),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ input, ctx }) => {
      const before = await getRetrabalhosById(input.id);
      const result = await deleteRetrabalho(input.id);
      insertAuditLog({
        retrabalhoId: input.id,
        osRetrabalhada: before?.osRetrabalhada ?? null,
        osOriginal: before?.osOriginal ?? null,
        acao: "EXCLUSAO",
        usuarioId: ctx.user?.id ?? null,
        usuarioNome: ctx.user?.name ?? null,
        usuarioRole: ctx.user?.role ?? null,
        detalhes: { registroExcluido: before }
      }).catch(() => {
      });
      return result;
    })
  }),
  // ─── Dashboard / KPIs ───────────────────────────────────────────────────
  dashboard: router({
    kpis: publicProcedure.input(filterSchema.optional()).query(({ input }) => getKpis(input ?? {})),
    bySetor: publicProcedure.input(filterSchema.optional()).query(({ input }) => getBySetor(input ?? {})),
    byCategoria: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByCategoria(input ?? {})),
    byCodigoErro: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByCodigoErro(input ?? {})),
    byResponsavel: publicProcedure.input(filterSchema.optional()).query(({ input }) => getByResponsavel(input ?? {})),
    evolucaoMensal: publicProcedure.query(() => getEvolucaoMensal()),
    evolucaoMensalCnq: publicProcedure.query(() => getEvolucaoMensal("cnq")),
    evolucaoMensalRetrabalho: publicProcedure.query(() => getEvolucaoMensal("retrabalho")),
    kpisCnq: publicProcedure.input(filterSchema.optional()).query(({ input }) => getKpis({ ...input ?? {}, tipoRegistro: "cnq" })),
    reincidencia: publicProcedure.input(filterSchema.optional()).query(({ input }) => getReincidencia(input ?? {})),
    distinctValues: publicProcedure.query(() => getDistinctValues()),
    retrabalhosDodia: publicProcedure.query(async () => {
      const agora = /* @__PURE__ */ new Date();
      const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 0, 0, 0, 0);
      const hojeFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
      const ontemInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 0, 0, 0, 0);
      const ontemFim = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1, 23, 59, 59, 999);
      const [hoje, ontem] = await Promise.all([
        getRetrabalhosAll({ dataInicio: hojeInicio, dataFim: hojeFim }),
        getRetrabalhosAll({ dataInicio: ontemInicio, dataFim: ontemFim })
      ]);
      return {
        hoje,
        ontem,
        dataHoje: hojeInicio.toISOString(),
        dataOntem: ontemInicio.toISOString()
      };
    })
  }),
  // ─── Insights LLM ───────────────────────────────────────────────────────
  insights: router({
    generate: publicProcedure.input(filterSchema.optional()).mutation(async ({ input }) => {
      const [kpis, bySetor, byErro, byResp, evolucao, reincidencia, allRetrabalhos] = await Promise.all([
        getKpis(input ?? {}),
        getBySetor(input ?? {}),
        getByCodigoErro(input ?? {}),
        getByResponsavel(input ?? {}),
        getEvolucaoMensal(),
        getReincidencia(input ?? {}),
        getRetrabalhosAll(input ?? {})
      ]);
      const descricoes = allRetrabalhos.filter((r) => r.descricao && r.descricao.trim().length > 10).slice(0, 30).map((r) => `- [${r.setor}/${r.codigoErro ?? "sem c\xF3digo"}] ${r.descricao?.trim()}`);
      const context = `
Voc\xEA \xE9 um especialista em qualidade industrial e gest\xE3o de produ\xE7\xE3o de letreiros.
Analise os dados de retrabalho abaixo e gere insights pr\xE1ticos e acion\xE1veis.

## KPIs Gerais
- Total de retrabalhos: ${kpis?.total}
- Custo total: R$ ${kpis?.custoTotal?.toFixed(2)}
- Custo m\xE9dio por retrabalho: R$ ${kpis?.custoMedio?.toFixed(2)}
- Evit\xE1veis: ${kpis?.evitavel} (${kpis?.pctEvitavel}%)
- Inevit\xE1veis: ${kpis?.inevitavel} (${kpis?.pctInevitavel}%)

## Retrabalhos por Setor
${bySetor.map((s) => `- ${s.setor}: ${s.count} ocorr\xEAncias, R$ ${Number(s.custo).toFixed(2)}`).join("\n")}

## Erros Mais Frequentes
${byErro.slice(0, 10).map((e) => `- ${e.codigoErro}: ${e.count} ocorr\xEAncias, R$ ${Number(e.custo).toFixed(2)}`).join("\n")}

## Respons\xE1veis com Mais Retrabalhos
${byResp.slice(0, 8).map((r) => `- ${r.responsavel ?? "Sem respons\xE1vel"}: ${r.count} ocorr\xEAncias, R$ ${Number(r.custo).toFixed(2)}`).join("\n")}

## Evolu\xE7\xE3o Mensal
${evolucao.map((m) => `- ${m.mes}: ${m.count} retrabalhos, R$ ${Number(m.custo).toFixed(2)}, Evit\xE1veis: ${m.evitavel}, Inevit\xE1veis: ${m.inevitavel}`).join("\n")}

## Erros com Reincid\xEAncia (\u22652 ocorr\xEAncias)
${reincidencia.slice(0, 10).map((r) => `- ${r.codigoErro} (${r.setor}): ${r.count} reincid\xEAncias, R$ ${Number(r.custo).toFixed(2)}, Respons\xE1veis: ${r.responsaveis}`).join("\n")}
${descricoes.length > 0 ? `
## Descri\xE7\xF5es do Ocorrido (relatos reais dos operadores)
${descricoes.join("\n")}
` : ""}
`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: context },
          {
            role: "user",
            content: `Com base nesses dados de retrabalho de uma f\xE1brica de letreiros, gere:

1. **Diagn\xF3stico Geral** (2-3 par\xE1grafos): an\xE1lise cr\xEDtica dos padr\xF5es identificados
2. **Top 3 Problemas Cr\xEDticos**: os problemas mais urgentes com impacto financeiro
3. **An\xE1lise por Setor**: quais setores precisam de aten\xE7\xE3o imediata e por qu\xEA
4. **Padr\xF5es de Reincid\xEAncia**: erros que se repetem e indicam falha de processo
5. **An\xE1lise das Descri\xE7\xF5es do Ocorrido**: se houver relatos dos operadores, identifique padr\xF5es nas causas raiz descritas, linguagem recorrente e situa\xE7\xF5es que indicam falhas de processo ou treinamento
6. **Plano de A\xE7\xE3o Priorit\xE1rio**: 5 a\xE7\xF5es concretas e implement\xE1veis imediatamente
7. **Metas Sugeridas**: indicadores e metas para os pr\xF3ximos 3 meses

Seja direto, t\xE9cnico e pr\xE1tico. Use dados espec\xEDficos dos n\xFAmeros fornecidos. Quando houver relatos dos operadores, cite-os diretamente para embasar suas recomenda\xE7\xF5es.`
          }
        ]
      });
      return { content: response.choices[0]?.message?.content ?? "N\xE3o foi poss\xEDvel gerar insights." };
    })
  }),
  // ─── OPERAÇÕES: Base de Conhecimento ────────────────────────────────────
  knowledge: router({
    list: publicProcedure.input(z23.object({ search: z23.string().optional(), category: z23.string().optional() }).optional()).query(({ input }) => listKnowledge(input?.search, input?.category)),
    byId: publicProcedure.input(z23.object({ id: z23.number() })).query(({ input }) => getKnowledgeById(input.id)),
    create: protectedProcedure.input(z23.object({ title: z23.string(), content: z23.string(), category: z23.string(), subcategory: z23.string().optional().nullable(), keywords: z23.string().optional().nullable() })).mutation(({ input }) => createKnowledge(input)),
    update: protectedProcedure.input(z23.object({ id: z23.number(), data: z23.object({ title: z23.string().optional(), content: z23.string().optional(), category: z23.string().optional(), subcategory: z23.string().optional().nullable(), keywords: z23.string().optional().nullable() }) })).mutation(({ input }) => updateKnowledge(input.id, input.data)),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteKnowledge(input.id)),
    askAI: protectedProcedure.input(z23.object({ question: z23.string() })).mutation(async ({ input, ctx }) => {
      const [allKnowledge, allErrors, allPops, allArquivos] = await Promise.all([
        listKnowledge(input.question),
        getErrorLibrary(),
        listPops(),
        listArquivosBibliotecaComConteudo()
      ]);
      const words = input.question.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const matchScore = (text2) => words.filter((w) => text2.toLowerCase().includes(w)).length;
      const topKnowledge = allKnowledge.map((k) => ({ ...k, score: matchScore(k.title + " " + k.content) })).filter((k) => k.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      const topErrors = allErrors.map((e) => ({ ...e, score: matchScore((e.code ?? "") + " " + (e.description ?? "") + " " + (e.correction ?? "")) })).filter((e) => e.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      const topPops = allPops.map((p) => ({ ...p, score: matchScore((p.title ?? "") + " " + (p.steps ?? "") + " " + (p.objective ?? "")) })).filter((p) => p.score > 0).sort((a, b) => b.score - a.score).slice(0, 2);
      const topArquivos = allArquivos.filter((a) => a.conteudoExtraido && a.conteudoExtraido.trim().length > 0).map((a) => ({
        ...a,
        score: matchScore(
          (a.nome ?? "") + " " + (a.descricao ?? "") + " " + (a.tags ?? "") + " " + (a.categoria ?? "") + " " + (a.conteudoExtraido ?? "")
        )
      })).filter((a) => a.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);
      const hasInternalContent = topKnowledge.length > 0 || topErrors.length > 0 || topPops.length > 0 || topArquivos.length > 0;
      let contextText = "";
      if (topKnowledge.length > 0) {
        contextText += "\n## Artigos da Base de Conhecimento\n";
        topKnowledge.forEach((k) => {
          contextText += `### ${k.title}
${k.content}

`;
        });
      }
      if (topErrors.length > 0) {
        contextText += "\n## Erros Documentados\n";
        topErrors.forEach((e) => {
          contextText += `- **${e.code}** ${e.description}: ${e.correction}
`;
        });
      }
      if (topPops.length > 0) {
        contextText += "\n## Procedimentos Operacionais (POPs)\n";
        topPops.forEach((p) => {
          contextText += `### ${p.title}
${p.steps}

`;
        });
      }
      if (topArquivos.length > 0) {
        contextText += "\n## Documentos da Biblioteca de Arquivos\n";
        topArquivos.forEach((a) => {
          const excerptSize = 1500;
          const excerpt = a.conteudoExtraido.slice(0, excerptSize);
          contextText += `### ${a.nome} (${a.categoria}${a.subcategoria ? " > " + a.subcategoria : ""})
${excerpt}

`;
        });
      }
      const { invokeLLM: invokeLLM2 } = await Promise.resolve().then(() => (init_llm(), llm_exports));
      const systemPrompt = hasInternalContent ? `Voc\xEA \xE9 um assistente especialista nos processos internos da empresa Letreiros Express. Use o contexto interno fornecido como base principal para responder. Se o contexto n\xE3o for suficiente, complemente com seu conhecimento geral. Seja objetivo e pr\xE1tico. Responda em no m\xE1ximo 3 par\xE1grafos curtos.` : `Voc\xEA \xE9 um assistente especialista em processos industriais e produ\xE7\xE3o de letreiros. A pergunta n\xE3o possui informa\xE7\xF5es na base interna da empresa. Responda com base no seu conhecimento geral de forma objetiva e pr\xE1tica. Deixe claro que esta \xE9 uma resposta geral, n\xE3o baseada em dados internos da empresa. Responda em no m\xE1ximo 3 par\xE1grafos curtos.`;
      const llmResponse = await invokeLLM2({
        messages: [{ role: "user", content: `${systemPrompt}

${contextText ? `Contexto interno:
${contextText}

` : ""}Pergunta: ${input.question}` }]
      });
      const geminiAnswer = llmResponse.choices?.[0]?.message?.content ?? "";
      return {
        internalSources: {
          hasContent: hasInternalContent,
          knowledge: topKnowledge.map((k) => ({ id: k.id, title: k.title, category: k.category, excerpt: k.content.slice(0, 300) })),
          errors: topErrors.map((e) => ({ code: e.code, description: e.description, correction: e.correction })),
          pops: topPops.map((p) => ({ id: p.id, title: p.title, code: p.code })),
          files: topArquivos.map((a) => ({ id: a.id, nome: a.nome, categoria: a.categoria, subcategoria: a.subcategoria, fileName: a.fileName, fileUrl: a.fileUrl, conteudoExtraido: a.conteudoExtraido ?? null }))
        },
        geminiAnswer,
        geminiAnswerIsGeneral: !hasInternalContent
      };
    })
  }),
  // ─── SUGESTÕES DE INCORPORAÇÃO NA BASE DE CONHECIMENTO ──────────────────
  knowledgeSuggestions: router({
    list: protectedProcedure.input(z23.object({ status: z23.string().optional() }).optional()).query(({ input }) => listKnowledgeSuggestions(input?.status)),
    create: protectedProcedure.input(z23.object({
      pergunta: z23.string(),
      conteudoSugerido: z23.string(),
      fonte: z23.enum(["gemini", "manual"]).default("manual"),
      tituloSugerido: z23.string().optional(),
      categoriaSugerida: z23.string().optional()
    })).mutation(({ input, ctx }) => createKnowledgeSuggestion({
      ...input,
      autorId: ctx.user?.id ?? void 0,
      autorNome: ctx.user?.name ?? "Usu\xE1rio"
    })),
    // Master aprova: cria artigo na base de conhecimento
    approve: protectedProcedure.use(requireRole("admin", "master")).input(z23.object({
      id: z23.number(),
      titulo: z23.string(),
      categoria: z23.string(),
      conteudo: z23.string(),
      observacao: z23.string().optional()
    })).mutation(async ({ input }) => {
      await createKnowledge({ title: input.titulo, content: input.conteudo, category: input.categoria });
      await updateKnowledgeSuggestion(input.id, {
        status: "aprovado",
        tituloSugerido: input.titulo,
        categoriaSugerida: input.categoria,
        observacaoMaster: input.observacao
      });
      return { success: true };
    }),
    reject: protectedProcedure.use(requireRole("admin", "master")).input(z23.object({ id: z23.number(), observacao: z23.string().optional() })).mutation(async ({ input }) => {
      await updateKnowledgeSuggestion(input.id, { status: "rejeitado", observacaoMaster: input.observacao });
      return { success: true };
    }),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteKnowledgeSuggestion(input.id))
  }),
  // ─── OPERAÇÕES: Fornecedores ─────────────────────────────────────────────
  suppliers: router({
    list: publicProcedure.input(z23.object({ search: z23.string().optional(), category: z23.string().optional() }).optional()).query(({ input }) => listSuppliers(input?.search, input?.category)),
    byId: publicProcedure.input(z23.object({ id: z23.number() })).query(({ input }) => getSupplierById(input.id)),
    create: protectedProcedure.input(z23.object({ name: z23.string(), company: z23.string().optional().nullable(), category: z23.string(), supplies: z23.string().optional().nullable(), contact: z23.string().optional().nullable(), phone: z23.string().optional().nullable(), email: z23.string().optional().nullable(), paymentTerms: z23.string().optional().nullable(), notes: z23.string().optional().nullable() })).mutation(({ input, ctx }) => createSupplier({ ...input, createdByNome: ctx.user.name ?? ctx.user.email ?? "sistema", updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" })),
    update: protectedProcedure.input(z23.object({ id: z23.number(), data: z23.object({ name: z23.string().optional(), company: z23.string().optional().nullable(), category: z23.string().optional(), supplies: z23.string().optional().nullable(), contact: z23.string().optional().nullable(), phone: z23.string().optional().nullable(), email: z23.string().optional().nullable(), paymentTerms: z23.string().optional().nullable(), notes: z23.string().optional().nullable(), active: z23.enum(["sim", "nao"]).optional() }) })).mutation(({ input, ctx }) => updateSupplier(input.id, { ...input.data, updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" })),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteSupplier(input.id))
  }),
  // ─── OPERAÇÕES: Rotinas ──────────────────────────────────────────────────────────────────
  routines: router({
    list: publicProcedure.query(() => listRoutines()),
    pending: publicProcedure.query(() => listPendingRoutines()),
    create: protectedProcedure.input(z23.object({
      title: z23.string(),
      description: z23.string().optional().nullable(),
      frequency: z23.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]),
      assignedTo: z23.string().optional().nullable(),
      startDate: z23.string().optional().nullable(),
      calendarDates: z23.string().optional().nullable()
    })).mutation(({ input }) => createRoutine(input)),
    update: protectedProcedure.input(z23.object({
      id: z23.number(),
      data: z23.object({
        title: z23.string().optional(),
        description: z23.string().optional().nullable(),
        frequency: z23.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]).optional(),
        assignedTo: z23.string().optional().nullable(),
        status: z23.enum(["pendente", "em_dia", "atrasada"]).optional(),
        lastDone: z23.date().optional().nullable(),
        startDate: z23.string().optional().nullable(),
        calendarDates: z23.string().optional().nullable(),
        nextDue: z23.date().optional().nullable()
      })
    })).mutation(({ input }) => updateRoutine(input.id, input.data)),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteRoutine(input.id)),
    markDone: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => markRoutineDone(input.id))
  }),
  // ─── OPERAÇÕES: Regulamentos ─────────────────────────────────────────────────────
  regulations: router({
    list: publicProcedure.input(z23.object({ type: z23.string().optional() }).optional()).query(({ input }) => listRegulations(input?.type)),
    byId: publicProcedure.input(z23.object({ id: z23.number() })).query(({ input }) => getRegulationById(input.id)),
    create: protectedProcedure.input(z23.object({ title: z23.string(), type: z23.enum(["regulamento", "memorando", "politica", "procedimento"]), content: z23.string(), version: z23.string().optional().nullable() })).mutation(({ input }) => createRegulation(input)),
    update: protectedProcedure.input(z23.object({ id: z23.number(), data: z23.object({ title: z23.string().optional(), type: z23.enum(["regulamento", "memorando", "politica", "procedimento"]).optional(), content: z23.string().optional(), version: z23.string().optional().nullable(), active: z23.enum(["sim", "nao"]).optional() }) })).mutation(({ input }) => updateRegulation(input.id, input.data)),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deleteRegulation(input.id))
  }),
  // ─── OPERAÇÕES: POPs ─────────────────────────────────────────────────────
  pops: router({
    list: publicProcedure.input(z23.object({ sector: z23.string().optional() }).optional()).query(({ input }) => listPops(input?.sector)),
    byId: publicProcedure.input(z23.object({ id: z23.number() })).query(({ input }) => getPopById(input.id)),
    create: protectedProcedure.input(z23.object({ code: z23.string(), title: z23.string(), sector: z23.string(), objective: z23.string().optional().nullable(), steps: z23.string(), responsible: z23.string().optional().nullable(), version: z23.string().optional().nullable() })).mutation(({ input }) => createPop(input)),
    update: protectedProcedure.input(z23.object({ id: z23.number(), data: z23.object({ code: z23.string().optional(), title: z23.string().optional(), sector: z23.string().optional(), objective: z23.string().optional().nullable(), steps: z23.string().optional(), responsible: z23.string().optional().nullable(), version: z23.string().optional().nullable(), active: z23.enum(["sim", "nao"]).optional() }) })).mutation(({ input }) => updatePop(input.id, input.data)),
    delete: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(({ input }) => deletePop(input.id)),
    // Gera um POP automaticamente via IA a partir de um erro da biblioteca
    generateFromError: protectedProcedure.input(z23.object({
      errorCode: z23.string(),
      errorDescription: z23.string(),
      errorCategory: z23.string(),
      correction: z23.string(),
      // histórico de ocorrências para enriquecer o contexto
      occurrenceCount: z23.number().optional(),
      totalCost: z23.number().optional()
    })).mutation(async ({ input }) => {
      const prompt = `Voc\xEA \xE9 um especialista em qualidade e processos industriais de uma f\xE1brica de letreiros chamada Letreiros Express.

Com base nas informa\xE7\xF5es abaixo sobre um tipo de erro de retrabalho, crie um Procedimento Operacional Padr\xE3o (POP) completo e detalhado para PREVENIR a recorr\xEAncia deste erro.

## Dados do Erro
- **C\xF3digo:** ${input.errorCode}
- **Categoria/Setor:** ${input.errorCategory}
- **Descri\xE7\xE3o do erro:** ${input.errorDescription}
- **A\xE7\xE3o corretiva documentada:** ${input.correction}
${input.occurrenceCount ? `- **Ocorr\xEAncias registradas:** ${input.occurrenceCount}` : ""}
${input.totalCost ? `- **Custo total acumulado:** R$ ${input.totalCost.toFixed(2)}` : ""}

Crie um POP estruturado com:
1. **Objetivo** \u2014 o que este POP visa prevenir/garantir (2-3 frases)
2. **Passos detalhados** \u2014 m\xEDnimo 5 passos numerados, cada um com a\xE7\xE3o clara e verifica\xE7\xE3o
3. **Pontos de aten\xE7\xE3o** \u2014 riscos e cuidados espec\xEDficos
4. **Crit\xE9rio de aceita\xE7\xE3o** \u2014 como saber que o processo foi executado corretamente

O POP deve ser pr\xE1tico, direto e aplic\xE1vel no ch\xE3o de f\xE1brica. Use linguagem simples e imperativa (ex: "Verifique...", "Aplique...", "Confirme...").`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um especialista em qualidade industrial e cria\xE7\xE3o de POPs para f\xE1bricas de letreiros. Responda sempre em portugu\xEAs brasileiro." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pop_gerado",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "T\xEDtulo do POP (ex: POP - Preven\xE7\xE3o de Erro de Solda ES-01)" },
                objective: { type: "string", description: "Objetivo do POP em 2-3 frases" },
                steps: {
                  type: "array",
                  description: "Lista de passos do procedimento",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "number", description: "N\xFAmero do passo" },
                      action: { type: "string", description: "A\xE7\xE3o a ser executada" },
                      check: { type: "string", description: "Verifica\xE7\xE3o ou crit\xE9rio de aceita\xE7\xE3o do passo" }
                    },
                    required: ["step", "action", "check"],
                    additionalProperties: false
                  }
                },
                attention_points: {
                  type: "array",
                  description: "Pontos de aten\xE7\xE3o e riscos",
                  items: { type: "string" }
                },
                acceptance_criteria: { type: "string", description: "Crit\xE9rio geral de aceita\xE7\xE3o do procedimento" }
              },
              required: ["title", "objective", "steps", "attention_points", "acceptance_criteria"],
              additionalProperties: false
            }
          }
        }
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Falha ao interpretar resposta da IA");
      }
      const existingPops = await listPops();
      const popCode = `POP-${input.errorCode}`;
      const existing = existingPops.find((p) => p.code === popCode);
      const stepsText = [
        ...parsed.steps.map((s) => `${s.step}. ${s.action}
   \u2713 ${s.check}`),
        "",
        "\u26A0\uFE0F PONTOS DE ATEN\xC7\xC3O:",
        ...parsed.attention_points.map((p) => `\u2022 ${p}`),
        "",
        "\u2705 CRIT\xC9RIO DE ACEITA\xC7\xC3O:",
        parsed.acceptance_criteria
      ].join("\n");
      if (existing) {
        const rawVer = (existing.version ?? "1.0").replace(/^v/i, "");
        const currentVersion = parseFloat(rawVer) || 1;
        const newVersion = (currentVersion + 0.1).toFixed(1);
        await updatePop(existing.id, {
          title: parsed.title,
          objective: parsed.objective,
          steps: stepsText,
          version: newVersion
        });
        return { action: "updated", popCode, popId: existing.id, title: parsed.title, stepsText, parsed };
      } else {
        const result = await createPop({
          code: popCode,
          title: parsed.title,
          sector: input.errorCategory,
          objective: parsed.objective,
          steps: stepsText,
          responsible: "",
          version: "1.0"
        });
        return { action: "created", popCode, popId: result.id, title: parsed.title, stepsText, parsed };
      }
    }),
    // Incorpora o conhecimento de um erro a um POP existente via IA
    incorporateError: protectedProcedure.input(z23.object({
      popId: z23.number(),
      errorCode: z23.string(),
      errorDescription: z23.string(),
      errorCategory: z23.string(),
      correction: z23.string()
    })).mutation(async ({ input }) => {
      const pop = await getPopById(input.popId);
      if (!pop) throw new Error("POP n\xE3o encontrado");
      const prompt = `Voc\xEA \xE9 um especialista em qualidade industrial da Letreiros Express.

Abaixo est\xE1 um POP (Procedimento Operacional Padr\xE3o) existente e um novo conhecimento sobre um erro de retrabalho que deve ser incorporado a ele.

## POP Existente
- **C\xF3digo:** ${pop.code}
- **T\xEDtulo:** ${pop.title}
- **Objetivo atual:** ${pop.objective ?? "(n\xE3o definido)"}
- **Passos/Procedimento atual:**
${pop.steps}

## Novo Conhecimento a Incorporar
- **C\xF3digo do Erro:** ${input.errorCode}
- **Categoria/Setor:** ${input.errorCategory}
- **Descri\xE7\xE3o do erro:** ${input.errorDescription}
- **A\xE7\xE3o corretiva documentada:** ${input.correction}

## Tarefa
Atualize o POP incorporando o novo conhecimento de forma coerente e complementar ao conte\xFAdo existente. N\xE3o remova passos j\xE1 existentes \u2014 apenas enrique\xE7a, adicione ou refine.

Retorne o POP atualizado com:
1. **Objetivo** \u2014 revisado se necess\xE1rio (2-3 frases)
2. **Passos detalhados** \u2014 lista completa e enriquecida com os novos conhecimentos
3. **Pontos de aten\xE7\xE3o** \u2014 incluindo os novos riscos identificados
4. **Crit\xE9rio de aceita\xE7\xE3o** \u2014 revisado se necess\xE1rio

Use linguagem simples e imperativa ("Verifique...", "Aplique...", "Confirme...").`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um especialista em qualidade industrial e cria\xE7\xE3o de POPs para f\xE1bricas de letreiros. Responda sempre em portugu\xEAs brasileiro." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pop_atualizado",
            strict: true,
            schema: {
              type: "object",
              properties: {
                objective: { type: "string" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "number" },
                      action: { type: "string" },
                      check: { type: "string" }
                    },
                    required: ["step", "action", "check"],
                    additionalProperties: false
                  }
                },
                attention_points: { type: "array", items: { type: "string" } },
                acceptance_criteria: { type: "string" }
              },
              required: ["objective", "steps", "attention_points", "acceptance_criteria"],
              additionalProperties: false
            }
          }
        }
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Falha ao interpretar resposta da IA");
      }
      const stepsText = [
        ...parsed.steps.map((s) => `${s.step}. ${s.action}
   \u2713 ${s.check}`),
        "",
        "\u26A0\uFE0F PONTOS DE ATEN\xC7\xC3O:",
        ...parsed.attention_points.map((p) => `\u2022 ${p}`),
        "",
        "\u2705 CRIT\xC9RIO DE ACEITA\xC7\xC3O:",
        parsed.acceptance_criteria
      ].join("\n");
      const rawVer = (pop.version ?? "1.0").replace(/^v/i, "");
      const currentVersion = parseFloat(rawVer) || 1;
      const newVersion = (currentVersion + 0.1).toFixed(1);
      await updatePop(input.popId, {
        objective: parsed.objective,
        steps: stepsText,
        version: newVersion
      });
      return { popId: input.popId, popCode: pop.code, title: pop.title, newVersion, stepsText, parsed };
    }),
    // Gera um POP unificado por categoria abrangendo todos os erros da categoria
    generateFromCategory: protectedProcedure.input(z23.object({
      category: z23.string(),
      errors: z23.array(z23.object({
        code: z23.string(),
        description: z23.string(),
        correction: z23.string(),
        imageUrl: z23.string().optional().nullable()
      }))
    })).mutation(async ({ input }) => {
      const errorsText = input.errors.map(
        (e) => `- **${e.code}** \u2014 ${e.description}
  A\xE7\xE3o corretiva: ${e.correction}`
      ).join("\n");
      const errorImages = input.errors.filter((e) => e.imageUrl).map((e) => ({ code: e.code, description: e.description, imageUrl: e.imageUrl }));
      const prompt = `Voc\xEA \xE9 um especialista em qualidade e processos industriais da Letreiros Express (f\xE1brica de letreiros).
Crie um Procedimento Operacional Padr\xE3o (POP) UNIFICADO para a categoria "${input.category}" que abranja e previna TODOS os erros listados abaixo.

## Erros da Categoria ${input.category}
${errorsText}

## REGRA CR\xCDTICA \u2014 PRESERVA\xC7\xC3O INTEGRAL DAS INSTRU\xC7\xD5ES
\u26A0\uFE0F NUNCA abrevie, resuma, encurte ou remova qualquer parte do texto das "A\xE7\xF5es corretivas" fornecidas acima.
Cada campo "A\xE7\xE3o corretiva" deve aparecer INTEGRALMENTE no campo "action" do passo correspondente.
Voc\xEA pode COMPLEMENTAR com contexto adicional AP\xD3S o texto original, mas JAMAIS pode remover, encurtar ou parafrasear o conte\xFAdo original.
Se a a\xE7\xE3o corretiva original tiver 3 frases, o campo action deve conter essas mesmas 3 frases + eventuais complementos.

## Instru\xE7\xF5es
O POP deve:
- Ter um objetivo geral que cubra todos os erros da categoria
- Ter um passo dedicado para CADA erro listado, com o texto da a\xE7\xE3o corretiva PRESERVADO INTEGRALMENTE
- Cada passo deve ser claro, acion\xE1vel e verificar\xE1vel no ch\xE3o de f\xE1brica
- Incluir pontos de aten\xE7\xE3o espec\xEDficos para os riscos desta categoria
- Usar linguagem simples e imperativa ("Verifique...", "Aplique...", "Confirme...")
- Ser pr\xE1tico e direto, voltado para treinamento de m\xE3o-de-obra
- M\xEDnimo de 6 passos; adicione passos de prepara\xE7\xE3o e verifica\xE7\xE3o final al\xE9m dos passos de cada erro`;
      const response = await invokeLLM({
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um especialista em qualidade industrial e cria\xE7\xE3o de POPs para f\xE1bricas de letreiros. Responda sempre em portugu\xEAs brasileiro." },
          { role: "user", content: prompt }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "pop_categoria",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string", description: "T\xEDtulo do POP (ex: POP - Ilumina\xE7\xE3o)" },
                objective: { type: "string", description: "Objetivo geral do POP em 2-3 frases" },
                steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "number" },
                      action: { type: "string" },
                      check: { type: "string" }
                    },
                    required: ["step", "action", "check"],
                    additionalProperties: false
                  }
                },
                attention_points: { type: "array", items: { type: "string" } },
                acceptance_criteria: { type: "string" }
              },
              required: ["title", "objective", "steps", "attention_points", "acceptance_criteria"],
              additionalProperties: false
            }
          }
        }
      });
      const raw = response.choices[0]?.message?.content ?? "{}";
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error("Falha ao interpretar resposta da IA");
      }
      const stepsText = [
        ...parsed.steps.map((s) => `${s.step}. ${s.action}
   \u2713 ${s.check}`),
        "",
        "\u26A0\uFE0F PONTOS DE ATEN\xC7\xC3O:",
        ...parsed.attention_points.map((p) => `\u2022 ${p}`),
        "",
        "\u2705 CRIT\xC9RIO DE ACEITA\xC7\xC3O:",
        parsed.acceptance_criteria
      ].join("\n");
      const categorySlug = input.category.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
      const popCode = `POP-${categorySlug}`;
      const existingPops = await listPops();
      const existing = existingPops.find((p) => p.code === popCode);
      if (existing) {
        const rawVer = (existing.version ?? "1.0").replace(/^v/i, "");
        const newVersion = ((parseFloat(rawVer) || 1) + 0.1).toFixed(1);
        await updatePop(existing.id, { title: parsed.title, objective: parsed.objective, steps: stepsText, version: newVersion });
        return { action: "updated", popCode, popId: existing.id, title: parsed.title, stepsText, parsed, errorImages };
      } else {
        const result = await createPop({
          code: popCode,
          title: parsed.title,
          sector: input.category,
          objective: parsed.objective,
          steps: stepsText,
          responsible: "",
          version: "1.0"
        });
        return { action: "created", popCode, popId: result.id, title: parsed.title, stepsText, parsed, errorImages };
      }
    }),
    // Edição manual de texto do POP
    updateContent: publicProcedure.input(z23.object({
      id: z23.number(),
      title: z23.string().optional(),
      objective: z23.string().optional().nullable(),
      steps: z23.string().optional(),
      responsible: z23.string().optional().nullable(),
      version: z23.string().optional().nullable(),
      sector: z23.string().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updatePop(id, data);
    }),
    // Upload de imagem em anexo ao POP
    uploadImage: publicProcedure.input(z23.object({
      popId: z23.number(),
      fileName: z23.string(),
      url: z23.string().url(),
      key: z23.string().min(1),
      mimeType: z23.string().default("image/jpeg")
    })).mutation(async ({ input }) => {
      const pop = await getPopById(input.popId);
      if (!pop) throw new TRPCError5({ code: "NOT_FOUND", message: "POP n\xE3o encontrado" });
      let attachments = [];
      try {
        attachments = pop.attachments ? JSON.parse(pop.attachments) : [];
      } catch {
        attachments = [];
      }
      attachments.push(input.url);
      await updatePop(input.popId, { attachments: JSON.stringify(attachments) });
      return { url: input.url, attachments };
    }),
    // Remove imagem de anexo do POP
    removeImage: publicProcedure.input(z23.object({ popId: z23.number(), url: z23.string() })).mutation(async ({ input }) => {
      const pop = await getPopById(input.popId);
      if (!pop) throw new TRPCError5({ code: "NOT_FOUND", message: "POP n\xE3o encontrado" });
      let attachments = [];
      try {
        attachments = pop.attachments ? JSON.parse(pop.attachments) : [];
      } catch {
        attachments = [];
      }
      attachments = attachments.filter((u) => u !== input.url);
      await updatePop(input.popId, { attachments: JSON.stringify(attachments) });
      return { attachments };
    }),
    // Registrar acesso (visualização) a um POP
    registrarAcesso: protectedProcedure.input(z23.object({
      popId: z23.number(),
      popCode: z23.string(),
      popTitle: z23.string(),
      tipo: z23.enum(["visualizacao", "download"]).default("visualizacao")
    })).mutation(async ({ input, ctx }) => {
      const { getDb: getDb6 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db5 = await getDb6();
      if (!db5) return { success: false };
      const { popAcessos: popAcessos2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      await db5.insert(popAcessos2).values({
        popId: input.popId,
        popCode: input.popCode,
        popTitle: input.popTitle,
        usuarioNome: ctx.user.name ?? ctx.user.email ?? "desconhecido",
        usuarioEmail: ctx.user.email ?? null,
        tipo: input.tipo
      });
      return { success: true };
    }),
    // Relatório de acessos/downloads de POPs
    relatorioAcessos: protectedProcedure.input(z23.object({
      popId: z23.number().optional(),
      tipo: z23.enum(["visualizacao", "download", "todos"]).default("todos"),
      dataInicio: z23.string().optional(),
      // ISO date string
      dataFim: z23.string().optional()
    }).optional()).query(async ({ input }) => {
      const { getDb: getDb6 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db5 = await getDb6();
      if (!db5) return [];
      const { popAcessos: popAcessos2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { desc: descOrder, eq: eqOp, and: andOp, gte: gteOp, lte: lteOp } = await import("drizzle-orm");
      const conditions = [];
      if (input?.popId) conditions.push(eqOp(popAcessos2.popId, input.popId));
      if (input?.tipo && input.tipo !== "todos") conditions.push(eqOp(popAcessos2.tipo, input.tipo));
      if (input?.dataInicio) conditions.push(gteOp(popAcessos2.createdAt, new Date(input.dataInicio)));
      if (input?.dataFim) conditions.push(lteOp(popAcessos2.createdAt, /* @__PURE__ */ new Date(input.dataFim + "T23:59:59")));
      const where = conditions.length > 0 ? andOp(...conditions) : void 0;
      const rows = await db5.select().from(popAcessos2).where(where).orderBy(descOrder(popAcessos2.createdAt)).limit(500);
      return rows;
    }),
    // Estatísticas de acessos por POP
    estatisticasAcessos: protectedProcedure.query(async () => {
      const { getDb: getDb6 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db5 = await getDb6();
      if (!db5) return [];
      const { popAcessos: popAcessos2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const { sql: sqlRaw, desc: descOrder } = await import("drizzle-orm");
      const rows = await db5.select({
        popCode: popAcessos2.popCode,
        popTitle: popAcessos2.popTitle,
        totalVisualizacoes: sqlRaw`SUM(CASE WHEN ${popAcessos2.tipo} = 'visualizacao' THEN 1 ELSE 0 END)`,
        totalDownloads: sqlRaw`SUM(CASE WHEN ${popAcessos2.tipo} = 'download' THEN 1 ELSE 0 END)`,
        total: sqlRaw`COUNT(*)`,
        ultimoAcesso: sqlRaw`MAX(${popAcessos2.createdAt})`
      }).from(popAcessos2).groupBy(popAcessos2.popCode, popAcessos2.popTitle).orderBy(descOrder(sqlRaw`COUNT(*)`));
      return rows;
    })
  }),
  // ─── GERENCIAMENTO DE USUÁRIOS (master/admin) ────────────────────────────
  // Login/logout/sessão em si ficam a cargo do Better Auth (/api/auth/*,
  // authClient no client) — esta seção só cobre o CRUD administrativo, que
  // continua tendo regras de negócio próprias (modo bootstrap, roles sem
  // e-mail) sem equivalente pronto no plugin admin.
  localUsers: router({
    // Endpoint público para seletores de responsável em todo o sistema
    activeList: publicProcedure.query(async () => {
      const db5 = await getDb3();
      if (!db5) return [];
      const rows = await db5.select({ id: user.id, name: user.name, role: user.role }).from(user).where(or2(isNull2(user.banned), eq20(user.banned, false))).orderBy(asc6(user.name));
      return rows;
    }),
    list: publicProcedure.query(async ({ ctx }) => {
      const db5 = await getDb3();
      if (!db5) return [];
      const total = await countUsers();
      if (total > 0) assertAdminOrMaster(ctx);
      const rows = await db5.select({
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role,
        banned: user.banned
      }).from(user).orderBy(asc6(user.name));
      return rows.map((u) => ({ ...u, active: u.banned ? "nao" : "sim" }));
    }),
    create: publicProcedure.input(z23.object({
      name: z23.string().min(2),
      email: z23.string().email().optional(),
      password: z23.string().min(6),
      role: z23.enum(APP_ROLES)
    })).mutation(async ({ input, ctx }) => {
      const total = await countUsers();
      if (total > 0) assertAdminOrMaster(ctx);
      const needsEmail = input.role !== "producao" && input.role !== "empacotamento";
      if (needsEmail && !input.email) {
        throw new TRPCError5({ code: "BAD_REQUEST", message: "E-mail obrigat\xF3rio para esta fun\xE7\xE3o" });
      }
      const name = input.name.trim();
      const email = input.email ? input.email.toLowerCase() : `${slugifyName(name)}@local.internal`;
      const username2 = input.email ? email : slugifyName(name);
      const { user: user2 } = await auth.api.createUser({
        body: {
          email,
          password: input.password,
          name,
          role: input.role,
          data: { username: username2, displayUsername: name }
        }
      });
      return { id: user2.id, name: user2.name, email: user2.email, role: input.role };
    }),
    update: publicProcedure.input(z23.object({
      id: z23.string(),
      name: z23.string().min(2).optional(),
      role: z23.enum(APP_ROLES).optional(),
      password: z23.string().min(6).optional(),
      active: z23.enum(["sim", "nao"]).optional()
    })).mutation(async ({ input, ctx }) => {
      const total = await countUsers();
      if (total > 0) assertAdminOrMaster(ctx);
      const headers = fromNodeHeaders(ctx.req.headers);
      const { id, password, active, ...rest } = input;
      if (Object.keys(rest).length > 0) {
        await auth.api.adminUpdateUser({ body: { userId: id, data: rest }, headers });
      }
      if (password) {
        await auth.api.setUserPassword({ body: { userId: id, newPassword: password }, headers });
      }
      if (active === "nao") {
        await auth.api.banUser({ body: { userId: id }, headers });
      } else if (active === "sim") {
        await auth.api.unbanUser({ body: { userId: id }, headers });
      }
      return { ok: true };
    }),
    delete: publicProcedure.input(z23.object({ id: z23.string() })).mutation(async ({ input, ctx }) => {
      const total = await countUsers();
      if (total > 0) assertAdminOrMaster(ctx);
      await auth.api.removeUser({
        body: { userId: input.id },
        headers: fromNodeHeaders(ctx.req.headers)
      });
      return { ok: true };
    })
  }),
  // ─── PERMISSÕES POR ROLE ──────────────────────────────────────────────────
  permissions: router({
    getAll: protectedProcedure.use(requireRole("admin", "master")).query(async () => {
      const rows = await getAllRolePermissions();
      const matrix = {};
      for (const role of APP_ROLES) {
        matrix[role] = {};
        for (const page of PAGE_KEYS) {
          matrix[role][page] = role === "master" || role === "admin";
        }
      }
      for (const row of rows) {
        if (!matrix[row.role]) matrix[row.role] = {};
        matrix[row.role][row.pageKey] = row.canAccess === "sim";
      }
      return matrix;
    }),
    set: protectedProcedure.use(requireRole("admin", "master")).input(z23.object({
      role: z23.enum(APP_ROLES),
      pageKey: z23.string(),
      canAccess: z23.boolean()
    })).mutation(async ({ input }) => {
      return setRolePermission(input.role, input.pageKey, input.canAccess ? "sim" : "nao");
    }),
    myPermissions: publicProcedure.query(async ({ ctx }) => {
      if (!ctx.user) return [];
      return getPermissionsForRole(ctx.user.role);
    })
  }),
  // ─── COMENTÁRIOS DA BASE DE CONHECIMENTO ──────────────────────────────────────────────────────
  knowledgeComments: router({
    list: publicProcedure.input(z23.object({ knowledgeId: z23.number() })).query(async ({ input }) => {
      return listKnowledgeComments(input.knowledgeId);
    }),
    create: publicProcedure.input(z23.object({
      knowledgeId: z23.number(),
      author: z23.string().min(1).max(128).default("Equipe"),
      content: z23.string().min(1)
    })).mutation(async ({ input }) => {
      await createKnowledgeComment(input);
      return { ok: true };
    }),
    delete: publicProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ input }) => {
      await deleteKnowledgeComment(input.id);
      return { ok: true };
    })
  }),
  price: router({
    list: protectedProcedure.input(z23.object({ page: z23.number().optional() })).query(async ({ input }) => {
      return listPriceTableSections(input.page);
    }),
    getMeta: protectedProcedure.query(async () => {
      return getPriceTableMeta();
    }),
    update: protectedProcedure.input(z23.object({
      id: z23.number(),
      sectionTitle: z23.string().optional(),
      contentJson: z23.string().optional(),
      notes: z23.string().nullable().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updatePriceTableSection(id, data, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true };
    }),
    addSection: protectedProcedure.input(z23.object({
      page: z23.number(),
      sectionTitle: z23.string(),
      contentJson: z23.string(),
      notes: z23.string().nullable().optional()
    })).mutation(async ({ input, ctx }) => {
      const id = await addPriceTableSection(input, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true, id };
    }),
    deleteSection: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ input, ctx }) => {
      await deletePriceTableSection(input.id, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true };
    }),
    getHistory: protectedProcedure.input(z23.object({ limit: z23.number().optional() })).query(async ({ input }) => {
      return listPriceTableHistory(input.limit ?? 100);
    })
  }),
  // ─── PERFORMANCE ────────────────────────────────────────────────────────────────
  performance: performanceRouter,
  performanceAbc: performanceAbcRouter,
  performanceComercial: performanceComercialRouter,
  insightsComerciais: insightsComerciaisRouter,
  analiseGeografica: analiseGeograficaRouter,
  metricas: metricasRouter,
  crm: crmRouter,
  custoLed: custoLedRouter,
  auditoria: auditoriaRouter,
  cargos: cargosRouter,
  curriculos: curriculosRouter,
  empacotamento: empacotamentoRouter,
  // ─── BIBLIOTECA DE ARQUIVOS ─────────────────────────────────────────────────────
  bibliotecaArquivos: bibliotecaArquivosRouter,
  // ─── QUALIDADE ────────────────────────────────────────────────────────────────
  acoesCorretivas: acoesCorretivasRouter,
  metasRetrabalho: metasRetrabalhoRouter,
  planosAcao: planosAcaoRouter,
  alertas: alertasRouter,
  desempenhoColaborador: desempenhoColaboradorRouter,
  metasOperacionais: metasRouter,
  metaProdutos: metaProdutosRouter,
  financeiro: financeiroRouter,
  observacoesFinanceiras: observacoesFinanceirasRouter,
  desempenhoColabMensal: desempenhoColabMensalRouter,
  // LOGISTICA ────────────────────────────────────────────────────────────────────
  transportadoras: transportadorasRouter,
  cotacoesFrete: cotacoesFreteRouter,
  cte: cteRouter,
  logistica: router({
    buscarDadosOS: publicProcedure.input(z23.object({ osNumero: z23.string() })).mutation(async ({ input }) => {
      const { buscarDadosOSParaFrete: buscarDadosOSParaFrete2 } = await Promise.resolve().then(() => (init_mubisys_frete(), mubisys_frete_exports));
      return buscarDadosOSParaFrete2(input.osNumero);
    }),
    analisarAssertividade: publicProcedure.input(z23.object({ tipo: z23.string(), pergunta: z23.string().optional() })).mutation(async ({ input }) => {
      const { getDb: getDb6 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const db22 = await getDb6();
      const { cotacoesFrete: cotacoesFrete2, cotacaoOpcoes: cotacaoOpcoes2, transportadoras: transpTable } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      const cotacoes = db22 ? await db22.select().from(cotacoesFrete2).limit(50) : [];
      const opcoes = db22 ? await db22.select().from(cotacaoOpcoes2) : [];
      const transps = db22 ? await db22.select().from(transpTable) : [];
      const totalCotacoes = cotacoes.length;
      const concluidas = cotacoes.filter((c) => c.status === "concluido").length;
      const emAndamento = cotacoes.filter((c) => c.status === "fila" || c.status === "em_cotacao").length;
      const transpMap = {};
      opcoes.filter((o) => o.selecionada === "sim").forEach((o) => {
        const nome = o.transportadoraNome ?? "Desconhecida";
        transpMap[nome] = (transpMap[nome] ?? 0) + 1;
      });
      const rankingTransp = Object.entries(transpMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([nome, total]) => `${nome}: ${total}x`).join(", ");
      const destMap = {};
      cotacoes.forEach((c) => {
        const dest = `${c.municipio ?? ""}/${c.estado ?? ""}`;
        if (c.municipio) destMap[dest] = (destMap[dest] ?? 0) + 1;
      });
      const topDest = Object.entries(destMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([dest, total]) => `${dest}: ${total}x`).join(", ");
      const contexto = `
Dados do sistema de log\xEDstica:
- Total de cota\xE7\xF5es: ${totalCotacoes}
- Conclu\xEDdas: ${concluidas} (${totalCotacoes > 0 ? Math.round(concluidas / totalCotacoes * 100) : 0}%)
- Em andamento: ${emAndamento}
- Transportadoras cadastradas: ${transps.length}
- Transportadoras mais selecionadas: ${rankingTransp || "nenhuma ainda"}
- Destinos mais frequentes: ${topDest || "nenhum ainda"}
`;
      let prompt = "";
      if (input.tipo === "desempenho") {
        prompt = `Com base nos dados abaixo, analise o desempenho geral da log\xEDstica, identifique gargalos e sugira melhorias:
${contexto}`;
      } else if (input.tipo === "transportadoras") {
        prompt = `Com base nos dados abaixo, fa\xE7a um comparativo das transportadoras e recomende as melhores para diferentes tipos de envio:
${contexto}`;
      } else if (input.tipo === "oportunidades") {
        prompt = `Com base nos dados abaixo, identifique oportunidades de redu\xE7\xE3o de custo, melhoria de prazo e otimiza\xE7\xE3o de rotas:
${contexto}`;
      } else {
        prompt = `${input.pergunta}

Contexto do sistema:
${contexto}`;
      }
      const resp = await invokeLLM({
        messages: [
          { role: "system", content: "Voc\xEA \xE9 um especialista em log\xEDstica e transporte de cargas. Responda em portugu\xEAs brasileiro de forma objetiva e pr\xE1tica, com bullet points quando adequado." },
          { role: "user", content: prompt }
        ]
      });
      const analise = resp.choices?.[0]?.message?.content ?? "N\xE3o foi poss\xEDvel gerar a an\xE1lise.";
      return { analise };
    })
  })
});

// server/_core/context.ts
init_auth();
import { fromNodeHeaders as fromNodeHeaders2 } from "better-auth/node";
async function createContext(opts) {
  let user2 = null;
  try {
    const session2 = await auth.api.getSession({
      headers: fromNodeHeaders2(opts.req.headers)
    });
    if (session2) {
      user2 = {
        id: session2.user.id,
        name: session2.user.name,
        email: session2.user.email,
        role: session2.user.role
      };
    }
  } catch {
    user2 = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user: user2
  };
}

// server/_core/app.ts
var IS_SERVERLESS = process.env.VERCEL === "1";
async function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      // Vite/React gerencia o CSP em dev
      crossOriginEmbedderPolicy: false
      // Necessário para recursos externos (mapas, fontes)
    })
  );
  if (!IS_SERVERLESS) {
    const generalLimiter = rateLimit({
      windowMs: 60 * 1e3,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas requisi\xE7\xF5es. Tente novamente em alguns instantes." },
      skip: (req) => req.path.startsWith("/__manus__")
      // Não limitar ferramentas internas
    });
    app.use("/api", generalLimiter);
    const loginLimiter = rateLimit({
      windowMs: 60 * 1e3,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: "Muitas tentativas de login. Aguarde 1 minuto e tente novamente." }
    });
    app.use("/api/auth/sign-in", loginLimiter);
    app.use("/api/auth/sign-up", loginLimiter);
  }
  if (IS_SERVERLESS) {
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ limit: "2mb", extended: true }));
    const { authWebHandler: authWebHandler2 } = await Promise.resolve().then(() => (init_auth_web_handler(), auth_web_handler_exports));
    app.all("/api/auth/*", authWebHandler2);
  } else {
    app.all("/api/auth/*", toNodeHandler(auth));
    app.use(express.json({ limit: "2mb" }));
    app.use(express.urlencoded({ limit: "2mb", extended: true }));
  }
  const { createRouteHandler } = await import("uploadthing/express");
  const { uploadRouter: uploadRouter2 } = await Promise.resolve().then(() => (init_uploadthing(), uploadthing_exports));
  app.use("/api/uploadthing", createRouteHandler({ router: uploadRouter2 }));
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  const { handleSincronizarOS: handleSincronizarOS2, handleStatusSincronizacao: handleStatusSincronizacao2 } = await Promise.resolve().then(() => (init_scheduled_sync_os_handler(), scheduled_sync_os_handler_exports));
  app.post("/api/scheduled/sincronizarOS", handleSincronizarOS2);
  app.get("/api/scheduled/sincronizarOS/status", handleStatusSincronizacao2);
  return app;
}

// server/_core/serverless-handler.ts
var appPromise = null;
async function handler(req, res) {
  if (!appPromise) {
    appPromise = createApp();
  }
  const app = await appPromise;
  return app(req, res);
}
export {
  handler as default
};
