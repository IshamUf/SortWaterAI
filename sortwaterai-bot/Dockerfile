FROM python:3.10-slim

WORKDIR /app

# 1) Сначала ставим зависимости самого бота
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2) Ставим все зависимости для ai_functions (numpy, torch, gymnasium…)
#    Используем тот же файл requirements.txt, что лежит в ai_functions
COPY ../ai_functions/requirements.txt ./ai_functions_requirements.txt
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      -r ai_functions_requirements.txt

# 3) Копируем код бота
COPY . .

CMD ["python", "bot.py"]
