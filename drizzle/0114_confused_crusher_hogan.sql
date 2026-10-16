ALTER TABLE "perfil_estoque_itens" ADD COLUMN "consumo_mensal_historico" numeric(16, 4);

-- Seed de consumo m?dio hist?rico MubiSys: O.S. conclu?das/entregues, 01/01?15/10/2026.
-- Qtd. Prevista convertida em metros dividida pelos 9,5 meses decorridos.
-- Perfis sem BOM/m?trica linear e perfil com zero consumo observado foram exclu?dos.
UPDATE perfil_estoque_itens AS perfil
SET consumo_mensal_historico = historico.consumo_mensal
FROM (VALUES
    ('Perfil Galvanizado 80mm - 26"', 755.25),
    ('Perfil Galvanizado 20mm - 26"', 232.63),
    ('Perfil Galvanizado 100mm - 26"', 215.89),
    ('Perfil Galvanizado 50mm - 26"', 213.05),
    ('Perfil Galvanizado 70mm - 26"', 163.26),
    ('Perfil Galvanizado 40mm - 26"', 130.06),
    ('Perfil Galvanizado 80mm - 24"', 126.95),
    ('Perfil Galvanizado 60mm - 26"', 116.84),
    ('Perfil Inox Polido 50mm - 26"- Lig 430', 83.96),
    ('Perfil Galvanizado 30mm - 26"', 73.58),
    ('Perfil Inox Escovado 30mm - 26"- Liga 430', 55.94),
    ('Perfil Inox Escovado 50mm - 26"- Lig 430', 51.60),
    ('Perfil Inox Polido 40mm - 26"- Lig 430', 50.20),
    ('Perfil Inox Polido 80mm - 26"- Liga 430', 38.63),
    ('Perfil Galvanizado 100mm - 24"', 35.58),
    ('Perfil Inox Polido 30mm - 26"- Liga 430', 33.92),
    ('Perfil Inox Escovado 40mm - 26"- Lig 430', 32.95),
    ('Perfil Inox Polido 30mm - 26"- Liga 304', 30.93),
    ('Perfil Inox Escovado 30mm - 26"- Liga 304', 30.82),
    ('Perfil Inox Polido 80mm - 24"- Lig 430', 28.53),
    ('Perfil Inox Escovado 20mm - 26" - Lig 430', 28.42),
    ('Perfil Inox Escovado 50mm - 26"- Liga 304', 22.20),
    ('Perfil Inox Polido 50mm - 26"- Liga 304', 18.46),
    ('Perfil Inox Polido 20mm - 26"- Lig 430', 16.96),
    ('Perfil Galvanizado 120mm - 24"', 10.53),
    ('Perfil Galvanizado 150mm - 24"', 10.53),
    ('Perfil Inox Polido 60mm - 26"- Liga 430', 7.47),
    ('Perfil Inox Escovado 70mm - 26"- Lig 430', 7.09),
    ('Perfil Inox Polido 70mm - 26"- Lig 430', 6.95),
    ('Perfil Inox Escovado 80mm - 26"- Liga 430', 3.37),
    ('Perfil Inox Polido 80mm - 26"- Liga 304', 2.11),
    ('Perfil Inox Escovado 80mm - 26"- Liga 304', 1.05)
) AS historico(nome, consumo_mensal)
WHERE btrim(split_part(perfil.nome, '|', 1)) = historico.nome
  AND perfil.consumo_mensal_historico IS NULL;
