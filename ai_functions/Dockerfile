# ai_functions/Dockerfile
FROM python:3.10-slim

# Рабочая директория
WORKDIR /app

# Копируем только зависимости, чтобы закэшировать pip install
COPY requirements.txt .

# Устанавливаем зависимости
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код ai_functions
COPY . .

# По умолчанию никаких команд не запускаем — скрипты вызываются ботом
