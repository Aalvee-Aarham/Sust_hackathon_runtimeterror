FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY .env.example ./.env.example

EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "src/index.js"]
