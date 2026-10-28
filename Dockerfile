# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS manifests
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json

FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts --no-audit --no-fund
COPY apps ./apps
COPY packages ./packages
COPY prisma ./prisma
RUN npm run build:shared && npx prisma generate && npm run build -w @fsp/api
# Compile seed so the init container does not need tsx.
RUN npx tsc prisma/seed.ts --outDir seed-dist --rootDir . --module commonjs --target ES2022 --esModuleInterop --skipLibCheck
ENV DOCKER_BUILD=true NEXT_PUBLIC_API_URL=/api
RUN npm run build -w @fsp/web

FROM manifests AS api-deps
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@fsp/api --include-workspace-root --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund

FROM base AS api
ENV NODE_ENV=production API_PORT=4000
COPY --from=api-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/assets ./apps/api/assets
COPY --from=build /app/packages/shared ./packages/shared
COPY scripts/docker-entry.mjs ./scripts/docker-entry.mjs
USER node
EXPOSE 4000
CMD ["node", "scripts/docker-entry.mjs", "api"]

# Prisma CLI exists only in this one-shot migration container.
FROM manifests AS init-deps
RUN --mount=type=cache,target=/root/.npm npm ci --workspace=@fsp/api --include-workspace-root --omit=dev --ignore-scripts --no-audit --no-fund

FROM base AS init
COPY --from=init-deps /app/node_modules ./node_modules
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/seed-dist ./seed-dist
COPY prisma ./prisma
COPY scripts/docker-entry.mjs ./scripts/docker-entry.mjs
USER node
CMD ["node", "scripts/docker-entry.mjs", "init"]

FROM base AS web
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
