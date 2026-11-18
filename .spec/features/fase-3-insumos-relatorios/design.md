<!-- onp-spec:documentation-contract=v1 -->

# TDD: fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## 1. Identificação e responsáveis

Autor: Claude (Claude Code). Responsável técnico e revisor: Matheus. Versão 1, 2026-11-17.

## 2. Contexto e sistema atual

Fase 1 entregou produtos com estoque pronto (src/lib/stock/stock.ts), pedidos (src/lib/orders), painel com papéis ADMIN e STAFF. Spec anterior: .spec/features/fase-1-loja-painel/spec.md.

## 3. Problema e motivação

Sem insumos e custo, a dona não sabe a margem nem o fluxo de caixa (PRD). Sem a fase 3, o sistema só vende.

## 4. Escopo e não objetivos

Escopo: AC-029 a AC-054. Não objetivos: custos fixos, PEPS, fornecedores, kit festa, Pix/cartão.

## 5. Solução e arquitetura

Dados novos (migração 0001):

1. `ingredients`: nome único, `base_unit` (g, ml, un), `package_name` e `package_size_milli` opcionais, `stock_milli` bigint, `min_milli` bigint, `avg_cost_cents_per_base` double, `active`.
2. `ingredient_movements`: tipo PURCHASE, PRODUCTION, LOSS, CONSUMPTION, COUNT; `qty_milli` com sinal, `cost_cents` (pago na compra, custo estimado nas saídas), `reason`, `stock_movement_id` para ligar à produção, `user_id`, `created_at`.
3. `recipes` (um por produto, `yield_qty`) e `recipe_items` (insumo, `qty_milli`, único por receita).
4. `settings` chave/valor: `cmv_target_bps` (3500).
5. `order_items.unit_cost_cents` (nulo quando o custo está incompleto).

Módulos:

1. `src/lib/ingredients/units.ts`: conversão de entrada (kg, g, l, ml, un, embalagem) para milésimos da unidade base e formatação.
2. `src/lib/ingredients/ingredients.ts`: cadastro, compra (custo médio ponderado; com estoque ≤ 0 o custo vira o da compra), perda, consumo, contagem, alertas, sugestão de mínimo.
3. `src/lib/ingredients/recipes.ts`: salvar receita, baixar insumos de uma produção (`consumeForProduction`).
4. `src/lib/ingredients/costing.ts`: custo unitário com detalhamento, CMV, margem, markup, meta.
5. `src/lib/reports/*.ts`: relatório do mês, por produto, do ano, CMV previsto e real, e o gerador de Excel.

Fluxo da produção: `produce` (fase 1) passa a chamar `consumeForProduction` na mesma transação e devolve `{ warnings }` com insumos negativos ou falta de receita. Fluxo do pedido: `createOrder` grava `unit_cost_cents` de cada item a partir de `costing`.

Telas: /painel/insumos (todos, sem dinheiro para STAFF), /painel/receitas (ADMIN), /painel/relatorios com gráficos SVG e /painel/relatorios/exportar (ADMIN), alerta de mínimo em /painel.

## 6. Riscos e mitigação

| Risco | Evidência / hipótese | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| Receita cadastrada errada gera custo errado | hipótese | média | alto | detalhamento por insumo e CMV real × previsto | dona |
| Produção pesada demais em transação | poucos insumos por receita | baixa | baixo | uma consulta por receita, update por insumo | Claude |
| Funcionária ver custo | regra AC-017 | baixa | alto | objetos de STAFF sem campos de dinheiro, teste AC-047 | Claude |
| Fuso errado no relatório | já tratado na fase 1 | baixa | médio | `localDayRange` de hours.ts, teste AC-048 | Claude |

## 7. Plano de implementação

T-009 dados e unidades → T-010 insumos → T-011 receitas e produção → T-012 custo → T-013 relatórios e Excel → T-014 e T-015 telas → T-016 demo e documentação. Sequencial: todas mexem no schema ou dependem da anterior.

## 8. Segurança e privacidade

Toda função com dinheiro chama `assertRole(user, "ADMIN")` no servidor; páginas usam `requireRole`. Exportação Excel só para ADMIN e sem dados pessoais de cliente (nome e telefone ficam fora do arquivo). Entradas validadas com zod e limites de quantidade.

## 9. Estratégia de testes

Cada AC tem teste Vitest contra Postgres real com a marca `@spec:AC-xxx`. Regressão: os 125 testes da fase 1 continuam passando, inclusive AC-019 (produção registra quem lançou).

## 10. Operação e observabilidade

Movimentos de insumo ficam auditáveis (quem, quando, motivo). Erros de servidor aparecem no log do contêiner, sem dados de cliente.

## 11. Reversão e recuperação

Migração só adiciona tabelas e uma coluna anulável; reverter = voltar a imagem anterior, dados novos ficam sem uso. Backup diário (scripts/backup.sh) antes do deploy.

## 12. Métricas de sucesso

% de produtos ativos com receita; diferença entre CMV previsto e real no mês. Medidas a partir do uso real; sem metas numéricas ainda.

## 13. Glossário e domínios

Insumo: ingrediente ou embalagem comprado. Unidade base: g, ml ou un. Embalagem: como compra (lata 395 g). CMV: custo dos insumos ÷ preço de venda. Margem bruta: 1 − CMV. Markup: preço ÷ custo. Saldo do caixa: recebido − compras.

## 14. Alternativas e decisões

Ver ADR: milésimos, custo médio ponderado, custo guardado na venda, exceljs, SVG.

## 15. Dependências e compatibilidade

Nova dependência exceljs 4.4. Postgres 16 (bigint e double nativos).

## 16. Performance e capacidade

Volume esperado: dezenas de pedidos por dia. Relatório do mês agrega no banco com GROUP BY por dia; sem meta de latência medida ainda.

## 17. Migração e implantação

Migração 0001 aditiva, aplicada no início do contêiner como na fase 1. Pedidos antigos ficam com `unit_cost_cents` nulo e aparecem como "sem custo" no relatório por produto.

## 18. Perguntas e suposições

ASM-007 a ASM-009 e Q-004 na spec; nenhuma bloqueia a implementação, todas são editáveis pela dona.

## 19. Marcos e acompanhamento

Um commit por tarefa na branch fase-3; lista de tarefas do harness.

## 20. Revisão e rastreabilidade

PRD → ADR → este TDD → spec AC-029..AC-054 → tasks T-009..T-016 → testes `@spec`. Revisor: Matheus.

Estrutura baseada no [Technical Design Doc Creator, Tech Leads Club](https://github.com/tech-leads-club/agent-skills/blob/main/packages/skills-catalog/skills/%28creation%29/create-technical-design-doc/SKILL.md); texto e requisitos de rastreabilidade adaptados para este projeto.
