# Build context = repo root (see docker-compose.yml).
# The orchestrator composes the other services' domain logic by importing their
# source, so it ships the whole monorepo and runs via tsx. Third-party deps
# (mcp sdk, neo4j-driver, tsx) are installed at /app so cross-package bare
# imports resolve; @ear-build/shared is mapped via tsconfig paths.
FROM node:20-alpine
RUN apk add --no-cache subversion
WORKDIR /app

COPY package.json ./
COPY shared/ ./shared/
RUN cd shared && npm install && npm run build
RUN npm install

COPY orchestrator/ ./orchestrator/
COPY services/ ./services/

WORKDIR /app/services/mcp-orchestrator
EXPOSE 3000
CMD ["npx", "tsx", "src/index.ts"]
