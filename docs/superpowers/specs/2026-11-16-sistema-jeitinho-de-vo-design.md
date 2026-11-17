# Sistema Jeitinho de Vó: desenho do sistema

Data: 16/11/2026. Situação: aprovado pelo Matheus em 16/11/2026, com os ajustes abaixo já incorporados.

Legenda: **[M]** decidido pelo Matheus na conversa. **[P]** proposta do Claude, ainda não confirmada: vale se ninguém cortar.

## 1. Para que serve

A Jeitinho de Vó (doceria artesanal desde 2017, Nova Andradina, MS) vende hoje por WhatsApp e delivery e está abrindo a primeira loja física. O sistema junta num lugar só a venda online, a produção, o estoque e o caixa, em cima da home já prototipada.

Sucesso é: a cliente pede em poucos toques pelo celular; a equipe recebe a comanda impressa sem ninguém copiar pedido de WhatsApp; a dona sabe o que vendeu, o que tem e o que falta comprar, sem planilha paralela.

## 2. Objetivos, fora do escopo e o que seria fracasso

Objetivos [M]
- Loja online com cardápio que mostra só o que tem em estoque.
- Pagamento por Pix e cartão (Stone, via Pagar.me) e opção de pagar na entrega.
- Comanda impressa na Elgin i9 para cada pedido confirmado.
- Kit festa calculado por número de pessoas, ajustável pela cliente.
- Estoque de produtos prontos e de insumos, com receita e baixa automática.
- Painel com login para dona e funcionários, relatórios diários e mensais, exportação para Excel.
- Conta de cliente opcional, com atrativos para cadastrar.
- Links de Instagram, Facebook e WhatsApp.

Fora do escopo agora [M]
- Nota fiscal (o Matheus vai ver com a dona).
- IA de conversa com a cliente. A inteligência de hábitos e fidelidade fica para depois.
- Python. Tudo em TypeScript.
- Aplicativo de celular nativo. O site funciona bem no celular.

Seria fracasso mesmo funcionando
- Cardápio mostrar produto que não tem.
- A dona precisar de mais de um minuto para lançar a produção do dia.
- Funcionário enxergar dinheiro.
- Dado de cartão passar pelo nosso servidor.

## 3. Restrições

- Servidor próprio do Matheus. [M]
- Código no GitHub do Matheus, com histórico organizado. [M]
- Chaves do Pagar.me ainda não existem: cadastro do CNPJ em andamento. Construir e testar em modo de teste. [M]
- Impressora Elgin i9 ligada por cabo USB a um notebook na loja. [M]
- Número novo de WhatsApp e link do Facebook ainda vão chegar. [M]
- Segurança é requisito: pagamento e dados de cliente. [M]
- Regra de trabalho: Claude pergunta, não decide sozinho. [M]

## 4. Caminhos considerados

| Caminho | Prós | Contras |
|---|---|---|
| Next.js + PostgreSQL | Uma linguagem só; telas interativas (sacola, kit, painel); a home atual entra quase direto | Inteligência futura precisa caber em TypeScript |
| Django + PostgreSQL | Estoque e relatórios rápidos de fazer | Telas interativas dão mais trabalho; o Matheus não quer Python agora |
| Laravel + MySQL | Roda em qualquer hospedagem | Nenhuma vantagem neste caso |

Escolhido: **Next.js + PostgreSQL** [M], porque o que a cliente e a dona mais usam são telas interativas e o Matheus quer ficar em TypeScript.

## 5. Como funciona

### 5.1 Loja (cliente)

- Home atual vira a página inicial real, com cardápio vindo do banco. [M]
- Categorias: fatias, copos, bolos artesanais, bolos recheados e outras que a dona criar. [M]
- Produto com estoque zero some do cardápio; voltou o estoque, reaparece. [M]
- Bolo inteiro e fatia são produtos separados, cada um com seu estoque. [M]
- Sacola, depois checkout: entrega (bairro, com taxa da tabela) ou retirada na loja (sem taxa). [M]
- Pagamento: Pix, cartão ou pagar na entrega. [M]
- Compra sem conta é permitida: informa nome, WhatsApp e endereço. [M]
- Convite para cadastrar, com promoções e sorteios como atrativo. [M]
- Pronta entrega só dentro do horário de atendimento. Fora dele, cardápio visível e pedido bloqueado com aviso de quando abre. [M quanto ao horário fixo; P quanto ao bloqueio]
- Horário: segunda a sábado, 8h às 18h, definido em configuração, sem tela por enquanto. [P quanto aos dias e horas exatos]
- Seção "Fale conosco" com WhatsApp, Instagram e Facebook. Sem botão flutuante. [M]
- O estoque é reservado quando o pedido é criado e devolvido se o Pix expirar ou o cartão for recusado, para duas pessoas não comprarem a última fatia. [M]

### 5.2 Kit festa (fase 4)

- A dona cadastra o kit uma vez: lista de produtos, quantidade por pessoa e preço unitário. [M]
- A cliente escolhe 10, 20, 30, 50 ou digita o número; o sistema calcula quantidades e total. [M]
- A cliente aumenta ou diminui cada item e pode acrescentar produtos; o total acompanha. [M]
- A dona edita produtos, quantidades por pessoa, preços e os atalhos. [M]
- Antecedência mínima de 2 dias. [M]
- Kit é feito sob encomenda: não depende do estoque de pronta entrega. [M]
- EM ABERTO: como o kit dá baixa nos insumos (pela receita dos produtos do kit ao produzir, ou outro jeito). O Matheus vai conversar com a dona. Não implementar essa parte antes da resposta.
- Quantidade calculada arredonda para cima. [P]

### 5.3 Pedidos e comanda

Estados: aguardando pagamento, confirmado, em preparo, saiu para entrega ou pronto para retirada, concluído, cancelado. [P]

- Pago online ou marcado "pagar na entrega": vira confirmado e imprime a comanda. [M]
- Pagar na entrega fica "a receber" até a dona lançar o valor recebido. [M]
- Dona e funcionário avançam o estado no painel. Ao marcar "saiu para entrega", abre o WhatsApp com a mensagem pronta para a cliente. Envio automático (API oficial) fica para depois. [M quanto ao aviso; P quanto à forma simples primeiro]
- Comanda: número do pedido, hora, itens e quantidades, observação, entrega ou retirada, endereço e bairro, forma de pagamento. Só uso interno. [M]

Impressão: um programa pequeno em Node roda no notebook da loja, busca no servidor os pedidos ainda não impressos a cada poucos segundos, imprime na i9 (comandos ESC/POS por USB) e avisa o servidor. Se a internet ou o notebook cair, os pedidos ficam na fila e saem quando voltar. O painel mostra se a impressora está respondendo. [P]

### 5.4 Estoque de produtos prontos

- Tela "Produzi hoje": escolhe o produto, informa a quantidade, salva. Tem que ser a tela mais simples do painel. [M]
- Cada venda desconta. [M]
- Ajuste manual com motivo (perda, consumo, correção). [M]
- Toda movimentação fica registrada com quem fez e quando. [P]

### 5.5 Insumos e receitas (fase 3)

- Insumo: nome, unidade (kg, g, litro, ml, lata, unidade), estoque atual, mínimo. [M]
- Entrada por compra: quantidade e valor pago. [M]
- Receita: bloco por produto com a lista de insumos e a quantidade de cada um, e quantas unidades a receita rende. [M]
- Ao lançar produção, os insumos saem automaticamente pela receita. [M]
- Ajuste manual para perda e consumo avulso. [M]
- Alerta no painel quando um insumo chega ao mínimo, com orientação de como definir o mínimo. [M]
- Insumo pode ficar negativo com aviso, em vez de travar a produção. [M]

### 5.6 Painel, contas e permissões

- Dona (admin): tudo. [M]
- Funcionário: pedidos, produção e baixas de estoque. Nada de valores, relatórios financeiros ou configurações. [M]
- A dona cria e desativa contas de funcionário. [P]
- Cadastro de produto: nome, categoria, descrição, preço, foto, ativo. A dona cria novas categorias. [M]
- Foto: sobe qualquer imagem; o sistema recorta, reduz e converte para WebP em tamanhos para celular e computador. [M]
- Tabela de bairros com taxa, editável. [M]

### 5.7 Relatórios (fase 3)

- Tabela do mês com uma linha por dia: pedidos, itens, total vendido, por forma de pagamento, taxas de entrega, a receber. [M]
- Visão mensal e por produto, com gráfico. [M]
- Exportar para Excel (.xlsx). [M]

### 5.8 Dados para a inteligência futura

Sem IA agora, mas desde o primeiro pedido o sistema guarda histórico por cliente (o que pediu, quando, sabores). Isso alimenta depois sugestões, fidelidade (ex.: sexta fatia grátis) e padrões de consumo para a equipe. Data de nascimento só com consentimento explícito no cadastro. [M quanto à ideia; P quanto ao consentimento]

## 6. Segurança

- Cartão nunca passa pelo nosso servidor: o navegador envia os dados direto ao Pagar.me e recebemos só um código (token). [M]
- Confirmação de pagamento chega por aviso do Pagar.me (webhook), conferido por assinatura e reconsultado na API antes de liberar o pedido. [P]
- Senhas com hash forte (argon2). Sessão em cookie seguro. [P]
- Admin e funcionário: senha mais código de verificação por aplicativo autenticador. [M quanto ao segundo fator; P quanto ao aplicativo]
- Limite de tentativas de login e de pedidos por IP. [P]
- Permissão conferida no servidor em toda rota, não só escondida na tela. [P]
- Chaves e senhas só em variáveis de ambiente no servidor, fora do GitHub. [P]
- HTTPS obrigatório. Backup diário do banco. [P]
- LGPD: coletar o mínimo, página de privacidade, cliente pode pedir exclusão da conta. [P]
- Repositório privado no GitHub: matheusivi/jeitinho-de-vo. [M]

## 7. Técnica

- Next.js (App Router) com TypeScript, PostgreSQL, Prisma. [M quanto a Next e Postgres; P quanto ao Prisma]
- Um projeto só: loja, painel e API. O agente de impressão é uma pasta à parte no mesmo repositório. [P]
- Dinheiro guardado em centavos (inteiro). Quantidade de insumo na unidade base (g, ml, unidade). [P]
- Testes automáticos para as regras: estoque, reserva, cálculo de kit, baixa por receita, permissões. [P]
- Deploy no servidor do Matheus com Docker Compose (app e banco). [M]
- Visual: design system Jeitinho de Vó já criado (cores, Caprasimo e Hanken Grotesk, vovozinhas, calda). [M]

## 8. Ordem de construção [M]

1. Base, login do admin, produtos com foto, estoque pronto, cardápio real, pedido com pagar na entrega e retirada, taxa por bairro, comanda na i9.
2. Pix e cartão pelo Pagar.me.
3. Insumos, receitas, baixa automática, relatórios e Excel.
4. Kit festa.
5. Conta da cliente, aviso por WhatsApp, fidelidade.

Cada fase termina utilizável e é revisada com o Matheus antes da próxima.

## 9. Pendências do lado do Matheus

- Criar o repositório no GitHub.
- Chaves de teste do Pagar.me.
- Número novo de WhatsApp e link do Facebook.
- Lista de bairros com as taxas.
- Confirmar dias e horas do horário comercial.
- Dados do servidor para deploy (sistema, acesso, domínio).
- Quantidades por pessoa dos kits (fase 4).
- Decisão sobre nota fiscal.
