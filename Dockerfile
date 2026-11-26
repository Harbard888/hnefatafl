FROM node:24-slim

WORKDIR /app

COPY packages/core-engine packages/core-engine
RUN cd packages/core-engine && npm ci && npm run build && npm prune --omit=dev

COPY packages/backend packages/backend
RUN cd packages/backend && npm ci && npm run build && npm prune --omit=dev

COPY packages/web packages/web
RUN cd packages/web && npm ci && npm run build

ENV NODE_ENV=production \
    PORT=3001 \
    WEB_DIST=/app/packages/web/dist

EXPOSE 3001
WORKDIR /app/packages/backend
CMD ["node", "dist/server.js"]
