# 1) Сначала образ для бота (aiogram, psycopg2 и т.п.)
FROM python:3.10-slim AS base

WORKDIR /app

# Копируем зависимости бота
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код бота
COPY . .

# 2) Устанавливаем зависимости AI‑сервиса
# (берём файл из папки ai_functions через контекст docker-compose volume)
FROM base AS final

# Копируем файл зависимостей AI
COPY ../ai_functions/requirements.txt ./ai_functions/requirements.txt

# Ставим зависимости AI‑сервиса
RUN pip install --no-cache-dir -r ai_functions/requirements.txt

# Точка входа
CMD ["python", "bot.py"]
