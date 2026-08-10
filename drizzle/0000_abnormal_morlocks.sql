CREATE TYPE "public"."abc_classificacao" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."abc_tipo" AS ENUM('clientes', 'produtos');--> statement-breakpoint
CREATE TYPE "public"."acao_5w2h_status" AS ENUM('pendente', 'em_andamento', 'concluido');--> statement-breakpoint
CREATE TYPE "public"."acao_corretiva_status" AS ENUM('aberto', 'em_tratamento', 'resolvido');--> statement-breakpoint
CREATE TYPE "public"."alerta_severidade" AS ENUM('info', 'aviso', 'critico');--> statement-breakpoint
CREATE TYPE "public"."alerta_status" AS ENUM('ativo', 'lido', 'arquivado');--> statement-breakpoint
CREATE TYPE "public"."alerta_tipo" AS ENUM('reincidencia', 'meta_excedida', 'sem_acao', 'prazo_vencido', 'novo_retrabalho', 'atraso_expedicao');--> statement-breakpoint
CREATE TYPE "public"."analise_curriculo_status" AS ENUM('pendente', 'analisando', 'concluido', 'erro');--> statement-breakpoint
CREATE TYPE "public"."app_role" AS ENUM('master', 'admin', 'gestor', 'vendas', 'logistica', 'producao', 'financeiro', 'empacotamento');--> statement-breakpoint
CREATE TYPE "public"."auditoria_acao" AS ENUM('CRIACAO', 'EDICAO', 'EXCLUSAO');--> statement-breakpoint
CREATE TYPE "public"."cliente_cadastro_status" AS ENUM('ativo', 'inativo', 'prospect');--> statement-breakpoint
CREATE TYPE "public"."cliente_override_status" AS ENUM('recorrente', 'novo');--> statement-breakpoint
CREATE TYPE "public"."cnq_tipo" AS ENUM('interno', 'externo');--> statement-breakpoint
CREATE TYPE "public"."cotacao_status" AS ENUM('fila', 'em_cotacao', 'pronto', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."crm_canal" AS ENUM('whatsapp', 'telefone', 'email', 'visita', 'outro', 'perdida', 'nao_retornou', 'esperando_cliente', 'garantiu_fechamento');--> statement-breakpoint
CREATE TYPE "public"."crm_proposta_status" AS ENUM('prospeccao', 'proposta_enviada', 'negociacao', 'ganho', 'perdido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."forma_cotacao" AS ENUM('site', 'whatsapp', 'telefone', 'email');--> statement-breakpoint
CREATE TYPE "public"."ishikawa_categoria" AS ENUM('maquina', 'mao_de_obra', 'material', 'metodo', 'medida', 'meio_ambiente');--> statement-breakpoint
CREATE TYPE "public"."kanban_status" AS ENUM('aguardando', 'embalando', 'patio', 'abandonado');--> statement-breakpoint
CREATE TYPE "public"."oauth_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."plano_acao_comercial_status" AS ENUM('pendente', 'em_andamento', 'concluido', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."plano_acao_status" AS ENUM('pendente', 'em_andamento', 'concluido', 'monitorando');--> statement-breakpoint
CREATE TYPE "public"."pop_acesso_tipo" AS ENUM('visualizacao', 'download');--> statement-breakpoint
CREATE TYPE "public"."prioridade_com_critica" AS ENUM('baixa', 'media', 'alta', 'critica');--> statement-breakpoint
CREATE TYPE "public"."prioridade" AS ENUM('alta', 'media', 'baixa');--> statement-breakpoint
CREATE TYPE "public"."producao_alerta_tipo" AS ENUM('em_risco', 'atrasado', 'bloqueado', 'dependencia_nao_concluida');--> statement-breakpoint
CREATE TYPE "public"."producao_setor_status" AS ENUM('nao_iniciado', 'em_andamento', 'concluido', 'atrasado', 'bloqueado');--> statement-breakpoint
CREATE TYPE "public"."producao_status_geral" AS ENUM('nao_iniciado', 'em_andamento', 'concluido', 'atrasado');--> statement-breakpoint
CREATE TYPE "public"."regulation_type" AS ENUM('regulamento', 'memorando', 'politica', 'procedimento');--> statement-breakpoint
CREATE TYPE "public"."retrabalho_classe" AS ENUM('EVITÁVEL', 'INEVITÁVEL');--> statement-breakpoint
CREATE TYPE "public"."retrabalho_tipo" AS ENUM('INTERNO', 'EXTERNO');--> statement-breakpoint
CREATE TYPE "public"."routine_frequency" AS ENUM('diaria', 'semanal', 'quinzenal', 'mensal', 'esporadico', 'daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom');--> statement-breakpoint
CREATE TYPE "public"."routine_status" AS ENUM('pendente', 'em_dia', 'atrasada');--> statement-breakpoint
CREATE TYPE "public"."sim_nao" AS ENUM('sim', 'nao');--> statement-breakpoint
CREATE TYPE "public"."status_validacao" AS ENUM('pendente', 'validado', 'corrigido_excel');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('SUCESSO', 'ERRO', 'PENDENTE');--> statement-breakpoint
CREATE TYPE "public"."tipo_prazo" AS ENUM('uteis', 'corridos');--> statement-breakpoint
CREATE TYPE "public"."tipo_registro" AS ENUM('retrabalho', 'cnq');--> statement-breakpoint
CREATE TYPE "public"."tipo_responsavel" AS ENUM('operador', 'gestor');--> statement-breakpoint
CREATE TYPE "public"."turno" AS ENUM('manha', 'tarde', 'noite');--> statement-breakpoint
CREATE TABLE "abc_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"tipo" "abc_tipo" NOT NULL,
	"dados" text NOT NULL,
	"totalOs" integer DEFAULT 0,
	"faturamentoTotal" numeric(14, 2),
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acoes_5w2h" (
	"id" serial PRIMARY KEY NOT NULL,
	"planoId" integer NOT NULL,
	"what" text NOT NULL,
	"why" text,
	"where" varchar(128),
	"who" varchar(128),
	"when" varchar(64),
	"how" text,
	"howMuch" varchar(64),
	"status" "acao_5w2h_status" DEFAULT 'pendente',
	"causaId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "acoes_corretivas" (
	"id" serial PRIMARY KEY NOT NULL,
	"retrabalhoid" integer NOT NULL,
	"status" "acao_corretiva_status" DEFAULT 'aberto' NOT NULL,
	"acaoTomada" text,
	"responsavel" varchar(128),
	"prazoResolucao" timestamp,
	"dataResolucao" timestamp,
	"custoAdicional" numeric(10, 2) DEFAULT '0',
	"observacoes" text,
	"registradoPor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas_sistema" (
	"id" serial PRIMARY KEY NOT NULL,
	"tipo" "alerta_tipo" NOT NULL,
	"severidade" "alerta_severidade" DEFAULT 'aviso' NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text,
	"referenciaId" integer,
	"referenciaTipo" varchar(64),
	"referenciaExtra" varchar(256),
	"status" "alerta_status" DEFAULT 'ativo' NOT NULL,
	"destinatario" varchar(128),
	"lidoPor" varchar(128),
	"lidoEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analise_curriculos" (
	"id" serial PRIMARY KEY NOT NULL,
	"cargoId" integer NOT NULL,
	"curriculoFileName" varchar(256) NOT NULL,
	"curriculoUrl" text NOT NULL,
	"curriculoKey" text NOT NULL,
	"resultado" text,
	"status" "analise_curriculo_status" DEFAULT 'pendente' NOT NULL,
	"erroMensagem" text,
	"uploadedBy" varchar(128),
	"uploadedByName" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auditoria_retrabalhos" (
	"id" serial PRIMARY KEY NOT NULL,
	"retrabalhoId" integer,
	"osRetrabalhada" varchar(32),
	"osOriginal" varchar(64),
	"acao" "auditoria_acao" NOT NULL,
	"usuarioId" integer,
	"usuarioNome" varchar(128),
	"usuarioRole" varchar(32),
	"detalhes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biblioteca_arquivos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(256) NOT NULL,
	"descricao" text,
	"categoria" varchar(64) DEFAULT 'Geral' NOT NULL,
	"subcategoria" varchar(64),
	"tags" text,
	"fileKey" varchar(512) NOT NULL,
	"fileUrl" varchar(1024) NOT NULL,
	"fileName" varchar(256) NOT NULL,
	"mimeType" varchar(128) NOT NULL,
	"fileSize" integer DEFAULT 0 NOT NULL,
	"uploadedBy" varchar(128),
	"visualizacoes" integer DEFAULT 0 NOT NULL,
	"conteudoExtraido" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cargos" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"missao" text NOT NULL,
	"subordinacao" varchar(256),
	"setor" varchar(128) NOT NULL,
	"regime_trabalho" varchar(128),
	"jornada" varchar(256),
	"limites" text,
	"condicoes_trabalho" text,
	"requisitos" text,
	"gestao_riscos" text,
	"ferramentas_recursos" text,
	"integracao_fluxo" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cargos_titulo_unique" UNIQUE("titulo")
);
--> statement-breakpoint
CREATE TABLE "cargos_funcoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(128) NOT NULL,
	"missao" text,
	"responsabilidades" text,
	"kpis" text,
	"ferramentas" text,
	"integracao" text,
	"riscos" text,
	"requisitos" text,
	"condicoes" text,
	"imagemDivulgacaoUrl" text,
	"imagemDivulgacaoKey" text,
	"roteiroEntrevista" text,
	"promptAnaliseIA" text,
	"createdBy" varchar(128),
	"updatedBy" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cliente_novos_contato" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"contatado" boolean DEFAULT false NOT NULL,
	"data_contato" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cliente_overrides" (
	"id" serial PRIMARY KEY NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"empresaOriginal" varchar(256) NOT NULL,
	"status" "cliente_override_status" DEFAULT 'recorrente' NOT NULL,
	"motivo" text,
	"criadoPor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cliente_overrides_empresa_unique" UNIQUE("empresa")
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(256) NOT NULL,
	"cnpj" varchar(32),
	"email" varchar(256),
	"telefone" varchar(64),
	"cidade" varchar(128),
	"estado" varchar(2),
	"segmento" varchar(64),
	"origem" varchar(64),
	"status" "cliente_cadastro_status" DEFAULT 'prospect',
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cnq_registros" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"categoria" varchar(64) NOT NULL,
	"descricao" text,
	"valor" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tipo" "cnq_tipo" DEFAULT 'interno' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacao_comentarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotacaoId" integer NOT NULL,
	"autorId" integer,
	"autorNome" varchar(128) DEFAULT 'Sistema' NOT NULL,
	"texto" text,
	"audioUrl" varchar(512),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacao_opcoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotacaoId" integer NOT NULL,
	"transportadoraId" integer,
	"transportadoraNome" varchar(128),
	"valorFrete" numeric(10, 2) NOT NULL,
	"prazoDias" integer,
	"modal" varchar(32),
	"observacoes" text,
	"tipoPrazo" "tipo_prazo" DEFAULT 'uteis',
	"selecionada" "sim_nao" DEFAULT 'nao' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacoes_frete" (
	"id" serial PRIMARY KEY NOT NULL,
	"solicitanteId" integer,
	"solicitanteNome" varchar(128),
	"destinatarioNome" varchar(256),
	"destinatarioCnpj" varchar(32),
	"cepDestino" varchar(10),
	"municipio" varchar(128),
	"estado" varchar(2),
	"dimensoesLargura" numeric(8, 2),
	"dimensoesAltura" numeric(8, 2),
	"dimensoesComprimento" numeric(8, 2),
	"pesoKg" numeric(8, 2),
	"valorNf" numeric(12, 2),
	"observacoes" text,
	"observacaoGol" text,
	"fotoUrl" text,
	"empacotamentoPedidoId" integer,
	"empacotamentoPedidoNumero" varchar(64),
	"status" "cotacao_status" DEFAULT 'fila' NOT NULL,
	"transportadoraSelecionadaId" integer,
	"horarioDecisaoMs" varchar(8),
	"dataSource" varchar(32),
	"tipoMaterial" varchar(256),
	"dataEntregaPrevista" date,
	"dataDespacho" timestamp,
	"temRetrabalho" boolean DEFAULT false,
	"tipoRetrabalho" varchar(64),
	"motivoRetrabalho" text,
	"retrabalhoVinculadoId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cotacoes_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"cotacaoId" integer NOT NULL,
	"transportadoraId" integer,
	"transportadoraNome" varchar(128),
	"prazoEntrega" varchar(64),
	"valorFrete" numeric(10, 2),
	"valorTotal" numeric(10, 2),
	"observacoes" text,
	"selecionada" boolean DEFAULT false,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_atividade_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor" varchar(128) NOT NULL,
	"local_user_id" integer,
	"acao" varchar(64) NOT NULL,
	"orcamento_id" varchar(32),
	"empresa" varchar(256),
	"detalhe" varchar(512),
	"realizada_em" timestamp DEFAULT now() NOT NULL,
	"turno" "turno" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_contatos" (
	"id" serial PRIMARY KEY NOT NULL,
	"orcamentoId" varchar(32) NOT NULL,
	"vendedor" varchar(128) NOT NULL,
	"empresa" varchar(256) NOT NULL,
	"numeroContato" integer NOT NULL,
	"canal" "crm_canal" DEFAULT 'whatsapp' NOT NULL,
	"observacao" text,
	"contatadoEm" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_faixa_etiquetas" (
	"id" serial PRIMARY KEY NOT NULL,
	"faixa" integer NOT NULL,
	"label" varchar(128) NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_metas" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor" varchar(128) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"metaValor" numeric(14, 2) DEFAULT '0' NOT NULL,
	"metaQtdOs" integer DEFAULT 0 NOT NULL,
	"usuarioVinculadoId" integer,
	"usuarioVinculadoNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_propostas" (
	"id" serial PRIMARY KEY NOT NULL,
	"clienteId" integer,
	"clienteNome" varchar(256),
	"titulo" varchar(256) NOT NULL,
	"descricao" text,
	"valor" numeric(12, 2),
	"status" "crm_proposta_status" DEFAULT 'prospeccao' NOT NULL,
	"responsavel" varchar(128),
	"dataFechamento" date,
	"motivoPerda" text,
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm_scripts" (
	"id" serial PRIMARY KEY NOT NULL,
	"faixa" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"titulo" varchar(128),
	"conteudo" text NOT NULL,
	"conteudo_voz" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"copia_count" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cte_importacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"numeroCte" varchar(64) NOT NULL,
	"transportadoraId" integer,
	"transportadoraNome" varchar(128),
	"valor" numeric(12, 2),
	"dataEmissao" timestamp,
	"remetente" varchar(256),
	"destinatario" varchar(256),
	"municipioDestino" varchar(128),
	"estadoDestino" varchar(2),
	"rawData" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custo_led" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"produto" varchar(128) NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"custoUnitario" numeric(10, 2) DEFAULT '0' NOT NULL,
	"custoTotal" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fornecedor" varchar(128),
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custo_led_lancamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"os" varchar(64) NOT NULL,
	"led_tipo_id" integer NOT NULL,
	"led_tipo_efetivo_id" integer,
	"qtd_prevista" numeric(10, 4) DEFAULT '0' NOT NULL,
	"qtd_efetiva" numeric(10, 4),
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"observacao" text,
	"vendedor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custo_marketing" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"investimento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"observacao" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custos_fixos" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano" varchar(256) NOT NULL,
	"categoria" varchar(128) NOT NULL,
	"grupoCategoria" varchar(64) NOT NULL,
	"fornecedor" varchar(256) NOT NULL,
	"tipo" varchar(64) NOT NULL,
	"valor" numeric(14, 2) DEFAULT '0' NOT NULL,
	"vencimento" integer,
	"observacao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desempenho_colaborador_mensal" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(120) NOT NULL,
	"categoria" varchar(40) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"numFaltas" integer DEFAULT 0,
	"metrosSoldados" numeric(10, 2),
	"numRetrabalhos" integer DEFAULT 0,
	"numPropostas" integer DEFAULT 0,
	"numVendas" integer DEFAULT 0,
	"faturamentoVendedor" numeric(14, 2),
	"ticketMedioVendedor" numeric(12, 2),
	"numTrabalhos" integer DEFAULT 0,
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dividas_parcelamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"plano" varchar(256) NOT NULL,
	"categoria" varchar(128) NOT NULL,
	"fornecedor" varchar(256) NOT NULL,
	"jan_valor" numeric(14, 2),
	"fev_valor" numeric(14, 2),
	"mar_valor" numeric(14, 2),
	"abr_valor" numeric(14, 2),
	"mai_valor" numeric(14, 2),
	"jun_valor" numeric(14, 2),
	"jul_valor" numeric(14, 2),
	"ago_valor" numeric(14, 2),
	"set_valor" numeric(14, 2),
	"out_valor" numeric(14, 2),
	"nov_valor" numeric(14, 2),
	"dez_valor" numeric(14, 2),
	"media" numeric(14, 2),
	"observacao" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dre_mensal" (
	"id" serial PRIMARY KEY NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer NOT NULL,
	"receita_operacional_bruta" numeric(14, 2),
	"receita_financeira" numeric(14, 2),
	"receita_nao_operacional" numeric(14, 2),
	"total_entradas" numeric(14, 2),
	"impostos_vendas" numeric(14, 2),
	"despesa_variavel" numeric(14, 2),
	"despesa_operacional" numeric(14, 2),
	"materia_prima" numeric(14, 2),
	"gastos_gerais_fabricacao" numeric(14, 2),
	"despesas_pessoal" numeric(14, 2),
	"despesas_fixas" numeric(14, 2),
	"despesas_financeiras" numeric(14, 2),
	"despesas_nao_operacionais" numeric(14, 2),
	"total_saidas" numeric(14, 2),
	"receita_bruta_operacional" numeric(14, 2),
	"lucro_bruto" numeric(14, 2),
	"lucro_operacional" numeric(14, 2),
	"lucro_liquido" numeric(14, 2),
	"valor_pedidos" numeric(14, 2),
	"resultado_efetivo" numeric(14, 2),
	"margem_resultado_efetivo" numeric(8, 4),
	"perc_materia_prima" numeric(8, 4),
	"perc_fixo_rateado" numeric(8, 4),
	"perc_tributos" numeric(8, 4),
	"perc_comissao_interna" numeric(8, 4),
	"perc_descontos" numeric(8, 4),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_checklist_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"modeloCaixaId" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"descricao" varchar(256) NOT NULL,
	"obrigatorio" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_checklist_letreiro_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"modeloLetreitoId" integer NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"descricao" varchar(512) NOT NULL,
	"obrigatorio" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_config_produtividade" (
	"id" serial PRIMARY KEY NOT NULL,
	"valorPorMinuto" numeric(10, 4) DEFAULT '0.15' NOT NULL,
	"bonusPorcentagem" numeric(5, 2) DEFAULT '20.00' NOT NULL,
	"penalidadePorcentagem" numeric(5, 2) DEFAULT '30.00' NOT NULL,
	"descricao" varchar(255),
	"ativo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_consumo_caixa" (
	"id" serial PRIMARY KEY NOT NULL,
	"modeloCaixaId" integer NOT NULL,
	"insumoId" integer NOT NULL,
	"quantidadePorCaixa" numeric(10, 4) DEFAULT '0' NOT NULL,
	"formulaConsumo" varchar(32) DEFAULT 'fixo' NOT NULL,
	"fator" numeric(8, 4) DEFAULT '1' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_cronometro_pausas" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoUsuarioId" integer NOT NULL,
	"pausadoEm" timestamp NOT NULL,
	"retomadoEm" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_custo_funcionario" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) DEFAULT 'Padrão' NOT NULL,
	"salarioMensal" numeric(10, 2) DEFAULT '0' NOT NULL,
	"horasMes" numeric(6, 2) DEFAULT '220' NOT NULL,
	"custoHora" numeric(10, 4),
	"ativo" integer DEFAULT 1 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_insumos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"unidadeMedida" varchar(32) NOT NULL,
	"custoUnitario" numeric(10, 4) DEFAULT '0' NOT NULL,
	"precoAtualizadoEm" timestamp,
	"categoria" varchar(64),
	"ativo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_insumos_letreiro" (
	"id" serial PRIMARY KEY NOT NULL,
	"modeloLetreiId" integer NOT NULL,
	"insumoId" integer NOT NULL,
	"quantidade" numeric(10, 4) DEFAULT '1' NOT NULL,
	"fatorM2" numeric(10, 4),
	"observacao" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_modelos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"descricao" text,
	"modeloCaixaIdPadrao" integer,
	"tempoPorM2Min" numeric(8, 2),
	"valorProdutividadePorMinLetreiro" numeric(10, 4),
	"ativo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_modelos_caixa" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"descricao" text,
	"tipoCaixa" varchar(32) DEFAULT 'padronizada' NOT NULL,
	"larguraCm" numeric(8, 2),
	"alturaCm" numeric(8, 2),
	"profundidadeCm" numeric(8, 2),
	"custoAquisicao" numeric(10, 2) DEFAULT '0' NOT NULL,
	"custoAquisicaoAtualizadoEm" timestamp,
	"tempoPorM2Min" numeric(8, 2),
	"tempoPorM3Min" numeric(8, 2),
	"tempoPorMetroArestaMin" numeric(8, 2),
	"valorProdutividadePorCm2" numeric(10, 6),
	"ativo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_pedido_checklist" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoId" integer NOT NULL,
	"itemId" integer NOT NULL,
	"marcado" integer DEFAULT 0 NOT NULL,
	"marcadoPor" varchar(128),
	"marcadoEm" timestamp
);
--> statement-breakpoint
CREATE TABLE "empacotamento_pedido_checklist_letreiro" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoId" integer NOT NULL,
	"itemId" integer NOT NULL,
	"marcado" integer DEFAULT 0 NOT NULL,
	"marcadoPor" varchar(128),
	"marcadoEm" timestamp
);
--> statement-breakpoint
CREATE TABLE "empacotamento_pedido_fotos" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoId" integer NOT NULL,
	"storageKey" text NOT NULL,
	"url" text NOT NULL,
	"usuarioNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_pedido_usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoId" integer NOT NULL,
	"usuarioId" integer,
	"usuarioNome" varchar(128) NOT NULL,
	"iniciadoEm" timestamp,
	"finalizadoEm" timestamp,
	"tempoSegundos" integer DEFAULT 0,
	"ativo" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"numeroPedido" varchar(64) NOT NULL,
	"cliente" varchar(256) NOT NULL,
	"modeloId" integer,
	"modeloNome" varchar(128),
	"modeloCaixaId" integer,
	"modeloCaixaNome" varchar(128),
	"tipoCaixa" varchar(64) DEFAULT '' NOT NULL,
	"arquivoUrl" text,
	"arquivoKey" text,
	"arquivoTipo" varchar(16),
	"kanbanStatus" "kanban_status" DEFAULT 'aguardando' NOT NULL,
	"prazoEntrega" timestamp,
	"horarioMaximo" varchar(8),
	"finalizadoEm" timestamp,
	"valorComissao" numeric(8, 2),
	"larguraCm" numeric(8, 2),
	"alturaCm" numeric(8, 2),
	"profundidadeCm" numeric(8, 2),
	"pesoKg" numeric(8, 2),
	"metrosQuadrados" numeric(10, 4),
	"cnpjCliente" varchar(32),
	"cepCliente" varchar(16),
	"enderecoCliente" varchar(512),
	"fotografiaUrl" text,
	"fotografiaKey" text,
	"observacoes" text,
	"createdBy" integer,
	"createdByNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_sessoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedidoId" integer NOT NULL,
	"operadorId" integer NOT NULL,
	"operadorNome" varchar(128) NOT NULL,
	"iniciadoEm" integer NOT NULL,
	"finalizadoEm" integer,
	"totalSegundos" integer DEFAULT 0 NOT NULL,
	"status" varchar(32) DEFAULT 'ativo' NOT NULL,
	"registradoEm" integer,
	"tempoRegistradoSegundos" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "empacotamento_sessoes_pausas" (
	"id" serial PRIMARY KEY NOT NULL,
	"sessaoId" integer NOT NULL,
	"pausadoEm" integer NOT NULL,
	"retomadoEm" integer
);
--> statement-breakpoint
CREATE TABLE "empacotamento_tabela_precos" (
	"id" serial PRIMARY KEY NOT NULL,
	"modeloId" integer NOT NULL,
	"tipoCaixa" varchar(64) NOT NULL,
	"valorComissao" numeric(8, 2) DEFAULT '0' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "erp_os_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"numeroOs" varchar(32) NOT NULL,
	"razaoSocial" varchar(256),
	"cnpj" varchar(20),
	"email" varchar(320),
	"cep" varchar(10),
	"municipio" varchar(128),
	"estado" varchar(2),
	"endereco" text,
	"telefone" varchar(20),
	"dataEmissao" date,
	"dataAprovacao" date,
	"dataEntregaPrevista" date,
	"nomeVendedor" varchar(256),
	"status" varchar(32),
	"valorTotal" numeric(12, 2),
	"descricao" text,
	"dataUltimaAtualizacao" timestamp DEFAULT now() NOT NULL,
	"sincronizadoEm" timestamp DEFAULT now() NOT NULL,
	"criadoEm" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "erp_os_cache_numeroOs_unique" UNIQUE("numeroOs")
);
--> statement-breakpoint
CREATE TABLE "error_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"category" varchar(64) NOT NULL,
	"description" text NOT NULL,
	"correction" text NOT NULL,
	"imageUrl" text,
	"imageKey" text,
	"tipoRegistro" "tipo_registro" DEFAULT 'retrabalho' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "error_library_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "erros_padrao" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigo" varchar(16) NOT NULL,
	"descricao" text NOT NULL,
	"categoria" varchar(64),
	"setor" varchar(64),
	"tipo" "cnq_tipo" DEFAULT 'interno',
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "erros_padrao_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "faturamento" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" varchar(20) NOT NULL,
	"ano" integer NOT NULL,
	"valorFaturado" numeric(14, 2) NOT NULL,
	"totalPedidos" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feriados" (
	"id" serial PRIMARY KEY NOT NULL,
	"data" date NOT NULL,
	"descricao" varchar(128) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "feriados_data_unique" UNIQUE("data")
);
--> statement-breakpoint
CREATE TABLE "financeiro_mensal" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"faturamentoOficial" numeric(14, 2),
	"despesasFixas" numeric(14, 2),
	"despesasVariaveis" numeric(14, 2),
	"numColaboradores" integer,
	"lucroBruto" numeric(14, 2),
	"lucroLiquido" numeric(14, 2),
	"impostoDas" numeric(14, 2),
	"impostoIcmsDifal" numeric(14, 2),
	"impostoDaems" numeric(14, 2),
	"comissoesBv" numeric(14, 2),
	"produtividadeSolda" numeric(14, 2),
	"freteRetrabalho" numeric(14, 2),
	"devSoftware" numeric(14, 2),
	"receitaOperacionalOs" numeric(14, 2),
	"resultadoEfetivo" numeric(14, 2),
	"saldoMes" numeric(14, 2),
	"tl1" numeric(14, 2),
	"tl2" numeric(14, 2),
	"tl3" numeric(14, 2),
	"notas" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financeiros_mensais" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"receita_bruta" numeric(14, 2) DEFAULT '0' NOT NULL,
	"receita_operacional" numeric(14, 2) DEFAULT '0' NOT NULL,
	"receita_financeira" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_total" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_fixas" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_variaveis" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_pessoal" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_financeiras" numeric(14, 2) DEFAULT '0' NOT NULL,
	"despesas_impostos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lucro_gruto" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lucro_operacional" numeric(14, 2) DEFAULT '0' NOT NULL,
	"lucro_liquido" numeric(14, 2) DEFAULT '0' NOT NULL,
	"entradas" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saidas" numeric(14, 2) DEFAULT '0' NOT NULL,
	"saldo_mes" numeric(14, 2) DEFAULT '0' NOT NULL,
	"fonte" varchar(64) DEFAULT 'manual',
	"fonte_arquivo" varchar(256),
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_orcamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"orcNumero" varchar(32),
	"empresa" varchar(256),
	"trabalho" text,
	"dataCadastro" varchar(32),
	"validade" varchar(32),
	"vendedor" varchar(256),
	"status" varchar(64),
	"motivoCancelamento" text,
	"total" numeric(14, 2),
	"custosTotal" numeric(14, 2),
	"margemLiquida" numeric(14, 2),
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historico_os" (
	"id" serial PRIMARY KEY NOT NULL,
	"osNumero" varchar(32),
	"tipoOs" varchar(64),
	"empresa" varchar(256),
	"trabalho" text,
	"logistica" varchar(128),
	"dataAprovacao" varchar(32),
	"dataEntrega" varchar(32),
	"dataFaturamento" varchar(32),
	"status" varchar(64),
	"vendedor" varchar(256),
	"valorTotal" numeric(14, 2),
	"descontos" numeric(14, 2),
	"valorOs" numeric(14, 2),
	"materiaPrima" numeric(14, 2),
	"custoFixo" numeric(14, 2),
	"maoDeObra" numeric(14, 2),
	"tarifasFinanceiras" numeric(14, 2),
	"comissoesInternas" numeric(14, 2),
	"comissoesExternas" numeric(14, 2),
	"terceirizados" numeric(14, 2),
	"tributos" numeric(14, 2),
	"custosTotal" numeric(14, 2),
	"resultadoReais" numeric(14, 2),
	"resultadoPct" numeric(7, 2),
	"contribuicaoReais" numeric(14, 2),
	"contribuicaoPct" numeric(7, 2),
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inteligencia_clientes_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"periodo_key" varchar(32) NOT NULL,
	"dados_json" text NOT NULL,
	"calculado_em" timestamp DEFAULT now() NOT NULL,
	"congelado" boolean DEFAULT false NOT NULL,
	"congelado_em" timestamp
);
--> statement-breakpoint
CREATE TABLE "ishikawa_causas" (
	"id" serial PRIMARY KEY NOT NULL,
	"planoId" integer NOT NULL,
	"categoria" "ishikawa_categoria" NOT NULL,
	"causa" text NOT NULL,
	"prioridade" "prioridade" DEFAULT 'media',
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ishikawa_planos" (
	"id" serial PRIMARY KEY NOT NULL,
	"retrabalhoid" integer NOT NULL,
	"problema" text NOT NULL,
	"efeito" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_base" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(64) NOT NULL,
	"subcategory" varchar(64),
	"keywords" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"knowledgeId" integer NOT NULL,
	"author" varchar(128) DEFAULT 'Equipe' NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_suggestions" (
	"id" serial PRIMARY KEY NOT NULL,
	"pergunta" text NOT NULL,
	"conteudoSugerido" text NOT NULL,
	"fonte" varchar(32) DEFAULT 'manual' NOT NULL,
	"autorId" integer,
	"autorNome" varchar(128),
	"status" varchar(32) DEFAULT 'pendente' NOT NULL,
	"tituloSugerido" varchar(256),
	"categoriaSugerida" varchar(64),
	"observacaoMaster" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kpis_cargo" (
	"id" serial PRIMARY KEY NOT NULL,
	"cargo_id" integer NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text NOT NULL,
	"meta" varchar(256),
	"ordem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "led_tipos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"descricao" text,
	"custo_unitario" numeric(10, 4) DEFAULT '0' NOT NULL,
	"unidade" varchar(16) DEFAULT 'un' NOT NULL,
	"ativo" varchar(4) DEFAULT 'sim' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "local_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"email" varchar(320),
	"passwordHash" varchar(256) NOT NULL,
	"role" "app_role" DEFAULT 'vendas' NOT NULL,
	"active" "sim_nao" DEFAULT 'sim' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "local_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "meta_produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"nomeProduto" varchar(256) NOT NULL,
	"codigoProduto" varchar(64),
	"metaParticipacaoPct" numeric(5, 2) DEFAULT '0' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"observacao" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas_comerciais" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendedor" varchar(256) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"metaCotacoes" integer,
	"metaVendas" integer,
	"metaFaturamento" numeric(14, 2),
	"metaConversao" numeric(5, 2),
	"metaTicketMedio" numeric(12, 2),
	"metaOsGeradas" integer,
	"metaClientesNovos" integer,
	"metaOsNovos" integer,
	"metaCotacoesNovos" integer,
	"metaFaturamentoNovos" numeric(14, 2),
	"metaTaxaFaturamento" numeric(5, 2),
	"metaTaxaFaturamentoNovos" numeric(5, 2),
	"metaConversaoNovos" numeric(5, 2),
	"metaTicketMedioNovos" numeric(12, 2),
	"metaValorOrcado" numeric(14, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas_operacionais" (
	"id" serial PRIMARY KEY NOT NULL,
	"anoVigencia" integer,
	"metaEntregaNoPrazoPct" numeric(5, 2) DEFAULT '90.00',
	"metaMaxRetrabalhosMes" integer,
	"metaMaxRetrabalhoPct" numeric(5, 2) DEFAULT '5.00',
	"metaFaturamentoMensal" numeric(14, 2) DEFAULT '425000.00',
	"metaFaturamentoAnual" numeric(16, 2),
	"metaLucratividadePct" numeric(5, 2),
	"metaLucratividadeValor" numeric(14, 2),
	"metaLucratividadeAnual" numeric(16, 2),
	"metaMetrosSoldadosMes" integer,
	"metaCapacidadeSoldaMin" integer,
	"metaCapacidadeSoldaMax" integer,
	"numSoldadores" integer,
	"metaMediaSoldaPorSoldador" numeric(10, 2),
	"metaMaxPrejuizoRetrabalhoMes" numeric(12, 2),
	"metaMaxPrejuizoRetrabalhoPct" numeric(5, 2),
	"metaOsPorColaboradorDia" numeric(6, 2),
	"metaRetrabalhosPorColaboradorMes" integer,
	"metaTicketMedio" numeric(10, 2) DEFAULT '3000.00',
	"metaOsGeradasMes" integer,
	"metaMaxMetrosTerceirizadosMes" integer,
	"metaMaxPercTerceirizacao" numeric(5, 2),
	"observacoes" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "metas_retrabalho" (
	"id" serial PRIMARY KEY NOT NULL,
	"ano" integer NOT NULL,
	"mes" integer,
	"metaMaxRetrabalhosMes" integer,
	"metaMaxCustoMes" numeric(12, 2),
	"metaMaxPercFaturamento" numeric(5, 2),
	"metaMaxPercEvitaveis" numeric(5, 2),
	"metaMinResolucaoDias" integer,
	"metaMaxReincidencias" integer,
	"metasPorSetor" text,
	"observacoes" text,
	"criadoPor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "motivos_atraso" (
	"id" serial PRIMARY KEY NOT NULL,
	"motivo" varchar(256) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "motivos_atraso_motivo_unique" UNIQUE("motivo")
);
--> statement-breakpoint
CREATE TABLE "mubisys_api_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"cache_key" varchar(64) NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"os_data" text,
	"orc_data" text,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mubisys_api_cache_cache_key_unique" UNIQUE("cache_key")
);
--> statement-breakpoint
CREATE TABLE "observacoes_financeiras_mensais" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"observacoes_manuais" text,
	"analise_ia" text,
	"contextos_especificos" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_abc" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"tipo" "abc_tipo" NOT NULL,
	"entidade" varchar(256) NOT NULL,
	"faturamento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"quantidade" integer DEFAULT 0 NOT NULL,
	"classificacao" "abc_classificacao" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_auditada" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"cotacoes" integer DEFAULT 0 NOT NULL,
	"os_normais" integer DEFAULT 0 NOT NULL,
	"taxa_conversao" numeric(5, 2) DEFAULT '0' NOT NULL,
	"faturamento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"valor_orcado" numeric(14, 2) DEFAULT '0' NOT NULL,
	"clientes_novos" integer DEFAULT 0 NOT NULL,
	"cotacoes_novos" integer DEFAULT 0 NOT NULL,
	"taxa_conv_novos" numeric(5, 2) DEFAULT '0' NOT NULL,
	"faturamento_novos" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status_validacao" "status_validacao" DEFAULT 'pendente' NOT NULL,
	"congelado" boolean DEFAULT false NOT NULL,
	"fonte_excel" varchar(512),
	"observacoes" text,
	"auditado_por" varchar(128) DEFAULT 'sistema' NOT NULL,
	"data_auditoria" timestamp DEFAULT now() NOT NULL,
	"data_congelamento" timestamp,
	"lista_clientes_novos" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_comercial" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"vendedor" varchar(128) NOT NULL,
	"faturamento" numeric(14, 2) DEFAULT '0' NOT NULL,
	"quantidadeOs" integer DEFAULT 0 NOT NULL,
	"novosClientes" integer DEFAULT 0 NOT NULL,
	"ticketMedio" numeric(10, 2),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_mensal" (
	"id" serial PRIMARY KEY NOT NULL,
	"mes" integer NOT NULL,
	"ano" integer NOT NULL,
	"osGeradas" integer,
	"osExpedicao" integer,
	"percExpedicao" numeric(5, 2),
	"metaOsDia" numeric(6, 2),
	"capacidadeOsDiaMin" numeric(6, 2),
	"capacidadeOsDiaMax" numeric(6, 2),
	"deficitFinalizacao" numeric(5, 2),
	"metaEmbalagemDia" numeric(6, 2),
	"producaoEmbalagemDia" numeric(6, 2),
	"metaAcabamentoDia" numeric(6, 2),
	"capacidadeAcabamentoDia" numeric(6, 2),
	"capacidadeNominalSolda" integer,
	"producaoInternaSolda" integer,
	"demandaTotalSolda" integer,
	"osTerceirizadas" integer,
	"metrosTerceirizados" integer,
	"metaOsGeradas" integer,
	"metaOsExpedicao" integer,
	"metaProducaoSolda" integer,
	"metaPercTerceirizacao" numeric(5, 2),
	"numSoldadores" integer,
	"soldadorSalarioBase" numeric(10, 2),
	"soldadorHorasExtras" numeric(8, 2),
	"soldadorValorHoraExtra" numeric(8, 2),
	"soldadorOutrosCustos" numeric(10, 2),
	"custoProdutividadeSolda" numeric(12, 2),
	"gestorSalarioBase" numeric(10, 2),
	"gestorHorasExtras" numeric(8, 2),
	"gestorValorHoraExtra" numeric(8, 2),
	"gestorOutrosCustos" numeric(10, 2),
	"custoMetroTerceirizado" numeric(8, 2),
	"precoVendaMetro" numeric(8, 2),
	"faturamentoRealizado" numeric(14, 2),
	"metaFaturamento" numeric(14, 2),
	"projetosEntregues" integer,
	"projetosNoPrazo" integer,
	"projetosForaPrazo" integer,
	"metaEntregaNoPrazoPct" numeric(5, 2),
	"metaRetrabalhoPct" numeric(5, 2),
	"totalPedidos" integer,
	"observacoes" text,
	"destaques" text,
	"gargalos" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos_acao" (
	"id" serial PRIMARY KEY NOT NULL,
	"codigoErro" varchar(20) NOT NULL,
	"setor" varchar(64),
	"titulo" varchar(256) NOT NULL,
	"problemaRaiz" text,
	"acoesPreventivas" text,
	"responsavel" varchar(128),
	"prazo" timestamp,
	"status" "plano_acao_status" DEFAULT 'pendente' NOT NULL,
	"reincidenciasNaAbertura" integer DEFAULT 0,
	"reincidenciasAposPlano" integer DEFAULT 0,
	"errosPrevenidos" text,
	"errosResolvidos" text,
	"metodologia" varchar(32) DEFAULT 'ambos',
	"codigosErro" text,
	"criadoPor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos_acao_comercial" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text,
	"responsavel" varchar(128),
	"prazo" date,
	"status" "plano_acao_comercial_status" DEFAULT 'pendente' NOT NULL,
	"prioridade" "prioridade_com_critica" DEFAULT 'media',
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planos_acao_qualidade" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text,
	"responsavel" varchar(128),
	"prazo" date,
	"status" "plano_acao_comercial_status" DEFAULT 'pendente' NOT NULL,
	"prioridade" "prioridade_com_critica" DEFAULT 'media',
	"retrabalhoid" integer,
	"observacoes" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pop_acessos" (
	"id" serial PRIMARY KEY NOT NULL,
	"popId" integer NOT NULL,
	"popCode" varchar(32) NOT NULL,
	"popTitle" varchar(256) NOT NULL,
	"usuarioNome" varchar(128) NOT NULL,
	"usuarioEmail" varchar(256),
	"tipo" "pop_acesso_tipo" DEFAULT 'visualizacao' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pops" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(32) NOT NULL,
	"title" varchar(256) NOT NULL,
	"sector" varchar(64) NOT NULL,
	"objective" text,
	"steps" text NOT NULL,
	"responsible" varchar(128),
	"version" varchar(16) DEFAULT '1.0',
	"active" "sim_nao" DEFAULT 'sim' NOT NULL,
	"attachments" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "pops_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "price_table_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"versao" varchar(16) NOT NULL,
	"sectionId" integer NOT NULL,
	"sectionTitle" varchar(256),
	"autor" varchar(128) DEFAULT 'sistema',
	"campoAlterado" varchar(64),
	"valorAnterior" text,
	"valorNovo" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_table_meta" (
	"id" serial PRIMARY KEY NOT NULL,
	"versao" varchar(16) DEFAULT '001' NOT NULL,
	"dataModificacao" timestamp DEFAULT now() NOT NULL,
	"descricao" text
);
--> statement-breakpoint
CREATE TABLE "price_table_sections" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" integer NOT NULL,
	"sectionOrder" integer DEFAULT 0 NOT NULL,
	"sectionTitle" varchar(256) NOT NULL,
	"contentJson" text NOT NULL,
	"notes" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producao_alertas" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordemId" integer NOT NULL,
	"setorId" integer,
	"tipoAlerta" "producao_alerta_tipo" NOT NULL,
	"motivo" varchar(256),
	"motivoAtrasoId" integer,
	"descricao" text,
	"resolvido" boolean DEFAULT false NOT NULL,
	"resolvidoEm" timestamp,
	"criadoEm" timestamp DEFAULT now() NOT NULL,
	"atualizadoEm" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producao_historico_alteracoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordemId" integer NOT NULL,
	"setorId" integer,
	"tipoAlteracao" varchar(128) NOT NULL,
	"valorAnterior" text,
	"valorNovo" text,
	"motivo" text,
	"alteradoPor" varchar(128) NOT NULL,
	"criadoEm" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "producao_ordens" (
	"id" serial PRIMARY KEY NOT NULL,
	"osNumero" varchar(32) NOT NULL,
	"clienteNome" varchar(256) NOT NULL,
	"clienteId" varchar(64),
	"descricaoPedido" text,
	"dataEntrada" date NOT NULL,
	"dataPrazo" date NOT NULL,
	"diasUteisTotais" integer NOT NULL,
	"statusGeral" "producao_status_geral" DEFAULT 'nao_iniciado' NOT NULL,
	"temPintura" boolean DEFAULT false NOT NULL,
	"temPvcExpandido" boolean DEFAULT false NOT NULL,
	"temAcrilico" boolean DEFAULT false NOT NULL,
	"temGalvanizado" boolean DEFAULT false NOT NULL,
	"temInox" boolean DEFAULT false NOT NULL,
	"temPerfil" boolean DEFAULT false NOT NULL,
	"temLed" boolean DEFAULT false NOT NULL,
	"temAdesivo" boolean DEFAULT false NOT NULL,
	"temGabarito" boolean DEFAULT false NOT NULL,
	"criadoPor" varchar(128),
	"criadoEm" timestamp DEFAULT now() NOT NULL,
	"atualizadoEm" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "producao_ordens_osNumero_unique" UNIQUE("osNumero")
);
--> statement-breakpoint
CREATE TABLE "producao_ordens_new" (
	"id" serial PRIMARY KEY NOT NULL,
	"osNumero" varchar(32) NOT NULL,
	"clienteNome" varchar(256) NOT NULL,
	"clienteId" varchar(64),
	"descricaoPedido" text,
	"dataEntrada" date NOT NULL,
	"dataPrazo" date NOT NULL,
	"diasUteisTotais" integer NOT NULL,
	"statusGeral" "producao_status_geral" DEFAULT 'nao_iniciado' NOT NULL,
	"temPintura" boolean DEFAULT false NOT NULL,
	"temPvcExpandido" boolean DEFAULT false NOT NULL,
	"temAcrilico" boolean DEFAULT false NOT NULL,
	"temGalvanizado" boolean DEFAULT false NOT NULL,
	"temInox" boolean DEFAULT false NOT NULL,
	"temPerfil" boolean DEFAULT false NOT NULL,
	"temLed" boolean DEFAULT false NOT NULL,
	"temAdesivo" boolean DEFAULT false NOT NULL,
	"temGabarito" boolean DEFAULT false NOT NULL,
	"criadoPor" varchar(128),
	"criadoEm" timestamp DEFAULT now() NOT NULL,
	"atualizadoEm" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "producao_ordens_new_osNumero_unique" UNIQUE("osNumero")
);
--> statement-breakpoint
CREATE TABLE "producao_setores" (
	"id" serial PRIMARY KEY NOT NULL,
	"ordemId" integer NOT NULL,
	"setorNome" varchar(128) NOT NULL,
	"sequencia" integer NOT NULL,
	"status" "producao_setor_status" DEFAULT 'nao_iniciado' NOT NULL,
	"diasAlocados" integer NOT NULL,
	"dataInicio" date,
	"dataFim" date,
	"dataFimPrevista" date NOT NULL,
	"emRisco" boolean DEFAULT false NOT NULL,
	"dependeDe" varchar(256),
	"atualizadoEm" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulamentos" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text,
	"categoria" varchar(64),
	"conteudo" text,
	"versao" varchar(16) DEFAULT '1.0',
	"ativo" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"type" "regulation_type" NOT NULL,
	"content" text NOT NULL,
	"version" varchar(16) DEFAULT '1.0',
	"active" "sim_nao" DEFAULT 'sim' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "responsabilidades_cargo" (
	"id" serial PRIMARY KEY NOT NULL,
	"cargo_id" integer NOT NULL,
	"titulo" varchar(256) NOT NULL,
	"descricao" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "retrabalhos" (
	"id" serial PRIMARY KEY NOT NULL,
	"titulo" varchar(256),
	"osRetrabalhada" varchar(32),
	"osOriginal" varchar(64),
	"data" timestamp NOT NULL,
	"setor" varchar(64) NOT NULL,
	"tipo" "retrabalho_tipo" NOT NULL,
	"custo" numeric(10, 2) DEFAULT '0' NOT NULL,
	"frete" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(10, 2) DEFAULT '0' NOT NULL,
	"codigoErro" varchar(20),
	"responsavel" varchar(128),
	"tipoResponsavel" "tipo_responsavel" DEFAULT 'operador',
	"descricao" text,
	"classe" "retrabalho_classe" NOT NULL,
	"horasImpacto" numeric(6, 2),
	"mes" varchar(20),
	"tipoRegistro" "tipo_registro" DEFAULT 'retrabalho' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" "app_role" NOT NULL,
	"pageKey" varchar(64) NOT NULL,
	"canAccess" "sim_nao" DEFAULT 'nao' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(256) NOT NULL,
	"description" text,
	"frequency" "routine_frequency" DEFAULT 'semanal' NOT NULL,
	"assignedTo" varchar(128),
	"startDate" timestamp,
	"nextDue" timestamp,
	"lastDone" timestamp,
	"calendarDates" text,
	"status" "routine_status" DEFAULT 'pendente' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(128) NOT NULL,
	"company" varchar(128),
	"category" varchar(64) NOT NULL,
	"supplies" text,
	"contact" varchar(128),
	"phone" varchar(32),
	"email" varchar(128),
	"paymentTerms" text,
	"notes" text,
	"active" "sim_nao" DEFAULT 'sim' NOT NULL,
	"createdByNome" varchar(128),
	"updatedByNome" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataExecucao" timestamp DEFAULT now() NOT NULL,
	"quantidadeOsImportadas" integer DEFAULT 0 NOT NULL,
	"status" "sync_status" DEFAULT 'PENDENTE' NOT NULL,
	"mensagemErro" text,
	"tempoExecucaoMs" integer,
	"proximaExecucao" timestamp,
	"criadoEm" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportadora_avaliacoes" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportadoraId" integer NOT NULL,
	"estrelas" integer NOT NULL,
	"comentario" text,
	"autor" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportadora_cidades" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportadoraId" integer NOT NULL,
	"cidade" varchar(128) NOT NULL,
	"estado" varchar(2) NOT NULL,
	"telefone" varchar(256),
	"observacao" varchar(512),
	"endereco" varchar(512),
	"responsavel" varchar(128),
	"sede" varchar(128),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportadora_filiais" (
	"id" serial PRIMARY KEY NOT NULL,
	"transportadoraId" integer NOT NULL,
	"nome" varchar(128) NOT NULL,
	"endereco" text,
	"cidade" varchar(128),
	"estado" varchar(2),
	"telefone" varchar(256),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transportadoras" (
	"id" serial PRIMARY KEY NOT NULL,
	"nome" varchar(128) NOT NULL,
	"site" varchar(256),
	"endereco" text,
	"referencia" text,
	"nomeContato" varchar(128),
	"telefoneContato" varchar(32),
	"whatsappContato" varchar(32),
	"nomeContatoNegocial" varchar(128),
	"telefoneContatoNegocial" varchar(32),
	"emailContatoNegocial" varchar(128),
	"formaCotacao" "forma_cotacao" DEFAULT 'site',
	"linkSiteCotacao" varchar(256),
	"modais" text,
	"pesoMaxKg" numeric(10, 2),
	"alturaMaxCm" numeric(8, 2),
	"larguraMaxCm" numeric(8, 2),
	"comprimentoMaxCm" numeric(8, 2),
	"somaMaxCm" numeric(8, 2),
	"horarioLimiteColeta" varchar(8),
	"horarioLimiteMercadoria" varchar(8),
	"distanciaSedMin" integer,
	"observacoes" text,
	"ativa" "sim_nao" DEFAULT 'sim' NOT NULL,
	"logoUrl" varchar(512),
	"realizaColeta" "sim_nao" DEFAULT 'nao',
	"ultAtualizTabela" varchar(16),
	"semTabelaNegociavel" "sim_nao" DEFAULT 'nao',
	"whatsappContatoNegocial" varchar(32),
	"portalUrl" varchar(256),
	"portalUsuario" varchar(128),
	"portalEmail" varchar(128),
	"portalObservacao" text,
	"portalSenha" varchar(256),
	"ultAtualizCidades" varchar(16),
	"coberturaTotal" integer DEFAULT 0,
	"contatoRastreio" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64) NOT NULL,
	"name" text,
	"email" varchar(320),
	"loginMethod" varchar(64),
	"role" "oauth_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId")
);
--> statement-breakpoint
ALTER TABLE "analise_curriculos" ADD CONSTRAINT "analise_curriculos_cargoId_cargos_funcoes_id_fk" FOREIGN KEY ("cargoId") REFERENCES "public"."cargos_funcoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "kpis_cargo" ADD CONSTRAINT "kpis_cargo_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_alertas" ADD CONSTRAINT "producao_alertas_ordemId_producao_ordens_id_fk" FOREIGN KEY ("ordemId") REFERENCES "public"."producao_ordens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_alertas" ADD CONSTRAINT "producao_alertas_setorId_producao_setores_id_fk" FOREIGN KEY ("setorId") REFERENCES "public"."producao_setores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_alertas" ADD CONSTRAINT "producao_alertas_motivoAtrasoId_motivos_atraso_id_fk" FOREIGN KEY ("motivoAtrasoId") REFERENCES "public"."motivos_atraso"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_historico_alteracoes" ADD CONSTRAINT "producao_historico_alteracoes_ordemId_producao_ordens_id_fk" FOREIGN KEY ("ordemId") REFERENCES "public"."producao_ordens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_historico_alteracoes" ADD CONSTRAINT "producao_historico_alteracoes_setorId_producao_setores_id_fk" FOREIGN KEY ("setorId") REFERENCES "public"."producao_setores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "producao_setores" ADD CONSTRAINT "producao_setores_ordemId_producao_ordens_id_fk" FOREIGN KEY ("ordemId") REFERENCES "public"."producao_ordens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "responsabilidades_cargo" ADD CONSTRAINT "responsabilidades_cargo_cargo_id_cargos_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "erp_os_cache_numero_os_idx" ON "erp_os_cache" USING btree ("numeroOs");--> statement-breakpoint
CREATE UNIQUE INDEX "erp_os_cache_cnpj_idx" ON "erp_os_cache" USING btree ("cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "faturamento_mes_ano_unique" ON "faturamento" USING btree ("mes","ano");