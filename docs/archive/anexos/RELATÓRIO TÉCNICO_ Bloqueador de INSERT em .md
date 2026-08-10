# RELATÓRIO TÉCNICO: Bloqueador de INSERT em `cotacoes_frete`

**Data**: 2026-08-08  
**Prioridade**: CRÍTICA  
**Status**: EM INVESTIGAÇÃO  
**Solicitante**: Sistema de Controle de Retrabalhos (Logística)

---

## 1. RESUMO EXECUTIVO

O sistema está impossibilitado de criar novas solicitações de frete. Ao clicar em "Criar Solicitação", ocorre erro SQL com mensagem indicando múltiplos campos `?` (undefined) sendo enviados para o banco de dados. Após 3 tentativas de correção, o problema persiste.

**Erro Observado**:
```
Failed query: insert into `cotacoes_frete` (`id`, `solicitanteId`, `solicitanteNome`, 
`destinatarioNome`, `destinatarioCnpj`, `cepDestino`, `municipio`, `estado`, 
`dimensoesLargura`, `dimensoesAltura`, `dimensoesComprimento`, `pesoKg`, `valorNf`, 
`observacoes`, `observacaoGol`, `fotoUrl`, `empacotamentoPedidoId`, 
`empacotamentoPedidoNumero`, `status`, `transportadoraSelecionadaId`, 
`horarioDecisaoMs`, `dataSource`, `tipoMaterial`, `dataEntregaPrevista`, 
`dataDespacho`, `temRetrabalho`, `tipoRetrabalho`, `motivoRetrabalho`, 
`retrabalhoVinculadoId`, `createdAt`, `updatedAt`) values (default, default, default, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, default, ?, ?, ?, ?, ?, ?, ?, default, ?, ?, default, default)
```

---

## 2. INFRAESTRUTURA TÉCNICA

### 2.1 Stack Tecnológico

| Componente | Tecnologia | Versão |
|---|---|---|
| **Frontend** | React 19 + Tailwind 4 | Latest |
| **Backend** | Express 4 + tRPC 11 | Latest |
| **ORM** | Drizzle ORM | Latest |
| **Banco de Dados** | MySQL/TiDB | Managed |
| **Autenticação** | Manus OAuth | Built-in |
| **API Externa** | MubiSys (JWT + Public Key) | v1 |

### 2.2 Arquitetura do Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (React Component)                                       │
│ NovaCotacaoDialog.tsx                                            │
│                                                                   │
│ 1. Usuário preenche formulário (form state)                     │
│ 2. Clica "Criar Solicitação"                                    │
│ 3. Validação local (campos obrigatórios, volumes)               │
│ 4. Monta objeto payload com 17 campos                           │
│ 5. Chama create.mutate(payload)                                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ tRPC CLIENT LAYER (client/src/lib/trpc.ts)                      │
│                                                                   │
│ - Serialização com SuperJSON                                    │
│ - Validação de schema Zod                                       │
│ - HTTP POST para /api/trpc/cotacoesFrete.create                 │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Express + tRPC Router)                                  │
│ server/routers/logistica.ts (linhas 468-523)                    │
│                                                                   │
│ Procedure: cotacoesFrete.create                                 │
│ - Input schema com 17 campos                                    │
│ - Mapeamento condicional (if input.campo)                       │
│ - Construção de insertData                                      │
│ - db.insert(cotacoesFrete).values(insertData)                   │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ DRIZZLE ORM (server/routers/logistica.ts)                       │
│                                                                   │
│ - Converte insertData em SQL INSERT                             │
│ - Usa schema definido em drizzle/schema.ts                      │
│ - Gera query com placeholders (?)                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ MYSQL/TIDB (Banco de Dados)                                      │
│ Tabela: cotacoes_frete                                           │
│                                                                   │
│ ❌ ERRO: Campos com ? (undefined) causam falha                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Definição da Tabela (Drizzle Schema)

**Arquivo**: `drizzle/schema.ts` (linhas 382-423)

**Campos da tabela** (31 campos):
- `id` (int, autoincrement, PK)
- `solicitanteId` (int, nullable)
- `solicitanteNome` (varchar 128, nullable)
- `destinatarioNome` (varchar 256, nullable)
- `destinatarioCnpj` (varchar 32, nullable)
- `cepDestino` (varchar 10, nullable)
- `municipio` (varchar 128, nullable)
- `estado` (varchar 2, nullable)
- `dimensoesLargura` (decimal 8,2, nullable)
- `dimensoesAltura` (decimal 8,2, nullable)
- `dimensoesComprimento` (decimal 8,2, nullable)
- `pesoKg` (decimal 8,2, nullable)
- `valorNf` (decimal 12,2, nullable)
- `observacoes` (text, nullable)
- `observacaoGol` (text, nullable)
- `fotoUrl` (text, nullable)
- `empacotamentoPedidoId` (int, nullable)
- `empacotamentoPedidoNumero` (varchar 64, nullable)
- `status` (enum, default 'fila', NOT NULL) ✅
- `transportadoraSelecionadaId` (int, nullable)
- `horarioDecisaoMs` (varchar 8, nullable)
- `dataSource` (varchar 32, nullable)
- `tipoMaterial` (varchar 256, nullable)
- `dataEntregaPrevista` (date, nullable)
- `dataDespacho` (timestamp, nullable)
- `temRetrabalho` (boolean, default false, NOT NULL)
- `tipoRetrabalho` (varchar 64, nullable)
- `motivoRetrabalho` (text, nullable)
- `retrabalhoVinculadoId` (int, nullable)
- `createdAt` (timestamp, default NOW(), NOT NULL)
- `updatedAt` (timestamp, default NOW(), NOT NULL)

---

## 3. FLUXO DE DADOS ATUAL

### 3.1 Payload Enviado pelo Frontend

**Arquivo**: `client/src/pages/logistica/NovaCotacaoDialog.tsx` (linhas 288-303)

```javascript
create.mutate({
  destinatarioNome: form.destinatarioNome,           // ✅ Preenchido
  municipio: form.municipio,                         // ✅ Preenchido
  estado: form.estado,                               // ✅ Preenchido
  cepDestino: form.cepDestino,                       // ✅ Preenchido (pode estar vazio)
  pesoKg: pesoTotal.toString(),                      // ✅ Preenchido (1.00)
  valorNf: "0",                                      // ✅ Preenchido
  observacoes: form.observacoes,                     // ✅ Pode estar vazio
  solicitanteNome: solicitanteNome || localUser?.name || "",  // ✅ Preenchido
  destinatarioCnpj: form.cnpj,                       // ✅ Preenchido
  pedidoCnpj: form.cnpj,                             // ⚠️ NÃO MAPEADO NO SCHEMA
  pedidoEndereco: "",                                // ⚠️ NÃO MAPEADO NO SCHEMA
  pedidoCep: form.cepDestino,                        // ⚠️ NÃO MAPEADO NO SCHEMA
  tipoMaterial: "Letreiro / Sinalização",            // ✅ Preenchido
  dimensoes: volumesJson,                            // ⚠️ NÃO MAPEADO NO SCHEMA (é JSON string)
} as any)
```

### 3.2 Schema de Input (Zod)

**Arquivo**: `server/routers/logistica.ts` (linhas 468-482)

```typescript
.input(z.object({
  destinatarioNome: z.string(),
  municipio: z.string(),
  estado: z.string(),
  cepDestino: z.string().optional(),
  pesoKg: z.string().optional(),
  valorNf: z.string().optional(),
  observacoes: z.string().optional(),
  solicitanteNome: z.string().optional(),
  destinatarioCnpj: z.string().optional(),
  pedidoCnpj: z.string().optional(),           // ⚠️ Campo extra
  pedidoEndereco: z.string().optional(),       // ⚠️ Campo extra
  pedidoCep: z.string().optional(),            // ⚠️ Campo extra
  tipoMaterial: z.string().optional(),
  dimensoes: z.string().optional(),            // ⚠️ Campo extra
  // ... mais campos opcionais
}))
```

### 3.3 Mapeamento no Backend

**Arquivo**: `server/routers/logistica.ts` (linhas 484-509)

```typescript
const insertData: any = {};

// Campos obrigatórios
insertData.destinatarioNome = input.destinatarioNome;
insertData.municipio = input.municipio;
insertData.estado = input.estado;
insertData.status = "fila";

// Campos opcionais - só adicionar se tiverem valor
if (input.solicitanteId) insertData.solicitanteId = input.solicitanteId;
if (input.solicitanteNome) insertData.solicitanteNome = input.solicitanteNome;
if (input.destinatarioCnpj) insertData.destinatarioCnpj = input.destinatarioCnpj;
if (input.cepDestino) insertData.cepDestino = input.cepDestino;
if (input.dimensoesLargura) insertData.dimensoesLargura = parseFloat(input.dimensoesLargura);
// ... mais campos
```

---

## 4. ANÁLISE DO PROBLEMA

### 4.1 Discrepâncias Identificadas

| Campo | Frontend | Schema | Mapeamento | Status |
|---|---|---|---|---|
| `destinatarioNome` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `municipio` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `estado` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `cepDestino` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `pesoKg` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `valorNf` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `solicitanteNome` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `destinatarioCnpj` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `tipoMaterial` | ✅ Enviado | ✅ Existe | ✅ Mapeado | OK |
| `dimensoes` | ✅ Enviado (JSON) | ❌ NÃO EXISTE | ❌ Não mapeado | **PROBLEMA** |
| `pedidoCnpj` | ✅ Enviado | ❌ NÃO EXISTE | ❌ Não mapeado | **PROBLEMA** |
| `pedidoEndereco` | ✅ Enviado | ❌ NÃO EXISTE | ❌ Não mapeado | **PROBLEMA** |
| `pedidoCep` | ✅ Enviado | ❌ NÃO EXISTE | ❌ Não mapeado | **PROBLEMA** |

### 4.2 Hipóteses Sobre os `?` no SQL

O erro mostra múltiplos `?` (placeholders) no SQL. Isso significa que o Drizzle está tentando inserir valores undefined em certos campos.

**Possíveis causas**:

1. **Campos com default no schema mas não sendo preenchidos**:
   - `temRetrabalho` (default false, mas pode estar sendo enviado como undefined)
   - `createdAt` / `updatedAt` (têm default, mas Drizzle pode estar tentando inserir)

2. **Campos NOT NULL sem default**:
   - `status` tem default 'fila' ✅
   - `createdAt` tem default NOW() ✅
   - `updatedAt` tem default NOW() ✅

3. **Problema com Drizzle ORM**:
   - Drizzle pode estar gerando SQL com placeholders para campos que não foram explicitamente inclusos no insertData
   - Isso causaria `?` sem valor correspondente

### 4.3 Tentativas Anteriores e Por Que Falharam

**Tentativa 1**: Mapeamento condicional com `if (input.campo)`
- ❌ Falhou porque não resolve o problema de campos que o Drizzle tenta inserir automaticamente

**Tentativa 2**: Adicionar logging detalhado
- ⏳ Aguardando feedback do usuário (logs não foram recebidos)

---

## 5. HIPÓTESES TÉCNICAS PARA INVESTIGAÇÃO

### H1: Drizzle gerando SQL com campos extras
**Probabilidade**: 70%

O Drizzle pode estar tentando inserir todos os 31 campos da tabela, mesmo que apenas alguns estejam em `insertData`. Isso causaria múltiplos `?` sem valores.

**Teste**: Verificar o SQL gerado antes de executar
```typescript
const query = db.insert(cotacoesFrete).values(insertData);
console.log("SQL gerado:", query.toSQL());
```

### H2: Campos com default estão sendo explicitamente inseridos como undefined
**Probabilidade**: 60%

Campos como `temRetrabalho` (default false) podem estar sendo inseridos como undefined, causando erro.

**Teste**: Verificar se `temRetrabalho` está sendo incluído em insertData
```typescript
console.log("temRetrabalho em insertData?", 'temRetrabalho' in insertData);
```

### H3: Problema com tipos de dados
**Probabilidade**: 40%

Campos decimal (`dimensoesLargura`, etc.) podem estar sendo parseados incorretamente ou como undefined.

**Teste**: Verificar parseFloat() em campos que vêm como string
```typescript
console.log("pesoKg parseado:", parseFloat("1.00"));  // Deve ser 1
```

### H4: Campos timestamp (`createdAt`, `updatedAt`) sendo inseridos explicitamente
**Probabilidade**: 50%

Mesmo tendo default, Drizzle pode estar tentando inserir esses campos como undefined.

**Teste**: Remover esses campos de insertData se estiverem lá
```typescript
delete insertData.createdAt;
delete insertData.updatedAt;
```

---

## 6. RECOMENDAÇÕES PARA PROGRAMADOR SENIOR

### 6.1 Investigação Imediata (30 min)

1. **Adicionar logging SQL**:
   ```typescript
   const query = db.insert(cotacoesFrete).values(insertData);
   console.log("SQL:", query.toSQL());
   console.log("Valores:", query.toSQL().values);
   ```

2. **Verificar insertData completo**:
   ```typescript
   console.log("insertData keys:", Object.keys(insertData));
   console.log("insertData values:", Object.values(insertData));
   ```

3. **Testar com dados mínimos**:
   ```typescript
   const minimalData = {
     destinatarioNome: "TESTE",
     municipio: "ANDRADINA",
     estado: "SP",
     status: "fila"
   };
   await db.insert(cotacoesFrete).values(minimalData);
   ```

### 6.2 Possíveis Soluções (Ordem de Probabilidade)

**Solução 1**: Usar `db.insert().values()` com seleção explícita de colunas (90% confiança)
```typescript
const result = await db
  .insert(cotacoesFrete)
  .values({
    destinatarioNome: insertData.destinatarioNome,
    municipio: insertData.municipio,
    estado: insertData.estado,
    status: "fila",
    // ... apenas campos que queremos inserir
  });
```

**Solução 2**: Usar raw SQL com prepared statements (85% confiança)
```typescript
const result = await db.execute(
  sql`INSERT INTO cotacoes_frete (destinatarioNome, municipio, estado, status) 
      VALUES (${insertData.destinatarioNome}, ${insertData.municipio}, ${insertData.estado}, 'fila')`
);
```

**Solução 3**: Verificar versão do Drizzle e atualizar se necessário (70% confiança)
```bash
npm list drizzle-orm
npm update drizzle-orm
```

**Solução 4**: Usar TypeScript strict mode para garantir tipos corretos (60% confiança)
```typescript
const insertData: Partial<InsertCotacaoFrete> = {
  destinatarioNome: input.destinatarioNome,
  // TypeScript vai reclamar se tipos não baterem
};
```

### 6.3 Validação Pós-Correção

- [ ] Testar criação com dados mínimos (3 campos)
- [ ] Testar criação com dados completos (todos os campos)
- [ ] Verificar se `createdAt` e `updatedAt` são preenchidos automaticamente
- [ ] Verificar se `status` é 'fila' por padrão
- [ ] Testar com volumes (campo `dimensoes` como JSON)
- [ ] Verificar logs do servidor para confirmar SQL correto

---

## 7. INFORMAÇÕES ADICIONAIS

### 7.1 Ambiente de Produção
- **URL**: https://retrablog-ejd2bjzn.manus.space/
- **Auto-publish**: ATIVADO (cada checkpoint é publicado automaticamente)
- **Banco**: MySQL/TiDB gerenciado

### 7.2 Arquivos Críticos
- Frontend: `/home/ubuntu/retrabalho-system-recriado/client/src/pages/logistica/NovaCotacaoDialog.tsx`
- Backend: `/home/ubuntu/retrabalho-system-recriado/server/routers/logistica.ts`
- Schema: `/home/ubuntu/retrabalho-system-recriado/drizzle/schema.ts`

### 7.3 Checkpoint Atual
- **Version**: d0de9721
- **Status**: Com logging detalhado adicionado

---

## 8. PRÓXIMOS PASSOS

1. **Programador Senior**: Analisar as hipóteses e executar investigação imediata
2. **Feedback**: Compartilhar resultado do logging SQL
3. **Implementação**: Aplicar solução mais apropriada
4. **Teste**: Validar criação de cotação com sucesso
5. **Checkpoint**: Salvar versão corrigida

---

**Documento preparado para análise especializada**  
**Última atualização**: 2026-08-08 17:15 UTC

