FROM python:3.10-slim

WORKDIR /app

# Копируем зависимости и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем весь код бота
COPY . .

# Запускаем бота
CMD ["python", "bot.py"]
