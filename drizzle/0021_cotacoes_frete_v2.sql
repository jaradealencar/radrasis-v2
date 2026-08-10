-- Adicionar campos observacaoGol, fotoUrl, empacotamentoPedidoId e empacotamentoPedidoNumero à tabela cotacoes_frete
ALTER TABLE `cotacoes_frete`
  ADD COLUMN `observacaoGol` text,
  ADD COLUMN `fotoUrl` text,
  ADD COLUMN `empacotamentoPedidoId` int,
  ADD COLUMN `empacotamentoPedidoNumero` varchar(64);
