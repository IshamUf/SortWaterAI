# sortwaterai-bot/Dockerfile
FROM python:3.10-slim

# Рабочая директория внутри контейнера
WORKDIR /app

# 1) Копируем файл с зависимостями для бота (aiogram, httpx и пр.)
COPY sortwaterai-bot/requirements.txt ./

# 2) Устанавливаем только «легкие» зависимости бота
RUN pip install --no-cache-dir -r requirements.txt

# 3) Копируем код самого бота
COPY sortwaterai-bot/ ./

# Точка входа — запускаем бот
CMD ["python", "bot.py"]
