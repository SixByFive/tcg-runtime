FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config  ./packages/config
COPY packages/logger  ./packages/logger
COPY apps/realtime-service ./apps/realtime-service
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile --filter @sbf/realtime-service...

WORKDIR /app/apps/realtime-service

EXPOSE 4018

CMD ["node", "src/index.js"]
