FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/collections-service ./apps/collections-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4013

CMD ["pnpm", "--filter", "@sbf/collections-service", "start"]
