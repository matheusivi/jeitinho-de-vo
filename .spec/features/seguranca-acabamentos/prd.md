<!-- onp-spec:documentation-contract=v1 -->

# PRD: segurança e acabamentos

> feature: seguranca-acabamentos
> status: revisado

[ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Pedido original do cliente

> Segurança e acabamentos: código no celular (Google Authenticator) obrigatório para a dona e opcional para funcionárias; recuperação por códigos impressos; tirar o ano 'desde 2017'; passar a administração para o e-mail dela; arrumar o menu

Origem: Matheus, 2026-11-24, ao escolher "Segurança e acabamentos (Recomendado)" e responder às perguntas sobre código obrigatório, recuperação e o texto "desde 2017". O pedido de autenticação pelo Google Authenticator vem do desenho aprovado (2026-11-16).

## Problema, público e contexto

Palavras do cliente: "o sistema tem que ser com autenticação e seguro pois vamos trabalhar com formas de pagamento e dados de cliente". Um colega dele alertou que, com a nota fiscal ligada, quem invadir o painel poderia emitir notas em nome da empresa.

Interpretação da equipe: a conta da dona precisa de um segundo fator antes de a nota fiscal ser ligada; os ajustes de texto e de fontes saem junto porque são pequenos.

## Resultados desejados e métricas

Toda administradora ativa com código no celular. Sem linha de base (função nova). Métrica operacional: zero contas de administradora sem código depois do primeiro acesso.

## Requisitos e prioridades

| Requisito | Palavras do cliente / origem | Prioridade | Critérios na spec |
|---|---|---|---|
| Código no celular para a dona | "Obrigatório para a dona, opcional para funcionárias" | alta | AC-056, AC-057, AC-058, AC-059, AC-060, AC-062 |
| Recuperação por códigos impressos | "Códigos de recuperação impressos" | alta | AC-061 |
| Código opcional para funcionárias | idem | média | AC-063, AC-064 |
| Passar a administração | "passar para o e-mail dela" (2026-11-18) | média | AC-065, AC-066 |
| Fontes no próprio site | proposta do Claude, aceita no bloco | baixa | AC-067 |
| Tirar "desde 2017" | "Tirar o ano" | baixa | tarefa T-022 |

## Escopo e exclusões

Dentro: o que está na spec. Fora: login com Google, código para clientes, comando de servidor para zerar o código da dona.

## Regras de produto e domínios

1. Login da fase 1 (AC-013, AC-014, AC-015) continua igual na parte da senha; o código entra depois da senha.
2. Funcionária continua sem ver dinheiro (AC-017).
3. Sempre existe pelo menos uma administradora ativa.

## Dependências, riscos e suposições

Nova variável de ambiente AUTH_SECRET no servidor. Risco: dona perder celular e códigos ao mesmo tempo; mitigação: orientação para guardar os códigos impressos, e o Matheus, com acesso ao banco, ainda consegue intervir manualmente. Suposições ASM-013 e ASM-014 na spec.

## Validação com o cliente

2026-11-24, AskUserQuestion: "Segurança e acabamentos (Recomendado), Mesas com comanda na impressora, Conta de cliente, WhatsApp e fidelidade"; "Tirar o ano"; "Obrigatório para a dona, opcional para funcionárias (Recomendado)"; "Códigos de recuperação impressos (Recomendado)".
