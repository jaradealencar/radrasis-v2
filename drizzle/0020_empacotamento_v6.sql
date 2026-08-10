-- Empacotamento v6: custo de aquisição na caixa + tabela insumos por letreiro

-- 1. Adicionar custo de aquisição na tabela de modelos de caixa
ALTER TABLE `empacotamento_modelos_caixa`
  ADD COLUMN `custoAquisicao` DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT 'Custo de compra da caixa em R$';

-- 2. Criar tabela de insumos vinculados a modelos de letreiro
CREATE TABLE `empacotamento_insumos_letreiro` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `modeloLetreiId` INT NOT NULL COMMENT 'FK → empacotamento_modelos.id',
  `insumoId` INT NOT NULL COMMENT 'FK → empacotamento_insumos.id',
  `quantidade` DECIMAL(10,4) NOT NULL DEFAULT 1 COMMENT 'Quantidade fixa por letreiro',
  `observacao` VARCHAR(255),
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_insumos_letreiro_modelo` (`modeloLetreiId`),
  KEY `idx_insumos_letreiro_insumo` (`insumoId`)
);
