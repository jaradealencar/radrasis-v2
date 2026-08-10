-- Empacotamento v5: adicionar tipoCaixa, remover tempoLimiteMin e valorComissao
ALTER TABLE `empacotamento_modelos_caixa`
  ADD COLUMN `tipoCaixa` varchar(32) NOT NULL DEFAULT 'padronizada' AFTER `descricao`,
  DROP COLUMN `tempoLimiteMin`,
  DROP COLUMN `valorComissao`;
