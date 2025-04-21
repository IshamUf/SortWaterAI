# sortwaterai-bot/Dockerfile
FROM python:3.10-slim

# куда всё копируем
WORKDIR /app

# 1) Копируем и ставим зависимости бота
COPY sortwaterai-bot/requirements.txt ./requirements.txt
RUN pip install --no‑cache‑dir -r requirements.txt

# 2) Копируем и ставим зависимости AI‑сервиса
#    (тот же файл, что лежит в ai_functions/requirements.txt)
COPY ai_functions/requirements.txt ./ai_requirements.txt
RUN pip install --no‑cache‑dir \
      --extra‑index‑url https://download.pytorch.org/whl/cpu \
      -r ai_requirements.txt

# 3) Копируем исходники бота и AI‑скрипты
COPY sortwaterai-bot/    ./           # сюда попадает bot.py и всё из sortwaterai-bot
COPY ai_functions/       ./ai_functions/

# Точка входа: запускаем бот, который изнутри дергает add_ai_level.py
CMD ["python", "bot.py"]
