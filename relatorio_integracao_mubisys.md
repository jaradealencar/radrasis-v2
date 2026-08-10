# RELATÓRIO TÉCNICO: INTEGRAÇÃO API MUBISYS
## Formulário de Solicitações de Frete - Sistema de Controle de Retrabalhos

**Data**: 08 de Agosto de 2026  
**Projeto**: Sistema de Controle de Retrabalhos (Radrasys)  
**Módulo**: Logística - Solicitações de Frete  
**Status**: ⚠️ Bloqueado por erro de autenticação API

---

## 1. REQUISITOS FUNCIONAIS ESPERADOS

### 1.1 Fluxo de Busca de Ordem de Serviço (OS)

#### Especificação Técnica
- **Campo de entrada**: Input numérico para número da OS (ex: 6906)
- **Acionador**: Botão "Buscar" ou tecla Enter
- **Validação de entrada**: Rejeitar entrada com menos de 3 dígitos

#### Chamada HTTP
```
GET https://api.mubisys.com/api/{TENANT}/ordem-servico/{OS_NUMBER}
Headers:
  - Access-Token: {JWT_TOKEN}
  - Content-Type: application/json
```

#### Resposta Esperada (Sucesso)
```json
{
  "id": 6906,
  "numero": "6906",
  "cliente": {
    "id": 123,
    "nome": "Empresa XYZ Ltda",
    "cnpj": "12.345.678/0001-90",
    "razaoSocial": "Empresa XYZ Ltda"
  },
  "endereco": {
    "municipio": "São Paulo",
    "estado": "SP",
    "cep": "01310-100",
    "rua": "Avenida Paulista",
    "numero": "1000"
  },
  "status": "aberta",
  "dataAbertura": "2026-08-01T10:30:00Z"
}
```

#### Preenchimento Automático de Campos
Ao receber resposta bem-sucedida, o formulário deve preencher automaticamente:

| Campo do Formulário | Origem na Resposta | Tipo |
|-------------------|------------------|------|
| `destinatarioNome` | `response.cliente.nome` | string |
| `cnpj` | `response.cliente.cnpj` | string |
| `razaoSocial` | `response.cliente.razaoSocial` | string |
| `municipio` | `response.endereco.municipio` | string |
| `estado` | `response.endereco.estado` | string |
| `cepDestino` | `response.endereco.cep` | string |

#### Efeitos Colaterais Esperados
1. **Disparo automático**: Chamar `buscarTransportadoras(municipio)` após preenchimento bem-sucedido
2. **Feedback visual**: Exibir toast com mensagem "✓ OS {numero} carregada com sucesso"
3. **Estado do botão**: Desabilitar botão "Buscar" durante requisição, reabilitar após resposta

### 1.2 Indicação de Transportadoras Disponíveis

#### Trigger
- Disparado automaticamente após preenchimento bem-sucedido de `municipio`

#### Comportamento Esperado
- Exibir card com fundo verde (bg-green-50)
- Listar transportadoras que atendem a cidade
- Cada item exibir: ícone ✓, nome da transportadora, cobertura

#### Exemplo de Renderização
```
✓ Transportadoras que atendem São Paulo
  ✓ Sedex (Nacional)
  ✓ PAC (Nacional)
  ✓ Loggi (Principais cidades)
  ✓ Transportadora Local (Região)
```

### 1.3 Múltiplos Volumes

#### Funcionalidades
- Adicionar volumes dinamicamente via botão "+ Adicionar Volume"
- Remover volumes (se mais de um existir)
- Cada volume contém 4 campos obrigatórios

#### Campos por Volume
| Campo | Tipo | Unidade | Validação |
|-------|------|---------|-----------|
| Largura | number | cm | > 0 |
| Comprimento | number | cm | > 0 |
| Altura | number | cm | > 0 |
| Peso | number | kg | > 0 |

#### Cálculo Automático
```
Peso Total = Σ(peso de cada volume)
Exemplo: Volume 1 (5kg) + Volume 2 (3kg) = 8.00 kg
```

#### Validação antes de Criar Solicitação
- Todos os campos de volume devem estar preenchidos
- Peso total deve ser > 0
- Campos obrigatórios do formulário (Destinatário, Município, Estado) devem estar preenchidos

---

## 2. IMPLEMENTAÇÃO ATUAL

### 2.1 Arquivo: `client/src/pages/logistica/NovaCotacaoDialog.tsx`

#### Componente Principal
```typescript
export function NovaCotacaoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [osNumero, setOsNumero] = useState("");
  const [buscandoOS, setBuscandoOS] = useState(false);
  const [volumes, setVolumes] = useState<Volume[]>([...]);
  const [form, setForm] = useState({
    destinatarioNome: "",
    cnpj: "",
    razaoSocial: "",
    municipio: "",
    estado: "",
    cepDestino: "",
    observacoes: "",
    solicitanteNome: "",
  });
  const [transportadorasDisponiveis, setTransportadorasDisponiveis] = useState<any[]>([]);
  // ...
}
```

#### Função `buscarOS()` - Implementação Atual
```typescript
const buscarOS = async () => {
  if (!osNumero || osNumero.length < 3) {
    toast.error("Digite um número de OS válido");
    return;
  }

  setBuscandoOS(true);
  try {
    const response = await fetch(
      `https://api.mubisys.com/api/public-353778-key/ordem-servico/${osNumero}`,
      {
        headers: {
          "Access-Token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3Nzc5NTI0OTl9.YN7UXgoJoAWRxR4OGIzo5awYGzSrI_rtKcVU0iGtqM4",
        },
      }
    );

    // ⚠️ PROBLEMA 1: Validação inadequada
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.error?.includes("autorizado")) {
        toast.error("Erro de autenticação com MubiSys. Preencha os dados manualmente.");
      } else {
        toast.error("OS não encontrada. Verifique o número.");
      }
      return;
    }

    const dadosOS = await response.json();
    
    // ⚠️ PROBLEMA 2: Fallbacks múltiplos indicam incerteza sobre estrutura
    setForm(p => ({
      ...p,
      destinatarioNome: dadosOS.cliente?.nome || dadosOS.nomeCliente || p.destinatarioNome,
      cnpj: dadosOS.cliente?.cnpj || dadosOS.cnpjCliente || p.cnpj,
      razaoSocial: dadosOS.cliente?.razaoSocial || dadosOS.cliente?.nome || dadosOS.nomeCliente || p.razaoSocial,
      municipio: dadosOS.endereco?.municipio || dadosOS.municipio || p.municipio,
      estado: dadosOS.endereco?.estado || dadosOS.estado || p.estado,
      cepDestino: dadosOS.endereco?.cep || dadosOS.cep || p.cepDestino,
    }));

    if (dadosOS.endereco?.municipio || dadosOS.municipio) {
      buscarTransportadoras(dadosOS.endereco?.municipio || dadosOS.municipio);
    }

    toast.success(`✓ OS ${osNumero} carregada com sucesso`);
  } catch (error) {
    console.error("Erro ao buscar OS:", error);
    toast.error("Erro ao buscar OS. Você pode preencher os dados manualmente.");
  } finally {
    setBuscandoOS(false);
  }
};
```

#### Função `buscarTransportadoras()` - Implementação Atual
```typescript
const buscarTransportadoras = async (cidade: string) => {
  try {
    // ❌ PROBLEMA 3: Lista hardcoded, não consultada de API
    const transportadoras = [
      { id: 1, nome: "Sedex", cobertura: "Nacional" },
      { id: 2, nome: "PAC", cobertura: "Nacional" },
      { id: 3, nome: "Loggi", cobertura: "Principais cidades" },
      { id: 4, nome: "Transportadora Local", cobertura: "Região" },
    ];
    setTransportadorasDisponiveis(transportadoras);
  } catch (error) {
    console.error("Erro ao buscar transportadoras:", error);
  }
};
```

### 2.2 Componentes de UI Implementados
- ✓ Campo de busca de OS com botão "Buscar"
- ✓ Campos de formulário (Destinatário, CNPJ, Razão Social, Município, Estado, CEP)
- ✓ Card de transportadoras (estrutura visual)
- ✓ Sistema de múltiplos volumes com adicionar/remover
- ✓ Cálculo de peso total
- ✓ Validação de entrada
- ✓ Toast notifications

---

## 3. PROBLEMAS IDENTIFICADOS

### 3.1 Erro de Autenticação (CRÍTICO - BLOQUEADOR)

#### Sintoma
```
Toast exibindo: "Erro de autenticação com MubiSys. Preencha os dados manualmente."
Nenhum campo é preenchido automaticamente
```

#### Teste Realizado
```bash
$ curl -s "https://api.mubisys.com/api/public-353778-key/ordem-servico/6906" \
  -H "Access-Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3Nzc5NTI0OTl9.YN7UXgoJoAWRxR4OGIzo5awYGzSrI_rtKcVU0iGtqM4"

# Resposta:
{
  "error": "Usuário não autorizado"
}
```

#### Causa Raiz
1. **API retorna HTTP 200** com JSON contendo campo `error`
2. **Código verifica apenas `response.ok`** (HTTP status 200-299), não valida o corpo JSON
3. **Token JWT pode estar expirado** (data de expiração: 1777995249 = 2026-08-08)
4. **Tenant/chave pública pode estar incorreto** na URL

#### Fluxo de Erro Detalhado
```
1. Usuario clica "Buscar"
2. fetch() envia GET request
3. API retorna:
   - HTTP Status: 200 ✓
   - Body: { "error": "Usuário não autorizado" }
4. response.ok === true (porque HTTP 200)
5. Código pula a validação de erro JSON
6. JSON.parse() tenta extrair dados.cliente.nome
7. Retorna undefined (porque não há "cliente" no objeto de erro)
8. setForm() recebe valores undefined
9. Nenhum campo é preenchido
10. buscarTransportadoras() nunca é chamado
11. Toast nunca exibe sucesso
12. Usuário vê "Erro de autenticação"
```

### 3.2 Validação Inadequada de Resposta HTTP

#### Problema
```typescript
// ❌ ERRADO - Implementação Atual
if (!response.ok) {
  // Trata erro
}
const data = await response.json();
// Assume que data é válido
```

#### Solução Necessária
```typescript
// ✓ CORRETO - Necessário
const data = await response.json();

// Validar campo de erro ANTES de usar dados
if (data.error) {
  throw new Error(`API Error: ${data.error}`);
}

// Validar estrutura esperada
if (!data.cliente || !data.endereco) {
  throw new Error("Resposta da API em formato inesperado");
}

// Agora é seguro usar data
```

### 3.3 Transportadoras Hardcoded (NÃO INTEGRADO)

#### Problema
```typescript
const transportadoras = [
  { id: 1, nome: "Sedex", cobertura: "Nacional" },
  { id: 2, nome: "PAC", cobertura: "Nacional" },
  // ... lista fixa, não consultada de API
];
```

#### Impacto
- Lista não reflete transportadoras reais que atendem cada cidade
- Não há integração com base de dados de transportadoras
- Comportamento é idêntico para qualquer município

#### Necessário
- Endpoint API: `GET /transportadoras?municipio={city}`
- Ou: Consultar base de dados local com cobertura por transportadora

### 3.4 Estrutura de Resposta Desconhecida

#### Problema
Código usa múltiplos fallbacks indicando incerteza:
```typescript
destinatarioNome: dadosOS.cliente?.nome || dadosOS.nomeCliente || p.destinatarioNome,
cnpj: dadosOS.cliente?.cnpj || dadosOS.cnpjCliente || p.cnpj,
municipio: dadosOS.endereco?.municipio || dadosOS.municipio || p.municipio,
```

#### Causa
- Documentação da estrutura de resposta do MubiSys não foi fornecida
- Não há exemplo real de resposta bem-sucedida
- Código tenta múltiplas variações de nomes de campos

#### Necessário
- Documentação exata da estrutura JSON retornada por `/ordem-servico/{id}`
- Exemplo real de resposta bem-sucedida
- Confirmação de nomes de campos exatos

---

## 4. TABELA DE FLUXO: ESPERADO vs. ATUAL

| # | Etapa | Esperado | Implementado | Status | Observação |
|---|-------|----------|--------------|--------|-----------|
| 1 | Usuário digita OS 6906 | Input recebe "6906" | ✓ Sim | ✓ OK | Funciona |
| 2 | Clica "Buscar" | Dispara `buscarOS()` | ✓ Sim | ✓ OK | Funciona |
| 3 | Validação de entrada | Rejeita < 3 dígitos | ✓ Sim | ✓ OK | Funciona |
| 4 | Chamada HTTP GET | Envia para `/ordem-servico/6906` | ✓ Sim | ⚠️ Falha | Retorna erro 200 |
| 5 | Validação de resposta | Verifica `error` no JSON | ✗ Não | ❌ FALHA | Não implementado |
| 6 | Parse de resposta | Extrai campos de cliente | ✓ Sim | ⚠️ Incerto | Usa fallbacks |
| 7 | Preenchimento automático | Atualiza form state | ✓ Sim | ❌ Nunca executa | Bloqueado por erro |
| 8 | Busca transportadoras | Consulta API por cidade | ✗ Simulado | ❌ FALHA | Hardcoded |
| 9 | Exibir transportadoras | Card verde com lista | ✓ Sim | ❌ Nunca executa | Bloqueado por erro |
| 10 | Toast de sucesso | Mensagem "✓ OS carregada" | ✓ Sim | ❌ Nunca executa | Bloqueado por erro |

---

## 5. RAIZ DO PROBLEMA - ANÁLISE DETALHADA

### Sequência de Execução com Erro

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ATUAL COM ERRO                                        │
└─────────────────────────────────────────────────────────────┘

Usuario clica "Buscar"
    ↓
setBuscandoOS(true)
    ↓
fetch("https://api.mubisys.com/api/public-353778-key/ordem-servico/6906", {
  headers: { "Access-Token": "eyJ0eXAi..." }
})
    ↓
API retorna:
  HTTP 200
  Body: { "error": "Usuário não autorizado" }
    ↓
response.ok === true  ✓ (porque HTTP 200)
    ↓
if (!response.ok) {   ← Condição FALSE, pula o bloco
  // Não entra aqui
}
    ↓
const dadosOS = await response.json()
  → { "error": "Usuário não autorizado" }
    ↓
setForm(p => ({
  destinatarioNome: dadosOS.cliente?.nome  ← undefined (não existe)
                    || dadosOS.nomeCliente  ← undefined (não existe)
                    || p.destinatarioNome   ← "" (vazio)
  // Resultado: ""
  
  cnpj: dadosOS.cliente?.cnpj  ← undefined
        || dadosOS.cnpjCliente  ← undefined
        || p.cnpj               ← "" (vazio)
  // Resultado: ""
  
  municipio: dadosOS.endereco?.municipio  ← undefined
             || dadosOS.municipio          ← undefined
             || p.municipio                ← "" (vazio)
  // Resultado: ""
}))
    ↓
if (dadosOS.endereco?.municipio || dadosOS.municipio) {
  // Ambos undefined, condição FALSE
  // buscarTransportadoras() NÃO É CHAMADO
}
    ↓
toast.success(`✓ OS 6906 carregada com sucesso`)
  ← Executa, mas dados não foram preenchidos
    ↓
setBuscandoOS(false)
    ↓
FIM: Nenhum campo foi preenchido, nenhuma transportadora foi buscada
```

### Comparação com Fluxo Esperado

```
┌─────────────────────────────────────────────────────────────┐
│ FLUXO ESPERADO (COM SUCESSO)                                │
└─────────────────────────────────────────────────────────────┘

Usuario clica "Buscar"
    ↓
fetch() com credenciais válidas
    ↓
API retorna:
  HTTP 200
  Body: {
    "cliente": { "nome": "Empresa XYZ", "cnpj": "12.345...", ... },
    "endereco": { "municipio": "São Paulo", "estado": "SP", ... }
  }
    ↓
response.ok === true ✓
    ↓
const dadosOS = await response.json()
  → { "cliente": {...}, "endereco": {...} }
    ↓
setForm() preenche com dados reais
  → destinatarioNome: "Empresa XYZ"
  → cnpj: "12.345..."
  → municipio: "São Paulo"
  → estado: "SP"
    ↓
if (dadosOS.endereco?.municipio) {
  buscarTransportadoras("São Paulo")  ← EXECUTA
}
    ↓
setTransportadorasDisponiveis([...])
  → Exibe card verde com transportadoras
    ↓
toast.success("✓ OS 6906 carregada com sucesso")
    ↓
FIM: Todos os campos preenchidos, transportadoras exibidas
```

---

## 6. AÇÕES NECESSÁRIAS PARA RESOLVER

### 6.1 Validação de Resposta (CRÍTICO - PRIORIDADE 1)

**Implementar validação de erro JSON:**

```typescript
const buscarOS = async () => {
  // ... código anterior ...
  
  try {
    const response = await fetch(url, { headers });
    
    // ✓ NOVO: Validar HTTP status
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // ✓ NOVO: Validar campo de erro JSON
    if (data.error) {
      throw new Error(`API Error: ${data.error}`);
    }
    
    // ✓ NOVO: Validar estrutura esperada
    if (!data.cliente || !data.endereco) {
      throw new Error("Resposta da API em formato inesperado");
    }
    
    // Agora é seguro usar data
    setForm(p => ({
      ...p,
      destinatarioNome: data.cliente.nome,
      cnpj: data.cliente.cnpj,
      razaoSocial: data.cliente.razaoSocial,
      municipio: data.endereco.municipio,
      estado: data.endereco.estado,
      cepDestino: data.endereco.cep,
    }));
    
    // ...resto do código...
  } catch (error) {
    console.error("Erro ao buscar OS:", error);
    toast.error(`Erro: ${error.message}`);
  }
};
```

### 6.2 Verificar Credenciais MubiSys (CRÍTICO - PRIORIDADE 1)

**Checklist:**

- [ ] Confirmar se JWT está válido e não expirado
  - JWT atual expira em: 2026-08-08 (hoje)
  - Gerar novo JWT válido
  
- [ ] Confirmar se tenant está correto
  - Atual: `public-353778-key`
  - Verificar se é o tenant correto no painel MubiSys
  
- [ ] Confirmar endpoint exato
  - Testar: `GET /api/{TENANT}/ordem-servico/{ID}`
  - Testar: `GET /api/{TENANT}/os/{ID}`
  - Testar: `GET /api/{TENANT}/ordens-servico/{ID}`

**Teste manual:**
```bash
TOKEN="novo_jwt_valido"
TENANT="public-353778-key"
OS="6906"

curl -v "https://api.mubisys.com/api/${TENANT}/ordem-servico/${OS}" \
  -H "Access-Token: ${TOKEN}" \
  -H "Content-Type: application/json"

# Esperado: HTTP 200 + JSON com dados da OS
# Atual: HTTP 200 + { "error": "Usuário não autorizado" }
```

### 6.3 Documentar Estrutura de Resposta (PRIORIDADE 2)

**Obter exemplo real:**

```bash
# Após obter credenciais válidas, executar:
curl -s "https://api.mubisys.com/api/public-353778-key/ordem-servico/6906" \
  -H "Access-Token: {NOVO_JWT_VALIDO}" | python3 -m json.tool > resposta_exemplo.json
```

**Documentar campos:**
- Nomes exatos de campos
- Tipos de dados (string, number, date, etc.)
- Campos opcionais vs. obrigatórios
- Estrutura aninhada (cliente, endereco, etc.)

### 6.4 Integrar Transportadoras Reais (PRIORIDADE 2)

**Opção A: API MubiSys**
```typescript
const buscarTransportadoras = async (municipio: string) => {
  try {
    const response = await fetch(
      `https://api.mubisys.com/api/public-353778-key/transportadoras?municipio=${municipio}`,
      {
        headers: {
          "Access-Token": "novo_jwt_valido",
        },
      }
    );
    
    if (!response.ok) throw new Error("Erro ao buscar transportadoras");
    
    const data = await response.json();
    if (data.error) throw new Error(data.error);
    
    setTransportadorasDisponiveis(data.transportadoras || []);
  } catch (error) {
    console.error("Erro ao buscar transportadoras:", error);
    setTransportadorasDisponiveis([]);
  }
};
```

**Opção B: Base de dados local**
```typescript
const buscarTransportadoras = (municipio: string) => {
  const transportadorasPorMunicipio = {
    "São Paulo": [
      { id: 1, nome: "Sedex", cobertura: "Nacional" },
      { id: 2, nome: "PAC", cobertura: "Nacional" },
    ],
    "Rio de Janeiro": [
      { id: 1, nome: "Sedex", cobertura: "Nacional" },
      { id: 3, nome: "Loggi", cobertura: "Principais cidades" },
    ],
    // ... mais cidades ...
  };
  
  setTransportadorasDisponiveis(
    transportadorasPorMunicipio[municipio] || []
  );
};
```

---

## 7. CHECKLIST DE RESOLUÇÃO

### Fase 1: Autenticação (BLOQUEADOR)
- [ ] Gerar novo JWT válido no painel MubiSys
- [ ] Confirmar tenant correto (`public-353778-key`)
- [ ] Testar endpoint com curl (manual)
- [ ] Atualizar token no código do formulário
- [ ] Testar busca de OS 6906 no navegador

### Fase 2: Validação
- [ ] Implementar validação de erro JSON
- [ ] Implementar validação de estrutura de resposta
- [ ] Testar com resposta de erro (simular falha)
- [ ] Testar com resposta bem-sucedida

### Fase 3: Transportadoras
- [ ] Escolher fonte de dados (API ou base local)
- [ ] Implementar `buscarTransportadoras()` real
- [ ] Testar exibição de transportadoras por município
- [ ] Validar card verde renderiza corretamente

### Fase 4: Testes End-to-End
- [ ] Teste: Buscar OS válida → Preencher campos
- [ ] Teste: Buscar OS inválida → Exibir erro
- [ ] Teste: Buscar OS → Exibir transportadoras
- [ ] Teste: Múltiplos volumes → Calcular peso total
- [ ] Teste: Criar solicitação com dados preenchidos

---

## 8. RESUMO EXECUTIVO

| Aspecto | Status | Descrição |
|---------|--------|-----------|
| **O que funciona** | ✓ | Interface, validação de entrada, estrutura de componente, renderização de formulário |
| **O que não funciona** | ❌ | Autenticação com API MubiSys, validação de resposta JSON, busca real de transportadoras |
| **Causa raiz** | ⚠️ | Validação inadequada de resposta HTTP (verifica apenas status, não JSON error field) |
| **Impacto** | 🔴 | Nenhum dado é preenchido automaticamente, nenhuma transportadora é exibida |
| **Bloqueador** | 🔴 | Credenciais MubiSys (JWT + tenant) inválidas ou estrutura de endpoint incorreta |
| **Prioridade** | 🔴 | CRÍTICA - Bloqueia funcionalidade principal |
| **Esforço estimado** | ⏱️ | 2-4 horas (incluindo testes e validação) |

---

## 9. CONTATO E PRÓXIMOS PASSOS

**Para resolver este problema:**

1. Fornecer JWT válido e não expirado
2. Confirmar tenant correto
3. Confirmar endpoint exato do MubiSys
4. Fornecer exemplo de resposta bem-sucedida da API
5. Indicar fonte de dados para transportadoras

**Documentação de referência:**
- [API MubiSys Documentation](https://api.mubisys.com/api/documentation)
- [Arquivo de componente](./client/src/pages/logistica/NovaCotacaoDialog.tsx)
- [Projeto no GitHub](https://github.com/radrasys/retrabalho-system-recriado)

---

**Documento gerado em**: 08/08/2026  
**Versão**: 1.0  
**Responsável**: Manus AI Agent
