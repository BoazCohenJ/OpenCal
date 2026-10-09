FROM node:24-alpine
WORKDIR /app
# Runs the TypeScript directly (Node strips the types); no dependencies to install.
COPY package.json ./
COPY src ./src
ENV NODE_ENV=production PORT=2290 DATA_DIR=/data
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 2290
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:2290/api/health || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "src/main.ts"]
