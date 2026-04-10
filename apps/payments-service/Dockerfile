FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config    ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/database  ./packages/database
COPY packages/logger    ./packages/logger
COPY apps/payments-service ./apps/payments-service
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile --filter @sbf/payments-service...

WORKDIR /app/apps/payments-service

EXPOSE 4019

CMD ["node", "src/index.js"]
