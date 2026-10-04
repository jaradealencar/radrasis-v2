# CPQ Letreiros Express — cores e materiais antes do nesting

## Objetivo e posição no fluxo

Esta funcionalidade analisa a cor da arte vetorial original depois da vetorização e da validação geométrica, mas antes do nesting. A análise usa o SVG original para preservar os preenchimentos; o SVG monocromático normalizado para corte continua sendo a geometria usada pela factibilidade e pelo nesting.

O fluxo atual do CPQ aceita SVG vetorial e imagens raster (JPG/PNG, que passam pela reconstrução e vetorização). PDF e DXF ainda não são entradas diretas deste navegador: precisam ser convertidos para SVG antes desta etapa. A análise de cor só ocorre quando há escala física confirmada.

## Persistência

As definições ficam em `drizzle/schema.ts`; as migrations `0068_estudio_cores.sql` e `0069_abnormal_avengers.sql` devem ser aplicadas pelos ambientes conforme o procedimento normal de migrations do repositório. Para aplicar migrations já geradas sem criar outra, configure `DATABASE_URL` para o banco alvo e execute `yarn run drizzle-kit migrate` na raiz do projeto. O migrator aplica apenas as migrations pendentes, em ordem do journal; confirme no banco alvo que `0069_abnormal_avengers` foi registrada antes de usar os campos de transmissão da impressão.

| Tabela | Uso |
| --- | --- |
| `estudio_chapas` | Mantém Pantone, CMYK e transmissão de luz opcional junto do cadastro existente de chapa. CMYK é armazenado com dois decimais; todos os quatro canais devem ser preenchidos ou deixados vazios. |
| `estudio_imprimax_adesivos` | Catálogo importado de vinis sólidos, poliméricos, monoméricos e translúcidos: linha, código, nome, acabamento, amostra HEX, Pantone/CMYK, transmissão, preço/m², versão e origem. Código é único. |
| `estudio_precos_impressao` | Custos configuráveis por m² de vinil branco/transparente, impressão e laminação, transmissão de luz informada para as duas bases e indicação de laminação padrão. Nulo significa custo ou propriedade técnica desconhecida e impede emitir a cotação quando a região depende desse processo. |
| `estudio_mapeamento_cores_cotacao` | Snapshot por região e `sourceId`: cor de origem, área, iluminação, material sugerido, ΔE00, custo, alternativas, parâmetros e versão do algoritmo, além de aprovação, autor e data. A chave única é origem + região. |

Os códigos e preços de fornecedores não são inventados pelo sistema. O catálogo da Imprimax deve ser importado por usuário gestor/admin/master e os valores comerciais devem ser mantidos pela empresa. A Imprimax publica catálogos para download, mas não foi localizada uma API pública documentada; por isso a integração entregue é de importação do catálogo validado, e não consulta automática de endpoint externo. Fontes oficiais: [catálogos Imprimax](https://www.imprimax.com.br/catalogos-imprimax), [comunicação visual](https://www.imprimax.com.br/comunicacao-visual), [Max Lux translúcido para backlight](https://www.imprimax.com.br/max-lux).

A migration `0069_abnormal_avengers.sql` acrescenta à tabela de custos a transmissão de luz cadastrada separadamente para o vinil branco e o transparente. Em faces iluminadas, a base de impressão também precisa ter transmissão positiva cadastrada; se houver mínimo de engenharia, o valor deve atendê-lo. Sem esse dado, a impressão fica sem custo aprovável até a ficha técnica ser informada. Atenção operacional: enquanto as duas transmissões não forem cadastradas em Administração > Chapas, projetos iluminados com região impressa não liberam o preço.

## Extração e cálculo cromático

Serviço: `server/services/cpqCoresMateriais.ts`; rotas: `server/routes/estudio-cores.ts`.

1. O servidor percorre preenchimentos SVG (`fill` de caminho/grupo, `style`, hexadecimal, cores CSS básicas, `rgb()` e stops de gradientes). Também lê os metadados explícitos `data-pantone`/`data-pantone-code` e `data-cmyk`. Cada caminho mantém seu índice para cruzamento com a geometria aprovada.
2. O servidor calcula a área visível por caminho na escala confirmada, em mm² e converte para m². Caminhos são tratados na ordem de pintura do SVG: a área coberta por peças pintadas à frente é descontada para não somar sobreposição duas vezes. Caminhos sem área visível não geram linha de material.
3. Cores iguais e tipo de pintura igual são agregados; a tabela de mapeamento guarda a soma de área e os índices de origem. Gradientes guardam as cores dos stops reconhecidos e seguem para impressão digital.
4. HEX é convertido de sRGB D65 para CIELAB. CMYK sem HEX é aproximado para sRGB pela fórmula convencional, sem perfil ICC; a interface registra esse aviso para revisão física. Uma identificação Pantone só é considerada exata quando o código informado coincide com um código Pantone cadastrado. Não há conversor Pantone/licenciado embutido.
5. A comparação usa CIEDE2000 (ΔE00, fatores paramétricos kL=kC=kH=1). O candidato de menor ΔE só pode ser sugerido depois dos filtros de iluminação e de existência de amostra cromática.

Parâmetros de decisão iniciais, centralizados no serviço:

- chapa interna: correspondência direta quando Pantone exato ou ΔE00 ≤ 2;
- Imprimax sólido: sugerir o melhor candidato com ΔE00 ≤ 5;
- acima desse limite, sem candidato de cor ou em gradiente/cor complexa: classificar como adesivo impresso.

Esses limites são critérios para organizar opções, não promessa de identidade visual. A amostra física e a revisão do vendedor/engenharia continuam necessárias. Cores CMYK sem perfil calibrado, substrato, acabamento, lote e iluminação não permitem garantir equivalência por cálculo de tela.

## Iluminação e transmissão

Em projeto sem iluminação, a transmissão não filtra os candidatos. Em projeto iluminado, chapas e vinis sólidos sem transmissão cadastrada ou igual a zero são excluídos. Em frontlight, o usuário pode definir transmissão mínima; quando informada, candidatos precisam atingir esse valor. Sem mínimo, o resultado exige confirmação da engenharia. Backlight exige transmissão mínima e exclui materiais sem dado ou abaixo do mínimo. Na impressão digital, a transmissão cadastrada para a base branca/transparente também precisa atender à condição informada; sem dado, incompatibilidade ou abaixo do mínimo, o custo fica pendente e a emissão é bloqueada. A transmissão fornecida no catálogo é uma triagem, não substitui a validação da face acrílica/ACM e da fonte luminosa.

## Regra de material e preço

```mermaid
flowchart TD
  A[SVG original aprovado + escala física] --> B[Extrair cores e regiões]
  B --> C[Calcular áreas visíveis por caminho e agrupar cores]
  C --> D{Região sólida identificável?}
  D -- Sim --> E{Chapa cadastrada compatível com luz e Pantone/ΔE00 ≤ 2?}
  E -- Sim --> H[Sugerir chapa interna]
  E -- Não --> F{Imprimax compatível com luz e ΔE00 ≤ 5?}
  F -- Sim --> I[Sugerir vinil Imprimax sólido]
  F -- Não --> J[Adesivo impresso]
  D -- Gradiente / complexa / sem match --> J
  J --> K[Área m² × (vinil base + impressão + laminação opcional)]
  H --> L[Revisão humana e aprovação do mapa]
  I --> M{Preço do vinil e área disponíveis?}
  M -- Sim --> N[Área m² × preço/m²]
  M -- Não --> O[Marcar pendência de custo]
  K --> P{Todos os custos cadastrados?}
  P -- Sim --> L
  P -- Não --> O
  N --> L
  O --> Q[Bloquear análise/aprovação de preço e emissão]
  L --> R[Validar composição e executar nesting]
```

Impressão digital é calculada como:

`custo = área_visível_m² × (custo_vinil_base_m² + custo_impressão_m² + custo_laminação_m², se selecionada)`

O custo de vinil sólido é `área_visível_m² × preço_m²` do item de catálogo. Chapa segue a composição e o cálculo de material já existentes no kit/nesting; a sugestão de cor não substitui nem altera silenciosamente uma linha de composição.

Se um componente de preço necessário ou a área estiver ausente, o custo permanece nulo e a emissão é bloqueada. O fluxo não transforma dado ausente em custo zero.

## Consumo físico de bobina

A análise do SVG calcula a área visível e o Bounding Box original de cada contorno
fechado. Contornos agrupados por cor mantêm cada caixa no objeto estruturado de
preço; a sangria configurada é aplicada em cada borda de cada caixa antes de medir o layout.
O padrão é 3 mm por lado.

Em Administração > Chapas, configure a largura total do rolo, a largura útil máxima
de impressão e a sangria. Sem as duas larguras cadastradas, o custo de vinil fica
pendente. O motor verifica o layout com sangria nas orientações original e rotacionada,
escolhendo o menor comprimento linear que caiba na largura útil. O consumo cobrado
é `largura_total_da_bobina_mm × comprimento_linear_mm / 1.000.000`; portanto, inclui
a faixa lateral não aproveitada. Esse consumo é rateado entre as regiões do mesmo
trabalho conforme a área dos retângulos com sangria, e então multiplicado pela soma
dos custos por m² de vinil, impressão e laminação aplicáveis. Se nenhuma orientação
caber, ou faltar geometria/configuração, o custo permanece nulo e a aprovação dos
materiais é bloqueada.

A opção administrativa “Reutilizar retalhos de bobina em outros trabalhos” começa
desativada. Quando a operação confirmar que o retalho pode ser aproveitado, o custo
considera a união dos retângulos com sangria, sem cobrar a faixa residual da bobina.

As migrations `0075_chubby_tenebrous.sql` e `0076_reconciliar_retalho_bobina.sql`
adicionam as larguras, a sangria e a opção de retalho em `estudio_precos_impressao`;
larguras começam sem valor para evitar assumir um formato de rolo que não esteja
cadastrado pela operação.

## Revisão, snapshot e relação com nesting

O vendedor revisa sugestões e confirma o mapa antes da factibilidade/nesting. Reanalisar ou alterar iluminação, base de impressão, laminação ou catálogo invalida a aprovação anterior. As rotas de análise, aprovação, análise de preço e emissão consultam o snapshot persistido no servidor; valores enviados pelo navegador precisam corresponder ao registro aprovado.

As linhas de adesivo/impressão aprovadas entram como custo adicional no snapshot da cotação. Materiais de chapa continuam ligados ao kit/linhas que já alimentam o nesting. A sugestão de uma chapa colorida ou de um vinil não adiciona automaticamente uma matéria-prima ao kit, não redivide o vetor por material e não gera percursos CNC separados por cor. O nesting atual valida a geometria de corte existente; essa automação por material requer uma etapa futura de composição/fabricação que conecte regiões aprovadas a matérias-primas e processos.

## Importação Imprimax e manutenção

Em Administração > Chapas, o cadastro guarda Pantone/CMYK/transmissão das chapas. A seção do catálogo/custos de cor permite importar itens Imprimax em JSON compatível com os campos da API interna e editar os quatro custos por m², a transmissão das bases branca/transparente e a laminação padrão. Use código de catálogo conferido, linha, tipo de vinil e amostra/códigos validados pelo fornecedor. O CPQ registra versão e URL de origem para auditoria; não consulta o fornecedor nem fabrica códigos faltantes.

## Limites conhecidos

- A interpretação de preenchimentos é vetorial e limitada aos recursos SVG cobertos pelo parser; gradientes com stops não reconhecidos ou estilos complexos podem resultar em região complexa/pendência.
- A conversão CMYK→sRGB não usa ICC. Uma cor de foto reconstruída pode não carregar metadados Pantone/CMYK; sem cor vetorial legível, a região precisa de revisão ou impressão.
- SVG é a entrada desta análise. PDF/DXF precisam de conversor que preserve caminhos, preenchimentos e relação com escala antes de habilitar leitura automática.
- O fluxo sugere e precifica processos, mas ainda não associa por si só cada cor às operações separadas nem substitui confirmação de escala, composição e compatibilidade de fabricação.
