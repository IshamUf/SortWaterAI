# Базовый образ
FROM python:3.10-slim

# Рабочая папка в контейнере
WORKDIR /app

# Копируем файл зависимостей из корня (т.к. build.context = .)
COPY requirements.txt ./

# Устанавливаем PyTorch (CPU‑only) и остальные библиотеки
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

# Копируем весь код бота внутрь /app
# (после этого мы можем монтировать /app сверху вашим локальным кодом)
COPY sortwaterai-bot/ .

# По умолчанию запускаем бот
CMD ["python", "bot.py"]
