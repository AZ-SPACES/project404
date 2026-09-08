# Defense scoring app — built on the droplet by the deploy workflow.
#
# Three stages so the runtime image carries neither the toolchain nor the dev
# dependencies: only Next's standalone output, which is server.js plus the
# subset of node_modules its tracer actually found reachable.

FROM node:22-alpine AS deps
WORKDIR /app
# package-lock.json is committed, so `npm ci` gives the same tree the local
# build was verified against. Copying only the manifests keeps this layer
# cached across source-only changes.
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Every route is `export const dynamic = "force-dynamic"`, so nothing is
# prerendered and the build never opens a database connection. That is what
# lets this run on a builder with no access to defense-db.
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# The roster seed is not part of the traced server bundle, but it has to be
# runnable against the live database:
#   docker compose exec evaluations node db/seed.mjs
# It resolves `pg` from /app/node_modules, which the standalone output already
# contains because lib/db.ts imports it.
COPY --from=build /app/db ./db
COPY --from=build /app/data ./data

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
