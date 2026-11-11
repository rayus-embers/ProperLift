# ---- build stage: install production dependencies only ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# ---- runtime stage: small image, non-root user ----
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# The "node" user (uid 1000) already exists in the official image.
USER 1000:1000
EXPOSE 8080
# Run node directly (not "npm start") so SIGTERM reaches the process and
# graceful shutdown works during rolling updates and node drains.
CMD ["node", "src/server.js"]
