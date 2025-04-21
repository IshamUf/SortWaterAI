# Базовый образ Python
FROM python:3.10-slim

# Рабочая директория внутри контейнера
WORKDIR /app

# 1) Копируем единый файл requirements.txt (бот + AI‑сервис)
#    Этот файл должен содержать все зависимости: aiogram, psycopg2, numpy, torch, gymnasium и т.п.
COPY sortwaterai-bot/requirements.txt ./

# 2) Ставим зависимости
#    Для CPU‑only сборки PyTorch используем extra‑index‑url
RUN pip install --no‑cache‑dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

# 3) Копируем только код бота
#    ai_functions мы будем монтировать сверху из docker-compose
COPY sortwaterai-bot/ ./

# Точка входа — запускаем бот, который сам дергает add_ai_level.py
CMD ["python", "bot.py"]

