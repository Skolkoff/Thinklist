# Thinklist (SciVisE)

Система рекомендации научных публикаций на основе нейронных сетей.

## Описание проекта

Thinklist - это платформа для поиска, организации и обмена научными публикациями с интеллектуальной системой рекомендаций. Проект сочетает в себе функции социальной сети и инструмента для работы с научной литературой.
Пользователь может работать в гостевом режиме (просмотр, поиск), а лайки/сохранения и коллекции доступны после регистрации.

## Структура проекта

```
Thinklist/
├── frontend/                    # React + TypeScript фронтенд
├── backend-api/                 # Backend API (FastAPI + SQLAlchemy + Alembic)
├── ml-service/                  # ML-сервис (FastAPI)
├── db/                          # Скрипты/миграции БД (если нужны вне backend-api)
├── DOCS/                        # Техническая документация проекта
├── docker-compose.yml           # Docker конфигурация (postgres + backend-api + ml-service + frontend)
├── BACKEND_IMPLEMENTATION_PLAN.md  # План реализации бэкенда
└── DOCKER_SETUP.md              # Инструкция по запуску Docker
```

## ER‑модель БД (MVP)

ER‑модель следует требованиям из `DOCS/AGENTS.md` §5.

- **users**
  - `id` (PK)
  - `email` (уникальный)
  - `password_hash`
  - `created_at`
  - Связи:
    - 1 ко многим с `events`
    - 1 ко многим с `collections`
    - 1 ко многим с `user_interests`

- **sources**
  - `id` (PK)
  - `name`
  - `code` (уникальный, например `"arxiv"`)
  - `url`
  - Связи:
    - 1 ко многим с `papers`

- **papers**
  - `id` (PK)
  - `source_id` (FK → `sources.id`)
  - `external_id` (идентификатор в источнике, например arXiv ID)
  - `title`
  - `abstract`
  - `authors`
  - `published_at`
  - `doi` (уникальный, если указан)
  - `url` (уникальный, если указана)
  - `content_hash` (уникальный хэш `title_normalized + first_author + year`)
  - `created_at`
  - Индексы:
    - `papers(doi)`
    - `papers(content_hash)`
    - `papers(published_at)`
  - Связи:
    - многие ко многим с `tags` через `paper_tags`
    - 1 ко многим с `events`
    - многие ко многим с `collections` через `collection_items`

- **tags**
  - `id` (PK)
  - `name` (уникальный)
  - `slug` (уникальный)
  - Связи:
    - многие ко многим с `papers` через `paper_tags`
    - 1 ко многим с `user_interests`

- **paper_tags** (связующая таблица `papers` ↔ `tags`)
  - `paper_id` (FK → `papers.id`)
  - `tag_id` (FK → `tags.id`)
  - PK: составной (`paper_id`, `tag_id`)

- **user_interests**
  - `id` (PK)
  - `user_id` (FK → `users.id`)
  - `tag_id` (FK → `tags.id`)
  - `weight` (например, счётчик/вес интереса)
  - `updated_at`
  - Уникальность: (`user_id`, `tag_id`)

- **events**
  - `id` (PK)
  - `user_id` (FK → `users.id`)
  - `paper_id` (FK → `papers.id`)
  - `type` (enum: `like`, `save`, `open`, `hide`)
  - `created_at`
  - Доп. индексы:
    - `events(user_id, created_at)` — для быстрой выборки истории пользователя

- **collections**
  - `id` (PK)
  - `user_id` (FK → `users.id`)
  - `name`
  - `description`
  - `created_at`
  - Уникальность: (`user_id`, `name`) — имя коллекции уникально в рамках пользователя
  - Связи:
    - 1 ко многим с `collection_items`

- **collection_items**
  - `id` (PK)
  - `collection_id` (FK → `collections.id`)
  - `paper_id` (FK → `papers.id`)
  - `added_at`
  - Уникальность: (`collection_id`, `paper_id`) — одна статья один раз в коллекции

Диаграмма на уровне связей:

- `users` 1—N `events`
- `users` 1—N `collections`
- `users` 1—N `user_interests`
- `sources` 1—N `papers`
- `papers` N—M `tags` через `paper_tags`
- `users` N—M `tags` через `user_interests`
- `collections` N—M `papers` через `collection_items`

## Основные функции

- 📚 **Лента статей** - просмотр и поиск научных публикаций
- 🏷️ **Фильтрация** - поиск по тегам и ключевым словам
- 📁 **Коллекции** - организация статей в персональные коллекции
- 👤 **Профили** - персональные профили исследователей
- 💬 **Мессенджер** - общение и обмен статьями
- 🤖 **Рекомендации** - персональные рекомендации на основе ML
- 🧭 **Гостевой режим** - доступ к ленте и поиску без регистрации
- ✅ **Онбординг** - регистрация с никнеймом, аватаром, интересами и описанием

## Технологический стек

### Фронтенд
- React 19
- TypeScript
- Vite
- Tailwind CSS
- Lucide React

### Бэкенд
- FastAPI
- SQLAlchemy + Alembic
- PostgreSQL 15+
- ML-сервис (FastAPI + scikit-learn)

Подробный план: [BACKEND_IMPLEMENTATION_PLAN.md](./BACKEND_IMPLEMENTATION_PLAN.md)

## Сервисы и порты (Docker)

- Frontend (nginx): http://localhost:5740
- Backend API: http://localhost:8000
- ML service: http://localhost:8001
- PostgreSQL: localhost:5432

## Быстрый старт

### Локальная разработка

```bash
cd frontend
npm install
npm run dev
```

Фронтенд будет доступен по адресу: http://localhost:5173

### Docker

См. [DOCKER_SETUP.md](./DOCKER_SETUP.md) для подробных инструкций.

```bash
docker compose build
docker compose up -d
```

Фронтенд в Docker доступен по адресу: http://localhost:5740

### Ingestion (arXiv)

Backend накапливает arXiv-статьи инкрементально:

- цель: 5000 уникальных статей
- batch: до 100 статей за итерацию
- interval: 5 минут
- широкий набор категорий arXiv для покрытия основных научных областей
- статус: `GET /admin/ingestion/status`

```bash
curl -X POST http://localhost:8000/admin/ingestion/run
curl http://localhost:8000/admin/ingestion/status
```

## Регистрация и онбординг

Шаги регистрации:
1. Email + пароль + подтверждение + никнейм (проверка доступности никнейма).
2. Аватар: загрузка или выбор из предложенных.
3. Интересы: выбор тегов.
4. Описание (bio).

Гостевой режим доступен без регистрации, но лайки/сохранения и коллекции требуют авторизации.

## Документация

- [План реализации бэкенда](./BACKEND_IMPLEMENTATION_PLAN.md) - подробный план разработки бэкенда
- [Инструкция по Docker](./DOCKER_SETUP.md) - настройка и запуск контейнеров
- [Техническая документация](./DOCS/) - техническое задание и требования

## Статус проекта

- ✅ Фронтенд реализован
- ✅ Backend API и ML‑service работают
- ✅ Docker конфигурация готова

## Автор

Дипломная работа по теме "Система рекомендации научных публикаций на основе нейронных сетей"
