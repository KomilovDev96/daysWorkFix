# Deploy

## Что нужно на сервере
- Docker + Docker Compose (Compose v2 — встроен в современный Docker)
- ~6 GB свободного места (модель Ollama + образы)
- Порты 80 и 443 открыты для интернета (если хочешь SSL)

## Первый запуск

```bash
# 1. Клонировать проект на сервер
git clone <repo-url>
cd daysWorkFix

# 2. Создать .env из шаблона и заполнить
cp .env.example .env
nano .env
#   JWT_SECRET=...           (openssl rand -hex 64)
#   TELEGRAM_BOT_TOKEN=...   (из @BotFather)
#   SITE_ADDRESS=https://myapp.example.com   (если есть домен)
#   ACME_EMAIL=you@email.com

# 3. Поднять всё
docker compose up -d --build

# 4. Создать админа (одноразово)
docker compose exec api node createAdmin.js
#   → email: admin@gmail.com / пароль: Admin1234!

# 5. Засеять базу знаний ассистента
docker compose exec api node seedKnowledge.js
```

После `up -d` контейнер `ollama-init` скачает модель (~2GB qwen2.5:3b), затем выйдет. Это занимает 5-10 минут на первом запуске; следующие старты — мгновенные (модель в volume).

## Логи

```bash
docker compose logs -f api          # сервер + бот
docker compose logs -f ollama       # LLM
docker compose logs -f caddy        # reverse proxy
docker compose ps                   # статус всех контейнеров
```

## Обновление кода

```bash
git pull
docker compose up -d --build
```

(Volumes не пересоздаются — данные MongoDB, модель Ollama и загруженные файлы сохраняются.)

## Скачать другую модель

```bash
# Изменить OLLAMA_MODEL в .env, потом:
docker compose exec ollama ollama pull qwen2.5:7b
docker compose restart api
```

## Полный сброс (⚠️ удалит ВСЕ данные)

```bash
docker compose down -v
```

## Без домена (HTTP-only для теста)

В `.env`: `SITE_ADDRESS=:80` → приложение доступно по IP сервера на 80 порту, без SSL.

## С доменом + авто-SSL

1. Направь A-запись домена на IP сервера
2. В `.env`: `SITE_ADDRESS=https://myapp.example.com`
3. `docker compose up -d` → Caddy сам получит сертификат от Let's Encrypt при первом обращении.
