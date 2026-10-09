# Этап 1: Сборка
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Этап 2: Запуск
FROM node:20-alpine

WORKDIR /app

# Копируем package.json и устанавливаем production зависимости
COPY package*.json ./
RUN npm install --only=production

# Копируем собранное приложение
COPY --from=builder /app/dist ./dist

# Копируем server.js
COPY server.js ./

# Устанавливаем express (если не установлен)
RUN npm install express dotenv --save-prod 2>/dev/null || true

EXPOSE 8080

# Запуск сервера
CMD ["node", "server.js"]
