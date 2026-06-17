FROM node:22.21-alpine3.21 AS builder
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN apk add --no-cache openssl && corepack enable

FROM builder AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/backend/package.json ./apps/backend/
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM deps AS build
COPY packages/shared ./packages/shared
RUN pnpm --filter @game-reservations/shared build

COPY apps/backend ./apps/backend
RUN pnpm --filter @game-reservations/backend db:generate
RUN pnpm --filter @game-reservations/backend build

FROM builder AS runtime
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S -G app app

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/backend/node_modules ./apps/backend/node_modules
COPY apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY package.json pnpm-workspace.yaml ./

RUN chown -R app:app /app
USER app

WORKDIR /app/apps/backend
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', r => r.statusCode === 200 ? process.exit(0) : process.exit(1)).on('error', () => process.exit(1))"
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/main"]
