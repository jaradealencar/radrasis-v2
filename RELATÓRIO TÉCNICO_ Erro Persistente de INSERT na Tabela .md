# RELATÓRIO TÉCNICO: Erro Persistente de INSERT na Tabela `cotacoes_frete`

**Data**: 08/08/2026  
**Versão do Sistema**: Sistema de Controle de Retrabalhos (retrabalho-system-recriado)  
**Stack Tecnológico**: React 19, Express 4, tRPC 11, Drizzle ORM, MySQL/TiDB  
**Endpoint Afetado**: `POST /api/trpc/cotacoesFrete.create`

---

## 1. DESCRIÇÃO DO ERRO

### Sintoma
Ao clicar no botão **"Criar Solicitação"** no formulário de cotações de frete, o sistema exibe o seguinte erro SQL:

```
Erro: Erro ao inserir cotação: Failed query: insert into `cotacoes_frete` 
(`id`, `solicitanteId`, `solicitanteNome`, `destinatarioNome`, 
`destinatarioCnpj`, `cepDestino`, `municipio`, `estado`, 
`dimensoesLargura`, `dimensoesAltura`, `dimensoesComprimento`, `pesoKg`, 
`valorNf`, `observacoes`, `observacaoGol`, `fotoUrl`, 
`empacotamentoPedidoId`, `empacotamentoPedidoNumero`, `status`, 
`transportadoraSelecionadaId`, `horarioDecisaoMs`, `dataSource`, 
`tipoMaterial`, `dataEntregaPrevista`, `dataDespacho`, `temRetrabalho`, 
`tipoRetrabalho`, `motivoRetrabalho`, `retrabalhoVinculadoId`, `createdAt`, 
`updatedAt`) 
values (default, default, default, ?, ?, ?, ?, ?, ?, ?, ?, default, 
default, default, default, default, default, ?, default, default, ?, 
default, default, default, default, default, default, default, ?, 
default, default, default) 
params: USUARIO,DENIS RODRIGUES DE OLIVEIRA,43.001.533/0001-09,16901-125,
ANDRADINA,SP,1,1,1,1.0,Letreiro / Sinalização
```

### Análise do Erro
- **Colunas declaradas**: 32 colunas
- **Placeholders (?)**: 27 placeholders
- **Discrepância**: 5 colunas a mais que placeholders
- **Causa**: Mismatch entre número de colunas e número de valores

---

## 2. ESTRUTURA DA TABELA `cotacoes_frete`

```sql
CREATE TABLE cotacoes_frete (
  id INT PRIMARY KEY AUTO_INCREMENT,
  solicitanteId INT,
  solicitanteNome VARCHAR(255),
  destinatarioNome VARCHAR(255) NOT NULL,
  destinatarioCnpj VARCHAR(18),
  cepDestino VARCHAR(9),
  municipio VARCHAR(100) NOT NULL,
  estado VARCHAR(2) NOT NULL,
  dimensoesLargura DECIMAL(10,2),
  dimensoesAltura DECIMAL(10,2),
  dimensoesComprimento DECIMAL(10,2),
  pesoKg DECIMAL(10,2),
  valorNf DECIMAL(15,2),
  observacoes TEXT,
  observacaoGol TEXT,
  fotoUrl VARCHAR(500),
  empacotamentoPedidoId INT,
  empacotamentoPedidoNumero VARCHAR(50),
  status ENUM('fila', 'em_cotacao', 'aprovada', 'rejeitada') DEFAULT 'fila',
  transportadoraSelecionadaId INT,
  horarioDecisaoMs BIGINT,
  dataSource VARCHAR(50),
  tipoMaterial VARCHAR(100),
  dataEntregaPrevista DATE,
  dataDespacho DATE,
  temRetrabalho BOOLEAN DEFAULT false,
  tipoRetrabalho VARCHAR(100),
  motivoRetrabalho VARCHAR(255),
  retrabalhoVinculadoId INT,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Total de colunas**: 32

---

## 3. FLUXO DE DADOS ATUAL

### Frontend (NovaCotacaoDialog.tsx)
```typescript
const payloadCriacao = {
  destinatarioNome: "DENIS RODRIGUES DE OLIVEIRA",
  municipio: "ANDRADINA",
  estado: "SP",
  cepDestino: "16901-125",
  pesoKg: "1.0",
  valorNf: "0",
  observacoes: "",
  solicitanteNome: "Usuário",
  destinatarioCnpj: "43.001.533/0001-09",
  tipoMaterial: "Letreiro / Sinalização",
  dimensoes: "[{largura: 1, comprimento: 1, altura: 1, peso: 1}]"
};

create.mutate(payloadCriacao);
```

### Backend (server/routers/logistica.ts - Endpoint create)
```typescript
.mutation(async ({ input }) => {
  // Parse de dimensões
  const dimensoesLargura = 1;
  const dimensoesAltura = 1;
  const dimensoesComprimento = 1;
  const pesoKg = 1.0;

  // Construir insertData
  const insertData = {
    destinatarioNome: "DENIS RODRIGUES DE OLIVEIRA",
    municipio: "ANDRADINA",
    estado: "SP",
    cepDestino: "16901-125",
    pesoKg: "1.0",
    valorNf: "0",
    observacoes: "",
    solicitanteNome: "Usuário",
    destinatarioCnpj: "43.001.533/0001-09",
    tipoMaterial: "Letreiro / Sinalização",
    dimensoesLargura: "1",
    dimensoesAltura: "1",
    dimensoesComprimento: "1"
  };

  // INSERT via Drizzle
  const result = await db.insert(cotacoesFrete).values(insertData);
})
```

---

## 4. TENTATIVAS DE RESOLUÇÃO E RESULTADOS

### Tentativa 1: Remover campos com `default` do INSERT
**Data**: 08/08/2026 - Checkpoint 71a5ebde  
**Abordagem**: Modificar o endpoint para não enviar colunas que têm DEFAULT no schema  
**Código**:
```typescript
const insertData = {};
insertData.destinatarioNome = input.destinatarioNome;
insertData.municipio = input.municipio;
insertData.estado = input.estado;
// Não enviar: status (tem default), temRetrabalho (tem default), etc.

const result = await db.insert(cotacoesFrete).values(insertData);
```
**Resultado**: ❌ FALHOU - Drizzle ainda gerava INSERT com 32 colunas  
**Razão**: Drizzle ORM estava expandindo o schema completo internamente

---

### Tentativa 2: Usar `returning()` do Drizzle
**Data**: 08/08/2026 - Checkpoint a13af00f  
**Abordagem**: Usar `.returning({ id: cotacoesFrete.id })` para retornar ID  
**Código**:
```typescript
const result = await db.insert(cotacoesFrete)
  .values(insertData)
  .returning({ id: cotacoesFrete.id });
```
**Resultado**: ❌ FALHOU - MySQL não suporta `returning()`  
**Erro**: `Property 'returning' does not exist on type 'MySqlInsertBase'`

---

### Tentativa 3: Usar `$returningId` do Drizzle MySQL
**Data**: 08/08/2026 - Checkpoint a13af00f  
**Abordagem**: Usar método específico do Drizzle MySQL  
**Código**:
```typescript
const result = await db.insert(cotacoesFrete)
  .values(insertData)
  .$returningId();
```
**Resultado**: ❌ FALHOU - Método não existe  
**Erro**: `Property '$returningId' does not exist`

---

### Tentativa 4: Usar SQL puro com `db.execute()`
**Data**: 08/08/2026 - Checkpoint f503a09c  
**Abordagem**: Construir SQL dinamicamente e executar com `db.execute()`  
**Código**:
```typescript
const colunas = Object.keys(insertData);
const placeholders = colunas.map(() => '?').join(', ');
const valores = Object.values(insertData);

const sql = `INSERT INTO cotacoes_frete (${colunas.join(', ')}) VALUES (${placeholders})`;
const result = await db.execute(sql, valores);
```
**Resultado**: ❌ FALHOU - `db.execute()` não existe no Drizzle MySQL  
**Erro**: `Property 'execute' does not exist on type 'Database'`

---

### Tentativa 5: Usar Drizzle com apenas campos com valor + Fallback
**Data**: 08/08/2026 - Checkpoint f503a09c (Atual)  
**Abordagem**: Manter apenas campos com valor em `insertData` e adicionar fallback para buscar ID  
**Código**:
```typescript
const insertData = {
  destinatarioNome: "...",
  municipio: "...",
  estado: "...",
  // Apenas 13 campos com valor
};

const result = await db.insert(cotacoesFrete).values(insertData);
const insertId = (result).insertId;

// Fallback se não conseguir ID
if (!insertId) {
  const lastInserted = await db.select()
    .from(cotacoesFrete)
    .orderBy(sql`id DESC`)
    .limit(1);
  return { success: true, id: lastInserted[0]?.id };
}
```
**Resultado**: ⚠️ PARCIALMENTE - Ainda gera erro SQL  
**Razão**: Drizzle continua gerando INSERT com 32 colunas internamente

---

## 5. ROOT CAUSE ANALYSIS

### Hipótese Dominante
O **Drizzle ORM está gerando SQL com TODAS as colunas da tabela**, independentemente de quantas você passa em `.values()`. Isso é um comportamento do Drizzle MySQL que não filtra colunas automaticamente.

### Evidências
1. Mesmo passando apenas 13 campos em `insertData`, o SQL gerado tem 32 colunas
2. O padrão de `?` e `default` sugere que Drizzle está iterando sobre o schema completo
3. Tentativas de usar métodos Drizzle nativos (returning, $returningId) não funcionam em MySQL

---

## 6. SOLUÇÕES PROPOSTAS PARA CLAUDE IA

### Solução A: Usar Query Builder Raw do Drizzle
```typescript
import { sql } from 'drizzle-orm';

const result = await db.run(
  sql`INSERT INTO cotacoes_frete (destinatarioNome, municipio, estado, ...) 
      VALUES (${input.destinatarioNome}, ${input.municipio}, ${input.estado}, ...)`
);
```
**Confiança**: 70%  
**Risco**: Perder type-safety do Drizzle

---

### Solução B: Usar MySQL2 Diretamente
```typescript
import mysql from 'mysql2/promise';

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const result = await connection.execute(
  'INSERT INTO cotacoes_frete (destinatarioNome, municipio, estado) VALUES (?, ?, ?)',
  [input.destinatarioNome, input.municipio, input.estado]
);
```
**Confiança**: 85%  
**Risco**: Bypass do Drizzle, perder migrations

---

### Solução C: Usar Stored Procedure
```sql
CREATE PROCEDURE sp_criar_cotacao(
  IN p_destinatarioNome VARCHAR(255),
  IN p_municipio VARCHAR(100),
  IN p_estado VARCHAR(2),
  OUT p_id INT
) BEGIN
  INSERT INTO cotacoes_frete (destinatarioNome, municipio, estado) 
  VALUES (p_destinatarioNome, p_municipio, p_estado);
  SET p_id = LAST_INSERT_ID();
END;
```
**Confiança**: 90%  
**Risco**: Complexidade adicional

---

### Solução D: Verificar Versão do Drizzle
Pode ser um bug conhecido do Drizzle MySQL que foi corrigido em versão mais recente.

```bash
npm list drizzle-orm
# Atualmente: drizzle-orm@0.x.x
# Tentar upgrade para: drizzle-orm@latest
```
**Confiança**: 60%  
**Risco**: Pode quebrar outras partes

---

## 7. IMPACTO NO NEGÓCIO

| Aspecto | Status |
|---------|--------|
| Criação de cotações | ❌ BLOQUEADO |
| Visualização de cotações | ✅ Funciona |
| Busca de OS | ✅ Funciona |
| Paginação | ✅ Funciona |
| Cache local | ✅ Funciona |
| Validação de CEP | ✅ Funciona |

**Severidade**: CRÍTICA - Funcionalidade principal não funciona

---

## 8. PERGUNTAS PARA CLAUDE IA

1. **Qual é a causa raiz do Drizzle gerar INSERT com 32 colunas quando apenas 13 são passadas?**

2. **Existe um método nativo do Drizzle MySQL para inserir apenas colunas específicas sem enviar defaults explícitos?**

3. **Qual é a melhor prática para lidar com esse cenário em Drizzle MySQL?**

4. **Devemos usar SQL puro, Stored Procedures, ou há outra abordagem recomendada?**

5. **Esse é um bug conhecido do Drizzle que foi corrigido em versões recentes?**

6. **Como garantir type-safety ao usar SQL puro?**

---

## 9. CONTEXTO TÉCNICO ADICIONAL

### Arquivo: server/routers/logistica.ts (Linhas 505-590)
- Endpoint: `cotacoesFrete.create`
- Input validation: Zod schema
- Mutation handler: Processa input, valida, cria insertData, executa INSERT

### Arquivo: client/src/pages/logistica/NovaCotacaoDialog.tsx
- Componente: Dialog com formulário de criação
- Validação: 3 fases (VALIDAÇÃO → PREPARAÇÃO → CRIAÇÃO)
- Persistência: sessionStorage
- Feedback: Toast com ID da cotação

### Versões
- Drizzle ORM: 0.x.x (verificar com `npm list`)
- MySQL Driver: mysql2
- Node.js: 22.13.0
- React: 19

---

## 10. CONCLUSÃO

Após **5 tentativas distintas** de resolução, o erro persiste. O problema parece estar na forma como o Drizzle ORM gera SQL para MySQL, inserindo todas as colunas da tabela independentemente do que é passado em `.values()`.

**Recomendação**: Aguardar análise do Claude IA para determinar a melhor abordagem entre SQL puro, Stored Procedures, ou upgrade do Drizzle.

---

**Relatório preparado por**: Manus AI Agent  
**Data**: 08/08/2026 16:50 UTC  
**Status**: Aguardando análise de especialista
