# Prompt 3 — Área líquida, perímetro e prancha técnica

> Transcrição de `Prompt 3 Área líquida, perímetro e pracha técnica.pdf`, fornecido pelo usuário. As medidas e a prancha são geradas por lógica determinística no CPQ Letreiros Express; o texto completo não é enviado ao modelo a cada orçamento.

PROMPT 3 — CÁLCULO DE ÁREA
LÍQUIDA, PERÍMETRO E PRANCHA
TÉCNICA
1. PAPEL E OBJETIVO
Atue como especialista em geometria vetorial, cálculo de áreas, perímetros, fabricação
CNC, corte a laser, router e comunicação visual.
Analise o arquivo SVG fornecido e calcule suas dimensões reais, área líquida e perímetros.
Além dos cálculos, gere uma imagem PNG técnica mostrando:
● a logomarca completa;
● a largura final;
● a altura final proporcional;
● linhas de cota;
● réguas técnicas;
● área líquida;
● perímetro externo;
● perímetro dos vazados;
● comprimento total de corte.
Não altere, redesenhe ou distorça a geometria do SVG.

2. ARQUIVO OBRIGATÓRIO
Utilize como referência principal o arquivo SVG vetorial final anexado.
O SVG deve possuir:
● caminhos vetoriais reais;
● textos convertidos em curvas;
● fundo transparente;
● formas fechadas;
● ausência de bitmap incorporado;
● ausência de elementos
<image>
;
●
viewBox
 correto.

Se for fornecida somente uma imagem PNG ou JPG, informe que não é possível obter área
e perímetro técnicos com precisão e solicite o SVG.

3. MEDIDA REAL CONHECIDA
Preencha somente uma das opções:
OPÇÃO A — LARGURA OU COMPRIMENTO
CONHECIDO
Largura/comprimento total da arte: __________________
Unidade:
[ ] mm
[ ] cm
[ ] m
A altura deverá ser calculada proporcionalmente.
OPÇÃO B — ALTURA CONHECIDA
Altura total da arte: __________________
Unidade:
[ ] mm
[ ] cm
[ ] m
A largura deverá ser calculada proporcionalmente.
Utilize somente uma opção.

4. REFERÊNCIA DA MEDIDA
A medida informada corresponde a:
[ ] Arte completa, considerando todos os elementos
[ ] Somente a palavra ou nome principal

[ ] Somente o símbolo
[ ] Painel ou placa de fundo
[ ] Outro elemento: ______________________________
Descrição dos pontos entre os quais a medida foi tomada:

Se esse campo não for preenchido, considere que a medida corresponde aos pontos
extremos da arte vetorial, sem incluir margens vazias da página SVG.

5. REGRAS DE ESCALA
1. Identifique os limites reais da geometria vetorial.
2. Ignore margens vazias do
viewBox
.
3. Não utilize o tamanho da página SVG como tamanho da arte.
4. Encontre os pontos mais extremos da geometria.
5. Calcule o fator de escala com base na medida informada.
6. Aplique o mesmo fator de escala nos eixos horizontal e vertical.
7. Não distorça a arte para atingir duas medidas incompatíveis.
8. Se a largura for informada, calcule a altura proporcional.
9. Se a altura for informada, calcule a largura proporcional.
10. Informe qualquer divergência encontrada.

6. TRATAMENTO DOS CONTORNOS
O contorno preto utilizado apenas para visualização deve ser:
[ ] Ignorado no cálculo físico — opção recomendada
[ ] Considerado parte da peça
Se nenhuma opção for marcada, ignore o contorno visual e utilize somente a geometria
preenchida original.
Não calcule área com base na espessura de um
stroke
 decorativo, salvo quando for
explicitamente informado que esse contorno será produzido fisicamente.

7. CÁLCULOS OBRIGATÓRIOS
Calcule e apresente:
7.1 DIMENSÕES FINAIS EM METROS
● largura total;
● altura total proporcional;
● proporção entre largura e altura;
● fator de escala aplicado.
7.2 ÁREA LÍQUIDA EM METROS
Calcule a área ocupada pelo material, descontando:
[x] vazados internos;
[ ] contraformas das letras;
[ ] furos;
[ ] recortes;
[ ] espaços internos dos símbolos.
Não desconte os espaços existentes entre peças separadas, pois eles já não pertencem à
geometria preenchida.
Não conte duas vezes regiões sobrepostas.
Apresente a área líquida em:
[ ] mm²;
[ ] cm²;
[x] m².
7.3 PERÍMETRO EXTERNO
Calcule a soma de todos os contornos externos das peças.
7.4 PERÍMETRO INTERNO
Calcule separadamente a soma dos contornos internos:

[x] vazados das letras;
[ ] furos;
[ ] contraformas;
[ ] recortes internos;
[ ] vazados do símbolo.
7.5 COMPRIMENTO TOTAL DE CORTE
Calcule:
COMPRIMENTO TOTAL DE CORTE
= PERÍMETROS EXTERNOS
● PERÍMETROS INTERNOS.
Apresente o resultado em:
[ ] mm;
[ ] cm;
[x] metros lineares.
7.6 RESULTADO POR ELEMENTO
Quando o SVG possuir grupos ou camadas identificáveis, apresente separadamente:
[ ]área líquida do nome;
[ ] área líquida do símbolo;
[ ] área líquida de elementos complementares;
[ ] comprimento de corte de cada grupo;
[x] total geral.

8. REGRAS PARA SOBREPOSIÇÕES
Modo de cálculo:

[ ] Considerar elementos unidos como uma única peça
[ ] Considerar cada elemento como uma peça separada
[x] Respeitar exatamente a estrutura e os grupos do SVG
Se nenhuma opção for selecionada, respeite a geometria final visível e não conte áreas
sobrepostas duas vezes.
Informe qual método foi utilizado.

9. PRANCHA TÉCNICA EM PNG
Gere obrigatoriamente um arquivo PNG em alta resolução contendo a logomarca e os
resultados.
9.1 COMPOSIÇÃO
A prancha deve apresentar:
● fundo branco ou cinza muito claro;
● logomarca centralizada;
● proporção original preservada;
● nenhuma parte cortada;
● margens suficientes para as cotas;
● aparência limpa e profissional.
9.2 COTAS E RÉGUAS
Mostrar:
● linha de cota horizontal;
● setas indicando os extremos da largura;
● valor final da largura;
● linha de cota vertical;
● setas indicando os extremos da altura;
● valor final da altura proporcional;
● unidade de medida;
● réguas técnicas horizontal e vertical com divisões coerentes.
As linhas de cota e as réguas não podem sobrepor ou esconder a logomarca.
9.3 QUADRO DE INFORMAÇÕES
Incluir dentro da imagem um quadro técnico contendo:

DIMENSÕES FINAIS
● Largura: __________
● Altura proporcional: __________
GEOMETRIA
● Área líquida total: __________
● Perímetro externo: __________
● Perímetro dos vazados: __________
● Comprimento total de corte: __________
OBSERVAÇÃO
● Fundo transparente no SVG;
● Medidas calculadas a partir da geometria vetorial;
● Contorno visual incluído ou ignorado: __________.
9.4 QUALIDADE DO PNG
O PNG deve possuir:
● largura mínima de 2400 pixels;
● textos perfeitamente legíveis;
● linhas de cota nítidas;
● números com unidades;
● boa separação visual;
● nenhuma perspectiva;
● nenhum efeito 3D;
● nenhuma textura;
● nenhuma sombra decorativa;
● nenhuma informação inventada.

10. VERIFICAÇÃO OBRIGATÓRIA
Antes de entregar:
1. Confirme que a escala foi aplicada uniformemente.
2. Confirme que a proporção original foi preservada.
3. Confirme que as margens vazias do SVG não foram medidas.
4. Confirme que os vazados foram descontados da área.
5. Confirme que os vazados foram acrescentados ao comprimento de corte.
6. Confirme que áreas sobrepostas não foram contadas duas vezes.
7. Confirme que o contorno visual recebeu o tratamento selecionado.
8. Confirme que os valores mostrados no PNG são iguais aos valores do relatório.

9. Confirme que a largura e a altura do PNG correspondem aos limites reais da arte.
10. Informe se o cálculo é exato para o vetor ou aproximado devido à referência.

11. FORMATO DA ENTREGA
Entregar nesta ordem:
1. RESUMO DAS PREMISSAS
Informar:
● medida conhecida utilizada;
● elemento ao qual a medida corresponde;
● fator de escala;
● tratamento do contorno;
● tratamento das sobreposições.
2. TABELA DE RESULTADOS
Apresentar:
Informação Resultad
o
Largura final
Altura proporcional
Área líquida total
Perímetro externo
Perímetro interno/vazados
Comprimento total de corte
3. RESULTADOS POR GRUPO
Apresentar área e comprimento de corte separados para nome, símbolo e demais grupos,
quando existirem.
4. PRANCHA TÉCNICA PNG

Entregar o PNG com:
● logomarca;
● réguas;
● cotas;
● dimensões;
● área líquida;
● perímetros;
● comprimento total de corte.
5. OBSERVAÇÃO TÉCNICA
Informar que os valores geométricos não incluem automaticamente:
● compensação de corte;
● kerf do laser;
● diâmetro da ferramenta;
● offset;
● margem de segurança;
● pontes de sustentação;
● aproveitamento da chapa;
● desperdício de material.
Esses valores deverão ser calculados separadamente quando forem fornecidos processo,
material, ferramenta e espessura.

12. COMANDO FINAL
Analise o SVG anexado.
Use a medida real informada para aplicar escala proporcional.
Não utilize as margens vazias da página SVG.
Não distorça a logomarca.
Calcule a largura e a altura finais.
Calcule a área líquida descontando todos os vazados.
Calcule separadamente os perímetros externos e internos.
Calcule o comprimento total de corte.
Gere uma prancha técnica em PNG mostrando a logomarca, as réguas, as cotas e todos os
resultados principais.

Não invente medidas.
Não apresente estimativas como valores exatos.
Os números mostrados no PNG devem coincidir exatamente com o relatório.
