# ---- deps stage ----
FROM node:24-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline

# ---- build stage ----
FROM node:24-alpine AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN NODE_OPTIONS='--max-old-space-size=512' npm run build

# ---- runtime stage ----
FROM node:24-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3002
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
