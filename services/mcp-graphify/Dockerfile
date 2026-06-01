# Build context = repo root (see docker-compose.yml).
FROM node:20-alpine
WORKDIR /app

COPY shared/ ./shared/
RUN cd shared && npm install && npm run build

COPY services/mcp-graphify/ ./services/mcp-graphify/
RUN cd services/mcp-graphify && npm install && npm run build

WORKDIR /app/services/mcp-graphify
EXPOSE 3000
CMD ["node", "dist/index.js"]
