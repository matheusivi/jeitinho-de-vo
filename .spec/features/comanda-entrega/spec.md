# Spec: Comanda de entrega

> feature: comanda-entrega
> status: implementada

## Contexto

Pedido do site para entrega passa pelo entregador, que precisa saber para onde vai, como falar com a cliente e quanto cobrar. Na loja (mesa e retirada) isso não é necessário.

## Histórias

### US-022 — Entregador leva a via com endereço, telefone e valor

Como entregador, quero uma via impressa do pedido de entrega com endereço, telefone e quanto cobrar, para entregar e receber sem perguntar no balcão.

#### AC-083 — Pedido de entrega imprime a via do entregador

- **Dado** um pedido do site para entrega com pagamento na entrega
- **Quando** o pedido é criado
- **Então** além da comanda da cozinha (sem telefone nem endereço) sai uma segunda via "ENTREGA" com nome, telefone, endereço, bairro, observação, itens, taxa de entrega, total e "Cobrar na entrega"

#### AC-084 — Retirada e mesa não imprimem via de entrega

- **Dado** um pedido do site para retirada ou um lançamento de mesa
- **Quando** a comanda é gerada
- **Então** sai só a comanda da cozinha, sem telefone nem endereço

## Fora de escopo

- Pagamento online pelo site (fase 2); quando existir, a via dirá "Já pago".
- Mapa ou rota no papel.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-021 | A via de entrega leva total e forma de pagar | confirmada | Matheus em 2026-11-25: "Sim, total e forma de pagar (Recomendado)" |
| ASM-022 | Entrega sai em duas vias: cozinha e entregador | confirmada | Matheus em 2026-11-25: "Duas vias (Recomendado)" |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-007 | Nenhuma pendente para esta entrega. | respondida | Registrado para manter o formato |
