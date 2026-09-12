# Qualificação de Leads B2B por CNPJ

Especificação e implementação do módulo que recebe o JSON de uma consulta de
CNPJ e gera a qualificação/perfil de um lead B2B — gráficas, agências de
comunicação visual, birôs de impressão e empresas de sinalização que possam
terceirizar a fabricação de letras/letreiros/fachadas com a empresa.

**Escopo desta entrega**: especificação completa + função determinística de
score em código (`server/services/qualificacaoLeadCnpj.ts`) + integração real
com a fonte de dados (API gratuita de CNPJ) + endpoint e tela de consulta.
**Não incluído nesta entrega**: acionar IA automaticamente a cada consulta —
o prompt de sistema abaixo fica pronto e versionado, mas não é chamado pelo
código; ativar isso é decisão de custo/uso de LLM a confirmar com o usuário.

## 1. Fonte de dados: OpenCNPJ

`GET https://api.opencnpj.org/{cnpj}` — CNPJ sem máscara (14 dígitos), sem
chave de autenticação. Testado nesta sessão (CNPJ 00000000000191, Banco do
Brasil) — campos confirmados na resposta real:

```
cnpj, razao_social, nome_fantasia, situacao_cadastral, data_situacao_cadastral,
data_inicio_atividade, cnae_principal, cnaes_secundarios[], cnaes[] (codigo,
descricao, is_principal), natureza_juridica, logradouro, numero, bairro, cep,
uf, municipio, capital_social (string com vírgula decimal, ex "120000000000,00"),
porte_empresa ("ME" | "EPP" | "Demais"), QSA[] (nome_socio, qualificacao_socio,
data_entrada_sociedade, cnpj_cpf_socio mascarado, faixa_etaria)
```

**Atenção ao formato dos CNAEs**: a API devolve os códigos **sem hífen/barra**
(`"3299003"`, não `"3299-0/03"`). Qualquer comparação com a lista-alvo abaixo
precisa normalizar para o mesmo formato (string de 7 dígitos) antes de
comparar — implementado em `normalizarCodigoCnae()`.

Limitações conhecidas da fonte (não verificadas nesta sessão, documentar se
confirmadas em uso real): rate limit não documentado publicamente; CNPJ
inexistente provavelmente retorna 404; sem SLA formal por ser um projeto
gratuito/comunitário.

## 2. Regras de filtro e CNAEs-alvo

CNAEs confirmados via busca nesta sessão contra fontes oficiais (IBGE/Concla)
e fontes contábeis — ver seção "Fontes" ao final. Classificados por nível de
confiança: **alto** (atividade principal do fabricante/instalador terceirizado
que o negócio busca) e **médio** (adjacente — precisa checar o CNAE secundário
e o contexto antes de tratar como ICP forte).

| CNAE | Descrição | Confiança | Por quê |
| --- | --- | --- | --- |
| 3299-0/03 | Fabricação de letras, letreiros e placas de qualquer material, exceto luminosos | Alta | Atividade quase idêntica à do próprio negócio — empresas assim frequentemente terceirizam parte da produção para dar conta de volume |
| 3299-0/04 | Fabricação de painéis e letreiros luminosos | Alta | Mesmo raciocínio, para letreiros luminosos |
| 4329-1/01 | Instalação de painéis publicitários | Alta | **Instala mas não fabrica** — candidato natural a terceirizar a fabricação para focar em instalação |
| 1813-0/01 | Impressão de material para uso publicitário | Média | Gráfica que atende comunicação visual, pode expandir para letreiro/fachada |
| 1813-0/99 | Impressão de material para outros usos | Média | Gráfica genérica — confirmar atuação em comunicação visual antes de priorizar |
| 7410-2/02 | Design publicitário e gráfico | Média | Agências que projetam mas não fabricam |
| 7311-4/00 | Agências de publicidade | Média | Pode intermediar projetos de sinalização para clientes finais |
| 7319-0/99 | Outras atividades de publicidade não especificadas | Média | Genérico demais sozinho — só priorizar se o CNAE secundário reforçar o encaixe |

**Excluído deliberadamente**: 7312-2/00 (agenciamento de espaços para
publicidade — mídia/OOH, compra e revende espaço, não fabrica nem instala;
comprador errado para este negócio).

Esta lista deve ser revisada por alguém do time comercial antes de uso em
escala — é um ponto de partida verificado contra fonte oficial, não uma
certeza de mercado.

### Regra de rejeição automática

Um CNPJ é rejeitado automaticamente (não recebe score) quando:

1. `situacao_cadastral` é diferente de `"Ativa"` (empresa baixada, suspensa,
   inapta etc. não é lead válido); ou
2. Nenhum CNAE (principal ou secundário) bate com a lista-alvo acima (nem
   confiança alta, nem média).

## 3. Matriz de score de aderência (A/B/C/D)

Heurística de priorização, **não uma probabilidade calibrada de compra** —
mesmo princípio de honestidade usado no resto do sistema (ver
`docs/inteligencia-clientes.md`). Composta por três fatores com pesos
explícitos, pensados a partir do raciocínio de negócio combinado com o
usuário: porte e capital social indicam capacidade de gerar volume
recorrente; idade da empresa indica maturidade operacional (empresa muito
nova pode não ter volume ainda, mas não é motivo de rejeição — só de nota
menor). Nenhum peso aqui foi calibrado estatisticamente contra vendas
reais — são pontos de partida a validar com a experiência do time comercial.

| Fator | Peso | Regra |
| --- | --- | --- |
| Porte | 40% | `Demais` → 100 · `EPP` → 80 · `ME` → 40 |
| Capital social | 35% | ≥ R$ 500 mil → 100 · ≥ R$ 100 mil → 70 · ≥ R$ 20 mil → 40 · abaixo disso → 15 |
| Idade da empresa | 25% | ≥ 3 anos → 100 · 1–3 anos → 60 · < 1 ano → 30 (empresa nova não é rejeitada, só pontua menos — pode não ter volume ainda) |

Pontuação final = soma ponderada (0–100), convertida em letra:

- **A** (≥ 75): forte aderência — priorizar contato.
- **B** (55–74): aderência boa — vale contato, sem urgência.
- **C** (35–54): aderência fraca — qualificar mais antes de investir tempo.
- **D** (< 35): baixa aderência — provavelmente não vale o esforço agora.

O CNAE de confiança **média** (não alta) reduz automaticamente uma letra do
resultado calculado pelos três fatores acima (ex.: um score que daria "A"
vira "B") — reconhece que o encaixe é menos certo mesmo com bom porte/capital.

## 4. Prompt de sistema (IA embutida — pronto, não acionado nesta entrega)

Versão: `v1`. Para uso futuro via `server/_core/llm.ts` (OpenAI — LLM
principal do produto, ver AGENTS.md) ou `server/integrations/anthropic-client.ts`
(Anthropic, já usado para o chat do Painel Financeiro) — qualquer um dos dois
já está integrado ao projeto; a escolha entre eles é decisão do usuário, não
técnica. Entrada: o JSON já aprovado pela regra de rejeição
automática, mais o resultado do scorer determinístico (nunca o JSON bruto
sozinho — o modelo não deve recalcular o que o código já calculou).

```
Você é um analista de qualificação de leads B2B para uma fábrica de letras
metálicas, letras-caixa, letreiros luminosos e fachadas comerciais que vende
exclusivamente por terceirização — para gráficas, agências de comunicação
visual, birôs de impressão e empresas de sinalização, nunca para o cliente
final.

Você recebe: os dados cadastrais de uma empresa já aprovada pela regra de
filtro (situação ativa, CNAE compatível) e o score determinístico (A/B/C/D)
já calculado pelo sistema, com os fatores que o compuseram. Não recalcule o
score nem invente dados que não estejam no JSON fornecido.

Produza três seções, curtas e diretas:

1. "Potencial do lead": com base em porte, capital social, idade da empresa
   e o(s) CNAE(s) que bateram na lista-alvo, estime se a empresa
   provavelmente compra letreiro em volume alto, médio ou baixo — e diga
   explicitamente que é uma estimativa por porte cadastral, não um dado de
   compra real (o sistema não tem acesso ao volume de compras dessa empresa).

2. "Argumento de venda B2B": aponte a dor de terceirização mais provável
   para o perfil dessa empresa (ex.: uma empresa de instalação de painéis
   sem CNAE de fabricação provavelmente terceiriza 100% da produção; uma
   agência de design provavelmente não tem estrutura fabril nenhuma; uma
   gráfica com CNAE de impressão publicitária pode estar tentando expandir
   para letreiro sem ter maquinário). Formule como uma pergunta ou abertura
   de conversa, nunca como afirmação de fato sobre a empresa específica.

3. "Quem abordar": olhando o QSA, identifique o(s) sócio(s) com
   qualificação mais provável de decidir sobre fornecedores (ex.:
   "Administrador", "Sócio-Administrador", "Diretor") — se houver mais de
   um nome plausível, liste todos sem apontar um único "responsável"
   fabricado. Se o QSA não tiver ninguém com qualificação decisória clara,
   diga isso e sugira abordar pelo contato institucional da empresa.

Nunca prometa condições comerciais, nunca afirme que a empresa "com certeza"
compra ou vai comprar, e nunca trate o score de aderência como uma garantia.
Separe sempre fato cadastral (o que está no JSON) de hipótese comercial (o
que você está inferindo). Responda em português do Brasil.
```

## 5. Arquitetura implementada

- `server/integrations/opencnpj-client.ts` — cliente HTTP (fetch nativo, sem
  chave), normaliza o CNPJ de entrada (remove pontuação) antes de chamar,
  trata 404 (CNPJ não encontrado) e erro de rede.
- `server/services/qualificacaoLeadCnpj.ts` — função pura
  `qualificarLeadCnpj(json)`, implementa a regra de rejeição e a matriz de
  score acima. Sem chamada de rede, sem chamada de IA — determinístico e
  testável isoladamente.
- `drizzle/schema.ts` — tabela `leads_cnpj_qualificados` (cnpj único, dados
  cadastrais relevantes, score, JSON bruto para auditoria, quem consultou e
  quando).
- `server/routers/leadsCnpj.ts` — `consultar({cnpj})` (mutation: chama a
  API, roda o scorer, grava/atualiza o lead) e `listar({score?, uf?})`
  (query: histórico de leads já consultados).
- `client/src/pages/comercial/QualificacaoLeadsCnpj.tsx` — tela de consulta
  (campo de CNPJ, ficha do resultado, CNAEs destacados, score, QSA). Rota
  `/comercial/leads-cnpj`, item de menu em "Comercial".

## 6. Fontes consultadas (CNAEs)

- IBGE/Concla — busca online CNAE (concla.ibge.gov.br/busca-online-cnae.html)
- Contabilizei, Contabilivre, Senhor Contábil, Meu Contador Online — consultas
  de CNAE (fontes secundárias, usadas para confirmar a descrição oficial e a
  exclusão declarada entre subclasses vizinhas, ex. 3299-0/03 vs 3299-0/04)

Esta lista de CNAEs e a matriz de score devem ser revistas por alguém do
time comercial com conhecimento direto do mercado antes de uso em produção
para prospecção em escala — foram verificadas contra fonte oficial nesta
sessão, mas não validadas contra resultado real de vendas.
