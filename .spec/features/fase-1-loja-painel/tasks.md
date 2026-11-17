# Tasks: Fase 1 loja painel

> feature: fase-1-loja-painel

<!--
  Retroativo: as tarefas espelham as 8 tarefas do plano
  docs/superpowers/plans/2026-11-16-fase-1-loja-e-painel.md, já implementadas na branch fase-1.
-->

## T-001 — Base do projeto e banco [concluida]

- Refs: US-002, AC-003
- Arquivos: src/db/schema.ts, src/db/migrate.ts, src/db/seed.ts, src/lib/db.ts, src/lib/money.ts, src/app/layout.tsx, src/app/globals.css, src/app/favicon.ico
- Notas: Next.js 16, PostgreSQL 16 e Drizzle; dinheiro em centavos inteiros.

## T-002 — Autenticação e equipe [concluida]

- Refs: US-003, AC-013, AC-014, AC-015, AC-016
- Arquivos: src/lib/auth/password.ts, src/lib/auth/session.ts, src/lib/auth/rate-limit.ts, src/lib/auth/types.ts, src/lib/auth/guard.ts, src/lib/auth/users.ts, src/lib/ip.ts, src/lib/http.ts, src/app/painel/(auth)/login/LoginForm.tsx, src/app/painel/(auth)/login/actions.ts, src/app/painel/(auth)/login/page.tsx, src/app/painel/(app)/equipe/StaffForm.tsx, src/app/painel/(app)/equipe/actions.ts, src/app/painel/(app)/equipe/page.tsx, src/app/painel/(app)/sem-acesso/page.tsx
- Notas: argon2, sessão com token em SHA-256, limites com advisory lock.

## T-003 — Catálogo e fotos [concluida]

- Refs: US-005, AC-024, AC-025
- Arquivos: src/lib/catalog/categories.ts, src/lib/catalog/products.ts, src/lib/catalog/images.ts, src/lib/catalog/slug.ts, src/app/midia/[file]/route.ts, src/app/painel/(app)/categorias/CategoryForms.tsx, src/app/painel/(app)/categorias/actions.ts, src/app/painel/(app)/categorias/page.tsx, src/app/painel/(app)/produtos/ProductForm.tsx, src/app/painel/(app)/produtos/[id]/page.tsx, src/app/painel/(app)/produtos/actions.ts, src/app/painel/(app)/produtos/novo/page.tsx, src/app/painel/(app)/produtos/page.tsx

## T-004 — Estoque e produção [concluida]

- Refs: US-004, AC-005, AC-019, AC-020
- Arquivos: src/lib/stock/stock.ts, src/lib/stock/views.ts, src/app/painel/(app)/producao/StockForms.tsx, src/app/painel/(app)/producao/actions.ts, src/app/painel/(app)/producao/page.tsx
- Notas: reserva atômica com UPDATE condicional e CHECK no banco.

## T-005 — Cardápio e sacola [concluida]

- Refs: US-001, AC-001, AC-002
- Arquivos: src/lib/store/hours.ts, src/lib/store/menu.ts, src/lib/store/bag.ts, src/lib/store/contact.ts, src/app/(loja)/layout.tsx, src/app/(loja)/loja.css, src/app/(loja)/page.tsx, src/app/(loja)/sacola/Sacola.tsx, src/app/(loja)/sacola/page.tsx, src/app/(loja)/conta/page.tsx, src/components/loja/Aviso.tsx, src/components/loja/BagButton.tsx, src/components/loja/BagProvider.tsx, src/components/loja/Cardapio.tsx, src/components/loja/Footer.tsx, src/components/loja/Header.tsx, src/components/loja/Thumb.tsx

## T-006 — Pedido sem conta e bairros [concluida]

- Refs: US-002, US-005, AC-003, AC-004, AC-006, AC-007, AC-008, AC-009, AC-010, AC-011, AC-012, AC-026
- Arquivos: src/lib/orders/create.ts, src/lib/orders/fees.ts, src/lib/orders/phone.ts, src/lib/orders/public.ts, src/app/(loja)/actions.ts, src/app/(loja)/finalizar/Finalizar.tsx, src/app/(loja)/finalizar/page.tsx, src/app/(loja)/pedido/[code]/page.tsx, src/app/painel/(app)/bairros/NbForms.tsx, src/app/painel/(app)/bairros/actions.ts, src/app/painel/(app)/bairros/page.tsx, src/components/useFormAction.ts

## T-007 — Painel de pedidos [concluida]

- Refs: US-004, AC-017, AC-018, AC-021, AC-022, AC-023
- Arquivos: src/lib/orders/transitions.ts, src/lib/orders/views.ts, src/app/painel/(app)/layout.tsx, src/app/painel/(app)/page.tsx, src/app/painel/(app)/error.tsx, src/app/painel/(app)/pedidos/AutoRefresh.tsx, src/app/painel/(app)/pedidos/OrderCard.tsx, src/app/painel/(app)/pedidos/actions.ts, src/app/painel/(app)/pedidos/page.tsx, src/app/painel/painel.css, src/components/painel/NavLink.tsx

## T-008 — Deploy e endurecimento [concluida]

- Refs: US-003, AC-016
- Arquivos: Dockerfile, docker-compose.yml, next.config.ts, .env.example, scripts/backup.sh, docs/deploy.md
- Notas: cabeçalhos de segurança e CSP, backup do banco.
