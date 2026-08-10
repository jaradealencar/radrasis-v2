import {
  boolean,
  date,
  decimal,
  int,
  mediumtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Biblioteca de classificação de erros
export const errorLibrary = mysqlTable("error_library", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull(),
  description: text("description").notNull(),
  correction: text("correction").notNull(),
  imageUrl: text("imageUrl"), // URL da imagem de referência (S3)
  imageKey: text("imageKey"), // chave S3
  tipoRegistro: mysqlEnum("tipoRegistro", ["retrabalho", "cnq"]).default("retrabalho").notNull(), // Retrabalho ou Custo da Não-Qualidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ErrorLibraryItem = typeof errorLibrary.$inferSelect;
export type InsertErrorLibraryItem = typeof errorLibrary.$inferInsert;

// Ocorrências de retrabalho
export const retrabalhos = mysqlTable("retrabalhos", {
  id: int("id").autoincrement().primaryKey(),
  titulo: varchar("titulo", { length: 256 }),
  osRetrabalhada: varchar("osRetrabalhada", { length: 32 }), // Opcional para CNQ
  osOriginal: varchar("osOriginal", { length: 64 }), // Opcional para CNQ
  data: timestamp("data").notNull(),
  setor: varchar("setor", { length: 64 }).notNull(),
  tipo: mysqlEnum("tipo", ["INTERNO", "EXTERNO"]).notNull(),
  custo: decimal("custo", { precision: 10, scale: 2 }).default("0").notNull(),
  frete: decimal("frete", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).default("0").notNull(),
  codigoErro: varchar("codigoErro", { length: 20 }),
  responsavel: varchar("responsavel", { length: 128 }),
  tipoResponsavel: mysqlEnum("tipoResponsavel", ["operador", "gestor"]).default("operador"),
  descricao: text("descricao"),
  classe: mysqlEnum("classe", ["EVITÁVEL", "INEVITÁVEL"]).notNull(),
  horasImpacto: decimal("horasImpacto", { precision: 6, scale: 2 }),
  mes: varchar("mes", { length: 20 }),
  tipoRegistro: mysqlEnum("tipoRegistro", ["retrabalho", "cnq"]).default("retrabalho").notNull(), // Retrabalho ou Custo da Não-Qualidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Retrabalho = typeof retrabalhos.$inferSelect;
export type InsertRetrabalho = typeof retrabalhos.$inferInsert;

// Faturamento mensal para cálculo de KPIs
export const faturamento = mysqlTable("faturamento", {
  id: int("id").autoincrement().primaryKey(),
  mes: varchar("mes", { length: 20 }).notNull(),
  ano: int("ano").notNull(),
  valorFaturado: decimal("valorFaturado", { precision: 14, scale: 2 }).notNull(),
  totalPedidos: int("totalPedidos").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => ({
  mesAnoUnique: uniqueIndex("faturamento_mes_ano_unique").on(t.mes, t.ano),
}));
export type Faturamento = typeof faturamento.$inferSelect;
export type InsertFaturamento = typeof faturamento.$inferInsert;

// ─── MÓDULOS DE OPERAÇÕES ────────────────────────────────────────────────────

// Base de Conhecimento
export const knowledgeBase = mysqlTable("knowledge_base", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 64 }).notNull(), // Comercial, Administrativo, Financeiro, Produção
  subcategory: varchar("subcategory", { length: 64 }),
  keywords: text("keywords"), // comma-separated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KnowledgeItem = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeItem = typeof knowledgeBase.$inferInsert;

// Fornecedores
export const suppliers = mysqlTable("suppliers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  company: varchar("company", { length: 128 }),
  category: varchar("category", { length: 64 }).notNull(),
  supplies: text("supplies"), // insumos oferecidos
  contact: varchar("contact", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 128 }),
  paymentTerms: text("paymentTerms"),
  notes: text("notes"),
  active: mysqlEnum("active", ["sim", "nao"]).default("sim").notNull(),
  createdByNome: varchar("createdByNome", { length: 128 }), // nome do usuário que cadastrou
  updatedByNome: varchar("updatedByNome", { length: 128 }), // nome do último editor
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Rotinas
export const routines = mysqlTable("routines", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  frequency: mysqlEnum("frequency", ["diaria", "semanal", "quinzenal", "mensal", "esporadico"]).notNull(),
  assignedTo: varchar("assignedTo", { length: 128 }),
  startDate: timestamp("startDate"),
  nextDue: timestamp("nextDue"),
  lastDone: timestamp("lastDone"),
  calendarDates: text("calendarDates"), // JSON array de datas ISO para esporádico
  status: mysqlEnum("status", ["pendente", "em_dia", "atrasada"]).default("pendente").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Routine = typeof routines.$inferSelect;
export type InsertRoutine = typeof routines.$inferInsert;

// Regulamentos e Memorandos
export const regulations = mysqlTable("regulations", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  type: mysqlEnum("type", ["regulamento", "memorando", "politica", "procedimento"]).notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 16 }).default("1.0"),
  active: mysqlEnum("active", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Regulation = typeof regulations.$inferSelect;
export type InsertRegulation = typeof regulations.$inferInsert;

// POPs — Procedimentos Operacionais Padrão
export const pops = mysqlTable("pops", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // ex: POP-001
  title: varchar("title", { length: 256 }).notNull(),
  sector: varchar("sector", { length: 64 }).notNull(),
  objective: text("objective"),
  steps: text("steps").notNull(), // JSON array of steps
  responsible: varchar("responsible", { length: 128 }),
  version: varchar("version", { length: 16 }).default("1.0"),
  active: mysqlEnum("active", ["sim", "nao"]).default("sim").notNull(),
  attachments: text("attachments"), // JSON array de URLs de imagens
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Pop = typeof pops.$inferSelect;
export type InsertPop = typeof pops.$inferInsert;

// Registro de acessos e downloads de POPs
export const popAcessos = mysqlTable("pop_acessos", {
  id: int("id").autoincrement().primaryKey(),
  popId: int("popId").notNull(),
  popCode: varchar("popCode", { length: 32 }).notNull(),
  popTitle: varchar("popTitle", { length: 256 }).notNull(),
  usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
  usuarioEmail: varchar("usuarioEmail", { length: 256 }),
  tipo: mysqlEnum("tipo", ["visualizacao", "download"]).notNull().default("visualizacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PopAcesso = typeof popAcessos.$inferSelect;
export type InsertPopAcesso = typeof popAcessos.$inferInsert;

// Comentários e notas por artigo da Base de Conhecimento
export const knowledgeComments = mysqlTable("knowledge_comments", {
  id: int("id").autoincrement().primaryKey(),
  knowledgeId: int("knowledgeId").notNull(),
  author: varchar("author", { length: 128 }).notNull().default("Equipe"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeComment = typeof knowledgeComments.$inferSelect;
export type InsertKnowledgeComment = typeof knowledgeComments.$inferInsert;

// ─── MÓDULO COMERCIAL ──────────────────────────────────────────────────────

// Seções editáveis da Tabela de Preços (páginas 1-3 do PDF)
export const priceTableSections = mysqlTable("price_table_sections", {
  id: int("id").autoincrement().primaryKey(),
  page: int("page").notNull(), // 1, 2 ou 3 (editável) | 4, 5 (consulta)
  sectionOrder: int("sectionOrder").notNull().default(0),
  sectionTitle: varchar("sectionTitle", { length: 256 }).notNull(),
  contentJson: text("contentJson").notNull(), // JSON com linhas da tabela
  notes: text("notes"), // observações em texto livre
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PriceTableSection = typeof priceTableSections.$inferSelect;
export type InsertPriceTableSection = typeof priceTableSections.$inferInsert;

// ─── METADADOS DA TABELA DE PREÇOS ──────────────────────────────────────────
export const priceTableMeta = mysqlTable("price_table_meta", {
  id: int("id").autoincrement().primaryKey(),
  versao: varchar("versao", { length: 16 }).notNull().default("001"),
  dataModificacao: timestamp("dataModificacao").defaultNow().onUpdateNow().notNull(),
  descricao: text("descricao"),
});
export type PriceTableMeta = typeof priceTableMeta.$inferSelect;

// ─── HISTÓRICO DE VERSÕES DA TABELA DE PREÇOS ───────────────────────────────
export const priceTableHistory = mysqlTable("price_table_history", {
  id: int("id").autoincrement().primaryKey(),
  versao: varchar("versao", { length: 16 }).notNull(),
  sectionId: int("sectionId").notNull(),
  sectionTitle: varchar("sectionTitle", { length: 256 }),
  autor: varchar("autor", { length: 128 }).default("sistema"),
  campoAlterado: varchar("campoAlterado", { length: 64 }),
  valorAnterior: text("valorAnterior"),
  valorNovo: text("valorNovo"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PriceTableHistory = typeof priceTableHistory.$inferSelect;
export type InsertPriceTableHistory = typeof priceTableHistory.$inferInsert;


// ─── SISTEMA DE USUÁRIOS LOCAIS E PERMISSÕES ────────────────────────────────

// Tipos de role do sistema
export const APP_ROLES = ["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"] as const;
export type AppRole = typeof APP_ROLES[number];

// Chaves de todas as páginas/abas do sistema
export const PAGE_KEYS = [
  "painel", "retrabalhos", "inserir", "biblioteca", "reincidencia",
  "relatorio", "insights", "conhecimento", "fornecedores", "rotinas",
  "regulamentos", "pops", "tabela-preco",
  "logistica-dashboard", "logistica-solicitacoes", "logistica-minhas-cotacoes",
  "logistica-transportadoras", "logistica-consulta", "logistica-importar-cte",
  "logistica-assertividade", "logistica-empacotamento",
  "operacoes-performance", "operacoes-custo-solda", "operacoes-custo-led",
  "biblioteca-arquivos", "sugestoes-conhecimento",
  "auditoria",
  "cargos-funcoes",
  "financeiro",
  "admin", "admin-usuarios", "admin-permissoes",
  "comercial-performance", "comercial-metas", "comercial-crm", "comercial-crm-config",
  "comercial-tabela-preco", "comercial-planos-acao",
  "qualidade-planos", "qualidade-desempenho",
  "logistica-cte", "logistica-insights-ia",
] as const;
export type PageKey = typeof PAGE_KEYS[number];

// Usuários locais criados pelo master (e-mail + senha)
export const localUsers = mysqlTable("local_users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }).notNull(),
  role: mysqlEnum("role", ["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"]).notNull().default("vendas"),
  active: mysqlEnum("active", ["sim", "nao"]).default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LocalUser = typeof localUsers.$inferSelect;
export type InsertLocalUser = typeof localUsers.$inferInsert;

// Permissões de acesso por role × página
export const rolePermissions = mysqlTable("role_permissions", {
  id: int("id").autoincrement().primaryKey(),
  role: mysqlEnum("role", ["master", "admin", "gestor", "vendas", "logistica", "producao", "financeiro", "empacotamento"]).notNull(),
  pageKey: varchar("pageKey", { length: 64 }).notNull(),
  canAccess: mysqlEnum("canAccess", ["sim", "nao"]).default("nao").notNull(),
});
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ─── MÓDULO LOGÍSTICA ──────────────────────────────────────────────────────

// Transportadoras parceiras
export const transportadoras = mysqlTable("transportadoras", {
  id: int("id").autoincrement().primaryKey(),
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
  formaCotacao: mysqlEnum("formaCotacao", ["site", "whatsapp", "telefone", "email"]).default("site"),
  linkSiteCotacao: varchar("linkSiteCotacao", { length: 256 }),
  modais: text("modais"), // JSON array: ["rodoviario", "aereo"]
  pesoMaxKg: decimal("pesoMaxKg", { precision: 10, scale: 2 }),
  alturaMaxCm: decimal("alturaMaxCm", { precision: 8, scale: 2 }),
  larguraMaxCm: decimal("larguraMaxCm", { precision: 8, scale: 2 }),
  comprimentoMaxCm: decimal("comprimentoMaxCm", { precision: 8, scale: 2 }),
  somaMaxCm: decimal("somaMaxCm", { precision: 8, scale: 2 }),
  horarioLimiteColeta: varchar("horarioLimiteColeta", { length: 8 }),
  horarioLimiteMercadoria: varchar("horarioLimiteMercadoria", { length: 8 }),
  distanciaSedMin: int("distanciaSedMin"),
  observacoes: text("observacoes"),
  ativa: mysqlEnum("ativa", ["sim", "nao"]).default("sim").notNull(),
  logoUrl: varchar("logoUrl", { length: 512 }),
  // Novos campos
  realizaColeta: mysqlEnum("realizaColeta", ["sim", "nao"]).default("nao"),
  ultAtualizTabela: varchar("ultAtualizTabela", { length: 16 }), // YYYY-MM-DD
  semTabelaNegociavel: mysqlEnum("semTabelaNegociavel", ["sim", "nao"]).default("nao"),
  whatsappContatoNegocial: varchar("whatsappContatoNegocial", { length: 32 }),
  portalUrl: varchar("portalUrl", { length: 256 }),
  portalUsuario: varchar("portalUsuario", { length: 128 }),
  portalEmail: varchar("portalEmail", { length: 128 }),
  portalObservacao: text("portalObservacao"),
  portalSenha: varchar("portalSenha", { length: 256 }),
  ultAtualizCidades: varchar("ultAtualizCidades", { length: 16 }), // YYYY-MM-DD
  coberturaTotal: int("coberturaTotal").default(0), // 1 = atende todos os municípios do Brasil
  contatoRastreio: text("contatoRastreio"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Transportadora = typeof transportadoras.$inferSelect;
export type InsertTransportadora = typeof transportadoras.$inferInsert;

// Avaliações de serviço das transportadoras
export const transportadoraAvaliacoes = mysqlTable("transportadora_avaliacoes", {
  id: int("id").autoincrement().primaryKey(),
  transportadoraId: int("transportadoraId").notNull(),
  estrelas: int("estrelas").notNull(), // 1-5
  comentario: text("comentario"),
  autor: varchar("autor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TransportadoraAvaliacao = typeof transportadoraAvaliacoes.$inferSelect;
export type InsertTransportadoraAvaliacao = typeof transportadoraAvaliacoes.$inferInsert;

// Filiais das transportadoras
export const transportadoraFiliais = mysqlTable("transportadora_filiais", {
  id: int("id").autoincrement().primaryKey(),
  transportadoraId: int("transportadoraId").notNull(),
  nome: varchar("nome", { length: 128 }).notNull(),
  endereco: text("endereco"),
  cidade: varchar("cidade", { length: 128 }),
  estado: varchar("estado", { length: 2 }),
  telefone: varchar("telefone", { length: 256 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TransportadoraFilial = typeof transportadoraFiliais.$inferSelect;
export type InsertTransportadoraFilial = typeof transportadoraFiliais.$inferInsert;

// Cidades/regiões atendidas por cada transportadora
export const transportadoraCidades = mysqlTable("transportadora_cidades", {
  id: int("id").autoincrement().primaryKey(),
  transportadoraId: int("transportadoraId").notNull(),
  cidade: varchar("cidade", { length: 128 }).notNull(),
  estado: varchar("estado", { length: 2 }).notNull(),
  telefone: varchar("telefone", { length: 256 }), // telefone(s) do adicional nessa cidade
  observacao: varchar("observacao", { length: 512 }), // obs adicionais (ex: cidades cobertas)
  endereco: varchar("endereco", { length: 512 }), // endereço do ponto de coleta/entrega nessa cidade
  responsavel: varchar("responsavel", { length: 128 }), // nome do responsável nessa cidade
  sede: varchar("sede", { length: 128 }), // nome da sede/filial responsável por essa cidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TransportadoraCidade = typeof transportadoraCidades.$inferSelect;
export type InsertTransportadoraCidade = typeof transportadoraCidades.$inferInsert;

// Solicitações de cotação de frete
export const cotacoesFrete = mysqlTable("cotacoes_frete", {
  id: int("id").autoincrement().primaryKey(),
  solicitanteId: int("solicitanteId"), // local_users.id
  solicitanteNome: varchar("solicitanteNome", { length: 128 }),
  destinatarioNome: varchar("destinatarioNome", { length: 256 }),
  destinatarioCnpj: varchar("destinatarioCnpj", { length: 32 }),
  cepDestino: varchar("cepDestino", { length: 10 }),
  municipio: varchar("municipio", { length: 128 }),
  estado: varchar("estado", { length: 2 }),
  dimensoesLargura: decimal("dimensoesLargura", { precision: 8, scale: 2 }),
  dimensoesAltura: decimal("dimensoesAltura", { precision: 8, scale: 2 }),
  dimensoesComprimento: decimal("dimensoesComprimento", { precision: 8, scale: 2 }),
  pesoKg: decimal("pesoKg", { precision: 8, scale: 2 }),
  valorNf: decimal("valorNf", { precision: 12, scale: 2 }),
  observacoes: text("observacoes"),
  // Campo de observação especial para transportadora Gol (ex: "Retirar no aeroporto do Galeão")
  observacaoGol: text("observacaoGol"),
  // Foto e ID do pedido de empacotamento que originou esta cotação
  fotoUrl: text("fotoUrl"),
  empacotamentoPedidoId: int("empacotamentoPedidoId"),
  empacotamentoPedidoNumero: varchar("empacotamentoPedidoNumero", { length: 64 }),
  status: mysqlEnum("status", ["fila", "em_cotacao", "pronto", "concluido", "cancelado"]).default("fila").notNull(),
  transportadoraSelecionadaId: int("transportadoraSelecionadaId"),
  horarioDecisaoMs: varchar("horarioDecisaoMs", { length: 8 }), // ex: "14:30" — horário limite de decisão no fuso MS
  dataSource: varchar("dataSource", { length: 32 }), // 'mub' | 'brasilapi' | null
  // Tipo de material/produto (transportado do empacotamento - modeloNome)
  tipoMaterial: varchar("tipoMaterial", { length: 256 }),
  // Data de entrega prevista (campo 'data_entrega' do Mubisys)
  dataEntregaPrevista: date("dataEntregaPrevista"),
  // Data real de despacho (quando o card vai para 'concluido')
  dataDespacho: timestamp("dataDespacho"),
  // Marcação de retrabalho: indica se este pedido teve retrabalho associado
  temRetrabalho: boolean("temRetrabalho").default(false),
  // Tipo do retrabalho (categorias: Produção, Expedição, Projeto, Qualidade, Outro)
  tipoRetrabalho: varchar("tipoRetrabalho", { length: 64 }),
  // Descrição breve do motivo do retrabalho
  motivoRetrabalho: text("motivoRetrabalho"),
  // ID do retrabalho vinculado na tabela retrabalhos (se houver)
  retrabalhoVinculadoId: int("retrabalhoVinculadoId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CotacaoFrete = typeof cotacoesFrete.$inferSelect;
export type InsertCotacaoFrete = typeof cotacoesFrete.$inferInsert;

// Opções de cotação oferecidas pela logística
export const cotacaoOpcoes = mysqlTable("cotacao_opcoes", {
  id: int("id").autoincrement().primaryKey(),
  cotacaoId: int("cotacaoId").notNull(),
  transportadoraId: int("transportadoraId"),
  transportadoraNome: varchar("transportadoraNome", { length: 128 }),
  valorFrete: decimal("valorFrete", { precision: 10, scale: 2 }).notNull(),
  prazoDias: int("prazoDias"),
  modal: varchar("modal", { length: 32 }),
  observacoes: text("observacoes"),
  tipoPrazo: mysqlEnum("tipoPrazo", ["uteis", "corridos"]).default("uteis"),
  selecionada: mysqlEnum("selecionada", ["sim", "nao"]).default("nao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CotacaoOpcao = typeof cotacaoOpcoes.$inferSelect;
export type InsertCotacaoOpcao = typeof cotacaoOpcoes.$inferInsert;

// Comentários internos por cotação
export const cotacaoComentarios = mysqlTable("cotacao_comentarios", {
  id: int("id").autoincrement().primaryKey(),
  cotacaoId: int("cotacaoId").notNull(),
  autorId: int("autorId"),
  autorNome: varchar("autorNome", { length: 128 }).notNull().default("Sistema"),
  texto: text("texto"),
  audioUrl: varchar("audioUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CotacaoComentario = typeof cotacaoComentarios.$inferSelect;
export type InsertCotacaoComentario = typeof cotacaoComentarios.$inferInsert;

// Importações de CT-e
export const cteImportacoes = mysqlTable("cte_importacoes", {
  id: int("id").autoincrement().primaryKey(),
  numeroCte: varchar("numeroCte", { length: 64 }).notNull(),
  transportadoraId: int("transportadoraId"),
  transportadoraNome: varchar("transportadoraNome", { length: 128 }),
  valor: decimal("valor", { precision: 12, scale: 2 }),
  dataEmissao: timestamp("dataEmissao"),
  remetente: varchar("remetente", { length: 256 }),
  destinatario: varchar("destinatario", { length: 256 }),
  municipioDestino: varchar("municipioDestino", { length: 128 }),
  estadoDestino: varchar("estadoDestino", { length: 2 }),
  rawData: text("rawData"), // JSON com dados brutos do CT-e
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CteImportacao = typeof cteImportacoes.$inferSelect;
export type InsertCteImportacao = typeof cteImportacoes.$inferInsert;

// ─── VISÃO DE PERFORMANCE MENSAL ─────────────────────────────────────────────
// Indicadores de produtividade e capacidade operacional por mês/ano
export const performanceMensal = mysqlTable("performance_mensal", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),       // 1–12
  ano: int("ano").notNull(),       // ex: 2026

  // 1. Visão Geral de Produtividade
  osGeradas: int("osGeradas"),                         // OS geradas no mês
  osExpedicao: int("osExpedicao"),                     // OS demandadas para expedição
  percExpedicao: decimal("percExpedicao", { precision: 5, scale: 2 }), // % expedição/geradas

  // 2.1 Finalização e Fluxo de OS
  metaOsDia: decimal("metaOsDia", { precision: 6, scale: 2 }),          // meta necessária OS/dia
  capacidadeOsDiaMin: decimal("capacidadeOsDiaMin", { precision: 6, scale: 2 }), // capacidade mínima
  capacidadeOsDiaMax: decimal("capacidadeOsDiaMax", { precision: 6, scale: 2 }), // capacidade máxima
  deficitFinalizacao: decimal("deficitFinalizacao", { precision: 5, scale: 2 }),  // % déficit

  // 2.2 Embalagem e Expedição
  metaEmbalagemDia: decimal("metaEmbalagemDia", { precision: 6, scale: 2 }),
  producaoEmbalagemDia: decimal("producaoEmbalagemDia", { precision: 6, scale: 2 }),

  // 2.3 Acabamento (Pintura, Instalação, Colagem)
  metaAcabamentoDia: decimal("metaAcabamentoDia", { precision: 6, scale: 2 }),
  capacidadeAcabamentoDia: decimal("capacidadeAcabamentoDia", { precision: 6, scale: 2 }),

  // 3. Setor de Solda
  capacidadeNominalSolda: int("capacidadeNominalSolda"),   // metros (horário útil)
  producaoInternaSolda: int("producaoInternaSolda"),        // metros produzidos internamente
  demandaTotalSolda: int("demandaTotalSolda"),              // metros demandados no mês
  osTerceirizadas: int("osTerceirizadas"),                  // qtd OS terceirizadas
  metrosTerceirizados: int("metrosTerceirizados"),          // metros terceirizados

  // Metas configuráveis (para comparativo)
  metaOsGeradas: int("metaOsGeradas"),
  metaOsExpedicao: int("metaOsExpedicao"),
  metaProducaoSolda: int("metaProducaoSolda"),
  metaPercTerceirizacao: decimal("metaPercTerceirizacao", { precision: 5, scale: 2 }),

  // ─── Análise de Custo de Solda ─────────────────────────────────────────────
  // Soldador interno
  numSoldadores: int("numSoldadores"),                                               // quantidade de soldadores no setor
  soldadorSalarioBase: decimal("soldadorSalarioBase", { precision: 10, scale: 2 }),  // R$ salário base mensal (por soldador)
  soldadorHorasExtras: decimal("soldadorHorasExtras", { precision: 8, scale: 2 }),   // horas extras no mês
  soldadorValorHoraExtra: decimal("soldadorValorHoraExtra", { precision: 8, scale: 2 }), // R$/hora extra
  soldadorOutrosCustos: decimal("soldadorOutrosCustos", { precision: 10, scale: 2 }), // encargos, benefícios, etc. (por soldador)
  custoProdutividadeSolda: decimal("custoProdutividadeSolda", { precision: 12, scale: 2 }), // custo total de produtividade do setor no mês (R$)
  // Gestor do setor de solda
  gestorSalarioBase: decimal("gestorSalarioBase", { precision: 10, scale: 2 }),       // R$ salário base mensal do gestor
  gestorHorasExtras: decimal("gestorHorasExtras", { precision: 8, scale: 2 }),        // horas extras no mês
  gestorValorHoraExtra: decimal("gestorValorHoraExtra", { precision: 8, scale: 2 }), // R$/hora extra
  gestorOutrosCustos: decimal("gestorOutrosCustos", { precision: 10, scale: 2 }),     // encargos, benefícios, etc.
  // Terceirização
  custoMetroTerceirizado: decimal("custoMetroTerceirizado", { precision: 8, scale: 2 }), // R$/metro pago ao terceiro
  // Preço de venda (mantido no schema para compatibilidade, não exibido na UI)
  precoVendaMetro: decimal("precoVendaMetro", { precision: 8, scale: 2 }), // R$/metro cobrado do cliente (legado)

   // ─── Faturamento ─────────────────────────────────────────────────────────────
  faturamentoRealizado: decimal("faturamentoRealizado", { precision: 14, scale: 2 }), // R$ faturado no mês
  metaFaturamento: decimal("metaFaturamento", { precision: 14, scale: 2 }),           // R$ meta (default 425000)
  // ─── Projetos Entregues ───────────────────────────────────────────────────────
  projetosEntregues: int("projetosEntregues"),      // total de projetos/pedidos entregues
  projetosNoPrazo: int("projetosNoPrazo"),          // entregues dentro do prazo
  projetosForaPrazo: int("projetosForaPrazo"),      // entregues fora do prazo
  // ─── Metas de Performance ────────────────────────────────────────────────────
  metaEntregaNoPrazoPct: decimal("metaEntregaNoPrazoPct", { precision: 5, scale: 2 }), // % meta entrega no prazo (ex: 90.00)
  metaRetrabalhoPct: decimal("metaRetrabalhoPct", { precision: 5, scale: 2 }),         // % máx retrabalho/pedidos (ex: 5.00)
  // Total de pedidos do mês (para cálculo de ticket médio e taxa de retrabalho)
  totalPedidos: int("totalPedidos"),
  // Campos livres para observações
  observacoes: text("observacoes"),
  destaques: text("destaques"),    // pontos positivos do mês
  gargalos: text("gargalos"),      // gargalos identificados
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PerformanceMensal = typeof performanceMensal.$inferSelect;
export type InsertPerformanceMensal = typeof performanceMensal.$inferInsert;

// ─── Auditoria de Retrabalhos ──────────────────────────────────────────────
export const auditoriaRetrabalhos = mysqlTable("auditoria_retrabalhos", {
  id: int("id").autoincrement().primaryKey(),
  // Referência ao retrabalho (nullable para quando foi excluído)
  retrabalhoId: int("retrabalhoId"),
  // OS do retrabalho (preservada mesmo após exclusão)
  osRetrabalhada: varchar("osRetrabalhada", { length: 32 }),
  osOriginal: varchar("osOriginal", { length: 64 }),
  // Tipo de ação
  acao: mysqlEnum("acao", ["CRIACAO", "EDICAO", "EXCLUSAO"]).notNull(),
  // Usuário que realizou a ação
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 128 }),
  usuarioRole: varchar("usuarioRole", { length: 32 }),
  // Detalhes da mudança (JSON com campos antes/depois para edições)
  detalhes: text("detalhes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditoriaRetrabalho = typeof auditoriaRetrabalhos.$inferSelect;
export type InsertAuditoriaRetrabalho = typeof auditoriaRetrabalhos.$inferInsert;

// ─── Cargos e Funções ─────────────────────────────────────────────────────────
export const cargosFuncoes = mysqlTable("cargos_funcoes", {
  id: int("id").autoincrement().primaryKey(),
  titulo: varchar("titulo", { length: 128 }).notNull(),
  // Seções do descritivo (armazenadas como texto rico / markdown)
  missao: text("missao"),
  responsabilidades: text("responsabilidades"),
  kpis: text("kpis"),
  ferramentas: text("ferramentas"),
  integracao: text("integracao"),
  riscos: text("riscos"),
  requisitos: text("requisitos"),
  condicoes: text("condicoes"),
  // Imagem de divulgacao do cargo
  imagemDivulgacaoUrl: text("imagemDivulgacaoUrl"),
  imagemDivulgacaoKey: text("imagemDivulgacaoKey"),
  // Roteiro de entrevista e prompt de IA
  roteiroEntrevista: text("roteiroEntrevista"),
  promptAnaliseIA: text("promptAnaliseIA"),
  // Metadados
  createdBy: varchar("createdBy", { length: 128 }),
  updatedBy: varchar("updatedBy", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CargoFuncao = typeof cargosFuncoes.$inferSelect;
export type InsertCargoFuncao = typeof cargosFuncoes.$inferInsert;

// ─── Módulo de Empacotamento/Expedição ───────────────────────────────────────

// Modelos de letreiros cadastrados pelo supervisor
export const empacotamentoModelos = mysqlTable("empacotamento_modelos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  descricao: text("descricao"),
  modeloCaixaIdPadrao: int("modeloCaixaIdPadrao"), // vínculo letreiro → caixa padrão
  tempoPorM2Min: decimal("tempoPorM2Min", { precision: 8, scale: 2 }), // minutos por m² do letreiro
  valorProdutividadePorMinLetreiro: decimal("valorProdutividadePorMinLetreiro", { precision: 10, scale: 4 }), // R$ por minuto de execução do letreiro
  ativo: int("ativo").notNull().default(1), // 1=ativo, 0=inativo
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoModelo = typeof empacotamentoModelos.$inferSelect;
export type InsertEmpacotamentoModelo = typeof empacotamentoModelos.$inferInsert;

// Tabela de preços: Modelo + Tipo de Caixa → valor de comissão
export const empacotamentoTabelaPrecos = mysqlTable("empacotamento_tabela_precos", {
  id: int("id").autoincrement().primaryKey(),
  modeloId: int("modeloId").notNull(),
  tipoCaixa: varchar("tipoCaixa", { length: 64 }).notNull(), // ex: "P", "M", "G", "GG"
  valorComissao: decimal("valorComissao", { precision: 8, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoTabelaPreco = typeof empacotamentoTabelaPrecos.$inferSelect;
export type InsertEmpacotamentoTabelaPreco = typeof empacotamentoTabelaPrecos.$inferInsert;

// Modelos de caixa (com dimensões, tempo limite e valor de comissão)
export const empacotamentoModelosCaixa = mysqlTable("empacotamento_modelos_caixa", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  descricao: text("descricao"),
  // tipoCaixa: 'padronizada' = tem dimensões fixas; 'personalizada' = dimensões definidas no pedido
  tipoCaixa: varchar("tipoCaixa", { length: 32 }).notNull().default("padronizada"),
  larguraCm: decimal("larguraCm", { precision: 8, scale: 2 }),
  alturaCm: decimal("alturaCm", { precision: 8, scale: 2 }),
  profundidadeCm: decimal("profundidadeCm", { precision: 8, scale: 2 }),
  custoAquisicao: decimal("custoAquisicao", { precision: 10, scale: 2 }).notNull().default("0"), // custo de compra da caixa em R$
  custoAquisicaoAtualizadoEm: timestamp("custoAquisicaoAtualizadoEm"), // data da última atualização do custo
  tempoPorM2Min: decimal("tempoPorM2Min", { precision: 8, scale: 2 }), // minutos por m² da área da caixa (caixas padronizadas)
  tempoPorM3Min: decimal("tempoPorM3Min", { precision: 8, scale: 2 }), // minutos por m³ do volume (caixas personalizadas)
  tempoPorMetroArestaMin: decimal("tempoPorMetroArestaMin", { precision: 8, scale: 2 }), // minutos por metro de aresta da caixa
  valorProdutividadePorCm2: decimal("valorProdutividadePorCm2", { precision: 10, scale: 6 }), // R$ por cm² da caixa
  ativo: int("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoModeloCaixa = typeof empacotamentoModelosCaixa.$inferSelect;
export type InsertEmpacotamentoModeloCaixa = typeof empacotamentoModelosCaixa.$inferInsert;

// Itens de checklist por modelo de caixa
export const empacotamentoChecklistItens = mysqlTable("empacotamento_checklist_itens", {
  id: int("id").autoincrement().primaryKey(),
  modeloCaixaId: int("modeloCaixaId").notNull(),
  ordem: int("ordem").notNull().default(0),
  descricao: varchar("descricao", { length: 256 }).notNull(),
  obrigatorio: int("obrigatorio").notNull().default(1), // 1=obrigatório
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoChecklistItem = typeof empacotamentoChecklistItens.$inferSelect;
export type InsertEmpacotamentoChecklistItem = typeof empacotamentoChecklistItens.$inferInsert;

// Pedidos de empacotamento (fila de despacho)
export const empacotamentoPedidos = mysqlTable("empacotamento_pedidos", {
  id: int("id").autoincrement().primaryKey(),
  numeroPedido: varchar("numeroPedido", { length: 64 }).notNull(),
  cliente: varchar("cliente", { length: 256 }).notNull(),
  modeloId: int("modeloId"),
  modeloNome: varchar("modeloNome", { length: 128 }),
  modeloCaixaId: int("modeloCaixaId"),
  modeloCaixaNome: varchar("modeloCaixaNome", { length: 128 }),
  tipoCaixa: varchar("tipoCaixa", { length: 64 }).notNull().default(""),
  arquivoUrl: text("arquivoUrl"),
  arquivoKey: text("arquivoKey"),
  arquivoTipo: varchar("arquivoTipo", { length: 16 }),
  // Kanban status
  kanbanStatus: mysqlEnum("kanbanStatus", ["aguardando", "embalando", "patio", "abandonado"]).notNull().default("aguardando"),
  // Prazo de entrega
  prazoEntrega: timestamp("prazoEntrega"),
  horarioMaximo: varchar("horarioMaximo", { length: 8 }), // ex: "17:30"
  // Dados de finalização
  finalizadoEm: timestamp("finalizadoEm"),
  valorComissao: decimal("valorComissao", { precision: 8, scale: 2 }),
  // Dimensões da caixa e peso (preenchidos pelo operador ao embalar)
  larguraCm: decimal("larguraCm", { precision: 8, scale: 2 }),
  alturaCm: decimal("alturaCm", { precision: 8, scale: 2 }),
  profundidadeCm: decimal("profundidadeCm", { precision: 8, scale: 2 }),
  pesoKg: decimal("pesoKg", { precision: 8, scale: 2 }),
  // m² do letreiro (informado pelo supervisor ao criar o pedido)
  metrosQuadrados: decimal("metrosQuadrados", { precision: 10, scale: 4 }),
  // Dados do ERP (Mubisys) - preenchidos automaticamente via ID OS
  cnpjCliente: varchar("cnpjCliente", { length: 32 }),
  cepCliente: varchar("cepCliente", { length: 16 }),
  enderecoCliente: varchar("enderecoCliente", { length: 512 }),
  // Fotografia do pedido embalado (tirada pelo operador)
  fotografiaUrl: text("fotografiaUrl"),
  fotografiaKey: text("fotografiaKey"),
  // Observações
  observacoes: text("observacoes"),
  createdBy: int("createdBy"),
  createdByNome: varchar("createdByNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoPedido = typeof empacotamentoPedidos.$inferSelect;
export type InsertEmpacotamentoPedido = typeof empacotamentoPedidos.$inferInsert;

// Usuários trabalhando em um pedido (múltiplos por pedido)
export const empacotamentoPedidoUsuarios = mysqlTable("empacotamento_pedido_usuarios", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
  iniciadoEm: timestamp("iniciadoEm"),
  finalizadoEm: timestamp("finalizadoEm"),
  tempoSegundos: int("tempoSegundos").default(0), // tempo total trabalhado
  ativo: int("ativo").notNull().default(1), // 1=ainda trabalhando
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoPedidoUsuario = typeof empacotamentoPedidoUsuarios.$inferSelect;
export type InsertEmpacotamentoPedidoUsuario = typeof empacotamentoPedidoUsuarios.$inferInsert;

// Fotos tiradas ao finalizar um pedido
export const empacotamentoPedidoFotos = mysqlTable("empacotamento_pedido_fotos", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  storageKey: text("storageKey").notNull(),
  url: text("url").notNull(),
  usuarioNome: varchar("usuarioNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoPedidoFoto = typeof empacotamentoPedidoFotos.$inferSelect;
export type InsertEmpacotamentoPedidoFoto = typeof empacotamentoPedidoFotos.$inferInsert;

// Checklist preenchido por pedido
export const empacotamentoPedidoChecklist = mysqlTable("empacotamento_pedido_checklist", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  itemId: int("itemId").notNull(),
  marcado: int("marcado").notNull().default(0),
  marcadoPor: varchar("marcadoPor", { length: 128 }),
  marcadoEm: timestamp("marcadoEm"),
});
export type EmpacotamentoPedidoChecklistItem = typeof empacotamentoPedidoChecklist.$inferSelect;
export type InsertEmpacotamentoPedidoChecklistItem = typeof empacotamentoPedidoChecklist.$inferInsert;

// ─── Empacotamento v3: Insumos, Precificação e Custo de Funcionário ───────────

// Insumos de embalagem (ERP leve)
export const empacotamentoInsumos = mysqlTable("empacotamento_insumos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  unidadeMedida: varchar("unidadeMedida", { length: 32 }).notNull(), // ex: "m²", "m linear", "unidade"
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull().default("0"), // custo por unidade de medida
  precoAtualizadoEm: timestamp("precoAtualizadoEm"), // data da última atualização do preço
  categoria: varchar("categoria", { length: 64 }), // ex: "proteção", "fixação", "reforço"
  ativo: int("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoInsumo = typeof empacotamentoInsumos.$inferSelect;
export type InsertEmpacotamentoInsumo = typeof empacotamentoInsumos.$inferInsert;

// Consumo de insumos por modelo de caixa (receita da caixa)
// formula_consumo define como a quantidade é calculada a partir das dimensões da caixa:
//   area_externa_m2 = 2*(L*A + L*P + A*P) / 10000  (papelão, plástico bolha, etc.)
//   volume_interno_m3 = L*A*P / 1000000            (espuma, enchimento volumétrico)
//   perimetro_m = 4*(L+A+P)/2 / 100               (fita de arquear, cantoneiras)
//   fixo = quantidade fixa por caixa (independe das dimensões)
// fator = multiplicador sobre o resultado geométrico (ex: 1.1 para 10% de sobra)
export const empacotamentoConsumoCaixa = mysqlTable("empacotamento_consumo_caixa", {
  id: int("id").autoincrement().primaryKey(),
  modeloCaixaId: int("modeloCaixaId").notNull(),
  insumoId: int("insumoId").notNull(),
  quantidadePorCaixa: decimal("quantidadePorCaixa", { precision: 10, scale: 4 }).notNull().default("0"), // usado quando formula=fixo
  formulaConsumo: varchar("formulaConsumo", { length: 32 }).notNull().default("fixo"), // area_externa_m2 | volume_interno_m3 | arestas_m | fixo
  fator: decimal("fator", { precision: 8, scale: 4 }).notNull().default("1"), // multiplicador (ex: 1.1 = +10% de sobra)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoConsumoCaixa = typeof empacotamentoConsumoCaixa.$inferSelect;
export type InsertEmpacotamentoConsumoCaixa = typeof empacotamentoConsumoCaixa.$inferInsert;

// Custo de funcionário de empacotamento (para cálculo de mão-de-obra)
export const empacotamentoCustoFuncionario = mysqlTable("empacotamento_custo_funcionario", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull().default("Padrão"),
  salarioMensal: decimal("salarioMensal", { precision: 10, scale: 2 }).notNull().default("0"),
  horasMes: decimal("horasMes", { precision: 6, scale: 2 }).notNull().default("220"),
  custoHora: decimal("custoHora", { precision: 10, scale: 4 }), // calculado: salarioMensal / horasMes
  ativo: int("ativo").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoCustoFuncionario = typeof empacotamentoCustoFuncionario.$inferSelect;
export type InsertEmpacotamentoCustoFuncionario = typeof empacotamentoCustoFuncionario.$inferInsert;

// Vínculo padrão letreiro → modelo de caixa (coluna extra em empacotamento_modelos)
// Adicionado via migration ALTER TABLE

// Insumos vinculados a cada modelo de letreiro (consumo por m² do letreiro)
export const empacotamentoInsumosLetreiro = mysqlTable("empacotamento_insumos_letreiro", {
  id: int("id").autoincrement().primaryKey(),
  modeloLetreiId: int("modeloLetreiId").notNull(), // FK → empacotamento_modelos.id
  insumoId: int("insumoId").notNull(),             // FK → empacotamento_insumos.id
  quantidade: decimal("quantidade", { precision: 10, scale: 4 }).notNull().default("1"), // legado: quantidade fixa por letreiro
  fatorM2: decimal("fatorM2", { precision: 10, scale: 4 }), // quantidade por m² do letreiro
  observacao: varchar("observacao", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoInsumoLetreiro = typeof empacotamentoInsumosLetreiro.$inferSelect;
export type InsertEmpacotamentoInsumoLetreiro = typeof empacotamentoInsumosLetreiro.$inferInsert;

// Pausas do cronômetro por operador/pedido
export const empacotamentoCronometroPausas = mysqlTable("empacotamento_cronometro_pausas", {
  id: int("id").autoincrement().primaryKey(),
  pedidoUsuarioId: int("pedidoUsuarioId").notNull(), // FK → empacotamento_pedido_usuarios.id
  pausadoEm: timestamp("pausadoEm").notNull(),
  retomadoEm: timestamp("retomadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoCronometroPausa = typeof empacotamentoCronometroPausas.$inferSelect;
export type InsertEmpacotamentoCronometroPausa = typeof empacotamentoCronometroPausas.$inferInsert;

// Configuração de produtividade (valor por minuto, bônus/penalidade)
export const empacotamentoConfigProdutividade = mysqlTable("empacotamento_config_produtividade", {
  id: int("id").autoincrement().primaryKey(),
  valorPorMinuto: decimal("valorPorMinuto", { precision: 10, scale: 4 }).notNull().default("0.15"),
  bonusPorcentagem: decimal("bonusPorcentagem", { precision: 5, scale: 2 }).notNull().default("20.00"),
  penalidadePorcentagem: decimal("penalidadePorcentagem", { precision: 5, scale: 2 }).notNull().default("30.00"),
  descricao: varchar("descricao", { length: 255 }),
  ativo: int("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoConfigProdutividade = typeof empacotamentoConfigProdutividade.$inferSelect;
export type InsertEmpacotamentoConfigProdutividade = typeof empacotamentoConfigProdutividade.$inferInsert;

// ─── Empacotamento v10: Checklist por Modelo de Letreiro ──────────────────────

// Itens de checklist por modelo de letreiro (baseado no PDF de expedição)
export const empacotamentoChecklistLetreitoItens = mysqlTable("empacotamento_checklist_letreiro_itens", {
  id: int("id").autoincrement().primaryKey(),
  modeloLetreitoId: int("modeloLetreitoId").notNull(),
  ordem: int("ordem").notNull().default(0),
  descricao: varchar("descricao", { length: 512 }).notNull(),
  obrigatorio: int("obrigatorio").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoChecklistLetreitoItem = typeof empacotamentoChecklistLetreitoItens.$inferSelect;
export type InsertEmpacotamentoChecklistLetreitoItem = typeof empacotamentoChecklistLetreitoItens.$inferInsert;

// Checklist de letreiro preenchido por pedido
export const empacotamentoPedidoChecklistLetreiro = mysqlTable("empacotamento_pedido_checklist_letreiro", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  itemId: int("itemId").notNull(),
  marcado: int("marcado").notNull().default(0),
  marcadoPor: varchar("marcadoPor", { length: 128 }),
  marcadoEm: timestamp("marcadoEm"),
});
export type EmpacotamentoPedidoChecklistLetreiro = typeof empacotamentoPedidoChecklistLetreiro.$inferSelect;
export type InsertEmpacotamentoPedidoChecklistLetreiro = typeof empacotamentoPedidoChecklistLetreiro.$inferInsert;

// ─── Empacotamento v11: Sessões de Trabalho (Temporizador) ───────────────────
// Registra cada sessão de trabalho de um operador em um pedido
// Um pedido pode ter múltiplas sessões (pause/resume)
export const empacotamentoSessoes = mysqlTable("empacotamento_sessoes", {
  id: int("id").autoincrement().primaryKey(),
  pedidoId: int("pedidoId").notNull(),
  operadorId: int("operadorId").notNull(), // FK → empacotamento_operadores.id
  operadorNome: varchar("operadorNome", { length: 128 }).notNull(),
  iniciadoEm: int("iniciadoEm").notNull(), // timestamp em segundos UTC
  finalizadoEm: int("finalizadoEm"), // null = em andamento
  totalSegundos: int("totalSegundos").notNull().default(0), // tempo acumulado (excluindo pausas)
  status: varchar("status", { length: 32 }).notNull().default("ativo"), // ativo | pausado | finalizado
  registradoEm: int("registradoEm"), // timestamp UTC (segundos) quando o operador clicou em "Registrar"
  tempoRegistradoSegundos: int("tempoRegistradoSegundos"), // tempo acumulado no momento do registro formal
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmpacotamentoSessao = typeof empacotamentoSessoes.$inferSelect;
export type InsertEmpacotamentoSessao = typeof empacotamentoSessoes.$inferInsert;

// Pausas dentro de uma sessão (para calcular tempo real trabalhado)
export const empacotamentoSessoesPausas = mysqlTable("empacotamento_sessoes_pausas", {
  id: int("id").autoincrement().primaryKey(),
  sessaoId: int("sessaoId").notNull(),
  pausadoEm: int("pausadoEm").notNull(),
  retomadoEm: int("retomadoEm"), // null = ainda pausado
});
export type EmpacotamentoSessaoPausa = typeof empacotamentoSessoesPausas.$inferSelect;
export type InsertEmpacotamentoSessaoPausa = typeof empacotamentoSessoesPausas.$inferInsert;

// ─── SUGESTÕES DE INCORPORAÇÃO NA BASE DE CONHECIMENTO ──────────────────────

export const knowledgeSuggestions = mysqlTable("knowledge_suggestions", {
  id: int("id").autoincrement().primaryKey(),
  // Pergunta que originou a sugestão
  pergunta: text("pergunta").notNull(),
  // Resposta sugerida (pode ser do Gemini ou escrita manualmente)
  conteudoSugerido: text("conteudoSugerido").notNull(),
  // Fonte: 'gemini' | 'manual'
  fonte: varchar("fonte", { length: 32 }).notNull().default("manual"),
  // Quem sugeriu
  autorId: int("autorId"),
  autorNome: varchar("autorNome", { length: 128 }),
  // Status: 'pendente' | 'aprovado' | 'rejeitado'
  status: varchar("status", { length: 32 }).notNull().default("pendente"),
  // Se aprovado, título e categoria para criar o artigo
  tituloSugerido: varchar("tituloSugerido", { length: 256 }),
  categoriaSugerida: varchar("categoriaSugerida", { length: 64 }),
  // Observação do master ao aprovar/rejeitar
  observacaoMaster: text("observacaoMaster"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type KnowledgeSuggestion = typeof knowledgeSuggestions.$inferSelect;
export type InsertKnowledgeSuggestion = typeof knowledgeSuggestions.$inferInsert;

// ─── Ações Corretivas de Retrabalho ──────────────────────────────────────────
// Cada retrabalho pode ter uma ação corretiva associada (fechamento do ciclo)
export const acoesCorretivas = mysqlTable("acoes_corretivas", {
  id: int("id").autoincrement().primaryKey(),
  retrabalhoid: int("retrabalhoid").notNull(), // FK → retrabalhos.id
  // Status do ciclo: aberto → em_tratamento → resolvido
  status: mysqlEnum("status", ["aberto", "em_tratamento", "resolvido"]).notNull().default("aberto"),
  // Ação tomada para resolver o problema
  acaoTomada: text("acaoTomada"),
  // Responsável pela ação corretiva
  responsavel: varchar("responsavel", { length: 128 }),
  // Prazo para resolução
  prazoResolucao: timestamp("prazoResolucao"),
  // Data em que foi efetivamente resolvido
  dataResolucao: timestamp("dataResolucao"),
  // Custo adicional gerado pela ação corretiva
  custoAdicional: decimal("custoAdicional", { precision: 10, scale: 2 }).default("0"),
  // Observações
  observacoes: text("observacoes"),
  // Quem registrou
  registradoPor: varchar("registradoPor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AcaoCorretiva = typeof acoesCorretivas.$inferSelect;
export type InsertAcaoCorretiva = typeof acoesCorretivas.$inferInsert;

// ─── Planos de Ação para Reincidências ────────────────────────────────────────
// Quando um erro reincide N vezes, é criado um plano de ação preventivo
export const planosAcao = mysqlTable("planos_acao", {
  id: int("id").autoincrement().primaryKey(),
  // Código do erro que gerou o plano
  codigoErro: varchar("codigoErro", { length: 20 }).notNull(),
  // Setor onde ocorre a reincidência
  setor: varchar("setor", { length: 64 }),
  // Título do plano
  titulo: varchar("titulo", { length: 256 }).notNull(),
  // Descrição do problema raiz identificado
  problemaRaiz: text("problemaRaiz"),
  // Ações preventivas planejadas
  acoesPreventivas: text("acoesPreventivas"),
  // Responsável pelo plano
  responsavel: varchar("responsavel", { length: 128 }),
  // Prazo para implementação
  prazo: timestamp("prazo"),
  // Status: pendente → em_andamento → concluido → monitorando
  status: mysqlEnum("status", ["pendente", "em_andamento", "concluido", "monitorando"]).notNull().default("pendente"),
  // Número de reincidências que disparou o plano
  reincidenciasNaAbertura: int("reincidenciasNaAbertura").default(0),
  // Reincidências após implementação (para medir eficácia)
  reincidenciasAposPlano: int("reincidenciasAposPlano").default(0),
  // Erros que este plano previne (JSON array de códigos: ["PIN-001", "PIN-002"])
  errosPrevenidos: text("errosPrevenidos"),
  // Erros que este plano resolve (JSON array de códigos)
  errosResolvidos: text("errosResolvidos"),
  // Metodologia usada: ishikawa, 5w2h, ambos
  metodologia: varchar("metodologia", { length: 32 }).default("ambos"),
  // Lista de códigos de erro vinculados (JSON array: ["PIN-001", "PIN-002", "PIN-003"])
  codigosErro: text("codigosErro"),
  // Quem criou
  criadoPor: varchar("criadoPor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlanoAcao = typeof planosAcao.$inferSelect;
export type InsertPlanoAcao = typeof planosAcao.$inferInsert;

// ─── Causas Ishikawa (6M) por Plano de Ação ─────────────────────────────────
export const ishikawaCausas = mysqlTable("ishikawa_causas", {
  id: int("id").autoincrement().primaryKey(),
  planoId: int("planoId").notNull(),
  // Categoria 6M
  categoria: mysqlEnum("categoria", ["maquina", "mao_de_obra", "material", "metodo", "medida", "meio_ambiente"]).notNull(),
  // Descrição da causa identificada
  causa: text("causa").notNull(),
  // Prioridade: alta, media, baixa
  prioridade: mysqlEnum("prioridade", ["alta", "media", "baixa"]).default("media"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IshikawaCausa = typeof ishikawaCausas.$inferSelect;
export type InsertIshikawaCausa = typeof ishikawaCausas.$inferInsert;

// ─── Ações 5W2H por Plano de Ação ────────────────────────────────────────────
export const acoes5w2h = mysqlTable("acoes_5w2h", {
  id: int("id").autoincrement().primaryKey(),
  planoId: int("planoId").notNull(),
  // 5W
  what: text("what").notNull(),        // O quê?
  why: text("why"),                    // Por quê?
  where: varchar("where", { length: 128 }), // Onde?
  who: varchar("who", { length: 128 }),    // Quem?
  when: varchar("when", { length: 64 }),   // Quando?
  // 2H
  how: text("how"),                    // Como?
  howMuch: varchar("howMuch", { length: 64 }), // Quanto custa?
  // Status da ação
  status: mysqlEnum("status", ["pendente", "em_andamento", "concluido"]).default("pendente"),
  // Causa Ishikawa que originou esta ação (opcional)
  causaId: int("causaId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Acao5w2h = typeof acoes5w2h.$inferSelect;
export type InsertAcao5w2h = typeof acoes5w2h.$inferInsert;

// ─── Metas de Retrabalho ──────────────────────────────────────────────────────
// Metas específicas para o módulo de retrabalho (separadas das metas de performance)
export const metasRetrabalho = mysqlTable("metas_retrabalho", {
  id: int("id").autoincrement().primaryKey(),
  // Período de vigência da meta
  ano: int("ano").notNull(),
  mes: int("mes"), // null = meta anual
  // Metas quantitativas
  metaMaxRetrabalhosMes: int("metaMaxRetrabalhosMes"),        // máx retrabalhos por mês
  metaMaxCustoMes: decimal("metaMaxCustoMes", { precision: 12, scale: 2 }), // R$ máx custo/mês
  metaMaxPercFaturamento: decimal("metaMaxPercFaturamento", { precision: 5, scale: 2 }), // % máx do faturamento
  metaMaxPercEvitaveis: decimal("metaMaxPercEvitaveis", { precision: 5, scale: 2 }),     // % máx evitáveis
  metaMinResolucaoDias: int("metaMinResolucaoDias"),           // prazo máx para resolver (dias)
  metaMaxReincidencias: int("metaMaxReincidencias"),           // máx reincidências por erro/mês
  // Metas por setor (JSON: { "SOLDA": 5, "PINTURA": 3, ... })
  metasPorSetor: text("metasPorSetor"),
  // Observações
  observacoes: text("observacoes"),
  criadoPor: varchar("criadoPor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaRetrabalho = typeof metasRetrabalho.$inferSelect;
export type InsertMetaRetrabalho = typeof metasRetrabalho.$inferInsert;

// ─── Alertas do Sistema ───────────────────────────────────────────────────────
// Alertas gerados automaticamente por regras de negócio
export const alertasSistema = mysqlTable("alertas_sistema", {
  id: int("id").autoincrement().primaryKey(),
  // Tipo do alerta
  tipo: mysqlEnum("tipo", [
    "reincidencia",      // erro reincidiu N vezes
    "meta_excedida",     // meta de retrabalho excedida
    "sem_acao",          // retrabalho sem ação corretiva há N dias
    "prazo_vencido",     // prazo de ação corretiva vencido
    "novo_retrabalho",   // novo retrabalho registrado (para notificar gestores)
    "atraso_expedicao"   // pedido atrasado na expedição
  ]).notNull(),
  // Nível de severidade
  severidade: mysqlEnum("severidade", ["info", "aviso", "critico"]).notNull().default("aviso"),
  // Título do alerta
  titulo: varchar("titulo", { length: 256 }).notNull(),
  // Descrição detalhada
  descricao: text("descricao"),
  // Referência ao objeto relacionado (retrabalhoid, codigoErro, etc.)
  referenciaId: int("referenciaId"),
  referenciaTipo: varchar("referenciaTipo", { length: 64 }), // "retrabalho" | "plano_acao" | "cotacao"
  referenciaExtra: varchar("referenciaExtra", { length: 256 }), // ex: codigoErro, numeroOS
  // Status: ativo → lido → arquivado
  status: mysqlEnum("status", ["ativo", "lido", "arquivado"]).notNull().default("ativo"),
  // Quem deve ver (null = todos)
  destinatario: varchar("destinatario", { length: 128 }),
  // Quem leu e quando
  lidoPor: varchar("lidoPor", { length: 128 }),
  lidoEm: timestamp("lidoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AlertaSistema = typeof alertasSistema.$inferSelect;
export type InsertAlertaSistema = typeof alertasSistema.$inferInsert;

// ─── BIBLIOTECA DE ARQUIVOS (Base de Conhecimento) ──────────────────────────
export const bibliotecaArquivos = mysqlTable("biblioteca_arquivos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 256 }).notNull(),
  descricao: text("descricao"),
  categoria: varchar("categoria", { length: 64 }).notNull().default("Geral"),
  subcategoria: varchar("subcategoria", { length: 64 }),
  tags: text("tags"), // comma-separated
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileUrl: varchar("fileUrl", { length: 1024 }).notNull(),
  fileName: varchar("fileName", { length: 256 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  fileSize: int("fileSize").notNull().default(0), // bytes
  uploadedBy: varchar("uploadedBy", { length: 128 }),
  visualizacoes: int("visualizacoes").notNull().default(0),
  conteudoExtraido: mediumtext("conteudoExtraido"), // texto extraído do PDF/documento para busca semântica
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BibliotecaArquivo = typeof bibliotecaArquivos.$inferSelect;
export type InsertBibliotecaArquivo = typeof bibliotecaArquivos.$inferInsert;

// ─── CACHE CURVA ABC (ERP Mubisys) ──────────────────────────────────────────
// Cache mensal de curva ABC de clientes e produtos (buscado do ERP)
export const abcCache = mysqlTable("abc_cache", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),   // 1-12
  ano: int("ano").notNull(),   // ex: 2026
  tipo: mysqlEnum("tipo", ["clientes", "produtos"]).notNull(),
  // JSON array com os itens da curva ABC
  dados: text("dados").notNull(), // JSON: [{nome, total, count, pct, pctAcum, classe}]
  totalOs: int("totalOs").default(0), // total de OS no mês
  faturamentoTotal: decimal("faturamentoTotal", { precision: 14, scale: 2 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AbcCache = typeof abcCache.$inferSelect;
export type InsertAbcCache = typeof abcCache.$inferInsert;


// ─── METAS OPERACIONAIS ──────────────────────────────────────────────────────
// Configuração centralizada de metas para todos os indicadores do painel de performance
export const metasOperacionais = mysqlTable("metas_operacionais", {
  id: int("id").autoincrement().primaryKey(),
  // Identificação do período de vigência (null = meta padrão global)
  anoVigencia: int("anoVigencia"),  // ex: 2026 (null = aplica a todos os anos)
  // 1. Pedidos entregues dentro do prazo
  metaEntregaNoPrazoPct: decimal("metaEntregaNoPrazoPct", { precision: 5, scale: 2 }).default("90.00"),
  // 2. Número de retrabalhos
  metaMaxRetrabalhosMes: int("metaMaxRetrabalhosMes"),
  metaMaxRetrabalhoPct: decimal("metaMaxRetrabalhoPct", { precision: 5, scale: 2 }).default("5.00"),
  // 3. Faturamento
  metaFaturamentoMensal: decimal("metaFaturamentoMensal", { precision: 14, scale: 2 }).default("425000.00"),
  metaFaturamentoAnual: decimal("metaFaturamentoAnual", { precision: 16, scale: 2 }),
  // 4. Lucratividade
  metaLucratividadePct: decimal("metaLucratividadePct", { precision: 5, scale: 2 }),
  metaLucratividadeValor: decimal("metaLucratividadeValor", { precision: 14, scale: 2 }),
  // 4b. Lucratividade anual
  metaLucratividadeAnual: decimal("metaLucratividadeAnual", { precision: 16, scale: 2 }),
  // 5. Metros soldados
  metaMetrosSoldadosMes: int("metaMetrosSoldadosMes"),
  metaCapacidadeSoldaMin: int("metaCapacidadeSoldaMin"),
  metaCapacidadeSoldaMax: int("metaCapacidadeSoldaMax"),
  // 5b. Soldadores
  numSoldadores: int("numSoldadores"),
  metaMediaSoldaPorSoldador: decimal("metaMediaSoldaPorSoldador", { precision: 10, scale: 2 }),
  // 6. Prejuízo com retrabalhos
  metaMaxPrejuizoRetrabalhoMes: decimal("metaMaxPrejuizoRetrabalhoMes", { precision: 12, scale: 2 }),
  metaMaxPrejuizoRetrabalhoPct: decimal("metaMaxPrejuizoRetrabalhoPct", { precision: 5, scale: 2 }),
  // 7. Desempenho por colaborador
  metaOsPorColaboradorDia: decimal("metaOsPorColaboradorDia", { precision: 6, scale: 2 }),
  metaRetrabalhosPorColaboradorMes: int("metaRetrabalhosPorColaboradorMes"),
  // 8. Ticket médio
  metaTicketMedio: decimal("metaTicketMedio", { precision: 10, scale: 2 }).default("3000.00"),
  // 10. OS Criadas por mês
  metaOsGeradasMes: int("metaOsGeradasMes"),
  // 9. Metros terceirizados
  metaMaxMetrosTerceirizadosMes: int("metaMaxMetrosTerceirizadosMes"),
  metaMaxPercTerceirizacao: decimal("metaMaxPercTerceirizacao", { precision: 5, scale: 2 }),
  // Observações
  observacoes: text("observacoes"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetasOperacionais = typeof metasOperacionais.$inferSelect;
export type InsertMetasOperacionais = typeof metasOperacionais.$inferInsert;

// ─── FINANCEIRO MENSAL ────────────────────────────────────────────────────────
export const financeiroMensal = mysqlTable("financeiro_mensal", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),   // 1-12
  ano: int("ano").notNull(),
  // Faturamento oficial (fonte única para todo o sistema)
  faturamentoOficial: decimal("faturamentoOficial", { precision: 14, scale: 2 }),
  // Despesas
  despesasFixas: decimal("despesasFixas", { precision: 14, scale: 2 }),
  despesasVariaveis: decimal("despesasVariaveis", { precision: 14, scale: 2 }),
  // Colaboradores
  numColaboradores: int("numColaboradores"),
  // Lucro (pode ser preenchido manualmente ou calculado automaticamente)
  lucroBruto: decimal("lucroBruto", { precision: 14, scale: 2 }),
  lucroLiquido: decimal("lucroLiquido", { precision: 14, scale: 2 }),
  // ─── Impostos detalhados (a partir de Abr/2026) ───
  impostoDas: decimal("impostoDas", { precision: 14, scale: 2 }),           // DAS Simples Nacional
  impostoIcmsDifal: decimal("impostoIcmsDifal", { precision: 14, scale: 2 }), // ICMS DIFAL e Equalizador
  impostoDaems: decimal("impostoDaems", { precision: 14, scale: 2 }),        // DAEMS (guia municipal)
  // ─── Despesas específicas (a partir de Abr/2026) ───
  comissoesBv: decimal("comissoesBv", { precision: 14, scale: 2 }),          // Comissões BV / Vendas Externas
  produtividadeSolda: decimal("produtividadeSolda", { precision: 14, scale: 2 }), // Bônus produtividade soldadores
  freteRetrabalho: decimal("freteRetrabalho", { precision: 14, scale: 2 }), // Frete pago em retrabalhos
  devSoftware: decimal("devSoftware", { precision: 14, scale: 2 }),          // Desenvolvimento de Software
  // ─── Receitas detalhadas (a partir de Abr/2026) ───
  receitaOperacionalOs: decimal("receitaOperacionalOs", { precision: 14, scale: 2 }), // Receita somente de OS
  resultadoEfetivo: decimal("resultadoEfetivo", { precision: 14, scale: 2 }), // Resultado ajustado
  saldoMes: decimal("saldoMes", { precision: 14, scale: 2 }),               // Saldo real entrada-saída no caixa
  // ─── Indicadores de resultado em 3 níveis (a partir de Abr/2026) ───
  tl1: decimal("tl1", { precision: 14, scale: 2 }),  // TL1 = Receitas - Despesas Variáveis
  tl2: decimal("tl2", { precision: 14, scale: 2 }),  // TL2 = TL1 - Despesas Fixas (exceto dívidas/investimentos)
  tl3: decimal("tl3", { precision: 14, scale: 2 }),  // TL3 = TL2 - Dívidas e Investimentos (= Resultado Final)
  // Observações
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FinanceiroMensal = typeof financeiroMensal.$inferSelect;
export type InsertFinanceiroMensal = typeof financeiroMensal.$inferInsert;

// ─── OBSERVAÇÕES FINANCEIRAS MENSAIS ─────────────────────────────────────────
export const observacoesFinanceirasMensais = mysqlTable("observacoes_financeiras_mensais", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  // Observações manuais escritas pelo usuário (texto rico HTML)
  observacoesManuais: text("observacoes_manuais"),
  // Análise gerada pela IA
  analiseIa: text("analise_ia"),
  // Contextos específicos informados pelo usuário
  contextosEspecificos: text("contextos_especificos"), // JSON array de contextos
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ObservacoesFinanceirasMensais = typeof observacoesFinanceirasMensais.$inferSelect;

// ─── DESEMPENHO POR COLABORADOR MENSAL ───────────────────────────────────────
export const desempenhoColaboradorMensal = mysqlTable("desempenho_colaborador_mensal", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 120 }).notNull(),
  categoria: varchar("categoria", { length: 40 }).notNull(), // "soldador" | "vendedor" | "operador_maquinas"
  mes: int("mes").notNull(),   // 1-12
  ano: int("ano").notNull(),
  // Métricas comuns
  numFaltas: int("numFaltas").default(0),
  // Soldador
  metrosSoldados: decimal("metrosSoldados", { precision: 10, scale: 2 }),
  numRetrabalhos: int("numRetrabalhos").default(0),
  // Vendedor
  numPropostas: int("numPropostas").default(0),
  numVendas: int("numVendas").default(0),
  faturamentoVendedor: decimal("faturamentoVendedor", { precision: 14, scale: 2 }),
  ticketMedioVendedor: decimal("ticketMedioVendedor", { precision: 12, scale: 2 }),
  // Operador de Máquinas
  numTrabalhos: int("numTrabalhos").default(0),
  // Observações
  notas: text("notas"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DesempenhoColaboradorMensal = typeof desempenhoColaboradorMensal.$inferSelect;
export type InsertDesempenhoColaboradorMensal = typeof desempenhoColaboradorMensal.$inferInsert;

// ─── METAS DE PRODUTOS ────────────────────────────────────────────────────────
// Armazena os produtos monitorados e suas metas de participação no faturamento
export const metaProdutos = mysqlTable("meta_produtos", {
  id: int("id").autoincrement().primaryKey(),
  nomeProduto: varchar("nomeProduto", { length: 256 }).notNull(),
  codigoProduto: varchar("codigoProduto", { length: 64 }),
  metaParticipacaoPct: decimal("metaParticipacaoPct", { precision: 5, scale: 2 }).notNull().default("0"),
  ativo: boolean("ativo").default(true).notNull(),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaProduto = typeof metaProdutos.$inferSelect;
export type InsertMetaProduto = typeof metaProdutos.$inferInsert;

// ─── METAS COMERCIAIS POR VENDEDOR ───────────────────────────────────────────
// Armazena metas mensais individuais de cada vendedor
export const metasComerciais = mysqlTable("metas_comerciais", {
  id: int("id").autoincrement().primaryKey(),
  vendedor: varchar("vendedor", { length: 256 }).notNull(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  metaCotacoes: int("metaCotacoes"),
  metaVendas: int("metaVendas"),
  metaFaturamento: decimal("metaFaturamento", { precision: 14, scale: 2 }),
  metaConversao: decimal("metaConversao", { precision: 5, scale: 2 }),
  metaTicketMedio: decimal("metaTicketMedio", { precision: 12, scale: 2 }),
  // Novos indicadores
  metaOsGeradas: int("metaOsGeradas"),
  metaClientesNovos: int("metaClientesNovos"),
  metaOsNovos: int("metaOsNovos"),
  metaCotacoesNovos: int("metaCotacoesNovos"),
  metaFaturamentoNovos: decimal("metaFaturamentoNovos", { precision: 14, scale: 2 }),
  metaTaxaFaturamento: decimal("metaTaxaFaturamento", { precision: 5, scale: 2 }),
  metaTaxaFaturamentoNovos: decimal("metaTaxaFaturamentoNovos", { precision: 5, scale: 2 }),
  metaConversaoNovos: decimal("metaConversaoNovos", { precision: 5, scale: 2 }),
  metaTicketMedioNovos: decimal("metaTicketMedioNovos", { precision: 12, scale: 2 }),
  metaValorOrcado: decimal("metaValorOrcado", { precision: 14, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MetaComercial = typeof metasComerciais.$inferSelect;
export type InsertMetaComercial = typeof metasComerciais.$inferInsert;

// ─── HISTÓRICO DE OS (Relatório de Vendas) ───────────────────────────────────
// Dados importados do relatório XLS de Vendas do ERP (OS Normais por aprovação)
export const historicoOs = mysqlTable("historico_os", {
  id: int("id").autoincrement().primaryKey(),
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
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HistoricoOs = typeof historicoOs.$inferSelect;
export type InsertHistoricoOs = typeof historicoOs.$inferInsert;

// ─── HISTÓRICO DE ORÇAMENTOS ──────────────────────────────────────────────────
// Dados importados do relatório XLS de Orçamentos do ERP
export const historicoOrcamentos = mysqlTable("historico_orcamentos", {
  id: int("id").autoincrement().primaryKey(),
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
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type HistoricoOrcamento = typeof historicoOrcamentos.$inferSelect;
export type InsertHistoricoOrcamento = typeof historicoOrcamentos.$inferInsert;

// ─── CRM Comercial ────────────────────────────────────────────────────────────

// Metas mensais por vendedor
export const crmMetas = mysqlTable("crm_metas", {
  id: int("id").autoincrement().primaryKey(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  mes: int("mes").notNull(),          // 1-12
  ano: int("ano").notNull(),
  metaValor: decimal("metaValor", { precision: 14, scale: 2 }).default("0").notNull(),
  metaQtdOs: int("metaQtdOs").default(0).notNull(),
  usuarioVinculadoId: int("usuarioVinculadoId"),  // FK para local_users.id
  usuarioVinculadoNome: varchar("usuarioVinculadoNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrmMeta = typeof crmMetas.$inferSelect;
export type InsertCrmMeta = typeof crmMetas.$inferInsert;

// Contatos registrados por vendedor em cada orçamento
export const crmContatos = mysqlTable("crm_contatos", {
  id: int("id").autoincrement().primaryKey(),
  orcamentoId: varchar("orcamentoId", { length: 32 }).notNull(), // sequencial do orçamento no ERP
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  empresa: varchar("empresa", { length: 256 }).notNull(),
  numeroContato: int("numeroContato").notNull(), // 1 ou 2
  canal: mysqlEnum("canal", ["whatsapp", "telefone", "email", "visita", "outro", "perdida", "nao_retornou", "esperando_cliente", "garantiu_fechamento"]).default("whatsapp").notNull(),
  observacao: text("observacao"),
  contatadoEm: timestamp("contatadoEm").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrmContato = typeof crmContatos.$inferSelect;
export type InsertCrmContato = typeof crmContatos.$inferInsert;

// ─── Overrides manuais de status de cliente ───────────────────────────────────
// Permite marcar manualmente um cliente como "recorrente" para corrigir
// casos onde o histórico pré-2024 não está no banco
export const clienteOverrides = mysqlTable("cliente_overrides", {
  id: int("id").autoincrement().primaryKey(),
  empresa: varchar("empresa", { length: 256 }).notNull().unique(), // nome normalizado (lowercase, sem acentos)
  empresaOriginal: varchar("empresaOriginal", { length: 256 }).notNull(), // nome como aparece no ERP
  status: mysqlEnum("status", ["recorrente", "novo"]).notNull().default("recorrente"),
  motivo: text("motivo"), // justificativa do override
  criadoPor: varchar("criadoPor", { length: 128 }), // nome do usuário que criou
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClienteOverride = typeof clienteOverrides.$inferSelect;
export type InsertClienteOverride = typeof clienteOverrides.$inferInsert;

// ─── Custo de Marketing por mês ───────────────────────────────────────────────
// Armazena o investimento mensal em marketing para cálculo de CAC e ROI
export const custoMarketing = mysqlTable("custo_marketing", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  investimento: decimal("investimento", { precision: 14, scale: 2 }).notNull().default("0"),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoMarketing = typeof custoMarketing.$inferSelect;
export type InsertCustoMarketing = typeof custoMarketing.$inferInsert;

// ─── Custos Fixos Mensais ─────────────────────────────────────────────────────
// Despesas fixas e recorrentes da empresa (salários, aluguel, serviços, etc.)
export const custosFixos = mysqlTable("custos_fixos", {
  id: int("id").autoincrement().primaryKey(),
  plano: varchar("plano", { length: 256 }).notNull(),          // ex: "2.5.1.2 - Salários"
  categoria: varchar("categoria", { length: 128 }).notNull(),  // ex: "Salários"
  grupoCategoria: varchar("grupoCategoria", { length: 64 }).notNull(), // ex: "Pessoal", "Operacional", "Financeiro"
  fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
  tipo: varchar("tipo", { length: 64 }).notNull(),             // "Fixa", "Variavel", "Operacional", "Pagamento Colaborador"
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull().default("0"),
  vencimento: int("vencimento"),                               // dia do mês (ex: 30)
  observacao: text("observacao"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoFixo = typeof custosFixos.$inferSelect;
export type InsertCustoFixo = typeof custosFixos.$inferInsert;

// ─── Dívidas e Parcelamentos ──────────────────────────────────────────────────
// Empréstimos, financiamentos, consórcios e parcelamentos com valores mensais
export const dividasParcelamentos = mysqlTable("dividas_parcelamentos", {
  id: int("id").autoincrement().primaryKey(),
  plano: varchar("plano", { length: 256 }).notNull(),
  categoria: varchar("categoria", { length: 128 }).notNull(),
  fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
  // Valores mensais de 2026
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
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DividaParcelamento = typeof dividasParcelamentos.$inferSelect;
export type InsertDividaParcelamento = typeof dividasParcelamentos.$inferInsert;

// ─── DRE Mensal (dados de fechamento financeiro) ──────────────────────────────
export const dreMensal = mysqlTable("dre_mensal", {
  id: int("id").autoincrement().primaryKey(),
  ano: int("ano").notNull(),
  mes: int("mes").notNull(), // 1-12
  // Receitas
  receitaOperacionalBruta: decimal("receita_operacional_bruta", { precision: 14, scale: 2 }),
  receitaFinanceira: decimal("receita_financeira", { precision: 14, scale: 2 }),
  receitaNaoOperacional: decimal("receita_nao_operacional", { precision: 14, scale: 2 }),
  totalEntradas: decimal("total_entradas", { precision: 14, scale: 2 }),
  // Deduções
  impostosVendas: decimal("impostos_vendas", { precision: 14, scale: 2 }),
  despesaVariavel: decimal("despesa_variavel", { precision: 14, scale: 2 }),
  despesaOperacional: decimal("despesa_operacional", { precision: 14, scale: 2 }),
  // Custos
  materiaPrima: decimal("materia_prima", { precision: 14, scale: 2 }),
  gastosGeraisFabricacao: decimal("gastos_gerais_fabricacao", { precision: 14, scale: 2 }),
  despesasPessoal: decimal("despesas_pessoal", { precision: 14, scale: 2 }),
  despesasFixas: decimal("despesas_fixas", { precision: 14, scale: 2 }),
  despesasFinanceiras: decimal("despesas_financeiras", { precision: 14, scale: 2 }),
  despesasNaoOperacionais: decimal("despesas_nao_operacionais", { precision: 14, scale: 2 }),
  totalSaidas: decimal("total_saidas", { precision: 14, scale: 2 }),
  // Resultados DRE
  receitaBrutaOperacional: decimal("receita_bruta_operacional", { precision: 14, scale: 2 }),
  lucroBruto: decimal("lucro_bruto", { precision: 14, scale: 2 }),
  lucroOperacional: decimal("lucro_operacional", { precision: 14, scale: 2 }),
  lucroLiquido: decimal("lucro_liquido", { precision: 14, scale: 2 }),
  // Dados de vendas
  valorPedidos: decimal("valor_pedidos", { precision: 14, scale: 2 }),
  resultadoEfetivo: decimal("resultado_efetivo", { precision: 14, scale: 2 }),
  margemResultadoEfetivo: decimal("margem_resultado_efetivo", { precision: 8, scale: 4 }),
  // Composição de custos (% sobre pedidos)
  percMateriaPrima: decimal("perc_materia_prima", { precision: 8, scale: 4 }),
  percFixoRateado: decimal("perc_fixo_rateado", { precision: 8, scale: 4 }),
  percTributos: decimal("perc_tributos", { precision: 8, scale: 4 }),
  percComissaoInterna: decimal("perc_comissao_interna", { precision: 8, scale: 4 }),
  percDescontos: decimal("perc_descontos", { precision: 8, scale: 4 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type DreMensal = typeof dreMensal.$inferSelect;
export type InsertDreMensal = typeof dreMensal.$inferInsert;

// Scripts de vendas por faixa do CRM
export const crmScripts = mysqlTable("crm_scripts", {
  id: int("id").autoincrement().primaryKey(),
  faixa: int("faixa").notNull(), // 1, 2 ou 3
  ordem: int("ordem").notNull().default(0),
  titulo: varchar("titulo", { length: 128 }),
  conteudo: mediumtext("conteudo").notNull(),
  conteudo_voz: mediumtext("conteudo_voz"), // script alternativo para áudio/voz
  ativo: boolean("ativo").notNull().default(true),
  copia_count: int("copia_count").notNull().default(0), // contador de cópias
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrmScript = typeof crmScripts.$inferSelect;
export type InsertCrmScript = typeof crmScripts.$inferInsert;

// Cache de Inteligência de Clientes (calculado sob demanda, salvo para carregamento rápido)
export const inteligenciaClientesCache = mysqlTable("inteligencia_clientes_cache", {
  id: int("id").autoincrement().primaryKey(),
  periodoKey: varchar("periodo_key", { length: 32 }).notNull(), // ex: "2025-01_2025-12" ou "2026-01_2026-05"
  dadosJson: mediumtext("dados_json").notNull(), // JSON com todos os indicadores calculados
  calculadoEm: timestamp("calculado_em").defaultNow().notNull(),
  congelado: boolean("congelado").default(false).notNull(), // se true, dados protegidos contra sobrescrita automática
  congeladoEm: timestamp("congelado_em"), // data/hora do congelamento
});
export type InteligenciaClientesCache = typeof inteligenciaClientesCache.$inferSelect;
export type InsertInteligenciaClientesCache = typeof inteligenciaClientesCache.$inferInsert;

// Tipos de LED para cálculo de custo
export const ledTipos = mysqlTable("led_tipos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  descricao: text("descricao"),
  custoUnitario: decimal("custo_unitario", { precision: 10, scale: 4 }).notNull().default("0"),
  unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
  ativo: varchar("ativo", { length: 4 }).notNull().default("sim"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LedTipo = typeof ledTipos.$inferSelect;
export type InsertLedTipo = typeof ledTipos.$inferInsert;

// Lançamentos de custo de LED por OS
export const custoLedLancamentos = mysqlTable("custo_led_lancamentos", {
  id: int("id").autoincrement().primaryKey(),
  os: varchar("os", { length: 64 }).notNull(),
  ledTipoId: int("led_tipo_id").notNull(),
  ledTipoEfetivoId: int("led_tipo_efetivo_id"),
  qtdPrevista: decimal("qtd_prevista", { precision: 10, scale: 4 }).notNull().default("0"),
  qtdEfetiva: decimal("qtd_efetiva", { precision: 10, scale: 4 }),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  observacao: text("observacao"),
  vendedor: varchar("vendedor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CustoLedLancamento = typeof custoLedLancamentos.$inferSelect;
export type InsertCustoLedLancamento = typeof custoLedLancamentos.$inferInsert;

// Etiquetas das faixas do CRM (editáveis pelo admin)
export const crmFaixaEtiquetas = mysqlTable("crm_faixa_etiquetas", {
  id: int("id").autoincrement().primaryKey(),
  faixa: int("faixa").notNull(), // 1, 2 ou 3
  label: varchar("label", { length: 128 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CrmFaixaEtiqueta = typeof crmFaixaEtiquetas.$inferSelect;
export type InsertCrmFaixaEtiqueta = typeof crmFaixaEtiquetas.$inferInsert;

// Auditoria e congelamento de dados da Performance Comercial
export const performanceAuditada = mysqlTable("performance_auditada", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  // Dados validados
  cotacoes: int("cotacoes").notNull().default(0),
  osNormais: int("os_normais").notNull().default(0),
  taxaConversao: decimal("taxa_conversao", { precision: 5, scale: 2 }).notNull().default("0"),
  faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
  valorOrcado: decimal("valor_orcado", { precision: 14, scale: 2 }).notNull().default("0"),
  clientesNovos: int("clientes_novos").notNull().default(0),
  cotacoesNovos: int("cotacoes_novos").notNull().default(0),
  taxaConvNovos: decimal("taxa_conv_novos", { precision: 5, scale: 2 }).notNull().default("0"),
  faturamentoNovos: decimal("faturamento_novos", { precision: 14, scale: 2 }).notNull().default("0"),
  // Metadados de auditoria
  statusValidacao: mysqlEnum("status_validacao", ["pendente", "validado", "corrigido_excel"]).notNull().default("pendente"),
  congelado: boolean("congelado").notNull().default(false),
  fonteExcel: varchar("fonte_excel", { length: 512 }),
  observacoes: text("observacoes"),
  auditadoPor: varchar("auditado_por", { length: 128 }).notNull().default("sistema"),
  dataAuditoria: timestamp("data_auditoria").defaultNow().notNull(),
  dataCongelamento: timestamp("data_congelamento"),
  // Lista de clientes novos serializada como JSON (salva ao congelar o mês)
  listaClientesNovos: mediumtext("lista_clientes_novos"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PerformanceAuditada = typeof performanceAuditada.$inferSelect;
export type InsertPerformanceAuditada = typeof performanceAuditada.$inferInsert;

// Controle de contato com clientes novos (checkbox "Contatado" na tabela de Clientes Novos)
export const clienteNovosContato = mysqlTable("cliente_novos_contato", {
  id: int("id").autoincrement().primaryKey(),
  empresa: varchar("empresa", { length: 256 }).notNull(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  contatado: boolean("contatado").notNull().default(false),
  dataContato: timestamp("data_contato"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type ClienteNovosContato = typeof clienteNovosContato.$inferSelect;
export type InsertClienteNovosContato = typeof clienteNovosContato.$inferInsert;

// Cache persistente de dados brutos da API MubiSys (sobrevive a reinicializações do servidor)
// TTL: 5 minutos para o mês atual, 6 horas para meses históricos
export const mubisysApiCache = mysqlTable("mubisys_api_cache", {
  id: int("id").autoincrement().primaryKey(),
  cacheKey: varchar("cache_key", { length: 64 }).notNull().unique(),
  mes: int("mes").notNull(),
  ano: int("ano").notNull(),
  // Dados brutos serializados como JSON
  osData: mediumtext("os_data"),     // Array de OS brutas da API
  orcData: mediumtext("orc_data"),   // Array de orçamentos brutos da API
  // Controle de validade
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type MubisysApiCache = typeof mubisysApiCache.$inferSelect;
export type InsertMubisysApiCache = typeof mubisysApiCache.$inferInsert;

// ─── Log de Atividade do CRM por Vendedor ─────────────────────────────────────
// Registra cada ação realizada no CRM para auditoria de uso (manhã/tarde, velocidade, etc.)
export const crmAtividadeLog = mysqlTable("crm_atividade_log", {
  id: int("id").autoincrement().primaryKey(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),       // nome do vendedor
  localUserId: int("local_user_id"),                              // id do local_user (se disponível)
  acao: varchar("acao", { length: 64 }).notNull(),                // ex: "registrarContato", "marcarGanha", "marcarPerdida"
  orcamentoId: varchar("orcamento_id", { length: 32 }),           // orçamento relacionado (se houver)
  empresa: varchar("empresa", { length: 256 }),                   // empresa relacionada (se houver)
  detalhe: varchar("detalhe", { length: 512 }),                   // info extra (canal, obs resumida, etc.)
  realizadaEm: timestamp("realizada_em").defaultNow().notNull(),  // timestamp exato da ação
  turno: mysqlEnum("turno", ["manha", "tarde", "noite"]).notNull(), // calculado no servidor
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrmAtividadeLog = typeof crmAtividadeLog.$inferSelect;
export type InsertCrmAtividadeLog = typeof crmAtividadeLog.$inferInsert;


// Dados Financeiros Mensais (integração com relatórios financeiros)
export const financeirosMensais = mysqlTable("financeiros_mensais", {
  id: int("id").autoincrement().primaryKey(),
  mes: int("mes").notNull(), // 1-12
  ano: int("ano").notNull(), // 2026, 2027, etc
  // Receitas
  receitaBruta: decimal("receita_bruta", { precision: 14, scale: 2 }).notNull().default("0"),
  receitaOperacional: decimal("receita_operacional", { precision: 14, scale: 2 }).notNull().default("0"),
  receitaFinanceira: decimal("receita_financeira", { precision: 14, scale: 2 }).notNull().default("0"),
  // Despesas
  despesasTotal: decimal("despesas_total", { precision: 14, scale: 2 }).notNull().default("0"),
  despesasFixas: decimal("despesas_fixas", { precision: 14, scale: 2 }).notNull().default("0"),
  despesasVariaveis: decimal("despesas_variaveis", { precision: 14, scale: 2 }).notNull().default("0"),
  despesasPessoal: decimal("despesas_pessoal", { precision: 14, scale: 2 }).notNull().default("0"),
  despesasFinanceiras: decimal("despesas_financeiras", { precision: 14, scale: 2 }).notNull().default("0"),
  despesasImpostos: decimal("despesas_impostos", { precision: 14, scale: 2 }).notNull().default("0"),
  // Resultados
  lucroGruto: decimal("lucro_gruto", { precision: 14, scale: 2 }).notNull().default("0"),
  lucroOperacional: decimal("lucro_operacional", { precision: 14, scale: 2 }).notNull().default("0"),
  lucroLiquido: decimal("lucro_liquido", { precision: 14, scale: 2 }).notNull().default("0"),
  // Fluxo de Caixa
  entradas: decimal("entradas", { precision: 14, scale: 2 }).notNull().default("0"),
  saidas: decimal("saidas", { precision: 14, scale: 2 }).notNull().default("0"),
  saldoMes: decimal("saldo_mes", { precision: 14, scale: 2 }).notNull().default("0"),
  // Metadados
  fonte: varchar("fonte", { length: 64 }).default("manual"), // manual, excel, api
  fonteArquivo: varchar("fonte_arquivo", { length: 256 }), // nome do arquivo Excel
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FinanceiroMensal = typeof financeirosMensais.$inferSelect;
export type InsertFinanceiroMensal = typeof financeirosMensais.$inferInsert;


// Desenho de Cargos e Funções
export const cargos = mysqlTable("cargos", {
  id: int("id").autoincrement().primaryKey(),
  titulo: varchar("titulo", { length: 256 }).notNull().unique(),
  missao: text("missao").notNull(), // Missão estratégica do cargo
  subordinacao: varchar("subordinacao", { length: 256 }), // Reporta-se a...
  setor: varchar("setor", { length: 128 }).notNull(), // Setor/Departamento
  regimeTrabalho: varchar("regime_trabalho", { length: 128 }), // Presencial, Híbrido, Remoto
  jornada: varchar("jornada", { length: 256 }), // Descrição da jornada
  limites: text("limites"), // O que NÃO faz
  condicoesTrabalho: text("condicoes_trabalho"), // Detalhes de trabalho
  requisitos: text("requisitos"), // Requisitos técnicos e perfil
  gestaoRiscos: text("gestao_riscos"), // Gestão de riscos e EPIs
  ferramentasRecursos: text("ferramentas_recursos"), // Ferramentas e recursos
  integracaoFluxo: text("integracao_fluxo"), // Integração e fluxo de trabalho
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cargo = typeof cargos.$inferSelect;
export type InsertCargo = typeof cargos.$inferInsert;

// Responsabilidades e Funções por Cargo
export const responsabilidadesCargo = mysqlTable("responsabilidades_cargo", {
  id: int("id").autoincrement().primaryKey(),
  cargoId: int("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao").notNull(),
  ordem: int("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ResponsabilidadeCargo = typeof responsabilidadesCargo.$inferSelect;
export type InsertResponsabilidadeCargo = typeof responsabilidadesCargo.$inferInsert;

// KPIs por Cargo
export const kpisCargo = mysqlTable("kpis_cargo", {
  id: int("id").autoincrement().primaryKey(),
  cargoId: int("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao").notNull(),
  meta: varchar("meta", { length: 256 }), // Ex: "0%", "100%", "85,0h"
  ordem: int("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type KpiCargo = typeof kpisCargo.$inferSelect;
export type InsertKpiCargo = typeof kpisCargo.$inferInsert;

// ─── Análise de Currículos com IA ─────────────────────────────────────────────
export const analiseCurriculos = mysqlTable("analise_curriculos", {
  id: int("id").autoincrement().primaryKey(),
  cargoId: int("cargoId").notNull().references(() => cargosFuncoes.id, { onDelete: "cascade" }),
  // Arquivo do currículo
  curriculoFileName: varchar("curriculoFileName", { length: 256 }).notNull(),
  curriculoUrl: text("curriculoUrl").notNull(),
  curriculoKey: text("curriculoKey").notNull(),
  // Resultado da análise
  resultado: text("resultado"), // JSON com análise estruturada (aprovado/reprovado + motivo)
  status: mysqlEnum("status", ["pendente", "analisando", "concluido", "erro"]).default("pendente").notNull(),
  erroMensagem: text("erroMensagem"), // Mensagem de erro se análise falhar
  // Metadados
  uploadedBy: varchar("uploadedBy", { length: 128 }),
  uploadedByName: varchar("uploadedByName", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AnaliseCurriculo = typeof analiseCurriculos.$inferSelect;
export type InsertAnaliseCurriculo = typeof analiseCurriculos.$inferInsert;


// ─── PCP: Programa de Controle de Produção ──────────────────────────────────────

// Feriados (para cálculo de dias úteis)
export const feriados = mysqlTable("feriados", {
  id: int("id").autoincrement().primaryKey(),
  data: date("data").notNull().unique(),
  descricao: varchar("descricao", { length: 128 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Feriado = typeof feriados.$inferSelect;
export type InsertFeriado = typeof feriados.$inferInsert;

// Motivos de atraso (biblioteca)
export const motivosAtraso = mysqlTable("motivos_atraso", {
  id: int("id").autoincrement().primaryKey(),
  motivo: varchar("motivo", { length: 256 }).notNull().unique(),
  ativo: boolean("ativo").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type MotivoAtraso = typeof motivosAtraso.$inferSelect;
export type InsertMotivoAtraso = typeof motivosAtraso.$inferInsert;

// Ordens de Produção (espelhadas do MubiSys)
export const producaoOrdens = mysqlTable("producao_ordens", {
  id: int("id").autoincrement().primaryKey(),
  osNumero: varchar("osNumero", { length: 32 }).notNull().unique(),
  clienteNome: varchar("clienteNome", { length: 256 }).notNull(),
  clienteId: varchar("clienteId", { length: 64 }), // ID do cliente no MubiSys
  descricaoPedido: text("descricaoPedido"),
  dataEntrada: date("dataEntrada").notNull(), // Data de entrada no MubiSys
  dataPrazo: date("dataPrazo").notNull(), // Prazo de entrega calculado
  diasUteisTotais: int("diasUteisTotais").notNull(), // Total de dias úteis alocados
  statusGeral: mysqlEnum("statusGeral", ["nao_iniciado", "em_andamento", "concluido", "atrasado"]).default("nao_iniciado").notNull(),
  temPintura: boolean("temPintura").default(false).notNull(),
  temPvcExpandido: boolean("temPvcExpandido").default(false).notNull(),
  temAcrilico: boolean("temAcrilico").default(false).notNull(),
  temGalvanizado: boolean("temGalvanizado").default(false).notNull(),
  temInox: boolean("temInox").default(false).notNull(),
  temPerfil: boolean("temPerfil").default(false).notNull(),
  temLed: boolean("temLed").default(false).notNull(),
  temAdesivo: boolean("temAdesivo").default(false).notNull(),
  temGabarito: boolean("temGabarito").default(false).notNull(),
  criadoPor: varchar("criadoPor", { length: 128 }),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type ProducaoOrdem = typeof producaoOrdens.$inferSelect;
export type InsertProducaoOrdem = typeof producaoOrdens.$inferInsert;

// Setores de Produção (um por ordem)
export const producaoSetores = mysqlTable("producao_setores", {
  id: int("id").autoincrement().primaryKey(),
  ordemId: int("ordemId").notNull().references(() => producaoOrdens.id, { onDelete: "cascade" }),
  setorNome: varchar("setorNome", { length: 128 }).notNull(), // projeto, corte_laser, corte_router, etc
  sequencia: int("sequencia").notNull(), // Ordem de execução (1, 2, 3, ...)
  status: mysqlEnum("status", ["nao_iniciado", "em_andamento", "concluido", "atrasado", "bloqueado"]).default("nao_iniciado").notNull(),
  diasAlocados: int("diasAlocados").notNull(), // Dias úteis alocados para este setor
  dataInicio: date("dataInicio"), // Data de início real
  dataFim: date("dataFim"), // Data de conclusão real
  dataFimPrevista: date("dataFimPrevista").notNull(), // Data de conclusão esperada
  emRisco: boolean("emRisco").default(false).notNull(), // Se está em risco de atraso
  dependeDe: varchar("dependeDe", { length: 256 }), // Setores dos quais depende (JSON array ou CSV)
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type ProducaoSetor = typeof producaoSetores.$inferSelect;
export type InsertProducaoSetor = typeof producaoSetores.$inferInsert;

// Alertas de Produção
export const producaoAlertas = mysqlTable("producao_alertas", {
  id: int("id").autoincrement().primaryKey(),
  ordemId: int("ordemId").notNull().references(() => producaoOrdens.id, { onDelete: "cascade" }),
  setorId: int("setorId").references(() => producaoSetores.id, { onDelete: "cascade" }),
  tipoAlerta: mysqlEnum("tipoAlerta", ["em_risco", "atrasado", "bloqueado", "dependencia_nao_concluida"]).notNull(),
  motivo: varchar("motivo", { length: 256 }),
  motivoAtrasoId: int("motivoAtrasoId").references(() => motivosAtraso.id),
  descricao: text("descricao"),
  resolvido: boolean("resolvido").default(false).notNull(),
  resolvidoEm: timestamp("resolvidoEm"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
  atualizadoEm: timestamp("atualizadoEm").defaultNow().onUpdateNow().notNull(),
});

export type ProducaoAlerta = typeof producaoAlertas.$inferSelect;
export type InsertProducaoAlerta = typeof producaoAlertas.$inferInsert;

// Histórico de Alterações de Prazos (auditoria)
export const producaoHistoricoAltracoes = mysqlTable("producao_historico_alteracoes", {
  id: int("id").autoincrement().primaryKey(),
  ordemId: int("ordemId").notNull().references(() => producaoOrdens.id, { onDelete: "cascade" }),
  setorId: int("setorId").references(() => producaoSetores.id, { onDelete: "cascade" }),
  tipoAlteracao: varchar("tipoAlteracao", { length: 128 }).notNull(), // "prazo_alterado", "status_alterado", etc
  valorAnterior: text("valorAnterior"),
  valorNovo: text("valorNovo"),
  motivo: text("motivo"),
  alteradoPor: varchar("alteradoPor", { length: 128 }).notNull(),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});

export type ProducaoHistoricoAlteracao = typeof producaoHistoricoAltracoes.$inferSelect;
export type InsertProducaoHistoricoAlteracao = typeof producaoHistoricoAltracoes.$inferInsert;
