.PHONY: build run sqlc-generate tidy

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

sqlc-generate:
	cd db && sqlc generate

tidy:
	go mod tidy
