# 1) Установка зависимостей бота
FROM python:3.10-slim AS base
WORKDIR /app

# 1.1 копируем и ставим зависимости бота
COPY sortwaterai-bot/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 2) Копируем весь код бота
COPY sortwaterai-bot /app

# 3) Установка зависимостей ai_functions
#    (мы смонтировали ./ai_functions в /app/ai_functions через volume,
#     но чтобы они были в образе при сборке, копируем их из контекста)
COPY ai_functions/requirements.txt /app/ai_functions/requirements.txt
RUN pip install --no-cache-dir -r /app/ai_functions/requirements.txt

# 4) Точка входа
CMD ["python", "bot.py"]
