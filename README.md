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
- `npm run db:seed`: cria o admin inicial e dados de exemplo.
