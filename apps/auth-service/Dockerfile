FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/auth-service ./apps/auth-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm@9 && pnpm install --no-frozen-lockfile

EXPOSE 4011

CMD ["pnpm", "--filter", "@sbf/auth-service", "start"]
