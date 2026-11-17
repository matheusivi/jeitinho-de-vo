# Jeitinho de Vó: loja e painel
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Variáveis públicas entram no build do Next (WhatsApp e Facebook aparecem no site).
ARG NEXT_PUBLIC_WHATSAPP=""
ARG NEXT_PUBLIC_FACEBOOK=""
ENV NEXT_PUBLIC_WHATSAPP=$NEXT_PUBLIC_WHATSAPP NEXT_PUBLIC_FACEBOOK=$NEXT_PUBLIC_FACEBOOK
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads && chown -R node:node /data
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --from=build --chown=node:node /app/src ./src
COPY --from=build --chown=node:node /app/package.json /app/next.config.ts /app/tsconfig.json ./
USER node
EXPOSE 3000
# Aplica as migrations e sobe o servidor.
CMD ["sh", "-c", "npx tsx src/db/migrate.ts && npx next start -p ${PORT}"]
