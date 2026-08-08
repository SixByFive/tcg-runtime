FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/media-service ./apps/media-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile

EXPOSE 4017

CMD ["pnpm", "--filter", "@sbf/media-service", "start"]
