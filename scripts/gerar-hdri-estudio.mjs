/**
 * Gera o HDRI de estúdio usado pelo 3D do CPQ (client/public/render3d/environments/studio-1k.hdr).
 *
 * É um ambiente procedural nosso (equirretangular 1024×512, Radiance RGBE com RLE): fundo cinza neutro suave, três softboxes
 * (principal quente à frente, preenchimento frio à esquerda e faixa superior) e uma luz de recorte atrás. Não deriva de nenhum
 * HDRI de terceiros, então não há licença a respeitar. Serve para os metais terem o que refletir; não é uma medição de luz real.
 *
 * Uso: node scripts/gerar-hdri-estudio.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const LARGURA = 1024;
const ALTURA = 512;
const SAIDA = resolve(import.meta.dirname, "..", "client", "public", "render3d", "environments", "studio-1k.hdr");

const suave = (x, a, b) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Retângulo angular suave: 1 dentro, 0 fora, borda de `borda` radianos. */
function caixaSuave(phi, lat, centroPhi, centroLat, meioPhi, meioLat, borda) {
  let dphi = phi - centroPhi;
  while (dphi > Math.PI) dphi -= 2 * Math.PI;
  while (dphi < -Math.PI) dphi += 2 * Math.PI;
  const dentroPhi = 1 - suave(Math.abs(dphi), meioPhi, meioPhi + borda);
  const dentroLat = 1 - suave(Math.abs(lat - centroLat), meioLat, meioLat + borda);
  return dentroPhi * dentroLat;
}

// Convenção do Three para equirretangular: u = atan2(dir.z, dir.x) / 2π + 0.5 ; +Z (rumo ao observador) = phi π/2.
const FRENTE = Math.PI / 2;

function radiancia(phi, lat) {
  // Base neutra: teto um pouco mais claro que o chão.
  const base = lat >= 0 ? 0.32 + 0.38 * Math.sin(lat) : 0.1 + 0.1 * (1 + Math.sin(lat));
  let r = base, g = base, b = base * 1.02;
  const soma = (peso, cor) => { r += peso * cor[0]; g += peso * cor[1]; b += peso * cor[2]; };
  soma(caixaSuave(phi, lat, FRENTE - 0.75, 0.62, 0.42, 0.3, 0.22) * 16, [1.0, 0.96, 0.9]); // principal (quente), alto à direita da frente
  soma(caixaSuave(phi, lat, FRENTE + 1.15, 0.18, 0.3, 0.38, 0.25) * 5, [0.9, 0.95, 1.0]); // preenchimento frio, à esquerda
  soma(caixaSuave(phi, lat, FRENTE, 1.2, 0.9, 0.12, 0.2) * 9, [1, 1, 1]); // faixa superior
  soma(caixaSuave(phi, lat, FRENTE + Math.PI, 0.35, 0.5, 0.3, 0.25) * 6, [0.95, 0.98, 1.0]); // recorte atrás
  return [r, g, b];
}

function paraRgbe([r, g, b]) {
  const maior = Math.max(r, g, b);
  if (maior < 1e-32) return [0, 0, 0, 0];
  const expoente = Math.ceil(Math.log2(maior + 1e-12));
  const escala = 256 / 2 ** expoente;
  return [Math.min(255, Math.round(r * escala)), Math.min(255, Math.round(g * escala)), Math.min(255, Math.round(b * escala)), expoente + 128];
}

/** RLE "novo" do Radiance para um canal de uma linha: corridas (≥4 iguais) e blocos literais. */
function codificarCanal(valores) {
  const saida = [];
  let i = 0;
  while (i < valores.length) {
    let corrida = 1;
    while (i + corrida < valores.length && corrida < 127 && valores[i + corrida] === valores[i]) corrida += 1;
    if (corrida >= 4) { saida.push(128 + corrida, valores[i]); i += corrida; continue; }
    let literal = 0;
    while (i + literal < valores.length && literal < 128) {
      let proxima = 1;
      while (i + literal + proxima < valores.length && proxima < 4 && valores[i + literal + proxima] === valores[i + literal]) proxima += 1;
      if (proxima >= 4) break;
      literal += 1;
    }
    literal = Math.max(1, literal);
    saida.push(literal, ...valores.slice(i, i + literal));
    i += literal;
  }
  return saida;
}

const cabecalho = Buffer.from(`#?RADIANCE\n# gerado por scripts/gerar-hdri-estudio.mjs (procedural, sem terceiros)\nFORMAT=32-bit_rle_rgbe\n\n-Y ${ALTURA} +X ${LARGURA}\n`, "ascii");
const partes = [cabecalho];
for (let linha = 0; linha < ALTURA; linha += 1) {
  const lat = Math.PI / 2 - ((linha + 0.5) / ALTURA) * Math.PI;
  const canais = [[], [], [], []];
  for (let coluna = 0; coluna < LARGURA; coluna += 1) {
    const phi = ((coluna + 0.5) / LARGURA - 0.5) * 2 * Math.PI;
    paraRgbe(radiancia(phi, lat)).forEach((valor, indice) => canais[indice].push(valor));
  }
  partes.push(Buffer.from([2, 2, LARGURA >> 8, LARGURA & 255]));
  for (const canal of canais) partes.push(Buffer.from(codificarCanal(canal)));
}
mkdirSync(dirname(SAIDA), { recursive: true });
const arquivo = Buffer.concat(partes);
writeFileSync(SAIDA, arquivo);
console.log(`HDRI gerado: ${SAIDA} (${(arquivo.length / 1024).toFixed(0)} KB)`);
