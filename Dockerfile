# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22-alpine
ARG GO_VERSION=1.26-alpine
ARG ALPINE_VERSION=3.21

# Build frontend on the host architecture so multi-arch image builds do not
# spend time emulating Node.js for every target platform.
FROM --platform=$BUILDPLATFORM node:${NODE_VERSION} AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --prefer-offline

COPY frontend/ ./
RUN npm run build

# Cross-compile the Go binary on the host architecture as well. Buildx injects
# TARGETOS/TARGETARCH so we can emit the right binary without QEMU.
FROM --platform=$BUILDPLATFORM golang:${GO_VERSION} AS backend-builder

ARG VERSION=dev
ARG COMMIT=unknown
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src

COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod \
    go mod download

COPY main.go ./
COPY docs ./docs
COPY internal ./internal
COPY --from=frontend-builder /app/web ./web

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 \
    GOOS=${TARGETOS:-linux} \
    GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath \
      -ldflags "-s -w \
        -X github.com/hxuanyu/lifelog/internal/version.Version=${VERSION} \
        -X github.com/hxuanyu/lifelog/internal/version.CommitHash=${COMMIT}" \
      -o /out/lifelog .

# Prepare runtime assets on the host architecture too, then copy them into a
# minimal final image. This avoids target-platform RUN steps entirely.
FROM --platform=$BUILDPLATFORM alpine:${ALPINE_VERSION} AS runtime-assets

RUN apk add --no-cache ca-certificates tzdata \
    && mkdir -p /out/app/data /out/app/logs

FROM scratch

WORKDIR /app

COPY --from=runtime-assets /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=runtime-assets /usr/share/zoneinfo /usr/share/zoneinfo
COPY --from=runtime-assets /out/app/data /app/data
COPY --from=runtime-assets /out/app/logs /app/logs
COPY --from=backend-builder /out/lifelog /app/lifelog

EXPOSE 8080 8081

ENTRYPOINT ["/app/lifelog"]
