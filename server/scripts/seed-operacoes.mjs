import mysql from 'mysql2/promise';

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── FORNECEDORES ─────────────────────────────────────────────────────────────
const fornecedores = [
  { name: 'Carlos Silva', company: 'Aço Express', category: 'Metais', supplies: 'Aço inox, alumínio, chapa galvanizada', phone: '(67) 99999-0001', paymentTerms: '30/60 dias', notes: 'Entrega em 3 dias úteis' },
  { name: 'Fernanda Costa', company: 'Tintas & Cores', category: 'Pintura', supplies: 'Tinta automotiva, primer, verniz, catalisador', phone: '(67) 99999-0002', paymentTerms: 'À vista 5% desconto', notes: 'Mínimo R$ 500 por pedido' },
  { name: 'Roberto Melo', company: 'Plásticos Sul', category: 'Plásticos', supplies: 'Acrílico, PVC, policarbonato, PS', phone: '(67) 99999-0003', paymentTerms: '28 dias', notes: 'Corte sob medida disponível' },
  { name: 'Ana Pereira', company: 'LED Solutions', category: 'Elétrico', supplies: 'Fita LED, fonte chaveada, controlador, perfil alumínio', phone: '(67) 99999-0004', paymentTerms: '30 dias boleto', notes: 'Garantia 1 ano nos produtos' },
  { name: 'Marcos Oliveira', company: 'Fibra Forte', category: 'Fibra', supplies: 'Fibra de vidro, resina poliéster, gel coat, catalisador', phone: '(67) 99999-0005', paymentTerms: 'À vista', notes: 'Entrega imediata em estoque' },
  { name: 'Juliana Santos', company: 'Embalagens Rápidas', category: 'Embalagem', supplies: 'Caixas papelão, espuma, filme stretch, fita adesiva', phone: '(67) 99999-0006', paymentTerms: '15 dias', notes: 'Personalização disponível' },
  { name: 'Paulo Ferreira', company: 'Solda & Cia', category: 'Solda', supplies: 'Eletrodo, arame MIG, gás argônio, disco de corte', phone: '(67) 99999-0007', paymentTerms: '30 dias', notes: 'Entrega semanal toda terça' },
  { name: 'Letícia Rocha', company: 'Químicos Gerais', category: 'Químicos', supplies: 'Solvente, thinner, acetona, desmoldante, cera', phone: '(67) 99999-0008', paymentTerms: 'À vista', notes: 'Produtos com ficha FISPQ' },
];

for (const f of fornecedores) {
  try {
    await conn.execute(
      `INSERT INTO suppliers (name, company, category, supplies, phone, paymentTerms, notes, active) VALUES (?, ?, ?, ?, ?, ?, ?, 'sim')`,
      [f.name, f.company, f.category, f.supplies, f.phone, f.paymentTerms, f.notes]
    );
  } catch(e) { console.log('Fornecedor skip:', e.message.substring(0,60)); }
}
console.log('Fornecedores inseridos:', fornecedores.length);

// ─── BASE DE CONHECIMENTO ─────────────────────────────────────────────────────
const conhecimentos = [
  {
    title: 'Política de Desconto Comercial',
    category: 'Comercial',
    subcategory: 'Precificação',
    keywords: 'desconto, preço, negociação, comercial',
    content: `## Política de Desconto Comercial

### Regras Gerais
- Descontos acima de 10% precisam de aprovação do supervisor comercial.
- Descontos acima de 20% precisam de aprovação da diretoria.
- Nunca conceder desconto sem calcular a margem mínima de 25%.

### Tabela de Descontos por Volume
| Volume (pedidos/mês) | Desconto máximo |
|---|---|
| 1-5 pedidos | 5% |
| 6-15 pedidos | 10% |
| 16+ pedidos | 15% (com aprovação) |

### Observações
- Frete nunca entra no desconto — é negociado separadamente.
- Clientes novos não recebem desconto no primeiro pedido.`
  },
  {
    title: 'Processo de Orçamentação',
    category: 'Comercial',
    subcategory: 'Negocial',
    keywords: 'orçamento, cotação, prazo, processo',
    content: `## Processo de Orçamentação

### Fluxo Padrão
1. Receber arquivo do cliente (AI, PDF, imagem de referência)
2. Verificar se o arquivo está em escala ou com medidas
3. Calcular área total do letreiro
4. Aplicar tabela de preços por material e processo
5. Adicionar frete conforme destino
6. Enviar orçamento em até 4 horas úteis

### Materiais e Processos
- **Aço inox escovado**: R$ X/m² + corte laser
- **Alumínio composto (ACM)**: R$ X/m² + router
- **Acrílico**: R$ X/m² + corte laser/router
- **Fibra de vidro**: orçamento sob consulta

### Prazo de Validade do Orçamento
Orçamentos têm validade de 15 dias corridos.`
  },
  {
    title: 'Controle de Qualidade na Expedição',
    category: 'Produção',
    subcategory: 'Qualidade',
    keywords: 'qualidade, expedição, checklist, conferência',
    content: `## Controle de Qualidade na Expedição

### Checklist Obrigatório antes do Envio
- [ ] Conferir medidas do letreiro com o pedido
- [ ] Verificar acabamento superficial (sem riscos, rebarbas ou manchas)
- [ ] Testar iluminação LED (se aplicável)
- [ ] Fotografar o produto finalizado
- [ ] Registrar OS no sistema como "Pronto para Envio"
- [ ] Embalar adequadamente com espuma e canto de proteção

### Responsabilidade
O operador de expedição é responsável pela conferência final. Qualquer divergência deve ser reportada ao supervisor antes do envio.`
  },
  {
    title: 'Política de Retrabalho e Garantia',
    category: 'Administrativo',
    subcategory: 'Qualidade',
    keywords: 'retrabalho, garantia, defeito, reclamação',
    content: `## Política de Retrabalho e Garantia

### Classificação
- **Retrabalho Interno**: erro identificado antes da expedição
- **Retrabalho Externo**: reclamação do cliente após entrega

### Garantia Oferecida
- Estrutura metálica: 12 meses
- Pintura: 6 meses
- LED e elétrico: 12 meses (fabricante)
- Fibra: 6 meses

### Processo de Atendimento
1. Registrar ocorrência no sistema de retrabalhos
2. Classificar como Evitável ou Inevitável
3. Identificar responsável e setor
4. Aplicar ação corretiva da biblioteca de soluções
5. Registrar custo e impacto`
  },
  {
    title: 'Gestão Financeira — Fluxo de Caixa',
    category: 'Financeiro',
    subcategory: 'Controle',
    keywords: 'financeiro, fluxo de caixa, pagamento, recebimento',
    content: `## Gestão Financeira — Fluxo de Caixa

### Recebimentos
- Pedidos acima de R$ 2.000: 50% na aprovação + 50% na entrega
- Pedidos abaixo de R$ 2.000: 100% na aprovação
- Clientes recorrentes com histórico: 30 dias após entrega

### Pagamentos a Fornecedores
- Prioridade: materiais críticos para produção em andamento
- Negociar sempre prazo mínimo de 28 dias
- Manter reserva de 15% do faturamento para capital de giro

### Indicadores Monitorados
- Ticket médio por pedido
- Prazo médio de recebimento
- % custo de retrabalho sobre faturamento`
  },
];

for (const k of conhecimentos) {
  try {
    await conn.execute(
      `INSERT INTO knowledge_base (title, content, category, subcategory, keywords) VALUES (?, ?, ?, ?, ?)`,
      [k.title, k.content, k.category, k.subcategory || null, k.keywords || null]
    );
  } catch(e) { console.log('Conhecimento skip:', e.message.substring(0,60)); }
}
console.log('Base de conhecimento inserida:', conhecimentos.length);

// ─── ROTINAS ──────────────────────────────────────────────────────────────────
const rotinas = [
  { title: 'Backup de conversas WhatsApp', description: 'Cada colaborador deve fazer backup das conversas do WhatsApp Business para preservar histórico de negociações.', frequency: 'quinzenal', assignedTo: 'Todos os colaboradores', status: 'pendente' },
  { title: 'Limpeza e organização do setor de Solda', description: 'Limpar bancadas, organizar eletrodos e verificar equipamentos de solda.', frequency: 'semanal', assignedTo: 'Responsável Solda', status: 'em_dia' },
  { title: 'Conferência de estoque de materiais', description: 'Verificar níveis de estoque de acrílico, aço inox, alumínio e tintas. Emitir pedido de reposição se necessário.', frequency: 'semanal', assignedTo: 'Almoxarifado', status: 'pendente' },
  { title: 'Reunião de alinhamento de produção', description: 'Reunião semanal para revisar OS em aberto, prioridades e gargalos.', frequency: 'semanal', assignedTo: 'Supervisor de Produção', status: 'em_dia' },
  { title: 'Manutenção preventiva Router CNC', description: 'Lubrificação dos trilhos, verificação das brocas e limpeza do sistema de aspiração.', frequency: 'mensal', assignedTo: 'Operador Router', status: 'pendente' },
  { title: 'Manutenção preventiva Laser CO2', description: 'Limpeza das lentes, verificação do alinhamento do feixe e nível de água do chiller.', frequency: 'mensal', assignedTo: 'Operador Laser', status: 'pendente' },
  { title: 'Revisão de indicadores de retrabalho', description: 'Analisar relatório mensal de retrabalhos, identificar padrões e propor ações corretivas.', frequency: 'mensal', assignedTo: 'Supervisor de Qualidade', status: 'pendente' },
  { title: 'Atualização da base de conhecimento', description: 'Revisar e atualizar artigos da base de conhecimento com novos processos e aprendizados.', frequency: 'trimestral', assignedTo: 'Gestão', status: 'em_dia' },
];

for (const r of rotinas) {
  try {
    await conn.execute(
      `INSERT INTO routines (title, description, frequency, assignedTo, status) VALUES (?, ?, ?, ?, ?)`,
      [r.title, r.description, r.frequency, r.assignedTo, r.status]
    );
  } catch(e) { console.log('Rotina skip:', e.message.substring(0,60)); }
}
console.log('Rotinas inseridas:', rotinas.length);

// ─── REGULAMENTOS ─────────────────────────────────────────────────────────────
const regs = [
  {
    title: 'Regulamento Interno de Conduta',
    type: 'regulamento',
    version: '2.0',
    content: `## Regulamento Interno de Conduta

### 1. Horário de Trabalho
- Entrada: 07h30 | Saída: 17h30 (segunda a sexta)
- Tolerância de 10 minutos. Atrasos recorrentes serão registrados.

### 2. EPI e Segurança
- Uso obrigatório de EPI em todos os setores de produção.
- Proibido operar máquinas sem treinamento certificado.

### 3. Uso de Equipamentos
- Equipamentos da empresa são para uso exclusivo profissional.
- Danos por mau uso são de responsabilidade do operador.

### 4. Comunicação
- Problemas técnicos devem ser reportados imediatamente ao supervisor.
- Reclamações de clientes devem ser registradas no sistema.`
  },
  {
    title: 'Memorando — Procedimento de Expedição',
    type: 'memorando',
    version: '1.1',
    content: `## Memorando — Procedimento de Expedição

**Para:** Todos os colaboradores do setor de Expedição
**Data:** Janeiro 2026

### Atualização do Processo
A partir desta data, todos os produtos devem ser fotografados antes do embalamento e a foto deve ser anexada à OS no sistema.

### Motivo
Reduzir reclamações de danos no transporte e facilitar a identificação de responsabilidade em casos de retrabalho externo.

### Vigência
Imediata.`
  },
  {
    title: 'Política de Uso de EPI',
    type: 'politica',
    version: '1.0',
    content: `## Política de Uso de EPI

### EPIs Obrigatórios por Setor

**Solda:**
- Máscara de solda com filtro adequado
- Luvas de raspa
- Avental de couro
- Botina de segurança

**Pintura:**
- Máscara respiratória com filtro para vapores orgânicos
- Luvas nitrílicas
- Óculos de proteção

**Router/Laser:**
- Óculos de proteção
- Protetor auricular
- Botina de segurança

### Responsabilidade
O colaborador que recusar usar EPI estará sujeito a medidas disciplinares conforme CLT.`
  },
];

for (const r of regs) {
  try {
    await conn.execute(
      `INSERT INTO regulations (title, type, content, version, active) VALUES (?, ?, ?, ?, 'sim')`,
      [r.title, r.type, r.content, r.version]
    );
  } catch(e) { console.log('Regulamento skip:', e.message.substring(0,60)); }
}
console.log('Regulamentos inseridos:', regs.length);

// ─── POPs ─────────────────────────────────────────────────────────────────────
const popsData = [
  {
    code: 'POP-001',
    title: 'Corte em Router CNC',
    sector: 'Router',
    objective: 'Padronizar o processo de corte de materiais no Router CNC para garantir qualidade e segurança.',
    responsible: 'Operador Router',
    steps: JSON.stringify([
      'Verificar o arquivo de corte (DXF/DWG) e confirmar medidas com a OS',
      'Fixar o material na mesa do router com grampos adequados',
      'Selecionar a broca correta conforme o material (acrílico, ACM, PVC)',
      'Configurar velocidade e profundidade de corte no software',
      'Executar corte em modo de teste (air cut) antes do corte real',
      'Realizar o corte e monitorar durante toda a operação',
      'Conferir as peças cortadas com as medidas da OS',
      'Registrar na OS como concluído e encaminhar para próxima etapa'
    ])
  },
  {
    code: 'POP-002',
    title: 'Pintura Eletrostática',
    sector: 'Pintura',
    objective: 'Garantir acabamento uniforme e durável na pintura de peças metálicas.',
    responsible: 'Operador Pintura',
    steps: JSON.stringify([
      'Lixar a peça com lixa 220 para remover oxidação e criar aderência',
      'Limpar a peça com pano umedecido em thinner para remover gordura',
      'Aplicar primer anticorrosivo em camada fina e uniforme',
      'Aguardar secagem do primer (mínimo 30 minutos)',
      'Aplicar tinta na cor especificada na OS em 2 demãos',
      'Aguardar secagem entre demãos (15 minutos)',
      'Aplicar verniz de acabamento se especificado',
      'Registrar na OS como concluído após cura completa (24h)'
    ])
  },
  {
    code: 'POP-003',
    title: 'Soldagem MIG/MAG',
    sector: 'Solda',
    objective: 'Padronizar o processo de soldagem para garantir resistência estrutural e acabamento adequado.',
    responsible: 'Soldador',
    steps: JSON.stringify([
      'Verificar o projeto e identificar os pontos de solda',
      'Preparar as peças: limpeza, alinhamento e fixação com grampos',
      'Selecionar o arame e configurar a máquina (tensão, velocidade)',
      'Usar EPI completo: máscara, luvas, avental',
      'Realizar pontos de fixação antes da solda contínua',
      'Executar a solda com movimento uniforme',
      'Aguardar resfriamento e remover escória',
      'Verificar a qualidade da solda visualmente e com martelo',
      'Registrar na OS e encaminhar para acabamento'
    ])
  },
  {
    code: 'POP-004',
    title: 'Laminação em Fibra de Vidro',
    sector: 'Fibra',
    objective: 'Garantir a qualidade e uniformidade das peças produzidas em fibra de vidro.',
    responsible: 'Operador Fibra',
    steps: JSON.stringify([
      'Preparar o molde: limpeza e aplicação de desmoldante (3 demãos)',
      'Aplicar gel coat na cor especificada e aguardar gelificação',
      'Preparar a resina com catalisador na proporção correta (1-2%)',
      'Aplicar camada de resina sobre o gel coat',
      'Posicionar a manta de fibra de vidro sobre a resina',
      'Laminar com rolo para eliminar bolhas de ar',
      'Repetir as camadas conforme espessura especificada',
      'Aguardar cura completa (mínimo 4 horas)',
      'Desmoldar com cuidado e verificar acabamento',
      'Registrar na OS e encaminhar para acabamento'
    ])
  },
];

for (const p of popsData) {
  try {
    await conn.execute(
      `INSERT INTO pops (code, title, sector, objective, steps, responsible, version, active) VALUES (?, ?, ?, ?, ?, ?, '1.0', 'sim')`,
      [p.code, p.title, p.sector, p.objective, p.steps, p.responsible]
    );
  } catch(e) { console.log('POP skip:', e.message.substring(0,60)); }
}
console.log('POPs inseridos:', popsData.length);

await conn.end();
console.log('\n✅ Seed de Operações concluído!');
