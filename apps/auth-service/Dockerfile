FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages
COPY env ./env

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
RUN pnpm install --no-frozen-lockfile

EXPOSE 4011

CMD ["pnpm", "--filter", "@sbf/auth-service", "start"]