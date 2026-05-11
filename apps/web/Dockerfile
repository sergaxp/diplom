FROM node:20-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# NEXT_PUBLIC_API_URL нужна на этапе билда (встраивается в JS)
ARG NEXT_PUBLIC_API_URL=https://diplom.warmingtea.su/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Копируем весь монорепозиторий
COPY . .

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Билдим Next.js
RUN pnpm --filter web build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Standalone-режим: сервер в .next/standalone
CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
