FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/user-service ./apps/user-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4021

CMD ["pnpm", "--filter", "@sbf/user-service", "start"]
