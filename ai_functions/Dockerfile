# ai_functions/Dockerfile

FROM python:3.10-slim

# Установим системные зависимости для psycopg2 и сборки
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential \
      libpq-dev \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# скопируем только requirements, чтобы кэшировать pip install
COPY requirements.txt .

# Указываем CPU‑only индекс для PyTorch
RUN pip install --no-cache-dir \
      -r requirements.txt \
      --extra-index-url https://download.pytorch.org/whl/cpu

# скопируем остальной код
COPY . .

# никаких CMD: скрипт запускается ботом через subprocess
