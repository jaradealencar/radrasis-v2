import { describe, it, expect } from 'vitest';

/**
 * Réplica da regra usada em Solicitacoes.tsx (formatarEntregaOS).
 * Mantida aqui para travar o comportamento: a Entrega da OS sempre sai
 * como data de calendário dd/mm/aaaa, nunca como string de Date.
 */
function formatarEntregaOS(entrega?: string | null, aprovacao?: string | null): string {
  if (!entrega) return '—';
  const texto = String(entrega).trim();

  const jaBR = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (jaBR) return `${jaBR[1]}/${jaBR[2]}/${jaBR[3]}`;

  const diasUteis = texto.match(/(\d+)\s*DIAS?\s*(?:[ÚU]TEIS?|[ÚU]TIL)/i);
  if (diasUteis) {
    const base = aprovacao?.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (base) {
      const d = new Date(Number(base[3]), Number(base[2]) - 1, Number(base[1]));
      let restantes = Number(diasUteis[1]);
      while (restantes > 0) {
        d.setDate(d.getDate() + 1);
        const dia = d.getDay();
        if (dia !== 0 && dia !== 6) restantes--;
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return texto;
  }

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const parsed = new Date(texto);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
  }

  return texto;
}

describe('Entrega da OS exibida como data de calendário', () => {
  it('converte string de Date em dd/mm/aaaa', () => {
    expect(formatarEntregaOS('Thu Jul 23 2026 00:00:00 GMT+0000 (Coordinated Universal Time)'))
      .toBe('23/07/2026');
  });

  it('converte ISO em dd/mm/aaaa', () => {
    expect(formatarEntregaOS('2026-08-21')).toBe('21/08/2026');
  });

  it('mantém data já formatada', () => {
    expect(formatarEntregaOS('23/07/2026')).toBe('23/07/2026');
  });

  it('converte "10 DIAS ÚTEIS" somando a partir da aprovação', () => {
    // 16/07/2026 é quinta; +10 dias úteis => 30/07/2026
    expect(formatarEntregaOS('10 DIAS ÚTEIS', '16/07/2026')).toBe('30/07/2026');
  });

  it('pula fim de semana ao somar dias úteis', () => {
    // 17/07/2026 é sexta; +1 dia útil => 20/07/2026 (segunda)
    expect(formatarEntregaOS('1 DIA ÚTIL', '17/07/2026')).toBe('20/07/2026');
  });

  it('preserva o texto quando não há aprovação para calcular', () => {
    expect(formatarEntregaOS('10 DIAS ÚTEIS')).toBe('10 DIAS ÚTEIS');
  });

  it('devolve travessão quando não há entrega', () => {
    expect(formatarEntregaOS(null)).toBe('—');
    expect(formatarEntregaOS('')).toBe('—');
  });
});
