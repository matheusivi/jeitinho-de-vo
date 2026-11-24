<!-- onp-spec:documentation-contract=v1 -->

# Spec: Segurança e acabamentos

> feature: seguranca-acabamentos
> status: implementada

[PRD](prd.md) · [ADR](adr.md) · [TDD](design.md) · [Tarefas](tasks.md) · [Pesquisa](research.md)

## Contexto

O painel já mostra dinheiro e dados de clientes e, em breve, vai emitir nota fiscal em nome da empresa. Uma senha vazada não pode bastar para alguém entrar como dona. Junto, ajustes que apareceram no uso: passar a administração para o e-mail dela, fontes servidas pelo próprio site e textos corretos.

## Histórias

### US-013 — Dona protege o login com código no celular

Como dona, quero que o painel peça, além da senha, um código do aplicativo do celular, para que uma senha vazada não dê acesso a vendas, clientes e notas.

#### AC-056 — Código segue o padrão dos aplicativos autenticadores

- **Dado** o segredo e os instantes dos vetores de teste da RFC 6238 (SHA-1)
- **Quando** o sistema calcula o código
- **Então** o resultado bate com o da RFC, e o código do passo anterior ou seguinte também é aceito

#### AC-057 — Dona sem código configurado só acessa a configuração

- **Dado** uma administradora que ainda não ativou o código no celular
- **Quando** ela entra com a senha e tenta abrir qualquer tela ou ação do painel
- **Então** o sistema a leva para a tela de configuração e nada mais funciona até ativar

#### AC-058 — Ativação confirma o aplicativo e entrega códigos de recuperação

- **Dado** uma pessoa logada configurando o código
- **Quando** ela informa um código válido do aplicativo
- **Então** o código fica ativo e o sistema mostra uma única vez 8 códigos de recuperação; com código inválido nada é ativado

#### AC-059 — Senha certa não basta quando o código está ativo

- **Dado** uma conta com código ativo
- **Quando** alguém acerta a senha
- **Então** nenhuma sessão é criada até o código do aplicativo ser informado; com o código certo a sessão é criada

#### AC-060 — Tentativas de código são limitadas e código usado não vale de novo

- **Dado** uma tentativa de login à espera do código
- **Quando** alguém erra o código 5 vezes, ou reenvia um código já usado
- **Então** a tentativa é encerrada e precisa recomeçar pela senha; o código repetido é recusado

#### AC-061 — Código de recuperação entra uma vez só

- **Dado** uma conta com códigos de recuperação
- **Quando** a pessoa entra com um deles
- **Então** a entrada funciona e aquele código não serve mais

#### AC-062 — Segredo do aplicativo guardado criptografado

- **Dado** uma conta com código ativo
- **Quando** alguém lê a tabela de usuários direto no banco
- **Então** o segredo não aparece em texto, e os códigos de recuperação estão guardados só como resumo (hash)

### US-014 — Funcionária escolhe usar o código

Como funcionária, quero poder ativar o código no celular se eu quiser, e a dona precisa conseguir zerar o meu código se eu perder o celular.

#### AC-063 — Funcionária ativa e desativa; dona não desativa o próprio

- **Dado** uma funcionária e uma administradora com código ativo
- **Quando** cada uma tenta desativar o próprio código informando um código válido
- **Então** a funcionária consegue e a administradora é recusada

#### AC-064 — Dona zera o código de uma funcionária

- **Dado** uma funcionária com código ativo que perdeu o celular
- **Quando** a dona zera o código dela pela Equipe
- **Então** a funcionária volta a entrar só com a senha, e as sessões abertas dela são encerradas

### US-015 — Passar a administração para a dona

Como desenvolvedor, quero criar a conta de administradora da dona pela tela Equipe e depois desativar a minha, sem comando no servidor.

#### AC-065 — Dona cria outra administradora pela Equipe

- **Dado** a tela Equipe
- **Quando** uma administradora cria uma conta escolhendo o acesso "Administradora"
- **Então** a conta nasce como administradora e precisará ativar o código no primeiro acesso; funcionária não cria contas

#### AC-066 — Sempre sobra uma administradora ativa

- **Dado** duas administradoras ativas
- **Quando** uma desativa a outra, e depois alguém tenta desativar a última ativa ou a si mesma
- **Então** a primeira desativação funciona e as outras são recusadas

### US-016 — Acabamentos

Como dona, quero o site com os textos certos e carregando só do nosso servidor.

#### AC-067 — Fontes servidas pelo próprio site

- **Dado** a política de segurança de conteúdo (CSP) do site
- **Quando** o navegador carrega qualquer página
- **Então** a CSP não libera fonts.googleapis.com nem fonts.gstatic.com, e as fontes vêm do próprio site

## Fora de escopo

- Login com Google (fica para a conta de cliente).
- Código no celular para clientes da loja.
- Comando de servidor para zerar o código da dona: por decisão do Matheus, a recuperação é só pelos códigos impressos.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-010 | Código obrigatório para administradora e opcional para funcionária | confirmada | Matheus em 2026-11-24: "Obrigatório para a dona, opcional para funcionárias (Recomendado)" |
| ASM-011 | Recuperação por 8 códigos impressos de uso único | confirmada | Matheus em 2026-11-24: "Códigos de recuperação impressos (Recomendado)" |
| ASM-012 | Texto "desde 2017" sai do site | confirmada | Matheus em 2026-11-24: "Tirar o ano" |
| ASM-013 | A dona pode zerar o código de uma funcionária | confirmada | Matheus em 2026-11-24: "Sim, a dona pode zerar (Recomendado)" |
| ASM-014 | Tentativa de login espera o código por 5 minutos | confirmada | Matheus em 2026-11-24: "5 minutos (Recomendado)" |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-005 | Nenhuma além das suposições abertas acima. | respondida | Registrado para manter o formato |
