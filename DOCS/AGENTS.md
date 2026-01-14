# AGENTS.md — SciVisE MVP Backend (Cursor)
Версия: 1.0  
Цель: реализовать MVP бэкенда SciVisE в виде 2 сервисов (backend-api + ml-service) + PostgreSQL, интегрированных с фронтендом и запускаемых через Docker Compose.

---

## 0) Ключевой результат (Definition of Success)
Считаем задачу выполненной, если выполняются все пункты:

1) `docker compose up --build` поднимает:
   - postgres
   - backend-api
   - ml-service
   - (опционально) frontend
2) В БД загружено >= 1000 статей через ingestion (arXiv).
3) Frontend умеет:
   - логин/регистрация (или хотя бы login для MVP),
   - получать `/feed`,
   - отправлять `/events` (like/save/open/hide),
   - видеть изменение ленты после 3–5 like/save (персонализация).
4) ML-сервис реально используется при ранжировании персональной ленты (не заглушка).
5) Swagger/OpenAPI доступен на backend-api.
6) Есть README с шагами запуска + демо-сценарием.

---

## 1) Архитектура MVP
### 1.1 Сервисы (обязательно)
- backend-api (FastAPI):
  - auth (JWT)
  - feed / search / papers
  - events (like/save/open/hide)
  - interests
  - ingestion orchestration
  - интеграция с ml-service для ранжирования
- ml-service (FastAPI):
  - TF-IDF векторизация (title + abstract)
  - построение профиля пользователя
  - ранжирование кандидатов и выдача score
  - rebuild индекса
- PostgreSQL:
  - users, sources, papers, tags, paper_tags, user_interests, events, collections, collection_items

### 1.2 Принцип MVP
Сначала сделать работающий backend без ML (feed по свежести/интересам), затем подключить ML-rerank.

---

## 2) Repo structure (требование)
В корне репозитория должна быть структура:

/backend-api
/ml-service
/db
/docker
docker-compose.yml
.env.example
README.md

---

## 3) Глобальные правила работы агента
1) Работай итерациями: **Plan → Implement → Test → Document → Commit**
2) Никаких “магических” решений:
   - если нужна заглушка — пометь и добавь TODO с точным планом удаления.
3) Все изменения должны быть запускаемы через Docker.
4) Всегда обновляй README при изменении способа запуска.
5) Не ломай фронтенд: обеспечь CORS и стабильные API контракты.

---

## 4) Технологический стек (фиксируем)
- Python 3.11+
- FastAPI + Uvicorn
- SQLAlchemy + Alembic
- Postgres 15+
- scikit-learn (TF-IDF, cosine similarity)
- Docker + Docker Compose

---

## 5) Данные и дедупликация (обязательно)
### 5.1 Таблицы MVP
- users
- sources
- papers
- tags
- paper_tags
- user_interests
- events
- collections
- collection_items

### 5.2 Дедупликация papers
Порядок:
1) DOI (если есть) — уникальность
2) content_hash = hash(title_normalized + first_author + year)
3) url (если есть) — уникальность

Добавить индексы на:
- papers(doi)
- papers(content_hash)
- papers(published_at)
- events(user_id, created_at)

---

## 6) Ingestion (arXiv обязателен)
### 6.1 Обязательные функции
- загрузка статей из arXiv API
- нормализация полей: title, abstract, authors, published_at, url, doi(optional)
- дедупликация
- tagging: arXiv categories → tags
- сохранение в БД
- логирование итогов (added/updated/skipped/failed)

### 6.2 Управление
- Endpoint: `POST /admin/ingestion/run`
- Endpoint: `GET /admin/ingestion/status` (последний запуск, статистика)

---

## 7) ML — ключевой модуль MVP
### 7.1 Алгоритм (фиксируем)
Content-based:
- TF-IDF для `title + abstract`
- cosine similarity
- профиль пользователя = средний вектор liked/saved

### 7.2 Скоринг
`score(U,d) = 0.7 * similarity(P(U), V(d)) + 0.3 * freshness(d)`

freshness:
- age_days = today - published_at
- fresh = max(0, 1 - age_days / T)
- T = 30 (по умолчанию), вынести в конфиг

### 7.3 Формирование ленты
1) Собрать кандидатов N=500..3000 (по интересам + небольшая доля explore)
2) Исключить hide (и опционально открытые)
3) Отдать candidates + user positives в ml-service `/ml/rank`
4) Вернуть top-K (20..50)

Cold start:
- нет like/save → выдача по интересам + свежесть

---

## 8) API контракты (MVP)
### 8.1 backend-api
- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /me`
- `GET /feed?limit=&cursor=&tag=&source=&date_from=&date_to=`
- `GET /papers/{id}`
- `GET /search?q=&tag=&source=`
- `POST /events` (like/save/open/hide)
- `GET /me/likes`
- `GET /me/saved`
- (желательно) collections:
  - `POST /collections`
  - `GET /collections`
  - `POST /collections/{id}/items`

### 8.2 ml-service
- `POST /ml/rebuild`
- `POST /ml/rank`
  - input:
    - user_id
    - candidate_paper_ids[]
    - positive_paper_ids[] (liked/saved)
  - output:
    - ranked: [{paper_id, score}...]

---

## 9) Docker requirements
### 9.1 docker-compose
Обязательные сервисы:
- postgres
- backend-api
- ml-service

Опционально:
- frontend

Обязательно:
- healthchecks
- volumes:
  - postgres-data
  - ml-cache (опционально)

---

## 10) Порядок реализации (обязательная последовательность)
Агент должен выполнять этапы строго по порядку:

1) Repo skeleton + docker compose (без логики)
2) DB schema + Alembic migrations
3) backend-api minimal + /health + OpenAPI
4) Auth (register/login/me)
5) Ingestion arXiv → DB (>= 1000)
6) Feed v1 без ML (freshness + interests)
7) Events (like/save/open/hide) + hide исключение из feed
8) ml-service v1 (TF-IDF + /ml/rank + /ml/rebuild)
9) Интеграция backend-api ↔ ml-service (персональный feed через ML)
10) Search v1 (postgres full-text или ILIKE)
11) Docker polishing + README + demo script

---

## 11) Acceptance tests (обязательные проверки)
- docker compose поднимает все сервисы без ошибок
- ingestion добавляет статьи и не плодит дубликаты
- feed работает для гостя и пользователя
- после 3–5 like/save лента меняется
- hide не возвращает статью в ленту
- swagger доступен

---

## 12) README must include
- переменные окружения
- команды запуска
- как прогнать ingestion
- как rebuild ML
- демо-сценарий (7 шагов)

---