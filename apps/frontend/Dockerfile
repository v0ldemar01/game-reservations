FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/frontend/package.json ./apps/frontend/

RUN corepack enable && pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
RUN pnpm --filter @game-reservations/shared build

COPY apps/frontend ./apps/frontend

# Declare build-time variables; Vite reads them during the build step below
ARG VITE_GRAPHQL_URL=http://localhost:3000/graphql
ARG VITE_API_URL=http://localhost:3000
ENV VITE_GRAPHQL_URL=$VITE_GRAPHQL_URL
ENV VITE_API_URL=$VITE_API_URL

RUN pnpm --filter @game-reservations/frontend build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
