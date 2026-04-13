FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/shipping-service ./apps/shipping-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4023

CMD ["pnpm", "--filter", "@sbf/shipping-service", "start"]
