/*
 * Vetorizador local do CPQ (plano B quando o Vectorizer.AI falha ou sem créditos).
 * JavaScript puro, sem dependências: roda no navegador (canvas) e no Node (testes).
 *
 * Entrada: pixels RGBA da arte aprovada (flat, cores chapadas sobre fundo liso ou transparente).
 * Saída: SVG só com <path> preenchidos, um por cor, formas recortadas umas das outras (sem sobreposição) e com
 * os vazados como subcaminhos — o mesmo formato que o resto do fluxo (validação, factibilidade, nesting) espera.
 *
 * Método: separa o fundo, agrupa as cores (k-means), monta uma máscara por cor, suaviza levemente e extrai o
 * contorno em subpixel (marching squares), ligando os segmentos em anéis fechados e simplificando (Douglas-Peucker).
 * Fica um pouco menos fino que o Vectorizer.AI; o fluxo valida a silhueta contra a arte aprovada do mesmo jeito.
 */
(function (global) {
  'use strict';

  var LIMITE_FUNDO = 48;          // distância RGB até a cor de fundo para um pixel contar como fundo
  var DISTANCIA_MIN_CORES = 45;   // cores mais próximas que isso viram a mesma cor
  var PARTICIPACAO_MIN = 0.004;   // cor que ocupa menos que 0,4% da arte não vira camada própria
  var TOLERANCIA_RDP = 0.45;      // px

  function hex(c) {
    return '#' + c.map(function (v) { var s = Math.max(0, Math.min(255, Math.round(v))).toString(16); return s.length < 2 ? '0' + s : s; }).join('');
  }

  /** Cor de fundo = a mais comum nas bordas; null quando a arte tem fundo transparente. */
  function estimarFundo(d, w, h) {
    var transparentes = 0, total = 0, contagem = {}, melhor = null, melhorN = 0;
    function amostra(x, y) {
      var i = (y * w + x) * 4;
      total++;
      if (d[i + 3] < 128) { transparentes++; return; }
      var chave = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
      var item = contagem[chave] || (contagem[chave] = { n: 0, r: 0, g: 0, b: 0 });
      item.n++; item.r += d[i]; item.g += d[i + 1]; item.b += d[i + 2];
      if (item.n > melhorN) { melhorN = item.n; melhor = item; }
    }
    for (var x = 0; x < w; x++) { amostra(x, 0); amostra(x, h - 1); }
    for (var y = 1; y < h - 1; y++) { amostra(0, y); amostra(w - 1, y); }
    if (transparentes * 2 >= total || !melhor) return null;
    return [melhor.r / melhor.n, melhor.g / melhor.n, melhor.b / melhor.n];
  }

  /** Marca o que é arte (1) e o que é fundo (0). */
  function mascaraArte(d, w, h, fundo) {
    var m = new Uint8Array(w * h), limite = LIMITE_FUNDO * LIMITE_FUNDO, n = 0;
    for (var p = 0, i = 0; p < w * h; p++, i += 4) {
      if (d[i + 3] < 128) continue;
      if (fundo) {
        var dr = d[i] - fundo[0], dg = d[i + 1] - fundo[1], db = d[i + 2] - fundo[2];
        if (dr * dr + dg * dg + db * db < limite) continue;
      }
      m[p] = 1; n++;
    }
    return { mascara: m, total: n };
  }

  /** Cores dominantes: escolha gulosa das mais frequentes e distintas, depois refinamento k-means. */
  function agruparCores(d, w, h, mascara, total, maxCores) {
    var hist = new Uint32Array(32768), passo = Math.max(1, Math.floor(total / 400000));
    var vistos = 0;
    for (var p = 0, i = 0; p < w * h; p++, i += 4) {
      if (!mascara[p]) continue;
      if ((vistos++ % passo) !== 0) continue;
      hist[((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3)]++;
    }
    var bins = [], soma = 0;
    for (var b = 0; b < 32768; b++) if (hist[b]) { bins.push(b); soma += hist[b]; }
    bins.sort(function (a, c) { return hist[c] - hist[a]; });
    function cor(b) { return [((b >> 10) << 3) + 4, (((b >> 5) & 31) << 3) + 4, ((b & 31) << 3) + 4]; }
    var centros = [], minimo = DISTANCIA_MIN_CORES * DISTANCIA_MIN_CORES;
    for (var k = 0; k < bins.length && centros.length < maxCores; k++) {
      if (hist[bins[k]] / soma < PARTICIPACAO_MIN && centros.length) break;
      var c = cor(bins[k]), longe = true;
      for (var q = 0; q < centros.length; q++) {
        var a = centros[q], dr = a[0] - c[0], dg = a[1] - c[1], db = a[2] - c[2];
        if (dr * dr + dg * dg + db * db < minimo) { longe = false; break; }
      }
      if (longe) centros.push(c);
    }
    if (!centros.length) centros.push(cor(bins[0]));
    for (var it = 0; it < 5; it++) {
      var acum = centros.map(function () { return [0, 0, 0, 0]; });
      for (var j = 0; j < bins.length; j++) {
        var cc = cor(bins[j]), idx = mais_proximo(centros, cc[0], cc[1], cc[2]), peso = hist[bins[j]];
        acum[idx][0] += cc[0] * peso; acum[idx][1] += cc[1] * peso; acum[idx][2] += cc[2] * peso; acum[idx][3] += peso;
      }
      for (var z = 0; z < centros.length; z++) if (acum[z][3]) centros[z] = [acum[z][0] / acum[z][3], acum[z][1] / acum[z][3], acum[z][2] / acum[z][3]];
    }
    return centros;
  }

  function mais_proximo(centros, r, g, b) {
    var melhor = 0, dist = Infinity;
    for (var i = 0; i < centros.length; i++) {
      var dr = centros[i][0] - r, dg = centros[i][1] - g, db = centros[i][2] - b, v = dr * dr + dg * dg + db * db;
      if (v < dist) { dist = v; melhor = i; }
    }
    return melhor;
  }

  /** Rótulo de cada pixel de arte (-1 = fundo) e filtro de maioria para tirar pixels isolados. */
  function rotular(d, w, h, mascara, centros) {
    var rot = new Int16Array(w * h).fill(-1);
    for (var p = 0, i = 0; p < w * h; p++, i += 4) if (mascara[p]) rot[p] = mais_proximo(centros, d[i], d[i + 1], d[i + 2]);
    if (centros.length < 2) return rot;
    var copia = rot.slice(), cont = new Int16Array(centros.length);
    for (var y = 1; y < h - 1; y++) for (var x = 1; x < w - 1; x++) {
      var q = y * w + x, atual = copia[q];
      if (atual < 0) continue;
      cont.fill(0);
      for (var oy = -1; oy <= 1; oy++) for (var ox = -1; ox <= 1; ox++) { var v = copia[q + oy * w + ox]; if (v >= 0 && (ox || oy)) cont[v]++; }
      var alvo = atual, mx = cont[atual];
      for (var l = 0; l < centros.length; l++) if (cont[l] >= 5 && cont[l] > mx) { mx = cont[l]; alvo = l; }
      rot[q] = alvo;
    }
    return rot;
  }

  /** Campo 0..1 da camada, com borda de zeros e um leve borrão [1 2 1]/4 nos dois eixos (contorno em subpixel). */
  function campo(rot, w, h, etiqueta) {
    var W = w + 2, H = h + 2, f = new Float32Array(W * H), t = new Float32Array(W * H);
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
      var v = rot[y * w + x];
      if (etiqueta === -2 ? v >= 0 : v === etiqueta) f[(y + 1) * W + x + 1] = 1;
    }
    for (var y1 = 0; y1 < H; y1++) for (var x1 = 1; x1 < W - 1; x1++) { var i1 = y1 * W + x1; t[i1] = (f[i1 - 1] + 2 * f[i1] + f[i1 + 1]) / 4; }
    for (var y2 = 1; y2 < H - 1; y2++) for (var x2 = 0; x2 < W; x2++) { var i2 = y2 * W + x2; f[i2] = (t[i2 - W] + 2 * t[i2] + t[i2 + W]) / 4; }
    return { f: f, W: W, H: H };
  }

  // Segmentos de cada caso (a=TL 8, b=TR 4, c=BR 2, d=BL 1); arestas: 0=topo 1=direita 2=base 3=esquerda. Dentro à esquerda.
  var TABELA = [
    [], [[2, 3]], [[1, 2]], [[1, 3]], [[0, 1]], null, [[0, 2]], [[0, 3]],
    [[3, 0]], [[2, 0]], null, [[1, 0]], [[3, 1]], [[2, 1]], [[3, 2]], []
  ];

  function anelDe(F, iso) {
    var f = F.f, W = F.W, H = F.H, proximo = new Map();
    function aresta(i, j, e) { // id único da aresta (i,j,e) do tipo H (e 0/2) ou V (e 1/3)
      if (e === 0) return (j * W + i) * 2;
      if (e === 2) return ((j + 1) * W + i) * 2;
      if (e === 3) return (j * W + i) * 2 + 1;
      return (j * W + i + 1) * 2 + 1;
    }
    for (var j = 0; j < H - 1; j++) for (var i = 0; i < W - 1; i++) {
      var a = f[j * W + i], b = f[j * W + i + 1], c = f[(j + 1) * W + i + 1], d = f[(j + 1) * W + i];
      var caso = (a >= iso ? 8 : 0) | (b >= iso ? 4 : 0) | (c >= iso ? 2 : 0) | (d >= iso ? 1 : 0);
      if (caso === 0 || caso === 15) continue;
      var segs = TABELA[caso];
      if (!segs) {
        var centro = (a + b + c + d) / 4 >= iso;
        if (caso === 10) segs = centro ? [[1, 0], [3, 2]] : [[3, 0], [1, 2]];
        else segs = centro ? [[0, 3], [2, 1]] : [[0, 1], [2, 3]];
      }
      for (var s = 0; s < segs.length; s++) proximo.set(aresta(i, j, segs[s][0]), aresta(i, j, segs[s][1]));
    }
    function ponto(id) {
      var vertical = id & 1, base = id >> 1, j2 = Math.floor(base / W), i2 = base - j2 * W, v1, v2, t;
      if (!vertical) { v1 = f[j2 * W + i2]; v2 = f[j2 * W + i2 + 1]; t = (iso - v1) / (v2 - v1); return [i2 + t - 0.5, j2 - 0.5]; }
      v1 = f[j2 * W + i2]; v2 = f[(j2 + 1) * W + i2]; t = (iso - v1) / (v2 - v1);
      return [i2 - 0.5, j2 + t - 0.5];
    }
    var aneis = [], visitado = new Set();
    proximo.forEach(function (_, inicio) {
      if (visitado.has(inicio)) return;
      var anel = [], atual = inicio;
      while (atual !== undefined && !visitado.has(atual)) { visitado.add(atual); anel.push(ponto(atual)); atual = proximo.get(atual); }
      if (atual === inicio && anel.length >= 3) aneis.push(anel);
    });
    return aneis;
  }

  function areaAssinada(anel) {
    var s = 0;
    for (var i = 0; i < anel.length; i++) { var a = anel[i], b = anel[(i + 1) % anel.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }

  /** Douglas-Peucker num anel fechado: parte do ponto 0 e do mais distante dele. */
  function simplificar(anel, tol) {
    var n = anel.length;
    if (n < 8) return anel;
    var longe = 0, dm = -1;
    for (var i = 1; i < n; i++) { var dx = anel[i][0] - anel[0][0], dy = anel[i][1] - anel[0][1], dd = dx * dx + dy * dy; if (dd > dm) { dm = dd; longe = i; } }
    var manter = new Uint8Array(n); manter[0] = 1; manter[longe] = 1;
    function trecho(ini, fim) {
      var pilha = [[ini, fim]];
      while (pilha.length) {
        var par = pilha.pop(), a = par[0], b = par[1];
        if (b - a < 2) continue;
        var pa = anel[a % n], pb = anel[b % n], vx = pb[0] - pa[0], vy = pb[1] - pa[1], len = Math.hypot(vx, vy), pior = -1, idx = -1;
        for (var k = a + 1; k < b; k++) {
          var p = anel[k % n], dist = len < 1e-9 ? Math.hypot(p[0] - pa[0], p[1] - pa[1]) : Math.abs(vx * (pa[1] - p[1]) - (pa[0] - p[0]) * vy) / len;
          if (dist > pior) { pior = dist; idx = k; }
        }
        if (pior > tol) { manter[idx % n] = 1; pilha.push([a, idx], [idx, b]); }
      }
    }
    trecho(0, longe); trecho(longe, n);
    var saida = [];
    for (var m = 0; m < n; m++) if (manter[m]) saida.push(anel[m]);
    return saida;
  }

  function caminho(aneis) {
    return aneis.map(function (anel) {
      return 'M' + anel.map(function (p) { return (Math.round(p[0] * 100) / 100) + ' ' + (Math.round(p[1] * 100) / 100); }).join('L') + 'Z';
    }).join('');
  }

  /**
   * @param {{data: Uint8ClampedArray|Uint8Array, width: number, height: number}} imagem  pixels RGBA
   * @param {{maxCores?: number, minAreaPx?: number, modo?: 'completo'|'corte'}} opcoes
   * @returns {{svg: string, info: {cores: number, caminhos: number, aneis: number}}}
   */
  function vetorizarPixels(imagem, opcoes) {
    opcoes = opcoes || {};
    var d = imagem.data, w = imagem.width, h = imagem.height;
    if (!d || !(w > 2) || !(h > 2) || d.length < w * h * 4) throw new Error('Imagem inválida para vetorizar.');
    var maxCores = Math.max(1, Math.min(24, Math.round(opcoes.maxCores || 8)));
    var minArea = opcoes.minAreaPx != null ? Math.max(0.5, opcoes.minAreaPx) : 6;
    var fundo = estimarFundo(d, w, h), arte = mascaraArte(d, w, h, fundo);
    if (arte.total < 16) throw new Error('Não encontrei a arte na imagem (só fundo).');
    if (arte.total > w * h * 0.985) throw new Error('A imagem não tem fundo separável da arte; reconstrua a arte sobre fundo liso.');
    var corte = opcoes.modo === 'corte';
    var centros = corte ? [[0, 0, 0]] : agruparCores(d, w, h, arte.mascara, arte.total, maxCores);
    var rot = corte ? (function () { var r = new Int16Array(w * h).fill(-1); for (var p = 0; p < w * h; p++) if (arte.mascara[p]) r[p] = 0; return r; })() : rotular(d, w, h, arte.mascara, centros);
    var camadas = [], totalAneis = 0;
    for (var k = 0; k < centros.length; k++) {
      var aneis = anelDe(campo(rot, w, h, k), 0.5).map(function (a) { return simplificar(a, TOLERANCIA_RDP); })
        .filter(function (a) { return a.length >= 3 && Math.abs(areaAssinada(a)) >= minArea; });
      if (!aneis.length) continue;
      totalAneis += aneis.length;
      var maior = Math.max.apply(null, aneis.map(function (a) { return Math.abs(areaAssinada(a)); }));
      camadas.push({ cor: hex(centros[k]), d: caminho(aneis), maior: maior });
    }
    if (!camadas.length) throw new Error('Não consegui extrair contornos da imagem.');
    camadas.sort(function (a, b) { return b.maior - a.maior; });
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">'
      + camadas.map(function (c) { return '<path fill="' + c.cor + '" d="' + c.d + '"/>'; }).join('') + '</svg>';
    return { svg: svg, info: { cores: camadas.length, caminhos: camadas.length, aneis: totalAneis } };
  }

  /** Navegador: abre o Blob/URL numa tela, reduz para no máximo `ladoMax` px e vetoriza. */
  function vetorizarImagem(fonte, opcoes) {
    opcoes = opcoes || {};
    var ladoMax = opcoes.ladoMax || 1200;
    return new Promise(function (resolve, reject) {
      var url = typeof fonte === 'string' ? fonte : URL.createObjectURL(fonte), img = new Image();
      img.onload = function () {
        try {
          var escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
          var w = Math.max(3, Math.round(img.naturalWidth * escala)), h = Math.max(3, Math.round(img.naturalHeight * escala));
          var tela = document.createElement('canvas'); tela.width = w; tela.height = h;
          var ctx = tela.getContext('2d', { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, w, h);
          var dados = ctx.getImageData(0, 0, w, h);
          if (typeof fonte !== 'string') URL.revokeObjectURL(url);
          resolve(vetorizarPixels({ data: dados.data, width: w, height: h }, opcoes));
        } catch (erro) { reject(erro); }
      };
      img.onerror = function () { reject(new Error('Não foi possível abrir a imagem para vetorizar localmente.')); };
      img.src = url;
    });
  }

  global.CpqVetorizadorLocal = { vetorizarPixels: vetorizarPixels, vetorizarImagem: vetorizarImagem };
})(typeof globalThis !== 'undefined' ? globalThis : this);
