/**
 * Regras sugeridas para o leitor de imagem do CPQ (Administração > Configurações). Valem enquanto o administrador não
 * salvar um texto próprio; quem apagar o campo e salvar fica sem regras (usa só a recomendação padrão do sistema).
 */
export const REGRAS_LEITURA_ARTE_PADRAO = `- Uma logo nunca tem mais de 6 cores chapadas. Se a arte não tiver foto nem degradê, use limite de 6 cores no Vectorizer (ou o número de cores chapadas que você contou mais 1, se for menor que 6).
- Se houver foto ou degradê, use limite de 32 cores, para a parte fotográfica continuar sendo reconhecida como área de adesivo.
- Não conte sombras, brilhos nem bordas suavizadas como cores.
- Se houver letras ou detalhes muito finos, use área mínima de 1 pixel para não perder nada.
- Se as curvas parecerem ter pontos demais, use tolerância de 0,2.
- Em "areasAdesivo", liste toda área que provavelmente terá de receber adesivo impresso: fotos, degradês, imagens dentro de círculos ou molduras e regiões com muitos tons pequenos. Diga onde ficam na arte e por que precisam de adesivo.`;
