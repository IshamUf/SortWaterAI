# 1) Базовый образ для бота
FROM python:3.10-slim AS bot-base

WORKDIR /app

# Копируем только requirements из папки бота
COPY sortwaterai-bot/requirements.txt ./requirements.txt

# Ставим PyTorch CPU-only и всё остальное
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

# 2) Сборка финального образа
FROM python:3.10-slim

WORKDIR /app

# берём установленные пакеты из bot-base
COPY --from=bot-base /usr/local/lib/python3.10/site-packages /usr/local/lib/python3.10/site-packages
COPY --from=bot-base /usr/local/bin /usr/local/bin

# Копируем код бота
COPY sortwaterai-bot/ .

# По умолчанию запускаем бот
CMD ["python", "bot.py"]
