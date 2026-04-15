#!/bin/bash
# Script para regenerar los archivos proto compilados usando Docker

set -e

PROJECT_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
PROTOS_DIR="$PROJECT_ROOT/protos"
FRONTEND_DIR="$PROJECT_ROOT/src/frontend"

echo "🔧 Regenerando proto files..."

# Usar imagen Docker con protoc preinstalado
docker run --rm \
  -v "$PROJECT_ROOT:/workspace" \
  -w /workspace \
  python:3.11-slim bash -c '
    apt-get update && apt-get install -y protobuf-compiler golang-any git && \
    go install google.golang.org/protobuf/cmd/protoc-gen-go@latest && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@latest && \
    export PATH=$PATH:$(go env GOPATH)/bin && \
    cd /workspace/src/frontend && \
    protoc \
      --go_out=. \
      --go-grpc_out=. \
      --go_opt=module=github.com/GoogleCloudPlatform/microservices-demo/src/frontend \
      --go-grpc_opt=module=github.com/GoogleCloudPlatform/microservices-demo/src/frontend \
      -I/workspace/protos \
      /workspace/protos/demo.proto
  '

echo "✅ Proto files regenerated successfully!"
echo "📁 Generated files:"
ls -la "$FRONTEND_DIR/genproto/"demo*.go
