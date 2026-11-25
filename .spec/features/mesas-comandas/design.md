<!-- onp-spec:documentation-contract=v1 -->

# TDD: mesas e comandas

> feature: mesas-comandas
> status: revisado

[PRD](prd.md) · [ADR](adr.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## 1. Identificação e responsáveis

Autor: Claude. Revisor: Matheus. Versão 1, 2026-11-25.

## 2. Contexto e sistema atual

Pedidos do site (src/lib/orders), estoque com reserva (src/lib/stock/stock.ts), relatórios sobre pedidos (src/lib/reports). Specs anteriores: fase 1, fase 3, segurança.

## 3. Problema e motivação

Ver PRD.

## 4. Escopo e não objetivos

AC-068 a AC-082. Não objetivos: QR code, nota fiscal, ESC/POS.

## 5. Solução e arquitetura

Dados (migração 0004): fulfillment ganha TABLE; payment_method ganha IN_STORE; tabela dining_tables (número, ativo); orders ganha table_id, opened_by, closed_by, closed_at; order_items ganha added_by e added_at; índice único parcial: uma comanda aberta por mesa; tabela order_payments (forma CASH/PIX/CARD, valor, itens pagos, quem recebeu); tabela print_jobs (tipo, pedido, conteúdo, reservado_em, reservado_por, impresso_em).

Módulos: src/lib/tables/tables.ts (abrir, lançar, tirar item, cancelar, configurar mesas), src/lib/tables/payments.ts (dividir, pagar, fechar), src/lib/printing/jobs.ts (enfileirar, reservar, marcar impresso, listar). createOrder enfileira a comanda do site.

Telas: /painel/mesas (grade), /painel/mesas/[numero] (lançar, tirar, fechar), /painel/comandas (fila, impressão automática, reimprimir). Atalho do Chrome com --kiosk-printing.

## 6. Riscos e mitigação

| Risco | Evidência / hipótese | Probabilidade | Impacto | Mitigação | Responsável |
|---|---|---|---|---|---|
| Página de comandas fechada | hipótese | média | alto | aviso em Mesas quando há comanda pendente há mais de 1 minuto | equipe |
| Duas abas imprimindo | hipótese | média | médio | impressão automática ligada por computador e reserva atômica | Claude |
| Pagamento duplicado | concorrência | baixa | alto | lock da comanda (FOR UPDATE) ao pagar | Claude |

## 7. Plano de implementação

T-023 dados → T-024 mesas e itens → T-025 pagamentos → T-026 fila de impressão → T-027 telas → T-028 relatórios, pedidos e documentação.

## 8. Segurança e privacidade

Comanda não leva telefone nem endereço. Todas as ações exigem login; configurar mesas e cancelar mesa com itens só administradora. Equipe vê preços só nas telas de mesa.

## 9. Estratégia de testes

Vitest contra Postgres real com `@spec:AC-xxx`; regressão das fases anteriores; teste no navegador do fluxo completo.

## 10. Operação e observabilidade

Fila de impressão mostra pendentes e impressas do dia; quem lançou e quem fechou fica em cada item e pagamento.

## 11. Reversão e recuperação

Migração aditiva. Comandas abertas ficam no banco; voltar a versão anterior apenas esconde as telas.

## 12. Métricas de sucesso

Mesas fechadas por dia; comandas pendentes há mais de 1 minuto (deve ser zero).

## 13. Glossário e domínios

Mesa: lugar no salão. Comanda da mesa: pedido do tipo MESA aberto. Comanda impressa: papel para a cozinha. Lançamento: grupo de itens enviado de uma vez.

## 14. Alternativas e decisões

Ver ADR.

## 15. Dependências e compatibilidade

Chrome no Windows com a impressora Elgin como padrão. Sem dependência nova de pacote.

## 16. Performance e capacidade

8 mesas, dezenas de lançamentos por dia; a página de comandas consulta a fila a cada 5 segundos.

## 17. Migração e implantação

Migração 0004 automática; criar a conta "Balcão" e o atalho do Chrome (docs/impressora.md).

## 18. Perguntas e suposições

Ver spec (ASM-015 a ASM-020).

## 19. Marcos e acompanhamento

Um commit por tarefa na branch fase-mesas.

## 20. Revisão e rastreabilidade

PRD → ADR → este TDD → spec AC-068..AC-082 → tasks T-023..T-028 → testes `@spec`.

Estrutura baseada no [Technical Design Doc Creator, Tech Leads Club](https://github.com/tech-leads-club/agent-skills/blob/main/packages/skills-catalog/skills/%28creation%29/create-technical-design-doc/SKILL.md); texto e requisitos de rastreabilidade adaptados para este projeto.
