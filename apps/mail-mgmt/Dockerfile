FROM node:22-alpine

WORKDIR /workspace

COPY package.json pnpm-workspace.yaml ./
COPY apps/mail-mgmt ./apps/mail-mgmt
COPY packages ./packages

RUN npm install -g pnpm && pnpm install --no-frozen-lockfile

EXPOSE 4031

CMD ["pnpm", "--filter", "@sbf/mail-mgmt", "start"]
