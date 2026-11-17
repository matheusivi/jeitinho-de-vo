<!-- onp-spec:documentation-contract=v1 -->

# Pesquisa de produto: fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md)

## Pergunta e hipótese

Qual análise de custo e margem é padrão para confeitaria, e o que deve aparecer para a dona decidir preço? Hipótese: ficha técnica + CMV por produto + comparação com uma meta resolve a dúvida "este bolo dá lucro?".

## Concorrentes e alternativas

| Produto / alternativa | Comportamento observado | Fonte primária | Data da consulta | Limitações |
|---|---|---|---|---|
| Saipos | Ficha técnica por item, markup, CMV teórico (ficha) e CMV real (gasto efetivo, inclui desperdício) | https://saipos.com/sistema/cmv-real | 2026-11-17 | Página comercial: prova a oferta, não o uso |
| Planilha de confeitaria (planilhadefluxo) | Custo da receita + embalagem e gás, dividido pelo rendimento; markup 2,5x a 4x; margem acima de 60% como referência | https://www.planilhadefluxo.com.br/baixar/tabela-precos-confeitaria | 2026-11-17 | Referência de mercado sem metodologia publicada |
| Cielo (Abrasel/Sebrae) | CMV entre 20% e 40% conforme segmento | https://blog.cielo.com.br/financas/cmv-o-que-e-como-calcular/ | 2026-11-17 | Faixa geral, não específica de doceria |
| Planilha manual (situação atual) | Dona não tem custo por produto no sistema | conversa com o Matheus | 2026-11-16 | Não há dados de quanto tempo ela gasta |

## Evidências e dados

Sem dados da loja ainda. As faixas acima são referências públicas, não medição da Jeitinho de Vó.

## Viabilidade matemática e estatística

Custo unitário = Σ(qtd do insumo na receita × custo médio) ÷ rendimento. CMV = custo ÷ preço. Margem bruta = 1 − CMV. Markup = preço ÷ custo. CMV real do mês = custo das saídas de insumo (produção, perda, consumo) ÷ vendido; CMV previsto = Σ(custo guardado nas vendas) ÷ vendido. Sem amostra, não há análise estatística.

## Proposta e alternativas ao pedido

Proposta: custo e margem por produto com meta de CMV editável (35% inicial, dentro da faixa 20–40%), detalhamento por insumo e comparação previsto × real. Alternativa: só mostrar custo, sem meta. A meta foi proposta ao Matheus junto com a explicação.

## Decisão e experimento

Matheus, 2026-11-17: "sim, pode seguir o mais detalhado possivel". Experimento depois do uso: comparar CMV previsto e real no primeiro mês com receitas cadastradas.
