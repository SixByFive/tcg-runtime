FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/trading-service ./apps/trading-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

VOLUME ["/var/uploads"]

EXPOSE 4015

CMD ["pnpm", "--filter", "@sbf/trading-service", "start"]
