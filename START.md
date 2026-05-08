# Warmingtea — Руководство по запуску

## Что нужно установить

### 1. Node.js ≥ 20

Скачай с официального сайта: https://nodejs.org (выбери версию LTS)

Проверить установку:
```bash
node --version   # должно быть v20.x.x или выше
```

---

### 2. pnpm ≥ 9

pnpm — менеджер пакетов, которым собран монорепозиторий.

```bash
npm install -g pnpm
```

Проверить:
```bash
pnpm --version   # должно быть 9.x.x или выше
```

---

### 3. Docker + Docker Compose

Docker нужен для запуска базы данных (PostgreSQL), кэша (Redis) и файлового хранилища (MinIO).

- **Windows / Mac**: установи [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- **Linux**: [docs.docker.com/engine/install](https://docs.docker.com/engine/install/)

Docker Compose входит в Docker Desktop. На Linux установи отдельно:
```bash
sudo apt install docker-compose-plugin   # Ubuntu/Debian
```

Проверить:
```bash
docker --version          # Docker version 24.x.x или выше
docker compose version    # v2.x.x или выше
```

---

## Порядок запуска

### Шаг 1 — Клонируй репозиторий

```bash
git clone <url-репозитория>
cd diplom
```

---

### Шаг 2 — Установи зависимости

Из корня проекта (устанавливает всё сразу для api, web и shared пакетов):

```bash
pnpm install
```

---

### Шаг 3 — Создай файлы окружения

**API** — создай файл `apps/api/.env`:
```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=sergey
DATABASE_PASSWORD=dev_password_change_me
DATABASE_NAME=warmingtea_dev

REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=замени-на-свой-секретный-ключ
JWT_REFRESH_SECRET=замени-на-другой-секретный-ключ
```

**Web** — создай файл `apps/web/.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

> Файлы `.env` уже могут существовать в репозитории с дефолтными dev-значениями — тогда этот шаг можно пропустить.

---

### Шаг 4 — Запусти Docker (база данных, Redis, MinIO)

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
cd ..
```

Что запустится:

| Сервис     | Адрес                          | Логин / Пароль              |
|------------|--------------------------------|-----------------------------|
| PostgreSQL | `localhost:5432`               | `sergey` / `dev_password_change_me` |
| Redis      | `localhost:6379`               | —                           |
| MinIO      | `http://localhost:9001` (UI)   | `minioadmin` / `minioadmin123` |

Проверить что контейнеры запущены:
```bash
docker compose -f docker/docker-compose.dev.yml ps
```

---

### Шаг 5 — Запусти бэкенд (API)

В отдельном терминале:
```bash
pnpm dev:api
```

API поднимется на **http://localhost:3001**

При первом запуске TypeORM автоматически создаст все таблицы в базе данных (режим `synchronize: true`).

---

### Шаг 6 — Запусти фронтенд (Web)

В другом отдельном терминале:
```bash
pnpm dev:web
```

Приложение откроется на **http://localhost:3000**

---

## Итого: три терминала

| Терминал | Команда                                              |
|----------|------------------------------------------------------|
| 1        | `docker compose -f docker/docker-compose.dev.yml up` |
| 2        | `pnpm dev:api`                                       |
| 3        | `pnpm dev:web`                                       |

---

## Адреса в браузере

| Что              | Адрес                       |
|------------------|-----------------------------|
| Сайт             | http://localhost:3000        |
| API              | http://localhost:3001        |
| MinIO (файлы)    | http://localhost:9001        |

---

## Остановка

Остановить API и Web — `Ctrl+C` в каждом терминале.

Остановить Docker-контейнеры:
```bash
docker compose -f docker/docker-compose.dev.yml down
```

Остановить и удалить данные (сброс БД):
```bash
docker compose -f docker/docker-compose.dev.yml down -v
```

---

## Возможные проблемы

**Порт 5432 занят** — на машине уже запущен PostgreSQL. Останови его или смени порт в `docker-compose.dev.yml` и `apps/api/.env`.

**`pnpm: command not found`** — pnpm не установлен глобально. Запусти `npm install -g pnpm` и перезапусти терминал.

**API не стартует с ошибкой подключения к БД** — убедись что Docker-контейнеры запущены (`docker compose ps`) и переменные в `.env` совпадают с настройками в `docker-compose.dev.yml`.

**Таблицы не создались** — перезапусти API. При старте TypeORM с `synchronize: true` создаёт таблицы автоматически.
