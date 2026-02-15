# Stage 1: Build frontend (runs on build platform, output is platform-independent)
FROM --platform=$BUILDPLATFORM node:25-alpine AS frontend-builder

WORKDIR /app/web

# Copy package files first for better caching
COPY web/package.json web/package-lock.json ./
RUN npm ci --silent

# Copy source and build
COPY web/ ./
RUN npm run build


# Stage 2: Build backend
FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend-builder

ARG TARGETARCH

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files first for better caching
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build for target architecture
COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=${TARGETARCH} go build -ldflags="-w -s" -o /app/server ./cmd/server


# Stage 3: Production runtime
FROM alpine:3.21

WORKDIR /app

# Install ca-certificates for HTTPS and tzdata for timezones
RUN apk add --no-cache ca-certificates tzdata

# Create non-root user
RUN adduser -D -u 1000 appuser

# Copy binary from backend builder
COPY --from=backend-builder /app/server ./server

# Copy static files from frontend builder
COPY --from=frontend-builder /app/web/dist ./static

# Set ownership
RUN chown -R appuser:appuser /app

USER appuser

# Environment defaults
ENV PORT=8080 \
    HOST=0.0.0.0 \
    STATIC_DIR=/app/static \
    ENV=production

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

ENTRYPOINT ["./server"]
