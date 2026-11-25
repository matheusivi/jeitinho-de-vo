<!-- onp-spec:documentation-contract=v1 -->

# Spec: Mesas e comandas

> feature: mesas-comandas
> status: pronta

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Contexto

A doceria tem um salão com 8 mesas. O garçom precisa abrir a mesa, lançar o que a mesa pede, mandar a comanda para a cozinha e, no fim, fechar a conta inteira ou dividida, como num restaurante. A impressora Elgin i9 fica no balcão, ligada ao notebook, e também precisa imprimir os pedidos do site.

## Histórias

### US-017 — Garçom abre a mesa e lança os pedidos

Como garçom, quero abrir uma mesa e lançar os itens pelo celular ou pelo balcão, para a cozinha receber a comanda e a conta da mesa ir somando.

#### AC-068 — Mesa livre abre uma vez só

- **Dado** uma mesa livre
- **Quando** dois garçons tentam abrir a mesma mesa ao mesmo tempo
- **Então** só uma comanda é aberta, registrando quem abriu; a mesa aparece ocupada

#### AC-069 — Lançar itens baixa o estoque da vitrine e soma na conta

- **Dado** uma mesa aberta e produtos com estoque
- **Quando** o garçom lança itens
- **Então** o estoque cai, a conta soma os itens com o preço e o custo do momento; se faltar estoque de algum item, nada do lançamento é gravado

#### AC-070 — Cada lançamento gera uma comanda só com os itens novos

- **Dado** uma mesa que já tem itens
- **Quando** o garçom lança mais itens
- **Então** sai uma comanda com o número da mesa, o nome do garçom e só os itens desse lançamento

#### AC-071 — Tirar item antes de fechar devolve o estoque

- **Dado** um item lançado numa mesa aberta
- **Quando** alguém tira o item informando o motivo
- **Então** o estoque volta, a conta diminui e o movimento guarda quem tirou e o motivo; sem motivo é recusado

### US-018 — Fechar a conta inteira ou dividida

Como garçom ou caixa, quero fechar a conta da mesa de uma vez ou dividida entre as pessoas, registrando como cada parte foi paga.

#### AC-072 — Conta inteira fecha a mesa e entra no caixa

- **Dado** uma mesa com itens
- **Quando** alguém registra o pagamento do total (dinheiro, Pix ou cartão)
- **Então** a mesa fecha, fica livre, guarda quem fechou e o valor entra como recebido no dia

#### AC-073 — Dividir igual fecha a conta sem sobrar centavo

- **Dado** uma conta de R$ 100,00 dividida entre 3 pessoas
- **Quando** o sistema calcula as partes
- **Então** as partes são R$ 33,34, R$ 33,33 e R$ 33,33, somando exatamente o total

#### AC-074 — Cada um paga o que consumiu

- **Dado** uma mesa com itens de duas pessoas
- **Quando** cada uma paga os seus itens
- **Então** cada pagamento guarda os itens pagos, um item não pode ser pago duas vezes e a mesa só fecha quando tudo foi pago

#### AC-075 — Não aceita pagar mais do que falta

- **Dado** uma mesa com R$ 20,00 em aberto
- **Quando** alguém tenta registrar R$ 25,00
- **Então** o sistema recusa; o troco do dinheiro é calculado na tela e não entra no caixa

#### AC-076 — Mesa fechada não muda

- **Dado** uma mesa já fechada
- **Quando** alguém tenta lançar item, tirar item ou registrar pagamento nela
- **Então** o sistema recusa

#### AC-077 — Mesa aberta sem itens pode ser cancelada; com itens, só pela dona

- **Dado** uma mesa aberta por engano
- **Quando** o garçom cancela uma mesa sem itens, ou tenta cancelar uma mesa com itens
- **Então** a sem itens é cancelada; a com itens só a administradora cancela, devolvendo o estoque

### US-019 — Comandas na impressora do balcão

Como equipe, quero que toda comanda saia sozinha na impressora do balcão, inclusive os pedidos do site, e poder reimprimir se o papel acabar.

#### AC-078 — Pedido do site gera comanda

- **Dado** um pedido feito pelo site
- **Quando** ele é criado
- **Então** entra uma comanda na fila com o código, retirada ou entrega e os itens, sem telefone nem endereço do cliente

#### AC-079 — Cada comanda sai uma vez só

- **Dado** a fila com comandas pendentes e dois computadores com impressão automática ligada
- **Quando** os dois buscam comandas ao mesmo tempo
- **Então** cada comanda é entregue a um só computador; reimprimir não devolve a comanda para a fila

### US-020 — Dona configura as mesas

Como dona, quero definir quantas mesas o salão tem.

#### AC-080 — Número de mesas configurável

- **Dado** 8 mesas
- **Quando** a dona muda para 10 ou para 6
- **Então** as mesas novas aparecem; uma mesa ocupada não sai até ser fechada; funcionária não muda

### US-021 — Mesas nos relatórios, fora da lista de pedidos do site

#### AC-081 — Venda de mesa entra nos relatórios e não aparece em Pedidos

- **Dado** uma mesa fechada e paga
- **Quando** a dona abre o relatório do dia e a equipe abre a tela de Pedidos
- **Então** o relatório soma a mesa (vendido, recebido, produtos, custo) e a tela de Pedidos mostra só os pedidos do site

#### AC-082 — Funcionária vê preços só nas mesas

- **Dado** uma funcionária logada
- **Quando** ela abre a mesa
- **Então** vê preços e total da mesa; custos e relatórios continuam fechados para ela

## Fora de escopo

- QR code na mesa para o cliente pedir (etapa seguinte).
- Nota fiscal no fechamento (aguarda decisão da dona).
- Taxa de serviço (não cobra).
- Programa instalado no Windows, gaveta de dinheiro e corte por comando ESC/POS.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-015 | Garçom lança pelo celular e pelo balcão, cada um com conta própria de funcionária | confirmada | Matheus em 2026-11-24/25: "no celular e no balcão" e "cada garçom terá sua própria conta" |
| ASM-016 | Conta inteira, dividir igual ou cada um paga o que consumiu; garçom ou caixa fecham; comanda leva tudo o que foi pedido | confirmada | Matheus em 2026-11-24: "é isso mesmo, sem mais" |
| ASM-017 | Impressora no balcão; pedidos do site também imprimem | confirmada | Matheus em 2026-11-24: "ambos estão no balcão" e "Sim, imprime" |
| ASM-018 | Impressão por página do painel no Chrome do notebook | confirmada | Matheus em 2026-11-25: "Pode ser a 1 mesmo" |
| ASM-019 | Equipe vê preços e total só nas mesas | confirmada | Matheus em 2026-11-25: "Vê só nas mesas (Recomendado)" |
| ASM-020 | Notebook logado numa conta de funcionária "Balcão" | confirmada | Matheus em 2026-11-25: "Uma conta de funcionária 'Balcão' (Recomendado)" |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-006 | Nenhuma pendente para esta entrega. | respondida | Registrado para manter o formato |
