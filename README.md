# Jeitinho de Vó

Sistema da doceria Jeitinho de Vó: loja online, estoque e painel.

Documentos: `docs/superpowers/specs` (desenho do sistema) e `docs/superpowers/plans` (plano de cada fase).

## Rodar no computador

Precisa de Node 22 e Docker.

1. `cp .env.example .env` e preencha. Para o banco do Docker, defina também `POSTGRES_PASSWORD`.
2. `docker compose up -d db`
3. Crie o banco de testes: `docker compose exec db createdb -U jdv jdv_test`
4. `npm install`
5. `npm run db:migrate`
6. `npm run db:seed`
7. `npm run dev` e abra http://localhost:3000

## Comandos

- `npm test`: testes automáticos (usam `DATABASE_URL_TEST`).
- `npm run db:generate`: gera uma migration depois de mudar `src/db/schema.ts`.
- `npm run db:migrate`: aplica as migrations.
- `npm run db:seed`: cria o admin inicial, categorias e bairros de exemplo.
- `npm run demo`: cadastra produtos de demonstração com foto e estoque (só para mostrar; não use em produção).

## Colocar no ar

Veja `docs/deploy.md`.

## O que tem nesta versão (fases 1 e 3)

- Loja: cardápio que mostra só o que tem estoque, sacola, pedido sem cadastro, entrega por bairro ou retirada, pagamento na entrega, página de acompanhamento do pedido.
- Painel da dona: pedidos do dia, produção, ajuste de estoque, produtos com foto, categorias, bairros e taxas, equipe.
- Painel do funcionário: pedidos e produção, sem nenhum valor em dinheiro.
- Horário de atendimento: segunda a sábado, 8h às 18h (em `src/lib/store/hours.ts`).

### Fase 3: insumos, receitas, custo e relatórios

- Insumos em g, ml ou unidade, com embalagem opcional (lata 395 g, caixa 200 g, pacote 5 kg). Lançamento em kg, litro, embalagem ou unidade.
- Compras com quantidade e valor pago; custo médio ponderado atualizado a cada compra (só a dona).
- Perda e consumo avulso (equipe toda), contagem da prateleira (dona), alerta de estoque mínimo no topo do painel e sugestão de mínimo pelo consumo dos últimos 30 dias.
- Receita por produto com rendimento; "Produzi hoje" baixa os insumos na proporção e avisa se algum ficou negativo ou se o produto não tem receita.
- Custo por unidade com o peso de cada insumo, CMV, margem bruta, markup, meta de CMV editável (começa em 35%) e preço para ficar na meta.
- Cada venda guarda o custo do dia, para os relatórios antigos não mudarem quando um insumo encarece.
- Relatórios (só a dona): mês com uma linha por dia (vendido, taxas, a receber, recebido, compras, saldo do caixa), por produto, ano por mês, CMV previsto e real com perdas, gráficos e exportação para Excel com as abas Dias, Produtos, Compras e Insumos.
- Funcionária vê estoque de insumos sem nenhum valor e não acessa receitas, custos nem relatórios.
