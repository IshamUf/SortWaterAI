# sortwaterai-bot/Dockerfile
FROM python:3.10-slim AS base
WORKDIR /app

COPY sortwaterai-bot/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY sortwaterai-bot /app

# ставим зависимости из ai_functions
COPY ai_functions/requirements.txt /app/ai_functions/requirements.txt
RUN pip install --no-cache-dir -r /app/ai_functions/requirements.txt

CMD ["python", "bot.py"]
