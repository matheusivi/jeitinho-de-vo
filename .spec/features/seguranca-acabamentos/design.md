<!-- onp-spec:documentation-contract=v1 -->

# TDD: segurança e acabamentos

> feature: seguranca-acabamentos
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## 1. Identificação e responsáveis

Autor: Claude (Claude Code). Revisor: Matheus. Versão 1, 2026-11-24.

## 2. Contexto e sistema atual

Login por e-mail e senha (src/lib/auth/session.ts), sessão com token em cookie jdv_session, guarda de rotas em src/lib/auth/guard.ts. Equipe cria só funcionárias. Spec da fase 1: .spec/features/fase-1-loja-painel/spec.md (AC-013 a AC-016).

## 3. Problema e motivação

Ver PRD: senha sozinha não basta para quem vai emitir nota fiscal.

## 4. Escopo e não objetivos

Escopo: AC-056 a AC-067 e as tarefas de texto e menu. Não objetivos: login com Google, 2FA de cliente.

## 5. Solução e arquitetura

Dados (migração 0003): em users, totp_secret_enc, totp_pending_enc, totp_enabled_at, totp_last_step; tabela recovery_codes (user_id, code_hash, used_at); tabela login_challenges (token_hash, user_id, expires_at, attempts).

Módulos:

1. src/lib/auth/totp.ts: base32, código TOTP, verificação com janela e passo mínimo, URI otpauth.
2. src/lib/auth/crypto.ts: cifrar e decifrar com AES-256-GCM usando chave derivada de AUTH_SECRET.
3. src/lib/auth/mfa.ts: iniciar e confirmar a ativação, gerar códigos de recuperação, desativar, zerar (dona), verificar desafio.
4. session.ts: login devolve MFA_REQUIRED com token de desafio quando a conta tem código.
5. guard.ts: administradora sem código ativo é levada para /painel/seguranca; requireUserForSetup libera só essa tela.

Telas: /painel/login/codigo (código ou código de recuperação), /painel/seguranca (QR, chave manual, confirmação, códigos, desativar), botão "Zerar código" e campo de acesso na Equipe.

## 6. Riscos e mitigação

| Risco | Evidência / hipótese | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| Dona perder celular e códigos | hipótese | baixa | alto | orientação na tela para imprimir os códigos | dona |
| AUTH_SECRET ausente no servidor | nova variável | média | alto | erro claro ao ativar o código; passo no guia de deploy | Matheus |
| Força bruta no código | padrão | baixa | alto | 5 erros por desafio, desafio exige senha, limite por conta | Claude |

## 7. Plano de implementação

T-018 TOTP e cifra → T-019 ativação e recuperação → T-020 login com código e guarda → T-021 equipe → T-022 acabamentos.

## 8. Segurança e privacidade

Segredo cifrado; códigos de recuperação só em hash; cookie do desafio httpOnly, SameSite=Lax, 5 minutos; comparação em tempo constante; passo TOTP já usado é recusado.

## 9. Estratégia de testes

Vitest contra Postgres real, com `@spec:AC-xxx`. Vetores da RFC 6238 para o cálculo. Regressão dos testes de login da fase 1.

## 10. Operação e observabilidade

Tentativas de código erradas entram no mesmo registro de tentativas do login (login_attempts).

## 11. Reversão e recuperação

Migração aditiva. Voltar a versão anterior ignora as colunas novas (login volta a ser só senha).

## 12. Métricas de sucesso

Administradoras ativas com código: 100% após o primeiro acesso.

## 13. Glossário e domínios

TOTP: código de uso temporário baseado em tempo. Desafio: etapa entre a senha e o código. Código de recuperação: código impresso de uso único.

## 14. Alternativas e decisões

Ver ADR.

## 15. Dependências e compatibilidade

qrcode 1.5 (MIT); @fontsource/caprasimo e @fontsource/hanken-grotesk 5.x (fontes servidas pelo site). Compatível com Google Authenticator, Authy e Microsoft Authenticator.

## 16. Performance e capacidade

Uma consulta a mais no login e uma por verificação de código. Sem impacto mensurável.

## 17. Migração e implantação

Adicionar AUTH_SECRET (32+ caracteres aleatórios) ao .env e ao docker-compose antes de subir. No primeiro acesso depois da atualização, cada administradora é levada a configurar o código.

## 18. Perguntas e suposições

ASM-013 e ASM-014 na spec.

## 19. Marcos e acompanhamento

Um commit por tarefa na branch fase-seguranca.

## 20. Revisão e rastreabilidade

PRD → ADR → este TDD → spec AC-056..AC-067 → tasks T-018..T-022 → testes `@spec`.

Estrutura baseada no [Technical Design Doc Creator, Tech Leads Club](https://github.com/tech-leads-club/agent-skills/blob/main/packages/skills-catalog/skills/%28creation%29/create-technical-design-doc/SKILL.md); texto e requisitos de rastreabilidade adaptados para este projeto.
