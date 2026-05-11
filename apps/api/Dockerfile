FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# Копируем весь монорепозиторий
COPY . .

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Билдим API
RUN pnpm --filter api build

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "apps/api/dist/main.js"]
