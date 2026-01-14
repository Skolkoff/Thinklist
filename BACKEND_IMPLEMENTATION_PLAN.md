# План реализации бэкенда для Thinklist (SciVisE)

## Обзор проекта

Thinklist (SciVisE) - система рекомендации научных публикаций на основе нейронных сетей. Проект представляет собой платформу для поиска, организации и обмена научными статьями с функциями социальной сети.

## Анализ фронтенда

### Технологический стек фронтенда
- **React 19** + **TypeScript**
- **Vite** как сборщик
- **Tailwind CSS** для стилизации
- **Lucide React** для иконок

### Основные функции фронтенда

1. **Управление статьями**
   - Просмотр ленты статей (feed)
   - Поиск по заголовку и аннотации
   - Фильтрация по тегам
   - Просмотр детальной информации о статье
   - Лайки статей
   - Рекомендации похожих статей

2. **Коллекции**
   - Создание коллекций статей
   - Управление видимостью (public, private, friends, followers)
   - Добавление/удаление статей из коллекций
   - Редактирование коллекций

3. **Профили пользователей**
   - Просмотр профилей
   - Редактирование собственного профиля
   - Управление интересами
   - Просмотр коллекций пользователя

4. **Мессенджер**
   - Отправка сообщений
   - Реакции на сообщения
   - Вложения (текст, изображения, видео, коллекции, запросы в друзья)
   - Управление чатами

## Архитектура бэкенда

### Рекомендуемый технологический стек

#### Вариант 1: Python (рекомендуется для ML-компонентов)
- **FastAPI** - современный, быстрый веб-фреймворк
- **SQLAlchemy** - ORM для работы с БД
- **PostgreSQL** - основная БД
- **Redis** - кэширование и очереди
- **Celery** - асинхронные задачи (для ML-обработки)
- **PyTorch/TensorFlow** - для нейронных сетей рекомендаций
- **JWT** - аутентификация

#### Вариант 2: Node.js (если команда знакома с JS/TS)
- **Express.js** или **NestJS** - веб-фреймворк
- **TypeORM** или **Prisma** - ORM
- **PostgreSQL** - основная БД
- **Redis** - кэширование
- **TensorFlow.js** или интеграция с Python ML-сервисом
- **JWT** - аутентификация

### Структура базы данных

#### Основные сущности

```sql
-- Пользователи
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(100) UNIQUE NOT NULL,
    avatar_url TEXT,
    workplace VARCHAR(255),
    field_of_study VARCHAR(255),
    bio TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Интересы пользователей
CREATE TABLE user_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    interest VARCHAR(100) NOT NULL,
    UNIQUE(user_id, interest)
);

-- Авторы статей
CREATE TABLE authors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    orcid VARCHAR(19), -- ORCID идентификатор
    created_at TIMESTAMP DEFAULT NOW()
);

-- Статьи
CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    abstract TEXT NOT NULL,
    source VARCHAR(255) NOT NULL, -- Nature, Science, arXiv и т.д.
    published_at TIMESTAMP NOT NULL,
    doi VARCHAR(255) UNIQUE,
    image_url TEXT,
    full_text_url TEXT, -- ссылка на полный текст
    likes_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Связь статей и авторов (many-to-many)
CREATE TABLE article_authors (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
    author_order INTEGER, -- порядок авторов
    PRIMARY KEY (article_id, author_id)
);

-- Теги статей
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL
);

-- Связь статей и тегов (many-to-many)
CREATE TABLE article_tags (
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (article_id, tag_id)
);

-- Коллекции
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
    visibility VARCHAR(20) NOT NULL DEFAULT 'public', -- public, private, friends, followers
    cover_image TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Связь коллекций и статей (many-to-many)
CREATE TABLE collection_articles (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (collection_id, article_id)
);

-- Лайки статей
CREATE TABLE article_likes (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, article_id)
);

-- Друзья/подписки
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    friend_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, accepted, blocked
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, friend_id),
    CHECK (user_id != friend_id)
);

-- Сообщения
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id UUID NOT NULL, -- можно использовать составной ключ или отдельную таблицу chats
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'text', -- text, image, video, collection, friend_request
    attachment_url TEXT,
    attachment_id UUID, -- для коллекций и friend_request
    created_at TIMESTAMP DEFAULT NOW()
);

-- Реакции на сообщения
CREATE TABLE message_reactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(message_id, user_id, emoji)
);

-- Векторы статей для ML (для рекомендаций)
CREATE TABLE article_embeddings (
    article_id UUID PRIMARY KEY REFERENCES articles(id) ON DELETE CASCADE,
    embedding VECTOR(768), -- размерность зависит от модели
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Векторы пользователей для ML
CREATE TABLE user_embeddings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    embedding VECTOR(768),
    model_version VARCHAR(50),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Индексы для производительности
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_likes_count ON articles(likes_count DESC);
CREATE INDEX idx_collections_owner_id ON collections(owner_id);
CREATE INDEX idx_collection_articles_collection_id ON collection_articles(collection_id);
CREATE INDEX idx_article_likes_user_id ON article_likes(user_id);
CREATE INDEX idx_article_likes_article_id ON article_likes(article_id);
CREATE INDEX idx_friendships_user_id ON friendships(user_id);
CREATE INDEX idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX idx_messages_chat_id ON messages(chat_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
```

## API Endpoints

### Аутентификация

```
POST   /api/auth/register          - Регистрация пользователя
POST   /api/auth/login             - Вход в систему
POST   /api/auth/refresh           - Обновление токена
POST   /api/auth/logout            - Выход
POST   /api/auth/change-password   - Смена пароля
GET    /api/auth/me                - Получить текущего пользователя
```

### Статьи

```
GET    /api/articles               - Получить список статей (с фильтрами)
GET    /api/articles/:id          - Получить статью по ID
POST   /api/articles/:id/like     - Лайкнуть статью
DELETE /api/articles/:id/like     - Убрать лайк
GET    /api/articles/:id/related  - Получить похожие статьи
GET    /api/articles/search        - Поиск статей (полнотекстовый)
GET    /api/tags                   - Получить список всех тегов
```

**Параметры запроса для GET /api/articles:**
- `search` - поисковый запрос (поиск в title и abstract)
- `tags[]` - массив тегов для фильтрации
- `page` - номер страницы (пагинация)
- `limit` - количество на странице
- `sort` - сортировка (relevance, date, likes)

### Коллекции

```
GET    /api/collections            - Получить коллекции (опционально по userId)
GET    /api/collections/:id        - Получить коллекцию по ID
POST   /api/collections             - Создать коллекцию
PUT    /api/collections/:id        - Обновить коллекцию
DELETE /api/collections/:id        - Удалить коллекцию
POST   /api/collections/:id/articles/:articleId - Добавить статью в коллекцию
DELETE /api/collections/:id/articles/:articleId - Удалить статью из коллекции
```

**Параметры запроса для GET /api/collections:**
- `userId` - фильтр по владельцу
- `visibility` - фильтр по видимости

### Пользователи

```
GET    /api/users/:id              - Получить профиль пользователя
PUT    /api/users/me               - Обновить свой профиль
GET    /api/users/:id/collections   - Получить коллекции пользователя
GET    /api/users/:id/articles     - Получить сохраненные статьи пользователя
POST   /api/users/:id/follow       - Подписаться на пользователя
DELETE /api/users/:id/follow       - Отписаться от пользователя
GET    /api/users/me/friends       - Получить список друзей
```

### Мессенджер

```
GET    /api/chats                  - Получить список чатов
GET    /api/chats/:id              - Получить чат с сообщениями
POST   /api/chats                  - Создать новый чат
POST   /api/chats/:id/messages     - Отправить сообщение
POST   /api/messages/:id/reactions - Добавить реакцию на сообщение
DELETE /api/messages/:id/reactions/:emoji - Удалить реакцию
DELETE /api/chats/:id              - Удалить чат
POST   /api/chats/:id/clear        - Очистить историю чата
POST   /api/users/:id/block        - Заблокировать пользователя
```

### Рекомендации (ML)

```
GET    /api/recommendations        - Получить персональные рекомендации
GET    /api/recommendations/articles/:id - Рекомендации на основе статьи
POST   /api/recommendations/feedback - Отправить feedback для улучшения модели
```

## Система рекомендаций (ML компонент)

### Архитектура рекомендательной системы

1. **Content-Based Filtering**
   - Анализ текста статей (title, abstract)
   - Извлечение признаков через BERT/Word2Vec
   - Создание векторных представлений статей
   - Поиск похожих статей по косинусному расстоянию

2. **Collaborative Filtering**
   - Анализ поведения пользователей (лайки, сохранения, просмотры)
   - Матрица взаимодействий пользователь-статья
   - Рекомендации на основе похожих пользователей

3. **Hybrid Approach**
   - Комбинация content-based и collaborative filtering
   - Взвешенное объединение результатов
   - Учет контекста (время, популярность, новизна)

### Технологии для ML

- **Sentence Transformers** (sentence-transformers) - для создания эмбеддингов статей
- **scikit-learn** - для классических ML алгоритмов
- **FAISS** (Facebook AI Similarity Search) - для быстрого поиска похожих векторов
- **Celery** - для асинхронной обработки и обновления рекомендаций

### Процесс работы рекомендаций

1. **Инициализация**
   - При добавлении новой статьи: создание эмбеддинга через BERT
   - Сохранение вектора в БД (pgvector) или FAISS индекс

2. **Обучение модели пользователя**
   - Анализ взаимодействий пользователя (лайки, сохранения)
   - Создание профиля интересов (вектор предпочтений)
   - Обновление при новых взаимодействиях

3. **Генерация рекомендаций**
   - Поиск похожих статей по эмбеддингам
   - Фильтрация уже просмотренных/сохраненных
   - Ранжирование по релевантности и популярности
   - Кэширование результатов

## Этапы реализации

### Этап 1: Базовая инфраструктура (1-2 недели)

1. **Настройка проекта**
   - Выбор технологического стека
   - Настройка структуры проекта
   - Настройка Docker окружения
   - Настройка CI/CD

2. **База данных**
   - Проектирование схемы БД
   - Настройка миграций (Alembic для Python / TypeORM migrations для Node.js)
   - Создание базовых моделей

3. **Аутентификация**
   - Реализация регистрации/входа
   - JWT токены
   - Middleware для проверки авторизации

### Этап 2: Основной функционал (2-3 недели)

1. **CRUD для статей**
   - API для получения статей
   - Фильтрация и поиск
   - Лайки статей

2. **Коллекции**
   - CRUD операции
   - Управление видимостью
   - Добавление/удаление статей

3. **Профили пользователей**
   - Просмотр и редактирование профилей
   - Управление интересами

### Этап 3: Социальные функции (1-2 недели)

1. **Друзья/подписки**
   - Система дружбы
   - Запросы в друзья
   - Блокировка пользователей

2. **Мессенджер**
   - Отправка сообщений
   - Реакции на сообщения
   - WebSocket для real-time обновлений

### Этап 4: ML компонент (2-3 недели)

1. **Подготовка данных**
   - Сбор данных о взаимодействиях
   - Подготовка датасета для обучения

2. **Модель рекомендаций**
   - Настройка BERT для эмбеддингов статей
   - Реализация content-based filtering
   - Реализация collaborative filtering
   - Объединение в hybrid систему

3. **Интеграция**
   - API для получения рекомендаций
   - Асинхронная обработка через Celery
   - Кэширование результатов

### Этап 5: Оптимизация и тестирование (1-2 недели)

1. **Производительность**
   - Оптимизация запросов к БД
   - Индексы
   - Кэширование (Redis)
   - Пагинация

2. **Тестирование**
   - Unit тесты
   - Integration тесты
   - Тестирование ML компонента

3. **Документация**
   - API документация (Swagger/OpenAPI)
   - Документация кода
   - Инструкции по развертыванию

## Технические детали

### Безопасность

- **Хеширование паролей**: bcrypt или argon2
- **JWT токены**: с коротким временем жизни и refresh токенами
- **CORS**: настройка для фронтенда
- **Rate Limiting**: защита от DDoS
- **Валидация данных**: Pydantic (Python) или class-validator (Node.js)
- **SQL Injection**: использование ORM предотвращает большинство атак

### Производительность

- **Кэширование**: Redis для часто запрашиваемых данных
- **Пагинация**: для всех списков
- **Индексы БД**: на часто используемых полях
- **Connection Pooling**: для БД
- **CDN**: для статических файлов (изображения статей)

### Масштабируемость

- **Микросервисная архитектура** (опционально):
  - API сервис
  - ML сервис (отдельный для рекомендаций)
  - Message service (для мессенджера)
- **Очереди задач**: Celery/RQ для асинхронных задач
- **Горизонтальное масштабирование**: через load balancer

## Интеграция с внешними источниками

### Источники статей

1. **arXiv API** - для статей по физике, математике, CS
2. **PubMed API** - для биомедицинских статей
3. **CrossRef API** - для метаданных статей по DOI
4. **OpenAlex API** - открытая база научных публикаций

### Парсинг и обновление

- Периодический парсинг новых статей (Celery Beat)
- Обновление метаданных существующих статей
- Обработка дубликатов

## Docker Compose для полного стека

```yaml
services:
  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/thinklist
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=thinklist
      - POSTGRES_PASSWORD=thinklist
      - POSTGRES_DB=thinklist
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  celery:
    build: ./backend
    command: celery -A app.celery worker --loglevel=info
    depends_on:
      - db
      - redis

  celery-beat:
    build: ./backend
    command: celery -A app.celery beat --loglevel=info
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
  redis_data:
```

## Метрики и мониторинг

- **Логирование**: структурированные логи (JSON)
- **Метрики**: Prometheus + Grafana
- **Трекинг ошибок**: Sentry
- **Health checks**: эндпоинты для проверки состояния сервисов

## Заключение

Данный план представляет комплексный подход к реализации бэкенда для системы Thinklist. Основные приоритеты:

1. **Быстрый старт**: базовая функциональность для работы фронтенда
2. **Масштабируемость**: архитектура, готовая к росту
3. **ML интеграция**: система рекомендаций как ключевая особенность
4. **Качество кода**: тестирование и документация

Рекомендуется начать с MVP (минимально жизнеспособного продукта), включающего:
- Аутентификацию
- Базовый CRUD для статей и коллекций
- Простую систему рекомендаций (content-based)
- Затем постепенно добавлять остальной функционал

