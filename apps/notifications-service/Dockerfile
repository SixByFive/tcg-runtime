FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/notifications-service ./apps/notifications-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile

EXPOSE 4016

CMD ["pnpm", "--filter", "@sbf/notifications-service", "start"]
