<!-- onp-spec:documentation-contract=v1 -->

# Tasks: Fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios

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

## T-009 — Dados e unidades [concluida]

- Refs: US-006, AC-029, AC-030
- Arquivos: src/db/schema.ts, drizzle/0001_insumos.sql, src/lib/ingredients/units.ts, tests/setup.ts, tests/helpers.ts, tests/ingredients/units.test.ts

## T-010 — Insumos: cadastro, compras, perdas e contagem [concluida]

- Refs: US-006, US-007, US-008, US-010, AC-030, AC-031, AC-032, AC-033, AC-034, AC-035, AC-036, AC-041, AC-042, AC-047
- Arquivos: src/lib/ingredients/ingredients.ts, tests/ingredients/ingredients.test.ts

## T-011 — Receitas e baixa na produção [concluida]

- Refs: US-009, AC-037, AC-038, AC-039, AC-040
- Arquivos: src/lib/ingredients/recipes.ts, src/lib/stock/stock.ts, tests/ingredients/recipes.test.ts

## T-012 — Custo e margem [concluida]

- Refs: US-011, AC-043, AC-044, AC-045, AC-046
- Arquivos: src/lib/ingredients/costing.ts, src/lib/settings.ts, src/lib/orders/create.ts, tests/ingredients/costing.test.ts

## T-013 — Relatórios e Excel [concluida]

- Refs: US-012, AC-048, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054
- Arquivos: src/lib/reports/monthly.ts, src/lib/reports/excel.ts, tests/reports/reports.test.ts, package.json, package-lock.json

## T-014 — Telas de insumos, receitas e produção [concluida]

- Refs: US-006, US-007, US-008, US-009, US-010, US-011
- Arquivos: src/app/painel/(app)/insumos/page.tsx, src/app/painel/(app)/insumos/[id]/page.tsx, src/app/painel/(app)/insumos/format.ts, src/app/painel/(app)/insumos/actions.ts, src/app/painel/(app)/insumos/InsumoForms.tsx, src/app/painel/(app)/receitas/page.tsx, src/app/painel/(app)/receitas/[productId]/page.tsx, src/app/painel/(app)/receitas/actions.ts, src/app/painel/(app)/receitas/RecipeForm.tsx, src/app/painel/(app)/producao/actions.ts, src/app/painel/(app)/producao/StockForms.tsx, src/app/painel/(app)/page.tsx, src/app/painel/(app)/layout.tsx, src/app/painel/painel.css

## T-015 — Telas de relatórios, gráficos e exportação [concluida]

- Refs: US-012, AC-053, AC-054
- Arquivos: src/app/painel/(app)/relatorios/page.tsx, src/app/painel/(app)/relatorios/exportar/route.ts, src/components/painel/BarChart.tsx

## T-016 — Demonstração e documentação [concluida]

- Refs: US-011, US-012
- Arquivos: scripts/demo.ts, README.md, docs/deploy.md

## T-017 — Produto pronto descartado no CMV real [concluida]

- Refs: US-012, AC-055
- Arquivos: src/db/schema.ts, drizzle/0002_custo_ajuste_produto.sql, src/lib/stock/stock.ts, src/lib/reports/monthly.ts, src/lib/reports/excel.ts, src/app/painel/(app)/relatorios/page.tsx, src/app/painel/(app)/producao/StockForms.tsx, tests/reports/reports.test.ts
- Notas: decisão do Matheus em 2026-11-18: "sim, o bolo descartado entra na contagem".
