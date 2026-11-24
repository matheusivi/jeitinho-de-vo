<!-- onp-spec:documentation-contract=v1 -->

# Pesquisa de produto: segurança e acabamentos

> feature: seguranca-acabamentos
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md)

## Pergunta e hipótese

Qual segundo fator protege a conta da dona sem atrapalhar a rotina? Hipótese: código de aplicativo (TOTP), que é o padrão dos bancos e do Google, com códigos de recuperação.

## Concorrentes e alternativas

| Produto / alternativa | Comportamento observado | Fonte primária | Data da consulta | Limitações |
|---|---|---|---|---|
| Padrão TOTP | Código de 6 dígitos a cada 30 s gerado no celular a partir de um segredo compartilhado | RFC 6238, https://www.rfc-editor.org/rfc/rfc6238 | 2026-11-24 | Padrão técnico, não estudo de uso |
| Pagar.me (Stone) | Dashboard usa autenticação de dois fatores por aplicativo autenticador | https://conteudo.stone.com.br/autenticacao-de-dois-fatores-2fa/ | 2026-11-17 | Página institucional |

## Evidências e dados

A dona já precisou usar autenticador para o Pagar.me (relato do Matheus em 2026-11-17), então o aplicativo não é novidade para ela.

## Viabilidade matemática e estatística

Código de 6 dígitos com janela de 3 passos e 5 tentativas por desafio: chance de acerto por tentativa de login ≈ 5 × 3 / 10^6 = 0,0015%, e cada desafio exige a senha correta antes.

## Proposta e alternativas ao pedido

Proposta: TOTP obrigatório para administradora, opcional para funcionária, recuperação por 8 códigos. Alternativas apresentadas: obrigatório para todas, opcional para todas; recuperação por comando do servidor.

## Decisão e experimento

Matheus escolheu as opções recomendadas em 2026-11-24. Sem experimento.
