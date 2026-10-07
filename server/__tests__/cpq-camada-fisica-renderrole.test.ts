import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Camada física do nesting (Face/Aro/Fundo) a partir do papel 3D (`renderRole`) já confirmado no kit (pedido de 07/10/2026): a ficha do
 * MubiSys e o editor de kit criam linhas com papel vazio e o nesting pedia para vincular cada chapa de novo. A lógica mora no HTML
 * monolítico do CPQ; aqui as funções reais são extraídas do arquivo e executadas, sem navegador.
 */
const html = readFileSync("client/cpq-letreiros-express.html", "utf8");

function extrairFuncao(nome: string): string {
  const inicio = html.indexOf(`function ${nome}(`);
  if (inicio < 0) throw new Error(`Função ${nome} não encontrada no HTML do CPQ.`);
  const resto = html.slice(inicio).replace(/\r\n/g, "\n");
  const primeiraLinha = resto.slice(0, resto.indexOf("\n"));
  if (/\}\s*$/.test(primeiraLinha) && !/\{\s*$/.test(primeiraLinha)) return primeiraLinha;
  const fim = resto.indexOf("\n}\n");
  if (fim < 0) throw new Error(`Fim da função ${nome} não encontrado.`);
  return resto.slice(0, fim + 2);
}

const api = new Function(
  "catalog",
  `${["normalizeSearch", "materialKitAtivo", "camadaFisicaKit", "camadaFisicaDoKit", "linhaEhPerfil"].map(extrairFuncao).join("\n")}
return { camadaFisicaKit, camadaFisicaDoKit, linhaEhPerfil };`,
)({ materias: [] }) as {
  camadaFisicaKit: (linha: Record<string, unknown>) => string | null;
  camadaFisicaDoKit: (linha: Record<string, unknown>) => string | null;
  linhaEhPerfil: (linha: Record<string, unknown>) => boolean;
};

const linha = (extra: Record<string, unknown>) => ({ matId: 1, nome: "Acrílico Branco 3mm", papel: "", ...extra });

describe("camada física do nesting a partir do papel 3D do kit", () => {
  it("linha da ficha do MubiSys (papel vazio) usa o papel 3D já confirmado: face, retorno→aro e fundo", () => {
    expect(api.camadaFisicaKit(linha({ renderRole: "face" }))).toBeNull(); // só o texto do papel (decide a troca por cor, não mexe)
    expect(api.camadaFisicaDoKit(linha({ renderRole: "face" }))).toBe("face");
    expect(api.camadaFisicaDoKit(linha({ renderRole: "return" }))).toBe("aro");
    expect(api.camadaFisicaDoKit(linha({ renderRole: "back" }))).toBe("fundo");
  });

  it("o texto do papel continua mandando e papéis 3D que não são chapa não viram camada", () => {
    expect(api.camadaFisicaDoKit(linha({ papel: "Fundo", renderRole: "face" }))).toBe("fundo");
    expect(api.camadaFisicaDoKit(linha({ papel: "Face e fundo", renderRole: "face" }))).toBe("face"); // ambíguo no texto: o papel 3D desempata
    for (const role of ["led", "fixing", "finish", "ignored", "profile", null, undefined])
      expect(api.camadaFisicaDoKit(linha({ renderRole: role }))).toBeNull();
    expect(api.camadaFisicaDoKit(linha({}))).toBeNull();
  });

  it("papel 3D de perfil tira a linha do nesting mesmo sem a palavra \"perfil\" no papel ou no nome", () => {
    expect(api.linhaEhPerfil(linha({ nome: "Tubo 20x20", renderRole: "profile" }))).toBe(true);
    expect(api.linhaEhPerfil(linha({ nome: "Acrílico", renderRole: "face" }))).toBe(false);
    expect(api.linhaEhPerfil(linha({ papel: "Perfil lateral" }))).toBe(true);
  });
});

describe("HTML do CPQ", () => {
  it("os scripts embutidos continuam com sintaxe válida", () => {
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]).filter(codigo => codigo.trim().length > 200);
    expect(scripts.length).toBeGreaterThan(0);
    for (const codigo of scripts) expect(() => new Script(codigo)).not.toThrow();
  });
});
