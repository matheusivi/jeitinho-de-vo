# Impressora do balcão (Elgin i9) e página de Comandas

As comandas das mesas e dos pedidos do site saem pela página **Comandas** do painel, aberta no Chrome do notebook que fica no balcão com a impressora. Não precisa instalar programa nenhum.

## Uma vez só, no notebook do balcão

1. Instale o driver da Elgin i9 no Windows (site da Elgin, "Drivers i9"). Ligue a impressora no USB e imprima uma página de teste pelo Windows.
2. Em Configurações do Windows > Bluetooth e dispositivos > Impressoras, desligue "Permitir que o Windows gerencie minha impressora padrão" e deixe a **Elgin i9 como padrão**.
3. Nas preferências da impressora, escolha o papel de **80 mm** (ou "80 x 297 mm") e margens zero, se o driver oferecer.
4. Crie um atalho na área de trabalho com este destino (troque o endereço pelo da loja):

   ```
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing --app=https://ENDERECO-DA-LOJA/painel/comandas
   ```

   Nome do atalho: **Comandas**. O `--kiosk-printing` faz o Chrome imprimir direto na impressora padrão, sem abrir a janela de impressão. O `--app` abre a página numa janela só dela.

5. Para abrir sozinho quando ligar o notebook: aperte Windows+R, digite `shell:startup`, Enter, e copie o atalho para essa pasta.
6. Feche todas as janelas do Chrome antes de abrir pelo atalho pela primeira vez (se o Chrome já estiver aberto, a opção de impressão direta não pega).

## No dia a dia

1. Abra o atalho **Comandas** e entre com a conta de funcionária **Balcão**.
2. Toque em **Ligar impressão automática**. Isso vale só para esse notebook; nos celulares dos garçons fica desligado.
3. Deixe a janela aberta (pode minimizar). Cada comanda sai uma vez só. Se o papel acabar, troque e use **Reimprimir** na lista.
4. Se uma comanda ficar parada mais de 1 minuto, a tela **Mesas** mostra um aviso vermelho: confira se a janela Comandas está aberta e se a impressora está ligada.

## O que sai no papel

1. Mesa: número da mesa, nome do garçom, hora e só os itens daquele lançamento, com a observação de cada um.
2. Item tirado da mesa: "MESA X · CANCELADO", o item e o motivo, para a cozinha não preparar.
3. Pedido do site: código, retirada ou entrega com o bairro, primeiro nome e os itens. Sem telefone, endereço nem valores.

## Limites conhecidos

1. Corte automático do papel e abertura da gaveta dependem do driver; pela página do Chrome não dá para mandar o comando direto.
2. Se precisar desses comandos no futuro, a alternativa é um pequeno programa no Windows que lê a mesma fila.
