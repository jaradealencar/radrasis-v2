# Teste visual real do modal do card (10/08/2026)

URL testada: https://3000-ialgxtx0itunsq0u7tdo2-0d7338a7.us2.manus.computer/logistica/solicitacoes
Card usado: OS #6811 — ART BRASIL COMUNICACAO VISUAL (Cassilândia/MS, CEP 79540-000)

## Antes da correção (modal aberto)
Presentes: OS, razão social, Aprovação, Entrega, Vendedor, CNPJ, Destino (cidade/UF), Peso, Volumes, Solicitante, Status.
Ausentes: CEP, Vol. total (cubagem), Dimensões por volume (L×C×A · peso), transportadoras selecionadas com R$/dias úteis, sugestões por cidade.

## Depois da correção
Modal passou a reutilizar os componentes do card (DadosFixosCard, OpcoesFreteNoCard, CardTransportadorasPorCidade).
Confirmado no navegador:
- CEP: 79540-000
- Cidade: Cassilândia/MS
- Volumes: 1 · 1,00 kg
- Vol. total: 1 cm³
- Dimensões (L×C×A): 1×1×1 cm · 1 kg
- Sugestões: "4 atendem Cassilândia/MS · 3 vaga(s)" (Braspress, Correios, KM Transportes, Expresso Queiroz MS)
- Após "Adicionar 3 selecionada(s)": bloco "Transportadoras selecionadas (3)" com input R$ e d.ú. por transportadora, tanto no modal quanto no card minimizado
- Valor 320,90 digitado no campo da Braspress dentro do modal

## Bug pendente identificado no teste
Campo Entrega exibe `Thu Jul 23 2026 00:00:00 GMT+0000 (Coordinated Universal Time)` em vez de `23/07/2026`.
Ocorre no card minimizado e no modal. Origem: valor vindo do cache/API é convertido com toString() em vez de formatação pt-BR.
