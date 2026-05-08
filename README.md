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
