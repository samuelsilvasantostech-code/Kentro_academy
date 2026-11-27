# Imagem do Kentro Academy para o Doca (tipo API, pasta ".", build por este Dockerfile, porta 3000, verificação /health).
# Variáveis: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e NEXT_PUBLIC_SITE_URL.
# O app só as lê no servidor, então valem em tempo de execução; se o Doca também as passar no build, tudo certo.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/health || exit 1
# O Docker define HOSTNAME com o nome do container na hora de rodar; sem forçar 0.0.0.0 o Next só escuta no IP do container.
CMD ["sh", "-c", "HOSTNAME=0.0.0.0 exec node server.js"]
