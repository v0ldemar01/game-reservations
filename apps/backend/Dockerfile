FROM node:22-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN corepack enable && pnpm install --frozen-lockfile

# Build shared package so apps/backend can resolve @game-reservations/shared
COPY packages/shared ./packages/shared
RUN pnpm --filter @game-reservations/shared build

COPY apps/backend ./apps/backend
RUN pnpm --filter @game-reservations/backend db:generate
RUN pnpm --filter @game-reservations/backend build

FROM node:22-alpine AS runner
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/

RUN corepack enable && pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/node_modules/.prisma ./apps/backend/node_modules/.prisma
COPY apps/backend/prisma ./apps/backend/prisma

WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
