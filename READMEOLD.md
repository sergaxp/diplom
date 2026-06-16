Инструкция по запуску:

Сначала Docker
Откройте терминал и выполните команды:
cd docker
docker compose -f docker-compose.dev.yml up -d
cd ..
Затем приложения (в разных терминалах)
В двух отдельных терминалах запустите:
pnpm dev:api (cd apps/api  WEATHER_MOCK=1 npm run start:dev)
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


Обновление сайта (без боли)
Когда ты что-то изменил в коде, запушил на GitHub – вот как обновить сервер:


# 1. Зайди на сервер
ssh root@<IP_сервера>

# 2. Перейди в папку проекта
cd /opt/warmingtea

# 3. Стяни изменения
git pull origin main

# 4. Пересобери и перезапусти изменённые контейнеры
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build

# Docker сам определит что изменилось и пересоберёт только нужные контейнеры
# Простой (downtime) минимальный – секунды
Быстрое обновление без пересборки (если изменилось только что-то не требующее rebuild):


docker compose -f docker-compose.prod.yml restart api
# или
docker compose -f docker-compose.prod.yml restart web


Полезные команды

# Посмотреть статус всех контейнеров
docker compose -f docker-compose.prod.yml ps

# Логи в реальном времени
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f web

# Остановить всё
docker compose -f docker-compose.prod.yml down

# Перезапустить один контейнер
docker compose -f docker-compose.prod.yml restart api

# Освободить место (старые образы)
docker image prune -f

# Проверить место на диске
df -h
