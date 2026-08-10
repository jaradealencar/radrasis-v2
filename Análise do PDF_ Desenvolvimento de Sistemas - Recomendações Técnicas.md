# Análise do PDF: Desenvolvimento de Sistemas - Recomendações Técnicas

**Data**: 08/08/2026  
**Arquivo**: ManusIagoFacebook-DesenvolvimentodeSistemas.pdf  
**Páginas**: 5

---

## 📌 RECOMENDAÇÕES PRINCIPAIS EXTRAÍDAS

### 1. **Problema Identificado: Drizzle ORM Gerando SQL Incorreto**

O PDF confirma que o Drizzle ORM está gerando INSERT com todas as 32 colunas da tabela, mesmo quando apenas 13 campos são passados em `.values()`.

**Causa Raiz**: Comportamento padrão do Drizzle MySQL que não filtra colunas automaticamente quando há campos com DEFAULT.

---

### 2. **Solução Recomendada: Usar SQL Puro com Prepared Statements**

Em vez de tentar forçar o Drizzle a funcionar, a recomendação é usar SQL puro com prepared statements para ter controle total:

```typescript
import { pool } from './db-connection';

const query = `
  INSERT INTO cotacoes_frete 
  (solicitanteNome, destinatarioNome, destinatarioCnpj, cepDestino, 
   municipio, estado, dimensoesLargura, dimensoesAltura, 
   dimensoesComprimento, pesoKg, observacoes, tipoMaterial) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const values = [
  input.solicitanteNome,
  input.destinatarioNome,
  input.destinatarioCnpj,
  input.cepDestino,
  input.municipio,
  input.estado,
  dimensoesLargura,
  dimensoesAltura,
  dimensoesComprimento,
  pesoKg,
  input.observacoes,
  input.tipoMaterial
];

const [result] = await pool.execute(query, values);
const insertId = result.insertId;
```

**Vantagens**:
- ✅ Controle total sobre colunas inseridas
- ✅ Sem overhead do Drizzle
- ✅ Prepared statements = segurança contra SQL injection
- ✅ Retorna insertId corretamente

**Desvantagens**:
- ⚠️ Perde type-safety do Drizzle
- ⚠️ Precisa manter query sincronizada com schema

---

### 3. **Alternativa: Usar Drizzle com Partial Update**

Se quiser manter o Drizzle, usar a abordagem de inserir e depois atualizar:

```typescript
// 1. Inserir com campos mínimos obrigatórios
const result = await db.insert(cotacoesFrete).values({
  destinatarioNome: input.destinatarioNome,
  municipio: input.municipio,
  estado: input.estado
});

// 2. Buscar o ID inserido
const insertId = (result as any).insertId;

// 3. Atualizar com campos opcionais
if (insertId) {
  await db.update(cotacoesFrete)
    .set({
      solicitanteNome: input.solicitanteNome,
      destinatarioCnpj: input.destinatarioCnpj,
      // ... outros campos
    })
    .where(eq(cotacoesFrete.id, insertId));
}
```

**Vantagens**:
- ✅ Mantém type-safety do Drizzle
- ✅ Funciona com Drizzle MySQL
- ✅ Simples de implementar

**Desvantagens**:
- ⚠️ 2 queries em vez de 1 (performance)
- ⚠️ Não é transacional por padrão

---

### 4. **Recomendação Final do PDF**

**Use SQL Puro + Prepared Statements** porque:

1. **Simplicidade**: Uma única query bem definida
2. **Performance**: Sem overhead do Drizzle
3. **Segurança**: Prepared statements protegem contra SQL injection
4. **Confiabilidade**: Controle total sobre o que é inserido
5. **Debugging**: SQL é explícito e fácil de debugar

---

## 🔧 IMPLEMENTAÇÃO RECOMENDADA

### Passo 1: Criar helper de database connection

**Arquivo**: `server/db-connection.ts`

```typescript
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### Passo 2: Criar função helper para INSERT

**Arquivo**: `server/db-helpers.ts`

```typescript
import { pool } from './db-connection';

export async function criarCotacaoFrete(dados: {
  solicitanteNome: string;
  destinatarioNome: string;
  destinatarioCnpj?: string;
  cepDestino?: string;
  municipio: string;
  estado: string;
  dimensoesLargura?: number;
  dimensoesAltura?: number;
  dimensoesComprimento?: number;
  pesoKg?: number;
  observacoes?: string;
  tipoMaterial?: string;
}) {
  const query = `
    INSERT INTO cotacoes_frete 
    (solicitanteNome, destinatarioNome, destinatarioCnpj, cepDestino, 
     municipio, estado, dimensoesLargura, dimensoesAltura, 
     dimensoesComprimento, pesoKg, observacoes, tipoMaterial) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    dados.solicitanteNome,
    dados.destinatarioNome,
    dados.destinatarioCnpj || null,
    dados.cepDestino || null,
    dados.municipio,
    dados.estado,
    dados.dimensoesLargura || null,
    dados.dimensoesAltura || null,
    dados.dimensoesComprimento || null,
    dados.pesoKg || null,
    dados.observacoes || null,
    dados.tipoMaterial || null
  ];

  try {
    const [result] = await pool.execute(query, values);
    return {
      success: true,
      id: (result as any).insertId,
      message: `Cotação criada com sucesso! ID: ${(result as any).insertId}`
    };
  } catch (error: any) {
    console.error('Erro ao criar cotação:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
```

### Passo 3: Usar no endpoint tRPC

**Arquivo**: `server/routers/logistica.ts`

```typescript
import { criarCotacaoFrete } from '../db-helpers';

export const cotacoesFrete = router({
  create: protectedProcedure
    .input(z.object({
      solicitanteNome: z.string(),
      destinatarioNome: z.string(),
      destinatarioCnpj: z.string().optional(),
      // ... outros campos
    }))
    .mutation(async ({ input }) => {
      // Validação
      if (!input.destinatarioNome || !input.municipio || !input.estado) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Campos obrigatórios não preenchidos'
        });
      }

      // Parse de dimensões
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
            pesoKg = volumes.reduce((acc: number, vol: any) => 
              acc + (Number(vol.peso) || 0), 0) || null;
          }
        } catch (e) {
          console.error('Erro ao parsear dimensões:', e);
        }
      }

      // Usar helper SQL puro
      const resultado = await criarCotacaoFrete({
        solicitanteNome: input.solicitanteNome,
        destinatarioNome: input.destinatarioNome,
        destinatarioCnpj: input.destinatarioCnpj,
        cepDestino: input.cepDestino,
        municipio: input.municipio,
        estado: input.estado,
        dimensoesLargura,
        dimensoesAltura,
        dimensoesComprimento,
        pesoKg,
        observacoes: input.observacoes,
        tipoMaterial: input.tipoMaterial
      });

      if (!resultado.success) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: resultado.error
        });
      }

      return { success: true, id: resultado.id };
    })
});
```

---

## 📊 COMPARAÇÃO: Drizzle vs SQL Puro

| Aspecto | Drizzle ORM | SQL Puro |
|---------|------------|----------|
| **Type-safety** | ✅ Alto | ⚠️ Médio |
| **Controle** | ⚠️ Limitado | ✅ Total |
| **Performance** | ⚠️ Overhead | ✅ Rápido |
| **Segurança** | ✅ Seguro | ✅ Seguro (prepared) |
| **Debugging** | ⚠️ Complexo | ✅ Simples |
| **Manutenção** | ⚠️ Acoplado | ✅ Independente |
| **Curva de aprendizado** | ⚠️ Média | ✅ Baixa |

---

## ✅ PLANO DE AÇÃO

### Fase 1: Preparação (30 min)
- [ ] Criar `server/db-connection.ts` com pool MySQL
- [ ] Criar `server/db-helpers.ts` com função `criarCotacaoFrete()`
- [ ] Testar conexão com banco

### Fase 2: Implementação (45 min)
- [ ] Atualizar endpoint `cotacoesFrete.create` em `server/routers/logistica.ts`
- [ ] Remover lógica Drizzle do endpoint
- [ ] Adicionar chamada para `criarCotacaoFrete()`
- [ ] Testar no navegador

### Fase 3: Validação (30 min)
- [ ] Preencher formulário com dados válidos
- [ ] Clicar "Criar Solicitação"
- [ ] Validar que cotação é criada com sucesso
- [ ] Validar que card aparece no Kanban
- [ ] Verificar logs no console

### Fase 4: Cleanup (15 min)
- [ ] Remover código Drizzle não utilizado
- [ ] Adicionar testes unitários
- [ ] Criar checkpoint final

**Tempo Total Estimado**: 2 horas

---

## 🎯 RESULTADO ESPERADO

Após implementação:
- ✅ INSERT funciona sem erro SQL
- ✅ Cotação é criada com ID correto
- ✅ Card aparece no Kanban
- ✅ Toast exibe ID com sucesso
- ✅ Formulário é resetado
- ✅ Sem perda de dados ao mudar de janela

---

## 📝 CONCLUSÃO

O PDF recomenda **SQL Puro com Prepared Statements** como solução definitiva para o erro de INSERT. Esta abordagem:

1. Resolve o problema imediatamente
2. Melhora performance
3. Mantém segurança
4. Simplifica debugging
5. Não quebra outras funcionalidades

**Recomendação**: Implementar nas próximas 2 horas.

---

**Análise realizada por**: Manus AI Agent  
**Data**: 08/08/2026 17:00 UTC  
**Status**: Pronto para implementação
