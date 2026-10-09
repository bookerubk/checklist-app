# syntax=docker/dockerfile:1.6
# CheckList-1С webapp — Yandex Serverless Containers (test/prod)

# ---------- build ----------
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY index.html vite.config.ts tsconfig.json metadata.json ./
COPY public ./public
COPY src ./src

ARG VITE_SHOW_DEMO_PROFILES=true
ARG VITE_APP_ENV=test
ENV VITE_SHOW_DEMO_PROFILES=$VITE_SHOW_DEMO_PROFILES
ENV VITE_APP_ENV=$VITE_APP_ENV

RUN npm run build

# ---------- runtime ----------
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080
ENV APP_ENV=test

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
  && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY server.js ./

# Serverless Containers: listen 0.0.0.0:8080
EXPOSE 8080
USER node
CMD ["node", "server.js"]
