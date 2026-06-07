# Warmingtea — API

Бэкенд (NestJS / TypeORM / PostgreSQL) приложения Warmingtea.

Общее описание проекта, архитектура, переменные окружения и инструкции по запуску — в [корневом README](../../README.md).

## Быстрый старт

```bash
pnpm dev:api   # из корня монорепозитория, http://localhost:3001
```

## Документация API

После запуска — Swagger UI на [http://localhost:3001/api/docs](http://localhost:3001/api/docs) (отключается переменной `SWAGGER_ENABLED=false`).

## Тесты

```bash
pnpm test       # Jest
pnpm test:cov   # с покрытием
pnpm test:e2e   # e2e-тесты
```

## Миграции (TypeORM)

```bash
pnpm migration:generate -- src/migrations/<Имя>
pnpm migration:run
pnpm migration:revert
```
