# Standard multi-stage Distroless/Alpine Node build
# NOTE: This Dockerfile expects the build context to be its own directory.
# Usage: docker build -t ois-mcp-portal .

FROM node:22-alpine AS builder

WORKDIR /app/mcp-portal

# Copy the Portal codebase
COPY . .

# Install dependencies for the portal
RUN npm install
# Prune development dependencies to minimize instructional mass
RUN npm prune --production

# Stage 2: Runtime (distroless/alpine)
FROM node:22-alpine

WORKDIR /app/mcp-portal

# Copy the exact logic from the builder stage
COPY --from=builder /app/mcp-portal .

# Create mount points for the physical state (Sovereign Volumes)
RUN mkdir -p /ois/org /ois/storage/anchors

# Bind the execution logic to the physical mount paths
ENV OIS_ROOT_PATH="/ois/org"
ENV OIS_STORAGE_PATH="/ois/storage/anchors"

EXPOSE 3000

# Execute the Portal Gateway
ENTRYPOINT ["node", "src/index.js"]
