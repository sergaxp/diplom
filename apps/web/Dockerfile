FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10 --activate

WORKDIR /app

# NEXT_PUBLIC_API_URL встраивается в JS на этапе билда
ARG NEXT_PUBLIC_API_URL=https://diplom.warmingtea.su/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .

RUN pnpm install --frozen-lockfile

RUN pnpm --filter web build

# Standalone не копирует статику автоматически – делаем это вручную
RUN cp -r apps/web/.next/static \
         apps/web/.next/standalone/apps/web/.next/static && \
    cp -r apps/web/public \
         apps/web/.next/standalone/apps/web/public

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
