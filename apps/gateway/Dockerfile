FROM node:20-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/gateway ./apps/gateway
COPY packages ./packages
COPY env ./env

RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
RUN pnpm install --no-frozen-lockfile

EXPOSE 4010

CMD ["pnpm", "--filter", "@sbf/gateway", "start"]