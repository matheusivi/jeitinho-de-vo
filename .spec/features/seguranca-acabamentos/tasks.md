<!-- onp-spec:documentation-contract=v1 -->

# Tasks: Seguranca acabamentos

> feature: seguranca-acabamentos

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Spec](spec.md) · [Pesquisa](research.md)

<!--
  Como ler este arquivo (o formato é verificado por `onp-spec audit`):
  - T-xxx = tarefa (código de rastreio, único no projeto inteiro).
  - Toda tarefa referencia em `Refs:` pelo menos uma história de usuário
    (US-xxx) ou critério de aceite (AC-xxx).
  - Toda tarefa lista os arquivos que cria/altera em `Arquivos:` — capriche:
    é o que decide o que `onp-spec plano` roda em PARALELO (arquivos
    disjuntos) e o que roda em sequência.
  - Campos opcionais por tarefa, usados pelo plano de execução:
    `- Modelo: claude-sonnet-5` e `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - Uma tarefa só pode virar [concluida] quando os critérios de aceite dela
    tiverem prova PASS registrada por `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (atalho: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-018 — Cálculo do código e cifra do segredo [pendente]

- Refs: US-013, AC-056, AC-062
- Arquivos: src/lib/auth/totp.ts, src/lib/auth/crypto.ts, tests/auth/totp.test.ts, tests/setup.ts

## T-019 — Ativação, recuperação e dados [pendente]

- Refs: US-013, US-014, AC-058, AC-061, AC-062, AC-063, AC-064
- Arquivos: src/db/schema.ts, drizzle/0003_mfa.sql, src/lib/auth/mfa.ts, tests/auth/mfa.test.ts, package.json, package-lock.json

## T-020 — Login com código e guarda das telas [pendente]

- Refs: US-013, AC-057, AC-059, AC-060, AC-061
- Arquivos: src/lib/auth/session.ts, src/lib/auth/guard.ts, src/lib/auth/types.ts, src/app/painel/(auth)/login/actions.ts, src/app/painel/(auth)/login/LoginForm.tsx, src/app/painel/(auth)/login/codigo/page.tsx, src/app/painel/(auth)/login/codigo/CodeForm.tsx, src/app/painel/(app)/seguranca/page.tsx, src/app/painel/(app)/seguranca/actions.ts, src/app/painel/(app)/seguranca/MfaForms.tsx, src/app/painel/(app)/layout.tsx, tests/auth/login-mfa.test.ts

## T-021 — Equipe: administradora, zerar código e última administradora [pendente]

- Refs: US-014, US-015, AC-064, AC-065, AC-066
- Arquivos: src/lib/auth/users.ts, src/app/painel/(app)/equipe/actions.ts, src/app/painel/(app)/equipe/page.tsx, src/app/painel/(app)/equipe/StaffForm.tsx, tests/auth/users.test.ts

## T-022 — Acabamentos: fontes, textos e menu [pendente]

- Refs: US-016, AC-067
- Arquivos: src/app/layout.tsx, next.config.ts, src/components/loja/Footer.tsx, src/app/(loja)/page.tsx, src/app/painel/painel.css, docker-compose.yml, .env.example, docs/deploy.md, tests/security/csp.test.ts
