.PHONY: up down build logs clean install dev validate-neo4j validate-jenkins

# Jenkins host port (override if 8080 is taken: `make up JENKINS_PORT=8085`)
JENKINS_PORT ?= 8080
export JENKINS_PORT

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

logs:
	docker compose logs -f

logs-jenkins:
	docker compose logs -f mcp-jenkins

logs-graphify:
	docker compose logs -f mcp-graphify

clean:
	docker compose down -v --remove-orphans

install:
	cd shared && npm install && npm run build
	cd services/mcp-jenkins && npm install
	cd services/mcp-jira && npm install
	cd services/mcp-svn && npm install
	cd services/mcp-graphify && npm install

dev:
	cd shared && npm run build
	@echo "Starting all MCP servers in dev mode..."
	@echo "Run each service with: cd services/mcp-<name> && npm run dev"

status:
	docker compose ps

# Validate the real outbound adapters against live containers.
validate-neo4j:
	docker compose up -d neo4j && npm run validate:neo4j

validate-jenkins:
	docker compose up -d jenkins && JENKINS_URL=http://localhost:$(JENKINS_PORT) npm run validate:jenkins

health:
	@echo "=== Jenkins ===" && curl -sf http://localhost:$(JENKINS_PORT)/login > /dev/null && echo "OK" || echo "FAIL"
	@echo "=== Jira ===" && curl -sf http://localhost:8090/status > /dev/null && echo "OK" || echo "FAIL"
	@echo "=== Neo4j ===" && curl -sf http://localhost:7474 > /dev/null && echo "OK" || echo "FAIL"
	@echo "=== SVN ===" && svn info svn://localhost/test-repo --non-interactive 2>/dev/null && echo "OK" || echo "FAIL"
