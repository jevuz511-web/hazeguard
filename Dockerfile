# syntax=docker/dockerfile:1
# Three stages: build the bundles, install production dependencies, then copy both into a
# distroless image that has no shell and runs as an unprivileged user. Bases are pinned by digest.

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY scripts ./scripts
COPY src ./src
COPY web ./web
COPY public ./public
RUN npm run build

FROM node:22-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da AS runtime-deps
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

FROM gcr.io/distroless/nodejs22-debian13:nonroot@sha256:c73ddeb03e1dc2d579aa111c83d6699c6b8b487e35c0c631d4a3a20229fc25ee
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=runtime-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/dist ./dist
USER nonroot
EXPOSE 8080
CMD ["dist/server.js"]
