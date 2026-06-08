FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/docker-mgmt ./apps/docker-mgmt
COPY packages ./packages

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4030

CMD ["pnpm", "--filter", "@sbf/docker-mgmt", "start"]
