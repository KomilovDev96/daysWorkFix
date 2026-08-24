FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# По умолчанию client стучится в /api (его проксирует Caddy в api:5001)
ARG VITE_API_URL=/
ENV VITE_API_URL=$VITE_API_URL

# Явный лимит heap V8 — на слабых хостах Node иначе занижает его сам и падает по OOM
ENV NODE_OPTIONS=--max-old-space-size=2048
RUN npm run build

# Раздача статики через nginx
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
