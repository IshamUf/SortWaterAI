# --- Frontend Stage ----------------------------------------------------------
FROM node:18 AS frontend
WORKDIR /app

# зависимости фронтенда
COPY package*.json ./
RUN npm ci \
 && npm audit signatures

# исходники + билд
COPY . .
RUN npm run build

# --- Backend Stage -----------------------------------------------------------
FROM node:18
WORKDIR /app

# зависимости бэкенда
COPY backend/package*.json ./backend/
RUN cd backend \
 && npm ci --omit=dev \
 && npm audit signatures           # проверяем уязвимости

# копируем исходники backend и итоговый фронт
COPY backend ./backend
COPY --from=frontend /app/dist ./backend/public

WORKDIR /app/backend
CMD ["node", "index.mjs"]
