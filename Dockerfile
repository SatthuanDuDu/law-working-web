FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma-cms ./prisma-cms
# prisma generate (postinstall) needs the env var present even without a live DB
ENV CMS_DATABASE_URL="postgresql://nslaw_web:unused@localhost:5432/luat_work?schema=cms"
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Dummy URL so prisma generate --schema=prisma-cms succeeds without real DB
ARG CMS_DATABASE_URL="postgresql://nslaw_web:unused@localhost:5432/luat_work?schema=cms"
ENV CMS_DATABASE_URL=$CMS_DATABASE_URL
RUN npm run db:generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 -G nodejs nextjs

# Own files as nextjs at copy time so image-cache mkdir works at runtime.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma-cms ./prisma-cms
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# CMS Prisma client (generated under src/generated — may be outside standalone)
COPY --from=builder --chown=nextjs:nodejs /app/src/generated ./src/generated

USER nextjs
RUN mkdir -p /app/.next/cache
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
