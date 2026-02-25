# ---- build stage ----
FROM golang:1.24-alpine AS builder

WORKDIR /app
ENV GOTOOLCHAIN=auto
COPY go.mod go.sum ./
RUN go mod download
COPY . .

RUN GOMAXPROCS=1 CGO_ENABLED=0 GOOS=linux go build -o /server ./cmd/server

# ---- runtime stage ----
FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=builder /server /server

EXPOSE 8080
USER nonroot:nonroot
ENTRYPOINT ["/server"]
