FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json pnpm-lock.yaml* package-lock.json* ./
RUN npm install

# Copy source files
COPY . .

# Build frontend and backend production bundles
RUN npm run build

# Production Runner
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy necessary files from builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
