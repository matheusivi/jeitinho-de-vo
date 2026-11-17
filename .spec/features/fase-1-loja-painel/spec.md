# Spec: Fase 1 loja painel

> feature: fase-1-loja-painel
> status: implementada

<!--
  Spec retroativa: registra em critérios verificáveis o que a fase 1 já entrega.
  O desenho original continua em docs/superpowers/specs/2026-11-16-sistema-jeitinho-de-vo-design.md
  e o plano em docs/superpowers/plans/2026-11-16-fase-1-loja-e-painel.md (preservados, sem migração).
-->

## Contexto

A doceria Jeitinho de Vó (Nova Andradina-MS) precisa vender online só o que está pronto na vitrine, receber pedidos sem cadastro do cliente e operar produção e pedidos num painel com login seguro, porque o sistema lida com dados de cliente e, nas próximas fases, pagamento.

## Histórias

### US-001 — Cliente vê só o que tem pronto

Como cliente, quero ver no cardápio apenas o que está disponível hoje, para que eu não peça algo que acabou.

#### AC-001 — Cardápio mostra só o que tem disponível

- **Dado** produtos ativos, alguns com estoque e outros zerados ou inativos
- **Quando** o cliente abre o cardápio
- **Então** aparecem só os produtos ativos com quantidade disponível maior que zero

#### AC-002 — Categoria vazia ou desativada some do cardápio

- **Dado** uma categoria sem produtos disponíveis e outra desativada
- **Quando** o cliente abre o cardápio
- **Então** nenhuma das duas aparece

### US-002 — Cliente pede sem criar conta

Como cliente, quero montar a sacola e fechar o pedido com nome, telefone e entrega ou retirada, para que eu compre rápido e pague na entrega.

#### AC-003 — Retirada calcula o total e baixa o estoque

- **Dado** a loja aberta e produtos com estoque
- **Quando** o cliente fecha um pedido para retirar na loja
- **Então** o pedido é criado com o total dos itens, sem taxa, e o estoque diminui com a venda registrada

#### AC-004 — Entrega soma a taxa do bairro

- **Dado** um bairro ativo com taxa cadastrada
- **Quando** o cliente fecha um pedido para entrega nesse bairro
- **Então** o total é itens mais a taxa daquele bairro

#### AC-005 — Disputa pela última unidade: só um leva

- **Dado** um produto com uma única unidade disponível
- **Quando** duas pessoas tentam comprar ao mesmo tempo
- **Então** só uma reserva dá certo e o estoque nunca fica negativo

#### AC-006 — Preço enviado pelo navegador é ignorado

- **Dado** um pedido com preço e taxa adulterados no envio
- **Quando** o servidor cria o pedido
- **Então** valem os preços e a taxa do banco de dados

#### AC-007 — Pedido fora dos limites é recusado

- **Dado** um pedido com mais de 30 produtos diferentes
- **Quando** o cliente tenta finalizar
- **Então** o pedido é recusado como inválido e nada é gravado

#### AC-008 — Fora do horário o pedido é recusado

- **Dado** a loja fechada (fora de segunda a sábado, 8h às 18h)
- **Quando** alguém envia um pedido
- **Então** o servidor recusa avisando que está fechado

#### AC-009 — Preço mudou desde a sacola: avisa em vez de cobrar diferente

- **Dado** o total mostrado na sacola diferente do total atual
- **Quando** o cliente finaliza
- **Então** o pedido é recusado com aviso de preço alterado e nada é gravado

#### AC-010 — Produto de categoria desativada não é vendido

- **Dado** um produto com estoque numa categoria desativada
- **Quando** alguém tenta pedir esse produto
- **Então** o pedido é recusado como inválido

#### AC-011 — Limite de pedidos por IP vale até com envios simultâneos

- **Dado** 20 pedidos enviados ao mesmo tempo do mesmo IP
- **Quando** o servidor processa todos
- **Então** só 5 são aceitos e os demais recebem aviso de limite

#### AC-012 — Página pública do pedido não expõe dados pessoais

- **Dado** um pedido existente
- **Quando** alguém abre a página pelo código do pedido
- **Então** vê itens, totais e estado, mas não vê telefone nem endereço

### US-003 — Equipe entra no painel com segurança

Como dona ou funcionária, quero entrar no painel com e-mail e senha protegidos, para que ninguém de fora acesse pedidos e dados de clientes.

#### AC-013 — Erro de login não revela se o e-mail existe

- **Dado** um e-mail cadastrado e outro inexistente
- **Quando** alguém erra a senha em um e tenta o outro
- **Então** a resposta é a mesma mensagem de credenciais inválidas nos dois casos

#### AC-014 — Bloqueio depois de 5 falhas

- **Dado** 5 tentativas erradas do mesmo e-mail e IP em 15 minutos
- **Quando** a pessoa tenta de novo, mesmo com a senha certa
- **Então** o login fica bloqueado temporariamente

#### AC-015 — Bloqueio por e-mail mesmo trocando de IP

- **Dado** 20 falhas no mesmo e-mail vindas de IPs diferentes
- **Quando** chega a próxima tentativa
- **Então** o login daquele e-mail fica bloqueado

#### AC-016 — IP falsificado no cabeçalho é ignorado

- **Dado** um cliente que envia X-Forwarded-For inventado
- **Quando** o sistema identifica o IP para os limites
- **Então** usa o IP acrescentado pelo proxy, não o inventado

### US-004 — Equipe cuida da produção e dos pedidos

Como funcionária, quero lançar o que produzi e avançar os pedidos, para que o cardápio e a cozinha fiquem em dia, sem ver valores financeiros.

#### AC-017 — Funcionária não vê dinheiro

- **Dado** pedidos do dia
- **Quando** uma funcionária abre o painel de pedidos
- **Então** a lista dela não traz nenhum campo de valor

#### AC-018 — Só a dona registra o recebimento

- **Dado** um pedido concluído
- **Quando** alguém tenta registrar o pagamento recebido
- **Então** só a administradora consegue, e com valor válido

#### AC-027 — Pedido cancelado não recebe pagamento

- **Dado** um pedido cancelado
- **Quando** a dona tenta registrar o pagamento recebido
- **Então** o sistema recusa e o pedido continua sem recebimento

#### AC-028 — Recebimento registrado não é regravado

- **Dado** um pedido com recebimento já registrado
- **Quando** alguém tenta registrar outro valor
- **Então** o sistema recusa e mantém o valor original

#### AC-019 — "Produzi hoje" soma ao estoque e registra quem lançou

- **Dado** um produto cadastrado
- **Quando** a funcionária lança uma produção
- **Então** o estoque aumenta e o movimento guarda quem lançou

#### AC-020 — Ajuste de estoque exige motivo

- **Dado** um produto com estoque
- **Quando** alguém faz um ajuste sem motivo ou com quantidade zero
- **Então** o ajuste é recusado

#### AC-021 — Pedido segue a sequência certa de estados

- **Dado** pedidos de entrega e de retirada confirmados
- **Quando** a equipe avança o pedido
- **Então** ele passa por preparo, saiu para entrega ou pronto para retirar, e concluído, nessa ordem

#### AC-022 — Cancelar devolve o estoque uma vez só

- **Dado** um pedido em andamento
- **Quando** ele é cancelado, inclusive com dois cancelamentos ao mesmo tempo
- **Então** o estoque volta uma única vez

#### AC-023 — Pedido de ontem em andamento continua na lista

- **Dado** um pedido de ontem ainda não concluído
- **Quando** a equipe abre o painel hoje
- **Então** o pedido continua aparecendo

### US-005 — Dona cuida de produtos e bairros

Como dona, quero cadastrar produtos com foto e definir as taxas por bairro, para que a loja mostre fotos leves e cobre a entrega certa.

#### AC-024 — Foto vira WebP quadrada e leve

- **Dado** uma foto JPEG, PNG ou WebP
- **Quando** a dona envia no cadastro do produto
- **Então** o sistema gera versões WebP quadradas em 480 e 960 pixels

#### AC-025 — Arquivo que não é imagem é recusado

- **Dado** um arquivo com extensão de imagem mas conteúdo de outro tipo
- **Quando** a dona tenta enviar
- **Então** o envio é recusado

#### AC-026 — Taxa de bairro negativa é recusada

- **Dado** o cadastro de bairros
- **Quando** a dona informa taxa negativa, fracionada ou nome repetido
- **Então** o cadastro é recusado (taxa zero é aceita)

## Fora de escopo

- Pagamento online (Pagar.me: Pix e cartão), fica para a fase 2.
- Impressão na Elgin i9.
- Insumos, fichas técnicas e relatórios (fase 3), kit festa (fase 4).
- Conta de cliente, fidelidade e status automático por WhatsApp (fase 5).
- Login com Google e autenticação em dois fatores.
- Perguntas levadas para as próximas fases: se o kit festa dá baixa nos insumos (fase 3/4) e quando a nota fiscal entra no escopo.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-001 | Horário de funcionamento fixo: segunda a sábado, 8h às 18h, fuso de Campo Grande | confirmada | Matheus confirmou em 2026-11-17: "Sim, está certo" |
| ASM-002 | Limite de 5 pedidos por IP a cada 10 minutos não atrapalha clientes reais (ex.: várias pessoas na mesma rede) | confirmada | Matheus em 2026-11-17: "Manter 5 a cada 10 min" |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-001 | Registrar recebimento num pedido cancelado deve ser bloqueado? | respondida | Matheus em 2026-11-17: "Bloquear os dois casos" (cancelado não recebe e recebido não é regravado), virou AC-027 e AC-028 |
