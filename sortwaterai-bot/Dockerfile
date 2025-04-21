FROM python:3.10-slim

WORKDIR /app

# зависимости бота (aiogram, psycopg2 и т.п.)
COPY sortwaterai-bot/requirements.txt ./
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r requirements.txt

# копируем только код бота
COPY sortwaterai-bot/ .

# Папка ai_functions будет примонтирована томом из docker-compose
# Скрипты AI дергаются ботом напрямую, сами не стартуют.

CMD ["python", "bot.py"]
