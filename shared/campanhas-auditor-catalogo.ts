// Catálogo originado de docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md, com os IDs CAMP-001..084.
// Status inicial registra a auditoria do repositório, não aprovação em runtime.
export const CAMPANHAS_AUDITOR_CATALOGO = [
  {
    id: "CAMP-001",
    name: "Cada mensagem deve ter estados de enviada",
    description:
      "Cada mensagem deve ter estados de enviada, entregue e lida quando disponíveis, com origem, data/hora, idempotência e indicador que diferencie ausência de evento de falha.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Cada mensagem deve ter estados de enviada, entregue e lida quando disponíveis, com origem, data/hora, idempotência e indicador que diferencie ausência de evento de falha.",
    associatedTests: ["server/__tests__/wts-chat-client.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-002",
    name: "Registrar resposta interativa/botão/lista recebida com telefone",
    description:
      "Registrar resposta interativa/botão/lista recebida com telefone, campanha candidata, mensagem de origem e timestamp; validar payload real do provedor.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Registrar resposta interativa/botão/lista recebida com telefone, campanha candidata, mensagem de origem e timestamp; validar payload real do provedor.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-003",
    name: "Persistir ID e rótulo do botão escolhido",
    description:
      "Persistir ID e rótulo do botão escolhido; teste deve provar que dois botões distintos não viram o mesmo evento.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Persistir ID e rótulo do botão escolhido; teste deve provar que dois botões distintos não viram o mesmo evento.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-004",
    name: "Pedido de saída recebido deve gravar opt-out automaticamente",
    description:
      "Pedido de saída recebido deve gravar opt-out automaticamente, normalizar telefone e impedir envios promocionais posteriores.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Pedido de saída recebido deve gravar opt-out automaticamente, normalizar telefone e impedir envios promocionais posteriores.",
    associatedTests: ["server/__tests__/campanhas-whatsapp.test.ts"],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-005",
    name: "Uma fonte central de supressão deve ser consultada pelo envio nativo",
    description:
      "Uma fonte central de supressão deve ser consultada pelo envio nativo, CRM, Retenção e APIs externas antes de qualquer envio.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Uma fonte central de supressão deve ser consultada pelo envio nativo, CRM, Retenção e APIs externas antes de qualquer envio.",
    associatedTests: [
      "server/__tests__/campanhas-whatsapp.test.ts",
      "server/__tests__/campanhas-whatsapp-db.test.ts",
    ],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-006",
    name: "Relatório deve mostrar por campanha os bloqueios/exclusões",
    description:
      "Relatório deve mostrar por campanha os bloqueios/exclusões, motivo e data, sem tratar quarentena como pedido de saída.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Relatório deve mostrar por campanha os bloqueios/exclusões, motivo e data, sem tratar quarentena como pedido de saída.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-007",
    name: "Para cada telefone",
    description:
      "Para cada telefone, exibir tentativas históricas completas por campanha, inclusive origem e resultado, não apenas o último contato.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Para cada telefone, exibir tentativas históricas completas por campanha, inclusive origem e resultado, não apenas o último contato.",
    associatedTests: [
      "server/__tests__/campanhas-whatsapp.test.ts",
      "server/__tests__/campanhas-whatsapp-db.test.ts",
      "server/__tests__/campanhas-contatos.test.ts",
    ],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-008",
    name: "Marcar primeira tentativa que gerou sinal comercial e mostrar número ordinal",
    description:
      "Marcar primeira tentativa que gerou sinal comercial e mostrar número ordinal, evidência e regra de classificação.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Marcar primeira tentativa que gerou sinal comercial e mostrar número ordinal, evidência e regra de classificação.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-009",
    name: "Medir tempo entre envio elegível",
    description:
      "Medir tempo entre envio elegível, resposta do cliente e primeiro atendimento humano; deixar nulos quando origem/horário não forem confiáveis.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Medir tempo entre envio elegível, resposta do cliente e primeiro atendimento humano; deixar nulos quando origem/horário não forem confiáveis.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-010",
    name: "Heatmap deve agregar eventos reais de resposta/interação por dia e hora",
    description:
      "Heatmap deve agregar eventos reais de resposta/interação por dia e hora, com fuso explícito e filtro por campanha/período.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Heatmap deve agregar eventos reais de resposta/interação por dia e hora, com fuso explícito e filtro por campanha/período.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-011",
    name: "Exibir taxas com denominadores definidos para resposta",
    description:
      "Exibir taxas com denominadores definidos para resposta, interesse e rejeição; mensagens sem classificação não podem ser silenciosamente contadas como negativas.",
    module: "Disparos e engajamento",
    acceptanceCriteria:
      "Exibir taxas com denominadores definidos para resposta, interesse e rejeição; mensagens sem classificação não podem ser silenciosamente contadas como negativas.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-012",
    name: "Classificar ausência/menu/automação com tipo",
    description:
      "Classificar ausência/menu/automação com tipo, evidência e confiança; validar mensagens curtas, menus e variações de texto.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Classificar ausência/menu/automação com tipo, evidência e confiança; validar mensagens curtas, menus e variações de texto.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-013",
    name: "Usar latência apenas como indício combinado com outros sinais",
    description:
      "Usar latência apenas como indício combinado com outros sinais; documentar limiar e não concluir “bot” só por resposta rápida.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Usar latência apenas como indício combinado com outros sinais; documentar limiar e não concluir “bot” só por resposta rápida.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-014",
    name: "Separar mensagem humana de automática com confiança e permitir correção humana regist…",
    description:
      "Separar mensagem humana de automática com confiança e permitir correção humana registrada.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Separar mensagem humana de automática com confiança e permitir correção humana registrada.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-015",
    name: "Classificar explicitamente positiva",
    description:
      "Classificar explicitamente positiva, negativa, neutra ou incerta; cobrir todos os resultados e falhas do provedor de IA em teste.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Classificar explicitamente positiva, negativa, neutra ou incerta; cobrir todos os resultados e falhas do provedor de IA em teste.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-016",
    name: "Definir interesse comercial por evidência citável e permitir revisão",
    description:
      "Definir interesse comercial por evidência citável e permitir revisão; testar falso positivo, falso negativo e caso ambíguo.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Definir interesse comercial por evidência citável e permitir revisão; testar falso positivo, falso negativo e caso ambíguo.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-017",
    name: "Produzir intenção de compra em categorias definidas e gravar confiança",
    description:
      "Produzir intenção de compra em categorias definidas e gravar confiança; separar intenção de score ICP.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Produzir intenção de compra em categorias definidas e gravar confiança; separar intenção de score ICP.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-018",
    name: "Gerar clusters versionados e explicáveis",
    description:
      "Gerar clusters versionados e explicáveis; distribuição do dashboard deve fechar com o total de leads classificados.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Gerar clusters versionados e explicáveis; distribuição do dashboard deve fechar com o total de leads classificados.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-019",
    name: "Classificar perfil do interlocutor com opção desconhecido e evidência da conversa",
    description:
      "Classificar perfil do interlocutor com opção desconhecido e evidência da conversa; não inferir dados pessoais sem suporte.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Classificar perfil do interlocutor com opção desconhecido e evidência da conversa; não inferir dados pessoais sem suporte.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-020",
    name: "Extrair tipo e resumo de objeção com referência à fala original e opção explícita “ne…",
    description:
      "Extrair tipo e resumo de objeção com referência à fala original e opção explícita “nenhuma/incerta”.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Extrair tipo e resumo de objeção com referência à fala original e opção explícita “nenhuma/incerta”.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-021",
    name: "Calcular ICP em escala documentada",
    description:
      "Calcular ICP em escala documentada, reproduzível e independente de intenção; incluir fatores que formaram a pontuação.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Calcular ICP em escala documentada, reproduzível e independente de intenção; incluir fatores que formaram a pontuação.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-022",
    name: "Manter score de intenção separado do score ICP e testar que variar um não altera auto…",
    description:
      "Manter score de intenção separado do score ICP e testar que variar um não altera automaticamente o outro.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Manter score de intenção separado do score ICP e testar que variar um não altera automaticamente o outro.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-023",
    name: "Filtro de lead quente deve usar limiar configurável/documentado",
    description:
      "Filtro de lead quente deve usar limiar configurável/documentado, persistir filtros e respeitar supressão antes de retargeting.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Filtro de lead quente deve usar limiar configurável/documentado, persistir filtros e respeitar supressão antes de retargeting.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-024",
    name: "Profundidade deve contar turnos da conversa por regra definida",
    description:
      "Profundidade deve contar turnos da conversa por regra definida; testar conversa curta, longa, duplicada e incompleta.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Profundidade deve contar turnos da conversa por regra definida; testar conversa curta, longa, duplicada e incompleta.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-025",
    name: "Diagnóstico deve apresentar evidências",
    description:
      "Diagnóstico deve apresentar evidências, limitações e recomendações acionáveis sem afirmar causalidade não observada.",
    module: "Inteligência artificial",
    acceptanceCriteria:
      "Diagnóstico deve apresentar evidências, limitações e recomendações acionáveis sem afirmar causalidade não observada.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-026",
    name: "Usar telefone normalizado como chave inicial do lead e preservar a origem do dado",
    description:
      "Usar telefone normalizado como chave inicial do lead e preservar a origem do dado, sem exigir CNPJ na primeira prospecção.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Usar telefone normalizado como chave inicial do lead e preservar a origem do dado, sem exigir CNPJ na primeira prospecção.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-027",
    name: "Normalizar números e associá-los a cadastro/lead com trilha de origem",
    description:
      "Normalizar números e associá-los a cadastro/lead com trilha de origem, conflitos detectáveis e sem fundir pessoas por coincidência de telefone.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Normalizar números e associá-los a cadastro/lead com trilha de origem, conflitos detectáveis e sem fundir pessoas por coincidência de telefone.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-028",
    name: "Quando lead externo entrar no ERP",
    description:
      "Quando lead externo entrar no ERP, reconhecer o vínculo com histórico verificável e sem duplicar lead, mesmo após sincronização tardia.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Quando lead externo entrar no ERP, reconhecer o vínculo com histórico verificável e sem duplicar lead, mesmo após sincronização tardia.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-029",
    name: "Relacionar lead a cadastro de cliente por ID estável ou associação humana aprovada",
    description:
      "Relacionar lead a cadastro de cliente por ID estável ou associação humana aprovada; mostrar confiança e permitir desfazer.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Relacionar lead a cadastro de cliente por ID estável ou associação humana aprovada; mostrar confiança e permitir desfazer.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-030",
    name: "Associar propostas/orçamentos por ID e telefone/cliente com trilha de evidência",
    description:
      "Associar propostas/orçamentos por ID e telefone/cliente com trilha de evidência; não inferir vínculo apenas pelo nome aproximado.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Associar propostas/orçamentos por ID e telefone/cliente com trilha de evidência; não inferir vínculo apenas pelo nome aproximado.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-031",
    name: "Associar OS por identificador e registrar cliente",
    description:
      "Associar OS por identificador e registrar cliente, datas e campanha candidata; cobrir OS sem telefone e OS repetida.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Associar OS por identificador e registrar cliente, datas e campanha candidata; cobrir OS sem telefone e OS repetida.",
    associatedTests: ["server/__tests__/campanhas-contatos.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-032",
    name: "Contabilizar somente venda confirmada segundo status/ID do MubiSys",
    description:
      "Contabilizar somente venda confirmada segundo status/ID do MubiSys; separar status aprovado, faturado, cancelado e não confirmado.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Contabilizar somente venda confirmada segundo status/ID do MubiSys; separar status aprovado, faturado, cancelado e não confirmado.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-033",
    name: "Calcular quantidade de vendas e conversão por campanha com denominador de contatos el…",
    description:
      "Calcular quantidade de vendas e conversão por campanha com denominador de contatos elegíveis explicitado e sem dupla contagem.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Calcular quantidade de vendas e conversão por campanha com denominador de contatos elegíveis explicitado e sem dupla contagem.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-034",
    name: "Somar faturamento atribuído por regra documentada e permitir auditar quais OS compõem…",
    description:
      "Somar faturamento atribuído por regra documentada e permitir auditar quais OS compõem cada total.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Somar faturamento atribuído por regra documentada e permitir auditar quais OS compõem cada total.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-035",
    name: "Ticket médio deve ser receita atribuída dividida pelo número de vendas atribuídas",
    description:
      "Ticket médio deve ser receita atribuída dividida pelo número de vendas atribuídas, com caso de zero vendas testado.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Ticket médio deve ser receita atribuída dividida pelo número de vendas atribuídas, com caso de zero vendas testado.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-036",
    name: "Mostrar custo estimado separado do custo real",
    description:
      "Mostrar custo estimado separado do custo real; origem do custo e ausência de dado devem ficar visíveis.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Mostrar custo estimado separado do custo real; origem do custo e ausência de dado devem ficar visíveis.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-037",
    name: "Calcular margem de contribuição/ROI com fórmula e custo confiáveis",
    description:
      "Calcular margem de contribuição/ROI com fórmula e custo confiáveis; bloquear ou sinalizar cálculo quando faltar margem/custo.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Calcular margem de contribuição/ROI com fórmula e custo confiáveis; bloquear ou sinalizar cálculo quando faltar margem/custo.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-038",
    name: "Identificar primeira compra",
    description:
      "Identificar primeira compra, recompra e reativação no relatório por cliente deduplicado, com período e regra explícitos.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Identificar primeira compra, recompra e reativação no relatório por cliente deduplicado, com período e regra explícitos.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-039",
    name: "Diferenciar receita direta",
    description:
      "Diferenciar receita direta, assistida e temporal por regra de atribuição; permitir inspecionar toques e janela usados.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Diferenciar receita direta, assistida e temporal por regra de atribuição; permitir inspecionar toques e janela usados.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-040",
    name: "Cada venda deve ser atribuída no máximo uma vez no total e a regra de crédito entre c…",
    description:
      "Cada venda deve ser atribuída no máximo uma vez no total e a regra de crédito entre campanhas deve ser reproduzível.",
    module: "Integração com MubiSys",
    acceptanceCriteria:
      "Cada venda deve ser atribuída no máximo uma vez no total e a regra de crédito entre campanhas deve ser reproduzível.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-041",
    name: "Dashboard executivo deve resumir resultado comercial e operacional por campanha",
    description:
      "Dashboard executivo deve resumir resultado comercial e operacional por campanha, explicando fonte, período e limitações de cada KPI.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Dashboard executivo deve resumir resultado comercial e operacional por campanha, explicando fonte, período e limitações de cada KPI.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-042",
    name: "Funil deve mostrar totais e conversões entre envio",
    description:
      "Funil deve mostrar totais e conversões entre envio, entrega, resposta, interesse, proposta e venda, com totais reconciliáveis.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Funil deve mostrar totais e conversões entre envio, entrega, resposta, interesse, proposta e venda, com totais reconciliáveis.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-043",
    name: "Comparar campanhas/famílias em períodos equivalentes",
    description:
      "Comparar campanhas/famílias em períodos equivalentes, com taxa e volume e sem misturar denominadores diferentes.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Comparar campanhas/famílias em períodos equivalentes, com taxa e volume e sem misturar denominadores diferentes.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-044",
    name: "Relacionar resultado comercial à tentativa ordinal 1",
    description:
      "Relacionar resultado comercial à tentativa ordinal 1, 2, … com amostra e taxa de cada tentativa.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Relacionar resultado comercial à tentativa ordinal 1, 2, … com amostra e taxa de cada tentativa.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-045",
    name: "Mostrar qualidade e profundidade por campanha com distribuição de classes",
    description:
      "Mostrar qualidade e profundidade por campanha com distribuição de classes, turnos e confiança da análise.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Mostrar qualidade e profundidade por campanha com distribuição de classes, turnos e confiança da análise.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-046",
    name: "Relatório financeiro deve reconciliar vendas/OS",
    description:
      "Relatório financeiro deve reconciliar vendas/OS, receita, custos e margem com detalhamento auditável.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Relatório financeiro deve reconciliar vendas/OS, receita, custos e margem com detalhamento auditável.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-047",
    name: "Mostrar recompra atribuída e não atribuída",
    description:
      "Mostrar recompra atribuída e não atribuída, quantidade de clientes e receita por coorte/período.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Mostrar recompra atribuída e não atribuída, quantidade de clientes e receita por coorte/período.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-048",
    name: "Permitir comparar resultado por segmento",
    description:
      "Permitir comparar resultado por segmento, cluster e perfil, incluindo tamanho da audiência e conversão.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Permitir comparar resultado por segmento, cluster e perfil, incluindo tamanho da audiência e conversão.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-049",
    name: "Medir resposta e atendimento humano por tempo/SLA",
    description:
      "Medir resposta e atendimento humano por tempo/SLA, fila e desfecho sem confundir bot com vendedor.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Medir resposta e atendimento humano por tempo/SLA, fila e desfecho sem confundir bot com vendedor.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-050",
    name: "Criar variante A/B com alocação registrada",
    description:
      "Criar variante A/B com alocação registrada, audiência comparável, métrica primária e regra para declarar resultado.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Criar variante A/B com alocação registrada, audiência comparável, métrica primária e regra para declarar resultado.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-051",
    name: "Lista de leads deve permitir busca e filtros combináveis e manter os mesmos critérios…",
    description:
      "Lista de leads deve permitir busca e filtros combináveis e manter os mesmos critérios na exportação.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Lista de leads deve permitir busca e filtros combináveis e manter os mesmos critérios na exportação.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-052",
    name: "Filtro de leads quentes deve ser consistente entre tela",
    description:
      "Filtro de leads quentes deve ser consistente entre tela, exportação e criação de audiência.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Filtro de leads quentes deve ser consistente entre tela, exportação e criação de audiência.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-053",
    name: "Exportar XLSX com campos e filtros visíveis",
    description:
      "Exportar XLSX com campos e filtros visíveis, mantendo telefone normalizado e sem incluir contatos suprimidos em audiência de envio.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Exportar XLSX com campos e filtros visíveis, mantendo telefone normalizado e sem incluir contatos suprimidos em audiência de envio.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-054",
    name: "Criar retargeting com um clique a partir de filtros ativos e revalidar permissões",
    description:
      "Criar retargeting com um clique a partir de filtros ativos e revalidar permissões, opt-out e quarentena no envio final.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Criar retargeting com um clique a partir de filtros ativos e revalidar permissões, opt-out e quarentena no envio final.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-055",
    name: "Resumo executivo deve apontar período",
    description:
      "Resumo executivo deve apontar período, amostra, evidências e recomendações; não pode inventar vendas ou causalidade.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Resumo executivo deve apontar período, amostra, evidências e recomendações; não pode inventar vendas ou causalidade.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-056",
    name: "Gerar PDF técnico reproduzível a partir do estado auditado",
    description:
      "Gerar PDF técnico reproduzível a partir do estado auditado, com data/commit, pontos fortes, limitações e comando/script.",
    module: "Relatórios e gestão comercial",
    acceptanceCriteria:
      "Gerar PDF técnico reproduzível a partir do estado auditado, com data/commit, pontos fortes, limitações e comando/script.",
    associatedTests: [],
    criticality: "media",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-057",
    name: "Este documento cataloga 74 requisitos com IDs permanentes",
    description:
      "Este documento cataloga 74 requisitos com IDs permanentes, situação observada e critério mínimo de aceite; alterações futuras devem versionar o histórico.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Este documento cataloga 74 requisitos com IDs permanentes, situação observada e critério mínimo de aceite; alterações futuras devem versionar o histórico.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Entregue nesta auditoria",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-058",
    name: "Testes backend devem cobrir cada regra crítica",
    description:
      "Testes backend devem cobrir cada regra crítica, falhas e idempotência; gate deve registrar versão, resultado e log sem dados sensíveis.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes backend devem cobrir cada regra crítica, falhas e idempotência; gate deve registrar versão, resultado e log sem dados sensíveis.",
    associatedTests: ["server/__tests__/campanhas-whatsapp.test.ts"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-059",
    name: "Componentes/páginas críticos devem ter testes de filtros",
    description:
      "Componentes/páginas críticos devem ter testes de filtros, estados, erros, acessibilidade essencial e exportação.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Componentes/páginas críticos devem ter testes de filtros, estados, erros, acessibilidade essencial e exportação.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-060",
    name: "Simulador deve percorrer campanha e interações com fixtures sem enviar WhatsApp real…",
    description:
      "Simulador deve percorrer campanha e interações com fixtures sem enviar WhatsApp real nem alterar dados de produção.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Simulador deve percorrer campanha e interações com fixtures sem enviar WhatsApp real nem alterar dados de produção.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-061",
    name: "Testar eventos de botão/lista desde payload recebido até contador/lead",
    description:
      "Testar eventos de botão/lista desde payload recebido até contador/lead, incluindo retry e payload inválido.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testar eventos de botão/lista desde payload recebido até contador/lead, incluindo retry e payload inválido.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch/parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-062",
    name: "Testes devem provar opt-out automático/manual e bloqueio em todos os canais e APIs an…",
    description:
      "Testes devem provar opt-out automático/manual e bloqueio em todos os canais e APIs antes de chamar o provedor.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes devem provar opt-out automático/manual e bloqueio em todos os canais e APIs antes de chamar o provedor.",
    associatedTests: [
      "server/__tests__/campanhas-whatsapp.test.ts",
      "server/__tests__/campanhas-whatsapp-db.test.ts",
    ],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-063",
    name: "Testes IA devem cobrir schema",
    description:
      "Testes IA devem cobrir schema, classificação, incerteza, fallback, custo/limite e regressões de prompt.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes IA devem cobrir schema, classificação, incerteza, fallback, custo/limite e regressões de prompt.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "bloqueado_dependencia",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Outra branch",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-064",
    name: "Testes MubiSys devem validar contrato",
    description:
      "Testes MubiSys devem validar contrato, paginação, falha, campos ausentes e associação por IDs; relatório deve indicar quando teste de rede foi pulado.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes MubiSys devem validar contrato, paginação, falha, campos ausentes e associação por IDs; relatório deve indicar quando teste de rede foi pulado.",
    associatedTests: [
      "server/__tests__/campanhas-whatsapp.test.ts",
      "server/__tests__/mubisys.test.ts",
    ],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-065",
    name: "Testes financeiros devem reconciliar fórmulas de receita",
    description:
      "Testes financeiros devem reconciliar fórmulas de receita, custo, ticket, margem, ROI e deduplicação em casos-limite.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes financeiros devem reconciliar fórmulas de receita, custo, ticket, margem, ROI e deduplicação em casos-limite.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente/não comprovado",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-066",
    name: "Testes devem validar cada KPI e linha do relatório contra fixtures conhecidas",
    description:
      "Testes devem validar cada KPI e linha do relatório contra fixtures conhecidas, inclusive limites de data e significado dos totais.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Testes devem validar cada KPI e linha do relatório contra fixtures conhecidas, inclusive limites de data e significado dos totais.",
    associatedTests: ["server/__tests__/campanhas-whatsapp.test.ts"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-067",
    name: "Suíte de regressão deve cobrir envio sequencial",
    description:
      "Suíte de regressão deve cobrir envio sequencial, quarentena, cadência, opt-out, fontes, relatório e histórico após cada release.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Suíte de regressão deve cobrir envio sequencial, quarentena, cadência, opt-out, fontes, relatório e histórico após cada release.",
    associatedTests: ["server/__tests__/campanhas-whatsapp.test.ts"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-068",
    name: "Auditor deve verificar commit/branch remota e deployment real por integração autorizada",
    description:
      "Auditor deve verificar commit/branch remota e deployment real por integração autorizada; nunca declarar publicado só porque existe commit local.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Auditor deve verificar commit/branch remota e deployment real por integração autorizada; nunca declarar publicado só porque existe commit local.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Parcial",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-069",
    name: "Lacunas ausentes",
    description:
      "Lacunas ausentes, parciais, de outra branch e não verificadas devem ser listadas sem declarar sucesso sem evidência.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Lacunas ausentes, parciais, de outra branch e não verificadas devem ser listadas sem declarar sucesso sem evidência.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Entregue nesta auditoria",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-070",
    name: "Registrar a ausência de testes frontend de Campanhas e que o teste de contrato MubiSy…",
    description:
      "Registrar a ausência de testes frontend de Campanhas e que o teste de contrato MubiSys pode ser condicionalmente pulado; atualizar ao revisar suítes.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Registrar a ausência de testes frontend de Campanhas e que o teste de contrato MubiSys pode ser condicionalmente pulado; atualizar ao revisar suítes.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Entregue nesta auditoria",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-071",
    name: "Cada auditoria executada deve ter histórico imutável com data",
    description:
      "Cada auditoria executada deve ter histórico imutável com data, commit, ambiente, versão de regras, resumo e localização dos detalhes.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Cada auditoria executada deve ter histórico imutável com data, commit, ambiente, versão de regras, resumo e localização dos detalhes.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-072",
    name: "Painel visual deve mostrar aprovados",
    description:
      "Painel visual deve mostrar aprovados, falhas, pendências e não verificados com links para os resultados correspondentes.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Painel visual deve mostrar aprovados, falhas, pendências e não verificados com links para os resultados correspondentes.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-073",
    name: "Resultado deve oferecer síntese em linguagem simples e detalhe técnico reproduzível",
    description:
      "Resultado deve oferecer síntese em linguagem simples e detalhe técnico reproduzível, sem expor tokens, telefones ou mensagens pessoais.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Resultado deve oferecer síntese em linguagem simples e detalhe técnico reproduzível, sem expor tokens, telefones ou mensagens pessoais.",
    associatedTests: [],
    criticality: "alta",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-074",
    name: "Pipeline de publicação deve falhar automaticamente quando qualquer teste definido com…",
    description:
      "Pipeline de publicação deve falhar automaticamente quando qualquer teste definido como crítico falhar ou não for executado.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Pipeline de publicação deve falhar automaticamente quando qualquer teste definido como crítico falhar ou não for executado.",
    associatedTests: [],
    criticality: "critica",
    initialStatus: "nao_implementado",
    initialEvidence: {
      source:
        "docs/auditoria-tecnica-campanhas-whatsapp-2026-10-20.md#catalogo",
      observedStatus: "Ausente",
      note: "Evidência de inspeção do repositório; não comprova execução ou publicação.",
    },
  },
  {
    id: "CAMP-075",
    name: "Execução isolada dos testes",
    description:
      "Os testes destrutivos e de integração devem rodar somente em PostgreSQL efêmero com dados fictícios.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "CI deve provisionar banco temporário, aplicar migrations e destruir o ambiente ao final; nenhuma credencial de produção deve ser necessária.",
    associatedTests: ["CI:postgres-efemero"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-076",
    name: "Auditoria manual segura",
    description:
      "A auditoria acionada no painel deve ser não destrutiva e não chamar provedores externos.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Verificar somente catálogo, metadados e conectividade; não enviar WhatsApp, consultar MubiSys ou alterar dados comerciais.",
    associatedTests: ["auditor:simulacao-segura"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-077",
    name: "Acesso administrativo",
    description:
      "O painel e as operações de auditoria são exclusivos para administração.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "A interface oculta o painel de outras roles e o servidor bloqueia qualquer consulta ou mutação sem role admin/master.",
    associatedTests: ["auditor:controle-de-role"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-078",
    name: "Relatório exportável e sanitizado",
    description:
      "O administrador pode baixar evidências sem expor dados pessoais ou segredos.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Exportar o resultado em formato técnico com versão e resultados; sanitizar tokens, e-mails, telefones e mensagens pessoais.",
    associatedTests: ["auditor:relatorio-sanitizado"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-079",
    name: "Auditoria manual com histórico",
    description:
      "Cada execução administrativa é registrada e pode ser revisada depois.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Salvar escopo, executor, versão, ambiente, horário, resumo e resultados append-only; confirmar leitura após gravação.",
    associatedTests: ["auditor:historico-persistente"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-080",
    name: "Auditoria periódica",
    description:
      "O pipeline executa verificações recorrentes em ambiente isolado.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Workflow agendado roda typecheck, migrations e testes sem secrets de serviços reais e falha se um check crítico falhar ou for ignorado.",
    associatedTests: ["CI:agenda-semanal"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-081",
    name: "Auditoria após mudanças de código",
    description:
      "Pull requests e alterações na branch principal disparam checks automatizados.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Workflow de CI é acionado em pull_request e push e bloqueia seu job quando build, typecheck, migrations ou testes falham.",
    associatedTests: ["CI:push-e-pull-request"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-082",
    name: "Publicação separada de push",
    description: "O sistema não trata commit/push como prova de deploy.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Exibir SHA e ambiente publicado somente quando fornecidos pelo runtime; declarar push e estado de publicação como não verificados sem fonte autorizada.",
    associatedTests: ["auditor:versao-publicada"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-083",
    name: "Testes críticos não podem ser ignorados",
    description:
      "Uma suíte crítica ausente, desabilitada, pendente ou sem evidência bloqueia o gate.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Manifesto de testes críticos é comparado ao relatório Vitest; teste faltante, skipped ou sem resultado causa falha no CI.",
    associatedTests: ["auditor:gate-testes-criticos"],
    criticality: "critica",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
  {
    id: "CAMP-084",
    name: "Autotestes de falhas controladas",
    description:
      "O próprio motor detecta falhas sintéticas sem tocar em dados ou integrações reais.",
    module: "Robô Auditor",
    acceptanceCriteria:
      "Fixtures devem demonstrar detecção de botão inoperante, cálculo incorreto, funcionalidade ausente, teste desativado, opt-out ignorado, evento duplicado e versão divergente.",
    associatedTests: ["auditor:autotestes"],
    criticality: "alta",
    initialStatus: "implementado_nao_testado",
    initialEvidence: {
      source: "Prompt 02 — controles novos do Robô Auditor",
      observedStatus: "implementação nesta fase",
      note: "A aprovação depende de execução de evidências; presença de código não aprova.",
    },
  },
] as const;

export type CampanhaAuditorRequisito =
  (typeof CAMPANHAS_AUDITOR_CATALOGO)[number];
