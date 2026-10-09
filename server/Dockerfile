# Built from the repository root (it reuses the app's calendar code from src/):
#   docker build -f server/Dockerfile .
# Dockerfile.dockerignore next to this file keeps everything else out of the build context.
FROM node:24-alpine
WORKDIR /app
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY src/models ./src/models
COPY src/utils ./src/utils
COPY src/services/occurrences.ts src/services/eventTimes.ts ./src/services/
COPY server/src ./server/src
# Node runs the TypeScript directly (type stripping); register.js resolves the app's imports.
ENV NODE_ENV=production PORT=2290 DATA_DIR=/data TZ=UTC
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 2290
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:2290/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "--import", "./server/src/register.js", "server/src/main.ts"]
