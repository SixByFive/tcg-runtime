FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/gateway ./apps/gateway
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile

EXPOSE 4010

CMD ["pnpm", "--filter", "@sbf/gateway", "start"]