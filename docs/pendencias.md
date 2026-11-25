# Pendências e ideias anotadas

Coisas que o Matheus pediu para anotar e que ainda não têm especificação nem data. Cada uma vira uma fase ou uma feature no ONP Spec quando for priorizada.

## Para conversar com a dona

1. **Mesas no salão: feito em 25/11/2026 (feature mesas-comandas).** Falta: QR code na mesa para o cliente pedir. Texto original: **Mesas no salão (pedido da dona, 18/11/2026).** São 8 mesas por enquanto. Cada mesa tem uma comanda aberta com o que consumiu, como num restaurante. Respostas do Matheus em 18/11/2026: quem lança é o garçom (por enquanto); a conta pode ser dividida; não tem taxa de serviço; a comanda da mesa sai na Elgin i9 para a cozinha; o consumo baixa o mesmo estoque da vitrine. Depois: QR code na mesa para o cliente pedir pelo cardápio digital, com a comanda saindo na hora. Depende da integração com a impressora, que ainda não foi feita.
2. **Nota fiscal (atualizado 24/11/2026: ela está deixando o sistema antigo e as notas vão ser emitidas pelo nosso).** Pegar do sistema antigo os XMLs de algumas NFC-e (trazem IE, regime, série, número e NCM/CFOP/CSOSN/CEST de cada produto) e a série e o número da última nota, para continuar a sequência sem duplicar. Certificado .pfx e CSC vêm dela e da Sefaz-MS e nunca devem trafegar por WhatsApp ou e-mail. Texto original: Ligar cada venda, já com desconto, à nota fiscal, com o imposto de cada produto (fatia, bolo etc.). Falta saber o regime tributário da empresa (provavelmente Simples Nacional), o modelo da nota (NFC-e para consumidor no balcão), a classificação fiscal de cada produto (NCM, CFOP, CSOSN) com o contador dela e qual emissor usar (serviço de API de NFC-e ou o da Stone, se houver).
3. Kit festa: como dá baixa nos insumos.
4. Domínio próprio (nome "jeitinho de vó"), número de WhatsApp e link do Facebook.
5. Chave do Pagar.me para a fase 2.

## Para explicar ao Matheus

1. Custo médio ponderado e controle por lote.
2. Como apresentar à dona cada número dos relatórios (CMV previsto, real, perdas, margem).

## Ajustes conhecidos

1. Ilustração das vovós não aparece na página inicial.
2. Menu do painel: abaixo de 1480 px de largura ele vai para uma segunda linha (de propósito, cabe tudo).
3. Conta de teste matheus@jeitinho.teste (senha fraca) deve ser desativada antes do uso real.
