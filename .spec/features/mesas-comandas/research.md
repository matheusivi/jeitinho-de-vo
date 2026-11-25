<!-- onp-spec:documentation-contract=v1 -->

# Pesquisa de produto: mesas e comandas

> feature: mesas-comandas
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md)

## Pergunta e hipótese

O que o salão precisa no primeiro dia? Hipótese: abrir mesa, lançar, comanda impressa, fechar inteira ou dividida.

## Concorrentes e alternativas

| Produto / alternativa | Comportamento observado | Fonte primária | Data da consulta | Limitações |
|---|---|---|---|---|
| Sistema anterior da dona | Exigia cardápio, certificado e totens (formulário enviado em 2026-11-24) | mensagem do Matheus | 2026-11-24 | Não vimos as telas |
| Chrome | Opção de linha de comando --kiosk-printing imprime na impressora padrão sem diálogo | https://peter.sh/experiments/chromium-command-line-switches/ | 2026-11-25 | Lista mantida pela comunidade |

## Evidências e dados

Respostas do Matheus registradas na spec (ASM-015 a ASM-020). Sem dados de volume do salão.

## Viabilidade matemática e estatística

Divisão igual: parte = piso(total ÷ n) e os centavos que sobram vão para as primeiras partes, para a soma bater com o total.

## Proposta e alternativas ao pedido

Proposta aceita: página no Chrome. Alternativa registrada: programa no Windows, se faltar gaveta ou corte.

## Decisão e experimento

Usar no salão e revisar depois de uma semana.
