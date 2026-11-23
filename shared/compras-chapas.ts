export function medidasChapaMm(descricao: string) {
  const m = descricao.match(
    /(\d{3,5}(?:[.,]\d+)?)\s*[x×]\s*(\d{3,5}(?:[.,]\d+)?)\s*[x×]\s*(\d{1,2}(?:[.,]\d+)?)\s*mm\b/i
  );
  if (!m) return null;
  const largura = Number(m[1].replace(",", ".")),
    comprimento = Number(m[2].replace(",", "."));
  return {
    largura,
    comprimento,
    area: Number(((largura * comprimento) / 1e6).toFixed(8)),
  };
}
export function precoChapaM2(preco: number, area: number | null) {
  return area != null &&
    Number.isFinite(area) &&
    area > 0 &&
    Number.isFinite(preco)
    ? preco / area
    : null;
}
