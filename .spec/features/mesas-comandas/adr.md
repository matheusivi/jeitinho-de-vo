<!-- onp-spec:documentation-contract=v1 -->

# ADR: mesas e comandas

> feature: mesas-comandas
> status: revisado

[PRD](prd.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Identificação e contexto

Como representar a conta da mesa e como imprimir. Autor: Claude; revisor: Matheus; 2026-11-25. Atende AC-068 a AC-082.

## Restrições e regras anteriores

Pedidos, estoque reservado e baixado, custo guardado na venda e relatórios por pedido (fases 1 e 3) continuam valendo.

## Alternativas consideradas

Conta da mesa: (a) um pedido do tipo MESA na tabela de pedidos, com itens acrescentados ao longo do atendimento; (b) tabelas separadas de comanda. Escolhido (a): vendas, caixa, CMV, estoque e Excel já funcionam sobre pedidos; (b) obrigaria duplicar e somar duas fontes em todos os relatórios.

Pagamentos: tabela de pagamentos por pedido (forma, valor, itens pagos, quem recebeu). Ao quitar, o pedido fica RECEBIDO com o total, como os pedidos do site.

Impressão: (a) página do painel aberta no Chrome com impressão silenciosa; (b) programa no Windows com ESC/POS. Escolhido (a) pelo Matheus em 2026-11-25. Fila no banco com reserva atômica para cada comanda sair uma vez.

## Decisão e justificativa

Pedido de tipo MESA (fulfillment TABLE, pagamento "no salão"), itens com quem lançou, pagamentos em tabela própria, fila de impressão com claim atômico.

## Consequências e riscos

Ganho: relatórios sem mudança estrutural. Custo: telas de Pedidos e transições precisam ignorar pedidos de mesa.

## Validade, revisão e substituição

Revisar ao entrar o QR code (cliente lança na mesma mesa) e a nota fiscal no fechamento.

## Respostas e aprovação

Matheus, 2026-11-25: "Pode ser a 1 mesmo" (impressão) e "Então eu te dou a liberdade de fazer" (detalhes técnicos).
