import { useState, useCallback } from "react";

interface CepData {
  cep: string;
  logradouro: string;
  numero?: string;
  bairro: string;
  cidade: string;
  estado: string;
  uf: string;
}

/**
 * Hook customizado para buscar dados de CEP em tempo real
 * Usa a API ViaCEP (gratuita e sem autenticação)
 */
export function useCepLookup() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CepData | null>(null);

  const lookupCep = useCallback(async (cep: string) => {
    // Remover caracteres não numéricos
    const cleanCep = cep.replace(/\D/g, "");

    // Validar formato (8 dígitos)
    if (cleanCep.length !== 8) {
      setError("CEP deve conter 8 dígitos");
      setData(null);
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      // Usar API ViaCEP (gratuita)
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);

      if (!response.ok) {
        throw new Error("Erro ao buscar CEP");
      }

      const result = await response.json();

      // ViaCEP retorna erro: true se CEP não encontrado
      if (result.erro) {
        setError("CEP não encontrado");
        setData(null);
        return null;
      }

      // Formatar dados
      const cepData: CepData = {
        cep: cleanCep,
        logradouro: result.logradouro || "",
        bairro: result.bairro || "",
        cidade: result.localidade || "",
        estado: result.uf || "",
        uf: result.uf || "",
      };

      console.log("✅ [CEP] Dados encontrados:", cepData);
      setData(cepData);
      setError(null);
      return cepData;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Erro ao buscar CEP";
      console.error("❌ [CEP] Erro:", errorMsg);
      setError(errorMsg);
      setData(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { lookupCep, loading, error, data };
}
