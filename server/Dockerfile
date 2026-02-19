FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY src/db/prisma ./src/db/prisma/

ENV NODE_ENV=development
RUN npm ci
ENV NODE_ENV=production

RUN npx prisma generate --schema=./src/db/prisma/schema.prisma

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src/db/prisma ./src/db/prisma
COPY --from=builder /app/public ./public

USER appuser
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy --schema=./src/db/prisma/schema.prisma && node dist/index.js"]
