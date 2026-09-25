FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache python3 make g++
RUN npm install -g pnpm@10.11.1

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/backend/package.json ./apps/backend/

RUN pnpm install --frozen-lockfile --filter=@dtc/backend...

COPY apps/backend ./apps/backend

WORKDIR /app/apps/backend
RUN pnpm build && \
    if [ -d ".medusa/server/public" ]; then \
      mkdir -p public && cp -rn .medusa/server/public/* public/ 2>/dev/null || true; \
      mkdir -p .medusa/admin && cp -rn .medusa/server/public/* .medusa/admin/ 2>/dev/null || true; \
    fi

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
RUN npm install -g pnpm@10.11.1

COPY --from=builder /app ./

WORKDIR /app/apps/backend

EXPOSE 9000

CMD ["sh", "-c", "pnpm medusa db:migrate && (find . -name 'index.html' | grep -q 'index.html' || pnpm medusa build) && pnpm medusa start"]
