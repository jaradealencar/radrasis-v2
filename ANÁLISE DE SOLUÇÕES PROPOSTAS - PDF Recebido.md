# ANÁLISE DE SOLUÇÕES PROPOSTAS - PDF Recebido

**Data**: 2026-08-08  
**Fonte**: `retrabalho-system-permanente(1).pdf`  
**Checkpoint Referência**: d0de9721

---

## 1. RESUMO DAS SOLUÇÕES PROPOSTAS NO PDF

### 1.1 Causa Raiz Identificada
O Drizzle ORM está tentando inserir **31 campos simultaneamente**, incluindo campos que chegam como `undefined` do frontend. O SQL gerado contém múltiplos placeholders `?` sem valores correspondentes.

**Problemas Específicos**:
1. **Campos inexistentes no schema**: `pedidoCnpj`, `pedidoEndereco`, `pedidoCep` (frontend envia, schema não tem)
2. **Mapeamento de dimensões**: Frontend envia `dimensoes` como JSON string, mas schema espera 3 colunas separadas (`dimensoesLargura`, `dimensoesAltura`, `dimensoesComprimento`)
3. **Tipagem de peso**: Peso enviado como string `"0"`, banco espera `decimal`

---

## 2. SOLUÇÃO TÉCNICA: BACKEND (server/routers/logistica.ts)

### 2.1 Código Proposto

```typescript
.create(async ({ input }) => {
  // ✅ Validação: garantir que apenas campos válidos sejam enviados ao banco
  
  // Extrair dimensões do JSON se enviado como string
  let dimensoesLargura: number | null = null;
  let dimensoesAltura: number | null = null;
  let dimensoesComprimento: number | null = null;
  let pesoKg: number | null = null;
  
  if (input.dimensoes) {
    try {
      const volumes = JSON.parse(input.dimensoes);
      if (Array.isArray(volumes) && volumes.length > 0) {
        const v = volumes[0];
        dimensoesLargura = Number(v.largura) || null;
        dimensoesAltura = Number(v.altura) || null;
        dimensoesComprimento = Number(v.comprimento) || null;
        pesoKg = volumes.reduce((acc: number, vol: any) => acc + (Number(vol.peso) || 0), 0) || null;
      }
    } catch (e) {
      console.error('Erro ao parsear dimensões:', e);
    }
  }
  
  if (!pesoKg && input.pesoKg) {
    pesoKg = parseFloat(input.pesoKg);
  }
  
  // ✅ Construir insertData APENAS com campos que o schema aceita
  const insertData: Record<string, any> = {
    destinatarioNome: input.destinatarioNome,
    municipio: input.municipio,
    estado: input.estado,
    status: "fila",
  };
  
  if (input.solicitanteId) insertData.solicitanteId = input.solicitanteId;
  if (input.solicitanteNome) insertData.solicitanteNome = input.solicitanteNome;
  if (input.destinatarioCnpj) insertData.destinatarioCnpj = input.destinatarioCnpj;
  if (input.cepDestino) insertData.cepDestino = input.cepDestino;
  if (dimensoesLargura) insertData.dimensoesLargura = dimensoesLargura;
  if (dimensoesAltura) insertData.dimensoesAltura = dimensoesAltura;
  if (dimensoesComprimento) insertData.dimensoesComprimento = dimensoesComprimento;
  if (pesoKg && pesoKg > 0) insertData.pesoKg = pesoKg;
  if (input.valorNf) insertData.valorNf = parseFloat(input.valorNf);
  if (input.observacoes) insertData.observacoes = input.observacoes;
  if (input.observacaoGol) insertData.observacaoGol = input.observacaoGol;
  if (input.fotoUrl) insertData.fotoUrl = input.fotoUrl;
  if (input.empacotamentoPedidoId) insertData.empacotamentoPedidoId = input.empacotamentoPedidoId;
  if (input.empacotamentoPedidoNumero) insertData.empacotamentoPedidoNumero = input.empacotamentoPedidoNumero;
  if (input.tipoMaterial) insertData.tipoMaterial = input.tipoMaterial;
  
  // ✅ Adicionar campos com defaults explícitos
  insertData.temRetrabalho = false;
  
  try {
    const result = await db.insert(cotacoesFrete).values(insertData);
    return { success: true, id: result[0].insertId };
  } catch (error: any) {
    console.error('ERRO NO INSERT:', { 
      message: error.message, 
      sql: error.sql, 
      insertData 
    });
    throw new TRPCError({ 
      code: 'INTERNAL_SERVER_ERROR', 
      message: error.message 
    });
  }
})
```

### 2.2 Mudanças-Chave
1. **Parse de dimensões**: Extrair do JSON string para 3 colunas decimais
2. **Parse de peso**: Calcular total dos volumes ou usar input direto
3. **Tipagem**: Converter strings para números (parseFloat, Number())
4. **Campos default**: Adicionar explicitamente `temRetrabalho: false`
5. **Campos inválidos**: NÃO incluir `pedidoCnpj`, `pedidoEndereco`, `pedidoCep` (não existem no schema)
6. **Try/catch**: Capturar erro SQL com contexto completo

---

## 3. SOLUÇÃO TÉCNICA: FRONTEND (client/src/pages/logistica/NovaCotacaoDialog.tsx)

### 3.1 Correção do Payload

**Remover campos que não existem no schema**:
```typescript
// ❌ REMOVER ESTAS LINHAS:
pedidoCnpj: form.cnpj,
pedidoEndereco: "",
pedidoCep: form.cepDestino,

// ✅ MANTER APENAS:
create.mutate({
  destinatarioNome: form.destinatarioNome,
  municipio: form.municipio,
  estado: form.estado,
  cepDestino: form.cepDestino,
  pesoKg: pesoTotal.toString(),
  valorNf: "0",
  observacoes: form.observacoes,
  solicitanteNome: solicitanteNome || localUser?.name || "",
  destinatarioCnpj: form.cnpj,
  tipoMaterial: "Letreiro / Sinalização",
  dimensoes: volumesJson,  // ✅ Deixar como JSON string
} as any);
```

### 3.2 Adicionar Hook useEffect para Persistência
```typescript
useEffect(() => {
  if (open) {
    // Restaurar dados ao abrir dialog
    const storage = getStorage();
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setForm(data.form);
        setVolumes(data.volumes);
        setOsNumero(data.osNumero);
      } catch (e) {
        console.error('Erro ao restaurar dados:', e);
      }
    }
  } else {
    // Limpar ao fechar (apenas após sucesso)
    if (create.isSuccess) {
      const storage = getStorage();
      storage?.removeItem(STORAGE_KEY);
    }
  }
}, [open, create.isSuccess]);
```

### 3.3 Adicionar onSuccess Handler
```typescript
const create = trpc.cotacoesFrete.create.useMutation({
  onSuccess: (data) => {
    toast.success(`✅ Cotação #${data.id} criada com sucesso!`);
    setOpen(false);
    handleResetForm();
    onSuccess();
  },
  onError: (error) => {
    toast.error(`❌ Erro: ${error.message}`);
  },
});
```

---

## 4. SOLUÇÃO TÉCNICA: PERSISTÊNCIA (sessionStorage)

### 4.1 Implementar Hook useEffect
```typescript
useEffect(() => {
  if (typeof window === "undefined") return;
  
  // Sincronizar estado com sessionStorage
  const storage = getStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify({
      form,
      volumes,
      osNumero,
    }));
  }
}, [form, volumes, osNumero]);

// Restaurar ao montar
useEffect(() => {
  if (typeof window === "undefined") return;
  
  const storage = getStorage();
  if (storage) {
    const saved = storage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setForm(data.form);
        setVolumes(data.volumes);
        setOsNumero(data.osNumero);
      } catch (e) {
        console.error('Erro ao restaurar:', e);
      }
    }
  }
}, []);
```

---

## 5. PERFORMANCE E FILTRAGEM (Drizzle Syntax)

### 5.1 Implementar Filtro de 30 Dias
```typescript
import { gte, lte, and, desc } from 'drizzle-orm';

const trinta_dias_atras = new Date();
trinta_dias_atras.setDate(trinta_dias_atras.getDate() - 30);

const solicitacoes = await db
  .select()
  .from(cotacoesFrete)
  .where(and(
    gte(cotacoesFrete.createdAt, trinta_dias_atras),
    lte(cotacoesFrete.createdAt, new Date())
  ))
  .orderBy(desc(cotacoesFrete.createdAt))
  .limit(100);
```

---

## 6. PROTOCOLO DE TESTES EXAUSTIVOS

| Teste | Ação | Resultado Esperado |
|---|---|---|
| **T1: INSERT Mínimo** | Criar com apenas Nome, Cidade, UF | Sucesso no banco (campos default preenchidos) |
| **T2: CNPJ Clean** | Inserir CNPJ com pontos e barras | Banco deve registrar apenas números |
| **T3: Persistência** | Preencher → Trocar aba Chrome → Voltar | Dados devem permanecer no formulário |
| **T4: Performance** | Abrir menu Solicitação de Frete | Carregamento em < 2 segundos |

---

## 7. COMPARAÇÃO: ESTADO ATUAL vs. SOLUÇÕES PROPOSTAS

| Aspecto | Estado Atual (d0de9721) | Solução Proposta | Status |
|---|---|---|---|
| **Campos inválidos no payload** | ❌ Envia `pedidoCnpj`, `pedidoEndereco`, `pedidoCep` | ✅ Remove campos inválidos | 🔴 CRÍTICO |
| **Parse de dimensões** | ❌ Envia como JSON string sem parse | ✅ Parse para 3 colunas decimais | 🔴 CRÍTICO |
| **Tipagem de peso** | ⚠️ String, sem conversão | ✅ parseFloat() com validação | 🔴 CRÍTICO |
| **Tratamento de erro** | ✅ Try/catch com logging | ✅ Melhorado com contexto SQL | 🟡 MELHORIA |
| **Persistência** | ✅ sessionStorage implementado | ✅ useEffect sincronizado | 🟢 OK |
| **Filtro 30 dias** | ✅ Implementado no servidor | ✅ Usar Drizzle syntax correto | 🟡 MELHORIA |

---

## 8. PLANO DE IMPLEMENTAÇÃO

### Fase 1: Backend (30 min)
- [ ] Implementar parse de dimensões
- [ ] Adicionar tipagem correta (parseFloat, Number)
- [ ] Remover campos inválidos
- [ ] Adicionar try/catch melhorado

### Fase 2: Frontend (20 min)
- [ ] Remover `pedidoCnpj`, `pedidoEndereco`, `pedidoCep` do payload
- [ ] Adicionar onSuccess handler
- [ ] Melhorar persistência com useEffect

### Fase 3: Testes (15 min)
- [ ] T1: INSERT mínimo
- [ ] T2: CNPJ com formatação
- [ ] T3: Persistência ao trocar aba
- [ ] T4: Performance < 2s

### Fase 4: Validação (10 min)
- [ ] Testar criação com dados completos
- [ ] Verificar se `createdAt` é preenchido
- [ ] Confirmar `status = 'fila'`
- [ ] Testar com múltiplos volumes

---

## 9. CONCLUSÃO

As soluções propostas no PDF são **técnicas e viáveis**. O problema principal é a **discrepância entre o payload do frontend e o schema do banco**. 

**Próximo passo**: Implementar as 3 soluções (Backend, Frontend, Persistência) e executar os 4 testes.

