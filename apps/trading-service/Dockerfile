FROM node:20-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/trading-service ./apps/trading-service
COPY packages ./packages
COPY env ./env

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
RUN pnpm install --no-frozen-lockfile

VOLUME ["/var/uploads"]

EXPOSE 4015

CMD ["pnpm", "--filter", "@sbf/trading-service", "start"]
