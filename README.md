Инструкция по запуску:

Сначала Docker
Откройте терминал и выполните команды:
cd docker
docker compose -f docker-compose.dev.yml up -d
cd ..
Затем приложения (в разных терминалах)
В двух отдельных терминалах запустите:
pnpm dev:api
pnpm dev:web
Доступность

Frontend: http://localhost:3000

Backend API: http://localhost:3001

Консоль MinIO: http://localhost:9001

Login: minioadmin

Password: minioadmin123

Остановка

В каждом терминале, где запущены pnpm dev:*, нажмите Ctrl+C для остановки процессов.

Остановка Docker-контейнеров:
cd docker
docker compose -f docker-compose.dev.yml down


Запуск тестов
cd /home/serga/diplom/apps/web
pnpm test           # одноразовый прогон
pnpm test:watch     # ре-ран на изменениях
pnpm test:ui        # web-UI с подробностями

Деплой на хостинг
Твой проект использует docker-compose.prod.yml. Вот полный процесс обновления:

Требования на сервере
Docker + Docker Compose
Nginx (reverse-proxy, уже настроен на diplom.warmingtea.su)
Файл .env в корне проекта с переменными:

POSTGRES_PASSWORD=...
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
ADMIN_SECRET=...
Первый деплой

# 1. Склонировать репо на сервер
git clone <url> /srv/warmingtea
cd /srv/warmingtea

# 2. Создать .env
cp .env.example .env   # или заполнить вручную

# 3. Поднять всё
docker compose -f docker-compose.prod.yml up -d --build
Обновление (после push новых изменений)

cd /srv/warmingtea

# 1. Получить обновления
git pull

# 2. Пересобрать и перезапустить только изменившиеся сервисы
docker compose -f docker-compose.prod.yml up -d --build web api

# 3. Проверить статус
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs web --tail 50
Если нужен полный rebuild (без кэша)

docker compose -f docker-compose.prod.yml build --no-cache web api
docker compose -f docker-compose.prod.yml up -d