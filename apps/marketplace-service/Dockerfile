FROM node:22-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/config    ./packages/config
COPY packages/contracts ./packages/contracts
COPY packages/database  ./packages/database
COPY packages/logger    ./packages/logger
COPY apps/marketplace-service ./apps/marketplace-service

RUN npm install -g pnpm && pnpm install --frozen-lockfile --filter @sbf/marketplace-service...

WORKDIR /app/apps/marketplace-service

EXPOSE 4014

CMD ["node", "src/index.js"]
