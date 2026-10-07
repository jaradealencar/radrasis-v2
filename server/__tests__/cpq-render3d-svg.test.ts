import { describe, expect, it } from "vitest";
import { inspecionarSvgRender3d, RENDER3D_SVG_MAX_BYTES, RENDER3D_SVG_MAX_PATHS } from "../../shared/cpq-render3d-svg";

const P = `<path d="M0 0 L10 0 L10 10 Z"/>`;
const svg = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${corpo}</svg>`;

describe("inspeção de segurança do SVG do 3D", () => {
  it("aceita o SVG limpo, o do Vectorizer (DOCTYPE externo simples, gradiente por url(#id)) e conta só os paths fora de <defs>", () => {
    expect(inspecionarSvgRender3d(svg(P)).ok).toBe(true);
    const vectorizer = `<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">`
      + svg(`<defs><linearGradient id="g"/><path d="M1 1"/></defs>${P.replace("/>", ' fill="url(#g)"/>')}${P}`);
    const r = inspecionarSvgRender3d(vectorizer);
    expect(r.ok).toBe(true);
    expect(r.pathCount).toBe(2); // o path de dentro do <defs> não conta (numeração dos pathIndexes)
  });

  it.each([
    ["script", svg(`${P}<script>alert(1)</script>`)],
    ["SCRIPT em maiúsculas", svg(`${P}<SCRIPT>alert(1)</SCRIPT>`)],
    ["foreignObject", svg(`<foreignObject><div/></foreignObject>${P}`)],
    ["onload com espaço", `<svg onload="alert(1)">${P}</svg>`],
    ["onload com quebra de linha", `<svg\nonload="alert(1)">${P}</svg>`],
    ["onload com barra (<svg/onload=…>)", `<svg/onload=alert(1)>${P}</svg>`],
    ["onload com atributos colados", `<svg xmlns="http://www.w3.org/2000/svg"onload="alert(1)">${P}</svg>`],
    ["animate", svg(`${P.replace("/>", '><animate attributeName="d" to="M1 1"/></path>')}`)],
    ["animateTransform", svg(`${P.replace("/>", '><animateTransform attributeName="transform" type="rotate" to="360"/></path>')}`)],
    ["animateMotion", svg(`${P.replace("/>", '><animateMotion dur="1s" path="M0,0 L9,9"/></path>')}`)],
    ["href externo", svg(`<a href="https://evil.example">${P}</a>`)],
    ["xlink:href javascript:", svg(`<a xlink:href="javascript:alert(1)">${P}</a>`)],
    ["url() externo", svg(P.replace("/>", ' fill="url(https://evil.example/x)"/>'))],
    ["use", svg(`<use href="#a"/>${P}`)],
    ["image embutida", svg(`<image href="data:image/png;base64,AAAA"/>${P}`)],
    ["style", svg(`<style>@import 'https://evil.example'</style>${P}`)],
    ["entidade XML", `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY a "aaaa">]>${svg(P)}`],
  ])("recusa: %s", (_nome, entrada) => {
    expect(inspecionarSvgRender3d(entrada).ok).toBe(false);
  });

  it("recusa SVG sem path, não-SVG, vazio e acima dos limites de caminhos e de tamanho", () => {
    expect(inspecionarSvgRender3d(svg("")).ok).toBe(false);
    expect(inspecionarSvgRender3d("<html></html>").ok).toBe(false);
    expect(inspecionarSvgRender3d("   ").ok).toBe(false);
    expect(inspecionarSvgRender3d(42).ok).toBe(false);
    expect(inspecionarSvgRender3d(svg(P.repeat(RENDER3D_SVG_MAX_PATHS + 1))).ok).toBe(false);
    const grande = inspecionarSvgRender3d(svg(P + " ".repeat(RENDER3D_SVG_MAX_BYTES)));
    expect(grande.ok).toBe(false);
    expect(grande.motivos[0]).toMatch(/passa de/);
  });

  // Achado do teste real (07/10/2026): a regex preguiçosa de <defs> era quadrática; 0,72 MB de "<defs>" sem fechar levavam ~15 s de CPU.
  it("não trava com entrada maliciosa: <defs> sem fechamento e SVG acima do teto respondem em milissegundos", () => {
    const casos = [
      svg("<defs>".repeat(200_000) + P),            // ~1,2 MB, abaixo do teto: tem de ser linear
      svg("<defs>".repeat(500_000) + P),            // ~3 MB, acima do teto: nem chega a rodar as regex
      svg(`<defs>${"<defs>".repeat(150_000)}</defs>${P}`), // um fechamento só no fim
      svg("< ".repeat(300_000) + P),                // muitos "<" seguidos de espaço
    ];
    for (const entrada of casos) {
      const inicio = performance.now();
      inspecionarSvgRender3d(entrada);
      expect(performance.now() - inicio).toBeLessThan(1000);
    }
  });

  it("<defs> sem fechamento não remove nada (mesma contagem de paths de antes)", () => {
    expect(inspecionarSvgRender3d(svg(`<defs>${P}${P}`)).pathCount).toBe(2);
    expect(inspecionarSvgRender3d(svg(`<defs>${P}</defs>${P}<defs>${P}</defs>${P}`)).pathCount).toBe(2);
  });
});
