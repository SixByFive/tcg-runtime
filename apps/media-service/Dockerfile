FROM node:22-alpine

# sharp requires build tools
RUN apk add --no-cache vips-dev build-base python3

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/media-service ./apps/media-service
COPY packages ./packages
COPY env ./env

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

# Persistent upload volume
VOLUME ["/var/uploads"]

EXPOSE 4017

CMD ["pnpm", "--filter", "@sbf/media-service", "start"]
