# Build context = repo root (see docker-compose.yml). The monorepo layout is
# preserved in the image so the service's `file:../../shared` dependency resolves.
FROM node:20-alpine
WORKDIR /app

COPY shared/ ./shared/
RUN cd shared && npm install && npm run build

COPY services/mcp-jenkins/ ./services/mcp-jenkins/
RUN cd services/mcp-jenkins && npm install && npm run build

WORKDIR /app/services/mcp-jenkins
EXPOSE 3000
CMD ["node", "dist/index.js"]
