<!-- onp-spec:documentation-contract=v1 -->

# Spec: Fase 3 insumos relatorios

> feature: fase-3-insumos-relatorios
> status: em-implementacao

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Contexto

A dona da Jeitinho de Vó precisa saber quanto tem de cada insumo, quanto custa cada produto que vende e quanto dinheiro entrou e saiu no dia e no mês, sem montar planilha à mão.

## Histórias

### US-006 — Dona cadastra insumos com unidade e embalagem

Como dona, quero cadastrar cada insumo com a unidade em que uso e a embalagem em que compro, para lançar compras e receitas do jeito que falo no dia a dia (kg, litro, lata, unidade).

#### AC-029 — Quantidade digitada em kg, litro ou embalagem vira a unidade base

- **Dado** um insumo em gramas com embalagem "lata" de 395 g
- **Quando** alguém informa 2 latas, 1,5 kg ou 300 g
- **Então** o sistema guarda 790 g, 1500 g e 300 g respectivamente

#### AC-030 — Cadastro inválido de insumo é recusado

- **Dado** o cadastro de insumos
- **Quando** a dona tenta salvar nome vazio, nome repetido ou embalagem sem tamanho
- **Então** o cadastro é recusado com a mensagem do problema

### US-007 — Dona lança compras e o sistema acompanha o custo

Como dona, quero lançar cada compra com quantidade e valor pago, para que o estoque suba e o custo do insumo fique sempre atualizado.

#### AC-031 — Compra soma ao estoque e guarda o valor pago

- **Dado** um insumo com estoque zero
- **Quando** a dona lança a compra de 5 kg por R$ 30,00
- **Então** o estoque fica em 5 kg e a compra fica registrada com o valor, a data e quem lançou

#### AC-032 — Custo médio acompanha compras com preços diferentes

- **Dado** 5 kg comprados por R$ 30,00 ainda em estoque
- **Quando** a dona compra mais 5 kg por R$ 40,00
- **Então** o custo médio passa a ser R$ 7,00 por kg

#### AC-033 — Compra com estoque negativo não distorce o custo

- **Dado** um insumo com estoque negativo (usado antes de ser lançado)
- **Quando** a dona lança uma compra
- **Então** o custo médio passa a ser o preço dessa compra

#### AC-034 — Só a dona lança compras

- **Dado** uma funcionária logada
- **Quando** ela tenta lançar uma compra
- **Então** o sistema recusa

### US-008 — Equipe registra perdas, consumo e contagem

Como funcionária ou dona, quero registrar perda e consumo avulso, e a dona quer corrigir pelo que contou na prateleira, para o estoque bater com a realidade.

#### AC-035 — Perda e consumo baixam o estoque com motivo e custo

- **Dado** um insumo com estoque e custo médio
- **Quando** alguém registra uma perda ou consumo informando o motivo
- **Então** o estoque diminui e o movimento guarda quem lançou, o motivo e quanto custou; sem motivo ou com quantidade zero é recusado

#### AC-036 — Contagem corrige o estoque pela diferença

- **Dado** um insumo com 3 kg no sistema
- **Quando** a dona informa que contou 2,6 kg
- **Então** o estoque fica 2,6 kg e o movimento registra a diferença de 400 g

### US-009 — Receita do produto e baixa automática

Como dona, quero cadastrar a receita de cada produto com o rendimento, para que ao lançar "Produzi hoje" os insumos saiam sozinhos.

#### AC-037 — Receita inválida é recusada

- **Dado** o cadastro de receita de um produto
- **Quando** a dona informa rendimento zero, insumo repetido ou quantidade zero
- **Então** a receita é recusada

#### AC-038 — Produção baixa os insumos na proporção do rendimento

- **Dado** uma receita que rende 10 unidades e usa 1 kg de farinha
- **Quando** a equipe lança a produção de 5 unidades
- **Então** saem 500 g de farinha, com o movimento ligado à produção e ao custo do momento

#### AC-039 — Insumo insuficiente não trava a produção e avisa

- **Dado** uma receita que precisa de mais farinha do que tem
- **Quando** a equipe lança a produção
- **Então** a produção é registrada, a farinha fica negativa e o retorno avisa quais insumos ficaram negativos

#### AC-040 — Produto sem receita produz e avisa

- **Dado** um produto sem receita cadastrada
- **Quando** a equipe lança a produção
- **Então** o estoque do produto sobe e o retorno avisa que nenhum insumo foi baixado

### US-010 — Alerta de estoque mínimo

Como dona, quero ser avisada quando um insumo chega no mínimo e ter uma sugestão de mínimo, para não faltar nada na hora de produzir.

#### AC-041 — Insumo no mínimo aparece no alerta

- **Dado** insumos com estoque acima, igual e abaixo do mínimo
- **Quando** alguém abre o painel
- **Então** o alerta lista os que estão no mínimo ou abaixo, com os negativos primeiro

#### AC-042 — Sugestão de mínimo pelo consumo

- **Dado** um insumo que saiu 3 kg nos últimos 30 dias
- **Quando** a dona vê a sugestão de mínimo
- **Então** o sistema sugere o consumo de 7 dias (700 g) e explica a conta

### US-011 — Custo e margem de cada produto

Como dona, quero ver quanto custa cada produto pela receita e qual a margem sobre o preço, para saber se o preço está certo.

#### AC-043 — Custo por unidade com o peso de cada insumo

- **Dado** uma receita que rende 10 e usa R$ 20,00 de manteiga e R$ 10,00 de farinha
- **Quando** a dona abre o custo do produto
- **Então** vê custo de R$ 3,00 por unidade, com a manteiga respondendo por 66,7% e a farinha por 33,3%

#### AC-044 — CMV e margem com sinal acima da meta

- **Dado** um produto de R$ 12,00 com custo de R$ 3,00 e meta de CMV de 35%
- **Quando** a dona vê a margem
- **Então** vê CMV de 25%, margem bruta de 75% e markup de 4,0; um produto acima da meta fica sinalizado

#### AC-045 — Custo incompleto não vira zero

- **Dado** uma receita com um insumo que nunca foi comprado
- **Quando** o sistema calcula o custo
- **Então** o custo aparece como incompleto, apontando o insumo sem preço

#### AC-046 — Venda guarda o custo do momento

- **Dado** um produto com custo calculado
- **Quando** um pedido é criado e depois o preço do insumo muda
- **Então** o item do pedido mantém o custo da hora da venda

#### AC-047 — Funcionária não vê custo

- **Dado** uma funcionária logada
- **Quando** ela abre a lista de insumos
- **Então** vê nome, estoque e situação, sem nenhum valor em dinheiro

### US-012 — Relatórios do dia, do mês e do ano

Como dona, quero uma tabela do mês com uma linha por dia, o resultado por produto e o fluxo de caixa, exportável para Excel, para acompanhar o negócio sem planilha manual.

#### AC-048 — Tabela do mês com uma linha por dia

- **Dado** pedidos, recebimentos e compras em dias diferentes do mês
- **Quando** a dona abre o relatório do mês
- **Então** cada dia mostra pedidos, itens, vendido, taxas de entrega, a receber, recebido, compras e saldo; cancelados ficam fora e o dia segue o fuso da loja

#### AC-049 — Recebimento entra no caixa no dia em que foi recebido

- **Dado** um pedido de um dia recebido no dia seguinte
- **Quando** a dona vê o relatório
- **Então** a venda conta no dia do pedido e o dinheiro entra no caixa no dia do recebimento

#### AC-050 — Resultado por produto

- **Dado** vendas de produtos com custo guardado
- **Quando** a dona abre o relatório por produto
- **Então** vê quantidade, faturamento, custo, margem e CMV de cada um

#### AC-051 — Visão do ano por mês

- **Dado** vendas e compras em meses diferentes
- **Quando** a dona abre a visão do ano
- **Então** vê vendido, recebido, compras e saldo de cada mês

#### AC-052 — CMV previsto e CMV real do mês

- **Dado** vendas com custo guardado e saídas de insumo fora da receita (perda, consumo, contagem)
- **Quando** a dona vê o resumo do mês
- **Então** vê o CMV previsto pela receita, o CMV real (previsto mais perdas, consumo e contagem) e a diferença entre eles; produção que ainda está na vitrine não conta como custo

#### AC-055 — Produto pronto descartado entra nas perdas

- **Dado** um produto com receita na vitrine
- **Quando** a equipe ajusta o estoque para baixo (passou da validade, quebrou)
- **Então** o ajuste guarda o custo da receita das unidades e esse valor entra nas perdas e no CMV real do mês; produto sem receita fica sem custo

#### AC-053 — Exportação para Excel

- **Dado** o relatório de um mês
- **Quando** a dona exporta
- **Então** recebe um arquivo .xlsx com as abas Dias, Produtos, Compras e Insumos, com números como número

#### AC-054 — Só a dona vê relatórios

- **Dado** uma funcionária logada
- **Quando** ela tenta abrir relatórios ou exportar
- **Então** o sistema recusa

## Fora de escopo

- Custos fixos (aluguel, luz, gás, mão de obra) por produto: não dá para dividir com precisão; ficam para uma fase de DRE se a dona pedir.
- Kit festa e sua baixa de insumos (fase 4, decisão em aberto com a dona).
- Pagamento online por Pix e cartão nos relatórios (fase 2; a estrutura já separa por forma de pagamento).
- Nota fiscal e cadastro de fornecedores.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-003 | Fluxo de caixa: vendas recebidas entram, compras de insumo saem | confirmada | Matheus em 2026-11-17: "sim, pode seguir" |
| ASM-004 | Lata e outras embalagens têm peso ou volume cadastrado; receita pode usar embalagem ou a unidade base | confirmada | Matheus em 2026-11-17: "sim, pode seguir" |
| ASM-005 | Só a dona lança compras; funcionária lança perda e consumo | confirmada | Matheus em 2026-11-17: "sim, pode seguir" |
| ASM-006 | Custo e margem por produto entram na fase 3, o mais detalhado possível | confirmada | Matheus em 2026-11-17: "sim, pode seguir o mais detalhado possivel" |
| ASM-007 | Meta de CMV começa em 35% e a dona pode mudar | confirmada | Matheus em 2026-11-17: "Meta de CMV começa em 35%" |
| ASM-008 | Sugestão de mínimo = consumo médio diário dos últimos 30 dias × 7 dias | confirmada | Matheus em 2026-11-18: "Sugestão de mínimo igual a 7 dias de consumo isso seria interessante também" |
| ASM-009 | Custo médio ponderado pelas compras (sem PEPS) | aberta | Matheus em 2026-11-18: "o custo médio ponderado não no momento, depois quero entender melhor"; segue o custo médio já implementado até a decisão |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-004 | Quais mínimos a dona quer para os insumos principais? (o sistema sugere, ela confirma) | respondida | Matheus em 2026-11-17: "A média dos produtos a respeito do que a média limite, né, para depois mostrar que está acabando, é a dona que vai fazer." A dona define na tela de cada insumo |
