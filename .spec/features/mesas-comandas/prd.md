<!-- onp-spec:documentation-contract=v1 -->

# PRD: mesas e comandas

> feature: mesas-comandas
> status: revisado

[ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Pedido original do cliente

> Mesas: a cliente quer mesas; terá 8 mesas por enquanto no salão; uma comanda por mesa, o que gastou cada mesa separadamente, como restaurante. Garçom lança pelo celular e no balcão; conta pode ser dividida; sem taxa de serviço; comanda sai na impressora Elgin (no balcão) para a cozinha; pedidos do site também imprimem; estoque da vitrine; cada garçom tem conta própria; impressão por página do painel aberta no Chrome do notebook.

Origem: Matheus, conversas de 2026-11-18 a 2026-11-25 (pedido da dona: "A cliente quer mesas... comanda para cada mesa, o que gastou cada mesa, separadamente").

## Problema, público e contexto

Palavras do cliente: "precisamos atender como se fosse uma comanda para cada mesa, o que gastou cada mesa, separadamente". Interpretação: o salão hoje não tem controle; a conta de cada mesa e a comanda da cozinha precisam sair do sistema, com o estoque e o caixa batendo.

## Resultados desejados e métricas

Toda venda do salão registrada numa mesa e nos relatórios. Métrica após uso: mesas fechadas por dia e diferença zero entre recebido nas mesas e o caixa conferido pela dona. Sem linha de base.

## Requisitos e prioridades

| Requisito | Palavras do cliente / origem | Prioridade | Critérios na spec |
|---|---|---|---|
| Abrir mesa e lançar itens | "comanda para cada mesa" | alta | AC-068, AC-069, AC-071 |
| Comanda na impressora | "sai na impressora Elgin para a cozinha" | alta | AC-070, AC-078, AC-079 |
| Fechar e dividir | "A conta pode ser dividida" | alta | AC-072, AC-073, AC-074, AC-075, AC-076 |
| Cancelar mesa aberta por engano | proposta do Claude | média | AC-077 |
| Número de mesas | "8 mesas por enquanto" | média | AC-080 |
| Relatórios | estoque e caixa já existentes | alta | AC-081 |
| Preços para a equipe só nas mesas | "Vê só nas mesas" | alta | AC-082 |

## Escopo e exclusões

Fora: QR code na mesa, nota fiscal, taxa de serviço, programa instalado no Windows.

## Regras de produto e domínios

1. Funcionária não vê custos nem relatórios (fase 1 AC-017 e fase 3 AC-047); nas mesas, vê preços e total (decisão de 2026-11-25).
2. Estoque da vitrine é o mesmo do site (fase 1).
3. Venda de mesa entra no caixa no dia do pagamento (fase 3 AC-049).

## Dependências, riscos e suposições

Depende do Chrome aberto no notebook com impressão silenciosa. Risco: página fechada para de imprimir; mitigação: aviso na tela de Mesas quando há comanda pendente há mais de 1 minuto.

## Validação com o cliente

Respostas literais na tabela de suposições da spec (ASM-015 a ASM-020).
