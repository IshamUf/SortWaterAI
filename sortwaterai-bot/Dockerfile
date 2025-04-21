FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

# Устанавливаем torch (CPU‑only) и все остальные зависимости
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

COPY . .

# По умолчанию скрипт не запускается сам — его дергает bot.py
CMD ["python", "add_ai_level.py"]
