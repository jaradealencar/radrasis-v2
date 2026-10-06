/**
 * Gera uma imagem PNG limpa de um resultado (card de totais ou tabela) e a coloca na área de transferência, para o
 * vendedor colar direto no WhatsApp. Desenha em canvas em vez de fotografar o DOM: o `html2canvas` não entende as
 * cores `oklch()` do Tailwind 4 e a imagem sairia diferente conforme o tema/zoom da tela.
 */

export type BlocoImagem =
  | { tipo: "linha"; rotulo: string; detalhe?: string; valor: string; forte?: boolean }
  | { tipo: "nota"; texto: string }
  | { tipo: "tabela"; colunas: { titulo: string; alinhar?: "esq" | "dir" }[]; linhas: string[][] };

export interface EspecImagem {
  titulo?: string;
  subtitulo?: string;
  blocos: BlocoImagem[];
  /** Largura mínima em px CSS (a imagem cresce se a tabela precisar de mais). */
  larguraMinima?: number;
}

const FONTE = "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";
const COR = { texto: "#0f172a", suave: "#64748b", linha: "#e2e8f0", cabecalho: "#f1f5f9", borda: "#cbd5e1" };
const MARGEM = 28;
const ESCALA = 2;

const fonte = (peso: number, tamanho: number) => `${peso} ${tamanho}px ${FONTE}`;

/** Quebra o texto em linhas que caibam na largura (palavras longas demais ficam inteiras). */
function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && ctx.measureText(tentativa).width > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

/** Mede o conteúdo da tabela e devolve a largura de cada coluna. */
function larguraColunas(ctx: CanvasRenderingContext2D, bloco: Extract<BlocoImagem, { tipo: "tabela" }>): number[] {
  return bloco.colunas.map((coluna, indice) => {
    ctx.font = fonte(600, 13);
    let maior = ctx.measureText(coluna.titulo).width;
    ctx.font = fonte(400, 14);
    for (const linha of bloco.linhas) maior = Math.max(maior, ctx.measureText(linha[indice] ?? "").width);
    return Math.ceil(maior) + 24;
  });
}

export function desenharImagem(spec: EspecImagem): Promise<Blob> {
  const medida = document.createElement("canvas").getContext("2d");
  if (!medida) return Promise.reject(new Error("Este navegador não consegue desenhar a imagem."));

  // A tabela define a largura mínima do conteúdo.
  const tabelas = spec.blocos.filter((b): b is Extract<BlocoImagem, { tipo: "tabela" }> => b.tipo === "tabela");
  const larguraTabela = Math.max(0, ...tabelas.map(t => larguraColunas(medida, t).reduce((a, b) => a + b, 0)));
  const largura = Math.max(spec.larguraMinima ?? 420, larguraTabela + MARGEM * 2);
  const larguraUtil = largura - MARGEM * 2;

  // Primeira passada: altura. Segunda: desenho.
  const passar = (ctx: CanvasRenderingContext2D, desenhar: boolean): number => {
    let y = MARGEM;
    if (spec.titulo) {
      ctx.font = fonte(700, 18);
      ctx.fillStyle = COR.texto;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      y += 18;
      if (desenhar) ctx.fillText(spec.titulo, MARGEM, y);
      y += 6;
    }
    if (spec.subtitulo) {
      ctx.font = fonte(400, 13);
      ctx.fillStyle = COR.suave;
      for (const linha of quebrar(ctx, spec.subtitulo, larguraUtil)) {
        y += 18;
        if (desenhar) ctx.fillText(linha, MARGEM, y);
      }
      y += 4;
    }
    if (spec.titulo || spec.subtitulo) y += 10;

    spec.blocos.forEach((bloco, indice) => {
      if (bloco.tipo === "linha") {
        const alturaLinha = bloco.detalhe ? 54 : 40;
        const base = y + (bloco.detalhe ? 24 : 26);
        if (desenhar) {
          ctx.textAlign = "left";
          ctx.fillStyle = COR.texto;
          ctx.font = fonte(bloco.forte ? 700 : 400, bloco.forte ? 17 : 16);
          ctx.fillText(bloco.rotulo, MARGEM, base);
          if (bloco.detalhe) {
            ctx.font = fonte(400, 13);
            ctx.fillStyle = COR.suave;
            ctx.fillText(bloco.detalhe, MARGEM, base + 19);
          }
          ctx.textAlign = "right";
          ctx.fillStyle = COR.texto;
          ctx.font = fonte(bloco.forte ? 700 : 400, bloco.forte ? 17 : 16);
          ctx.fillText(bloco.valor, largura - MARGEM, base);
          const proximo = spec.blocos[indice + 1];
          if (proximo && proximo.tipo === "linha") {
            ctx.fillStyle = COR.linha;
            ctx.fillRect(MARGEM, y + alturaLinha - 1, larguraUtil, 1);
          }
        }
        y += alturaLinha;
      } else if (bloco.tipo === "nota") {
        ctx.font = fonte(400, 13);
        ctx.fillStyle = COR.suave;
        ctx.textAlign = "left";
        y += 6;
        for (const linha of quebrar(ctx, bloco.texto, larguraUtil)) {
          y += 19;
          if (desenhar) ctx.fillText(linha, MARGEM, y);
        }
        y += 4;
      } else {
        const colunas = larguraColunas(ctx, bloco);
        const extra = (larguraUtil - colunas.reduce((a, b) => a + b, 0)) / colunas.length;
        const larguras = colunas.map(c => c + extra);
        const alturaCabecalho = 36;
        const alturaLinha = 38;
        if (desenhar) {
          ctx.fillStyle = COR.cabecalho;
          ctx.fillRect(MARGEM, y, larguraUtil, alturaCabecalho);
        }
        const celula = (texto: string, i: number, base: number, peso: number, tamanho: number, cor: string) => {
          const x0 = MARGEM + larguras.slice(0, i).reduce((a, b) => a + b, 0);
          ctx.font = fonte(peso, tamanho);
          ctx.fillStyle = cor;
          if (bloco.colunas[i].alinhar === "dir") {
            ctx.textAlign = "right";
            ctx.fillText(texto, x0 + larguras[i] - 12, base);
          } else {
            ctx.textAlign = "left";
            ctx.fillText(texto, x0 + 12, base);
          }
        };
        if (desenhar) bloco.colunas.forEach((coluna, i) => celula(coluna.titulo, i, y + 23, 600, 13, COR.suave));
        y += alturaCabecalho;
        bloco.linhas.forEach(linha => {
          if (desenhar) {
            ctx.fillStyle = COR.linha;
            ctx.fillRect(MARGEM, y + alturaLinha - 1, larguraUtil, 1);
            linha.forEach((texto, i) => celula(texto, i, y + 24, i === linha.length - 1 ? 700 : 400, 14, COR.texto));
          }
          y += alturaLinha;
        });
        y += 6;
      }
    });
    return y + MARGEM;
  };

  const altura = Math.ceil(passar(medida, false));
  const canvas = document.createElement("canvas");
  canvas.width = largura * ESCALA;
  canvas.height = altura * ESCALA;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Este navegador não consegue desenhar a imagem."));

  const montar = async () => {
    // Espera a Inter carregar para a imagem não sair na fonte reserva.
    try {
      await Promise.all([document.fonts.load(fonte(400, 14)), document.fonts.load(fonte(700, 17)), document.fonts.load(fonte(600, 13))]);
    } catch { /* sem a API de fontes: usa a reserva */ }
    ctx.scale(ESCALA, ESCALA);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, largura, altura);
    passar(ctx, true);
    ctx.strokeStyle = COR.borda;
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, largura - 1, altura - 1);
    return new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar a imagem."))), "image/png")
    );
  };
  return montar();
}

/**
 * Copia a imagem para a área de transferência. O `ClipboardItem` aceita uma Promise, o que mantém a cópia dentro do
 * "gesto" do clique mesmo com a imagem ainda sendo desenhada. Sem suporte (ou sem permissão), baixa o PNG.
 */
export async function copiarImagem(imagem: Promise<Blob>, nomeArquivo: string): Promise<"copiada" | "baixada"> {
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": imagem })]);
      return "copiada";
    } catch {
      /* cai para o download */
    }
  }
  const blob = await imagem;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "baixada";
}
