FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat
RUN npm install -g pnpm@10.11.1

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/storefront/package.json ./apps/storefront/

RUN pnpm install --frozen-lockfile --filter=@dtc/storefront...

COPY apps/storefront ./apps/storefront

ARG NEXT_PUBLIC_MEDUSA_BACKEND_URL
ARG NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_DEFAULT_REGION=us
ARG NEXT_PUBLIC_STRIPE_KEY

ENV NEXT_PUBLIC_MEDUSA_BACKEND_URL=$NEXT_PUBLIC_MEDUSA_BACKEND_URL
ENV NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=$NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_DEFAULT_REGION=$NEXT_PUBLIC_DEFAULT_REGION
ENV NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY

WORKDIR /app/apps/storefront
RUN pnpm build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
RUN npm install -g pnpm@10.11.1

COPY --from=builder /app ./

WORKDIR /app/apps/storefront
EXPOSE 8000

CMD ["pnpm", "start"]
