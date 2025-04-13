# --- Frontend Stage ---
FROM node:18 AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# --- Backend Stage ---
FROM node:18
WORKDIR /app

# Установка зависимостей бэкенда
COPY backend/package*.json ./backend/
RUN cd backend && npm install

# Копируем исходники backend + готовый frontend
COPY backend ./backend
COPY --from=frontend /app/dist ./backend/public

# Запуск
WORKDIR /app/backend
CMD ["node", "index.mjs"]
