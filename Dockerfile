# ---- Stage 1: Build frontend ----
FROM node:22-alpine AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Stage 2: Build backend ----
FROM golang:1.24-alpine AS backend-builder

ARG VERSION=dev
ARG COMMIT=unknown

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend-builder /app/web ./web

RUN CGO_ENABLED=0 go build -trimpath \
    -ldflags "-s -w \
      -X github.com/hxuanyu/lifelog/internal/version.Version=${VERSION} \
      -X github.com/hxuanyu/lifelog/internal/version.CommitHash=${COMMIT}" \
    -o /lifelog .

# ---- Stage 3: Final image ----
FROM alpine:3.21

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=backend-builder /lifelog /app/lifelog

RUN mkdir -p /app/data /app/logs

EXPOSE 8080 8081

ENTRYPOINT ["/app/lifelog"]
