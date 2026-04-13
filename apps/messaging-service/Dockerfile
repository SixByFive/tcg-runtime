FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/messaging-service ./apps/messaging-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4022

CMD ["pnpm", "--filter", "@sbf/messaging-service", "start"]
