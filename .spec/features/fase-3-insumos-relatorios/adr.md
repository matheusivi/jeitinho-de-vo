<!-- onp-spec:documentation-contract=v1 -->

# ADR: fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios
> status: revisado

[PRD](prd.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Identificação e contexto

Decisões de modelagem de quantidade, custo e relatórios da fase 3. Autor: Claude (sessão Claude Code), revisão do Matheus. Data 2026-11-17. Atende AC-029 a AC-054.

## Restrições e regras anteriores

Continuam válidas: dinheiro em centavos inteiros; funcionária sem valores (AC-017); estoque de produto com reserva atômica (AC-005); produção registra quem lançou (AC-019). Nenhuma é substituída.

## Alternativas consideradas

Quantidade: (a) decimal do Postgres, (b) inteiro em milésimos da unidade base, (c) float. Escolhido (b): exato, soma sem erro de arredondamento, aceita meia receita (1,5 ovo). (a) devolve texto no driver e complica a aritmética; (c) acumula erro.

Custo: (a) custo médio ponderado, (b) PEPS por lote, (c) último preço. Escolhido (a): é o padrão de pequenos negócios, não exige controlar lote. (b) é mais exato mas pede validade e lote em cada compra; (c) oscila demais.

Custo histórico das vendas: (a) guardar o custo unitário no item do pedido, (b) recalcular depois. Escolhido (a): o relatório do mês passado não muda quando o preço da farinha sobe.

Excel: biblioteca exceljs (MIT, mantida) gera .xlsx com números tipados. Alternativa SheetJS tem licença e distribuição mais restritas na versão atual.

Gráficos: SVG gerado no servidor, sem biblioteca. Alternativa Recharts traria JavaScript no navegador para poucos gráficos.

## Decisão e justificativa

Quantidade em milésimos da unidade base (g, ml, un) em bigint; custo médio em centavos por unidade base, em ponto flutuante só para o custo unitário, com totais arredondados para centavos inteiros; custo do produto guardado no item do pedido; exceljs; SVG no servidor.

## Consequências e riscos

Ganho: relatórios estáveis e exatos. Custo: custo unitário em float pode diferir em frações de centavo; aceitável e arredondado na exibição. Embalagem fixa (lata = 395 g) não acompanha troca de marca: a dona edita o tamanho.

## Validade, revisão e substituição

Revisar se a dona precisar de controle por lote/validade (PEPS) ou de custos fixos (DRE).

## Respostas e aprovação

Matheus, 2026-11-17: "sim, pode seguir o mais detalhado possivel, desta forma ela terá uma ajuda melhor para ter o custo". Escolhas técnicas (milésimos, float do custo unitário, exceljs, SVG) são propostas do Claude listadas para o Matheus revisar.
