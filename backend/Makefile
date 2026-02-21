.PHONY: build run sqlc-generate migrate

build:
	go build -o bin/server ./cmd/server

run:
	go run ./cmd/server

sqlc-generate:
	cd db && sqlc generate

tidy:
	go mod tidy
