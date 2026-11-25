<!-- onp-spec:documentation-contract=v1 -->

# Tasks: Mesas comandas

> feature: mesas-comandas

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Pesquisa](research.md)

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-023 — Dados de mesas, pagamentos e fila de impressão [concluida]

- Refs: US-017, US-018, US-019, US-020
- Arquivos: src/db/schema.ts, drizzle/0004_mesas.sql, tests/setup.ts, tests/helpers.ts

## T-024 — Abrir mesa, lançar e tirar itens, cancelar e configurar mesas [concluida]

- Refs: US-017, US-020, AC-068, AC-069, AC-070, AC-071, AC-077, AC-080
- Arquivos: src/lib/tables/tables.ts, src/lib/stock/stock.ts, tests/tables/tables.test.ts

## T-025 — Fechar conta: inteira, dividida e por itens [concluida]

- Refs: US-018, AC-072, AC-073, AC-074, AC-075, AC-076
- Arquivos: src/lib/tables/payments.ts, tests/tables/payments.test.ts

## T-026 — Fila de impressão e comanda do site [concluida]

- Refs: US-019, AC-070, AC-078, AC-079
- Arquivos: src/lib/printing/jobs.ts, src/lib/orders/create.ts, tests/printing/jobs.test.ts

## T-027 — Telas de mesas e de comandas [concluida]

- Refs: US-017, US-018, US-019, US-020, AC-082
- Arquivos: src/app/painel/(app)/mesas/page.tsx, src/app/painel/(app)/mesas/actions.ts, src/app/painel/(app)/mesas/MesasForms.tsx, src/app/painel/(app)/mesas/[numero]/page.tsx, src/app/painel/(app)/mesas/[numero]/MesaClient.tsx, src/app/painel/(app)/comandas/page.tsx, src/app/painel/(app)/comandas/ComandasClient.tsx, src/app/painel/(app)/comandas/actions.ts, src/lib/tables/split.ts, src/app/painel/(app)/layout.tsx, src/app/painel/painel.css

## T-028 — Relatórios, lista de pedidos e documentação [concluida]

- Refs: US-021, AC-081
- Arquivos: src/lib/orders/views.ts, src/lib/orders/transitions.ts, src/lib/orders/public.ts, src/lib/reports/monthly.ts, docs/impressora.md, docs/pendencias.md, README.md, tests/tables/reports.test.ts
