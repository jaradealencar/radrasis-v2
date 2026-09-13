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
function toPgPlaceholders(sql11) {
  let i = 0;
  return sql11.replace(/\?/g, () => `$${++i}`);
}
async function executeQuery(sql11, values = []) {
  const pool2 = getPool();
  try {
    console.log("\u{1F4DD} [QUERY] SQL:", sql11);
    console.log("\u{1F4DD} [QUERY] Values:", values);
    const result = await pool2.query(toPgPlaceholders(sql11), values);
    console.log("\u2705 [QUERY] Sucesso");
    return result;
  } catch (error) {
    console.error("\u274C [QUERY] Erro:", error);
    throw error;
  }
}
async function selectQuery(sql11, values = []) {
  const result = await executeQuery(sql11, values);
  return result.rows;
}
async function mutationQuery(sql11, values = []) {
  const result = await executeQuery(sql11, values);
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
  auditoriaCustoMarketing: () => auditoriaCustoMarketing,
  auditoriaRetrabalhos: () => auditoriaRetrabalhos,
  bibliotecaArquivos: () => bibliotecaArquivos,
  cargos: () => cargos,
  cargosFuncoes: () => cargosFuncoes,
  clienteCadastroStatusEnum: () => clienteCadastroStatusEnum,
  clienteNovosContato: () => clienteNovosContato,
  clienteOverrideStatusEnum: () => clienteOverrideStatusEnum,
  clienteOverrides: () => clienteOverrides,
  clientes: () => clientes,
  clientesPerfilCnpj: () => clientesPerfilCnpj,
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
  custoMarketingItens: () => custoMarketingItens,
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
  inteligenciaAcaoResultadoEnum: () => inteligenciaAcaoResultadoEnum,
  inteligenciaAcaoStatusEnum: () => inteligenciaAcaoStatusEnum,
  inteligenciaAcaoTipoEnum: () => inteligenciaAcaoTipoEnum,
  inteligenciaAcoesClientes: () => inteligenciaAcoesClientes,
  inteligenciaClientesAcessos: () => inteligenciaClientesAcessos,
  inteligenciaClientesContatos: () => inteligenciaClientesContatos,
  ishikawaCategoriaEnum: () => ishikawaCategoriaEnum,
  ishikawaCausas: () => ishikawaCausas,
  ishikawaPlanos: () => ishikawaPlanos,
  kanbanStatusEnum: () => kanbanStatusEnum,
  knowledgeBase: () => knowledgeBase,
  knowledgeComments: () => knowledgeComments,
  knowledgeSuggestions: () => knowledgeSuggestions,
  kpisCargo: () => kpisCargo,
  leadsCnpjQualificados: () => leadsCnpjQualificados,
  ledTipos: () => ledTipos,
  marketingConfig: () => marketingConfig,
  marketingConfigAuditoria: () => marketingConfigAuditoria,
  metaProdutos: () => metaProdutos,
  metasComerciais: () => metasComerciais,
  metasOperacionais: () => metasOperacionais,
  metasRetrabalho: () => metasRetrabalho,
  metricas: () => metricas,
  modalidadeFreteEnum: () => modalidadeFreteEnum,
  mubisysApiCache: () => mubisysApiCache,
  nivelConfiancaSinalEnum: () => nivelConfiancaSinalEnum,
  observacoesFinanceirasMensais: () => observacoesFinanceirasMensais,
  origemVinculoCnpjEnum: () => origemVinculoCnpjEnum,
  performanceAbc: () => performanceAbc,
  performanceAuditada: () => performanceAuditada,
  performanceComercial: () => performanceComercial,
  performanceMensal: () => performanceMensal,
  performancePropostasFollowup: () => performancePropostasFollowup,
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
  radarMercadoConfig: () => radarMercadoConfig,
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
  scoreLeadCnpjEnum: () => scoreLeadCnpjEnum,
  session: () => session,
  simNaoEnum: () => simNaoEnum,
  sinaisMercado: () => sinaisMercado,
  statusSinalMercadoEnum: () => statusSinalMercadoEnum,
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
var tipoRegistroEnum, retrabalhoTipoEnum, tipoResponsavelEnum, retrabalhoClasseEnum, simNaoEnum, routineFrequencyEnum, routineStatusEnum, regulationTypeEnum, popAcessoTipoEnum, formaCotacaoEnum, cotacaoStatusEnum, tipoPrazoEnum, modalidadeFreteEnum, auditoriaAcaoEnum, kanbanStatusEnum, acaoCorretivaStatusEnum, planoAcaoStatusEnum, ishikawaCategoriaEnum, prioridadeEnum, acao5w2hStatusEnum, alertaTipoEnum, alertaSeveridadeEnum, alertaStatusEnum, abcTipoEnum, crmCanalEnum, clienteOverrideStatusEnum, statusValidacaoEnum, turnoEnum, analiseCurriculoStatusEnum, syncStatusEnum, clienteCadastroStatusEnum, crmPropostaStatusEnum, cnqTipoEnum, abcClassificacaoEnum, planoAcaoComercialStatusEnum, prioridadeComCriticaEnum, inteligenciaAcaoTipoEnum, inteligenciaAcaoStatusEnum, inteligenciaAcaoResultadoEnum, scoreLeadCnpjEnum, nivelConfiancaSinalEnum, statusSinalMercadoEnum, errorLibrary, retrabalhos, faturamento, knowledgeBase, suppliers, routines, regulations, pops, popAcessos, knowledgeComments, priceTableSections, priceTableMeta, priceTableHistory, APP_ROLES, appRoleEnum, PAGE_KEYS, user, session, account, verification, rolePermissions, transportadoras, transportadoraAvaliacoes, transportadoraFiliais, transportadoraCidades, cotacoesFrete, cotacaoOpcoes, cotacaoComentarios, cteImportacoes, performanceMensal, auditoriaRetrabalhos, cargosFuncoes, empacotamentoModelos, empacotamentoTabelaPrecos, empacotamentoModelosCaixa, empacotamentoChecklistItens, empacotamentoPedidos, empacotamentoPedidoUsuarios, empacotamentoPedidoFotos, empacotamentoPedidoChecklist, empacotamentoInsumos, empacotamentoConsumoCaixa, empacotamentoCustoFuncionario, empacotamentoInsumosLetreiro, empacotamentoCronometroPausas, empacotamentoConfigProdutividade, empacotamentoChecklistLetreitoItens, empacotamentoPedidoChecklistLetreiro, empacotamentoSessoes, empacotamentoSessoesPausas, knowledgeSuggestions, acoesCorretivas, planosAcao, ishikawaCausas, acoes5w2h, metasRetrabalho, alertasSistema, bibliotecaArquivos, abcCache, metasOperacionais, financeiroMensal, observacoesFinanceirasMensais, desempenhoColaboradorMensal, metaProdutos, metasComerciais, historicoOs, historicoOrcamentos, crmMetas, crmContatos, clienteOverrides, custoMarketing, auditoriaCustoMarketing, custoMarketingItens, marketingConfig, marketingConfigAuditoria, custosFixos, dividasParcelamentos, dreMensal, crmScripts, inteligenciaAcoesClientes, inteligenciaClientesAcessos, inteligenciaClientesContatos, leadsCnpjQualificados, origemVinculoCnpjEnum, clientesPerfilCnpj, radarMercadoConfig, sinaisMercado, ledTipos, custoLedLancamentos, crmFaixaEtiquetas, performanceAuditada, clienteNovosContato, performancePropostasFollowup, mubisysApiCache, crmAtividadeLog, financeirosMensais, cargos, responsabilidadesCargo, kpisCargo, analiseCurriculos, syncLogs, erpOsCache, clientes, crmPropostas, performanceComercial, custoLed, cotacoesItens, cnqRegistros, errosPadrao, ishikawaPlanos, performanceAbc, planosAcaoComercial, planosAcaoQualidade, regulamentos, metricas;
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
    inteligenciaAcaoTipoEnum = pgEnum("inteligencia_acao_tipo", ["primeira_sem_segunda", "atraso_recompra", "alto_volume_baixa_margem"]);
    inteligenciaAcaoStatusEnum = pgEnum("inteligencia_acao_status", ["pendente", "concluida", "adiada", "descartada"]);
    inteligenciaAcaoResultadoEnum = pgEnum("inteligencia_acao_resultado", ["contato_realizado", "sem_resposta", "projeto_futuro", "orcamento_solicitado", "compra", "adiamento", "sem_interesse"]);
    scoreLeadCnpjEnum = pgEnum("score_lead_cnpj", ["A", "B", "C", "D"]);
    nivelConfiancaSinalEnum = pgEnum("nivel_confianca_sinal", ["confirmado", "inferencia"]);
    statusSinalMercadoEnum = pgEnum("status_sinal_mercado", ["novo", "qualificando", "oportunidade", "associado_cliente", "descartado", "expirado"]);
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
      googleMapsUrl: varchar("googleMapsUrl", { length: 512 }),
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
      estadoIdx: index("historico_os_estado_idx").on(t2.estado),
      // Permite upsert idempotente por OS (sync incremental) — sem isso, rodar o
      // sync duas vezes pro mesmo mês duplicava toda OS já importada.
      osNumeroIdx: uniqueIndex("historico_os_os_numero_idx").on(t2.osNumero)
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
      mesAnoIdx: index("historico_orcamentos_mes_ano_idx").on(t2.mes, t2.ano),
      orcNumeroIdx: uniqueIndex("historico_orcamentos_orc_numero_idx").on(t2.orcNumero)
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
      investimentoAquisicao: decimal("investimento_aquisicao", { precision: 14, scale: 2 }),
      investimentoReativacao: decimal("investimento_reativacao", { precision: 14, scale: 2 }),
      // Soma de investimentoAquisicao + investimentoReativacao, mantida por compatibilidade com consumidores existentes.
      // null somente se os dois componentes forem null.
      investimento: decimal("investimento", { precision: 14, scale: 2 }),
      observacao: text("observacao"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    auditoriaCustoMarketing = pgTable("auditoria_custo_marketing", {
      id: serial("id").primaryKey(),
      custoMarketingId: integer("custoMarketingId"),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      acao: auditoriaAcaoEnum("acao").notNull(),
      usuarioId: text("usuarioId"),
      usuarioNome: varchar("usuarioNome", { length: 128 }),
      usuarioRole: varchar("usuarioRole", { length: 32 }),
      valoresAnteriores: text("valoresAnteriores"),
      // JSON: snapshot antes da alteração (null em CRIACAO)
      valoresNovos: text("valoresNovos"),
      // JSON: snapshot depois da alteração (null em EXCLUSAO)
      createdAt: timestamp("createdAt").defaultNow().notNull()
    });
    custoMarketingItens = pgTable("custo_marketing_itens", {
      id: serial("id").primaryKey(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      categoria: varchar("categoria", { length: 32 }).notNull().default("aquisicao"),
      // "aquisicao" | "reativacao"
      fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
      tipo: varchar("tipo", { length: 128 }),
      despesa: varchar("despesa", { length: 256 }),
      descricao: text("descricao"),
      valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
      dataVencimento: timestamp("dataVencimento"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    marketingConfig = pgTable("marketing_config", {
      id: serial("id").primaryKey(),
      // Meses de calendário sem compra para o cliente contar como "reativado" ao
      // comprar de novo. Independente de MESES_INATIVIDADE_PARA_NOVO
      // (performanceComercial.ts) — de propósito: mudar este valor não pode
      // afetar Performance Comercial/Inteligência de Clientes/snapshots já
      // auditados, só o relatório de Marketing. Ver server/services/marketingFinanceiroClientes.ts.
      mesesInatividadeReativacao: integer("mesesInatividadeReativacao").notNull().default(6),
      // Usado só como fallback quando o pedido não tem historico_os.contribuicaoReais
      // preenchido — o método primário de margem é o valor real por pedido.
      percentualMargemFallback: decimal("percentualMargemFallback", { precision: 5, scale: 2 }).notNull().default("51.00"),
      cacMaximo: decimal("cacMaximo", { precision: 14, scale: 2 }),
      custoReativacaoMaximo: decimal("custoReativacaoMaximo", { precision: 14, scale: 2 }),
      roiMinimoPct: decimal("roiMinimoPct", { precision: 7, scale: 2 }),
      ticketMedioMinimo: decimal("ticketMedioMinimo", { precision: 14, scale: 2 }),
      metaClientesNovosMes: integer("metaClientesNovosMes"),
      metaClientesReativadosMes: integer("metaClientesReativadosMes"),
      aumentoMaximoCacMensalPct: decimal("aumentoMaximoCacMensalPct", { precision: 7, scale: 2 }),
      // 0 = sem janela (atribui todo o faturamento do mês calendário ao grupo do
      // cliente naquele mês — comportamento atual/padrão). 30/60/90 = atribui só
      // o faturamento do cliente dentro de N dias da data em que ele virou
      // novo/reativado.
      janelaAtribuicaoDias: integer("janelaAtribuicaoDias").notNull().default(0),
      // ── Campos da aba "Resultado Geral e Ponto de Equilíbrio" ──
      // Direcionador usado para ratear custo fixo em análises gerenciais por
      // pedido/vendedor (nunca na ponte de resultado consolidada, que sempre usa
      // financeiro_mensal.despesasFixas real). Valores válidos: "pedidos" |
      // "faturamento" | "custo_direto" | "rateio_erp" | "personalizado".
      // "rateio_erp" reaproveita historico_os.custoFixo (já calculado pelo MubiSys).
      direcionadorRateio: varchar("direcionadorRateio", { length: 32 }).notNull().default("faturamento"),
      // Documenta a suposição de que despesasFixas/despesasFinanceiras de
      // financeiro_mensal NÃO incluem o investimento de custo_marketing (fontes
      // diferentes) — se marcado true, o investimento de marketing não é
      // subtraído de novo como linha própria na ponte de resultado, para não
      // contar 2x.
      custosFinanceirosIncluemMarketing: boolean("custosFinanceirosIncluemMarketing").notNull().default(false),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    marketingConfigAuditoria = pgTable("marketing_config_auditoria", {
      id: serial("id").primaryKey(),
      acao: auditoriaAcaoEnum("acao").notNull(),
      usuarioId: text("usuarioId"),
      usuarioNome: varchar("usuarioNome", { length: 128 }),
      usuarioRole: varchar("usuarioRole", { length: 32 }),
      valoresAnteriores: text("valoresAnteriores"),
      // JSON: snapshot antes da alteração (null em CRIACAO)
      valoresNovos: text("valoresNovos"),
      // JSON: snapshot depois da alteração (null em EXCLUSAO)
      createdAt: timestamp("createdAt").defaultNow().notNull()
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
    inteligenciaAcoesClientes = pgTable("inteligencia_acoes_clientes", {
      id: serial("id").primaryKey(),
      tipo: inteligenciaAcaoTipoEnum("tipo").notNull(),
      empresaKey: varchar("empresa_key", { length: 256 }).notNull(),
      // normalizeEmpresaKey(empresa) — chave de idempotência
      empresa: varchar("empresa", { length: 256 }).notNull(),
      // nome de exibição (grafia mais recente observada)
      vendedor: varchar("vendedor", { length: 128 }),
      // vendedor da compra mais recente do cliente — para filtrar a fila por responsável
      titulo: varchar("titulo", { length: 256 }).notNull(),
      motivo: text("motivo").notNull(),
      evidenciaJson: text("evidencia_json").notNull(),
      // fatos que sustentam a ação (datas, valores, cálculo)
      prioridade: integer("prioridade").notNull().default(0),
      // 0-100, prioridade operacional (não é probabilidade de compra)
      prioridadeFatoresJson: text("prioridade_fatores_json"),
      // componentes/pesos que formaram a prioridade
      status: inteligenciaAcaoStatusEnum("status").notNull().default("pendente"),
      responsavel: varchar("responsavel", { length: 128 }),
      proximoPasso: text("proximo_passo"),
      prazo: date("prazo"),
      resultado: inteligenciaAcaoResultadoEnum("resultado"),
      resultadoObservacao: text("resultado_observacao"),
      versaoRegra: varchar("versao_regra", { length: 16 }).notNull().default("v1"),
      dataAnalise: timestamp("data_analise").defaultNow().notNull(),
      // quando a evidência foi calculada
      resolvidoEm: timestamp("resolvido_em"),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      tipoEmpresaUnique: uniqueIndex("inteligencia_acoes_tipo_empresa_unique").on(t2.tipo, t2.empresaKey),
      statusIdx: index("inteligencia_acoes_status_idx").on(t2.status)
    }));
    inteligenciaClientesAcessos = pgTable("inteligencia_clientes_acessos", {
      id: serial("id").primaryKey(),
      userId: text("user_id").notNull(),
      // user.id (Better Auth)
      userName: varchar("user_name", { length: 128 }).notNull(),
      acessadoEm: timestamp("acessado_em").defaultNow().notNull()
    }, (t2) => ({
      userIdx: index("inteligencia_clientes_acessos_user_idx").on(t2.userId, t2.acessadoEm)
    }));
    inteligenciaClientesContatos = pgTable("inteligencia_clientes_contatos", {
      id: serial("id").primaryKey(),
      empresaKey: varchar("empresa_key", { length: 256 }).notNull(),
      empresa: varchar("empresa", { length: 256 }).notNull(),
      userId: text("user_id").notNull(),
      // user.id (Better Auth)
      vendedor: varchar("vendedor", { length: 128 }).notNull(),
      // nome de exibição no momento do registro
      observacao: text("observacao"),
      contatadoEm: timestamp("contatado_em").defaultNow().notNull()
    }, (t2) => ({
      empresaIdx: index("inteligencia_clientes_contatos_empresa_idx").on(t2.empresaKey, t2.contatadoEm)
    }));
    leadsCnpjQualificados = pgTable("leads_cnpj_qualificados", {
      id: serial("id").primaryKey(),
      cnpj: varchar("cnpj", { length: 14 }).notNull().unique(),
      // sem máscara
      razaoSocial: varchar("razao_social", { length: 256 }).notNull(),
      nomeFantasia: varchar("nome_fantasia", { length: 256 }),
      uf: varchar("uf", { length: 2 }),
      municipio: varchar("municipio", { length: 128 }),
      cnaePrincipal: varchar("cnae_principal", { length: 16 }),
      situacaoCadastral: varchar("situacao_cadastral", { length: 32 }),
      porte: varchar("porte", { length: 40 }),
      capitalSocial: decimal("capital_social", { precision: 16, scale: 2 }),
      dataInicioAtividade: varchar("data_inicio_atividade", { length: 32 }),
      aprovado: boolean("aprovado").notNull().default(false),
      score: scoreLeadCnpjEnum("score"),
      // null quando rejeitado automaticamente
      motivoRejeicao: text("motivo_rejeicao"),
      cnaesRelevantesJson: text("cnaes_relevantes_json"),
      // CNAEs que bateram na lista-alvo
      fatoresScoreJson: text("fatores_score_json"),
      qsaJson: text("qsa_json"),
      dadosJson: text("dados_json").notNull(),
      // resposta bruta da OpenCNPJ, para auditoria
      resumoIa: text("resumo_ia"),
      // texto gerado pelo prompt v1 (potencial/argumento/quem abordar) — null se rejeitado ou IA indisponível
      versaoPromptIa: varchar("versao_prompt_ia", { length: 16 }),
      versaoRegra: varchar("versao_regra", { length: 16 }).notNull().default("v1"),
      consultadoPor: varchar("consultado_por", { length: 128 }),
      consultadoEm: timestamp("consultado_em").defaultNow().notNull(),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    origemVinculoCnpjEnum = pgEnum("origem_vinculo_cnpj", ["erp_os_cache", "manual", "mubisys"]);
    clientesPerfilCnpj = pgTable("clientes_perfil_cnpj", {
      id: serial("id").primaryKey(),
      empresaKey: varchar("empresa_key", { length: 256 }).notNull().unique(),
      // normalizeEmpresaKey(empresa) de historico_os
      empresaExibicao: varchar("empresa_exibicao", { length: 256 }).notNull(),
      cnpj: varchar("cnpj", { length: 14 }).notNull(),
      razaoSocial: varchar("razao_social", { length: 256 }),
      situacaoCadastral: varchar("situacao_cadastral", { length: 32 }),
      dataInicioAtividade: varchar("data_inicio_atividade", { length: 32 }),
      idadeAnos: decimal("idade_anos", { precision: 5, scale: 1 }),
      porte: varchar("porte", { length: 40 }),
      naturezaJuridica: varchar("natureza_juridica", { length: 128 }),
      qtdSocios: integer("qtd_socios"),
      capitalSocial: decimal("capital_social", { precision: 16, scale: 2 }),
      uf: varchar("uf", { length: 2 }),
      municipio: varchar("municipio", { length: 128 }),
      cnaePrincipal: varchar("cnae_principal", { length: 16 }),
      dadosJson: text("dados_json").notNull(),
      // resposta bruta da OpenCNPJ
      origem: origemVinculoCnpjEnum("origem").notNull(),
      vinculadoPor: varchar("vinculado_por", { length: 128 }),
      vinculadoEm: timestamp("vinculado_em").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    radarMercadoConfig = pgTable("radar_mercado_config", {
      id: serial("id").primaryKey(),
      // single-row: sempre id=1
      regioesJson: text("regioes_json").notNull(),
      // array de UF, ex: ["MS","MT","GO","DF","SP",...]
      segmentosAlvoJson: text("segmentos_alvo_json").notNull(),
      // ex: ["Gráficas","Comunicação visual"]
      concorrentesConhecidosJson: text("concorrentes_conhecidos_json").notNull().default("[]"),
      termosBuscaJson: text("termos_busca_json").notNull(),
      // templates de busca, ex: "gráfica nova {cidade}"
      exclusoesJson: text("exclusoes_json").notNull().default("[]"),
      // termos/domínios a ignorar
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    });
    sinaisMercado = pgTable("sinais_mercado", {
      id: serial("id").primaryKey(),
      empresa: varchar("empresa", { length: 256 }),
      localizacaoTexto: varchar("localizacao_texto", { length: 256 }),
      uf: varchar("uf", { length: 2 }),
      municipio: varchar("municipio", { length: 128 }),
      tipoEvento: varchar("tipo_evento", { length: 64 }),
      // inauguração, reforma, expansão, edital, concorrente, outro
      evidenciaTrecho: text("evidencia_trecho").notNull(),
      // trecho/síntese da fonte, nunca a página inteira
      url: text("url").notNull(),
      urlHash: varchar("url_hash", { length: 64 }).notNull().unique(),
      // sha256(url) — deduplicação
      publicador: varchar("publicador", { length: 256 }),
      dataPublicacao: varchar("data_publicacao", { length: 32 }),
      // texto — nem toda fonte dá data ISO
      dataEvento: varchar("data_evento", { length: 32 }),
      dataColeta: timestamp("data_coleta").defaultNow().notNull(),
      nivelConfianca: nivelConfiancaSinalEnum("nivel_confianca").notNull().default("inferencia"),
      relacaoProdutos: text("relacao_produtos"),
      // por que isso interessa ao nosso catálogo — null se não avaliado
      proximoPasso: text("proximo_passo"),
      validadeAte: date("validade_ate"),
      // sinal deixa de ser considerado novo depois dessa data
      jaClienteEmpresaKey: varchar("ja_cliente_empresa_key", { length: 256 }),
      // vínculo com historico_os, se identificado
      status: statusSinalMercadoEnum("status").notNull().default("novo"),
      termoBuscaOrigem: varchar("termo_busca_origem", { length: 256 }),
      createdAt: timestamp("createdAt").defaultNow().notNull(),
      updatedAt: timestamp("updatedAt").defaultNow().notNull()
    }, (t2) => ({
      statusIdx: index("sinais_mercado_status_idx").on(t2.status)
    }));
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
      diasInicio: integer("dias_inicio").notNull(),
      diasFim: integer("dias_fim").notNull(),
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
    performancePropostasFollowup = pgTable("performance_propostas_followup", {
      id: serial("id").primaryKey(),
      orcNumero: varchar("orcNumero", { length: 32 }).notNull(),
      empresa: varchar("empresa", { length: 256 }).notNull(),
      mes: integer("mes").notNull(),
      ano: integer("ano").notNull(),
      usuarioId: text("usuarioId"),
      usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
      motivo: text("motivo").notNull(),
      contatadoEm: timestamp("contatadoEm").defaultNow().notNull()
    }, (t2) => ({
      orcNumeroIdx: index("performance_propostas_followup_orc_idx").on(t2.orcNumero),
      mesAnoIdx: index("performance_propostas_followup_mes_ano_idx").on(t2.mes, t2.ano)
    }));
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

// shared/const.ts
var UNAUTHED_ERR_MSG, NOT_ADMIN_ERR_MSG;
var init_const = __esm({
  "shared/const.ts"() {
    "use strict";
    UNAUTHED_ERR_MSG = "Please login (10001)";
    NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
  }
});

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
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
var t, router, publicProcedure, requireUser, protectedProcedure, adminProcedure;
var init_trpc = __esm({
  "server/_core/trpc.ts"() {
    "use strict";
    init_const();
    t = initTRPC.context().create({
      transformer: superjson
    });
    router = t.router;
    publicProcedure = t.procedure;
    requireUser = t.middleware(async (opts) => {
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
    protectedProcedure = t.procedure.use(requireUser);
    adminProcedure = t.procedure.use(requireRole("admin", "master"));
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
      anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
      MUBISYS_ACCESS_TOKEN: process.env.MUBISYS_ACCESS_TOKEN ?? "",
      MUBISYS_PUBLIC_KEY: process.env.MUBISYS_PUBLIC_KEY ?? "",
      // Radar de Mercado (Inteligência de Clientes) — SerpAPI (serpapi.com). Trocado
      // do Google Custom Search JSON API em 2026-09 porque o Google fechou essa API
      // para contas novas em 2025 (ver docs/radar-mercado.md). Sem essa chave, o
      // radar fica com a configuração pronta mas a busca desativada.
      serpapiKey: process.env.SERPAPI_KEY ?? ""
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
function ajustarDias(dataISO, dias) {
  const [ano, mes, dia] = dataISO.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 1, dia));
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
function refiltrarPorJanela(itens, campo, datainicial, datafinal) {
  return itens.filter((item) => {
    const valor = item[campo];
    const dia = valor?.slice(0, 10);
    return !!dia && dia >= datainicial && dia <= datafinal;
  });
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
  const filtrodata = opts.filtrodata ?? "CADASTRO";
  const campo = CAMPO_DATA_OS[filtrodata];
  const { itens, completo } = await listarTudo(
    "ordem-servico",
    {
      status: opts.status ?? "TODOS",
      filtrodata,
      datainicial: campo ? ajustarDias(opts.datainicial, -1) : opts.datainicial,
      datafinal: campo ? ajustarDias(opts.datafinal, 1) : opts.datafinal
    },
    { timeoutMs: TIMEOUT_LISTA_MS }
  );
  if (!campo) return { itens, completo };
  return { itens: refiltrarPorJanela(itens, campo, opts.datainicial, opts.datafinal), completo };
}
async function buscarOSPorNumero(numero) {
  return mubisysGetOrNull(
    `ordem-servico/numero/${encodeURIComponent(numero)}`,
    void 0,
    { timeoutMs: TIMEOUT_PONTUAL_MS }
  );
}
async function listarOrcamentosMubiSys(opts) {
  const { itens, completo } = await listarTudo(
    "orcamento",
    {
      status: opts.status ?? "TODOS",
      filtrodata: "CADASTRO",
      datainicial: ajustarDias(opts.datainicial, -1),
      datafinal: ajustarDias(opts.datafinal, 1)
    },
    // per_page=500 (padrão de listarTudo) estoura TIMEOUT_LISTA_MS em janelas de
    // mês cheio (~800 orçamentos) — medido em 17/08/2026. 200 reduz o payload por
    // página o bastante para caber no orçamento de tempo sem precisar de retry.
    // Medido em 12/09/2026: o tempo por página NÃO escala linear com per_page — com
    // per_page=200 a API degrada a cada página (21s, 24s, >45s/timeout na 3ª), enquanto
    // per_page=50 fica estável em ~3,5-4,7s por página. Chamadores sensíveis a esse
    // limite (ex.: CRM) devem passar um perPage menor.
    { timeoutMs: TIMEOUT_LISTA_MS, perPage: opts.perPage ?? 200 }
  );
  return {
    itens: refiltrarPorJanela(itens, "data_cadastro", opts.datainicial, opts.datafinal),
    completo
  };
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
var BASE_URL, MubiSysError, TIMEOUT_PADRAO_MS, TIMEOUT_PONTUAL_MS, TIMEOUT_LISTA_MS, CAMPO_DATA_OS;
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
    CAMPO_DATA_OS = {
      CADASTRO: "data_cadastro",
      APROVACAO: "data_aprovacao",
      ENTREGA: "data_entrega",
      FATURAMENTO: "data_faturamento",
      CANCELAMENTO: "data_cancelamento"
    };
    avisarSeTokenVencido();
  }
});

// shared/dias-uteis.ts
function ehDiaUtil(d) {
  const diaSemana = d.getDay();
  return diaSemana !== 0 && diaSemana !== 6;
}
function diasUteisEntre(inicio, fim) {
  if (fim <= inicio) return 0;
  const cursor = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate());
  const alvo = new Date(fim.getFullYear(), fim.getMonth(), fim.getDate());
  let count3 = 0;
  while (cursor < alvo) {
    cursor.setDate(cursor.getDate() + 1);
    if (ehDiaUtil(cursor)) count3++;
  }
  return count3;
}
var init_dias_uteis = __esm({
  "shared/dias-uteis.ts"() {
    "use strict";
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
    init_dias_uteis();
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
    const sql11 = 'SELECT * FROM erp_os_cache WHERE "numeroOs" = ?';
    const result = await selectQuery(sql11, [osNumero]);
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
  insertAuditLogCustoMarketing: () => insertAuditLogCustoMarketing,
  insertAuditLogMarketingConfig: () => insertAuditLogMarketingConfig,
  listArquivosBibliotecaComConteudo: () => listArquivosBibliotecaComConteudo,
  listAuditLogs: () => listAuditLogs,
  listAuditLogsCustoMarketing: () => listAuditLogsCustoMarketing,
  listAuditLogsMarketingConfig: () => listAuditLogsMarketingConfig,
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
async function insertAuditLogCustoMarketing(data) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.insert(auditoriaCustoMarketing).values({
    custoMarketingId: data.custoMarketingId ?? null,
    mes: data.mes,
    ano: data.ano,
    acao: data.acao,
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    usuarioRole: data.usuarioRole ?? null,
    valoresAnteriores: data.valoresAnteriores ? JSON.stringify(data.valoresAnteriores) : null,
    valoresNovos: data.valoresNovos ? JSON.stringify(data.valoresNovos) : null
  });
}
async function listAuditLogsCustoMarketing(ano) {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(auditoriaCustoMarketing).where(eq3(auditoriaCustoMarketing.ano, ano)).orderBy(desc3(auditoriaCustoMarketing.createdAt));
}
async function insertAuditLogMarketingConfig(data) {
  const db5 = await getDb3();
  if (!db5) return;
  await db5.insert(marketingConfigAuditoria).values({
    acao: data.acao,
    usuarioId: data.usuarioId ?? null,
    usuarioNome: data.usuarioNome ?? null,
    usuarioRole: data.usuarioRole ?? null,
    valoresAnteriores: data.valoresAnteriores ? JSON.stringify(data.valoresAnteriores) : null,
    valoresNovos: data.valoresNovos ? JSON.stringify(data.valoresNovos) : null
  });
}
async function listAuditLogsMarketingConfig(limit = 50) {
  const db5 = await getDb3();
  if (!db5) return [];
  return db5.select().from(marketingConfigAuditoria).orderBy(desc3(marketingConfigAuditoria.createdAt)).limit(limit);
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

// server/integrations/anthropic-client.ts
import Anthropic from "@anthropic-ai/sdk";
function getClient() {
  if (!ENV.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY n\xE3o configurada \u2014 o chat de IA do Painel Financeiro est\xE1 desativado.");
  }
  if (!client) client = new Anthropic({ apiKey: ENV.anthropicApiKey });
  return client;
}
async function perguntarSobreFinanceiro(contextoDados, historico, pergunta) {
  const anthropic = getClient();
  const messages = [
    ...historico.map((m) => ({
      role: m.role,
      content: m.texto
    })),
    { role: "user", content: pergunta }
  ];
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: contextoDados }
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude n\xE3o retornou texto na resposta.");
  return textBlock.text;
}
async function perguntarSobreClientes(systemPrompt, contextoDados, pergunta) {
  const anthropic = getClient();
  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
      { type: "text", text: contextoDados }
    ],
    thinking: { type: "adaptive" },
    output_config: { effort: "high" },
    messages: [{ role: "user", content: pergunta }]
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("Claude n\xE3o retornou texto na resposta.");
  return textBlock.text;
}
var client, SYSTEM_PROMPT;
var init_anthropic_client = __esm({
  "server/integrations/anthropic-client.ts"() {
    "use strict";
    init_env();
    client = null;
    SYSTEM_PROMPT = `Voc\xEA \xE9 um CFO s\xEAnior atuando como consultor interno da Radra (Letreiros Express), uma ind\xFAstria de comunica\xE7\xE3o visual (letreiros, placas, pain\xE9is de LED). Voc\xEA responde perguntas do gestor sobre a sa\xFAde financeira da empresa usando os dados reais fornecidos no contexto abaixo.

Use, quando fizerem sentido para a pergunta, estes frameworks de an\xE1lise financeira:
- EBITDA e Margem EBITDA
- Margem de Contribui\xE7\xE3o por canal/produto
- LTV vs. CAC (Lifetime Value / Customer Acquisition Cost)
- Working Capital (Capital de Giro) e Ciclo de Caixa
- ROIC e ROE
- An\xE1lise de Vari\xE2ncia (Or\xE7ado vs. Realizado)
- An\xE1lise de Coorte (reten\xE7\xE3o por m\xEAs de entrada do cliente)
- An\xE1lise de Sensibilidade / Cen\xE1rios (Otimista, Base, Pessimista)
- An\xE1lise de Pareto (80/20) por produto/cliente
- Regress\xE3o linear / tend\xEAncia de vendas (forecasting)

Regra inegoci\xE1vel: NUNCA invente ou estime um n\xFAmero financeiro como se fosse dado real. Se o dado necess\xE1rio para responder algo com precis\xE3o n\xE3o estiver no contexto fornecido, diga explicitamente que falta esse dado e o que seria preciso para calcul\xE1-lo \u2014 n\xE3o preencha a lacuna com um chute. Voc\xEA pode fazer proje\xE7\xF5es/estimativas explicitamente rotuladas como tal (ex: "proje\xE7\xE3o baseada em regress\xE3o linear sobre os \xFAltimos N meses"), mas nunca as apresente como n\xFAmero realizado.

Seja direto e quantitativo. Responda em portugu\xEAs do Brasil.`;
  }
});

// server/services/inteligenciaClientes.ts
function parseDataFlexivel(s) {
  if (!s) return null;
  const texto = s.trim();
  if (!texto) return null;
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (br) {
    const [, dia, mes, ano, h, min, seg] = br;
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(h ?? 0), Number(min ?? 0), Number(seg ?? 0));
    return isNaN(d.getTime()) ? null : d;
  }
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (iso) {
    const [, ano, mes, dia, h, min, seg] = iso;
    const d = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(h ?? 0), Number(min ?? 0), Number(seg ?? 0));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}
function toNum(v) {
  const n = parseFloat(String(v ?? "0"));
  return isNaN(n) ? 0 : n;
}
function toNumOrNull(v) {
  if (v === null || v === void 0 || v === "") return null;
  const n = parseFloat(String(v));
  return isNaN(n) ? null : n;
}
function construirBaseClientes(rows) {
  const base = /* @__PURE__ */ new Map();
  for (const r of rows) {
    if (!isOsNormalDb(r)) continue;
    const empresaBruta = (r.empresa ?? "").trim();
    if (!empresaBruta) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const key = normalizeEmpresaKey(empresaBruta);
    let cliente = base.get(key);
    if (!cliente) {
      cliente = { empresaKey: key, empresaExibicao: empresaBruta, compras: [] };
      base.set(key, cliente);
    }
    cliente.compras.push({
      osNumero: r.osNumero ?? "",
      data,
      valor: toNum(r.valorOs ?? r.valorTotal),
      custo: toNumOrNull(r.custosTotal),
      contribuicao: toNumOrNull(r.contribuicaoReais),
      vendedor: r.vendedor,
      cidade: r.cidade,
      estado: r.estado,
      trabalho: r.trabalho ?? null
    });
  }
  for (const cliente of base.values()) {
    cliente.compras.sort((a, b) => a.data.getTime() - b.data.getTime());
    cliente.empresaExibicao = cliente.compras[cliente.compras.length - 1].vendedor ? cliente.empresaExibicao : cliente.empresaExibicao;
  }
  return base;
}
function mediana(valores) {
  if (valores.length === 0) return null;
  const s = [...valores].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}
function diasEntre(a, b) {
  return Math.round((a.getTime() - b.getTime()) / 864e5);
}
function diasUteisEntre2(fim, inicio) {
  return diasUteisEntre(inicio, fim);
}
function analisarCliente(cliente, dataRef, dataInicial, dataFinal) {
  const validas = cliente.compras;
  if (validas.length === 0) return null;
  const primeiraCompra = validas[0].data;
  const ultimaCompra = validas[validas.length - 1].data;
  const diasDesdeUltimaCompra = diasEntre(dataRef, ultimaCompra);
  const intervalosDias = [];
  for (let i = 1; i < validas.length; i++) {
    intervalosDias.push(diasEntre(validas[i].data, validas[i - 1].data));
  }
  const medianaIntervaloDias = mediana(intervalosDias);
  const razaoAtraso = medianaIntervaloDias && medianaIntervaloDias > 0 ? diasDesdeUltimaCompra / medianaIntervaloDias : null;
  const duracaoJanelaMs = dataFinal.getTime() - dataInicial.getTime();
  const dataInicialAnterior = new Date(dataInicial.getTime() - duracaoJanelaMs - 864e5);
  const dataFinalAnterior = new Date(dataInicial.getTime() - 864e5);
  let valorJanelaAtual = 0, valorJanelaAnterior = 0;
  let custoConhecidoTotal = true;
  let contribSomaHistorico = 0, valorSomaHistorico = 0;
  for (const c of validas) {
    valorSomaHistorico += c.valor;
    if (c.contribuicao !== null) contribSomaHistorico += c.contribuicao;
    else custoConhecidoTotal = false;
    if (c.data >= dataInicial && c.data <= dataFinal) valorJanelaAtual += c.valor;
    if (c.data >= dataInicialAnterior && c.data <= dataFinalAnterior) valorJanelaAnterior += c.valor;
  }
  const margemHistoricaPct = custoConhecidoTotal && valorSomaHistorico > 0 ? contribSomaHistorico / valorSomaHistorico * 100 : null;
  const variacaoVolumePct = valorJanelaAnterior > 0 ? (valorJanelaAtual - valorJanelaAnterior) / valorJanelaAnterior * 100 : valorJanelaAtual > 0 ? null : 0;
  let classificacao;
  let confianca = "alta";
  if (validas.length === 1) {
    classificacao = "primeira_compra";
  } else if (validas.length < HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA) {
    classificacao = "historico_insuficiente";
    confianca = "baixa";
  } else if (razaoAtraso !== null && razaoAtraso >= RAZAO_ATRASO_LIMIAR) {
    classificacao = "intervalo_acima_habitual";
  } else if (variacaoVolumePct !== null && variacaoVolumePct >= VARIACAO_VOLUME_LIMIAR_PCT) {
    classificacao = "em_crescimento";
  } else if (variacaoVolumePct !== null && variacaoVolumePct <= -VARIACAO_VOLUME_LIMIAR_PCT) {
    classificacao = "reducao_volume";
  } else {
    classificacao = "recompra_observada";
  }
  return {
    empresaKey: cliente.empresaKey,
    empresaExibicao: cliente.empresaExibicao,
    vendedor: validas[validas.length - 1].vendedor || "Sem vendedor",
    totalComprasValidas: validas.length,
    primeiraCompra,
    ultimaCompra,
    diasDesdeUltimaCompra,
    medianaIntervaloDias,
    qtdIntervalos: intervalosDias.length,
    razaoAtraso,
    valorTotalHistorico: valorSomaHistorico,
    ticketMedioHistorico: valorSomaHistorico / validas.length,
    valorJanelaAtual,
    valorJanelaAnterior,
    variacaoVolumePct,
    margemHistoricaPct,
    classificacao,
    confiancaClassificacao: confianca,
    sinalizacoes: []
    // preenchido depois, em calcularVisaoGeral (precisa da distribuição do grupo)
  };
}
function scoreQuintil(valor, ordenadosAsc) {
  if (ordenadosAsc.length <= 1) return 3;
  const idx = ordenadosAsc.findIndex((v) => v >= valor);
  const posicao = idx === -1 ? ordenadosAsc.length - 1 : idx;
  const percentil2 = posicao / (ordenadosAsc.length - 1);
  return Math.min(5, Math.max(1, Math.ceil(percentil2 * 5) || 1));
}
function calcularVisaoGeral(base, dataInicial, dataFinal, dataRef) {
  const classificacoes = {
    primeira_compra: 0,
    recompra_observada: 0,
    em_crescimento: 0,
    reducao_volume: 0,
    intervalo_acima_habitual: 0,
    historico_insuficiente: 0
  };
  const clientesDoPeriodo = [];
  let valorTotalPeriodo = 0;
  let qtdPedidosValidos = 0;
  let contribSomaPeriodo = 0;
  let custoConhecidoPeriodo = true;
  let algumPedidoNoPeriodo = false;
  for (const cliente of base.values()) {
    const comprasNoPeriodo = cliente.compras.filter((c) => c.data >= dataInicial && c.data <= dataFinal);
    if (comprasNoPeriodo.length === 0) continue;
    const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
    if (!analise) continue;
    clientesDoPeriodo.push(analise);
    classificacoes[analise.classificacao]++;
    for (const c of comprasNoPeriodo) {
      algumPedidoNoPeriodo = true;
      valorTotalPeriodo += c.valor;
      qtdPedidosValidos++;
      if (c.contribuicao !== null) contribSomaPeriodo += c.contribuicao;
      else custoConhecidoPeriodo = false;
    }
  }
  const clientesCompradoresPeriodo = clientesDoPeriodo.length;
  const primeiraCompraObservada = clientesDoPeriodo.filter((c) => c.primeiraCompra >= dataInicial && c.primeiraCompra <= dataFinal).length;
  const recompraNoPeriodo = clientesCompradoresPeriodo - primeiraCompraObservada;
  const porValorDesc = [...clientesDoPeriodo].sort((a, b) => b.valorJanelaAtual - a.valorJanelaAtual);
  const qtdTop20 = Math.max(1, Math.round(porValorDesc.length * (1 - ALTO_VOLUME_PERCENTIL)));
  const valorTop20 = porValorDesc.slice(0, qtdTop20).reduce((s, c) => s + c.valorJanelaAtual, 0);
  const margemContribuicaoPct = algumPedidoNoPeriodo && custoConhecidoPeriodo && valorTotalPeriodo > 0 ? contribSomaPeriodo / valorTotalPeriodo * 100 : null;
  const margemContribuicaoCobertura = !algumPedidoNoPeriodo ? "indisponivel" : custoConhecidoPeriodo ? "completa" : "parcial";
  const recencias = clientesDoPeriodo.map((c) => c.diasDesdeUltimaCompra).sort((a, b) => a - b);
  const frequencias = clientesDoPeriodo.map((c) => c.totalComprasValidas).sort((a, b) => a - b);
  const valores = clientesDoPeriodo.map((c) => c.valorJanelaAtual).sort((a, b) => a - b);
  const rfm = clientesDoPeriodo.map((c) => {
    const frequenciaPeriodo = base.get(c.empresaKey).compras.filter((x) => x.data >= dataInicial && x.data <= dataFinal).length;
    return {
      empresaKey: c.empresaKey,
      empresaExibicao: c.empresaExibicao,
      recenciaDias: c.diasDesdeUltimaCompra,
      frequencia: frequenciaPeriodo,
      valorMonetario: c.valorJanelaAtual,
      // recência: quanto menor, melhor (score maior) → inverte a escala
      scoreRecencia: 6 - scoreQuintil(c.diasDesdeUltimaCompra, recencias),
      scoreFrequencia: scoreQuintil(frequenciaPeriodo, frequencias),
      scoreValor: scoreQuintil(c.valorJanelaAtual, valores)
    };
  }).sort((a, b) => b.scoreRecencia + b.scoreFrequencia + b.scoreValor - (a.scoreRecencia + a.scoreFrequencia + a.scoreValor));
  const topClientesPorValor = porValorDesc.slice(0, 10).map((c) => ({
    empresa: c.empresaExibicao,
    valor: c.valorJanelaAtual,
    qtdPedidos: base.get(c.empresaKey).compras.filter((x) => x.data >= dataInicial && x.data <= dataFinal).length
  }));
  return {
    periodo: { dataInicial: dataInicial.toISOString().slice(0, 10), dataFinal: dataFinal.toISOString().slice(0, 10) },
    dataReferencia: dataRef.toISOString(),
    clientesCompradoresPeriodo,
    primeiraCompraObservada,
    recompraNoPeriodo,
    classificacoes,
    concentracaoTop20PctClientes: qtdTop20,
    concentracaoTop20PctReceitaPct: valorTotalPeriodo > 0 ? valorTop20 / valorTotalPeriodo * 100 : null,
    margemContribuicaoPct,
    margemContribuicaoCobertura,
    valorTotalPeriodo,
    ticketMedioPedido: qtdPedidosValidos > 0 ? valorTotalPeriodo / qtdPedidosValidos : null,
    qtdPedidosValidos,
    rfm,
    amostraPequena: clientesCompradoresPeriodo < 20,
    topClientesPorValor
  };
}
function gapMesesCalendario(recente, antiga) {
  return (recente.getFullYear() - antiga.getFullYear()) * 12 + (recente.getMonth() - antiga.getMonth());
}
function calcularRecompraNovosReativados(base, dataInicial, dataFinal, dataRef) {
  const novos = [];
  const reativados = [];
  for (const cliente of base.values()) {
    const comprasNoPeriodo = cliente.compras.filter((c) => c.data >= dataInicial && c.data <= dataFinal);
    if (comprasNoPeriodo.length === 0) continue;
    const primeiraNoPeriodo = comprasNoPeriodo[0];
    const comprasAntes = cliente.compras.filter((c) => c.data < dataInicial);
    let categoria = null;
    if (comprasAntes.length === 0) {
      categoria = "novo";
    } else {
      const ultimaAntes = comprasAntes[comprasAntes.length - 1].data;
      if (gapMesesCalendario(primeiraNoPeriodo.data, ultimaAntes) >= MESES_INATIVIDADE_PARA_NOVO) {
        categoria = "reativado";
      }
    }
    if (!categoria) continue;
    const comprasDepois = cliente.compras.filter((c) => c.data > primeiraNoPeriodo.data && c.data <= dataRef);
    const recompra = comprasDepois.length > 0;
    const detalhe = {
      empresa: cliente.empresaExibicao,
      dataQualificacao: primeiraNoPeriodo.data.toISOString(),
      recompra,
      dataRecompra: recompra ? comprasDepois[0].data.toISOString() : null,
      diasAteRecompra: recompra ? diasEntre(comprasDepois[0].data, primeiraNoPeriodo.data) : null,
      qtdComprasDesdeQualificacao: 1 + comprasDepois.length,
      valorNoPeriodo: comprasNoPeriodo.reduce((s, c) => s + c.valor, 0)
    };
    (categoria === "novo" ? novos : reativados).push(detalhe);
  }
  const distribuir = (lista) => {
    const total = lista.length;
    const contagem = { "1": 0, "2": 0, "3": 0, "4+": 0 };
    for (const d of lista) {
      const qtd = d.qtdComprasDesdeQualificacao;
      const chave = qtd >= 4 ? "4+" : String(qtd);
      contagem[chave]++;
    }
    return ["1", "2", "3", "4+"].map((faixa) => ({
      faixa,
      quantidade: contagem[faixa],
      pct: total > 0 ? contagem[faixa] / total * 100 : 0
    }));
  };
  const agrupar = (lista) => {
    const comRecompra = lista.filter((d) => d.recompra).length;
    return {
      total: lista.length,
      comRecompra,
      taxaPct: lista.length > 0 ? comRecompra / lista.length * 100 : null,
      distribuicaoQtdCompras: distribuir(lista),
      faturamentoNoPeriodo: lista.reduce((s, d) => s + d.valorNoPeriodo, 0),
      detalhes: lista.sort((a, b) => a.recompra === b.recompra ? 0 : a.recompra ? 1 : -1)
    };
  };
  return {
    periodo: { dataInicial: dataInicial.toISOString().slice(0, 10), dataFinal: dataFinal.toISOString().slice(0, 10) },
    mesesInatividadeParaReativado: MESES_INATIVIDADE_PARA_NOVO,
    novos: agrupar(novos),
    reativados: agrupar(reativados)
  };
}
function calcularCandidatosAcao(base, dataRef) {
  const candidatos = [];
  const doze_meses_atras = new Date(dataRef);
  doze_meses_atras.setFullYear(doze_meses_atras.getFullYear() - 1);
  const valoresUltimos12m = [...base.values()].map((c) => ({ key: c.empresaKey, valor: c.compras.filter((x) => x.data >= doze_meses_atras && x.data <= dataRef).reduce((s, x) => s + x.valor, 0) })).filter((x) => x.valor > 0).sort((a, b) => a.valor - b.valor);
  const limiarAltoVolume = valoresUltimos12m.length > 0 ? valoresUltimos12m[Math.floor(valoresUltimos12m.length * ALTO_VOLUME_PERCENTIL)]?.valor ?? Infinity : Infinity;
  for (const cliente of base.values()) {
    const validas = cliente.compras;
    if (validas.length === 0) continue;
    const ultimaCompra = validas[validas.length - 1].data;
    const diasDesdeUltima = diasEntre(dataRef, ultimaCompra);
    const vendedorAtual = validas[validas.length - 1].vendedor || "Sem vendedor";
    if (validas.length === 1 && diasDesdeUltima >= PRIMEIRA_COMPRA_DIAS_MIN_CONTATO && diasDesdeUltima <= PRIMEIRA_COMPRA_DIAS_MAX_CONTATO) {
      const urgencia = Math.min(100, (diasDesdeUltima - PRIMEIRA_COMPRA_DIAS_MIN_CONTATO) / (PRIMEIRA_COMPRA_DIAS_MAX_CONTATO - PRIMEIRA_COMPRA_DIAS_MIN_CONTATO) * 100);
      const relevancia = Math.min(100, validas[0].valor / 5e3 * 100);
      const prioridade = Math.round(urgencia * 0.6 + relevancia * 0.4);
      candidatos.push({
        tipo: "primeira_sem_segunda",
        empresaKey: cliente.empresaKey,
        empresa: cliente.empresaExibicao,
        vendedor: vendedorAtual,
        titulo: `Acompanhar 1\xAA compra sem repeti\xE7\xE3o \u2014 ${cliente.empresaExibicao}`,
        motivo: `Fez a primeira compra v\xE1lida em ${ultimaCompra.toLocaleDateString("pt-BR")} (${diasDesdeUltima} dias atr\xE1s) e ainda n\xE3o fez uma segunda compra.`,
        evidencia: { osNumero: validas[0].osNumero, data: ultimaCompra.toISOString(), valor: validas[0].valor, diasDesdeUltima },
        prioridade,
        prioridadeFatores: { urgencia: Math.round(urgencia), relevanciaEconomica: Math.round(relevancia) }
      });
    }
    if (validas.length >= HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA) {
      const intervalosDias = [];
      for (let i = 1; i < validas.length; i++) intervalosDias.push(diasEntre(validas[i].data, validas[i - 1].data));
      const medianaInt = mediana(intervalosDias);
      if (medianaInt && medianaInt > 0) {
        const razao = diasDesdeUltima / medianaInt;
        if (razao >= RAZAO_ATRASO_LIMIAR && diasDesdeUltima <= 365) {
          const urgencia = Math.min(100, razao / 3 * 100);
          const valor12m2 = valoresUltimos12m.find((v) => v.key === cliente.empresaKey)?.valor ?? 0;
          const relevancia = Math.min(100, valor12m2 / 2e4 * 100);
          const prioridade = Math.round(urgencia * 0.6 + relevancia * 0.4);
          candidatos.push({
            tipo: "atraso_recompra",
            empresaKey: cliente.empresaKey,
            empresa: cliente.empresaExibicao,
            vendedor: vendedorAtual,
            titulo: `Atraso na recompra \u2014 ${cliente.empresaExibicao}`,
            motivo: `Costuma comprar a cada ${Math.round(medianaInt)} dias (mediana de ${intervalosDias.length} intervalos); j\xE1 se passaram ${diasDesdeUltima} dias desde a \xFAltima compra (${ultimaCompra.toLocaleDateString("pt-BR")}).`,
            evidencia: { medianaIntervaloDias: Math.round(medianaInt), qtdIntervalos: intervalosDias.length, diasDesdeUltima, razaoAtraso: Number(razao.toFixed(2)), ultimaCompra: ultimaCompra.toISOString() },
            prioridade,
            prioridadeFatores: { urgencia: Math.round(urgencia), relevanciaEconomica: Math.round(relevancia) }
          });
        }
      }
    }
    const comprasUltimos12m = validas.filter((c) => c.data >= doze_meses_atras && c.data <= dataRef);
    const valor12m = comprasUltimos12m.reduce((s, c) => s + c.valor, 0);
    if (valor12m >= limiarAltoVolume && comprasUltimos12m.length > 0) {
      const comCusto = comprasUltimos12m.filter((c) => c.contribuicao !== null);
      if (comCusto.length === comprasUltimos12m.length) {
        const contrib12m = comCusto.reduce((s, c) => s + (c.contribuicao ?? 0), 0);
        const margemPct = valor12m > 0 ? contrib12m / valor12m * 100 : null;
        if (margemPct !== null && margemPct < MARGEM_BAIXA_LIMIAR_PCT) {
          const relevancia = Math.min(100, valor12m / 5e4 * 100);
          const urgencia = Math.min(100, (MARGEM_BAIXA_LIMIAR_PCT - margemPct) / MARGEM_BAIXA_LIMIAR_PCT * 100);
          const prioridade = Math.round(relevancia * 0.6 + urgencia * 0.4);
          candidatos.push({
            tipo: "alto_volume_baixa_margem",
            empresaKey: cliente.empresaKey,
            empresa: cliente.empresaExibicao,
            vendedor: vendedorAtual,
            titulo: `Alto volume, margem baixa \u2014 ${cliente.empresaExibicao}`,
            motivo: `Comprou R$ ${valor12m.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} nos \xFAltimos 12 meses (top 20% da carteira), com margem de contribui\xE7\xE3o de ${margemPct.toFixed(1)}% \u2014 abaixo do limiar de ${MARGEM_BAIXA_LIMIAR_PCT}%.`,
            evidencia: { valor12m, margemPct: Number(margemPct.toFixed(1)), qtdPedidos12m: comprasUltimos12m.length },
            prioridade,
            prioridadeFatores: { relevanciaEconomica: Math.round(relevancia), urgencia: Math.round(urgencia) }
          });
        }
      }
    }
  }
  return candidatos.sort((a, b) => b.prioridade - a.prioridade);
}
function calcularFunilOrcamentos(rows, hoje) {
  const porStatusMap = /* @__PURE__ */ new Map();
  const porVendedorMap = /* @__PURE__ */ new Map();
  const perdasMap = /* @__PURE__ */ new Map();
  const idadeBuckets = [
    { faixa: "0-7 dias", min: 0, max: 7, quantidade: 0, valor: 0 },
    { faixa: "8-15 dias", min: 8, max: 15, quantidade: 0, valor: 0 },
    { faixa: "16-30 dias", min: 16, max: 30, quantidade: 0, valor: 0 },
    { faixa: "31-60 dias", min: 31, max: 60, quantidade: 0, valor: 0 },
    { faixa: "60+ dias", min: 61, max: Infinity, quantidade: 0, valor: 0 }
  ];
  let anoMin = Infinity, anoMax = -Infinity;
  let decididoGanho = 0, decididoPerdido = 0, aprovadoCancelado = 0;
  let vencidasQtd = 0, vencidasValor = 0;
  for (const r of rows) {
    anoMin = Math.min(anoMin, r.ano);
    anoMax = Math.max(anoMax, r.ano);
    const status = (r.status ?? "").trim();
    const statusKey = status.toLowerCase();
    const valor = toNum(r.total);
    const statusAtual = porStatusMap.get(status) ?? { quantidade: 0, valor: 0 };
    statusAtual.quantidade++;
    statusAtual.valor += valor;
    porStatusMap.set(status, statusAtual);
    const vendedor = r.vendedor || "Sem vendedor";
    const vendedorAtual = porVendedorMap.get(vendedor) ?? { quantidade: 0, valor: 0 };
    vendedorAtual.quantidade++;
    vendedorAtual.valor += valor;
    porVendedorMap.set(vendedor, vendedorAtual);
    if (r.motivoCancelamento && r.motivoCancelamento.trim()) {
      const motivo = r.motivoCancelamento.trim();
      perdasMap.set(motivo, (perdasMap.get(motivo) ?? 0) + 1);
    }
    if (statusKey === STATUS_AMBIGUO_APROVADO_CANCELADO) {
      aprovadoCancelado++;
    } else if (STATUS_GANHO.has(statusKey)) {
      decididoGanho++;
    } else if (STATUS_PERDIDO.has(statusKey)) {
      decididoPerdido++;
    } else if (statusKey === STATUS_ABERTO) {
      const dataCadastro = parseDataFlexivel(r.dataCadastro);
      if (dataCadastro) {
        const idadeDias = diasEntre(hoje, dataCadastro);
        const bucket = idadeBuckets.find((b) => idadeDias >= b.min && idadeDias <= b.max);
        if (bucket) {
          bucket.quantidade++;
          bucket.valor += valor;
        }
        const validadeDias = toNum(r.validade);
        const dataVencimento = new Date(dataCadastro);
        dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
        if (validadeDias > 0 && dataVencimento < hoje) {
          vencidasQtd++;
          vencidasValor += valor;
        }
      }
    }
  }
  const totalDecidido = decididoGanho + decididoPerdido;
  return {
    cobertura: {
      anoInicio: isFinite(anoMin) ? anoMin : hoje.getFullYear(),
      anoFim: isFinite(anoMax) ? anoMax : hoje.getFullYear(),
      observacao: "historico_orcamentos cobre apenas o(s) ano(s) listado(s) \u2014 sem compara\xE7\xE3o hist\xF3rica multi-ano at\xE9 o hist\xF3rico local ser ampliado."
    },
    porStatus: [...porStatusMap.entries()].map(([status, v]) => ({ status, ...v })).sort((a, b) => b.valor - a.valor),
    emAbertoPorIdadeDias: idadeBuckets.map(({ faixa, quantidade, valor }) => ({ faixa, quantidade, valor })),
    porVendedor: [...porVendedorMap.entries()].map(([vendedor, v]) => ({ vendedor, ...v })).sort((a, b) => b.valor - a.valor),
    decisoesVencidas: { quantidade: vencidasQtd, valor: vencidasValor },
    perdasComMotivo: [...perdasMap.entries()].map(([motivo, quantidade]) => ({ motivo, quantidade })).sort((a, b) => b.quantidade - a.quantidade),
    taxaConversao: {
      decididoGanho,
      decididoPerdido,
      aprovadoMasCanceladoDepois: aprovadoCancelado,
      taxaPct: totalDecidido > 0 ? decididoGanho / totalDecidido * 100 : null
    }
  };
}
function faixaTicketDoValor(valor) {
  return (FAIXAS_TICKET.find((f2) => valor <= f2.ate) ?? FAIXAS_TICKET[FAIXAS_TICKET.length - 1]).faixa;
}
function calcularConversaoPorFaixaTicket(rows, hoje) {
  const buckets = FAIXAS_TICKET.map((f2) => ({ faixa: f2.faixa, ate: f2.ate, ganhos: 0, perdidos: 0 }));
  for (const r of rows) {
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    let perdido = STATUS_PERDIDO.has(statusKey);
    if (!ganho && !perdido && statusKey === STATUS_ABERTO) {
      const dataCadastro = parseDataFlexivel(r.dataCadastro);
      const validadeDias = toNum(r.validade);
      if (dataCadastro && validadeDias > 0) {
        const dataVencimento = new Date(dataCadastro);
        dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
        if (dataVencimento < hoje) perdido = true;
      }
    }
    if (!ganho && !perdido) continue;
    const valor = toNum(r.total);
    const bucket = buckets.find((b) => valor <= b.ate) ?? buckets[buckets.length - 1];
    if (ganho) bucket.ganhos++;
    else bucket.perdidos++;
  }
  return buckets.map(({ faixa, ganhos, perdidos }) => {
    const total = ganhos + perdidos;
    return { faixa, ganhos, perdidos, taxaConversaoPct: total > 0 ? ganhos / total * 100 : null };
  });
}
function calcularPrevisaoComercial(osRows, orcRows, funil, hoje) {
  const faixasDef = [
    { faixa: "1-30", min: 1, max: 30 },
    { faixa: "31-60", min: 31, max: 60 },
    { faixa: "61-90", min: 61, max: 90 }
  ];
  const faixas = faixasDef.map((f2) => ({ faixa: f2.faixa, carteiraConfirmada: 0, oportunidadesAbertasEstimativa: 0 }));
  let carteiraSemPrazo = 0;
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const statusKey = (r.status ?? "").toLowerCase();
    if (statusKey !== "aprovado" && statusKey !== "em produ\xE7\xE3o") continue;
    const valor = toNum(r.valorOs ?? r.valorTotal);
    const dataEntrega = parseDataFlexivel(r.dataEntrega);
    if (!dataEntrega) {
      carteiraSemPrazo += valor;
      continue;
    }
    const diasAteEntrega = diasEntre(dataEntrega, hoje);
    const faixa = faixasDef.find((f2) => diasAteEntrega >= f2.min && diasAteEntrega <= f2.max);
    if (faixa) {
      const alvo = faixas.find((f2) => f2.faixa === faixa.faixa);
      alvo.carteiraConfirmada += valor;
    }
  }
  const pesoConversao = (funil.taxaConversao.taxaPct ?? 0) / 100;
  for (const r of orcRows) {
    if ((r.status ?? "").toLowerCase() !== "em aberto") continue;
    const dataCadastro = parseDataFlexivel(r.dataCadastro);
    if (!dataCadastro) continue;
    const validadeDias = toNum(r.validade);
    const dataVencimento = new Date(dataCadastro);
    dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
    if (dataVencimento < hoje) continue;
    const diasAteDecisao = diasEntre(dataVencimento, hoje);
    const faixa = faixasDef.find((f2) => diasAteDecisao >= f2.min && diasAteDecisao <= f2.max);
    if (!faixa) continue;
    const alvo = faixas.find((f2) => f2.faixa === faixa.faixa);
    alvo.oportunidadesAbertasEstimativa += toNum(r.total) * pesoConversao;
  }
  const porMesAno = /* @__PURE__ */ new Map();
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (!data) continue;
    const chave = `${data.getFullYear()}-${data.getMonth() + 1}`;
    porMesAno.set(chave, (porMesAno.get(chave) ?? 0) + toNum(r.valorOs ?? r.valorTotal));
  }
  const estimativaSazonalidade = [];
  for (let offset = 0; offset < 3; offset++) {
    const dataAlvo = new Date(hoje.getFullYear(), hoje.getMonth() + offset, 1);
    const mesAlvo = dataAlvo.getMonth() + 1;
    const anosConsiderados = [];
    let soma = 0;
    for (let anoOffset = 1; anoOffset <= 3; anoOffset++) {
      const ano = dataAlvo.getFullYear() - anoOffset;
      const valor = porMesAno.get(`${ano}-${mesAlvo}`);
      if (valor !== void 0) {
        anosConsiderados.push(ano);
        soma += valor;
      }
    }
    estimativaSazonalidade.push({
      mesAlvo: `${String(mesAlvo).padStart(2, "0")}/${dataAlvo.getFullYear()}`,
      mediaHistorica: anosConsiderados.length > 0 ? soma / anosConsiderados.length : null,
      anosConsiderados
    });
  }
  return {
    dataReferencia: hoje.toISOString(),
    premissas: [
      "Carteira confirmada usa a data de entrega prevista (dataEntrega) das OS j\xE1 aprovadas/em produ\xE7\xE3o \u2014 n\xE3o \xE9 a data de faturamento.",
      "Oportunidades abertas s\xE3o estimativa (valor do or\xE7amento \xD7 taxa de convers\xE3o hist\xF3rica do funil), nunca somada \xE0 carteira confirmada.",
      "Estimativa por sazonalidade \xE9 refer\xEAncia de compara\xE7\xE3o (m\xE9dia hist\xF3rica do mesmo m\xEAs), n\xE3o uma parcela a somar \xE0s demais.",
      funil.cobertura.observacao
    ],
    carteiraConfirmadaSemPrazo: carteiraSemPrazo,
    faixas,
    estimativaSazonalidade
  };
}
function montarContextoAssistenteClientes(visaoGeral, funil, previsao, candidatosAcao, periodo, limiteAcoes = 15) {
  return {
    periodo,
    visaoGeral,
    funil,
    previsao,
    filaAcoesPendentesResumo: candidatosAcao.slice(0, limiteAcoes).map((c) => ({
      tipo: c.tipo,
      empresa: c.empresa,
      motivo: c.motivo,
      prioridade: c.prioridade
    }))
  };
}
function percentil(valoresAsc, p) {
  if (valoresAsc.length === 0) return 0;
  const idx = Math.min(valoresAsc.length - 1, Math.max(0, Math.ceil(p / 100 * valoresAsc.length) - 1));
  return valoresAsc[idx];
}
function calcularTempoOrcamentoPedido(orcRows, osRows, janelaMaximaDias = JANELA_MAXIMA_ORCAMENTO_PEDIDO_DIAS) {
  const osPorEmpresa = /* @__PURE__ */ new Map();
  for (const r of osRows) {
    if (!isOsNormalDb(r)) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    const empresa = (r.empresa ?? "").trim();
    if (!data || !empresa) continue;
    const key = normalizeEmpresaKey(empresa);
    if (!osPorEmpresa.has(key)) osPorEmpresa.set(key, []);
    osPorEmpresa.get(key).push(data);
  }
  for (const lista of osPorEmpresa.values()) lista.sort((a, b) => a.getTime() - b.getTime());
  const osUsada = /* @__PURE__ */ new Map();
  const orcamentosGanhos = orcRows.filter((r) => STATUS_GANHO.has((r.status ?? "").trim().toLowerCase())).map((r) => ({ empresaKey: normalizeEmpresaKey((r.empresa ?? "").trim()), data: parseDataFlexivel(r.dataCadastro) })).filter((r) => !!r.data && !!r.empresaKey).sort((a, b) => a.data.getTime() - b.data.getTime());
  const diasAteFechamento = [];
  for (const orc of orcamentosGanhos) {
    const listaOs = osPorEmpresa.get(orc.empresaKey);
    if (!listaOs) continue;
    if (!osUsada.has(orc.empresaKey)) osUsada.set(orc.empresaKey, /* @__PURE__ */ new Set());
    const usadas = osUsada.get(orc.empresaKey);
    for (let i = 0; i < listaOs.length; i++) {
      if (usadas.has(i)) continue;
      const osData = listaOs[i];
      if (osData < orc.data) continue;
      const gapCorrido = diasEntre(osData, orc.data);
      if (gapCorrido > janelaMaximaDias) break;
      diasAteFechamento.push(diasUteisEntre2(osData, orc.data));
      usadas.add(i);
      break;
    }
  }
  diasAteFechamento.sort((a, b) => a - b);
  const n = diasAteFechamento.length;
  const mediana3 = n > 0 ? n % 2 === 0 ? (diasAteFechamento[n / 2 - 1] + diasAteFechamento[n / 2]) / 2 : diasAteFechamento[(n - 1) / 2] : null;
  const p25 = n > 0 ? percentil(diasAteFechamento, 25) : null;
  const p75 = n > 0 ? percentil(diasAteFechamento, 75) : null;
  const p90 = n > 0 ? percentil(diasAteFechamento, 90) : null;
  let sugestao = null;
  if (mediana3 !== null && p25 !== null && p75 !== null) {
    const primeiro = Math.max(1, p25);
    const segundo = Math.max(primeiro + 1, Math.round(mediana3));
    const terceiro = Math.max(segundo + 1, p75);
    sugestao = { primeiro, segundo, terceiro };
  }
  const contagemPorDia = /* @__PURE__ */ new Map();
  for (const d of diasAteFechamento) {
    const chave = d > DISTRIBUICAO_DIAS_MAX ? DISTRIBUICAO_DIAS_MAX + 1 : d;
    contagemPorDia.set(chave, (contagemPorDia.get(chave) ?? 0) + 1);
  }
  const distribuicaoDias = [];
  for (let d = 0; d <= DISTRIBUICAO_DIAS_MAX; d++) {
    const quantidade = contagemPorDia.get(d) ?? 0;
    distribuicaoDias.push({ dias: d, label: `${d}du`, quantidade, percentual: n > 0 ? quantidade / n * 100 : 0 });
  }
  const quantidadeCauda = contagemPorDia.get(DISTRIBUICAO_DIAS_MAX + 1) ?? 0;
  distribuicaoDias.push({
    dias: DISTRIBUICAO_DIAS_MAX + 1,
    label: `${DISTRIBUICAO_DIAS_MAX}+du`,
    quantidade: quantidadeCauda,
    percentual: n > 0 ? quantidadeCauda / n * 100 : 0
  });
  return {
    amostra: n,
    totalOrcamentosGanhos: orcamentosGanhos.length,
    taxaPareamentoPct: orcamentosGanhos.length > 0 ? n / orcamentosGanhos.length * 100 : null,
    mediaDias: n > 0 ? diasAteFechamento.reduce((s, d) => s + d, 0) / n : null,
    medianaDias: mediana3,
    p25Dias: p25,
    p75Dias: p75,
    p90Dias: p90,
    minDias: n > 0 ? diasAteFechamento[0] : null,
    maxDias: n > 0 ? diasAteFechamento[n - 1] : null,
    sugestaoFollowUpDias: sugestao,
    distribuicaoDias
  };
}
var HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA, RAZAO_ATRASO_LIMIAR, VARIACAO_VOLUME_LIMIAR_PCT, MARGEM_BAIXA_LIMIAR_PCT, ALTO_VOLUME_PERCENTIL, PRIMEIRA_COMPRA_DIAS_MIN_CONTATO, PRIMEIRA_COMPRA_DIAS_MAX_CONTATO, DIAS_COOLDOWN_ACAO_RESOLVIDA, VERSAO_REGRA_ATUAL, DICIONARIO_METRICAS, STATUS_GANHO, STATUS_PERDIDO, STATUS_AMBIGUO_APROVADO_CANCELADO, STATUS_ABERTO, FAIXAS_TICKET, VERSAO_PROMPT_ASSISTENTE_CLIENTES, PROMPT_ASSISTENTE_CLIENTES_V1, JANELA_MAXIMA_ORCAMENTO_PEDIDO_DIAS, DISTRIBUICAO_DIAS_MAX;
var init_inteligenciaClientes = __esm({
  "server/services/inteligenciaClientes.ts"() {
    "use strict";
    init_performanceComercial();
    init_dias_uteis();
    HISTORICO_MINIMO_COMPRAS_PARA_TENDENCIA = 3;
    RAZAO_ATRASO_LIMIAR = 1.5;
    VARIACAO_VOLUME_LIMIAR_PCT = 20;
    MARGEM_BAIXA_LIMIAR_PCT = 15;
    ALTO_VOLUME_PERCENTIL = 0.8;
    PRIMEIRA_COMPRA_DIAS_MIN_CONTATO = 30;
    PRIMEIRA_COMPRA_DIAS_MAX_CONTATO = 120;
    DIAS_COOLDOWN_ACAO_RESOLVIDA = 30;
    VERSAO_REGRA_ATUAL = "v1";
    DICIONARIO_METRICAS = [
      {
        id: "pedido_valido",
        nome: "Pedido v\xE1lido",
        formula: "OS com tipoOs preenchido, diferente de Retrabalho/Amostra/Cortesia, e status diferente de Cancelada.",
        periodo: "N/A (filtro aplicado a toda OS antes de qualquer c\xE1lculo)",
        limitacoes: "Linhas com tipoOs nulo s\xE3o duplicatas de importa\xE7\xF5es antigas sem custo e s\xE3o sempre exclu\xEDdas, mesmo que representem um pedido real."
      },
      {
        id: "data_do_pedido",
        nome: "Data do pedido",
        formula: "Data de aprova\xE7\xE3o da OS (dataAprovacao).",
        periodo: "N/A",
        limitacoes: "N\xE3o \xE9 data de faturamento nem de entrega \u2014 100% das OS t\xEAm data de aprova\xE7\xE3o, mas ~2% n\xE3o t\xEAm data de faturamento (pedidos ainda em produ\xE7\xE3o)."
      },
      {
        id: "clientes_compradores_periodo",
        nome: "Clientes compradores no per\xEDodo",
        formula: "Contagem de empresas distintas (normalizadas) com pelo menos um pedido v\xE1lido cuja data de aprova\xE7\xE3o cai dentro do per\xEDodo selecionado.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: 'N\xE3o \xE9 uma classifica\xE7\xE3o permanente de "cliente ativo" \u2014 \xE9 s\xF3 quem comprou nessa janela espec\xEDfica.'
      },
      {
        id: "primeira_compra_observada",
        nome: "Primeira compra observada",
        formula: "Empresa cujo primeiro pedido v\xE1lido em todo o hist\xF3rico local (desde 2023) cai dentro do per\xEDodo selecionado.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: '"Observada" porque o hist\xF3rico local come\xE7a em 2023 \u2014 n\xE3o prova que o cliente nunca comprou antes disso, s\xF3 que n\xE3o h\xE1 registro.'
      },
      {
        id: "recompra_no_periodo",
        nome: "Recompra no per\xEDodo",
        formula: "Empresa com 2 ou mais pedidos v\xE1lidos no hist\xF3rico total, cujo pedido mais recente dentro do per\xEDodo n\xE3o \xE9 a primeira compra dela.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: "\u2014"
      },
      {
        id: "rfm_recencia",
        nome: "RFM \u2014 Rec\xEAncia",
        formula: "Dias entre a data de refer\xEAncia (hoje) e a data do pedido v\xE1lido mais recente do cliente, em todo o hist\xF3rico.",
        periodo: "Calculado na data de refer\xEAncia, n\xE3o depende do per\xEDodo selecionado",
        limitacoes: "\u2014"
      },
      {
        id: "rfm_frequencia",
        nome: "RFM \u2014 Frequ\xEAncia",
        formula: "Quantidade de pedidos v\xE1lidos do cliente dentro do per\xEDodo selecionado.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: "Pedidos divididos ou revisados contam pelo n\xFAmero de OS distintas geradas, n\xE3o pelo n\xFAmero de itens."
      },
      {
        id: "rfm_valor",
        nome: "RFM \u2014 Valor monet\xE1rio",
        formula: "Soma do valor dos pedidos v\xE1lidos do cliente dentro do per\xEDodo selecionado.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: "Valor bruto do pedido (valorOs), n\xE3o desconta custo \u2014 n\xE3o \xE9 margem."
      },
      {
        id: "razao_atraso_recompra",
        nome: "Raz\xE3o de atraso na recompra",
        formula: "Dias desde a \xFAltima compra v\xE1lida \xF7 mediana dos intervalos entre compras v\xE1lidas do pr\xF3prio cliente (exige 3+ compras).",
        periodo: "Calculado na data de refer\xEAncia",
        limitacoes: 'Heur\xEDstica de acompanhamento, n\xE3o \xE9 probabilidade de perda do cliente. Sem hist\xF3rico suficiente, aparece como "hist\xF3rico insuficiente".'
      },
      {
        id: "concentracao",
        nome: "Concentra\xE7\xE3o de carteira",
        formula: "Participa\xE7\xE3o (%) da receita dos clientes no top 20% por valor comprado, sobre a receita total v\xE1lida do per\xEDodo selecionado.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: "\u2014"
      },
      {
        id: "margem_contribuicao",
        nome: "Margem de contribui\xE7\xE3o",
        formula: "Soma da contribui\xE7\xE3o (contribuicaoReais, j\xE1 calculada pelo ERP) dividida pela soma do valor (valorTotal) dos pedidos v\xE1lidos do per\xEDodo \u2014 margem agregada, n\xE3o m\xE9dia dos percentuais individuais.",
        periodo: "Per\xEDodo selecionado no filtro",
        limitacoes: "A metodologia de custo (materiaPrima, m\xE3o de obra, custo fixo, comiss\xF5es, tributos) \xE9 a do ERP MubiSys \u2014 este sistema n\xE3o recalcula custo, s\xF3 agrega o que j\xE1 vem importado."
      },
      {
        id: "classificacao_cliente",
        nome: "Classifica\xE7\xE3o do cliente",
        formula: "Primeira compra (1 compra v\xE1lida no hist\xF3rico) \xB7 Recompra observada (2+ compras, sem sinal de atraso ou varia\xE7\xE3o relevante) \xB7 Em crescimento / Redu\xE7\xE3o de volume (varia\xE7\xE3o \u226520% entre a janela atual e a anterior de mesmo tamanho) \xB7 Intervalo acima do habitual (raz\xE3o de atraso \u22651,5) \xB7 Hist\xF3rico insuficiente (menos de 3 compras v\xE1lidas).",
        periodo: "Calculada na data de refer\xEAncia, usando todo o hist\xF3rico do cliente",
        limitacoes: "\xC9 uma classifica\xE7\xE3o calculada, n\xE3o uma avalia\xE7\xE3o comercial confirmada \u2014 n\xE3o implica que o cliente foi perdido."
      },
      {
        id: "recompra_novos_reativados",
        nome: "Recompra de clientes novos e reativados",
        formula: 'Reaproveita a regra "Cliente Novo e Reativado" (nunca comprou antes da janela, ou \xFAltima compra 6+ meses antes dela). Taxa de recompra = % desses clientes que fez pelo menos mais uma compra v\xE1lida depois, at\xE9 hoje. Distribui\xE7\xE3o de quantidade de compras = % que ficou em exatamente 1/2/3/4+ compras (contando a de entrada) desde a qualifica\xE7\xE3o at\xE9 hoje. Faturamento no per\xEDodo = soma do valor de todos os pedidos v\xE1lidos desses clientes dentro do per\xEDodo selecionado (n\xE3o inclui compras feitas depois do per\xEDodo).',
        periodo: "Coorte qualificada dentro do per\xEDodo selecionado; recompra observada at\xE9 a data de refer\xEAncia (hoje), n\xE3o at\xE9 o fim do per\xEDodo",
        limitacoes: "Clientes qualificados perto do fim do per\xEDodo t\xEAm menos tempo para recomprar at\xE9 hoje \u2014 a taxa tende a subir se o per\xEDodo for revisitado mais adiante."
      }
    ];
    STATUS_GANHO = /* @__PURE__ */ new Set(["aprovado", "em produ\xE7\xE3o", "entregue", "conclu\xEDda"]);
    STATUS_PERDIDO = /* @__PURE__ */ new Set(["reprovado", "cancelada"]);
    STATUS_AMBIGUO_APROVADO_CANCELADO = "orc.: aprovado | os.:cancelada";
    STATUS_ABERTO = "em aberto";
    FAIXAS_TICKET = [
      { faixa: "At\xE9 R$330", ate: 330 },
      { faixa: "R$335~750", ate: 750 },
      { faixa: "R$760~1.300", ate: 1300 },
      { faixa: "R$1.301~5.490", ate: 5490 },
      { faixa: "R$5.500~8.000", ate: 8e3 },
      { faixa: "R$8.010~12.000", ate: 12e3 },
      { faixa: "R$12k+", ate: Infinity }
    ];
    VERSAO_PROMPT_ASSISTENTE_CLIENTES = "v1";
    PROMPT_ASSISTENTE_CLIENTES_V1 = `Voc\xEA \xE9 o analista comercial da empresa, especializado em comunica\xE7\xE3o visual (letras, letreiros, letras-caixa, fachadas) e rela\xE7\xF5es B2B. Ajude o usu\xE1rio a aumentar recompra lucrativa e melhorar a previsibilidade com base em dados verific\xE1veis.

Voc\xEA recebe, a cada pergunta, um contexto estruturado com os resultados J\xC1 CALCULADOS pelo sistema para o per\xEDodo selecionado: vis\xE3o geral de clientes (RFM, classifica\xE7\xE3o, concentra\xE7\xE3o, margem, segunda compra em X dias), funil de or\xE7amentos, previs\xE3o comercial 30/60/90 dias e a fila de a\xE7\xF5es pendentes. Use somente esses n\xFAmeros \u2014 nunca invente clientes, valores ou fatos que n\xE3o estejam no contexto fornecido. Se a pergunta pedir algo que o contexto n\xE3o cobre, diga isso explicitamente e sugira qual tela ou filtro poderia trazer a resposta.

Separe sempre fato observado (o que est\xE1 no contexto), hip\xF3tese (sua interpreta\xE7\xE3o) e a\xE7\xE3o recomendada. Diferencie aus\xEAncia de dado de valor zero, associa\xE7\xE3o de causalidade de correla\xE7\xE3o, e pontua\xE7\xE3o de prioridade de probabilidade de compra.

N\xE3o trate um comprador ocasional como cliente de assinatura. Considere a frequ\xEAncia hist\xF3rica, a margem dispon\xEDvel e a irregularidade natural de projetos de comunica\xE7\xE3o visual (n\xE3o \xE9 um neg\xF3cio de recorr\xEAncia mensal autom\xE1tica).

Previs\xF5es no contexto s\xE3o estimativas com premissas expl\xEDcitas \u2014 nunca as apresente como garantia, nem invente percentuais ou datas exatas de recompra al\xE9m do que est\xE1 no contexto.

Toda recomenda\xE7\xE3o deve dizer para quem \xE9, qual o motivo (citando o n\xFAmero ou classifica\xE7\xE3o que a sustenta), e qual seria o pr\xF3ximo passo. N\xE3o prometa condi\xE7\xF5es comerciais (desconto, prazo, cr\xE9dito) e n\xE3o afirme ter executado nenhuma a\xE7\xE3o no sistema \u2014 voc\xEA s\xF3 responde perguntas, n\xE3o aciona nada.

Responda em portugu\xEAs do Brasil, com frases claras e diretas. Explique termos t\xE9cnicos (RFM, coorte, margem de contribui\xE7\xE3o) s\xF3 quando isso ajudar a resposta, sem virar aula.`;
    JANELA_MAXIMA_ORCAMENTO_PEDIDO_DIAS = 90;
    DISTRIBUICAO_DIAS_MAX = 10;
  }
});

// server/routers/analiseGeografica.ts
import { z as z4 } from "zod";
import { eq as eq6, and as and5, ne } from "drizzle-orm";
function osValidaCondition() {
  return ne(historicoOs.status, "Cancelada");
}
function osValidaMubisys(os) {
  return String(os.status ?? "").toLowerCase() !== "cancelada";
}
function tituloCidade(s) {
  return s.toLowerCase().split(" ").map((w) => w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)).join(" ");
}
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
function isMesAtual(mes, ano) {
  const now = /* @__PURE__ */ new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}
async function lerCacheOsBrutas(db5, cacheKey) {
  const rows = await db5.select().from(mubisysApiCache).where(eq6(mubisysApiCache.cacheKey, cacheKey)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (/* @__PURE__ */ new Date() > new Date(row.expiresAt) || !row.osData) return null;
  try {
    return JSON.parse(row.osData);
  } catch {
    return null;
  }
}
async function buscarOsBrutasDoMes(db5, mes, ano) {
  const compartilhado = await lerCacheOsBrutas(db5, `raw_${mes}_${ano}`);
  if (compartilhado) return { itens: compartilhado, completo: true, viaApi: false };
  const cacheKeyProprio = `geo_raw_${mes}_${ano}`;
  const proprio = await lerCacheOsBrutas(db5, cacheKeyProprio);
  if (proprio) return { itens: proprio, completo: true, viaApi: false };
  const pad2 = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad2(mes)}-01`;
  const datafinal = `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
  const resultado = await listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal });
  if (resultado.completo) {
    const now = /* @__PURE__ */ new Date();
    const ttlMs = isMesAtual(mes, ano) ? TTL_MES_ATUAL_MS : TTL_MES_FECHADO_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await db5.select({ id: mubisysApiCache.id }).from(mubisysApiCache).where(eq6(mubisysApiCache.cacheKey, cacheKeyProprio)).limit(1);
    const payload = { osData: JSON.stringify(resultado.itens), fetchedAt: now, expiresAt };
    if (existing.length > 0) {
      await db5.update(mubisysApiCache).set(payload).where(eq6(mubisysApiCache.cacheKey, cacheKeyProprio));
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
  }).from(historicoOs).where(and5(eq6(historicoOs.mes, mes), eq6(historicoOs.ano, ano), osValidaCondition()));
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
var UFS_VALIDAS, TTL_MES_ATUAL_MS, TTL_MES_FECHADO_MS, analiseGeograficaRouter;
var init_analiseGeografica = __esm({
  "server/routers/analiseGeografica.ts"() {
    "use strict";
    init_trpc();
    init_env();
    init_db();
    init_mubisys_client();
    init_schema();
    UFS_VALIDAS = /* @__PURE__ */ new Set([
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
    TTL_MES_ATUAL_MS = 60 * 60 * 1e3;
    TTL_MES_FECHADO_MS = 30 * 24 * 60 * 60 * 1e3;
    analiseGeograficaRouter = router({
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
      getPorEstado: publicProcedure.input(z4.object({
        ano: z4.number(),
        // null/undefined = ano inteiro
        mes: z4.number().min(1).max(12).nullable().optional()
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
      getEvolucaoMensal: publicProcedure.input(z4.object({ ano: z4.number() })).query(async ({ input }) => {
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
      getListaClientes: publicProcedure.input(z4.object({
        ano: z4.number(),
        mes: z4.number().min(1).max(12).nullable().optional(),
        estado: z4.string().length(2).nullable().optional()
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
  }
});

// server/utils/regioesBrasil.ts
var UF_PARA_REGIAO;
var init_regioesBrasil = __esm({
  "server/utils/regioesBrasil.ts"() {
    "use strict";
    init_analiseGeografica();
    UF_PARA_REGIAO = {
      AC: "Norte",
      AM: "Norte",
      AP: "Norte",
      PA: "Norte",
      RO: "Norte",
      RR: "Norte",
      TO: "Norte",
      AL: "Nordeste",
      BA: "Nordeste",
      CE: "Nordeste",
      MA: "Nordeste",
      PB: "Nordeste",
      PE: "Nordeste",
      PI: "Nordeste",
      RN: "Nordeste",
      SE: "Nordeste",
      DF: "Centro-Oeste",
      GO: "Centro-Oeste",
      MS: "Centro-Oeste",
      MT: "Centro-Oeste",
      ES: "Sudeste",
      MG: "Sudeste",
      RJ: "Sudeste",
      SP: "Sudeste",
      PR: "Sul",
      RS: "Sul",
      SC: "Sul"
    };
  }
});

// server/services/probabilidadeCompra.ts
function foiPerdido(status, dataCadastro, validade, agora) {
  const statusKey = (status ?? "").trim().toLowerCase();
  if (STATUS_PERDIDO.has(statusKey)) return true;
  if (statusKey !== "em aberto") return false;
  const data = parseDataFlexivel(dataCadastro);
  if (!data) return false;
  const validadeDias = parseFloat(String(validade ?? "0")) || 0;
  if (validadeDias > 0) {
    const dataVencimento = new Date(data);
    dataVencimento.setDate(dataVencimento.getDate() + validadeDias);
    return dataVencimento < agora;
  }
  const dias = (agora.getTime() - data.getTime()) / (1e3 * 60 * 60 * 24);
  return dias > DIAS_PRESUMIDO_PERDIDO;
}
function normalizeEmpresaKey2(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}
async function construirMapaConversaoClientes(db5) {
  const linhas = await db5.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    total: historicoOrcamentos.total
  }).from(historicoOrcamentos);
  const porCliente = /* @__PURE__ */ new Map();
  let totalGeral = 0;
  let fechadosGeral = 0;
  for (const r of linhas) {
    const empresaKey = normalizeEmpresaKey2(r.empresa ?? "");
    if (!empresaKey) continue;
    const fechou = STATUS_GANHO.has((r.status ?? "").trim().toLowerCase());
    const valor = r.total != null ? parseFloat(r.total) : NaN;
    let acc = porCliente.get(empresaKey);
    if (!acc) {
      acc = { total: 0, fechados: 0, somaValor: 0, qtdComValor: 0 };
      porCliente.set(empresaKey, acc);
    }
    acc.total++;
    if (fechou) acc.fechados++;
    if (!isNaN(valor)) {
      acc.somaValor += valor;
      acc.qtdComValor++;
    }
    totalGeral++;
    if (fechou) fechadosGeral++;
  }
  const osRows = await db5.select({ empresa: historicoOs.empresa }).from(historicoOs);
  const qtdComprasPorCliente = /* @__PURE__ */ new Map();
  for (const r of osRows) {
    const empresaKey = normalizeEmpresaKey2(r.empresa ?? "");
    if (!empresaKey) continue;
    qtdComprasPorCliente.set(empresaKey, (qtdComprasPorCliente.get(empresaKey) ?? 0) + 1);
  }
  const resultado = /* @__PURE__ */ new Map();
  for (const [empresaKey, acc] of porCliente.entries()) {
    resultado.set(empresaKey, {
      totalOrcamentos: acc.total,
      orcamentosFechados: acc.fechados,
      taxaIndividual: acc.total >= MIN_AMOSTRA_TAXA_INDIVIDUAL ? acc.fechados / acc.total * 100 : null,
      ticketMedio: acc.qtdComValor > 0 ? acc.somaValor / acc.qtdComValor : null,
      qtdCompras: (qtdComprasPorCliente.get(empresaKey) ?? 0) + acc.fechados
    });
  }
  for (const [empresaKey, qtd] of qtdComprasPorCliente.entries()) {
    if (!resultado.has(empresaKey)) {
      resultado.set(empresaKey, { totalOrcamentos: 0, orcamentosFechados: 0, taxaIndividual: null, ticketMedio: null, qtdCompras: qtd });
    }
  }
  const taxaGeral = totalGeral > 0 ? fechadosGeral / totalGeral * 100 : 0;
  return { porCliente: resultado, taxaGeral };
}
function calcularProbabilidade(opts) {
  const empresaKey = normalizeEmpresaKey2(opts.nomeCliente);
  const conversao = empresaKey ? opts.mapa.porCliente.get(empresaKey) : void 0;
  const explicacao = [];
  let base;
  if (opts.clienteNovo && opts.taxaNovosDoMes != null) {
    base = opts.taxaNovosDoMes;
    explicacao.push(`Base: ${base.toFixed(0)}% (convers\xE3o m\xE9dia de clientes novos, \xFAltimos ${MESES_JANELA_NOVOS} meses)`);
  } else if (opts.clienteNovo) {
    base = opts.mapa.taxaGeral;
    explicacao.push(`Base: ${base.toFixed(0)}% (convers\xE3o geral da carteira \u2014 sem or\xE7amentos de clientes novos recentes)`);
  } else if (conversao?.taxaIndividual != null) {
    base = conversao.taxaIndividual;
    explicacao.push(`Base: ${base.toFixed(0)}% (${conversao.orcamentosFechados} de ${conversao.totalOrcamentos} or\xE7amentos fechados deste cliente)`);
  } else {
    base = opts.mapa.taxaGeral;
    const amostra = conversao ? `${conversao.totalOrcamentos} or\xE7amento${conversao.totalOrcamentos === 1 ? "" : "s"}` : "sem hist\xF3rico suficiente";
    explicacao.push(`Base: ${base.toFixed(0)}% (convers\xE3o geral da carteira \u2014 ${amostra} deste cliente, amostra pequena demais para taxa individual)`);
  }
  let probabilidade = base;
  const ticketMedio = conversao?.ticketMedio;
  if (!opts.clienteNovo && ticketMedio && ticketMedio > 0 && opts.valorProposta > 0) {
    const ratio = opts.valorProposta / ticketMedio;
    if (ratio > 2) {
      probabilidade -= 20;
      explicacao.push(`Ajuste: -20pp (proposta ${ratio.toFixed(1)}x acima do ticket m\xE9dio deste cliente)`);
    } else if (ratio > 1) {
      probabilidade -= 10;
      explicacao.push(`Ajuste: -10pp (proposta ${ratio.toFixed(1)}x acima do ticket m\xE9dio deste cliente)`);
    }
  }
  const pesoAjustePortfolio = opts.clienteNovo ? 0.5 : 1;
  if (opts.valorProposta > 0 && opts.mapaFaixaTicket) {
    const faixa = opts.mapaFaixaTicket.get(faixaTicketDoValor(opts.valorProposta));
    const amostraFaixa = faixa ? faixa.ganhos + faixa.perdidos : 0;
    if (faixa && faixa.taxaConversaoPct != null && amostraFaixa >= MIN_AMOSTRA_FAIXA_TICKET) {
      const delta = faixa.taxaConversaoPct - opts.mapa.taxaGeral;
      const ajusteFaixa = Math.max(-AJUSTE_FAIXA_TICKET_MAX_PP, Math.min(AJUSTE_FAIXA_TICKET_MAX_PP, delta)) * pesoAjustePortfolio;
      if (Math.abs(ajusteFaixa) >= 1) {
        probabilidade += ajusteFaixa;
        const sufixoPeso = opts.clienteNovo ? " (peso reduzido \u2014 cliente novo)" : "";
        explicacao.push(`Ajuste: ${ajusteFaixa >= 0 ? "+" : ""}${ajusteFaixa.toFixed(0)}pp (faixa "${faixa.faixa}" converte ${faixa.taxaConversaoPct.toFixed(0)}% vs. ${opts.mapa.taxaGeral.toFixed(0)}% da carteira${sufixoPeso})`);
      }
    }
  }
  if (opts.regiaoCliente && opts.mapaRegiao) {
    const regiao = opts.mapaRegiao.get(opts.regiaoCliente);
    const amostraRegiao = regiao ? regiao.ganhos + regiao.perdidos : 0;
    if (regiao && regiao.taxaConversaoPct != null && amostraRegiao >= MIN_AMOSTRA_REGIAO) {
      const delta = regiao.taxaConversaoPct - opts.mapa.taxaGeral;
      const ajusteRegiao = Math.max(-AJUSTE_REGIAO_MAX_PP, Math.min(AJUSTE_REGIAO_MAX_PP, delta)) * pesoAjustePortfolio;
      if (Math.abs(ajusteRegiao) >= 1) {
        probabilidade += ajusteRegiao;
        const sufixoPeso = opts.clienteNovo ? " (peso reduzido \u2014 cliente novo)" : "";
        explicacao.push(`Ajuste: ${ajusteRegiao >= 0 ? "+" : ""}${ajusteRegiao.toFixed(0)}pp (regi\xE3o ${opts.regiaoCliente} converte ${regiao.taxaConversaoPct.toFixed(0)}% vs. ${opts.mapa.taxaGeral.toFixed(0)}% da carteira${sufixoPeso})`);
      }
    }
  }
  probabilidade = Math.min(PROB_MAX, Math.max(PROB_MIN, Math.round(probabilidade)));
  return { probabilidade, explicacao };
}
function logitP(p) {
  const c = Math.min(0.999, Math.max(1e-3, p));
  return Math.log(c / (1 - c));
}
function sigmoidP(x) {
  return 1 / (1 + Math.exp(-x));
}
function betaPosteriorMean(ganhos, perdidos, alpha0, beta0) {
  return (alpha0 + ganhos) / (alpha0 + beta0 + ganhos + perdidos);
}
async function construirModeloBayesiano(db5) {
  const orcRows = await db5.select({
    empresa: historicoOrcamentos.empresa,
    status: historicoOrcamentos.status,
    total: historicoOrcamentos.total,
    dataCadastro: historicoOrcamentos.dataCadastro,
    validade: historicoOrcamentos.validade
  }).from(historicoOrcamentos);
  const osRows = await db5.select({
    empresa: historicoOs.empresa,
    dataAprovacao: historicoOs.dataAprovacao,
    estado: historicoOs.estado
  }).from(historicoOs);
  const primeiraCompraPorCliente = /* @__PURE__ */ new Map();
  const estadoMaisRecentePorCliente = /* @__PURE__ */ new Map();
  for (const r of osRows) {
    const key = normalizeEmpresaKey2(r.empresa ?? "");
    if (!key) continue;
    const data = parseDataFlexivel(r.dataAprovacao);
    if (data) {
      const atual = primeiraCompraPorCliente.get(key);
      if (!atual || data < atual) primeiraCompraPorCliente.set(key, data);
    }
    const uf = normalizarUf(r.estado);
    if (uf && data) {
      const atualEstado = estadoMaisRecentePorCliente.get(key);
      if (!atualEstado || data > atualEstado.data) estadoMaisRecentePorCliente.set(key, { estado: uf, data });
    }
  }
  const agora = /* @__PURE__ */ new Date();
  const porCliente = /* @__PURE__ */ new Map();
  const novos = { ganhos: 0, perdidos: 0 };
  const porFaixa = /* @__PURE__ */ new Map();
  const porRegiao = /* @__PURE__ */ new Map();
  let ganhosGeral = 0, decididos = 0;
  for (const r of orcRows) {
    const empresaKey = normalizeEmpresaKey2(r.empresa ?? "");
    if (!empresaKey) continue;
    const data = parseDataFlexivel(r.dataCadastro);
    if (!data) continue;
    const statusKey = (r.status ?? "").trim().toLowerCase();
    const ganho = STATUS_GANHO.has(statusKey);
    const perdido = !ganho && foiPerdido(r.status, r.dataCadastro, r.validade, agora);
    if (!ganho && !perdido) continue;
    decididos++;
    if (ganho) ganhosGeral++;
    const cAcc = porCliente.get(empresaKey) ?? { ganhos: 0, perdidos: 0 };
    if (ganho) cAcc.ganhos++;
    else cAcc.perdidos++;
    porCliente.set(empresaKey, cAcc);
    const primeira = primeiraCompraPorCliente.get(empresaKey);
    if (!primeira || primeira >= data) {
      if (ganho) novos.ganhos++;
      else novos.perdidos++;
    }
    const valor = parseFloat(String(r.total ?? "0")) || 0;
    const faixa = faixaTicketDoValor(valor);
    const fAcc = porFaixa.get(faixa) ?? { ganhos: 0, perdidos: 0 };
    if (ganho) fAcc.ganhos++;
    else fAcc.perdidos++;
    porFaixa.set(faixa, fAcc);
    const uf = estadoMaisRecentePorCliente.get(empresaKey);
    const regiao = uf ? UF_PARA_REGIAO[uf.estado] : void 0;
    if (regiao) {
      const rAcc = porRegiao.get(regiao) ?? { ganhos: 0, perdidos: 0 };
      if (ganho) rAcc.ganhos++;
      else rAcc.perdidos++;
      porRegiao.set(regiao, rAcc);
    }
  }
  return {
    taxaGeral: decididos > 0 ? ganhosGeral / decididos : 0.2,
    porCliente,
    novos,
    porFaixa,
    porRegiao,
    nTreino: decididos
  };
}
function calcularProbabilidadeBayesiana(opts) {
  const { modelo } = opts;
  const alpha0 = K_PRIOR_BAYES * modelo.taxaGeral;
  const beta0 = K_PRIOR_BAYES * (1 - modelo.taxaGeral);
  const logitGeral = logitP(modelo.taxaGeral);
  let logitFinal = logitGeral;
  const explicacao = [`Base: taxa geral da carteira ${(modelo.taxaGeral * 100).toFixed(0)}% (${modelo.nTreino} or\xE7amentos decididos)`];
  const empresaKey = normalizeEmpresaKey2(opts.nomeCliente);
  if (opts.clienteNovo) {
    const p = betaPosteriorMean(modelo.novos.ganhos, modelo.novos.perdidos, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Cliente novo: segmento converte ${(p * 100).toFixed(0)}% (${modelo.novos.ganhos}/${modelo.novos.ganhos + modelo.novos.perdidos} decididos, ajustado bayesianamente)`);
  } else {
    const c = modelo.porCliente.get(empresaKey);
    const n = (c?.ganhos ?? 0) + (c?.perdidos ?? 0);
    const p = betaPosteriorMean(c?.ganhos ?? 0, c?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(n > 0 ? `Hist\xF3rico do cliente: ${c.ganhos}/${n} decididos, ajustado bayesianamente para ${(p * 100).toFixed(0)}%` : `Sem or\xE7amento decidido deste cliente ainda \u2014 usa a taxa geral`);
  }
  if (opts.valorProposta > 0) {
    const faixa = faixaTicketDoValor(opts.valorProposta);
    const f2 = modelo.porFaixa.get(faixa);
    const p = betaPosteriorMean(f2?.ganhos ?? 0, f2?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Faixa de t\xEDquete "${faixa}": converte ${(p * 100).toFixed(0)}% (ajustado bayesianamente)`);
  }
  if (opts.regiaoCliente) {
    const r = modelo.porRegiao.get(opts.regiaoCliente);
    const p = betaPosteriorMean(r?.ganhos ?? 0, r?.perdidos ?? 0, alpha0, beta0);
    logitFinal += logitP(p) - logitGeral;
    explicacao.push(`Regi\xE3o ${opts.regiaoCliente}: converte ${(p * 100).toFixed(0)}% (ajustado bayesianamente)`);
  }
  const probabilidade = Math.min(PROB_MAX, Math.max(PROB_MIN, Math.round(sigmoidP(logitFinal) * 100)));
  return { probabilidade, explicacao };
}
var DIAS_PRESUMIDO_PERDIDO, MIN_AMOSTRA_TAXA_INDIVIDUAL, MIN_AMOSTRA_FAIXA_TICKET, AJUSTE_FAIXA_TICKET_MAX_PP, MESES_JANELA_NOVOS, PROB_MIN, PROB_MAX, MIN_AMOSTRA_REGIAO, AJUSTE_REGIAO_MAX_PP, K_PRIOR_BAYES;
var init_probabilidadeCompra = __esm({
  "server/services/probabilidadeCompra.ts"() {
    "use strict";
    init_schema();
    init_inteligenciaClientes();
    init_regioesBrasil();
    DIAS_PRESUMIDO_PERDIDO = 30;
    MIN_AMOSTRA_TAXA_INDIVIDUAL = 3;
    MIN_AMOSTRA_FAIXA_TICKET = 5;
    AJUSTE_FAIXA_TICKET_MAX_PP = 15;
    MESES_JANELA_NOVOS = 3;
    PROB_MIN = 5;
    PROB_MAX = 95;
    MIN_AMOSTRA_REGIAO = 5;
    AJUSTE_REGIAO_MAX_PP = 15;
    K_PRIOR_BAYES = 8;
  }
});

// server/routers/performanceComercial.ts
import { z as z5 } from "zod";
import { eq as eq7, and as and6, desc as desc6, gte as gte3, sql as sql4 } from "drizzle-orm";
async function getDbCache(cacheKey, opts) {
  try {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(mubisysApiCache).where(eq7(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (rows.length === 0) return null;
    const row = rows[0];
    if (!opts?.ignorarExpiracao && /* @__PURE__ */ new Date() > new Date(row.expiresAt)) {
      await db5.delete(mubisysApiCache).where(eq7(mubisysApiCache.cacheKey, cacheKey));
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
    const ttlMs = isMesFechado(mes, ano) ? CACHE_TTL_HISTORICO_PERSISTENTE_MS : CACHE_TTL_ATUAL_MS;
    const expiresAt = new Date(now.getTime() + ttlMs);
    const existing = await db5.select({ id: mubisysApiCache.id }).from(mubisysApiCache).where(eq7(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db5.update(mubisysApiCache).set({ osData: JSON.stringify(allOs), orcData: JSON.stringify(allOrc), fetchedAt: now, expiresAt }).where(eq7(mubisysApiCache.cacheKey, cacheKey));
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
    await db5.delete(mubisysApiCache).where(eq7(mubisysApiCache.cacheKey, cacheKey));
  } catch {
  }
}
function normalizeEmpresaKey(s) {
  return (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
}
function isMesAtual2(mes, ano) {
  const now = /* @__PURE__ */ new Date();
  return mes === now.getMonth() + 1 && ano === now.getFullYear();
}
function isMesFechado(mes, ano) {
  const now = /* @__PURE__ */ new Date();
  const anoAtual = now.getFullYear();
  const mesAtualNum = now.getMonth() + 1;
  return ano < anoAtual || ano === anoAtual && mes < mesAtualNum;
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
  if (isMesAtual2(mes, ano)) {
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
function isClienteNovoPorRecencia(ultima, mes, ano, mesesInatividade = MESES_INATIVIDADE_PARA_NOVO) {
  if (!ultima) return true;
  const gapMeses = (ano - ultima.ano) * 12 + (mes - ultima.mes);
  return gapMeses >= mesesInatividade;
}
function reindexarPorChaveNormalizada(mapa) {
  const normalizado = /* @__PURE__ */ new Map();
  for (const [chave, ultima] of mapa) {
    const chaveNorm = normalizeEmpresaKey(chave);
    const existente = normalizado.get(chaveNorm);
    if (!existente || ultima.ano > existente.ano || ultima.ano === existente.ano && ultima.mes > existente.mes) {
      normalizado.set(chaveNorm, ultima);
    }
  }
  return normalizado;
}
async function getMesFromDb(mes, ano) {
  const db5 = await getDb3();
  if (!db5) return null;
  const osRows = await db5.select().from(historicoOs).where(and6(eq7(historicoOs.mes, mes), eq7(historicoOs.ano, ano)));
  const orcRows = await db5.select().from(historicoOrcamentos).where(and6(eq7(historicoOrcamentos.mes, mes), eq7(historicoOrcamentos.ano, ano)));
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
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(label)), ms))
  ]);
}
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
  const pad2 = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const datainicial = `${ano}-${pad2(mes)}-01`;
  const datafinal = `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
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
      let usouCacheAnteriorPorZeroImplausivel = false;
      if (isMesAtual2(mes, ano) && allOs.length === 0 && allOrc.length === 0) {
        const anterior = await getDbCache(rawCacheKey, { ignorarExpiracao: true });
        if (anterior && (anterior.allOs.length > 0 || anterior.allOrc.length > 0)) {
          console.warn(`[MubiSys] Resposta zerada implaus\xEDvel para m\xEAs vigente ${mes}/${ano} \u2014 usando \xFAltimo cache n\xE3o-vazio (${anterior.allOs.length} OS, ${anterior.allOrc.length} or\xE7amentos) em vez do zero.`);
          allOs = anterior.allOs;
          allOrc = anterior.allOrc;
          usouCacheAnteriorPorZeroImplausivel = true;
        }
      }
      setCacheWithTTL(osCacheKey, allOs, mes, ano);
      setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
      if (osResult.completo && orcResult.completo && !usouCacheAnteriorPorZeroImplausivel) {
        setDbCache(rawCacheKey, mes, ano, allOs, allOrc).catch(() => {
        });
        console.log(`[MubiSys] Cache persistente salvo para ${mes}/${ano}: ${allOs.length} OS, ${allOrc.length} or\xE7amentos`);
      } else if (!usouCacheAnteriorPorZeroImplausivel) {
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
  const MESES_NOMES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
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
    label: `${MESES_NOMES3[mes - 1]}/${String(ano).slice(2)}`,
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
function calcularNovosDoMesLocal(mes, ano, osDoAno, todasComprasValidas, overrideMap) {
  const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(todasComprasValidas, mes, ano));
  const osMes = osDoAno.filter((os) => os.mes === mes);
  let osNovos = 0;
  let faturamentoNovos = 0;
  let faturamentoReativados = 0;
  let clientesReativados = 0;
  const clientesVistos = /* @__PURE__ */ new Set();
  for (const os of osMes) {
    if (!isOsNormalDb(os)) continue;
    const clienteKey = normalizeEmpresaKey(os.empresa ?? "");
    if (!clienteKey) continue;
    const overrideStatus = overrideMap.get(clienteKey);
    const isNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isClienteNovoPorRecencia(ultimaCompraPorCliente.get(clienteKey), mes, ano);
    if (!isNovo) continue;
    const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
    const jaComprouAntes = Boolean(ultimaCompraPorCliente.get(clienteKey));
    osNovos++;
    faturamentoNovos += valor;
    if (jaComprouAntes) faturamentoReativados += valor;
    if (!clientesVistos.has(clienteKey)) {
      clientesVistos.add(clienteKey);
      if (jaComprouAntes) clientesReativados++;
    }
  }
  return {
    mes,
    ticketMedioNovos: osNovos > 0 ? parseFloat((faturamentoNovos / osNovos).toFixed(2)) : 0,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    faturamentoReativados: parseFloat(faturamentoReativados.toFixed(2)),
    // Faturamento de clientes genuinamente novos, SEM os reativados — ver nota em getClientesNovosMes.
    faturamentoNovosPuros: parseFloat((faturamentoNovos - faturamentoReativados).toFixed(2)),
    clientesNovosUnicos: clientesVistos.size,
    clientesReativados,
    // Clientes genuinamente novos (nunca compraram antes), SEM os reativados — perfis
    // diferentes de cliente, não devem ser somados na mesma métrica (ver MarketingFinanceiro.tsx).
    clientesNovosPuros: clientesVistos.size - clientesReativados
  };
}
async function getClientesNovosMes(mes, ano) {
  const db5 = await getDb3();
  const EMPTY = { total: 0, totalReativados: 0, totalPuros: 0, cotacoesNovos: 0, osNovos: 0, faturamentoNovos: 0, faturamentoReativados: 0, faturamentoNovosPuros: 0, ticketMedioNovos: 0, valorOrcadoNovos: 0, taxaConversaoNovos: 0, taxaFaturamentoNovos: 0, porVendedor: {}, porVendedorNovos: {}, lista: [] };
  if (!db5) return EMPTY;
  const snapCongelado = await db5.select().from(performanceAuditada).where(and6(eq7(performanceAuditada.mes, mes), eq7(performanceAuditada.ano, ano), eq7(performanceAuditada.congelado, true))).limit(1);
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
    const orcMesSnap = await db5.select().from(historicoOrcamentos).where(and6(eq7(historicoOrcamentos.mes, mes), eq7(historicoOrcamentos.ano, ano)));
    const comprasSnap = await buscarTodasComprasValidas(db5);
    const ultimaCompraSnap = ultimaCompraAntesDe(comprasSnap, mes, ano);
    const ultimaCompraSnapNorm = reindexarPorChaveNormalizada(ultimaCompraSnap);
    const clientesUnicosSnap = new Set(listaSnap.map((item) => normalizeEmpresaKey(item.empresa)));
    let totalReativadosSnap = 0;
    for (const chave of clientesUnicosSnap) {
      if (ultimaCompraSnapNorm.get(chave)) totalReativadosSnap++;
    }
    let faturamentoReativadosSnap = 0;
    for (const item of listaSnap) {
      if (!ultimaCompraSnapNorm.get(normalizeEmpresaKey(item.empresa))) continue;
      faturamentoReativadosSnap += parseFloat(String(item.valorOs ?? "0")) || 0;
    }
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
      totalReativados: totalReativadosSnap,
      totalPuros: (s.clientesNovos ?? 0) - totalReativadosSnap,
      cotacoesNovos: cotacoesNovosSnap,
      osNovos: s.clientesNovos ?? 0,
      faturamentoNovos: parseFloat(String(s.faturamentoNovos ?? 0)),
      faturamentoReativados: parseFloat(faturamentoReativadosSnap.toFixed(2)),
      faturamentoNovosPuros: parseFloat((parseFloat(String(s.faturamentoNovos ?? 0)) - faturamentoReativadosSnap).toFixed(2)),
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
  const ultimaCompraPorClienteNorm = reindexarPorChaveNormalizada(ultimaCompraPorCliente);
  const pad2 = (n) => String(n).padStart(2, "0");
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad2(mes)}-01`;
  const df = `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
  let allOsApi = [];
  let allOrcApiPrefetched = null;
  try {
    await withTimeout(getMesFromApi(mes, ano), 45e3, "timeout_clientes_novos");
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
        const [osResult, orcResult] = await Promise.all([
          listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: di, datafinal: df }),
          listarOrcamentosMubiSys({ status: "TODOS", datainicial: di, datafinal: df })
        ]);
        allOsApi = osResult.itens;
        const orcList = orcResult.itens;
        setCacheWithTTL(osCacheKey, allOsApi, mes, ano);
        setCacheWithTTL(orcCacheKey, orcList, mes, ano);
        setDbCache(rawCacheKeyNovos, mes, ano, allOsApi, orcList).catch(() => {
        });
        allOrcApiPrefetched = orcList;
      }
    }
  } catch {
    const osMesDb = await db5.select().from(historicoOs).where(and6(eq7(historicoOs.mes, mes), eq7(historicoOs.ano, ano)));
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
  let totalReativados = 0;
  let osNovosCount = 0;
  let faturamentoNovos = 0;
  let faturamentoReativados = 0;
  const clientesVistos = /* @__PURE__ */ new Set();
  const listaRaw = [];
  for (const os of osNormaisApi) {
    const clienteRaw = os.cliente;
    const nomeCliente2 = typeof clienteRaw === "object" && clienteRaw !== null ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "") : String(clienteRaw ?? "");
    const clienteKey = nomeCliente2.toLowerCase().trim();
    if (!clienteKey) continue;
    const overrideStatus = overrideMap.get(normalizeEmpresaKey(nomeCliente2));
    const isNovoByHistory = isClienteNovoPorRecencia(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente2)), mes, ano);
    const isNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isNovoByHistory;
    if (isNovo) {
      const vendedor = String(os.vendedor ?? "Sem Vendedor");
      const vendedorKey = vendedor.toLowerCase().trim();
      const valorOs = parseFloat(String(os.valor_total ?? "0")) || 0;
      const jaComprouAntes = Boolean(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente2)));
      faturamentoNovos += valorOs;
      if (jaComprouAntes) faturamentoReativados += valorOs;
      osNovosCount++;
      if (!porVendedorNovosOs[vendedorKey]) porVendedorNovosOs[vendedorKey] = { osNovos: 0, faturamentoNovos: 0, clientesNovos: 0, nomeOriginal: vendedor };
      porVendedorNovosOs[vendedorKey].osNovos++;
      porVendedorNovosOs[vendedorKey].faturamentoNovos += valorOs;
      if (!clientesVistos.has(clienteKey)) {
        clientesVistos.add(clienteKey);
        total++;
        if (jaComprouAntes) totalReativados++;
        porVendedor[vendedor] = (porVendedor[vendedor] ?? 0) + 1;
        porVendedorNovosOs[vendedorKey].clientesNovos++;
        const contatosOs = Array.isArray(os.cliente_contato) ? os.cliente_contato : os.cliente_contato ? [os.cliente_contato] : [];
        const enderecosOs = Array.isArray(os.cliente_endereco) ? os.cliente_endereco : os.cliente_endereco ? [os.cliente_endereco] : [];
        const primeiroContato = contatosOs[0];
        const primeiroEndereco2 = enderecosOs[0];
        const telefoneOs = primeiroContato?.celular || primeiroContato?.telefone || primeiroContato?.fone || "";
        const contatoOs = primeiroContato?.nome_contato || primeiroContato?.nome || "";
        const cidadeOs = primeiroEndereco2?.cidade || "";
        const estadoOs = primeiroEndereco2?.estado || primeiroEndereco2?.uf || "";
        listaRaw.push({ empresa: nomeCliente2, vendedor, osNumero: String(os.numero ?? ""), valorOs: String(os.valor_total ?? ""), telefone: telefoneOs, contato: contatoOs, cidade: cidadeOs, estado: estadoOs });
      }
    }
  }
  function formatWhatsApp(tel) {
    if (!tel) return "";
    const digits = tel.replace(/\D/g, "");
    if (!digits) return "";
    const num2 = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num2}`;
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
      const orcMes = await db5.select().from(historicoOrcamentos).where(and6(eq7(historicoOrcamentos.mes, mes), eq7(historicoOrcamentos.ano, ano)));
      allOrcApi = orcMes.map((orc) => ({
        cliente: orc.empresa,
        vendedor: orc.vendedor,
        valor_total: orc.total
      }));
    }
    for (const orc of allOrcApi) {
      const clienteRaw = orc.cliente;
      const nomeCliente2 = typeof clienteRaw === "object" && clienteRaw !== null ? String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "") : String(clienteRaw ?? "");
      const clienteKey = nomeCliente2.toLowerCase().trim();
      const orcOverride = overrideMap.get(normalizeEmpresaKey(nomeCliente2));
      const isNovoOrc = orcOverride === "recorrente" ? false : orcOverride === "novo" ? true : isClienteNovoPorRecencia(ultimaCompraPorClienteNorm.get(normalizeEmpresaKey(nomeCliente2)), mes, ano);
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
    db5.update(performanceAuditada).set({ listaClientesNovos: JSON.stringify(lista) }).where(and6(eq7(performanceAuditada.mes, mes), eq7(performanceAuditada.ano, ano))).execute().catch(() => {
    });
  }
  return {
    total,
    totalReativados,
    totalPuros: total - totalReativados,
    cotacoesNovos,
    osNovos,
    faturamentoNovos: parseFloat(faturamentoNovos.toFixed(2)),
    faturamentoReativados: parseFloat(faturamentoReativados.toFixed(2)),
    faturamentoNovosPuros: parseFloat((faturamentoNovos - faturamentoReativados).toFixed(2)),
    ticketMedioNovos,
    valorOrcadoNovos: parseFloat(valorOrcadoNovos.toFixed(2)),
    taxaConversaoNovos,
    taxaFaturamentoNovos,
    porVendedor,
    porVendedorNovos,
    lista
  };
}
async function sincronizarFilaAcoesClientes(db5) {
  const rows = await db5.select().from(historicoOs);
  const base = construirBaseClientes(rows);
  const dataRef = /* @__PURE__ */ new Date();
  const candidatos = calcularCandidatosAcao(base, dataRef);
  const cutoff = new Date(dataRef.getTime() - DIAS_COOLDOWN_ACAO_RESOLVIDA * 864e5);
  for (const cand of candidatos) {
    const existentes = await db5.select().from(inteligenciaAcoesClientes).where(and6(eq7(inteligenciaAcoesClientes.tipo, cand.tipo), eq7(inteligenciaAcoesClientes.empresaKey, cand.empresaKey))).limit(1);
    const existente = existentes[0];
    if (existente) {
      const resolvidaRecente = existente.resolvidoEm && new Date(existente.resolvidoEm) > cutoff && (existente.status === "concluida" || existente.status === "descartada");
      if (resolvidaRecente) continue;
      if (existente.status === "adiada" && existente.prazo && new Date(existente.prazo) > dataRef) continue;
      await db5.update(inteligenciaAcoesClientes).set({
        empresa: cand.empresa,
        vendedor: cand.vendedor,
        titulo: cand.titulo,
        motivo: cand.motivo,
        evidenciaJson: JSON.stringify(cand.evidencia),
        prioridade: cand.prioridade,
        prioridadeFatoresJson: JSON.stringify(cand.prioridadeFatores),
        dataAnalise: dataRef,
        updatedAt: dataRef,
        // Reabre uma ação concluída/descartada antiga (fora do cooldown) sem perder o histórico de resultado
        ...existente.status === "concluida" || existente.status === "descartada" ? { status: "pendente", resolvidoEm: null } : {}
      }).where(eq7(inteligenciaAcoesClientes.id, existente.id));
    } else {
      await db5.insert(inteligenciaAcoesClientes).values({
        tipo: cand.tipo,
        empresaKey: cand.empresaKey,
        empresa: cand.empresa,
        vendedor: cand.vendedor,
        titulo: cand.titulo,
        motivo: cand.motivo,
        evidenciaJson: JSON.stringify(cand.evidencia),
        prioridade: cand.prioridade,
        prioridadeFatoresJson: JSON.stringify(cand.prioridadeFatores),
        versaoRegra: VERSAO_REGRA_ATUAL,
        dataAnalise: dataRef
      });
    }
  }
}
var gestorProcedure, apiCache, CACHE_TTL_ATUAL_MS, CACHE_TTL_HISTORICO_MS, CACHE_TTL_HISTORICO_PERSISTENTE_MS, MESES_INATIVIDADE_PARA_NOVO, pendingApiCalls, performanceComercialRouter;
var init_performanceComercial = __esm({
  "server/routers/performanceComercial.ts"() {
    "use strict";
    init_trpc();
    init_env();
    init_mubisys_client();
    init_db();
    init_schema();
    init_inteligenciaClientes();
    init_probabilidadeCompra();
    init_anthropic_client();
    gestorProcedure = protectedProcedure.use(requireRole("admin", "master", "gestor"));
    apiCache = /* @__PURE__ */ new Map();
    CACHE_TTL_ATUAL_MS = 60 * 60 * 1e3;
    CACHE_TTL_HISTORICO_MS = 6 * 60 * 60 * 1e3;
    CACHE_TTL_HISTORICO_PERSISTENTE_MS = 30 * 24 * 60 * 60 * 1e3;
    MESES_INATIVIDADE_PARA_NOVO = 6;
    pendingApiCalls = /* @__PURE__ */ new Map();
    performanceComercialRouter = router({
      // Dados de um mês específico
      getMes: publicProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020), forceRefresh: z5.boolean().optional().default(false) })).query(async ({ input }) => {
        const { mes, ano, forceRefresh } = input;
        if (!forceRefresh) {
          const dbSnap = await getDb3();
          if (dbSnap) {
            const snap = await dbSnap.select().from(performanceAuditada).where(and6(eq7(performanceAuditada.mes, mes), eq7(performanceAuditada.ano, ano), eq7(performanceAuditada.congelado, true))).limit(1);
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
            const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 42e3));
            raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
          } catch {
            raw = null;
          }
        }
        let viaApi = raw !== null;
        if (!raw) {
          raw = await getMesFromDb(mes, ano);
        }
        if (viaApi && !isMesAtual2(mes, ano) && raw.osNormais?.total === 0 && raw.orcamentos?.total === 0) {
          const local = await getMesFromDb(mes, ano);
          if (local && (local.osNormais.total > 0 || local.orcamentos.total > 0)) {
            raw = local;
            viaApi = false;
          }
        }
        if (!raw) return null;
        const metrics = calcMetrics(raw.osNormais, raw.orcamentos, mes, ano);
        const db22 = await getDb3();
        let totalPedidosBanco = null;
        if (db22) {
          const MESES_NOMES_UPPER = ["JANEIRO", "FEVEREIRO", "MAR\xC7O", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
          const mesNome = MESES_NOMES_UPPER[mes - 1];
          const fatRow = await db22.select({ totalPedidos: faturamento.totalPedidos }).from(faturamento).where(and6(sql4`UPPER(${faturamento.mes}) = ${mesNome}`, eq7(faturamento.ano, ano))).limit(1);
          if (fatRow.length > 0 && fatRow[0].totalPedidos > 0) totalPedidosBanco = fatRow[0].totalPedidos;
        }
        return { ...metrics, totalPedidosBanco, _origemDados: viaApi ? "api" : "local" };
      }),
      // Múltiplos meses para comparativo e gráfico de evolução
      getMultiMes: publicProcedure.input(z5.object({
        meses: z5.array(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) }))
      })).query(async ({ input }) => {
        const now = /* @__PURE__ */ new Date();
        const publicKey = ENV.MUBISYS_PUBLIC_KEY;
        const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
        const db5 = await getDb3();
        const anoSet = Array.from(new Set(input.meses.map((m) => m.ano)));
        const dbDataByAno = /* @__PURE__ */ new Map();
        for (const ano of anoSet) {
          const osRows = db5 ? await db5.select().from(historicoOs).where(eq7(historicoOs.ano, ano)) : [];
          const orcRows = db5 ? await db5.select().from(historicoOrcamentos).where(eq7(historicoOrcamentos.ano, ano)) : [];
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
        const snapsCongelados = db5 ? await db5.select().from(performanceAuditada).where(and6(
          eq7(performanceAuditada.congelado, true),
          sql4`(${performanceAuditada.mes}, ${performanceAuditada.ano}) IN (${sql4.join(
            mesesSolicitados.map((m) => sql4`(${m.mes}, ${m.ano})`),
            sql4`, `
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
      getMetas: publicProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) return [];
        return db5.select().from(metasComerciais).where(and6(eq7(metasComerciais.mes, input.mes), eq7(metasComerciais.ano, input.ano)));
      }),
      upsertMeta: protectedProcedure.input(z5.object({
        vendedor: z5.string().min(1),
        mes: z5.number().min(1).max(12),
        ano: z5.number().min(2020),
        metaCotacoes: z5.number().nullable().optional(),
        metaVendas: z5.number().nullable().optional(),
        metaFaturamento: z5.number().nullable().optional(),
        metaConversao: z5.number().nullable().optional(),
        metaTicketMedio: z5.number().nullable().optional(),
        // Novos campos
        metaOsGeradas: z5.number().nullable().optional(),
        metaClientesNovos: z5.number().nullable().optional(),
        metaOsNovos: z5.number().nullable().optional(),
        metaCotacoesNovos: z5.number().nullable().optional(),
        metaFaturamentoNovos: z5.number().nullable().optional(),
        metaTaxaFaturamento: z5.number().nullable().optional(),
        metaTaxaFaturamentoNovos: z5.number().nullable().optional(),
        metaConversaoNovos: z5.number().nullable().optional(),
        metaTicketMedioNovos: z5.number().nullable().optional(),
        metaValorOrcado: z5.number().nullable().optional()
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
        const existing = await db5.select().from(metasComerciais).where(and6(
          eq7(metasComerciais.vendedor, input.vendedor),
          eq7(metasComerciais.mes, input.mes),
          eq7(metasComerciais.ano, input.ano)
        ));
        if (existing.length > 0) {
          await db5.update(metasComerciais).set(setData).where(and6(
            eq7(metasComerciais.vendedor, input.vendedor),
            eq7(metasComerciais.mes, input.mes),
            eq7(metasComerciais.ano, input.ano)
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
      deleteMeta: protectedProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
        await db5.delete(metasComerciais).where(eq7(metasComerciais.id, input.id));
        return { ok: true };
      }),
      // Todos os meses de um ano para comparativo anual
      getAno: publicProcedure.input(z5.object({ ano: z5.number().min(2020) })).query(async ({ input }) => {
        const { ano } = input;
        const publicKey = ENV.MUBISYS_PUBLIC_KEY;
        const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
        const db5 = await getDb3();
        const todasOsAno = db5 ? await db5.select().from(historicoOs).where(eq7(historicoOs.ano, ano)) : [];
        const todosOrcAno = db5 ? await db5.select().from(historicoOrcamentos).where(eq7(historicoOrcamentos.ano, ano)) : [];
        const snapsCongeladosAno = db5 ? await db5.select().from(performanceAuditada).where(and6(eq7(performanceAuditada.ano, ano), eq7(performanceAuditada.congelado, true))) : [];
        const snapMapAno = /* @__PURE__ */ new Map();
        for (const s of snapsCongeladosAno) snapMapAno.set(s.mes, s);
        const MESES_NOMES_ANO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        const meses = Array.from({ length: 12 }, (_, i) => i + 1);
        const results = await Promise.all(meses.map(async (mes) => {
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
              const timeoutPromise = new Promise((resolve) => setTimeout(() => resolve(null), 45e3));
              raw = await Promise.race([getMesFromApi(mes, ano), timeoutPromise]);
            } catch {
              raw = null;
            }
          }
          if (raw && !isMesAtual2(mes, ano) && raw.osNormais?.total === 0 && raw.orcamentos?.total === 0) {
            raw = null;
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
        return results;
      }),
      // Clientes novos do mês (primeira compra)
      getClientesNovos: protectedProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        return getClientesNovosMes(input.mes, input.ano);
      }),
      // Clientes novos de todos os meses do ano (para gráfico anual) — lê do histórico local
      getClientesNovosAno: publicProcedure.input(z5.object({ ano: z5.number().min(2020) })).query(async ({ input }) => {
        const { ano } = input;
        const now = /* @__PURE__ */ new Date();
        const mesAtual = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
        const meses = Array.from({ length: mesAtual }, (_, i) => i + 1);
        const db5 = await getDb3();
        if (!db5) {
          return meses.map((mes) => ({
            mes,
            ticketMedioNovos: 0,
            osNovos: 0,
            faturamentoNovos: 0,
            faturamentoReativados: 0,
            faturamentoNovosPuros: 0,
            clientesNovosUnicos: 0,
            clientesReativados: 0,
            clientesNovosPuros: 0,
            origem: "indisponivel"
          }));
        }
        const snapsCongelados = await db5.select({ mes: performanceAuditada.mes }).from(performanceAuditada).where(and6(eq7(performanceAuditada.ano, ano), eq7(performanceAuditada.congelado, true)));
        const congeladosSet = new Set(snapsCongelados.map((s) => s.mes));
        const overrides = await db5.select().from(clienteOverrides);
        const overrideMap = /* @__PURE__ */ new Map();
        for (const ov of overrides) overrideMap.set(ov.empresa, ov.status);
        const todasComprasValidas = await buscarTodasComprasValidas(db5);
        const osDoAno = await db5.select({
          empresa: historicoOs.empresa,
          tipoOs: historicoOs.tipoOs,
          status: historicoOs.status,
          mes: historicoOs.mes,
          valorOs: historicoOs.valorOs,
          valorTotal: historicoOs.valorTotal
        }).from(historicoOs).where(eq7(historicoOs.ano, ano));
        const results = await Promise.all(meses.map(async (mes) => {
          if (congeladosSet.has(mes)) {
            const dados = await getClientesNovosMes(mes, ano);
            return {
              mes,
              ticketMedioNovos: dados.ticketMedioNovos,
              osNovos: dados.osNovos,
              faturamentoNovos: dados.faturamentoNovos,
              faturamentoReativados: dados.faturamentoReativados,
              faturamentoNovosPuros: dados.faturamentoNovosPuros,
              clientesNovosUnicos: dados.total,
              clientesReativados: dados.totalReativados,
              clientesNovosPuros: dados.totalPuros,
              origem: "congelado"
            };
          }
          return { ...calcularNovosDoMesLocal(mes, ano, osDoAno, todasComprasValidas, overrideMap), origem: "local" };
        }));
        results.sort((a, b) => a.mes - b.mes);
        return results;
      }),
      // Evolucao diaria do mes vigente por vendedor
      getEvolucaoDiariaMes: publicProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        const { mes, ano } = input;
        const publicKey = ENV.MUBISYS_PUBLIC_KEY;
        const accessToken = ENV.MUBISYS_ACCESS_TOKEN;
        if (!publicKey || !accessToken) return { dias: [], vendedores: [] };
        const osCacheKey = `os_raw_${mes}_${ano}`;
        const orcCacheKey = `orc_raw_${mes}_${ano}`;
        let allOs = getCached(osCacheKey);
        let allOrc = getCached(orcCacheKey);
        if (!allOs || !allOrc) {
          const pad3 = (n) => String(n).padStart(2, "0");
          const lastDay2 = new Date(ano, mes, 0).getDate();
          const datainicial = `${ano}-${pad3(mes)}-01`;
          const datafinal = `${ano}-${pad3(mes)}-${pad3(lastDay2)}`;
          try {
            const [osResult, orcResult] = await withTimeout(
              Promise.all([
                listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial, datafinal }),
                listarOrcamentosMubiSys({ status: "TODOS", datainicial, datafinal })
              ]),
              45e3,
              "timeout_evolucao_diaria"
            );
            allOs = osResult.itens;
            allOrc = orcResult.itens;
            setCacheWithTTL(osCacheKey, allOs, mes, ano);
            setCacheWithTTL(orcCacheKey, allOrc, mes, ano);
          } catch {
            return { dias: [], vendedores: [] };
          }
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
        const pad2 = (n) => String(n).padStart(2, "0");
        const lastDay = new Date(ano, mes, 0).getDate();
        const today = /* @__PURE__ */ new Date();
        const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
        const acumOs = {};
        const acumFat = {};
        const acumCot = {};
        const acumOrc = {};
        const dias = [];
        for (let d = 1; d <= lastDay; d++) {
          const dStr = `${ano}-${pad2(mes)}-${pad2(d)}`;
          if (dStr > todayStr) break;
          const label = `${pad2(d)}/${pad2(mes)}`;
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
      upsertClienteOverride: protectedProcedure.input(z5.object({
        empresaOriginal: z5.string().min(1),
        status: z5.enum(["recorrente", "novo"]),
        motivo: z5.string().optional()
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
      deleteClienteOverride: protectedProcedure.input(z5.object({ id: z5.number() })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
        await db5.delete(clienteOverrides).where(eq7(clienteOverrides.id, input.id));
        return { ok: true };
      }),
      // ─── Inteligência de Clientes ─────────────────────────────────────────────
      // Reescrito em setembro/2026 (ver docs/inteligencia-clientes.md) — calcula tudo
      // localmente a partir de historico_os (nunca mais a API MubiSys ao vivo), por isso
      // não há mais congelamento: o cálculo é determinístico e rápido, não muda entre uma
      // consulta e outra a não ser que o histórico local seja reimportado.
      getVisaoGeralClientes: publicProcedure.input(z5.object({
        dataInicial: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select().from(historicoOs);
        const base = construirBaseClientes(rows);
        const dataRef = /* @__PURE__ */ new Date();
        const visaoGeral = calcularVisaoGeral(base, new Date(input.dataInicial), /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`), dataRef);
        return { visaoGeral, dicionarioMetricas: DICIONARIO_METRICAS };
      }),
      listarClientesInteligencia: publicProcedure.input(z5.object({
        dataInicial: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select().from(historicoOs);
        const base = construirBaseClientes(rows);
        const dataRef = /* @__PURE__ */ new Date();
        const dataInicial = new Date(input.dataInicial);
        const dataFinal = /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`);
        const clientes2 = [];
        for (const cliente of base.values()) {
          const comprasNoPeriodo = cliente.compras.filter((c) => c.data >= dataInicial && c.data <= dataFinal);
          if (comprasNoPeriodo.length === 0) continue;
          const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
          if (analise) clientes2.push(analise);
        }
        const ordemClassificacao = {
          intervalo_acima_habitual: 0,
          reducao_volume: 1,
          historico_insuficiente: 2,
          primeira_compra: 3,
          recompra_observada: 4,
          em_crescimento: 5
        };
        clientes2.sort((a, b) => (ordemClassificacao[a.classificacao] ?? 9) - (ordemClassificacao[b.classificacao] ?? 9) || b.valorJanelaAtual - a.valorJanelaAtual);
        try {
          const mapaConversao = await construirMapaConversaoClientes(db5);
          return clientes2.map((c) => {
            const { probabilidade, explicacao } = calcularProbabilidade({
              clienteNovo: false,
              // esta tela só lista quem já comprou — nunca é "cliente novo"
              nomeCliente: c.empresaExibicao,
              valorProposta: 0,
              // sem proposta específica aqui — sem ajuste por valor
              mapa: mapaConversao,
              taxaNovosDoMes: 0
            });
            return { ...c, probabilidadeCompra: probabilidade, probabilidadeExplicacao: explicacao };
          });
        } catch {
          return clientes2.map((c) => ({ ...c, probabilidadeCompra: null, probabilidadeExplicacao: [] }));
        }
      }),
      getFichaCliente: publicProcedure.input(z5.object({ empresaKey: z5.string().min(1) })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select().from(historicoOs);
        const base = construirBaseClientes(rows);
        const cliente = base.get(input.empresaKey);
        if (!cliente) return null;
        const dataRef = /* @__PURE__ */ new Date();
        const dataFinal = dataRef;
        const dataInicial = new Date(dataRef);
        dataInicial.setFullYear(dataInicial.getFullYear() - 1);
        const analise = analisarCliente(cliente, dataRef, dataInicial, dataFinal);
        return {
          empresaKey: cliente.empresaKey,
          empresaExibicao: cliente.empresaExibicao,
          historico: cliente.compras.map((c) => ({
            osNumero: c.osNumero,
            data: c.data.toISOString(),
            valor: c.valor,
            custo: c.custo,
            contribuicao: c.contribuicao,
            vendedor: c.vendedor,
            cidade: c.cidade,
            estado: c.estado,
            trabalho: c.trabalho
          })),
          analise
        };
      }),
      getFilaAcoesClientes: publicProcedure.input(z5.object({
        status: z5.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
        responsavel: z5.string().optional(),
        vendedor: z5.string().optional()
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        await sincronizarFilaAcoesClientes(db5);
        const filtros = [];
        if (input.status) filtros.push(eq7(inteligenciaAcoesClientes.status, input.status));
        if (input.responsavel) filtros.push(eq7(inteligenciaAcoesClientes.responsavel, input.responsavel));
        if (input.vendedor) filtros.push(eq7(inteligenciaAcoesClientes.vendedor, input.vendedor));
        const fila = await db5.select().from(inteligenciaAcoesClientes).where(filtros.length > 0 ? and6(...filtros) : void 0).orderBy(desc6(inteligenciaAcoesClientes.prioridade));
        return fila.map((a) => ({
          ...a,
          evidencia: JSON.parse(a.evidenciaJson),
          prioridadeFatores: a.prioridadeFatoresJson ? JSON.parse(a.prioridadeFatoresJson) : null
        }));
      }),
      /** Lista de vendedores distintos já presentes na fila — para popular o filtro. */
      getVendedoresFilaAcoes: publicProcedure.query(async () => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.selectDistinct({ vendedor: inteligenciaAcoesClientes.vendedor }).from(inteligenciaAcoesClientes);
        return rows.map((r) => r.vendedor).filter((v) => !!v).sort();
      }),
      /** Gera um PDF (texto, paginado) da fila de ações filtrada — mesmo padrão de
       * server/routers/logistica.ts::romaneioPdf (jsPDF no servidor, retorna base64). */
      gerarFilaAcoesPdf: publicProcedure.input(z5.object({
        status: z5.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
        vendedor: z5.string().optional()
      })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        await sincronizarFilaAcoesClientes(db5);
        const filtros = [];
        if (input.status) filtros.push(eq7(inteligenciaAcoesClientes.status, input.status));
        if (input.vendedor) filtros.push(eq7(inteligenciaAcoesClientes.vendedor, input.vendedor));
        const fila = await db5.select().from(inteligenciaAcoesClientes).where(filtros.length > 0 ? and6(...filtros) : void 0).orderBy(desc6(inteligenciaAcoesClientes.prioridade));
        const { jsPDF } = await import("jspdf");
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const margem = 40;
        const limiteY = 800;
        let y = 48;
        const escreve = (texto, negrito = false, tamanho = 9) => {
          const linhas = doc.splitTextToSize(texto, 515);
          for (const linha of linhas) {
            if (y > limiteY) {
              doc.addPage();
              y = 48;
            }
            doc.setFont("helvetica", negrito ? "bold" : "normal");
            doc.setFontSize(tamanho);
            doc.text(linha, margem, y);
            y += tamanho + 4;
          }
        };
        const tituloTipo = {
          primeira_sem_segunda: "1\xAA compra sem repeti\xE7\xE3o",
          atraso_recompra: "Atraso na recompra",
          alto_volume_baixa_margem: "Alto volume, margem baixa"
        };
        escreve("Fila de A\xE7\xF5es \u2014 Intelig\xEAncia de Clientes", true, 14);
        escreve(`Filtros: status=${input.status ?? "todos"} \xB7 vendedor=${input.vendedor ?? "todos"}`);
        escreve(`Total de a\xE7\xF5es: ${fila.length} \xB7 Emitido em ${(/* @__PURE__ */ new Date()).toLocaleString("pt-BR")}`);
        y += 8;
        for (const a of fila) {
          escreve(`${a.empresa}  \u2014  ${tituloTipo[a.tipo] ?? a.tipo}`, true, 11);
          escreve(`Vendedor: ${a.vendedor ?? "\u2014"}   |   Prioridade: ${a.prioridade}   |   Status: ${a.status}`);
          escreve(a.motivo);
          if (a.proximoPasso) escreve(`Pr\xF3ximo passo: ${a.proximoPasso}`);
          if (a.resultado) escreve(`Resultado: ${a.resultado}${a.resultadoObservacao ? " \u2014 " + a.resultadoObservacao : ""}`);
          y += 6;
        }
        const pdfBase64 = doc.output("datauristring").split(",")[1];
        return {
          pdfBase64,
          fileName: `fila-acoes-clientes-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.pdf`,
          totalAcoes: fila.length
        };
      }),
      atualizarAcaoCliente: protectedProcedure.input(z5.object({
        id: z5.number(),
        status: z5.enum(["pendente", "concluida", "adiada", "descartada"]).optional(),
        responsavel: z5.string().nullable().optional(),
        proximoPasso: z5.string().nullable().optional(),
        prazo: z5.string().nullable().optional(),
        // YYYY-MM-DD
        resultado: z5.enum(["contato_realizado", "sem_resposta", "projeto_futuro", "orcamento_solicitado", "compra", "adiamento", "sem_interesse"]).nullable().optional(),
        resultadoObservacao: z5.string().nullable().optional()
      })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const { id, ...campos } = input;
        const set = { updatedAt: /* @__PURE__ */ new Date() };
        if (campos.status !== void 0) {
          set.status = campos.status;
          set.resolvidoEm = campos.status === "concluida" || campos.status === "descartada" ? /* @__PURE__ */ new Date() : null;
        }
        if (campos.responsavel !== void 0) set.responsavel = campos.responsavel;
        if (campos.proximoPasso !== void 0) set.proximoPasso = campos.proximoPasso;
        if (campos.prazo !== void 0) set.prazo = campos.prazo;
        if (campos.resultado !== void 0) set.resultado = campos.resultado;
        if (campos.resultadoObservacao !== void 0) set.resultadoObservacao = campos.resultadoObservacao;
        await db5.update(inteligenciaAcoesClientes).set(set).where(eq7(inteligenciaAcoesClientes.id, id));
        return { ok: true };
      }),
      // ─── Inteligência de Clientes — acesso ao painel e confirmação de contato ──
      // Pedido do gestor (13/09/2026): saber se a equipe está de fato usando a aba
      // "Clientes" e permitir que cada vendedor confirme contato com um cliente
      // listado, com observação livre (ver drizzle/schema.ts para o porquê de
      // tabelas dedicadas em vez de reaproveitar crm_atividade_log/crm_contatos).
      /** Registra um acesso à aba "Clientes" — chamado uma vez por montagem do
       * componente no front. Silencioso o suficiente para não travar a tela por
       * causa disso: falhas aqui não devem impedir o uso do painel. */
      registrarAcessoInteligenciaClientes: protectedProcedure.mutation(async ({ ctx }) => {
        const db5 = await getDb3();
        if (!db5) return { ok: false };
        await db5.insert(inteligenciaClientesAcessos).values({
          userId: ctx.user.id,
          userName: ctx.user.name
        });
        return { ok: true };
      }),
      /** Para o gestor: quem da equipe acessou a aba nos últimos `dias` dias,
       * quantas vezes e quando foi a última. */
      getAcessosInteligenciaClientes: gestorProcedure.input(z5.object({ dias: z5.number().int().min(1).max(365).default(30) })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const desde = new Date(Date.now() - input.dias * 864e5);
        const rows = await db5.select().from(inteligenciaClientesAcessos).where(gte3(inteligenciaClientesAcessos.acessadoEm, desde)).orderBy(desc6(inteligenciaClientesAcessos.acessadoEm));
        const porUsuario = /* @__PURE__ */ new Map();
        for (const r of rows) {
          const atual = porUsuario.get(r.userId);
          if (!atual) {
            porUsuario.set(r.userId, { userId: r.userId, userName: r.userName, qtdAcessos: 1, ultimoAcesso: r.acessadoEm });
          } else {
            atual.qtdAcessos++;
          }
        }
        return [...porUsuario.values()].sort((a, b) => b.ultimoAcesso.getTime() - a.ultimoAcesso.getTime());
      }),
      /** Vendedor confirma que entrou em contato com um cliente da lista, com
       * observação livre opcional — fica visível para o gestor em getContatosClientes. */
      registrarContatoCliente: protectedProcedure.input(z5.object({
        empresaKey: z5.string().min(1),
        empresa: z5.string().min(1),
        observacao: z5.string().max(2e3).optional()
      })).mutation(async ({ ctx, input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        await db5.insert(inteligenciaClientesContatos).values({
          empresaKey: input.empresaKey,
          empresa: input.empresa,
          userId: ctx.user.id,
          vendedor: ctx.user.name,
          observacao: input.observacao || null
        });
        return { ok: true };
      }),
      /** Lista confirmações de contato — sem filtro, dá a ficha de um cliente
       * (histórico); com filtro de vendedor/dias, dá a visão do gestor sobre a
       * equipe toda. */
      getContatosClientes: protectedProcedure.input(z5.object({
        empresaKey: z5.string().optional(),
        vendedor: z5.string().optional(),
        dias: z5.number().int().min(1).max(365).optional(),
        limite: z5.number().int().min(1).max(500).default(200)
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const filtros = [];
        if (input.empresaKey) filtros.push(eq7(inteligenciaClientesContatos.empresaKey, input.empresaKey));
        if (input.vendedor) filtros.push(eq7(inteligenciaClientesContatos.vendedor, input.vendedor));
        if (input.dias) filtros.push(gte3(inteligenciaClientesContatos.contatadoEm, new Date(Date.now() - input.dias * 864e5)));
        return db5.select().from(inteligenciaClientesContatos).where(filtros.length > 0 ? and6(...filtros) : void 0).orderBy(desc6(inteligenciaClientesContatos.contatadoEm)).limit(input.limite);
      }),
      // ─── Funil de Orçamentos (analítico, histórico local — complementa o CRM operacional
      // em server/routers/crm.ts, que busca orçamentos ao vivo na API MubiSys) ────────────
      getFunilOrcamentos: publicProcedure.query(async () => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select().from(historicoOrcamentos);
        return calcularFunilOrcamentos(rows, /* @__PURE__ */ new Date());
      }),
      /** Conversão por faixa de valor do orçamento — quanto maior o tíquete,
       * menor a taxa histórica de fechamento. Mesmo cálculo usado como fator no
       * Score de Probabilidade de Compra (ver construirMapaFaixaTicket). */
      getConversaoPorFaixaTicket: publicProcedure.query(async () => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select({
          status: historicoOrcamentos.status,
          total: historicoOrcamentos.total,
          dataCadastro: historicoOrcamentos.dataCadastro,
          validade: historicoOrcamentos.validade
        }).from(historicoOrcamentos);
        return calcularConversaoPorFaixaTicket(rows, /* @__PURE__ */ new Date());
      }),
      /** Tempo entre orçamento aprovado e pedido fechado — aproximação por
       * pareamento heurístico (ver aviso em calcularTempoOrcamentoPedido), usada
       * para calibrar o prazo ideal de follow-up. */
      getTempoOrcamentoPedido: publicProcedure.query(async () => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const [orcRows, osRows] = await Promise.all([
          db5.select().from(historicoOrcamentos),
          db5.select().from(historicoOs)
        ]);
        return calcularTempoOrcamentoPedido(orcRows, osRows);
      }),
      // ─── Previsões 30/60/90 dias ──────────────────────────────────────────────────
      getPrevisaoComercial: publicProcedure.query(async () => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const [osRows, orcRows] = await Promise.all([
          db5.select().from(historicoOs),
          db5.select().from(historicoOrcamentos)
        ]);
        const funil = calcularFunilOrcamentos(orcRows, /* @__PURE__ */ new Date());
        return calcularPrevisaoComercial(osRows, orcRows, funil, /* @__PURE__ */ new Date());
      }),
      getRecompraNovosReativados: publicProcedure.input(z5.object({
        dataInicial: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const rows = await db5.select().from(historicoOs);
        const base = construirBaseClientes(rows);
        return calcularRecompraNovosReativados(base, new Date(input.dataInicial), /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`), /* @__PURE__ */ new Date());
      }),
      // ─── Assistente de IA (Inteligência de Clientes) ─────────────────────────────
      // Ver docs/inteligencia-clientes.md seção "Assistente de IA". Usa só os
      // resultados já calculados pelas funções acima como contexto — nunca soma
      // dados brutos, nunca recebe a base de clientes inteira.
      perguntarInteligenciaClientes: protectedProcedure.input(z5.object({
        pergunta: z5.string().min(3),
        dataInicial: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dataFinal: z5.string().regex(/^\d{4}-\d{2}-\d{2}$/)
      })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const dataRef = /* @__PURE__ */ new Date();
        const dataInicial = new Date(input.dataInicial);
        const dataFinal = /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`);
        const [osRows, orcRows] = await Promise.all([
          db5.select().from(historicoOs),
          db5.select().from(historicoOrcamentos)
        ]);
        const base = construirBaseClientes(osRows);
        const visaoGeral = calcularVisaoGeral(base, dataInicial, dataFinal, dataRef);
        const funil = calcularFunilOrcamentos(orcRows, dataRef);
        const previsao = calcularPrevisaoComercial(osRows, orcRows, funil, dataRef);
        const candidatosAcao = calcularCandidatosAcao(base, dataRef);
        const contexto = montarContextoAssistenteClientes(visaoGeral, funil, previsao, candidatosAcao, {
          dataInicial: input.dataInicial,
          dataFinal: input.dataFinal
        });
        const resposta = await perguntarSobreClientes(
          PROMPT_ASSISTENTE_CLIENTES_V1,
          `Contexto (dados j\xE1 calculados pelo sistema, em JSON):
${JSON.stringify(contexto)}`,
          input.pergunta
        );
        return { resposta, versaoPrompt: VERSAO_PROMPT_ASSISTENTE_CLIENTES };
      }),
      // ─── SISTEMA DE AUDITORIA E CONGELAMENTO DE DADOS ────────────────────────────
      /** Busca os dados auditados de um mês (congelado ou pendente) */
      getAuditoria: publicProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) return null;
        const rows = await db5.select().from(performanceAuditada).where(and6(eq7(performanceAuditada.mes, input.mes), eq7(performanceAuditada.ano, input.ano))).limit(1);
        return rows.length > 0 ? rows[0] : null;
      }),
      /** Salva um snapshot dos dados atuais do ERP como auditoria pendente */
      salvarAuditoria: protectedProcedure.input(z5.object({
        mes: z5.number().min(1).max(12),
        ano: z5.number().min(2020),
        cotacoes: z5.number(),
        osNormais: z5.number(),
        taxaConversao: z5.number(),
        faturamento: z5.number(),
        valorOrcado: z5.number(),
        clientesNovos: z5.number(),
        cotacoesNovos: z5.number().default(0),
        taxaConvNovos: z5.number(),
        faturamentoNovos: z5.number(),
        statusValidacao: z5.enum(["pendente", "validado", "corrigido_excel"]).default("validado"),
        fonteExcel: z5.string().optional(),
        observacoes: z5.string().optional()
      })).mutation(async ({ input, ctx }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const existing = await db5.select({ id: performanceAuditada.id }).from(performanceAuditada).where(and6(eq7(performanceAuditada.mes, input.mes), eq7(performanceAuditada.ano, input.ano))).limit(1);
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
          await db5.update(performanceAuditada).set(values).where(eq7(performanceAuditada.id, existing[0].id));
        } else {
          await db5.insert(performanceAuditada).values(values);
        }
        return { ok: true };
      }),
      /** Congela os dados auditados de um mês — impede sobrescrita automática */
      congelarAuditoria: protectedProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        await db5.update(performanceAuditada).set({ congelado: true, dataCongelamento: /* @__PURE__ */ new Date() }).where(and6(eq7(performanceAuditada.mes, input.mes), eq7(performanceAuditada.ano, input.ano)));
        deleteCache(`mes_${input.mes}_${input.ano}`);
        deleteCache(`os_raw_${input.mes}_${input.ano}`);
        deleteCache(`orc_raw_${input.mes}_${input.ano}`);
        return { ok: true };
      }),
      /** Descongela (recalibragem) — permite que o sistema busque dados frescos da API */
      descongelarAuditoria: protectedProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        await db5.update(performanceAuditada).set({ congelado: false, dataCongelamento: null }).where(and6(eq7(performanceAuditada.mes, input.mes), eq7(performanceAuditada.ano, input.ano)));
        deleteCache(`mes_${input.mes}_${input.ano}`);
        deleteCache(`os_raw_${input.mes}_${input.ano}`);
        deleteCache(`orc_raw_${input.mes}_${input.ano}`);
        return { ok: true };
      }),
      /** Diagnóstico: retorna dados brutos da API MubiSys para auditoria cruzada com Excel */
      diagnosticoApi: protectedProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        const { mes, ano } = input;
        const pad2 = (n) => String(n).padStart(2, "0");
        const lastDay = new Date(ano, mes, 0).getDate();
        const datainicial = `${ano}-${pad2(mes)}-01`;
        const datafinal = `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
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
      auditarMeses: protectedProcedure.input(z5.object({
        meses: z5.array(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) }))
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
      /** Retorna o mapa de clientes contatados para um mês/ano */
      getContatados: publicProcedure.input(z5.object({ mes: z5.number().min(1).max(12), ano: z5.number().min(2020) })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) return {};
        const rows = await db5.select().from(clienteNovosContato).where(and6(eq7(clienteNovosContato.mes, input.mes), eq7(clienteNovosContato.ano, input.ano)));
        const mapa = {};
        for (const r of rows) {
          mapa[r.empresa.toLowerCase().trim()] = { contatado: r.contatado, dataContato: r.dataContato };
        }
        return mapa;
      }),
      /** Marca ou desmarca um cliente como contatado */
      setContatado: protectedProcedure.input(z5.object({
        empresa: z5.string().min(1),
        mes: z5.number().min(1).max(12),
        ano: z5.number().min(2020),
        contatado: z5.boolean()
      })).mutation(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const key = input.empresa.toLowerCase().trim();
        const existing = await db5.select().from(clienteNovosContato).where(and6(
          eq7(clienteNovosContato.empresa, key),
          eq7(clienteNovosContato.mes, input.mes),
          eq7(clienteNovosContato.ano, input.ano)
        )).limit(1);
        if (existing.length > 0) {
          await db5.update(clienteNovosContato).set({ contatado: input.contatado, dataContato: input.contatado ? /* @__PURE__ */ new Date() : null }).where(and6(
            eq7(clienteNovosContato.empresa, key),
            eq7(clienteNovosContato.mes, input.mes),
            eq7(clienteNovosContato.ano, input.ano)
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
      }),
      // ─── Propostas de alto valor (padrão: acima de R$ 8.000) ───────────────────
      // Lista as propostas do mês/ano em aberto (exclui canceladas/excluídas e as
      // já convertidas em venda/faturamento — essas não precisam mais de follow-up)
      // acima do valor de corte, com telefone/WhatsApp quando disponível e o
      // histórico de contatos já registrados por quem fez o follow-up.
      getPropostasAltoValor: publicProcedure.input(z5.object({
        mes: z5.number().min(1).max(12),
        ano: z5.number().min(2020),
        valorMinimo: z5.number().min(0).default(8e3)
      })).query(async ({ input }) => {
        const db5 = await getDb3();
        if (!db5) return { propostas: [] };
        const { mes, ano, valorMinimo } = input;
        const orcRows = await db5.select().from(historicoOrcamentos).where(and6(eq7(historicoOrcamentos.mes, mes), eq7(historicoOrcamentos.ano, ano)));
        const STATUS_FINALIZADOS = ["cancelada", "cancelado", "exclu\xEDda", "exclu\xEDdo", "excluida", "excluido", "aprovado", "faturado", "concluido", "conclu\xEDdo"];
        const candidatas = orcRows.filter((orc) => {
          const valor = parseFloat(String(orc.total ?? "0")) || 0;
          if (valor < valorMinimo) return false;
          const status = (orc.status ?? "").toLowerCase();
          return !STATUS_FINALIZADOS.includes(status);
        });
        if (candidatas.length === 0) return { propostas: [] };
        const orcCacheKey = `orc_raw_${mes}_${ano}`;
        let allOrcApi = getCached(orcCacheKey);
        if (!allOrcApi) {
          const dbCached = await getDbCache(`raw_${mes}_${ano}`);
          allOrcApi = dbCached?.allOrc ?? null;
        }
        const telefonePorOrcNumero = /* @__PURE__ */ new Map();
        if (allOrcApi) {
          for (const o of allOrcApi) {
            const numero = String(o.sequencial_orcamento ?? o.id ?? "");
            if (!numero) continue;
            const contatosOrc = Array.isArray(o.cliente_contato) ? o.cliente_contato : o.cliente_contato ? [o.cliente_contato] : [];
            const primeiro = contatosOrc[0];
            const telefone = primeiro?.celular || primeiro?.telefone || primeiro?.fone || "";
            const contato = primeiro?.nome_contato || primeiro?.nome || "";
            if (telefone) telefonePorOrcNumero.set(numero, { telefone, contato });
          }
        }
        function formatWhatsApp(tel) {
          const digits = tel.replace(/\D/g, "");
          if (!digits) return "";
          const num2 = digits.startsWith("55") ? digits : `55${digits}`;
          return `https://wa.me/${num2}`;
        }
        const followupsDb = await db5.select().from(performancePropostasFollowup).where(and6(eq7(performancePropostasFollowup.mes, mes), eq7(performancePropostasFollowup.ano, ano))).orderBy(desc6(performancePropostasFollowup.contatadoEm));
        const followupsPorOrc = /* @__PURE__ */ new Map();
        for (const f2 of followupsDb) {
          if (!followupsPorOrc.has(f2.orcNumero)) followupsPorOrc.set(f2.orcNumero, []);
          followupsPorOrc.get(f2.orcNumero).push(f2);
        }
        const propostas = candidatas.map((orc) => {
          const numero = orc.orcNumero ?? "";
          const tel = telefonePorOrcNumero.get(numero);
          const followups = followupsPorOrc.get(numero) ?? [];
          return {
            orcNumero: numero,
            empresa: orc.empresa ?? "",
            vendedor: orc.vendedor ?? "",
            valor: parseFloat(String(orc.total ?? "0")) || 0,
            dataCadastro: orc.dataCadastro ?? null,
            status: orc.status ?? null,
            telefone: tel?.telefone ?? null,
            contato: tel?.contato ?? null,
            whatsappLink: tel?.telefone ? formatWhatsApp(tel.telefone) : null,
            followups: followups.map((f2) => ({
              id: f2.id,
              usuarioNome: f2.usuarioNome,
              motivo: f2.motivo,
              contatadoEm: f2.contatadoEm
            })),
            qtdFollowups: followups.length
          };
        }).sort((a, b) => b.valor - a.valor);
        return { propostas };
      }),
      /** Registra um contato/follow-up feito em uma proposta de alto valor. */
      registrarFollowupProposta: protectedProcedure.input(z5.object({
        orcNumero: z5.string().min(1),
        empresa: z5.string().min(1),
        mes: z5.number().min(1).max(12),
        ano: z5.number().min(2020),
        motivo: z5.string().min(3, "Descreva o motivo do contato")
      })).mutation(async ({ input, ctx }) => {
        const db5 = await getDb3();
        if (!db5) throw new Error("DB indispon\xEDvel");
        const [row] = await db5.insert(performancePropostasFollowup).values({
          orcNumero: input.orcNumero,
          empresa: input.empresa,
          mes: input.mes,
          ano: input.ano,
          usuarioId: ctx.user?.id ?? null,
          usuarioNome: ctx.user?.name ?? "Desconhecido",
          motivo: input.motivo
        }).returning();
        return row;
      })
    });
  }
});

// server/sync/crm-abertos-cache.ts
import { eq as eq20 } from "drizzle-orm";
async function getCrmAbertosCache(cacheKey) {
  try {
    const db5 = await getDb3();
    const rows = await db5.select().from(mubisysApiCache).where(eq20(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    const row = rows[0];
    if (!row || !row.orcData) return null;
    return { itens: JSON.parse(row.orcData), fetchedAt: row.fetchedAt };
  } catch {
    return null;
  }
}
async function setCrmAbertosCache(cacheKey, itens) {
  try {
    const db5 = await getDb3();
    const now = /* @__PURE__ */ new Date();
    const expiresAt = new Date(now.getTime() + CRM_CACHE_TTL_MS);
    const orcData = JSON.stringify(itens);
    const existing = await db5.select({ id: mubisysApiCache.id }).from(mubisysApiCache).where(eq20(mubisysApiCache.cacheKey, cacheKey)).limit(1);
    if (existing.length > 0) {
      await db5.update(mubisysApiCache).set({ orcData, fetchedAt: now, expiresAt, updatedAt: now }).where(eq20(mubisysApiCache.cacheKey, cacheKey));
    } else {
      await db5.insert(mubisysApiCache).values({
        cacheKey,
        mes: now.getMonth() + 1,
        ano: now.getFullYear(),
        osData: null,
        orcData,
        fetchedAt: now,
        expiresAt
      });
    }
  } catch {
  }
}
async function refreshCrmAbertosCache(cacheKey, janelaDias) {
  const now = /* @__PURE__ */ new Date();
  const diAberto = fmtDate(new Date(now.getTime() - janelaDias * 24 * 60 * 60 * 1e3));
  const dfAberto = fmtDate(now);
  const { itens } = await listarOrcamentosMubiSys({
    status: "ABERTO",
    datainicial: diAberto,
    datafinal: dfAberto,
    perPage: 50
  });
  await setCrmAbertosCache(cacheKey, itens);
  return itens;
}
function inicioJanelaFechadosCache() {
  return fmtDate(new Date(Date.now() - JANELA_FECHADOS_DIAS * 24 * 60 * 60 * 1e3));
}
async function refreshCrmFechadosCache() {
  const now = /* @__PURE__ */ new Date();
  const diFechados = fmtDate(new Date(now.getTime() - JANELA_FECHADOS_DIAS * 24 * 60 * 60 * 1e3));
  const dfFechados = fmtDate(now);
  const { itens } = await listarOrcamentosMubiSys({
    datainicial: diFechados,
    datafinal: dfFechados,
    perPage: 50
  });
  await setCrmAbertosCache(CACHE_KEY_FECHADOS, itens);
  return itens;
}
var CRM_CACHE_TTL_MS, JANELA_ABERTOS_DIAS_PADRAO, JANELA_ABERTOS_DIAS_MAX, CACHE_KEY_ABERTOS_PADRAO, CACHE_KEY_ABERTOS_ESTENDIDO, JANELA_FECHADOS_DIAS, CACHE_KEY_FECHADOS, fmtDate;
var init_crm_abertos_cache = __esm({
  "server/sync/crm-abertos-cache.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_mubisys_client();
    CRM_CACHE_TTL_MS = 20 * 60 * 1e3;
    JANELA_ABERTOS_DIAS_PADRAO = 21;
    JANELA_ABERTOS_DIAS_MAX = 30;
    CACHE_KEY_ABERTOS_PADRAO = "crm_abertos_15d";
    CACHE_KEY_ABERTOS_ESTENDIDO = "crm_abertos_30d";
    JANELA_FECHADOS_DIAS = 45;
    CACHE_KEY_FECHADOS = "crm_fechados_45d";
    fmtDate = (d) => {
      const pad2 = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    };
  }
});

// server/integrations/opencnpj-client.ts
function normalizarCnpj(cnpj) {
  const limpo = cnpj.replace(/[^\dA-Za-z]/g, "");
  if (limpo.length !== 14) {
    throw new Error(`CNPJ inv\xE1lido: "${cnpj}" (esperado 14 caracteres ap\xF3s remover pontua\xE7\xE3o, recebido ${limpo.length}).`);
  }
  return limpo;
}
async function consultarCnpj(cnpj) {
  const cnpjLimpo = normalizarCnpj(cnpj);
  let resp;
  try {
    resp = await fetch(`https://api.opencnpj.org/${cnpjLimpo}`, {
      headers: { Accept: "application/json" }
    });
  } catch (e) {
    throw new Error(`Falha de rede ao consultar OpenCNPJ: ${e?.message ?? "erro desconhecido"}`);
  }
  if (resp.status === 404) throw new CnpjNaoEncontradoError(cnpjLimpo);
  if (!resp.ok) throw new Error(`OpenCNPJ retornou status ${resp.status} para o CNPJ ${cnpjLimpo}.`);
  return await resp.json();
}
var CnpjNaoEncontradoError;
var init_opencnpj_client = __esm({
  "server/integrations/opencnpj-client.ts"() {
    "use strict";
    CnpjNaoEncontradoError = class extends Error {
      constructor(cnpj) {
        super(`CNPJ ${cnpj} n\xE3o encontrado na base da Receita Federal.`);
        this.name = "CnpjNaoEncontradoError";
      }
    };
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

// server/sync/scheduled-sync-historico.ts
function nomeCliente(clienteRaw) {
  if (typeof clienteRaw === "object" && clienteRaw !== null) {
    return String(clienteRaw?.nome ?? clienteRaw?.razao_social ?? "");
  }
  return String(clienteRaw ?? "");
}
function primeiroEndereco(os) {
  const e = os.cliente_endereco?.[0];
  return { cidade: e?.cidade ?? "", estado: e?.estado ?? "" };
}
function osParaLinha(os, mes, ano) {
  const valorTotal = Number(os.valor_total) || 0;
  const valorDesconto = Number(os.valor_desconto) || 0;
  const valorCusto = Number(os.valor_custo) || 0;
  const valorMargem = Number(os.valor_margem) || 0;
  const resultadoPct = valorTotal > 0 ? valorMargem / valorTotal * 100 : 0;
  const { cidade, estado } = primeiroEndereco(os);
  return {
    osNumero: String(os.sequencial_ordem || os.numero_pedido_compra || os.id || ""),
    tipoOs: os.tipo ?? "",
    empresa: nomeCliente(os.cliente),
    trabalho: os.nome_trabalho ?? null,
    logistica: os.logistica ?? null,
    dataAprovacao: os.data_aprovacao ?? null,
    dataEntrega: os.data_entrega ?? null,
    dataFaturamento: os.data_faturamento ?? null,
    status: os.status ?? null,
    vendedor: os.vendedor || os.atendente || null,
    valorTotal: valorTotal.toFixed(2),
    descontos: valorDesconto.toFixed(2),
    valorOs: (valorTotal - valorDesconto).toFixed(2),
    materiaPrima: (Number(os.valor_materia_prima) || 0).toFixed(2),
    custoFixo: (Number(os.valor_fixo_rateado) || 0).toFixed(2),
    maoDeObra: (Number(os.valor_processos_realizados) || 0).toFixed(2),
    tarifasFinanceiras: "0.00",
    comissoesInternas: (Number(os.valor_comissao_interna) || 0).toFixed(2),
    comissoesExternas: (Number(os.valor_comissao_externa) || 0).toFixed(2),
    terceirizados: (Number(os.valor_terceiros) || 0).toFixed(2),
    tributos: (Number(os.valor_tributos) || 0).toFixed(2),
    custosTotal: valorCusto.toFixed(2),
    resultadoReais: valorMargem.toFixed(2),
    resultadoPct: resultadoPct.toFixed(2),
    contribuicaoReais: valorMargem.toFixed(2),
    contribuicaoPct: resultadoPct.toFixed(2),
    cidade,
    estado: estado ? String(estado).slice(0, 2) : null,
    mes,
    ano
  };
}
function orcParaLinha(orc, mes, ano) {
  return {
    orcNumero: String(orc.sequencial_orcamento || orc.id || ""),
    empresa: nomeCliente(orc.cliente),
    trabalho: orc.nome_trabalho ?? null,
    dataCadastro: orc.data_cadastro ?? null,
    validade: orc.validade != null ? String(orc.validade) : null,
    vendedor: orc.vendedor ?? null,
    status: orc.status ?? null,
    motivoCancelamento: orc.motivo_cancelamento ?? null,
    total: (Number(orc.valor_total) || 0).toFixed(2),
    custosTotal: (Number(orc.valor_custo) || 0).toFixed(2),
    margemLiquida: (Number(orc.valor_margem) || 0).toFixed(2),
    mes,
    ano
  };
}
async function upsertEmLotes(table, cols, linhas, conflictCol, batchSize = 150) {
  if (linhas.length === 0) return 0;
  const pool2 = getPool();
  const colList = cols.map((c) => `"${c}"`).join(", ");
  const updateSet = cols.filter((c) => c !== conflictCol).map((c) => `"${c}" = EXCLUDED."${c}"`).join(", ");
  let processadas = 0;
  for (let i = 0; i < linhas.length; i += batchSize) {
    const lote = linhas.slice(i, i + batchSize);
    const values = [];
    const tuplas = lote.map((linha, r) => {
      const base = r * cols.length;
      values.push(...cols.map((c) => linha[c] ?? null));
      return "(" + cols.map((_, ci) => `$${base + ci + 1}`).join(", ") + ")";
    });
    const sql11 = `INSERT INTO ${table} (${colList}) VALUES ${tuplas.join(", ")}
      ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updateSet}`;
    await pool2.query(sql11, values);
    processadas += lote.length;
  }
  return processadas;
}
async function comTentativas(fn, tentativas = 3) {
  let ultimoErro;
  for (let i = 1; i <= tentativas; i++) {
    try {
      return await fn();
    } catch (erro) {
      ultimoErro = erro;
      if (i < tentativas) await new Promise((r) => setTimeout(r, 3e3 * i));
    }
  }
  throw ultimoErro;
}
function fatiarEmJanelas(di, df, diasPorJanela) {
  const [anoI, mesI, diaI] = di.split("-").map(Number);
  const inicio = new Date(Date.UTC(anoI, mesI - 1, diaI));
  const [anoF, mesF, diaF] = df.split("-").map(Number);
  const fim = new Date(Date.UTC(anoF, mesF - 1, diaF));
  const janelas = [];
  let cursor = new Date(inicio);
  while (cursor <= fim) {
    const janelaFim = new Date(cursor);
    janelaFim.setUTCDate(janelaFim.getUTCDate() + diasPorJanela - 1);
    if (janelaFim > fim) janelaFim.setTime(fim.getTime());
    janelas.push({ di: cursor.toISOString().slice(0, 10), df: janelaFim.toISOString().slice(0, 10) });
    cursor = new Date(janelaFim);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return janelas;
}
async function sincronizarHistoricoDoMubiSys(mes, ano) {
  const lastDay = new Date(ano, mes, 0).getDate();
  const di = `${ano}-${pad(mes)}-01`;
  const hoje = /* @__PURE__ */ new Date();
  const ehMesCorrente = ano === hoje.getFullYear() && mes === hoje.getMonth() + 1;
  const df = ehMesCorrente ? `${ano}-${pad(mes)}-${pad(hoje.getDate())}` : `${ano}-${pad(mes)}-${pad(lastDay)}`;
  try {
    const janelas = fatiarEmJanelas(di, df, DIAS_POR_JANELA);
    console.log(`\u{1F504} [SYNC-HISTORICO] Sincronizando ${pad(mes)}/${ano} (${di}..${df}) em ${janelas.length} janela(s)`);
    const resultados = [];
    const janelasFalhadas = [];
    for (const janela of janelas) {
      try {
        const osResult = await comTentativas(() => listarOSMubiSys({ status: "TODOS", filtrodata: "APROVACAO", datainicial: janela.di, datafinal: janela.df }));
        const orcResult = await comTentativas(() => listarOrcamentosMubiSys({ status: "TODOS", datainicial: janela.di, datafinal: janela.df }));
        resultados.push({ osResult, orcResult });
      } catch (erroJanela) {
        janelasFalhadas.push(`${janela.di}..${janela.df}`);
        console.warn(`\u26A0\uFE0F [SYNC-HISTORICO] Janela ${janela.di}..${janela.df} falhou (${erroJanela?.message}) \u2014 seguindo com as demais`);
      }
    }
    if (janelasFalhadas.length === janelas.length) throw new Error(`Todas as ${janelas.length} janelas falharam`);
    const osItens = resultados.flatMap((r) => r.osResult.itens);
    const orcItens = resultados.flatMap((r) => r.orcResult.itens);
    const osCompleto = resultados.every((r) => r.osResult.completo);
    const orcCompleto = resultados.every((r) => r.orcResult.completo);
    if (!osCompleto) console.warn(`\u26A0\uFE0F [SYNC-HISTORICO] Listagem de OS incompleta para ${mes}/${ano} \u2014 teto de p\xE1ginas atingido`);
    if (!orcCompleto) console.warn(`\u26A0\uFE0F [SYNC-HISTORICO] Listagem de or\xE7amentos incompleta para ${mes}/${ano} \u2014 teto de p\xE1ginas atingido`);
    const linhasOs = osItens.map((os) => osParaLinha(os, mes, ano)).filter((l) => l.osNumero);
    const linhasOrc = orcItens.map((orc) => orcParaLinha(orc, mes, ano)).filter((l) => l.orcNumero);
    const osProcessadas = await upsertEmLotes("historico_os", HISTORICO_OS_COLS, linhasOs, "osNumero");
    const orcamentosProcessados = await upsertEmLotes("historico_orcamentos", HISTORICO_ORC_COLS, linhasOrc, "orcNumero");
    console.log(`\u2705 [SYNC-HISTORICO] ${pad(mes)}/${ano}: ${osProcessadas} OS, ${orcamentosProcessados} or\xE7amentos`);
    return { mes, ano, osProcessadas, orcamentosProcessados, status: "SUCESSO" };
  } catch (erro) {
    console.error(`\u274C [SYNC-HISTORICO] Erro ao sincronizar ${mes}/${ano}:`, erro);
    return { mes, ano, osProcessadas: 0, orcamentosProcessados: 0, status: "ERRO", mensagemErro: erro?.message || "Erro desconhecido" };
  }
}
async function sincronizarHistoricoRecente(mesesAtras = 1) {
  const hoje = /* @__PURE__ */ new Date();
  const resultados = [];
  for (let i = 0; i <= mesesAtras; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    resultados.push(await sincronizarHistoricoDoMubiSys(d.getMonth() + 1, d.getFullYear()));
  }
  return resultados;
}
var pad, HISTORICO_OS_COLS, HISTORICO_ORC_COLS, DIAS_POR_JANELA;
var init_scheduled_sync_historico = __esm({
  "server/sync/scheduled-sync-historico.ts"() {
    "use strict";
    init_db_connection();
    init_mubisys_client();
    pad = (n) => String(n).padStart(2, "0");
    HISTORICO_OS_COLS = [
      "osNumero",
      "tipoOs",
      "empresa",
      "trabalho",
      "logistica",
      "dataAprovacao",
      "dataEntrega",
      "dataFaturamento",
      "status",
      "vendedor",
      "valorTotal",
      "descontos",
      "valorOs",
      "materiaPrima",
      "custoFixo",
      "maoDeObra",
      "tarifasFinanceiras",
      "comissoesInternas",
      "comissoesExternas",
      "terceirizados",
      "tributos",
      "custosTotal",
      "resultadoReais",
      "resultadoPct",
      "contribuicaoReais",
      "contribuicaoPct",
      "cidade",
      "estado",
      "mes",
      "ano"
    ];
    HISTORICO_ORC_COLS = [
      "orcNumero",
      "empresa",
      "trabalho",
      "dataCadastro",
      "validade",
      "vendedor",
      "status",
      "motivoCancelamento",
      "total",
      "custosTotal",
      "margemLiquida",
      "mes",
      "ano"
    ];
    DIAS_POR_JANELA = 2;
  }
});

// server/sync/scheduled-sync-historico-handler.ts
var scheduled_sync_historico_handler_exports = {};
__export(scheduled_sync_historico_handler_exports, {
  handleSincronizarHistorico: () => handleSincronizarHistorico
});
function clampParam2(valor, min, max, padrao) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  return Math.min(Math.max(n, min), max);
}
async function handleSincronizarHistorico(req, res) {
  try {
    const mesParam = req.query.mes;
    const anoParam = req.query.ano;
    if (mesParam !== void 0 && anoParam !== void 0) {
      const mes = clampParam2(mesParam, 1, 12, (/* @__PURE__ */ new Date()).getMonth() + 1);
      const ano = clampParam2(anoParam, 2020, 2100, (/* @__PURE__ */ new Date()).getFullYear());
      const resultado = await sincronizarHistoricoDoMubiSys(mes, ano);
      return res.json({ ok: resultado.status === "SUCESSO", resultado, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    }
    const mesesAtras = clampParam2(req.query.mesesAtras, 0, 6, 1);
    const resultados = await sincronizarHistoricoRecente(mesesAtras);
    const ok = resultados.every((r) => r.status === "SUCESSO");
    return res.status(ok ? 200 : 207).json({ ok, resultados, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (erro) {
    console.error(`\u274C [CRON] Erro na sincroniza\xE7\xE3o de hist\xF3rico:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      stack: erro?.stack,
      context: { url: req.url, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
}
var init_scheduled_sync_historico_handler = __esm({
  "server/sync/scheduled-sync-historico-handler.ts"() {
    "use strict";
    init_scheduled_sync_historico();
  }
});

// server/sync/scheduled-sync-crm-abertos.ts
async function sincronizarCrmAbertos() {
  const inicio = Date.now();
  try {
    const itens = await refreshCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO);
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`\u2705 [SYNC-CRM-ABERTOS] ${itens.length} or\xE7amentos em cache em ${tempoExecucaoMs}ms`);
    return { ok: true, quantidade: itens.length, tempoExecucaoMs };
  } catch (erro) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`\u274C [SYNC-CRM-ABERTOS] Erro:`, erro);
    return { ok: false, quantidade: 0, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
var init_scheduled_sync_crm_abertos = __esm({
  "server/sync/scheduled-sync-crm-abertos.ts"() {
    "use strict";
    init_crm_abertos_cache();
  }
});

// server/sync/scheduled-sync-crm-abertos-handler.ts
var scheduled_sync_crm_abertos_handler_exports = {};
__export(scheduled_sync_crm_abertos_handler_exports, {
  handleSincronizarCrmAbertos: () => handleSincronizarCrmAbertos
});
async function handleSincronizarCrmAbertos(req, res) {
  try {
    const resultado = await sincronizarCrmAbertos();
    return res.json({ ok: resultado.ok, resultado, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (erro) {
    console.error(`\u274C [CRON] Erro na sincroniza\xE7\xE3o de abertos do CRM:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
}
var init_scheduled_sync_crm_abertos_handler = __esm({
  "server/sync/scheduled-sync-crm-abertos-handler.ts"() {
    "use strict";
    init_scheduled_sync_crm_abertos();
  }
});

// server/sync/scheduled-sync-crm-fechados.ts
async function sincronizarCrmFechados() {
  const inicio = Date.now();
  try {
    const itens = await refreshCrmFechadosCache();
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`\u2705 [SYNC-CRM-FECHADOS] ${itens.length} or\xE7amentos em cache (${CACHE_KEY_FECHADOS}) em ${tempoExecucaoMs}ms`);
    return { ok: true, quantidade: itens.length, tempoExecucaoMs };
  } catch (erro) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error(`\u274C [SYNC-CRM-FECHADOS] Erro:`, erro);
    return { ok: false, quantidade: 0, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
var init_scheduled_sync_crm_fechados = __esm({
  "server/sync/scheduled-sync-crm-fechados.ts"() {
    "use strict";
    init_crm_abertos_cache();
  }
});

// server/sync/scheduled-sync-crm-fechados-handler.ts
var scheduled_sync_crm_fechados_handler_exports = {};
__export(scheduled_sync_crm_fechados_handler_exports, {
  handleSincronizarCrmFechados: () => handleSincronizarCrmFechados
});
async function handleSincronizarCrmFechados(req, res) {
  try {
    const resultado = await sincronizarCrmFechados();
    return res.json({ ok: resultado.ok, resultado, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (erro) {
    console.error(`\u274C [CRON] Erro na sincroniza\xE7\xE3o de fechados do CRM:`, erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
}
var init_scheduled_sync_crm_fechados_handler = __esm({
  "server/sync/scheduled-sync-crm-fechados-handler.ts"() {
    "use strict";
    init_scheduled_sync_crm_fechados();
  }
});

// server/sync/scheduled-sync-perfil-cnpj.ts
function parseDataOsFlexivel2(s) {
  if (!s) return null;
  const texto = s.trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}
function classificarDocumento2(doc) {
  const limpo = doc.replace(/\D/g, "");
  if (limpo.length === 14) return { tipo: "cnpj", limpo };
  if (limpo.length === 11) return { tipo: "cpf", limpo };
  return { tipo: "invalido", limpo };
}
function extrairCamposPerfil2(dados) {
  const idadeAnos2 = (() => {
    const d = new Date(dados.data_inicio_atividade);
    if (isNaN(d.getTime())) return null;
    return Number(((Date.now() - d.getTime()) / (365.25 * 864e5)).toFixed(1));
  })();
  return {
    razaoSocial: dados.razao_social,
    situacaoCadastral: dados.situacao_cadastral || null,
    dataInicioAtividade: dados.data_inicio_atividade || null,
    idadeAnos: idadeAnos2 !== null ? String(idadeAnos2) : null,
    porte: dados.porte_empresa || null,
    naturezaJuridica: dados.natureza_juridica || null,
    qtdSocios: Array.isArray(dados.QSA) ? dados.QSA.length : null,
    capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
    uf: dados.uf || null,
    municipio: dados.municipio || null,
    cnaePrincipal: dados.cnae_principal || null,
    dadosJson: JSON.stringify(dados)
  };
}
async function buscarOSPorNumeroComRetry(numero) {
  let ultimoErro;
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
async function sincronizarPerfilCnpj() {
  const inicio = Date.now();
  const vazio = {
    totalCandidatos: 0,
    processados: 0,
    sucessoCnpj: 0,
    pessoaFisica: 0,
    semDocumento: 0,
    falhaErp: 0,
    falhaOpenCnpj: 0,
    restantes: 0
  };
  try {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [osRows, mapeados] = await Promise.all([
      db5.select({
        empresa: historicoOs.empresa,
        tipoOs: historicoOs.tipoOs,
        status: historicoOs.status,
        valorTotal: historicoOs.valorTotal,
        valorOs: historicoOs.valorOs,
        osNumero: historicoOs.osNumero,
        dataAprovacao: historicoOs.dataAprovacao
      }).from(historicoOs),
      db5.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj)
    ]);
    const jaMapeados = new Set(mapeados.map((m) => m.empresaKey));
    const porCliente = /* @__PURE__ */ new Map();
    for (const r of osRows) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (!nome) continue;
      const key = normalizeEmpresaKey(nome);
      if (jaMapeados.has(key)) continue;
      const dataOs = parseDataOsFlexivel2(r.dataAprovacao);
      const valor = parseFloat(String(r.valorOs ?? r.valorTotal ?? "0")) || 0;
      const atual = porCliente.get(key) ?? { empresa: nome, valor: 0, osMaisRecente: null, dataMaisRecente: null };
      atual.valor += valor;
      if (r.osNumero && dataOs && (!atual.dataMaisRecente || dataOs > atual.dataMaisRecente)) {
        atual.osMaisRecente = r.osNumero;
        atual.dataMaisRecente = dataOs;
      }
      porCliente.set(key, atual);
    }
    const todosCandidatos = [...porCliente.entries()].map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, osReferencia: v.osMaisRecente })).filter((c) => !!c.osReferencia).sort((a, b) => porCliente.get(b.empresaKey).valor - porCliente.get(a.empresaKey).valor);
    const candidatos = todosCandidatos.slice(0, LIMITE_CANDIDATOS);
    let sucessoCnpj = 0, pessoaFisica = 0, semDocumento = 0, falhaErp = 0, falhaOpenCnpj = 0, processados = 0;
    for (const c of candidatos) {
      if (Date.now() - inicio > LIMITE_TEMPO_MS) break;
      processados++;
      let osErp;
      try {
        osErp = await buscarOSPorNumeroComRetry(c.osReferencia);
      } catch {
        falhaErp++;
        continue;
      }
      const doc = osErp?.cliente_cnpj_cpf;
      if (!doc) {
        semDocumento++;
        continue;
      }
      const { tipo, limpo } = classificarDocumento2(doc);
      if (tipo === "cpf") {
        pessoaFisica++;
        continue;
      }
      if (tipo === "invalido") {
        semDocumento++;
        continue;
      }
      try {
        const dados = await consultarCnpj(limpo);
        const campos = extrairCamposPerfil2(dados);
        const agora = /* @__PURE__ */ new Date();
        await db5.insert(clientesPerfilCnpj).values({
          empresaKey: c.empresaKey,
          empresaExibicao: c.empresa,
          cnpj: limpo,
          ...campos,
          origem: "mubisys",
          vinculadoPor: "cron-sincronizarPerfilCnpj",
          vinculadoEm: agora,
          updatedAt: agora
        });
        sucessoCnpj++;
      } catch (e) {
        falhaOpenCnpj++;
        if (!(e instanceof CnpjNaoEncontradoError)) {
          console.error(`  [SYNC-PERFIL-CNPJ] falha inesperada em ${c.empresa}:`, e?.message ?? e);
        }
      }
    }
    const restantes = Math.max(0, todosCandidatos.length - processados);
    const tempoExecucaoMs = Date.now() - inicio;
    console.log(`\u2705 [SYNC-PERFIL-CNPJ] processados=${processados} sucesso=${sucessoCnpj} pessoaFisica=${pessoaFisica} semDocumento=${semDocumento} falhaErp=${falhaErp} falhaOpenCnpj=${falhaOpenCnpj} restantes=${restantes} em ${tempoExecucaoMs}ms`);
    return { ok: true, totalCandidatos: todosCandidatos.length, processados, sucessoCnpj, pessoaFisica, semDocumento, falhaErp, falhaOpenCnpj, restantes, tempoExecucaoMs };
  } catch (erro) {
    const tempoExecucaoMs = Date.now() - inicio;
    console.error("\u274C [SYNC-PERFIL-CNPJ] Erro:", erro);
    return { ok: false, ...vazio, tempoExecucaoMs, erro: erro?.message || "Erro desconhecido" };
  }
}
var LIMITE_CANDIDATOS, LIMITE_TEMPO_MS, MAX_TENTATIVAS_OS, RETRY_BACKOFF_MS, sleep;
var init_scheduled_sync_perfil_cnpj = __esm({
  "server/sync/scheduled-sync-perfil-cnpj.ts"() {
    "use strict";
    init_db();
    init_schema();
    init_opencnpj_client();
    init_mubisys_client();
    init_performanceComercial();
    LIMITE_CANDIDATOS = 40;
    LIMITE_TEMPO_MS = 45e3;
    MAX_TENTATIVAS_OS = 2;
    RETRY_BACKOFF_MS = [800];
    sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  }
});

// server/sync/scheduled-sync-perfil-cnpj-handler.ts
var scheduled_sync_perfil_cnpj_handler_exports = {};
__export(scheduled_sync_perfil_cnpj_handler_exports, {
  handleSincronizarPerfilCnpj: () => handleSincronizarPerfilCnpj
});
async function handleSincronizarPerfilCnpj(req, res) {
  try {
    const resultado = await sincronizarPerfilCnpj();
    return res.json({ ok: resultado.ok, resultado, timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  } catch (erro) {
    console.error("\u274C [CRON] Erro na sincroniza\xE7\xE3o de perfil CNPJ:", erro);
    return res.status(500).json({
      error: erro?.message || "Erro desconhecido",
      context: { url: req.url, timestamp: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
}
var init_scheduled_sync_perfil_cnpj_handler = __esm({
  "server/sync/scheduled-sync-perfil-cnpj-handler.ts"() {
    "use strict";
    init_scheduled_sync_perfil_cnpj();
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
import { z as z28 } from "zod";

// server/routers/logistica.ts
init_trpc();
init_db_helpers_select();
init_db_connection();
init_mubisys_frete();
init_mubisys_client();
init_schema();
import { z } from "zod";
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
    googleMapsUrl: z.string().optional(),
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
    googleMapsUrl: z.string().optional(),
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
  let nomeCliente2 = String(os.cliente ?? "").trim();
  if (!cnpj && os.cliente_id) {
    const cli = await buscarClientePorId(os.cliente_id);
    if (cli) {
      cnpj = formatarDocumento(cli.cnpj_cpf);
      if (!nomeCliente2) nomeCliente2 = cli.razao_social ?? "";
    }
  }
  return {
    nomeCliente: nomeCliente2,
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
init_trpc();
init_llm();
init_db();
import { z as z2 } from "zod";

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
init_trpc();
init_db();
init_schema();
import { z as z3 } from "zod";
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
init_trpc();
init_db();
init_schema();
init_anthropic_client();
init_performanceComercial();
import { z as z6 } from "zod";
import * as XLSX from "xlsx";
import { eq as eq8, and as and7 } from "drizzle-orm";
import { TRPCError as TRPCError3 } from "@trpc/server";
var MESES_NOMES = ["", "Janeiro", "Fevereiro", "Mar\xE7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
var fmtR = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
async function calcularRadarMargens(db5) {
  const rows = await db5.select({
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
    vendedor: historicoOs.vendedor,
    valorOs: historicoOs.valorOs,
    materiaPrima: historicoOs.materiaPrima,
    custoFixo: historicoOs.custoFixo,
    maoDeObra: historicoOs.maoDeObra,
    tarifasFinanceiras: historicoOs.tarifasFinanceiras,
    comissoesInternas: historicoOs.comissoesInternas,
    comissoesExternas: historicoOs.comissoesExternas,
    terceirizados: historicoOs.terceirizados,
    tributos: historicoOs.tributos,
    resultadoReais: historicoOs.resultadoReais,
    contribuicaoReais: historicoOs.contribuicaoReais
  }).from(historicoOs);
  const num2 = (v) => parseFloat(String(v ?? "0")) || 0;
  const novoMesAcc = (mes, ano) => ({
    mes,
    ano,
    count: 0,
    valorOs: 0,
    materiaPrima: 0,
    custoFixo: 0,
    maoDeObra: 0,
    tarifasFinanceiras: 0,
    comissoes: 0,
    terceirizados: 0,
    tributos: 0,
    resultado: 0,
    contribuicao: 0
  });
  const porMes = /* @__PURE__ */ new Map();
  const porVendedor = /* @__PURE__ */ new Map();
  const porAnoStatus = /* @__PURE__ */ new Map();
  for (const os of rows) {
    const tipo = (os.tipoOs ?? "").toLowerCase();
    const tipoNormal = os.tipoOs != null && !tipo.startsWith("retrabalho") && tipo !== "amostra" && tipo !== "cortesia";
    if (tipoNormal) {
      const status = os.status || "Sem status";
      const chaveStatus = `${os.ano}-${status}`;
      const sAcc = porAnoStatus.get(chaveStatus) ?? { ano: os.ano, status, count: 0 };
      sAcc.count += 1;
      porAnoStatus.set(chaveStatus, sAcc);
    }
    if (!isOsNormalDb(os)) continue;
    const valorOs = num2(os.valorOs);
    const chaveMes = `${os.ano}-${String(os.mes).padStart(2, "0")}`;
    const acc = porMes.get(chaveMes) ?? novoMesAcc(os.mes, os.ano);
    acc.count += 1;
    acc.valorOs += valorOs;
    acc.materiaPrima += num2(os.materiaPrima);
    acc.custoFixo += num2(os.custoFixo);
    acc.maoDeObra += num2(os.maoDeObra);
    acc.tarifasFinanceiras += num2(os.tarifasFinanceiras);
    acc.comissoes += num2(os.comissoesInternas) + num2(os.comissoesExternas);
    acc.terceirizados += num2(os.terceirizados);
    acc.tributos += num2(os.tributos);
    acc.resultado += num2(os.resultadoReais);
    acc.contribuicao += num2(os.contribuicaoReais);
    porMes.set(chaveMes, acc);
    const vendedor = os.vendedor || "Sem vendedor";
    const vAcc = porVendedor.get(vendedor) ?? { vendedor, count: 0, valorOs: 0, resultado: 0, contribuicao: 0 };
    vAcc.count += 1;
    vAcc.valorOs += valorOs;
    vAcc.resultado += num2(os.resultadoReais);
    vAcc.contribuicao += num2(os.contribuicaoReais);
    porVendedor.set(vendedor, vAcc);
  }
  const meses = [...porMes.values()].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes).map((m) => {
    const variavel = m.materiaPrima + m.tributos + m.comissoes + m.terceirizados;
    const fixo = m.custoFixo + m.maoDeObra + m.tarifasFinanceiras;
    const pct = (v) => m.valorOs ? v / m.valorOs * 100 : 0;
    return {
      mes: m.mes,
      ano: m.ano,
      label: `${MESES_NOMES[m.mes].slice(0, 3)}/${String(m.ano).slice(2)}`,
      count: m.count,
      valorOs: m.valorOs,
      variavel,
      fixo,
      materiaPrima: m.materiaPrima,
      custoFixoPuro: m.custoFixo,
      maoDeObra: m.maoDeObra,
      tributos: m.tributos,
      comissoes: m.comissoes,
      terceirizados: m.terceirizados,
      resultado: m.resultado,
      contribuicao: m.contribuicao,
      resultadoPct: pct(m.resultado),
      contribuicaoPct: pct(m.contribuicao),
      ticketMedio: m.count ? m.valorOs / m.count : 0,
      fixoPorOS: m.count ? fixo / m.count : 0,
      variavelPct: pct(variavel),
      fixoPct: pct(fixo),
      materiaPrimaPct: pct(m.materiaPrima),
      tributosPct: pct(m.tributos),
      comissoesPct: pct(m.comissoes),
      terceirizadosPct: pct(m.terceirizados),
      custoFixoPuroPct: pct(m.custoFixo),
      maoDeObraPct: pct(m.maoDeObra)
    };
  });
  const vendedores = [...porVendedor.values()].filter((v) => v.count >= 5).sort((a, b) => b.valorOs - a.valorOs).map((v) => ({
    ...v,
    resultadoPct: v.valorOs ? v.resultado / v.valorOs * 100 : 0,
    contribuicaoPct: v.valorOs ? v.contribuicao / v.valorOs * 100 : 0
  }));
  const statusPorAno = [...porAnoStatus.values()].sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : b.count - a.count);
  return { meses, vendedores, statusPorAno };
}
async function montarContextoFinanceiro(db5) {
  const [mensal, dre, fixosAtivos, marketingRows, dividasAtivas, radar] = await Promise.all([
    db5.select().from(financeiroMensal),
    db5.select().from(dreMensal),
    db5.select().from(custosFixos).where(eq8(custosFixos.ativo, true)),
    db5.select().from(custoMarketing),
    db5.select().from(dividasParcelamentos).where(eq8(dividasParcelamentos.ativo, true)),
    calcularRadarMargens(db5)
  ]);
  const linhasMensal = mensal.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes).map((r) => {
    const campos = [];
    const add = (label, v) => {
      if (v != null) campos.push(`${label}=${fmtR(Number(v))}`);
    };
    add("Faturamento", r.faturamentoOficial);
    add("DespFixas", r.despesasFixas);
    add("DespVariaveis", r.despesasVariaveis);
    add("LucroLiquido", r.lucroLiquido);
    add("SaldoMes", r.saldoMes);
    add("TL1", r.tl1);
    add("TL2", r.tl2);
    add("TL3", r.tl3);
    add("ImpostoDAS", r.impostoDas);
    add("ICMS_DIFAL", r.impostoIcmsDifal);
    add("DAEMS", r.impostoDaems);
    add("ComissoesBV", r.comissoesBv);
    add("ProdutividadeSolda", r.produtividadeSolda);
    add("FreteRetrabalho", r.freteRetrabalho);
    add("DevSoftware", r.devSoftware);
    if (r.numColaboradores != null) campos.push(`Colaboradores=${r.numColaboradores}`);
    return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados preenchidos)"}`;
  });
  const linhasDre = dre.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes).map((r) => {
    const campos = [];
    const add = (label, v) => {
      if (v != null) campos.push(`${label}=${fmtR(Number(v))}`);
    };
    add("ReceitaOpBruta", r.receitaOperacionalBruta);
    add("LucroBruto", r.lucroBruto);
    add("LucroOperacional", r.lucroOperacional);
    add("LucroLiquido", r.lucroLiquido);
    add("MateriaPrima", r.materiaPrima);
    add("DespesasFixas", r.despesasFixas);
    return `${MESES_NOMES[r.mes]}/${r.ano}: ${campos.join(", ") || "(sem dados)"}`;
  });
  const totalCustosFixos = fixosAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);
  const totalMarketing = marketingRows.reduce((s, m) => s + Number(m.investimento || 0), 0);
  const porAno = /* @__PURE__ */ new Map();
  for (const m of radar.meses) {
    const a = porAno.get(m.ano) ?? { count: 0, valorOs: 0, resultado: 0, contribuicao: 0 };
    a.count += m.count;
    a.valorOs += m.valorOs;
    a.resultado += m.resultado;
    a.contribuicao += m.contribuicao;
    porAno.set(m.ano, a);
  }
  const linhasRadarAno = [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, a]) => {
    const resPct = a.valorOs ? a.resultado / a.valorOs * 100 : 0;
    const conPct = a.valorOs ? a.contribuicao / a.valorOs * 100 : 0;
    return `${ano}: ${a.count} O.S. vendidas, ValorVendido=${fmtR(a.valorOs)}, ResultadoLiquido=${fmtR(a.resultado)} (${resPct.toFixed(1)}%), MargemContribuicao=${fmtR(a.contribuicao)} (${conPct.toFixed(1)}%)`;
  });
  const linhasVendedores = radar.vendedores.slice(0, 8).map((v) => `${v.vendedor}: ${v.count} O.S., ValorVendido=${fmtR(v.valorOs)}, MargemLiquida=${v.resultadoPct.toFixed(1)}%, MargemContribuicao=${v.contribuicaoPct.toFixed(1)}%`);
  return `## DADOS FINANCEIROS DISPON\xCDVEIS (banco de produ\xE7\xE3o, consultado agora)

### Painel Financeiro mensal (financeiro_mensal) \u2014 fonte oficial de faturamento
${linhasMensal.length ? linhasMensal.join("\n") : "Nenhum m\xEAs cadastrado."}

### DRE Gerencial mensal (dre_mensal) \u2014 alimentado pelo ERP (MubiSys), pode divergir do faturamento oficial acima
${linhasDre.length ? linhasDre.join("\n") : "Nenhum m\xEAs cadastrado."}

### Custos Fixos ativos cadastrados
Total mensal previsto: ${fmtR(totalCustosFixos)} (${fixosAtivos.length} itens ativos)

### Marketing
Investimento total acumulado (todos os meses cadastrados): ${fmtR(totalMarketing)}

### D\xEDvidas e Parcelamentos ativos
${dividasAtivas.length} registro(s) ativo(s).

### Radar de Margens (historico_os) \u2014 resultado l\xEDquido e margem de contribui\xE7\xE3o por O.S., agrupado pelo m\xEAs em que a O.S. foi vendida/aprovada (n\xE3o pela data de faturamento). Exclui retrabalho, amostra, cortesia e canceladas.
Totais por ano:
${linhasRadarAno.length ? linhasRadarAno.join("\n") : "Sem hist\xF3rico de O.S. sincronizado."}

Ranking de vendedores (hist\xF3rico completo, m\xEDnimo 5 O.S.):
${linhasVendedores.length ? linhasVendedores.join("\n") : "Sem vendedores com volume suficiente."}

## O QUE N\xC3O EST\xC1 DISPON\xCDVEL NESTE CONTEXTO (n\xE3o invente estes n\xFAmeros)
- Or\xE7ado/Budget mensal (n\xE3o existe cadastro de metas no sistema hoje)
- Deprecia\xE7\xE3o/amortiza\xE7\xE3o e juros separados de despesas fixas (portanto EBITDA calculado aqui \xE9 aproximado e coincide com Lucro L\xEDquido)
- Dados por produto/canal (o Radar de Margens acima cobre vendedor, mas n\xE3o produto/canal \u2014 necess\xE1rios para Pareto, LTV/CAC completos)
- Capital investido e patrim\xF4nio l\xEDquido (necess\xE1rios para ROIC/ROE)
- Prazos de recebimento/pagamento (necess\xE1rios para Capital de Giro e Ciclo de Caixa)`;
}
var MESES_ABREV_PT = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12
};
var LABEL_DESPESAS_FIXAS = "(-) Despesas Fixas (Exceto D\xEDvidas e Investimentos)";
var LABEL_DESPESAS_VARIAVEIS = "(-) Despesas Vari\xE1veis";
var LABEL_TL1 = "(=) TL1";
var LABEL_TL2 = "(=) TL2";
var LABEL_TL3 = "(=) TL3";
var LABEL_RESULTADO = "Resultado";
var LABEL_RECEITAS_CAIXA = "1 - Receitas";
var CAMPOS_FECHAMENTO = [
  { campo: "despesasFixas", label: LABEL_DESPESAS_FIXAS },
  { campo: "despesasVariaveis", label: LABEL_DESPESAS_VARIAVEIS },
  { campo: "tl1", label: LABEL_TL1 },
  { campo: "tl2", label: LABEL_TL2 },
  { campo: "impostoDas", label: "2 . 1 . 1 . 1 - DAS Simples Nacional" },
  { campo: "impostoIcmsDifal", label: "2 . 1 . 1 . 3 - ICMS DIFAL e EQUALIZADOR" },
  { campo: "impostoDaems", label: "2 . 1 . 1 . 4 - DAEMS" },
  { campo: "comissoesBv", label: "2 . 1 . 2 . 1 - Comiss\xF5es BV | Vendas Externas" },
  { campo: "freteRetrabalho", label: "2 . 1 . 2 . 3 - Frete Retrabalho" },
  { campo: "produtividadeSolda", label: "2 . 4 . 4 - Produtividade Solda" },
  { campo: "devSoftware", label: "2 . 9 . 6 - Desenvolvimento de Software" }
];
var CAMPOS_LABELS_PT = {
  despesasFixas: "Despesas Fixas",
  despesasVariaveis: "Despesas Vari\xE1veis",
  tl1: "TL1",
  tl2: "TL2",
  tl3: "TL3 (Resultado)",
  saldoMes: "Saldo do M\xEAs",
  impostoDas: "DAS Simples Nacional",
  impostoIcmsDifal: "ICMS DIFAL",
  impostoDaems: "DAEMS",
  comissoesBv: "Comiss\xF5es BV",
  freteRetrabalho: "Frete Retrabalho",
  produtividadeSolda: "Produtividade Solda",
  devSoftware: "Desenvolvimento de Software"
};
function parseValorMonetario(v) {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const s = String(v).trim();
  if (s === "") return null;
  if (/^-?\s*(r\$)?\s*-\s*$/i.test(s)) return 0;
  const limpo = s.replace(/r\$/i, "").replace(/\s/g, "").replace(/,/g, "");
  const n = parseFloat(limpo);
  return isNaN(n) ? null : n;
}
function parsePlanilhaFechamento(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const nomeAba = wb.SheetNames.find((n) => n.trim().toLowerCase() === "fluxo de caixa") ?? wb.SheetNames.find((n) => n.toLowerCase().includes("fluxo de caixa"));
  if (!nomeAba) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: `Aba "Fluxo de Caixa" n\xE3o encontrada no arquivo. Abas dispon\xEDveis: ${wb.SheetNames.join(", ")}` });
  }
  const ws = wb.Sheets[nomeAba];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (rows.length === 0) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: `A aba "Fluxo de Caixa" est\xE1 vazia.` });
  }
  const header = rows[0] ?? [];
  const colunasMes = [];
  for (let col = 1; col < header.length; col++) {
    const raw = header[col];
    if (typeof raw !== "string") continue;
    const m = /^([A-Za-z]{3})\/(\d{4})$/.exec(raw.trim());
    if (!m) continue;
    const mes = MESES_ABREV_PT[m[1].toLowerCase()];
    if (!mes) continue;
    colunasMes.push({ col, mes, ano: parseInt(m[2], 10) });
  }
  if (colunasMes.length === 0) {
    throw new TRPCError3({ code: "BAD_REQUEST", message: `N\xE3o encontrei colunas de m\xEAs (ex: "Jan/2026") no cabe\xE7alho da aba "Fluxo de Caixa".` });
  }
  const linhaPorLabel = /* @__PURE__ */ new Map();
  for (let i = 1; i < rows.length; i++) {
    const cel = rows[i]?.[0];
    if (typeof cel !== "string") continue;
    const texto = cel.trim();
    if (!linhaPorLabel.has(texto)) linhaPorLabel.set(texto, i);
  }
  const camposAusentes = CAMPOS_FECHAMENTO.filter(({ label }) => !linhaPorLabel.has(label)).map(({ campo }) => campo);
  const linhaResultado = linhaPorLabel.get(LABEL_RESULTADO);
  const linhaTl3 = linhaPorLabel.get(LABEL_TL3);
  if (linhaResultado == null && linhaTl3 == null) camposAusentes.push("tl3");
  const linhaReceitasCaixa = linhaPorLabel.get(LABEL_RECEITAS_CAIXA);
  const meses = colunasMes.map(({ col, mes, ano }) => {
    const valores = {};
    for (const { campo, label } of CAMPOS_FECHAMENTO) {
      const linha = linhaPorLabel.get(label);
      valores[campo] = linha != null ? parseValorMonetario(rows[linha]?.[col]) : null;
    }
    let tl3 = linhaResultado != null ? parseValorMonetario(rows[linhaResultado]?.[col]) : null;
    if (tl3 == null && linhaTl3 != null) tl3 = parseValorMonetario(rows[linhaTl3]?.[col]);
    valores.tl3 = tl3;
    valores.saldoMes = tl3;
    const receitaCaixa = linhaReceitasCaixa != null ? parseValorMonetario(rows[linhaReceitasCaixa]?.[col]) : null;
    return { mes, ano, valores, receitaCaixa };
  });
  return { meses, camposAusentes };
}
var financeiroRouter = router({
  // Buscar dados financeiros de um mês/ano específico
  get: publicProcedure.input(z6.object({ mes: z6.number(), ano: z6.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(financeiroMensal).where(and7(eq8(financeiroMensal.mes, input.mes), eq8(financeiroMensal.ano, input.ano))).limit(1);
    return rows[0] ?? null;
  }),
  // Listar todos os registros financeiros
  list: publicProcedure.input(z6.object({ ano: z6.number().optional() }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(financeiroMensal);
    if (input?.ano) return rows.filter((r) => r.ano === input.ano);
    return rows.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes);
  }),
  // Criar ou atualizar registro financeiro mensal
  upsert: publicProcedure.input(z6.object({
    mes: z6.number().min(1).max(12),
    ano: z6.number().min(2020).max(2100),
    faturamentoOficial: z6.number().nullable().optional(),
    despesasFixas: z6.number().nullable().optional(),
    despesasVariaveis: z6.number().nullable().optional(),
    numColaboradores: z6.number().int().nullable().optional(),
    lucroBruto: z6.number().nullable().optional(),
    lucroLiquido: z6.number().nullable().optional(),
    notas: z6.string().nullable().optional(),
    // Novos campos a partir de Abr/2026
    impostoDas: z6.number().nullable().optional(),
    impostoIcmsDifal: z6.number().nullable().optional(),
    impostoDaems: z6.number().nullable().optional(),
    comissoesBv: z6.number().nullable().optional(),
    produtividadeSolda: z6.number().nullable().optional(),
    freteRetrabalho: z6.number().nullable().optional(),
    devSoftware: z6.number().nullable().optional(),
    receitaOperacionalOs: z6.number().nullable().optional(),
    resultadoEfetivo: z6.number().nullable().optional(),
    saldoMes: z6.number().nullable().optional(),
    tl1: z6.number().nullable().optional(),
    tl2: z6.number().nullable().optional(),
    tl3: z6.number().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const existing = await db5.select().from(financeiroMensal).where(and7(eq8(financeiroMensal.mes, input.mes), eq8(financeiroMensal.ano, input.ano))).limit(1);
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
      await db5.update(financeiroMensal).set(data).where(eq8(financeiroMensal.id, existing[0].id));
      return { ...existing[0], ...data };
    } else {
      const [result] = await db5.insert(financeiroMensal).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: financeiroMensal.id });
      return { id: result.id, mes: input.mes, ano: input.ano, ...data };
    }
  }),
  // Upload da planilha de fechamento mensal ("Fechamento -AAAA.MM.xlsx", aba
  // "Fluxo de Caixa") — processa no servidor e faz upsert por mês/ano em
  // financeiro_mensal, com os mesmos campos que o formulário/`upsert` já usa.
  // faturamentoOficial: se já houver valor cadastrado manualmente (conferido com
  // a contabilidade), nunca é sobrescrito. Se estiver vazio, é preenchido com a
  // linha "1 - Receitas" (caixa) como aproximação — sabidamente não bate exato
  // com o valor oficial (~1-5% de diferença observada), por isso fica marcado
  // como "aproximado" no retorno para revisão posterior.
  uploadFechamentoMensal: publicProcedure.input(z6.object({
    arquivoBase64: z6.string().min(1),
    nomeArquivo: z6.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new TRPCError3({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    let buffer;
    try {
      buffer = Buffer.from(input.arquivoBase64, "base64");
    } catch {
      throw new TRPCError3({ code: "BAD_REQUEST", message: "Arquivo inv\xE1lido." });
    }
    const { meses, camposAusentes } = parsePlanilhaFechamento(buffer);
    const mesesProcessados = [];
    for (const { mes, ano, valores, receitaCaixa } of meses) {
      const existing = await db5.select().from(financeiroMensal).where(and7(eq8(financeiroMensal.mes, mes), eq8(financeiroMensal.ano, ano))).limit(1);
      const data = {};
      const camposVazios = [];
      for (const [campo, valor] of Object.entries(valores)) {
        if (valor == null) {
          camposVazios.push(CAMPOS_LABELS_PT[campo] ?? campo);
          data[campo] = null;
        } else {
          data[campo] = valor.toFixed(2);
        }
      }
      let faturamentoAtual = existing[0]?.faturamentoOficial != null ? parseFloat(existing[0].faturamentoOficial) : null;
      let faturamentoOrigem = "manual";
      if (faturamentoAtual == null) {
        if (receitaCaixa != null) {
          faturamentoAtual = receitaCaixa;
          data.faturamentoOficial = receitaCaixa.toFixed(2);
          faturamentoOrigem = "aproximado_caixa";
        } else {
          faturamentoOrigem = "sem_dado";
        }
      }
      if (faturamentoAtual != null && valores.despesasFixas != null && valores.despesasVariaveis != null) {
        const lucro = faturamentoAtual - valores.despesasFixas - valores.despesasVariaveis;
        data.lucroBruto = lucro.toFixed(2);
        data.lucroLiquido = lucro.toFixed(2);
      }
      if (existing.length > 0) {
        await db5.update(financeiroMensal).set(data).where(eq8(financeiroMensal.id, existing[0].id));
        mesesProcessados.push({ mes, ano, status: "atualizado", camposVazios, faturamentoOrigem });
      } else {
        await db5.insert(financeiroMensal).values({ mes, ano, ...data });
        mesesProcessados.push({ mes, ano, status: "criado", camposVazios, faturamentoOrigem });
      }
    }
    return {
      nomeArquivo: input.nomeArquivo ?? null,
      mesesProcessados: mesesProcessados.sort((a, b) => a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes),
      camposNaoEncontradosNaPlanilha: camposAusentes.map((c) => CAMPOS_LABELS_PT[c] ?? c)
    };
  }),
  // ─── Custo Marketing ─────────────────────────────────────────────────────────
  getCustoMarketing: publicProcedure.input(z6.object({ mes: z6.number(), ano: z6.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(custoMarketing).where(and7(eq8(custoMarketing.mes, input.mes), eq8(custoMarketing.ano, input.ano))).limit(1);
    return rows[0] ?? null;
  }),
  getCustoMarketingAno: publicProcedure.input(z6.object({ ano: z6.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custoMarketing).where(eq8(custoMarketing.ano, input.ano));
    return rows.sort((a, b) => a.mes - b.mes);
  }),
  upsertCustoMarketing: publicProcedure.input(z6.object({
    mes: z6.number().min(1).max(12),
    ano: z6.number().min(2020).max(2100),
    // Tri-state: campo OMITIDO mantém o valor já gravado (update parcial);
    // null LIMPA o campo (marca como "não preenchido", distinto de zero);
    // número define o valor. Nunca força "0" silenciosamente — ver
    // drizzle/schema.ts (custoMarketing) para o motivo da coluna ser nullable.
    investimentoAquisicao: z6.number().min(0).nullable().optional(),
    investimentoReativacao: z6.number().min(0).nullable().optional(),
    observacao: z6.string().nullable().optional()
  })).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const existing = await db5.select().from(custoMarketing).where(and7(eq8(custoMarketing.mes, input.mes), eq8(custoMarketing.ano, input.ano))).limit(1);
    const aquisicaoFinal = input.investimentoAquisicao !== void 0 ? input.investimentoAquisicao : existing[0]?.investimentoAquisicao != null ? Number(existing[0].investimentoAquisicao) : null;
    const reativacaoFinal = input.investimentoReativacao !== void 0 ? input.investimentoReativacao : existing[0]?.investimentoReativacao != null ? Number(existing[0].investimentoReativacao) : null;
    const data = {
      investimentoAquisicao: aquisicaoFinal != null ? String(aquisicaoFinal) : null,
      investimentoReativacao: reativacaoFinal != null ? String(reativacaoFinal) : null,
      // Soma dos dois componentes — null só se os DOIS estiverem vazios (nunca
      // trata "não preenchido" como zero na soma).
      investimento: aquisicaoFinal == null && reativacaoFinal == null ? null : String((aquisicaoFinal ?? 0) + (reativacaoFinal ?? 0)),
      observacao: input.observacao !== void 0 ? input.observacao : existing[0]?.observacao ?? null
    };
    const usuario = {
      usuarioId: ctx.user?.id ?? null,
      usuarioNome: ctx.user?.name ?? null,
      usuarioRole: ctx.user?.role ?? null
    };
    if (existing.length > 0) {
      await db5.update(custoMarketing).set(data).where(eq8(custoMarketing.id, existing[0].id));
      insertAuditLogCustoMarketing({
        custoMarketingId: existing[0].id,
        mes: input.mes,
        ano: input.ano,
        acao: "EDICAO",
        ...usuario,
        valoresAnteriores: existing[0],
        valoresNovos: { ...existing[0], ...data }
      }).catch(() => {
      });
      return { ...existing[0], ...data };
    } else {
      const [result] = await db5.insert(custoMarketing).values({ mes: input.mes, ano: input.ano, ...data }).returning({ id: custoMarketing.id });
      insertAuditLogCustoMarketing({
        custoMarketingId: result.id,
        mes: input.mes,
        ano: input.ano,
        acao: "CRIACAO",
        ...usuario,
        valoresAnteriores: null,
        valoresNovos: { id: result.id, mes: input.mes, ano: input.ano, ...data }
      }).catch(() => {
      });
      return { id: result.id, mes: input.mes, ano: input.ano, ...data };
    }
  }),
  // Histórico de auditoria de custo_marketing (quem/quando criou ou editou um valor)
  getAuditoriaCustoMarketing: publicProcedure.input(z6.object({ ano: z6.number() })).query(({ input }) => listAuditLogsCustoMarketing(input.ano)),
  // Importação em lote (planilha): agrega valores por mês/ano/categoria e faz upsert
  importCustoMarketingLote: publicProcedure.input(z6.array(z6.object({
    mes: z6.number().min(1).max(12),
    ano: z6.number().min(2020).max(2100),
    categoria: z6.enum(["aquisicao", "reativacao"]),
    valor: z6.number().min(0)
  }))).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const usuario = {
      usuarioId: ctx.user?.id ?? null,
      usuarioNome: ctx.user?.name ?? null,
      usuarioRole: ctx.user?.role ?? null
    };
    const agregados = /* @__PURE__ */ new Map();
    for (const linha of input) {
      const chave = `${linha.ano}-${linha.mes}`;
      const atual = agregados.get(chave) ?? { mes: linha.mes, ano: linha.ano, aquisicao: 0, reativacao: 0 };
      if (linha.categoria === "aquisicao") atual.aquisicao += linha.valor;
      else atual.reativacao += linha.valor;
      agregados.set(chave, atual);
    }
    const resultados = [];
    for (const { mes, ano, aquisicao, reativacao } of agregados.values()) {
      const existing = await db5.select().from(custoMarketing).where(and7(eq8(custoMarketing.mes, mes), eq8(custoMarketing.ano, ano))).limit(1);
      const aquisicaoTotal = (existing[0]?.investimentoAquisicao != null ? Number(existing[0].investimentoAquisicao) : 0) + aquisicao;
      const reativacaoTotal = (existing[0]?.investimentoReativacao != null ? Number(existing[0].investimentoReativacao) : 0) + reativacao;
      const data = {
        investimentoAquisicao: String(aquisicaoTotal),
        investimentoReativacao: String(reativacaoTotal),
        investimento: String(aquisicaoTotal + reativacaoTotal)
      };
      if (existing.length > 0) {
        await db5.update(custoMarketing).set(data).where(eq8(custoMarketing.id, existing[0].id));
        insertAuditLogCustoMarketing({
          custoMarketingId: existing[0].id,
          mes,
          ano,
          acao: "EDICAO",
          ...usuario,
          valoresAnteriores: existing[0],
          valoresNovos: { ...existing[0], ...data }
        }).catch(() => {
        });
        resultados.push({ id: existing[0].id, mes, ano, ...data });
      } else {
        const [result] = await db5.insert(custoMarketing).values({ mes, ano, ...data }).returning({ id: custoMarketing.id });
        insertAuditLogCustoMarketing({
          custoMarketingId: result.id,
          mes,
          ano,
          acao: "CRIACAO",
          ...usuario,
          valoresAnteriores: null,
          valoresNovos: { id: result.id, mes, ano, ...data }
        }).catch(() => {
        });
        resultados.push({ id: result.id, mes, ano, ...data });
      }
    }
    return resultados;
  }),
  // ─── Lançamentos detalhados de Marketing (fornecedor/despesa) ────────────────
  getCustoMarketingItensAno: publicProcedure.input(z6.object({ ano: z6.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custoMarketingItens).where(eq8(custoMarketingItens.ano, input.ano));
    return rows.map((r) => ({ ...r, valor: Number(r.valor) })).sort((a, b) => a.mes !== b.mes ? a.mes - b.mes : (a.dataVencimento?.getTime() ?? 0) - (b.dataVencimento?.getTime() ?? 0));
  }),
  // ─── Custos Fixos ────────────────────────────────────────────────────────────
  getCustosFixos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custosFixos).where(eq8(custosFixos.ativo, true));
    return rows.map((r) => ({ ...r, valor: Number(r.valor) }));
  }),
  upsertCustoFixo: publicProcedure.input(z6.object({
    id: z6.number().optional(),
    plano: z6.string(),
    categoria: z6.string(),
    grupoCategoria: z6.string(),
    fornecedor: z6.string(),
    tipo: z6.string(),
    valor: z6.number().min(0),
    vencimento: z6.number().nullable().optional(),
    observacao: z6.string().nullable().optional()
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
      await db5.update(custosFixos).set(data).where(eq8(custosFixos.id, input.id));
      return { id: input.id, ...data };
    } else {
      const [result] = await db5.insert(custosFixos).values(data).returning({ id: custosFixos.id });
      return { id: result.id, ...data };
    }
  }),
  deleteCustoFixo: publicProcedure.input(z6.object({ id: z6.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.update(custosFixos).set({ ativo: false }).where(eq8(custosFixos.id, input.id));
    return { ok: true };
  }),
  // ─── Dívidas e Parcelamentos ─────────────────────────────────────────────────
  getDividas: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(dividasParcelamentos).where(eq8(dividasParcelamentos.ativo, true));
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
  getDreMensal: publicProcedure.input(z6.object({ ano: z6.number().optional() })).query(async ({ input }) => {
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
  }),
  // ─── Radar de Margens (histórico completo por O.S. em historico_os, agrupado
  // pelo mês/ano em que a O.S. foi vendida — mesma base do backfill do dre_mensal,
  // mas com resultado líquido e margem de contribuição por O.S., que dre_mensal
  // não tem, e ranking por vendedor) ──────────────────────────────────────────
  getRadarMargens: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return { meses: [], vendedores: [], statusPorAno: [] };
    return calcularRadarMargens(db5);
  }),
  // ─── Retenção de clientes (compra única × recompra × intervalo entre compras,
  // por ano de venda — mesma base do Radar de Margens) ──────────────────────────
  getRetencaoClientes: publicProcedure.input(z6.object({
    // Restringe todos os anos ao mesmo recorte jan-mesLimite — sem isso, um ano
    // corrente parcial (poucos meses) parece ter menos recompra só por ainda não
    // ter tido tempo de o cliente voltar, não porque a retenção caiu de verdade.
    mesLimite: z6.number().min(1).max(12).optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { anos: [] };
    const mesLimite = input?.mesLimite;
    const rows = await db5.select({
      ano: historicoOs.ano,
      mes: historicoOs.mes,
      empresa: historicoOs.empresa,
      dataAprovacao: historicoOs.dataAprovacao,
      valorOs: historicoOs.valorOs,
      tipoOs: historicoOs.tipoOs,
      status: historicoOs.status
    }).from(historicoOs);
    const num2 = (v) => parseFloat(String(v ?? "0")) || 0;
    function parseData(s) {
      if (!s) return null;
      let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
      if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
      return null;
    }
    const porAno = /* @__PURE__ */ new Map();
    for (const os of rows) {
      if (!isOsNormalDb(os)) continue;
      if (mesLimite && os.mes > mesLimite) continue;
      const empresa = (os.empresa ?? "").trim();
      if (!empresa) continue;
      const dt = parseData(os.dataAprovacao);
      if (!dt) continue;
      const ano = os.ano;
      if (!porAno.has(ano)) porAno.set(ano, /* @__PURE__ */ new Map());
      const clientes2 = porAno.get(ano);
      const c = clientes2.get(empresa) ?? { count: 0, valor: 0, datas: [] };
      c.count += 1;
      c.valor += num2(os.valorOs);
      c.datas.push(dt);
      clientes2.set(empresa, c);
    }
    const anos = [...porAno.entries()].sort((a, b) => a[0] - b[0]).map(([ano, clientes2]) => {
      let unicos = 0, unicosValor = 0, recompra = 0, recompraValor = 0;
      const intervalos = [];
      for (const c of clientes2.values()) {
        if (c.count === 1) {
          unicos += 1;
          unicosValor += c.valor;
        } else {
          recompra += 1;
          recompraValor += c.valor;
          const datasOrdenadas = [...c.datas].sort((a, b) => a.getTime() - b.getTime());
          for (let i = 1; i < datasOrdenadas.length; i++) {
            const dias = (datasOrdenadas[i].getTime() - datasOrdenadas[i - 1].getTime()) / 864e5;
            if (dias >= 0) intervalos.push(dias);
          }
        }
      }
      intervalos.sort((a, b) => a - b);
      const totalClientes = unicos + recompra;
      return {
        ano,
        totalClientes,
        unicos,
        unicosValor,
        unicosPct: totalClientes ? unicos / totalClientes * 100 : 0,
        recompra,
        recompraValor,
        recompraPct: totalClientes ? recompra / totalClientes * 100 : 0,
        intervaloMedioDias: intervalos.length ? intervalos.reduce((a, b) => a + b, 0) / intervalos.length : null,
        intervaloMedianaDias: intervalos.length ? intervalos[Math.floor(intervalos.length / 2)] : null,
        amostraIntervalos: intervalos.length
      };
    });
    return { anos };
  }),
  // ─── Chat de IA (CFO virtual) ──────────────────────────────────────────────
  perguntarIA: publicProcedure.input(z6.object({
    pergunta: z6.string().min(1),
    historico: z6.array(z6.object({
      role: z6.enum(["user", "assistant"]),
      texto: z6.string()
    })).default([])
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const contexto = await montarContextoFinanceiro(db5);
    const historico = input.historico;
    const resposta = await perguntarSobreFinanceiro(contexto, historico, input.pergunta);
    return { resposta };
  })
});

// server/routers/marketingFinanceiro.ts
init_trpc();
init_db();
init_schema();
init_performanceComercial();
import { z as z7 } from "zod";
import { eq as eq10, and as and8 } from "drizzle-orm";

// server/services/marketingFinanceiroClientes.ts
init_schema();
init_performanceComercial();
import { eq as eq9 } from "drizzle-orm";

// shared/marketing-financeiro.ts
function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function safeDiv(dividendo, divisor) {
  if (dividendo == null || divisor == null || divisor === 0 || !isFinite(dividendo) || !isFinite(divisor)) return null;
  const r = dividendo / divisor;
  return isFinite(r) ? r : null;
}
function pctSobre(parte, base) {
  const r = safeDiv(parte ?? null, base ?? null);
  return r == null ? null : round2(r * 100);
}
function cacPonderado(investimentoTotalAquisicao, clientesNovosTotal) {
  const r = safeDiv(investimentoTotalAquisicao, clientesNovosTotal);
  return r == null ? null : round2(r);
}
function custoReativacaoPonderado(investimentoTotalReativacao, eventosReativacaoTotal) {
  const r = safeDiv(investimentoTotalReativacao, eventosReativacaoTotal);
  return r == null ? null : round2(r);
}
function margemDoPedido(pedido, percentualMargemFallback) {
  if (pedido.contribuicaoReais != null) {
    return { valor: pedido.contribuicaoReais, origem: "real" };
  }
  return { valor: round2(pedido.valorOs * (percentualMargemFallback / 100)), origem: "estimada" };
}
function agregarMargem(pedidos, percentualMargemFallback) {
  if (pedidos.length === 0) {
    return { margemTotal: 0, origem: "sem-dado", pctPedidosComMargemReal: null, qtdPedidos: 0 };
  }
  let margemTotal = 0;
  let qtdReal = 0;
  for (const p of pedidos) {
    const m = margemDoPedido(p, percentualMargemFallback);
    margemTotal += m.valor;
    if (m.origem === "real") qtdReal++;
  }
  const origem = qtdReal === pedidos.length ? "real" : qtdReal === 0 ? "estimada" : "mista";
  return {
    margemTotal: round2(margemTotal),
    origem,
    pctPedidosComMargemReal: round2(qtdReal / pedidos.length * 100),
    qtdPedidos: pedidos.length
  };
}
function agregarLinhas(linhas, percentualMargemFallback) {
  const clientesUnicos = new Set(linhas.map((l) => l.clienteKey).filter((k) => k));
  return {
    qtdOs: linhas.length,
    qtdClientesUnicos: clientesUnicos.size,
    faturamento: round2(linhas.reduce((s, l) => s + l.valorOs, 0)),
    margem: agregarMargem(linhas.map((l) => ({ valorOs: l.valorOs, contribuicaoReais: l.contribuicaoReais })), percentualMargemFallback)
  };
}
function calcularResultadoGrupo(investimento, margemContribuicao, faturamento2) {
  const resultado = investimento == null ? null : round2(margemContribuicao - investimento);
  const roiPct = investimento == null ? null : pctSobre(resultado, investimento);
  const roas = investimento == null ? null : (() => {
    const r = safeDiv(faturamento2, investimento);
    return r == null ? null : round2(r * 100) / 100;
  })();
  return { investimento, margemContribuicao, faturamento: faturamento2, resultado, roiPct, roas };
}
function calcularResultadoConsolidado(grupos) {
  const investimentoTotal = grupos.every((g) => g.investimento == null) ? null : grupos.reduce((s, g) => s + (g.investimento ?? 0), 0);
  const margemTotal = round2(grupos.reduce((s, g) => s + g.margemContribuicao, 0));
  const resultado = investimentoTotal == null ? null : round2(margemTotal - investimentoTotal);
  const roiPct = investimentoTotal == null ? null : pctSobre(resultado, investimentoTotal);
  return { investimento: investimentoTotal, margemContribuicao: margemTotal, faturamento: margemTotal, resultado, roiPct, roas: null };
}
function mediana2(valores) {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 !== 0 ? ord[meio] : round2((ord[meio - 1] + ord[meio]) / 2);
}
function participacaoTopN(valores, n) {
  if (valores.length === 0) return null;
  const total = valores.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const topN = [...valores].sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0);
  return round2(topN / total * 100);
}
function conciliar(totalReferencia, valoresPorCategoria) {
  const somaCategorias = round2(valoresPorCategoria.reduce((s, v) => s + v, 0));
  const divergencia = round2(totalReferencia - somaCategorias);
  return {
    totalReferencia: round2(totalReferencia),
    somaCategorias,
    divergencia,
    divergenciaPct: pctSobre(divergencia, totalReferencia),
    conciliado: Math.abs(divergencia) <= 0.05
  };
}

// server/services/marketingFinanceiroClientes.ts
var num = (v) => parseFloat(String(v ?? "0")) || 0;
var numOuNull = (v) => v == null ? null : parseFloat(v) || 0;
async function buscarOsDoAno(db5, ano) {
  return db5.select({
    osNumero: historicoOs.osNumero,
    empresa: historicoOs.empresa,
    tipoOs: historicoOs.tipoOs,
    status: historicoOs.status,
    mes: historicoOs.mes,
    ano: historicoOs.ano,
    valorOs: historicoOs.valorOs,
    valorTotal: historicoOs.valorTotal,
    contribuicaoReais: historicoOs.contribuicaoReais,
    vendedor: historicoOs.vendedor,
    cidade: historicoOs.cidade,
    estado: historicoOs.estado,
    dataAprovacao: historicoOs.dataAprovacao
  }).from(historicoOs).where(eq9(historicoOs.ano, ano));
}
async function buscarOverrideMap(db5) {
  const overrides = await db5.select().from(clienteOverrides);
  const map = /* @__PURE__ */ new Map();
  for (const ov of overrides) map.set(ov.empresa, ov.status);
  return map;
}
function classificarMes(mes, ano, osDoAno, todasComprasValidas, overrideMap, mesesInatividade) {
  const ultimaCompraPorCliente = reindexarPorChaveNormalizada(ultimaCompraAntesDe(todasComprasValidas, mes, ano));
  const osMes = osDoAno.filter((os) => os.mes === mes);
  const resultado = [];
  for (const os of osMes) {
    if (!isOsNormalDb(os)) continue;
    const valorOs = num(os.valorOs ?? os.valorTotal);
    const contribuicaoReais = numOuNull(os.contribuicaoReais);
    const clienteKey = normalizeEmpresaKey(os.empresa ?? "");
    if (!clienteKey) {
      resultado.push({
        osNumero: os.osNumero,
        empresaOriginal: os.empresa ?? "",
        clienteKey: "",
        mes,
        ano,
        valorOs,
        contribuicaoReais,
        vendedor: os.vendedor,
        cidade: os.cidade,
        estado: os.estado,
        dataAprovacao: os.dataAprovacao,
        categoria: "naoClassificado",
        jaComprouAntes: false,
        gapMesesUltimaCompra: null
      });
      continue;
    }
    const ultima = ultimaCompraPorCliente.get(clienteKey);
    const jaComprouAntes = Boolean(ultima);
    const gapMesesUltimaCompra = ultima ? (ano - ultima.ano) * 12 + (mes - ultima.mes) : null;
    const overrideStatus = overrideMap.get(clienteKey);
    const isNovoOuReativado = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isClienteNovoPorRecencia(ultima, mes, ano, mesesInatividade);
    const categoria = isNovoOuReativado ? jaComprouAntes ? "reativado" : "novo" : "recorrenteAtivo";
    resultado.push({
      osNumero: os.osNumero,
      empresaOriginal: os.empresa ?? "",
      clienteKey,
      mes,
      ano,
      valorOs,
      contribuicaoReais,
      vendedor: os.vendedor,
      cidade: os.cidade,
      estado: os.estado,
      dataAprovacao: os.dataAprovacao,
      categoria,
      jaComprouAntes,
      gapMesesUltimaCompra
    });
  }
  return resultado;
}
async function classificarAno(db5, ano, mesesInatividade) {
  const now = /* @__PURE__ */ new Date();
  const mesLimite = ano === now.getFullYear() ? now.getMonth() + 1 : 12;
  const meses = Array.from({ length: mesLimite }, (_, i) => i + 1);
  const [todasComprasValidas, osDoAno, overrideMap] = await Promise.all([
    buscarTodasComprasValidas(db5),
    buscarOsDoAno(db5, ano),
    buscarOverrideMap(db5)
  ]);
  const resultado = [];
  for (const mes of meses) {
    resultado.push(...classificarMes(mes, ano, osDoAno, todasComprasValidas, overrideMap, mesesInatividade));
  }
  return resultado;
}
function agregarMes(mes, ano, classificadas, percentualMargemFallback) {
  const doMes = classificadas.filter((c) => c.mes === mes && c.ano === ano);
  const categorias = ["novo", "recorrenteAtivo", "reativado", "naoClassificado"];
  const porCategoria = {};
  for (const cat of categorias) {
    const doGrupo = doMes.filter((c) => c.categoria === cat);
    const agregado = agregarLinhas(doGrupo, percentualMargemFallback);
    porCategoria[cat] = cat === "naoClassificado" ? { ...agregado, qtdClientesUnicos: doGrupo.length } : agregado;
  }
  return {
    mes,
    ano,
    porCategoria,
    faturamentoTotalValido: Math.round(doMes.reduce((s, c) => s + c.valorOs, 0) * 100) / 100
  };
}
function calcularReativacaoAnual(classificadas) {
  const porClienteMes = /* @__PURE__ */ new Set();
  const clientesUnicos = /* @__PURE__ */ new Set();
  for (const c of classificadas) {
    if (c.categoria !== "reativado" || !c.clienteKey) continue;
    porClienteMes.add(`${c.clienteKey}|${c.mes}`);
    clientesUnicos.add(c.clienteKey);
  }
  return { clientesReativadosUnicosAno: clientesUnicos.size, eventosReativacaoAno: porClienteMes.size };
}

// shared/resultado-geral.ts
function calcularPontoEquilibrio(custosFixos2, investimentoMarketing, margemContribuicaoPct, faturamentoLiquido, ticketMedio) {
  if (custosFixos2 == null || margemContribuicaoPct == null || margemContribuicaoPct <= 0) {
    return { pontoEquilibrio: null, margemSegurancaPct: null, distanciaAoEquilibrio: null, pedidosParaEquilibrio: null };
  }
  const custoTotal = custosFixos2 + (investimentoMarketing ?? 0);
  const pontoEquilibrio = round2(custoTotal / margemContribuicaoPct);
  const distanciaAoEquilibrio = faturamentoLiquido == null ? null : round2(faturamentoLiquido - pontoEquilibrio);
  const margemSegurancaPct = faturamentoLiquido == null || faturamentoLiquido === 0 ? null : pctSobre(distanciaAoEquilibrio, faturamentoLiquido);
  const pedidosParaEquilibrio = ticketMedio == null || ticketMedio <= 0 ? null : Math.ceil(pontoEquilibrio / ticketMedio);
  return { pontoEquilibrio, margemSegurancaPct, distanciaAoEquilibrio, pedidosParaEquilibrio };
}
function calcularDesvioMargem(margemMetaPct, margemRealPct, faturamentoLiquido) {
  if (margemRealPct == null) {
    return { margemMetaPct, margemRealPct: null, desvioPontosPct: null, impactoFinanceiro: null };
  }
  const desvioPontosPct = round2((margemRealPct - margemMetaPct) * 100);
  const impactoFinanceiro = faturamentoLiquido == null ? null : round2(faturamentoLiquido * (margemRealPct - margemMetaPct));
  return { margemMetaPct, margemRealPct, desvioPontosPct, impactoFinanceiro };
}
function montarPonteResultado(insumo) {
  const custosVariaveis = insumo.custosVariaveis;
  const margemContribuicao = insumo.faturamentoLiquido != null && custosVariaveis != null ? round2(insumo.faturamentoLiquido - custosVariaveis) : null;
  const margemContribuicaoPct = margemContribuicao == null ? null : safeDiv(margemContribuicao, insumo.faturamentoLiquido);
  const contribuicaoAposMarketing = margemContribuicao == null ? null : round2(margemContribuicao - (insumo.investimentoMarketing ?? 0));
  const resultadoOperacional = contribuicaoAposMarketing == null || insumo.custosFixos == null ? null : round2(contribuicaoAposMarketing - insumo.custosFixos);
  const resultadoNaoOperacional = (insumo.receitasNaoOperacionais ?? insumo.despesasNaoOperacionais) == null ? null : round2((insumo.receitasNaoOperacionais ?? 0) - (insumo.despesasNaoOperacionais ?? 0));
  const resultadoFinal = resultadoOperacional == null ? null : round2(resultadoOperacional - (insumo.despesasFinanceiras ?? 0) + (resultadoNaoOperacional ?? 0));
  return {
    faturamentoBruto: insumo.faturamentoBruto,
    cancelamentosInformativo: insumo.cancelamentosInformativo,
    faturamentoLiquido: insumo.faturamentoLiquido,
    custosVariaveis,
    margemContribuicao,
    margemContribuicaoPct,
    investimentoMarketing: insumo.investimentoMarketing,
    contribuicaoAposMarketing,
    custosFixos: insumo.custosFixos,
    resultadoOperacional,
    despesasFinanceiras: insumo.despesasFinanceiras,
    resultadoNaoOperacional,
    resultadoFinal
  };
}
function custoFixoMedioPorPedido(custosFixos2, qtdPedidos) {
  const r = safeDiv(custosFixos2, qtdPedidos);
  return r == null ? null : round2(r);
}
function resultadoMedioPorPedido(resultado, qtdPedidos) {
  const r = safeDiv(resultado, qtdPedidos);
  return r == null ? null : round2(r);
}
function calcularIndicadoresPorFuncionario(faturamentoLiquido, margemContribuicao, resultado, numColaboradores) {
  if (!numColaboradores || numColaboradores <= 0) {
    return { faturamentoPorFuncionario: null, margemPorFuncionario: null, resultadoPorFuncionario: null };
  }
  return {
    faturamentoPorFuncionario: faturamentoLiquido == null ? null : round2(faturamentoLiquido / numColaboradores),
    margemPorFuncionario: margemContribuicao == null ? null : round2(margemContribuicao / numColaboradores),
    resultadoPorFuncionario: resultado == null ? null : round2(resultado / numColaboradores)
  };
}
function ratearCustoFixo(custosFixosTotais, direcionador, dimensoes) {
  const resultado = {};
  if (direcionador === "rateio_erp") {
    for (const d of dimensoes) resultado[d.chave] = d.valorJaRateado != null ? round2(d.valorJaRateado) : null;
    return resultado;
  }
  const somaDirecionador = dimensoes.reduce((s, d) => s + d.valorDirecionador, 0);
  if (somaDirecionador <= 0) {
    for (const d of dimensoes) resultado[d.chave] = null;
    return resultado;
  }
  for (const d of dimensoes) {
    resultado[d.chave] = round2(custosFixosTotais * (d.valorDirecionador / somaDirecionador));
  }
  return resultado;
}

// server/routers/marketingFinanceiro.ts
var CONFIG_DEFAULTS = {
  mesesInatividadeReativacao: 6,
  percentualMargemFallback: 51,
  cacMaximo: null,
  custoReativacaoMaximo: null,
  roiMinimoPct: null,
  ticketMedioMinimo: null,
  metaClientesNovosMes: null,
  metaClientesReativadosMes: null,
  aumentoMaximoCacMensalPct: null,
  janelaAtribuicaoDias: 0,
  direcionadorRateio: "faturamento",
  custosFinanceirosIncluemMarketing: false
};
async function buscarConfig(db5) {
  if (!db5) return CONFIG_DEFAULTS;
  const rows = await db5.select().from(marketingConfig).limit(1);
  if (rows.length === 0) return CONFIG_DEFAULTS;
  const r = rows[0];
  return {
    mesesInatividadeReativacao: r.mesesInatividadeReativacao,
    percentualMargemFallback: Number(r.percentualMargemFallback),
    cacMaximo: r.cacMaximo != null ? Number(r.cacMaximo) : null,
    custoReativacaoMaximo: r.custoReativacaoMaximo != null ? Number(r.custoReativacaoMaximo) : null,
    roiMinimoPct: r.roiMinimoPct != null ? Number(r.roiMinimoPct) : null,
    ticketMedioMinimo: r.ticketMedioMinimo != null ? Number(r.ticketMedioMinimo) : null,
    metaClientesNovosMes: r.metaClientesNovosMes,
    metaClientesReativadosMes: r.metaClientesReativadosMes,
    aumentoMaximoCacMensalPct: r.aumentoMaximoCacMensalPct != null ? Number(r.aumentoMaximoCacMensalPct) : null,
    janelaAtribuicaoDias: r.janelaAtribuicaoDias,
    direcionadorRateio: r.direcionadorRateio,
    custosFinanceirosIncluemMarketing: r.custosFinanceirosIncluemMarketing
  };
}
var configInputSchema = z7.object({
  mesesInatividadeReativacao: z7.number().min(1).max(24),
  percentualMargemFallback: z7.number().min(0).max(100),
  cacMaximo: z7.number().min(0).nullable(),
  custoReativacaoMaximo: z7.number().min(0).nullable(),
  roiMinimoPct: z7.number().nullable(),
  ticketMedioMinimo: z7.number().min(0).nullable(),
  metaClientesNovosMes: z7.number().int().min(0).nullable(),
  metaClientesReativadosMes: z7.number().int().min(0).nullable(),
  aumentoMaximoCacMensalPct: z7.number().nullable(),
  janelaAtribuicaoDias: z7.number().int().min(0),
  direcionadorRateio: z7.enum(["pedidos", "faturamento", "custo_direto", "rateio_erp", "personalizado"]),
  custosFinanceirosIncluemMarketing: z7.boolean()
});
function configParaLinhaBanco(input) {
  return {
    mesesInatividadeReativacao: input.mesesInatividadeReativacao,
    percentualMargemFallback: String(input.percentualMargemFallback),
    cacMaximo: input.cacMaximo != null ? String(input.cacMaximo) : null,
    custoReativacaoMaximo: input.custoReativacaoMaximo != null ? String(input.custoReativacaoMaximo) : null,
    roiMinimoPct: input.roiMinimoPct != null ? String(input.roiMinimoPct) : null,
    ticketMedioMinimo: input.ticketMedioMinimo != null ? String(input.ticketMedioMinimo) : null,
    metaClientesNovosMes: input.metaClientesNovosMes,
    metaClientesReativadosMes: input.metaClientesReativadosMes,
    aumentoMaximoCacMensalPct: input.aumentoMaximoCacMensalPct != null ? String(input.aumentoMaximoCacMensalPct) : null,
    janelaAtribuicaoDias: input.janelaAtribuicaoDias,
    direcionadorRateio: input.direcionadorRateio,
    custosFinanceirosIncluemMarketing: input.custosFinanceirosIncluemMarketing
  };
}
var toNum2 = (v) => v == null ? null : Number(v);
function isCanceladaNormal(os) {
  if (os.tipoOs == null) return false;
  const tipo = (os.tipoOs ?? "").toLowerCase();
  if (tipo.startsWith("retrabalho") || tipo === "amostra" || tipo === "cortesia") return false;
  return (os.status ?? "").toLowerCase() === "cancelada";
}
var marketingFinanceiroRouter = router({
  // ─── Configuração (metas, semáforos, parâmetros) ───────────────────────────
  getConfig: publicProcedure.query(async () => {
    const db5 = await getDb3();
    return buscarConfig(db5);
  }),
  saveConfig: protectedProcedure.input(configInputSchema).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const usuario = { usuarioId: ctx.user?.id ?? null, usuarioNome: ctx.user?.name ?? null, usuarioRole: ctx.user?.role ?? null };
    const data = configParaLinhaBanco(input);
    const existing = await db5.select().from(marketingConfig).limit(1);
    if (existing.length > 0) {
      await db5.update(marketingConfig).set(data).where(eq10(marketingConfig.id, existing[0].id));
      insertAuditLogMarketingConfig({ acao: "EDICAO", ...usuario, valoresAnteriores: existing[0], valoresNovos: { ...existing[0], ...data } }).catch(() => {
      });
    } else {
      const [result] = await db5.insert(marketingConfig).values(data).returning({ id: marketingConfig.id });
      insertAuditLogMarketingConfig({ acao: "CRIACAO", ...usuario, valoresAnteriores: null, valoresNovos: { id: result.id, ...data } }).catch(() => {
      });
    }
    return buscarConfig(db5);
  }),
  getAuditoriaConfig: protectedProcedure.query(async () => {
    const { listAuditLogsMarketingConfig: listAuditLogsMarketingConfig2 } = await Promise.resolve().then(() => (init_db(), db_exports));
    return listAuditLogsMarketingConfig2();
  }),
  // ─── Relatório anual (Aba Marketing, Clientes e Receita) ───────────────────
  getRelatorioAno: publicProcedure.input(z7.object({
    ano: z7.number().min(2020),
    // Filtros gerenciais opcionais — o investimento em marketing (mensal,
    // não quebrado por vendedor/cidade) não muda com esses filtros, só o
    // faturamento/margem/clientes resultantes. Ver tooltip no client.
    vendedor: z7.string().nullable().optional(),
    cidade: z7.string().nullable().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    const config = await buscarConfig(db5);
    if (!db5) {
      return { meses: [], reativacaoAnual: { clientesReativadosUnicosAno: 0, eventosReativacaoAno: 0 }, config, origem: "indisponivel" };
    }
    const [classificadasBrutas, custoMarketingRows] = await Promise.all([
      classificarAno(db5, input.ano, config.mesesInatividadeReativacao),
      db5.select().from(custoMarketing).where(eq10(custoMarketing.ano, input.ano))
    ]);
    const custoMktMap = new Map(custoMarketingRows.map((r) => [r.mes, r]));
    const classificadas = classificadasBrutas.filter(
      (c) => (input.vendedor == null || c.vendedor === input.vendedor) && (input.cidade == null || c.cidade === input.cidade)
    );
    const now = /* @__PURE__ */ new Date();
    const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;
    const meses = [];
    for (let mes = 1; mes <= mesLimite; mes++) {
      const resumo = agregarMes(mes, input.ano, classificadas, config.percentualMargemFallback);
      const mk = custoMktMap.get(mes);
      const investimentoAquisicao = toNum2(mk?.investimentoAquisicao);
      const investimentoReativacao = toNum2(mk?.investimentoReativacao);
      const mesParcial = input.ano === now.getFullYear() && mes === now.getMonth() + 1;
      const resultadoNovo = calcularResultadoGrupo(investimentoAquisicao, resumo.porCategoria.novo.margem.margemTotal, resumo.porCategoria.novo.faturamento);
      const resultadoReativado = calcularResultadoGrupo(investimentoReativacao, resumo.porCategoria.reativado.margem.margemTotal, resumo.porCategoria.reativado.faturamento);
      const consolidado = calcularResultadoConsolidado([
        { investimento: investimentoAquisicao, margemContribuicao: resumo.porCategoria.novo.margem.margemTotal },
        { investimento: investimentoReativacao, margemContribuicao: resumo.porCategoria.reativado.margem.margemTotal }
      ]);
      meses.push({
        mes,
        ano: input.ano,
        mesParcial,
        investimentoAquisicao,
        investimentoReativacao,
        investimentoTotal: investimentoAquisicao == null && investimentoReativacao == null ? null : (investimentoAquisicao ?? 0) + (investimentoReativacao ?? 0),
        novo: { ...resumo.porCategoria.novo, ...resultadoNovo, cacPonderado: cacPonderado(investimentoAquisicao, resumo.porCategoria.novo.qtdClientesUnicos) },
        recorrenteAtivo: resumo.porCategoria.recorrenteAtivo,
        reativado: { ...resumo.porCategoria.reativado, ...resultadoReativado, custoReativacaoPonderado: custoReativacaoPonderado(investimentoReativacao, resumo.porCategoria.reativado.qtdClientesUnicos) },
        naoClassificado: resumo.porCategoria.naoClassificado,
        faturamentoTotalValido: resumo.faturamentoTotalValido,
        consolidado
      });
    }
    const reativacaoAnual = calcularReativacaoAnual(classificadas);
    return { meses, reativacaoAnual, config, origem: "local" };
  }),
  // ─── Opções de filtro (vendedor/cidade disponíveis no ano) ─────────────────
  getFiltrosDisponiveis: publicProcedure.input(z7.object({ ano: z7.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { vendedores: [], cidades: [] };
    const rows = await db5.select({ vendedor: historicoOs.vendedor, cidade: historicoOs.cidade }).from(historicoOs).where(eq10(historicoOs.ano, input.ano));
    const vendedores = /* @__PURE__ */ new Set();
    const cidades = /* @__PURE__ */ new Set();
    for (const r of rows) {
      if (r.vendedor) vendedores.add(r.vendedor);
      if (r.cidade) cidades.add(r.cidade);
    }
    return { vendedores: [...vendedores].sort(), cidades: [...cidades].sort() };
  }),
  // ─── Drill-down (detalhamento de pedidos) ──────────────────────────────────
  getDetalhamentoPedidos: publicProcedure.input(z7.object({
    ano: z7.number().min(2020),
    mes: z7.number().min(1).max(12).nullable().optional(),
    categoria: z7.enum(["novo", "recorrenteAtivo", "reativado", "naoClassificado"]).nullable().optional(),
    vendedor: z7.string().nullable().optional(),
    cidade: z7.string().nullable().optional(),
    estado: z7.string().nullable().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const config = await buscarConfig(db5);
    const classificadas = await classificarAno(db5, input.ano, config.mesesInatividadeReativacao);
    return classificadas.filter(
      (c) => (input.mes == null || c.mes === input.mes) && (input.categoria == null || c.categoria === input.categoria) && (input.vendedor == null || c.vendedor === input.vendedor) && (input.cidade == null || c.cidade === input.cidade) && (input.estado == null || c.estado === input.estado)
    );
  }),
  // ─── Mediana / outliers do período ─────────────────────────────────────────
  getMedianaOutliers: publicProcedure.input(z7.object({ ano: z7.number().min(2020), mes: z7.number().min(1).max(12).nullable().optional(), categoria: z7.enum(["novo", "reativado"]).nullable().optional() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const config = await buscarConfig(db5);
    const classificadas = await classificarAno(db5, input.ano, config.mesesInatividadeReativacao);
    const filtradas = classificadas.filter(
      (c) => (input.mes == null || c.mes === input.mes) && (input.categoria == null ? c.categoria === "novo" || c.categoria === "reativado" : c.categoria === input.categoria)
    );
    const valores = filtradas.map((c) => c.valorOs);
    return {
      qtdPedidos: valores.length,
      ticketMedio: valores.length ? Math.round(valores.reduce((s, v) => s + v, 0) / valores.length * 100) / 100 : null,
      ticketMediano: mediana2(valores),
      maiorPedido: valores.length ? Math.max(...valores) : null,
      participacaoTop5: participacaoTopN(valores, 5)
    };
  }),
  // ─── Resultado Geral e Ponto de Equilíbrio (Parte 2) ───────────────────────
  getResultadoGeralAno: publicProcedure.input(z7.object({ ano: z7.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    const config = await buscarConfig(db5);
    if (!db5) return { meses: [], config, origem: "indisponivel" };
    const [finRows, dreRows, mktRows, osAno] = await Promise.all([
      db5.select().from(financeiroMensal).where(eq10(financeiroMensal.ano, input.ano)),
      db5.select().from(dreMensal).where(eq10(dreMensal.ano, input.ano)),
      db5.select().from(custoMarketing).where(eq10(custoMarketing.ano, input.ano)),
      db5.select({
        mes: historicoOs.mes,
        ano: historicoOs.ano,
        tipoOs: historicoOs.tipoOs,
        status: historicoOs.status,
        valorOs: historicoOs.valorOs,
        valorTotal: historicoOs.valorTotal,
        empresa: historicoOs.empresa
      }).from(historicoOs).where(eq10(historicoOs.ano, input.ano))
    ]);
    const finMap = new Map(finRows.map((r) => [r.mes, r]));
    const dreMap = new Map(dreRows.map((r) => [r.mes, r]));
    const mktMap = new Map(mktRows.map((r) => [r.mes, r]));
    const porMes = /* @__PURE__ */ new Map();
    for (const os of osAno) {
      const acc = porMes.get(os.mes) ?? { qtdPedidos: 0, faturamento: 0, cancelamentos: 0, clientes: /* @__PURE__ */ new Set(), valores: [] };
      if (isOsNormalDb(os)) {
        const valor = parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
        acc.qtdPedidos++;
        acc.faturamento += valor;
        acc.valores.push(valor);
        const chave = normalizeEmpresaKey(os.empresa ?? "");
        if (chave) acc.clientes.add(chave);
      } else if (isCanceladaNormal(os)) {
        acc.cancelamentos += parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
      }
      porMes.set(os.mes, acc);
    }
    const now = /* @__PURE__ */ new Date();
    const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;
    const meses = [];
    for (let mes = 1; mes <= mesLimite; mes++) {
      const fin = finMap.get(mes);
      const dre = dreMap.get(mes);
      const mkt = mktMap.get(mes);
      const opsMes = porMes.get(mes) ?? { qtdPedidos: 0, faturamento: 0, cancelamentos: 0, clientes: /* @__PURE__ */ new Set(), valores: [] };
      const mesParcial = input.ano === now.getFullYear() && mes === now.getMonth() + 1;
      const faturamentoLiquido = toNum2(fin?.faturamentoOficial) ?? (dre?.receitaBrutaOperacional != null ? Number(dre.receitaBrutaOperacional) : null);
      const custosVariaveis = toNum2(fin?.despesasVariaveis) ?? (dre?.despesaVariavel != null ? Number(dre.despesaVariavel) : null);
      const custosFixos2 = toNum2(fin?.despesasFixas);
      const investimentoMarketingBruto = (toNum2(mkt?.investimentoAquisicao) ?? 0) + (toNum2(mkt?.investimentoReativacao) ?? 0);
      const investimentoMarketing = config.custosFinanceirosIncluemMarketing ? 0 : investimentoMarketingBruto;
      const ponte = montarPonteResultado({
        faturamentoBruto: faturamentoLiquido != null ? faturamentoLiquido + opsMes.cancelamentos : null,
        cancelamentosInformativo: opsMes.cancelamentos || null,
        faturamentoLiquido,
        custosVariaveis,
        investimentoMarketing,
        custosFixos: custosFixos2,
        // financeiro_mensal não tem despesasFinanceiras própria hoje — só dre_mensal
        // tem a coluna, e ela nunca é preenchida pelo backfill (não vem do ERP de
        // vendas, só de folha/banco) — ver Parte 2 "O que fica fora por falta de dado".
        despesasFinanceiras: dre?.despesasFinanceiras != null ? Number(dre.despesasFinanceiras) : null,
        despesasNaoOperacionais: null,
        receitasNaoOperacionais: null
      });
      const pontoEquilibrio = calcularPontoEquilibrio(
        custosFixos2,
        investimentoMarketing,
        ponte.margemContribuicaoPct,
        faturamentoLiquido,
        opsMes.qtdPedidos > 0 ? opsMes.faturamento / opsMes.qtdPedidos : null
      );
      const margemRealPct = ponte.margemContribuicaoPct;
      const desvioMargem = calcularDesvioMargem(config.percentualMargemFallback / 100, margemRealPct, faturamentoLiquido);
      const porFuncionario = calcularIndicadoresPorFuncionario(faturamentoLiquido, ponte.margemContribuicao, ponte.resultadoOperacional, fin?.numColaboradores);
      meses.push({
        mes,
        ano: input.ano,
        mesParcial,
        qtdPedidos: opsMes.qtdPedidos,
        qtdClientesUnicos: opsMes.clientes.size,
        ticketMedio: opsMes.qtdPedidos > 0 ? Math.round(opsMes.faturamento / opsMes.qtdPedidos * 100) / 100 : null,
        ticketMediano: mediana2(opsMes.valores),
        maiorPedido: opsMes.valores.length ? Math.max(...opsMes.valores) : null,
        participacaoTop5: participacaoTopN(opsMes.valores, 5),
        ponte,
        investimentoMarketingBruto,
        custosFinanceirosIncluemMarketing: config.custosFinanceirosIncluemMarketing,
        pontoEquilibrio,
        desvioMargem,
        porFuncionario,
        custoFixoMedioPorPedido: custoFixoMedioPorPedido(custosFixos2, opsMes.qtdPedidos),
        resultadoMedioPorPedido: resultadoMedioPorPedido(ponte.resultadoOperacional, opsMes.qtdPedidos),
        origemDados: {
          faturamentoLiquido: fin?.faturamentoOficial != null ? "real" : dre?.receitaBrutaOperacional != null ? "rateado" : "sem-dado",
          custosVariaveis: fin?.despesasVariaveis != null ? "real" : dre?.despesaVariavel != null ? "rateado" : "sem-dado",
          custosFixos: fin?.despesasFixas != null ? "real" : "sem-dado"
        }
      });
    }
    return { meses, config, origem: "local" };
  }),
  // ─── Resultado por vendedor (reaproveita calcularRadarMargens) ─────────────
  getResultadoPorVendedor: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const { vendedores } = await calcularRadarMargens(db5);
    return vendedores;
  }),
  // ─── Rateio de custo fixo por dimensão (gerencial) ─────────────────────────
  getRateioCustoFixoPorVendedor: publicProcedure.input(z7.object({ ano: z7.number().min(2020), mes: z7.number().min(1).max(12) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return {};
    const config = await buscarConfig(db5);
    const [finRow] = await db5.select().from(financeiroMensal).where(and8(eq10(financeiroMensal.ano, input.ano), eq10(financeiroMensal.mes, input.mes))).limit(1);
    const custosFixosTotais = toNum2(finRow?.despesasFixas);
    if (custosFixosTotais == null) return {};
    const osMes = await db5.select({
      vendedor: historicoOs.vendedor,
      tipoOs: historicoOs.tipoOs,
      status: historicoOs.status,
      valorOs: historicoOs.valorOs,
      valorTotal: historicoOs.valorTotal,
      custoFixo: historicoOs.custoFixo
    }).from(historicoOs).where(and8(eq10(historicoOs.ano, input.ano), eq10(historicoOs.mes, input.mes)));
    const porVendedor = /* @__PURE__ */ new Map();
    for (const os of osMes) {
      if (!isOsNormalDb(os)) continue;
      const vendedor = os.vendedor || "Sem vendedor";
      const acc = porVendedor.get(vendedor) ?? { qtdPedidos: 0, faturamento: 0, custoDireto: 0, rateadoErp: 0 };
      acc.qtdPedidos++;
      acc.faturamento += parseFloat(String(os.valorOs ?? os.valorTotal ?? "0")) || 0;
      acc.rateadoErp += parseFloat(String(os.custoFixo ?? "0")) || 0;
      porVendedor.set(vendedor, acc);
    }
    const dimensoes = [...porVendedor.entries()].map(([chave, v]) => ({
      chave,
      valorDirecionador: config.direcionadorRateio === "pedidos" ? v.qtdPedidos : config.direcionadorRateio === "custo_direto" ? v.custoDireto : v.faturamento,
      valorJaRateado: v.rateadoErp
    }));
    return ratearCustoFixo(custosFixosTotais, config.direcionadorRateio, dimensoes);
  }),
  // ─── Conciliação (novo + recorrente ativo + reativado + não-classificado = faturamento oficial) ──
  getConciliacaoAno: publicProcedure.input(z7.object({ ano: z7.number().min(2020) })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const config = await buscarConfig(db5);
    const [classificadas, finRows] = await Promise.all([
      classificarAno(db5, input.ano, config.mesesInatividadeReativacao),
      db5.select().from(financeiroMensal).where(eq10(financeiroMensal.ano, input.ano))
    ]);
    const finMap = new Map(finRows.map((r) => [r.mes, r]));
    const now = /* @__PURE__ */ new Date();
    const mesLimite = input.ano === now.getFullYear() ? now.getMonth() + 1 : 12;
    const resultado = [];
    for (let mes = 1; mes <= mesLimite; mes++) {
      const resumo = agregarMes(mes, input.ano, classificadas, config.percentualMargemFallback);
      const faturamentoOficial = toNum2(finMap.get(mes)?.faturamentoOficial);
      if (faturamentoOficial == null) {
        resultado.push({ mes, ano: input.ano, disponivel: false });
        continue;
      }
      const valoresPorCategoria = [
        resumo.porCategoria.novo.faturamento,
        resumo.porCategoria.recorrenteAtivo.faturamento,
        resumo.porCategoria.reativado.faturamento,
        resumo.porCategoria.naoClassificado.faturamento
      ];
      resultado.push({ mes, ano: input.ano, disponivel: true, ...conciliar(faturamentoOficial, valoresPorCategoria) });
    }
    return resultado;
  })
});

// server/routers/observacoesFinanceiras.ts
init_trpc();
init_db();
init_schema();
init_llm();
import { z as z8 } from "zod";
import { eq as eq11, and as and9, gte as gte4, lt as lt2 } from "drizzle-orm";
function mesRange(mes, ano) {
  const inicio = new Date(ano, mes - 1, 1);
  const fim = new Date(ano, mes, 1);
  return { inicio, fim };
}
function fmtR2(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
var observacoesFinanceirasRouter = router({
  // Carregar observações de um mês
  get: protectedProcedure.input(z8.object({ mes: z8.number(), ano: z8.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const rows = await db5.select().from(observacoesFinanceirasMensais).where(and9(
      eq11(observacoesFinanceirasMensais.mes, input.mes),
      eq11(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    return rows[0] ?? null;
  }),
  // Salvar observações manuais
  salvar: protectedProcedure.input(z8.object({
    mes: z8.number(),
    ano: z8.number(),
    observacoesManuais: z8.string().optional(),
    contextosEspecificos: z8.string().optional()
    // JSON string
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const existing = await db5.select().from(observacoesFinanceirasMensais).where(and9(
      eq11(observacoesFinanceirasMensais.mes, input.mes),
      eq11(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    if (existing.length > 0) {
      await db5.update(observacoesFinanceirasMensais).set({
        observacoesManuais: input.observacoesManuais ?? null,
        contextosEspecificos: input.contextosEspecificos ?? null
      }).where(eq11(observacoesFinanceirasMensais.id, existing[0].id));
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
  getDadosComplementares: protectedProcedure.input(z8.object({ mes: z8.number(), ano: z8.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return null;
    const { inicio, fim } = mesRange(input.mes, input.ano);
    const cfAtivos = await db5.select().from(custosFixos).where(eq11(custosFixos.ativo, true));
    const totalCustosFixosPrevistos = cfAtivos.reduce((sum, cf) => sum + Number(cf.valor || 0), 0);
    const custosFixosPorCategoria = cfAtivos.reduce((acc, cf) => {
      const cat = cf.grupoCategoria || "Outros";
      if (!acc[cat]) acc[cat] = 0;
      acc[cat] += Number(cf.valor || 0);
      return acc;
    }, {});
    const dreRows = await db5.select().from(dreMensal).where(and9(eq11(dreMensal.ano, input.ano), eq11(dreMensal.mes, input.mes))).limit(1);
    const dre = dreRows[0] ?? null;
    const custosFixosReais = dre ? Number(dre.despesasFixas || 0) : 0;
    const finRows = await db5.select().from(financeiroMensal).where(and9(eq11(financeiroMensal.mes, input.mes), eq11(financeiroMensal.ano, input.ano))).limit(1);
    const fin = finRows[0] ?? null;
    const cteRows = await db5.select().from(cteImportacoes).where(and9(
      gte4(cteImportacoes.dataEmissao, inicio),
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
    const pedidosFinalizados = await db5.select().from(empacotamentoPedidos).where(and9(
      gte4(empacotamentoPedidos.finalizadoEm, inicio),
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
  gerarAnalise: protectedProcedure.input(z8.object({ mes: z8.number(), ano: z8.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB n\xE3o dispon\xEDvel");
    const MESES_NOMES3 = ["", "Janeiro", "Fevereiro", "Mar\xE7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const obsRows = await db5.select().from(observacoesFinanceirasMensais).where(and9(
      eq11(observacoesFinanceirasMensais.mes, input.mes),
      eq11(observacoesFinanceirasMensais.ano, input.ano)
    )).limit(1);
    const obs = obsRows[0];
    const observacoesManuais = obs?.observacoesManuais || "";
    const contextosEspecificos = obs?.contextosEspecificos || "[]";
    const { inicio, fim } = mesRange(input.mes, input.ano);
    const dreRows = await db5.select().from(dreMensal).where(and9(eq11(dreMensal.ano, input.ano), eq11(dreMensal.mes, input.mes))).limit(1);
    const dre = dreRows[0];
    const finRows = await db5.select().from(financeiroMensal).where(and9(eq11(financeiroMensal.mes, input.mes), eq11(financeiroMensal.ano, input.ano))).limit(1);
    const fin = finRows[0];
    const cfAtivos = await db5.select().from(custosFixos).where(eq11(custosFixos.ativo, true));
    const totalCFPrevistos = cfAtivos.reduce((s, c) => s + Number(c.valor || 0), 0);
    const cteRows = await db5.select().from(cteImportacoes).where(and9(gte4(cteImportacoes.dataEmissao, inicio), lt2(cteImportacoes.dataEmissao, fim)));
    const totalTransp = cteRows.reduce((s, c) => s + Number(c.valor || 0), 0);
    const pedidos = await db5.select().from(empacotamentoPedidos).where(and9(gte4(empacotamentoPedidos.finalizadoEm, inicio), lt2(empacotamentoPedidos.finalizadoEm, fim)));
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

Analise detalhadamente o m\xEAs de ${MESES_NOMES3[input.mes]}/${input.ano} com base nos dados abaixo e nas observa\xE7\xF5es do gestor.

## DADOS FINANCEIROS DO M\xCAS

### DRE (Demonstrativo de Resultado)
${dre ? `- Receita Operacional Bruta: ${fmtR2(Number(dre.receitaOperacionalBruta || 0))}
- Total de Entradas: ${fmtR2(Number(dre.totalEntradas || 0))}
- Impostos sobre Vendas: ${fmtR2(Number(dre.impostosVendas || 0))}
- Mat\xE9ria-Prima: ${fmtR2(Number(dre.materiaPrima || 0))}
- Despesas com Pessoal: ${fmtR2(Number(dre.despesasPessoal || 0))}
- Despesas Fixas: ${fmtR2(Number(dre.despesasFixas || 0))}
- Despesas Financeiras: ${fmtR2(Number(dre.despesasFinanceiras || 0))}
- Total de Sa\xEDdas: ${fmtR2(Number(dre.totalSaidas || 0))}
- Lucro Bruto: ${fmtR2(Number(dre.lucroBruto || 0))}
- Lucro Operacional: ${fmtR2(Number(dre.lucroOperacional || 0))}
- Lucro L\xEDquido: ${fmtR2(Number(dre.lucroLiquido || 0))}` : "Dados da DRE n\xE3o dispon\xEDveis para este m\xEAs."}

### Financeiro Mensal
${fin ? `- Faturamento Oficial: ${fmtR2(Number(fin.faturamentoOficial || 0))}
- Despesas Fixas (lan\xE7adas): ${fmtR2(Number(fin.despesasFixas || 0))}
- Despesas Vari\xE1veis: ${fmtR2(Number(fin.despesasVariaveis || 0))}
- Lucro L\xEDquido: ${fmtR2(Number(fin.lucroLiquido || 0))}
- Resultado Efetivo: ${fmtR2(Number(fin.resultadoEfetivo || 0))}
- Saldo do M\xEAs (caixa): ${fmtR2(Number(fin.saldoMes || 0))}
- DAS (Simples Nacional): ${fmtR2(Number(fin.impostoDas || 0))}
- ICMS DIFAL: ${fmtR2(Number(fin.impostoIcmsDifal || 0))}
- Frete de Retrabalho: ${fmtR2(Number(fin.freteRetrabalho || 0))}` : "Dados financeiros n\xE3o dispon\xEDveis para este m\xEAs."}

### Custos Fixos: Previsto vs Real
- Total Previsto (cadastro ativo): ${fmtR2(totalCFPrevistos)}
- Total Real (DRE): ${fmtR2(Number(dre?.despesasFixas || 0))}
- Varia\xE7\xE3o: ${fmtR2(Number(dre?.despesasFixas || 0) - totalCFPrevistos)} (${Number(dre?.despesasFixas || 0) > totalCFPrevistos ? "ACIMA do previsto" : "abaixo do previsto"})

### Gastos com Transportadoras
- Total gasto: ${fmtR2(totalTransp)}
- Quantidade de CTe emitidos: ${cteRows.length}
${cteRows.length > 0 ? `- Observa\xE7\xE3o: Os fretes s\xE3o CIF (pagos pela empresa), mas o valor do frete \xE9 cobrado do cliente \xE0 vista. Quando o faturamento do m\xEAs anterior \xE9 alto, os fretes do m\xEAs seguinte tamb\xE9m ser\xE3o maiores.` : ""}

### Custo de Embalagem (Mat\xE9rias-Primas)
- Total estimado: ${fmtR2(custoEmb)}
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
      await db5.update(observacoesFinanceirasMensais).set({ analiseIa: analise }).where(eq11(observacoesFinanceirasMensais.id, obs.id));
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
init_trpc();
init_db();
init_schema();
import { z as z9 } from "zod";
import { eq as eq12, desc as desc7, sql as sql6 } from "drizzle-orm";
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
  const XLSX2 = await import("xlsx");
  const workbook = XLSX2.read(buffer, { type: "buffer" });
  const partes = workbook.SheetNames.map((nomeAba) => {
    const sheet = workbook.Sheets[nomeAba];
    return `# ${nomeAba}
${XLSX2.utils.sheet_to_csv(sheet)}`;
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
  list: publicProcedure.input(z9.object({
    categoria: z9.string().optional(),
    busca: z9.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(bibliotecaArquivos).orderBy(desc7(bibliotecaArquivos.createdAt));
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
  upload: protectedProcedure.input(z9.object({
    nome: z9.string().min(1),
    descricao: z9.string().optional(),
    categoria: z9.string().min(1),
    subcategoria: z9.string().optional(),
    tags: z9.string().optional(),
    fileName: z9.string().min(1),
    url: z9.string().url(),
    key: z9.string().min(1),
    mimeType: z9.string().min(1),
    fileSize: z9.number().int().nonnegative(),
    uploadedBy: z9.string().optional()
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
  reextrairTexto: protectedProcedure.input(z9.object({ id: z9.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    const [arquivo] = await db5.select().from(bibliotecaArquivos).where(eq12(bibliotecaArquivos.id, input.id));
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
    await db5.update(bibliotecaArquivos).set({ conteudoExtraido }).where(eq12(bibliotecaArquivos.id, input.id));
    return { success: true, conteudoExtraido: !!conteudoExtraido };
  }),
  update: protectedProcedure.input(z9.object({
    id: z9.number().int(),
    nome: z9.string().min(1).optional(),
    descricao: z9.string().optional(),
    categoria: z9.string().optional(),
    subcategoria: z9.string().optional(),
    tags: z9.string().optional()
  })).mutation(async ({ input }) => {
    const { id, ...data } = input;
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.update(bibliotecaArquivos).set(data).where(eq12(bibliotecaArquivos.id, id));
    return { success: true };
  }),
  delete: protectedProcedure.input(z9.object({ id: z9.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(bibliotecaArquivos).where(eq12(bibliotecaArquivos.id, input.id));
    return { success: true };
  }),
  incrementView: publicProcedure.input(z9.object({ id: z9.number().int() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { success: false };
    await db5.update(bibliotecaArquivos).set({ visualizacoes: sql6`${bibliotecaArquivos.visualizacoes} + 1` }).where(eq12(bibliotecaArquivos.id, input.id));
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
init_trpc();
init_db_connection();
init_schema();
import { z as z10 } from "zod";
import { drizzle as drizzle5 } from "drizzle-orm/neon-serverless";
import { eq as eq13, and as and10, asc as asc2, sql as sql7 } from "drizzle-orm";
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
  getByMesAno: publicProcedure.input(z10.object({ mes: z10.number().min(1).max(12), ano: z10.number().min(2020) })).query(async ({ input }) => {
    const rows = await db3.select().from(performanceMensal).where(
      and10(
        eq13(performanceMensal.mes, input.mes),
        eq13(performanceMensal.ano, input.ano)
      )
    );
    const row = rows[0] ?? null;
    const retrabCountRows = await getDb4().select({ total: sql7`COUNT(*)` }).from(retrabalhos).where(
      sql7`EXTRACT(MONTH FROM ${retrabalhos.data}) = ${input.mes} AND EXTRACT(YEAR FROM ${retrabalhos.data}) = ${input.ano}`
    );
    const retrabCount = [{ total: Number(retrabCountRows[0]?.total ?? 0) }];
    const fatRows = await db3.select().from(faturamento).where(eq13(faturamento.ano, input.ano));
    const MESES_NOMES3 = [
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
    const nomeMes = MESES_NOMES3[input.mes - 1];
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
    z10.object({
      mes: z10.number().min(1).max(12),
      ano: z10.number().min(2020),
      osGeradas: z10.number().nullish(),
      osExpedicao: z10.number().nullish(),
      percExpedicao: z10.number().nullish(),
      metaOsDia: z10.number().nullish(),
      capacidadeOsDiaMin: z10.number().nullish(),
      capacidadeOsDiaMax: z10.number().nullish(),
      deficitFinalizacao: z10.number().nullish(),
      metaEmbalagemDia: z10.number().nullish(),
      producaoEmbalagemDia: z10.number().nullish(),
      metaAcabamentoDia: z10.number().nullish(),
      capacidadeAcabamentoDia: z10.number().nullish(),
      capacidadeNominalSolda: z10.number().nullish(),
      producaoInternaSolda: z10.number().nullish(),
      demandaTotalSolda: z10.number().nullish(),
      osTerceirizadas: z10.number().nullish(),
      metrosTerceirizados: z10.number().nullish(),
      metaOsGeradas: z10.number().nullish(),
      metaOsExpedicao: z10.number().nullish(),
      metaProducaoSolda: z10.number().nullish(),
      metaPercTerceirizacao: z10.number().nullish(),
      observacoes: z10.string().nullish(),
      destaques: z10.string().nullish(),
      gargalos: z10.string().nullish(),
      // Custo de solda
      numSoldadores: z10.number().nullish(),
      soldadorSalarioBase: z10.number().nullish(),
      soldadorHorasExtras: z10.number().nullish(),
      soldadorValorHoraExtra: z10.number().nullish(),
      soldadorOutrosCustos: z10.number().nullish(),
      custoProdutividadeSolda: z10.number().nullish(),
      gestorSalarioBase: z10.number().nullish(),
      gestorHorasExtras: z10.number().nullish(),
      gestorValorHoraExtra: z10.number().nullish(),
      gestorOutrosCustos: z10.number().nullish(),
      custoMetroTerceirizado: z10.number().nullish(),
      precoVendaMetro: z10.number().nullish(),
      // ─── Novos campos de performance ─────────────────────────────────────
      faturamentoRealizado: z10.number().nullish(),
      metaFaturamento: z10.number().nullish(),
      projetosEntregues: z10.number().nullish(),
      projetosNoPrazo: z10.number().nullish(),
      projetosForaPrazo: z10.number().nullish(),
      metaEntregaNoPrazoPct: z10.number().nullish(),
      metaRetrabalhoPct: z10.number().nullish(),
      totalPedidos: z10.number().nullish()
    })
  ).mutation(async ({ input }) => {
    const { mes, ano, ...fields } = input;
    const existing = await db3.select().from(performanceMensal).where(
      and10(
        eq13(performanceMensal.mes, mes),
        eq13(performanceMensal.ano, ano)
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
      await db3.update(performanceMensal).set(data).where(eq13(performanceMensal.id, existing[0].id));
      return { action: "updated", id: existing[0].id };
    } else {
      const [result] = await db3.insert(performanceMensal).values({ mes, ano, ...data }).returning({ id: performanceMensal.id });
      return { action: "created", id: result.id };
    }
  }),
  // Excluir um registro
  delete: publicProcedure.input(z10.object({ id: z10.number() })).mutation(async ({ input }) => {
    await db3.delete(performanceMensal).where(eq13(performanceMensal.id, input.id));
    return { success: true };
  })
});

// server/routers/performanceAbc.ts
init_trpc();
init_db();
init_schema();
init_env();
init_mubisys_client();
import { z as z11 } from "zod";
import { and as and11, eq as eq14 } from "drizzle-orm";
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
    const client2 = os.cliente ?? "Desconhecido";
    const valor = parseFloat(String(os.valor_total ?? 0));
    if (!clientMap[client2]) clientMap[client2] = { total: 0, count: 0 };
    clientMap[client2].total += valor;
    clientMap[client2].count++;
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
  getClienteTags: protectedProcedure.input(z11.object({ mes: z11.number().min(1).max(12), ano: z11.number().min(2020).max(2030) })).query(async ({ input }) => {
    const { mes, ano } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { retrabalhos: {}, atrasos: {} };
    const { cotacoesFrete: cotacoesFrete2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
    const { sql: sqlFn, gte: gte7, lte: lte5 } = await import("drizzle-orm");
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
    z11.object({
      mes: z11.number().min(1).max(12),
      ano: z11.number().min(2020).max(2030),
      tipo: z11.enum(["clientes", "produtos"]),
      forceRefresh: z11.boolean().optional().default(false)
    })
  ).query(async ({ input }) => {
    const { mes, ano, tipo, forceRefresh } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { items: [], totalOs: 0, faturamento: 0, fromCache: false, updatedAt: /* @__PURE__ */ new Date() };
    if (!forceRefresh) {
      const cached = await dbClient.select().from(abcCache).where(
        and11(
          eq14(abcCache.mes, mes),
          eq14(abcCache.ano, ano),
          eq14(abcCache.tipo, tipo)
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
      and11(
        eq14(abcCache.mes, mes),
        eq14(abcCache.ano, ano),
        eq14(abcCache.tipo, tipo)
      )
    ).limit(1);
    if (existing.length > 0) {
      await dbClient.update(abcCache).set({
        dados: JSON.stringify(result.items),
        totalOs: result.totalOs,
        faturamentoTotal: String(result.faturamento.toFixed(2))
      }).where(eq14(abcCache.id, existing[0].id));
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
  getEvolucaoProdutos: protectedProcedure.input(z11.object({
    meses: z11.array(z11.object({ mes: z11.number().min(1).max(12), ano: z11.number().min(2020).max(2030) })),
    topN: z11.number().min(3).max(15).optional().default(8)
  })).query(async ({ input }) => {
    const { meses, topN } = input;
    const dbClient = await getDb3();
    if (!dbClient) return { chartData: [], tabela: [], topProdutos: [], mesesLabels: [] };
    const caches = await Promise.all(
      meses.map(async ({ mes, ano }) => {
        const rows = await dbClient.select().from(abcCache).where(and11(eq14(abcCache.mes, mes), eq14(abcCache.ano, ano), eq14(abcCache.tipo, "produtos"))).limit(1);
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
    const MESES_NOMES3 = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const mesesLabels = meses.map(({ mes, ano }) => `${MESES_NOMES3[mes - 1]} ${ano}`);
    const chartData = caches.map(({ mes, ano, items }) => {
      const label = `${MESES_NOMES3[mes - 1]} ${ano}`;
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
        const label = `${MESES_NOMES3[c.mes - 1]} ${c.ano}`;
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
  getProdutosERP: protectedProcedure.input(z11.object({ busca: z11.string().optional().default("") })).query(async ({ input }) => {
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
init_trpc();
init_db();
import { z as z12 } from "zod";
var auditoriaRouter = router({
  /**
   * Lista logs de auditoria com filtros opcionais e paginação.
   * Disponível apenas para usuários autenticados.
   */
  list: protectedProcedure.input(
    z12.object({
      acao: z12.enum(["CRIACAO", "EDICAO", "EXCLUSAO"]).optional(),
      usuarioId: z12.string().optional(),
      retrabalhoId: z12.number().int().positive().optional(),
      osRetrabalhada: z12.string().max(32).optional(),
      dataInicio: z12.string().optional(),
      // ISO date string "YYYY-MM-DD"
      dataFim: z12.string().optional(),
      // ISO date string "YYYY-MM-DD"
      page: z12.number().int().min(1).default(1),
      pageSize: z12.number().int().min(1).max(100).default(50)
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
init_trpc();
init_db();
import { z as z13 } from "zod";
var cargoSchema = z13.object({
  titulo: z13.string().min(1).max(128),
  missao: z13.string().optional().nullable(),
  responsabilidades: z13.string().optional().nullable(),
  kpis: z13.string().optional().nullable(),
  ferramentas: z13.string().optional().nullable(),
  integracao: z13.string().optional().nullable(),
  riscos: z13.string().optional().nullable(),
  requisitos: z13.string().optional().nullable(),
  condicoes: z13.string().optional().nullable()
});
var cargosRouter = router({
  list: protectedProcedure.query(async () => {
    return listCargos();
  }),
  getById: protectedProcedure.input(z13.object({ id: z13.number() })).query(async ({ input }) => {
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
  update: protectedProcedure.input(z13.object({ id: z13.number() }).merge(cargoSchema.partial())).mutation(async ({ input, ctx }) => {
    const { id, ...data } = input;
    await updateCargo(id, {
      ...data,
      updatedBy: ctx.user.name ?? ctx.user.email ?? "sistema"
    });
    return { ok: true };
  }),
  delete: protectedProcedure.input(z13.object({ id: z13.number() })).mutation(async ({ input }) => {
    await deleteCargo(input.id);
    return { ok: true };
  }),
  /**
   * O arquivo agora sobe direto do browser para o UploadThing (ver
   * client/src/lib/upload.ts); esta procedure só recebe o resultado.
   * Mantida para não quebrar o contrato do client e para o caso de passar a
   * registrar o upload no banco.
   */
  uploadImage: protectedProcedure.input(z13.object({
    url: z13.string().url(),
    key: z13.string().min(1),
    fileName: z13.string(),
    mimeType: z13.string()
  })).mutation(async ({ input }) => {
    return { url: input.url, key: input.key, success: true };
  })
});

// server/routers/curriculos.ts
init_trpc();
init_llm();
init_db();
import { z as z14 } from "zod";
var curriculosRouter = router({
  // Upload currículo e iniciar análise
  uploadAndAnalyze: protectedProcedure.input(z14.object({
    cargoId: z14.number(),
    fileName: z14.string(),
    url: z14.string().url(),
    key: z14.string().min(1),
    fileType: z14.string()
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
  listByCargo: protectedProcedure.input(z14.object({ cargoId: z14.number() })).query(async ({ input }) => {
    return getAnaliseCurriculosByCargo(input.cargoId);
  }),
  // Deletar análise
  delete: protectedProcedure.input(z14.object({ id: z14.number() })).mutation(async ({ input }) => {
    return { ok: true };
  })
});

// server/routers/desempenhoColabMensal.ts
init_trpc();
init_db();
init_schema();
import { z as z15 } from "zod";
import { and as and12, eq as eq15, asc as asc3 } from "drizzle-orm";
var desempenhoColabMensalRouter = router({
  // Listar todos os registros de um ano (opcionalmente filtrar por categoria)
  list: publicProcedure.input(z15.object({
    ano: z15.number(),
    categoria: z15.string().optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [eq15(desempenhoColaboradorMensal.ano, input.ano)];
    if (input.categoria) {
      conditions.push(eq15(desempenhoColaboradorMensal.categoria, input.categoria));
    }
    return db5.select().from(desempenhoColaboradorMensal).where(and12(...conditions)).orderBy(asc3(desempenhoColaboradorMensal.nome), asc3(desempenhoColaboradorMensal.mes));
  }),
  // Listar colaboradores distintos cadastrados (nome + categoria)
  listColaboradores: publicProcedure.input(z15.object({ ano: z15.number().optional() })).query(async ({ input }) => {
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
  upsert: publicProcedure.input(z15.object({
    nome: z15.string().min(1),
    categoria: z15.enum(["soldador", "vendedor", "operador_maquinas"]),
    mes: z15.number().min(1).max(12),
    ano: z15.number(),
    numFaltas: z15.number().nullable().optional(),
    // Soldador
    metrosSoldados: z15.number().nullable().optional(),
    numRetrabalhos: z15.number().nullable().optional(),
    // Vendedor
    numPropostas: z15.number().nullable().optional(),
    numVendas: z15.number().nullable().optional(),
    faturamentoVendedor: z15.number().nullable().optional(),
    ticketMedioVendedor: z15.number().nullable().optional(),
    // Operador de Máquinas
    numTrabalhos: z15.number().nullable().optional(),
    notas: z15.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    let ticketMedio = input.ticketMedioVendedor ?? null;
    if (input.categoria === "vendedor" && input.faturamentoVendedor && input.numVendas && input.numVendas > 0) {
      if (ticketMedio == null) ticketMedio = input.faturamentoVendedor / input.numVendas;
    }
    const existing = await db5.select({ id: desempenhoColaboradorMensal.id }).from(desempenhoColaboradorMensal).where(and12(
      eq15(desempenhoColaboradorMensal.nome, input.nome),
      eq15(desempenhoColaboradorMensal.categoria, input.categoria),
      eq15(desempenhoColaboradorMensal.mes, input.mes),
      eq15(desempenhoColaboradorMensal.ano, input.ano)
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
      await db5.update(desempenhoColaboradorMensal).set(payload).where(eq15(desempenhoColaboradorMensal.id, existing[0].id));
      return { id: existing[0].id, action: "updated" };
    } else {
      const [result] = await db5.insert(desempenhoColaboradorMensal).values(payload).returning({ id: desempenhoColaboradorMensal.id });
      return { id: result.id, action: "created" };
    }
  }),
  // Deletar colaborador (todos os registros de um nome+categoria)
  deleteColaborador: publicProcedure.input(z15.object({ nome: z15.string(), categoria: z15.string() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(desempenhoColaboradorMensal).where(and12(
      eq15(desempenhoColaboradorMensal.nome, input.nome),
      eq15(desempenhoColaboradorMensal.categoria, input.categoria)
    ));
    return { ok: true };
  })
});

// server/routers/empacotamento.ts
init_trpc();
init_schema();
init_mubisys_client();
init_db_connection();
init_schema();
import { z as z16 } from "zod";
import { drizzle as drizzle6 } from "drizzle-orm/neon-serverless";
import { eq as eq16, and as and13, desc as desc8, asc as asc4, gte as gte5, lte as lte3, sql as sql8 } from "drizzle-orm";
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
    const modelos = await getDb5().select().from(empacotamentoModelos).where(eq16(empacotamentoModelos.id, pedido.modeloId)).limit(1);
    const modelo = modelos[0];
    const tempoPorM2 = parseFloat(String(modelo?.tempoPorM2Min ?? "0"));
    const area = parseFloat(String(pedido.metrosQuadrados ?? "0"));
    if (tempoPorM2 > 0 && area > 0) return tempoPorM2 * area;
  } else if (pedido.modeloCaixaId) {
    const mcs = await getDb5().select().from(empacotamentoModelosCaixa).where(eq16(empacotamentoModelosCaixa.id, pedido.modeloCaixaId)).limit(1);
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
  const sessoes = await getDb5().select().from(empacotamentoSessoes).where(and13(
    eq16(empacotamentoSessoes.status, "finalizado"),
    sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
    sql8`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
    sql8`${empacotamentoSessoes.registradoEm} <= ${fimTs}`
  ));
  const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1));
  const cfg = config[0] ?? { valorPorMinuto: "0.15" };
  const valorMin = parseFloat(String(cfg.valorPorMinuto));
  const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
  let pedidos = [];
  if (pedidoIds.length > 0) {
    pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql8`${empacotamentoPedidos.id} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
      return await db4.select().from(empacotamentoModelos).where(eq16(empacotamentoModelos.ativo, 1)).orderBy(asc4(empacotamentoModelos.nome));
    }),
    create: publicProcedure.input(z16.object({
      nome: z16.string().min(1).max(128),
      descricao: z16.string().optional(),
      tempoPorM2Min: z16.number().min(0).optional(),
      valorProdutividadePorMinLetreiro: z16.number().min(0).optional()
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
    update: publicProcedure.input(z16.object({
      id: z16.number(),
      nome: z16.string().min(1).max(128),
      descricao: z16.string().optional(),
      ativo: z16.number().optional(),
      modeloCaixaIdPadrao: z16.number().nullable().optional(),
      tempoPorM2Min: z16.number().min(0).nullable().optional(),
      valorProdutividadePorMinLetreiro: z16.number().min(0).nullable().optional()
    })).mutation(async ({ input }) => {
      const upd = { nome: input.nome, descricao: input.descricao ?? null, ativo: input.ativo ?? 1 };
      if (input.modeloCaixaIdPadrao !== void 0) upd.modeloCaixaIdPadrao = input.modeloCaixaIdPadrao;
      if (input.tempoPorM2Min !== void 0) upd.tempoPorM2Min = input.tempoPorM2Min != null ? String(input.tempoPorM2Min) : null;
      if (input.valorProdutividadePorMinLetreiro !== void 0) upd.valorProdutividadePorMinLetreiro = input.valorProdutividadePorMinLetreiro != null ? String(input.valorProdutividadePorMinLetreiro) : null;
      await db4.update(empacotamentoModelos).set(upd).where(eq16(empacotamentoModelos.id, input.id));
      return { success: true };
    }),
    // Atualiza tempo e produtividade de TODOS os letreiros de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure.input(z16.object({
      tempoPorM2Min: z16.number().min(0).nullable(),
      valorProdutividadePorMinLetreiro: z16.number().min(0).nullable()
    })).mutation(async ({ input }) => {
      const upd = {};
      if (input.tempoPorM2Min !== null) upd.tempoPorM2Min = String(input.tempoPorM2Min);
      if (input.valorProdutividadePorMinLetreiro !== null) upd.valorProdutividadePorMinLetreiro = String(input.valorProdutividadePorMinLetreiro);
      if (Object.keys(upd).length > 0) {
        await db4.update(empacotamentoModelos).set(upd);
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoModelos).where(eq16(empacotamentoModelos.id, input.id));
      return { success: true };
    })
  }),
  // ─── MODELOS DE CAIXA ───────────────────────────────────────────────────────
  modelosCaixa: router({
    list: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelosCaixa).orderBy(asc4(empacotamentoModelosCaixa.nome));
    }),
    listAtivos: publicProcedure.query(async () => {
      return await db4.select().from(empacotamentoModelosCaixa).where(eq16(empacotamentoModelosCaixa.ativo, 1)).orderBy(asc4(empacotamentoModelosCaixa.nome));
    }),
    create: publicProcedure.input(z16.object({
      nome: z16.string().min(1).max(128),
      descricao: z16.string().optional(),
      larguraCm: z16.number().optional(),
      alturaCm: z16.number().optional(),
      profundidadeCm: z16.number().optional(),
      tipoCaixa: z16.enum(["padronizada", "personalizada"]).default("padronizada"),
      custoAquisicao: z16.number().min(0).default(0),
      tempoPorM2Min: z16.number().min(0).optional(),
      tempoPorM3Min: z16.number().min(0).optional(),
      tempoPorMetroArestaMin: z16.number().min(0).optional(),
      valorProdutividadePorCm2: z16.number().min(0).optional()
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
    update: publicProcedure.input(z16.object({
      id: z16.number(),
      nome: z16.string().min(1).max(128),
      descricao: z16.string().optional(),
      larguraCm: z16.number().optional(),
      alturaCm: z16.number().optional(),
      profundidadeCm: z16.number().optional(),
      tipoCaixa: z16.enum(["padronizada", "personalizada"]).optional(),
      custoAquisicao: z16.number().min(0).optional(),
      tempoPorM2Min: z16.number().min(0).optional(),
      tempoPorM3Min: z16.number().min(0).nullable().optional(),
      tempoPorMetroArestaMin: z16.number().min(0).nullable().optional(),
      valorProdutividadePorCm2: z16.number().min(0).nullable().optional(),
      ativo: z16.number().optional()
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
      await db4.update(empacotamentoModelosCaixa).set(setData).where(eq16(empacotamentoModelosCaixa.id, input.id));
      return { success: true };
    }),
    // Atualiza tempo e produtividade de TODAS as caixas de uma vez (painel centralizado)
    updateGlobalProdutividade: publicProcedure.input(z16.object({
      tempoPorM2Min: z16.number().min(0).nullable(),
      tempoPorMetroArestaMin: z16.number().min(0).nullable(),
      valorProdutividadePorCm2: z16.number().min(0).nullable()
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
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoModelosCaixa).where(eq16(empacotamentoModelosCaixa.id, input.id));
      return { success: true };
    })
  }),
  // ─── CHECKLIST POR MODELO DE CAIXA ─────────────────────────────────────────
  checklist: router({
    listPorCaixa: publicProcedure.input(z16.object({ modeloCaixaId: z16.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoChecklistItens).where(eq16(empacotamentoChecklistItens.modeloCaixaId, input.modeloCaixaId)).orderBy(asc4(empacotamentoChecklistItens.ordem));
    }),
    addItem: publicProcedure.input(z16.object({
      modeloCaixaId: z16.number(),
      descricao: z16.string().min(1).max(256),
      obrigatorio: z16.number().default(1),
      ordem: z16.number().default(0)
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoChecklistItens).values({
        modeloCaixaId: input.modeloCaixaId,
        descricao: input.descricao,
        obrigatorio: input.obrigatorio,
        ordem: input.ordem
      });
      return { success: true };
    }),
    updateItem: publicProcedure.input(z16.object({
      id: z16.number(),
      descricao: z16.string().min(1).max(256),
      obrigatorio: z16.number().optional(),
      ordem: z16.number().optional()
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoChecklistItens).set({
        descricao: input.descricao,
        obrigatorio: input.obrigatorio ?? 1,
        ordem: input.ordem ?? 0
      }).where(eq16(empacotamentoChecklistItens.id, input.id));
      return { success: true };
    }),
    deleteItem: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoChecklistItens).where(eq16(empacotamentoChecklistItens.id, input.id));
      return { success: true };
    }),
    // Checklist preenchido por pedido
    getPorPedido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoPedidoChecklist).where(eq16(empacotamentoPedidoChecklist.pedidoId, input.pedidoId));
    }),
    marcarItem: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      itemId: z16.number(),
      marcado: z16.number(),
      // 0 ou 1
      marcadoPor: z16.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoChecklist).where(
        and13(
          eq16(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
          eq16(empacotamentoPedidoChecklist.itemId, input.itemId)
        )
      );
      if (existing.length > 0) {
        await db4.update(empacotamentoPedidoChecklist).set({
          marcado: input.marcado,
          marcadoPor: input.marcadoPor ?? null,
          marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null
        }).where(
          and13(
            eq16(empacotamentoPedidoChecklist.pedidoId, input.pedidoId),
            eq16(empacotamentoPedidoChecklist.itemId, input.itemId)
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
    listPorModelo: publicProcedure.input(z16.object({ modeloId: z16.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoChecklistLetreitoItens).where(eq16(empacotamentoChecklistLetreitoItens.modeloLetreitoId, input.modeloId)).orderBy(asc4(empacotamentoChecklistLetreitoItens.ordem));
    }),
    addItem: publicProcedure.input(z16.object({
      modeloId: z16.number(),
      descricao: z16.string().min(1).max(512),
      obrigatorio: z16.number().default(1),
      ordem: z16.number().default(0)
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoChecklistLetreitoItens).values({
        modeloLetreitoId: input.modeloId,
        descricao: input.descricao,
        obrigatorio: input.obrigatorio,
        ordem: input.ordem
      });
      return { success: true };
    }),
    updateItem: publicProcedure.input(z16.object({
      id: z16.number(),
      descricao: z16.string().min(1).max(512),
      obrigatorio: z16.number().optional(),
      ordem: z16.number().optional()
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoChecklistLetreitoItens).set({ descricao: input.descricao, obrigatorio: input.obrigatorio ?? 1, ordem: input.ordem ?? 0 }).where(eq16(empacotamentoChecklistLetreitoItens.id, input.id));
      return { success: true };
    }),
    deleteItem: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoChecklistLetreitoItens).where(eq16(empacotamentoChecklistLetreitoItens.id, input.id));
      return { success: true };
    }),
    getPorPedido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoPedidoChecklistLetreiro).where(eq16(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId));
    }),
    marcarItem: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      itemId: z16.number(),
      marcado: z16.number(),
      marcadoPor: z16.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoChecklistLetreiro).where(and13(
        eq16(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
        eq16(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
      ));
      if (existing.length > 0) {
        await db4.update(empacotamentoPedidoChecklistLetreiro).set({ marcado: input.marcado, marcadoPor: input.marcadoPor ?? null, marcadoEm: input.marcado ? /* @__PURE__ */ new Date() : null }).where(and13(
          eq16(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId),
          eq16(empacotamentoPedidoChecklistLetreiro.itemId, input.itemId)
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
    listByModelo: publicProcedure.input(z16.object({ modeloId: z16.number() })).query(async ({ input }) => {
      return await db4.select().from(empacotamentoTabelaPrecos).where(eq16(empacotamentoTabelaPrecos.modeloId, input.modeloId)).orderBy(asc4(empacotamentoTabelaPrecos.tipoCaixa));
    }),
    upsert: publicProcedure.input(z16.object({
      modeloId: z16.number(),
      tipoCaixa: z16.string().min(1).max(64),
      valorComissao: z16.number().min(0)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoTabelaPrecos).where(
        and13(
          eq16(empacotamentoTabelaPrecos.modeloId, input.modeloId),
          eq16(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
        )
      );
      if (existing.length > 0) {
        await db4.update(empacotamentoTabelaPrecos).set({ valorComissao: String(input.valorComissao) }).where(
          and13(
            eq16(empacotamentoTabelaPrecos.modeloId, input.modeloId),
            eq16(empacotamentoTabelaPrecos.tipoCaixa, input.tipoCaixa)
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
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoTabelaPrecos).where(eq16(empacotamentoTabelaPrecos.id, input.id));
      return { success: true };
    })
  }),
  // ─── PEDIDOS ────────────────────────────────────────────────────────────────
  pedidos: router({
    list: publicProcedure.input(z16.object({
      kanbanStatus: z16.enum(["aguardando", "embalando", "patio", "abandonado", "todos"]).optional()
    }).optional()).query(async ({ input }) => {
      if (input?.kanbanStatus && input.kanbanStatus !== "todos") {
        return await getDb5().select().from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.kanbanStatus, input.kanbanStatus)).orderBy(asc4(empacotamentoPedidos.prazoEntrega), desc8(empacotamentoPedidos.createdAt));
      }
      return await getDb5().select().from(empacotamentoPedidos).orderBy(asc4(empacotamentoPedidos.prazoEntrega), desc8(empacotamentoPedidos.createdAt));
    }),
    getById: publicProcedure.input(z16.object({ id: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.id, input.id));
      return rows[0] ?? null;
    }),
    // ─── Lista pedidos de um vendedor específico (para alertas de status) ──────
    listPorVendedor: publicProcedure.input(z16.object({ vendedorNome: z16.string() })).query(async ({ input }) => {
      const nome = input.vendedorNome.toLowerCase().trim();
      const todos = await getDb5().select({
        id: empacotamentoPedidos.id,
        numeroPedido: empacotamentoPedidos.numeroPedido,
        cliente: empacotamentoPedidos.cliente,
        kanbanStatus: empacotamentoPedidos.kanbanStatus,
        createdByNome: empacotamentoPedidos.createdByNome,
        updatedAt: empacotamentoPedidos.updatedAt
      }).from(empacotamentoPedidos).orderBy(desc8(empacotamentoPedidos.updatedAt));
      return todos.filter((p) => (p.createdByNome ?? "").toLowerCase().trim() === nome);
    }),
    // ─── INTEGRAÇÃO MUBISYS: Buscar dados da OS pelo número ───────────────────────────
    buscarOs: publicProcedure.input(z16.object({ numeroOs: z16.string().min(1) })).query(async ({ input }) => {
      const dados = await buscarOsMubisys(input.numeroOs);
      return dados;
    }),
    create: publicProcedure.input(z16.object({
      numeroPedido: z16.string().min(1).max(64),
      cliente: z16.string().min(1).max(256),
      modeloId: z16.number().optional(),
      modeloNome: z16.string().optional(),
      modeloCaixaId: z16.number().optional(),
      modeloCaixaNome: z16.string().optional(),
      tipoCaixa: z16.string().max(64).default(""),
      arquivoUrl: z16.string().optional(),
      arquivoKey: z16.string().optional(),
      arquivoTipo: z16.string().optional(),
      prazoEntrega: z16.string().optional(),
      // ISO datetime
      horarioMaximo: z16.string().optional(),
      // "HH:MM"
      observacoes: z16.string().optional(),
      createdBy: z16.number().optional(),
      createdByNome: z16.string().optional(),
      larguraCm: z16.number().optional(),
      alturaCm: z16.number().optional(),
      profundidadeCm: z16.number().optional(),
      pesoKg: z16.number().min(0).optional(),
      metrosQuadrados: z16.number().min(0).optional(),
      cnpjCliente: z16.string().optional(),
      cepCliente: z16.string().optional(),
      enderecoCliente: z16.string().optional()
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
    update: publicProcedure.input(z16.object({
      id: z16.number(),
      numeroPedido: z16.string().optional(),
      cliente: z16.string().optional(),
      modeloId: z16.number().optional(),
      modeloNome: z16.string().optional(),
      modeloCaixaId: z16.number().optional(),
      modeloCaixaNome: z16.string().optional(),
      tipoCaixa: z16.string().optional(),
      prazoEntrega: z16.string().optional(),
      horarioMaximo: z16.string().optional(),
      observacoes: z16.string().optional()
    })).mutation(async ({ input }) => {
      const { id, prazoEntrega, ...rest } = input;
      await db4.update(empacotamentoPedidos).set({
        ...rest,
        prazoEntrega: prazoEntrega ? new Date(prazoEntrega) : void 0
      }).where(eq16(empacotamentoPedidos.id, id));
      return { success: true };
    }),
    atualizarDimensoes: publicProcedure.input(z16.object({
      id: z16.number(),
      larguraCm: z16.number().min(0).nullable().optional(),
      alturaCm: z16.number().min(0).nullable().optional(),
      profundidadeCm: z16.number().min(0).nullable().optional(),
      pesoKg: z16.number().min(0).nullable().optional()
    })).mutation(async ({ input }) => {
      const { id, ...dims } = input;
      const setData = {};
      if (dims.larguraCm !== void 0) setData.larguraCm = dims.larguraCm != null ? String(dims.larguraCm) : null;
      if (dims.alturaCm !== void 0) setData.alturaCm = dims.alturaCm != null ? String(dims.alturaCm) : null;
      if (dims.profundidadeCm !== void 0) setData.profundidadeCm = dims.profundidadeCm != null ? String(dims.profundidadeCm) : null;
      if (dims.pesoKg !== void 0) setData.pesoKg = dims.pesoKg != null ? String(dims.pesoKg) : null;
      await getDb5().update(empacotamentoPedidos).set(setData).where(eq16(empacotamentoPedidos.id, id));
      return { success: true };
    }),
    moverKanban: publicProcedure.input(z16.object({
      id: z16.number(),
      kanbanStatus: z16.enum(["aguardando", "embalando", "patio", "abandonado"])
    })).mutation(async ({ input }) => {
      const updates = { kanbanStatus: input.kanbanStatus };
      const { cotacoesFrete: cotacoesFrete2 } = await Promise.resolve().then(() => (init_schema(), schema_exports));
      if (input.kanbanStatus === "patio") {
        updates.finalizadoEm = /* @__PURE__ */ new Date();
        const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.id, input.id));
        const pedido = pedidos[0];
        if (pedido) {
          const existing = await getDb5().select({ id: cotacoesFrete2.id }).from(cotacoesFrete2).where(eq16(cotacoesFrete2.empacotamentoPedidoId, input.id)).limit(1);
          if (existing.length === 0) {
            const fotos = await getDb5().select().from(empacotamentoPedidoFotos).where(eq16(empacotamentoPedidoFotos.pedidoId, input.id)).orderBy(desc8(empacotamentoPedidoFotos.id)).limit(1);
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
              eq16(cotacoesFrete2.empacotamentoPedidoId, input.id)
            );
          }
        }
      }
      if (input.kanbanStatus === "embalando" || input.kanbanStatus === "aguardando") {
        await getDb5().update(cotacoesFrete2).set({ status: "cancelada" }).where(
          eq16(cotacoesFrete2.empacotamentoPedidoId, input.id)
        );
      }
      await getDb5().update(empacotamentoPedidos).set(updates).where(eq16(empacotamentoPedidos.id, input.id));
      return { success: true };
    }),
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await db4.delete(empacotamentoPedidos).where(eq16(empacotamentoPedidos.id, input.id));
      return { success: true };
    }),
    uploadArquivo: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      url: z16.string().url(),
      key: z16.string().min(1),
      mimeType: z16.string(),
      fileName: z16.string()
    })).mutation(async ({ input }) => {
      const tipo = input.mimeType.includes("pdf") ? "pdf" : "image";
      await db4.update(empacotamentoPedidos).set({ arquivoUrl: input.url, arquivoKey: input.key, arquivoTipo: tipo }).where(eq16(empacotamentoPedidos.id, input.pedidoId));
      return { url: input.url, key: input.key };
    }),
    uploadFoto: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      url: z16.string().url(),
      key: z16.string().min(1),
      mimeType: z16.string(),
      usuarioNome: z16.string().optional()
    })).mutation(async ({ input }) => {
      await db4.insert(empacotamentoPedidoFotos).values({
        pedidoId: input.pedidoId,
        storageKey: input.key,
        url: input.url,
        usuarioNome: input.usuarioNome ?? null
      });
      return { url: input.url, key: input.key };
    }),
    listFotos: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoPedidoFotos).where(eq16(empacotamentoPedidoFotos.pedidoId, input.pedidoId)).orderBy(desc8(empacotamentoPedidoFotos.createdAt));
    }),
    atualizarFotoAnotada: publicProcedure.input(z16.object({
      fotoId: z16.number(),
      url: z16.string().url(),
      key: z16.string().min(1)
    })).mutation(async ({ input }) => {
      await getDb5().update(empacotamentoPedidoFotos).set({ url: input.url, storageKey: input.key }).where(eq16(empacotamentoPedidoFotos.id, input.fotoId));
      return { url: input.url };
    }),
    // Salva o arquivo do supervisor (imagem) com anotações canvas
    atualizarArquivoPedidoAnotado: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      url: z16.string().url(),
      key: z16.string().min(1)
    })).mutation(async ({ input }) => {
      await getDb5().update(empacotamentoPedidos).set({ arquivoUrl: input.url, arquivoKey: input.key, arquivoTipo: "image" }).where(eq16(empacotamentoPedidos.id, input.pedidoId));
      return { url: input.url };
    }),
    // Verifica se um pedido pode ir para o pátio (checklist + operador)
    checkPendencias: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.id, input.pedidoId));
      const pedido = pedidos[0];
      if (!pedido) return { podeIrPatio: false, semOperador: true, checklistPendentes: 0, motivos: ["Pedido n\xE3o encontrado"] };
      const motivos = [];
      const operadores = await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq16(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId));
      const temOperador = operadores.length > 0;
      if (!temOperador) motivos.push("Nenhum colaborador vinculado ao pedido");
      let checklistPendentes = 0;
      if (pedido.modeloCaixaId) {
        const itens = await getDb5().select().from(empacotamentoChecklistItens).where(and13(eq16(empacotamentoChecklistItens.modeloCaixaId, pedido.modeloCaixaId), eq16(empacotamentoChecklistItens.obrigatorio, 1)));
        const marcados = await getDb5().select().from(empacotamentoPedidoChecklist).where(and13(eq16(empacotamentoPedidoChecklist.pedidoId, input.pedidoId), eq16(empacotamentoPedidoChecklist.marcado, 1)));
        const marcadosIds = new Set(marcados.map((m) => m.itemId));
        checklistPendentes += itens.filter((i) => !marcadosIds.has(i.id)).length;
      }
      if (pedido.modeloId) {
        const itensLetreiro = await getDb5().select().from(empacotamentoChecklistLetreitoItens).where(and13(eq16(empacotamentoChecklistLetreitoItens.modeloLetreitoId, pedido.modeloId), eq16(empacotamentoChecklistLetreitoItens.obrigatorio, 1)));
        const marcadosLetreiro = await getDb5().select().from(empacotamentoPedidoChecklistLetreiro).where(and13(eq16(empacotamentoPedidoChecklistLetreiro.pedidoId, input.pedidoId), eq16(empacotamentoPedidoChecklistLetreiro.marcado, 1)));
        const marcadosIdsLetreiro = new Set(marcadosLetreiro.map((m) => m.itemId));
        checklistPendentes += itensLetreiro.filter((i) => !marcadosIdsLetreiro.has(i.id)).length;
      }
      if (checklistPendentes > 0) motivos.push(`${checklistPendentes} item(ns) obrigat\xF3rio(s) do checklist pendente(s)`);
      const fotos = await getDb5().select({ id: empacotamentoPedidoFotos.id }).from(empacotamentoPedidoFotos).where(eq16(empacotamentoPedidoFotos.pedidoId, input.pedidoId)).limit(1);
      const temFoto = fotos.length > 0;
      if (!temFoto) motivos.push("Fotografia do pedido embalado \xE9 obrigat\xF3ria");
      const temPeso = pedido.pesoKg != null && parseFloat(String(pedido.pesoKg)) > 0;
      if (!temPeso) motivos.push("Peso (kg) \xE9 obrigat\xF3rio");
      const temMedidas = pedido.alturaCm != null && pedido.larguraCm != null && pedido.profundidadeCm != null && parseFloat(String(pedido.alturaCm)) > 0 && parseFloat(String(pedido.larguraCm)) > 0 && parseFloat(String(pedido.profundidadeCm)) > 0;
      if (!temMedidas) motivos.push("Medidas da caixa (A \xD7 L \xD7 P) s\xE3o obrigat\xF3rias");
      const sessoesAbertas = await getDb5().select().from(empacotamentoSessoes).where(and13(
        eq16(empacotamentoSessoes.pedidoId, input.pedidoId),
        sql8`${empacotamentoSessoes.status} IN ('ativo', 'pausado')`
      ));
      const temOperadorSemRegistro = sessoesAbertas.length > 0;
      if (temOperadorSemRegistro) motivos.push(`${sessoesAbertas.length} operador(es) com cron\xF4metro ativo sem registrar o tempo. Clique em 'Registrar' antes de mover para o P\xE1tio.`);
      const podeIrPatio = temOperador && checklistPendentes === 0 && temFoto && temPeso && temMedidas && !temOperadorSemRegistro;
      return { podeIrPatio, semOperador: !temOperador, checklistPendentes, temFoto, temPeso, temMedidas, temOperadorSemRegistro, motivos };
    })
  }),
  // ─── USUÁRIOS POR PEDIDO (cronômetro + atribuição) ──────────────────────────
  pedidoUsuarios: router({
    listPorPedido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq16(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId)).orderBy(asc4(empacotamentoPedidoUsuarios.createdAt));
    }),
    entrar: publicProcedure.input(z16.object({
      pedidoId: z16.number(),
      usuarioId: z16.string().optional(),
      usuarioNome: z16.string().min(1)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoPedidoUsuarios).where(
        and13(
          eq16(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
          eq16(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome),
          eq16(empacotamentoPedidoUsuarios.ativo, 1)
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
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.id, input.pedidoId));
      if (pedidos[0]?.kanbanStatus === "aguardando") {
        await getDb5().update(empacotamentoPedidos).set({ kanbanStatus: "embalando" }).where(eq16(empacotamentoPedidos.id, input.pedidoId));
      }
      return { success: true, id: result.id };
    }),
    sair: publicProcedure.input(z16.object({
      id: z16.number(),
      tempoSegundos: z16.number().int().min(0)
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoPedidoUsuarios).set({
        finalizadoEm: /* @__PURE__ */ new Date(),
        tempoSegundos: input.tempoSegundos,
        ativo: 0
      }).where(eq16(empacotamentoPedidoUsuarios.id, input.id));
      return { success: true };
    }),
    atualizarTempo: publicProcedure.input(z16.object({
      id: z16.number(),
      tempoSegundos: z16.number().int().min(0)
    })).mutation(async ({ input }) => {
      await db4.update(empacotamentoPedidoUsuarios).set({ tempoSegundos: input.tempoSegundos }).where(eq16(empacotamentoPedidoUsuarios.id, input.id));
      return { success: true };
    }),
    // Retorna o registro ativo do operador (por usuarioId ou nome) e o pedido correspondente
    pedidoAtivoDoOperador: publicProcedure.input(z16.object({
      usuarioId: z16.string().optional(),
      usuarioNome: z16.string().optional()
    })).query(async ({ input }) => {
      if (!input.usuarioId && !input.usuarioNome) return null;
      const conditions = [eq16(empacotamentoPedidoUsuarios.ativo, 1)];
      if (input.usuarioId) {
        conditions.push(eq16(empacotamentoPedidoUsuarios.usuarioId, input.usuarioId));
      } else if (input.usuarioNome) {
        conditions.push(eq16(empacotamentoPedidoUsuarios.usuarioNome, input.usuarioNome));
      }
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(and13(...conditions)).orderBy(desc8(empacotamentoPedidoUsuarios.createdAt)).limit(1);
      if (!registros.length) return null;
      const reg = registros[0];
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and13(
        eq16(empacotamentoPedidos.id, reg.pedidoId),
        eq16(empacotamentoPedidos.kanbanStatus, "embalando")
      )).limit(1);
      if (!pedidos.length) return null;
      return { pedido: pedidos[0], registro: reg };
    })
  }),
  // ─── RELATÓRIO DE FECHAMENTO ─────────────────────────────────────────────────
  relatorio: router({
    fechamento: publicProcedure.input(z16.object({
      dataInicio: z16.string(),
      dataFim: z16.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(
        and13(
          eq16(empacotamentoPedidos.kanbanStatus, "patio"),
          gte5(empacotamentoPedidos.finalizadoEm, inicio),
          lte3(empacotamentoPedidos.finalizadoEm, fim)
        )
      ).orderBy(asc4(empacotamentoPedidos.finalizadoEm));
      const pedidoIds = pedidos.map((p) => p.id);
      let usuariosTrabalho = [];
      if (pedidoIds.length > 0) {
        usuariosTrabalho = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql8`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
        and13(
          eq16(empacotamentoPedidos.kanbanStatus, "patio"),
          gte5(empacotamentoPedidos.finalizadoEm, hoje),
          lte3(empacotamentoPedidos.finalizadoEm, amanha)
        )
      );
      const totalHoje = pedidosHoje.reduce((acc, p) => acc + parseFloat(p.valorComissao ?? "0"), 0);
      const aguardando = await getDb5().select({ count: sql8`COUNT(*)` }).from(empacotamentoPedidos).where(eq16(empacotamentoPedidos.kanbanStatus, "aguardando"));
      return {
        finalizadosHoje: pedidosHoje.length,
        totalComissaoHoje: totalHoje,
        pendentes: Number(aguardando[0]?.count ?? 0)
      };
    }),
    produtividadePorUsuario: publicProcedure.input(z16.object({
      dataInicio: z16.string(),
      dataFim: z16.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(
        and13(
          gte5(empacotamentoPedidoUsuarios.createdAt, inicio),
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
    expedidosCompleto: publicProcedure.input(z16.object({
      dataInicio: z16.string().optional(),
      dataFim: z16.string().optional()
    })).query(async ({ input }) => {
      const inicio = input.dataInicio ? new Date(input.dataInicio) : /* @__PURE__ */ new Date(0);
      const fim = input.dataFim ? new Date(input.dataFim) : /* @__PURE__ */ new Date();
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(
        and13(
          eq16(empacotamentoPedidos.kanbanStatus, "patio"),
          gte5(empacotamentoPedidos.finalizadoEm, inicio),
          lte3(empacotamentoPedidos.finalizadoEm, fim)
        )
      ).orderBy(desc8(empacotamentoPedidos.finalizadoEm));
      const pedidoIds = pedidos.map((p) => p.id);
      let fotos = [];
      let usuarios = [];
      if (pedidoIds.length > 0) {
        fotos = await getDb5().select().from(empacotamentoPedidoFotos).where(sql8`${empacotamentoPedidoFotos.pedidoId} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
        usuarios = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql8`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
    create: publicProcedure.input(z16.object({
      nome: z16.string().min(1).max(128),
      unidadeMedida: z16.enum(["m\xB2", "metro", "kg", "unidades"]),
      custoUnitario: z16.number().min(0),
      categoria: z16.string().optional()
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
    update: publicProcedure.input(z16.object({
      id: z16.number(),
      nome: z16.string().min(1).max(128).optional(),
      unidadeMedida: z16.enum(["m\xB2", "metro", "kg", "unidades"]).optional(),
      custoUnitario: z16.number().min(0).optional(),
      categoria: z16.string().optional(),
      ativo: z16.number().optional()
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
      await getDb5().update(empacotamentoInsumos).set(upd).where(eq16(empacotamentoInsumos.id, id));
      return { success: true };
    }),
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoInsumos).where(eq16(empacotamentoInsumos.id, input.id));
      return { success: true };
    })
  }),
  // ─── CONSUMO DE INSUMOS POR CAIXA ───────────────────────────────────────────────────
  consumoCaixa: router({
    listPorCaixa: publicProcedure.input(z16.object({ modeloCaixaId: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq16(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({
        ...r,
        insumo: insumos.find((i) => i.id === r.insumoId)
      }));
    }),
    upsert: publicProcedure.input(z16.object({
      modeloCaixaId: z16.number(),
      insumoId: z16.number(),
      quantidadePorCaixa: z16.number().min(0),
      formulaConsumo: z16.string().optional().default("fixo"),
      fator: z16.number().optional().default(1)
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoConsumoCaixa).where(and13(
        eq16(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId),
        eq16(empacotamentoConsumoCaixa.insumoId, input.insumoId)
      ));
      const setData = {
        quantidadePorCaixa: String(input.quantidadePorCaixa),
        formulaConsumo: input.formulaConsumo,
        fator: String(input.fator)
      };
      if (existing.length > 0) {
        await getDb5().update(empacotamentoConsumoCaixa).set(setData).where(eq16(empacotamentoConsumoCaixa.id, existing[0].id));
      } else {
        await getDb5().insert(empacotamentoConsumoCaixa).values({
          modeloCaixaId: input.modeloCaixaId,
          insumoId: input.insumoId,
          ...setData
        });
      }
      return { success: true };
    }),
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoConsumoCaixa).where(eq16(empacotamentoConsumoCaixa.id, input.id));
      return { success: true };
    })
  }),
  // ─── CUSTO DE FUNCIONÁRIO ───────────────────────────────────────────────────────────────────────
  custoFuncionario: router({
    list: publicProcedure.query(async () => {
      return await getDb5().select().from(empacotamentoCustoFuncionario).orderBy(asc4(empacotamentoCustoFuncionario.nome));
    }),
    upsert: publicProcedure.input(z16.object({
      id: z16.number().optional(),
      nome: z16.string().min(1).max(128),
      salarioMensal: z16.number().min(0),
      horasMes: z16.number().min(1)
    })).mutation(async ({ input }) => {
      const custoHora = input.salarioMensal / input.horasMes;
      if (input.id) {
        await getDb5().update(empacotamentoCustoFuncionario).set({
          nome: input.nome,
          salarioMensal: String(input.salarioMensal),
          horasMes: String(input.horasMes),
          custoHora: String(custoHora.toFixed(4))
        }).where(eq16(empacotamentoCustoFuncionario.id, input.id));
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
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoCustoFuncionario).where(eq16(empacotamentoCustoFuncionario.id, input.id));
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
    calcular: publicProcedure.input(z16.object({
      modeloCaixaId: z16.number(),
      larguraCm: z16.number().min(0.1).optional(),
      alturaCm: z16.number().min(0.1).optional(),
      profundidadeCm: z16.number().min(0.1).optional(),
      tempoExecucaoMin: z16.number().min(0).optional(),
      margemPercent: z16.number().min(0).optional()
    })).query(async ({ input }) => {
      const caixas = await getDb5().select().from(empacotamentoModelosCaixa).where(eq16(empacotamentoModelosCaixa.id, input.modeloCaixaId));
      if (!caixas.length) throw new Error("Modelo de caixa n\xE3o encontrado");
      const caixa = caixas[0];
      const L = input.larguraCm ?? parseFloat(String(caixa.larguraCm ?? 0));
      const A = input.alturaCm ?? parseFloat(String(caixa.alturaCm ?? 0));
      const P = input.profundidadeCm ?? parseFloat(String(caixa.profundidadeCm ?? 0));
      const areaExternaM2 = L > 0 && A > 0 && P > 0 ? 2 * (L * A + L * P + A * P) / 1e4 : 0;
      const volumeInternoM3 = L > 0 && A > 0 && P > 0 ? L * A * P / 1e6 : 0;
      const perimetroM = L > 0 && A > 0 && P > 0 ? 4 * (L + A + P) / 2 / 100 : 0;
      const consumos = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq16(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId));
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
      const funcionarios = await getDb5().select().from(empacotamentoCustoFuncionario).where(eq16(empacotamentoCustoFuncionario.ativo, 1));
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
      const rows = await getDb5().select({ id: user.id, name: user.name, role: user.role }).from(user).where(eq16(user.role, "empacotamento")).orderBy(asc4(user.name));
      return rows;
    })
  }),
  // ─── PAUSAS DO CRONÔMETRO ─────────────────────────────────────────────────────
  cronometroPausas: router({
    listPorPedidoUsuario: publicProcedure.input(z16.object({ pedidoUsuarioId: z16.number() })).query(async ({ input }) => {
      return await getDb5().select().from(empacotamentoCronometroPausas).where(eq16(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId)).orderBy(asc4(empacotamentoCronometroPausas.pausadoEm));
    }),
    // Retorna true se há alguma pausa aberta para qualquer operador do pedido
    temPausaAbertaPorPedido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select({ id: empacotamentoCronometroPausas.id }).from(empacotamentoCronometroPausas).innerJoin(
        empacotamentoPedidoUsuarios,
        eq16(empacotamentoCronometroPausas.pedidoUsuarioId, empacotamentoPedidoUsuarios.id)
      ).where(
        and13(
          eq16(empacotamentoPedidoUsuarios.pedidoId, input.pedidoId),
          sql8`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
        )
      ).limit(1);
      return { pausado: rows.length > 0 };
    }),
    pausar: publicProcedure.input(z16.object({ pedidoUsuarioId: z16.number(), tempoSegundosAtual: z16.number().int().min(0).optional() })).mutation(async ({ input }) => {
      const abertas = await getDb5().select().from(empacotamentoCronometroPausas).where(and13(
        eq16(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId),
        sql8`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
      ));
      if (abertas.length > 0) return { success: true, id: abertas[0].id };
      if (input.tempoSegundosAtual !== void 0) {
        await getDb5().update(empacotamentoPedidoUsuarios).set({ tempoSegundos: input.tempoSegundosAtual }).where(eq16(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
      }
      const [result] = await getDb5().insert(empacotamentoCronometroPausas).values({
        pedidoUsuarioId: input.pedidoUsuarioId,
        pausadoEm: /* @__PURE__ */ new Date()
      }).returning({ id: empacotamentoCronometroPausas.id });
      return { success: true, id: result.id };
    }),
    retomar: publicProcedure.input(z16.object({ pedidoUsuarioId: z16.number() })).mutation(async ({ input }) => {
      await getDb5().execute(
        sql8`UPDATE empacotamento_cronometro_pausas SET retomadoEm = NOW() WHERE pedidoUsuarioId = ${input.pedidoUsuarioId} AND retomadoEm IS NULL`
      );
      await getDb5().update(empacotamentoPedidoUsuarios).set({ iniciadoEm: /* @__PURE__ */ new Date() }).where(eq16(empacotamentoPedidoUsuarios.id, input.pedidoUsuarioId));
      return { success: true };
    }),
    // Pausa automática: pausa todos os operadores ativos de um pedido (ou todos os pedidos)
    pausarTodosAtivos: publicProcedure.input(z16.object({ motivo: z16.string().optional() })).mutation(async ({ input }) => {
      const ativos = await getDb5().select().from(empacotamentoPedidoUsuarios).where(eq16(empacotamentoPedidoUsuarios.ativo, 1));
      let pausados = 0;
      for (const op of ativos) {
        const abertas = await getDb5().select().from(empacotamentoCronometroPausas).where(and13(
          eq16(empacotamentoCronometroPausas.pedidoUsuarioId, op.id),
          sql8`${empacotamentoCronometroPausas.retomadoEm} IS NULL`
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
    tempoTotalPausadoSegundos: publicProcedure.input(z16.object({ pedidoUsuarioId: z16.number() })).query(async ({ input }) => {
      const pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(eq16(empacotamentoCronometroPausas.pedidoUsuarioId, input.pedidoUsuarioId));
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
      const rows = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1)).orderBy(desc8(empacotamentoConfigProdutividade.updatedAt));
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
    upsert: publicProcedure.input(z16.object({
      valorPorMinuto: z16.number().min(0),
      bonusPorcentagem: z16.number().min(0).max(100),
      penalidadePorcentagem: z16.number().min(0).max(100),
      descricao: z16.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1));
      if (existing.length > 0) {
        await getDb5().update(empacotamentoConfigProdutividade).set({
          valorPorMinuto: String(input.valorPorMinuto),
          bonusPorcentagem: String(input.bonusPorcentagem),
          penalidadePorcentagem: String(input.penalidadePorcentagem),
          descricao: input.descricao ?? null
        }).where(eq16(empacotamentoConfigProdutividade.id, existing[0].id));
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
    calcular: publicProcedure.input(z16.object({
      modeloId: z16.number().optional(),
      modeloCaixaId: z16.number().optional(),
      metrosQuadrados: z16.number().min(0).optional()
    })).query(async ({ input }) => {
      let tempoCaixaMin = 0;
      let tempoLetreiMin = 0;
      if (input.modeloCaixaId) {
        const caixas = await getDb5().select().from(empacotamentoModelosCaixa).where(eq16(empacotamentoModelosCaixa.id, input.modeloCaixaId));
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
        const modelos = await getDb5().select().from(empacotamentoModelos).where(eq16(empacotamentoModelos.id, input.modeloId));
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
    porColaborador: publicProcedure.input(z16.object({
      dataInicio: z16.string(),
      dataFim: z16.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1));
      const cfg = config[0] ?? { valorPorMinuto: "0.15", bonusPorcentagem: "20", penalidadePorcentagem: "30" };
      const valorMin = parseFloat(String(cfg.valorPorMinuto));
      const bonusPct = parseFloat(String(cfg.bonusPorcentagem));
      const penalidadePct = parseFloat(String(cfg.penalidadePorcentagem));
      const registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(and13(
        gte5(empacotamentoPedidoUsuarios.createdAt, inicio),
        lte3(empacotamentoPedidoUsuarios.createdAt, fim)
      ));
      const pedidoIds = Array.from(new Set(registros.map((r) => r.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql8`${empacotamentoPedidos.id} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
      }
      const usuarioIds = registros.map((r) => r.id);
      let pausas = [];
      if (usuarioIds.length > 0) {
        pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(sql8`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql8.join(usuarioIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
    porPeriodo: publicProcedure.input(z16.object({
      dataInicio: z16.string(),
      dataFim: z16.string()
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and13(
        gte5(empacotamentoPedidos.finalizadoEm, inicio),
        lte3(empacotamentoPedidos.finalizadoEm, fim)
      )).orderBy(desc8(empacotamentoPedidos.finalizadoEm));
      const modelos = await getDb5().select().from(empacotamentoModelos);
      const modelosCaixa = await getDb5().select().from(empacotamentoModelosCaixa);
      const pedidoIds = pedidos.map((p) => p.id);
      let registros = [];
      let pausas = [];
      if (pedidoIds.length > 0) {
        registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql8`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
        const usuarioIds = registros.map((r) => r.id);
        if (usuarioIds.length > 0) {
          pausas = await getDb5().select().from(empacotamentoCronometroPausas).where(sql8`${empacotamentoCronometroPausas.pedidoUsuarioId} IN (${sql8.join(usuarioIds.map((id) => sql8`${id}`), sql8`, `)})`);
        }
      }
      const configs = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1));
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
    porPeriodo: publicProcedure.input(z16.object({
      dataInicio: z16.string(),
      dataFim: z16.string(),
      tipoProduto: z16.enum(["todos", "letreiro", "caixa"]).default("todos")
    })).query(async ({ input }) => {
      const inicio = new Date(input.dataInicio);
      const fim = new Date(input.dataFim);
      fim.setHours(23, 59, 59, 999);
      const pedidos = await getDb5().select().from(empacotamentoPedidos).where(and13(gte5(empacotamentoPedidos.finalizadoEm, inicio), lte3(empacotamentoPedidos.finalizadoEm, fim)));
      const modelos = await getDb5().select().from(empacotamentoModelos);
      const modelosCaixa = await getDb5().select().from(empacotamentoModelosCaixa);
      const pedidoIds = pedidos.map((p) => p.id);
      let registros = [];
      if (pedidoIds.length > 0) {
        registros = await getDb5().select().from(empacotamentoPedidoUsuarios).where(sql8`${empacotamentoPedidoUsuarios.pedidoId} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
    semanal: publicProcedure.input(z16.object({ semanas: z16.number().default(1) })).query(async ({ input }) => {
      const fimMs = /* @__PURE__ */ new Date();
      fimMs.setHours(23, 59, 59, 999);
      const inicioMs = /* @__PURE__ */ new Date();
      inicioMs.setDate(inicioMs.getDate() - input.semanas * 7);
      inicioMs.setHours(0, 0, 0, 0);
      return calcularRanking(Math.floor(inicioMs.getTime() / 1e3), Math.floor(fimMs.getTime() / 1e3));
    }),
    mensal: publicProcedure.input(z16.object({ meses: z16.number().default(1) })).query(async ({ input }) => {
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
    listPorModelo: publicProcedure.input(z16.object({ modeloCaixaId: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoConsumoCaixa).where(eq16(empacotamentoConsumoCaixa.modeloCaixaId, input.modeloCaixaId)).orderBy(asc4(empacotamentoConsumoCaixa.id));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({ ...r, insumo: insumos.find((i) => i.id === r.insumoId) ?? null }));
    })
  }),
  // ─── INSUMOS POR MODELO DE LETREIRO ─────────────────────────────────────────
  insumosLetreiro: router({
    listPorModelo: publicProcedure.input(z16.object({ modeloLetreiId: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoInsumosLetreiro).where(eq16(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId)).orderBy(asc4(empacotamentoInsumosLetreiro.id));
      const insumos = await getDb5().select().from(empacotamentoInsumos);
      return rows.map((r) => ({ ...r, insumo: insumos.find((i) => i.id === r.insumoId) ?? null }));
    }),
    upsert: publicProcedure.input(z16.object({
      modeloLetreiId: z16.number(),
      insumoId: z16.number(),
      fatorM2: z16.number().min(0).default(1),
      observacao: z16.string().optional()
    })).mutation(async ({ input }) => {
      const existing = await getDb5().select().from(empacotamentoInsumosLetreiro).where(and13(
        eq16(empacotamentoInsumosLetreiro.modeloLetreiId, input.modeloLetreiId),
        eq16(empacotamentoInsumosLetreiro.insumoId, input.insumoId)
      ));
      if (existing.length > 0) {
        await getDb5().update(empacotamentoInsumosLetreiro).set({ fatorM2: String(input.fatorM2), observacao: input.observacao ?? null }).where(eq16(empacotamentoInsumosLetreiro.id, existing[0].id));
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
    delete: publicProcedure.input(z16.object({ id: z16.number() })).mutation(async ({ input }) => {
      await getDb5().delete(empacotamentoInsumosLetreiro).where(eq16(empacotamentoInsumosLetreiro.id, input.id));
      return { success: true };
    })
  }),
  // ─── SESSÕES OPERACIONAIS (TEMPORIZADOR PERSISTENTE) ─────────────────────────
  // Fonte de verdade: banco de dados. Frontend apenas reflete o estado.
  // Timezone operacional: America/Campo_Grande
  sessoes: router({
    // Retorna a sessão ativa (ativo/pausado) de um operador em um pedido
    getAtiva: publicProcedure.input(z16.object({ pedidoId: z16.number(), operadorId: z16.string() })).query(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(and13(
        eq16(empacotamentoSessoes.pedidoId, input.pedidoId),
        eq16(empacotamentoSessoes.operadorId, input.operadorId),
        sql8`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
      )).orderBy(desc8(empacotamentoSessoes.id)).limit(1);
      if (rows.length === 0) return null;
      const sessao = rows[0];
      const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq16(empacotamentoSessoesPausas.sessaoId, sessao.id)).orderBy(asc4(empacotamentoSessoesPausas.id));
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
    resumoPorPedido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(eq16(empacotamentoSessoes.pedidoId, input.pedidoId)).orderBy(desc8(empacotamentoSessoes.id));
      const agoraSeg = Math.floor(Date.now() / 1e3);
      let totalSegundos = 0;
      let temRegistroValido = false;
      let temSessaoAtiva = false;
      let temSessaoPausada = false;
      for (const s of sessoes) {
        if (s.status === "ativo") {
          temSessaoAtiva = true;
          const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq16(empacotamentoSessoesPausas.sessaoId, s.id));
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
    iniciar: publicProcedure.input(z16.object({ pedidoId: z16.number(), operadorId: z16.string(), operadorNome: z16.string() })).mutation(async ({ input }) => {
      const existente = await getDb5().select().from(empacotamentoSessoes).where(and13(
        eq16(empacotamentoSessoes.pedidoId, input.pedidoId),
        eq16(empacotamentoSessoes.operadorId, input.operadorId),
        sql8`${empacotamentoSessoes.status} IN ('ativo', 'pausado', 'finalizado')`
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
    pausar: publicProcedure.input(z16.object({ sessaoId: z16.number() })).mutation(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(and13(eq16(empacotamentoSessoes.id, input.sessaoId), eq16(empacotamentoSessoes.status, "ativo"))).limit(1);
      if (rows.length === 0) return { success: false, error: "sessao_nao_ativa" };
      const sessao = rows[0];
      const agoraUtcSeg = Math.floor(Date.now() / 1e3);
      const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq16(empacotamentoSessoesPausas.sessaoId, sessao.id));
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
      }).where(eq16(empacotamentoSessoes.id, sessao.id));
      return { success: true, tempoAcumuladoSegundos: tempoAcumulado };
    }),
    // Retoma uma sessão pausada
    retomar: publicProcedure.input(z16.object({ sessaoId: z16.number() })).mutation(async ({ input }) => {
      return await retomarSessao(input.sessaoId);
    }),
    // Registra formalmente o tempo (não encerra a sessão)
    registrar: publicProcedure.input(z16.object({ sessaoId: z16.number() })).mutation(async ({ input }) => {
      const rows = await getDb5().select().from(empacotamentoSessoes).where(eq16(empacotamentoSessoes.id, input.sessaoId)).limit(1);
      if (rows.length === 0) return { success: false, error: "sessao_nao_encontrada" };
      const sessao = rows[0];
      const agoraUtcSeg = Math.floor(Date.now() / 1e3);
      let tempoAtual = sessao.totalSegundos;
      if (sessao.status === "ativo") {
        const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq16(empacotamentoSessoesPausas.sessaoId, sessao.id));
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
      }).where(eq16(empacotamentoSessoes.id, sessao.id));
      return { success: true, tempoRegistradoSegundos: tempoAtual };
    }),
    // Pausa automática: pausa todas as sessões ativas (chamada pelo scheduler)
    pausarTodosAtivos: publicProcedure.input(z16.object({ motivo: z16.string().optional() })).mutation(async ({ input: _input }) => {
      const ativas = await getDb5().select().from(empacotamentoSessoes).where(eq16(empacotamentoSessoes.status, "ativo"));
      let pausados = 0;
      for (const sessao of ativas) {
        const agoraUtcSeg = Math.floor(Date.now() / 1e3);
        const pausas = await getDb5().select().from(empacotamentoSessoesPausas).where(eq16(empacotamentoSessoesPausas.sessaoId, sessao.id));
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
        }).where(eq16(empacotamentoSessoes.id, sessao.id));
        pausados++;
      }
      return { success: true, pausados };
    }),
    // Apaga sessões com tempo zero (registros falsos no ranking)
    deletarSessoesZero: publicProcedure.mutation(async () => {
      const result = await getDb5().delete(empacotamentoSessoes).where(and13(
        eq16(empacotamentoSessoes.status, "finalizado"),
        sql8`(${empacotamentoSessoes.tempoRegistradoSegundos} IS NULL OR ${empacotamentoSessoes.tempoRegistradoSegundos} = 0)`,
        sql8`(${empacotamentoSessoes.totalSegundos} IS NULL OR ${empacotamentoSessoes.totalSegundos} = 0)`
      ));
      return { deletados: result.rowsAffected ?? 0 };
    }),
    // Verifica se o pedido tem pelo menos um registro válido (para liberar mover para pátio)
    temRegistroValido: publicProcedure.input(z16.object({ pedidoId: z16.number() })).query(async ({ input }) => {
      const rows = await getDb5().select({ id: empacotamentoSessoes.id }).from(empacotamentoSessoes).where(and13(
        eq16(empacotamentoSessoes.pedidoId, input.pedidoId),
        sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`
      )).limit(1);
      return { temRegistro: rows.length > 0 };
    })
  }),
  // ─── PAINEL DE REGISTROS DE TEMPO POR PEDIDO ─────────────────────────────────
  registrosTempo: router({
    list: publicProcedure.input(z16.object({
      periodo: z16.enum(["semana", "mes", "tudo"]).default("semana")
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
      const where = input.periodo === "tudo" ? and13(eq16(empacotamentoSessoes.status, "finalizado"), sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`) : and13(
        eq16(empacotamentoSessoes.status, "finalizado"),
        sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
        sql8`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
        sql8`${empacotamentoSessoes.registradoEm} <= ${agora}`
      );
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(where).orderBy(sql8`${empacotamentoSessoes.registradoEm} DESC`);
      const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql8`${empacotamentoPedidos.id} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
      }
      const config = await getDb5().select().from(empacotamentoConfigProdutividade).where(eq16(empacotamentoConfigProdutividade.ativo, 1));
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
    list: publicProcedure.input(z16.object({
      periodo: z16.enum(["semana", "mes", "tudo"]).default("semana")
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
      const where = input.periodo === "tudo" ? and13(eq16(empacotamentoSessoes.status, "finalizado"), sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`) : and13(
        eq16(empacotamentoSessoes.status, "finalizado"),
        sql8`${empacotamentoSessoes.registradoEm} IS NOT NULL`,
        sql8`${empacotamentoSessoes.registradoEm} >= ${inicioTs}`,
        sql8`${empacotamentoSessoes.registradoEm} <= ${agora}`
      );
      const sessoes = await getDb5().select().from(empacotamentoSessoes).where(where);
      const pedidoIds = Array.from(new Set(sessoes.map((s) => s.pedidoId)));
      let pedidos = [];
      if (pedidoIds.length > 0) {
        pedidos = await getDb5().select().from(empacotamentoPedidos).where(sql8`${empacotamentoPedidos.id} IN (${sql8.join(pedidoIds.map((id) => sql8`${id}`), sql8`, `)})`);
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
  const rows = await getDb5().select().from(empacotamentoSessoes).where(and13(eq16(empacotamentoSessoes.id, sessaoId), eq16(empacotamentoSessoes.status, "pausado"))).limit(1);
  if (rows.length === 0) return { success: false, error: "sessao_nao_pausada" };
  const sessao = rows[0];
  const agoraUtcSeg = Math.floor(Date.now() / 1e3);
  await getDb5().execute(
    sql8`UPDATE empacotamento_sessoes_pausas SET retomadoEm = ${agoraUtcSeg} WHERE sessaoId = ${sessao.id} AND retomadoEm IS NULL`
  );
  await getDb5().update(empacotamentoSessoes).set({
    status: "ativo"
  }).where(eq16(empacotamentoSessoes.id, sessao.id));
  return { success: true, sessaoId, action: "resumed" };
}

// server/routers/metaProdutos.ts
init_trpc();
init_db();
init_schema();
import { z as z17 } from "zod";
import { eq as eq17, asc as asc5 } from "drizzle-orm";
var metaProdutosRouter = router({
  // Listar todos os produtos monitorados
  list: protectedProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(metaProdutos).orderBy(asc5(metaProdutos.nomeProduto));
  }),
  // Criar ou atualizar um produto monitorado
  upsert: protectedProcedure.input(z17.object({
    id: z17.number().optional(),
    nomeProduto: z17.string().min(1),
    codigoProduto: z17.string().optional(),
    metaParticipacaoPct: z17.number().min(0).max(100),
    observacao: z17.string().optional(),
    ativo: z17.boolean().optional().default(true)
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
      }).where(eq17(metaProdutos.id, id));
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
  delete: protectedProcedure.input(z17.object({ id: z17.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB unavailable");
    await db5.delete(metaProdutos).where(eq17(metaProdutos.id, input.id));
    return { success: true };
  })
});

// server/routers.ts
init_performanceComercial();

// server/routers/insightsComerciais.ts
init_trpc();
init_db();
init_schema();
init_llm();
init_performanceComercial();
import { z as z18 } from "zod";
import { eq as eq18, and as and14 } from "drizzle-orm";
var MESES_NOMES2 = ["", "Janeiro", "Fevereiro", "Mar\xE7o", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function fmtR3(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function mesAnterior(mes, ano) {
  return mes === 1 ? { mes: 12, ano: ano - 1 } : { mes: mes - 1, ano };
}
async function coletarDados(db5, mes, ano) {
  const osRows = await db5.select().from(historicoOs).where(and14(eq18(historicoOs.mes, mes), eq18(historicoOs.ano, ano)));
  const orcRows = await db5.select().from(historicoOrcamentos).where(and14(eq18(historicoOrcamentos.mes, mes), eq18(historicoOrcamentos.ano, ano)));
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
  const dreRows = await db5.select().from(dreMensal).where(and14(eq18(dreMensal.ano, ano), eq18(dreMensal.mes, mes))).limit(1);
  const dre = dreRows[0] ?? null;
  const finRows = await db5.select().from(financeiroMensal).where(and14(eq18(financeiroMensal.mes, mes), eq18(financeiroMensal.ano, ano))).limit(1);
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

Analise os dados reais de ${MESES_NOMES2[mes]}/${ano}, comparados ao m\xEAs anterior, e gere um diagn\xF3stico pr\xE1tico focado em DUAS perguntas: como vender mais, e como lucrar mais.

## DESEMPENHO COMERCIAL \u2014 ${MESES_NOMES2[mes]}/${ano}
- OS aprovadas (vendas): ${c.totalOs}
- Faturamento: ${fmtR3(c.faturamento)}${varFat !== null ? ` (${varFat >= 0 ? "+" : ""}${varFat.toFixed(1)}% vs. ${MESES_NOMES2[mesAnt]}/${anoAnt})` : ""}
- Custo total: ${fmtR3(c.custo)}
- Resultado (lucro operacional das OS): ${fmtR3(c.resultado)} (margem de ${c.margemPct.toFixed(1)}%)
- Ticket m\xE9dio: ${fmtR3(c.ticketMedio)}
- Or\xE7amentos emitidos: ${c.totalOrcamentos}, somando ${fmtR3(c.valorOrcado)}
- Taxa de convers\xE3o (or\xE7amento \u2192 venda): ${c.taxaConversao.toFixed(1)}%
- Taxa de faturamento (venda / or\xE7ado): ${c.taxaFaturamento.toFixed(1)}%
- Clientes \xFAnicos atendidos: ${c.clientesUnicos} (${c.clientesNovos} novos ou reativados ap\xF3s 6+ meses de inatividade)

### Top 5 Clientes por Faturamento
${c.topClientes.length > 0 ? c.topClientes.map((t2, i) => `${i + 1}. ${t2.cliente} \u2014 ${fmtR3(t2.valor)}`).join("\n") : "(sem dados)"}

### Faturamento por Vendedor
${c.topVendedores.length > 0 ? c.topVendedores.map((v) => `- ${v.vendedor}: ${v.total} OS, ${fmtR3(v.faturamento)}`).join("\n") : "(sem dados)"}

## M\xCAS ANTERIOR (${MESES_NOMES2[mesAnt]}/${anoAnt}) \u2014 PARA COMPARA\xC7\xC3O
- Faturamento: ${fmtR3(cAnt.faturamento)}
- Resultado: ${fmtR3(cAnt.resultado)} (margem de ${cAnt.margemPct.toFixed(1)}%)
- Taxa de convers\xE3o: ${cAnt.taxaConversao.toFixed(1)}%
- Clientes \xFAnicos: ${cAnt.clientesUnicos} (${cAnt.clientesNovos} novos/reativados)

## DADOS FINANCEIROS DO M\xCAS
${atual.dre ? `- Receita Operacional Bruta (DRE): ${fmtR3(Number(atual.dre.receitaOperacionalBruta || 0))}
- Despesas Fixas: ${fmtR3(Number(atual.dre.despesasFixas || 0))}
- Despesas com Pessoal: ${fmtR3(Number(atual.dre.despesasPessoal || 0))}
- Lucro L\xEDquido (DRE): ${fmtR3(Number(atual.dre.lucroLiquido || 0))}` : "- DRE n\xE3o dispon\xEDvel para este m\xEAs."}
${atual.fin ? `- Resultado Efetivo: ${fmtR3(Number(atual.fin.resultadoEfetivo || 0))}
- Saldo do M\xEAs (caixa): ${fmtR3(Number(atual.fin.saldoMes || 0))}` : "- Financeiro mensal n\xE3o dispon\xEDvel para este m\xEAs."}

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
  gerarDiagnostico: protectedProcedure.input(z18.object({ mes: z18.number().min(1).max(12), ano: z18.number().min(2020) })).mutation(async ({ input }) => {
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
  perguntar: protectedProcedure.input(z18.object({ mes: z18.number().min(1).max(12), ano: z18.number().min(2020), pergunta: z18.string().min(3) })).mutation(async ({ input }) => {
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

// server/routers.ts
init_analiseGeografica();

// server/routers/metricas.ts
init_trpc();
init_db();
init_schema();
import { z as z19 } from "zod";
import { and as and15, desc as desc9, eq as eq19, gte as gte6, lte as lte4 } from "drizzle-orm";
var metricasRouter = router({
  list: publicProcedure.input(z19.object({
    nome: z19.string().optional(),
    dataInicio: z19.string().optional(),
    // AAAA-MM-DD
    dataFim: z19.string().optional()
  }).optional()).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const conditions = [];
    if (input?.nome) conditions.push(eq19(metricas.nome, input.nome));
    if (input?.dataInicio) conditions.push(gte6(metricas.dataApuracao, input.dataInicio));
    if (input?.dataFim) conditions.push(lte4(metricas.dataApuracao, input.dataFim));
    return db5.select().from(metricas).where(conditions.length ? and15(...conditions) : void 0).orderBy(desc9(metricas.dataApuracao), desc9(metricas.id));
  }),
  nomesDistintos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.selectDistinct({ nome: metricas.nome }).from(metricas);
    return rows.map((r) => r.nome).sort((a, b) => a.localeCompare(b));
  }),
  create: protectedProcedure.input(z19.object({
    nome: z19.string().min(1, "Informe o nome do indicador"),
    valor: z19.number(),
    unidade: z19.string().max(16).default("%"),
    dataApuracao: z19.string(),
    // AAAA-MM-DD
    observacao: z19.string().optional().nullable()
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
  update: protectedProcedure.input(z19.object({
    id: z19.number(),
    nome: z19.string().min(1).optional(),
    valor: z19.number().optional(),
    unidade: z19.string().max(16).optional(),
    dataApuracao: z19.string().optional(),
    observacao: z19.string().optional().nullable()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("Banco de dados indispon\xEDvel");
    const { id, valor, ...rest } = input;
    const [row] = await db5.update(metricas).set({
      ...rest,
      ...valor !== void 0 ? { valor: String(valor) } : {},
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq19(metricas.id, id)).returning();
    return row;
  }),
  delete: protectedProcedure.input(z19.object({ id: z19.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("Banco de dados indispon\xEDvel");
    await db5.delete(metricas).where(eq19(metricas.id, input.id));
    return { success: true };
  })
});

// server/routers/crm.ts
init_trpc();
init_llm();
init_db();
init_schema();
init_crm_abertos_cache();
init_probabilidadeCompra();
init_regioesBrasil();
init_dias_uteis();
init_mubisys_client();
import { z as z20 } from "zod";
import { TRPCError as TRPCError4 } from "@trpc/server";
import { eq as eq21, and as and16, desc as desc10, sql as sql9 } from "drizzle-orm";
var FAIXA_DEFAULTS = {
  1: { faixa: 1, label: "Faixa 1 (1-2 du)", diasInicio: 1, diasFim: 2 },
  2: { faixa: 2, label: "Faixa 2 (3-5 du)", diasInicio: 3, diasFim: 5 },
  3: { faixa: 3, label: "Faixa 3 (6-10 du)", diasInicio: 6, diasFim: 10 }
};
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
async function buscarOrcamentosPeriodo(di, df) {
  if (di >= inicioJanelaFechadosCache()) {
    const cacheHit = await getCrmAbertosCache(CACHE_KEY_FECHADOS);
    const todos = cacheHit ? cacheHit.itens : await refreshCrmFechadosCache();
    return todos.filter((o) => {
      const dia = (o.data_cadastro || "").slice(0, 10);
      return dia && dia >= di && dia <= df;
    });
  }
  const { itens } = await listarOrcamentosMubiSys({ datainicial: di, datafinal: df, perPage: 50 });
  return itens;
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
  getPropostas: protectedProcedure.input(z20.object({
    vendedor: z20.string().optional(),
    // se omitido, usa o nome do usuário logado
    mes: z20.number().min(1).max(12).optional(),
    ano: z20.number().optional(),
    dataInicio: z20.string().optional(),
    // YYYY-MM-DD — filtro manual de datas
    dataFim: z20.string().optional(),
    preset: z20.enum(["hoje", "7dias", "15dias", "mes", "personalizado"]).optional(),
    buscarAntigas: z20.boolean().optional()
    // true = janela de 30 dias em vez de 15 (caso raro de proposta antiga ainda aberta)
  })).query(async ({ ctx, input }) => {
    const now = /* @__PURE__ */ new Date();
    const pad2 = (n) => String(n).padStart(2, "0");
    const fmtDate2 = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    let di;
    let df;
    const preset = input.preset ?? "mes";
    if (preset === "hoje") {
      di = fmtDate2(now);
      df = fmtDate2(now);
    } else if (preset === "7dias") {
      const d7 = new Date(now);
      d7.setDate(now.getDate() - 7);
      di = fmtDate2(d7);
      df = fmtDate2(now);
    } else if (preset === "15dias") {
      const d15 = new Date(now);
      d15.setDate(now.getDate() - 15);
      di = fmtDate2(d15);
      df = fmtDate2(now);
    } else if (preset === "personalizado" && input.dataInicio && input.dataFim) {
      di = input.dataInicio;
      df = input.dataFim;
    } else {
      const mes = input.mes ?? now.getMonth() + 1;
      const ano = input.ano ?? now.getFullYear();
      const lastDay = new Date(ano, mes, 0).getDate();
      di = input.dataInicio ?? `${ano}-${pad2(mes)}-01`;
      df = input.dataFim ?? `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
    }
    const janelaDias = input.buscarAntigas ? JANELA_ABERTOS_DIAS_MAX : JANELA_ABERTOS_DIAS_PADRAO;
    const cacheKey = input.buscarAntigas ? CACHE_KEY_ABERTOS_ESTENDIDO : CACHE_KEY_ABERTOS_PADRAO;
    const cacheHit = await getCrmAbertosCache(cacheKey);
    const todosAbertos = cacheHit ? cacheHit.itens : await refreshCrmAbertosCache(cacheKey, janelaDias);
    const abertosAtualizadoEm = (cacheHit?.fetchedAt ?? /* @__PURE__ */ new Date()).toISOString();
    const todosPeriodo = await buscarOrcamentosPeriodo(di, df);
    const abertos = todosAbertos.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "em aberto" || s === "em andamento" || s === "pendente";
    });
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
    const contatosDb = idsAbertos.length > 0 ? await db5.select().from(crmContatos).orderBy(desc10(crmContatos.contatadoEm)) : [];
    const contatosPorOrc = {};
    for (const c of contatosDb) {
      if (!contatosPorOrc[c.orcamentoId]) contatosPorOrc[c.orcamentoId] = [];
      contatosPorOrc[c.orcamentoId].push(c);
    }
    const propostas = propostasAbertas.map((o) => {
      const orcId = String(o.id);
      const contatos = contatosPorOrc[orcId] ?? [];
      const dataCriacaoDate = parseDate(o.data_cadastro);
      const diasCriado = dataCriacaoDate ? diasUteisEntre(dataCriacaoDate, /* @__PURE__ */ new Date()) : 0;
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
    const ontemStr = `${ontem.getFullYear()}-${pad2(ontem.getMonth() + 1)}-${pad2(ontem.getDate())}`;
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
    const hojeStr = `${hoje.getFullYear()}-${pad2(hoje.getMonth() + 1)}-${pad2(hoje.getDate())}`;
    const contatosHoje = contatosDb.filter((c) => {
      const d = new Date(c.contatadoEm);
      return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` === hojeStr;
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
    let mapaConversao = null;
    let modeloBayesiano = null;
    try {
      mapaConversao = await construirMapaConversaoClientes(db5);
      modeloBayesiano = await construirModeloBayesiano(db5);
    } catch {
      mapaConversao = null;
      modeloBayesiano = null;
    }
    const propostasComTelefone = propostasFiltradas.map((p) => {
      const telefone = telefonesMap[p.id] ?? null;
      const orc = propostasAbertas.find((o) => String(o.id) === p.id);
      const clienteRaw = orc?.cliente;
      const empresaRaw = orc?.empresa;
      const nomeCliente2 = typeof clienteRaw === "object" && clienteRaw !== null ? clienteRaw?.nome ?? clienteRaw?.razao_social ?? String(clienteRaw) : String(clienteRaw ?? empresaRaw ?? "");
      const clienteKey = (nomeCliente2 || "").toLowerCase().trim();
      const overrideStatus = overrideMap.get(clienteKey);
      const isNovoByHistory = clientesComCompra.size > 0 && !clientesComCompra.has(clienteKey);
      const clienteNovo = overrideStatus === "recorrente" ? false : overrideStatus === "novo" ? true : isNovoByHistory;
      const estadoCliente = Array.isArray(orc?.cliente_endereco) ? normalizarUf(orc.cliente_endereco[0]?.estado) : null;
      const regiaoCliente = estadoCliente ? UF_PARA_REGIAO[estadoCliente] ?? null : null;
      const { probabilidade: probabilidadeCompra, explicacao: probabilidadeExplicacao } = modeloBayesiano ? calcularProbabilidadeBayesiana({ clienteNovo, nomeCliente: nomeCliente2, valorProposta: p.valor, modelo: modeloBayesiano, regiaoCliente }) : { probabilidade: null, explicacao: [] };
      const qtdComprasCliente = mapaConversao?.porCliente.get(normalizeEmpresaKey2(nomeCliente2))?.qtdCompras ?? 0;
      return { ...p, telefone, nomeCliente: nomeCliente2, nomeContato: p.nomeContato ?? "", clienteNovo, probabilidadeCompra, probabilidadeExplicacao, qtdComprasCliente, estadoCliente, regiaoCliente };
    });
    return {
      propostas: propostasComTelefone.sort((a, b) => a.qtdContatos - b.qtdContatos || b.diasAberto - a.diasAberto),
      abertosAtualizadoEm,
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
  desfazarContato: protectedProcedure.input(z20.object({
    orcamentoId: z20.string(),
    data: z20.string()
    // ISO string da data do contato a remover
  })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const todos = await db5.select().from(crmContatos).where(eq21(crmContatos.orcamentoId, input.orcamentoId)).orderBy(desc10(crmContatos.contatadoEm));
    const dataAlvo = new Date(input.data);
    const alvo = todos.find((c) => {
      const d = new Date(c.contatadoEm);
      return d.getFullYear() === dataAlvo.getFullYear() && d.getMonth() === dataAlvo.getMonth() && d.getDate() === dataAlvo.getDate();
    });
    if (!alvo) throw new TRPCError4({ code: "NOT_FOUND", message: "Contato n\xE3o encontrado para essa data." });
    await db5.delete(crmContatos).where(eq21(crmContatos.id, alvo.id));
    const vendedor = ctx.user?.name ?? "desconhecido";
    await logAtividade(ctx, { vendedor, acao: "desfazarContato", orcamentoId: input.orcamentoId, detalhe: `contato de ${input.data} removido` });
    return { ok: true };
  }),
  // Marcar proposta como ganha
  marcarGanha: protectedProcedure.input(z20.object({ orcamentoId: z20.string(), vendedor: z20.string(), empresa: z20.string() })).mutation(async ({ ctx, input }) => {
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
  marcarPerdida: protectedProcedure.input(z20.object({ orcamentoId: z20.string(), vendedor: z20.string(), empresa: z20.string() })).mutation(async ({ ctx, input }) => {
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
  getMensagemMotivacional: protectedProcedure.input(z20.object({
    propostasOntem: z20.number(),
    pendentesFollowup: z20.number(),
    nomeVendedor: z20.string()
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
  registrarContato: protectedProcedure.input(z20.object({
    orcamentoId: z20.string(),
    empresa: z20.string(),
    vendedor: z20.string(),
    canal: z20.enum(["nao_retornou", "esperando_cliente", "garantiu_fechamento"]),
    observacao: z20.string().nullable().optional(),
    dataContato: z20.string().optional()
    // ISO string da data clicada
  })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    const existentes = await db5.select().from(crmContatos).where(and16(
      eq21(crmContatos.orcamentoId, input.orcamentoId),
      sql9`${crmContatos.canal} NOT IN ('perdida', 'garantiu_fechamento')`
    ));
    const numeroContato = existentes.length + 1;
    if (numeroContato > 2) {
      throw new TRPCError4({ code: "CONFLICT", message: "M\xE1ximo de 2 contatos j\xE1 registrados para esta proposta." });
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
  getMeta: protectedProcedure.input(z20.object({ vendedor: z20.string(), mes: z20.number(), ano: z20.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    const rows = await db5.select().from(crmMetas).where(and16(
      eq21(crmMetas.vendedor, input.vendedor),
      eq21(crmMetas.mes, input.mes),
      eq21(crmMetas.ano, input.ano)
    ));
    return rows[0] ?? null;
  }),
  saveMeta: protectedProcedure.input(z20.object({
    vendedor: z20.string(),
    mes: z20.number(),
    ano: z20.number(),
    metaValor: z20.number(),
    metaQtdOs: z20.number()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and16(
      eq21(crmMetas.vendedor, input.vendedor),
      eq21(crmMetas.mes, input.mes),
      eq21(crmMetas.ano, input.ano)
    ));
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ metaValor: String(input.metaValor), metaQtdOs: input.metaQtdOs }).where(eq21(crmMetas.id, existing[0].id));
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
    const pad2 = (n) => String(n).padStart(2, "0");
    const lastDay = new Date(ano, mes, 0).getDate();
    const di = `${ano}-${pad2(mes)}-01`;
    const df = `${ano}-${pad2(mes)}-${pad2(lastDay)}`;
    const cacheHit = await getCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO);
    const todosAbertos = cacheHit ? cacheHit.itens : await refreshCrmAbertosCache(CACHE_KEY_ABERTOS_PADRAO, JANELA_ABERTOS_DIAS_PADRAO);
    const todosPeriodo = await buscarOrcamentosPeriodo(di, df);
    const abertos = todosAbertos.filter((o) => {
      const s = (o.status || "").toLowerCase();
      return s === "em aberto" || s === "em andamento" || s === "pendente";
    });
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
    const metas = await db5.select().from(crmMetas).where(and16(eq21(crmMetas.mes, mes), eq21(crmMetas.ano, ano)));
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
  getContatos: protectedProcedure.input(z20.object({ orcamentoId: z20.string() })).query(async ({ input }) => {
    const db5 = await getDb3();
    return db5.select().from(crmContatos).where(eq21(crmContatos.orcamentoId, input.orcamentoId)).orderBy(crmContatos.numeroContato);
  }),
  // Buscar metas do mês com usuário vinculado
  getMetas: protectedProcedure.input(z20.object({ mes: z20.number().optional(), ano: z20.number().optional() })).query(async ({ input }) => {
    const db5 = await getDb3();
    const now = /* @__PURE__ */ new Date();
    const mes = input.mes ?? now.getMonth() + 1;
    const ano = input.ano ?? now.getFullYear();
    return db5.select().from(crmMetas).where(and16(eq21(crmMetas.mes, mes), eq21(crmMetas.ano, ano))).orderBy(crmMetas.vendedor);
  }),
  // Salvar meta (cria ou atualiza)
  salvarMeta: protectedProcedure.input(z20.object({
    vendedor: z20.string(),
    mes: z20.number(),
    ano: z20.number(),
    metaValor: z20.number().optional(),
    metaQtdOs: z20.number().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and16(eq21(crmMetas.vendedor, input.vendedor), eq21(crmMetas.mes, input.mes), eq21(crmMetas.ano, input.ano))).limit(1);
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ metaValor: String(input.metaValor ?? 0), metaQtdOs: input.metaQtdOs ?? 0 }).where(and16(eq21(crmMetas.vendedor, input.vendedor), eq21(crmMetas.mes, input.mes), eq21(crmMetas.ano, input.ano)));
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
  vincularUsuarioMeta: protectedProcedure.input(z20.object({
    vendedor: z20.string(),
    mes: z20.number(),
    ano: z20.number(),
    usuarioId: z20.string().nullable(),
    usuarioNome: z20.string().nullable()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select().from(crmMetas).where(and16(eq21(crmMetas.vendedor, input.vendedor), eq21(crmMetas.mes, input.mes), eq21(crmMetas.ano, input.ano))).limit(1);
    if (existing.length > 0) {
      await db5.update(crmMetas).set({ usuarioVinculadoId: input.usuarioId, usuarioVinculadoNome: input.usuarioNome }).where(and16(eq21(crmMetas.vendedor, input.vendedor), eq21(crmMetas.mes, input.mes), eq21(crmMetas.ano, input.ano)));
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
  excluirVendedorMeta: protectedProcedure.input(z20.object({ vendedor: z20.string(), mes: z20.number(), ano: z20.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.delete(crmMetas).where(and16(eq21(crmMetas.vendedor, input.vendedor), eq21(crmMetas.mes, input.mes), eq21(crmMetas.ano, input.ano)));
    return { ok: true };
  }),
  // ─── Scripts de vendas por faixa ─────────────────────────────────────────────
  listScripts: protectedProcedure.input(z20.object({ faixa: z20.number().min(1).max(20) })).query(async ({ input }) => {
    const db5 = await getDb3();
    return db5.select().from(crmScripts).where(and16(eq21(crmScripts.faixa, input.faixa), eq21(crmScripts.ativo, true))).orderBy(crmScripts.ordem);
  }),
  updateScript: protectedProcedure.input(z20.object({
    id: z20.number(),
    titulo: z20.string().max(128).optional(),
    conteudo: z20.string().min(1),
    conteudo_voz: z20.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.update(crmScripts).set({ titulo: input.titulo, conteudo: input.conteudo, conteudo_voz: input.conteudo_voz ?? null }).where(eq21(crmScripts.id, input.id));
    return { ok: true };
  }),
  addScript: protectedProcedure.input(z20.object({
    faixa: z20.number().min(1).max(20),
    titulo: z20.string().max(128).optional(),
    conteudo: z20.string().min(1),
    conteudo_voz: z20.string().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    const existing = await db5.select({ ordem: crmScripts.ordem }).from(crmScripts).where(eq21(crmScripts.faixa, input.faixa)).orderBy(desc10(crmScripts.ordem)).limit(1);
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
  deleteScript: protectedProcedure.input(z20.object({ id: z20.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.update(crmScripts).set({ ativo: false }).where(eq21(crmScripts.id, input.id));
    return { ok: true };
  }),
  incrementCopiaCount: protectedProcedure.input(z20.object({ id: z20.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await db5.execute(sql9`UPDATE crm_scripts SET copia_count = copia_count + 1 WHERE id = ${input.id}`);
    return { ok: true };
  }),
  reorderScripts: protectedProcedure.input(z20.object({
    faixa: z20.number().min(1).max(20),
    orderedIds: z20.array(z20.number())
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    await Promise.all(
      input.orderedIds.map(
        (id, index2) => db5.update(crmScripts).set({ ordem: index2 }).where(eq21(crmScripts.id, id))
      )
    );
    return { ok: true };
  }),
  // ─── Faixas de follow-up (dias úteis + etiqueta) ─────────────────────────────
  // Fonte única de verdade para os cortes de dias das 3 faixas de follow-up,
  // consumida por CRM.tsx (colunas/filtro/agenda), ScriptsFaixaPopover.tsx,
  // CRMConfig.tsx e InteligenteClientes.tsx (SecaoTempoFollowUp). Defaults
  // calibrados em setembro/2026 pela distribuição real de dias úteis até o
  // fechamento (calcularTempoOrcamentoPedido): cum. 0-2du≈67%, 0-5du≈79%,
  // 0-10du≈89% dos orçamentos ganhos observados.
  getFaixaEtiquetas: protectedProcedure.query(async () => {
    const db5 = await getDb3();
    const rows = await db5.select().from(crmFaixaEtiquetas).orderBy(crmFaixaEtiquetas.faixa);
    const result = { ...FAIXA_DEFAULTS };
    for (const row of rows) {
      if (row.faixa === 1 || row.faixa === 2 || row.faixa === 3) {
        result[row.faixa] = { faixa: row.faixa, label: row.label, diasInicio: row.diasInicio, diasFim: row.diasFim };
      }
    }
    return result;
  }),
  saveFaixas: protectedProcedure.input(z20.object({
    faixas: z20.array(z20.object({
      faixa: z20.number().int().min(1).max(3),
      label: z20.string().min(1).max(128),
      diasInicio: z20.number().int().min(1),
      diasFim: z20.number().int().min(1)
    })).length(3)
  })).mutation(async ({ input }) => {
    const ordenadas = [...input.faixas].sort((a, b) => a.faixa - b.faixa);
    const faixasVistas = new Set(ordenadas.map((f2) => f2.faixa));
    if (faixasVistas.size !== 3 || ![1, 2, 3].every((f2) => faixasVistas.has(f2))) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "\xC9 necess\xE1rio enviar exatamente as faixas 1, 2 e 3." });
    }
    for (const f2 of ordenadas) {
      if (f2.diasFim < f2.diasInicio) {
        throw new TRPCError4({ code: "BAD_REQUEST", message: `Faixa ${f2.faixa}: o dia final n\xE3o pode ser menor que o dia inicial.` });
      }
    }
    for (let i = 1; i < ordenadas.length; i++) {
      if (ordenadas[i].diasInicio <= ordenadas[i - 1].diasFim) {
        throw new TRPCError4({
          code: "BAD_REQUEST",
          message: `Faixa ${ordenadas[i].faixa} (dia ${ordenadas[i].diasInicio}) n\xE3o pode come\xE7ar antes ou no mesmo dia em que termina a Faixa ${ordenadas[i - 1].faixa} (dia ${ordenadas[i - 1].diasFim}).`
        });
      }
    }
    const db5 = await getDb3();
    for (const f2 of ordenadas) {
      const existing = await db5.select().from(crmFaixaEtiquetas).where(eq21(crmFaixaEtiquetas.faixa, f2.faixa));
      if (existing.length > 0) {
        await db5.update(crmFaixaEtiquetas).set({ label: f2.label, diasInicio: f2.diasInicio, diasFim: f2.diasFim }).where(eq21(crmFaixaEtiquetas.faixa, f2.faixa));
      } else {
        await db5.insert(crmFaixaEtiquetas).values({ faixa: f2.faixa, label: f2.label, diasInicio: f2.diasInicio, diasFim: f2.diasFim });
      }
    }
    return { ok: true };
  }),
  // ─── AUDITORIA DO CRM ────────────────────────────────────────────────────────
  /**
   * Retorna o painel de auditoria completo para um período (data inicial e final).
   * Inclui os 7 blocos: rotina, volume por faixa, descartes, limbo, velocidade suspeita,
   * ranking e diagnóstico.
   */
  getAuditoria: protectedProcedure.input(z20.object({
    dataInicio: z20.string(),
    // ISO date "YYYY-MM-DD"
    dataFim: z20.string(),
    // ISO date "YYYY-MM-DD"
    vendedor: z20.string().optional()
    // undefined = todos
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    const inicio = /* @__PURE__ */ new Date(input.dataInicio + "T03:00:00.000Z");
    const fim = /* @__PURE__ */ new Date(input.dataFim + "T26:59:59.999Z");
    const logsWhere = input.vendedor ? and16(
      sql9`${crmAtividadeLog.realizadaEm} >= ${inicio}`,
      sql9`${crmAtividadeLog.realizadaEm} <= ${fim}`,
      eq21(crmAtividadeLog.vendedor, input.vendedor)
    ) : and16(
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
    const contatosNoPeriodo = await db5.select().from(crmContatos).where(and16(
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
  getLogDia: protectedProcedure.input(z20.object({
    vendedor: z20.string(),
    data: z20.string()
    // "YYYY-MM-DD"
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    const inicio = /* @__PURE__ */ new Date(input.data + "T03:00:00.000Z");
    const fim = /* @__PURE__ */ new Date(input.data + "T26:59:59.999Z");
    const logs = await db5.select().from(crmAtividadeLog).where(and16(
      eq21(crmAtividadeLog.vendedor, input.vendedor),
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

// server/routers/leadsCnpj.ts
init_trpc();
init_db();
init_schema();
init_opencnpj_client();
import { z as z21 } from "zod";
import { eq as eq22, desc as desc11, and as and17 } from "drizzle-orm";

// server/services/qualificacaoLeadCnpj.ts
var CNAES_ALVO = [
  { codigo: "3299-0/03", descricao: "Fabrica\xE7\xE3o de letras, letreiros e placas de qualquer material, exceto luminosos", confianca: "alta" },
  { codigo: "3299-0/04", descricao: "Fabrica\xE7\xE3o de pain\xE9is e letreiros luminosos", confianca: "alta" },
  { codigo: "4329-1/01", descricao: "Instala\xE7\xE3o de pain\xE9is publicit\xE1rios", confianca: "alta" },
  { codigo: "1813-0/01", descricao: "Impress\xE3o de material para uso publicit\xE1rio", confianca: "media" },
  { codigo: "1813-0/99", descricao: "Impress\xE3o de material para outros usos", confianca: "media" },
  { codigo: "7410-2/02", descricao: "Design publicit\xE1rio e gr\xE1fico", confianca: "media" },
  { codigo: "7311-4/00", descricao: "Ag\xEAncias de publicidade", confianca: "media" },
  { codigo: "7319-0/99", descricao: "Outras atividades de publicidade n\xE3o especificadas anteriormente", confianca: "media" }
];
function normalizarCodigoCnae(codigo) {
  return codigo.replace(/\D/g, "");
}
var CNAES_ALVO_NORMALIZADOS = CNAES_ALVO.map((c) => ({ ...c, codigoNorm: normalizarCodigoCnae(c.codigo) }));
function pontosPorte(porte) {
  const p = porte.trim().toLowerCase();
  if (p.includes("demais") || p.includes("grande")) return 100;
  if (p.includes("epp") || p.includes("pequeno porte")) return 80;
  if (p.includes("me") || p.includes("microempresa")) return 40;
  return 40;
}
function parseCapitalSocial(valor) {
  const limpo = valor.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(limpo);
  return isNaN(n) ? 0 : n;
}
function pontosCapitalSocial(valor) {
  if (valor >= 5e5) return 100;
  if (valor >= 1e5) return 70;
  if (valor >= 2e4) return 40;
  return 15;
}
function idadeAnos(dataInicioAtividade, hoje) {
  const d = new Date(dataInicioAtividade);
  if (isNaN(d.getTime())) return 0;
  return (hoje.getTime() - d.getTime()) / (365.25 * 864e5);
}
function pontosIdade(anos) {
  if (anos >= 3) return 100;
  if (anos >= 1) return 60;
  return 30;
}
function letraDaPontuacao(pontos) {
  if (pontos >= 75) return "A";
  if (pontos >= 55) return "B";
  if (pontos >= 35) return "C";
  return "D";
}
function rebaixarLetra(letra) {
  if (letra === "A") return "B";
  if (letra === "B") return "C";
  if (letra === "C") return "D";
  return "D";
}
function qualificarLeadCnpj(dados, hoje = /* @__PURE__ */ new Date()) {
  if ((dados.situacao_cadastral ?? "").trim().toLowerCase() !== "ativa") {
    return {
      aprovado: false,
      motivoRejeicao: `Situa\xE7\xE3o cadastral "${dados.situacao_cadastral}" \u2014 s\xF3 empresas "Ativa" s\xE3o qualificadas.`,
      cnaesRelevantes: [],
      melhorConfianca: null,
      score: null,
      fatoresScore: null
    };
  }
  const todosCnaes = dados.cnaes ?? [];
  const cnaesRelevantes = [];
  for (const cnae of todosCnaes) {
    const codigoNorm = normalizarCodigoCnae(cnae.codigo);
    const alvo = CNAES_ALVO_NORMALIZADOS.find((a) => a.codigoNorm === codigoNorm);
    if (alvo) {
      cnaesRelevantes.push({ codigo: cnae.codigo, descricao: alvo.descricao, confianca: alvo.confianca, isPrincipal: cnae.is_principal });
    }
  }
  if (cnaesRelevantes.length === 0) {
    return {
      aprovado: false,
      motivoRejeicao: "Nenhum CNAE (principal ou secund\xE1rio) corresponde \xE0 lista-alvo de gr\xE1ficas/comunica\xE7\xE3o visual/sinaliza\xE7\xE3o.",
      cnaesRelevantes: [],
      melhorConfianca: null,
      score: null,
      fatoresScore: null
    };
  }
  const melhorConfianca = cnaesRelevantes.some((c) => c.confianca === "alta") ? "alta" : "media";
  const pPorte = pontosPorte(dados.porte_empresa);
  const capitalNum = parseCapitalSocial(dados.capital_social);
  const pCapital = pontosCapitalSocial(capitalNum);
  const anos = idadeAnos(dados.data_inicio_atividade, hoje);
  const pIdade = pontosIdade(anos);
  const pontuacaoBruta = pPorte * 0.4 + pCapital * 0.35 + pIdade * 0.25;
  let letra = letraDaPontuacao(pontuacaoBruta);
  const ajusteConfiancaMedia = melhorConfianca === "media";
  if (ajusteConfiancaMedia) letra = rebaixarLetra(letra);
  return {
    aprovado: true,
    motivoRejeicao: null,
    cnaesRelevantes,
    melhorConfianca,
    score: letra,
    fatoresScore: {
      porte: { valor: dados.porte_empresa, pontos: pPorte, peso: 0.4 },
      capitalSocial: { valorNumerico: capitalNum, pontos: pCapital, peso: 0.35 },
      idadeAnos: { valor: Number(anos.toFixed(1)), pontos: pIdade, peso: 0.25 },
      pontuacaoBruta: Number(pontuacaoBruta.toFixed(1)),
      ajusteConfiancaMedia
    }
  };
}
var VERSAO_PROMPT_LEAD_CNPJ = "v1";
var PROMPT_LEAD_CNPJ_V1 = `Voc\xEA \xE9 um analista de qualifica\xE7\xE3o de leads B2B para uma f\xE1brica de letras met\xE1licas, letras-caixa, letreiros luminosos e fachadas comerciais que vende exclusivamente por terceiriza\xE7\xE3o \u2014 para gr\xE1ficas, ag\xEAncias de comunica\xE7\xE3o visual, bir\xF4s de impress\xE3o e empresas de sinaliza\xE7\xE3o, nunca para o cliente final.

Voc\xEA recebe: os dados cadastrais de uma empresa j\xE1 aprovada pela regra de filtro (situa\xE7\xE3o ativa, CNAE compat\xEDvel) e o score determin\xEDstico (A/B/C/D) j\xE1 calculado pelo sistema, com os fatores que o compuseram. N\xE3o recalcule o score nem invente dados que n\xE3o estejam no JSON fornecido.

Produza tr\xEAs se\xE7\xF5es, curtas e diretas:

1. "Potencial do lead": com base em porte, capital social, idade da empresa e o(s) CNAE(s) que bateram na lista-alvo, estime se a empresa provavelmente compra letreiro em volume alto, m\xE9dio ou baixo \u2014 e diga explicitamente que \xE9 uma estimativa por porte cadastral, n\xE3o um dado de compra real (o sistema n\xE3o tem acesso ao volume de compras dessa empresa).

2. "Argumento de venda B2B": aponte a dor de terceiriza\xE7\xE3o mais prov\xE1vel para o perfil dessa empresa (ex.: uma empresa de instala\xE7\xE3o de pain\xE9is sem CNAE de fabrica\xE7\xE3o provavelmente terceiriza 100% da produ\xE7\xE3o; uma ag\xEAncia de design provavelmente n\xE3o tem estrutura fabril nenhuma; uma gr\xE1fica com CNAE de impress\xE3o publicit\xE1ria pode estar tentando expandir para letreiro sem ter maquin\xE1rio). Formule como uma pergunta ou abertura de conversa, nunca como afirma\xE7\xE3o de fato sobre a empresa espec\xEDfica.

3. "Quem abordar": olhando o QSA, identifique o(s) s\xF3cio(s) com qualifica\xE7\xE3o mais prov\xE1vel de decidir sobre fornecedores (ex.: "Administrador", "S\xF3cio-Administrador", "Diretor") \u2014 se houver mais de um nome plaus\xEDvel, liste todos sem apontar um \xFAnico "respons\xE1vel" fabricado. Se o QSA n\xE3o tiver ningu\xE9m com qualifica\xE7\xE3o decis\xF3ria clara, diga isso e sugira abordar pelo contato institucional da empresa.

Nunca prometa condi\xE7\xF5es comerciais, nunca afirme que a empresa "com certeza" compra ou vai comprar, e nunca trate o score de ader\xEAncia como uma garantia. Separe sempre fato cadastral (o que est\xE1 no JSON) de hip\xF3tese comercial (o que voc\xEA est\xE1 inferindo). Responda em portugu\xEAs do Brasil.`;
function montarMensagemLeadCnpj(dados, resultado) {
  const cadastro = {
    razao_social: dados.razao_social,
    nome_fantasia: dados.nome_fantasia,
    municipio: dados.municipio,
    uf: dados.uf,
    porte_empresa: dados.porte_empresa,
    capital_social: dados.capital_social,
    data_inicio_atividade: dados.data_inicio_atividade,
    natureza_juridica: dados.natureza_juridica,
    QSA: (dados.QSA ?? []).map((s) => ({ nome: s.nome_socio, qualificacao: s.qualificacao_socio, desde: s.data_entrada_sociedade }))
  };
  return JSON.stringify({
    dadosCadastrais: cadastro,
    cnaesQueBateramNaListaAlvo: resultado.cnaesRelevantes,
    scoreCalculado: resultado.score,
    fatoresDoScore: resultado.fatoresScore
  }, null, 2);
}

// server/routers/leadsCnpj.ts
init_llm();
var leadsCnpjRouter = router({
  // ─── Qualificação de Leads por CNPJ ──────────────────────────────────────
  // Ver docs/inteligencia-mercado-leads-cnpj.md. Fonte: OpenCNPJ (gratuita,
  // sem chave). Score é heurística determinística — não é probabilidade de compra.
  consultar: protectedProcedure.input(z21.object({ cnpj: z21.string().min(11) })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const cnpjLimpo = normalizarCnpj(input.cnpj);
    let dados;
    try {
      dados = await consultarCnpj(cnpjLimpo);
    } catch (e) {
      if (e instanceof CnpjNaoEncontradoError) throw new Error(e.message);
      throw e;
    }
    const resultado = qualificarLeadCnpj(dados);
    const agora = /* @__PURE__ */ new Date();
    let resumoIa = null;
    if (resultado.aprovado) {
      try {
        const resp = await invokeLLM({
          messages: [
            { role: "system", content: PROMPT_LEAD_CNPJ_V1 },
            { role: "user", content: montarMensagemLeadCnpj(dados, resultado) }
          ]
        });
        const conteudo = resp.choices?.[0]?.message?.content;
        resumoIa = typeof conteudo === "string" ? conteudo : null;
      } catch {
        resumoIa = null;
      }
    }
    const valores = {
      cnpj: cnpjLimpo,
      razaoSocial: dados.razao_social,
      nomeFantasia: dados.nome_fantasia || null,
      uf: dados.uf || null,
      municipio: dados.municipio || null,
      cnaePrincipal: dados.cnae_principal || null,
      situacaoCadastral: dados.situacao_cadastral || null,
      porte: dados.porte_empresa || null,
      capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
      dataInicioAtividade: dados.data_inicio_atividade || null,
      aprovado: resultado.aprovado,
      score: resultado.score,
      motivoRejeicao: resultado.motivoRejeicao,
      cnaesRelevantesJson: JSON.stringify(resultado.cnaesRelevantes),
      fatoresScoreJson: resultado.fatoresScore ? JSON.stringify(resultado.fatoresScore) : null,
      qsaJson: JSON.stringify(dados.QSA ?? []),
      dadosJson: JSON.stringify(dados),
      resumoIa,
      versaoPromptIa: resumoIa ? VERSAO_PROMPT_LEAD_CNPJ : null,
      consultadoPor: ctx.user?.name ?? ctx.user?.id ?? "desconhecido",
      consultadoEm: agora,
      updatedAt: agora
    };
    const existente = await db5.select({ id: leadsCnpjQualificados.id }).from(leadsCnpjQualificados).where(eq22(leadsCnpjQualificados.cnpj, cnpjLimpo)).limit(1);
    if (existente.length > 0) {
      await db5.update(leadsCnpjQualificados).set(valores).where(eq22(leadsCnpjQualificados.cnpj, cnpjLimpo));
    } else {
      await db5.insert(leadsCnpjQualificados).values(valores);
    }
    return { dados, resultado, resumoIa };
  }),
  listar: protectedProcedure.input(z21.object({
    score: z21.enum(["A", "B", "C", "D"]).optional(),
    uf: z21.string().length(2).optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const filtros = [];
    if (input.score) filtros.push(eq22(leadsCnpjQualificados.score, input.score));
    if (input.uf) filtros.push(eq22(leadsCnpjQualificados.uf, input.uf));
    const rows = await db5.select().from(leadsCnpjQualificados).where(filtros.length > 0 ? and17(...filtros) : void 0).orderBy(desc11(leadsCnpjQualificados.consultadoEm));
    return rows.map((r) => ({
      ...r,
      cnaesRelevantes: r.cnaesRelevantesJson ? JSON.parse(r.cnaesRelevantesJson) : [],
      fatoresScore: r.fatoresScoreJson ? JSON.parse(r.fatoresScoreJson) : null,
      qsa: r.qsaJson ? JSON.parse(r.qsaJson) : []
    }));
  })
});

// server/routers/perfilClientesCnpj.ts
init_trpc();
init_db();
init_schema();
init_opencnpj_client();
init_mubisys_client();
init_performanceComercial();
import { z as z22 } from "zod";
import { eq as eq23 } from "drizzle-orm";

// server/services/perfilClienteCnpj.ts
function contarDistribuicao(valores, topN) {
  const total = valores.filter((v) => v !== null).length;
  const contagem = /* @__PURE__ */ new Map();
  for (const v of valores) {
    if (v === null) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  let entradas = [...contagem.entries()].map(([chave, quantidade]) => ({ chave, quantidade, pct: total > 0 ? quantidade / total * 100 : 0 }));
  entradas.sort((a, b) => b.quantidade - a.quantidade);
  if (topN) entradas = entradas.slice(0, topN);
  return entradas;
}
function calcularPerfilAgregado(perfis, totalClientesBase) {
  const totalMapeados = perfis.length;
  const comIdade = perfis.filter((p) => p.idadeAnos !== null);
  const maior3Anos = comIdade.filter((p) => Number(p.idadeAnos) >= 3).length;
  const comSocios = perfis.filter((p) => p.qtdSocios !== null);
  const doisOuMaisSocios = comSocios.filter((p) => (p.qtdSocios ?? 0) >= 2).length;
  const faixasIdade = [
    { chave: "menos de 1 ano", min: 0, max: 1 },
    { chave: "1 a 3 anos", min: 1, max: 3 },
    { chave: "3 a 10 anos", min: 3, max: 10 },
    { chave: "10+ anos", min: 10, max: Infinity }
  ];
  const distribuicaoIdade = faixasIdade.map((f2) => {
    const qtd = comIdade.filter((p) => {
      const a = Number(p.idadeAnos);
      return a >= f2.min && a < f2.max;
    }).length;
    return { chave: f2.chave, quantidade: qtd, pct: comIdade.length > 0 ? qtd / comIdade.length * 100 : 0 };
  });
  return {
    totalClientesBase,
    totalMapeados,
    coberturaPct: totalClientesBase > 0 ? totalMapeados / totalClientesBase * 100 : 0,
    pctIdadeMaior3Anos: comIdade.length > 0 ? maior3Anos / comIdade.length * 100 : null,
    pctDoisOuMaisSocios: comSocios.length > 0 ? doisOuMaisSocios / comSocios.length * 100 : null,
    distribuicaoPorte: contarDistribuicao(perfis.map((p) => p.porte)),
    distribuicaoNaturezaJuridica: contarDistribuicao(perfis.map((p) => p.naturezaJuridica), 8),
    distribuicaoUf: contarDistribuicao(perfis.map((p) => p.uf), 8),
    distribuicaoIdade
  };
}

// server/routers/perfilClientesCnpj.ts
function parseDataOsFlexivel(s) {
  if (!s) return null;
  const texto = s.trim();
  const br = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return new Date(Number(br[3]), Number(br[2]) - 1, Number(br[1]));
  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  return null;
}
function classificarDocumento(doc) {
  const limpo = doc.replace(/\D/g, "");
  if (limpo.length === 14) return { tipo: "cnpj", limpo };
  if (limpo.length === 11) return { tipo: "cpf", limpo };
  return { tipo: "invalido", limpo };
}
function extrairCamposPerfil(dados) {
  const idadeAnos2 = (() => {
    const d = new Date(dados.data_inicio_atividade);
    if (isNaN(d.getTime())) return null;
    return Number(((Date.now() - d.getTime()) / (365.25 * 864e5)).toFixed(1));
  })();
  return {
    razaoSocial: dados.razao_social,
    situacaoCadastral: dados.situacao_cadastral || null,
    dataInicioAtividade: dados.data_inicio_atividade || null,
    idadeAnos: idadeAnos2 !== null ? String(idadeAnos2) : null,
    porte: dados.porte_empresa || null,
    naturezaJuridica: dados.natureza_juridica || null,
    qtdSocios: Array.isArray(dados.QSA) ? dados.QSA.length : null,
    capitalSocial: dados.capital_social ? dados.capital_social.replace(/\./g, "").replace(",", ".") : null,
    uf: dados.uf || null,
    municipio: dados.municipio || null,
    cnaePrincipal: dados.cnae_principal || null,
    dadosJson: JSON.stringify(dados)
  };
}
var perfilClientesCnpjRouter = router({
  // ─── Perfil de Clientes por CNPJ (Inteligência de Clientes) ──────────────
  // Enriquecimento manual/semi-automático — ver server/services/perfilClienteCnpj.ts
  // e a nota de limitação na definição de clientesPerfilCnpj (drizzle/schema.ts).
  getPerfilAgregado: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [perfis, osRows] = await Promise.all([
      db5.select().from(clientesPerfilCnpj),
      db5.select({ empresa: historicoOs.empresa, tipoOs: historicoOs.tipoOs, status: historicoOs.status }).from(historicoOs)
    ]);
    const clientesDistintos = /* @__PURE__ */ new Set();
    for (const r of osRows) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (nome) clientesDistintos.add(normalizeEmpresaKey(nome));
    }
    return calcularPerfilAgregado(perfis, clientesDistintos.size);
  }),
  listarPerfis: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    return db5.select().from(clientesPerfilCnpj).orderBy(clientesPerfilCnpj.empresaExibicao);
  }),
  /** Clientes da base (historico_os) ainda sem perfil de CNPJ vinculado —
   * ordenados por valor histórico comprado (prioriza enriquecer quem mais
   * compra). Filtro opcional por data: só considera quem comprou dentro da
   * janela informada (aplicado à data de aprovação da OS). */
  listarClientesSemCnpj: publicProcedure.input(z22.object({
    limite: z22.number().min(1).max(500).default(100),
    dataInicial: z22.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dataFinal: z22.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [osRows, mapeados] = await Promise.all([
      db5.select({
        empresa: historicoOs.empresa,
        tipoOs: historicoOs.tipoOs,
        status: historicoOs.status,
        valorTotal: historicoOs.valorTotal,
        valorOs: historicoOs.valorOs,
        osNumero: historicoOs.osNumero,
        dataAprovacao: historicoOs.dataAprovacao
      }).from(historicoOs),
      db5.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj)
    ]);
    const jaMapeados = new Set(mapeados.map((m) => m.empresaKey));
    const dataIni = input.dataInicial ? new Date(input.dataInicial) : null;
    const dataFim = input.dataFinal ? /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`) : null;
    const porCliente = /* @__PURE__ */ new Map();
    for (const r of osRows) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (!nome) continue;
      const dataOs = parseDataOsFlexivel(r.dataAprovacao);
      if (dataIni && (!dataOs || dataOs < dataIni)) continue;
      if (dataFim && (!dataOs || dataOs > dataFim)) continue;
      const key = normalizeEmpresaKey(nome);
      if (jaMapeados.has(key)) continue;
      const valor = parseFloat(String(r.valorOs ?? r.valorTotal ?? "0")) || 0;
      const atual = porCliente.get(key) ?? { empresa: nome, valor: 0, osMaisRecente: null, dataMaisRecente: null };
      atual.valor += valor;
      if (r.osNumero && dataOs && (!atual.dataMaisRecente || dataOs > atual.dataMaisRecente)) {
        atual.osMaisRecente = r.osNumero;
        atual.dataMaisRecente = dataOs;
      }
      porCliente.set(key, atual);
    }
    return [...porCliente.entries()].map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, valorHistorico: v.valor, osReferencia: v.osMaisRecente })).sort((a, b) => b.valorHistorico - a.valorHistorico).slice(0, input.limite);
  }),
  /** Vincula um CNPJ a um cliente manualmente — consulta a OpenCNPJ e grava o perfil. */
  vincularCnpj: protectedProcedure.input(z22.object({ empresaKey: z22.string().min(1), empresaExibicao: z22.string().min(1), cnpj: z22.string().min(11) })).mutation(async ({ ctx, input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const cnpjLimpo = normalizarCnpj(input.cnpj);
    let dados;
    try {
      dados = await consultarCnpj(cnpjLimpo);
    } catch (e) {
      if (e instanceof CnpjNaoEncontradoError) throw new Error(e.message);
      throw e;
    }
    const campos = extrairCamposPerfil(dados);
    const agora = /* @__PURE__ */ new Date();
    const valores = {
      empresaKey: input.empresaKey,
      empresaExibicao: input.empresaExibicao,
      cnpj: cnpjLimpo,
      ...campos,
      origem: "manual",
      vinculadoPor: ctx.user?.name ?? ctx.user?.id ?? "desconhecido",
      vinculadoEm: agora,
      updatedAt: agora
    };
    const existente = await db5.select({ id: clientesPerfilCnpj.id }).from(clientesPerfilCnpj).where(eq23(clientesPerfilCnpj.empresaKey, input.empresaKey)).limit(1);
    if (existente.length > 0) {
      await db5.update(clientesPerfilCnpj).set(valores).where(eq23(clientesPerfilCnpj.empresaKey, input.empresaKey));
    } else {
      await db5.insert(clientesPerfilCnpj).values(valores);
    }
    return { ok: true, dados };
  }),
  /** Backfill automático a partir de erp_os_cache (cache de outra funcionalidade,
   * cotação de frete, que por acaso guarda CNPJ) — cobre uma fração pequena da
   * carteira (só quem já teve cotação de frete gerada), mas é dado real já
   * disponível, sem custo. Roda sequencialmente com tolerância a falha por item. */
  sincronizarDeErpCache: protectedProcedure.mutation(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [cacheRows, mapeados] = await Promise.all([
      db5.select({ razaoSocial: erpOsCache.razaoSocial, cnpj: erpOsCache.cnpj }).from(erpOsCache),
      db5.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj)
    ]);
    const jaMapeados = new Set(mapeados.map((m) => m.empresaKey));
    const candidatos = /* @__PURE__ */ new Map();
    for (const r of cacheRows) {
      if (!r.razaoSocial || !r.cnpj) continue;
      const key = normalizeEmpresaKey(r.razaoSocial);
      if (jaMapeados.has(key) || candidatos.has(key)) continue;
      candidatos.set(key, { empresa: r.razaoSocial, cnpj: r.cnpj });
    }
    let sucesso = 0, falha = 0;
    const agora = /* @__PURE__ */ new Date();
    for (const [empresaKey, c] of candidatos) {
      try {
        const cnpjLimpo = normalizarCnpj(c.cnpj);
        const dados = await consultarCnpj(cnpjLimpo);
        const campos = extrairCamposPerfil(dados);
        await db5.insert(clientesPerfilCnpj).values({
          empresaKey,
          empresaExibicao: c.empresa,
          cnpj: cnpjLimpo,
          ...campos,
          origem: "erp_os_cache",
          vinculadoEm: agora,
          updatedAt: agora
        });
        sucesso++;
      } catch {
        falha++;
      }
    }
    return { tentativas: candidatos.size, sucesso, falha };
  }),
  /** Preenche CNPJ automaticamente consultando a API AO VIVO do MubiSys: cada
   * OS já traz `cliente_cnpj_cpf` (confirmado em docs/integracao-mubisys.md).
   * Para cada cliente candidato, busca uma OS de referência dele e lê o
   * documento direto do ERP — sem precisar digitar nada manualmente. Clientes
   * pessoa física (CPF, 11 dígitos) são pulados: OpenCNPJ só cobre CNPJ.
   * Processa em lote pequeno (a API do MubiSys é lenta/instável, ver
   * docs/integracao-mubisys.md) — clique de novo para continuar o restante. */
  enriquecerViaMubisys: protectedProcedure.input(z22.object({
    limite: z22.number().min(1).max(30).default(15),
    dataInicial: z22.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dataFinal: z22.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
  })).mutation(async ({ input, ctx }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [osRows, mapeados] = await Promise.all([
      db5.select({
        empresa: historicoOs.empresa,
        tipoOs: historicoOs.tipoOs,
        status: historicoOs.status,
        valorTotal: historicoOs.valorTotal,
        valorOs: historicoOs.valorOs,
        osNumero: historicoOs.osNumero,
        dataAprovacao: historicoOs.dataAprovacao
      }).from(historicoOs),
      db5.select({ empresaKey: clientesPerfilCnpj.empresaKey }).from(clientesPerfilCnpj)
    ]);
    const jaMapeados = new Set(mapeados.map((m) => m.empresaKey));
    const dataIni = input.dataInicial ? new Date(input.dataInicial) : null;
    const dataFim = input.dataFinal ? /* @__PURE__ */ new Date(`${input.dataFinal}T23:59:59`) : null;
    const porCliente = /* @__PURE__ */ new Map();
    for (const r of osRows) {
      if (!isOsNormalDb(r)) continue;
      const nome = (r.empresa ?? "").trim();
      if (!nome) continue;
      const dataOs = parseDataOsFlexivel(r.dataAprovacao);
      if (dataIni && (!dataOs || dataOs < dataIni)) continue;
      if (dataFim && (!dataOs || dataOs > dataFim)) continue;
      const key = normalizeEmpresaKey(nome);
      if (jaMapeados.has(key)) continue;
      const valor = parseFloat(String(r.valorOs ?? r.valorTotal ?? "0")) || 0;
      const atual = porCliente.get(key) ?? { empresa: nome, valor: 0, osMaisRecente: null, dataMaisRecente: null };
      atual.valor += valor;
      if (r.osNumero && dataOs && (!atual.dataMaisRecente || dataOs > atual.dataMaisRecente)) {
        atual.osMaisRecente = r.osNumero;
        atual.dataMaisRecente = dataOs;
      }
      porCliente.set(key, atual);
    }
    const candidatos = [...porCliente.entries()].map(([empresaKey, v]) => ({ empresaKey, empresa: v.empresa, osReferencia: v.osMaisRecente })).filter((c) => !!c.osReferencia).sort((a, b) => porCliente.get(b.empresaKey).valor - porCliente.get(a.empresaKey).valor).slice(0, input.limite);
    let sucessoCnpj = 0, pessoaFisica = 0, semDocumento = 0, falhaErp = 0, falhaOpenCnpj = 0;
    const agora = /* @__PURE__ */ new Date();
    for (const c of candidatos) {
      let osErp;
      try {
        osErp = await buscarOSPorNumero(c.osReferencia);
      } catch {
        falhaErp++;
        continue;
      }
      const doc = osErp?.cliente_cnpj_cpf;
      if (!doc) {
        semDocumento++;
        continue;
      }
      const { tipo, limpo } = classificarDocumento(doc);
      if (tipo === "cpf") {
        pessoaFisica++;
        continue;
      }
      if (tipo === "invalido") {
        semDocumento++;
        continue;
      }
      try {
        const dados = await consultarCnpj(limpo);
        const campos = extrairCamposPerfil(dados);
        await db5.insert(clientesPerfilCnpj).values({
          empresaKey: c.empresaKey,
          empresaExibicao: c.empresa,
          cnpj: limpo,
          ...campos,
          origem: "mubisys",
          vinculadoPor: ctx.user?.name ?? ctx.user?.id ?? "sistema",
          vinculadoEm: agora,
          updatedAt: agora
        });
        sucessoCnpj++;
      } catch {
        falhaOpenCnpj++;
      }
    }
    return {
      totalCandidatos: candidatos.length,
      sucessoCnpj,
      pessoaFisica,
      semDocumento,
      falhaErp,
      falhaOpenCnpj,
      restantes: Math.max(0, [...porCliente.keys()].length - candidatos.length)
    };
  })
});

// server/routers/planosAcaoComercial.ts
init_trpc();
init_db();
init_schema();
import { z as z23 } from "zod";
import { eq as eq24, desc as desc12 } from "drizzle-orm";
var planosAcaoComercialRouter = router({
  listar: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    return db5.select().from(planosAcaoComercial).orderBy(desc12(planosAcaoComercial.createdAt));
  }),
  criar: protectedProcedure.input(z23.object({
    titulo: z23.string().min(1),
    descricao: z23.string().optional(),
    responsavel: z23.string().optional(),
    prazo: z23.string().optional(),
    // YYYY-MM-DD
    prioridade: z23.enum(["baixa", "media", "alta", "critica"]).default("media")
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const [row] = await db5.insert(planosAcaoComercial).values(input).returning();
    return row;
  }),
  atualizar: protectedProcedure.input(z23.object({
    id: z23.number(),
    status: z23.enum(["pendente", "em_andamento", "concluido", "cancelado"]).optional(),
    prioridade: z23.enum(["baixa", "media", "alta", "critica"]).optional(),
    responsavel: z23.string().nullable().optional(),
    prazo: z23.string().nullable().optional(),
    observacoes: z23.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...campos } = input;
    await db5.update(planosAcaoComercial).set({ ...campos, updatedAt: /* @__PURE__ */ new Date() }).where(eq24(planosAcaoComercial.id, id));
    return { ok: true };
  }),
  excluir: protectedProcedure.input(z23.object({ id: z23.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(planosAcaoComercial).where(eq24(planosAcaoComercial.id, input.id));
    return { ok: true };
  })
});

// server/routers/radarMercado.ts
init_trpc();
init_db();
init_schema();
import { z as z24 } from "zod";
import crypto from "crypto";
import { eq as eq25, and as and18, desc as desc13 } from "drizzle-orm";

// server/integrations/serpapi-client.ts
init_env();
function buscaConfigurada() {
  return !!ENV.serpapiKey;
}
async function buscarNaWeb(query, num2 = 10) {
  if (!buscaConfigurada()) {
    throw new Error("Radar de Mercado sem busca configurada \u2014 defina SERPAPI_KEY (ver .env.example).");
  }
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("api_key", ENV.serpapiKey);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(Math.min(num2, 10)));
  url.searchParams.set("gl", "br");
  url.searchParams.set("hl", "pt");
  let resp;
  try {
    resp = await fetch(url.toString());
  } catch (e) {
    throw new Error(`Falha de rede ao consultar o SerpAPI: ${e?.message ?? "erro desconhecido"}`);
  }
  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`SerpAPI retornou status ${resp.status}: ${corpo.slice(0, 300)}`);
  }
  const json = await resp.json();
  if (json.error) throw new Error(`SerpAPI: ${json.error}`);
  const items = Array.isArray(json.organic_results) ? json.organic_results : [];
  return items.map((i) => ({
    title: i.title ?? "",
    link: i.link ?? "",
    snippet: i.snippet ?? "",
    displayLink: i.displayed_link ?? (i.link ? new URL(i.link).hostname : "")
  }));
}

// server/routers/radarMercado.ts
init_llm();
var UFS_PADRAO = ["MS", "MT", "GO", "DF", "MG", "SP", "RJ", "ES", "PR", "SC", "RS"];
var SEGMENTOS_PADRAO = ["Gr\xE1ficas", "Comunica\xE7\xE3o visual", "Sinaliza\xE7\xE3o"];
var TERMOS_BUSCA_PADRAO = [
  "gr\xE1fica nova inaugura\xE7\xE3o",
  "empresa de comunica\xE7\xE3o visual inaugura\xE7\xE3o",
  "gr\xE1fica r\xE1pida abre loja",
  "edital licita\xE7\xE3o sinaliza\xE7\xE3o comunica\xE7\xE3o visual"
];
async function carregarConfig(db5) {
  const rows = await db5.select().from(radarMercadoConfig).where(eq25(radarMercadoConfig.id, 1)).limit(1);
  if (rows.length === 0) {
    const [row] = await db5.insert(radarMercadoConfig).values({
      id: 1,
      regioesJson: JSON.stringify(UFS_PADRAO),
      segmentosAlvoJson: JSON.stringify(SEGMENTOS_PADRAO),
      termosBuscaJson: JSON.stringify(TERMOS_BUSCA_PADRAO)
    }).returning();
    return row;
  }
  return rows[0];
}
function parseConfig(row) {
  return {
    regioes: JSON.parse(row.regioesJson),
    segmentosAlvo: JSON.parse(row.segmentosAlvoJson),
    concorrentesConhecidos: JSON.parse(row.concorrentesConhecidosJson),
    termosBusca: JSON.parse(row.termosBuscaJson),
    exclusoes: JSON.parse(row.exclusoesJson),
    updatedAt: row.updatedAt
  };
}
function hashUrl(url) {
  return crypto.createHash("sha256").update(url).digest("hex");
}
var MAX_ITENS_POR_EXECUCAO = 20;
var radarMercadoRouter = router({
  buscaConfigurada: publicProcedure.query(() => ({ configurada: buscaConfigurada() })),
  getConfig: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    return parseConfig(await carregarConfig(db5));
  }),
  atualizarConfig: protectedProcedure.input(z24.object({
    regioes: z24.array(z24.string()).optional(),
    segmentosAlvo: z24.array(z24.string()).optional(),
    concorrentesConhecidos: z24.array(z24.string()).optional(),
    termosBusca: z24.array(z24.string()).optional(),
    exclusoes: z24.array(z24.string()).optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await carregarConfig(db5);
    const set = { updatedAt: /* @__PURE__ */ new Date() };
    if (input.regioes) set.regioesJson = JSON.stringify(input.regioes);
    if (input.segmentosAlvo) set.segmentosAlvoJson = JSON.stringify(input.segmentosAlvo);
    if (input.concorrentesConhecidos) set.concorrentesConhecidosJson = JSON.stringify(input.concorrentesConhecidos);
    if (input.termosBusca) set.termosBuscaJson = JSON.stringify(input.termosBusca);
    if (input.exclusoes) set.exclusoesJson = JSON.stringify(input.exclusoes);
    await db5.update(radarMercadoConfig).set(set).where(eq25(radarMercadoConfig.id, 1));
    return { ok: true };
  }),
  listarSinais: publicProcedure.input(z24.object({
    status: z24.enum(["novo", "qualificando", "oportunidade", "associado_cliente", "descartado", "expirado"]).optional(),
    uf: z24.string().length(2).optional()
  })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const filtros = [];
    if (input.status) filtros.push(eq25(sinaisMercado.status, input.status));
    if (input.uf) filtros.push(eq25(sinaisMercado.uf, input.uf));
    return db5.select().from(sinaisMercado).where(filtros.length > 0 ? and18(...filtros) : void 0).orderBy(desc13(sinaisMercado.dataColeta));
  }),
  atualizarSinal: protectedProcedure.input(z24.object({
    id: z24.number(),
    status: z24.enum(["novo", "qualificando", "oportunidade", "associado_cliente", "descartado", "expirado"]).optional(),
    proximoPasso: z24.string().nullable().optional(),
    jaClienteEmpresaKey: z24.string().nullable().optional()
  })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    const { id, ...campos } = input;
    await db5.update(sinaisMercado).set({ ...campos, updatedAt: /* @__PURE__ */ new Date() }).where(eq25(sinaisMercado.id, id));
    return { ok: true };
  }),
  /** Roda a busca configurada, extrai sinais estruturados via IA e grava os
   * novos (deduplicados por URL). Nunca inventa dado — descarta resultado que
   * a IA classificar como não relacionado ao nosso catálogo/segmento. */
  buscarSinais: protectedProcedure.mutation(async () => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    if (!buscaConfigurada()) {
      throw new Error("Radar sem busca configurada \u2014 falta SERPAPI_KEY no servidor (ver .env.example).");
    }
    const config = parseConfig(await carregarConfig(db5));
    const existentes = new Set((await db5.select({ urlHash: sinaisMercado.urlHash }).from(sinaisMercado)).map((r) => r.urlHash));
    let resultadosBrutos = 0, novosResultados = 0, salvos = 0, ignorados = 0;
    const erros = [];
    for (const termo of config.termosBusca) {
      if (novosResultados >= MAX_ITENS_POR_EXECUCAO) break;
      let itens;
      try {
        itens = await buscarNaWeb(termo, 10);
      } catch (e) {
        erros.push(`${termo}: ${e?.message ?? "erro na busca"}`);
        continue;
      }
      resultadosBrutos += itens.length;
      for (const item of itens) {
        if (novosResultados >= MAX_ITENS_POR_EXECUCAO) break;
        const hash = hashUrl(item.link);
        if (existentes.has(hash)) continue;
        existentes.add(hash);
        novosResultados++;
        const dominioExcluido = config.exclusoes.some((ex) => item.displayLink.includes(ex) || item.link.includes(ex));
        if (dominioExcluido) {
          ignorados++;
          continue;
        }
        try {
          const resp = await invokeLLM({
            messages: [
              {
                role: "system",
                content: `Voc\xEA extrai sinais comerciais de resultados de busca para uma f\xE1brica de letras/letreiros/fachadas que vende por terceiriza\xE7\xE3o para gr\xE1ficas e empresas de comunica\xE7\xE3o visual, nas regi\xF5es Centro-Oeste, Sudeste e Sul do Brasil. Analise o t\xEDtulo e trecho fornecidos. Marque relevante=false se n\xE3o tiver rela\xE7\xE3o plaus\xEDvel com esse contexto (ex: not\xEDcia gen\xE9rica sem rela\xE7\xE3o, empresa de outro ramo, fora das regi\xF5es-alvo quando identific\xE1vel). Nunca invente dados que n\xE3o estejam no texto \u2014 campos desconhecidos ficam null. nivelConfianca="confirmado" s\xF3 se o trecho afirma o fato diretamente (n\xE3o infer\xEAncia sua); sen\xE3o "inferencia".`
              },
              { role: "user", content: `T\xEDtulo: ${item.title}
Trecho: ${item.snippet}
URL: ${item.link}
Site: ${item.displayLink}
Termo de busca que trouxe este resultado: ${termo}` }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "sinal_mercado",
                strict: true,
                schema: {
                  type: "object",
                  properties: {
                    relevante: { type: "boolean" },
                    empresa: { type: ["string", "null"] },
                    uf: { type: ["string", "null"] },
                    municipio: { type: ["string", "null"] },
                    tipoEvento: { type: ["string", "null"], enum: ["inauguracao", "reforma", "expansao", "edital", "concorrente", "outro", null] },
                    relacaoProdutos: { type: ["string", "null"] },
                    nivelConfianca: { type: "string", enum: ["confirmado", "inferencia"] }
                  },
                  required: ["relevante", "empresa", "uf", "municipio", "tipoEvento", "relacaoProdutos", "nivelConfianca"],
                  additionalProperties: false
                }
              }
            }
          });
          const conteudo = resp.choices?.[0]?.message?.content;
          const extraido = JSON.parse(typeof conteudo === "string" ? conteudo : "{}");
          if (!extraido.relevante) {
            ignorados++;
            continue;
          }
          await db5.insert(sinaisMercado).values({
            empresa: extraido.empresa ?? item.title,
            localizacaoTexto: [extraido.municipio, extraido.uf].filter(Boolean).join("/") || null,
            uf: extraido.uf ?? null,
            municipio: extraido.municipio ?? null,
            tipoEvento: extraido.tipoEvento ?? "outro",
            evidenciaTrecho: item.snippet,
            url: item.link,
            urlHash: hash,
            publicador: item.displayLink,
            nivelConfianca: extraido.nivelConfianca === "confirmado" ? "confirmado" : "inferencia",
            relacaoProdutos: extraido.relacaoProdutos ?? null,
            termoBuscaOrigem: termo,
            status: "novo"
          });
          salvos++;
        } catch (e) {
          erros.push(`${item.link}: ${e?.message ?? "falha ao processar"}`);
          ignorados++;
        }
      }
    }
    return { resultadosBrutos, novosResultados, salvos, ignorados, erros };
  })
});

// server/routers/custoLed.ts
init_trpc();
init_db();
init_schema();
import { z as z25 } from "zod";
import { eq as eq26, and as and19 } from "drizzle-orm";
var custoLedRouter = router({
  // Listar todos os tipos de LED ativos
  listTipos: publicProcedure.query(async () => {
    const db5 = await getDb3();
    if (!db5) return [];
    return db5.select().from(ledTipos).orderBy(ledTipos.nome);
  }),
  // Criar ou atualizar tipo de LED
  upsertTipo: protectedProcedure.input(z25.object({
    id: z25.number().optional(),
    nome: z25.string().min(1),
    descricao: z25.string().optional(),
    custoUnitario: z25.number().min(0),
    unidade: z25.string().default("un"),
    ativo: z25.enum(["sim", "nao"]).default("sim")
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
      await db5.update(ledTipos).set(payload).where(eq26(ledTipos.id, id));
      return { ok: true, id };
    } else {
      const [res] = await db5.insert(ledTipos).values(payload).returning({ id: ledTipos.id });
      return { ok: true, id: res.id };
    }
  }),
  // Excluir tipo de LED
  deleteTipo: protectedProcedure.input(z25.object({ id: z25.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(ledTipos).where(eq26(ledTipos.id, input.id));
    return { ok: true };
  }),
  // ─── Lançamentos de custo de LED por OS ──────────────────────────────────────
  // Listar lançamentos de um mês/ano
  listLancamentos: publicProcedure.input(z25.object({ mes: z25.number(), ano: z25.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return [];
    const rows = await db5.select().from(custoLedLancamentos).where(and19(
      eq26(custoLedLancamentos.mes, input.mes),
      eq26(custoLedLancamentos.ano, input.ano)
    )).orderBy(custoLedLancamentos.os, custoLedLancamentos.createdAt);
    return rows;
  }),
  // Criar ou atualizar lançamento
  upsertLancamento: protectedProcedure.input(z25.object({
    id: z25.number().optional(),
    os: z25.string().min(1),
    ledTipoId: z25.number(),
    ledTipoEfetivoId: z25.number().nullable().optional(),
    qtdPrevista: z25.number().min(0),
    qtdEfetiva: z25.number().min(0).nullable().optional(),
    mes: z25.number().min(1).max(12),
    ano: z25.number(),
    observacao: z25.string().optional()
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
      await db5.update(custoLedLancamentos).set(payload).where(eq26(custoLedLancamentos.id, id));
      return { ok: true, id };
    } else {
      const [res] = await db5.insert(custoLedLancamentos).values(payload).returning({ id: custoLedLancamentos.id });
      return { ok: true, id: res.id };
    }
  }),
  // Excluir lançamento
  deleteLancamento: protectedProcedure.input(z25.object({ id: z25.number() })).mutation(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) throw new Error("DB indispon\xEDvel");
    await db5.delete(custoLedLancamentos).where(eq26(custoLedLancamentos.id, input.id));
    return { ok: true };
  }),
  // Resumo mensal: total previsto, efetivo, diferença (por tipo de LED)
  getResumoMensal: publicProcedure.input(z25.object({ mes: z25.number(), ano: z25.number() })).query(async ({ input }) => {
    const db5 = await getDb3();
    if (!db5) return { lancamentos: [], tipos: [], totalPrevisto: 0, totalEfetivo: 0, diferenca: 0 };
    const [lancamentos, tipos] = await Promise.all([
      db5.select().from(custoLedLancamentos).where(and19(
        eq26(custoLedLancamentos.mes, input.mes),
        eq26(custoLedLancamentos.ano, input.ano)
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
init_trpc();
init_mubisys_client();
import { z as z26 } from "zod";
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
    z26.object({
      dias: z26.number().min(1).max(31).optional(),
      offset: z26.number().min(0).max(365).optional()
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
  obterHistoricoSincronizacoes: adminProcedure.input(z26.object({ limite: z26.number().default(10) })).query(async ({ input }) => {
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
import { z as z27 } from "zod";

// server/_core/notification.ts
import { TRPCError as TRPCError5 } from "@trpc/server";
var TITLE_MAX_LENGTH = 256;
var CONTENT_MAX_LENGTH = 2e4;
var trimValue = (value) => value.trim();
var isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
var validatePayload = (input) => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: "Notification title is required."
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: "Notification content is required."
    });
  }
  const title = trimValue(input.title);
  const content = trimValue(input.content);
  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError5({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`
    });
  }
  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError5({
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
init_trpc();
var systemRouter = router({
  health: publicProcedure.input(
    z27.object({
      timestamp: z27.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  })),
  notifyOwner: adminProcedure.input(
    z27.object({
      title: z27.string().min(1, "title is required"),
      content: z27.string().min(1, "content is required")
    })
  ).mutation(async ({ input }) => {
    const delivered = await notifyOwner(input);
    return {
      success: delivered
    };
  })
});

// server/routers.ts
init_trpc();
init_auth();
init_llm();
init_schema();
init_db();
init_db();
init_db();
import { fromNodeHeaders } from "better-auth/node";
import { TRPCError as TRPCError6 } from "@trpc/server";
import { asc as asc6, eq as eq27, isNull as isNull2, or as or2, count as sqlCount } from "drizzle-orm";
async function countUsers() {
  const db5 = await getDb3();
  if (!db5) return 0;
  const [row] = await db5.select({ n: sqlCount() }).from(user);
  return row?.n ?? 0;
}
function assertAdminOrMaster(ctx) {
  if (!ctx.user || ctx.user.role !== "admin" && ctx.user.role !== "master") {
    throw new TRPCError6({ code: "FORBIDDEN", message: "Apenas Admin ou Master podem gerenciar usu\xE1rios." });
  }
}
function slugifyName(name) {
  const slug = name.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return slug || "usuario";
}
var filterSchema = z28.object({
  mes: z28.string().optional(),
  setor: z28.string().optional(),
  tipo: z28.string().optional(),
  responsavel: z28.string().optional(),
  classe: z28.string().optional(),
  dataInicio: z28.date().optional(),
  dataFim: z28.date().optional(),
  search: z28.string().optional(),
  tipoRegistro: z28.enum(["retrabalho", "cnq"]).optional()
});
var appRouter = router({
  system: systemRouter,
  // Painel "Status de Sincronização ERP" (cache de OS dos últimos 30 dias + logs)
  admin: adminRouter,
  // ─── Error Library ──────────────────────────────────────────────────────
  errorLibrary: router({
    list: publicProcedure.query(() => getErrorLibrary()),
    byCode: publicProcedure.input(z28.object({ code: z28.string() })).query(({ input }) => getErrorByCode(input.code)),
    updateCorrection: protectedProcedure.input(z28.object({ code: z28.string(), correction: z28.string().min(1) })).mutation(({ input }) => updateErrorCorrection(input.code, input.correction)),
    create: protectedProcedure.input(z28.object({
      code: z28.string().min(1),
      category: z28.string().min(1),
      description: z28.string().min(1),
      correction: z28.string().min(1),
      tipoRegistro: z28.enum(["retrabalho", "cnq"]).default("retrabalho")
    })).mutation(({ input }) => createErrorLibraryItem(input)),
    updateItem: protectedProcedure.input(z28.object({
      code: z28.string(),
      description: z28.string().min(1).optional(),
      correction: z28.string().min(1).optional()
    })).mutation(({ input }) => updateErrorItem(input.code, { description: input.description, correction: input.correction })),
    uploadImage: protectedProcedure.input(z28.object({
      code: z28.string(),
      fileName: z28.string(),
      url: z28.string().url(),
      key: z28.string().min(1),
      mimeType: z28.string().default("image/jpeg")
    })).mutation(async ({ input }) => {
      await updateErrorItem(input.code, { imageUrl: input.url, imageKey: input.key });
      return { url: input.url, key: input.key };
    }),
    removeImage: protectedProcedure.input(z28.object({ code: z28.string() })).mutation(async ({ input }) => {
      await updateErrorItem(input.code, { imageUrl: null, imageKey: null });
      return { success: true };
    }),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteErrorLibraryItem(input.id))
  }),
  faturamento: router({
    list: publicProcedure.query(() => getFaturamento()),
    upsert: publicProcedure.input(z28.object({ mes: z28.string(), ano: z28.number(), valorFaturado: z28.number(), totalPedidos: z28.number() })).mutation(({ input }) => upsertFaturamento(input.mes, input.ano, input.valorFaturado, input.totalPedidos))
  }),
  financeiros: router({
    list: publicProcedure.query(() => getFinanceiros()),
    byMesAno: publicProcedure.input(z28.object({ mes: z28.number(), ano: z28.number() })).query(({ input }) => getFinanceiroByMesAno(input.mes, input.ano)),
    upsert: protectedProcedure.input(z28.object({
      mes: z28.number(),
      ano: z28.number(),
      receitaBruta: z28.number().optional(),
      receitaOperacional: z28.number().optional(),
      receitaFinanceira: z28.number().optional(),
      despesasTotal: z28.number().optional(),
      despesasFixas: z28.number().optional(),
      despesasVariaveis: z28.number().optional(),
      despesasPessoal: z28.number().optional(),
      despesasFinanceiras: z28.number().optional(),
      despesasImpostos: z28.number().optional(),
      lucroGruto: z28.number().optional(),
      lucroOperacional: z28.number().optional(),
      lucroLiquido: z28.number().optional(),
      entradas: z28.number().optional(),
      saidas: z28.number().optional(),
      saldoMes: z28.number().optional(),
      observacoes: z28.string().optional()
    })).mutation(({ input }) => upsertFinanceiro(input))
  }),
  // ─── Retrabalhos ────────────────────────────────────────────────────────
  retrabalhos: router({
    list: publicProcedure.input(z28.object({ filter: filterSchema.optional(), page: z28.number().default(1), pageSize: z28.number().default(50) })).query(({ input }) => listRetrabalhos(input.filter ?? {}, input.page, input.pageSize)),
    all: publicProcedure.input(filterSchema.optional()).query(({ input }) => getRetrabalhosAll(input ?? {})),
    byId: publicProcedure.input(z28.object({ id: z28.number() })).query(({ input }) => getRetrabalhosById(input.id)),
    create: protectedProcedure.input(z28.object({
      titulo: z28.string().optional().nullable(),
      osRetrabalhada: z28.string().optional().nullable(),
      // Opcional para CNQ
      osOriginal: z28.string().optional().nullable(),
      // Opcional para CNQ
      data: z28.date(),
      setor: z28.string(),
      tipo: z28.enum(["INTERNO", "EXTERNO"]),
      custo: z28.string().default("0"),
      frete: z28.string().default("0"),
      total: z28.string().default("0"),
      codigoErro: z28.string().optional().nullable(),
      responsavel: z28.string().min(1, "Respons\xE1vel \xE9 obrigat\xF3rio"),
      tipoResponsavel: z28.enum(["operador", "gestor"]).default("operador"),
      descricao: z28.string().optional().nullable(),
      classe: z28.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]),
      horasImpacto: z28.union([z28.number(), z28.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
      mes: z28.string().optional().nullable(),
      tipoRegistro: z28.enum(["retrabalho", "cnq"]).default("retrabalho")
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
    createBatch: protectedProcedure.input(z28.object({
      titulo: z28.string().optional().nullable(),
      osRetrabalhada: z28.string().optional().nullable(),
      // Opcional para CNQ
      osOriginal: z28.string().optional().nullable(),
      // Opcional para CNQ
      data: z28.date(),
      setor: z28.string(),
      tipo: z28.enum(["INTERNO", "EXTERNO"]),
      custo: z28.string().default("0"),
      frete: z28.string().default("0"),
      total: z28.string().default("0"),
      responsavel: z28.string().min(1, "Respons\xE1vel \xE9 obrigat\xF3rio"),
      tipoResponsavel: z28.enum(["operador", "gestor"]).default("operador"),
      descricao: z28.string().optional().nullable(),
      classe: z28.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]),
      horasImpacto: z28.union([z28.number(), z28.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
      mes: z28.string().optional().nullable(),
      tipoRegistro: z28.enum(["retrabalho", "cnq"]).default("retrabalho"),
      errorIds: z28.array(z28.number()).min(1, "Selecione pelo menos um erro")
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
    update: protectedProcedure.input(z28.object({
      id: z28.number(),
      data: z28.object({
        titulo: z28.string().optional().nullable(),
        osRetrabalhada: z28.string().optional(),
        osOriginal: z28.string().optional(),
        data: z28.date().optional(),
        setor: z28.string().optional(),
        tipo: z28.enum(["INTERNO", "EXTERNO"]).optional(),
        custo: z28.string().optional(),
        frete: z28.string().optional(),
        total: z28.string().optional(),
        codigoErro: z28.string().optional().nullable(),
        responsavel: z28.string().optional().nullable(),
        tipoResponsavel: z28.enum(["operador", "gestor"]).optional(),
        descricao: z28.string().optional().nullable(),
        classe: z28.enum(["EVIT\xC1VEL", "INEVIT\xC1VEL"]).optional(),
        horasImpacto: z28.union([z28.number(), z28.string()]).optional().nullable().transform((v) => v != null ? String(v) : null),
        mes: z28.string().optional().nullable(),
        tipoRegistro: z28.enum(["retrabalho", "cnq"]).optional()
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
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(async ({ input, ctx }) => {
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
    list: publicProcedure.input(z28.object({ search: z28.string().optional(), category: z28.string().optional() }).optional()).query(({ input }) => listKnowledge(input?.search, input?.category)),
    byId: publicProcedure.input(z28.object({ id: z28.number() })).query(({ input }) => getKnowledgeById(input.id)),
    create: protectedProcedure.input(z28.object({ title: z28.string(), content: z28.string(), category: z28.string(), subcategory: z28.string().optional().nullable(), keywords: z28.string().optional().nullable() })).mutation(({ input }) => createKnowledge(input)),
    update: protectedProcedure.input(z28.object({ id: z28.number(), data: z28.object({ title: z28.string().optional(), content: z28.string().optional(), category: z28.string().optional(), subcategory: z28.string().optional().nullable(), keywords: z28.string().optional().nullable() }) })).mutation(({ input }) => updateKnowledge(input.id, input.data)),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteKnowledge(input.id)),
    askAI: protectedProcedure.input(z28.object({ question: z28.string() })).mutation(async ({ input, ctx }) => {
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
    list: protectedProcedure.input(z28.object({ status: z28.string().optional() }).optional()).query(({ input }) => listKnowledgeSuggestions(input?.status)),
    create: protectedProcedure.input(z28.object({
      pergunta: z28.string(),
      conteudoSugerido: z28.string(),
      fonte: z28.enum(["gemini", "manual"]).default("manual"),
      tituloSugerido: z28.string().optional(),
      categoriaSugerida: z28.string().optional()
    })).mutation(({ input, ctx }) => createKnowledgeSuggestion({
      ...input,
      autorId: ctx.user?.id ?? void 0,
      autorNome: ctx.user?.name ?? "Usu\xE1rio"
    })),
    // Master aprova: cria artigo na base de conhecimento
    approve: protectedProcedure.use(requireRole("admin", "master")).input(z28.object({
      id: z28.number(),
      titulo: z28.string(),
      categoria: z28.string(),
      conteudo: z28.string(),
      observacao: z28.string().optional()
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
    reject: protectedProcedure.use(requireRole("admin", "master")).input(z28.object({ id: z28.number(), observacao: z28.string().optional() })).mutation(async ({ input }) => {
      await updateKnowledgeSuggestion(input.id, { status: "rejeitado", observacaoMaster: input.observacao });
      return { success: true };
    }),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteKnowledgeSuggestion(input.id))
  }),
  // ─── OPERAÇÕES: Fornecedores ─────────────────────────────────────────────
  suppliers: router({
    list: publicProcedure.input(z28.object({ search: z28.string().optional(), category: z28.string().optional() }).optional()).query(({ input }) => listSuppliers(input?.search, input?.category)),
    byId: publicProcedure.input(z28.object({ id: z28.number() })).query(({ input }) => getSupplierById(input.id)),
    create: protectedProcedure.input(z28.object({ name: z28.string(), company: z28.string().optional().nullable(), category: z28.string(), supplies: z28.string().optional().nullable(), contact: z28.string().optional().nullable(), phone: z28.string().optional().nullable(), email: z28.string().optional().nullable(), paymentTerms: z28.string().optional().nullable(), notes: z28.string().optional().nullable() })).mutation(({ input, ctx }) => createSupplier({ ...input, createdByNome: ctx.user.name ?? ctx.user.email ?? "sistema", updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" })),
    update: protectedProcedure.input(z28.object({ id: z28.number(), data: z28.object({ name: z28.string().optional(), company: z28.string().optional().nullable(), category: z28.string().optional(), supplies: z28.string().optional().nullable(), contact: z28.string().optional().nullable(), phone: z28.string().optional().nullable(), email: z28.string().optional().nullable(), paymentTerms: z28.string().optional().nullable(), notes: z28.string().optional().nullable(), active: z28.enum(["sim", "nao"]).optional() }) })).mutation(({ input, ctx }) => updateSupplier(input.id, { ...input.data, updatedByNome: ctx.user.name ?? ctx.user.email ?? "sistema" })),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteSupplier(input.id))
  }),
  // ─── OPERAÇÕES: Rotinas ──────────────────────────────────────────────────────────────────
  routines: router({
    list: publicProcedure.query(() => listRoutines()),
    pending: publicProcedure.query(() => listPendingRoutines()),
    create: protectedProcedure.input(z28.object({
      title: z28.string(),
      description: z28.string().optional().nullable(),
      frequency: z28.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]),
      assignedTo: z28.string().optional().nullable(),
      startDate: z28.string().optional().nullable(),
      calendarDates: z28.string().optional().nullable()
    })).mutation(({ input }) => createRoutine(input)),
    update: protectedProcedure.input(z28.object({
      id: z28.number(),
      data: z28.object({
        title: z28.string().optional(),
        description: z28.string().optional().nullable(),
        frequency: z28.enum(["diaria", "semanal", "quinzenal", "mensal", "esporadico"]).optional(),
        assignedTo: z28.string().optional().nullable(),
        status: z28.enum(["pendente", "em_dia", "atrasada"]).optional(),
        lastDone: z28.date().optional().nullable(),
        startDate: z28.string().optional().nullable(),
        calendarDates: z28.string().optional().nullable(),
        nextDue: z28.date().optional().nullable()
      })
    })).mutation(({ input }) => updateRoutine(input.id, input.data)),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteRoutine(input.id)),
    markDone: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => markRoutineDone(input.id))
  }),
  // ─── OPERAÇÕES: Regulamentos ─────────────────────────────────────────────────────
  regulations: router({
    list: publicProcedure.input(z28.object({ type: z28.string().optional() }).optional()).query(({ input }) => listRegulations(input?.type)),
    byId: publicProcedure.input(z28.object({ id: z28.number() })).query(({ input }) => getRegulationById(input.id)),
    create: protectedProcedure.input(z28.object({ title: z28.string(), type: z28.enum(["regulamento", "memorando", "politica", "procedimento"]), content: z28.string(), version: z28.string().optional().nullable() })).mutation(({ input }) => createRegulation(input)),
    update: protectedProcedure.input(z28.object({ id: z28.number(), data: z28.object({ title: z28.string().optional(), type: z28.enum(["regulamento", "memorando", "politica", "procedimento"]).optional(), content: z28.string().optional(), version: z28.string().optional().nullable(), active: z28.enum(["sim", "nao"]).optional() }) })).mutation(({ input }) => updateRegulation(input.id, input.data)),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deleteRegulation(input.id))
  }),
  // ─── OPERAÇÕES: POPs ─────────────────────────────────────────────────────
  pops: router({
    list: publicProcedure.input(z28.object({ sector: z28.string().optional() }).optional()).query(({ input }) => listPops(input?.sector)),
    byId: publicProcedure.input(z28.object({ id: z28.number() })).query(({ input }) => getPopById(input.id)),
    create: protectedProcedure.input(z28.object({ code: z28.string(), title: z28.string(), sector: z28.string(), objective: z28.string().optional().nullable(), steps: z28.string(), responsible: z28.string().optional().nullable(), version: z28.string().optional().nullable() })).mutation(({ input }) => createPop(input)),
    update: protectedProcedure.input(z28.object({ id: z28.number(), data: z28.object({ code: z28.string().optional(), title: z28.string().optional(), sector: z28.string().optional(), objective: z28.string().optional().nullable(), steps: z28.string().optional(), responsible: z28.string().optional().nullable(), version: z28.string().optional().nullable(), active: z28.enum(["sim", "nao"]).optional() }) })).mutation(({ input }) => updatePop(input.id, input.data)),
    delete: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(({ input }) => deletePop(input.id)),
    // Gera um POP automaticamente via IA a partir de um erro da biblioteca
    generateFromError: protectedProcedure.input(z28.object({
      errorCode: z28.string(),
      errorDescription: z28.string(),
      errorCategory: z28.string(),
      correction: z28.string(),
      // histórico de ocorrências para enriquecer o contexto
      occurrenceCount: z28.number().optional(),
      totalCost: z28.number().optional()
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
    incorporateError: protectedProcedure.input(z28.object({
      popId: z28.number(),
      errorCode: z28.string(),
      errorDescription: z28.string(),
      errorCategory: z28.string(),
      correction: z28.string()
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
    generateFromCategory: protectedProcedure.input(z28.object({
      category: z28.string(),
      errors: z28.array(z28.object({
        code: z28.string(),
        description: z28.string(),
        correction: z28.string(),
        imageUrl: z28.string().optional().nullable()
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
    updateContent: publicProcedure.input(z28.object({
      id: z28.number(),
      title: z28.string().optional(),
      objective: z28.string().optional().nullable(),
      steps: z28.string().optional(),
      responsible: z28.string().optional().nullable(),
      version: z28.string().optional().nullable(),
      sector: z28.string().optional()
    })).mutation(({ input }) => {
      const { id, ...data } = input;
      return updatePop(id, data);
    }),
    // Upload de imagem em anexo ao POP
    uploadImage: publicProcedure.input(z28.object({
      popId: z28.number(),
      fileName: z28.string(),
      url: z28.string().url(),
      key: z28.string().min(1),
      mimeType: z28.string().default("image/jpeg")
    })).mutation(async ({ input }) => {
      const pop = await getPopById(input.popId);
      if (!pop) throw new TRPCError6({ code: "NOT_FOUND", message: "POP n\xE3o encontrado" });
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
    removeImage: publicProcedure.input(z28.object({ popId: z28.number(), url: z28.string() })).mutation(async ({ input }) => {
      const pop = await getPopById(input.popId);
      if (!pop) throw new TRPCError6({ code: "NOT_FOUND", message: "POP n\xE3o encontrado" });
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
    registrarAcesso: protectedProcedure.input(z28.object({
      popId: z28.number(),
      popCode: z28.string(),
      popTitle: z28.string(),
      tipo: z28.enum(["visualizacao", "download"]).default("visualizacao")
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
    relatorioAcessos: protectedProcedure.input(z28.object({
      popId: z28.number().optional(),
      tipo: z28.enum(["visualizacao", "download", "todos"]).default("todos"),
      dataInicio: z28.string().optional(),
      // ISO date string
      dataFim: z28.string().optional()
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
      const rows = await db5.select({ id: user.id, name: user.name, role: user.role }).from(user).where(or2(isNull2(user.banned), eq27(user.banned, false))).orderBy(asc6(user.name));
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
    create: publicProcedure.input(z28.object({
      name: z28.string().min(2),
      email: z28.string().email().optional(),
      password: z28.string().min(6),
      role: z28.enum(APP_ROLES)
    })).mutation(async ({ input, ctx }) => {
      const total = await countUsers();
      if (total > 0) assertAdminOrMaster(ctx);
      const needsEmail = input.role !== "producao" && input.role !== "empacotamento";
      if (needsEmail && !input.email) {
        throw new TRPCError6({ code: "BAD_REQUEST", message: "E-mail obrigat\xF3rio para esta fun\xE7\xE3o" });
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
    update: publicProcedure.input(z28.object({
      id: z28.string(),
      name: z28.string().min(2).optional(),
      role: z28.enum(APP_ROLES).optional(),
      password: z28.string().min(6).optional(),
      active: z28.enum(["sim", "nao"]).optional()
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
    delete: publicProcedure.input(z28.object({ id: z28.string() })).mutation(async ({ input, ctx }) => {
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
    set: protectedProcedure.use(requireRole("admin", "master")).input(z28.object({
      role: z28.enum(APP_ROLES),
      pageKey: z28.string(),
      canAccess: z28.boolean()
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
    list: publicProcedure.input(z28.object({ knowledgeId: z28.number() })).query(async ({ input }) => {
      return listKnowledgeComments(input.knowledgeId);
    }),
    create: publicProcedure.input(z28.object({
      knowledgeId: z28.number(),
      author: z28.string().min(1).max(128).default("Equipe"),
      content: z28.string().min(1)
    })).mutation(async ({ input }) => {
      await createKnowledgeComment(input);
      return { ok: true };
    }),
    delete: publicProcedure.input(z28.object({ id: z28.number() })).mutation(async ({ input }) => {
      await deleteKnowledgeComment(input.id);
      return { ok: true };
    })
  }),
  price: router({
    list: protectedProcedure.input(z28.object({ page: z28.number().optional() })).query(async ({ input }) => {
      return listPriceTableSections(input.page);
    }),
    getMeta: protectedProcedure.query(async () => {
      return getPriceTableMeta();
    }),
    update: protectedProcedure.input(z28.object({
      id: z28.number(),
      sectionTitle: z28.string().optional(),
      contentJson: z28.string().optional(),
      notes: z28.string().nullable().optional()
    })).mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      await updatePriceTableSection(id, data, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true };
    }),
    addSection: protectedProcedure.input(z28.object({
      page: z28.number(),
      sectionTitle: z28.string(),
      contentJson: z28.string(),
      notes: z28.string().nullable().optional()
    })).mutation(async ({ input, ctx }) => {
      const id = await addPriceTableSection(input, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true, id };
    }),
    deleteSection: protectedProcedure.input(z28.object({ id: z28.number() })).mutation(async ({ input, ctx }) => {
      await deletePriceTableSection(input.id, ctx.user.name ?? ctx.user.email ?? "usu\xE1rio");
      return { ok: true };
    }),
    getHistory: protectedProcedure.input(z28.object({ limit: z28.number().optional() })).query(async ({ input }) => {
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
  leadsCnpj: leadsCnpjRouter,
  perfilClientesCnpj: perfilClientesCnpjRouter,
  planosAcaoComercial: planosAcaoComercialRouter,
  radarMercado: radarMercadoRouter,
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
  marketingFinanceiro: marketingFinanceiroRouter,
  observacoesFinanceiras: observacoesFinanceirasRouter,
  desempenhoColabMensal: desempenhoColabMensalRouter,
  // LOGISTICA ────────────────────────────────────────────────────────────────────
  transportadoras: transportadorasRouter,
  cotacoesFrete: cotacoesFreteRouter,
  cte: cteRouter,
  logistica: router({
    buscarDadosOS: publicProcedure.input(z28.object({ osNumero: z28.string() })).mutation(async ({ input }) => {
      const { buscarDadosOSParaFrete: buscarDadosOSParaFrete2 } = await Promise.resolve().then(() => (init_mubisys_frete(), mubisys_frete_exports));
      return buscarDadosOSParaFrete2(input.osNumero);
    }),
    analisarAssertividade: publicProcedure.input(z28.object({ tipo: z28.string(), pergunta: z28.string().optional() })).mutation(async ({ input }) => {
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
  const { handleSincronizarHistorico: handleSincronizarHistorico2 } = await Promise.resolve().then(() => (init_scheduled_sync_historico_handler(), scheduled_sync_historico_handler_exports));
  app.post("/api/scheduled/sincronizarHistorico", handleSincronizarHistorico2);
  const { handleSincronizarCrmAbertos: handleSincronizarCrmAbertos2 } = await Promise.resolve().then(() => (init_scheduled_sync_crm_abertos_handler(), scheduled_sync_crm_abertos_handler_exports));
  app.post("/api/scheduled/sincronizarCrmAbertos", handleSincronizarCrmAbertos2);
  const { handleSincronizarCrmFechados: handleSincronizarCrmFechados2 } = await Promise.resolve().then(() => (init_scheduled_sync_crm_fechados_handler(), scheduled_sync_crm_fechados_handler_exports));
  app.post("/api/scheduled/sincronizarCrmFechados", handleSincronizarCrmFechados2);
  const { handleSincronizarPerfilCnpj: handleSincronizarPerfilCnpj2 } = await Promise.resolve().then(() => (init_scheduled_sync_perfil_cnpj_handler(), scheduled_sync_perfil_cnpj_handler_exports));
  app.post("/api/scheduled/sincronizarPerfilCnpj", handleSincronizarPerfilCnpj2);
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
