# 🤗 Dockerfile — Hugging Face Spaces
# ------------------------------------
# Build: install deps → build Next.js → jalanin production server
# HF Spaces jalanin container ini di port 7860 (wajib!).

# ── Stage 1: Build ────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Copy dependency files dulu (cache layer npm install)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source & build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Stage 2: Runtime ──────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=7860

# Copy hasil build + deps production
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# HF persistent storage: data aman di sini (jangan di project!)
ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 7860

CMD ["npm", "start"]
