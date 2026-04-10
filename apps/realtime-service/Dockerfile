FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config  ./packages/config
COPY packages/logger  ./packages/logger
COPY apps/realtime-service ./apps/realtime-service

RUN npm install -g pnpm && pnpm install --frozen-lockfile --filter @sbf/realtime-service...

WORKDIR /app/apps/realtime-service

EXPOSE 4018

CMD ["node", "src/index.js"]
