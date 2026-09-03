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
  varchar,
} from "drizzle-orm/pg-core";

// ─── ENUMS (Postgres exige tipos nomeados; MySQL permitia enum inline) ───────

export const tipoRegistroEnum = pgEnum("tipo_registro", ["retrabalho", "cnq"]);
export const retrabalhoTipoEnum = pgEnum("retrabalho_tipo", ["INTERNO", "EXTERNO"]);
export const tipoResponsavelEnum = pgEnum("tipo_responsavel", ["operador", "gestor"]);
export const retrabalhoClasseEnum = pgEnum("retrabalho_classe", ["EVITÁVEL", "INEVITÁVEL"]);
export const simNaoEnum = pgEnum("sim_nao", ["sim", "nao"]);
export const routineFrequencyEnum = pgEnum("routine_frequency", ["diaria", "semanal", "quinzenal", "mensal", "esporadico", "daily", "weekly", "monthly", "quarterly", "yearly", "custom"]);
export const routineStatusEnum = pgEnum("routine_status", ["pendente", "em_dia", "atrasada"]);
export const regulationTypeEnum = pgEnum("regulation_type", ["regulamento", "memorando", "politica", "procedimento"]);
export const popAcessoTipoEnum = pgEnum("pop_acesso_tipo", ["visualizacao", "download"]);
export const formaCotacaoEnum = pgEnum("forma_cotacao", ["site", "whatsapp", "telefone", "email"]);
// Vocabulário do Kanban de fretes (client/src/pages/logistica/Solicitacoes.tsx) — mesmo do MySQL/TiDB original.
export const cotacaoStatusEnum = pgEnum("cotacao_status", ["aberta", "cotando", "selecao", "cotada", "enviada", "cancelada"]);
export const tipoPrazoEnum = pgEnum("tipo_prazo", ["uteis", "corridos"]);
export const modalidadeFreteEnum = pgEnum("modalidade_frete", ["cif", "fob"]);
export const auditoriaAcaoEnum = pgEnum("auditoria_acao", ["CRIACAO", "EDICAO", "EXCLUSAO"]);
export const kanbanStatusEnum = pgEnum("kanban_status", ["aguardando", "embalando", "patio", "abandonado"]);
export const acaoCorretivaStatusEnum = pgEnum("acao_corretiva_status", ["aberto", "em_tratamento", "resolvido"]);
export const planoAcaoStatusEnum = pgEnum("plano_acao_status", ["pendente", "em_andamento", "concluido", "monitorando"]);
export const ishikawaCategoriaEnum = pgEnum("ishikawa_categoria", ["maquina", "mao_de_obra", "material", "metodo", "medida", "meio_ambiente"]);
export const prioridadeEnum = pgEnum("prioridade", ["alta", "media", "baixa"]);
export const acao5w2hStatusEnum = pgEnum("acao_5w2h_status", ["pendente", "em_andamento", "concluido"]);
export const alertaTipoEnum = pgEnum("alerta_tipo", ["reincidencia", "meta_excedida", "sem_acao", "prazo_vencido", "novo_retrabalho", "atraso_expedicao", "manual"]);
export const alertaSeveridadeEnum = pgEnum("alerta_severidade", ["info", "aviso", "critico"]);
export const alertaStatusEnum = pgEnum("alerta_status", ["ativo", "lido", "arquivado"]);
export const abcTipoEnum = pgEnum("abc_tipo", ["clientes", "produtos"]);
export const crmCanalEnum = pgEnum("crm_canal", ["whatsapp", "telefone", "email", "visita", "outro", "perdida", "nao_retornou", "esperando_cliente", "garantiu_fechamento"]);
export const clienteOverrideStatusEnum = pgEnum("cliente_override_status", ["recorrente", "novo"]);
export const statusValidacaoEnum = pgEnum("status_validacao", ["pendente", "validado", "corrigido_excel"]);
export const turnoEnum = pgEnum("turno", ["manha", "tarde", "noite"]);
export const analiseCurriculoStatusEnum = pgEnum("analise_curriculo_status", ["pendente", "analisando", "concluido", "erro"]);
export const syncStatusEnum = pgEnum("sync_status", ["SUCESSO", "ERRO", "PENDENTE"]);
// Enums das 13 tabelas que não estavam declaradas no schema (existem no banco real)
export const clienteCadastroStatusEnum = pgEnum("cliente_cadastro_status", ["ativo", "inativo", "prospect"]);
export const crmPropostaStatusEnum = pgEnum("crm_proposta_status", ["prospeccao", "proposta_enviada", "negociacao", "ganho", "perdido", "cancelado"]);
export const cnqTipoEnum = pgEnum("cnq_tipo", ["interno", "externo"]);
export const abcClassificacaoEnum = pgEnum("abc_classificacao", ["A", "B", "C"]);
export const planoAcaoComercialStatusEnum = pgEnum("plano_acao_comercial_status", ["pendente", "em_andamento", "concluido", "cancelado"]);
export const prioridadeComCriticaEnum = pgEnum("prioridade_com_critica", ["baixa", "media", "alta", "critica"]);

// Biblioteca de classificação de erros
export const errorLibrary = pgTable("error_library", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 20 }).notNull().unique(),
  category: varchar("category", { length: 64 }).notNull(),
  description: text("description").notNull(),
  correction: text("correction").notNull(),
  imageUrl: text("imageUrl"), // URL da imagem de referência (S3)
  imageKey: text("imageKey"), // chave S3
  tipoRegistro: tipoRegistroEnum("tipoRegistro").default("retrabalho").notNull(), // Retrabalho ou Custo da Não-Qualidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ErrorLibraryItem = typeof errorLibrary.$inferSelect;
export type InsertErrorLibraryItem = typeof errorLibrary.$inferInsert;

// Ocorrências de retrabalho
export const retrabalhos = pgTable("retrabalhos", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 256 }),
  osRetrabalhada: varchar("osRetrabalhada", { length: 32 }), // Opcional para CNQ
  osOriginal: varchar("osOriginal", { length: 64 }), // Opcional para CNQ
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
  tipoRegistro: tipoRegistroEnum("tipoRegistro").default("retrabalho").notNull(), // Retrabalho ou Custo da Não-Qualidade
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Retrabalho = typeof retrabalhos.$inferSelect;
export type InsertRetrabalho = typeof retrabalhos.$inferInsert;

// Faturamento mensal para cálculo de KPIs
export const faturamento = pgTable("faturamento", {
  id: serial("id").primaryKey(),
  mes: varchar("mes", { length: 20 }).notNull(),
  ano: integer("ano").notNull(),
  valorFaturado: decimal("valorFaturado", { precision: 14, scale: 2 }).notNull(),
  totalPedidos: integer("totalPedidos").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  mesAnoUnique: uniqueIndex("faturamento_mes_ano_unique").on(t.mes, t.ano),
}));
export type Faturamento = typeof faturamento.$inferSelect;
export type InsertFaturamento = typeof faturamento.$inferInsert;

// ─── MÓDULOS DE OPERAÇÕES ────────────────────────────────────────────────────

// Base de Conhecimento
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 64 }).notNull(), // Comercial, Administrativo, Financeiro, Produção
  subcategory: varchar("subcategory", { length: 64 }),
  keywords: text("keywords"), // comma-separated
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type KnowledgeItem = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeItem = typeof knowledgeBase.$inferInsert;

// Fornecedores
export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  company: varchar("company", { length: 128 }),
  category: varchar("category", { length: 64 }).notNull(),
  supplies: text("supplies"), // insumos oferecidos
  contact: varchar("contact", { length: 128 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 128 }),
  paymentTerms: text("paymentTerms"),
  notes: text("notes"),
  active: simNaoEnum("active").default("sim").notNull(),
  createdByNome: varchar("createdByNome", { length: 128 }), // nome do usuário que cadastrou
  updatedByNome: varchar("updatedByNome", { length: 128 }), // nome do último editor
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Supplier = typeof suppliers.$inferSelect;
export type InsertSupplier = typeof suppliers.$inferInsert;

// Rotinas
export const routines = pgTable("routines", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description"),
  frequency: routineFrequencyEnum("frequency").notNull().default("semanal"),
  assignedTo: varchar("assignedTo", { length: 128 }),
  startDate: timestamp("startDate"),
  nextDue: timestamp("nextDue"),
  lastDone: timestamp("lastDone"),
  calendarDates: text("calendarDates"), // JSON array de datas ISO para esporádico
  status: routineStatusEnum("status").default("pendente").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Routine = typeof routines.$inferSelect;
export type InsertRoutine = typeof routines.$inferInsert;

// Regulamentos e Memorandos
export const regulations = pgTable("regulations", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }).notNull(),
  type: regulationTypeEnum("type").notNull(),
  content: text("content").notNull(),
  version: varchar("version", { length: 16 }).default("1.0"),
  active: simNaoEnum("active").default("sim").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Regulation = typeof regulations.$inferSelect;
export type InsertRegulation = typeof regulations.$inferInsert;

// POPs — Procedimentos Operacionais Padrão
export const pops = pgTable("pops", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // ex: POP-001
  title: varchar("title", { length: 256 }).notNull(),
  sector: varchar("sector", { length: 64 }).notNull(),
  objective: text("objective"),
  steps: text("steps").notNull(), // JSON array of steps
  responsible: varchar("responsible", { length: 128 }),
  version: varchar("version", { length: 16 }).default("1.0"),
  active: simNaoEnum("active").default("sim").notNull(),
  attachments: text("attachments"), // JSON array de URLs de imagens
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Pop = typeof pops.$inferSelect;
export type InsertPop = typeof pops.$inferInsert;

// Registro de acessos e downloads de POPs
export const popAcessos = pgTable("pop_acessos", {
  id: serial("id").primaryKey(),
  popId: integer("popId").notNull(),
  popCode: varchar("popCode", { length: 32 }).notNull(),
  popTitle: varchar("popTitle", { length: 256 }).notNull(),
  usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
  usuarioEmail: varchar("usuarioEmail", { length: 256 }),
  tipo: popAcessoTipoEnum("tipo").notNull().default("visualizacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PopAcesso = typeof popAcessos.$inferSelect;
export type InsertPopAcesso = typeof popAcessos.$inferInsert;

// Comentários e notas por artigo da Base de Conhecimento
export const knowledgeComments = pgTable("knowledge_comments", {
  id: serial("id").primaryKey(),
  knowledgeId: integer("knowledgeId").notNull(),
  author: varchar("author", { length: 128 }).notNull().default("Equipe"),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KnowledgeComment = typeof knowledgeComments.$inferSelect;
export type InsertKnowledgeComment = typeof knowledgeComments.$inferInsert;

// ─── MÓDULO COMERCIAL ──────────────────────────────────────────────────────

// Seções editáveis da Tabela de Preços (páginas 1-3 do PDF)
export const priceTableSections = pgTable("price_table_sections", {
  id: serial("id").primaryKey(),
  page: integer("page").notNull(), // 1, 2 ou 3 (editável) | 4, 5 (consulta)
  sectionOrder: integer("sectionOrder").notNull().default(0),
  sectionTitle: varchar("sectionTitle", { length: 256 }).notNull(),
  contentJson: text("contentJson").notNull(), // JSON com linhas da tabela
  notes: text("notes"), // observações em texto livre
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PriceTableSection = typeof priceTableSections.$inferSelect;
export type InsertPriceTableSection = typeof priceTableSections.$inferInsert;

// ─── METADADOS DA TABELA DE PREÇOS ──────────────────────────────────────────
export const priceTableMeta = pgTable("price_table_meta", {
  id: serial("id").primaryKey(),
  versao: varchar("versao", { length: 16 }).notNull().default("001"),
  dataModificacao: timestamp("dataModificacao").defaultNow().notNull(),
  descricao: text("descricao"),
});
export type PriceTableMeta = typeof priceTableMeta.$inferSelect;

// ─── HISTÓRICO DE VERSÕES DA TABELA DE PREÇOS ───────────────────────────────
export const priceTableHistory = pgTable("price_table_history", {
  id: serial("id").primaryKey(),
  versao: varchar("versao", { length: 16 }).notNull(),
  sectionId: integer("sectionId").notNull(),
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
export const appRoleEnum = pgEnum("app_role", APP_ROLES);

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
  "comercial-tabela-preco", "comercial-planos-acao", "comercial-geografia", "comercial-insights-ia",
  "qualidade-planos", "qualidade-desempenho",
  "logistica-cte", "logistica-insights-ia",
  "metricas",
] as const;
export type PageKey = typeof PAGE_KEYS[number];

// ─── BETTER AUTH (Fase 3 da migração) ───────────────────────────────────────
// Nomes de tabela/export em singular (user/session/account/verification) não
// seguem a convenção plural do resto deste arquivo — é o nome de modelo
// padrão que o drizzleAdapter do Better Auth espera encontrar como chave do
// módulo de schema. Substituem as antigas `local_users`/`users` (OAuth),
// removidas nesta mesma tarefa (Fase 3, Tarefa 3.2) junto com o código que
// as consumia.
export const user = pgTable("user", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type BetterAuthUser = typeof user.$inferSelect;
export type InsertBetterAuthUser = typeof user.$inferInsert;

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  impersonatedBy: text("impersonatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const account = pgTable("account", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});

// Permissões de acesso por role × página
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: appRoleEnum("role").notNull(),
  pageKey: varchar("pageKey", { length: 64 }).notNull(),
  canAccess: simNaoEnum("canAccess").default("nao").notNull(),
});
export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = typeof rolePermissions.$inferInsert;

// ─── MÓDULO LOGÍSTICA ──────────────────────────────────────────────────────

// Transportadoras parceiras
export const transportadoras = pgTable("transportadoras", {
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
  modais: text("modais"), // JSON array: ["rodoviario", "aereo"]
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
  ultAtualizTabela: varchar("ultAtualizTabela", { length: 16 }), // YYYY-MM-DD
  semTabelaNegociavel: simNaoEnum("semTabelaNegociavel").default("nao"),
  whatsappContatoNegocial: varchar("whatsappContatoNegocial", { length: 32 }),
  portalUrl: varchar("portalUrl", { length: 256 }),
  portalUsuario: varchar("portalUsuario", { length: 128 }),
  portalEmail: varchar("portalEmail", { length: 128 }),
  portalObservacao: text("portalObservacao"),
  portalSenha: varchar("portalSenha", { length: 256 }),
  ultAtualizCidades: varchar("ultAtualizCidades", { length: 16 }), // YYYY-MM-DD
  coberturaTotal: integer("coberturaTotal").default(0), // 1 = atende todos os municípios do Brasil
  contatoRastreio: text("contatoRastreio"),
  origem: varchar("origem", { length: 40 }).default("Manual").notNull(), // 'Frenet' | 'Manual'
  bairro: varchar("bairro", { length: 160 }),
  cep: varchar("cep", { length: 20 }),
  cidade: varchar("cidade", { length: 160 }),
  uf: varchar("uf", { length: 2 }),
  cnpj: varchar("cnpj", { length: 24 }),
  googleMapsUrl: varchar("googleMapsUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Transportadora = typeof transportadoras.$inferSelect;
export type InsertTransportadora = typeof transportadoras.$inferInsert;

// Avaliações de serviço das transportadoras
export const transportadoraAvaliacoes = pgTable("transportadora_avaliacoes", {
  id: serial("id").primaryKey(),
  transportadoraId: integer("transportadoraId").notNull(),
  estrelas: integer("estrelas").notNull(), // 1-5
  comentario: text("comentario"),
  autor: varchar("autor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type TransportadoraAvaliacao = typeof transportadoraAvaliacoes.$inferSelect;
export type InsertTransportadoraAvaliacao = typeof transportadoraAvaliacoes.$inferInsert;

// Filiais das transportadoras
export const transportadoraFiliais = pgTable("transportadora_filiais", {
  id: serial("id").primaryKey(),
  transportadoraId: integer("transportadoraId").notNull(),
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
export const transportadoraCidades = pgTable("transportadora_cidades", {
  id: serial("id").primaryKey(),
  transportadoraId: integer("transportadoraId").notNull(),
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
export const cotacoesFrete = pgTable("cotacoes_frete", {
  id: serial("id").primaryKey(),
  osNumero: varchar("osNumero", { length: 32 }),
  solicitanteId: text("solicitanteId"), // user.id (Better Auth)
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
  osAprovacao: varchar("osAprovacao", { length: 64 }), // texto livre vindo do cache MubiSys, ex: "17/07/2026 às 10:36"
  osEntrega: varchar("osEntrega", { length: 64 }),
  osVendedor: varchar("osVendedor", { length: 128 }),
  transportadoraSelecionadaId: integer("transportadoraSelecionadaId"),
  horarioDecisaoMs: varchar("horarioDecisaoMs", { length: 8 }), // ex: "14:30" — horário limite de decisão no fuso MS
  dataSource: varchar("dataSource", { length: 32 }), // 'mub' | 'brasilapi' | null
  tipoMaterial: varchar("tipoMaterial", { length: 256 }),
  dataEntregaPrevista: date("dataEntregaPrevista"),
  dataDespacho: timestamp("dataDespacho"),
  temRetrabalho: boolean("temRetrabalho").default(false),
  tipoRetrabalho: varchar("tipoRetrabalho", { length: 64 }),
  motivoRetrabalho: text("motivoRetrabalho"),
  retrabalhoVinculadoId: integer("retrabalhoVinculadoId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CotacaoFrete = typeof cotacoesFrete.$inferSelect;
export type InsertCotacaoFrete = typeof cotacoesFrete.$inferInsert;

// Opções de cotação oferecidas pela logística
export const cotacaoOpcoes = pgTable("cotacao_opcoes", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CotacaoOpcao = typeof cotacaoOpcoes.$inferSelect;
export type InsertCotacaoOpcao = typeof cotacaoOpcoes.$inferInsert;

// Comentários internos por cotação
export const cotacaoComentarios = pgTable("cotacao_comentarios", {
  id: serial("id").primaryKey(),
  cotacaoId: integer("cotacaoId").notNull(),
  autorId: text("autorId"), // user.id (Better Auth)
  autorNome: varchar("autorNome", { length: 128 }).notNull().default("Sistema"),
  texto: text("texto"),
  audioUrl: varchar("audioUrl", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CotacaoComentario = typeof cotacaoComentarios.$inferSelect;
export type InsertCotacaoComentario = typeof cotacaoComentarios.$inferInsert;

// Importações de CT-e
export const cteImportacoes = pgTable("cte_importacoes", {
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
  rawData: text("rawData"), // JSON com dados brutos do CT-e
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CteImportacao = typeof cteImportacoes.$inferSelect;
export type InsertCteImportacao = typeof cteImportacoes.$inferInsert;

// ─── VISÃO DE PERFORMANCE MENSAL ─────────────────────────────────────────────
export const performanceMensal = pgTable("performance_mensal", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PerformanceMensal = typeof performanceMensal.$inferSelect;
export type InsertPerformanceMensal = typeof performanceMensal.$inferInsert;

// ─── Auditoria de Retrabalhos ──────────────────────────────────────────────
export const auditoriaRetrabalhos = pgTable("auditoria_retrabalhos", {
  id: serial("id").primaryKey(),
  retrabalhoId: integer("retrabalhoId"),
  osRetrabalhada: varchar("osRetrabalhada", { length: 32 }),
  osOriginal: varchar("osOriginal", { length: 64 }),
  acao: auditoriaAcaoEnum("acao").notNull(),
  usuarioId: text("usuarioId"), // user.id (Better Auth)
  usuarioNome: varchar("usuarioNome", { length: 128 }),
  usuarioRole: varchar("usuarioRole", { length: 32 }),
  detalhes: text("detalhes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AuditoriaRetrabalho = typeof auditoriaRetrabalhos.$inferSelect;
export type InsertAuditoriaRetrabalho = typeof auditoriaRetrabalhos.$inferInsert;

// ─── Cargos e Funções ─────────────────────────────────────────────────────────
export const cargosFuncoes = pgTable("cargos_funcoes", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CargoFuncao = typeof cargosFuncoes.$inferSelect;
export type InsertCargoFuncao = typeof cargosFuncoes.$inferInsert;

// ─── Módulo de Empacotamento/Expedição ───────────────────────────────────────

export const empacotamentoModelos = pgTable("empacotamento_modelos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  descricao: text("descricao"),
  modeloCaixaIdPadrao: integer("modeloCaixaIdPadrao"),
  tempoPorM2Min: decimal("tempoPorM2Min", { precision: 8, scale: 2 }),
  valorProdutividadePorMinLetreiro: decimal("valorProdutividadePorMinLetreiro", { precision: 10, scale: 4 }),
  ativo: integer("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoModelo = typeof empacotamentoModelos.$inferSelect;
export type InsertEmpacotamentoModelo = typeof empacotamentoModelos.$inferInsert;

export const empacotamentoTabelaPrecos = pgTable("empacotamento_tabela_precos", {
  id: serial("id").primaryKey(),
  modeloId: integer("modeloId").notNull(),
  tipoCaixa: varchar("tipoCaixa", { length: 64 }).notNull(),
  valorComissao: decimal("valorComissao", { precision: 8, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoTabelaPreco = typeof empacotamentoTabelaPrecos.$inferSelect;
export type InsertEmpacotamentoTabelaPreco = typeof empacotamentoTabelaPrecos.$inferInsert;

export const empacotamentoModelosCaixa = pgTable("empacotamento_modelos_caixa", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoModeloCaixa = typeof empacotamentoModelosCaixa.$inferSelect;
export type InsertEmpacotamentoModeloCaixa = typeof empacotamentoModelosCaixa.$inferInsert;

export const empacotamentoChecklistItens = pgTable("empacotamento_checklist_itens", {
  id: serial("id").primaryKey(),
  modeloCaixaId: integer("modeloCaixaId").notNull(),
  ordem: integer("ordem").notNull().default(0),
  descricao: varchar("descricao", { length: 256 }).notNull(),
  obrigatorio: integer("obrigatorio").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoChecklistItem = typeof empacotamentoChecklistItens.$inferSelect;
export type InsertEmpacotamentoChecklistItem = typeof empacotamentoChecklistItens.$inferInsert;

// Pedidos de empacotamento (fila de despacho)
export const empacotamentoPedidos = pgTable("empacotamento_pedidos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoPedido = typeof empacotamentoPedidos.$inferSelect;
export type InsertEmpacotamentoPedido = typeof empacotamentoPedidos.$inferInsert;

export const empacotamentoPedidoUsuarios = pgTable("empacotamento_pedido_usuarios", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  usuarioId: text("usuarioId"), // user.id (Better Auth)
  usuarioNome: varchar("usuarioNome", { length: 128 }).notNull(),
  iniciadoEm: timestamp("iniciadoEm"),
  finalizadoEm: timestamp("finalizadoEm"),
  tempoSegundos: integer("tempoSegundos").default(0),
  ativo: integer("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoPedidoUsuario = typeof empacotamentoPedidoUsuarios.$inferSelect;
export type InsertEmpacotamentoPedidoUsuario = typeof empacotamentoPedidoUsuarios.$inferInsert;

export const empacotamentoPedidoFotos = pgTable("empacotamento_pedido_fotos", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  storageKey: text("storageKey").notNull(),
  url: text("url").notNull(),
  usuarioNome: varchar("usuarioNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoPedidoFoto = typeof empacotamentoPedidoFotos.$inferSelect;
export type InsertEmpacotamentoPedidoFoto = typeof empacotamentoPedidoFotos.$inferInsert;

export const empacotamentoPedidoChecklist = pgTable("empacotamento_pedido_checklist", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  itemId: integer("itemId").notNull(),
  marcado: integer("marcado").notNull().default(0),
  marcadoPor: varchar("marcadoPor", { length: 128 }),
  marcadoEm: timestamp("marcadoEm"),
});
export type EmpacotamentoPedidoChecklistItem = typeof empacotamentoPedidoChecklist.$inferSelect;
export type InsertEmpacotamentoPedidoChecklistItem = typeof empacotamentoPedidoChecklist.$inferInsert;

// ─── Empacotamento v3: Insumos, Precificação e Custo de Funcionário ───────────

export const empacotamentoInsumos = pgTable("empacotamento_insumos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  unidadeMedida: varchar("unidadeMedida", { length: 32 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull().default("0"),
  precoAtualizadoEm: timestamp("precoAtualizadoEm"),
  categoria: varchar("categoria", { length: 64 }),
  ativo: integer("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoInsumo = typeof empacotamentoInsumos.$inferSelect;
export type InsertEmpacotamentoInsumo = typeof empacotamentoInsumos.$inferInsert;

export const empacotamentoConsumoCaixa = pgTable("empacotamento_consumo_caixa", {
  id: serial("id").primaryKey(),
  modeloCaixaId: integer("modeloCaixaId").notNull(),
  insumoId: integer("insumoId").notNull(),
  quantidadePorCaixa: decimal("quantidadePorCaixa", { precision: 10, scale: 4 }).notNull().default("0"),
  formulaConsumo: varchar("formulaConsumo", { length: 32 }).notNull().default("fixo"),
  fator: decimal("fator", { precision: 8, scale: 4 }).notNull().default("1"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoConsumoCaixa = typeof empacotamentoConsumoCaixa.$inferSelect;
export type InsertEmpacotamentoConsumoCaixa = typeof empacotamentoConsumoCaixa.$inferInsert;

export const empacotamentoCustoFuncionario = pgTable("empacotamento_custo_funcionario", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull().default("Padrão"),
  salarioMensal: decimal("salarioMensal", { precision: 10, scale: 2 }).notNull().default("0"),
  horasMes: decimal("horasMes", { precision: 6, scale: 2 }).notNull().default("220"),
  custoHora: decimal("custoHora", { precision: 10, scale: 4 }),
  ativo: integer("ativo").notNull().default(1),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoCustoFuncionario = typeof empacotamentoCustoFuncionario.$inferSelect;
export type InsertEmpacotamentoCustoFuncionario = typeof empacotamentoCustoFuncionario.$inferInsert;

export const empacotamentoInsumosLetreiro = pgTable("empacotamento_insumos_letreiro", {
  id: serial("id").primaryKey(),
  modeloLetreiId: integer("modeloLetreiId").notNull(),
  insumoId: integer("insumoId").notNull(),
  quantidade: decimal("quantidade", { precision: 10, scale: 4 }).notNull().default("1"),
  fatorM2: decimal("fatorM2", { precision: 10, scale: 4 }),
  observacao: varchar("observacao", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoInsumoLetreiro = typeof empacotamentoInsumosLetreiro.$inferSelect;
export type InsertEmpacotamentoInsumoLetreiro = typeof empacotamentoInsumosLetreiro.$inferInsert;

export const empacotamentoCronometroPausas = pgTable("empacotamento_cronometro_pausas", {
  id: serial("id").primaryKey(),
  pedidoUsuarioId: integer("pedidoUsuarioId").notNull(),
  pausadoEm: timestamp("pausadoEm").notNull(),
  retomadoEm: timestamp("retomadoEm"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoCronometroPausa = typeof empacotamentoCronometroPausas.$inferSelect;
export type InsertEmpacotamentoCronometroPausa = typeof empacotamentoCronometroPausas.$inferInsert;

export const empacotamentoConfigProdutividade = pgTable("empacotamento_config_produtividade", {
  id: serial("id").primaryKey(),
  valorPorMinuto: decimal("valorPorMinuto", { precision: 10, scale: 4 }).notNull().default("0.15"),
  bonusPorcentagem: decimal("bonusPorcentagem", { precision: 5, scale: 2 }).notNull().default("20.00"),
  penalidadePorcentagem: decimal("penalidadePorcentagem", { precision: 5, scale: 2 }).notNull().default("30.00"),
  descricao: varchar("descricao", { length: 255 }),
  ativo: integer("ativo").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoConfigProdutividade = typeof empacotamentoConfigProdutividade.$inferSelect;
export type InsertEmpacotamentoConfigProdutividade = typeof empacotamentoConfigProdutividade.$inferInsert;

export const empacotamentoChecklistLetreitoItens = pgTable("empacotamento_checklist_letreiro_itens", {
  id: serial("id").primaryKey(),
  modeloLetreitoId: integer("modeloLetreitoId").notNull(),
  ordem: integer("ordem").notNull().default(0),
  descricao: varchar("descricao", { length: 512 }).notNull(),
  obrigatorio: integer("obrigatorio").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type EmpacotamentoChecklistLetreitoItem = typeof empacotamentoChecklistLetreitoItens.$inferSelect;
export type InsertEmpacotamentoChecklistLetreitoItem = typeof empacotamentoChecklistLetreitoItens.$inferInsert;

export const empacotamentoPedidoChecklistLetreiro = pgTable("empacotamento_pedido_checklist_letreiro", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  itemId: integer("itemId").notNull(),
  marcado: integer("marcado").notNull().default(0),
  marcadoPor: varchar("marcadoPor", { length: 128 }),
  marcadoEm: timestamp("marcadoEm"),
});
export type EmpacotamentoPedidoChecklistLetreiro = typeof empacotamentoPedidoChecklistLetreiro.$inferSelect;
export type InsertEmpacotamentoPedidoChecklistLetreiro = typeof empacotamentoPedidoChecklistLetreiro.$inferInsert;

export const empacotamentoSessoes = pgTable("empacotamento_sessoes", {
  id: serial("id").primaryKey(),
  pedidoId: integer("pedidoId").notNull(),
  operadorId: text("operadorId").notNull(), // user.id (Better Auth)
  operadorNome: varchar("operadorNome", { length: 128 }).notNull(),
  iniciadoEm: integer("iniciadoEm").notNull(),
  finalizadoEm: integer("finalizadoEm"),
  totalSegundos: integer("totalSegundos").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("ativo"),
  registradoEm: integer("registradoEm"),
  tempoRegistradoSegundos: integer("tempoRegistradoSegundos"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type EmpacotamentoSessao = typeof empacotamentoSessoes.$inferSelect;
export type InsertEmpacotamentoSessao = typeof empacotamentoSessoes.$inferInsert;

export const empacotamentoSessoesPausas = pgTable("empacotamento_sessoes_pausas", {
  id: serial("id").primaryKey(),
  sessaoId: integer("sessaoId").notNull(),
  pausadoEm: integer("pausadoEm").notNull(),
  retomadoEm: integer("retomadoEm"),
});
export type EmpacotamentoSessaoPausa = typeof empacotamentoSessoesPausas.$inferSelect;
export type InsertEmpacotamentoSessaoPausa = typeof empacotamentoSessoesPausas.$inferInsert;

// ─── SUGESTÕES DE INCORPORAÇÃO NA BASE DE CONHECIMENTO ──────────────────────
export const knowledgeSuggestions = pgTable("knowledge_suggestions", {
  id: serial("id").primaryKey(),
  pergunta: text("pergunta").notNull(),
  conteudoSugerido: text("conteudoSugerido").notNull(),
  fonte: varchar("fonte", { length: 32 }).notNull().default("manual"),
  autorId: text("autorId"), // user.id (Better Auth)
  autorNome: varchar("autorNome", { length: 128 }),
  status: varchar("status", { length: 32 }).notNull().default("pendente"),
  tituloSugerido: varchar("tituloSugerido", { length: 256 }),
  categoriaSugerida: varchar("categoriaSugerida", { length: 64 }),
  observacaoMaster: text("observacaoMaster"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type KnowledgeSuggestion = typeof knowledgeSuggestions.$inferSelect;
export type InsertKnowledgeSuggestion = typeof knowledgeSuggestions.$inferInsert;

// ─── Ações Corretivas de Retrabalho ──────────────────────────────────────────
export const acoesCorretivas = pgTable("acoes_corretivas", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AcaoCorretiva = typeof acoesCorretivas.$inferSelect;
export type InsertAcaoCorretiva = typeof acoesCorretivas.$inferInsert;

// ─── Planos de Ação para Reincidências ────────────────────────────────────────
export const planosAcao = pgTable("planos_acao", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PlanoAcao = typeof planosAcao.$inferSelect;
export type InsertPlanoAcao = typeof planosAcao.$inferInsert;

// ─── Causas Ishikawa (6M) por Plano de Ação ─────────────────────────────────
export const ishikawaCausas = pgTable("ishikawa_causas", {
  id: serial("id").primaryKey(),
  planoId: integer("planoId").notNull(),
  categoria: ishikawaCategoriaEnum("categoria").notNull(),
  causa: text("causa").notNull(),
  prioridade: prioridadeEnum("prioridade").default("media"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type IshikawaCausa = typeof ishikawaCausas.$inferSelect;
export type InsertIshikawaCausa = typeof ishikawaCausas.$inferInsert;

// ─── Ações 5W2H por Plano de Ação ────────────────────────────────────────────
export const acoes5w2h = pgTable("acoes_5w2h", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Acao5w2h = typeof acoes5w2h.$inferSelect;
export type InsertAcao5w2h = typeof acoes5w2h.$inferInsert;

// ─── Metas de Retrabalho ──────────────────────────────────────────────────────
export const metasRetrabalho = pgTable("metas_retrabalho", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type MetaRetrabalho = typeof metasRetrabalho.$inferSelect;
export type InsertMetaRetrabalho = typeof metasRetrabalho.$inferInsert;

// ─── Alertas do Sistema ───────────────────────────────────────────────────────
export const alertasSistema = pgTable("alertas_sistema", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AlertaSistema = typeof alertasSistema.$inferSelect;
export type InsertAlertaSistema = typeof alertasSistema.$inferInsert;

// ─── BIBLIOTECA DE ARQUIVOS (Base de Conhecimento) ──────────────────────────
export const bibliotecaArquivos = pgTable("biblioteca_arquivos", {
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
  conteudoExtraido: text("conteudoExtraido"), // mediumtext (MySQL) → text (Postgres)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type BibliotecaArquivo = typeof bibliotecaArquivos.$inferSelect;
export type InsertBibliotecaArquivo = typeof bibliotecaArquivos.$inferInsert;

// ─── CACHE CURVA ABC (ERP Mubisys) ──────────────────────────────────────────
export const abcCache = pgTable("abc_cache", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  tipo: abcTipoEnum("tipo").notNull(),
  dados: text("dados").notNull(), // JSON: [{nome, total, count, pct, pctAcum, classe}]
  totalOs: integer("totalOs").default(0),
  faturamentoTotal: decimal("faturamentoTotal", { precision: 14, scale: 2 }),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AbcCache = typeof abcCache.$inferSelect;
export type InsertAbcCache = typeof abcCache.$inferInsert;

// ─── METAS OPERACIONAIS ──────────────────────────────────────────────────────
export const metasOperacionais = pgTable("metas_operacionais", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type MetasOperacionais = typeof metasOperacionais.$inferSelect;
export type InsertMetasOperacionais = typeof metasOperacionais.$inferInsert;

// ─── FINANCEIRO MENSAL ────────────────────────────────────────────────────────
export const financeiroMensal = pgTable("financeiro_mensal", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinanceiroMensal = typeof financeiroMensal.$inferSelect;
export type InsertFinanceiroMensal = typeof financeiroMensal.$inferInsert;

// ─── OBSERVAÇÕES FINANCEIRAS MENSAIS ─────────────────────────────────────────
export const observacoesFinanceirasMensais = pgTable("observacoes_financeiras_mensais", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  observacoesManuais: text("observacoes_manuais"),
  analiseIa: text("analise_ia"),
  contextosEspecificos: text("contextos_especificos"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ObservacoesFinanceirasMensais = typeof observacoesFinanceirasMensais.$inferSelect;

// ─── DESEMPENHO POR COLABORADOR MENSAL ───────────────────────────────────────
export const desempenhoColaboradorMensal = pgTable("desempenho_colaborador_mensal", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DesempenhoColaboradorMensal = typeof desempenhoColaboradorMensal.$inferSelect;
export type InsertDesempenhoColaboradorMensal = typeof desempenhoColaboradorMensal.$inferInsert;

// ─── METAS DE PRODUTOS ────────────────────────────────────────────────────────
export const metaProdutos = pgTable("meta_produtos", {
  id: serial("id").primaryKey(),
  nomeProduto: varchar("nomeProduto", { length: 256 }).notNull(),
  codigoProduto: varchar("codigoProduto", { length: 64 }),
  metaParticipacaoPct: decimal("metaParticipacaoPct", { precision: 5, scale: 2 }).notNull().default("0"),
  ativo: boolean("ativo").default(true).notNull(),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type MetaProduto = typeof metaProdutos.$inferSelect;
export type InsertMetaProduto = typeof metaProdutos.$inferInsert;

// ─── METAS COMERCIAIS POR VENDEDOR ───────────────────────────────────────────
export const metasComerciais = pgTable("metas_comerciais", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type MetaComercial = typeof metasComerciais.$inferSelect;
export type InsertMetaComercial = typeof metasComerciais.$inferInsert;

// ─── HISTÓRICO DE OS (Relatório de Vendas) ───────────────────────────────────
export const historicoOs = pgTable("historico_os", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  mesAnoIdx: index("historico_os_mes_ano_idx").on(t.mes, t.ano),
  estadoIdx: index("historico_os_estado_idx").on(t.estado),
  // Permite upsert idempotente por OS (sync incremental) — sem isso, rodar o
  // sync duas vezes pro mesmo mês duplicava toda OS já importada.
  osNumeroIdx: uniqueIndex("historico_os_os_numero_idx").on(t.osNumero),
}));
export type HistoricoOs = typeof historicoOs.$inferSelect;
export type InsertHistoricoOs = typeof historicoOs.$inferInsert;

// ─── HISTÓRICO DE ORÇAMENTOS ──────────────────────────────────────────────────
export const historicoOrcamentos = pgTable("historico_orcamentos", {
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
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  mesAnoIdx: index("historico_orcamentos_mes_ano_idx").on(t.mes, t.ano),
  orcNumeroIdx: uniqueIndex("historico_orcamentos_orc_numero_idx").on(t.orcNumero),
}));
export type HistoricoOrcamento = typeof historicoOrcamentos.$inferSelect;
export type InsertHistoricoOrcamento = typeof historicoOrcamentos.$inferInsert;

// ─── CRM Comercial ────────────────────────────────────────────────────────────

export const crmMetas = pgTable("crm_metas", {
  id: serial("id").primaryKey(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  metaValor: decimal("metaValor", { precision: 14, scale: 2 }).default("0").notNull(),
  metaQtdOs: integer("metaQtdOs").default(0).notNull(),
  usuarioVinculadoId: text("usuarioVinculadoId"), // user.id (Better Auth)
  usuarioVinculadoNome: varchar("usuarioVinculadoNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CrmMeta = typeof crmMetas.$inferSelect;
export type InsertCrmMeta = typeof crmMetas.$inferInsert;

export const crmContatos = pgTable("crm_contatos", {
  id: serial("id").primaryKey(),
  orcamentoId: varchar("orcamentoId", { length: 32 }).notNull(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  empresa: varchar("empresa", { length: 256 }).notNull(),
  numeroContato: integer("numeroContato").notNull(),
  canal: crmCanalEnum("canal").default("whatsapp").notNull(),
  observacao: text("observacao"),
  contatadoEm: timestamp("contatadoEm").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrmContato = typeof crmContatos.$inferSelect;
export type InsertCrmContato = typeof crmContatos.$inferInsert;

// ─── Overrides manuais de status de cliente ───────────────────────────────────
export const clienteOverrides = pgTable("cliente_overrides", {
  id: serial("id").primaryKey(),
  empresa: varchar("empresa", { length: 256 }).notNull().unique(),
  empresaOriginal: varchar("empresaOriginal", { length: 256 }).notNull(),
  status: clienteOverrideStatusEnum("status").notNull().default("recorrente"),
  motivo: text("motivo"),
  criadoPor: varchar("criadoPor", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ClienteOverride = typeof clienteOverrides.$inferSelect;
export type InsertClienteOverride = typeof clienteOverrides.$inferInsert;

// ─── Custo de Marketing por mês ───────────────────────────────────────────────
export const custoMarketing = pgTable("custo_marketing", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  investimentoAquisicao: decimal("investimento_aquisicao", { precision: 14, scale: 2 }).notNull().default("0"),
  investimentoReativacao: decimal("investimento_reativacao", { precision: 14, scale: 2 }).notNull().default("0"),
  // Soma de investimentoAquisicao + investimentoReativacao, mantida por compatibilidade com consumidores existentes
  investimento: decimal("investimento", { precision: 14, scale: 2 }).notNull().default("0"),
  observacao: text("observacao"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CustoMarketing = typeof custoMarketing.$inferSelect;
export type InsertCustoMarketing = typeof custoMarketing.$inferInsert;

// ─── Lançamentos detalhados de Marketing (linhas do relatório de contas a pagar) ──
export const custoMarketingItens = pgTable("custo_marketing_itens", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  categoria: varchar("categoria", { length: 32 }).notNull().default("aquisicao"), // "aquisicao" | "reativacao"
  fornecedor: varchar("fornecedor", { length: 256 }).notNull(),
  tipo: varchar("tipo", { length: 128 }),
  despesa: varchar("despesa", { length: 256 }),
  descricao: text("descricao"),
  valor: decimal("valor", { precision: 14, scale: 2 }).notNull(),
  dataVencimento: timestamp("dataVencimento"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CustoMarketingItem = typeof custoMarketingItens.$inferSelect;
export type InsertCustoMarketingItem = typeof custoMarketingItens.$inferInsert;

// ─── Custos Fixos Mensais ─────────────────────────────────────────────────────
export const custosFixos = pgTable("custos_fixos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CustoFixo = typeof custosFixos.$inferSelect;
export type InsertCustoFixo = typeof custosFixos.$inferInsert;

// ─── Dívidas e Parcelamentos ──────────────────────────────────────────────────
export const dividasParcelamentos = pgTable("dividas_parcelamentos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DividaParcelamento = typeof dividasParcelamentos.$inferSelect;
export type InsertDividaParcelamento = typeof dividasParcelamentos.$inferInsert;

// ─── DRE Mensal (dados de fechamento financeiro) ──────────────────────────────
export const dreMensal = pgTable("dre_mensal", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type DreMensal = typeof dreMensal.$inferSelect;
export type InsertDreMensal = typeof dreMensal.$inferInsert;

// Scripts de vendas por faixa do CRM
export const crmScripts = pgTable("crm_scripts", {
  id: serial("id").primaryKey(),
  faixa: integer("faixa").notNull(),
  ordem: integer("ordem").notNull().default(0),
  titulo: varchar("titulo", { length: 128 }),
  conteudo: text("conteudo").notNull(), // mediumtext → text
  conteudo_voz: text("conteudo_voz"), // mediumtext → text
  ativo: boolean("ativo").notNull().default(true),
  copia_count: integer("copia_count").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CrmScript = typeof crmScripts.$inferSelect;
export type InsertCrmScript = typeof crmScripts.$inferInsert;

export const inteligenciaClientesCache = pgTable("inteligencia_clientes_cache", {
  id: serial("id").primaryKey(),
  periodoKey: varchar("periodo_key", { length: 32 }).notNull(),
  dadosJson: text("dados_json").notNull(), // mediumtext → text
  calculadoEm: timestamp("calculado_em").defaultNow().notNull(),
  congelado: boolean("congelado").default(false).notNull(),
  congeladoEm: timestamp("congelado_em"),
});
export type InteligenciaClientesCache = typeof inteligenciaClientesCache.$inferSelect;
export type InsertInteligenciaClientesCache = typeof inteligenciaClientesCache.$inferInsert;

export const ledTipos = pgTable("led_tipos", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 128 }).notNull(),
  descricao: text("descricao"),
  custoUnitario: decimal("custo_unitario", { precision: 10, scale: 4 }).notNull().default("0"),
  unidade: varchar("unidade", { length: 16 }).notNull().default("un"),
  ativo: varchar("ativo", { length: 4 }).notNull().default("sim"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type LedTipo = typeof ledTipos.$inferSelect;
export type InsertLedTipo = typeof ledTipos.$inferInsert;

export const custoLedLancamentos = pgTable("custo_led_lancamentos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CustoLedLancamento = typeof custoLedLancamentos.$inferSelect;
export type InsertCustoLedLancamento = typeof custoLedLancamentos.$inferInsert;

export const crmFaixaEtiquetas = pgTable("crm_faixa_etiquetas", {
  id: serial("id").primaryKey(),
  faixa: integer("faixa").notNull(),
  label: varchar("label", { length: 128 }).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CrmFaixaEtiqueta = typeof crmFaixaEtiquetas.$inferSelect;
export type InsertCrmFaixaEtiqueta = typeof crmFaixaEtiquetas.$inferInsert;

// Auditoria e congelamento de dados da Performance Comercial
export const performanceAuditada = pgTable("performance_auditada", {
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
  listaClientesNovos: text("lista_clientes_novos"), // mediumtext → text
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
}, (t) => ({
  mesAnoIdx: index("performance_auditada_mes_ano_idx").on(t.mes, t.ano),
}));
export type PerformanceAuditada = typeof performanceAuditada.$inferSelect;
export type InsertPerformanceAuditada = typeof performanceAuditada.$inferInsert;

// Controle de contato com clientes novos
export const clienteNovosContato = pgTable("cliente_novos_contato", {
  id: serial("id").primaryKey(),
  empresa: varchar("empresa", { length: 256 }).notNull(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  contatado: boolean("contatado").notNull().default(false),
  dataContato: timestamp("data_contato"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ClienteNovosContato = typeof clienteNovosContato.$inferSelect;
export type InsertClienteNovosContato = typeof clienteNovosContato.$inferInsert;

// Cache persistente de dados brutos da API MubiSys
export const mubisysApiCache = pgTable("mubisys_api_cache", {
  id: serial("id").primaryKey(),
  cacheKey: varchar("cache_key", { length: 64 }).notNull().unique(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  osData: text("os_data"), // mediumtext → text
  orcData: text("orc_data"), // mediumtext → text
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type MubisysApiCache = typeof mubisysApiCache.$inferSelect;
export type InsertMubisysApiCache = typeof mubisysApiCache.$inferInsert;

// ─── Log de Atividade do CRM por Vendedor ─────────────────────────────────────
export const crmAtividadeLog = pgTable("crm_atividade_log", {
  id: serial("id").primaryKey(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  localUserId: text("local_user_id"), // user.id (Better Auth)
  acao: varchar("acao", { length: 64 }).notNull(),
  orcamentoId: varchar("orcamento_id", { length: 32 }),
  empresa: varchar("empresa", { length: 256 }),
  detalhe: varchar("detalhe", { length: 512 }),
  realizadaEm: timestamp("realizada_em").defaultNow().notNull(),
  turno: turnoEnum("turno").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CrmAtividadeLog = typeof crmAtividadeLog.$inferSelect;
export type InsertCrmAtividadeLog = typeof crmAtividadeLog.$inferInsert;

// Dados Financeiros Mensais (integração com relatórios financeiros)
export const financeirosMensais = pgTable("financeiros_mensais", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FinanceirosMensais = typeof financeirosMensais.$inferSelect;
export type InsertFinanceirosMensais = typeof financeirosMensais.$inferInsert;

// Desenho de Cargos e Funções
export const cargos = pgTable("cargos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Cargo = typeof cargos.$inferSelect;
export type InsertCargo = typeof cargos.$inferInsert;

export const responsabilidadesCargo = pgTable("responsabilidades_cargo", {
  id: serial("id").primaryKey(),
  cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao").notNull(),
  ordem: integer("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type ResponsabilidadeCargo = typeof responsabilidadesCargo.$inferSelect;
export type InsertResponsabilidadeCargo = typeof responsabilidadesCargo.$inferInsert;

export const kpisCargo = pgTable("kpis_cargo", {
  id: serial("id").primaryKey(),
  cargoId: integer("cargo_id").notNull().references(() => cargos.id, { onDelete: "cascade" }),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao").notNull(),
  meta: varchar("meta", { length: 256 }),
  ordem: integer("ordem").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type KpiCargo = typeof kpisCargo.$inferSelect;
export type InsertKpiCargo = typeof kpisCargo.$inferInsert;

// ─── Análise de Currículos com IA ─────────────────────────────────────────────
export const analiseCurriculos = pgTable("analise_curriculos", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type AnaliseCurriculo = typeof analiseCurriculos.$inferSelect;
export type InsertAnaliseCurriculo = typeof analiseCurriculos.$inferInsert;

// ─── SINCRONIZAÇÃO COM ERP (CACHING LOCAL) ────────────────────────────────────

export const syncLogs = pgTable("sync_logs", {
  id: serial("id").primaryKey(),
  dataExecucao: timestamp("dataExecucao").defaultNow().notNull(),
  quantidadeOsImportadas: integer("quantidadeOsImportadas").default(0).notNull(),
  status: syncStatusEnum("status").default("PENDENTE").notNull(),
  mensagemErro: text("mensagemErro"),
  tempoExecucaoMs: integer("tempoExecucaoMs"),
  proximaExecucao: timestamp("proximaExecucao"),
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
});
export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// Tabela de Cache Local de OSs do ERP
export const erpOsCache = pgTable("erp_os_cache", {
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
  criadoEm: timestamp("criadoEm").defaultNow().notNull(),
}, (t) => ({
  numeroOsIndex: uniqueIndex("erp_os_cache_numero_os_idx").on(t.numeroOs),
}));
export type ErpOsCache = typeof erpOsCache.$inferSelect;
export type InsertErpOsCache = typeof erpOsCache.$inferInsert;

// ─── TABELAS SEM DEFINIÇÃO PRÉVIA NO SCHEMA (existem no banco real via SQL cru) ───
// Descobertas comparando SHOW TABLES do MySQL de origem contra este arquivo.
// Todas estavam vazias (0 linhas) no momento da migração.

export const clientes = pgTable("clientes", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Cliente = typeof clientes.$inferSelect;
export type InsertCliente = typeof clientes.$inferInsert;

export const crmPropostas = pgTable("crm_propostas", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CrmProposta = typeof crmPropostas.$inferSelect;
export type InsertCrmProposta = typeof crmPropostas.$inferInsert;

export const performanceComercial = pgTable("performance_comercial", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  vendedor: varchar("vendedor", { length: 128 }).notNull(),
  faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
  quantidadeOs: integer("quantidadeOs").notNull().default(0),
  novosClientes: integer("novosClientes").notNull().default(0),
  ticketMedio: decimal("ticketMedio", { precision: 10, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PerformanceComercial = typeof performanceComercial.$inferSelect;
export type InsertPerformanceComercial = typeof performanceComercial.$inferInsert;

export const custoLed = pgTable("custo_led", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CustoLed = typeof custoLed.$inferSelect;
export type InsertCustoLed = typeof custoLed.$inferInsert;

export const cotacoesItens = pgTable("cotacoes_itens", {
  id: serial("id").primaryKey(),
  cotacaoId: integer("cotacaoId").notNull(),
  transportadoraId: integer("transportadoraId"),
  transportadoraNome: varchar("transportadoraNome", { length: 128 }),
  prazoEntrega: varchar("prazoEntrega", { length: 64 }),
  valorFrete: decimal("valorFrete", { precision: 10, scale: 2 }),
  valorTotal: decimal("valorTotal", { precision: 10, scale: 2 }),
  observacoes: text("observacoes"),
  selecionada: boolean("selecionada").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CotacaoItem = typeof cotacoesItens.$inferSelect;
export type InsertCotacaoItem = typeof cotacoesItens.$inferInsert;

export const cnqRegistros = pgTable("cnq_registros", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  categoria: varchar("categoria", { length: 64 }).notNull(),
  descricao: text("descricao"),
  valor: decimal("valor", { precision: 12, scale: 2 }).notNull().default("0"),
  tipo: cnqTipoEnum("tipo").notNull().default("interno"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type CnqRegistro = typeof cnqRegistros.$inferSelect;
export type InsertCnqRegistro = typeof cnqRegistros.$inferInsert;

export const errosPadrao = pgTable("erros_padrao", {
  id: serial("id").primaryKey(),
  codigo: varchar("codigo", { length: 16 }).notNull().unique(),
  descricao: text("descricao").notNull(),
  categoria: varchar("categoria", { length: 64 }),
  setor: varchar("setor", { length: 64 }),
  tipo: cnqTipoEnum("tipo").default("interno"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type ErroPadrao = typeof errosPadrao.$inferSelect;
export type InsertErroPadrao = typeof errosPadrao.$inferInsert;

export const ishikawaPlanos = pgTable("ishikawa_planos", {
  id: serial("id").primaryKey(),
  retrabalhoid: integer("retrabalhoid").notNull(),
  problema: text("problema").notNull(),
  efeito: text("efeito"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type IshikawaPlano = typeof ishikawaPlanos.$inferSelect;
export type InsertIshikawaPlano = typeof ishikawaPlanos.$inferInsert;

export const performanceAbc = pgTable("performance_abc", {
  id: serial("id").primaryKey(),
  mes: integer("mes").notNull(),
  ano: integer("ano").notNull(),
  tipo: abcTipoEnum("tipo").notNull(),
  entidade: varchar("entidade", { length: 256 }).notNull(),
  faturamento: decimal("faturamento", { precision: 14, scale: 2 }).notNull().default("0"),
  quantidade: integer("quantidade").notNull().default(0),
  classificacao: abcClassificacaoEnum("classificacao").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PerformanceAbc = typeof performanceAbc.$inferSelect;
export type InsertPerformanceAbc = typeof performanceAbc.$inferInsert;

export const planosAcaoComercial = pgTable("planos_acao_comercial", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao"),
  responsavel: varchar("responsavel", { length: 128 }),
  prazo: date("prazo"),
  status: planoAcaoComercialStatusEnum("status").notNull().default("pendente"),
  prioridade: prioridadeComCriticaEnum("prioridade").default("media"),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PlanoAcaoComercial = typeof planosAcaoComercial.$inferSelect;
export type InsertPlanoAcaoComercial = typeof planosAcaoComercial.$inferInsert;

export const planosAcaoQualidade = pgTable("planos_acao_qualidade", {
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
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type PlanoAcaoQualidade = typeof planosAcaoQualidade.$inferSelect;
export type InsertPlanoAcaoQualidade = typeof planosAcaoQualidade.$inferInsert;

export const regulamentos = pgTable("regulamentos", {
  id: serial("id").primaryKey(),
  titulo: varchar("titulo", { length: 256 }).notNull(),
  descricao: text("descricao"),
  categoria: varchar("categoria", { length: 64 }),
  conteudo: text("conteudo"),
  versao: varchar("versao", { length: 16 }).default("1.0"),
  ativo: boolean("ativo").notNull().default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type RegulamentoItem = typeof regulamentos.$inferSelect;
export type InsertRegulamentoItem = typeof regulamentos.$inferInsert;

// ─── Métricas (indicadores livres apurados manualmente, com data) ───────────
export const metricas = pgTable("metricas", {
  id: serial("id").primaryKey(),
  nome: varchar("nome", { length: 256 }).notNull(),
  valor: decimal("valor", { precision: 14, scale: 4 }).notNull(),
  unidade: varchar("unidade", { length: 16 }).default("%"),
  dataApuracao: date("dataApuracao").notNull(),
  observacao: text("observacao"),
  criadoPorNome: varchar("criadoPorNome", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Metrica = typeof metricas.$inferSelect;
export type InsertMetrica = typeof metricas.$inferInsert;
