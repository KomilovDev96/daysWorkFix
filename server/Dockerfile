FROM node:20-alpine

WORKDIR /app

# Зависимости (cacheable layer)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Код
COPY . .

# uploads хранятся на volume
RUN mkdir -p uploads

ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001

CMD ["node", "server.js"]
