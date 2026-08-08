FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config    ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/database  ./packages/database
COPY packages/logger    ./packages/logger
COPY apps/worker-service ./apps/worker-service
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile --filter @sbf/worker-service...

WORKDIR /app/apps/worker-service

EXPOSE 4020

CMD ["node", "src/index.js"]
