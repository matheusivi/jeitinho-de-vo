# Fase 1: loja, estoque pronto e painel de pedidos. Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar no ar uma loja que mostra só o que tem em estoque, aceita pedido sem conta com entrega por bairro ou retirada e pagamento na entrega, e um painel com login onde dona e funcionários lançam produção e tocam os pedidos.

**Architecture:** Um projeto Next.js (App Router) com as regras de negócio em `src/lib/**` como funções puras ou que recebem o cliente Prisma, testadas contra um PostgreSQL real. As páginas e Server Actions só validam entrada (zod), conferem permissão e chamam essas funções. Sessão própria em cookie httpOnly com tabela `Session`.

**Tech Stack:** Next.js estável mais recente, TypeScript estrito, PostgreSQL 16, Prisma, zod, @node-rs/argon2, sharp, Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-16-sistema-jeitinho-de-vo-design.md`

## Global Constraints

- Tudo em TypeScript. Sem Python.
- Dinheiro em centavos (`Int`). Nunca `Float` para valor.
- Produto com estoque disponível 0 não aparece no cardápio.
- Bolo inteiro e fatia são produtos separados, sem conversão.
- Horário de atendimento: segunda a sábado, 08:00 às 18:00, fuso `America/Campo_Grande`, vindo de `src/lib/store/hours.ts` (constante, sem tela).
- Papéis: `ADMIN` vê tudo; `STAFF` vê pedidos, produção e baixas, e nunca recebe valores em dinheiro nem do servidor.
- Permissão conferida no servidor em toda Server Action e rota.
- Compra sem conta: nome, WhatsApp, endereço.
- Fora desta fase: Pagar.me, impressão na i9, login com Google, segundo fator, insumos, receitas, relatórios, kit festa, conta de cliente.
- Segredos só em `.env` (fora do git). `.env.example` versionado.
- Visual: tokens do design system (surface `#EDE7D7`, cyan `#00C0D5`, cyan-deep `#006A7A`, goiaba `#CF3A4E`, goiaba-escuro `#B02E39`, ink `#10343B`, ink-muted `#3F5558`, surface-raised `#F7F3EA`), fontes Caprasimo e Hanken Grotesk. A home parte de `/home/claude/site/index.html` e seus assets.
- Textos da interface em português do Brasil.
- Commits pequenos, mensagem em português, um por task no mínimo.

## Review Focus

1. Duas pessoas compram a última unidade ao mesmo tempo: só uma consegue, a outra recebe "acabou de esgotar". (Task 4)
2. Preço ou taxa adulterados no navegador: o servidor ignora valores do cliente e recalcula tudo pelo banco. (Task 6)
3. Quantidade 0, negativa, fracionada ou absurda (ex.: 9999) na sacola: rejeitada com mensagem, sem tocar no estoque. (Task 6)
4. Pedido enviado fora do horário direto para a action: recusado no servidor, não só escondido na tela. (Task 6)
5. Funcionário chamando action de admin ou lendo valores: recusado, e as consultas de `STAFF` não trazem campos de dinheiro. (Tasks 2 e 7)

Também coberto em task: upload que não é imagem ou passa de 10 MB (Task 3); cancelamento devolve estoque uma única vez (Task 7).

---

## Estrutura de arquivos

```
docker-compose.yml            app + postgres
Dockerfile
.env.example
prisma/schema.prisma
prisma/seed.ts                admin inicial, categorias, bairros de exemplo
src/lib/db.ts                 PrismaClient único
src/lib/money.ts              formatBRL
src/lib/auth/password.ts      hash e verificação
src/lib/auth/session.ts       criar, ler, encerrar sessão
src/lib/auth/guard.ts         requireUser, requireRole
src/lib/auth/rate-limit.ts    limite de tentativas
src/lib/catalog/categories.ts
src/lib/catalog/products.ts
src/lib/catalog/images.ts     pipeline sharp
src/lib/stock/stock.ts        produzir, ajustar, reservar, devolver, confirmar
src/lib/store/hours.ts        isOpen, nextOpening
src/lib/store/menu.ts         getMenu
src/lib/orders/fees.ts        bairros e taxa
src/lib/orders/create.ts      createOrder
src/lib/orders/transitions.ts advanceOrder, cancelOrder, markReceived
src/lib/orders/views.ts       listagens por papel
src/app/(loja)/...            home, sacola, checkout, pedido/[code]
src/app/painel/...            login, pedidos, producao, produtos, categorias, bairros, equipe
src/components/...            peças visuais
tests/**                      espelha src/lib
```

---

### Task 1: Base do projeto, banco e esquema

**Files:**
- Create: projeto Next.js na raiz, `docker-compose.yml`, `Dockerfile`, `.env.example`, `.gitignore`, `prisma/schema.prisma`, `src/lib/db.ts`, `src/lib/money.ts`, `vitest.config.ts`, `tests/setup.ts`, `tests/money.test.ts`, `README.md`

**Interfaces:**
- Produces: `db` (PrismaClient) de `src/lib/db.ts`; `formatBRL(cents: number): string`; helper de teste `resetDb(): Promise<void>` em `tests/setup.ts` que trunca todas as tabelas; scripts `npm test`, `npm run dev`, `npm run db:migrate`, `npm run db:seed`.
- Modelos Prisma (nomes exatos):
  - `User { id, name, email @unique, passwordHash, role Role (ADMIN|STAFF), active Boolean @default(true), createdAt }`
  - `Session { id, tokenHash @unique, userId, expiresAt, createdAt }`
  - `LoginAttempt { id, key, createdAt }` com índice em `(key, createdAt)`
  - `Category { id, name @unique, slug @unique, position Int, active Boolean }`
  - `Product { id, name, slug @unique, description, priceCents Int, unitLabel String, categoryId, imageKey String?, active Boolean, stockOnHand Int @default(0), stockReserved Int @default(0), createdAt, updatedAt }`
  - `StockMovement { id, productId, type StockMovementType (PRODUCTION|SALE|ADJUSTMENT|CANCEL_RETURN), quantity Int (com sinal), reason String?, orderId String?, userId String?, createdAt }`
  - `Neighborhood { id, name @unique, feeCents Int, active Boolean }`
  - `Order { id, code @unique, status OrderStatus (CONFIRMED|PREPARING|OUT_FOR_DELIVERY|READY_FOR_PICKUP|DONE|CANCELED), fulfillment (DELIVERY|PICKUP), customerName, customerPhone, addressLine String?, neighborhoodId String?, notes String?, subtotalCents Int, deliveryFeeCents Int, totalCents Int, paymentMethod (ON_DELIVERY), paymentStatus (PENDING|RECEIVED), receivedCents Int?, receivedAt DateTime?, createdAt, updatedAt }`
  - `OrderItem { id, orderId, productId, productName, unitPriceCents Int, quantity Int }`
  - Restrição no banco via migration SQL: `CHECK ("stockOnHand" >= 0 AND "stockReserved" >= 0 AND "stockReserved" <= "stockOnHand")` em `Product`.

- [ ] **Step 1:** Criar o projeto com `create-next-app` (TypeScript, App Router, `src/`, ESLint, sem Tailwind) e instalar prisma, @prisma/client, zod, @node-rs/argon2, sharp, vitest.
- [ ] **Step 2:** `docker-compose.yml` com serviço `db` (postgres:16, volume, porta 5432) e serviço `app`; `.env.example` com `DATABASE_URL`, `DATABASE_URL_TEST`, `SESSION_SECRET`, `UPLOAD_DIR`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
- [ ] **Step 3:** Escrever o teste `tests/money.test.ts`:

```ts
expect(formatBRL(0)).toBe("R$ 0,00");
expect(formatBRL(1250)).toBe("R$ 12,50");
expect(formatBRL(123456)).toBe("R$ 1.234,56");
```

- [ ] **Step 4:** Rodar `npm test`, esperar FALHA por `formatBRL` não existir.
- [ ] **Step 5:** Implementar `formatBRL` com `Intl.NumberFormat("pt-BR")`, normalizando o espaço para espaço comum.
- [ ] **Step 6:** Escrever `prisma/schema.prisma` com os modelos acima, gerar a migration inicial e acrescentar o `CHECK` em SQL na mesma migration.
- [ ] **Step 7:** `tests/setup.ts` aponta o Prisma para `DATABASE_URL_TEST`, aplica migrations uma vez e exporta `resetDb`. Vitest configurado para rodar os arquivos em série.
- [ ] **Step 8:** Rodar `npm test`, esperar PASS. Rodar `npm run build`, esperar sucesso.
- [ ] **Step 9:** README com como subir local (`docker compose up db`, migrate, seed, dev). Commit: `chore: base do projeto, banco e esquema`.

---

### Task 2: Login, sessão e papéis

**Files:**
- Create: `src/lib/auth/password.ts`, `session.ts`, `guard.ts`, `rate-limit.ts`, `src/app/painel/login/page.tsx`, `src/app/painel/login/actions.ts`, `src/app/painel/layout.tsx`, `src/app/painel/equipe/page.tsx`, `src/app/painel/equipe/actions.ts`, `prisma/seed.ts`
- Test: `tests/auth/password.test.ts`, `tests/auth/session.test.ts`, `tests/auth/guard.test.ts`, `tests/auth/rate-limit.test.ts`

**Interfaces:**
- Produces:
  - `hashPassword(plain: string): Promise<string>`; `verifyPassword(hash: string, plain: string): Promise<boolean>`
  - `createSession(userId: string): Promise<{ token: string; expiresAt: Date }>` (token aleatório de 32 bytes; no banco só o SHA-256; validade 7 dias)
  - `getSessionUser(token: string | undefined): Promise<SessionUser | null>` onde `SessionUser = { id: string; name: string; role: "ADMIN" | "STAFF" }`; retorna `null` para sessão expirada ou usuário inativo
  - `destroySession(token: string): Promise<void>`
  - `requireUser(): Promise<SessionUser>` e `requireRole(role: "ADMIN"): Promise<SessionUser>`, que leem o cookie `jdv_session`; sem sessão redirecionam para `/painel/login`; papel insuficiente lança `ForbiddenError`
  - `checkRateLimit(key: string, max: number, windowMinutes: number): Promise<boolean>` e `recordAttempt(key: string): Promise<void>`
  - `login(email: string, password: string, ip: string): Promise<{ ok: true; token: string; expiresAt: Date } | { ok: false; error: "INVALID" | "BLOCKED" }>` em `session.ts`
- Cookie: `jdv_session`, `httpOnly`, `sameSite=lax`, `secure` em produção, `path=/`.

- [ ] **Step 1:** Testes de senha: hash diferente do texto; `verifyPassword` true para a senha certa e false para a errada.
- [ ] **Step 2:** Testes de sessão: `createSession` grava só o hash do token; `getSessionUser` devolve o usuário; devolve `null` com token inexistente, sessão vencida e usuário `active=false`; `destroySession` invalida.
- [ ] **Step 3:** Testes de login: senha errada devolve `INVALID` sem dizer se o e-mail existe; após 5 falhas em 15 minutos para o mesmo `email+ip` devolve `BLOCKED` mesmo com a senha certa; e-mail é comparado sem diferenciar maiúsculas.
- [ ] **Step 4:** Testes de guard com usuário injetado: `STAFF` em `requireRole("ADMIN")` lança `ForbiddenError`.
- [ ] **Step 5:** Rodar, esperar FALHA.
- [ ] **Step 6:** Implementar os quatro módulos. Argon2id com parâmetros padrão da biblioteca.
- [ ] **Step 7:** Rodar, esperar PASS.
- [ ] **Step 8:** Tela `/painel/login` (e-mail, senha, mensagem única "E-mail ou senha incorretos", mensagem de bloqueio "Muitas tentativas. Tente de novo em 15 minutos"), action de login e de sair, `layout.tsx` do painel com `requireUser` e menu que esconde itens de admin para `STAFF`.
- [ ] **Step 9:** `/painel/equipe` (só `ADMIN`): listar, criar funcionário com senha inicial, ativar e desativar. Senha mínima de 8 caracteres validada com zod.
- [ ] **Step 10:** `prisma/seed.ts` cria o admin a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD` se não existir.
- [ ] **Step 11:** Commit: `feat: login, sessão e papéis`.

---

### Task 3: Categorias, produtos e fotos

**Files:**
- Create: `src/lib/catalog/categories.ts`, `products.ts`, `images.ts`, `src/app/painel/categorias/*`, `src/app/painel/produtos/*`, `src/app/midia/[...key]/route.ts`
- Test: `tests/catalog/products.test.ts`, `tests/catalog/images.test.ts`, `tests/fixtures/foto.jpg`, `tests/fixtures/nao-imagem.txt`

**Interfaces:**
- Consumes: `requireRole`, `db`.
- Produces:
  - `createCategory(input: { name: string }): Promise<Category>`; `updateCategory`, `listCategories()`
  - `createProduct(input: ProductInput): Promise<Product>`; `updateProduct(id: string, input: ProductInput): Promise<Product>`; `ProductInput = { name: string; description: string; priceCents: number; unitLabel: string; categoryId: string; active: boolean; imageKey?: string }`
  - `slugify(name: string): string` com sufixo numérico quando o slug já existe
  - `processProductImage(buffer: Buffer): Promise<{ key: string }>` grava em `UPLOAD_DIR/<key>-480.webp` e `<key>-960.webp`; lança `ImageError("TIPO")` se não for JPEG, PNG ou WebP (conferido pelo conteúdo, não pela extensão) e `ImageError("TAMANHO")` acima de 10 MB
  - `imageUrl(key: string, size: 480 | 960): string` devolve `/midia/<key>-<size>.webp`

- [ ] **Step 1:** Testes de produto: `priceCents` precisa ser inteiro maior que 0; nome vazio é rejeitado; dois produtos com o mesmo nome recebem slugs diferentes; `slugify("Fatia de Torta de Limão")` é `"fatia-de-torta-de-limao"`.
- [ ] **Step 2:** Testes de imagem: `foto.jpg` gera dois arquivos WebP quadrados de 480 e 960 px, com orientação EXIF aplicada e cada um abaixo de 150 KB; `nao-imagem.txt` renomeado para `.jpg` lança `ImageError("TIPO")`; buffer de 11 MB lança `ImageError("TAMANHO")`.
- [ ] **Step 3:** Rodar, esperar FALHA.
- [ ] **Step 4:** Implementar. Imagem com `sharp`: `rotate()`, `resize(size, size, { fit: "cover", position: "attention" })`, `webp({ quality: 80 })`. `key` aleatório.
- [ ] **Step 5:** Rodar, esperar PASS.
- [ ] **Step 6:** Rota `/midia/[...key]` serve só arquivos `.webp` de dentro de `UPLOAD_DIR` (rejeita `..`), com cache longo.
- [ ] **Step 7:** Telas de categorias e produtos (só `ADMIN`): lista com foto, preço e situação; formulário com upload e prévia; ativar e desativar. Sem exclusão definitiva.
- [ ] **Step 8:** Commit: `feat: categorias, produtos e fotos`.

---

### Task 4: Estoque de produto pronto

**Files:**
- Create: `src/lib/stock/stock.ts`, `src/app/painel/producao/page.tsx`, `src/app/painel/producao/actions.ts`
- Test: `tests/stock/stock.test.ts`

**Interfaces:**
- Consumes: `db`, `requireUser`.
- Produces (todas aceitam um cliente de transação opcional como último parâmetro `tx`):
  - `produce(productId: string, quantity: number, userId: string): Promise<void>` soma em `stockOnHand`, movimento `PRODUCTION`
  - `adjust(productId: string, delta: number, reason: string, userId: string): Promise<void>` movimento `ADJUSTMENT`; `reason` obrigatório; lança `StockError("INSUFICIENTE")` se o resultado ficar abaixo do reservado
  - `reserve(items: { productId: string; quantity: number }[], tx): Promise<void>` soma em `stockReserved`; lança `StockError("ESGOTADO", productId)` se `stockOnHand - stockReserved < quantity`
  - `commitSale(orderId: string, tx): Promise<void>` baixa `stockOnHand` e `stockReserved` dos itens do pedido, movimento `SALE`
  - `releaseForCancel(orderId: string, userId: string | null, tx): Promise<void>` devolve conforme o estado da venda, movimento `CANCEL_RETURN`
  - `available(p: { stockOnHand: number; stockReserved: number }): number`

- [ ] **Step 1:** Testes: `produce` de 5 deixa disponível 5 e cria um movimento `+5`; `quantity` 0, negativa ou não inteira é rejeitada; `adjust(-2, "perda")` baixa e exige motivo; `adjust` que deixaria menos que o reservado lança `INSUFICIENTE`.
- [ ] **Step 2:** Teste de reserva: com disponível 1, `reserve` de 2 lança `ESGOTADO` e não altera nada; `reserve` de vários itens é tudo ou nada.
- [ ] **Step 3:** Teste de concorrência (Review Focus 1): com disponível 1, disparar duas `reserve` de 1 em paralelo em transações separadas; exatamente uma resolve e a outra lança `ESGOTADO`; `stockReserved` final é 1.
- [ ] **Step 4:** Rodar, esperar FALHA.
- [ ] **Step 5:** Implementar. A reserva é um `UPDATE ... SET "stockReserved" = "stockReserved" + $q WHERE id = $id AND "stockOnHand" - "stockReserved" >= $q` conferindo linhas afetadas, para ser atômica sem depender de leitura anterior.
- [ ] **Step 6:** Rodar, esperar PASS.
- [ ] **Step 7:** Tela `/painel/producao` ("Produzi hoje"), para `ADMIN` e `STAFF`: lista dos produtos ativos por categoria com o disponível atual, um campo de quantidade e um botão "Lançar" por linha, e confirmação na própria linha. Segunda aba "Ajustar" com quantidade, sinal e motivo. Histórico do dia abaixo. Sem valores em dinheiro.
- [ ] **Step 8:** Commit: `feat: estoque de produto pronto`.

---

### Task 5: Cardápio real na home

**Files:**
- Create: `src/lib/store/hours.ts`, `src/lib/store/menu.ts`, `src/app/(loja)/layout.tsx`, `src/app/(loja)/page.tsx`, `src/components/loja/*` (Header, Hero, Calda, Cardapio, ItemRow, FaixaVo, Rodape), `src/app/globals.css`, `public/` com os assets de `/home/claude/site/assets`
- Test: `tests/store/hours.test.ts`, `tests/store/menu.test.ts`

**Interfaces:**
- Consumes: `db`, `available`, `imageUrl`, `formatBRL`.
- Produces:
  - `BUSINESS_HOURS` (seg a sáb, 08:00 às 18:00) e `TIMEZONE = "America/Campo_Grande"`
  - `isOpen(now: Date): boolean`; `nextOpening(now: Date): Date`
  - `getMenu(): Promise<MenuCategory[]>` onde `MenuCategory = { id, name, slug, items: MenuItem[] }` e `MenuItem = { id, name, description, priceCents, unitLabel, imageKey: string | null, available: number }`; traz só categorias e produtos ativos com `available > 0`; categoria sem item não aparece

- [ ] **Step 1:** Testes de horário (datas em UTC convertidas para o fuso): segunda 12:00 local aberto; segunda 07:59 fechado; sábado 17:59 aberto; sábado 18:00 fechado; domingo fechado; `nextOpening` de sábado 19:00 é segunda 08:00 local.
- [ ] **Step 2:** Testes de cardápio: produto com estoque 0 não aparece; produto todo reservado não aparece; produto inativo não aparece; categoria vazia some; `available` é `stockOnHand - stockReserved`.
- [ ] **Step 3:** Rodar, esperar FALHA. Implementar. Rodar, esperar PASS.
- [ ] **Step 4:** Portar a home de `/home/claude/site/index.html` para componentes React, mantendo o visual (vovozinhas no cabeçalho, selo, calda, faixa goiaba, rodapé), com o cardápio vindo de `getMenu()` e a página sem cache estático. Abas: "Todos" mais uma por categoria. Aviso "Restam N" quando `available <= 4`. Loja fechada mostra faixa "Abrimos <dia> às 8h" e desabilita "Pôr na sacola". Cardápio vazio mostra "A fornada de hoje ainda não saiu. Volte daqui a pouco."
- [ ] **Step 5:** Seção "Fale conosco" com Instagram (`https://www.instagram.com/jeitinhodevodoces/`), e WhatsApp e Facebook lidos de `NEXT_PUBLIC_WHATSAPP` e `NEXT_PUBLIC_FACEBOOK`, omitidos quando vazios. Sem botão flutuante.
- [ ] **Step 6:** Conferir no navegador em 390 px e 1440 px. Commit: `feat: cardápio real na home`.

---

### Task 6: Sacola, checkout e criação do pedido

**Files:**
- Create: `src/lib/orders/fees.ts`, `src/lib/orders/create.ts`, `src/components/loja/sacola/*` (contexto da sacola em `localStorage` com try/catch), `src/app/(loja)/sacola/page.tsx`, `src/app/(loja)/checkout/page.tsx`, `src/app/(loja)/checkout/actions.ts`, `src/app/(loja)/pedido/[code]/page.tsx`
- Test: `tests/orders/create.test.ts`, `tests/orders/fees.test.ts`

**Interfaces:**
- Consumes: `reserve`, `commitSale`, `isOpen`, `checkRateLimit`, `db`.
- Produces:
  - `listNeighborhoods(): Promise<{ id: string; name: string; feeCents: number }[]>` (só ativos, ordem alfabética)
  - `createOrder(input: CreateOrderInput, ctx: { now: Date; ip: string }): Promise<CreateOrderResult>`
  - `CreateOrderInput = { items: { productId: string; quantity: number }[]; fulfillment: "DELIVERY" | "PICKUP"; customerName: string; customerPhone: string; addressLine?: string; neighborhoodId?: string; notes?: string }`
  - `CreateOrderResult = { ok: true; code: string } | { ok: false; error: "FECHADO" | "ESGOTADO" | "INVALIDO" | "LIMITE"; productId?: string; message: string }`
  - `code`: 6 caracteres de `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, único

Regras de `createOrder`: valida com zod (quantidade inteira de 1 a 50 por item, de 1 a 30 itens distintos, telefone com 10 ou 11 dígitos após limpar, nome de 2 a 80 caracteres, `notes` até 300); `DELIVERY` exige `addressLine` e bairro ativo; `PICKUP` ignora endereço e tem taxa 0; preços e taxa sempre lidos do banco; numa transação só: reserva, cria `Order` com `status CONFIRMED`, `paymentMethod ON_DELIVERY`, `paymentStatus PENDING`, cria itens com nome e preço copiados, e chama `commitSale`. Limite: 5 pedidos por IP a cada 10 minutos.

- [ ] **Step 1:** Testes do caminho feliz: retirada com 2 itens calcula subtotal e total, baixa o estoque, cria movimentos `SALE`; entrega soma a taxa do bairro.
- [ ] **Step 2:** Teste de adulteração (Review Focus 2): a entrada não tem campo de preço; passar um objeto com `priceCents` e `deliveryFeeCents` extras não muda o total gravado.
- [ ] **Step 3:** Testes de quantidade (Review Focus 3): 0, -1, 1.5, 51 e lista vazia devolvem `INVALIDO` e o estoque fica igual.
- [ ] **Step 4:** Teste de horário (Review Focus 4): `ctx.now` num domingo devolve `FECHADO` e nada é gravado.
- [ ] **Step 5:** Testes de estoque: pedir mais que o disponível devolve `ESGOTADO` com o `productId`, sem pedido criado; produto inativo devolve `INVALIDO`.
- [ ] **Step 6:** Testes de entrega: `DELIVERY` sem endereço ou com bairro inativo devolve `INVALIDO`. Teste de limite: sexto pedido do mesmo IP em 10 minutos devolve `LIMITE`.
- [ ] **Step 7:** Rodar, esperar FALHA. Implementar. Rodar, esperar PASS.
- [ ] **Step 8:** Sacola: contador no cabeçalho, página com itens, mais e menos, remover e subtotal. Ao abrir, a sacola confere com o servidor e avisa o que saiu de estoque ou mudou de preço.
- [ ] **Step 9:** Checkout: escolha entre "Receber em casa" e "Retirar na loja"; nome, WhatsApp, endereço e bairro (com a taxa ao lado do nome) quando for entrega; observação; resumo com subtotal, taxa e total; pagamento fixo "Pagar na entrega (Pix, cartão ou dinheiro)". Erros do servidor aparecem junto do campo ou do item.
- [ ] **Step 10:** Página `/pedido/[code]` com o resumo e o estado atual, e convite discreto para cadastro ("Em breve: crie sua conta e participe de promoções e sorteios"). Não mostra telefone nem endereço completos.
- [ ] **Step 11:** Conferir o fluxo inteiro no navegador em 390 px. Commit: `feat: sacola, checkout e criação do pedido`.

---

### Task 7: Painel de pedidos e bairros

**Files:**
- Create: `src/lib/orders/transitions.ts`, `src/lib/orders/views.ts`, `src/app/painel/pedidos/page.tsx`, `src/app/painel/pedidos/[id]/page.tsx`, `src/app/painel/pedidos/actions.ts`, `src/app/painel/bairros/*`
- Test: `tests/orders/transitions.test.ts`, `tests/orders/views.test.ts`

**Interfaces:**
- Consumes: `releaseForCancel`, `requireUser`, `requireRole`.
- Produces:
  - `advanceOrder(orderId: string, to: OrderStatus, user: SessionUser): Promise<void>`; transições válidas: `CONFIRMED → PREPARING`; `PREPARING → OUT_FOR_DELIVERY` só se `DELIVERY`; `PREPARING → READY_FOR_PICKUP` só se `PICKUP`; `OUT_FOR_DELIVERY → DONE`; `READY_FOR_PICKUP → DONE`. Qualquer outra lança `TransitionError`.
  - `cancelOrder(orderId: string, user: SessionUser): Promise<void>` permitido para `ADMIN` e `STAFF` até antes de `DONE`; devolve o estoque uma única vez
  - `markReceived(orderId: string, receivedCents: number, user: SessionUser): Promise<void>` só `ADMIN`; grava `paymentStatus RECEIVED`, `receivedCents`, `receivedAt`
  - `listOrdersForPanel(user: SessionUser, filter: { day: Date }): Promise<PanelOrder[]>`; para `STAFF`, o tipo devolvido não tem nenhum campo terminado em `Cents` nem `paymentStatus`
  - `whatsappStatusLink(order: { customerPhone: string; code: string; status: OrderStatus; customerName: string }): string` devolve `https://wa.me/55<telefone>?text=<mensagem codificada>`

- [ ] **Step 1:** Testes de transição: a sequência de entrega e a de retirada passam; `CONFIRMED → DONE`, `DONE → PREPARING` e `PREPARING → READY_FOR_PICKUP` num pedido de entrega lançam `TransitionError`.
- [ ] **Step 2:** Testes de cancelamento: cancelar devolve as quantidades a `stockOnHand` com movimento `CANCEL_RETURN`; cancelar duas vezes lança erro e não devolve em dobro; cancelar pedido `DONE` lança erro.
- [ ] **Step 3:** Testes de permissão (Review Focus 5): `markReceived` com `STAFF` lança `ForbiddenError`; `receivedCents` negativo é rejeitado; o objeto devolvido por `listOrdersForPanel` para `STAFF` não contém chaves que casem com `/Cents$|paymentStatus/` em nenhum nível.
- [ ] **Step 4:** Teste do link: telefone `(67) 99999-0000` vira `5567999990000`; a mensagem contém o código e o primeiro nome.
- [ ] **Step 5:** Rodar, esperar FALHA. Implementar. Rodar, esperar PASS.
- [ ] **Step 6:** Tela `/painel/pedidos`: pedidos do dia agrupados por estado, mais novos primeiro, atualização automática a cada 20 segundos, cartão com código, hora, itens, observação e entrega ou retirada. Botão único com a próxima ação ("Começar preparo", "Saiu para entrega", "Pronto para retirada", "Concluir") e "Cancelar" com confirmação na própria tela. Em "Saiu para entrega" e "Pronto para retirada" aparece "Avisar no WhatsApp", que abre o link.
- [ ] **Step 7:** Para `ADMIN`: totais no cartão, "Registrar recebimento" com o valor sugerido, e total "a receber" do dia no topo. Para `STAFF`: nada disso é renderizado nem enviado.
- [ ] **Step 8:** `/painel/bairros` (só `ADMIN`): lista editável com nome, taxa em reais e ativo; adicionar bairro. Seed com poucos bairros de exemplo marcados para substituição.
- [ ] **Step 9:** Conferir o fluxo completo no navegador: produzir, comprar, avançar o pedido, cancelar outro, registrar recebimento; entrar como funcionário e confirmar que não há valores. Commit: `feat: painel de pedidos e bairros`.

---

### Task 8: Empacotamento para o servidor

**Files:**
- Modify: `Dockerfile`, `docker-compose.yml`, `README.md`, `next.config.*`
- Create: `scripts/backup.sh`, `docs/deploy.md`

**Interfaces:**
- Consumes: tudo acima.
- Produces: imagem que sobe com `docker compose up -d`, aplica migrations na inicialização e guarda uploads e banco em volumes.

- [ ] **Step 1:** Dockerfile em estágios com saída `standalone`; o container roda como usuário sem privilégios.
- [ ] **Step 2:** Cabeçalhos de segurança no `next.config`: `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: DENY` e uma `Content-Security-Policy` que libera só o próprio domínio e as fontes do Google.
- [ ] **Step 3:** `scripts/backup.sh` com `pg_dump` diário guardando 14 dias; `docs/deploy.md` com o passo a passo para o servidor (variáveis, proxy com HTTPS, primeiro admin, backup).
- [ ] **Step 4:** Subir com `docker compose up` do zero numa pasta limpa, rodar o seed, entrar no painel e fazer um pedido. Esperado: tudo funciona sem passo manual além do `.env`.
- [ ] **Step 5:** `npm test`, `npm run lint` e `npm run build` passando. Commit: `chore: empacotamento para o servidor`.
