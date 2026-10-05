import type { EstudioChapa, MateriaPrimaCadastro, MateriaPrimaCategoria } from "../../drizzle/schema";
import { formatoPerfilUsaAltura, formatoPerfilUsaEspessura, normalizarFormatoPerfil, secaoPerfilMm2 } from "../../shared/peso";

/**
 * Situação do cadastro local de uma matéria-prima (Produtos > Matérias-primas):
 * - `sem_categoria`: ainda não foi classificada;
 * - `incompleta`: tem categoria, mas faltam os dados técnicos que essa categoria exige;
 * - `atualizada`: categorizada e com todos os dados exigidos.
 * Categorias que não pedem dados técnicos (insumos gerais, elétrica…) ficam `atualizada` assim que classificadas.
 */
export type StatusCadastroMateria = "sem_categoria" | "incompleta" | "atualizada";

export type EntradaStatusCadastro = {
  categoria: { usaDadosChapa: boolean; usaDadosBobina: boolean; usaDadosPerfil: boolean } | null;
  cadastro: {
    espessuraMm: number | null;
    densidadeKgM3: number | null;
    perfilFormato: string | null;
    perfilAlturaMm: number | null;
    perfilLarguraMm: number | null;
    perfilComprimentoMm: number | null;
    bobinaCustoBase: string | null;
    bobinaComprimentoRoloMm: number | null;
  } | null;
  /** Formatos de chapa ou larguras de bobina ativos. */
  formatosAtivos: number;
};

export type ResultadoStatusCadastro = { status: StatusCadastroMateria; pendencias: string[] };

export function statusCadastroMateriaPrima({ categoria, cadastro, formatosAtivos }: EntradaStatusCadastro): ResultadoStatusCadastro {
  if (!categoria) return { status: "sem_categoria", pendencias: ["Sem categoria"] };

  const pendencias: string[] = [];
  const positivo = (valor: number | null | undefined) => valor != null && Number.isFinite(valor) && valor > 0;

  if (categoria.usaDadosChapa) {
    if (!positivo(cadastro?.espessuraMm)) pendencias.push("espessura");
    if (!positivo(cadastro?.densidadeKgM3)) pendencias.push("densidade");
    if (formatosAtivos < 1) pendencias.push("ao menos um formato de chapa");
  } else if (categoria.usaDadosBobina) {
    if (formatosAtivos < 1) pendencias.push("ao menos uma largura de bobina");
    if (!positivo(cadastro?.espessuraMm)) pendencias.push("espessura");
    if (!positivo(cadastro?.densidadeKgM3)) pendencias.push("densidade");
    if (!cadastro?.bobinaCustoBase) pendencias.push("como o custo é cobrado");
    else if (cadastro.bobinaCustoBase === "rolo" && !positivo(cadastro.bobinaComprimentoRoloMm)) pendencias.push("comprimento do rolo");
  } else if (categoria.usaDadosPerfil) {
    const formato = normalizarFormatoPerfil(cadastro?.perfilFormato);
    const usaAltura = formatoPerfilUsaAltura(formato);
    const usaEspessura = formatoPerfilUsaEspessura(formato);
    if (usaAltura && !positivo(cadastro?.perfilAlturaMm)) pendencias.push("altura do perfil");
    if (!positivo(cadastro?.perfilLarguraMm)) pendencias.push(usaAltura ? "largura do perfil" : "diâmetro do perfil");
    if (usaEspessura && !positivo(cadastro?.espessuraMm)) pendencias.push("espessura");
    if (!positivo(cadastro?.perfilComprimentoMm)) pendencias.push("comprimento da barra");
    if (!positivo(cadastro?.densidadeKgM3)) pendencias.push("densidade");
    if (!pendencias.length
      && secaoPerfilMm2(formato, cadastro?.perfilAlturaMm ?? 0, cadastro?.perfilLarguraMm ?? 0, cadastro?.espessuraMm ?? null) == null) {
      pendencias.push("medidas que formem uma seção válida");
    }
  }

  return pendencias.length ? { status: "incompleta", pendencias } : { status: "atualizada", pendencias: [] };
}

const numero = (valor: string | null | undefined) => (valor == null ? null : Number(valor));

/** Situação a partir das linhas do banco (categoria, cadastro local e formatos de chapa/bobina da matéria-prima). */
export function statusCadastroDeLinhas(
  categoria: MateriaPrimaCategoria | null | undefined,
  cadastro: MateriaPrimaCadastro | null | undefined,
  formatos: Pick<EstudioChapa, "ativo">[],
): ResultadoStatusCadastro {
  return statusCadastroMateriaPrima({
    categoria: categoria
      ? { usaDadosChapa: categoria.usaDadosChapa, usaDadosBobina: categoria.usaDadosBobina, usaDadosPerfil: categoria.usaDadosPerfil }
      : null,
    cadastro: cadastro
      ? {
          espessuraMm: numero(cadastro.espessuraMm),
          densidadeKgM3: numero(cadastro.densidadeKgM3),
          perfilFormato: cadastro.perfilFormato,
          perfilAlturaMm: numero(cadastro.perfilAlturaMm),
          perfilLarguraMm: numero(cadastro.perfilLarguraMm),
          perfilComprimentoMm: numero(cadastro.perfilComprimentoMm),
          bobinaCustoBase: cadastro.bobinaCustoBase,
          bobinaComprimentoRoloMm: numero(cadastro.bobinaComprimentoRoloMm),
        }
      : null,
    formatosAtivos: formatos.filter(formato => formato.ativo).length,
  });
}
