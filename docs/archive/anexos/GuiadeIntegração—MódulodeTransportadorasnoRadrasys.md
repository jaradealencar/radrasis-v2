# Guia de Integração — Módulo de Transportadoras no Radrasys

## Visão Geral

Este guia descreve como integrar o módulo de transportadoras coletadas nesta sessão como uma **subaba dentro do Radrasys**. O arquivo `transportadoras_radrasys.json` contém **58 transportadoras** estruturadas e prontas para importação.

---

## Dados do Pacote de Importação

| Campo | Valor |
| :--- | :--- |
| Total de transportadoras | 58 |
| Ativas | 7 (KM, Expresso Queiroz MS, APT Logística + 4 outras) |
| Inativas | 51 (todas as importadas da Frenet) |
| Origem Frenet | 55 transportadoras com tag `[Frenet]` |
| Origem Manual | 3 (KM, Expresso Queiroz MS, APT Logística) |
| Cidades atendidas cadastradas | 176 registros |
| Modais | Rodoviário: 45 · Aéreo: 5 · Ônibus: 8 |

---

## Estrutura do JSON de Importação

Cada transportadora no arquivo `transportadoras_radrasys.json` segue este formato:

```json
{
  "nome": "Nome da Transportadora",
  "modal": "Rodoviario | Aereo | Onibus",
  "ativa": true | false,
  "origem": "Frenet | Manual",
  "site": "https://...",
  "email": "contato@...",
  "telefone": "(67) 0000-0000",
  "endereco": "Rua X, 123",
  "bairro": "Bairro",
  "cep": "79000-000",
  "cidade": "Campo Grande",
  "uf": "MS",
  "cnpj": null,
  "contatoResponsavel": null,
  "observacoes": "...",
  "cidadesAtendidas": [
    { "cidade": "Campo Grande", "uf": "MS" },
    { "cidade": "Dourados", "uf": "MS" }
  ]
}
```

---

## Passo a Passo para Integração no Radrasys

### Passo 1 — Abrir o chat do Radrasys

Acesse a conversa onde o Radrasys foi desenvolvido e envie a seguinte mensagem ao agente, junto com o arquivo `transportadoras_radrasys.json`:

> "Quero adicionar uma subaba chamada **Transportadoras** dentro do Radrasys. Tenho um arquivo JSON com 58 transportadoras prontas para importação. Preciso de: (1) tabela compacta com filtros por modal e status, (2) badge `[Frenet]` nas importadas, (3) indicador de completude por registro, (4) painel de dados incompletos, (5) formulário de edição com cidades atendidas agrupadas por estado."

### Passo 2 — Fornecer o arquivo JSON

Anexe o arquivo `transportadoras_radrasys.json` na mensagem. O agente usará os dados para criar a tabela do banco e popular os registros automaticamente.

### Passo 3 — Definir o schema do banco

O agente precisará criar duas tabelas no banco do Radrasys:

```sql
-- Tabela principal de transportadoras
CREATE TABLE carriers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  modal ENUM('Rodoviario','Aereo','Onibus') NOT NULL DEFAULT 'Rodoviario',
  ativa INT NOT NULL DEFAULT 0,
  site VARCHAR(400),
  email VARCHAR(320),
  telefone VARCHAR(60),
  endereco VARCHAR(400),
  bairro VARCHAR(160),
  cep VARCHAR(20),
  cidade VARCHAR(160),
  uf VARCHAR(2),
  cnpj VARCHAR(24),
  contatoResponsavel VARCHAR(200),
  origem VARCHAR(40) NOT NULL DEFAULT 'Manual',
  observacoes TEXT,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  updatedAt TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE CURRENT_TIMESTAMP
);

-- Tabela de cidades atendidas por transportadora
CREATE TABLE carrierCities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  carrierId INT NOT NULL,
  cidade VARCHAR(160) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  createdAt TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Passo 4 — Importar os dados via script

Peça ao agente para criar um script de seed que leia o JSON e insira todos os registros nas tabelas acima, preservando o campo `origem` e o status `ativa`.

### Passo 5 — Criar a subaba no Radrasys

Peça ao agente para adicionar a rota `/transportadoras` (ou a subaba equivalente dentro da estrutura do Radrasys) com:

- Listagem em tabela densa com colunas: Nome, Modal, Status, Origem, Site, E-mail, Telefone, Endereço, Completude, Ações
- Filtros: modal (Rodoviário / Aéreo / Ônibus), status (Ativa / Inativa), busca por nome
- Badge `[Frenet]` ao lado do nome das transportadoras com `origem === "Frenet"`
- Barra de completude por linha (percentual de campos preenchidos de 9 campos-chave)
- Botão de toggle de status diretamente na listagem
- Formulário de edição em modal com aba de cidades atendidas agrupadas por UF

### Passo 6 — Painel de dados incompletos

Peça ao agente para criar uma subaba ou seção dentro de Transportadoras chamada **"Dados Incompletos"**, que:

- Liste apenas as transportadoras com completude < 100%
- Mostre os campos faltantes de cada registro como badges vermelhos
- Permita edição direta clicando no ícone de lápis

---

## Campos Considerados para Cálculo de Completude

Os 9 campos que determinam o percentual de completude de cada transportadora são:

1. `nome`
2. `site`
3. `email`
4. `telefone`
5. `endereco`
6. `bairro`
7. `cep`
8. `cnpj`
9. `contatoResponsavel`

---

## Observações Importantes

- Todas as transportadoras com `origem: "Frenet"` devem exibir o badge `[Frenet]` na interface.
- O status padrão das transportadoras da Frenet é **inativo** (`ativa: false`).
- As três transportadoras manuais (KM, Expresso Queiroz MS, APT Logística) já entram como **ativas** (`ativa: true`).
- As cidades atendidas ficam em tabela separada (`carrierCities`) vinculadas por `carrierId`.

---

# Dados Detalhados: Expresso Queiroz MS

**Status:** Ativa | **Modal:** Rodoviário | **Origem:** Manual

**Cobertura:** Todos os CEPs do Mato Grosso do Sul (75 cidades cadastradas)

**Agências de coleta:**
- Campo Grande
- Dourados
- Nova Alvorada do Sul
- Rio Brilhante
- Sidrolândia
- Maracaju
- Ponta Porã
- Amambai / Coronel Sapucaia / Paranhos
- Juti
- Caarapó
- Aquidauana / Anastácio / Dois Irmãos do Buriti
- Jardim / Guia Lopes da Laguna
- Bela Vista
- Naviraí
- Nova Andradina / Ivinhema / Angélica / Taquarussu / Anaurilândia / Bataiporã

**Cidades atendidas (75 municípios do MS):**
Água Clara, Alcinópolis, Amambai, Anastácio, Anaurilândia, Angélica, Aparecida do Taboado, Aquidauana, Aral Moreira, Bandeirantes, Bataguassu, Batayporã, Bela Vista, Bodoquena, Bonito, Brasilândia, Caarapó, Camapuã, Campo Grande, Caracol, Cassilândia, Chapadão do Sul, Corguinho, Coronel Sapucaia, Corumbá, Costa Rica, Coxim, Deodápolis, Dois Irmãos do Buriti, Douradina, Dourados, Eldorado, Fátima do Sul, Figueirão, Glória de Dourados, Guia Lopes da Laguna, Iguatemi, Inocência, Itaporã, Itaquiraí, Ivinhema, Jaraguari, Jardim, Jateí, Juti, Ladário, Laguna Carapã, Maracaju, Miranda, Mundo Novo, Naviraí, Nioaque, Nova Alvorada do Sul, Nova Andradina, Novo Horizonte do Sul, Paranaíba, Paranhos, Pedro Gomes, Ponta Porã, Porto Murtinho, Ribas do Rio Pardo, Rio Brilhante, Rio Negro, Rio Verde de MT, Rochedo, Santa Rita do Pardo, São Gabriel do Oeste, Selvíria, Sidrolândia, Sonora, Tacuru, Taquarussu, Terenos, Três Lagoas, Vicentina

---

# Dados Detalhados: APT Logística

**Status:** Ativa | **Modal:** Rodoviário | **Origem:** Manual

**Filial Principal — Campo Grande/MS**
- Telefone: (67) 3043-8500
- WhatsApp: (67) 4042-0833
- Endereço: Rua Elvira Matos de Oliveira, 187
- Bairro: Universitário
- CEP: 79071-204
- Cidade/UF: Campo Grande/MS

**Filial — Dourados/MS**
- Telefone: (67) 3424-3681
- Endereço: R. Epifânio Ribeiro da Silva, 1011
- Bairro: Vila São Francisco
- CEP: 79833-000

**Filial — Três Lagoas/MS**
- Telefone: (67) 3521-3860
- Endereço: Av. Ranulpho Marques Leal, 780
- Bairro: Jardim Alvorada
- CEP: 79610-100

**Cidades atendidas (45 municípios do MS):**
Água Clara, Alcinópolis, Amambai, Aparecida do Taboado, Aral Moreira, Bandeirantes, Bonito, Caarapó, Campo Grande, Corguinho, Coronel Sapucaia, Coxim, Deodápolis, Douradina, Dourados, Eldorado, Fátima do Sul, Figueirão, Glória de Dourados, Guia Lopes da Laguna, Iguatemi, Inocência, Itaporã, Itaquiraí, Jaraguari, Jardim, Jateí, Juti, Laguna Carapã, Maracaju, Mundo Novo, Naviraí, Paranhos, Paranaíba, Ribas do Rio Pardo, Rio Brilhante, Rio Negro, Rio Verde de MT, Rochedo, São Gabriel do Oeste, Sete Quedas, Sidrolândia, Tacuru, Três Lagoas, Vicentina

**Cidades atendidas em dias alternados (marcadas com * no flyer):**
Alcinópolis, Aral Moreira, Corguinho, Coronel Sapucaia, Douradina, Figueirão, Guia Lopes da Laguna, Itaporã, Paranhos, Rio Negro, Rochedo, Sete Quedas, Tacuru
