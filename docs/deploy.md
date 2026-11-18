# Colocar no ar (servidor próprio)

Guia para subir a Jeitinho de Vó num servidor Linux com Docker. Leva uns 20 minutos na primeira vez.

## 1. O que precisa ter no servidor

- Docker com o plugin Compose (`docker compose version` responde).
- Um domínio ou subdomínio apontando para o servidor, por exemplo `jeitinho.seudominio.com.br`.
- Um proxy com HTTPS na frente (Caddy, Nginx com Certbot, ou o que já atende seus outros sites).

## 2. Baixar o código e configurar

```sh
git clone git@github.com:matheusivi/jeitinho-de-vo.git
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

O site fica em `127.0.0.1:3000`, só para o proxy.

## 4. HTTPS

Exemplo com Caddy (`/etc/caddy/Caddyfile`):

```
jeitinho.seudominio.com.br {
  reverse_proxy 127.0.0.1:3000
}
```

Com Nginx, use `proxy_pass http://127.0.0.1:3000;` e repasse o IP real:

```
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
client_max_body_size 12m;
```

O site lê o IP de quem acessou primeiro do `X-Real-IP` e, na falta dele, do **último** valor do `X-Forwarded-For` (o que o seu proxy acrescentou). Esse IP é usado no limite de tentativas de login e de pedidos, então mantenha o `X-Real-IP $remote_addr` acima. Caddy já faz isso por padrão.

Deixe um proxy só na frente do site. Com dois proxies em cadeia (por exemplo Cloudflare na frente do Nginx), o IP visto passa a ser o do primeiro proxy e o limite fica por conta dele.

## 5. Primeiro acesso

1. Abra `https://jeitinho.seudominio.com.br/painel` e entre com o e-mail e a senha do `.env`.
2. Em Bairros, troque os exemplos pelos bairros e taxas reais.
3. Em Produtos, cadastre os produtos com foto.
4. Em Produzi hoje, lance o que está pronto. O cardápio da loja só mostra o que tem estoque.
5. Em Equipe, crie as contas dos funcionários.

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
