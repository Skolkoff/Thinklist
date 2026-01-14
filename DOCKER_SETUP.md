# Инструкция по запуску фронтенда в Docker

## Требования

- Docker Desktop установлен и запущен
- Docker Compose (обычно входит в Docker Desktop)

## Быстрый старт

1. **Убедитесь, что Docker запущен**
   ```bash
   docker --version
   docker-compose --version
   ```

2. **Соберите и запустите контейнер**
   ```bash
   cd /Users/skolkoff/Desktop/Thinklist
   docker-compose build
   docker-compose up -d
   ```

3. **Проверьте статус**
   ```bash
   docker-compose ps
   ```

4. **Откройте в браузере**
   - Фронтенд будет доступен по адресу: http://localhost:3000

## Полезные команды

### Просмотр логов
```bash
docker-compose logs -f frontend
```

### Остановка контейнера
```bash
docker-compose down
```

### Пересборка после изменений
```bash
docker-compose build --no-cache
docker-compose up -d
```

### Очистка
```bash
docker-compose down -v  # удаляет volumes
docker system prune -a  # очистка неиспользуемых образов
```

## Разработка

Для разработки с hot-reload рекомендуется запускать фронтенд локально:

```bash
cd frontend
npm install
npm run dev
```

Docker контейнер лучше использовать для production-сборки и тестирования финальной версии.

## Структура Docker файлов

- `frontend/Dockerfile` - многостадийная сборка (builder + nginx)
- `frontend/nginx.conf` - конфигурация nginx для SPA
- `frontend/.dockerignore` - исключения при сборке
- `docker-compose.yml` - оркестрация контейнеров

## Troubleshooting

### Порт 3000 уже занят
Измените порт в `docker-compose.yml`:
```yaml
ports:
  - "3001:80"  # используйте другой порт
```

### Ошибки при сборке
```bash
# Очистите кэш и пересоберите
docker-compose build --no-cache
```

### Контейнер не запускается
```bash
# Проверьте логи
docker-compose logs frontend

# Проверьте, что Docker daemon запущен
docker ps
```

