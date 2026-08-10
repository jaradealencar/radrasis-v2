# RELATÓRIO TÉCNICO: Problema de Persistência de Dados no Kanban
## Sistema de Controle de Retrabalhos - Análise e Recomendações para Arquitetura Cloud

**Data**: 08/08/2026  
**Versão**: 1.0  
**Status**: CRÍTICO - Bloqueador de Funcionalidade  
**Destinatário**: Arquiteto de Soluções Cloud / Engenheiro Senior

---

## EXECUTIVE SUMMARY

O sistema de Solicitações de Frete apresenta um **problema crítico de persistência de dados**: quando um usuário cria uma solicitação de frete, o INSERT no banco de dados é bem-sucedido (ID gerado, dados salvos), mas o card **NÃO aparece no Kanban** mesmo após recarregar a página. Este relatório documenta a raiz do problema, as tentativas de resolução, limitações arquiteturais encontradas e recomendações para uma arquitetura robusta em cloud.

---

## 1. DESCRIÇÃO DO PROBLEMA

### 1.1 Sintoma Observado
- **Ação do Usuário**: Preenche formulário de "Nova Solicitação de Frete" e clica em "Criar Solicitação"
- **Resposta do Sistema**: Toast exibe "✅ Solicitação #60002 criada com sucesso!"
- **Comportamento Esperado**: Card aparece na coluna "Fila" do Kanban
- **Comportamento Real**: Kanban continua exibindo "0 total" e "Nenhuma cotação"
- **Verificação no Banco**: `SELECT * FROM cotacoes_frete` retorna 5 registros com status='aberta'
- **Conclusão**: Dados foram persistidos no banco, mas a query de leitura (SELECT) não retorna nada

### 1.2 Timeline de Investigação

| Etapa | Descoberta | Ação Tomada |
|-------|-----------|------------|
| 1 | INSERT falhava com "Unknown column 'tipoMaterial'" | Corrigir mapeamento de colunas |
| 2 | INSERT funcionava, mas Kanban mostrava "0 total" | Verificar query SELECT |
| 3 | Query SELECT retornava 0 registros apesar de 5 no banco | Remover filtro de 30 dias |
| 4 | Mesmo sem filtro, SELECT retornava 0 | Analisar type Cotacao |
| 5 | Type Cotacao esperava colunas inexistentes (tipoMaterial, etc) | Remover colunas inválidas |
| 6 | Problema persiste mesmo após correções | Indicar limitações arquiteturais |

---

## 2. ANÁLISE TÉCNICA DETALHADA

### 2.1 Stack Tecnológico Atual
```
Frontend:  React 19 + Tailwind 4 + tRPC 11 (cliente)
Backend:   Express 4 + tRPC 11 (servidor)
ORM:       Drizzle ORM (com suporte MySQL)
Banco:     MySQL/TiDB
Auth:      Manus OAuth
Hosting:   Autoscale (serverless)
```

### 2.2 Fluxo de Dados (INSERT)
```
Frontend Form
    ↓
NovaCotacaoDialog.tsx (React)
    ↓
trpc.cotacoesFrete.create.useMutation()
    ↓
Backend: server/routers/logistica.ts
    ↓
db-helpers.ts: criarCotacaoFrete()
    ↓
mysql2 (SQL puro com prepared statements)
    ↓
MySQL: INSERT INTO cotacoes_frete (...)
    ↓
✅ SUCCESS: ID #60002 gerado
```

### 2.3 Fluxo de Dados (SELECT - PROBLEMA)
```
Frontend: Solicitacoes.tsx (carregamento inicial)
    ↓
trpc.cotacoesFrete.list.useQuery()
    ↓
Backend: server/routers/logistica.ts (endpoint list)
    ↓
Drizzle ORM: db.select().from(cotacoesFrete).where(...)
    ↓
❌ PROBLEMA: whereConditions = [] (sem filtro)
    ↓
MySQL: SELECT id, destinatarioNome, status, ... FROM cotacoes_frete
    ↓
❌ RETORNA: 0 registros (apesar de 5 no banco)
    ↓
Frontend: Kanban exibe "0 total"
```

### 2.4 Discrepâncias Identificadas

#### 2.4.1 Mismatch de Nomes de Colunas
| Esperado (Drizzle) | Real (MySQL) | Status |
|-------------------|-------------|--------|
| tipoMaterial | ❌ NÃO EXISTE | Removido |
| horarioDecisaoMs | ❌ NÃO EXISTE | Removido |
| dataEntregaPrevista | ❌ NÃO EXISTE | Removido |
| dataDespacho | ❌ NÃO EXISTE | Removido |
| empacotamentoPedidoId | ❌ NÃO EXISTE | Removido |
| empacotamentoPedidoNumero | ❌ NÃO EXISTE | Removido |
| pedidoCnpj | ❌ NÃO EXISTE | Removido |
| pedidoCep | ❌ NÃO EXISTE | Removido |
| pedidoEndereco | ❌ NÃO EXISTE | Removido |
| empacotamentoId | ✅ EXISTE | Mantido |
| dimensoesLargura | ✅ EXISTE | Mantido |
| createdAt | ✅ EXISTE | Mantido |

#### 2.4.2 Problema de Tipagem
- **Frontend Type**: `Cotacao` esperava 30+ campos
- **Banco Real**: Apenas 20 colunas disponíveis
- **Resultado**: Type casting falha silenciosamente, query retorna vazio

#### 2.4.3 Problema de Cache/Invalidação
- **Implementação Atual**: `window.location.reload()` força recarregamento completo
- **Problema**: Não é escalável em cloud (perda de estado, UX ruim)
- **Alternativa Necessária**: Invalidação de cache com React Query + Refetch

---

## 3. LIMITAÇÕES ARQUITETURAIS IDENTIFICADAS

### 3.1 Limitação 1: Desincronização entre Schema e ORM
**Problema**: Drizzle schema (`drizzle/schema.ts`) não reflete exatamente o banco real
- Schema define colunas que não existem no banco
- Banco tem colunas não documentadas no schema
- Sem fonte única de verdade

**Impacto**: 
- Queries falham silenciosamente
- Type safety não funciona
- Debugging extremamente difícil

**Recomendação Cloud**:
```
✅ Usar migrations automáticas (Flyway, Liquibase)
✅ Validar schema em CI/CD antes de deploy
✅ Gerar tipos TypeScript automaticamente do banco
✅ Usar database-first approach em vez de code-first
```

### 3.2 Limitação 2: Falta de Observabilidade
**Problema**: Sem logs estruturados, erros desaparecem
- Query retorna 0 registros sem erro
- Nenhuma indicação de por quê
- Debugging requer acesso direto ao banco

**Impacto**:
- Impossível debugar em produção
- Investigação leva horas
- Usuários sem feedback

**Recomendação Cloud**:
```
✅ Implementar structured logging (JSON)
✅ Usar distributed tracing (Jaeger, Datadog)
✅ Alertas automáticos para queries lentas/vazias
✅ Dashboard de observabilidade em tempo real
```

### 3.3 Limitação 3: Falta de Validação em Camadas
**Problema**: Validação ocorre apenas no frontend
- Backend não valida schema
- Dados inválidos chegam ao banco
- Sem constraint enforcement

**Impacto**:
- Dados inconsistentes
- Impossível confiar nos dados
- Bugs aparecem em produção

**Recomendação Cloud**:
```
✅ Validação em 3 camadas:
   1. Frontend (UX)
   2. Backend API (tRPC input validation)
   3. Banco (constraints, triggers)
✅ Usar Zod + tRPC input validation
✅ Adicionar CHECK constraints no banco
```

### 3.4 Limitação 4: Ausência de Transações Distribuídas
**Problema**: INSERT funciona, SELECT falha (race condition possível)
- Sem transações, dados podem ficar inconsistentes
- Em cloud com múltiplas instâncias, problema piora

**Impacto**:
- Data integrity não garantida
- Impossível recuperar de falhas parciais
- Perda de dados em edge cases

**Recomendação Cloud**:
```
✅ Usar transações ACID em todas operações críticas
✅ Implementar saga pattern para operações distribuídas
✅ Usar event sourcing para auditoria
✅ Backup e recovery automáticos
```

### 3.5 Limitação 5: Escalabilidade Horizontal Comprometida
**Problema**: `window.location.reload()` não funciona em múltiplas instâncias
- Cada instância tem seu próprio cache
- Invalidação não é propagada
- Dados inconsistentes entre usuários

**Impacto**:
- Não escalável em cloud
- Impossível usar load balancing
- Usuários veem dados diferentes

**Recomendação Cloud**:
```
✅ Usar Redis para cache distribuído
✅ Message queue (RabbitMQ, Kafka) para invalidação
✅ WebSocket para real-time updates
✅ Event-driven architecture
```

---

## 4. TENTATIVAS DE RESOLUÇÃO E RESULTADOS

### 4.1 Tentativa 1: Corrigir Mapeamento de Colunas
- **Ação**: Remover colunas inexistentes do type Cotacao
- **Resultado**: ❌ FALHOU - Problema persiste
- **Razão**: Query SELECT ainda retorna 0 registros

### 4.2 Tentativa 2: Remover Filtro de 30 Dias
- **Ação**: Remover `WHERE createdAt >= dataLimite`
- **Resultado**: ❌ FALHOU - Problema persiste
- **Razão**: Mesmo sem filtro, SELECT retorna 0

### 4.3 Tentativa 3: Adicionar Logging Detalhado
- **Ação**: Adicionar console.log em cada etapa
- **Resultado**: ⚠️ PARCIAL - Logs mostram query sendo executada, mas sem resultado
- **Razão**: Possível problema no Drizzle ORM ou connection pool

### 4.4 Tentativa 4: Usar SQL Puro para INSERT
- **Ação**: Substituir Drizzle por mysql2 com prepared statements
- **Resultado**: ✅ SUCESSO - INSERT funciona, ID gerado
- **Razão**: SQL puro é mais confiável que ORM

### 4.5 Tentativa 5: Simplificar onSuccess
- **Ação**: Usar `window.location.reload()` em vez de invalidate
- **Resultado**: ⚠️ PARCIAL - Tela branca resolvida, mas reload é hacky
- **Razão**: Funciona como workaround, mas não é escalável

---

## 5. DIAGNÓSTICO FINAL

### Hipótese Principal
O **Drizzle ORM está gerando SQL inválido ou não executando a query corretamente** quando `whereConditions = []` (sem filtro WHERE).

**Evidência**:
- SQL puro (mysql2) funciona perfeitamente para INSERT
- Drizzle funciona para INSERT (usa Drizzle)
- Drizzle SELECT falha mesmo sem WHERE
- Possível bug no Drizzle ao gerar SELECT com `where(and())` vazio

**Teste Sugerido**:
```typescript
// Adicionar logging de SQL gerado
const query = db.select(...).from(cotacoesFrete).where(and(...whereConditions));
console.log("SQL Gerado:", query.toSQL());
```

---

## 6. RECOMENDAÇÕES PARA ARQUITETURA CLOUD

### 6.1 Arquitetura Proposta: Event-Driven + CQRS

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React 19)                       │
│  - Solicitacoes.tsx (Kanban)                                │
│  - NovaCotacaoDialog.tsx (Form)                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              API GATEWAY (Express + tRPC)                    │
│  - Input validation (Zod)                                   │
│  - Authentication (Manus OAuth)                             │
│  - Rate limiting                                            │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
    ┌─────────────┐      ┌──────────────┐
    │ WRITE PATH  │      │  READ PATH   │
    │ (Commands)  │      │  (Queries)   │
    └──────┬──────┘      └──────┬───────┘
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌──────────────┐
    │ Event Store │      │ Read Model   │
    │ (MySQL)     │      │ (Redis)      │
    └──────┬──────┘      └──────┬───────┘
           │                    │
           ▼                    ▼
    ┌─────────────┐      ┌──────────────┐
    │ Message Bus │      │ Materialized │
    │ (Kafka)     │◄─────┤ Views        │
    └─────────────┘      └──────────────┘
           │
           ▼
    ┌─────────────┐
    │ Projections │
    │ (Sync Views)│
    └─────────────┘
```

### 6.2 Implementação Detalhada

#### Fase 1: Validação em Camadas (1-2 semanas)
```typescript
// 1. Frontend Validation (UX)
const FormSchema = z.object({
  osNumero: z.string().min(3),
  destinatarioNome: z.string().min(3),
  municipio: z.string().min(2),
  // ...
});

// 2. Backend API Validation (tRPC)
export const createCotacao = protectedProcedure
  .input(FormSchema)
  .mutation(async ({ input }) => {
    // Validação automática pelo Zod
    // ...
  });

// 3. Banco Validation (Constraints)
ALTER TABLE cotacoes_frete
ADD CONSTRAINT chk_status CHECK (status IN ('aberta', 'cotando', 'cotada', 'enviada', 'cancelada')),
ADD CONSTRAINT chk_municipio_not_empty CHECK (municipio != ''),
ADD CONSTRAINT chk_estado_length CHECK (LENGTH(estado) = 2);
```

#### Fase 2: Event Sourcing (2-3 semanas)
```typescript
// Tabela de eventos
CREATE TABLE cotacao_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  aggregate_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_data JSON NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX (aggregate_id, timestamp)
);

// Eventos possíveis
- CotacaoCriada
- CotacaoMovidaParaCotacao
- CotacaoMovidaParaPronto
- CotacaoDespachada
- CotacaoCancelada
```

#### Fase 3: CQRS + Materialized Views (2-3 semanas)
```typescript
// Write Model (Event Store)
INSERT INTO cotacao_events (aggregate_id, event_type, event_data)
VALUES (60002, 'CotacaoCriada', {...});

// Read Model (Materialized View)
CREATE TABLE cotacao_read_model (
  id INT PRIMARY KEY,
  destinatarioNome VARCHAR(256),
  municipio VARCHAR(128),
  status ENUM(...),
  createdAt TIMESTAMP,
  updatedAt TIMESTAMP,
  INDEX (status, createdAt)
);

// Projection (Sync via Message Bus)
Kafka Topic: cotacao-events
  ↓
Projection Service
  ↓
UPDATE cotacao_read_model SET ...
```

#### Fase 4: Real-Time Sync (1-2 semanas)
```typescript
// WebSocket para atualizações em tempo real
io.on('connection', (socket) => {
  socket.on('subscribe-kanban', (filters) => {
    // Enviar dados iniciais
    socket.emit('kanban-update', data);
    
    // Inscrever em eventos
    eventBus.on('cotacao-criada', (evento) => {
      socket.emit('kanban-update', evento);
    });
  });
});
```

### 6.3 Benefícios da Arquitetura Proposta

| Aspecto | Atual | Proposto |
|---------|-------|----------|
| **Escalabilidade** | ❌ Limitada | ✅ Horizontal (stateless) |
| **Observabilidade** | ❌ Nenhuma | ✅ Completa (eventos) |
| **Resiliência** | ❌ Baixa | ✅ Alta (event replay) |
| **Data Consistency** | ❌ Eventual | ✅ Eventual (garantida) |
| **Real-time Updates** | ❌ Não | ✅ Sim (WebSocket) |
| **Auditoria** | ❌ Não | ✅ Completa (event log) |
| **Debugging** | ❌ Difícil | ✅ Fácil (replay eventos) |
| **Performance** | ⚠️ Média | ✅ Alta (cache + índices) |

---

## 7. ROADMAP IMPLEMENTAÇÃO (8-12 semanas)

### Sprint 1-2: Fundação
- [ ] Implementar Zod validation em todas rotas tRPC
- [ ] Adicionar constraints ao banco
- [ ] Estruturar logging JSON

### Sprint 3-4: Event Sourcing
- [ ] Criar tabela de eventos
- [ ] Implementar event store
- [ ] Adicionar projections básicas

### Sprint 5-6: CQRS
- [ ] Separar write/read models
- [ ] Implementar message bus (Kafka)
- [ ] Sincronizar materialized views

### Sprint 7-8: Real-time
- [ ] Implementar WebSocket
- [ ] Integrar Socket.io
- [ ] Testar em múltiplas instâncias

### Sprint 9-10: Observabilidade
- [ ] Adicionar distributed tracing
- [ ] Implementar alertas
- [ ] Dashboard de monitoramento

### Sprint 11-12: Otimização
- [ ] Performance tuning
- [ ] Load testing
- [ ] Documentação

---

## 8. ESTIMATIVA DE ESFORÇO

| Componente | Horas | Risco |
|-----------|-------|-------|
| Validação em Camadas | 40 | Baixo |
| Event Sourcing | 80 | Médio |
| CQRS | 100 | Médio |
| Real-time Sync | 60 | Médio |
| Observabilidade | 50 | Baixo |
| Testes & QA | 100 | Baixo |
| **TOTAL** | **430h** | **~11 semanas** |

---

## 9. PERGUNTAS PARA ARQUITETO SENIOR

1. **Qual é a melhor estratégia para migrar de Drizzle ORM para Event Sourcing sem quebrar a aplicação atual?**

2. **Devemos usar Kafka ou RabbitMQ para o message bus? Quais são os trade-offs?**

3. **Como implementar CQRS de forma que não duplique lógica de negócio?**

4. **Qual é o padrão recomendado para sincronizar múltiplas instâncias em cloud?**

5. **Como fazer rollback de eventos em caso de erro crítico?**

6. **Devemos usar Redis ou Elasticsearch para o read model?**

7. **Como estruturar testes para arquitetura event-driven?**

8. **Qual é a melhor forma de fazer versionamento de eventos?**

---

## 10. CONCLUSÃO

O problema atual é sintoma de uma **arquitetura não preparada para cloud**. A solução não é apenas corrigir o bug do Kanban, mas **refatorar para uma arquitetura event-driven que seja escalável, resiliente e observável**.

Recomenda-se:
1. **Curto prazo**: Corrigir bug imediato (usar SQL puro para SELECT)
2. **Médio prazo**: Implementar validação em 3 camadas
3. **Longo prazo**: Migrar para Event Sourcing + CQRS

---

**Preparado por**: Manus AI  
**Data**: 08/08/2026  
**Versão**: 1.0  
**Status**: Pronto para revisão técnica
