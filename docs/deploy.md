# Colocar no ar (servidor próprio)

Guia para subir a Jeitinho de Vó num servidor Linux com Docker. Leva uns 20 minutos na primeira vez.

## 1. O que precisa ter no servidor

- Docker com o plugin Compose (`docker compose version` responde). Para instalar no Ubuntu 24.04, use o repositório oficial do Docker:

```sh
sudo apt-get update && sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```
- Um domínio ou subdomínio apontando para o servidor, por exemplo `jeitinho.seudominio.com.br`.
- Um proxy com HTTPS na frente (Caddy, Nginx com Certbot, ou o que já atende seus outros sites).

## 2. Baixar o código e configurar

O repositório é privado. Crie uma chave só de leitura para este repositório (deploy key):

```sh
ssh-keygen -t ed25519 -N "" -C "servidor jeitinho-de-vo" -f ~/.ssh/jeitinho_deploy
cat ~/.ssh/jeitinho_deploy.pub
```

Cole a chave pública no GitHub em Settings do repositório → Deploy keys → Add deploy key, sem marcar "Allow write access". Depois:

```sh
cat >> ~/.ssh/config <<'CFG'
Host github-jeitinho
  HostName github.com
  User git
  IdentityFile ~/.ssh/jeitinho_deploy
  IdentitiesOnly yes
CFG
git clone git@github-jeitinho:matheusivi/jeitinho-de-vo.git
cd jeitinho-de-vo
cp .env.example .env
```

Edite o `.env`:

| Variável | O que colocar |
|---|---|
| `POSTGRES_PASSWORD` | uma senha longa e aleatória para o banco (`openssl rand -base64 24`) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | e-mail e senha da primeira conta da dona (mínimo 8 caracteres) |
| `NEXT_PUBLIC_WHATSAPP` | número da loja com DDD, por exemplo `67999990000` (deixe vazio até ter o número) |
| `NEXT_PUBLIC_FACEBOOK` | link da página do Facebook (opcional) |

`DATABASE_URL`, `DATABASE_URL_TEST` e `UPLOAD_DIR` do `.env` são para rodar no computador; o Docker Compose monta os do servidor sozinho.

## 3. Subir

```sh
docker compose up -d --build
docker compose exec app npx tsx src/db/seed.ts
```

O primeiro comando constrói a imagem, sobe o banco e o site e aplica as migrations. O segundo cria a conta da dona, as categorias iniciais e três bairros de exemplo (troque os bairros no painel, em Bairros).

O site fica em `127.0.0.1:3010`, só para o proxy (a 3000 já é usada por outro site; dá para trocar com `APP_PORT` no `.env`).

## 4. HTTPS

Exemplo com Caddy (`/etc/caddy/Caddyfile`):

```
jeitinho.seudominio.com.br {
  reverse_proxy 127.0.0.1:3010
}
```

Com Nginx, use `proxy_pass http://127.0.0.1:3010;` e repasse o IP real:

```
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
client_max_body_size 12m;
```

O site lê o IP de quem acessou primeiro do `X-Real-IP` e, na falta dele, do **último** valor do `X-Forwarded-For` (o que o seu proxy acrescentou). Esse IP é usado no limite de tentativas de login e de pedidos, então mantenha o `X-Real-IP $remote_addr` acima. Caddy já faz isso por padrão.

Deixe um proxy só na frente do site. Com dois proxies em cadeia (por exemplo Cloudflare na frente do Nginx), o IP visto passa a ser o do primeiro proxy e o limite fica por conta dele.

## 5. Primeiro acesso

1. Abra `https://jeitinho.seudominio.com.br/painel` e entre com o e-mail e a senha do `.env`. Toda administradora configura o código no celular (Google Authenticator, Microsoft Authenticator ou Authy) no primeiro acesso e recebe 8 códigos de recuperação para imprimir.
2. Em Bairros, troque os exemplos pelos bairros e taxas reais.
3. Em Produtos, cadastre os produtos com foto.
4. Em Produzi hoje, lance o que está pronto. O cardápio da loja só mostra o que tem estoque.
5. Em Equipe, crie as contas das funcionárias. Para passar a administração para outra pessoa, crie a conta dela com acesso "Administradora" e depois desative a sua.

Depois do primeiro acesso, apague `ADMIN_PASSWORD` do `.env`. Ela só é usada para criar a primeira conta.

## 6. Backup

```sh
crontab -e
# backup todo dia às 3h15, guarda 14 dias em ./backups
15 3 * * * cd /caminho/jeitinho-de-vo && ./scripts/backup.sh >> backups/backup.log 2>&1
```

Para restaurar: `docker compose exec -T db pg_restore -U jdv -d jdv --clean < backups/ARQUIVO.dump`.

Copie a pasta `backups` para fora do servidor de vez em quando. Backup só no mesmo disco não protege de pane no disco.

## 7. Atualizar

```sh
git pull
docker compose up -d --build
```

As migrations novas são aplicadas sozinhas quando o site sobe.

Antes de atualizar, rode o backup (seção 6). A atualização da fase 3 só cria tabelas novas e uma coluna vazia nos itens de pedido; pedidos antigos aparecem como "sem custo" no relatório por produto.

### Atualização "segurança" (código no celular)

Antes do `git pull`, acrescente ao `.env` a chave que cifra o código no celular. Gere uma vez e guarde junto com o backup: se ela for perdida ou trocada, todos precisam configurar o código de novo (vendas e cadastros não são afetados).

```sh
cd /opt/jeitinho-de-vo
grep -q '^AUTH_SECRET=.\+' .env || echo "AUTH_SECRET=$(openssl rand -base64 48 | tr -d '\n/+=')" >> .env
git pull && docker compose up -d --build
```

Sem `AUTH_SECRET`, o `docker compose` recusa subir e avisa. No próximo acesso, cada administradora é levada a ativar o código no celular.
