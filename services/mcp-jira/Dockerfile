# Build context = repo root (see docker-compose.yml).
FROM node:20-alpine
WORKDIR /app

COPY shared/ ./shared/
RUN cd shared && npm install && npm run build

COPY services/mcp-jira/ ./services/mcp-jira/
RUN cd services/mcp-jira && npm install && npm run build

WORKDIR /app/services/mcp-jira
EXPOSE 3000
CMD ["node", "dist/index.js"]
