# Build context = repo root (see docker-compose.yml). Needs the svn client at runtime.
FROM node:20-alpine
RUN apk add --no-cache subversion
WORKDIR /app

COPY shared/ ./shared/
RUN cd shared && npm install && npm run build

COPY services/mcp-svn/ ./services/mcp-svn/
RUN cd services/mcp-svn && npm install && npm run build

WORKDIR /app/services/mcp-svn
EXPOSE 3000
CMD ["node", "dist/index.js"]
