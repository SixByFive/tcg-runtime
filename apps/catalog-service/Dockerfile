FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/catalog-service ./apps/catalog-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4012

CMD ["pnpm", "--filter", "@sbf/catalog-service", "start"]
