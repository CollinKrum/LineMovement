# ---------- 1) Build stage ----------
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (npm). If you use pnpm/yarn, say the word and I'll swap it.
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY tsconfig.json ./
COPY server ./server
# (add any other src folders you use)
RUN npm run build   # expects "build": "tsc" in package.json

# ---------- 2) Runtime stage ----------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Only prod deps
COPY package*.json ./
RUN npm ci --omit=dev

# Bring over the compiled JS
COPY --from=builder /app/dist ./dist

# Healthcheck (optional, shows healthy in Cloud Run)
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "process.exit(0)"

EXPOSE 8080
CMD ["node", "dist/server/index.js"]
