# BACKEND_TASKS.md
Проект: SciVisE  
Тип: Рабочий бэклог для Cursor / AI-агента  
Связано с: AGENTS.md

---

## Статусы
- [ ] — не начато
- [x] — выполнено
- [!] — заблокировано / требует решения

---

## Этап 1. Repo skeleton + Docker Compose
**AGENTS.md §10.1**

- [x] T1.1 Создать структуру репозитория
- [x] T1.2 Добавить docker-compose с postgres, backend-api, ml-service
- [x] T1.3 Добавить healthchecks для сервисов

**DoD:** `docker compose up --build` запускается без ошибок

---

## Этап 2. DB schema + Alembic
**AGENTS.md §10.2**

- [x] T2.1 Описать ER-модель в README
- [x] T2.2 Настроить SQLAlchemy + Alembic
- [x] T2.3 Создать миграции (таблицы + индексы)
- [x] T2.4 Реализовать дедупликацию papers

**DoD:** миграции применяются, схема стабильна

---

## Этап 3. Backend API minimal
**AGENTS.md §10.3**

- [x] T3.1 FastAPI каркас
- [x] T3.2 `/health` и `/version`
- [ ] T3.3 Swagger / OpenAPI

**DoD:** API доступен в Docker

---

## Этап 4. Auth
**AGENTS.md §10.4**

- [x] T4.1 POST /auth/register
- [x] T4.2 POST /auth/login
- [x] T4.3 GET /me
- [ ] T4.4 CORS для фронта

**DoD:** пользователь может авторизоваться

---

## Этап 5. Ingestion arXiv
**AGENTS.md §10.5**

- [x] T5.1 Добавить source arXiv
- [x] T5.2 Реализовать ingestion worker
- [x] T5.3 Дедупликация + content_hash
- [x] T5.4 Автотеги из arXiv categories
- [x] T5.5 Ingestion status endpoint

**DoD:** >= 1000 статей в БД, без дубликатов

---

## Этап 6. Feed v1 (без ML)
**AGENTS.md §10.6**

- [x] T6.1 GET /feed (guest)
- [x] T6.2 User interests
- [x] T6.3 GET /feed (authorized)

**DoD:** лента работает без ML

---

## Этап 7. Events
**AGENTS.md §10.7**

- [x] T7.1 POST /events
- [x] T7.2 GET /me/likes
- [x] T7.3 GET /me/saved
- [x] T7.4 Hide исключает статьи из feed

**DoD:** события влияют на выдачу

---

## Этап 8. ML-service v1
**AGENTS.md §10.8**

- [x] T8.1 ml-service каркас
- [x] T8.2 TF-IDF индекс + /ml/rebuild
- [x] T8.3 /ml/rank (score + сортировка)
- [x] T8.4 Тестирование ML-service (rebuild + rank)

**DoD:** ML сервис ранжирует кандидатов

---

## Этап 9. Backend ↔ ML интеграция
**AGENTS.md §10.9**

- [x] T9.1 Формирование candidate pool
- [x] T9.2 ML rerank в /feed
- [x] T9.3 Cold start fallback
- [x] T9.4 Observable персонализация
- [x] T9.5 Проверка персонализации (демо)

**DoD:** лента персонализируется после 3–5 лайков

---

## Этап 10. Search
**AGENTS.md §10.10**

- [x] T10.1 GET /search
- [x] T10.2 Фильтры tag/source

**DoD:** поиск работает

---

## Этап 11. Docker polish + Demo
**AGENTS.md §10.11**

- [ ] T11.1 Автомиграции при старте
- [ ] T11.2 Обновить README
- [ ] T11.3 Demo script

**DoD:** проект готов к демонстрации

---

## Notes / Decisions
(здесь Cursor может оставлять комментарии и решения)
