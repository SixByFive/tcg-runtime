FROM node:22-alpine

WORKDIR /app

COPY apps/discord-bot/package.json ./
RUN npm install --omit=dev

COPY apps/discord-bot/src ./src

CMD ["node", "src/index.js"]
