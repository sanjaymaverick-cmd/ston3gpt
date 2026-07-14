# StoneOS backend — multi-stage build. Final image is small (only prod
# deps + compiled JS + generated Prisma client), not the whole build toolchain.

FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache openssl

# Install ALL deps (including dev) — needed for `nest build` and `prisma generate`.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Production stage ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache openssl

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci --omit=dev

# Prisma's generated client is version-matched to the schema — copy it
# rather than regenerating in the slim stage (keeps this stage free of
# devDependencies like the Prisma CLI itself).
COPY --chown=node:node --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=node:node --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node prisma ./prisma

USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/src/main.js"]
