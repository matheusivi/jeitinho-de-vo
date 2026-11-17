<!-- onp-spec:documentation-contract=v1 -->

# PRD: fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios
> status: revisado

[ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Pedido original do cliente

> insumos: entrada por compra (quantidade e valor pago), saída automática pela receita, ajuste manual para perda e consumo avulso, alerta de estoque mínimo; relatórios: tabela de vendas por dia e por mês com fluxo de caixa, exportável para Excel; custo e margem: pode seguir o mais detalhado possivel, desta forma ela terá uma ajuda melhor para ter o custo

Origem: Matheus (desenvolvedor, representa a dona da doceria), conversa de 2026-11-16 (13 pontos de escopo) e 2026-11-17 (custo e margem). Desenho aprovado: docs/superpowers/specs/2026-11-16-sistema-jeitinho-de-vo-design.md, seções 5.5 e 5.7.

## Problema, público e contexto

Palavras do cliente: controle de entradas e saídas, estoque de insumos com receita e baixa automática, relatórios diários e mensais estilo Excel com gráficos.

Interpretação da equipe: a dona hoje não sabe o custo real de cada bolo nem quanto sobra no mês. Ela precisa de três respostas sem planilha manual: quanto tenho de cada insumo, quanto custa cada produto e quanto entrou e saiu de dinheiro.

## Resultados desejados e métricas

Linha de base: não há dados no sistema (nada de insumo cadastrado). Meta qualitativa: a dona consegue, em uma tela, ver o custo e o CMV de cada produto com receita, e exportar o mês para Excel. Métrica a coletar depois do uso real: % de produtos ativos com receita cadastrada e diferença entre CMV previsto e real (sinal de desperdício). Sem dados reais ainda, não há meta numérica.

## Requisitos e prioridades

| Requisito | Palavras do cliente / origem | Prioridade | Critérios na spec |
|---|---|---|---|
| Insumos com unidade e embalagem | "insumos em kg, g, ml, lata e outras medidas" | alta | AC-029, AC-030 |
| Compra com quantidade e valor | "entrada por compra (quantidade e valor pago)" | alta | AC-031, AC-032, AC-033, AC-034 |
| Perda e consumo avulso | "ajuste manual para perda e consumo avulso" | alta | AC-035, AC-036 |
| Receita e baixa automática | "saída automática pela receita" | alta | AC-037, AC-038, AC-039, AC-040 |
| Alerta de mínimo | "alerta de estoque mínimo" | média | AC-041, AC-042 |
| Custo e margem | "o mais detalhado possivel" | alta | AC-043, AC-044, AC-045, AC-046, AC-047 |
| Relatórios e Excel | "tabela de vendas por dia e por mês com fluxo de caixa, exportável para Excel" | alta | AC-048, AC-049, AC-050, AC-051, AC-052, AC-053, AC-054 |

## Escopo e exclusões

Dentro: o que está na spec. Fora: custos fixos por produto, kit festa, Pix/cartão (fase 2), nota fiscal, fornecedores.

## Regras de produto e domínios

1. Funcionária nunca vê dinheiro (fase 1, AC-017): vale também para custos de insumo e receita (AC-047).
2. Insumo pode ficar negativo com aviso, nunca trava a produção (desenho 5.5).
3. "Produzi hoje" continua sendo a tela mais simples (desenho 5.4): a baixa de insumos acontece por trás, sem campo novo.
4. Dinheiro em centavos inteiros; quantidade de insumo na unidade base (desenho seção 7).
5. Domínios atingidos: estoque de produto (produce), pedidos (createOrder guarda custo), painel.

## Dependências, riscos e suposições

Risco principal: custo errado se a dona cadastrar a receita ou a compra errado. Mitigação: custo incompleto é mostrado como incompleto (AC-045) e o CMV real expõe a diferença (AC-052). Suposições ASM-007 a ASM-009 na spec.

## Validação com o cliente

2026-11-17, pergunta pela ferramenta nativa sobre custo, caixa, lata e compras. Resposta literal: "mas como seria essa analise de marge, tem algum calculo como padrão ?" Depois da explicação do CMV e das propostas: "sim, pode seguir o mais detalhado possivel, desta forma ela terá uma ajuda melhor para ter o custo".
