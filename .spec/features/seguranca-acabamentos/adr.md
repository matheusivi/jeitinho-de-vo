<!-- onp-spec:documentation-contract=v1 -->

# ADR: segurança e acabamentos

> feature: seguranca-acabamentos
> status: revisado

[PRD](prd.md) · [TDD](design.md) · [Spec](spec.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Identificação e contexto

Como implementar o segundo fator no login do painel. Autor: Claude; revisor: Matheus; 2026-11-24. Atende AC-056 a AC-066.

## Restrições e regras anteriores

Continuam válidas as regras de login da fase 1 (limites por IP e por e-mail, mensagem única de erro, sessão com token em SHA-256). Nenhuma é substituída.

## Alternativas consideradas

Fator: (a) TOTP com aplicativo (Google Authenticator, Authy), (b) código por SMS, (c) código por e-mail. Escolhido (a): pedido do cliente, sem custo por envio e sem depender de operadora; SMS e e-mail exigiriam serviço pago e são mais fáceis de interceptar.

Biblioteca TOTP: (a) implementar RFC 6238 com o crypto do Node, (b) pacote otplib. Escolhido (a): são poucas linhas, testadas com os vetores oficiais da RFC, e evita dependência a mais no caminho do login.

Segredo no banco: (a) criptografado com AES-256-GCM usando chave de AUTH_SECRET, (b) em texto. Escolhido (a): um backup ou leitura do banco não entrega o segundo fator.

Etapa do código: (a) desafio temporário guardado no banco com cookie próprio, (b) sessão "parcial". Escolhido (a): nenhuma sessão existe antes do código, então nenhuma rota precisa saber de sessão parcial.

QR code: pacote qrcode (MIT), gerado no servidor em SVG.

## Decisão e justificativa

TOTP RFC 6238 (SHA-1, 30 s, 6 dígitos, janela de ±1 passo, sem reutilizar passo), segredo cifrado com AES-256-GCM, desafio de 5 minutos com no máximo 5 erros, 8 códigos de recuperação guardados como SHA-256.

## Consequências e riscos

Ganho: senha vazada não basta. Custo: nova variável AUTH_SECRET obrigatória; se ela for perdida, todos precisam reconfigurar o código (os dados de venda não são afetados).

## Validade, revisão e substituição

Revisar se entrar login com Google para a equipe ou chaves físicas (passkeys).

## Respostas e aprovação

Matheus, 2026-11-24: "Obrigatório para a dona, opcional para funcionárias (Recomendado)" e "Códigos de recuperação impressos (Recomendado)". As escolhas técnicas são propostas do Claude listadas para revisão.
