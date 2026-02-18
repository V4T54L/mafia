# Mafia Game - Makefile

.PHONY: dev build run clean docker-build docker-push docker-run help

# Variables
DOCKER_IMAGE := ditto512/someone-is-lying
VERSION ?= v1.2.0

# Development
dev: ## Run backend and frontend in development mode
	@echo "Starting backend..."
	@go run cmd/server/main.go &
	@echo "Starting frontend..."
	@cd web && npm run dev

dev-backend: ## Run backend only
	go run cmd/server/main.go

dev-frontend: ## Run frontend only
	cd web && npm run dev

# Build
build: build-frontend build-backend ## Build both frontend and backend

build-frontend: ## Build frontend
	cd web && npm run build

build-backend: ## Build backend binary
	CGO_ENABLED=0 go build -ldflags="-w -s" -o bin/server ./cmd/server

# Run
run: build ## Build and run production server
	./bin/server

# Clean
clean: ## Clean build artifacts
	rm -rf bin/
	rm -rf web/dist/

# Docker
docker-build: ## Build Docker image for linux/amd64
	docker build --platform linux/amd64 -t $(DOCKER_IMAGE):latest -t $(DOCKER_IMAGE):$(VERSION) .

docker-push: ## Push Docker image to DockerHub
	docker push $(DOCKER_IMAGE):latest
	docker push $(DOCKER_IMAGE):$(VERSION)

docker-run: ## Run Docker container locally
	docker run -p 8080:8080 $(DOCKER_IMAGE):latest

docker-all: docker-build docker-push ## Build and push Docker image

# Dependencies
deps: ## Install all dependencies
	go mod download
	cd web && npm install

# Lint
lint: ## Run linters
	cd web && npm run lint

# Help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
