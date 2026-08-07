FROM node:20-bookworm-slim AS base

ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . ./
RUN npx prisma generate && npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Amvera монтирует постоянный диск в эту папку. Next.js раздаёт её как /media/.
# Отдельная копия позволяет заполнить пустой том при первом запуске.
RUN mkdir -p /app/public/media \
  && cp -a /app/public/media /app/media-seed \
  && chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/bin/sh", "/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
