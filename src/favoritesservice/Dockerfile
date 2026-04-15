# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

ARG BUILDPLATFORM=linux/amd64

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS builder
ARG TARGETOS=linux
ARG TARGETARCH=arm64
WORKDIR /src

# Copy go mod files
COPY favoritesservice/go.mod favoritesservice/go.sum* ./

# Copy frontend module for proto dependencies (needed for replace directive)
COPY frontend /frontend

# Download dependencies
RUN go mod download

# Copy source
COPY favoritesservice/ .

# Build
RUN GOOS=${TARGETOS} GOARCH=${TARGETARCH} CGO_ENABLED=0 go build -ldflags="-s -w" -o /go/bin/favoritesservice .

# Runtime image
FROM gcr.io/distroless/static
WORKDIR /src
COPY --from=builder /go/bin/favoritesservice /src/server

EXPOSE 50052
ENTRYPOINT ["/src/server"]
