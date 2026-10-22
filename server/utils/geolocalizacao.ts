import MAPA_MUNICIPIOS from "../data/municipios-coordenadas";

export function normalizarChaveMunicipio(cidade: string, uf: string): string {
  const c = (cidade || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const u = (uf || "").trim().toUpperCase();
  return `${c}|${u}`;
}

/**
 * Obtém latitude e longitude do centroide de uma cidade brasileira.
 */
export function obterCoordenadasMunicipio(cidade: string, uf: string): { lat: number; lng: number } | null {
  const chave = normalizarChaveMunicipio(cidade, uf);
  const coords = MAPA_MUNICIPIOS[chave];
  if (coords && coords.length === 2) {
    return { lat: coords[0], lng: coords[1] };
  }
  return null;
}

/**
 * Calcula a distância em quilômetros (em linha reta sobre a esfera terrestre)
 * entre dois pontos geográficos usando a fórmula de Haversine.
 * Retorna com 1 casa decimal de precisão.
 */
export function calcularDistanciaHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Raio médio da Terra em km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const dist = R * c;
  return Math.round(dist * 10) / 10;
}

export interface ResultadoConsultaCep {
  cep: string;
  cidade: string;
  uf: string;
  lat: number;
  lng: number;
}

// Cache em memória para evitar chamadas de rede repetidas para o mesmo CEP
const cacheCep = new Map<string, ResultadoConsultaCep>();

/**
 * Consulta os dados e as coordenadas de um CEP brasileiro.
 * Usa BrasilAPI (com fallback para ViaCEP + mapa de coordenadas IBGE).
 */
export async function consultarDadosCep(cepBruto: string): Promise<ResultadoConsultaCep | null> {
  const digitos = (cepBruto || "").replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  const emCache = cacheCep.get(digitos);
  if (emCache) return emCache;

  const cepFormatado = `${digitos.slice(0, 5)}-${digitos.slice(5)}`;

  // Tentativa 1: BrasilAPI v2 (traz coordenadas quando disponíveis)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      const cidade = String(data.city || "").trim();
      const uf = String(data.state || "").trim().toUpperCase();
      let lat = parseFloat(data.location?.coordinates?.latitude);
      let lng = parseFloat(data.location?.coordinates?.longitude);

      if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        const coordsCidade = obterCoordenadasMunicipio(cidade, uf);
        if (coordsCidade) {
          lat = coordsCidade.lat;
          lng = coordsCidade.lng;
        }
      }

      if (cidade && uf && !isNaN(lat) && !isNaN(lng)) {
        const resultado: ResultadoConsultaCep = {
          cep: cepFormatado,
          cidade,
          uf,
          lat,
          lng,
        };
        cacheCep.set(digitos, resultado);
        return resultado;
      }
    }
  } catch (_e) {
    // Fallback silencioso para ViaCEP
  }

  // Tentativa 2: ViaCEP
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const resp = await fetch(`https://viacep.com.br/ws/${digitos}/json/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    if (resp.ok) {
      const data = await resp.json();
      if (!data.erro) {
        const cidade = String(data.localidade || "").trim();
        const uf = String(data.uf || "").trim().toUpperCase();
        const coordsCidade = obterCoordenadasMunicipio(cidade, uf);

        if (cidade && uf && coordsCidade) {
          const resultado: ResultadoConsultaCep = {
            cep: cepFormatado,
            cidade,
            uf,
            lat: coordsCidade.lat,
            lng: coordsCidade.lng,
          };
          cacheCep.set(digitos, resultado);
          return resultado;
        }
      }
    }
  } catch (_e) {
    // Falha em ambas as fontes
  }

  return null;
}
