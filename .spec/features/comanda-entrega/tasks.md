# Tasks: Comanda entrega

> feature: comanda-entrega

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

## T-029 — Via do entregador nos pedidos de entrega [concluida]

- Refs: US-022, AC-083, AC-084
- Arquivos: src/db/schema.ts, drizzle/0005_via_entrega.sql, src/lib/printing/jobs.ts, src/lib/orders/create.ts, src/app/painel/(app)/comandas/ComandasClient.tsx, tests/printing/jobs.test.ts, docs/impressora.md, docs/pendencias.md
