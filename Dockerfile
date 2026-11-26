# syntax=docker/dockerfile:1
# Three stages: build the bundles, install production dependencies, then copy both into a
# distroless image that has no shell and runs as an unprivileged user. Bases are pinned by digest.

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY scripts ./scripts
COPY src ./src
COPY web ./web
COPY public ./public
RUN npm run build

FROM node:25-slim@sha256:81db02c4b671288a03915da9534dbd54f96d0e7c24d80ccc54f5b36b2e684370 AS runtime-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:8ad9cc935b7843c4024b7e1487b5ef472c354ea847b97c667023e2618552607e
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
USER nonroot
EXPOSE 8080
CMD ["dist/server.js"]
