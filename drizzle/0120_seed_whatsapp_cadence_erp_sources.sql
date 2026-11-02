-- Stable default ERP audiences. Custom edits in the UI are preserved on later deploys.
INSERT INTO "campanhas_whatsapp_fontes" (
  "tipo", "chave", "label", "descricao", "regras_erp", "ativo"
) VALUES
  (
    'regras_erp', 'reativacao_inativos', 'Reativação de Inativos',
    'Clientes com 60 ou mais dias sem compra.',
    '{"versao":1,"regras":[{"campo":"days_since_purchase","operador":"gte","valor":60}]}'::jsonb,
    true
  ),
  (
    'regras_erp', 'orcou_nao_comprou', 'Orçaram e não compraram',
    'Orçamento pendente há pelo menos 15 dias, sem pedido posterior.',
    '{"versao":1,"regras":[{"campo":"quote_status","operador":"eq","valor":"pending"},{"campo":"days_since_quote","operador":"gte","valor":15},{"campo":"orders_after_latest_quote","operador":"eq","valor":0}]}'::jsonb,
    true
  ),
  (
    'regras_erp', 'primeira_compra_pos_venda', 'Primeira Compra / Pós-Venda',
    'Clientes com exatamente um pedido.',
    '{"versao":1,"regras":[{"campo":"total_orders","operador":"eq","valor":1}]}'::jsonb,
    true
  ),
  (
    'regras_erp', 'ativos_recorrentes', 'Ativos Recorrentes',
    'Clientes com pelo menos cinco pedidos e compra há menos de 60 dias.',
    '{"versao":1,"regras":[{"campo":"total_orders","operador":"gte","valor":5},{"campo":"days_since_purchase","operador":"lt","valor":60}]}'::jsonb,
    true
  )
ON CONFLICT ("chave") DO NOTHING;
